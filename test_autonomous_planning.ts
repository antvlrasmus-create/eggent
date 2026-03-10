import { orchestrationService } from "./src/lib/agent/orchestration-service";
import dotenv from "dotenv";
import crypto from "crypto";
dotenv.config();

async function testAutonomousPlanning() {
    console.log("Starting Full Autonomous Orchestration Test...");

    // Create a dummy chat ID for the session
    const chatId = "test-chat-" + crypto.randomUUID().substring(0, 8);
    const goal = "Research how 'OrchestrationService' manages task status and write a summary in 'ORCHESTRATION_LOG.md'.";

    try {
        // 1. Generate plan automatically from goal
        console.log(`\n--- Goal: ${goal} ---`);
        console.log("Requesting Orchestrator to generate a DAG plan...");
        const plan = await orchestrationService.createPlanFromGoal(goal, chatId);

        console.log(`\nGenerated Plan [${plan.id}]:`);
        plan.tasks.forEach(t => {
            console.log(`- [${t.role}] ${t.id}: ${t.title} (Deps: ${t.dependencies.join(", ") || "None"})`);
        });

        // 2. Execute the plan
        console.log("\nStarting execution loop...");
        const finalState = await orchestrationService.executePlan(plan.id);

        console.log("\nPlan execution finished.");
        console.log("Final Plan Status:", finalState.status);

        finalState.tasks.forEach(t => {
            console.log(`\n- Task [${t.id}] (${t.status}): ${t.title}`);
            if (t.result) {
                const preview = t.result.substring(0, 300);
                console.log(`  Result (truncated):\n${preview}${t.result.length > 300 ? "..." : ""}`);
            }
            if (t.error) console.log(`  Error: ${t.error}`);
        });

    } catch (error) {
        console.error("Test failed:", error);
    }
}

testAutonomousPlanning();
