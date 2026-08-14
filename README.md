# OmniGate AI 🌐

![Version](https://img.shields.io/badge/version-1.0.2-blue.svg)
![License](https://img.shields.io/badge/license-MIT-green.svg)
![PRs Welcome](https://img.shields.io/badge/PRs-welcome-brightgreen.svg)
![Node.js](https://img.shields.io/badge/Node.js-20+-43853D?logo=node.js&logoColor=white)
![Docker](https://img.shields.io/badge/Docker-Ready-2496ED?logo=docker&logoColor=white)

**The Privacy-First LLM API Gateway for Developers & AI Agents**

OmniGate AI is a self-hosted, local proxy server that sits between your code editors (VS Code, Roo Code, Cline) and LLM providers (OpenAI, DeepSeek, Anthropic). It securely injects your real API keys, counts tokens, and calculates costs in real-time—all without your secret keys ever leaving your machine.

## 🌟 Why This Exists

Developers and AI agents face a critical dilemma: **convenience vs. security**. Cloud-based proxies expose your API keys to third parties, while manual key management in every tool is a nightmare. OmniGate AI solves this by providing a **local, zero-trust gateway** that keeps your keys on your machine while giving you full visibility into token usage and costs.

## ✨ Key Features

- **🔒 Privacy-First**: Your API keys never leave your machine. All requests are proxied locally.
- **📊 Real-Time Token Counting**: Track input/output tokens and costs per request, model, and project.
- **🖥️ Live Dashboard**: A built-in web dashboard with real-time telemetry via SSE (Server-Sent Events).
- **🔧 Multi-Provider Support**: Works with OpenAI, Anthropic, and any OpenAI-compatible endpoint (DeepSeek, etc.).
- **📦 Zero-Config Setup**: Get started in minutes with npm or Docker.
- **📈 Cost Tracking**: Calculate costs per request and aggregate usage for budgeting.
- **🛡️ Zero-Retention Logging**: Prompts and completions are never stored—only metadata counts.
- **🔌 Easy Integration**: Compatible with VS Code extensions like Roo Code and Cline.

## 🛠️ Tech Stack & Architecture

- **Node.js** (>=20) with Express
- **Docker** for containerized deployment
- **Server-Sent Events** for real-time telemetry streaming
- **REST API** for configuration and telemetry retrieval

```
[VS Code / AI Agent] → [OmniGate AI Proxy] → [OpenAI / Anthropic / etc.]
                         |
                         ├─ Dashboard (localhost:8080/dashboard)
                         ├─ Telemetry API (localhost:8080/api/telemetry)
                         └─ Config API (localhost:8080/api/config)
```

## 📦 Quickstart & Installation

### Option 1: Run with Node.js

```bash
# Clone the repository
git clone https://github.com/erfanhassan/Omnigate.ai.git
cd Omnigate.ai

# Install dependencies
npm install

# Set your API keys (optional, can also be configured via dashboard)
export OPENAI_API_KEY=your-key
export ANTHROPIC_API_KEY=your-key

# Start the server
npm start
```

### Option 2: Run with Docker

```bash
docker build -t omnigate-ai .
docker run -p 8080:8080 -e OPENAI_API_KEY=your-key omnigate-ai
```

Or use docker-compose:

```bash
docker-compose up
```

### Configure Your AI Tools

Point your AI tool (e.g., Roo Code) to `http://localhost:8080` as the API base URL. OmniGate will inject the correct API key and forward requests to the appropriate provider.

## 📸 Screenshots

*Dashboard preview coming soon. Stay tuned!*

## 🤝 Contributing & Community

We welcome contributions! Please read our [Contributing Guidelines](CONTRIBUTING.md) and [Code of Conduct](CODE_OF_CONDUCT.md) to get started.

- **Report Issues**: [GitHub Issues](https://github.com/erfanhassan/Omnigate.ai/issues)
- **Submit PRs**: Fork the repo and create a pull request.
- **Join the Discussion**: Use GitHub Discussions for questions and ideas.

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

---

**Star ⭐ this repo** if you find it useful! Your support helps us grow and improve.