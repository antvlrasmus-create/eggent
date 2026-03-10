import { orchestrationService } from "./src/lib/agent/orchestration-service";

import dotenv from "dotenv";
dotenv.config();

async function testParallelOrchestration() {
    console.log("Starting Parallel Orchestration Test...");

    try {
        // 1. Create a new plan
        const goal = "Demonstrate parallel task execution and DAG dependency management.";
        const plan = await orchestrationService.createPlan(goal, "test-manual-chat");
        console.log(`Created Plan: ${plan.id}`);

        // 2. Add tasks
        // Task 1: Research (Base task)
        await orchestrationService.addTask(plan.id, {
            id: "research-task",
            title: "Codebase Research",
            description: "Read src/lib/agent/orchestration-service.ts and summarize the 'executePlan' method in exactly 2 sentences. Return the summary in your response text.",
            role: "researcher"
        });

        // Task 2: Documentation (Parallel task A)
        await orchestrationService.addTask(plan.id, {
            id: "doc-task",
            title: "Technical Documentation",
            description: "Create a file named 'PARALLEL_TEST_A.md' with the content: 'Parallel Wave A verified at ' + new Date().toISOString()",
            role: "coder",
            dependencies: ["research-task"]
        });

        // Task 3: Status Log (Parallel task B)
        await orchestrationService.addTask(plan.id, {
            id: "log-task",
            title: "Implementation Log",
            description: "Create a file named 'PARALLEL_TEST_B.md' with the content: 'Parallel Wave B verified at ' + new Date().toISOString()",
            role: "coder",
            dependencies: ["research-task"]
        });

        console.log("Tasks added. Starting execution...");

        // 3. Execute the plan
        const finalState = await orchestrationService.executePlan(plan.id);

        console.log("\nPlan execution finished.");
        console.log("Final Plan Status:", finalState.status);

        finalState.tasks.forEach(t => {
            console.log(`\n- Task [${t.id}]: ${t.status}`);
            if (t.result) console.log(`  Result: ${t.result.substring(0, 200)}...`);
            if (t.error) console.log(`  Error: ${t.error}`);
        });

    } catch (error) {
        console.error("Test failed:", error);
    }
}

testParallelOrchestration();
