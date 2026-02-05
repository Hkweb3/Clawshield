import { NavLink, Outlet } from 'react-router-dom'
import {
    LayoutDashboard,
    Puzzle,
    Shield,
    Rocket,
    Github
} from 'lucide-react'

const navItems = [
    { to: '/', icon: LayoutDashboard, label: 'Dashboard' },
    { to: '/skills', icon: Puzzle, label: 'Skills' },
    { to: '/policies', icon: Shield, label: 'Policies' },
    { to: '/preflight', icon: Rocket, label: 'Preflight' },
]

export default function Layout() {
    return (
        <div className="min-h-screen bg-dark-900 flex">
            {/* Sidebar */}
            <aside className="w-64 bg-dark-800 border-r border-dark-700 flex flex-col">
                {/* Logo */}
                <div className="p-6 border-b border-dark-700">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-primary-500 to-primary-700 flex items-center justify-center glow-primary">
                            <Shield className="w-6 h-6 text-white" />
                        </div>
                        <div>
                            <h1 className="text-lg font-bold text-white">ClawShield</h1>
                            <p className="text-xs text-dark-400">OpenClaw Security</p>
                        </div>
                    </div>
                </div>

                {/* Navigation */}
                <nav className="flex-1 p-4">
                    <ul className="space-y-2">
                        {navItems.map((item) => (
                            <li key={item.to}>
                                <NavLink
                                    to={item.to}
                                    end={item.to === '/'}
                                    className={({ isActive }) =>
                                        `flex items-center gap-3 px-4 py-3 rounded-lg transition-all ${isActive
                                            ? 'bg-primary-500/20 text-primary-400 border border-primary-500/30'
                                            : 'text-dark-300 hover:bg-dark-700 hover:text-white'
                                        }`
                                    }
                                >
                                    <item.icon className="w-5 h-5" />
                                    <span className="font-medium">{item.label}</span>
                                </NavLink>
                            </li>
                        ))}
                    </ul>
                </nav>

                {/* Footer */}
                <div className="p-4 border-t border-dark-700">
                    <a
                        href="https://github.com"
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-center gap-2 text-dark-400 hover:text-white transition-colors text-sm"
                    >
                        <Github className="w-4 h-4" />
                        <span>View on GitHub</span>
                    </a>
                </div>
            </aside>

            {/* Main Content */}
            <main className="flex-1 overflow-auto">
                <div className="p-8">
                    <Outlet />
                </div>
            </main>
        </div>
    )
}
