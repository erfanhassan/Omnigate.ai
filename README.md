# OmniGate AI 🌐

![Version](https://img.shields.io/badge/version-1.0.2-blue.svg)
![License](https://img.shields.io/badge/license-MIT-green.svg)
![PRs Welcome](https://img.shields.io/badge/PRs-welcome-brightgreen.svg)
![Node.js](https://img.shields.io/badge/Node.js-20+-43853D?logo=node.js&logoColor=white)
![Docker](https://img.shields.io/badge/Docker-Ready-2496ED?logo=docker&logoColor=white)

**The Privacy-First LLM API Gateway for Developers & AI Agents**

OmniGate AI is a self-hosted, local proxy server that sits between your code editors (VS Code, Roo Code, Cline) and LLM providers (OpenAI, DeepSeek, Anthropic). It securely injects your real API keys, counts tokens, and calculates costs in real-time—all without your secret keys ever leaving your machine.

## 🌟 Why This Exists

Developers and AI agents face a critical dilemma: **convenience vs. security**. Cloud-based proxies expose your API keys to third parties, while manual key management in every tool is a nightmare. OmniGate AI solves this by providing a **local, zero-trust gateway** that keeps your keys on your machine, giving you full control and visibility.

## ✨ Key Features

- **🔒 Zero-Trust Security**: API keys are stored locally and never transmitted to third-party servers.
- **📊 Real-Time Token & Cost Tracking**: Monitor token usage and costs per request, model, and project.
- **🖥️ Built-in Dashboard**: A clean web UI to view telemetry, clear history, and stream live updates.
- **🔌 Seamless Integration**: Works with popular AI tools like VS Code, Roo Code, and Cline.
- **🚀 Lightweight & Fast**: Built on Node.js and Express, with minimal overhead.
- **🐳 Docker Support**: Deploy in seconds with a single command.
- **📡 SSE Streaming**: Real-time telemetry streaming via Server-Sent Events.
- **🛠️ Dynamic Configuration**: Update API endpoints and keys without restarting.

## 🛠️ Tech Stack & Architecture

- **Node.js** (>=20) – Runtime
- **Express** – HTTP server and routing
- **Docker** – Containerization
- **Server-Sent Events (SSE)** – Real-time telemetry
- **Zero-Dependency Telemetry** – No external logging services

### Architecture Diagram

```
[VS Code / Roo Code / Cline] → [OmniGate AI Proxy] → [OpenAI / Anthropic / etc.]
                                    ↓
                           [Telemetry Dashboard]
```

## 📦 Quickstart & Installation

### Option 1: Run with Node.js

```bash
# Clone the repository
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

### Option 2: Run with Docker

```bash
docker-compose up -d
```

### Configure Your AI Tools

Point your AI tool's API base URL to `http://localhost:8080` and use the gateway key as the API key. For example, in VS Code with Roo Code, set:

```
Base URL: http://localhost:8080
API Key: your-gateway-key
```

## 📸 Screenshots

*Screenshots coming soon!* (Place your screenshots in `/assets` and update this section.)

## 🤝 Contributing & Community

We welcome contributions! Please read our [Contributing Guidelines](CONTRIBUTING.md) and [Code of Conduct](CODE_OF_CONDUCT.md) before getting started.

- **Report Issues**: [GitHub Issues](https://github.com/erfanhassan/Omnigate.ai/issues)
- **Submit PRs**: Fork the repo and create a pull request.
- **Join the Discussion**: Use GitHub Discussions to ask questions and share ideas.

## 📄 License

This project is licensed under the MIT License – see the [LICENSE](LICENSE) file for details.

---

**Star ⭐ this repo** if you find it useful! Your support helps us grow and improve.