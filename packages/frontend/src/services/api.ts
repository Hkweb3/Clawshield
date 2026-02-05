const API_BASE = '/api'

export interface Skill {
    id: string
    name: string
    description: string
    path: string
    source: 'bundled' | 'managed' | 'workspace'
    enabled: boolean
    metadata: Record<string, unknown>
    risk?: RiskScanResult
}

export interface RiskScanResult {
    score: number
    flags: RiskFlag[]
    explanation: string
    recommendation: 'allow' | 'sandbox' | 'block'
    scannedAt: string
    dependencyCount?: number
    astCount?: number
    behaviorCount?: number
}

export interface RiskFlag {
    type: string
    severity: 'low' | 'medium' | 'high' | 'critical'
    description: string
    location?: string
    line?: number
    source?: 'regex' | 'ast' | 'dependency' | 'behavior'
    evidence?: string
}

export interface DashboardSummary {
    openclawStatus: {
        detected: boolean
        version?: string
        skillsPath?: string
        workspaceSkillsPath?: string
        bundledSkillsCount?: number
        managedSkillsCount?: number
        workspaceSkillsCount?: number
    }
    totalSkills: number
    enabledSkills: number
    disabledSkills: number
    riskBreakdown: {
        safe: number
        warning: number
        danger: number
    }
    recentAuditEntries: AuditEntry[]
}

export interface AuditEntry {
    id: string
    timestamp: string
    action: string
    skillId?: string
    skillName?: string
    details: Record<string, unknown>
    result: 'success' | 'failure' | 'blocked'
}

export interface Policy {
    allowedDirs: { path: string; mode: 'read' | 'readwrite' }[]
    allowedDomains: string[]
    blockShell: boolean
    blockSecrets: boolean
    blockNetwork: boolean
    blockFsWrite: boolean
}

export interface PreflightResponse {
    slug: string
    skill?: Skill
    risk: RiskScanResult
    canInstall: boolean
    blockReason?: string
}

async function fetchApi<T>(endpoint: string, options?: RequestInit): Promise<T> {
    const res = await fetch(`${API_BASE}${endpoint}`, {
        headers: {
            'Content-Type': 'application/json',
        },
        ...options,
    })
    const data = await res.json()
    if (!data.success) {
        throw new Error(data.error || 'API request failed')
    }
    return data.data
}

export const api = {
    // Dashboard
    getDashboard: () => fetchApi<DashboardSummary>('/dashboard'),

    // Skills
    getSkills: () => fetchApi<Skill[]>('/skills'),
    getSkill: (id: string) => fetchApi<Skill>(`/skills/${id}`),
    scanSkill: (id: string) => fetchApi<RiskScanResult>(`/skills/${id}/scan`, { method: 'POST' }),
    toggleSkill: (id: string, enabled: boolean) =>
        fetchApi<{ enabled: boolean }>(`/skills/${id}/toggle`, {
            method: 'POST',
            body: JSON.stringify({ enabled }),
        }),

    // Policies
    getPolicies: () => fetchApi<{ defaultPolicy: Policy }>('/policies'),
    updatePolicies: (policy: Partial<Policy>) =>
        fetchApi<{ defaultPolicy: Policy }>('/policies', {
            method: 'POST',
            body: JSON.stringify(policy),
        }),

    // Preflight
    preflight: (slug: string) =>
        fetchApi<PreflightResponse>('/preflight', {
            method: 'POST',
            body: JSON.stringify({ slug }),
        }),
    install: (slug: string, workspacePath: string) =>
        fetchApi<{ installed: boolean; path: string }>('/install', {
            method: 'POST',
            body: JSON.stringify({ slug, workspacePath }),
        }),

    // Audit
    getAudit: (limit = 50) => fetchApi<AuditEntry[]>(`/audit?limit=${limit}`),

    // Sandbox
    getSandbox: () => fetchApi<{
        dockerAvailable: boolean
        sandboxConfig: object
        instructions: string
        runtimeGuard: {
            node: { supported: boolean; command: string; notes: string[] }
            python: { supported: boolean; command: string; notes: string[] }
        }
    }>('/sandbox'),
}
