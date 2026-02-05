// ==========================================
// Run Command (Runtime Guard)
// ==========================================

import { Command } from 'commander';
import chalk from 'chalk';
import * as fs from 'fs';
import * as path from 'path';
import { spawn } from 'child_process';
import matter from 'gray-matter';
import * as os from 'os';
import { PY_GUARD } from '../sandbox/python-guard';
import { ClawShieldConfig, DEFAULT_CLAWSHIELD_PATH, CONFIG_FILE, AUDIT_FILE } from '@clawshield/shared';

const loadConfig = (): ClawShieldConfig => {
    const configPath = path.join(DEFAULT_CLAWSHIELD_PATH, CONFIG_FILE);
    if (!fs.existsSync(configPath)) {
        return {
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
    }

    try {
        const content = fs.readFileSync(configPath, 'utf-8');
        return JSON.parse(content) as ClawShieldConfig;
    } catch {
        return {
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
    }
};

const detectEntry = (skillPath: string, entry?: string): string | null => {
    if (entry) return entry;
    const skillMdPath = path.join(skillPath, 'SKILL.md');
    if (fs.existsSync(skillMdPath)) {
        try {
            const content = fs.readFileSync(skillMdPath, 'utf-8');
            const { data } = matter(content);
            if (typeof data.entry === 'string') return data.entry;
            if (typeof data.main === 'string') return data.main;
            if (typeof data.script === 'string') return data.script;
        } catch {
            // ignore
        }
    }

    const fallback = ['index.js', 'main.js', 'skill.js', 'index.py', 'main.py', 'skill.py'];
    for (const file of fallback) {
        const candidate = path.join(skillPath, file);
        if (fs.existsSync(candidate)) return file;
    }
    return null;
};

const writePythonGuard = (): string => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'clawshield-guard-'));
    const guardPath = path.join(dir, 'sitecustomize.py');
    fs.writeFileSync(guardPath, PY_GUARD, 'utf-8');
    return dir;
};

export const runCommand = new Command('run')
    .description('Run a skill with the ClawShield runtime guard (Node.js or Python)')
    .argument('<skillPath>', 'Path to the skill folder')
    .option('-e, --entry <file>', 'Entry file relative to skill path (overrides SKILL.md)')
    .option('--arg <arg>', 'Argument passed through to the entry script', (value, prev: string[]) => {
        prev.push(value);
        return prev;
    }, [])
    .option('--audit <level>', 'Audit level: blocked | all', 'blocked')
    .action(async (skillPath: string, options: { entry?: string; arg?: string[]; audit?: string }) => {
        const resolvedPath = path.resolve(skillPath);
        if (!fs.existsSync(resolvedPath)) {
            console.error(chalk.red(`Skill path not found: ${resolvedPath}`));
            process.exit(1);
        }

        const entry = detectEntry(resolvedPath, options.entry);
        if (!entry) {
            console.error(chalk.red('Could not determine skill entry file.'));
            console.log(chalk.gray('Provide --entry <file> or add entry/main to SKILL.md frontmatter.'));
            process.exit(1);
        }

        const entryPath = path.isAbsolute(entry) ? entry : path.join(resolvedPath, entry);
        const entryExt = path.extname(entryPath).toLowerCase();
        if (!fs.existsSync(entryPath)) {
            console.error(chalk.red(`Entry file not found: ${entryPath}`));
            process.exit(1);
        }
        const isNode = ['.js', '.cjs', '.mjs'].includes(entryExt);
        const isPython = entryExt === '.py';
        if (!isNode && !isPython) {
            console.error(chalk.red(`Unsupported entry type: ${entryExt}`));
            console.log(chalk.gray('Only Node.js JavaScript or Python entrypoints are supported by the runtime guard.'));
            process.exit(1);
        }

        const config = loadConfig();
        const policy = {
            allowedDirs: [],
            allowedDomains: [],
            blockShell: true,
            blockSecrets: true,
            blockNetwork: false,
            blockFsWrite: false,
            ...config.defaultPolicy,
        };
        const allowedWriteDirs = policy.allowedDirs
            .filter(d => d.mode === 'readwrite')
            .map(d => d.path);

        const guardPath = path.join(__dirname, '..', 'sandbox', 'node-guard.js');
        if (isNode && !fs.existsSync(guardPath)) {
            console.error(chalk.red('Node runtime guard not found. Run the CLI build first.'));
            process.exit(1);
        }

        const skillId = Buffer.from(resolvedPath).toString('base64url').slice(0, 16);
        const skillName = path.basename(resolvedPath);

        const env = {
            ...process.env,
            CLAWSHIELD_BLOCK_SHELL: policy.blockShell ? '1' : '0',
            CLAWSHIELD_BLOCK_NETWORK: policy.blockNetwork ? '1' : '0',
            CLAWSHIELD_BLOCK_SECRETS: policy.blockSecrets ? '1' : '0',
            CLAWSHIELD_BLOCK_FS_WRITE: policy.blockFsWrite ? '1' : '0',
            CLAWSHIELD_ALLOWED_DIRS: allowedWriteDirs.join(';'),
            CLAWSHIELD_ALLOWED_DOMAINS: policy.allowedDomains.join(','),
            CLAWSHIELD_AUDIT_PATH: path.join(DEFAULT_CLAWSHIELD_PATH, AUDIT_FILE),
            CLAWSHIELD_AUDIT_LEVEL: options.audit || 'blocked',
            CLAWSHIELD_SKILL_ID: skillId,
            CLAWSHIELD_SKILL_NAME: skillName,
        };

        console.log(chalk.cyan('Running skill with ClawShield guard...'));
        console.log(chalk.gray(`  Skill: ${skillName}`));
        console.log(chalk.gray(`  Entry: ${entry}`));

        const args = [...(options.arg || [])];
        let command = 'node';
        let commandArgs = args;
        let pythonGuardDir: string | undefined;

        if (isNode) {
            commandArgs = ['-r', guardPath, entryPath, ...args];
        } else {
            const guardDir = writePythonGuard();
            const pythonPath = process.env.CLAWSHIELD_PYTHON_BIN || 'python';
            env.PYTHONPATH = guardDir + path.delimiter + (process.env.PYTHONPATH || '');
            command = pythonPath;
            commandArgs = [entryPath, ...args];
            pythonGuardDir = guardDir;
        }

        const child = spawn(command, commandArgs, {
            cwd: resolvedPath,
            env,
            stdio: 'inherit',
        });

        child.on('exit', (code) => {
            if (pythonGuardDir) {
                try {
                    fs.rmSync(pythonGuardDir, { recursive: true, force: true });
                } catch {
                    // ignore cleanup errors
                }
            }
            if (code !== 0) {
                console.error(chalk.red(`Skill exited with code ${code}`));
            }
            process.exit(code ?? 1);
        });
    });
