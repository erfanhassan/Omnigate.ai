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

  let dashboardInitialized = false;
  let evtSource = null;

  function initializeDashboard() {
    if (dashboardInitialized) return;
    dashboardInitialized = true;

    // 1. Fetch initial history
    tbody.innerHTML = ''; // Clear rows
    fetch('/api/telemetry')
      .then(res => res.json())
      .then(data => {
        // Clear states before reloading
        totalTokens = 0;
        totalInputTokens = 0;
        totalOutputTokens = 0;
        totalCost = 0.0;
        totalRequests = 0;
        requestTimestamps.length = 0;

        data.reverse().forEach(tel => renderRow(tel, false));
      })
      .catch(err => console.error("Error fetching telemetry:", err));

    // 2. Connect to live SSE stream
    if (evtSource) {
      evtSource.close();
    }
    evtSource = new EventSource('/api/telemetry/stream');
    evtSource.onmessage = (e) => {
      try {
        const tel = JSON.parse(e.data);
        renderRow(tel, true);
      } catch (err) {
        console.error("Stream parse error:", err);
      }
    };
  }

  // ==========================================
  // Configuration & Security Lock Logic
  // ==========================================
  const configForm = document.getElementById('config-form');
  const openaiPreset = document.getElementById('openaiPreset');
  const openaiApiUrl = document.getElementById('openaiApiUrl');
  const configStatus = document.getElementById('config-status');

  const gaugeWrapper = document.getElementById('gauge-cluster-wrapper');
  const dataWrapper = document.getElementById('data-panel-wrapper');

  function getGatewayKey() {
    return localStorage.getItem('gatewayKey') || '';
  }

  function setLockedState(isLocked) {
    if (isLocked) {
      gaugeWrapper.classList.add('locked-section');
      dataWrapper.classList.add('locked-section');
    } else {
      gaugeWrapper.classList.remove('locked-section');
      dataWrapper.classList.remove('locked-section');
    }
  }

  function showOnboardingModal() {
    const modal = document.getElementById('onboarding-modal');
    if (modal) modal.classList.remove('hidden');
  }

  function checkAuthAndLoad() {
    const key = getGatewayKey();
    if (!key) {
      setLockedState(true);
      showOnboardingModal();
      return;
    }

    // Validate key and fetch configs
    fetch('/api/config', {
      headers: { 'x-gateway-key': key }
    })
      .then(res => {
        if (res.status === 401) {
          localStorage.removeItem('gatewayKey');
          setLockedState(true);
          showOnboardingModal();
          alert("Unauthorized. Incorrect Gateway Secret Key.");
          throw new Error("Unauthorized. Incorrect Gateway Secret Key.");
        }
        return res.json();
      })
      .then(config => {
        // Success: Unlock dashboard!
        setLockedState(false);
        initializeDashboard();

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
        console.error("Config load error:", err);
      });
  }

  // Run initial check
  checkAuthAndLoad();

  // Handle preset selection
  openaiPreset.addEventListener('change', (e) => {
    if (e.target.value !== 'custom') {
      openaiApiUrl.value = e.target.value;
    }
  });

  // Handle save and unlock
  configForm.addEventListener('submit', (e) => {
    e.preventDefault();
    
    configStatus.textContent = "Saving and validating...";
    configStatus.className = "config-status";

    const enteredKey = document.getElementById('agencyGatewayKey').value;
    localStorage.setItem('gatewayKey', enteredKey);

    const payload = {
      agencyGatewayKey: enteredKey,
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
        'x-gateway-key': enteredKey
      },
      body: JSON.stringify(payload)
    })
    .then(res => {
      if (res.status === 401) {
        localStorage.removeItem('gatewayKey');
        setLockedState(true);
        throw new Error("Invalid Gateway Secret Key. Access Denied.");
      }
      return res.json();
    })
    .then(data => {
      if (data.status === 'success') {
        configStatus.textContent = "Dashboard unlocked and configurations saved!";
        configStatus.classList.add('success');
        
        setLockedState(false);
        initializeDashboard();

        // Clear password fields so placeholders remain
        document.getElementById('openaiApiKey').value = '';
        document.getElementById('anthropicApiKey').value = '';
      } else {
        configStatus.textContent = data.error || "Failed to save.";
        configStatus.classList.add('error');
      }
      setTimeout(() => configStatus.textContent = "", 4000);
    })
    .catch(err => {
      configStatus.textContent = err.message || "Network error. Failed to save.";
      configStatus.classList.add('error');
      setTimeout(() => configStatus.textContent = "", 4000);
    });
  });

  // ==========================================
  // Tab Switching Logic
  // ==========================================
  const tabButtons = document.querySelectorAll('.tab-btn');
  const tabContents = document.querySelectorAll('.tab-content');

  tabButtons.forEach(btn => {
    btn.addEventListener('click', () => {
      const targetTab = btn.getAttribute('data-tab');

      tabButtons.forEach(b => b.classList.remove('active'));
      tabContents.forEach(c => c.classList.remove('active'));

      btn.classList.add('active');
      const targetElement = document.getElementById(`tab-${targetTab}`);
      if (targetElement) {
        targetElement.classList.add('active');
      }
    });
  });

  // ==========================================
  // Onboarding Modal Logic
  // ==========================================
  const modal = document.getElementById('onboarding-modal');
  const btnNext = document.getElementById('btn-next');
  const btnPrev = document.getElementById('btn-prev');
  const btnFinish = document.getElementById('btn-finish');
  const steps = document.querySelectorAll('.wizard-step');
  const dots = document.querySelectorAll('.step-dot');
  
  let currentStep = 1;
  const totalSteps = steps.length;

  function updateModalUI() {
    steps.forEach(step => {
      step.classList.remove('active', 'exit-left');
      const stepNum = parseInt(step.id.split('-')[1]);
      if (stepNum < currentStep) {
        step.classList.add('exit-left');
      } else if (stepNum === currentStep) {
        step.classList.add('active');
      }
    });

    dots.forEach(dot => {
      const dotStep = parseInt(dot.getAttribute('data-step'));
      dot.classList.toggle('active', dotStep === currentStep);
    });

    if (btnPrev) btnPrev.style.visibility = currentStep === 1 ? 'hidden' : 'visible';
    
    if (currentStep === totalSteps) {
      if (btnNext) btnNext.classList.add('hidden');
      if (btnFinish) btnFinish.classList.remove('hidden');
      
      const enteredKey = document.getElementById('onboardingGatewayKey').value;
      const previewKeyEl = document.getElementById('preview-key');
      if (previewKeyEl) {
        previewKeyEl.textContent = enteredKey || 'your-key';
      }
    } else {
      if (btnNext) btnNext.classList.remove('hidden');
      if (btnFinish) btnFinish.classList.add('hidden');
    }
  }

  if (btnNext) {
    btnNext.addEventListener('click', () => {
      if (currentStep < totalSteps) {
        currentStep++;
        updateModalUI();
      }
    });
  }

  if (btnPrev) {
    btnPrev.addEventListener('click', () => {
      if (currentStep > 1) {
        currentStep--;
        updateModalUI();
      }
    });
  }

  if (btnFinish) {
    btnFinish.addEventListener('click', () => {
      const enteredKey = document.getElementById('onboardingGatewayKey').value;
      if (!enteredKey) {
        alert("Please enter your Gateway Secret Key to continue.");
        currentStep = 2;
        updateModalUI();
        return;
      }
      
      localStorage.setItem('gatewayKey', enteredKey);
      if (modal) modal.classList.add('hidden');
      checkAuthAndLoad();
    });
  }
});

// ==========================================
// Copy Code Snippet Helper
// ==========================================
window.copySnippet = function(id, btn) {
  const codeElement = document.getElementById(id);
  if (!codeElement) return;
  const code = codeElement.textContent;
  navigator.clipboard.writeText(code).then(() => {
    const originalText = btn.textContent;
    btn.textContent = "Copied!";
    btn.style.borderColor = "var(--accent-green)";
    btn.style.color = "var(--accent-green)";
    setTimeout(() => {
      btn.textContent = originalText;
      btn.style.borderColor = "";
      btn.style.color = "";
    }, 2000);
  }).catch(err => {
    console.error("Failed to copy code snippet:", err);
  });
};

