// ==========================================
// Skill Discovery Service
// ==========================================

import * as fs from 'fs';
import * as path from 'path';
import matter from 'gray-matter';
import { glob } from 'glob';
import { v4 as uuidv4 } from 'uuid';
import {
    Skill,
    SkillMetadata,
    SkillSource,
    OpenClawStatus
} from '@clawshield/shared';
import { DEFAULT_OPENCLAW_PATH } from '@clawshield/shared';

export class SkillDiscoveryService {
    private openclawPath: string;
    private workspacePath: string | null;

    constructor(openclawPath?: string, workspacePath?: string) {
        this.openclawPath = openclawPath || DEFAULT_OPENCLAW_PATH;
        this.workspacePath = workspacePath || null;
    }

    /**
     * Check if OpenClaw is installed and get status
     */
    async getOpenClawStatus(): Promise<OpenClawStatus> {
        const skillsPath = path.join(this.openclawPath, 'skills');
        const detected = fs.existsSync(this.openclawPath);

        if (!detected) {
            return { detected: false };
        }

        const managedSkillsCount = await this.countSkillsInDirectory(skillsPath);
        const workspaceSkillsPath = this.workspacePath
            ? path.join(this.workspacePath, 'skills')
            : undefined;
        const workspaceSkillsCount = workspaceSkillsPath
            ? await this.countSkillsInDirectory(workspaceSkillsPath)
            : 0;

        return {
            detected: true,
            skillsPath,
            workspaceSkillsPath,
            managedSkillsCount,
            workspaceSkillsCount,
            bundledSkillsCount: 0, // Bundled skills are in OpenClaw itself
        };
    }

    /**
     * Count skill folders in a directory
     */
    private async countSkillsInDirectory(dirPath: string): Promise<number> {
        if (!fs.existsSync(dirPath)) return 0;

        try {
            const entries = await fs.promises.readdir(dirPath, { withFileTypes: true });
            let count = 0;

            for (const entry of entries) {
                if (entry.isDirectory()) {
                    const skillMdPath = path.join(dirPath, entry.name, 'SKILL.md');
                    if (fs.existsSync(skillMdPath)) {
                        count++;
                    }
                }
            }

            return count;
        } catch {
            return 0;
        }
    }

    /**
     * Discover all skills from configured directories
     */
    async discoverSkills(): Promise<Skill[]> {
        const skills: Skill[] = [];

        // Scan managed skills (~/.openclaw/skills)
        const managedPath = path.join(this.openclawPath, 'skills');
        if (fs.existsSync(managedPath)) {
            const managedSkills = await this.scanDirectory(managedPath, 'managed');
            skills.push(...managedSkills);
        }

        // Scan workspace skills (<workspace>/skills)
        if (this.workspacePath) {
            const workspacePath = path.join(this.workspacePath, 'skills');
            if (fs.existsSync(workspacePath)) {
                const workspaceSkills = await this.scanDirectory(workspacePath, 'workspace');
                skills.push(...workspaceSkills);
            }
        }

        return skills;
    }

    /**
     * Scan a directory for skill folders
     */
    private async scanDirectory(dirPath: string, source: SkillSource): Promise<Skill[]> {
        const skills: Skill[] = [];

        try {
            const entries = await fs.promises.readdir(dirPath, { withFileTypes: true });

            for (const entry of entries) {
                if (entry.isDirectory()) {
                    const skillPath = path.join(dirPath, entry.name);
                    const skill = await this.parseSkill(skillPath, source);
                    if (skill) {
                        skills.push(skill);
                    }
                }
            }
        } catch (error) {
            console.error(`Error scanning directory ${dirPath}:`, error);
        }

        return skills;
    }

    /**
     * Parse a single skill folder
     */
    async parseSkill(skillPath: string, source: SkillSource): Promise<Skill | null> {
        const skillMdPath = path.join(skillPath, 'SKILL.md');

        if (!fs.existsSync(skillMdPath)) {
            return null;
        }

        try {
            const content = await fs.promises.readFile(skillMdPath, 'utf-8');
            const { data, content: body } = matter(content);

            const metadata: SkillMetadata = {
                name: data.name || path.basename(skillPath),
                description: data.description,
                version: data.version,
                author: data.author,
                primaryEnv: data.primaryEnv,
                requires: data.metadata?.openclaw?.requires || data.requires,
                ...data,
            };

            // Generate a unique ID based on path
            const id = Buffer.from(skillPath).toString('base64url').slice(0, 16);

            return {
                id,
                name: metadata.name,
                description: metadata.description || this.extractDescription(body),
                path: skillPath,
                source,
                enabled: true, // Default to enabled
                metadata,
            };
        } catch (error) {
            console.error(`Error parsing skill at ${skillPath}:`, error);
            return null;
        }
    }

    /**
     * Extract description from SKILL.md content if not in frontmatter
     */
    private extractDescription(content: string): string {
        // Try to get first paragraph after any headers
        const lines = content.split('\n');
        let foundContent = false;
        let description = '';

        for (const line of lines) {
            const trimmed = line.trim();
            if (!trimmed || trimmed.startsWith('#')) {
                if (foundContent) break;
                continue;
            }
            foundContent = true;
            description += (description ? ' ' : '') + trimmed;
            if (description.length > 200) break;
        }

        return description.slice(0, 200) || 'No description available';
    }

    /**
     * Set the workspace path
     */
    setWorkspacePath(workspacePath: string): void {
        this.workspacePath = workspacePath;
    }

    /**
     * Get skill by ID
     */
    async getSkillById(id: string): Promise<Skill | null> {
        const skills = await this.discoverSkills();
        return skills.find(s => s.id === id) || null;
    }

    /**
     * List files in a skill folder (for scanning)
     */
    async listSkillFiles(skillPath: string): Promise<string[]> {
        const extensions = ['js', 'ts', 'jsx', 'tsx', 'py', 'sh', 'bash', 'ps1'];
        const patterns = extensions.map(ext => `${skillPath}/**/*.${ext}`);

        const files: string[] = [];
        for (const pattern of patterns) {
            const matches = await glob(pattern, { nodir: true });
            files.push(...matches);
        }

        return files;
    }
}

export const skillDiscoveryService = new SkillDiscoveryService();
