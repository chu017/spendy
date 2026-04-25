import { TOOLS, Tool } from "./tools";

export interface ToolPlan extends Tool {
  score: number;
  selected: boolean;
  skipReason?: string;
}

export type QualityLevel = "none" | "low" | "medium" | "high" | "maximum";

export interface AgentPlan {
  selected: ToolPlan[];
  skipped: ToolPlan[];
  trace: string[];
  totalCost: number;
  remainingBudget: number;
  qualityLevel: QualityLevel;
}

const QUALITY: Record<number, QualityLevel> = {
  0: "none",
  1: "low",
  2: "medium",
  3: "high",
  4: "maximum",
};

export function runAgent(task: string, budget: number): AgentPlan {
  const scored: ToolPlan[] = TOOLS.map((t) => ({
    ...t,
    score: t.value / t.cost,
    selected: false,
  }));

  // Greedy: sort by efficiency score descending
  scored.sort((a, b) => b.score - a.score);

  let remaining = budget;
  const selected: ToolPlan[] = [];
  const skipped: ToolPlan[] = [];
  const trace: string[] = [];

  trace.push(`Task: "${task}"`);
  trace.push(`Budget allocated: $${budget.toFixed(4)}`);
  trace.push(`Evaluating ${scored.length} tools by score (value ÷ cost)...`);

  for (const tool of scored) {
    if (remaining >= tool.cost) {
      tool.selected = true;
      remaining -= tool.cost;
      selected.push(tool);
      trace.push(
        `✔ ${tool.name} → executed ($${tool.cost.toFixed(3)}, score ${tool.score.toFixed(0)})`
      );
    } else {
      tool.selected = false;
      tool.skipReason = `need $${tool.cost.toFixed(3)}, only $${remaining.toFixed(4)} left`;
      skipped.push(tool);
      trace.push(
        `✖ ${tool.name} → skipped (${tool.skipReason})`
      );
    }
  }

  const totalCost = budget - remaining;
  trace.push(`Done. Total spent: $${totalCost.toFixed(4)} · Remaining: $${remaining.toFixed(4)}`);

  return {
    selected,
    skipped,
    trace,
    totalCost,
    remainingBudget: remaining,
    qualityLevel: QUALITY[selected.length] ?? "none",
  };
}
