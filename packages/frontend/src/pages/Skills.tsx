import { useEffect, useState } from 'react'
import {
    Search,
    RefreshCw,
    CheckCircle,
    XCircle,
    AlertTriangle,
    ChevronRight,
    X,
    Shield,
    Folder,
    ExternalLink
} from 'lucide-react'
import { api, Skill } from '../services/api'

export default function Skills() {
    const [skills, setSkills] = useState<Skill[]>([])
    const [loading, setLoading] = useState(true)
    const [error, setError] = useState<string | null>(null)
    const [search, setSearch] = useState('')
    const [selectedSkill, setSelectedSkill] = useState<Skill | null>(null)
    const [scanning, setScanning] = useState<string | null>(null)

    useEffect(() => {
        loadSkills()
    }, [])

    const loadSkills = async () => {
        try {
            setLoading(true)
            const data = await api.getSkills()
            setSkills(data)
        } catch (err) {
            setError(String(err))
        } finally {
            setLoading(false)
        }
    }

    const handleToggle = async (skill: Skill) => {
        try {
            await api.toggleSkill(skill.id, !skill.enabled)
            setSkills(skills.map(s =>
                s.id === skill.id ? { ...s, enabled: !s.enabled } : s
            ))
            if (selectedSkill?.id === skill.id) {
                setSelectedSkill({ ...selectedSkill, enabled: !selectedSkill.enabled })
            }
        } catch (err) {
            console.error('Failed to toggle skill:', err)
        }
    }

    const handleRescan = async (skill: Skill) => {
        try {
            setScanning(skill.id)
            const risk = await api.scanSkill(skill.id)
            setSkills(skills.map(s =>
                s.id === skill.id ? { ...s, risk } : s
            ))
            if (selectedSkill?.id === skill.id) {
                setSelectedSkill({ ...selectedSkill, risk })
            }
        } catch (err) {
            console.error('Failed to rescan skill:', err)
        } finally {
            setScanning(null)
        }
    }

    const getRiskBadge = (score: number) => {
        if (score <= 30) return { class: 'risk-safe', label: 'Safe', icon: CheckCircle }
        if (score <= 60) return { class: 'risk-warning', label: 'Warning', icon: AlertTriangle }
        return { class: 'risk-danger', label: 'Danger', icon: XCircle }
    }

    const getSourceBadge = (source: string) => {
        switch (source) {
            case 'bundled': return 'bg-primary-500/20 text-primary-400'
            case 'managed': return 'bg-purple-500/20 text-purple-400'
            case 'workspace': return 'bg-cyan-500/20 text-cyan-400'
            default: return 'bg-dark-600 text-dark-300'
        }
    }

    const filterFlagsBySource = (flags: { source?: string }[] | undefined, source: string) => {
        if (!flags) return []
        return flags.filter(f => f.source === source)
    }

    const filteredSkills = skills.filter(s =>
        s.name.toLowerCase().includes(search.toLowerCase()) ||
        s.description.toLowerCase().includes(search.toLowerCase())
    )

    if (loading) {
        return (
            <div className="flex items-center justify-center h-64">
                <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-primary-500"></div>
            </div>
        )
    }

    return (
        <div className="animate-fadeIn">
            {/* Header */}
            <div className="flex items-center justify-between mb-8">
                <div>
                    <h1 className="text-3xl font-bold text-white">Skills</h1>
                    <p className="text-dark-400 mt-1">Manage and monitor installed skills</p>
                </div>
                <button
                    onClick={loadSkills}
                    className="flex items-center gap-2 px-4 py-2 bg-dark-700 hover:bg-dark-600 rounded-lg transition-colors"
                >
                    <RefreshCw className="w-4 h-4" />
                    <span>Refresh</span>
                </button>
            </div>

            {/* Search */}
            <div className="relative mb-6">
                <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-dark-400" />
                <input
                    type="text"
                    placeholder="Search skills..."
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    className="w-full pl-12 pr-4 py-3 bg-dark-800 border border-dark-700 rounded-xl focus:outline-none focus:border-primary-500 text-white placeholder-dark-400"
                />
            </div>

            {error && (
                <div className="glass rounded-xl p-6 mb-6">
                    <div className="flex items-center gap-3 text-danger-400">
                        <AlertTriangle className="w-6 h-6" />
                        <span>Failed to load skills: {error}</span>
                    </div>
                </div>
            )}

            {/* Skills Grid */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                {filteredSkills.map((skill) => {
                    const riskScore = skill.risk?.score ?? 0
                    const riskBadge = getRiskBadge(riskScore)
                    const RiskIcon = riskBadge.icon

                    return (
                        <div
                            key={skill.id}
                            className="glass rounded-xl p-5 card-hover cursor-pointer"
                            onClick={() => setSelectedSkill(skill)}
                        >
                            <div className="flex items-start justify-between">
                                <div className="flex-1 min-w-0">
                                    <div className="flex items-center gap-2 mb-2">
                                        <h3 className="text-lg font-semibold text-white truncate">{skill.name}</h3>
                                        <span className={`text-xs px-2 py-0.5 rounded ${getSourceBadge(skill.source)}`}>
                                            {skill.source}
                                        </span>
                                    </div>
                                    <p className="text-dark-400 text-sm line-clamp-2 mb-3">{skill.description}</p>

                                    <div className="flex items-center gap-3">
                                        <span className={`flex items-center gap-1.5 text-xs px-2 py-1 rounded ${riskBadge.class}`}>
                                            <RiskIcon className="w-3 h-3" />
                                            {riskScore}/100
                                        </span>
                                        {skill.risk?.recommendation && (
                                            <span className="text-xs text-dark-400">
                                                {skill.risk.recommendation}
                                            </span>
                                        )}
                                    </div>
                                </div>

                                <div className="flex items-center gap-3 ml-4">
                                    {/* Toggle */}
                                    <button
                                        onClick={(e) => {
                                            e.stopPropagation()
                                            handleToggle(skill)
                                        }}
                                        className={`toggle-switch ${skill.enabled ? 'toggle-switch-enabled' : 'toggle-switch-disabled'}`}
                                    >
                                        <span className={`toggle-switch-knob ${skill.enabled ? 'translate-x-6' : 'translate-x-1'}`} />
                                    </button>
                                    <ChevronRight className="w-5 h-5 text-dark-400" />
                                </div>
                            </div>
                        </div>
                    )
                })}
            </div>

            {filteredSkills.length === 0 && (
                <div className="text-center py-12">
                    <Shield className="w-12 h-12 text-dark-500 mx-auto mb-4" />
                    <p className="text-dark-400">No skills found</p>
                </div>
            )}

            {/* Skill Details Drawer */}
            {selectedSkill && (
                <div className="fixed inset-0 z-50 flex justify-end">
                    <div className="absolute inset-0 bg-black/50" onClick={() => setSelectedSkill(null)} />
                    <div className="relative w-full max-w-lg bg-dark-800 border-l border-dark-700 overflow-y-auto animate-fadeIn">
                        {/* Header */}
                        <div className="sticky top-0 bg-dark-800 border-b border-dark-700 p-6 flex items-center justify-between">
                            <h2 className="text-xl font-bold text-white">{selectedSkill.name}</h2>
                            <button
                                onClick={() => setSelectedSkill(null)}
                                className="p-2 hover:bg-dark-700 rounded-lg transition-colors"
                            >
                                <X className="w-5 h-5" />
                            </button>
                        </div>

                        <div className="p-6 space-y-6">
                            {/* Description */}
                            <div>
                                <h3 className="text-sm font-medium text-dark-400 mb-2">Description</h3>
                                <p className="text-white">{selectedSkill.description}</p>
                            </div>

                            {/* Path */}
                            <div>
                                <h3 className="text-sm font-medium text-dark-400 mb-2">Location</h3>
                                <div className="flex items-center gap-2 text-dark-300 text-sm bg-dark-900 p-3 rounded-lg">
                                    <Folder className="w-4 h-4 flex-shrink-0" />
                                    <span className="truncate">{selectedSkill.path}</span>
                                </div>
                            </div>

                            {/* Risk Score */}
                            {selectedSkill.risk && (
                                <>
                                    <div>
                                        <h3 className="text-sm font-medium text-dark-400 mb-2">Risk Analysis</h3>
                                        <div className={`p-4 rounded-lg ${getRiskBadge(selectedSkill.risk.score).class}`}>
                                            <div className="flex items-center justify-between mb-2">
                                                <span className="font-semibold">Score: {selectedSkill.risk.score}/100</span>
                                                <span className="text-sm">{selectedSkill.risk.recommendation}</span>
                                            </div>
                                            <p className="text-sm opacity-80">{selectedSkill.risk.explanation}</p>
                                            {(selectedSkill.risk.dependencyCount || selectedSkill.risk.astCount || selectedSkill.risk.behaviorCount) && (
                                                <div className="mt-3 text-xs opacity-80">
                                                    {typeof selectedSkill.risk.astCount === 'number' && (
                                                        <span className="mr-3">AST: {selectedSkill.risk.astCount}</span>
                                                    )}
                                                    {typeof selectedSkill.risk.dependencyCount === 'number' && (
                                                        <span className="mr-3">Deps: {selectedSkill.risk.dependencyCount}</span>
                                                    )}
                                                    {typeof selectedSkill.risk.behaviorCount === 'number' && (
                                                        <span>Behavior: {selectedSkill.risk.behaviorCount}</span>
                                                    )}
                                                </div>
                                            )}
                                        </div>
                                    </div>

                                    {/* Flags */}
                                    {selectedSkill.risk.flags.length > 0 && (
                                        <div>
                                            <h3 className="text-sm font-medium text-dark-400 mb-2">
                                                Detected Patterns ({selectedSkill.risk.flags.length})
                                            </h3>
                                            <div className="space-y-2">
                                                {selectedSkill.risk.flags.map((flag, i) => (
                                                    <div key={i} className="bg-dark-900 p-3 rounded-lg">
                                                        <div className="flex items-center gap-2 mb-1">
                                                            <span className={`text-xs px-2 py-0.5 rounded ${flag.severity === 'critical' ? 'bg-danger-500/20 text-danger-400' :
                                                                    flag.severity === 'high' ? 'bg-warning-500/20 text-warning-400' :
                                                                        'bg-dark-600 text-dark-300'
                                                                }`}>
                                                                {flag.severity}
                                                            </span>
                                                            {flag.source && (
                                                                <span className="text-xs px-2 py-0.5 rounded bg-dark-700 text-dark-300">
                                                                    {flag.source}
                                                                </span>
                                                            )}
                                                            <span className="text-sm text-white">{flag.type}</span>
                                                        </div>
                                                        <p className="text-xs text-dark-400">{flag.description}</p>
                                                        {flag.location && (
                                                            <p className="text-xs text-dark-500 mt-1">
                                                                {flag.location}{flag.line ? `:${flag.line}` : ''}
                                                            </p>
                                                        )}
                                                        {flag.evidence && (
                                                            <p className="text-xs text-dark-500 mt-1">
                                                                {flag.evidence}
                                                            </p>
                                                        )}
                                                    </div>
                                                ))}
                                            </div>
                                        </div>
                                    )}

                                    {/* Dependency Findings */}
                                    {filterFlagsBySource(selectedSkill.risk.flags, 'dependency').length > 0 && (
                                        <div>
                                            <h3 className="text-sm font-medium text-dark-400 mb-2">
                                                Dependency Findings ({filterFlagsBySource(selectedSkill.risk.flags, 'dependency').length})
                                            </h3>
                                            <div className="space-y-2">
                                                {filterFlagsBySource(selectedSkill.risk.flags, 'dependency').map((flag, i) => (
                                                    <div key={`dep-${i}`} className="bg-dark-900 p-3 rounded-lg">
                                                        <p className="text-sm text-white">{flag.description}</p>
                                                        {flag.evidence && (
                                                            <p className="text-xs text-dark-500 mt-1">{flag.evidence}</p>
                                                        )}
                                                    </div>
                                                ))}
                                            </div>
                                        </div>
                                    )}

                                    {/* AST Findings */}
                                    {filterFlagsBySource(selectedSkill.risk.flags, 'ast').length > 0 && (
                                        <div>
                                            <h3 className="text-sm font-medium text-dark-400 mb-2">
                                                AST Findings ({filterFlagsBySource(selectedSkill.risk.flags, 'ast').length})
                                            </h3>
                                            <div className="space-y-2">
                                                {filterFlagsBySource(selectedSkill.risk.flags, 'ast').map((flag, i) => (
                                                    <div key={`ast-${i}`} className="bg-dark-900 p-3 rounded-lg">
                                                        <p className="text-sm text-white">{flag.description}</p>
                                                        {flag.location && (
                                                            <p className="text-xs text-dark-500 mt-1">
                                                                {flag.location}{flag.line ? `:${flag.line}` : ''}
                                                            </p>
                                                        )}
                                                        {flag.evidence && (
                                                            <p className="text-xs text-dark-500 mt-1">{flag.evidence}</p>
                                                        )}
                                                    </div>
                                                ))}
                                            </div>
                                        </div>
                                    )}

                                    {/* Runtime Behavior Findings */}
                                    {filterFlagsBySource(selectedSkill.risk.flags, 'behavior').length > 0 && (
                                        <div>
                                            <h3 className="text-sm font-medium text-dark-400 mb-2">
                                                Runtime Findings ({filterFlagsBySource(selectedSkill.risk.flags, 'behavior').length})
                                            </h3>
                                            <div className="space-y-2">
                                                {filterFlagsBySource(selectedSkill.risk.flags, 'behavior').map((flag, i) => (
                                                    <div key={`behavior-${i}`} className="bg-dark-900 p-3 rounded-lg">
                                                        <p className="text-sm text-white">{flag.description}</p>
                                                        {flag.evidence && (
                                                            <p className="text-xs text-dark-500 mt-1">{flag.evidence}</p>
                                                        )}
                                                    </div>
                                                ))}
                                            </div>
                                        </div>
                                    )}
                                </>
                            )}

                            {/* Actions */}
                            <div className="pt-4 border-t border-dark-700 space-y-3">
                                <button
                                    onClick={() => handleRescan(selectedSkill)}
                                    disabled={scanning === selectedSkill.id}
                                    className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-primary-500/20 text-primary-400 rounded-lg hover:bg-primary-500/30 transition-colors disabled:opacity-50"
                                >
                                    <RefreshCw className={`w-4 h-4 ${scanning === selectedSkill.id ? 'animate-spin' : ''}`} />
                                    {scanning === selectedSkill.id ? 'Scanning...' : 'Rescan Skill'}
                                </button>

                                <button
                                    onClick={() => handleToggle(selectedSkill)}
                                    className={`w-full flex items-center justify-center gap-2 px-4 py-3 rounded-lg transition-colors ${selectedSkill.enabled
                                            ? 'bg-danger-500/20 text-danger-400 hover:bg-danger-500/30'
                                            : 'bg-success-500/20 text-success-400 hover:bg-success-500/30'
                                        }`}
                                >
                                    {selectedSkill.enabled ? (
                                        <>
                                            <XCircle className="w-4 h-4" />
                                            Disable Skill
                                        </>
                                    ) : (
                                        <>
                                            <CheckCircle className="w-4 h-4" />
                                            Enable Skill
                                        </>
                                    )}
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    )
}
