#!/usr/bin/env node
// ==========================================
// ClawShield CLI
// ==========================================

import { Command } from 'commander';
import chalk from 'chalk';
import { preflightCommand } from './commands/preflight';
import { installCommand } from './commands/install';
import { scanCommand } from './commands/scan';
import { configCommand } from './commands/config';
import { runCommand } from './commands/run';

const program = new Command();

console.log(chalk.cyan(`
╔═══════════════════════════════════════════════════════╗
║  🛡️  ClawShield - Security for OpenClaw Skills        ║
╚═══════════════════════════════════════════════════════╝
`));

program
    .name('clawshield')
    .description('Security & permissions layer for OpenClaw skills')
    .version('1.0.0');

// Register commands
program.addCommand(preflightCommand);
program.addCommand(installCommand);
program.addCommand(scanCommand);
program.addCommand(configCommand);
program.addCommand(runCommand);

program.parse();
