// Tool catalog — metadata only, safe to import in client components.
// Execute functions live in lib/registry.ts (server-side).

export type ToolCategory = "search" | "compute" | "llm" | "analysis" | "media" | "data";

export interface CatalogTool {
  name: string;
  label: string;
  description: string;
  cost: number;        // USD per call (estimated)
  value: number;       // 0–1 quality contribution
  provider: string;
  providerUrl: string;
  category: ToolCategory;
  pricingNote: string;
}

export const CATALOG: CatalogTool[] = [
  // ── Search ───────────────────────────────────────────────────────────────
  {
    name: "web_search",
    label: "Web Search",
    description: "Search the live web for current information and news.",
    cost: 0.003,
    value: 0.70,
    provider: "Brave Search",
    providerUrl: "https://brave.com/search/api/",
    category: "search",
    pricingNote: "$3 / 1 000 queries",
  },
  {
    name: "scrape_url",
    label: "URL Scraper",
    description: "Extract clean Markdown content from any web page.",
    cost: 0.002,
    value: 0.60,
    provider: "Firecrawl",
    providerUrl: "https://firecrawl.dev",
    category: "search",
    pricingNote: "$2 / 1 000 pages",
  },
  {
    name: "vector_search",
    label: "Vector Search",
    description: "Semantic similarity search over a knowledge base.",
    cost: 0.001,
    value: 0.50,
    provider: "Pinecone",
    providerUrl: "https://pinecone.io",
    category: "search",
    pricingNote: "$0.10 / 1M reads",
  },

  // ── Compute ──────────────────────────────────────────────────────────────
  {
    name: "code_interpreter",
    label: "Code Interpreter",
    description: "Execute Python in a sandboxed environment and return output.",
    cost: 0.010,
    value: 0.95,
    provider: "E2B",
    providerUrl: "https://e2b.dev",
    category: "compute",
    pricingNote: "$0.01 / sandbox second",
  },
  {
    name: "bash_execute",
    label: "Bash Execute",
    description: "Run shell commands on ephemeral cloud containers.",
    cost: 0.005,
    value: 0.80,
    provider: "Modal",
    providerUrl: "https://modal.com",
    category: "compute",
    pricingNote: "$0.0006 / CPU-second",
  },

  // ── LLM ──────────────────────────────────────────────────────────────────
  {
    name: "llm_fast",
    label: "LLM (Fast)",
    description: "Quick language model call — summaries, extraction, classification.",
    cost: 0.002,
    value: 0.60,
    provider: "Claude Haiku 4.5",
    providerUrl: "https://anthropic.com",
    category: "llm",
    pricingNote: "$0.80 / 1M input tokens",
  },
  {
    name: "llm_balanced",
    label: "LLM (Balanced)",
    description: "Mid-tier reasoning — analysis, drafting, Q&A.",
    cost: 0.008,
    value: 0.85,
    provider: "Claude Sonnet 4.6",
    providerUrl: "https://anthropic.com",
    category: "llm",
    pricingNote: "$3 / 1M input tokens",
  },
  {
    name: "llm_ultra",
    label: "LLM (Ultra)",
    description: "Maximum reasoning — complex strategy, code, multi-step plans.",
    cost: 0.020,
    value: 1.00,
    provider: "Claude Opus 4.7",
    providerUrl: "https://anthropic.com",
    category: "llm",
    pricingNote: "$15 / 1M input tokens",
  },

  // ── Analysis (simulation tools from the demo) ─────────────────────────
  {
    name: "market_summary",
    label: "Market Summary",
    description: "Summarises current market conditions and sector-level trends.",
    cost: 0.002,
    value: 0.50,
    provider: "Simulated",
    providerUrl: "#",
    category: "analysis",
    pricingNote: "demo tool",
  },
  {
    name: "risk_analysis",
    label: "Risk Analysis",
    description: "Identifies and quantifies risks using historical patterns.",
    cost: 0.003,
    value: 0.70,
    provider: "Simulated",
    providerUrl: "#",
    category: "analysis",
    pricingNote: "demo tool",
  },
  {
    name: "roi_model",
    label: "ROI Model",
    description: "Projects return on investment with multi-variable modelling.",
    cost: 0.004,
    value: 0.90,
    provider: "Simulated",
    providerUrl: "#",
    category: "analysis",
    pricingNote: "demo tool",
  },
  {
    name: "deep_insight",
    label: "Deep Insight",
    description: "Full-context deep analysis combining all available signals.",
    cost: 0.008,
    value: 1.00,
    provider: "Simulated",
    providerUrl: "#",
    category: "analysis",
    pricingNote: "demo tool",
  },
  {
    name: "sentiment_analysis",
    label: "Sentiment Analysis",
    description: "Detect tone and sentiment across text corpora.",
    cost: 0.001,
    value: 0.45,
    provider: "AWS Comprehend",
    providerUrl: "https://aws.amazon.com/comprehend/",
    category: "analysis",
    pricingNote: "$0.0001 / unit",
  },

  // ── Media ────────────────────────────────────────────────────────────────
  {
    name: "image_gen",
    label: "Image Generation",
    description: "Generate images from text prompts at production quality.",
    cost: 0.004,
    value: 0.60,
    provider: "fal.ai",
    providerUrl: "https://fal.ai",
    category: "media",
    pricingNote: "$0.004 / image",
  },
];

export const CATEGORIES: { id: ToolCategory | "all"; label: string }[] = [
  { id: "all",      label: "All"      },
  { id: "search",   label: "Search"   },
  { id: "llm",      label: "LLM"      },
  { id: "compute",  label: "Compute"  },
  { id: "analysis", label: "Analysis" },
  { id: "media",    label: "Media"    },
];

export const CATEGORY_COLOR: Record<ToolCategory, { bg: string; text: string }> = {
  search:   { bg: "#dbeafe", text: "#1d4ed8" },
  compute:  { bg: "#fce7f3", text: "#9d174d" },
  llm:      { bg: "#ede9fe", text: "#5b21b6" },
  analysis: { bg: "#dcfce7", text: "#166534" },
  media:    { bg: "#ffedd5", text: "#9a3412" },
  data:     { bg: "#f0fdf4", text: "#15803d" },
};
