// Claude.ai TokenMeter Utilities

// A robust BPE-like heuristic for estimating tokens (optimized for Portuguese, English, and code)
function estimateTokens(text) {
  if (!text || typeof text !== 'string') return 0;
  
  const charCount = text.length;
  // Split by whitespace to count words
  const words = text.trim().split(/\s+/);
  const wordCount = words.length === 1 && words[0] === '' ? 0 : words.length;
  
  // Count special characters which typically count as 1 token each in code/syntax
  const specialChars = (text.match(/[{}[\]()\;.,+=<>!&|?~`\-*\/%^:\n]/g) || []).length;
  
  // Advanced heuristic balancing character length, word count, and code elements
  const estimate = Math.ceil(Math.max(
    charCount / 3.8,
    wordCount * 1.3 + specialChars * 0.5
  ));
  
  return Math.max(1, estimate);
}

// Default pricing rates (USD per 1,000,000 tokens)
const MODEL_RATES = {
  'claude-3-5-sonnet': { input: 3.00, output: 15.00, name: 'Claude 3.5 Sonnet' },
  'claude-3-opus': { input: 15.00, output: 75.00, name: 'Claude 3 Opus' },
  'claude-3-5-haiku': { input: 0.80, output: 4.00, name: 'Claude 3.5 Haiku' },
  'claude-3-haiku': { input: 0.25, output: 1.25, name: 'Claude 3 Haiku' },
  'claude-2': { input: 8.00, output: 24.00, name: 'Claude 2' }
};

// Returns standard rate structure matching a model name
function getRatesForModel(modelId) {
  if (!modelId) return MODEL_RATES['claude-3-5-sonnet'];
  
  const idLower = modelId.toLowerCase();
  for (const [key, rates] of Object.entries(MODEL_RATES)) {
    if (idLower.includes(key)) {
      return rates;
    }
  }
  
  // Default fallback to 3.5 Sonnet if unknown
  return { 
    input: 3.00, 
    output: 15.00, 
    name: modelId.replace(/^claude-/, 'Claude ') 
  };
}

// Calculate the cost of the session in USD based on input/output token counts
function calculateUSDSpend(modelId, inputTokens, outputTokens) {
  const rates = getRatesForModel(modelId);
  const inputCost = (inputTokens / 1000000) * rates.input;
  const outputCost = (outputTokens / 1000000) * rates.output;
  return inputCost + outputCost;
}

// Format numbers into Brazilian Reais (R$)
function formatBRL(value) {
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
    minimumFractionDigits: 2,
    maximumFractionDigits: 4
  }).format(value);
}

// Format reset time/dates into user friendly strings
function formatResetTime(timeVal) {
  if (!timeVal) return '';
  try {
    let dateInput = timeVal;
    
    // Support numeric UNIX timestamps (seconds vs milliseconds)
    const num = Number(timeVal);
    if (!isNaN(num)) {
      if (num < 100000000000) { 
        dateInput = num * 1000;
      } else {
        dateInput = num;
      }
    }
    
    const resetDate = new Date(dateInput);
    if (isNaN(resetDate.getTime())) return '';
    
    const now = new Date();
    const diffMs = resetDate.getTime() - now.getTime();
    if (diffMs <= 0) return 'Reinício iminente';

    // Check if it resets today
    const isToday = resetDate.getDate() === now.getDate() && 
                    resetDate.getMonth() === now.getMonth() && 
                    resetDate.getFullYear() === now.getFullYear();

    // Check if tomorrow
    const tomorrow = new Date(now);
    tomorrow.setDate(tomorrow.getDate() + 1);
    const isTomorrow = resetDate.getDate() === tomorrow.getDate() && 
                       resetDate.getMonth() === tomorrow.getMonth() && 
                       resetDate.getFullYear() === tomorrow.getFullYear();

    const hours = String(resetDate.getHours()).padStart(2, '0');
    const minutes = String(resetDate.getMinutes()).padStart(2, '0');

    if (isToday) {
      return `Reinicia hoje às ${hours}:${minutes}`;
    } else if (isTomorrow) {
      return `Reinicia amanhã às ${hours}:${minutes}`;
    } else {
      const days = ['dom', 'seg', 'ter', 'qua', 'qui', 'sex', 'sáb'];
      const dayName = days[resetDate.getDay()];
      const day = String(resetDate.getDate()).padStart(2, '0');
      const month = String(resetDate.getMonth() + 1).padStart(2, '0');
      return `Reinicia ${dayName}., ${day}/${month} às ${hours}:${minutes}`;
    }
  } catch (e) {
    return '';
  }
}

// Export functions if running in Node, otherwise keep global for extension scripts
if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    estimateTokens,
    MODEL_RATES,
    getRatesForModel,
    calculateUSDSpend,
    formatBRL,
    formatResetTime
  };
}

