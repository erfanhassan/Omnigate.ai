import http from 'http';
import { spawn } from 'child_process';

// =========================================================
// 1. Start a Mock Upstream API (simulates OpenAI/Anthropic)
// =========================================================
const MOCK_PORT = 8081;

const mockReceivedRequests = [];

const mockServer = http.createServer((req, res) => {
  let body = '';
  req.on('data', chunk => { body += chunk; });
  req.on('end', () => {
    const parsedBody = body ? JSON.parse(body) : {};
    mockReceivedRequests.push({ url: req.url, body: parsedBody });

    if (req.url === '/v1/chat/completions') {
      const isStreaming = parsedBody.stream === true;
      if (isStreaming) {
        res.writeHead(200, {
          'Content-Type': 'text/event-stream',
          'Cache-Control': 'no-cache',
          'Connection': 'keep-alive'
        });
        // SSE chunks with usage info at the end
        res.write('data: {"id":"chatcmpl-1","object":"chat.completion.chunk","created":1677652288,"model":"gpt-4o","choices":[{"index":0,"delta":{"content":"Hello"},"finish_reason":null}]}\n\n');
        res.write('data: {"id":"chatcmpl-1","object":"chat.completion.chunk","created":1677652288,"model":"gpt-4o","choices":[],"usage":{"prompt_tokens":25,"completion_tokens":47,"total_tokens":72}}\n\n');
        res.write('data: [DONE]\n\n');
        res.end();
      } else {
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({
          id: 'chatcmpl-2',
          object: 'chat.completion',
          created: 1677652288,
          model: 'gpt-4o',
          choices: [{ index: 0, message: { role: 'assistant', content: 'Hello!' }, finish_reason: 'stop' }],
          usage: { prompt_tokens: 25, completion_tokens: 47, total_tokens: 72 }
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
        res.write('event: message_start\ndata: {"type":"message_start","message":{"id":"msg_1","type":"message","role":"assistant","model":"claude-3-5-sonnet-20241022","content":[],"usage":{"input_tokens":120,"output_tokens":0}}}\n\n');
        res.write('event: content_block_delta\ndata: {"type":"content_block_delta","index":0,"delta":{"type":"text_delta","text":"Hi there!"}}\n\n');
        res.write('event: message_delta\ndata: {"type":"message_delta","delta":{"stop_reason":"end_turn"},"usage":{"output_tokens":340}}\n\n');
        res.write('event: message_stop\ndata: {"type":"message_stop"}\n\n');
        res.end();
      } else {
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({
          id: 'msg_2',
          type: 'message',
          role: 'assistant',
          model: 'claude-3-5-sonnet-20241022',
          content: [{ type: 'text', text: 'Hi there!' }],
          stop_reason: 'end_turn',
          usage: { input_tokens: 120, output_tokens: 340 }
        }));
      }
    } else {
      res.writeHead(404);
      res.end('Not Found');
    }
  });
});

mockServer.listen(MOCK_PORT, () => {
  console.log(`✅ Mock Upstream API Server running on port ${MOCK_PORT}`);
  console.log(`   This simulates OpenAI & Anthropic APIs with fake usage data.\n`);
  startGateway();
});

// =========================================================
// 2. Start the OmniGate Proxy (pointing to our mock API)
// =========================================================
let proxyProcess;
let capturedTelemetry = [];

function startGateway() {
  proxyProcess = spawn('node', ['server.js'], {
    env: {
      ...process.env,
      PORT: 8080,
      AGENCY_GATEWAY_KEY: 'stub-agency-key-for-local-testing',
      OPENAI_API_KEY: 'sk-test-openai-key-mock',
      ANTHROPIC_API_KEY: 'sk-test-anthropic-key-mock',
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
          capturedTelemetry.push(logObj.telemetry);
          printTelemetry(logObj.telemetry);
        } catch (e) {}
      } else if (trimmed) {
        console.log(`   [Proxy]: ${trimmed}`);
      }
    }
  });

  proxyProcess.stderr.on('data', data => {
    console.error(`   [Proxy Error]: ${data}`);
  });

  setTimeout(runTests, 1500);
}

// =========================================================
// 3. Cost calculation helper
// =========================================================
const PRICING = {
  'gpt-4o': { in: 5.00, out: 15.00 },           // $5/$15 per 1M tokens
  'gpt-4o-mini': { in: 0.15, out: 0.60 },
  'claude-3-5-sonnet-20241022': { in: 3.00, out: 15.00 },
  'default': { in: 2.00, out: 10.00 }
};

function calculateCost(model, inTokens, outTokens) {
  const rates = PRICING[model] || PRICING['default'];
  const cost = (inTokens / 1000000) * rates.in + (outTokens / 1000000) * rates.out;
  return cost;
}

function printTelemetry(tel) {
  const cost = calculateCost(tel.model, tel.inputTokens, tel.outputTokens);
  console.log(`\n📊 Telemetry captured:`);
  console.log(`   Provider : ${tel.provider}`);
  console.log(`   Model    : ${tel.model}`);
  console.log(`   User     : ${tel.userId}`);
  console.log(`   Project  : ${tel.projectId}`);
  console.log(`   🔤 Input Tokens : ${tel.inputTokens.toLocaleString()}`);
  console.log(`   🔤 Output Tokens: ${tel.outputTokens.toLocaleString()}`);
  console.log(`   💰 Cost         : $${cost.toFixed(6)}`);
}

// =========================================================
// 4. Send test requests using Node.js built-in fetch
// =========================================================
async function runTests() {
  console.log('\n═══════════════════════════════════════════');
  console.log('   🧪 SENDING TEST REQUESTS');
  console.log('═══════════════════════════════════════════\n');

  const headers = {
    'Content-Type': 'application/json',
    'X-Gateway-Key': 'stub-agency-key-for-local-testing',
    'X-Gateway-User-ID': 'developer-alice',
    'X-Gateway-Project-ID': 'enterprise-client-xyz'
  };

  try {
    // Test 1: OpenAI Non-Streaming
    console.log('───────────────────────────────────────────');
    console.log('Test 1: OpenAI Non-Streaming (gpt-4o)');
    console.log('───────────────────────────────────────────');
    let res = await fetch('http://localhost:8080/v1/chat/completions', {
      method: 'POST',
      headers,
      body: JSON.stringify({
        model: 'gpt-4o',
        messages: [{ role: 'user', content: 'Explain quantum computing in simple terms' }]
      })
    });
    let data = await res.json();
    console.log(`   Response: "${data.choices?.[0]?.message?.content || 'N/A'}"\n`);

    await delay(200);

    // Test 2: OpenAI Streaming
    console.log('───────────────────────────────────────────');
    console.log('Test 2: OpenAI Streaming (gpt-4o)');
    console.log('───────────────────────────────────────────');
    // Just submit the request - telemetry will be captured on stream end
    let res2 = await fetch('http://localhost:8080/v1/chat/completions', {
      method: 'POST',
      headers: { ...headers, 'X-Gateway-Project-ID': 'startup-app-v2' },
      body: JSON.stringify({
        model: 'gpt-4o',
        messages: [{ role: 'user', content: 'Write a Python function to sort a list' }],
        stream: true
      })
    });
    // Read the full stream
    const reader = res2.body.getReader();
    const decoder = new TextDecoder();
    let streamText = '';
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      streamText += decoder.decode(value, { stream: true });
    }
    console.log(`   Stream completed. Contains [DONE]: ${streamText.includes('[DONE]')}\n`);

    await delay(200);

    // Test 3: Anthropic Non-Streaming
    console.log('───────────────────────────────────────────');
    console.log('Test 3: Anthropic Non-Streaming (claude-3-5-sonnet)');
    console.log('───────────────────────────────────────────');
    let res3 = await fetch('http://localhost:8080/v1/messages', {
      method: 'POST',
      headers: { ...headers, 'X-Gateway-User-ID': 'developer-bob' },
      body: JSON.stringify({
        model: 'claude-3-5-sonnet-20241022',
        messages: [{ role: 'user', content: 'Summarize the key points of REST APIs' }]
      })
    });
    let data3 = await res3.json();
    console.log(`   Response: "${data3.content?.[0]?.text || 'N/A'}"\n`);

    await delay(200);

    // Test 4: Anthropic Streaming
    console.log('───────────────────────────────────────────');
    console.log('Test 4: Anthropic Streaming (claude-3-5-sonnet)');
    console.log('───────────────────────────────────────────');
    let res4 = await fetch('http://localhost:8080/v1/messages', {
      method: 'POST',
      headers: { ...headers, 'X-Gateway-User-ID': 'developer-bob' },
      body: JSON.stringify({
        model: 'claude-3-5-sonnet-20241022',
        messages: [{ role: 'user', content: 'What is the difference between SQL and NoSQL?' }],
        stream: true
      })
    });
    const reader2 = res4.body.getReader();
    let streamText2 = '';
    while (true) {
      const { done, value } = await reader2.read();
      if (done) break;
      streamText2 += decoder.decode(value, { stream: true });
    }
    console.log(`   Stream completed. Contains message_stop: ${streamText2.includes('message_stop')}\n`);

    // Wait for all telemetry to be processed
    await delay(500);

    // =========================================================
    // 5. Summary Report
    // =========================================================
    console.log('\n═══════════════════════════════════════════');
    console.log('   📈 FINAL CONSOLIDATED REPORT');
    console.log('═══════════════════════════════════════════\n');

    let grandTotalInput = 0;
    let grandTotalOutput = 0;
    let grandTotalCost = 0;

    for (const tel of capturedTelemetry) {
      const cost = calculateCost(tel.model, tel.inputTokens, tel.outputTokens);
      grandTotalInput += tel.inputTokens;
      grandTotalOutput += tel.outputTokens;
      grandTotalCost += cost;
    }

    console.log(`   Total Requests Tracked : ${capturedTelemetry.length}`);
    console.log(`   Total Input Tokens     : ${grandTotalInput.toLocaleString()}`);
    console.log(`   Total Output Tokens    : ${grandTotalOutput.toLocaleString()}`);
    console.log(`   Total Tokens           : ${(grandTotalInput + grandTotalOutput).toLocaleString()}`);
    console.log(`   Total Estimated Cost   : $${grandTotalCost.toFixed(6)}`);

    console.log('\n   Breakdown by request:');
    console.log('   ─────────────────────────────────────────────');
    console.log('   #  │ Provider │ Model         │ In Tok │ Out Tok │ Cost        │ User');
    console.log('   ───┼──────────┼───────────────┼────────┼─────────┼─────────────┼──────────────');
    capturedTelemetry.forEach((tel, i) => {
      const cost = calculateCost(tel.model, tel.inputTokens, tel.outputTokens);
      console.log(`   ${i+1}. │ ${tel.provider.padEnd(7)}│ ${tel.model.padEnd(13)}│ ${String(tel.inputTokens).padStart(6)} │ ${String(tel.outputTokens).padStart(7)} │ $${cost.toFixed(6).padStart(9)} │ ${tel.userId}`);
    });

    console.log('\n═══════════════════════════════════════════');
    console.log('   ✅ ALL TESTS COMPLETED');
    console.log('   🌐 Access the dashboard: http://localhost:8080/dashboard/');
    console.log('   🔑 Dashboard Gateway Key: stub-agency-key-for-local-testing');
    console.log('═══════════════════════════════════════════\n');

    cleanup(0);
  } catch (error) {
    console.error('\n❌ Test failed:', error);
    cleanup(1);
  }
}

function delay(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

function cleanup(exitCode) {
  console.log('\nCleaning up...');
  if (proxyProcess) proxyProcess.kill('SIGINT');
  mockServer.close(() => process.exit(exitCode));
}
