/**
 * OmniGate AI - Real API Test Script
 * 
 * This script:
 * 1. Configures the proxy with your real API key
 * 2. Sends prompts about THIS project (the server.js code)
 * 3. Captures and displays exact token usage & cost from the proxy telemetry
 * 
 * Usage: node test-real-api.js
 */

import readline from 'readline';

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

function askQuestion(query) {
  return new Promise(resolve => rl.question(query, resolve));
}

// Pricing for cost calculation (matches the dashboard)
const PRICING = {
  'gpt-4o': { in: 5.00, out: 15.00 },
  'gpt-4o-mini': { in: 0.15, out: 0.60 },
  'gpt-4o-2024-08-06': { in: 2.50, out: 10.00 },
  'gpt-4-turbo': { in: 10.00, out: 30.00 },
  'gpt-3.5-turbo': { in: 0.50, out: 1.50 },
  'claude-3-5-sonnet-20241022': { in: 3.00, out: 15.00 },
  'claude-3-opus-20240229': { in: 15.00, out: 75.00 },
  'claude-3-haiku-20240307': { in: 0.25, out: 1.25 },
  'default': { in: 2.00, out: 10.00 }
};

function calculateCost(model, inTokens, outTokens) {
  const rates = PRICING[model] || PRICING['default'];
  return (inTokens / 1000000) * rates.in + (outTokens / 1000000) * rates.out;
}

// The server.js code content - this is what we'll ask about
const SERVER_CODE_INTRO = `
The OmniGate server.js is an Express-based proxy server with these key features:
- Proxies requests to OpenAI (/v1/chat/completions) and Anthropic (/v1/messages)
- Intercepts streaming SSE responses to extract usage/token metadata
- Forces OpenAI to include usage data via stream_options: {include_usage: true}
- Parses Anthropic message_start/message_delta events for token counting
- Logs telemetry with provider, model, input_tokens, output_tokens, userId, projectId
- Has a dashboard at /dashboard for live telemetry viewing
- Requires X-Gateway-Key header for authentication
- Uses timingSafeEqual for header comparison to prevent timing attacks
- Handles client disconnects by aborting upstream requests
`;

async function main() {
  console.log('\n╔══════════════════════════════════════════════════╗');
  console.log('║   🧪 OmniGate AI - Real API Token Test          ║');
  console.log('║   Testing prompt costs against THIS project      ║');
  console.log('╚══════════════════════════════════════════════════╝\n');

  // Get API key from user (masked input would require pty, so plain for now)
  const apiKey = await askQuestion('🔑 Enter your OpenAI API key (sk-...): ');
  
  // Choose model
  console.log('\n📋 Available models:');
  console.log('   1. gpt-4o (most capable)');
  console.log('   2. gpt-4o-mini (cheapest)');
  console.log('   3. gpt-4-turbo');
  console.log('   4. gpt-3.5-turbo');
  const modelChoice = await askQuestion('\n🎯 Choose model (1-4, default: 1): ') || '1';
  const models = ['gpt-4o', 'gpt-4o-mini', 'gpt-4-turbo', 'gpt-3.5-turbo'];
  const model = models[parseInt(modelChoice) - 1] || 'gpt-4o';

  // Choose what to ask about
  console.log('\n📝 Test prompts about this project:');
  console.log('   1. "Explain the architecture of this proxy server"');
  console.log('   2. "How does the SSE token interception work?"');
  console.log('   3. "Find any bugs or security issues in this code"');
  console.log('   4. "Write me a comprehensive code review"');
  console.log('   5. All of the above (multiple requests)');
  const promptChoice = await askQuestion('\n🎯 Choose prompt (1-5, default: 5): ') || '5';

  const prompts = {
    1: `${SERVER_CODE_INTRO}\n\nExplain the architecture of this proxy server. What are its main components and how do they interact?`,
    2: `${SERVER_CODE_INTRO}\n\nExplain in detail how the SSE (Server-Sent Events) token interception works for both OpenAI and Anthropic streaming responses. How does it extract usage metadata?`,
    3: `${SERVER_CODE_INTRO}\n\nReview this code carefully. Are there any bugs, security vulnerabilities, or edge cases that aren't handled properly? Be specific.`,
    4: `${SERVER_CODE_INTRO}\n\nProvide a comprehensive code review of this server.js file. Cover architecture, error handling, security, performance, and suggest improvements.`
  };

  // Configure the proxy with the API key
  console.log('\n⚙️  Configuring proxy with API key...');
  const configRes = await fetch('http://localhost:8080/api/config', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Gateway-Key': 'stub-agency-key-for-local-testing'
    },
    body: JSON.stringify({ openaiApiKey: apiKey })
  });
  const configData = await configRes.json();
  if (configData.status !== 'success') {
    console.error('❌ Failed to configure proxy:', configData);
    rl.close();
    return;
  }
  console.log('✅ Proxy configured successfully!\n');

  // Clear previous telemetry
  console.log('📊 Clearing previous telemetry data...');

  // Determine which prompts to run
  const selectedPrompts = (promptChoice === '5') 
    ? [1, 2, 3, 4] 
    : [parseInt(promptChoice)];

  const allTelemetry = [];

  for (const idx of selectedPrompts) {
    const prompt = prompts[idx];
    const promptName = {
      1: 'Architecture explanation',
      2: 'SSE token interception',
      3: 'Bug & security review',
      4: 'Comprehensive code review'
    }[idx];

    console.log('──────────────────────────────────────────────────────');
    console.log(`📤 Sending: ${promptName}`);
    console.log('──────────────────────────────────────────────────────');

    try {
      const startTime = Date.now();
      
      const response = await fetch('http://localhost:8080/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Gateway-Key': 'stub-agency-key-for-local-testing',
          'X-Gateway-User-ID': 'erfan',
          'X-Gateway-Project-ID': 'omnigate-ai-project'
        },
        body: JSON.stringify({
          model: model,
          messages: [{ role: 'user', content: prompt }],
          stream: false
        })
      });

      if (!response.ok) {
        const errText = await response.text();
        console.error(`❌ Request failed (${response.status}): ${errText}`);
        continue;
      }

      const data = await response.json();
      const elapsed = Date.now() - startTime;
      
      // Read telemetry from the proxy
      await new Promise(r => setTimeout(r, 200));
      const telemetryRes = await fetch('http://localhost:8080/api/telemetry');
      const telemetryData = await telemetryRes.json();
      
      // Find the latest telemetry entry
      const latestTel = telemetryData[0];
      
      if (latestTel && latestTel.inputTokens > 0) {
        const cost = calculateCost(latestTel.model, latestTel.inputTokens, latestTel.outputTokens);
        allTelemetry.push(latestTel);
        
        const content = data.choices?.[0]?.message?.content || '';
        const preview = content.length > 200 ? content.substring(0, 200) + '...' : content;
        
        console.log(`   ✅ Response received in ${elapsed}ms`);
        console.log(`   📝 Preview: "${preview}"\n`);
        console.log(`   📊 TOKEN USAGE:`);
        console.log(`      Input Tokens : ${latestTel.inputTokens.toLocaleString()}`);
        console.log(`      Output Tokens: ${latestTel.outputTokens.toLocaleString()}`);
        console.log(`      Total Tokens : ${(latestTel.inputTokens + latestTel.outputTokens).toLocaleString()}`);
        console.log(`      💰 Cost       : $${cost.toFixed(6)}`);
      } else {
        console.log('   ⚠️  Response received but no telemetry found.');
      }
    } catch (err) {
      console.error(`❌ Error: ${err.message}`);
    }
    console.log('');
  }

  // Print summary
  console.log('\n╔══════════════════════════════════════════════════╗');
  console.log('║   📈 FINAL CONSOLIDATED REPORT                   ║');
  console.log('╚══════════════════════════════════════════════════╝\n');

  if (allTelemetry.length === 0) {
    console.log('No telemetry data captured. Is the proxy running?');
    rl.close();
    return;
  }

  let totalInput = 0, totalOutput = 0, totalCost = 0;
  console.log(`   Model Used: ${model}`);
  for (const tel of allTelemetry) {
    const cost = calculateCost(tel.model, tel.inputTokens, tel.outputTokens);
    totalInput += tel.inputTokens;
    totalOutput += tel.outputTokens;
    totalCost += cost;
  }

  console.log(`   Total Requests : ${allTelemetry.length}`);
  console.log(`   Total Input    : ${totalInput.toLocaleString()} tokens`);
  console.log(`   Total Output   : ${totalOutput.toLocaleString()} tokens`);
  console.log(`   Grand Total    : ${(totalInput + totalOutput).toLocaleString()} tokens`);
  console.log(`   💰 Total Cost  : $${totalCost.toFixed(6)}`);
  
  // Estimate for 1000 similar requests
  console.log(`\n   📊 ESTIMATES:`);
  console.log(`   Cost per request         : $${(totalCost / allTelemetry.length).toFixed(6)}`);
  console.log(`   Est. cost for 1000 reqs  : $${((totalCost / allTelemetry.length) * 1000).toFixed(4)}`);
  console.log(`   Est. cost for 10000 reqs : $${((totalCost / allTelemetry.length) * 10000).toFixed(4)}`);
  console.log(`   Est. cost for 100k reqs  : $${((totalCost / allTelemetry.length) * 100000).toFixed(4)}`);

  console.log(`\n🌐 View full details: http://localhost:8080/dashboard/`);
  console.log('🔑 Gateway Key: stub-agency-key-for-local-testing\n');

  rl.close();
}

main().catch(console.error);
