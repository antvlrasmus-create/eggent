import { NextRequest } from "next/server";
import { listPlans } from "@/lib/storage/plan-store";
import { orchestrationService } from "@/lib/agent/orchestration-service";
import { requireAuth } from "@/lib/auth/session";

/**
 * GET /api/plans — list all task plans
 */
export async function GET() {
  const auth = await requireAuth();
  if (!auth) return Response.json({ error: "Unauthorized" }, { status: 401 });

  const plans = await listPlans();
  return Response.json(plans);
}

/**
 * POST /api/plans — create and optionally execute a plan from a goal
 * Body: { goal: string, chatId: string, projectId?: string, execute?: boolean }
 */
export async function POST(req: NextRequest) {
  const auth = await requireAuth();
  if (!auth) return Response.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const body = await req.json();
    const { goal, chatId, projectId, execute } = body;

    if (!goal || typeof goal !== "string") {
      return Response.json({ error: "goal is required" }, { status: 400 });
    }
    if (!chatId || typeof chatId !== "string") {
      return Response.json({ error: "chatId is required" }, { status: 400 });
    }

    // Create plan using the orchestrator agent to decompose the goal
    const plan = await orchestrationService.createPlanFromGoal(goal, chatId, projectId);

    // Optionally kick off execution immediately (non-blocking)
    if (execute) {
      orchestrationService.executePlan(plan.id).catch((err) => {
        console.error(`Background plan execution failed for ${plan.id}:`, err);
      });
    }

    return Response.json(plan, { status: 201 });
  } catch (error) {
    return Response.json(
      { error: error instanceof Error ? error.message : "Failed to create plan" },
      { status: 500 }
    );
  }
}
