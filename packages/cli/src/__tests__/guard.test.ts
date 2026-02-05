import { describe, it, expect } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import { spawnSync } from 'child_process';
import * as ts from 'typescript';

describe('runtime guard', () => {
    it('blocks shell, network, and filesystem writes and logs audit entries', () => {
        const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'clawshield-guard-test-'));
        const skillPath = path.join(tempDir, 'skill.js');
        const auditPath = path.join(tempDir, 'audit.jsonl');

        fs.writeFileSync(skillPath, `
const { execSync } = require('child_process');
try { execSync('echo clawshield'); } catch (e) {}
const fs = require('fs');
try { fs.writeFileSync('blocked.txt', 'nope'); } catch (e) {}
const https = require('https');
try { https.get('https://example.com'); } catch (e) {}
setTimeout(() => process.exit(0), 10);
`, 'utf-8');

        const guardPath = path.resolve(process.cwd(), 'src', 'sandbox', 'node-guard.ts');
        const guardSource = fs.readFileSync(guardPath, 'utf-8');
        const guardCompiled = ts.transpileModule(guardSource, {
            compilerOptions: {
                target: ts.ScriptTarget.ES2020,
                module: ts.ModuleKind.CommonJS,
                esModuleInterop: true,
            },
        });
        const guardJsPath = path.join(tempDir, 'node-guard.js');
        fs.writeFileSync(guardJsPath, guardCompiled.outputText, 'utf-8');
        const rootNodeModules = path.resolve(process.cwd(), '..', '..', 'node_modules');
        const env = {
            ...process.env,
            CLAWSHIELD_AUDIT_PATH: auditPath,
            CLAWSHIELD_AUDIT_LEVEL: 'blocked',
            CLAWSHIELD_BLOCK_SHELL: '1',
            CLAWSHIELD_BLOCK_NETWORK: '1',
            CLAWSHIELD_BLOCK_FS_WRITE: '1',
            CLAWSHIELD_BLOCK_SECRETS: '0',
            CLAWSHIELD_ALLOWED_DIRS: '',
            CLAWSHIELD_ALLOWED_DOMAINS: '',
            NODE_PATH: [rootNodeModules, process.env.NODE_PATH].filter(Boolean).join(path.delimiter),
        };

        const result = spawnSync('node', ['-r', guardJsPath, skillPath], {
            cwd: process.cwd(),
            env,
            stdio: 'ignore',
        });

        expect(result.status).toBe(0);

        const auditRaw = fs.readFileSync(auditPath, 'utf-8').trim();
        expect(auditRaw.length).toBeGreaterThan(0);

        const entries = auditRaw
            .split('\n')
            .map(line => JSON.parse(line));

        const blocked = entries.filter(entry => entry.result === 'blocked');
        expect(blocked.some(entry => entry.details?.kind === 'shell')).toBe(true);
        expect(blocked.some(entry => entry.details?.kind === 'network')).toBe(true);
        expect(blocked.some(entry => entry.details?.kind === 'fs_write')).toBe(true);
    });
});
