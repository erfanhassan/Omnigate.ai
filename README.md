# OmniGate AI 🌌

![Version](https://img.shields.io/badge/version-1.0.0-blue.svg)
![License](https://img.shields.io/badge/license-MIT-green.svg)

**The Privacy-First LLM API Gateway for Developers & AI Agents**

OmniGate AI is a self-hosted, local proxy server designed to sit between your code editors (like VS Code, Roo Code, Cline) and your LLM providers (OpenAI, DeepSeek, Anthropic). It intercepts API requests to securely inject your real API keys, count tokens, and calculate costs in real-time—all without your secret keys ever leaving your machine.

---

## 🚀 Quick Start

No complex installations required. If you have Node.js installed, simply run:

```bash
npx omnigate-ai
```

This will instantly download and start the proxy server on port `8080`.

## 💻 The Dashboard

Once the server is running, open your web browser and navigate to:
**http://localhost:8080/dashboard**

You will be greeted by a beautiful, glassmorphic UI where you can:
1. **Secure Your Gateway:** Create a local "Gateway Secret Key" to lock down your proxy.
2. **Add API Keys:** Securely store your real OpenAI or DeepSeek API keys locally.
3. **Track Usage:** Watch real-time gauges spin as your tokens are consumed, showing you exact costs and RPM (Requests Per Minute).
4. **Audit Logs:** View a live feed of every single request your AI tools are making behind the scenes.

## 🛠️ Integrating with VS Code / AI Agents

To route your AI coding assistant through OmniGate AI:

1. Open your AI Tool's settings (e.g., Roo Code or Continue).
2. Set the **Provider** to `OpenAI Compatible`.
3. Set the **Base URL** to `http://localhost:8080/v1`.
4. Set the **API Key** to your **Gateway Secret Key** (the one you created in the dashboard, *not* your real OpenAI key).

Now, start coding! OmniGate AI will silently intercept the requests, inject your real API key, forward it to the provider, and track your tokens on the dashboard.

## ✨ Features

- **🔒 100% Local Privacy:** Your real API keys are saved locally. Cloud-based AI tools never see them.
- **💸 Token & Cost Tracking:** Accurate token counting and real-time cost estimation for OpenAI and DeepSeek models.
- **🛡️ Rate Limit Protection:** Monitor your RPM to prevent accidental massive API bills from rogue agents.
- **📡 Live Audit Log:** Total transparency into what your automated agents are actually sending to the LLMs.
- **⚡ Zero Configuration:** Starts instantly with a single `npx` command.

## 🌐 Website
Visit our [Landing Page](https://erfanhassan.github.io/Omnigate.ai) for more information.

## 📄 License
MIT License
