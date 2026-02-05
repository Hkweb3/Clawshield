// ==========================================
// Skills API Routes
// ==========================================

import { FastifyPluginAsync } from 'fastify';
import {
    skillDiscoveryService,
    riskScannerService,
    policyManagerService,
    auditLoggerService
} from '../services';
import { ApiResponse, Skill, RiskScanResult } from '@clawshield/shared';

interface SkillWithRisk extends Skill {
    risk?: RiskScanResult;
}

export const skillsRoutes: FastifyPluginAsync = async (fastify) => {
    // Get all skills with risk info
    fastify.get<{
        Reply: ApiResponse<SkillWithRisk[]>
    }>('/skills', async (request, reply) => {
        try {
            const skills = await skillDiscoveryService.discoverSkills();

            // Add risk info and enabled status
            const skillsWithRisk: SkillWithRisk[] = await Promise.all(
                skills.map(async (skill) => {
                    const risk = await riskScannerService.scanSkill(skill);
                    const enabled = policyManagerService.isSkillEnabled(skill.id);
                    return { ...skill, risk, enabled };
                })
            );

            return { success: true, data: skillsWithRisk };
        } catch (error) {
            return { success: false, error: String(error) };
        }
    });

    // Get single skill by ID
    fastify.get<{
        Params: { id: string };
        Reply: ApiResponse<SkillWithRisk>
    }>('/skills/:id', async (request, reply) => {
        try {
            const skill = await skillDiscoveryService.getSkillById(request.params.id);

            if (!skill) {
                reply.status(404);
                return { success: false, error: 'Skill not found' };
            }

            const risk = await riskScannerService.scanSkill(skill);
            const enabled = policyManagerService.isSkillEnabled(skill.id);

            return { success: true, data: { ...skill, risk, enabled } };
        } catch (error) {
            return { success: false, error: String(error) };
        }
    });

    // Rescan a specific skill
    fastify.post<{
        Params: { id: string };
        Reply: ApiResponse<RiskScanResult>
    }>('/skills/:id/scan', async (request, reply) => {
        try {
            const skill = await skillDiscoveryService.getSkillById(request.params.id);

            if (!skill) {
                reply.status(404);
                return { success: false, error: 'Skill not found' };
            }

            const risk = await riskScannerService.scanSkill(skill);

            // Log the scan
            auditLoggerService.logScan(
                skill.id,
                skill.name,
                risk.score,
                risk.flags.map(f => f.type)
            );

            return { success: true, data: risk };
        } catch (error) {
            return { success: false, error: String(error) };
        }
    });

    // Toggle skill enabled/disabled
    fastify.post<{
        Params: { id: string };
        Body: { enabled?: boolean };
        Reply: ApiResponse<{ enabled: boolean }>
    }>('/skills/:id/toggle', async (request, reply) => {
        try {
            const skill = await skillDiscoveryService.getSkillById(request.params.id);

            if (!skill) {
                reply.status(404);
                return { success: false, error: 'Skill not found' };
            }

            const { enabled } = request.body;

            // Validate enabled field exists
            if (enabled === undefined) {
                reply.status(400);
                return { success: false, error: 'Missing enabled field in request body' };
            }

            if (enabled) {
                policyManagerService.enableSkill(skill.id);
            } else {
                policyManagerService.disableSkill(skill.id);
            }

            // Log the toggle
            auditLoggerService.logToggle(skill.id, skill.name, enabled);

            return { success: true, data: { enabled } };
        } catch (error) {
            reply.status(500);
            return { success: false, error: String(error) };
        }
    });
};
