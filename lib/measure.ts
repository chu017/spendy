// Actual cost measurement — call this AFTER a tool runs, not before.
// Replace hardcoded estimates with real post-hoc costs where possible.

export interface TokenUsage {
  inputTokens: number;
  outputTokens: number;
}

// Anthropic pricing per million tokens (as of 2026)
const TOKEN_PRICING: Record<string, { input: number; output: number }> = {
  "claude-haiku-4-5-20251001": { input: 0.80,  output: 4.00  },
  "claude-sonnet-4-6":         { input: 3.00,  output: 15.00 },
  "claude-opus-4-7":           { input: 15.00, output: 75.00 },
};

/**
 * Calculate real LLM cost from token usage returned by the API.
 * Pass the `usage` object from an Anthropic messages.create() response.
 */
export function measureLLMCost(
  model: string,
  usage: TokenUsage
): number {
  const pricing = TOKEN_PRICING[model];
  if (!pricing) return 0;
  return (
    (usage.inputTokens  / 1_000_000) * pricing.input +
    (usage.outputTokens / 1_000_000) * pricing.output
  );
}

/**
 * Rough estimate before calling an LLM — useful for budget pre-checks.
 * Assumes 500 input tokens and 200 output tokens as a baseline.
 */
export function estimateLLMCost(
  model: string,
  estimatedInputTokens = 500,
  estimatedOutputTokens = 200
): number {
  return measureLLMCost(model, {
    inputTokens: estimatedInputTokens,
    outputTokens: estimatedOutputTokens,
  });
}

/**
 * Wraps any async tool call and measures wall-clock time + returns cost.
 * For non-LLM tools, cost is the catalog fixed price.
 */
export async function measureToolCall<T>(
  fixedCost: number,
  fn: () => Promise<T>
): Promise<{ result: T; cost: number; durationMs: number }> {
  const start = Date.now();
  const result = await fn();
  return {
    result,
    cost: fixedCost,
    durationMs: Date.now() - start,
  };
}

/**
 * Running budget tracker — use this in the agent loop.
 */
export function createBudgetTracker(initialBudget: number) {
  let remaining = initialBudget;
  const ledger: { tool: string; cost: number; timestamp: number }[] = [];

  return {
    canAfford: (cost: number) => remaining >= cost,

    deduct: (tool: string, cost: number) => {
      if (remaining < cost) throw new Error(`Budget exceeded: need ${cost}, have ${remaining}`);
      remaining -= cost;
      ledger.push({ tool, cost, timestamp: Date.now() });
    },

    get remaining() { return remaining; },
    get spent()     { return initialBudget - remaining; },
    get ledger()    { return [...ledger]; },

    summary: () => ({
      budget:    initialBudget,
      spent:     initialBudget - remaining,
      remaining,
      utilisation: `${((1 - remaining / initialBudget) * 100).toFixed(1)}%`,
      calls:     ledger.length,
    }),
  };
}
