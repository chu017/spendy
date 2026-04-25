export interface Tool {
  name: string;
  cost: number;
  value: number;
  description: string;
}

export const TOOLS: Tool[] = [
  {
    name: "risk_analysis",
    cost: 0.003,
    value: 0.7,
    description: "Identifies and quantifies risks in the given scenario using historical patterns",
  },
  {
    name: "roi_model",
    cost: 0.004,
    value: 0.9,
    description: "Projects return on investment with multi-variable financial modelling",
  },
  {
    name: "market_summary",
    cost: 0.002,
    value: 0.5,
    description: "Summarises current market conditions and sector-level trends",
  },
  {
    name: "deep_insight",
    cost: 0.008,
    value: 1.0,
    description: "Full-context deep analysis combining all signals for maximum quality output",
  },
];
