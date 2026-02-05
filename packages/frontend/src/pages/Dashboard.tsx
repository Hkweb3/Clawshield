import { useEffect, useState } from 'react'
import {
    Shield,
    Puzzle,
    CheckCircle,
    XCircle,
    AlertTriangle,
    Activity,
    FolderOpen
} from 'lucide-react'
import { api, DashboardSummary } from '../services/api'

export default function Dashboard() {
    const [data, setData] = useState<DashboardSummary | null>(null)
    const [loading, setLoading] = useState(true)
    const [error, setError] = useState<string | null>(null)

    useEffect(() => {
        loadDashboard()
    }, [])

    const loadDashboard = async () => {
        try {
            setLoading(true)
            const summary = await api.getDashboard()
            setData(summary)
        } catch (err) {
            setError(String(err))
        } finally {
            setLoading(false)
        }
    }

    if (loading) {
        return (
            <div className="flex items-center justify-center h-64">
                <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-primary-500"></div>
            </div>
        )
    }

    if (error) {
        return (
            <div className="glass rounded-xl p-6">
                <div className="flex items-center gap-3 text-danger-400">
                    <AlertTriangle className="w-6 h-6" />
                    <span>Failed to load dashboard: {error}</span>
                </div>
                <p className="mt-4 text-dark-400 text-sm">
                    Make sure the ClawShield backend is running on port 3001.
                </p>
            </div>
        )
    }

    const { openclawStatus, totalSkills, enabledSkills, riskBreakdown, recentAuditEntries } = data!

    return (
        <div className="space-y-8 animate-fadeIn">
            {/* Header */}
            <div>
                <h1 className="text-3xl font-bold text-white">Dashboard</h1>
                <p className="text-dark-400 mt-1">Monitor your OpenClaw skills security</p>
            </div>

            {/* OpenClaw Status */}
            <div className={`glass rounded-xl p-6 ${openclawStatus.detected ? 'border-success-500/30' : 'border-warning-500/30'}`}>
                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-4">
                        <div className={`w-12 h-12 rounded-xl flex items-center justify-center ${openclawStatus.detected ? 'bg-success-500/20' : 'bg-warning-500/20'
                            }`}>
                            {openclawStatus.detected ? (
                                <CheckCircle className="w-6 h-6 text-success-400" />
                            ) : (
                                <AlertTriangle className="w-6 h-6 text-warning-400" />
                            )}
                        </div>
                        <div>
                            <h3 className="text-lg font-semibold text-white">
                                OpenClaw {openclawStatus.detected ? 'Detected' : 'Not Detected'}
                            </h3>
                            <p className="text-dark-400 text-sm">
                                {openclawStatus.detected
                                    ? `Skills path: ${openclawStatus.skillsPath}`
                                    : 'Configure the OpenClaw path in settings'}
                            </p>
                        </div>
                    </div>
                    {openclawStatus.detected && (
                        <div className="text-right">
                            <p className="text-2xl font-bold text-white">{openclawStatus.managedSkillsCount || 0}</p>
                            <p className="text-dark-400 text-sm">Managed Skills</p>
                        </div>
                    )}
                </div>
            </div>

            {/* Stats Grid */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
                <div className="glass rounded-xl p-6 card-hover">
                    <div className="flex items-center gap-4">
                        <div className="w-12 h-12 rounded-xl bg-primary-500/20 flex items-center justify-center">
                            <Puzzle className="w-6 h-6 text-primary-400" />
                        </div>
                        <div>
                            <p className="text-3xl font-bold text-white">{totalSkills}</p>
                            <p className="text-dark-400 text-sm">Total Skills</p>
                        </div>
                    </div>
                </div>

                <div className="glass rounded-xl p-6 card-hover">
                    <div className="flex items-center gap-4">
                        <div className="w-12 h-12 rounded-xl bg-success-500/20 flex items-center justify-center">
                            <CheckCircle className="w-6 h-6 text-success-400" />
                        </div>
                        <div>
                            <p className="text-3xl font-bold text-white">{riskBreakdown.safe}</p>
                            <p className="text-dark-400 text-sm">Safe Skills</p>
                        </div>
                    </div>
                </div>

                <div className="glass rounded-xl p-6 card-hover">
                    <div className="flex items-center gap-4">
                        <div className="w-12 h-12 rounded-xl bg-warning-500/20 flex items-center justify-center">
                            <AlertTriangle className="w-6 h-6 text-warning-400" />
                        </div>
                        <div>
                            <p className="text-3xl font-bold text-white">{riskBreakdown.warning}</p>
                            <p className="text-dark-400 text-sm">Warning</p>
                        </div>
                    </div>
                </div>

                <div className="glass rounded-xl p-6 card-hover">
                    <div className="flex items-center gap-4">
                        <div className="w-12 h-12 rounded-xl bg-danger-500/20 flex items-center justify-center">
                            <XCircle className="w-6 h-6 text-danger-400" />
                        </div>
                        <div>
                            <p className="text-3xl font-bold text-white">{riskBreakdown.danger}</p>
                            <p className="text-dark-400 text-sm">High Risk</p>
                        </div>
                    </div>
                </div>
            </div>

            {/* Risk Distribution */}
            <div className="glass rounded-xl p-6">
                <h3 className="text-lg font-semibold text-white mb-4">Risk Distribution</h3>
                {totalSkills > 0 ? (
                    <>
                        <div className="flex h-4 rounded-full overflow-hidden bg-dark-700">
                            {riskBreakdown.safe > 0 && (
                                <div
                                    className="bg-success-500 transition-all"
                                    style={{ width: `${(riskBreakdown.safe / totalSkills) * 100}%` }}
                                />
                            )}
                            {riskBreakdown.warning > 0 && (
                                <div
                                    className="bg-warning-500 transition-all"
                                    style={{ width: `${(riskBreakdown.warning / totalSkills) * 100}%` }}
                                />
                            )}
                            {riskBreakdown.danger > 0 && (
                                <div
                                    className="bg-danger-500 transition-all"
                                    style={{ width: `${(riskBreakdown.danger / totalSkills) * 100}%` }}
                                />
                            )}
                        </div>
                        <div className="flex gap-6 mt-4">
                            <div className="flex items-center gap-2">
                                <div className="w-3 h-3 rounded-full bg-success-500"></div>
                                <span className="text-dark-300 text-sm">Safe ({riskBreakdown.safe})</span>
                            </div>
                            <div className="flex items-center gap-2">
                                <div className="w-3 h-3 rounded-full bg-warning-500"></div>
                                <span className="text-dark-300 text-sm">Warning ({riskBreakdown.warning})</span>
                            </div>
                            <div className="flex items-center gap-2">
                                <div className="w-3 h-3 rounded-full bg-danger-500"></div>
                                <span className="text-dark-300 text-sm">Danger ({riskBreakdown.danger})</span>
                            </div>
                        </div>
                    </>
                ) : (
                    <p className="text-dark-400 text-sm">No skills to display</p>
                )}
            </div>

            {/* Recent Activity */}
            <div className="glass rounded-xl p-6">
                <div className="flex items-center gap-2 mb-4">
                    <Activity className="w-5 h-5 text-primary-400" />
                    <h3 className="text-lg font-semibold text-white">Recent Activity</h3>
                </div>
                {recentAuditEntries.length === 0 ? (
                    <p className="text-dark-400 text-sm">No recent activity</p>
                ) : (
                    <div className="space-y-3">
                        {recentAuditEntries.slice(0, 5).map((entry) => (
                            <div key={entry.id} className="flex items-center justify-between py-2 border-b border-dark-700 last:border-0">
                                <div className="flex items-center gap-3">
                                    <div className={`w-2 h-2 rounded-full ${entry.result === 'success' ? 'bg-success-500' :
                                            entry.result === 'blocked' ? 'bg-danger-500' : 'bg-warning-500'
                                        }`}></div>
                                    <div>
                                        <p className="text-white text-sm font-medium">
                                            {entry.action} {entry.skillName && `- ${entry.skillName}`}
                                        </p>
                                        <p className="text-dark-400 text-xs">
                                            {new Date(entry.timestamp).toLocaleString()}
                                        </p>
                                    </div>
                                </div>
                                <span className={`text-xs px-2 py-1 rounded ${entry.result === 'success' ? 'bg-success-500/20 text-success-400' :
                                        entry.result === 'blocked' ? 'bg-danger-500/20 text-danger-400' :
                                            'bg-warning-500/20 text-warning-400'
                                    }`}>
                                    {entry.result}
                                </span>
                            </div>
                        ))}
                    </div>
                )}
            </div>

            {/* Warning Banner */}
            <div className="bg-warning-500/10 border border-warning-500/30 rounded-xl p-4">
                <div className="flex items-start gap-3">
                    <AlertTriangle className="w-5 h-5 text-warning-400 mt-0.5" />
                    <div>
                        <h4 className="text-warning-400 font-medium">Security Notice</h4>
                        <p className="text-dark-300 text-sm mt-1">
                            Third-party skills are executable code. Only install and enable skills from trusted sources.
                            Always review skill permissions before enabling.
                        </p>
                    </div>
                </div>
            </div>
        </div>
    )
}
