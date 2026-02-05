// ==========================================
// ClawShield Shared Types
// ==========================================

export type SkillSource = 'bundled' | 'managed' | 'workspace';
export type RiskRecommendation = 'allow' | 'sandbox' | 'block';
export type AuditAction = 'scan' | 'install' | 'block' | 'policy_change' | 'enable' | 'disable' | 'runtime';
export type DirectoryMode = 'read' | 'readwrite';

// Skill metadata parsed from SKILL.md frontmatter
export interface SkillMetadata {
    name: string;
    description?: string;
    version?: string;
    author?: string;
    primaryEnv?: string;
    requires?: string[];
    [key: string]: unknown;
}

// Risk flag detected during scanning
export interface RiskFlag {
    type: string;
    severity: 'low' | 'medium' | 'high' | 'critical';
    description: string;
    location?: string;
    line?: number;
    source?: 'regex' | 'ast' | 'dependency' | 'behavior';
    evidence?: string;
}

// Risk scan result
export interface RiskScanResult {
    score: number; // 0-100
    flags: RiskFlag[];
    explanation: string;
    recommendation: RiskRecommendation;
    scannedAt: string;
    dependencyCount?: number;
    astCount?: number;
    behaviorCount?: number;
}

// Complete skill representation
export interface Skill {
    id: string;
    name: string;
    description: string;
    path: string;
    source: SkillSource;
    enabled: boolean;
    metadata: SkillMetadata;
    risk?: RiskScanResult;
}

// Directory permission
export interface DirectoryPermission {
    path: string;
    mode: DirectoryMode;
}

// Policy configuration per workspace
export interface Policy {
    id: string;
    workspacePath: string;
    allowedDirs: DirectoryPermission[];
    allowedDomains: string[];
    blockShell: boolean;
    blockSecrets: boolean;
    blockNetwork: boolean;
    blockFsWrite: boolean;
    createdAt: string;
    updatedAt: string;
}

// Global configuration
export interface ClawShieldConfig {
    openclawPath?: string;
    workspacePaths: string[];
    defaultPolicy: Omit<Policy, 'id' | 'workspacePath' | 'createdAt' | 'updatedAt'>;
    enabledSkills: string[];
    disabledSkills: string[];
}

// Audit log entry
export interface AuditEntry {
    id: string;
    timestamp: string;
    action: AuditAction;
    skillId?: string;
    skillName?: string;
    details: Record<string, unknown>;
    result: 'success' | 'failure' | 'blocked';
}

// Preflight scan request
export interface PreflightRequest {
    slug: string;
    workspacePath?: string;
}

// Preflight scan response
export interface PreflightResponse {
    slug: string;
    skill?: Skill;
    risk: RiskScanResult;
    canInstall: boolean;
    blockReason?: string;
}

// OpenClaw detection status
export interface OpenClawStatus {
    detected: boolean;
    version?: string;
    skillsPath?: string;
    workspaceSkillsPath?: string;
    bundledSkillsCount?: number;
    managedSkillsCount?: number;
    workspaceSkillsCount?: number;
}

// Dashboard summary
export interface DashboardSummary {
    openclawStatus: OpenClawStatus;
    totalSkills: number;
    enabledSkills: number;
    disabledSkills: number;
    riskBreakdown: {
        safe: number;     // 0-30
        warning: number;  // 31-60
        danger: number;   // 61-100
    };
    recentAuditEntries: AuditEntry[];
}

// API Response wrapper
export interface ApiResponse<T> {
    success: boolean;
    data?: T;
    error?: string;
}
