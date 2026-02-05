import { useEffect, useState } from 'react'
import {
    Shield,
    Save,
    Plus,
    X,
    Folder,
    Globe,
    Terminal,
    Key,
    Wifi,
    AlertTriangle
} from 'lucide-react'
import { api, Policy } from '../services/api'

export default function Policies() {
    const [policy, setPolicy] = useState<Policy | null>(null)
    const [loading, setLoading] = useState(true)
    const [saving, setSaving] = useState(false)
    const [newDir, setNewDir] = useState('')
    const [newDirMode, setNewDirMode] = useState<'read' | 'readwrite'>('read')
    const [newDomain, setNewDomain] = useState('')

    useEffect(() => {
        loadPolicies()
    }, [])

    const loadPolicies = async () => {
        try {
            setLoading(true)
            const data = await api.getPolicies()
            setPolicy(data.defaultPolicy)
        } catch (err) {
            console.error('Failed to load policies:', err)
        } finally {
            setLoading(false)
        }
    }

    const handleToggle = async (key: 'blockShell' | 'blockSecrets' | 'blockNetwork' | 'blockFsWrite') => {
        if (!policy) return
        try {
            setSaving(true)
            const updated = { [key]: !policy[key] }
            await api.updatePolicies(updated)
            setPolicy({ ...policy, [key]: !policy[key] })
        } catch (err) {
            console.error('Failed to update policy:', err)
        } finally {
            setSaving(false)
        }
    }

    const addDirectory = async () => {
        if (!newDir.trim() || !policy) return
        try {
            const newAllowedDirs = [...policy.allowedDirs, { path: newDir.trim(), mode: newDirMode }]
            await api.updatePolicies({ allowedDirs: newAllowedDirs } as any)
            setPolicy({ ...policy, allowedDirs: newAllowedDirs })
            setNewDir('')
        } catch (err) {
            console.error('Failed to add directory:', err)
        }
    }

    const removeDirectory = async (path: string) => {
        if (!policy) return
        try {
            const newAllowedDirs = policy.allowedDirs.filter(d => d.path !== path)
            await api.updatePolicies({ allowedDirs: newAllowedDirs } as any)
            setPolicy({ ...policy, allowedDirs: newAllowedDirs })
        } catch (err) {
            console.error('Failed to remove directory:', err)
        }
    }

    const addDomain = async () => {
        if (!newDomain.trim() || !policy) return
        try {
            const newAllowedDomains = [...policy.allowedDomains, newDomain.trim()]
            await api.updatePolicies({ allowedDomains: newAllowedDomains } as any)
            setPolicy({ ...policy, allowedDomains: newAllowedDomains })
            setNewDomain('')
        } catch (err) {
            console.error('Failed to add domain:', err)
        }
    }

    const removeDomain = async (domain: string) => {
        if (!policy) return
        try {
            const newAllowedDomains = policy.allowedDomains.filter(d => d !== domain)
            await api.updatePolicies({ allowedDomains: newAllowedDomains } as any)
            setPolicy({ ...policy, allowedDomains: newAllowedDomains })
        } catch (err) {
            console.error('Failed to remove domain:', err)
        }
    }

    if (loading) {
        return (
            <div className="flex items-center justify-center h-64">
                <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-primary-500"></div>
            </div>
        )
    }

    if (!policy) {
        return (
            <div className="glass rounded-xl p-6">
                <div className="flex items-center gap-3 text-danger-400">
                    <AlertTriangle className="w-6 h-6" />
                    <span>Failed to load policies</span>
                </div>
            </div>
        )
    }

    return (
        <div className="space-y-8 animate-fadeIn">
            {/* Header */}
            <div>
                <h1 className="text-3xl font-bold text-white">Policies</h1>
                <p className="text-dark-400 mt-1">Configure security policies and permissions</p>
            </div>

            {/* Global Toggles */}
            <div className="glass rounded-xl p-6">
                <h2 className="text-lg font-semibold text-white mb-6 flex items-center gap-2">
                    <Shield className="w-5 h-5 text-primary-400" />
                    Security Controls
                </h2>

                <div className="space-y-4">
                    {/* Block Shell */}
                    <div className="flex items-center justify-between p-4 bg-dark-900 rounded-lg">
                        <div className="flex items-center gap-4">
                            <div className="w-10 h-10 rounded-lg bg-danger-500/20 flex items-center justify-center">
                                <Terminal className="w-5 h-5 text-danger-400" />
                            </div>
                            <div>
                                <h3 className="text-white font-medium">Block Shell Execution</h3>
                                <p className="text-dark-400 text-sm">Prevent skills from running shell commands</p>
                            </div>
                        </div>
                        <button
                            onClick={() => handleToggle('blockShell')}
                            disabled={saving}
                            className={`toggle-switch ${policy.blockShell ? 'toggle-switch-enabled' : 'toggle-switch-disabled'}`}
                        >
                            <span className={`toggle-switch-knob ${policy.blockShell ? 'translate-x-6' : 'translate-x-1'}`} />
                        </button>
                    </div>

                    {/* Block Secrets */}
                    <div className="flex items-center justify-between p-4 bg-dark-900 rounded-lg">
                        <div className="flex items-center gap-4">
                            <div className="w-10 h-10 rounded-lg bg-warning-500/20 flex items-center justify-center">
                                <Key className="w-5 h-5 text-warning-400" />
                            </div>
                            <div>
                                <h3 className="text-white font-medium">Block Secret Access</h3>
                                <p className="text-dark-400 text-sm">Prevent skills from accessing environment secrets</p>
                            </div>
                        </div>
                        <button
                            onClick={() => handleToggle('blockSecrets')}
                            disabled={saving}
                            className={`toggle-switch ${policy.blockSecrets ? 'toggle-switch-enabled' : 'toggle-switch-disabled'}`}
                        >
                            <span className={`toggle-switch-knob ${policy.blockSecrets ? 'translate-x-6' : 'translate-x-1'}`} />
                        </button>
                    </div>

                    {/* Block Network */}
                    <div className="flex items-center justify-between p-4 bg-dark-900 rounded-lg">
                        <div className="flex items-center gap-4">
                            <div className="w-10 h-10 rounded-lg bg-primary-500/20 flex items-center justify-center">
                                <Wifi className="w-5 h-5 text-primary-400" />
                            </div>
                            <div>
                                <h3 className="text-white font-medium">Block Network Access</h3>
                                <p className="text-dark-400 text-sm">Prevent skills from making network requests</p>
                            </div>
                        </div>
                        <button
                            onClick={() => handleToggle('blockNetwork')}
                            disabled={saving}
                            className={`toggle-switch ${policy.blockNetwork ? 'toggle-switch-enabled' : 'toggle-switch-disabled'}`}
                        >
                            <span className={`toggle-switch-knob ${policy.blockNetwork ? 'translate-x-6' : 'translate-x-1'}`} />
                        </button>
                    </div>

                    {/* Block Filesystem Writes */}
                    <div className="flex items-center justify-between p-4 bg-dark-900 rounded-lg">
                        <div className="flex items-center gap-4">
                            <div className="w-10 h-10 rounded-lg bg-cyan-500/20 flex items-center justify-center">
                                <Folder className="w-5 h-5 text-cyan-400" />
                            </div>
                            <div>
                                <h3 className="text-white font-medium">Block Filesystem Writes</h3>
                                <p className="text-dark-400 text-sm">Prevent skills from writing outside allowed dirs</p>
                            </div>
                        </div>
                        <button
                            onClick={() => handleToggle('blockFsWrite')}
                            disabled={saving}
                            className={`toggle-switch ${policy.blockFsWrite ? 'toggle-switch-enabled' : 'toggle-switch-disabled'}`}
                        >
                            <span className={`toggle-switch-knob ${policy.blockFsWrite ? 'translate-x-6' : 'translate-x-1'}`} />
                        </button>
                    </div>
                </div>
            </div>

            {/* Allowed Directories */}
            <div className="glass rounded-xl p-6">
                <h2 className="text-lg font-semibold text-white mb-6 flex items-center gap-2">
                    <Folder className="w-5 h-5 text-primary-400" />
                    Allowed Directories
                </h2>

                {policy.allowedDirs.length > 0 && (
                    <div className="space-y-2 mb-4">
                        {policy.allowedDirs.map((dir) => (
                            <div key={dir.path} className="flex items-center justify-between p-3 bg-dark-900 rounded-lg">
                                <div className="flex items-center gap-3">
                                    <Folder className="w-4 h-4 text-dark-400" />
                                    <span className="text-white text-sm">{dir.path}</span>
                                    <span className={`text-xs px-2 py-0.5 rounded ${dir.mode === 'readwrite' ? 'bg-warning-500/20 text-warning-400' : 'bg-primary-500/20 text-primary-400'
                                        }`}>
                                        {dir.mode}
                                    </span>
                                </div>
                                <button
                                    onClick={() => removeDirectory(dir.path)}
                                    className="p-1 hover:bg-dark-700 rounded transition-colors"
                                >
                                    <X className="w-4 h-4 text-dark-400" />
                                </button>
                            </div>
                        ))}
                    </div>
                )}

                <div className="flex gap-2">
                    <input
                        type="text"
                        placeholder="/path/to/directory"
                        value={newDir}
                        onChange={(e) => setNewDir(e.target.value)}
                        className="flex-1 px-4 py-2 bg-dark-900 border border-dark-700 rounded-lg focus:outline-none focus:border-primary-500 text-white placeholder-dark-400 text-sm"
                    />
                    <select
                        value={newDirMode}
                        onChange={(e) => setNewDirMode(e.target.value as 'read' | 'readwrite')}
                        className="px-3 py-2 bg-dark-900 border border-dark-700 rounded-lg focus:outline-none focus:border-primary-500 text-white text-sm"
                    >
                        <option value="read">Read</option>
                        <option value="readwrite">Read/Write</option>
                    </select>
                    <button
                        onClick={addDirectory}
                        className="px-4 py-2 bg-primary-500 hover:bg-primary-600 text-white rounded-lg transition-colors flex items-center gap-2"
                    >
                        <Plus className="w-4 h-4" />
                        Add
                    </button>
                </div>
            </div>

            {/* Allowed Domains */}
            <div className="glass rounded-xl p-6">
                <h2 className="text-lg font-semibold text-white mb-6 flex items-center gap-2">
                    <Globe className="w-5 h-5 text-primary-400" />
                    Allowed Domains (Network Egress)
                </h2>

                {policy.allowedDomains.length > 0 && (
                    <div className="flex flex-wrap gap-2 mb-4">
                        {policy.allowedDomains.map((domain) => (
                            <span
                                key={domain}
                                className="flex items-center gap-2 px-3 py-1.5 bg-dark-900 rounded-lg text-sm text-white"
                            >
                                {domain}
                                <button
                                    onClick={() => removeDomain(domain)}
                                    className="hover:text-danger-400 transition-colors"
                                >
                                    <X className="w-3 h-3" />
                                </button>
                            </span>
                        ))}
                    </div>
                )}

                <div className="flex gap-2">
                    <input
                        type="text"
                        placeholder="api.example.com"
                        value={newDomain}
                        onChange={(e) => setNewDomain(e.target.value)}
                        className="flex-1 px-4 py-2 bg-dark-900 border border-dark-700 rounded-lg focus:outline-none focus:border-primary-500 text-white placeholder-dark-400 text-sm"
                    />
                    <button
                        onClick={addDomain}
                        className="px-4 py-2 bg-primary-500 hover:bg-primary-600 text-white rounded-lg transition-colors flex items-center gap-2"
                    >
                        <Plus className="w-4 h-4" />
                        Add
                    </button>
                </div>
            </div>
        </div>
    )
}
