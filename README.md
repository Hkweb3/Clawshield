# ClawShield 🛡️

> Security & Permissions Layer for OpenClaw Skills

ClawShield helps you safely install and manage OpenClaw skills by scanning for security risks, enforcing permissions policies, and providing a clean UI to monitor all installed skills.

![ClawShield Dashboard](./docs/dashboard.png)

## Features

- **🔍 Risk Scanner** - Static analysis of skill folders for dangerous patterns (shell execution, network calls, obfuscation, credential access)
- **🧠 AST Scanner** - JS/TS AST analysis for deeper detection beyond regex
- **📦 Supply Chain Scan** - Detects risky dependency sources, install scripts, and bundled native binaries
- **📊 Risk Scoring** - 0-100 risk score with recommendations (Allow, Sandbox, Block)
- **🔒 Policy Enforcement** - Block shell, secrets, or network access per skill
- **🧰 Runtime Guard** - Optional Node.js + Python runtime guard with behavioral audit logging
- **🚀 Preflight Checks** - Scan ClawHub skills before installing
- **📋 Audit Logging** - Track all scans, installs, and policy changes

## Quick Start

### Prerequisites

- Node.js 18+
- npm 9+

### Installation

```bash
# Clone and install
cd clawshield
npm install

# Start backend (port 3001)
npm run dev:backend

# Start frontend (port 5173)
npm run dev:frontend
```

Open http://localhost:5173 in your browser.

### CLI Usage

```bash
# Install CLI globally
npm install -g ./packages/cli

# Preflight scan a ClawHub skill
clawshield preflight my-awesome-skill

# Install after approval
clawshield install my-awesome-skill -w ./my-project

# Scan installed skills
clawshield scan ./my-project/skills

# Run a Node skill with runtime guard
clawshield run ./my-project/skills/my-skill --entry index.js

# Run a Python skill with runtime guard
clawshield run ./my-project/skills/my-skill --entry main.py

# Override python binary if needed
CLAWSHIELD_PYTHON_BIN=python3 clawshield run ./my-project/skills/my-skill --entry main.py

# View config
clawshield config --show
```

## How It Works

### Directory Detection

ClawShield scans these locations for skills:

| Location | Type | Description |
|----------|------|-------------|
| `~/.openclaw/skills` | Managed | Shared skills installed via ClawHub |
| `<workspace>/skills` | Workspace | Project-specific skills |

### Risk Scanning

The scanner detects these patterns:

| Pattern | Risk Weight | Examples |
|---------|-------------|----------|
| Shell Execution | 25 | `child_process`, `exec()`, `subprocess` |
| Filesystem Write | 15 | `fs.writeFile`, `open('w')` |
| Filesystem Delete | 20 | `fs.unlink`, `os.remove()` |
| Network Calls | 20 | `fetch`, `axios`, `requests`, `curl` |
| Remote Script Exec | 30 | `curl ... \| bash` |
| Obfuscation | 25 | `eval()`, `Function()`, base64+exec |
| Credential Access | 20 | `process.env`, `os.environ` |
| Dependency Risk | 20 | `git+` deps, install scripts, native binaries |

### Risk Thresholds

| Score | Label | Recommendation |
|-------|-------|----------------|
| 0-30 | Safe | Allow |
| 31-60 | Warning | Allow with sandbox |
| 61-100 | Danger | Block |

## Configuration

Config stored at `~/.clawshield/config.json`:

```json
{
  "workspacePaths": [],
    "defaultPolicy": {
      "blockShell": true,
      "blockSecrets": true,
      "blockNetwork": false,
      "blockFsWrite": false,
      "allowedDirs": [],
      "allowedDomains": []
    },
  "enabledSkills": [],
  "disabledSkills": []
}
```

## Threat Model & Limitations

### What ClawShield Does

- ✅ Static pattern matching for known risky code patterns
- ✅ AST analysis for JS/TS skills (imports, dangerous calls, env access)
- ✅ Supply-chain scanning for risky dependency sources and install scripts
- ✅ Optional Node runtime guard with audit logging
- ✅ Policy-based blocking of high-risk skills
- ✅ Audit trail of all security-related actions
- ✅ Input sanitization for ClawHub slugs

### What ClawShield Does NOT Do

- ❌ **Full sandboxing** - Runtime guard is best-effort and limited to Node/Python
- ❌ **Dynamic analysis** - We don't execute skill code during scanning
- ❌ **Obfuscation bypass** - Heavily obfuscated code may evade detection
- ❌ **Supply chain attacks** - Can't detect compromised dependencies

### Security Best Practices

1. **Only install skills from trusted sources**
2. **Review skill code before enabling**
3. **Use the sandbox toggle for moderate-risk skills**
4. **Keep ClawShield updated**
5. **Monitor the audit log regularly**

## Project Structure

```
clawshield/
├── packages/
│   ├── backend/       # Fastify API server
│   │   └── src/
│   │       ├── services/   # Discovery, scanner, policy, audit
│   │       └── routes/     # REST API endpoints
│   ├── frontend/      # React + Vite + Tailwind
│   │   └── src/
│   │       ├── pages/      # Dashboard, Skills, Policies, Preflight
│   │       └── components/ # Layout, shared components
│   ├── cli/           # Commander.js CLI tool
│   │   └── src/
│   │       └── commands/   # preflight, install, scan, config
│   └── shared/        # Shared types and constants
```

## API Endpoints

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/dashboard` | GET | Dashboard summary |
| `/api/skills` | GET | List all skills |
| `/api/skills/:id/scan` | POST | Rescan a skill |
| `/api/skills/:id/toggle` | POST | Enable/disable skill |
| `/api/policies` | GET/POST | Get or update policies |
| `/api/preflight` | POST | Preflight scan a slug |
| `/api/install` | POST | Install a skill |
| `/api/audit` | GET | Get audit log |
| `/api/sandbox` | GET | Get sandbox config |

## 🤝 Contributing

We welcome contributions! Please see our [Contributing Guide](CONTRIBUTING.md) and [Code of Conduct](CODE_OF_CONDUCT.md) for details on how to get started.

## 📄 License

ClawShield is released under the [Apache License 2.0](LICENSE).

## 🛡️ Security

If you discover a security vulnerability, please see our [SECURITY.md](SECURITY.md).

## 💬 Community

- [GitHub Issues](https://github.com/krishna/clawshield/issues)
- [OpenClaw Documentation](https://openclaw.org/docs)

---

Built with ❤️ for the OpenClaw community.
