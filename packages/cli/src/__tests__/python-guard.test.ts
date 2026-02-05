import { describe, it, expect } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import { spawnSync } from 'child_process';
import { PY_GUARD } from '../sandbox/python-guard';

const detectPython = (): string | null => {
    const candidates = ['python', 'python3'];
    for (const candidate of candidates) {
        const result = spawnSync(candidate, ['-c', 'import sys; print(sys.version)'], { stdio: 'ignore' });
        if (result.status === 0) return candidate;
    }
    return null;
};

describe('python runtime guard', () => {
    it('blocks shell, network, and filesystem writes and logs audit entries', () => {
        const pythonBin = detectPython();
        if (!pythonBin) {
            console.warn('Python not available; skipping python guard test.');
            return;
        }

        const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'clawshield-pyguard-test-'));
        const guardDir = path.join(tempDir, 'guard');
        fs.mkdirSync(guardDir, { recursive: true });
        fs.writeFileSync(path.join(guardDir, 'sitecustomize.py'), PY_GUARD, 'utf-8');

        const scriptPath = path.join(tempDir, 'skill.py');
        fs.writeFileSync(scriptPath, `
import subprocess
import socket

try:
    subprocess.run(["echo", "clawshield"])
except Exception:
    pass

try:
    with open("blocked.txt", "w") as fh:
        fh.write("nope")
except Exception:
    pass

try:
    socket.create_connection(("example.com", 443), timeout=1)
except Exception:
    pass
`, 'utf-8');

        const auditPath = path.join(tempDir, 'audit.jsonl');
        const env = {
            ...process.env,
            PYTHONPATH: guardDir + path.delimiter + (process.env.PYTHONPATH || ''),
            CLAWSHIELD_AUDIT_PATH: auditPath,
            CLAWSHIELD_AUDIT_LEVEL: 'blocked',
            CLAWSHIELD_BLOCK_SHELL: '1',
            CLAWSHIELD_BLOCK_NETWORK: '1',
            CLAWSHIELD_BLOCK_FS_WRITE: '1',
            CLAWSHIELD_BLOCK_SECRETS: '0',
            CLAWSHIELD_ALLOWED_DIRS: '',
            CLAWSHIELD_ALLOWED_DOMAINS: '',
        };

        const result = spawnSync(pythonBin, [scriptPath], {
            cwd: tempDir,
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
