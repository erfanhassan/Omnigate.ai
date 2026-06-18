import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import EventEmitter from 'events';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import crypto from 'crypto';

// Load environment variables for local development
dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const CONFIG_FILE = path.join(__dirname, 'config.json');

let activeConfig = {
  agencyGatewayKey: process.env.AGENCY_GATEWAY_KEY || 'stub-agency-key-for-local-testing',
  openaiApiKey: process.env.OPENAI_API_KEY || '',
  openaiApiUrl: process.env.OPENAI_API_URL || 'https://api.openai.com/v1/chat/completions',
  anthropicApiKey: process.env.ANTHROPIC_API_KEY || '',
  anthropicApiUrl: process.env.ANTHROPIC_API_URL || 'https://api.anthropic.com/v1/messages'
};

try {
  if (fs.existsSync(CONFIG_FILE)) {
    const data = JSON.parse(fs.readFileSync(CONFIG_FILE, 'utf8'));
    activeConfig = { ...activeConfig, ...data };
    console.log('Loaded configurations from config.json');
  }
} catch (err) {
  console.error('Error loading config.json:', err.message);
}

const telemetryEmitter = new EventEmitter();
const telemetryHistory = [];
const MAX_HISTORY = 100;

const app = express();
const PORT = process.env.PORT || 8080;

// Middleware configuration
app.use(cors());
// Parse incoming JSON payloads. Max limit is configured high enough to support large system prompts.
app.use(express.json({ limit: '5mb' }));

/**
 * Asynchronously log telemetry metadata.
 * Designed to be zero-retention for security and privacy.
 * Prompts, completions, and code snippets are never stored. Only counts are kept.
 * @param {object} metadata - Metadata to log
 */
function logTelemetry(metadata) {
  // Use nextTick to defer processing, ensuring zero impact on the proxy response cycle.
  process.nextTick(() => {
    const telemetry = {
      id: Math.random().toString(36).substring(2, 11),
      timestamp: new Date().toISOString(),
      provider: metadata.provider,
      model: metadata.model || 'unknown',
      userId: metadata.userId || 'anonymous',
      projectId: metadata.projectId || 'default-project',
      inputTokens: Number(metadata.inputTokens) || 0,
      outputTokens: Number(metadata.outputTokens) || 0
    };
    // Clean JSON output for cloud collectors/logging agents
    console.log(JSON.stringify({ telemetry }));

    // Update local history for the dashboard widget
    telemetryHistory.unshift(telemetry);
    if (telemetryHistory.length > MAX_HISTORY) {
      telemetryHistory.pop();
    }
    telemetryEmitter.emit('new_telemetry', telemetry);
  });
}

// ========================================================
// Dashboard & Telemetry API Routes (Zero-Auth for Local View)
// ========================================================
app.use('/dashboard', express.static(path.join(__dirname, 'public')));

app.get('/api/telemetry', (req, res) => {
  res.json(telemetryHistory);
});

app.get('/api/telemetry/stream', (req, res) => {
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.flushHeaders();
  
  const onTelemetry = (data) => {
    res.write(`data: ${JSON.stringify(data)}\n\n`);
  };
  
  telemetryEmitter.on('new_telemetry', onTelemetry);
  
  req.on('close', () => {
    telemetryEmitter.off('new_telemetry', onTelemetry);
  });
});

// ========================================================
// Dynamic Configuration API
// ========================================================
app.get('/api/config', (req, res) => {
  const maskedConfig = {
    agencyGatewayKey: activeConfig.agencyGatewayKey,
    openaiApiUrl: activeConfig.openaiApiUrl,
    anthropicApiUrl: activeConfig.anthropicApiUrl,
    openaiApiKey: activeConfig.openaiApiKey ? '••••••••••••••••' : '',
    anthropicApiKey: activeConfig.anthropicApiKey ? '••••••••••••••••' : ''
  };
  res.json(maskedConfig);
});

app.post('/api/config', (req, res) => {
  const { agencyGatewayKey, openaiApiKey, openaiApiUrl, anthropicApiKey, anthropicApiUrl } = req.body;

  if (agencyGatewayKey !== undefined) activeConfig.agencyGatewayKey = agencyGatewayKey;
  if (openaiApiUrl !== undefined) activeConfig.openaiApiUrl = openaiApiUrl;
  if (anthropicApiUrl !== undefined) activeConfig.anthropicApiUrl = anthropicApiUrl;

  if (openaiApiKey !== undefined && openaiApiKey !== '••••••••••••••••') {
    activeConfig.openaiApiKey = openaiApiKey;
  }
  if (anthropicApiKey !== undefined && anthropicApiKey !== '••••••••••••••••') {
    activeConfig.anthropicApiKey = anthropicApiKey;
  }

  try {
    fs.writeFileSync(CONFIG_FILE, JSON.stringify(activeConfig, null, 2), 'utf8');
    console.log('Saved updated configurations to config.json');
    res.json({ status: 'success', message: 'Configurations saved successfully' });
  } catch (err) {
    console.error('Error saving config.json:', err.message);
    res.status(500).json({ error: 'Failed to write configurations to disk' });
  }
});

// 1. Gateway Authentication & Custom Header extraction
app.use((req, res, next) => {
  // Allow health check, dashboard, and telemetry routes to pass without authentication
  if (
    (req.path === '/health' && req.method === 'GET') ||
    req.path.startsWith('/dashboard') ||
    req.path.startsWith('/api/telemetry')
  ) {
    return next();
  }

  const incomingGatewayKey = req.headers['x-gateway-key'] || '';
  const expectedKey = activeConfig.agencyGatewayKey || '';
  
  const incomingBuffer = Buffer.from(incomingGatewayKey);
  const expectedBuffer = Buffer.from(expectedKey);

  if (incomingBuffer.length !== expectedBuffer.length || !crypto.timingSafeEqual(incomingBuffer, expectedBuffer)) {
    return res.status(401).json({
      error: {
        message: 'Unauthorized. The custom X-Gateway-Key header is missing or incorrect.',
        type: 'gateway_authorization_error',
        code: 'unauthorized_access'
      }
    });
  }
  next();
});

// Health check endpoint
app.get('/health', (req, res) => {
  res.status(200).json({
    status: 'healthy',
    timestamp: new Date().toISOString(),
    service: 'OmniGate AI Proxy'
  });
});

// 2. OpenAI Stream / Non-Stream Proxy Handler
app.post('/v1/chat/completions', async (req, res) => {
  const openaiApiKey = activeConfig.openaiApiKey;
  if (!openaiApiKey) {
    return res.status(500).json({
      error: {
        message: 'OpenAI API key (openaiApiKey) is not configured on this server.',
        type: 'gateway_configuration_error',
        code: 'missing_provider_key'
      }
    });
  }

  // Extract metadata headers for telemetry tracking
  const userId = req.headers['x-gateway-user-id'] || 'anonymous';
  const projectId = req.headers['x-gateway-project-id'] || 'default-project';
  const isStreaming = req.body && req.body.stream === true;
  const requestedModel = req.body && req.body.model;

  const targetUrl = activeConfig.openaiApiUrl || 'https://api.openai.com/v1/chat/completions';
  const abortController = new AbortController();

  // If the client disconnects or aborts, clean up the upstream connection immediately.
  res.on('close', () => {
    if (!res.writableEnded) {
      abortController.abort();
    }
  });

  // Inject stream options to force usage inclusion inside the SSE stream if streaming
  if (isStreaming) {
    if (!req.body.stream_options) {
      req.body.stream_options = {};
    }
    req.body.stream_options.include_usage = true;
  }

  const headers = {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${openaiApiKey}`
  };

  try {
    const response = await fetch(targetUrl, {
      method: 'POST',
      headers,
      body: JSON.stringify(req.body),
      signal: abortController.signal
    });

    if (!response.ok) {
      const errorText = await response.text();
      let errorJson;
      try {
        errorJson = JSON.parse(errorText);
      } catch {
        errorJson = { error: errorText };
      }
      return res.status(response.status).json(errorJson);
    }

    // Pipe response headers to client
    res.setHeader('Content-Type', response.headers.get('content-type') || 'application/json');
    if (response.headers.has('openai-processing-ms')) {
      res.setHeader('openai-processing-ms', response.headers.get('openai-processing-ms'));
    }

    if (isStreaming) {
      // Setup SSE headers
      res.setHeader('Cache-Control', 'no-cache');
      res.setHeader('Connection', 'keep-alive');
      res.writeHead(response.status);

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';
      let usage = null;
      let actualModel = requestedModel;

      try {
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          // 1. TTFT Optimization: Pipe data directly to the client with zero buffering delay
          res.write(value);

          // 2. Intercept and parse the chunk asynchronously to extract token usage
          const chunkStr = decoder.decode(value, { stream: true });
          buffer += chunkStr;

          let boundary = buffer.lastIndexOf('\n');
          if (boundary !== -1) {
            const completeText = buffer.slice(0, boundary);
            buffer = buffer.slice(boundary + 1);

            const lines = completeText.split('\n');
            for (const line of lines) {
              const trimmed = line.trim();
              if (!trimmed || !trimmed.startsWith('data: ')) continue;

              const dataStr = trimmed.slice(6).trim();
              if (dataStr === '[DONE]') continue;

              // Heuristic: check for usage block without JSON parsing every single chunk
              if (dataStr.includes('"usage"')) {
                try {
                  const parsed = JSON.parse(dataStr);
                  if (parsed.usage) {
                    usage = parsed.usage;
                  }
                  if (parsed.model) {
                    actualModel = parsed.model;
                  }
                } catch {
                  // Ignore parse errors from chunk fragmentation
                }
              } else if (!actualModel && dataStr.includes('"model"')) {
                try {
                  const parsed = JSON.parse(dataStr);
                  if (parsed.model) {
                    actualModel = parsed.model;
                  }
                } catch {}
              }
            }
          }
        }

        // Flush any remaining text in the parser buffer
        const remaining = buffer.trim();
        if (remaining && remaining.startsWith('data: ')) {
          const dataStr = remaining.slice(6).trim();
          if (dataStr !== '[DONE]' && dataStr.includes('"usage"')) {
            try {
              const parsed = JSON.parse(dataStr);
              if (parsed.usage) {
                usage = parsed.usage;
              }
              if (parsed.model) {
                actualModel = parsed.model;
              }
            } catch {}
          }
        }
      } catch (streamError) {
        console.error('Error during OpenAI stream pipe:', streamError);
      } finally {
        res.end();
        if (usage) {
          logTelemetry({
            provider: 'openai',
            model: actualModel,
            userId,
            projectId,
            inputTokens: usage.prompt_tokens,
            outputTokens: usage.completion_tokens
          });
        } else {
          console.warn('[OpenAI Stream] Stream closed. No usage telemetry metadata found (aborted or failed).');
        }
      }
    } else {
      // Non-streaming JSON response
      const responseData = await response.json();
      res.status(response.status).json(responseData);

      const usage = responseData.usage;
      const actualModel = responseData.model || requestedModel;
      if (usage) {
        logTelemetry({
          provider: 'openai',
          model: actualModel,
          userId,
          projectId,
          inputTokens: usage.prompt_tokens,
          outputTokens: usage.completion_tokens
        });
      }
    }
  } catch (err) {
    if (err.name === 'AbortError') {
      console.log('OpenAI upstream request was aborted due to client disconnect.');
      if (!res.headersSent) {
        res.status(499).json({ error: 'Client aborted the request' });
      }
    } else {
      console.error('OpenAI proxy connection error:', err);
      if (!res.headersSent) {
        res.status(500).json({ error: 'Gateway Error: Unable to connect to OpenAI API' });
      }
    }
  }
});

// 3. Anthropic Stream / Non-Stream Proxy Handler
app.post('/v1/messages', async (req, res) => {
  const anthropicApiKey = activeConfig.anthropicApiKey;
  if (!anthropicApiKey) {
    return res.status(500).json({
      error: {
        message: 'Anthropic API key (anthropicApiKey) is not configured on this server.',
        type: 'gateway_configuration_error',
        code: 'missing_provider_key'
      }
    });
  }

  // Extract metadata headers for telemetry tracking
  const userId = req.headers['x-gateway-user-id'] || 'anonymous';
  const projectId = req.headers['x-gateway-project-id'] || 'default-project';
  const isStreaming = req.body && req.body.stream === true;
  const requestedModel = req.body && req.body.model;

  const targetUrl = activeConfig.anthropicApiUrl || 'https://api.anthropic.com/v1/messages';
  const abortController = new AbortController();

  // If the client disconnects or aborts, clean up the upstream connection immediately.
  res.on('close', () => {
    if (!res.writableEnded) {
      abortController.abort();
    }
  });

  const headers = {
    'Content-Type': 'application/json',
    'x-api-key': anthropicApiKey,
    'anthropic-version': req.headers['anthropic-version'] || '2023-06-01'
  };

  // Forward optional thinking beta headers if supplied
  if (req.headers['anthropic-beta']) {
    headers['anthropic-beta'] = req.headers['anthropic-beta'];
  }

  try {
    const response = await fetch(targetUrl, {
      method: 'POST',
      headers,
      body: JSON.stringify(req.body),
      signal: abortController.signal
    });

    if (!response.ok) {
      const errorText = await response.text();
      let errorJson;
      try {
        errorJson = JSON.parse(errorText);
      } catch {
        errorJson = { error: errorText };
      }
      return res.status(response.status).json(errorJson);
    }

    // Pipe response headers to client
    res.setHeader('Content-Type', response.headers.get('content-type') || 'application/json');

    if (isStreaming) {
      // Setup SSE headers
      res.setHeader('Cache-Control', 'no-cache');
      res.setHeader('Connection', 'keep-alive');
      res.writeHead(response.status);

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';
      let inputTokens = 0;
      let outputTokens = 0;
      let actualModel = requestedModel;

      try {
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          // 1. TTFT Optimization: Pipe data directly to the client with zero buffering delay
          res.write(value);

          // 2. Intercept and parse the chunk asynchronously to extract token usage
          const chunkStr = decoder.decode(value, { stream: true });
          buffer += chunkStr;

          let boundary = buffer.lastIndexOf('\n');
          if (boundary !== -1) {
            const completeText = buffer.slice(0, boundary);
            buffer = buffer.slice(boundary + 1);

            const lines = completeText.split('\n');
            for (const line of lines) {
              const trimmed = line.trim();
              if (!trimmed || !trimmed.startsWith('data: ')) continue;

              const dataStr = trimmed.slice(6).trim();
              if (dataStr.startsWith('{')) {
                // Heuristic: check if the string contains key telemetry events before parsing JSON
                if (dataStr.includes('"message_start"') || dataStr.includes('"message_delta"') || dataStr.includes('"message_stop"')) {
                  try {
                    const parsed = JSON.parse(dataStr);
                    if (parsed.type === 'message_start' && parsed.message?.usage) {
                      inputTokens = parsed.message.usage.input_tokens || inputTokens;
                      if (parsed.message.model) {
                        actualModel = parsed.message.model;
                      }
                    } else if (parsed.type === 'message_delta' && parsed.usage) {
                      outputTokens = parsed.usage.output_tokens || outputTokens;
                    } else if (parsed.type === 'message_stop' && parsed.usage) {
                      outputTokens = parsed.usage.output_tokens || outputTokens;
                    }
                  } catch {
                    // Ignore parse errors from chunk fragmentation
                  }
                }
              }
            }
          }
        }

        // Flush any remaining text in the parser buffer
        const remaining = buffer.trim();
        if (remaining && remaining.startsWith('data: ')) {
          const dataStr = remaining.slice(6).trim();
          if (dataStr.startsWith('{')) {
            try {
              const parsed = JSON.parse(dataStr);
              if (parsed.type === 'message_start' && parsed.message?.usage) {
                inputTokens = parsed.message.usage.input_tokens || inputTokens;
                if (parsed.message.model) {
                  actualModel = parsed.message.model;
                }
              } else if (parsed.type === 'message_delta' && parsed.usage) {
                outputTokens = parsed.usage.output_tokens || outputTokens;
              } else if (parsed.type === 'message_stop' && parsed.usage) {
                outputTokens = parsed.usage.output_tokens || outputTokens;
              }
            } catch {}
          }
        }
      } catch (streamError) {
        console.error('Error during Anthropic stream pipe:', streamError);
      } finally {
        res.end();
        if (inputTokens > 0 || outputTokens > 0) {
          logTelemetry({
            provider: 'anthropic',
            model: actualModel,
            userId,
            projectId,
            inputTokens,
            outputTokens
          });
        } else {
          console.warn('[Anthropic Stream] Stream closed. No usage telemetry metadata found (aborted or failed).');
        }
      }
    } else {
      // Non-streaming JSON response
      const responseData = await response.json();
      res.status(response.status).json(responseData);

      const usage = responseData.usage;
      const actualModel = responseData.model || requestedModel;
      if (usage) {
        logTelemetry({
          provider: 'anthropic',
          model: actualModel,
          userId,
          projectId,
          inputTokens: usage.input_tokens,
          outputTokens: usage.output_tokens
        });
      }
    }
  } catch (err) {
    if (err.name === 'AbortError') {
      console.log('Anthropic upstream request was aborted due to client disconnect.');
      if (!res.headersSent) {
        res.status(499).json({ error: 'Client aborted the request' });
      }
    } else {
      console.error('Anthropic proxy connection error:', err);
      if (!res.headersSent) {
        res.status(500).json({ error: 'Gateway Error: Unable to connect to Anthropic API' });
      }
    }
  }
});

// Catch-all route to reject unsupported endpoints
app.use((req, res) => {
  res.status(404).json({
    error: {
      message: `The endpoint ${req.method} ${req.path} is not supported by OmniGate AI gateway. Only /v1/chat/completions (OpenAI) and /v1/messages (Anthropic) are valid proxy routes.`,
      type: 'gateway_route_error',
      code: 'unsupported_route'
    }
  });
});

// Run server
app.listen(PORT, () => {
  console.log(`========================================================`);
  console.log(` OmniGate AI Privacy API Gateway Server                 `);
  console.log(` Status: ACTIVE | Listening on Port: ${PORT}           `);
  console.log(`========================================================`);
});

// Trigger watcher reload
