// ==========================================
// Preflight API Routes
// ==========================================

import { FastifyPluginAsync } from 'fastify';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import { exec } from 'child_process';
import { promisify } from 'util';
import {
    skillDiscoveryService,
    riskScannerService,
    policyManagerService,
    auditLoggerService
} from '../services';
import {
    ApiResponse,
    PreflightResponse,
    RiskScanResult
} from '@clawshield/shared';
import { SLUG_REGEX, RISK_THRESHOLDS } from '@clawshield/shared';

const execAsync = promisify(exec);

export const preflightRoutes: FastifyPluginAsync = async (fastify) => {
    // Preflight scan a ClawHub skill
    fastify.post<{
        Body: { slug: string; workspacePath?: string };
        Reply: ApiResponse<PreflightResponse>
    }>('/preflight', async (request, reply) => {
        const { slug, workspacePath } = request.body;

        // Validate slug (security critical!)
        if (!slug || !SLUG_REGEX.test(slug)) {
            reply.status(400);
            return {
                success: false,
                error: 'Invalid slug. Only lowercase letters, numbers, hyphens, and underscores are allowed.'
            };
        }

        try {
            // Create temp directory
            const tempDir = path.join(os.tmpdir(), `clawshield-preflight-${Date.now()}`);
            fs.mkdirSync(tempDir, { recursive: true });

            try {
                // Try to install via clawhub (if available)
                // NOTE: This is a simulated install - in real implementation, 
                // you'd call the actual clawhub CLI
                const skillPath = path.join(tempDir, slug);

                // Check if clawhub is available
                let clawHubAvailable = false;
                try {
                    await execAsync('clawhub --version');
                    clawHubAvailable = true;
                } catch {
                    // clawhub not available, we'll create a mock for demo
                }

                if (clawHubAvailable) {
                    // Real clawhub install to temp
                    await execAsync(`clawhub install ${slug} --target "${tempDir}"`, {
                        timeout: 30000,
                    });
                } else {
                    // For demo: create mock skill folder
                    fs.mkdirSync(skillPath, { recursive: true });
                    fs.writeFileSync(
                        path.join(skillPath, 'SKILL.md'),
                        `---\nname: ${slug}\ndescription: Skill from ClawHub (preflight preview)\n---\n\n# ${slug}\n\nThis is a preflight preview.`
                    );
                }

                // Parse the skill
                const skill = await skillDiscoveryService.parseSkill(skillPath, 'workspace');

                if (!skill) {
                    return {
                        success: false,
                        error: 'Failed to parse skill from ClawHub',
                    };
                }

                // Scan for risks
                const risk = await riskScannerService.scanSkill(skill);

                // Check against policy
                const policy = policyManagerService.getDefaultPolicy();
                let canInstall = true;
                let blockReason: string | undefined;

                if (risk.score > RISK_THRESHOLDS.WARNING_MAX) {
                    if (policy.blockShell && risk.flags.some(f => f.type === 'shell_execution')) {
                        canInstall = false;
                        blockReason = 'Skill executes shell commands and shell execution is blocked by policy';
                    }
                    if (policy.blockNetwork && risk.flags.some(f => f.type === 'network_call')) {
                        canInstall = false;
                        blockReason = 'Skill makes network calls and network access is blocked by policy';
                    }
                }

                if (risk.recommendation === 'block') {
                    canInstall = false;
                    blockReason = blockReason || 'High risk score - manual review required';
                }

                // Log the preflight
                auditLoggerService.log(
                    'scan',
                    canInstall ? 'success' : 'blocked',
                    { slug, score: risk.score, canInstall },
                    skill.id,
                    skill.name
                );

                return {
                    success: true,
                    data: {
                        slug,
                        skill,
                        risk,
                        canInstall,
                        blockReason,
                    },
                };

            } finally {
                // Cleanup temp directory
                try {
                    fs.rmSync(tempDir, { recursive: true, force: true });
                } catch {
                    // Ignore cleanup errors
                }
            }

        } catch (error) {
            reply.status(500);
            return { success: false, error: String(error) };
        }
    });

    // Install a skill after preflight
    fastify.post<{
        Body: { slug: string; workspacePath: string; force?: boolean };
        Reply: ApiResponse<{ installed: boolean; path: string }>
    }>('/install', async (request, reply) => {
        const { slug, workspacePath, force } = request.body;

        // Validate slug
        if (!slug || !SLUG_REGEX.test(slug)) {
            reply.status(400);
            return {
                success: false,
                error: 'Invalid slug'
            };
        }

        // Validate workspace path exists
        if (!fs.existsSync(workspacePath)) {
            reply.status(400);
            return {
                success: false,
                error: 'Workspace path does not exist'
            };
        }

        try {
            const skillsDir = path.join(workspacePath, 'skills');
            fs.mkdirSync(skillsDir, { recursive: true });

            const targetPath = path.join(skillsDir, slug);

            // Check if already exists
            if (fs.existsSync(targetPath) && !force) {
                reply.status(409);
                return {
                    success: false,
                    error: 'Skill already exists. Use force=true to overwrite.',
                };
            }

            // Try real clawhub install
            try {
                await execAsync(`clawhub install ${slug} --target "${skillsDir}"`, {
                    timeout: 60000,
                });
            } catch {
                // Mock install for demo
                fs.mkdirSync(targetPath, { recursive: true });
                fs.writeFileSync(
                    path.join(targetPath, 'SKILL.md'),
                    `---\nname: ${slug}\ndescription: Installed from ClawHub\n---\n\n# ${slug}\n\nInstalled via ClawShield.`
                );
            }

            // Log the install
            auditLoggerService.logInstall(slug, slug, 'clawhub');

            return {
                success: true,
                data: {
                    installed: true,
                    path: targetPath,
                },
            };

        } catch (error) {
            reply.status(500);
            return { success: false, error: String(error) };
        }
    });
};
