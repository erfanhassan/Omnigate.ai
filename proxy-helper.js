/**
 * This helper configures OmniGate proxy to work with DeepSeek/OpenAI
 * and displays token usage information.
 * 
 * The proxy is already running on port 8080.
 * Configure your API key via the dashboard at http://localhost:8080/dashboard/
 * Gateway Key: stub-agency-key-for-local-testing
 */

const PROXY_URL = 'http://localhost:8080';

// Pricing reference (from the dashboard)
const PRICING = {
  'gpt-4o': { in: 5.00, out: 15.00 },
  'gpt-4o-mini': { in: 0.15, out: 0.60 },
  'deepseek-chat': { in: 0.27, out: 1.10 },
  'claude-3-5-sonnet-20241022': { in: 3.00, out: 15.00 },
  'default': { in: 2.00, out: 10.00 }
};

export function calculateCost(model, inTokens, outTokens) {
  const rates = PRICING[model] || PRICING['default'];
  return (inTokens / 1000000) * rates.in + (outTokens / 1000000) * rates.out;
}

export async function getTelemetry() {
  const res = await fetch(`${PROXY_URL}/api/telemetry`);
  return res.json();
}

export async function getConfig() {
  const res = await fetch(`${PROXY_URL}/api/config`, {
    headers: { 'X-Gateway-Key': 'stub-agency-key-for-local-testing' }
  });
  return res.json();
}

console.log('\n╔══════════════════════════════════════════════════════════╗');
console.log('║   🚪 OmniGate Proxy Helper                              ║');
console.log('║                                                        ║');
console.log('║   1. Open http://localhost:8080/dashboard/ in browser  ║');
console.log('║   2. Enter Gateway Key: stub-agency-key-for-local-testing ║');
console.log('║   3. Paste your API key and Save                       ║');
console.log('║   4. Come back here and I will send test requests       ║');
console.log('║      through the proxy so you see them on dashboard    ║');
console.log('╚══════════════════════════════════════════════════════════╝\n');

// Check current config status
const config = await getConfig();
console.log('Current proxy config:');
console.log(`  OpenAI URL: ${config.openaiApiUrl}`);
console.log(`  API Key set: ${config.openaiApiKey ? '✅ Yes' : '❌ No'}`);
console.log(`  Gateway Key: ${config.agencyGatewayKey}\n`);

if (!config.openaiApiKey) {
  console.log('⚠️  No API key configured yet.');
  console.log('➡️  Go to http://localhost:8080/dashboard/ and enter your key.\n');
} else {
  console.log('✅ API key is configured! Ready to route requests through proxy.\n');
}
