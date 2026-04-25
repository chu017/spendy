import { NextRequest, NextResponse } from "next/server";
import { runAgent } from "@/lib/agent";

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => null);

  if (!body || typeof body.task !== "string" || typeof body.budget !== "number") {
    return NextResponse.json({ error: "Invalid input" }, { status: 400 });
  }

  const { task, budget } = body;

  if (budget <= 0 || budget > 1) {
    return NextResponse.json({ error: "Budget must be between 0 and 1" }, { status: 400 });
  }

  const plan = runAgent(task.trim() || "General analysis", budget);
  return NextResponse.json({ plan });
}
