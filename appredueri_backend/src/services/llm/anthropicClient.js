/**
 * Anthropic Claude API Client with Retry Logic
 * 
 * This module wraps the Anthropic SDK and adds:
 * - Exponential backoff retry for rate limits
 * - Error handling and logging
 * - Cost tracking
 */

const Anthropic = require('@anthropic-ai/sdk');
const { LLM_CONFIG, validateConfig, calculateCost } = require('../../config/llm');

// Validate configuration on module load
validateConfig();

// Initialize Anthropic client
const anthropic = new Anthropic({
  apiKey: LLM_CONFIG.apiKey,
});

/**
 * Sleep utility for retry delays
 * @param {number} ms - Milliseconds to sleep
 * @returns {Promise<void>}
 */
function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Calls Claude API with exponential backoff retry logic
 * 
 * @param {Object} params - API parameters
 * @param {string} params.system - System prompt (sets AI personality)
 * @param {Array<Object>} params.messages - User messages
 * @param {number} [params.max_tokens] - Max tokens to generate
 * @param {number} [params.temperature] - Temperature (0-1)
 * @returns {Promise<Object>} API response with usage stats
 * 
 * @example
 * const response = await callClaudeWithRetry({
 *   system: "You are a helpful assistant.",
 *   messages: [{ role: "user", content: "Hello!" }],
 *   max_tokens: 100,
 *   temperature: 0.7
 * });
 * console.log(response.content[0].text); // "Hello! How can I help you today?"
 */
async function callClaudeWithRetry(params) {
  const { maxAttempts, initialDelayMs, maxDelayMs, backoffMultiplier } = LLM_CONFIG.retry;
  
  let lastError;
  
  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    try {
      const startTime = Date.now();
      
      // Call Claude API
      const response = await anthropic.messages.create({
        model: params.model || LLM_CONFIG.model,
        max_tokens: params.max_tokens || LLM_CONFIG.maxTokens,
        temperature: params.temperature ?? LLM_CONFIG.temperature,
        system: params.system,
        messages: params.messages,
      });
      
      const duration = Date.now() - startTime;
      
      // Calculate cost
      const cost = calculateCost(
        response.usage.input_tokens,
        response.usage.output_tokens
      );
      
      // Log success (in production, you might want to use a proper logger)
      console.log(`[LLM] Claude API call successful:`, {
        attempt: attempt + 1,
        duration: `${duration}ms`,
        input_tokens: response.usage.input_tokens,
        output_tokens: response.usage.output_tokens,
        total_tokens: response.usage.input_tokens + response.usage.output_tokens,
        cost: `$${cost.toFixed(6)}`,
        model: params.model || LLM_CONFIG.model
      });
      
      // Return response with additional metadata
      return {
        ...response,
        metadata: {
          duration_ms: duration,
          cost_usd: cost,
          attempt: attempt + 1
        }
      };
      
    } catch (error) {
      lastError = error;
      
      // Check if it's a rate limit error (429)
      const isRateLimitError = 
        error.status === 429 || 
        error.error?.type === 'rate_limit_error';
      
      // Check if it's a retryable error
      const isRetryable = 
        isRateLimitError || 
        error.status === 500 || 
        error.status === 503 ||
        error.code === 'ECONNRESET' ||
        error.code === 'ETIMEDOUT';
      
      // If not retryable or last attempt, throw immediately
      if (!isRetryable || attempt === maxAttempts - 1) {
        console.error(`[LLM] Claude API call failed (attempt ${attempt + 1}/${maxAttempts}):`, {
          status: error.status,
          type: error.error?.type,
          message: error.message,
          retryable: isRetryable
        });
        throw error;
      }
      
      // Calculate delay with exponential backoff
      const delay = Math.min(
        initialDelayMs * Math.pow(backoffMultiplier, attempt),
        maxDelayMs
      );
      
      console.warn(`[LLM] Claude API call failed (attempt ${attempt + 1}/${maxAttempts}), retrying in ${delay}ms:`, {
        status: error.status,
        type: error.error?.type,
        message: error.message
      });
      
      await sleep(delay);
    }
  }
  
  // Should never reach here, but just in case
  throw lastError;
}

/**
 * Formats an error for user-friendly display
 * @param {Error} error - The error object
 * @returns {Object} Formatted error info
 */
function formatError(error) {
  if (error.status === 401) {
    return {
      code: 'AUTH_ERROR',
      message: 'Invalid API key. Please check your ANTHROPIC_API_KEY.',
      userMessage: 'Configurare API incorectă. Contactați administratorul.'
    };
  }
  
  if (error.status === 429) {
    return {
      code: 'RATE_LIMIT',
      message: 'Rate limit exceeded. Too many requests.',
      userMessage: 'Sistem temporar suprasolicitat. Încercați din nou în câteva minute.'
    };
  }
  
  if (error.status === 500 || error.status === 503) {
    return {
      code: 'API_ERROR',
      message: 'Anthropic API is experiencing issues.',
      userMessage: 'Serviciu AI temporar indisponibil. Încercați din nou mai târziu.'
    };
  }
  
  return {
    code: 'UNKNOWN_ERROR',
    message: error.message || 'Unknown error occurred',
    userMessage: 'Eroare la generarea rezumatului. Încercați din nou.'
  };
}

module.exports = {
  callClaudeWithRetry,
  formatError,
  anthropic // Export for advanced use cases
};
