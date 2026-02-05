// ==========================================
// Audit Logger Service
// ==========================================

import * as fs from 'fs';
import * as path from 'path';
import { v4 as uuidv4 } from 'uuid';
import { AuditEntry, AuditAction } from '@clawshield/shared';
import { DEFAULT_CLAWSHIELD_PATH, AUDIT_FILE } from '@clawshield/shared';

export class AuditLoggerService {
    private auditPath: string;

    constructor() {
        this.auditPath = path.join(DEFAULT_CLAWSHIELD_PATH, AUDIT_FILE);
        this.ensureAuditFile();
    }

    /**
     * Ensure the audit file and directory exist
     */
    private ensureAuditFile(): void {
        try {
            const dir = path.dirname(this.auditPath);
            if (!fs.existsSync(dir)) {
                fs.mkdirSync(dir, { recursive: true });
            }
            if (!fs.existsSync(this.auditPath)) {
                fs.writeFileSync(this.auditPath, '');
            }
        } catch (error) {
            console.error('Error ensuring audit file:', error);
        }
    }

    /**
     * Log an audit entry
     */
    log(
        action: AuditAction,
        result: AuditEntry['result'],
        details: Record<string, unknown>,
        skillId?: string,
        skillName?: string
    ): AuditEntry {
        const entry: AuditEntry = {
            id: uuidv4(),
            timestamp: new Date().toISOString(),
            action,
            skillId,
            skillName,
            details,
            result,
        };

        try {
            fs.appendFileSync(this.auditPath, JSON.stringify(entry) + '\n');
        } catch (error) {
            console.error('Error writing audit log:', error);
        }

        return entry;
    }

    /**
     * Log a skill scan
     */
    logScan(skillId: string, skillName: string, score: number, flags: string[]): AuditEntry {
        return this.log(
            'scan',
            'success',
            { score, flagCount: flags.length, flags: flags.slice(0, 5) },
            skillId,
            skillName
        );
    }

    /**
     * Log a skill install
     */
    logInstall(skillId: string, skillName: string, source: string): AuditEntry {
        return this.log(
            'install',
            'success',
            { source },
            skillId,
            skillName
        );
    }

    /**
     * Log a blocked action
     */
    logBlock(skillId: string, skillName: string, reason: string): AuditEntry {
        return this.log(
            'block',
            'blocked',
            { reason },
            skillId,
            skillName
        );
    }

    /**
     * Log a policy change
     */
    logPolicyChange(change: Record<string, unknown>): AuditEntry {
        return this.log(
            'policy_change',
            'success',
            change
        );
    }

    /**
     * Log skill enable/disable
     */
    logToggle(skillId: string, skillName: string, enabled: boolean): AuditEntry {
        return this.log(
            enabled ? 'enable' : 'disable',
            'success',
            { enabled },
            skillId,
            skillName
        );
    }

    /**
     * Get recent audit entries
     */
    getRecentEntries(limit: number = 50): AuditEntry[] {
        try {
            if (!fs.existsSync(this.auditPath)) {
                return [];
            }

            const content = fs.readFileSync(this.auditPath, 'utf-8');
            const lines = content.trim().split('\n').filter(line => line.length > 0);

            // Get last N entries (newest first)
            const entries: AuditEntry[] = [];
            for (let i = lines.length - 1; i >= 0 && entries.length < limit; i--) {
                try {
                    entries.push(JSON.parse(lines[i]));
                } catch {
                    // Skip malformed entries
                }
            }

            return entries;
        } catch (error) {
            console.error('Error reading audit log:', error);
            return [];
        }
    }

    /**
     * Get all entries (for export)
     */
    getAllEntries(): AuditEntry[] {
        return this.getRecentEntries(10000);
    }

    /**
     * Clear audit log
     */
    clear(): void {
        try {
            fs.writeFileSync(this.auditPath, '');
        } catch (error) {
            console.error('Error clearing audit log:', error);
        }
    }
}

export const auditLoggerService = new AuditLoggerService();
