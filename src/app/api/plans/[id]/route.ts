import { NextRequest } from "next/server";
import { getPlan, deletePlan } from "@/lib/storage/plan-store";
import { orchestrationService } from "@/lib/agent/orchestration-service";
import { requireAuth } from "@/lib/auth/session";

type Params = { params: Promise<{ id: string }> };

/**
 * GET /api/plans/[id] — get plan status + task details
 */
export async function GET(_req: NextRequest, { params }: Params) {
  const auth = await requireAuth();
  if (!auth) return Response.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const plan = await getPlan(id);

  if (!plan) {
    return Response.json({ error: "Plan not found" }, { status: 404 });
  }

  return Response.json(plan);
}

/**
 * POST /api/plans/[id] — execute a plan that's in 'planning' state
 * Body: {} (no body needed)
 */
export async function POST(_req: NextRequest, { params }: Params) {
  const auth = await requireAuth();
  if (!auth) return Response.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const plan = await getPlan(id);

  if (!plan) {
    return Response.json({ error: "Plan not found" }, { status: 404 });
  }
  if (plan.status === "completed" || plan.status === "executing") {
    return Response.json(
      { error: `Plan is already in state: ${plan.status}` },
      { status: 409 }
    );
  }

  // Fire-and-forget: execution happens in background
  orchestrationService.executePlan(id).catch((err) => {
    console.error(`Background plan execution failed for ${id}:`, err);
  });

  return Response.json({ message: "Plan execution started", planId: id });
}

/**
 * DELETE /api/plans/[id] — delete a plan
 */
export async function DELETE(_req: NextRequest, { params }: Params) {
  const auth = await requireAuth();
  if (!auth) return Response.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  await deletePlan(id);

  return Response.json({ message: "Plan deleted" });
}
