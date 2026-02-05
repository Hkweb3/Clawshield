// ==========================================
// Config Command
// ==========================================

import { Command } from 'commander';
import chalk from 'chalk';
import * as fs from 'fs';
import * as path from 'path';
import { DEFAULT_CLAWSHIELD_PATH, CONFIG_FILE } from '@clawshield/shared';
import { ClawShieldConfig } from '@clawshield/shared';

export const configCommand = new Command('config')
    .description('Show or edit ClawShield configuration')
    .option('--show', 'Show current configuration')
    .option('--path', 'Show config file path')
    .option('--reset', 'Reset to default configuration')
    .action(async (options: { show?: boolean; path?: boolean; reset?: boolean }) => {
        const configPath = path.join(DEFAULT_CLAWSHIELD_PATH, CONFIG_FILE);

        if (options.path) {
            console.log(chalk.bold('Config path:'));
            console.log(chalk.cyan(configPath));
            return;
        }

        if (options.reset) {
            const defaultConfig: ClawShieldConfig = {
                workspacePaths: [],
                defaultPolicy: {
                    allowedDirs: [],
                    allowedDomains: [],
                    blockShell: true,
                    blockSecrets: true,
                    blockNetwork: false,
                    blockFsWrite: false,
                },
                enabledSkills: [],
                disabledSkills: [],
            };

            const dir = path.dirname(configPath);
            if (!fs.existsSync(dir)) {
                fs.mkdirSync(dir, { recursive: true });
            }
            fs.writeFileSync(configPath, JSON.stringify(defaultConfig, null, 2));
            console.log(chalk.green('✓ Configuration reset to defaults.'));
            return;
        }

        // Default: show config
        if (!fs.existsSync(configPath)) {
            console.log(chalk.yellow('No configuration file found.'));
            console.log(chalk.gray(`Expected at: ${configPath}`));
            console.log(chalk.gray('\nRun `clawshield config --reset` to create default config.'));
            return;
        }

        try {
            const content = fs.readFileSync(configPath, 'utf-8');
            const config = JSON.parse(content) as ClawShieldConfig;

            console.log(chalk.bold('\n📋 ClawShield Configuration'));
            console.log(chalk.gray('─'.repeat(50)));

            console.log(chalk.bold('\nOpenClaw Path:'));
            console.log(`  ${config.openclawPath || chalk.gray('(auto-detect)')}`);

            console.log(chalk.bold('\nWorkspace Paths:'));
            if (config.workspacePaths.length === 0) {
                console.log(chalk.gray('  (none configured)'));
            } else {
                config.workspacePaths.forEach(p => console.log(`  • ${p}`));
            }

            console.log(chalk.bold('\nDefault Policy:'));
            console.log(`  Block Shell: ${config.defaultPolicy.blockShell ? chalk.red('Yes') : chalk.green('No')}`);
            console.log(`  Block Secrets: ${config.defaultPolicy.blockSecrets ? chalk.red('Yes') : chalk.green('No')}`);
            console.log(`  Block Network: ${config.defaultPolicy.blockNetwork ? chalk.red('Yes') : chalk.green('No')}`);
            console.log(`  Block FS Writes: ${config.defaultPolicy.blockFsWrite ? chalk.red('Yes') : chalk.green('No')}`);

            if (config.defaultPolicy.allowedDirs.length > 0) {
                console.log(chalk.bold('\nAllowed Directories:'));
                config.defaultPolicy.allowedDirs.forEach(d => {
                    console.log(`  • ${d.path} (${d.mode})`);
                });
            }

            if (config.defaultPolicy.allowedDomains.length > 0) {
                console.log(chalk.bold('\nAllowed Domains:'));
                config.defaultPolicy.allowedDomains.forEach(d => console.log(`  • ${d}`));
            }

            console.log(chalk.bold('\nSkills Status:'));
            console.log(`  Enabled: ${config.enabledSkills.length}`);
            console.log(`  Disabled: ${config.disabledSkills.length}`);

            console.log(chalk.gray('\n─'.repeat(50)));
            console.log(chalk.gray(`File: ${configPath}`));

        } catch (error) {
            console.error(chalk.red('Error reading config:'), error);
        }
    });
