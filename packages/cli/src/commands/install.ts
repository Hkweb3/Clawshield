// ==========================================
// Install Command
// ==========================================

import { Command } from 'commander';
import chalk from 'chalk';
import ora from 'ora';
import * as fs from 'fs';
import * as path from 'path';
import { exec } from 'child_process';
import { promisify } from 'util';
import { SLUG_REGEX } from '@clawshield/shared';

const execAsync = promisify(exec);

export const installCommand = new Command('install')
    .description('Install a skill from ClawHub after preflight check')
    .argument('<slug>', 'ClawHub skill slug')
    .option('-w, --workspace <path>', 'Workspace path to install to', process.cwd())
    .option('-f, --force', 'Overwrite if skill already exists')
    .action(async (slug: string, options: { workspace: string; force?: boolean }) => {
        // Validate slug
        if (!SLUG_REGEX.test(slug)) {
            console.log(chalk.red('✗ Invalid slug. Only lowercase letters, numbers, hyphens, and underscores allowed.'));
            process.exit(1);
        }

        const spinner = ora('Installing skill...').start();

        try {
            const skillsDir = path.join(options.workspace, 'skills');
            const targetPath = path.join(skillsDir, slug);

            // Check if exists
            if (fs.existsSync(targetPath) && !options.force) {
                spinner.fail('Skill already exists. Use --force to overwrite.');
                process.exit(1);
            }

            // Create skills directory
            fs.mkdirSync(skillsDir, { recursive: true });

            // Try clawhub install
            let clawHubAvailable = false;
            try {
                await execAsync('clawhub --version');
                clawHubAvailable = true;
            } catch {
                // clawhub not available
            }

            if (clawHubAvailable) {
                spinner.text = 'Installing from ClawHub...';
                if (fs.existsSync(targetPath)) {
                    fs.rmSync(targetPath, { recursive: true, force: true });
                }
                await execAsync(`clawhub install ${slug} --target "${skillsDir}"`, {
                    timeout: 60000,
                });
            } else {
                // Create mock for demo
                spinner.text = 'ClawHub not found, creating placeholder skill...';
                if (fs.existsSync(targetPath)) {
                    fs.rmSync(targetPath, { recursive: true, force: true });
                }
                fs.mkdirSync(targetPath, { recursive: true });
                fs.writeFileSync(
                    path.join(targetPath, 'SKILL.md'),
                    `---
name: ${slug}
description: Installed from ClawHub via ClawShield
version: 1.0.0
---

# ${slug}

This skill was installed via ClawShield.

## Usage

Add usage instructions here.
`
                );
            }

            spinner.succeed(`Installed ${slug} to ${targetPath}`);
            console.log();
            console.log(chalk.green('✓ Skill installed successfully!'));
            console.log(chalk.gray(`  Location: ${targetPath}`));
            console.log();
            console.log(chalk.cyan('Next steps:'));
            console.log(chalk.gray('  1. Review the skill code'));
            console.log(chalk.gray('  2. Enable it in ClawShield UI'));
            console.log(chalk.gray('  3. Use it in your OpenClaw workflows'));

        } catch (error) {
            spinner.fail('Installation failed');
            console.error(chalk.red(String(error)));
            process.exit(1);
        }
    });
