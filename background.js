// Claude.ai TokenMeter Background Service Worker
importScripts('utils.js');

// Initialize settings on install
chrome.runtime.onInstalled.addListener(() => {
  chrome.storage.local.get([
    'exchangeRate',
    'sessionLimit',
    'weeklyLimit',
    'weeklyUsage',
    'currentModel',
    'sessionTokens',
    'currentUser'
  ], (result) => {
    const defaults = {
      exchangeRate: 5.15,
      sessionLimit: 200000,
      weeklyLimit: 5000000,
      weeklyUsage: { amount: 0, lastReset: Date.now() },
      currentModel: 'claude-3-5-sonnet',
      sessionTokens: { input: 0, output: 0, total: 0 },
      currentUser: { name: 'Claude User', email: '', photoUrl: '', plan: 'Free Plan' }
    };

    const toSet = {};
    for (const [key, val] of Object.entries(defaults)) {
      if (result[key] === undefined) {
        toSet[key] = val;
      }
    }

    if (Object.keys(toSet).length > 0) {
      chrome.storage.local.set(toSet);
    }
  });
});

// Periodic check for weekly reset
function checkWeeklyReset(weeklyUsage) {
  const now = Date.now();
  const sevenDaysMs = 7 * 24 * 60 * 60 * 1000;
  if (!weeklyUsage || !weeklyUsage.lastReset || (now - weeklyUsage.lastReset) >= sevenDaysMs) {
    return { amount: 0, lastReset: now };
  }
  return weeklyUsage;
}

// Listen for messages from content scripts
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type === 'UPDATE_ME') {
    chrome.storage.local.set({ currentUser: message.data });
    sendResponse({ status: 'ok' });
  } 
  
  else if (message.type === 'UPDATE_CONVERSATION') {
    const { sessionTokens, activeConversationUuid, messages } = message.data;
    
    // We update session tokens
    chrome.storage.local.set({ 
      sessionTokens, 
      activeConversationUuid 
    });

    // Check if we need to add tokens to the weekly usage
    // To avoid double-counting, we can track which messages we've already counted for the weekly usage in storage.
    // Or we can track completion actions. Intercepting POST completions is the most robust way to count new tokens.
    sendResponse({ status: 'ok' });
  } 
  
  else if (message.type === 'ADD_COMPLETION_TOKENS') {
    const { inputTokens, outputTokens, model } = message.data;
    
    chrome.storage.local.get(['weeklyUsage', 'sessionTokens'], (result) => {
      let weekly = checkWeeklyReset(result.weeklyUsage);
      
      const newTokens = inputTokens + outputTokens;
      weekly.amount += newTokens;

      // Update current session tokens as well
      const session = result.sessionTokens || { input: 0, output: 0, total: 0 };
      session.input += inputTokens;
      session.output += outputTokens;
      session.total = session.input + session.output;

      chrome.storage.local.set({
        weeklyUsage: weekly,
        sessionTokens: session,
        currentModel: model || 'claude-3-5-sonnet'
      });
    });
    sendResponse({ status: 'ok' });
  } 
  
  else if (message.type === 'UPDATE_MODEL') {
    chrome.storage.local.set({ currentModel: message.data });
    sendResponse({ status: 'ok' });
  }

  else if (message.type === 'UPDATE_USAGE') {
    const data = message.data;
    chrome.storage.local.get(['weeklyLimit', 'weeklyUsage'], (res) => {
      const weeklyLimit = res.weeklyLimit || 5000000;
      const utilization5h = (data && data.five_hour) ? data.five_hour.utilization : 0;
      const utilization7d = (data && data.seven_day) ? data.seven_day.utilization : 0;
      
      const resetsAt5h = (data && data.five_hour) ? data.five_hour.resets_at : null;
      const resetsAt7d = (data && data.seven_day) ? data.seven_day.resets_at : null;
      
      const updatedWeeklyAmount = Math.round((utilization7d / 100) * weeklyLimit);
      const weeklyUsage = res.weeklyUsage || { amount: 0, lastReset: Date.now() };
      weeklyUsage.amount = updatedWeeklyAmount;

      chrome.storage.local.set({
        apiSessionPct: utilization5h,
        apiWeeklyPct: utilization7d,
        apiSessionResetsAt: resetsAt5h,
        apiWeeklyResetsAt: resetsAt7d,
        weeklyUsage: weeklyUsage
      }, () => {
        sendResponse({ status: 'ok' });
      });
    });
    return true;
  }

  return true; // Keep message channel open for async response
});
