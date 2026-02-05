// ==========================================
// Policies API Routes
// ==========================================

import { FastifyPluginAsync } from 'fastify';
import { policyManagerService, auditLoggerService } from '../services';
import { ApiResponse, ClawShieldConfig, DirectoryPermission } from '@clawshield/shared';

export const policiesRoutes: FastifyPluginAsync = async (fastify) => {
    // Get full config
    fastify.get<{
        Reply: ApiResponse<ClawShieldConfig>
    }>('/policies', async (request, reply) => {
        try {
            const config = policyManagerService.getConfig();
            return { success: true, data: config };
        } catch (error) {
            reply.status(500);
            return { success: false, error: String(error) };
        }
    });

    // Update default policy
    fastify.post<{
        Body: {
            blockShell?: boolean;
            blockSecrets?: boolean;
            blockNetwork?: boolean;
            blockFsWrite?: boolean;
            allowedDirs?: DirectoryPermission[];
            allowedDomains?: string[];
        };
        Reply: ApiResponse<ClawShieldConfig>
    }>('/policies', async (request, reply) => {
        try {
            const { blockShell, blockSecrets, blockNetwork, blockFsWrite, allowedDirs, allowedDomains } = request.body;

            policyManagerService.updateDefaultPolicy({
                ...(blockShell !== undefined && { blockShell }),
                ...(blockSecrets !== undefined && { blockSecrets }),
                ...(blockNetwork !== undefined && { blockNetwork }),
                ...(blockFsWrite !== undefined && { blockFsWrite }),
                ...(allowedDirs !== undefined && { allowedDirs }),
                ...(allowedDomains !== undefined && { allowedDomains }),
            });

            auditLoggerService.logPolicyChange(request.body);

            const config = policyManagerService.getConfig();
            return { success: true, data: config };
        } catch (error) {
            reply.status(500);
            return { success: false, error: String(error) };
        }
    });

    // Add allowed directory
    fastify.post<{
        Body: DirectoryPermission;
        Reply: ApiResponse<ClawShieldConfig>
    }>('/policies/directories', async (request, reply) => {
        try {
            policyManagerService.addAllowedDir(request.body);
            auditLoggerService.logPolicyChange({ addedDir: request.body });

            const config = policyManagerService.getConfig();
            return { success: true, data: config };
        } catch (error) {
            reply.status(500);
            return { success: false, error: String(error) };
        }
    });

    // Remove allowed directory
    fastify.delete<{
        Body: { path: string };
        Reply: ApiResponse<ClawShieldConfig>
    }>('/policies/directories', async (request, reply) => {
        try {
            policyManagerService.removeAllowedDir(request.body.path);
            auditLoggerService.logPolicyChange({ removedDir: request.body.path });

            const config = policyManagerService.getConfig();
            return { success: true, data: config };
        } catch (error) {
            reply.status(500);
            return { success: false, error: String(error) };
        }
    });

    // Add allowed domain
    fastify.post<{
        Body: { domain: string };
        Reply: ApiResponse<ClawShieldConfig>
    }>('/policies/domains', async (request, reply) => {
        try {
            policyManagerService.addAllowedDomain(request.body.domain);
            auditLoggerService.logPolicyChange({ addedDomain: request.body.domain });

            const config = policyManagerService.getConfig();
            return { success: true, data: config };
        } catch (error) {
            reply.status(500);
            return { success: false, error: String(error) };
        }
    });

    // Remove allowed domain
    fastify.delete<{
        Body: { domain: string };
        Reply: ApiResponse<ClawShieldConfig>
    }>('/policies/domains', async (request, reply) => {
        try {
            policyManagerService.removeAllowedDomain(request.body.domain);
            auditLoggerService.logPolicyChange({ removedDomain: request.body.domain });

            const config = policyManagerService.getConfig();
            return { success: true, data: config };
        } catch (error) {
            reply.status(500);
            return { success: false, error: String(error) };
        }
    });

    // Add workspace path
    fastify.post<{
        Body: { path: string };
        Reply: ApiResponse<ClawShieldConfig>
    }>('/policies/workspaces', async (request, reply) => {
        try {
            policyManagerService.addWorkspacePath(request.body.path);
            auditLoggerService.logPolicyChange({ addedWorkspace: request.body.path });

            const config = policyManagerService.getConfig();
            return { success: true, data: config };
        } catch (error) {
            reply.status(500);
            return { success: false, error: String(error) };
        }
    });

    // Remove workspace path
    fastify.delete<{
        Body: { path: string };
        Reply: ApiResponse<ClawShieldConfig>
    }>('/policies/workspaces', async (request, reply) => {
        try {
            policyManagerService.removeWorkspacePath(request.body.path);
            auditLoggerService.logPolicyChange({ removedWorkspace: request.body.path });

            const config = policyManagerService.getConfig();
            return { success: true, data: config };
        } catch (error) {
            reply.status(500);
            return { success: false, error: String(error) };
        }
    });
};
