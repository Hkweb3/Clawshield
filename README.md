# ClawShield 🛡️

> **Security & Permissions Layer for AI Agents**

[![License](https://img.shields.io/badge/License-Apache%202.0-blue.svg)](https://opensource.org/licenses/Apache-2.0)
[![TypeScript](https://img.shields.io/badge/TypeScript-Ready-blue)](https://www.typescriptlang.org/)
[![Status](https://img.shields.io/badge/Status-Beta-orange)](https://github.com/Hkweb3/Clawshield)

**ClawShield** is a powerful security layer designed to help you safely install and manage AI agent skills (OpenClaw, MCP, etc.). It bridges the gap between AI autonomy and system safety by providing automated risk scanning, secure sandboxing, and real-time permission auditing.

---

## ✨ Features

*   🔍 **Deep AST Scanning**: Automatically detects dangerous code patterns (shell execution, network calls, obfuscation).
*   🛡️ **Runtime Protection**: Secure guards for **Node.js** and **Python** to block unauthorized actions in real-time.
*   📊 **Security Dashboard**: A premium UI to monitor skill status, risk scores, and audit logs.
*   📝 **Audit Logging**: Every sensitive action is logged with high-resolution details.
*   💼 **Policy Management**: Global and per-workspace security policies.

---

## 🚀 Quick Start

Get ClawShield up and running in seconds.

### 1. Installation

```bash
# Clone the repository
git clone https://github.com/Hkweb3/Clawshield.git
cd Clawshield

# Install all dependencies
npm install
```

### 2. Launching the App

Start both the security backend and the dashboard with a single command:

```bash
npm run dev
```

> [!TIP]
> This command uses `concurrently` to launch the API (Port 3001) and the UI (Port 5173) in one window.

---

## 🛠️ Components

| Component | Description |
|-----------|-------------|
| **[CLI](packages/cli)** | Preflight scans, skill installation, and configuration. |
| **[Backend](packages/backend)** | High-performance Fastify server for discovery and scanning. |
| **[Frontend](packages/frontend)** | Modern React/Tailwind dashboard for visualization. |
| **[Shared](packages/shared)** | Unified types and security constants. |

---

## 🤝 Contributing

We welcome contributions! Please see our [Contributing Guide](CONTRIBUTING.md) and [Code of Conduct](CODE_OF_CONDUCT.md) for details on how to get started.

## 📄 License

ClawShield is released under the [Apache License 2.0](LICENSE).

## 🛡️ Security

If you discover a security vulnerability, please see our [SECURITY.md](SECURITY.md).

---

Built with ❤️ for the OpenClaw community.
