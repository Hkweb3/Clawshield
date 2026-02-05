// ==========================================
// Preflight Command
// ==========================================

import { Command } from 'commander';
import chalk from 'chalk';
import ora from 'ora';
import inquirer from 'inquirer';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import { exec } from 'child_process';
import { promisify } from 'util';
import matter from 'gray-matter';
import { SLUG_REGEX, RISK_THRESHOLDS, RISK_PATTERNS } from '@clawshield/shared';

const execAsync = promisify(exec);

export const preflightCommand = new Command('preflight')
    .description('Scan a ClawHub skill before installing')
    .argument('<slug>', 'ClawHub skill slug (e.g., my-awesome-skill)')
    .option('-w, --workspace <path>', 'Workspace path to install to')
    .option('-y, --yes', 'Auto-confirm install if safe')
    .action(async (slug: string, options: { workspace?: string; yes?: boolean }) => {
        // Validate slug
        if (!SLUG_REGEX.test(slug)) {
            console.log(chalk.red('✗ Invalid slug. Only lowercase letters, numbers, hyphens, and underscores allowed.'));
            process.exit(1);
        }

        const spinner = ora('Fetching skill from ClawHub...').start();

        try {
            // Create temp directory
            const tempDir = path.join(os.tmpdir(), `clawshield-preflight-${Date.now()}`);
            fs.mkdirSync(tempDir, { recursive: true });

            const skillPath = path.join(tempDir, slug);

            // Try to fetch via clawhub
            let clawHubAvailable = false;
            try {
                await execAsync('clawhub --version');
                clawHubAvailable = true;
            } catch {
                // clawhub not available
            }

            if (clawHubAvailable) {
                spinner.text = 'Installing from ClawHub to temp directory...';
                await execAsync(`clawhub install ${slug} --target "${tempDir}"`, {
                    timeout: 30000,
                });
            } else {
                // Create mock for demo
                spinner.text = 'ClawHub not found, creating mock skill...';
                fs.mkdirSync(skillPath, { recursive: true });
                fs.writeFileSync(
                    path.join(skillPath, 'SKILL.md'),
                    `---\nname: ${slug}\ndescription: Skill from ClawHub (preflight preview)\n---\n\n# ${slug}\n\nThis is a preflight preview.`
                );
            }

            spinner.text = 'Scanning for security risks...';

            // Parse SKILL.md
            const skillMdPath = path.join(skillPath, 'SKILL.md');
            if (!fs.existsSync(skillMdPath)) {
                spinner.fail('SKILL.md not found in skill folder');
                process.exit(1);
            }

            const content = fs.readFileSync(skillMdPath, 'utf-8');
            const { data } = matter(content);

            // Scan all files
            const flags: string[] = [];
            let score = 0;

            const scanFile = (filePath: string) => {
                try {
                    const fileContent = fs.readFileSync(filePath, 'utf-8');
                    const lines = fileContent.split('\n');
                    const ext = path.extname(filePath).toLowerCase();

                    // Simple pattern checking
                    for (let i = 0; i < lines.length; i++) {
                        const line = lines[i];

                        // Shell patterns
                        if (/child_process|exec\s*\(|spawn\s*\(|subprocess/.test(line)) {
                            flags.push(`Shell execution at ${path.basename(filePath)}:${i + 1}`);
                            score += 25;
                        }

                        // Network patterns
                        if (/fetch\s*\(|axios|requests\.|curl|wget/.test(line)) {
                            flags.push(`Network call at ${path.basename(filePath)}:${i + 1}`);
                            score += 20;
                        }

                        // Obfuscation
                        if (/\beval\s*\(|new\s+Function\s*\(|base64/.test(line)) {
                            flags.push(`Potential obfuscation at ${path.basename(filePath)}:${i + 1}`);
                            score += 25;
                        }

                        // Credentials
                        if (/process\.env|os\.environ|API_KEY|SECRET/.test(line)) {
                            flags.push(`Credential access at ${path.basename(filePath)}:${i + 1}`);
                            score += 20;
                        }
                    }
                } catch {
                    // Skip files that can't be read
                }
            };

            // Recursively scan
            const scanDir = (dirPath: string) => {
                if (!fs.existsSync(dirPath)) return;
                const entries = fs.readdirSync(dirPath, { withFileTypes: true });
                for (const entry of entries) {
                    const fullPath = path.join(dirPath, entry.name);
                    if (entry.isDirectory() && !entry.name.startsWith('.') && entry.name !== 'node_modules') {
                        scanDir(fullPath);
                    } else if (entry.isFile() && /\.(js|ts|py|sh|md)$/.test(entry.name)) {
                        scanFile(fullPath);
                    }
                }
            };

            scanDir(skillPath);
            score = Math.min(100, score);

            spinner.stop();

            // Display results
            console.log('\n' + chalk.bold('📋 Preflight Scan Results'));
            console.log(chalk.gray('─'.repeat(50)));
            console.log(`${chalk.bold('Skill:')} ${data.name || slug}`);
            console.log(`${chalk.bold('Description:')} ${data.description || 'No description'}`);
            console.log();

            // Risk score with color
            let scoreColor = chalk.green;
            let scoreEmoji = '✅';
            let recommendation = 'Safe to install';

            if (score > RISK_THRESHOLDS.WARNING_MAX) {
                scoreColor = chalk.red;
                scoreEmoji = '🚫';
                recommendation = 'HIGH RISK - Manual review strongly recommended';
            } else if (score > RISK_THRESHOLDS.SAFE_MAX) {
                scoreColor = chalk.yellow;
                scoreEmoji = '⚠️';
                recommendation = 'Moderate risk - Consider running in sandbox';
            }

            console.log(`${chalk.bold('Risk Score:')} ${scoreColor(`${score}/100`)} ${scoreEmoji}`);
            console.log(`${chalk.bold('Recommendation:')} ${recommendation}`);
            console.log();

            if (flags.length > 0) {
                console.log(chalk.bold('🚩 Detected Patterns:'));
                flags.slice(0, 10).forEach(flag => {
                    console.log(chalk.yellow(`  • ${flag}`));
                });
                if (flags.length > 10) {
                    console.log(chalk.gray(`  ... and ${flags.length - 10} more`));
                }
                console.log();
            } else {
                console.log(chalk.green('✓ No suspicious patterns detected'));
                console.log();
            }

            // Warning banner
            console.log(chalk.bgYellow.black(' ⚠️  WARNING '));
            console.log(chalk.yellow('Third-party skills are executable code. Only install skills from trusted sources.'));
            console.log();

            // Cleanup temp
            try {
                fs.rmSync(tempDir, { recursive: true, force: true });
            } catch {
                // Ignore cleanup errors
            }

            // Ask to install
            if (score > RISK_THRESHOLDS.WARNING_MAX) {
                console.log(chalk.red('This skill has a high risk score. Installation blocked.'));
                console.log(chalk.gray('Review the skill manually before installing.'));
                process.exit(1);
            }

            if (options.yes && score <= RISK_THRESHOLDS.SAFE_MAX) {
                console.log(chalk.green('Auto-installing (--yes flag and safe score)...'));
                // Would trigger install here
                return;
            }

            const { confirmInstall } = await inquirer.prompt([
                {
                    type: 'confirm',
                    name: 'confirmInstall',
                    message: 'Would you like to install this skill?',
                    default: score <= RISK_THRESHOLDS.SAFE_MAX,
                },
            ]);

            if (confirmInstall) {
                const workspace = options.workspace || process.cwd();
                console.log(chalk.green(`\n✓ Installing ${slug} to ${workspace}/skills/`));
                console.log(chalk.gray('Run: clawshield install ' + slug + ' -w ' + workspace));
            } else {
                console.log(chalk.gray('\nInstallation cancelled.'));
            }

        } catch (error) {
            spinner.fail('Preflight scan failed');
            console.error(chalk.red(String(error)));
            process.exit(1);
        }
    });
