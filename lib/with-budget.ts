// withBudget — drop this around any agent function to add budget constraints.
//
// Usage:
//   const result = await withBudget(myAgentFn, {
//     budget: 0.02,
//     tools: [REGISTRY.web_search, REGISTRY.llm_balanced],
//   });

import { REGISTRY, type RegistryTool } from "./registry";
import { createBudgetTracker } from "./measure";

export interface BudgetOptions {
  budget: number;
  tools: RegistryTool[];
  /** What to do when a tool call would exceed the budget. Default: "skip" */
  onExceeded?: "skip" | "error";
  /** Called after each successful tool execution. */
  onToolCall?: (name: string, cost: number, remaining: number) => void;
}

export interface BudgetContext {
  /** Execute a tool by name. Throws/skips if budget is exhausted. */
  call: (toolName: string, input?: Record<string, unknown>) => Promise<unknown>;
  /** Check whether a specific tool is still affordable. */
  canAfford: (toolName: string) => boolean;
  /** Current remaining budget in USD. */
  remaining: () => number;
  /** Total spent so far in USD. */
  spent: () => number;
  /** List of available (affordable) tools at plan time. */
  availableTools: RegistryTool[];
}

export interface BudgetRunResult<T> {
  result: T | null;
  spent: number;
  remaining: number;
  calls: { tool: string; cost: number; durationMs: number; skipped: boolean }[];
  error?: string;
}

/**
 * Wraps an agent function with budget-aware tool execution.
 *
 * @param fn     Your agent logic — receives a BudgetContext, returns a result.
 * @param options Budget, tool list, and overflow behaviour.
 */
export async function withBudget<T>(
  fn: (ctx: BudgetContext) => Promise<T>,
  options: BudgetOptions
): Promise<BudgetRunResult<T>> {
  const tracker = createBudgetTracker(options.budget);
  const callLog: BudgetRunResult<T>["calls"] = [];

  // Pre-select affordable tools (greedy by score)
  const scored = options.tools
    .map(t => ({ ...t, score: t.value / t.cost }))
    .sort((a, b) => b.score - a.score);

  let budgetLeft = options.budget;
  const available: RegistryTool[] = [];
  for (const t of scored) {
    if (budgetLeft >= t.cost) {
      available.push(t);
      budgetLeft -= t.cost;
    }
  }

  const ctx: BudgetContext = {
    availableTools: available,
    remaining: () => tracker.remaining,
    spent:     () => tracker.spent,

    canAfford: (name) => {
      const tool = REGISTRY[name] ?? options.tools.find(t => t.name === name);
      return tool ? tracker.canAfford(tool.cost) : false;
    },

    call: async (name, input = {}) => {
      const tool = REGISTRY[name] ?? options.tools.find(t => t.name === name);
      if (!tool) throw new Error(`Tool "${name}" not found in registry`);

      if (!tracker.canAfford(tool.cost)) {
        const entry = { tool: name, cost: tool.cost, durationMs: 0, skipped: true };
        callLog.push(entry);
        if (options.onExceeded === "error") {
          throw new Error(`Budget exhausted: cannot afford "${name}" ($${tool.cost})`);
        }
        return null; // skip
      }

      const start = Date.now();
      const result = await tool.execute(input);
      const durationMs = Date.now() - start;

      tracker.deduct(name, tool.cost);
      callLog.push({ tool: name, cost: tool.cost, durationMs, skipped: false });
      options.onToolCall?.(name, tool.cost, tracker.remaining);

      return result;
    },
  };

  try {
    const result = await fn(ctx);
    return { result, spent: tracker.spent, remaining: tracker.remaining, calls: callLog };
  } catch (err) {
    return {
      result: null,
      spent: tracker.spent,
      remaining: tracker.remaining,
      calls: callLog,
      error: err instanceof Error ? err.message : String(err),
    };
  }
}
