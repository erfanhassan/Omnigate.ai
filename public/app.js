document.addEventListener('DOMContentLoaded', () => {
  // Constants for generic pricing estimates (per 1M tokens)
  const PRICING = {
    'gpt-4o': { in: 5.00, out: 15.00 },
    'claude-3-5-sonnet-20241022': { in: 3.00, out: 15.00 },
    'default': { in: 2.00, out: 10.00 } // fallback
  };

  // State
  let totalTokens = 0;
  let totalInputTokens = 0;
  let totalOutputTokens = 0;
  let totalCost = 0.0;
  let totalRequests = 0;

  // DOM Elements
  const elTotalTokens = document.getElementById('total-tokens');
  const elInputTokens = document.getElementById('input-tokens');
  const elOutputTokens = document.getElementById('output-tokens');
  
  const elTotalCost = document.getElementById('total-cost');
  const elAvgCost = document.getElementById('avg-cost');
  
  const elRpmValue = document.getElementById('rpm-value');
  const elTotalRequests = document.getElementById('total-requests');
  
  const tokensGauge = document.getElementById('tokens-gauge');
  const costGauge = document.getElementById('cost-gauge');
  const rpmGauge = document.getElementById('rpm-gauge');
  const tbody = document.getElementById('telemetry-tbody');

  // Track timestamps for RPM calculation
  const requestTimestamps = [];

  function calculateCost(model, inTokens, outTokens) {
    const rates = PRICING[model] || PRICING['default'];
    return (inTokens / 1000000) * rates.in + (outTokens / 1000000) * rates.out;
  }

  function formatNumber(num) {
    return new Intl.NumberFormat('en-US').format(num);
  }

  function updateGauges() {
    // Max tokens scale (e.g., 50k max for the gauge visual to be more reactive to test data)
    const MAX_TOKENS = 50000;
    let tokenPct = Math.min(totalTokens / MAX_TOKENS, 1);
    tokensGauge.style.strokeDashoffset = 283 - (283 * tokenPct);

    // Max cost scale (e.g. $0.5 max for reactivity)
    const MAX_COST = 0.5;
    let costPct = Math.min(totalCost / MAX_COST, 1);
    costGauge.style.strokeDashoffset = 283 - (283 * costPct);

    // RPM gauge (max 60 RPM)
    const now = Date.now();
    // Keep requests from last 60 seconds
    while (requestTimestamps.length > 0 && now - requestTimestamps[0] > 60000) {
      requestTimestamps.shift();
    }
    const rpm = requestTimestamps.length;
    let rpmPct = Math.min(rpm / 60, 1);
    rpmGauge.style.strokeDashoffset = 283 - (283 * rpmPct);
    
    elRpmValue.textContent = rpm;
  }

  // Periodic RPM update
  setInterval(updateGauges, 2000);

  function renderRow(tel, isNew = false) {
    const cost = calculateCost(tel.model, tel.inputTokens, tel.outputTokens);
    
    // Update State
    totalTokens += (tel.inputTokens + tel.outputTokens);
    totalInputTokens += tel.inputTokens;
    totalOutputTokens += tel.outputTokens;
    totalCost += cost;
    totalRequests += 1;
    requestTimestamps.push(new Date(tel.timestamp).getTime());

    // Update DOM Text
    elTotalTokens.textContent = formatNumber(totalTokens);
    elInputTokens.textContent = formatNumber(totalInputTokens);
    elOutputTokens.textContent = formatNumber(totalOutputTokens);
    
    elTotalCost.textContent = `$${totalCost.toFixed(3)}`;
    elAvgCost.textContent = `$${(totalCost / totalRequests).toFixed(4)}`;
    elTotalRequests.textContent = formatNumber(totalRequests);

    // Create Row
    const tr = document.createElement('tr');
    if (isNew) tr.className = 'new-row';
    
    const time = new Date(tel.timestamp).toLocaleTimeString();
    
    tr.innerHTML = `
      <td>${time}</td>
      <td><strong>${tel.provider.toUpperCase()}</strong><br><span style="color:#94a3b8;font-size:0.75rem">${tel.model}</span></td>
      <td>${tel.projectId}</td>
      <td>${tel.userId}</td>
      <td class="text-right">${formatNumber(tel.inputTokens)}</td>
      <td class="text-right">${formatNumber(tel.outputTokens)}</td>
      <td class="text-right" style="color:var(--neon-cyan)">$${cost.toFixed(4)}</td>
    `;
    
    tbody.insertBefore(tr, tbody.firstChild);

    // Keep table from growing infinitely
    if (tbody.children.length > 50) {
      tbody.removeChild(tbody.lastChild);
    }

    updateGauges();
  }

  // 1. Fetch initial history
  fetch('/api/telemetry')
    .then(res => res.json())
    .then(data => {
      // Data arrives newest first from server (unshifted), so we reverse to process chronologically
      data.reverse().forEach(tel => renderRow(tel, false));
    })
    .catch(err => console.error("Error fetching telemetry:", err));

  // 2. Connect to live SSE stream
  const evtSource = new EventSource('/api/telemetry/stream');
  evtSource.onmessage = (e) => {
    try {
      const tel = JSON.parse(e.data);
      renderRow(tel, true);
    } catch (err) {
      console.error("Stream parse error:", err);
    }
  };

  // ==========================================
  // Configuration Form Logic
  // ==========================================
  const configForm = document.getElementById('config-form');
  const openaiPreset = document.getElementById('openaiPreset');
  const openaiApiUrl = document.getElementById('openaiApiUrl');
  const configStatus = document.getElementById('config-status');

  // Helper to get gateway key
  function getGatewayKey() {
    let key = localStorage.getItem('gatewayKey');
    if (!key) {
      key = prompt('Enter Gateway Key to access the dashboard configuration:');
      if (key) localStorage.setItem('gatewayKey', key);
    }
    return key || '';
  }

  // Load existing config on page load
  fetch('/api/config', {
    headers: { 'x-gateway-key': getGatewayKey() }
  })
    .then(res => {
      if (res.status === 401) {
        localStorage.removeItem('gatewayKey');
        throw new Error("Unauthorized. Incorrect Gateway Key.");
      }
      return res.json();
    })
    .then(config => {
      document.getElementById('agencyGatewayKey').value = config.agencyGatewayKey || '';
      document.getElementById('openaiApiUrl').value = config.openaiApiUrl || '';
      document.getElementById('openaiApiKey').placeholder = config.openaiApiKey || 'Enter API key (leave blank to keep current)';
      document.getElementById('anthropicApiUrl').value = config.anthropicApiUrl || '';
      document.getElementById('anthropicApiKey').placeholder = config.anthropicApiKey || 'Enter API key (leave blank to keep current)';
      
      // Select preset if matched
      let foundPreset = false;
      for (const option of openaiPreset.options) {
        if (option.value === config.openaiApiUrl) {
          openaiPreset.value = config.openaiApiUrl;
          foundPreset = true;
          break;
        }
      }
      if (!foundPreset && config.openaiApiUrl) {
        openaiPreset.value = 'custom';
      }
    })
    .catch(err => {
      console.error("Error fetching config:", err);
      if (err.message.includes('Unauthorized')) {
        alert('Unauthorized. Please refresh and enter the correct Gateway Key.');
      }
    });

  // Handle preset selection
  openaiPreset.addEventListener('change', (e) => {
    if (e.target.value !== 'custom') {
      openaiApiUrl.value = e.target.value;
    }
  });

  // Handle save
  configForm.addEventListener('submit', (e) => {
    e.preventDefault();
    
    configStatus.textContent = "Saving...";
    configStatus.className = "config-status";

    const payload = {
      agencyGatewayKey: document.getElementById('agencyGatewayKey').value,
      openaiApiUrl: document.getElementById('openaiApiUrl').value,
      anthropicApiUrl: document.getElementById('anthropicApiUrl').value,
    };

    const openaiApiKey = document.getElementById('openaiApiKey').value;
    if (openaiApiKey) payload.openaiApiKey = openaiApiKey;

    const anthropicApiKey = document.getElementById('anthropicApiKey').value;
    if (anthropicApiKey) payload.anthropicApiKey = anthropicApiKey;

    fetch('/api/config', {
      method: 'POST',
      headers: { 
        'Content-Type': 'application/json',
        'x-gateway-key': getGatewayKey()
      },
      body: JSON.stringify(payload)
    })
    .then(res => res.json())
    .then(data => {
      if (data.status === 'success') {
        if (payload.agencyGatewayKey) {
          localStorage.setItem('gatewayKey', payload.agencyGatewayKey);
        }
        configStatus.textContent = data.message || "Saved successfully!";
        configStatus.classList.add('success');
        // Clear password fields so placeholders remain
        document.getElementById('openaiApiKey').value = '';
        document.getElementById('anthropicApiKey').value = '';
      } else {
        configStatus.textContent = data.error || "Failed to save.";
        configStatus.classList.add('error');
      }
      setTimeout(() => configStatus.textContent = "", 3000);
    })
    .catch(err => {
      configStatus.textContent = "Network error. Failed to save.";
      configStatus.classList.add('error');
      setTimeout(() => configStatus.textContent = "", 3000);
    });
  });
});
