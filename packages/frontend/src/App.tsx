import { Routes, Route } from 'react-router-dom'
import Layout from './components/Layout'
import Dashboard from './pages/Dashboard'
import Skills from './pages/Skills'
import Policies from './pages/Policies'
import Preflight from './pages/Preflight'

function App() {
    return (
        <Routes>
            <Route path="/" element={<Layout />}>
                <Route index element={<Dashboard />} />
                <Route path="skills" element={<Skills />} />
                <Route path="policies" element={<Policies />} />
                <Route path="preflight" element={<Preflight />} />
            </Route>
        </Routes>
    )
}

export default App
