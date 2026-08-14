# OmniGate AI 🌐

![Version](https://img.shields.io/badge/version-1.0.2-blue.svg)
![License](https://img.shields.io/badge/license-MIT-green.svg)
![PRs Welcome](https://img.shields.io/badge/PRs-welcome-brightgreen.svg)
![Node.js](https://img.shields.io/badge/Node.js-20+-43853D?logo=node.js&logoColor=white)

**The Privacy-First LLM API Gateway for Developers & AI Agents**

OmniGate AI is a self-hosted, local proxy server that sits between your code editors (VS Code, Roo Code, Cline) and LLM providers (OpenAI, DeepSeek, Anthropic). It securely injects your real API keys, counts tokens, and calculates costs in real-time—all without your secret keys ever leaving your machine.

## 🌟 Why This Exists

Developers and AI agents face a critical dilemma: **convenience vs. security**. Cloud-based proxies expose your API keys to third parties, while manual key management in every tool is a nightmare. OmniGate AI solves this by providing a **local, zero-trust gateway** that keeps your keys on your machine, gives you full visibility into token usage, and works with any OpenAI-compatible client.

## ✨ Key Features

- **🔒 Privacy-First**: Your API keys never leave your machine. All requests are proxied locally.
- **📊 Real-Time Token Tracking**: Monitor token usage and costs live via a beautiful glassmorphic dashboard.
- **🔍 Full Audit Trail**: Log every API request with provider, model, and token counts—zero retention of prompts or completions.
- **🚀 Instant Setup**: Run `npx omnigate-ai` and you're ready. No complex configuration.
- **🔧 Dynamic Configuration**: Update API keys and endpoints on the fly via a REST API or config file.
- **📡 SSE Streaming**: Real-time telemetry streaming for integration with your own monitoring tools.
- **🐳 Docker Support**: Deploy with a single `docker-compose up` for containerized environments.
- **🛡️ Zero-Auth Local Dashboard**: Access your dashboard at `http://localhost:8080/dashboard` without any authentication.

## 🛠️ Tech Stack & Architecture

OmniGate AI is built with **Node.js** and **Express**, designed to be lightweight and dependency-free. The architecture is simple yet powerful:

```
[Code Editor / AI Agent] → [OmniGate Proxy] → [LLM Provider]
                              ↓
                        [Dashboard & Telemetry]
```

- **Proxy Engine**: Intercepts API requests, injects your keys, and forwards to the provider.
- **Telemetry Module**: Counts tokens and logs metadata asynchronously, ensuring zero impact on response time.
- **Dashboard**: A sleek, glassmorphic UI built with vanilla JS and CSS, served directly from the server.
- **Configuration**: Environment variables or a `config.json` file for dynamic updates.

## 📦 Quickstart & Installation

### Option 1: npx (Recommended)

```bash
npx omnigate-ai
```

This downloads and starts the proxy on port `8080`.

### Option 2: Docker

```bash
docker-compose up
```

### Option 3: Manual

```bash
git clone https://github.com/erfanhassan/Omnigate.ai.git
cd Omnigate.ai
npm install
npm start
```

### Configure Your Editor

Set your editor's API base URL to `http://localhost:8080` and use any dummy key. OmniGate will inject your real key automatically.

## 📊 Dashboard

Open `http://localhost:8080/dashboard` in your browser to see:

- Real-time token usage and cost per request
- History of all API calls
- Clear telemetry data with one click

![Dashboard Screenshot](https://via.placeholder.com/800x400?text=OmniGate+AI+Dashboard)

## 🤝 Contributing & Community

We welcome contributions! Please read our [CONTRIBUTING.md](CONTRIBUTING.md) and [CODE_OF_CONDUCT.md](CODE_OF_CONDUCT.md) to get started. Whether it's bug fixes, feature requests, or documentation improvements, your help is appreciated.

- **Issues**: Report bugs or request features via [GitHub Issues](https://github.com/erfanhassan/Omnigate.ai/issues).
- **Discussions**: Join the conversation in [GitHub Discussions](https://github.com/erfanhassan/Omnigate.ai/discussions).
- **Star**: If you find this useful, give us a ⭐ to show your support!

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

---

**Made with ❤️ for the developer community**