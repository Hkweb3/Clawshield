// ==========================================
// ClawShield Node Runtime Guard
// ==========================================

import * as fs from 'fs';
import * as path from 'path';
import * as crypto from 'crypto';
import { DEFAULT_CLAWSHIELD_PATH, AUDIT_FILE } from '@clawshield/shared';

type AuditResult = 'success' | 'blocked' | 'failure';

const parseList = (value?: string): string[] => {
    if (!value) return [];
    return value
        .split(/[,;]+/)
        .map(v => v.trim())
        .filter(Boolean);
};

const envBool = (key: string, fallback: boolean): boolean => {
    const value = process.env[key];
    if (value === undefined) return fallback;
    return value === '1' || value.toLowerCase() === 'true' || value.toLowerCase() === 'yes';
};

const auditPath = process.env.CLAWSHIELD_AUDIT_PATH
    || path.join(DEFAULT_CLAWSHIELD_PATH, AUDIT_FILE);
const auditLevel = (process.env.CLAWSHIELD_AUDIT_LEVEL || 'blocked').toLowerCase();
const skillId = process.env.CLAWSHIELD_SKILL_ID;
const skillName = process.env.CLAWSHIELD_SKILL_NAME;

const config = {
    blockShell: envBool('CLAWSHIELD_BLOCK_SHELL', true),
    blockNetwork: envBool('CLAWSHIELD_BLOCK_NETWORK', false),
    blockFsWrite: envBool('CLAWSHIELD_BLOCK_FS_WRITE', false),
    blockSecrets: envBool('CLAWSHIELD_BLOCK_SECRETS', false),
    allowedDirs: parseList(process.env.CLAWSHIELD_ALLOWED_DIRS),
    allowedDomains: parseList(process.env.CLAWSHIELD_ALLOWED_DOMAINS),
    allowedEnv: parseList(process.env.CLAWSHIELD_ALLOWED_ENV),
};

const normalizePath = (value: string): string => {
    const resolved = path.resolve(value);
    return process.platform === 'win32' ? resolved.toLowerCase() : resolved;
};

const allowedDirSet = new Set(config.allowedDirs.map(normalizePath));

const ensureAuditFile = () => {
    try {
        const dir = path.dirname(auditPath);
        if (!fs.existsSync(dir)) {
            fs.mkdirSync(dir, { recursive: true });
        }
        if (!fs.existsSync(auditPath)) {
            fs.writeFileSync(auditPath, '');
        }
    } catch {
        // ignore audit setup errors
    }
};

const writeAudit = (action: string, result: AuditResult, details: Record<string, unknown>) => {
    try {
        ensureAuditFile();
        const entry = {
            id: crypto.randomUUID(),
            timestamp: new Date().toISOString(),
            action,
            result,
            skillId,
            skillName,
            details,
        };
        fs.appendFileSync(auditPath, JSON.stringify(entry) + '\n');
    } catch {
        // ignore audit write errors
    }
};

const shouldLogAll = auditLevel === 'all';

const logAllowed = (details: Record<string, unknown>) => {
    if (shouldLogAll) {
        writeAudit('runtime', 'success', details);
    }
};

const logBlocked = (details: Record<string, unknown>) => {
    writeAudit('runtime', 'blocked', details);
};

const isPathAllowed = (targetPath?: string): boolean => {
    if (!targetPath) return false;
    const resolved = normalizePath(targetPath);
    const auditResolved = normalizePath(auditPath);
    if (resolved === auditResolved) return true;
    if (allowedDirSet.size === 0) return false;
    for (const allowed of allowedDirSet) {
        if (resolved === allowed || resolved.startsWith(allowed + path.sep)) {
            return true;
        }
    }
    return false;
};

const isDomainAllowed = (host?: string): boolean => {
    if (!host) return false;
    const hostname = host.toLowerCase().split(':')[0];
    if (config.allowedDomains.length === 0) return false;
    return config.allowedDomains.some(domain => {
        const d = domain.toLowerCase();
        return hostname === d || hostname.endsWith(`.${d}`);
    });
};

const extractHost = (target: unknown): string | undefined => {
    if (!target) return undefined;
    if (typeof target === 'string') {
        try {
            return new URL(target).hostname;
        } catch {
            return target.split('/')[0];
        }
    }
    if (typeof target === 'object') {
        const maybe = target as { hostname?: string; host?: string; href?: string };
        if (maybe.hostname) return maybe.hostname;
        if (maybe.host) return maybe.host;
        if (maybe.href) {
            try {
                return new URL(maybe.href).hostname;
            } catch {
                return undefined;
            }
        }
    }
    return undefined;
};

// ------------------------------------------
// Block secrets (process.env)
// ------------------------------------------
if (config.blockSecrets) {
    const defaultAllowed = new Set([
        'PATH', 'HOME', 'USER', 'SHELL', 'TMPDIR', 'TEMP', 'TMP', 'LANG', 'NODE_ENV', 'NODE_OPTIONS'
    ]);
    for (const key of config.allowedEnv) {
        defaultAllowed.add(key);
    }

    const originalEnv = process.env;
    process.env = new Proxy(originalEnv, {
        get(target, prop, receiver) {
            if (typeof prop === 'string') {
                if (!defaultAllowed.has(prop)) {
                    logBlocked({ kind: 'env', key: prop });
                    return undefined;
                }
            }
            return Reflect.get(target, prop, receiver);
        },
        set(target, prop, value, receiver) {
            if (typeof prop === 'string' && !defaultAllowed.has(prop)) {
                logBlocked({ kind: 'env_set', key: prop });
                return false;
            }
            return Reflect.set(target, prop, value, receiver);
        },
    });
}

// ------------------------------------------
// Patch child_process
// ------------------------------------------
try {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const childProcess = require('child_process');
    if (config.blockShell) {
        const blocked = ['exec', 'execSync', 'spawn', 'spawnSync', 'execFile', 'execFileSync', 'fork'];
        for (const fn of blocked) {
            if (typeof childProcess[fn] === 'function') {
                const original = childProcess[fn];
                childProcess[fn] = (...args: unknown[]) => {
                    logBlocked({ kind: 'shell', fn });
                    const error = new Error(`ClawShield blocked shell execution: ${fn}`);
                    (error as any).code = 'CLAWSHIELD_BLOCKED';
                    throw error;
                };
                childProcess[fn].__clawshield_original = original;
            }
        }
    }
} catch {
    // ignore
}

// ------------------------------------------
// Patch fs writes
// ------------------------------------------
try {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const fsModule = require('fs');
    const wrapWrite = (fnName: string, pathIndex: number) => {
        if (typeof fsModule[fnName] !== 'function') return;
        const original = fsModule[fnName];
        fsModule[fnName] = (...args: unknown[]) => {
            const target = args[pathIndex] as string | undefined;
            if (config.blockFsWrite && !isPathAllowed(target)) {
                logBlocked({ kind: 'fs_write', fn: fnName, target });
                const error = new Error(`ClawShield blocked filesystem write: ${target}`);
                (error as any).code = 'CLAWSHIELD_BLOCKED';
                throw error;
            }
            logAllowed({ kind: 'fs_write', fn: fnName, target });
            return original(...args);
        };
    };

    const wrapWriteAsync = (fnName: string, pathIndex: number) => {
        if (!fsModule.promises || typeof fsModule.promises[fnName] !== 'function') return;
        const original = fsModule.promises[fnName].bind(fsModule.promises);
        fsModule.promises[fnName] = async (...args: unknown[]) => {
            const target = args[pathIndex] as string | undefined;
            if (config.blockFsWrite && !isPathAllowed(target)) {
                logBlocked({ kind: 'fs_write', fn: fnName, target });
                const error = new Error(`ClawShield blocked filesystem write: ${target}`);
                (error as any).code = 'CLAWSHIELD_BLOCKED';
                throw error;
            }
            logAllowed({ kind: 'fs_write', fn: fnName, target });
            return original(...args);
        };
    };

    const writeFns = [
        ['writeFile', 0],
        ['writeFileSync', 0],
        ['appendFile', 0],
        ['appendFileSync', 0],
        ['createWriteStream', 0],
        ['rm', 0],
        ['rmSync', 0],
        ['unlink', 0],
        ['unlinkSync', 0],
        ['rmdir', 0],
        ['rmdirSync', 0],
        ['rename', 0],
        ['renameSync', 0],
        ['copyFile', 0],
        ['copyFileSync', 0],
        ['chmod', 0],
        ['chmodSync', 0],
        ['chown', 0],
        ['chownSync', 0],
        ['truncate', 0],
        ['truncateSync', 0],
        ['mkdir', 0],
        ['mkdirSync', 0],
    ] as const;

    for (const [fn, index] of writeFns) {
        wrapWrite(fn, index);
        wrapWriteAsync(fn, index);
    }
} catch {
    // ignore
}

// ------------------------------------------
// Patch network (http/https/net/tls + fetch)
// ------------------------------------------
const handleNetwork = (host?: string, details?: Record<string, unknown>) => {
    const allowed = config.allowedDomains.length > 0 ? isDomainAllowed(host) : !config.blockNetwork;
    if (!allowed) {
        logBlocked({ kind: 'network', host, ...details });
        const error = new Error(`ClawShield blocked network access: ${host ?? 'unknown'}`);
        (error as any).code = 'CLAWSHIELD_BLOCKED';
        throw error;
    }
    logAllowed({ kind: 'network', host, ...details });
};

try {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const http = require('http');
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const https = require('https');
    const wrapRequest = (mod: any, fnName: 'request' | 'get') => {
        const original = mod[fnName];
        if (typeof original !== 'function') return;
        mod[fnName] = (...args: unknown[]) => {
            const host = extractHost(args[0]);
            handleNetwork(host, { fn: fnName, module: mod === https ? 'https' : 'http' });
            return original(...args);
        };
    };
    wrapRequest(http, 'request');
    wrapRequest(http, 'get');
    wrapRequest(https, 'request');
    wrapRequest(https, 'get');
} catch {
    // ignore
}

try {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const net = require('net');
    const original = net.connect;
    if (typeof original === 'function') {
        net.connect = (...args: unknown[]) => {
            const host = extractHost(args[0]);
            handleNetwork(host, { fn: 'connect', module: 'net' });
            return original(...args);
        };
        net.createConnection = net.connect;
    }
} catch {
    // ignore
}

try {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const tls = require('tls');
    const original = tls.connect;
    if (typeof original === 'function') {
        tls.connect = (...args: unknown[]) => {
            const host = extractHost(args[0]);
            handleNetwork(host, { fn: 'connect', module: 'tls' });
            return original(...args);
        };
    }
} catch {
    // ignore
}

if (typeof globalThis.fetch === 'function') {
    const original = globalThis.fetch as any;
    globalThis.fetch = async (input: any, init?: any) => {
        let url: string | undefined;
        if (typeof input === 'string') url = input;
        else if (input instanceof URL) url = input.toString();
        else if (typeof input?.url === 'string') url = input.url;

        const host = url ? extractHost(url) : undefined;
        handleNetwork(host, { fn: 'fetch' });
        return original(input, init);
    };
}

// ------------------------------------------
// Startup log
// ------------------------------------------
logAllowed({
    kind: 'guard_start',
    blockShell: config.blockShell,
    blockNetwork: config.blockNetwork,
    blockFsWrite: config.blockFsWrite,
    blockSecrets: config.blockSecrets,
    allowedDirs: config.allowedDirs,
    allowedDomains: config.allowedDomains,
});
