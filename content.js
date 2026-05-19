// Claude.ai TokenMeter Content Script

// (Manual script injection removed; manifest.json now handles world: MAIN injection directly)

// Floating Widget State
let isExpanded = false;
let widgetContainer = null;

// Initialize Widget on page load when DOM is ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initWidget);
} else {
  initWidget();
}

function initWidget() {
  // Prevent duplicate creation
  if (document.getElementById('tm-floating-widget')) return;

  widgetContainer = document.createElement('div');
  widgetContainer.id = 'tm-floating-widget';
  
  // HTML layout representing both collapsed (badge) and expanded (panel) states
  widgetContainer.innerHTML = `
    <!-- Expanded Dashboard Panel -->
    <div class="tm-widget-panel tm-card" id="tm-widget-panel">
      <button class="tm-widget-close" id="tm-widget-close" title="Recolher">&times;</button>
      
      <div class="tm-container">
        <!-- Profile Header -->
        <div class="tm-profile">
          <div class="tm-avatar-wrapper">
            <img class="tm-avatar" id="tm-user-avatar" src="" alt="Avatar">
            <div class="tm-avatar-ring" id="tm-avatar-ring"></div>
          </div>
          <div class="tm-user-info">
            <span class="tm-user-name" id="tm-display-name">Claude User</span>
            <span class="tm-user-email" id="tm-display-email"></span>
            <span class="tm-plan-badge" id="tm-plan-badge">Free Plan</span>
          </div>
        </div>

        <!-- Model Section -->
        <div class="tm-model-section">
          <span>Modelo Ativo:</span>
          <span class="tm-model-badge">
            <span class="tm-model-dot"></span>
            <span id="tm-active-model">Sonnet 3.5</span>
          </span>
        </div>

        <!-- Session Progress Bar -->
        <div class="tm-usage-item">
          <div class="tm-usage-header">
            <span class="tm-usage-title">Uso da Sessão (Contexto)</span>
            <span class="tm-usage-value" id="tm-session-pct">0%</span>
          </div>
          <div class="tm-progress-track">
            <div class="tm-progress-bar" id="tm-session-progress"></div>
          </div>
          <div class="tm-tokens-detail" id="tm-session-tokens-txt">0 / 200k tkn</div>
        </div>

        <!-- Weekly Progress Bar -->
        <div class="tm-usage-item">
          <div class="tm-usage-header">
            <span class="tm-usage-title">Uso Semanal</span>
            <span class="tm-usage-value" id="tm-weekly-pct">0%</span>
          </div>
          <div class="tm-progress-track">
            <div class="tm-progress-bar" id="tm-weekly-progress"></div>
          </div>
          <div class="tm-tokens-detail" id="tm-weekly-tokens-txt">0 / 5.0M tkn</div>
        </div>

        <!-- Cost Estimate -->
        <div class="tm-cost-section">
          <span class="tm-cost-label">CUSTO ESTIMADO DA SESSÃO</span>
          <span class="tm-cost-amount" id="tm-session-cost">R$ 0,00</span>
          <span class="tm-cost-usd" id="tm-session-cost-usd">$0.00 USD • Cotação: R$ 5,15</span>
        </div>
      </div>
    </div>

    <!-- Collapsed Badge Button -->
    <div class="tm-widget-badge" id="tm-widget-badge" title="TokenMeter - Mostrar uso de tokens">
      <img class="tm-badge-avatar" id="tm-badge-avatar" src="" alt="Avatar">
      
      <!-- Circular Progress Ring -->
      <svg class="tm-badge-circle-svg">
        <circle class="tm-badge-circle-bg" cx="26" cy="26" r="23.5"></circle>
        <circle class="tm-badge-circle-progress" id="tm-badge-circle-progress" cx="26" cy="26" r="23.5"></circle>
      </svg>
    </div>
  `;

  document.body.appendChild(widgetContainer);

  // Setup Event Listeners
  const badge = document.getElementById('tm-widget-badge');
  const panel = document.getElementById('tm-widget-panel');
  const closeBtn = document.getElementById('tm-widget-close');

  badge.addEventListener('click', () => {
    isExpanded = true;
    panel.classList.add('open');
    badge.style.display = 'none';
  });

  closeBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    isExpanded = false;
    panel.classList.remove('open');
    badge.style.display = 'flex';
  });

  // Pull initial settings/data and render
  updateWidgetFromStorage();
}

// Format numbers into Brazilian Reais (R$) locally
function formatBRL(value) {
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  }).format(value);
}

// Helper to check if extension context is valid
function isContextValid() {
  return typeof chrome !== 'undefined' && chrome.runtime && !!chrome.runtime.id;
}

// Fetch values from storage and update DOM
function updateWidgetFromStorage() {
  if (!isContextValid()) return;
  chrome.storage.local.get([
    'exchangeRate',
    'sessionLimit',
    'weeklyLimit',
    'weeklyUsage',
    'currentModel',
    'sessionTokens',
    'currentUser',
    'apiSessionPct',
    'apiWeeklyPct'
  ], (data) => {
    if (!widgetContainer) return;

    const rate = data.exchangeRate || 5.15;
    const sessionLimit = data.sessionLimit || 200000;
    const weeklyLimit = data.weeklyLimit || 5000000;
    const weeklyTokens = (data.weeklyUsage && data.weeklyUsage.amount) || 0;
    const session = data.sessionTokens || { input: 0, output: 0, total: 0 };
    const model = data.currentModel || 'claude-3-5-sonnet';
    const user = data.currentUser || { name: 'Claude User', email: '', photoUrl: '', plan: 'Free Plan' };

    // Update Profile Info
    const avatarImg = document.getElementById('tm-user-avatar');
    const badgeAvatarImg = document.getElementById('tm-badge-avatar');
    const defaultAvatar = 'https://www.gravatar.com/avatar/00000000000000000000000000000000?d=mp&f=y';
    const userPhoto = user.photoUrl || defaultAvatar;

    if (avatarImg) avatarImg.src = userPhoto;
    if (badgeAvatarImg) badgeAvatarImg.src = userPhoto;

    const displayName = document.getElementById('tm-display-name');
    const displayEmail = document.getElementById('tm-display-email');
    const planBadge = document.getElementById('tm-plan-badge');

    if (displayName) displayName.textContent = user.name || 'Claude User';
    if (displayEmail) {
      displayEmail.textContent = user.email || '';
      displayEmail.style.display = user.email ? 'block' : 'none';
    }
    if (planBadge) {
      planBadge.textContent = user.plan || 'Free Plan';
      if (user.plan === 'Free Plan') {
        planBadge.style.background = 'linear-gradient(135deg, #4b5563, #374151)';
        planBadge.style.boxShadow = 'none';
      } else {
        planBadge.style.background = 'var(--accent-gradient)';
        planBadge.style.boxShadow = '0 2px 8px rgba(139, 92, 246, 0.3)';
      }
    }

    // Update Model Badge
    const activeModel = document.getElementById('tm-active-model');
    if (activeModel && typeof getRatesForModel === 'function') {
      activeModel.textContent = getRatesForModel(model).name;
    } else if (activeModel) {
      // Fallback if rates helper not loaded yet
      activeModel.textContent = model.replace(/^claude-/, 'Claude ');
    }

    // Calculate Percentages (prioritize official API values)
    const sessionPct = (typeof data.apiSessionPct === 'number') 
      ? Math.round(data.apiSessionPct) 
      : Math.min(100, Math.round((session.total / sessionLimit) * 100));

    const weeklyPct = (typeof data.apiWeeklyPct === 'number') 
      ? Math.round(data.apiWeeklyPct) 
      : Math.min(100, Math.round((weeklyTokens / weeklyLimit) * 100));

    // Update Session DOM
    const sessionPctEl = document.getElementById('tm-session-pct');
    const sessionProgress = document.getElementById('tm-session-progress');
    const sessionTxt = document.getElementById('tm-session-tokens-txt');

    if (sessionPctEl) sessionPctEl.textContent = `${sessionPct}%`;
    if (sessionProgress) {
      sessionProgress.style.width = `${sessionPct}%`;
      // Clear previous styles
      sessionProgress.className = 'tm-progress-bar';
      if (sessionPct >= 80) {
        sessionProgress.classList.add('high');
      } else if (sessionPct >= 50) {
        sessionProgress.classList.add('medium');
      }
    }
    if (sessionTxt) {
      sessionTxt.textContent = `${session.total.toLocaleString()} / ${(sessionLimit / 1000).toFixed(0)}k tokens`;
    }

    // Update Weekly DOM
    const weeklyPctEl = document.getElementById('tm-weekly-pct');
    const weeklyProgress = document.getElementById('tm-weekly-progress');
    const weeklyTxt = document.getElementById('tm-weekly-tokens-txt');

    if (weeklyPctEl) weeklyPctEl.textContent = `${weeklyPct}%`;
    if (weeklyProgress) {
      weeklyProgress.style.width = `${weeklyPct}%`;
      weeklyProgress.className = 'tm-progress-bar';
      if (weeklyPct >= 80) {
        weeklyProgress.classList.add('high');
      } else if (weeklyPct >= 50) {
        weeklyProgress.classList.add('medium');
      }
    }
    if (weeklyTxt) {
      const mbFormat = (weeklyLimit / 1000000).toFixed(1);
      weeklyTxt.textContent = `${weeklyTokens.toLocaleString()} / ${mbFormat}M tokens`;
    }

    // Update circular progress badge
    const badgeProgress = document.getElementById('tm-badge-circle-progress');
    const avatarRing = document.getElementById('tm-avatar-ring');
    if (badgeProgress) {
      // Circumference is 148
      const offset = 148 - (148 * sessionPct) / 100;
      badgeProgress.style.strokeDashoffset = offset;
      
      badgeProgress.className = 'tm-badge-circle-progress';
      if (avatarRing) avatarRing.className = 'tm-avatar-ring';

      if (sessionPct >= 80) {
        badgeProgress.classList.add('high');
        if (avatarRing) avatarRing.classList.add('high');
      } else if (sessionPct >= 50) {
        badgeProgress.classList.add('medium');
        if (avatarRing) avatarRing.classList.add('medium');
      }
    }

    // Calculate Costs
    let usdSpend = 0;
    if (typeof calculateUSDSpend === 'function') {
      usdSpend = calculateUSDSpend(model, session.input, session.output);
    } else {
      // Inline fallback calculation if utils.js isn't fully ready
      const rateInput = model.includes('opus') ? 15.00 : 3.00;
      const rateOutput = model.includes('opus') ? 75.00 : 15.00;
      usdSpend = ((session.input / 1000000) * rateInput) + ((session.output / 1000000) * rateOutput);
    }
    const brlSpend = usdSpend * rate;

    const sessionCost = document.getElementById('tm-session-cost');
    const sessionCostUsd = document.getElementById('tm-session-cost-usd');

    if (sessionCost) sessionCost.textContent = formatBRL(brlSpend);
    if (sessionCostUsd) {
      sessionCostUsd.textContent = `$${usdSpend.toFixed(4)} USD • Cotação: R$ ${rate.toFixed(2)}`;
    }
  });
}

// Receive messages from MAIN world window.postMessage
window.addEventListener('message', (event) => {
  if (!isContextValid()) return;

  const msg = event.data;
  if (!msg || typeof msg !== 'object') return;

  // Verify it is one of our specific token tracker events
  const validTypes = [
    'CLAUDE_ME_RECEIVED',
    'CLAUDE_ORG_RECEIVED',
    'CLAUDE_CHAT_LOADED',
    'CLAUDE_COMPLETION_FINISHED',
    'CLAUDE_USAGE_RECEIVED'
  ];
  if (!validTypes.includes(msg.type)) return;


  switch (msg.type) {
    case 'CLAUDE_ME_RECEIVED':
      chrome.runtime.sendMessage({ type: 'UPDATE_ME', data: msg.data }, (response) => {
        updateWidgetFromStorage();
      });
      break;

    case 'CLAUDE_ORG_RECEIVED':
      chrome.storage.local.get(['currentUser'], (result) => {
        const currentUser = result.currentUser || {};
        currentUser.plan = msg.data.plan;
        currentUser.orgName = msg.data.orgName;
        chrome.runtime.sendMessage({ type: 'UPDATE_ME', data: currentUser }, () => {
          updateWidgetFromStorage();
        });
      });
      break;

    case 'CLAUDE_USAGE_RECEIVED':
      chrome.runtime.sendMessage({ type: 'UPDATE_USAGE', data: msg.data }, () => {
        updateWidgetFromStorage();
      });
      break;

    case 'CLAUDE_CHAT_LOADED':
      chrome.runtime.sendMessage({
        type: 'UPDATE_CONVERSATION',
        data: {
          sessionTokens: msg.data.sessionTokens,
          activeConversationUuid: msg.data.conversationUuid
        }
      }, () => {
        chrome.runtime.sendMessage({ type: 'UPDATE_MODEL', data: msg.data.model }, () => {
          updateWidgetFromStorage();
        });
      });
      break;

    case 'CLAUDE_COMPLETION_FINISHED':
      chrome.runtime.sendMessage({
        type: 'ADD_COMPLETION_TOKENS',
        data: {
          inputTokens: msg.data.inputTokens,
          outputTokens: msg.data.outputTokens,
          model: msg.data.model
        }
      }, () => {
        updateWidgetFromStorage();
      });
      break;
  }
});

// Update the floating widget if the settings are updated from options/popup
if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.onChanged) {
  chrome.storage.onChanged.addListener((changes, area) => {
    if (!isContextValid()) return;
    if (area === 'local') {
      updateWidgetFromStorage();
    }
  });
}

// Toggle widget expanded/collapsed state
function toggleWidgetPanel() {
  const panel = document.getElementById('tm-widget-panel');
  const badge = document.getElementById('tm-widget-badge');
  if (!panel || !badge) return;

  isExpanded = !isExpanded;
  if (isExpanded) {
    panel.classList.add('open');
    badge.style.display = 'none';
  } else {
    panel.classList.remove('open');
    badge.style.display = 'flex';
  }
}

// Check if keyboard event matches configured shortcut format (e.g. "Ctrl+Shift+K")
function eventMatchesHotkey(event, hotkeyStr) {
  if (!hotkeyStr) return false;
  const parts = hotkeyStr.split('+').map(p => p.trim().toLowerCase());
  
  const hasCtrl = parts.includes('ctrl');
  const hasAlt = parts.includes('alt');
  const hasShift = parts.includes('shift');
  const hasMeta = parts.includes('meta');

  const mainKeyPart = parts.find(p => !['ctrl', 'alt', 'shift', 'meta'].includes(p));
  if (!mainKeyPart) return false;

  if (event.ctrlKey !== hasCtrl) return false;
  if (event.altKey !== hasAlt) return false;
  if (event.shiftKey !== hasShift) return false;
  if (event.metaKey !== hasMeta) return false;

  let key = event.key.toLowerCase();
  if (key === ' ') key = 'space';
  return key === mainKeyPart;
}

// Window keydown listener for widget hotkey
window.addEventListener('keydown', (event) => {
  // If user is typing in a text field, do not trigger the hotkey toggle
  const tag = event.target.tagName.toLowerCase();
  if (tag === 'input' || tag === 'textarea' || event.target.isContentEditable) {
    return;
  }
  if (!isContextValid()) return;

  chrome.storage.local.get(['widgetHotkey'], (data) => {
    if (!isContextValid()) return;
    const hotkey = data.widgetHotkey || 'Alt+Shift+K';
    if (eventMatchesHotkey(event, hotkey)) {
      event.preventDefault();
      event.stopPropagation();
      toggleWidgetPanel();
    }
  });
});

