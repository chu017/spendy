// Anthropic tool-use adapter for Spendy.
// Works with @anthropic-ai/sdk — install it separately:
//   npm install @anthropic-ai/sdk
//
// Usage:
//   import Anthropic from "@anthropic-ai/sdk";
//   import { SpendyAnthropicAdapter } from "@/lib/adapters/anthropic";
//
//   const client = new Anthropic();
//   const agent  = new SpendyAnthropicAdapter(client, {
//     budget: 0.02,
//     tools: [REGISTRY.web_search, REGISTRY.llm_fast],
//     model: "claude-sonnet-4-6",
//   });
//
//   const { content, spent } = await agent.run("Summarise the EV market landscape");

import { createBudgetTracker, measureLLMCost } from "../measure";
import { type RegistryTool } from "../registry";

// Minimal types that match @anthropic-ai/sdk without importing it
interface TextBlock   { type: "text";     text: string }
interface ToolUseBlock { type: "tool_use"; id: string; name: string; input: Record<string, unknown> }
type ContentBlock = TextBlock | ToolUseBlock;

interface AnthropicMessage {
  content: ContentBlock[];
  stop_reason: string;
  usage?: { input_tokens: number; output_tokens: number };
}

interface AnthropicClient {
  messages: {
    create: (params: {
      model: string;
      max_tokens: number;
      tools: unknown[];
      messages: unknown[];
    }) => Promise<AnthropicMessage>;
  };
}

export interface AdapterOptions {
  budget: number;
  tools: RegistryTool[];
  model?: string;
  maxTokens?: number;
  /** Max agentic loop iterations (safety cap). Default 10. */
  maxIterations?: number;
  onToolCall?: (name: string, cost: number, remaining: number) => void;
}

export interface AdapterResult {
  content: string;
  spent: number;
  remaining: number;
  iterations: number;
  toolCalls: { name: string; cost: number; skipped: boolean }[];
}

export class SpendyAnthropicAdapter {
  private client: AnthropicClient;
  private options: Required<AdapterOptions>;

  constructor(client: AnthropicClient, options: AdapterOptions) {
    this.client  = client;
    this.options = {
      model:         "claude-sonnet-4-6",
      maxTokens:     1024,
      maxIterations: 10,
      onToolCall:    () => {},
      ...options,
    };
  }

  async run(task: string): Promise<AdapterResult> {
    const tracker  = createBudgetTracker(this.options.budget);
    const toolLog: AdapterResult["toolCalls"] = [];
    const messages: unknown[] = [{ role: "user", content: task }];

    // Convert registry tools → Anthropic tool format
    const anthropicTools = this.options.tools.map(t => ({
      name:         t.name,
      description:  `${t.description} (cost: $${t.cost.toFixed(3)})`,
      input_schema: t.schema,
    }));

    let iterations = 0;
    let finalText  = "";

    while (iterations < this.options.maxIterations) {
      iterations++;

      const response = await this.client.messages.create({
        model:      this.options.model,
        max_tokens: this.options.maxTokens,
        tools:      anthropicTools,
        messages,
      });

      // Deduct LLM cost if usage metadata is present
      if (response.usage) {
        const llmCost = measureLLMCost(this.options.model, {
          inputTokens:  response.usage.input_tokens,
          outputTokens: response.usage.output_tokens,
        });
        if (tracker.canAfford(llmCost)) tracker.deduct("llm_call", llmCost);
      }

      // Collect text output
      for (const block of response.content) {
        if (block.type === "text") finalText = block.text;
      }

      // Done — no more tool calls
      if (response.stop_reason === "end_turn") break;

      // Process tool_use blocks
      const toolResults: unknown[] = [];
      for (const block of response.content) {
        if (block.type !== "tool_use") continue;

        const tool = this.options.tools.find(t => t.name === block.name);
        if (!tool) continue;

        if (!tracker.canAfford(tool.cost)) {
          // Budget exhausted — tell the model
          toolLog.push({ name: block.name, cost: tool.cost, skipped: true });
          toolResults.push({
            type:        "tool_result",
            tool_use_id: block.id,
            content:     `Skipped: budget exhausted (need $${tool.cost.toFixed(3)}, remaining $${tracker.remaining.toFixed(4)})`,
          });
          continue;
        }

        const result = await tool.execute(block.input);
        tracker.deduct(block.name, tool.cost);
        toolLog.push({ name: block.name, cost: tool.cost, skipped: false });
        this.options.onToolCall(block.name, tool.cost, tracker.remaining);

        toolResults.push({
          type:        "tool_result",
          tool_use_id: block.id,
          content:     JSON.stringify(result),
        });
      }

      messages.push({ role: "assistant", content: response.content });
      messages.push({ role: "user",      content: toolResults });
    }

    return {
      content:    finalText,
      spent:      tracker.spent,
      remaining:  tracker.remaining,
      iterations,
      toolCalls:  toolLog,
    };
  }
}
