import { useState } from 'react'
import {
    Rocket,
    Search,
    AlertTriangle,
    CheckCircle,
    XCircle,
    Download,
    Shield,
    FileText,
    Loader2
} from 'lucide-react'
import { api, PreflightResponse } from '../services/api'

export default function Preflight() {
    const [slug, setSlug] = useState('')
    const [loading, setLoading] = useState(false)
    const [result, setResult] = useState<PreflightResponse | null>(null)
    const [error, setError] = useState<string | null>(null)
    const [installing, setInstalling] = useState(false)
    const [installed, setInstalled] = useState(false)

    const handleScan = async () => {
        if (!slug.trim()) return

        // Validate slug format
        if (!/^[a-z0-9_-]+$/.test(slug)) {
            setError('Invalid slug format. Only lowercase letters, numbers, hyphens, and underscores are allowed.')
            return
        }

        try {
            setLoading(true)
            setError(null)
            setResult(null)
            setInstalled(false)
            const data = await api.preflight(slug)
            setResult(data)
        } catch (err) {
            setError(String(err))
        } finally {
            setLoading(false)
        }
    }

    const handleInstall = async () => {
        if (!result) return
        try {
            setInstalling(true)
            await api.install(result.slug, '.')
            setInstalled(true)
        } catch (err) {
            setError(String(err))
        } finally {
            setInstalling(false)
        }
    }

    const getRiskColor = (score: number) => {
        if (score <= 30) return 'text-success-400'
        if (score <= 60) return 'text-warning-400'
        return 'text-danger-400'
    }

    const getRiskBg = (score: number) => {
        if (score <= 30) return 'bg-success-500/10 border-success-500/30'
        if (score <= 60) return 'bg-warning-500/10 border-warning-500/30'
        return 'bg-danger-500/10 border-danger-500/30'
    }

    return (
        <div className="space-y-8 animate-fadeIn">
            {/* Header */}
            <div>
                <h1 className="text-3xl font-bold text-white">Preflight Check</h1>
                <p className="text-dark-400 mt-1">Scan skills from ClawHub before installing</p>
            </div>

            {/* Search Input */}
            <div className="glass rounded-xl p-6">
                <label className="block text-sm font-medium text-dark-300 mb-2">
                    ClawHub Skill Slug
                </label>
                <div className="flex gap-3">
                    <div className="relative flex-1">
                        <Rocket className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-dark-400" />
                        <input
                            type="text"
                            placeholder="my-awesome-skill"
                            value={slug}
                            onChange={(e) => setSlug(e.target.value.toLowerCase())}
                            onKeyDown={(e) => e.key === 'Enter' && handleScan()}
                            className="w-full pl-12 pr-4 py-3 bg-dark-900 border border-dark-700 rounded-xl focus:outline-none focus:border-primary-500 text-white placeholder-dark-400"
                        />
                    </div>
                    <button
                        onClick={handleScan}
                        disabled={loading || !slug.trim()}
                        className="px-6 py-3 bg-primary-500 hover:bg-primary-600 disabled:opacity-50 text-white rounded-xl transition-colors flex items-center gap-2 font-medium"
                    >
                        {loading ? (
                            <Loader2 className="w-5 h-5 animate-spin" />
                        ) : (
                            <Search className="w-5 h-5" />
                        )}
                        Scan
                    </button>
                </div>
                <p className="text-dark-500 text-sm mt-2">
                    Only lowercase letters, numbers, hyphens, and underscores allowed
                </p>
            </div>

            {/* Warning Banner */}
            <div className="bg-warning-500/10 border border-warning-500/30 rounded-xl p-4">
                <div className="flex items-start gap-3">
                    <AlertTriangle className="w-5 h-5 text-warning-400 mt-0.5" />
                    <div>
                        <h4 className="text-warning-400 font-medium">Security Warning</h4>
                        <p className="text-dark-300 text-sm mt-1">
                            Third-party skills are executable code that can access your system.
                            Always review the scan results and only install skills from trusted sources.
                        </p>
                    </div>
                </div>
            </div>

            {/* Error */}
            {error && (
                <div className="bg-danger-500/10 border border-danger-500/30 rounded-xl p-4">
                    <div className="flex items-center gap-3">
                        <XCircle className="w-5 h-5 text-danger-400" />
                        <span className="text-danger-400">{error}</span>
                    </div>
                </div>
            )}

            {/* Results */}
            {result && (
                <div className="space-y-6">
                    {/* Skill Info */}
                    <div className="glass rounded-xl p-6">
                        <div className="flex items-start justify-between mb-4">
                            <div>
                                <h2 className="text-xl font-bold text-white">{result.skill?.name || result.slug}</h2>
                                <p className="text-dark-400 mt-1">{result.skill?.description || 'No description'}</p>
                            </div>
                            <span className={`flex items-center gap-2 px-3 py-1.5 rounded-lg border ${getRiskBg(result.risk.score)}`}>
                                {result.risk.score <= 30 ? (
                                    <CheckCircle className="w-4 h-4 text-success-400" />
                                ) : result.risk.score <= 60 ? (
                                    <AlertTriangle className="w-4 h-4 text-warning-400" />
                                ) : (
                                    <XCircle className="w-4 h-4 text-danger-400" />
                                )}
                                <span className={getRiskColor(result.risk.score)}>
                                    {result.risk.score}/100
                                </span>
                            </span>
                        </div>

                        {/* Risk Details */}
                        <div className={`p-4 rounded-lg border ${getRiskBg(result.risk.score)}`}>
                            <div className="flex items-center justify-between mb-2">
                                <span className={`font-semibold ${getRiskColor(result.risk.score)}`}>
                                    Recommendation: {result.risk.recommendation.toUpperCase()}
                                </span>
                            </div>
                            <p className="text-dark-300 text-sm">{result.risk.explanation}</p>
                        </div>
                    </div>

                    {/* Detected Flags */}
                    {result.risk.flags.length > 0 && (
                        <div className="glass rounded-xl p-6">
                            <h3 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
                                <FileText className="w-5 h-5 text-primary-400" />
                                Detected Patterns ({result.risk.flags.length})
                            </h3>
                            <div className="space-y-2 max-h-64 overflow-y-auto">
                                {result.risk.flags.map((flag, i) => (
                                    <div key={i} className="flex items-start gap-3 p-3 bg-dark-900 rounded-lg">
                                        <span className={`text-xs px-2 py-0.5 rounded mt-0.5 ${flag.severity === 'critical' ? 'bg-danger-500/20 text-danger-400' :
                                                flag.severity === 'high' ? 'bg-warning-500/20 text-warning-400' :
                                                    flag.severity === 'medium' ? 'bg-primary-500/20 text-primary-400' :
                                                        'bg-dark-600 text-dark-300'
                                            }`}>
                                            {flag.severity}
                                        </span>
                                        <div>
                                            <p className="text-white text-sm font-medium">{flag.type}</p>
                                            <p className="text-dark-400 text-xs">{flag.description}</p>
                                            {flag.location && (
                                                <p className="text-dark-500 text-xs mt-1">{flag.location}</p>
                                            )}
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}

                    {/* Install Action */}
                    <div className="glass rounded-xl p-6">
                        <div className="flex items-center justify-between">
                            <div>
                                <h3 className="text-lg font-semibold text-white">Install Skill</h3>
                                <p className="text-dark-400 text-sm mt-1">
                                    {result.canInstall
                                        ? 'This skill passes your security policy'
                                        : result.blockReason || 'Blocked by security policy'}
                                </p>
                            </div>

                            {installed ? (
                                <div className="flex items-center gap-2 px-6 py-3 bg-success-500/20 text-success-400 rounded-xl">
                                    <CheckCircle className="w-5 h-5" />
                                    Installed
                                </div>
                            ) : (
                                <button
                                    onClick={handleInstall}
                                    disabled={!result.canInstall || installing}
                                    className={`px-6 py-3 rounded-xl transition-colors flex items-center gap-2 font-medium ${result.canInstall
                                            ? 'bg-success-500 hover:bg-success-600 text-white'
                                            : 'bg-dark-700 text-dark-400 cursor-not-allowed'
                                        }`}
                                >
                                    {installing ? (
                                        <Loader2 className="w-5 h-5 animate-spin" />
                                    ) : (
                                        <Download className="w-5 h-5" />
                                    )}
                                    {result.canInstall ? 'Install to Workspace' : 'Blocked'}
                                </button>
                            )}
                        </div>
                    </div>
                </div>
            )}

            {/* Empty State */}
            {!result && !loading && (
                <div className="text-center py-16">
                    <Shield className="w-16 h-16 text-dark-600 mx-auto mb-4" />
                    <h3 className="text-xl font-semibold text-dark-400 mb-2">Ready to Scan</h3>
                    <p className="text-dark-500 max-w-md mx-auto">
                        Enter a ClawHub skill slug above to scan it for security risks before installing.
                    </p>
                </div>
            )}
        </div>
    )
}
