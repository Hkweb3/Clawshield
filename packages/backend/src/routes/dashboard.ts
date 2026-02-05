// ==========================================
// Dashboard & Config API Routes
// ==========================================

import { FastifyPluginAsync } from 'fastify';
import {
    skillDiscoveryService,
    riskScannerService,
    policyManagerService,
    auditLoggerService
} from '../services';
import {
    ApiResponse,
    DashboardSummary,
    AuditEntry
} from '@clawshield/shared';
import { RISK_THRESHOLDS } from '@clawshield/shared';

export const dashboardRoutes: FastifyPluginAsync = async (fastify) => {
    // Get dashboard summary
    fastify.get<{
        Reply: ApiResponse<DashboardSummary>
    }>('/dashboard', async (request, reply) => {
        try {
            // Get OpenClaw status
            const openclawStatus = await skillDiscoveryService.getOpenClawStatus();

            // Get all skills
            const skills = await skillDiscoveryService.discoverSkills();

            // Calculate stats
            let enabledCount = 0;
            let disabledCount = 0;
            const riskBreakdown = { safe: 0, warning: 0, danger: 0 };

            for (const skill of skills) {
                const enabled = policyManagerService.isSkillEnabled(skill.id);
                if (enabled) {
                    enabledCount++;
                } else {
                    disabledCount++;
                }

                const risk = await riskScannerService.scanSkill(skill);
                if (risk.score <= RISK_THRESHOLDS.SAFE_MAX) {
                    riskBreakdown.safe++;
                } else if (risk.score <= RISK_THRESHOLDS.WARNING_MAX) {
                    riskBreakdown.warning++;
                } else {
                    riskBreakdown.danger++;
                }
            }

            // Get recent audit entries
            const recentAuditEntries = auditLoggerService.getRecentEntries(10);

            return {
                success: true,
                data: {
                    openclawStatus,
                    totalSkills: skills.length,
                    enabledSkills: enabledCount,
                    disabledSkills: disabledCount,
                    riskBreakdown,
                    recentAuditEntries,
                },
            };
        } catch (error) {
            reply.status(500);
            return { success: false, error: String(error) };
        }
    });

    // Get audit log
    fastify.get<{
        Querystring: { limit?: string };
        Reply: ApiResponse<AuditEntry[]>
    }>('/audit', async (request, reply) => {
        try {
            const limit = parseInt(request.query.limit || '50', 10);
            const entries = auditLoggerService.getRecentEntries(limit);
            return { success: true, data: entries };
        } catch (error) {
            reply.status(500);
            return { success: false, error: String(error) };
        }
    });

    // Set workspace path (for skill discovery)
    fastify.post<{
        Body: { workspacePath: string };
        Reply: ApiResponse<{ set: boolean }>
    }>('/config/workspace', async (request, reply) => {
        try {
            const { workspacePath } = request.body;
            skillDiscoveryService.setWorkspacePath(workspacePath);
            policyManagerService.addWorkspacePath(workspacePath);
            return { success: true, data: { set: true } };
        } catch (error) {
            reply.status(500);
            return { success: false, error: String(error) };
        }
    });

    // Get sandbox configuration helper
    fastify.get<{
        Reply: ApiResponse<{
            dockerAvailable: boolean;
            sandboxConfig: object;
            instructions: string;
            runtimeGuard: {
                node: {
                    supported: boolean;
                    command: string;
                    notes: string[];
                };
                python: {
                    supported: boolean;
                    command: string;
                    notes: string[];
                };
            };
        }>
    }>('/sandbox', async (request, reply) => {
        try {
            // Check if Docker is available
            let dockerAvailable = false;
            try {
                const { exec } = require('child_process');
                const { promisify } = require('util');
                const execAsync = promisify(exec);
                await execAsync('docker --version');
                dockerAvailable = true;
            } catch {
                // Docker not available
            }

            // Generate OpenClaw sandbox config
            const sandboxConfig = {
                sandbox: {
                    enabled: true,
                    type: dockerAvailable ? 'docker' : 'process',
                    permissions: {
                        filesystem: {
                            read: policyManagerService.getDefaultPolicy().allowedDirs
                                .filter(d => d.mode === 'read' || d.mode === 'readwrite')
                                .map(d => d.path),
                            write: policyManagerService.getDefaultPolicy().allowedDirs
                                .filter(d => d.mode === 'readwrite')
                                .map(d => d.path),
                        },
                        network: {
                            allowlist: policyManagerService.getDefaultPolicy().allowedDomains,
                        },
                        shell: !policyManagerService.getDefaultPolicy().blockShell,
                    },
                },
            };

            const instructions = dockerAvailable
                ? 'Docker is available. Add the following to your OpenClaw config to enable sandboxing:'
                : 'Docker is not installed. Install Docker Desktop for full sandboxing support, or use process-level isolation.';

            return {
                success: true,
                data: {
                    dockerAvailable,
                    sandboxConfig,
                    instructions,
                    runtimeGuard: {
                        node: {
                            supported: true,
                            command: 'clawshield run ./path/to/skill --entry index.js',
                            notes: [
                                'Node guard enforces shell/network/fs/env policies and writes runtime audit events.',
                                'Enable Block FS Writes to restrict writes to allowed directories.',
                            ],
                        },
                        python: {
                            supported: true,
                            command: 'clawshield run ./path/to/skill --entry main.py',
                            notes: [
                                'Python guard uses sitecustomize to patch subprocess, socket, and filesystem writes.',
                                'Network allowlist applies when Block Network is enabled.',
                            ],
                        },
                    },
                },
            };
        } catch (error) {
            reply.status(500);
            return { success: false, error: String(error) };
        }
    });
};
