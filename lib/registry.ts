// Server-side tool registry — includes execute() functions.
// Swap the simulated bodies for real API calls when you have keys.

import { CATALOG, type CatalogTool } from "./catalog";

export interface RegistryTool extends CatalogTool {
  // JSON Schema for the tool's input (used by LLM tool-calling)
  schema: Record<string, unknown>;
  execute: (input: Record<string, unknown>) => Promise<unknown>;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function simulate(name: string, latencyMs = 120) {
  return async (input: Record<string, unknown>): Promise<unknown> => {
    await new Promise(r => setTimeout(r, latencyMs));
    return { tool: name, input, result: `[simulated output from ${name}]`, timestamp: Date.now() };
  };
}

// ─── Registry ─────────────────────────────────────────────────────────────────

export const REGISTRY: Record<string, RegistryTool> = {
  web_search: {
    ...CATALOG.find(t => t.name === "web_search")!,
    schema: {
      type: "object",
      properties: { query: { type: "string", description: "Search query" } },
      required: ["query"],
    },
    execute: async (input) => {
      // Real: const res = await fetch(`https://api.search.brave.com/res/v1/web/search?q=${input.query}`, {
      //   headers: { "X-Subscription-Token": process.env.BRAVE_API_KEY! }
      // }); return res.json();
      return simulate("web_search")(input);
    },
  },

  scrape_url: {
    ...CATALOG.find(t => t.name === "scrape_url")!,
    schema: {
      type: "object",
      properties: { url: { type: "string", description: "URL to scrape" } },
      required: ["url"],
    },
    execute: async (input) => {
      // Real: const res = await fetch("https://api.firecrawl.dev/v0/scrape", {
      //   method: "POST", headers: { Authorization: `Bearer ${process.env.FIRECRAWL_API_KEY}` },
      //   body: JSON.stringify({ url: input.url })
      // }); return res.json();
      return simulate("scrape_url")(input);
    },
  },

  vector_search: {
    ...CATALOG.find(t => t.name === "vector_search")!,
    schema: {
      type: "object",
      properties: {
        query:     { type: "string" },
        namespace: { type: "string", description: "Pinecone namespace" },
        topK:      { type: "number", default: 5 },
      },
      required: ["query"],
    },
    execute: simulate("vector_search"),
  },

  code_interpreter: {
    ...CATALOG.find(t => t.name === "code_interpreter")!,
    schema: {
      type: "object",
      properties: { code: { type: "string", description: "Python code to execute" } },
      required: ["code"],
    },
    execute: async (input) => {
      // Real: import { Sandbox } from "@e2b/code-interpreter";
      // const sbx = await Sandbox.create(); const result = await sbx.runCode(input.code as string);
      // await sbx.kill(); return result;
      return simulate("code_interpreter", 800)(input);
    },
  },

  bash_execute: {
    ...CATALOG.find(t => t.name === "bash_execute")!,
    schema: {
      type: "object",
      properties: { command: { type: "string", description: "Shell command to run" } },
      required: ["command"],
    },
    execute: simulate("bash_execute", 400),
  },

  llm_fast: {
    ...CATALOG.find(t => t.name === "llm_fast")!,
    schema: {
      type: "object",
      properties: {
        prompt:    { type: "string" },
        maxTokens: { type: "number", default: 512 },
      },
      required: ["prompt"],
    },
    execute: async (input) => {
      // Real: const anthropic = new Anthropic();
      // return anthropic.messages.create({ model: "claude-haiku-4-5-20251001",
      //   max_tokens: input.maxTokens as number ?? 512,
      //   messages: [{ role: "user", content: input.prompt as string }] });
      return simulate("llm_fast", 300)(input);
    },
  },

  llm_balanced: {
    ...CATALOG.find(t => t.name === "llm_balanced")!,
    schema: {
      type: "object",
      properties: {
        prompt:    { type: "string" },
        maxTokens: { type: "number", default: 1024 },
      },
      required: ["prompt"],
    },
    execute: async (input) => {
      // Real: model: "claude-sonnet-4-6"
      return simulate("llm_balanced", 600)(input);
    },
  },

  llm_ultra: {
    ...CATALOG.find(t => t.name === "llm_ultra")!,
    schema: {
      type: "object",
      properties: {
        prompt:    { type: "string" },
        maxTokens: { type: "number", default: 2048 },
      },
      required: ["prompt"],
    },
    execute: async (input) => {
      // Real: model: "claude-opus-4-7"
      return simulate("llm_ultra", 1200)(input);
    },
  },

  market_summary:     { ...CATALOG.find(t => t.name === "market_summary")!,     schema: { type: "object", properties: { sector: { type: "string" } } }, execute: simulate("market_summary") },
  risk_analysis:      { ...CATALOG.find(t => t.name === "risk_analysis")!,      schema: { type: "object", properties: { context: { type: "string" } } }, execute: simulate("risk_analysis") },
  roi_model:          { ...CATALOG.find(t => t.name === "roi_model")!,           schema: { type: "object", properties: { scenario: { type: "string" } } }, execute: simulate("roi_model") },
  deep_insight:       { ...CATALOG.find(t => t.name === "deep_insight")!,        schema: { type: "object", properties: { topic: { type: "string" } } }, execute: simulate("deep_insight", 600) },
  sentiment_analysis: { ...CATALOG.find(t => t.name === "sentiment_analysis")!, schema: { type: "object", properties: { text: { type: "string" } } }, execute: simulate("sentiment_analysis", 80) },
  image_gen:          { ...CATALOG.find(t => t.name === "image_gen")!,           schema: { type: "object", properties: { prompt: { type: "string" } } }, execute: simulate("image_gen", 2000) },
};

export function getTools(names: string[]): RegistryTool[] {
  return names.map(n => REGISTRY[n]).filter(Boolean);
}
