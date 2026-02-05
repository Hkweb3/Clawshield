// ==========================================
// Policy Manager Service
// ==========================================

import * as fs from 'fs';
import * as path from 'path';
import { v4 as uuidv4 } from 'uuid';
import { Policy, ClawShieldConfig, DirectoryPermission } from '@clawshield/shared';
import { DEFAULT_CLAWSHIELD_PATH, CONFIG_FILE } from '@clawshield/shared';

export class PolicyManagerService {
    private configPath: string;
    private config: ClawShieldConfig;

    constructor() {
        this.configPath = path.join(DEFAULT_CLAWSHIELD_PATH, CONFIG_FILE);
        this.config = this.loadConfig();
    }

    /**
     * Load config from disk or create default
     */
    private loadConfig(): ClawShieldConfig {
        try {
            if (fs.existsSync(this.configPath)) {
                const content = fs.readFileSync(this.configPath, 'utf-8');
                const parsed = JSON.parse(content) as ClawShieldConfig;
                const defaultPolicy = parsed.defaultPolicy || {
                    allowedDirs: [],
                    allowedDomains: [],
                    blockShell: true,
                    blockSecrets: true,
                    blockNetwork: false,
                    blockFsWrite: false,
                };
                return {
                    ...parsed,
                    workspacePaths: parsed.workspacePaths || [],
                    enabledSkills: parsed.enabledSkills || [],
                    disabledSkills: parsed.disabledSkills || [],
                    defaultPolicy: {
                        allowedDirs: defaultPolicy.allowedDirs || [],
                        allowedDomains: defaultPolicy.allowedDomains || [],
                        blockShell: defaultPolicy.blockShell ?? true,
                        blockSecrets: defaultPolicy.blockSecrets ?? true,
                        blockNetwork: defaultPolicy.blockNetwork ?? false,
                        blockFsWrite: defaultPolicy.blockFsWrite ?? false,
                    },
                };
            }
        } catch (error) {
            console.error('Error loading config:', error);
        }

        // Return default config
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

    /**
     * Save config to disk
     */
    private saveConfig(): void {
        try {
            // Ensure directory exists
            const dir = path.dirname(this.configPath);
            if (!fs.existsSync(dir)) {
                fs.mkdirSync(dir, { recursive: true });
            }

            fs.writeFileSync(this.configPath, JSON.stringify(this.config, null, 2));
        } catch (error) {
            console.error('Error saving config:', error);
            throw new Error('Failed to save configuration');
        }
    }

    /**
     * Get all workspace paths
     */
    getWorkspacePaths(): string[] {
        return this.config.workspacePaths;
    }

    /**
     * Add a workspace path
     */
    addWorkspacePath(workspacePath: string): void {
        if (!this.config.workspacePaths.includes(workspacePath)) {
            this.config.workspacePaths.push(workspacePath);
            this.saveConfig();
        }
    }

    /**
     * Remove a workspace path
     */
    removeWorkspacePath(workspacePath: string): void {
        this.config.workspacePaths = this.config.workspacePaths.filter(p => p !== workspacePath);
        this.saveConfig();
    }

    /**
     * Get the default policy
     */
    getDefaultPolicy(): Omit<Policy, 'id' | 'workspacePath' | 'createdAt' | 'updatedAt'> {
        return this.config.defaultPolicy;
    }

    /**
     * Update the default policy
     */
    updateDefaultPolicy(
        policy: Partial<Omit<Policy, 'id' | 'workspacePath' | 'createdAt' | 'updatedAt'>>
    ): void {
        this.config.defaultPolicy = {
            ...this.config.defaultPolicy,
            ...policy,
        };
        this.saveConfig();
    }

    /**
     * Check if a skill is enabled
     */
    isSkillEnabled(skillId: string): boolean {
        // If explicitly disabled, return false
        if (this.config.disabledSkills.includes(skillId)) {
            return false;
        }
        // If explicitly enabled, return true
        if (this.config.enabledSkills.includes(skillId)) {
            return true;
        }
        // Default to enabled
        return true;
    }

    /**
     * Enable a skill
     */
    enableSkill(skillId: string): void {
        this.config.disabledSkills = this.config.disabledSkills.filter(id => id !== skillId);
        if (!this.config.enabledSkills.includes(skillId)) {
            this.config.enabledSkills.push(skillId);
        }
        this.saveConfig();
    }

    /**
     * Disable a skill
     */
    disableSkill(skillId: string): void {
        this.config.enabledSkills = this.config.enabledSkills.filter(id => id !== skillId);
        if (!this.config.disabledSkills.includes(skillId)) {
            this.config.disabledSkills.push(skillId);
        }
        this.saveConfig();
    }

    /**
     * Add allowed directory
     */
    addAllowedDir(dirPerm: DirectoryPermission): void {
        const existing = this.config.defaultPolicy.allowedDirs.find(
            d => d.path === dirPerm.path
        );
        if (existing) {
            existing.mode = dirPerm.mode;
        } else {
            this.config.defaultPolicy.allowedDirs.push(dirPerm);
        }
        this.saveConfig();
    }

    /**
     * Remove allowed directory
     */
    removeAllowedDir(dirPath: string): void {
        this.config.defaultPolicy.allowedDirs = this.config.defaultPolicy.allowedDirs.filter(
            d => d.path !== dirPath
        );
        this.saveConfig();
    }

    /**
     * Add allowed domain
     */
    addAllowedDomain(domain: string): void {
        if (!this.config.defaultPolicy.allowedDomains.includes(domain)) {
            this.config.defaultPolicy.allowedDomains.push(domain);
            this.saveConfig();
        }
    }

    /**
     * Remove allowed domain
     */
    removeAllowedDomain(domain: string): void {
        this.config.defaultPolicy.allowedDomains = this.config.defaultPolicy.allowedDomains.filter(
            d => d !== domain
        );
        this.saveConfig();
    }

    /**
     * Get full config (for debugging/API)
     */
    getConfig(): ClawShieldConfig {
        return this.config;
    }

    /**
     * Set OpenClaw path
     */
    setOpenClawPath(openclawPath: string): void {
        this.config.openclawPath = openclawPath;
        this.saveConfig();
    }

    /**
     * Get OpenClaw path
     */
    getOpenClawPath(): string | undefined {
        return this.config.openclawPath;
    }
}

export const policyManagerService = new PolicyManagerService();
