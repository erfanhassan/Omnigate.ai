# OmniGate AI 🌐

![Version](https://img.shields.io/badge/version-1.0.2-blue.svg)
![License](https://img.shields.io/badge/license-MIT-green.svg)
![PRs Welcome](https://img.shields.io/badge/PRs-welcome-brightgreen.svg)
![Node.js](https://img.shields.io/badge/Node.js-20+-43853D?logo=node.js&logoColor=white)
![Docker](https://img.shields.io/badge/Docker-Ready-2496ED?logo=docker&logoColor=white)

**The Privacy-First LLM API Gateway for Developers & AI Agents**

OmniGate AI is a self-hosted, local proxy server that sits between your code editors (VS Code, Roo Code, Cline) and LLM providers (OpenAI, DeepSeek, Anthropic). It securely injects your real API keys, counts tokens, and calculates costs in real-time—all without your secret keys ever leaving your machine.

## 🌟 Why This Exists

Developers and AI agents face a critical dilemma: **convenience vs. security**. Cloud-based proxies expose your API keys to third parties, while manual key management in every tool is a nightmare. OmniGate AI solves this by giving you a **local, self-hosted gateway** that keeps your keys on your machine, provides **real-time token usage tracking**, and offers **full auditability**—all with zero cloud dependencies.

## ✨ Key Features

- **🔒 Privacy-First Architecture**: Your API keys never leave your machine. All requests are proxied locally.
- **📊 Real-Time Token Counting**: Track input and output tokens for every request, with cost calculation.
- **🖥️ Live Dashboard**: A built-in web dashboard shows telemetry in real-time, with SSE streaming.
- **🔧 Multi-Provider Support**: Works with OpenAI, Anthropic, and any OpenAI-compatible endpoint.
- **📦 Zero-Config Setup**: Run with Docker or Node.js—no complex configuration required.
- **📈 Telemetry API**: Export usage data to your own logging or analytics systems.
- **🛡️ Zero-Retention Policy**: Prompts and completions are never stored—only counts are kept.

## 🛠️ Tech Stack & Architecture

OmniGate AI is built with a simple, modular architecture:

- **Node.js + Express**: Lightweight server handling proxy and API routes.
- **Docker**: Containerized deployment for easy scaling and isolation.
- **EventEmitter**: Real-time telemetry streaming to the dashboard.
- **Static Dashboard**: Vanilla HTML/CSS/JS for zero-dependency UI.

```
[Your Code Editor] → [OmniGate AI Proxy] → [LLM Provider]
                          |
                          ├── Token Counter
                          ├── Cost Calculator
                          └── Telemetry Dashboard
```

## 📦 Quickstart & Installation

### Option 1: Docker (Recommended)

```bash
git clone https://github.com/erfanhassan/Omnigate.ai.git
cd Omnigate.ai
docker-compose up -d
```

### Option 2: Node.js

```bash
# Clone the repo
git clone https://github.com/erfanhassan/Omnigate.ai.git
cd Omnigate.ai

# Install dependencies
npm install

# Set your API keys (optional, can be done via config.json)
export OPENAI_API_KEY=your-key
export ANTHROPIC_API_KEY=your-key

# Start the server
npm start
```

### Configure Your Editor

Point your AI editor (e.g., Roo Code, Cline) to `http://localhost:8080` as the API base URL. OmniGate will inject your keys and track usage automatically.

## 📸 Screenshots

> Add screenshots here to showcase the dashboard and proxy in action.

## 🤝 Contributing & Community

We welcome contributions! Please read our [Contributing Guidelines](CONTRIBUTING.md) and [Code of Conduct](CODE_OF_CONDUCT.md) to get started. Whether it's bug fixes, feature requests, or documentation improvements, your help is appreciated.

## 📄 License

This project is licensed under the MIT License—see the [LICENSE](LICENSE) file for details.

---

**Star this repo** ⭐ if you find it useful! Share it with your fellow developers and AI enthusiasts.
