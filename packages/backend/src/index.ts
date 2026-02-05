// ==========================================
// ClawShield Backend Server
// ==========================================

import Fastify from 'fastify';
import cors from '@fastify/cors';
import {
    skillsRoutes,
    policiesRoutes,
    preflightRoutes,
    dashboardRoutes
} from './routes';

const PORT = process.env.PORT ? parseInt(process.env.PORT, 10) : 3001;
const HOST = process.env.HOST || '0.0.0.0';

async function main() {
    const fastify = Fastify({
        logger: {
            level: 'info',
            transport: {
                target: 'pino-pretty',
                options: {
                    translateTime: 'HH:MM:ss Z',
                    ignore: 'pid,hostname',
                },
            },
        },
    });

    // Register CORS
    await fastify.register(cors, {
        origin: ['http://localhost:5173', 'http://localhost:3000'],
        methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH'],
    });

    // Register routes with /api prefix
    await fastify.register(async (app) => {
        await app.register(skillsRoutes);
        await app.register(policiesRoutes);
        await app.register(preflightRoutes);
        await app.register(dashboardRoutes);
    }, { prefix: '/api' });

    // Health check
    fastify.get('/health', async () => {
        return { status: 'ok', timestamp: new Date().toISOString() };
    });

    // Root route
    fastify.get('/', async () => {
        return {
            name: 'ClawShield API',
            version: '1.0.0',
            description: 'Security & permissions layer for OpenClaw skills',
            endpoints: [
                'GET /api/dashboard',
                'GET /api/skills',
                'GET /api/skills/:id',
                'POST /api/skills/:id/scan',
                'POST /api/skills/:id/toggle',
                'GET /api/policies',
                'POST /api/policies',
                'POST /api/preflight',
                'POST /api/install',
                'GET /api/audit',
                'GET /api/sandbox',
            ],
        };
    });

    try {
        await fastify.listen({ port: PORT, host: HOST });
        console.log(`
╔═══════════════════════════════════════════════════════╗
║                                                       ║
║   🛡️  ClawShield API Server                           ║
║                                                       ║
║   Running at: http://localhost:${PORT}                  ║
║                                                       ║
╚═══════════════════════════════════════════════════════╝
    `);
    } catch (err) {
        fastify.log.error(err);
        process.exit(1);
    }
}

main();
