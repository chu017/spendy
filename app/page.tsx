"use client";

import { useState, useCallback, useRef } from "react";
import { CATALOG, CATEGORIES, CATEGORY_COLOR, type CatalogTool, type ToolCategory } from "@/lib/catalog";

// ─── Types ────────────────────────────────────────────────────────────────────

interface ToolPlan {
  name: string;
  cost: number;
  value: number;
  score: number;
  selected: boolean;
  skipReason?: string;
  description: string;
}

interface AgentPlan {
  selected: ToolPlan[];
  skipped: ToolPlan[];
  trace: string[];
  totalCost: number;
  remainingBudget: number;
  qualityLevel: "none" | "low" | "medium" | "high" | "maximum";
}

interface RecentRun {
  budget: number;
  quality: AgentPlan["qualityLevel"];
  cost: number;
  toolCount: number;
}

type Phase = "idle" | "planning" | "executing" | "done";

// ─── Static data ──────────────────────────────────────────────────────────────

const BASE_TOOLS = [
  { name: "market_summary", cost: 0.002, value: 0.5, description: "Summarises market conditions & trends",      score: 250 },
  { name: "risk_analysis",  cost: 0.003, value: 0.7, description: "Identifies and quantifies scenario risks",   score: 233 },
  { name: "roi_model",      cost: 0.004, value: 0.9, description: "Projects ROI with financial modelling",      score: 225 },
  { name: "deep_insight",   cost: 0.008, value: 1.0, description: "Full-context deep analytical synthesis",     score: 125 },
];

const PRESETS = [
  { label: "Baseline",  sublabel: "Intelligence", budget: 0.003 },
  { label: "Moderate",  sublabel: "Intelligence", budget: 0.007 },
  { label: "High",      sublabel: "Quality",      budget: 0.013 },
  { label: "Max",       sublabel: "Quality",      budget: 0.02  },
];

// Quality thresholds for chart (budget → normalised quality 0-1)
const QUALITY_CURVE: [number, number][] = [
  [0.001, 0], [0.002, 0.25], [0.005, 0.5], [0.009, 0.75], [0.017, 1], [0.02, 1],
];

const QUALITY_CFG = {
  none:    { label: "No Analysis",     stars: 0, color: "#94a3b8", light: "#f1f5f9", badge: "#e2e8f0" },
  low:     { label: "Low Quality",     stars: 1, color: "#ef4444", light: "#fef2f2", badge: "#fecaca" },
  medium:  { label: "Medium Quality",  stars: 2, color: "#f59e0b", light: "#fffbeb", badge: "#fde68a" },
  high:    { label: "High Quality",    stars: 3, color: "#10b981", light: "#ecfdf5", badge: "#a7f3d0" },
  maximum: { label: "Maximum Quality", stars: 4, color: "#6366f1", light: "#eef2ff", badge: "#c7d2fe" },
};

// ─── Utils ────────────────────────────────────────────────────────────────────

const fmt      = (n: number) => `$${n.toFixed(4)}`;
const fmtShort = (n: number) => `$${n.toFixed(3)}`;
const mono     = "var(--font-geist-mono)";
function humanName(s: string) {
  return s.replace(/_/g, " ").replace(/\b\w/g, c => c.toUpperCase());
}

// ─── Sidebar ──────────────────────────────────────────────────────────────────

type AppView = "run" | "library";

function Sidebar({
  todaySpend, runCount, view, setView,
}: {
  todaySpend: number; runCount: number; view: AppView; setView: (v: AppView) => void;
}) {
  const nav: { icon: string; label: string; id: AppView | null }[] = [
    { icon: "▣", label: "Dashboard",    id: "run"     },
    { icon: "◫", label: "Tool Library", id: "library" },
    { icon: "◎", label: "Settings",     id: null      },
  ];

  // Fake sparkline data that grows with todaySpend
  const sparks = [0.002, 0.004, 0.003, 0.006, 0.005, 0.008, todaySpend || 0.004];
  const maxS   = Math.max(...sparks, 0.01);
  const W = 100, H = 28;
  const pts = sparks
    .map((v, i) => `${(i / (sparks.length - 1)) * W},${H - (v / maxS) * H}`)
    .join(" ");

  return (
    <aside className="w-[210px] shrink-0 border-r border-slate-200 bg-white flex flex-col h-screen sticky top-0 overflow-hidden">
      {/* Logo */}
      <div className="px-4 py-4 border-b border-slate-100 flex items-center gap-2.5">
        <div className="w-7 h-7 rounded-lg bg-indigo-600 flex items-center justify-center text-white text-sm font-bold">S</div>
        <div>
          <p className="text-sm font-bold text-slate-800 leading-none">Spendy</p>
          <p className="text-[9px] text-slate-400 mt-0.5 leading-none">Budget-Constrained Agent</p>
        </div>
      </div>

      {/* Nav */}
      <nav className="px-3 py-3 space-y-0.5">
        {nav.map(n => {
          const active = n.id === view;
          return (
            <div
              key={n.label}
              onClick={() => n.id && setView(n.id)}
              className="flex items-center gap-2.5 px-2.5 py-1.5 rounded-lg text-[13px] cursor-pointer transition-colors select-none"
              style={active ? { background: "#eef2ff", color: "#4338ca", fontWeight: 600 } : { color: "#64748b" }}
            >
              <span className="text-base leading-none">{n.icon}</span>
              {n.label}
            </div>
          );
        })}
      </nav>

      {/* Today's spend */}
      <div className="mx-3 mt-2 rounded-xl border border-slate-200 bg-slate-50 p-3">
        <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-400 mb-0.5">Today&apos;s Spend</p>
        <p className="text-xl font-bold text-slate-800" style={{ fontFamily: mono }}>{fmt(todaySpend)}</p>
        <p className="text-[10px] text-slate-400 mb-2">{runCount} run{runCount !== 1 ? "s" : ""} this session</p>
        <svg width={W} height={H} viewBox={`0 0 ${W} ${H}`} className="w-full">
          <defs>
            <linearGradient id="sg" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#6366f1" stopOpacity="0.15" />
              <stop offset="100%" stopColor="#6366f1" stopOpacity="0" />
            </linearGradient>
          </defs>
          <polygon
            points={`0,${H} ${pts} ${W},${H}`}
            fill="url(#sg)"
          />
          <polyline points={pts} fill="none" stroke="#6366f1" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </div>

      {/* Info box */}
      <div className="mx-3 mt-3 rounded-xl border border-indigo-100 bg-indigo-50 p-3">
        <p className="text-[11px] font-semibold text-indigo-700 mb-1">Higher budget = Higher intelligence</p>
        <p className="text-[10px] text-indigo-500 leading-relaxed">
          Each tool has a cost. The agent picks the best tools it can afford.
        </p>
      </div>

      {/* Footer */}
      <div className="mt-auto px-4 py-3 border-t border-slate-100">
        <div className="flex items-center gap-2">
          <div className="w-6 h-6 rounded-full bg-indigo-100 flex items-center justify-center text-[10px] font-bold text-indigo-600">C</div>
          <div>
            <p className="text-[11px] font-medium text-slate-700">Spendy Demo</p>
            <p className="text-[9px] text-slate-400">Hackathon MVP</p>
          </div>
        </div>
      </div>
    </aside>
  );
}

// ─── Tool Card ────────────────────────────────────────────────────────────────

function ToolCard({ tool, delay = 0 }: { tool: ToolPlan; delay?: number }) {
  const sel = tool.selected;
  return (
    <div
      className="animate-scale-in rounded-xl border p-4 bg-white relative"
      style={{ animationDelay: `${delay}ms`, borderColor: sel ? "#bbf7d0" : "#fecaca" }}
    >
      <div className="flex items-start justify-between mb-2">
        <p className="text-[13px] font-bold text-slate-800">{humanName(tool.name)}</p>
        <span
          className="text-[10px] font-semibold px-2 py-0.5 rounded-full shrink-0 ml-2"
          style={sel
            ? { background: "#dcfce7", color: "#16a34a" }
            : { background: "#fee2e2", color: "#dc2626" }}
        >
          {sel ? "✔ Executed" : "✖ Skipped"}
        </span>
      </div>

      <p className="text-[11px] text-slate-400 mb-3">{tool.description}</p>

      <div className="flex gap-1.5 flex-wrap">
        <Chip label="cost"  value={fmtShort(tool.cost)}        color="#3b82f6" />
        <Chip label="value" value={tool.value.toFixed(1)}       color="#a855f7" />
        <Chip
          label="score"
          value={tool.score.toFixed(0)}
          color="#f59e0b"
          tooltip={`score = value(${tool.value}) ÷ cost(${tool.cost}) = ${(tool.value / tool.cost).toFixed(1)}`}
        />
      </div>

      {!sel && tool.skipReason && (
        <p className="mt-2 text-[10px] text-red-400" style={{ fontFamily: mono }}>
          ↳ {tool.skipReason}
        </p>
      )}
    </div>
  );
}

function Chip({ label, value, color, tooltip }: { label: string; value: string; color: string; tooltip?: string }) {
  return (
    <span
      className="inline-flex items-center gap-1 text-[11px] rounded-md px-1.5 py-0.5"
      style={{ background: `${color}18`, color, fontFamily: mono }}
      title={tooltip}
    >
      <span style={{ opacity: 0.6 }}>{label}</span>
      <span style={{ fontWeight: 700 }}>{value}</span>
      {tooltip && <span style={{ opacity: 0.4, fontSize: 9 }}>ⓘ</span>}
    </span>
  );
}

// ─── Trace line ───────────────────────────────────────────────────────────────

function TraceLine({ line, index }: { line: string; index: number }) {
  const ok   = line.startsWith("✔");
  const skip = line.startsWith("✖");
  const color = ok ? "#16a34a" : skip ? "#dc2626" : "#94a3b8";
  return (
    <div
      className="animate-slide-in-left flex items-start gap-2 py-0.5"
      style={{ animationDelay: `${index * 20}ms`, color, fontFamily: mono, fontSize: 12 }}
    >
      <span style={{ opacity: 0.35, minWidth: 18, textAlign: "right", marginTop: 1, fontSize: 10 }}>{index + 1}</span>
      <span>{line}</span>
    </div>
  );
}

// ─── Value Breakdown bar chart ────────────────────────────────────────────────

function ValueBreakdown({ plan, budget }: { plan: AgentPlan | null; budget: number }) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-4">
      <p className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider mb-3">Value Breakdown</p>
      <div className="space-y-2">
        {BASE_TOOLS.map(tool => {
          const planTool = plan
            ? [...plan.selected, ...plan.skipped].find(t => t.name === tool.name)
            : null;
          const executed = planTool?.selected ?? false;
          const pct      = (tool.cost / budget) * 100;
          return (
            <div key={tool.name}>
              <div className="flex justify-between text-[11px] mb-0.5">
                <span className="text-slate-600">{humanName(tool.name)}</span>
                <span style={{ fontFamily: mono, color: executed ? "#16a34a" : "#94a3b8" }}>
                  {fmtShort(tool.cost)}
                </span>
              </div>
              <div className="h-1.5 rounded-full bg-slate-100 overflow-hidden">
                <div
                  className="h-full rounded-full transition-all duration-500"
                  style={{
                    width: `${Math.min(pct, 100)}%`,
                    background: executed ? "#6366f1" : "#e2e8f0",
                  }}
                />
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ─── Quality vs Budget SVG chart ──────────────────────────────────────────────

function QualityChart({ currentBudget }: { currentBudget: number }) {
  const W = 420, H = 110, ML = 40, MB = 28, MT = 10, MR = 10;
  const cW = W - ML - MR, cH = H - MB - MT;

  const bMin = 0.001, bMax = 0.02;
  const xOf  = (b: number) => ML + ((b - bMin) / (bMax - bMin)) * cW;
  const yOf  = (q: number) => MT + (1 - q) * cH;

  // Build smooth polyline
  const points = QUALITY_CURVE.map(([b, q]) => `${xOf(b)},${yOf(q)}`).join(" ");
  const area   = `${xOf(bMin)},${yOf(0)} ${points} ${xOf(bMax)},${yOf(0)}`;

  const cx = xOf(currentBudget);
  // Interpolate quality at currentBudget
  let cq = 0;
  for (let i = 0; i < QUALITY_CURVE.length - 1; i++) {
    const [b0, q0] = QUALITY_CURVE[i];
    const [b1, q1] = QUALITY_CURVE[i + 1];
    if (currentBudget >= b0 && currentBudget <= b1) {
      cq = q0 + ((currentBudget - b0) / (b1 - b0)) * (q1 - q0);
      break;
    }
    if (currentBudget > b1) cq = q1;
  }
  const cy = yOf(cq);

  const xTicks = [0.002, 0.005, 0.009, 0.013, 0.017, 0.02];

  return (
    <div className="rounded-xl border border-slate-200 bg-white p-4">
      <p className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider mb-3">
        Quality vs Budget
        <span className="ml-2 text-[10px] font-normal text-slate-400">how far your budget goes</span>
      </p>
      <svg width="100%" viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="xMidYMid meet">
        <defs>
          <linearGradient id="qg" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%"   stopColor="#6366f1" stopOpacity="0.15" />
            <stop offset="100%" stopColor="#6366f1" stopOpacity="0.01" />
          </linearGradient>
        </defs>

        {/* Grid lines */}
        {[0, 0.25, 0.5, 0.75, 1].map(q => (
          <line
            key={q}
            x1={ML} y1={yOf(q)} x2={ML + cW} y2={yOf(q)}
            stroke="#f1f5f9" strokeWidth="1"
          />
        ))}

        {/* Area fill */}
        <polygon points={area} fill="url(#qg)" />

        {/* Curve */}
        <polyline
          points={points}
          fill="none"
          stroke="#6366f1"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          className="animate-draw-line"
          style={{ strokeDasharray: 1000 }}
        />

        {/* Current budget marker */}
        <line x1={cx} y1={MT} x2={cx} y2={MT + cH} stroke="#6366f1" strokeWidth="1" strokeDasharray="3,2" opacity="0.5" />
        <circle cx={cx} cy={cy} r="4" fill="#6366f1" stroke="white" strokeWidth="2" />

        {/* Y labels */}
        {[{ q: 0, l: "None" }, { q: 0.5, l: "Med" }, { q: 1, l: "Max" }].map(({ q, l }) => (
          <text key={l} x={ML - 4} y={yOf(q) + 3.5} textAnchor="end" fontSize="9" fill="#94a3b8">{l}</text>
        ))}

        {/* X ticks */}
        {xTicks.map(b => (
          <text key={b} x={xOf(b)} y={H - 4} textAnchor="middle" fontSize="9" fill="#94a3b8" style={{ fontFamily: mono }}>
            {fmtShort(b)}
          </text>
        ))}
      </svg>
    </div>
  );
}

// ─── Stars ────────────────────────────────────────────────────────────────────

function Stars({ count, total = 4 }: { count: number; total?: number }) {
  return (
    <div className="flex gap-0.5">
      {Array.from({ length: total }, (_, i) => (
        <span key={i} style={{ color: i < count ? "#f59e0b" : "#e2e8f0", fontSize: 16 }}>★</span>
      ))}
    </div>
  );
}

// ─── Tool Library view ───────────────────────────────────────────────────────

function ToolLibraryView() {
  const [activeCategory, setActiveCategory] = useState<ToolCategory | "all">("all");
  const [copied, setCopied] = useState<string | null>(null);

  const filtered = activeCategory === "all"
    ? CATALOG
    : CATALOG.filter(t => t.category === activeCategory);

  const copySnippet = (tool: CatalogTool) => {
    const snippet = `import { REGISTRY } from "@/lib/registry";\n\nconst result = await REGISTRY.${tool.name}.execute({ /* input */ });`;
    navigator.clipboard.writeText(snippet);
    setCopied(tool.name);
    setTimeout(() => setCopied(null), 1800);
  };

  const integrationSnippet = `import { withBudget } from "@/lib/with-budget";
import { REGISTRY } from "@/lib/registry";

const result = await withBudget(
  async (ctx) => {
    const search = await ctx.call("web_search", { query: task });
    const answer = await ctx.call("llm_balanced", { prompt: search });
    return answer;
  },
  {
    budget: 0.02,
    tools: [REGISTRY.web_search, REGISTRY.llm_balanced],
  }
);

console.log(result.spent, result.remaining);`;

  const adapterSnippet = `import Anthropic from "@anthropic-ai/sdk";
import { SpendyAnthropicAdapter } from "@/lib/adapters/anthropic";
import { REGISTRY } from "@/lib/registry";

const agent = new SpendyAnthropicAdapter(new Anthropic(), {
  budget: 0.02,
  tools: [REGISTRY.web_search, REGISTRY.llm_balanced],
  model: "claude-sonnet-4-6",
});

const { content, spent } = await agent.run("Summarise the EV market");`;

  return (
    <div className="space-y-5 animate-fade-in-up">
      {/* Category filter */}
      <div className="flex gap-2 flex-wrap">
        {CATEGORIES.map(c => (
          <button
            key={c.id}
            onClick={() => setActiveCategory(c.id)}
            className="text-xs px-3 py-1.5 rounded-full border cursor-pointer transition-all"
            style={activeCategory === c.id
              ? { background: "#6366f1", borderColor: "#6366f1", color: "#fff" }
              : { borderColor: "#e2e8f0", color: "#64748b" }}
          >
            {c.label}
            <span className="ml-1.5 opacity-50 text-[10px]">
              {c.id === "all" ? CATALOG.length : CATALOG.filter(t => t.category === c.id).length}
            </span>
          </button>
        ))}
      </div>

      {/* Tool grid */}
      <div className="grid grid-cols-2 xl:grid-cols-3 gap-3">
        {filtered.map((tool, i) => {
          const catColor = CATEGORY_COLOR[tool.category];
          const score    = +(tool.value / tool.cost).toFixed(0);
          return (
            <div
              key={tool.name}
              className="animate-scale-in rounded-xl border border-slate-200 bg-white p-4 flex flex-col gap-3"
              style={{ animationDelay: `${i * 40}ms` }}
            >
              <div className="flex items-start justify-between gap-2">
                <div>
                  <span
                    className="text-[10px] font-semibold px-2 py-0.5 rounded-full mb-1.5 inline-block"
                    style={{ background: catColor.bg, color: catColor.text }}
                  >
                    {tool.category}
                  </span>
                  <p className="text-[13px] font-bold text-slate-800">{tool.label}</p>
                  <p className="text-[11px] text-slate-400 mt-0.5">{tool.provider}</p>
                </div>
                <button
                  onClick={() => copySnippet(tool)}
                  className="shrink-0 text-[10px] px-2 py-1 rounded-lg border border-slate-200 text-slate-400 hover:border-indigo-300 hover:text-indigo-500 cursor-pointer transition-all"
                >
                  {copied === tool.name ? "✓" : "copy"}
                </button>
              </div>

              <p className="text-[11px] text-slate-500">{tool.description}</p>

              <div className="flex gap-1.5 flex-wrap mt-auto">
                <Chip label="cost"  value={fmtShort(tool.cost)} color="#3b82f6" />
                <Chip label="value" value={tool.value.toFixed(1)} color="#a855f7" />
                <Chip
                  label="score"
                  value={String(score)}
                  color="#f59e0b"
                  tooltip={`score = value(${tool.value}) ÷ cost(${tool.cost}) = ${score}`}
                />
              </div>

              <p className="text-[10px] text-slate-400 pt-1 border-t border-slate-100"
                 style={{ fontFamily: mono }}>
                {tool.pricingNote}
              </p>
            </div>
          );
        })}
      </div>

      {/* Integration code snippets */}
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
        <CodeCard title="withBudget — one-line wrapper" code={integrationSnippet} />
        <CodeCard title="SpendyAnthropicAdapter — drop into Claude tool-use" code={adapterSnippet} />
      </div>
    </div>
  );
}

function CodeCard({ title, code }: { title: string; code: string }) {
  const [copied, setCopied] = useState(false);
  const copy = () => {
    navigator.clipboard.writeText(code);
    setCopied(true);
    setTimeout(() => setCopied(false), 1800);
  };
  return (
    <div className="rounded-xl border border-slate-200 bg-white overflow-hidden">
      <div className="flex items-center justify-between px-4 py-2.5 border-b border-slate-100 bg-slate-50">
        <p className="text-[11px] font-semibold text-slate-600">{title}</p>
        <button
          onClick={copy}
          className="text-[10px] px-2.5 py-1 rounded-lg bg-white border border-slate-200 text-slate-400 hover:text-indigo-500 hover:border-indigo-300 cursor-pointer transition-all"
        >
          {copied ? "✓ copied" : "copy"}
        </button>
      </div>
      <pre
        className="p-4 text-[11px] leading-relaxed overflow-x-auto text-slate-700"
        style={{ fontFamily: mono }}
      >
        {code}
      </pre>
    </div>
  );
}

// ─── Main page ────────────────────────────────────────────────────────────────

export default function SpendyPage() {
  const [task, setTask]             = useState("Analyse an investment opportunity in the renewable energy sector");
  const [budget, setBudget]         = useState(0.008);
  const [view, setView]             = useState<AppView>("run");
  const [plan, setPlan]             = useState<AgentPlan | null>(null);
  const [phase, setPhase]           = useState<Phase>("idle");
  const [visibleTrace, setVisible]  = useState(0);
  const [recentRuns, setRecent]     = useState<RecentRun[]>([]);
  const [todaySpend, setTodaySpend] = useState(0);
  const [teardown, setTeardown]     = useState(false);

  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const callApi = useCallback(async (t: string, b: number): Promise<AgentPlan> => {
    const res  = await fetch("/api/run-agent", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ task: t, budget: b }),
    });
    const data = await res.json();
    return data.plan as AgentPlan;
  }, []);

  const runAgent = useCallback(async () => {
    if (timerRef.current) clearTimeout(timerRef.current);
    setPhase("planning");
    setPlan(null);
    setVisible(0);

    await new Promise(r => setTimeout(r, 700));
    setPhase("executing");

    const result = await callApi(task, budget);
    setPlan(result);

    setRecent(prev => [
      { budget, quality: result.qualityLevel, cost: result.totalCost, toolCount: result.selected.length },
      ...prev.slice(0, 4),
    ]);
    setTodaySpend(prev => prev + result.totalCost);

    let i = 0;
    const next = () => {
      i++;
      setVisible(i);
      if (i < result.trace.length) {
        timerRef.current = setTimeout(next, 155);
      } else {
        setPhase("done");
      }
    };
    next();
  }, [task, budget, callApi]);

  const isRunning    = phase === "planning" || phase === "executing";
  const allPlanTools = plan
    ? [...plan.selected, ...plan.skipped].sort((a, b) => b.score - a.score)
    : [];

  return (
    <div className="flex h-screen bg-slate-50 overflow-hidden" style={{ fontFamily: "var(--font-geist-sans)" }}>
      <Sidebar todaySpend={todaySpend} runCount={recentRuns.length} view={view} setView={setView} />

      {/* ── Main content ─────────────────────────────────────────────────────── */}
      <div className="flex-1 overflow-y-auto">
        {/* Header */}
        <header className="sticky top-0 z-10 bg-white border-b border-slate-200 px-6 py-3.5 flex items-center justify-between">
          <div>
            <h1 className="text-lg font-bold text-slate-900">
              {view === "run" ? "New Run" : "Tool Library"}
            </h1>
            <p className="text-xs text-slate-400 mt-0.5">
              {view === "run"
                ? "Enter your task, pick a budget — Spendy will take care of the rest"
                : `${CATALOG.length} tools available · real pricing · drop-in execute() stubs`}
            </p>
          </div>
          <div className="flex items-center gap-3">
            {/* Teardown mode toggle */}
            <button
              onClick={() => setTeardown(v => !v)}
              className="flex items-center gap-2 text-xs px-3 py-1.5 rounded-full border transition-all cursor-pointer"
              style={teardown
                ? { background: "#fef2f2", borderColor: "#fca5a5", color: "#dc2626" }
                : { borderColor: "#e2e8f0", color: "#64748b" }}
            >
              <span
                className="w-3 h-3 rounded-full border"
                style={teardown ? { background: "#dc2626", borderColor: "#dc2626" } : { borderColor: "#cbd5e1" }}
              />
              Teardown Mode
            </button>
            <div className="w-8 h-8 rounded-full bg-indigo-600 flex items-center justify-center text-white text-sm font-bold">
              C
            </div>
          </div>
        </header>

        <div className="p-6 space-y-5">
          {view === "library" && <ToolLibraryView />}
          {view === "run" && <div>
          {/* ── 3-column layout ───────────────────────────────────────────────── */}
          <div className="grid grid-cols-[270px_1fr_260px] gap-4 items-start">

            {/* ── LEFT: controls ─────────────────────────────────────────────── */}
            <div className="space-y-3">
              {/* Task */}
              <div className="rounded-xl border border-slate-200 bg-white p-4">
                <label className="text-[11px] font-semibold uppercase tracking-wider text-slate-400 block mb-2">Task</label>
                <textarea
                  value={task}
                  onChange={e => setTask(e.target.value)}
                  rows={3}
                  className="w-full text-sm text-slate-700 placeholder-slate-300 focus:outline-none resize-none"
                  placeholder="Describe the agent's task…"
                />
              </div>

              {/* Budget */}
              <div className="rounded-xl border border-slate-200 bg-white p-4">
                <div className="flex items-center justify-between mb-3">
                  <label className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">Budget</label>
                  <span className="text-xl font-bold text-indigo-600" style={{ fontFamily: mono }}>
                    {fmt(budget)}
                  </span>
                </div>
                <input
                  type="range" min="0.001" max="0.02" step="0.001"
                  value={budget}
                  onChange={e => setBudget(parseFloat(e.target.value))}
                  className="w-full cursor-pointer mb-1"
                  style={{ accentColor: "#6366f1" }}
                />
                <div className="flex justify-between text-[10px] text-slate-300" style={{ fontFamily: mono }}>
                  <span>$0.001</span><span>$0.020</span>
                </div>
              </div>

              {/* Intelligence presets */}
              <div className="rounded-xl border border-slate-200 bg-white p-4">
                <label className="text-[11px] font-semibold uppercase tracking-wider text-slate-400 block mb-2.5">
                  Intelligence Preference
                </label>
                <div className="grid grid-cols-2 gap-1.5">
                  {PRESETS.map(p => {
                    const active = budget === p.budget;
                    return (
                      <button
                        key={p.label}
                        onClick={() => setBudget(p.budget)}
                        className="rounded-lg border py-2 px-2 text-left cursor-pointer transition-all"
                        style={active
                          ? { borderColor: "#6366f1", background: "#eef2ff" }
                          : { borderColor: "#e2e8f0", background: "#f8fafc" }}
                      >
                        <p className="text-[12px] font-semibold" style={{ color: active ? "#4338ca" : "#475569" }}>
                          {p.label}
                        </p>
                        <p className="text-[10px]" style={{ color: active ? "#818cf8" : "#94a3b8" }}>
                          {p.sublabel}
                        </p>
                        <p className="text-[10px] mt-0.5 font-mono" style={{ color: active ? "#6366f1" : "#cbd5e1" }}>
                          {fmt(p.budget)}
                        </p>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Run button */}
              <button
                onClick={runAgent}
                disabled={isRunning || !task.trim()}
                className="w-full py-3 rounded-xl text-sm font-semibold transition-all cursor-pointer disabled:cursor-not-allowed"
                style={isRunning
                  ? { background: "#e2e8f0", color: "#94a3b8" }
                  : { background: "#6366f1", color: "#fff", boxShadow: "0 4px 16px rgba(99,102,241,0.3)" }}
              >
                {isRunning ? (
                  <span className="flex items-center justify-center gap-2">
                    <span className="w-3.5 h-3.5 rounded-full border-2 border-slate-300 border-t-slate-500 animate-spin" />
                    {phase === "planning" ? "Agent planning…" : "Executing…"}
                  </span>
                ) : "▶  Run Agent"}
              </button>

              <ValueBreakdown plan={plan} budget={budget} />
            </div>

            {/* ── CENTER: tool eval + trace ───────────────────────────────────── */}
            <div className="space-y-4">
              {/* Tool Evaluation */}
              <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
                <div className="flex items-center justify-between mb-3">
                  <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">
                    Tool Evaluation
                  </p>
                  <span className="text-[10px] text-slate-400">sorted by score · value ÷ cost</span>
                </div>

                {phase === "idle" && (
                  <div className="rounded-xl border border-dashed border-slate-200 bg-white py-12 text-center">
                    <p className="text-slate-300 text-3xl mb-2">⚡</p>
                    <p className="text-sm text-slate-400">Run the agent to see tool decisions</p>
                  </div>
                )}

                {phase === "planning" && (
                  <div
                    className="rounded-xl border border-indigo-100 bg-indigo-50 flex flex-col items-center justify-center py-12 animate-fade-in-up"
                  >
                    <div className="w-10 h-10 rounded-full border-4 border-indigo-200 border-t-indigo-500 animate-spin mb-3" />
                    <p className="font-semibold text-indigo-700">Agent planning…</p>
                    <p className="text-xs text-indigo-400 mt-1">
                      Budget: <span style={{ fontFamily: mono }}>{fmt(budget)}</span>
                    </p>
                  </div>
                )}

                {(phase === "executing" || phase === "done") && plan && (
                  <div className="grid grid-cols-2 gap-3">
                    {allPlanTools.map((tool, i) => (
                      <ToolCard key={tool.name} tool={tool} delay={i * 70} />
                    ))}
                  </div>
                )}
              </div>

              {/* Execution Trace */}
              {(phase === "executing" || phase === "done") && plan && (
                <div className="rounded-xl border border-slate-200 bg-white p-4">
                  <div className="flex items-center justify-between mb-3">
                    <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">Execution Trace</p>
                    <span className="text-[10px] text-slate-300">{plan.trace.length} lines</span>
                  </div>
                  <div className="space-y-0.5">
                    {plan.trace.slice(0, visibleTrace).map((line, i) => (
                      <TraceLine key={i} line={line} index={i} />
                    ))}
                    {phase === "executing" && (
                      <div className="flex items-center gap-2 pl-6 pt-1" style={{ color: "#94a3b8", fontSize: 12, fontFamily: mono }}>
                        <span className="w-1.5 h-1.5 rounded-full bg-indigo-400 animate-pulse-dot" />
                        processing…
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* Quality vs Budget chart */}
              <QualityChart currentBudget={budget} />
            </div>

            {/* ── RIGHT: execution summary + recent runs ─────────────────────── */}
            <div className="space-y-3">
              <div className="rounded-xl border border-slate-200 bg-white p-4">
                <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-400 mb-4">
                  Execution Summary
                </p>

                {!plan ? (
                  <p className="text-sm text-slate-300 text-center py-6">No run yet</p>
                ) : (
                  <>
                    {/* Stats row */}
                    <div className="grid grid-cols-2 gap-3 mb-4">
                      <div className="rounded-lg bg-slate-50 border border-slate-100 p-2.5">
                        <p className="text-[10px] text-slate-400 mb-0.5">Tools executed</p>
                        <p className="text-xl font-bold text-slate-800">
                          {plan.selected.length}
                          <span className="text-sm font-normal text-slate-400">/{plan.selected.length + plan.skipped.length}</span>
                        </p>
                      </div>
                      <div className="rounded-lg bg-slate-50 border border-slate-100 p-2.5">
                        <p className="text-[10px] text-slate-400 mb-0.5">Remaining</p>
                        <p className="text-xl font-bold text-indigo-600" style={{ fontFamily: mono }}>
                          {fmt(plan.remainingBudget)}
                        </p>
                      </div>
                    </div>

                    <div className="rounded-lg bg-slate-50 border border-slate-100 p-2.5 mb-4">
                      <p className="text-[10px] text-slate-400 mb-0.5">Total cost</p>
                      <p className="text-xl font-bold text-slate-800" style={{ fontFamily: mono }}>{fmt(plan.totalCost)}</p>
                    </div>

                    {/* Quality */}
                    <div className="mb-4">
                      <p className="text-[10px] text-slate-400 mb-1.5">Quality Attributes</p>
                      <div
                        className="rounded-lg border p-2.5 flex items-center gap-2.5"
                        style={{
                          borderColor: QUALITY_CFG[plan.qualityLevel].badge,
                          background: QUALITY_CFG[plan.qualityLevel].light,
                        }}
                      >
                        <Stars count={QUALITY_CFG[plan.qualityLevel].stars} />
                        <span
                          className="text-xs font-semibold"
                          style={{ color: QUALITY_CFG[plan.qualityLevel].color }}
                        >
                          {QUALITY_CFG[plan.qualityLevel].label}
                        </span>
                      </div>
                    </div>

                    {/* Budget utilisation */}
                    <div>
                      <div className="flex justify-between text-[10px] text-slate-400 mb-1">
                        <span>Budget utilisation</span>
                        <span style={{ fontFamily: mono }}>
                          {Math.min(100, ((plan.totalCost / budget) * 100)).toFixed(0)}%
                        </span>
                      </div>
                      <div className="h-2 rounded-full bg-slate-100">
                        <div
                          className="h-full rounded-full transition-all duration-700"
                          style={{
                            width: `${Math.min(100, (plan.totalCost / budget) * 100)}%`,
                            background: "#6366f1",
                          }}
                        />
                      </div>
                      <div className="flex justify-between text-[10px] mt-1" style={{ fontFamily: mono }}>
                        <span className="text-indigo-500">{fmt(plan.totalCost)} spent</span>
                        <span className="text-slate-300">{fmt(plan.remainingBudget)} left</span>
                      </div>
                    </div>
                  </>
                )}
              </div>

              {/* Recent runs */}
              <div className="rounded-xl border border-slate-200 bg-white p-4">
                <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-400 mb-3">Recent Runs</p>
                {recentRuns.length === 0 ? (
                  <p className="text-xs text-slate-300 text-center py-3">No runs yet</p>
                ) : (
                  <div className="space-y-2">
                    {recentRuns.slice(0, 5).map((run, i) => {
                      const cfg = QUALITY_CFG[run.quality];
                      return (
                        <div
                          key={i}
                          className="animate-fade-in-up flex items-center justify-between py-1.5 border-b border-slate-50 last:border-0"
                          style={{ animationDelay: `${i * 60}ms` }}
                        >
                          <div className="flex items-center gap-2">
                            <span
                              className="text-[10px] font-semibold px-2 py-0.5 rounded-full"
                              style={{ background: cfg.light, color: cfg.color }}
                            >
                              {cfg.label}
                            </span>
                          </div>
                          <div className="text-right">
                            <p className="text-[11px] text-slate-500" style={{ fontFamily: mono }}>
                              {fmt(run.budget)}
                            </p>
                            <p className="text-[10px] text-slate-300">
                              {run.toolCount} tool{run.toolCount !== 1 ? "s" : ""}
                            </p>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>

              {/* Teardown info */}
              {teardown && (
                <div className="animate-fade-in-up rounded-xl border border-red-100 bg-red-50 p-4">
                  <p className="text-[11px] font-semibold text-red-500 uppercase tracking-wider mb-2">Teardown Mode</p>
                  <div className="space-y-1 text-[11px] text-red-400" style={{ fontFamily: mono }}>
                    <p>budget: {fmt(budget)}</p>
                    <p>tools: {BASE_TOOLS.length}</p>
                    <p>runs: {recentRuns.length}</p>
                    <p>session spend: {fmt(todaySpend)}</p>
                  </div>
                </div>
              )}
            </div>
          </div>
          </div>}
        </div>
      </div>
    </div>
  );
}
