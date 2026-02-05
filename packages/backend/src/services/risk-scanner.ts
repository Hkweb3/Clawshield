// ==========================================
// Risk Scanner Service
// ==========================================

import * as fs from 'fs';
import * as path from 'path';
import { glob } from 'glob';
import { parse } from '@babel/parser';
import traverse from '@babel/traverse';
import * as t from '@babel/types';
import {
    RiskScanResult,
    RiskFlag,
    Skill,
    RiskRecommendation
} from '@clawshield/shared';
import {
    RISK_PATTERNS,
    RISK_WEIGHTS,
    RISK_THRESHOLDS,
    getRecommendation,
    DEFAULT_CLAWSHIELD_PATH,
    AUDIT_FILE
} from '@clawshield/shared';
import { skillDiscoveryService } from './skill-discovery';

interface PatternMatch {
    pattern: string;
    line: number;
    content: string;
    file: string;
}

export class RiskScannerService {
    /**
     * Scan a skill folder for security risks
     */
    async scanSkill(skill: Skill): Promise<RiskScanResult> {
        const flags: RiskFlag[] = [];
        let totalScore = 0;

        // Get all scannable files
        const files = await skillDiscoveryService.listSkillFiles(skill.path);

        for (const file of files) {
            const fileFlags = await this.scanFile(file);
            flags.push(...fileFlags);
        }

        // Also scan SKILL.md for suspicious patterns
        const skillMdPath = path.join(skill.path, 'SKILL.md');
        if (fs.existsSync(skillMdPath)) {
            const skillMdFlags = await this.scanFile(skillMdPath);
            flags.push(...skillMdFlags);
        }

        // Dependency/supply-chain scan (package manifests, lockfiles, binaries)
        const dependencyFlags = await this.scanDependencies(skill.path);
        flags.push(...dependencyFlags);

        // Runtime behavior scan (audit log)
        const behaviorFlags = await this.scanBehavior(skill);
        flags.push(...behaviorFlags);

        // Calculate score based on flags
        totalScore = this.calculateScore(flags);

        // Generate explanation
        const explanation = this.generateExplanation(flags, totalScore);
        const recommendation = getRecommendation(totalScore);
        const dependencyCount = flags.filter(f => f.source === 'dependency').length;
        const astCount = flags.filter(f => f.source === 'ast').length;
        const behaviorCount = flags.filter(f => f.source === 'behavior').length;

        return {
            score: Math.min(100, totalScore),
            flags,
            explanation,
            recommendation,
            scannedAt: new Date().toISOString(),
            dependencyCount,
            astCount,
            behaviorCount,
        };
    }

    /**
     * Scan a single file for risk patterns
     */
    private async scanFile(filePath: string): Promise<RiskFlag[]> {
        const flags: RiskFlag[] = [];
        const ext = path.extname(filePath).toLowerCase();
        const fileName = path.basename(filePath);

        try {
            const content = await fs.promises.readFile(filePath, 'utf-8');
            const lines = content.split('\n');

            // Determine language category
            const langCategory = this.getLanguageCategory(ext);

            // Check for shell execution
            flags.push(...this.checkPatterns(
                lines, filePath, langCategory,
                RISK_PATTERNS.SHELL,
                'shell_execution',
                'Executes shell commands',
                'high',
                'regex'
            ));

            // Check for filesystem writes
            flags.push(...this.checkPatterns(
                lines, filePath, langCategory,
                RISK_PATTERNS.FILESYSTEM_WRITE,
                'filesystem_write',
                'Writes to filesystem',
                'medium',
                'regex'
            ));

            // Check for filesystem deletes
            flags.push(...this.checkPatterns(
                lines, filePath, langCategory,
                RISK_PATTERNS.FILESYSTEM_DELETE,
                'filesystem_delete',
                'Deletes files or directories',
                'high',
                'regex'
            ));

            // Check for network calls
            flags.push(...this.checkPatterns(
                lines, filePath, langCategory,
                RISK_PATTERNS.NETWORK,
                'network_call',
                'Makes network requests',
                'medium',
                'regex'
            ));

            // Check for remote script execution
            flags.push(...this.checkPatterns(
                lines, filePath, 'all',
                RISK_PATTERNS.REMOTE_EXEC,
                'remote_script_exec',
                'Downloads and executes remote scripts',
                'critical',
                'regex'
            ));

            // Check for obfuscation
            flags.push(...this.checkPatterns(
                lines, filePath, langCategory,
                RISK_PATTERNS.OBFUSCATION,
                'obfuscation',
                'Uses code obfuscation or dynamic execution',
                'high',
                'regex'
            ));

            // Check for credential access
            flags.push(...this.checkPatterns(
                lines, filePath, langCategory,
                RISK_PATTERNS.CREDENTIALS,
                'credential_access',
                'Accesses environment variables or credentials',
                'medium',
                'regex'
            ));

            // Check for suspiciously long lines (potential obfuscation)
            for (let i = 0; i < lines.length; i++) {
                if (lines[i].length > 500 && !lines[i].includes('//') && !lines[i].includes('#')) {
                    flags.push({
                        type: 'suspicious_long_line',
                        severity: 'medium',
                        description: 'Contains suspiciously long line (potential obfuscation)',
                        location: filePath,
                        line: i + 1,
                        source: 'regex',
                    });
                }
            }

            // AST-based analysis for JS/TS files
            const astFlags = this.scanAst(filePath, content);
            flags.push(...astFlags);

        } catch (error) {
            console.error(`Error scanning file ${filePath}:`, error);
        }

        return flags;
    }

    /**
     * Get language category from file extension
     */
    private getLanguageCategory(ext: string): 'js' | 'python' | 'bash' | 'all' {
        switch (ext) {
            case '.js':
            case '.ts':
            case '.jsx':
            case '.tsx':
            case '.mjs':
            case '.cjs':
                return 'js';
            case '.py':
            case '.pyw':
                return 'python';
            case '.sh':
            case '.bash':
            case '.zsh':
            case '.ps1':
                return 'bash';
            default:
                return 'all';
        }
    }

    /**
     * Check patterns against file content
     */
    private checkPatterns(
        lines: string[],
        filePath: string,
        langCategory: string,
        patterns: Record<string, RegExp[]>,
        flagType: string,
        description: string,
        severity: RiskFlag['severity'],
        source?: RiskFlag['source']
    ): RiskFlag[] {
        const flags: RiskFlag[] = [];
        const patternsToCheck: RegExp[] = [];

        // Get language-specific patterns
        if (langCategory in patterns) {
            patternsToCheck.push(...(patterns as any)[langCategory]);
        }
        // Always check 'all' patterns if they exist
        if ('all' in patterns) {
            patternsToCheck.push(...patterns.all);
        }

        for (let i = 0; i < lines.length; i++) {
            const line = lines[i];
            for (const pattern of patternsToCheck) {
                if (pattern.test(line)) {
                    // Avoid duplicate flags for the same line/type
                    const existing = flags.find(
                        f => f.type === flagType && f.line === i + 1 && f.location === filePath
                    );
                    if (!existing) {
                        flags.push({
                            type: flagType,
                            severity,
                            description,
                            location: filePath,
                            line: i + 1,
                            source,
                        });
                    }
                    break; // One flag per line per type
                }
            }
        }

        return flags;
    }

    /**
     * AST-based scanning for JS/TS files
     */
    private scanAst(filePath: string, content: string): RiskFlag[] {
        const flags: RiskFlag[] = [];
        const ext = path.extname(filePath).toLowerCase();
        const jsExts = new Set(['.js', '.ts', '.jsx', '.tsx', '.mjs', '.cjs']);
        if (!jsExts.has(ext)) return flags;

        let ast: t.File;
        try {
            ast = parse(content, {
                sourceType: 'unambiguous',
                errorRecovery: true,
                plugins: [
                    'typescript',
                    'jsx',
                    'dynamicImport',
                    'importMeta',
                ],
            });
        } catch {
            return flags;
        }

        const seen = new Set<string>();
        const addFlag = (
            type: string,
            severity: RiskFlag['severity'],
            description: string,
            node?: t.Node,
            evidence?: string
        ) => {
            const line = node?.loc?.start.line;
            const key = `${type}:${filePath}:${line ?? 0}:${evidence ?? ''}`;
            if (seen.has(key)) return;
            seen.add(key);
            flags.push({
                type,
                severity,
                description,
                location: filePath,
                line,
                source: 'ast',
                evidence,
            });
        };

        const shellCallees = new Set(['exec', 'execSync', 'spawn', 'spawnSync', 'execFile', 'execFileSync', 'fork']);
        const fsWriteCallees = new Set([
            'writeFile', 'writeFileSync', 'appendFile', 'appendFileSync', 'createWriteStream',
            'rm', 'rmSync', 'unlink', 'unlinkSync', 'rmdir', 'rmdirSync', 'rename', 'renameSync',
            'copyFile', 'copyFileSync', 'chmod', 'chmodSync', 'chown', 'chownSync', 'truncate', 'truncateSync',
        ]);
        const fsDeleteCallees = new Set(['rm', 'rmSync', 'unlink', 'unlinkSync', 'rmdir', 'rmdirSync']);
        const networkObjects = new Set(['http', 'https', 'net', 'tls', 'dns', 'dgram']);
        const networkMethods = new Set(['request', 'get', 'connect', 'createConnection']);
        const obfuscationCallees = new Set(['eval', 'Function']);
        const sensitiveImports = new Set([
            'child_process', 'fs', 'net', 'http', 'https', 'dns', 'tls', 'dgram', 'worker_threads', 'vm'
        ]);

        traverse(ast, {
            ImportDeclaration: (path) => {
                const source = path.node.source.value;
                if (sensitiveImports.has(source)) {
                    addFlag(
                        'sensitive_import',
                        'low',
                        `Imports sensitive module "${source}"`,
                        path.node,
                        source
                    );
                }
            },
            CallExpression: (path) => {
                const callee = path.node.callee;
                if (t.isIdentifier(callee)) {
                    const name = callee.name;
                    if (shellCallees.has(name)) {
                        addFlag('shell_execution', 'high', 'Executes shell commands (AST)', path.node, name);
                    } else if (obfuscationCallees.has(name)) {
                        addFlag('obfuscation', 'high', 'Uses eval/Function for dynamic execution (AST)', path.node, name);
                    } else if (name === 'fetch') {
                        addFlag('network_call', 'medium', 'Makes network requests (AST)', path.node, name);
                    } else if (name === 'require') {
                        const arg = path.node.arguments[0];
                        if (!t.isStringLiteral(arg)) {
                            addFlag('dynamic_require', 'medium', 'Uses dynamic require (AST)', path.node);
                        }
                    }
                } else if (t.isMemberExpression(callee)) {
                    const object = callee.object;
                    const property = callee.property;
                    if (t.isIdentifier(object) && t.isIdentifier(property)) {
                        const objName = object.name;
                        const propName = property.name;
                        if (objName === 'child_process' && shellCallees.has(propName)) {
                            addFlag('shell_execution', 'high', 'Executes shell commands (AST)', path.node, `${objName}.${propName}`);
                        } else if (objName === 'fs' && fsWriteCallees.has(propName)) {
                            const type = fsDeleteCallees.has(propName) ? 'filesystem_delete' : 'filesystem_write';
                            const desc = type === 'filesystem_delete'
                                ? 'Deletes files or directories (AST)'
                                : 'Writes to filesystem (AST)';
                            addFlag(type, type === 'filesystem_delete' ? 'high' : 'medium', desc, path.node, `${objName}.${propName}`);
                        } else if (objName === 'axios') {
                            addFlag('network_call', 'medium', 'Makes network requests (AST)', path.node, `${objName}.${propName}`);
                        } else if (networkObjects.has(objName) && networkMethods.has(propName)) {
                            addFlag('network_call', 'medium', 'Makes network requests (AST)', path.node, `${objName}.${propName}`);
                        }
                    }
                } else if (t.isImport(callee)) {
                    addFlag('dynamic_import', 'medium', 'Uses dynamic import (AST)', path.node);
                }
            },
            MemberExpression: (path) => {
                const node = path.node;
                if (t.isIdentifier(node.object, { name: 'process' }) && t.isIdentifier(node.property, { name: 'env' })) {
                    addFlag('credential_access', 'medium', 'Accesses environment variables (AST)', node, 'process.env');
                } else if (t.isMemberExpression(node.object)) {
                    const obj = node.object;
                    if (t.isIdentifier(obj.object, { name: 'process' }) && t.isIdentifier(obj.property, { name: 'env' })) {
                        addFlag('credential_access', 'medium', 'Accesses environment variables (AST)', node, 'process.env.*');
                    }
                }
            },
        });

        return flags;
    }

    /**
     * Dependency and supply-chain scan (manifest + lockfiles + binaries)
     */
    private async scanDependencies(skillPath: string): Promise<RiskFlag[]> {
        const flags: RiskFlag[] = [];
        const seen = new Set<string>();
        const addFlag = (
            type: string,
            severity: RiskFlag['severity'],
            description: string,
            location?: string,
            evidence?: string
        ) => {
            const key = `${type}:${location ?? ''}:${evidence ?? ''}`;
            if (seen.has(key)) return;
            seen.add(key);
            flags.push({
                type,
                severity,
                description,
                location,
                source: 'dependency',
                evidence,
            });
        };

        const packageJsonPath = path.join(skillPath, 'package.json');
        if (fs.existsSync(packageJsonPath)) {
            try {
                const content = await fs.promises.readFile(packageJsonPath, 'utf-8');
                const pkg = JSON.parse(content) as any;

                const scripts = pkg.scripts || {};
                const scriptKeys = ['preinstall', 'install', 'postinstall', 'prepare', 'prepublish', 'prepack'];
                const riskyScriptPattern = /(curl|wget|bash|sh|powershell|invoke-webrequest|chmod\s+\+x|node\s+-e|python\s+-c|perl\s+-e)/i;
                for (const key of scriptKeys) {
                    const value = scripts[key];
                    if (typeof value === 'string' && riskyScriptPattern.test(value)) {
                        addFlag(
                            'dependency_script',
                            'high',
                            `Install script "${key}" executes shell commands`,
                            packageJsonPath,
                            value.slice(0, 120)
                        );
                    }
                }

                const depGroups = [
                    pkg.dependencies || {},
                    pkg.devDependencies || {},
                    pkg.optionalDependencies || {},
                    pkg.peerDependencies || {},
                ];
                for (const deps of depGroups) {
                    for (const [name, spec] of Object.entries(deps)) {
                        if (typeof spec !== 'string') continue;
                        const trimmed = spec.trim();
                        if (trimmed === '*' || trimmed === 'latest') {
                            addFlag(
                                'dependency_unpinned',
                                'low',
                                'Unpinned dependency version',
                                packageJsonPath,
                                `${name}@${trimmed}`
                            );
                        }
                        if (/^(git\+|github:|git@|https?:|file:|link:|workspace:|path:)/i.test(trimmed) || trimmed.startsWith('..')) {
                            addFlag(
                                'dependency_url',
                                'medium',
                                'Dependency uses non-registry source',
                                packageJsonPath,
                                `${name}@${trimmed}`
                            );
                        }
                    }
                }
            } catch {
                // ignore parse errors
            }
        }

        const lockFiles = [
            'package-lock.json',
            'npm-shrinkwrap.json',
            'pnpm-lock.yaml',
            'yarn.lock',
        ];
        for (const file of lockFiles) {
            const lockPath = path.join(skillPath, file);
            if (!fs.existsSync(lockPath)) continue;
            try {
                const content = await fs.promises.readFile(lockPath, 'utf-8');
                const lines = content.split('\n').slice(0, 20000);
                for (const line of lines) {
                    if (/resolved/i.test(line) || /https?:\/\//.test(line)) {
                        if (/git\+|github:|git@|file:|https?:\/\/(?!registry\.npmjs\.org)/i.test(line)) {
                            addFlag(
                                'dependency_url',
                                'medium',
                                'Lockfile contains non-registry dependency source',
                                lockPath,
                                line.trim().slice(0, 140)
                            );
                        }
                    }
                }
            } catch {
                // ignore
            }
        }

        const requirementsPath = path.join(skillPath, 'requirements.txt');
        if (fs.existsSync(requirementsPath)) {
            try {
                const content = await fs.promises.readFile(requirementsPath, 'utf-8');
                const lines = content.split('\n');
                for (const line of lines) {
                    const trimmed = line.trim();
                    if (!trimmed || trimmed.startsWith('#')) continue;
                    if (/git\+|https?:\/\//i.test(trimmed)) {
                        addFlag('dependency_url', 'medium', 'Requirements include URL/git dependency', requirementsPath, trimmed.slice(0, 140));
                    }
                    if (/\s-e\s+|--editable/i.test(trimmed)) {
                        addFlag('dependency_url', 'medium', 'Editable requirements entry', requirementsPath, trimmed.slice(0, 140));
                    }
                    if (/--index-url|--extra-index-url|--trusted-host|--find-links/i.test(trimmed)) {
                        addFlag('dependency_index', 'medium', 'Custom package index in requirements', requirementsPath, trimmed.slice(0, 140));
                    }
                    if (!/==/.test(trimmed) && /^[A-Za-z0-9_.-]+/.test(trimmed)) {
                        addFlag('dependency_unpinned', 'low', 'Unpinned dependency version', requirementsPath, trimmed.slice(0, 140));
                    }
                }
            } catch {
                // ignore
            }
        }

        const textManifests = ['pyproject.toml', 'Pipfile', 'Pipfile.lock', 'poetry.lock', 'setup.py', 'setup.cfg'];
        for (const file of textManifests) {
            const manifestPath = path.join(skillPath, file);
            if (!fs.existsSync(manifestPath)) continue;
            try {
                const content = await fs.promises.readFile(manifestPath, 'utf-8');
                if (/git\s*=\s*|url\s*=\s*|path\s*=\s*|https?:\/\//i.test(content)) {
                    addFlag('dependency_url', 'medium', 'Manifest includes git/url/path dependency', manifestPath);
                }
            } catch {
                // ignore
            }
        }

        try {
            const binaries = await glob('**/*.{node,so,dylib,dll}', {
                cwd: skillPath,
                nodir: true,
                dot: true,
                ignore: ['**/node_modules/**', '**/.git/**'],
            });
            for (const bin of binaries) {
                addFlag(
                    'native_binary',
                    'high',
                    'Skill bundles native binary',
                    path.join(skillPath, bin)
                );
            }
        } catch {
            // ignore
        }

        return flags;
    }

    /**
     * Runtime behavior scan from audit log
     */
    private async scanBehavior(skill: Skill): Promise<RiskFlag[]> {
        const flags: RiskFlag[] = [];
        const auditPath = path.join(DEFAULT_CLAWSHIELD_PATH, AUDIT_FILE);
        if (!fs.existsSync(auditPath)) return flags;

        try {
            const content = await fs.promises.readFile(auditPath, 'utf-8');
            const lines = content.split('\n').filter(line => line.trim().length > 0);
            const recentLines = lines.slice(-2000);

            for (const line of recentLines) {
                try {
                    const entry = JSON.parse(line) as {
                        action?: string;
                        result?: string;
                        skillId?: string;
                        details?: Record<string, unknown>;
                        timestamp?: string;
                    };
                    if (entry.action !== 'runtime') continue;
                    if (!entry.skillId || entry.skillId !== skill.id) continue;

                    const details = entry.details || {};
                    const kind = typeof details.kind === 'string' ? details.kind : 'runtime';
                    const result = entry.result || 'blocked';
                    if (result !== 'blocked') continue;

                    let severity: RiskFlag['severity'] = 'medium';
                    if (kind === 'shell') severity = 'high';
                    if (kind === 'network') severity = 'high';
                    if (kind === 'env' || kind === 'env_set') severity = 'medium';
                    if (kind === 'fs_write') severity = 'medium';

                    const evidence = Object.entries(details)
                        .map(([key, value]) => `${key}=${String(value)}`)
                        .join(' ')
                        .slice(0, 180);

                    flags.push({
                        type: 'runtime_blocked',
                        severity,
                        description: `Runtime guard blocked ${kind} action`,
                        location: auditPath,
                        source: 'behavior',
                        evidence,
                    });
                } catch {
                    // skip malformed entries
                }
            }
        } catch {
            // ignore
        }

        return flags;
    }

    /**
     * Calculate risk score from flags
     */
    private calculateScore(flags: RiskFlag[]): number {
        let score = 0;

        const typeWeights: Record<string, number> = {
            'shell_execution': RISK_WEIGHTS.SHELL_EXECUTION,
            'filesystem_write': RISK_WEIGHTS.FILESYSTEM_WRITE,
            'filesystem_delete': RISK_WEIGHTS.FILESYSTEM_DELETE,
            'network_call': RISK_WEIGHTS.NETWORK_CALL,
            'remote_script_exec': RISK_WEIGHTS.REMOTE_SCRIPT_FETCH,
            'obfuscation': RISK_WEIGHTS.OBFUSCATION,
            'credential_access': RISK_WEIGHTS.CREDENTIAL_ACCESS,
            'suspicious_long_line': 10,
            'dependency_script': RISK_WEIGHTS.DEPENDENCY_RISK,
            'dependency_url': RISK_WEIGHTS.DEPENDENCY_RISK,
            'dependency_index': RISK_WEIGHTS.DEPENDENCY_RISK,
            'dependency_unpinned': 10,
            'native_binary': RISK_WEIGHTS.DEPENDENCY_RISK + 5,
            'dynamic_require': 10,
            'dynamic_import': 10,
            'sensitive_import': 5,
            'runtime_blocked': RISK_WEIGHTS.RUNTIME_BEHAVIOR,
        };

        // Count unique types (don't double-penalize multiple occurrences)
        const typeCount: Record<string, number> = {};
        for (const flag of flags) {
            typeCount[flag.type] = (typeCount[flag.type] || 0) + 1;
        }

        for (const [type, count] of Object.entries(typeCount)) {
            const weight = typeWeights[type] || 5;
            // First occurrence gets full weight, subsequent get diminishing returns
            score += weight + Math.min(count - 1, 3) * (weight / 4);
        }

        return Math.round(score);
    }

    /**
     * Generate human-readable explanation
     */
    private generateExplanation(flags: RiskFlag[], score: number): string {
        if (flags.length === 0) {
            return 'No security risks detected. This skill appears safe to use.';
        }

        const parts: string[] = [];

        // Count by type
        const typeCounts: Record<string, number> = {};
        for (const flag of flags) {
            typeCounts[flag.type] = (typeCounts[flag.type] || 0) + 1;
        }

        // Generate readable descriptions
        const typeDescriptions: Record<string, string> = {
            'shell_execution': 'executes shell commands',
            'filesystem_write': 'writes to the filesystem',
            'filesystem_delete': 'deletes files or directories',
            'network_call': 'makes network requests',
            'remote_script_exec': 'downloads and executes remote scripts',
            'obfuscation': 'uses code obfuscation',
            'credential_access': 'accesses credentials/environment variables',
            'suspicious_long_line': 'contains suspiciously long lines',
            'dependency_script': 'runs install scripts',
            'dependency_url': 'uses non-registry dependencies',
            'dependency_index': 'uses custom package indexes',
            'dependency_unpinned': 'uses unpinned dependencies',
            'native_binary': 'bundles native binaries',
            'dynamic_require': 'uses dynamic require',
            'dynamic_import': 'uses dynamic import',
            'sensitive_import': 'imports sensitive modules',
            'runtime_blocked': 'was blocked by runtime guard',
        };

        for (const [type, count] of Object.entries(typeCounts)) {
            const desc = typeDescriptions[type] || type;
            parts.push(`${desc} (${count} occurrence${count > 1 ? 's' : ''})`);
        }

        let recommendation = '';
        if (score <= RISK_THRESHOLDS.SAFE_MAX) {
            recommendation = 'Safe to use with standard precautions.';
        } else if (score <= RISK_THRESHOLDS.WARNING_MAX) {
            recommendation = 'Review carefully before enabling. Consider running in a sandbox.';
        } else {
            recommendation = 'High risk detected. Strongly recommend blocking or thorough manual review.';
        }

        return `This skill ${parts.join(', ')}. ${recommendation}`;
    }

    /**
     * Scan a skill by path (for preflight scanning)
     */
    async scanSkillPath(skillPath: string): Promise<RiskScanResult> {
        // Create a temporary skill object
        const skill: Skill = {
            id: 'temp',
            name: path.basename(skillPath),
            description: '',
            path: skillPath,
            source: 'workspace',
            enabled: false,
            metadata: { name: path.basename(skillPath) },
        };

        return this.scanSkill(skill);
    }
}

export const riskScannerService = new RiskScannerService();
