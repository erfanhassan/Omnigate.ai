import http from 'http';
import { spawn } from 'child_process';
import assert from 'assert';

const MOCK_PORT = 8081;
const PROXY_PORT = 8080;
const AGENCY_GATEWAY_KEY = 'test-gateway-secret-key';

let mockReceivedRequests = [];
let clientAbortedCount = 0;

// 1. Create a mock upstream API server simulating OpenAI and Anthropic endpoints
const mockServer = http.createServer((req, res) => {
  let body = '';
  req.on('data', chunk => {
    body += chunk;
  });

  req.on('end', () => {
    const parsedBody = body ? JSON.parse(body) : {};
    mockReceivedRequests.push({
      method: req.method,
      url: req.url,
      headers: req.headers,
      body: parsedBody
    });

    // Handle Client Abort test route specifically
    if (parsedBody.test_abort === true) {
      res.writeHead(200, {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive'
      });
      res.write('data: {"choices":[{"delta":{"content":"Slow chunk 1"}}]}\n\n');
      
      const timer = setTimeout(() => {
        if (!res.writableEnded) {
          res.write('data: {"choices":[{"delta":{"content":"Slow chunk 2"}}]}\n\n');
          res.end();
        }
      }, 1000);

      req.on('close', () => {
        clearTimeout(timer);
        clientAbortedCount++;
      });
      return;
    }

    if (req.url === '/v1/chat/completions') {
      const isStreaming = parsedBody.stream === true;
      if (isStreaming) {
        res.writeHead(200, {
          'Content-Type': 'text/event-stream',
          'Cache-Control': 'no-cache',
          'Connection': 'keep-alive'
        });

        // SSE chunks for OpenAI
        res.write('data: {"id":"chatcmpl-1","object":"chat.completion.chunk","created":1677652288,"model":"gpt-4o","choices":[{"index":0,"delta":{"content":"Hello"},"finish_reason":null}]}\n\n');
        res.write('data: {"id":"chatcmpl-1","object":"chat.completion.chunk","created":1677652288,"model":"gpt-4o","choices":[]}\n\n');
        res.write('data: {"id":"chatcmpl-1","object":"chat.completion.chunk","created":1677652288,"model":"gpt-4o","choices":[],"usage":{"prompt_tokens":12,"completion_tokens":24,"total_tokens":36}}\n\n');
        res.write('data: [DONE]\n\n');
        res.end();
      } else {
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({
          id: 'chatcmpl-2',
          object: 'chat.completion',
          created: 1677652288,
          model: 'gpt-4o',
          choices: [{ index: 0, message: { role: 'assistant', content: 'Hello' }, finish_reason: 'stop' }],
          usage: { prompt_tokens: 12, completion_tokens: 24, total_tokens: 36 }
        }));
      }
    } else if (req.url === '/v1/messages') {
      const isStreaming = parsedBody.stream === true;
      if (isStreaming) {
        res.writeHead(200, {
          'Content-Type': 'text/event-stream',
          'Cache-Control': 'no-cache',
          'Connection': 'keep-alive'
        });

        // SSE chunks for Anthropic
        res.write('event: message_start\ndata: {"type":"message_start","message":{"id":"msg_1","type":"message","role":"assistant","model":"claude-3-5-sonnet-20241022","content":[],"usage":{"input_tokens":15,"output_tokens":0}}}\n\n');
        res.write('event: content_block_start\ndata: {"type":"content_block_start","index":0,"content_block":{"type":"text","text":""}}\n\n');
        res.write('event: content_block_delta\ndata: {"type":"content_block_delta","index":0,"delta":{"type":"text_delta","text":"Hello"}}\n\n');
        res.write('event: content_block_stop\ndata: {"type":"content_block_stop","index":0}\n\n');
        res.write('event: message_delta\ndata: {"type":"message_delta","delta":{"stop_reason":"end_turn"},"usage":{"output_tokens":35}}\n\n');
        res.write('event: message_stop\ndata: {"type":"message_stop"}\n\n');
        res.end();
      } else {
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({
          id: 'msg_2',
          type: 'message',
          role: 'assistant',
          model: 'claude-3-5-sonnet-20241022',
          content: [{ type: 'text', text: 'Hello' }],
          stop_reason: 'end_turn',
          usage: { input_tokens: 15, output_tokens: 35 }
        }));
      }
    } else {
      res.writeHead(404);
      res.end('Not Found');
    }
  });
});

// Start mock upstream server
mockServer.listen(MOCK_PORT, () => {
  console.log(`Mock Upstream Server listening on port ${MOCK_PORT}`);
  startProxyServer();
});

let proxyProcess;
let capturedTelemetryLogs = [];

function startProxyServer() {
  // Start the proxy gateway in a spawned process
  proxyProcess = spawn('node', ['server.js'], {
    env: {
      ...process.env,
      PORT: PROXY_PORT,
      AGENCY_GATEWAY_KEY,
      OPENAI_API_KEY: 'test-openai-key',
      ANTHROPIC_API_KEY: 'test-anthropic-key',
      OPENAI_API_URL: `http://localhost:${MOCK_PORT}/v1/chat/completions`,
      ANTHROPIC_API_URL: `http://localhost:${MOCK_PORT}/v1/messages`
    }
  });

  proxyProcess.stdout.on('data', data => {
    const lines = data.toString().split('\n');
    for (const line of lines) {
      const trimmed = line.trim();
      if (trimmed.startsWith('{') && trimmed.includes('"telemetry"')) {
        try {
          const logObj = JSON.parse(trimmed);
          capturedTelemetryLogs.push(logObj.telemetry);
          console.log('[Telemetry Captured]:', logObj.telemetry);
        } catch (e) {
          // Ignore non-json or partial lines
        }
      } else if (trimmed) {
        console.log(`[Proxy Stdout]: ${trimmed}`);
      }
    }
  });

  proxyProcess.stderr.on('data', data => {
    console.error(`[Proxy Stderr]: ${data}`);
  });

  // Wait a short bit for the server to bind the port
  setTimeout(runTests, 1000);
}

async function runTests() {
  console.log('\n--- Starting Integration Test Cases ---\n');
  try {
    // Test Case 1: Unauthorized access (missing or invalid gateway key)
    console.log('Running Test Case 1: Unauthorized Access...');
    const authRes = await fetch(`http://localhost:${PROXY_PORT}/v1/chat/completions`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ model: 'gpt-4o' })
    });
    assert.strictEqual(authRes.status, 401);
    const authJson = await authRes.json();
    assert.strictEqual(authJson.error.type, 'gateway_authorization_error');
    console.log('✓ Test Case 1 Passed');

    // Test Case 2: OpenAI Non-Streaming request
    console.log('\nRunning Test Case 2: OpenAI Non-Streaming...');
    const oaRes = await fetch(`http://localhost:${PROXY_PORT}/v1/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Gateway-Key': AGENCY_GATEWAY_KEY,
        'X-Gateway-User-ID': 'user-123',
        'X-Gateway-Project-ID': 'project-abc'
      },
      body: JSON.stringify({ model: 'gpt-4o', messages: [{ role: 'user', content: 'hi' }] })
    });
    assert.strictEqual(oaRes.status, 200);
    const oaJson = await oaRes.json();
    assert.strictEqual(oaJson.id, 'chatcmpl-2');
    // Check telemetry log was recorded for TestCase 2
    await delay(100);
    const telemetryOa = capturedTelemetryLogs.find(t => t.provider === 'openai' && t.model === 'gpt-4o');
    assert.ok(telemetryOa);
    assert.strictEqual(telemetryOa.userId, 'user-123');
    assert.strictEqual(telemetryOa.projectId, 'project-abc');
    assert.strictEqual(telemetryOa.inputTokens, 12);
    assert.strictEqual(telemetryOa.outputTokens, 24);
    console.log('✓ Test Case 2 Passed');

    // Test Case 3: OpenAI Streaming request (Verify stream_options injection & extraction)
    console.log('\nRunning Test Case 3: OpenAI Streaming...');
    const oaStreamRes = await fetch(`http://localhost:${PROXY_PORT}/v1/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Gateway-Key': AGENCY_GATEWAY_KEY,
        'X-Gateway-User-ID': 'user-123',
        'X-Gateway-Project-ID': 'project-abc'
      },
      body: JSON.stringify({ model: 'gpt-4o', messages: [{ role: 'user', content: 'hi' }], stream: true })
    });
    assert.strictEqual(oaStreamRes.status, 200);
    // Read the entire stream response
    const reader = oaStreamRes.body.getReader();
    let streamContent = '';
    const decoder = new TextDecoder();
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      streamContent += decoder.decode(value, { stream: true });
    }
    assert.ok(streamContent.includes('[DONE]'));
    
    // Verify that the proxy injected include_usage: true into the body forwarded to the mock API
    const mockRequestOa = mockReceivedRequests.find(r => r.url === '/v1/chat/completions' && r.body.stream === true);
    assert.ok(mockRequestOa);
    assert.strictEqual(mockRequestOa.body.stream_options?.include_usage, true);

    await delay(100);
    const telemetryOaStream = capturedTelemetryLogs.find(t => t.provider === 'openai' && t.model === 'gpt-4o' && t.inputTokens === 12);
    assert.ok(telemetryOaStream);
    assert.strictEqual(telemetryOaStream.outputTokens, 24);
    console.log('✓ Test Case 3 Passed');

    // Test Case 4: Anthropic Non-Streaming request
    console.log('\nRunning Test Case 4: Anthropic Non-Streaming...');
    const antRes = await fetch(`http://localhost:${PROXY_PORT}/v1/messages`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Gateway-Key': AGENCY_GATEWAY_KEY,
        'X-Gateway-User-ID': 'user-456',
        'X-Gateway-Project-ID': 'project-xyz'
      },
      body: JSON.stringify({ model: 'claude-3-5-sonnet-20241022', messages: [{ role: 'user', content: 'hello' }] })
    });
    assert.strictEqual(antRes.status, 200);
    const antJson = await antRes.json();
    assert.strictEqual(antJson.id, 'msg_2');
    
    await delay(100);
    const telemetryAnt = capturedTelemetryLogs.find(t => t.provider === 'anthropic' && t.model === 'claude-3-5-sonnet-20241022');
    assert.ok(telemetryAnt);
    assert.strictEqual(telemetryAnt.userId, 'user-456');
    assert.strictEqual(telemetryAnt.projectId, 'project-xyz');
    assert.strictEqual(telemetryAnt.inputTokens, 15);
    assert.strictEqual(telemetryAnt.outputTokens, 35);
    console.log('✓ Test Case 4 Passed');

    // Test Case 5: Anthropic Streaming request
    console.log('\nRunning Test Case 5: Anthropic Streaming...');
    const antStreamRes = await fetch(`http://localhost:${PROXY_PORT}/v1/messages`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Gateway-Key': AGENCY_GATEWAY_KEY,
        'X-Gateway-User-ID': 'user-456',
        'X-Gateway-Project-ID': 'project-xyz'
      },
      body: JSON.stringify({ model: 'claude-3-5-sonnet-20241022', messages: [{ role: 'user', content: 'hello' }], stream: true })
    });
    assert.strictEqual(antStreamRes.status, 200);
    const antReader = antStreamRes.body.getReader();
    let antStreamContent = '';
    while (true) {
      const { done, value } = await antReader.read();
      if (done) break;
      antStreamContent += decoder.decode(value, { stream: true });
    }
    assert.ok(antStreamContent.includes('message_stop'));

    await delay(100);
    const telemetryAntStream = capturedTelemetryLogs.find(t => t.provider === 'anthropic' && t.model === 'claude-3-5-sonnet-20241022' && t.inputTokens === 15);
    assert.ok(telemetryAntStream);
    assert.strictEqual(telemetryAntStream.outputTokens, 35);
    console.log('✓ Test Case 5 Passed');

    // Test Case 6: Client Abort & Connection Drop mid-stream
    console.log('\nRunning Test Case 6: Client Abort / Connection Drop...');
    const abortController = new AbortController();
    const abortRes = await fetch(`http://localhost:${PROXY_PORT}/v1/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Gateway-Key': AGENCY_GATEWAY_KEY
      },
      body: JSON.stringify({ model: 'gpt-4o', test_abort: true, stream: true }),
      signal: abortController.signal
    });
    assert.strictEqual(abortRes.status, 200);

    const abortReader = abortRes.body.getReader();
    // Read the first chunk
    const { value: firstChunk } = await abortReader.read();
    assert.ok(decoder.decode(firstChunk).includes('Slow chunk 1'));

    // Abort the client connection immediately
    abortController.abort();
    console.log('Client stream fetch request aborted.');

    // Wait and check if the mock upstream received the close event
    await delay(500);
    assert.strictEqual(clientAbortedCount, 1);
    console.log('✓ Test Case 6 Passed (Upstream connection aborted correctly)');

    console.log('\n--- All Integration Tests Passed Successfully! ---\n');
    cleanup(0);
  } catch (error) {
    console.error('\n✗ Test Suite Failed with error:', error);
    cleanup(1);
  }
}

function delay(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

function cleanup(exitCode) {
  console.log('Cleaning up mock server and proxy process...');
  if (proxyProcess) {
    proxyProcess.kill('SIGINT');
  }
  mockServer.close(() => {
    process.exit(exitCode);
  });
}
