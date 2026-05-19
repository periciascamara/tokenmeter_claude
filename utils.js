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

// Export functions if running in Node, otherwise keep global for extension scripts
if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    estimateTokens,
    MODEL_RATES,
    getRatesForModel,
    calculateUSDSpend,
    formatBRL
  };
}
