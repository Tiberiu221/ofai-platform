/**
 * LLM Configuration for Review Summarization
 * 
 * This file centralizes all LLM-related settings for Claude integration.
 * It provides default values and loads from environment variables.
 */

require('dotenv').config();

const LLM_CONFIG = {
  // Anthropic API Configuration
  apiKey: process.env.ANTHROPIC_API_KEY,
  
  // Model Selection
  // Available models:
  // - claude-3-haiku-20240307 (fastest, cheapest - $0.25/$1.25 per 1M tokens)
  // - claude-3-sonnet-20240229 (balanced - $3/$15 per 1M tokens)
  // - claude-3-opus-20240229 (most capable - $15/$75 per 1M tokens)
  model: process.env.LLM_MODEL || 'claude-3-haiku-20240307',
  
  // Generation Parameters
  maxTokens: parseInt(process.env.LLM_MAX_TOKENS) || 300,
  
  // Temperature: Controls randomness (0.0 = deterministic, 1.0 = creative)
  // For summaries, we want consistency, so keep it low (0.2-0.4)
  temperature: parseFloat(process.env.LLM_TEMPERATURE) || 0.3,
  
  // Retry Configuration (for handling rate limits and transient errors)
  retry: {
    maxAttempts: 3,
    initialDelayMs: 1000,  // 1 second
    maxDelayMs: 10000,     // 10 seconds
    backoffMultiplier: 2   // Exponential backoff: 1s, 2s, 4s, 8s...
  },
  
  // Review Summarization Settings
  summarization: {
    // Minimum number of reviews required to generate a summary
    minReviewCount: 3,
    
    // Maximum number of reviews to include in the prompt (to control costs)
    // We'll use the most recent ones
    maxReviewsInPrompt: 10,
    
    // Character limit for individual review comments (to prevent huge prompts)
    maxReviewCommentLength: 500,
    
    // Cache invalidation: regenerate summary after N new reviews
    regenerateAfterNewReviews: 3
  },
  
  // Cost Tracking
  costs: {
    inputCostPerMillionTokens: 0.25,   // $0.25 per 1M input tokens (Haiku)
    outputCostPerMillionTokens: 1.25   // $1.25 per 1M output tokens (Haiku)
  }
};

/**
 * Validates that all required configuration is present
 * @throws {Error} If critical configuration is missing
 */
function validateConfig() {
  if (!LLM_CONFIG.apiKey) {
    throw new Error(
      'ANTHROPIC_API_KEY is not set. Please add it to your .env file.\n' +
      'Get your API key from: https://console.anthropic.com/'
    );
  }
  
  if (LLM_CONFIG.temperature < 0 || LLM_CONFIG.temperature > 1) {
    throw new Error('LLM_TEMPERATURE must be between 0.0 and 1.0');
  }
  
  if (LLM_CONFIG.maxTokens < 50 || LLM_CONFIG.maxTokens > 4096) {
    throw new Error('LLM_MAX_TOKENS must be between 50 and 4096');
  }
}

/**
 * Calculates the estimated cost for a given token usage
 * @param {number} inputTokens - Number of input tokens
 * @param {number} outputTokens - Number of output tokens
 * @returns {number} Estimated cost in USD
 */
function calculateCost(inputTokens, outputTokens) {
  const inputCost = (inputTokens / 1_000_000) * LLM_CONFIG.costs.inputCostPerMillionTokens;
  const outputCost = (outputTokens / 1_000_000) * LLM_CONFIG.costs.outputCostPerMillionTokens;
  return inputCost + outputCost;
}

module.exports = {
  LLM_CONFIG,
  validateConfig,
  calculateCost
};
