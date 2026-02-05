// ==========================================
// Scan Command
// ==========================================

import { Command } from 'commander';
import chalk from 'chalk';
import ora from 'ora';
import * as fs from 'fs';
import * as path from 'path';
import matter from 'gray-matter';
import { RISK_THRESHOLDS } from '@clawshield/shared';

interface ScanResult {
    name: string;
    path: string;
    score: number;
    flags: string[];
    recommendation: string;
}

export const scanCommand = new Command('scan')
    .description('Scan installed skills for security risks')
    .argument('[path]', 'Path to scan (defaults to ./skills and ~/.openclaw/skills)')
    .option('-v, --verbose', 'Show detailed output')
    .action(async (scanPath?: string, options?: { verbose?: boolean }) => {
        const spinner = ora('Scanning skills...').start();

        try {
            const pathsToScan: string[] = [];

            if (scanPath) {
                pathsToScan.push(scanPath);
            } else {
                // Default paths
                const cwdSkills = path.join(process.cwd(), 'skills');
                const homeSkills = path.join(process.env.HOME || process.env.USERPROFILE || '', '.openclaw', 'skills');

                if (fs.existsSync(cwdSkills)) pathsToScan.push(cwdSkills);
                if (fs.existsSync(homeSkills)) pathsToScan.push(homeSkills);
            }

            if (pathsToScan.length === 0) {
                spinner.info('No skills directories found.');
                console.log(chalk.gray('\nTry:'));
                console.log(chalk.gray('  clawshield scan ./path/to/skills'));
                return;
            }

            const results: ScanResult[] = [];

            for (const basePath of pathsToScan) {
                spinner.text = `Scanning ${basePath}...`;

                if (!fs.existsSync(basePath)) continue;

                const entries = fs.readdirSync(basePath, { withFileTypes: true });

                for (const entry of entries) {
                    if (!entry.isDirectory()) continue;

                    const skillPath = path.join(basePath, entry.name);
                    const skillMdPath = path.join(skillPath, 'SKILL.md');

                    if (!fs.existsSync(skillMdPath)) continue;

                    // Parse skill
                    const content = fs.readFileSync(skillMdPath, 'utf-8');
                    const { data } = matter(content);

                    // Scan for risks
                    const flags: string[] = [];
                    let score = 0;

                    const scanFile = (filePath: string) => {
                        try {
                            const fileContent = fs.readFileSync(filePath, 'utf-8');
                            const lines = fileContent.split('\n');

                            for (let i = 0; i < lines.length; i++) {
                                const line = lines[i];

                                if (/child_process|exec\s*\(|spawn\s*\(|subprocess/.test(line)) {
                                    flags.push(`Shell: ${path.basename(filePath)}:${i + 1}`);
                                    score += 25;
                                }
                                if (/fetch\s*\(|axios|requests\.|curl|wget/.test(line)) {
                                    flags.push(`Network: ${path.basename(filePath)}:${i + 1}`);
                                    score += 20;
                                }
                                if (/\beval\s*\(|new\s+Function\s*\(|base64/.test(line)) {
                                    flags.push(`Obfuscation: ${path.basename(filePath)}:${i + 1}`);
                                    score += 25;
                                }
                                if (/process\.env|os\.environ|API_KEY|SECRET/.test(line)) {
                                    flags.push(`Credentials: ${path.basename(filePath)}:${i + 1}`);
                                    score += 20;
                                }
                            }
                        } catch {
                            // Skip unreadable files
                        }
                    };

                    const scanDir = (dirPath: string) => {
                        if (!fs.existsSync(dirPath)) return;
                        const dirEntries = fs.readdirSync(dirPath, { withFileTypes: true });
                        for (const e of dirEntries) {
                            const fullPath = path.join(dirPath, e.name);
                            if (e.isDirectory() && !e.name.startsWith('.') && e.name !== 'node_modules') {
                                scanDir(fullPath);
                            } else if (e.isFile() && /\.(js|ts|py|sh|md)$/.test(e.name)) {
                                scanFile(fullPath);
                            }
                        }
                    };

                    scanDir(skillPath);
                    score = Math.min(100, score);

                    let recommendation = 'Safe';
                    if (score > RISK_THRESHOLDS.WARNING_MAX) {
                        recommendation = 'Block';
                    } else if (score > RISK_THRESHOLDS.SAFE_MAX) {
                        recommendation = 'Sandbox';
                    }

                    results.push({
                        name: data.name || entry.name,
                        path: skillPath,
                        score,
                        flags,
                        recommendation,
                    });
                }
            }

            spinner.stop();

            if (results.length === 0) {
                console.log(chalk.yellow('No skills found to scan.'));
                return;
            }

            // Display results
            console.log('\n' + chalk.bold('🔍 Scan Results'));
            console.log(chalk.gray('─'.repeat(60)));

            // Sort by score (highest first)
            results.sort((a, b) => b.score - a.score);

            for (const result of results) {
                let scoreColor = chalk.green;
                let badge = '✅';

                if (result.score > RISK_THRESHOLDS.WARNING_MAX) {
                    scoreColor = chalk.red;
                    badge = '🚫';
                } else if (result.score > RISK_THRESHOLDS.SAFE_MAX) {
                    scoreColor = chalk.yellow;
                    badge = '⚠️';
                }

                console.log(`\n${badge} ${chalk.bold(result.name)}`);
                console.log(`   Score: ${scoreColor(String(result.score))} | Action: ${result.recommendation}`);
                console.log(chalk.gray(`   Path: ${result.path}`));

                if (options?.verbose && result.flags.length > 0) {
                    console.log(chalk.gray('   Flags:'));
                    result.flags.slice(0, 5).forEach(f => {
                        console.log(chalk.yellow(`     • ${f}`));
                    });
                    if (result.flags.length > 5) {
                        console.log(chalk.gray(`     ... and ${result.flags.length - 5} more`));
                    }
                }
            }

            // Summary
            console.log('\n' + chalk.gray('─'.repeat(60)));
            const safe = results.filter(r => r.score <= RISK_THRESHOLDS.SAFE_MAX).length;
            const warning = results.filter(r => r.score > RISK_THRESHOLDS.SAFE_MAX && r.score <= RISK_THRESHOLDS.WARNING_MAX).length;
            const danger = results.filter(r => r.score > RISK_THRESHOLDS.WARNING_MAX).length;

            console.log(chalk.bold('Summary:'));
            console.log(`  ${chalk.green('✅ Safe:')} ${safe}`);
            console.log(`  ${chalk.yellow('⚠️ Warning:')} ${warning}`);
            console.log(`  ${chalk.red('🚫 Danger:')} ${danger}`);

        } catch (error) {
            spinner.fail('Scan failed');
            console.error(chalk.red(String(error)));
            process.exit(1);
        }
    });
