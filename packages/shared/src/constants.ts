// ==========================================
// ClawShield Constants
// ==========================================

import { RiskRecommendation } from './types';

// Slug validation regex (only allows safe characters)
export const SLUG_REGEX = /^[a-z0-9_-]+$/;

// Default paths
export const DEFAULT_OPENCLAW_PATH = process.env.HOME
    ? `${process.env.HOME}/.openclaw`
    : `${process.env.USERPROFILE}/.openclaw`;

export const DEFAULT_CLAWSHIELD_PATH = process.env.HOME
    ? `${process.env.HOME}/.clawshield`
    : `${process.env.USERPROFILE}/.clawshield`;

export const CONFIG_FILE = 'config.json';
export const AUDIT_FILE = 'audit.jsonl';

// Risk thresholds
export const RISK_THRESHOLDS = {
    SAFE_MAX: 30,
    WARNING_MAX: 60,
    DANGER_MIN: 61,
} as const;

// Risk pattern weights
export const RISK_WEIGHTS = {
    SHELL_EXECUTION: 25,
    FILESYSTEM_WRITE: 15,
    FILESYSTEM_DELETE: 20,
    NETWORK_CALL: 20,
    REMOTE_SCRIPT_FETCH: 30,
    OBFUSCATION: 25,
    CREDENTIAL_ACCESS: 20,
    EVAL_USAGE: 25,
    DEPENDENCY_RISK: 20,
    AST_RISK: 10,
    RUNTIME_BEHAVIOR: 15,
} as const;

// Get recommendation based on score
export function getRecommendation(score: number): RiskRecommendation {
    if (score <= RISK_THRESHOLDS.SAFE_MAX) return 'allow';
    if (score <= RISK_THRESHOLDS.WARNING_MAX) return 'sandbox';
    return 'block';
}

// Risk pattern definitions for scanning
export const RISK_PATTERNS = {
    // Shell execution patterns
    SHELL: {
        js: [
            /child_process/,
            /\bexec\s*\(/,
            /\bexecSync\s*\(/,
            /\bspawn\s*\(/,
            /\bspawnSync\s*\(/,
            /\bexecFile\s*\(/,
            /\bfork\s*\(/,
        ],
        python: [
            /subprocess\./,
            /os\.system\s*\(/,
            /os\.popen\s*\(/,
            /commands\.(getoutput|getstatusoutput)/,
            /\bpopen\s*\(/,
        ],
        bash: [
            /\beval\s+/,
            /\$\(.*\)/,
            /`.*`/,
        ],
    },

    // Filesystem patterns
    FILESYSTEM_WRITE: {
        js: [
            /fs\.writeFile/,
            /fs\.writeFileSync/,
            /fs\.appendFile/,
            /fs\.createWriteStream/,
            /fsPromises\.writeFile/,
        ],
        python: [
            /open\s*\([^)]*['"][wa]['"][^)]*\)/,
            /\.write\s*\(/,
            /shutil\.(copy|move|rmtree)/,
        ],
    },

    FILESYSTEM_DELETE: {
        js: [
            /fs\.unlink/,
            /fs\.rmdir/,
            /fs\.rm\s*\(/,
            /fs\.rmdirSync/,
            /rimraf/,
        ],
        python: [
            /os\.remove\s*\(/,
            /os\.unlink\s*\(/,
            /os\.rmdir\s*\(/,
            /shutil\.rmtree/,
        ],
    },

    // Network patterns
    NETWORK: {
        js: [
            /\bfetch\s*\(/,
            /\baxios\b/,
            /\bhttp\.request/,
            /\bhttps\.request/,
            /\bnode-fetch\b/,
            /\bgot\s*\(/,
        ],
        python: [
            /requests\.(get|post|put|delete|patch)/,
            /urllib\.(request|urlopen)/,
            /httplib\./,
            /aiohttp\./,
        ],
        bash: [
            /\bcurl\b/,
            /\bwget\b/,
            /\bnc\b/,
            /\bnetcat\b/,
        ],
    },

    // Remote script fetch + exec
    REMOTE_EXEC: {
        all: [
            /curl.*\|\s*(bash|sh|python)/,
            /wget.*\|\s*(bash|sh|python)/,
            /curl.*-o.*&&.*\.(sh|py|js)/,
        ],
    },

    // Obfuscation patterns
    OBFUSCATION: {
        js: [
            /\beval\s*\(/,
            /new\s+Function\s*\(/,
            /atob\s*\(.*\)/,
            /Buffer\.from\s*\([^)]+,\s*['"]base64['"]\)/,
        ],
        python: [
            /\beval\s*\(/,
            /\bexec\s*\(/,
            /base64\.b64decode/,
            /compile\s*\([^)]+\)\s*.*exec/,
        ],
    },

    // Credential/secret access
    CREDENTIALS: {
        js: [
            /process\.env\[/,
            /process\.env\./,
            /dotenv/,
        ],
        python: [
            /os\.environ/,
            /os\.getenv/,
            /dotenv/,
        ],
        all: [
            /API[_-]?KEY/i,
            /SECRET[_-]?KEY/i,
            /PASSWORD/i,
            /TOKEN/i,
            /CREDENTIAL/i,
        ],
    },
} as const;
