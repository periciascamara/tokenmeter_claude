// Claude.ai TokenMeter Popup Script

document.addEventListener('DOMContentLoaded', () => {
  // UI Elements
  const displayName = document.getElementById('display-name');
  const displayEmail = document.getElementById('display-email');
  const planBadge = document.getElementById('plan-badge');
  const avatarImg = document.getElementById('user-avatar');
  const avatarRing = document.getElementById('avatar-ring');
  
  const activeModel = document.getElementById('active-model');
  
  const sessionPctEl = document.getElementById('session-pct');
  const sessionProgress = document.getElementById('session-progress');
  const sessionTxt = document.getElementById('session-tokens-txt');
  
  const weeklyPctEl = document.getElementById('weekly-pct');
  const weeklyProgress = document.getElementById('weekly-progress');
  const weeklyTxt = document.getElementById('weekly-tokens-txt');
  
  const sessionCostEl = document.getElementById('session-cost');
  const sessionCostUsdEl = document.getElementById('session-cost-usd');
  
  // Settings elements
  const settingsHeader = document.getElementById('settings-header');
  const settingsArrow = document.getElementById('settings-arrow');
  const settingsContent = document.getElementById('settings-content');
  
  const inputExchangeRate = document.getElementById('input-exchange-rate');
  const inputSessionLimit = document.getElementById('input-session-limit');
  const inputWeeklyLimit = document.getElementById('input-weekly-limit');
  const saveSettingsBtn = document.getElementById('save-settings-btn');

  // Toggle Settings Section
  settingsHeader.addEventListener('click', () => {
    const isOpen = settingsContent.classList.toggle('open');
    settingsArrow.classList.toggle('open', isOpen);
  });

  // Save Settings
  saveSettingsBtn.addEventListener('click', () => {
    const rate = parseFloat(inputExchangeRate.value) || 5.15;
    const sessionLimit = parseInt(inputSessionLimit.value, 10) || 200000;
    const weeklyLimit = parseInt(inputWeeklyLimit.value, 10) || 5000000;

    chrome.storage.local.set({
      exchangeRate: rate,
      sessionLimit: sessionLimit,
      weeklyLimit: weeklyLimit
    }, () => {
      // Collapse settings after saving
      settingsContent.classList.remove('open');
      settingsArrow.classList.remove('open');
      
      // Update UI immediately
      updateUI();
    });
  });

  // Main UI update function
  function updateUI() {
    chrome.storage.local.get([
      'exchangeRate',
      'sessionLimit',
      'weeklyLimit',
      'weeklyUsage',
      'currentModel',
      'sessionTokens',
      'currentUser'
    ], (data) => {
      const rate = data.exchangeRate || 5.15;
      const sessionLimit = data.sessionLimit || 200000;
      const weeklyLimit = data.weeklyLimit || 5000000;
      const weeklyTokens = (data.weeklyUsage && data.weeklyUsage.amount) || 0;
      const session = data.sessionTokens || { input: 0, output: 0, total: 0 };
      const model = data.currentModel || 'claude-3-5-sonnet';
      const user = data.currentUser || { name: 'Claude User', email: '', photoUrl: '', plan: 'Free Plan' };

      // Pre-fill inputs if not focused
      if (document.activeElement !== inputExchangeRate) inputExchangeRate.value = rate;
      if (document.activeElement !== inputSessionLimit) inputSessionLimit.value = sessionLimit;
      if (document.activeElement !== inputWeeklyLimit) inputWeeklyLimit.value = weeklyLimit;

      // Profile Header
      const defaultAvatar = 'https://www.gravatar.com/avatar/00000000000000000000000000000000?d=mp&f=y';
      avatarImg.src = user.photoUrl || defaultAvatar;
      displayName.textContent = user.name || 'Claude User';
      
      if (user.email) {
        displayEmail.textContent = user.email;
        displayEmail.style.display = 'block';
      } else {
        displayEmail.style.display = 'none';
      }

      planBadge.textContent = user.plan || 'Free Plan';
      if (user.plan === 'Free Plan') {
        planBadge.style.background = 'linear-gradient(135deg, #4b5563, #374151)';
        planBadge.style.boxShadow = 'none';
      } else {
        planBadge.style.background = 'var(--accent-gradient)';
        planBadge.style.boxShadow = '0 2px 8px rgba(139, 92, 246, 0.3)';
      }

      // Active Model
      if (typeof getRatesForModel === 'function') {
        activeModel.textContent = getRatesForModel(model).name;
      } else {
        activeModel.textContent = model.replace(/^claude-/, 'Claude ');
      }

      // Percentages
      const sessionPct = Math.min(100, Math.round((session.total / sessionLimit) * 100));
      const weeklyPct = Math.min(100, Math.round((weeklyTokens / weeklyLimit) * 100));

      // Session UI Progress
      sessionPctEl.textContent = `${sessionPct}%`;
      sessionProgress.style.width = `${sessionPct}%`;
      sessionProgress.className = 'tm-progress-bar';
      avatarRing.className = 'tm-avatar-ring';

      if (sessionPct >= 80) {
        sessionProgress.classList.add('high');
        avatarRing.classList.add('high');
      } else if (sessionPct >= 50) {
        sessionProgress.classList.add('medium');
        avatarRing.classList.add('medium');
      }

      sessionTxt.textContent = `${session.total.toLocaleString()} / ${(sessionLimit / 1000).toFixed(0)}k tokens`;

      // Weekly UI Progress
      weeklyPctEl.textContent = `${weeklyPct}%`;
      weeklyProgress.style.width = `${weeklyPct}%`;
      weeklyProgress.className = 'tm-progress-bar';

      if (weeklyPct >= 80) {
        weeklyProgress.classList.add('high');
      } else if (weeklyPct >= 50) {
        weeklyProgress.classList.add('medium');
      }

      const mbFormat = (weeklyLimit / 1000000).toFixed(1);
      weeklyTxt.textContent = `${weeklyTokens.toLocaleString()} / ${mbFormat}M tokens`;

      // Costs Estimation
      let usdSpend = 0;
      if (typeof calculateUSDSpend === 'function') {
        usdSpend = calculateUSDSpend(model, session.input, session.output);
      } else {
        const rateInput = model.includes('opus') ? 15.00 : 3.00;
        const rateOutput = model.includes('opus') ? 75.00 : 15.00;
        usdSpend = ((session.input / 1000000) * rateInput) + ((session.output / 1000000) * rateOutput);
      }
      const brlSpend = usdSpend * rate;

      if (typeof formatBRL === 'function') {
        sessionCostEl.textContent = formatBRL(brlSpend);
      } else {
        // Fallback Formatter
        sessionCostEl.textContent = new Intl.NumberFormat('pt-BR', {
          style: 'currency',
          currency: 'BRL',
          minimumFractionDigits: 2,
          maximumFractionDigits: 2
        }).format(brlSpend);
      }

      sessionCostUsdEl.textContent = `$${usdSpend.toFixed(4)} USD • Cotação: R$ ${rate.toFixed(2)}`;
    });
  }

  // Load initially
  updateUI();

  // Refresh if storage values change in background
  chrome.storage.onChanged.addListener((changes, area) => {
    if (area === 'local') {
      updateUI();
    }
  });
});
