import { TaskPlan, SubTask } from "./types";
import { savePlan, getPlan } from "../storage/plan-store";
import crypto from "crypto";
import { runSubordinateAgent, runAgentText } from "./agent";
import { knowledgeSynthesizer } from "./knowledge-synthesizer";

/**
 * Service to manage Task Plans (DAG of tasks for multi-agent execution)
 * Refactored using Kimi (NVIDIA NIM) logic for parallel execution and robust state management.
 */
export class OrchestrationService {
    /**
     * Executes the tasks in the plan based on their dependencies.
     * Runs independent tasks in parallel using Promise.all.
     */
    async executePlan(planId: string): Promise<TaskPlan> {
        let plan = await getPlan(planId);
        if (!plan) throw new Error(`Plan ${planId} not found`);

        if (plan.status === 'completed' || plan.status === 'failed') return plan;

        try {
            plan.status = 'executing';
            await savePlan(plan);

            // Continuously execute waves of tasks as long as dependencies are met
            while (true) {
                const currentPlan: TaskPlan = plan;

                // Find tasks that are pending and have all dependencies completed
                const runnableTasks = currentPlan.tasks.filter((t: SubTask) =>
                    t.status === 'pending' &&
                    t.dependencies.every((depId: string) => {
                        const dep = currentPlan.tasks.find((pt: SubTask) => pt.id === depId);
                        return dep?.status === 'completed';
                    })
                );

                if (runnableTasks.length === 0) {
                    // Check if all tasks are finished or we are stuck in a deadlock/crash state
                    const allDone = currentPlan.tasks.every((t: SubTask) => t.status === 'completed');
                    const anyFailed = currentPlan.tasks.some((t: SubTask) => t.status === 'failed');

                    if (allDone) {
                        currentPlan.status = 'completed';
                    } else if (anyFailed) {
                        currentPlan.status = 'failed';
                    } else {
                        // Deadlock or stalled tasks (e.g. process was killed while executing)
                        console.warn(`Plan ${planId} stalled. Marking as failed.`);
                        currentPlan.status = 'failed';
                        for (const t of currentPlan.tasks) {
                            if (t.status === 'pending' || t.status === 'in_progress') {
                                t.status = 'failed';
                                t.error = 'Execution stalled or dependency deadlock.';
                            }
                        }
                    }
                    await savePlan(currentPlan);
                    break;
                }

                // Execute wave of runnable tasks with limited concurrency to avoid resource exhaustion
                console.log(`Executing wave of ${runnableTasks.length} tasks for plan ${planId}`);

                // Simple chunked execution (3 at a time)
                const CONCURRENCY_LIMIT = 2;
                for (let i = 0; i < runnableTasks.length; i += CONCURRENCY_LIMIT) {
                    const chunk = runnableTasks.slice(i, i + CONCURRENCY_LIMIT);
                    await Promise.all(chunk.map(async (task: SubTask) => {
                        task.status = 'in_progress';
                        await savePlan(currentPlan);

                        try {
                            // Context Injection: Collect results of dependencies
                            const dependencyContext: any[] = [];
                            for (const depId of task.dependencies) {
                                const dep = currentPlan.tasks.find(t => t.id === depId);
                                if (dep && dep.result) {
                                    dependencyContext.push({
                                        role: 'user',
                                        content: `Result of dependency task "${dep.title}" (${dep.id}):\n\n${dep.result}`
                                    });
                                }
                            }

                            const result = await runSubordinateAgent({
                                role: task.role,
                                task: task.description,
                                parentHistory: dependencyContext,
                                parentAgentNumber: 0,
                            });

                            // Autonomous Review Pass for Coding Tasks
                            if (task.role === 'coder') {
                                console.log(`Task ${task.id} is a coding task. Initiating Review phase...`);
                                const reviewPass = await runSubordinateAgent({
                                    role: 'reviewer',
                                    task: `Review the following code integration for task: "${task.title}".\nOriginal Goal: "${currentPlan.goal}"\n\nImplementation Output:\n${result}`,
                                    parentHistory: dependencyContext,
                                    parentAgentNumber: 1, // Indicate it's a follow-up
                                });
                                task.result = `--- IMPLEMENTATION ---\n${result}\n\n--- REVIEW FEEDBACK ---\n${reviewPass}`;
                            } else {
                                task.result = result;
                            }

                            task.status = 'completed';
                        } catch (err) {
                            console.error(`Task ${task.id} failed:`, err);
                            task.status = 'failed';
                            task.error = err instanceof Error ? err.message : String(err);
                        }
                        await savePlan(currentPlan);
                    }));
                }

                // Re-load plan state to verify consistency after wave completion
                const refreshedPlan = await getPlan(planId);
                if (!refreshedPlan) break;
                plan = refreshedPlan;

                // Stop execution if any task in this wave failed
                if (plan.tasks.some((t: SubTask) => t.status === 'failed')) {
                    plan.status = 'failed';
                    await savePlan(plan);
                    break;
                }
            }
        } catch (error) {
            console.error(`Plan execution error for ${planId}:`, error);
            if (plan) {
                plan.status = 'failed';
                await savePlan(plan);
            }
        }

        if (plan.status === 'completed') {
            console.log(`Plan ${planId} completed. Starting knowledge synthesis...`);
            try {
                const kiId = await knowledgeSynthesizer.synthesizeFromPlan(plan, plan.chatId);
                console.log(`Knowledge synthesized for plan ${planId}. KI: ${kiId}`);
            } catch (err) {
                console.error(`Knowledge synthesis failed for plan ${planId}:`, err);
            }
        }

        return plan;
    }

    async createPlan(goal: string, chatId: string): Promise<TaskPlan> {
        const plan: TaskPlan = {
            id: crypto.randomUUID(),
            goal,
            chatId,
            tasks: [],
            status: "planning",
        };
        await savePlan(plan);
        return plan;
    }

    async createPlanFromGoal(goal: string, chatId: string, projectId?: string): Promise<TaskPlan> {
        const prompt = `Create a multi-step execution plan for the following goal: "${goal}".\n\nOutput ONLY a JSON block with the task list according to your Role Guidelines.`;

        console.log(`Generating plan for goal: "${goal}" using Orchestrator agent...`);
        const responseText = await runAgentText({
            chatId,
            userMessage: prompt,
            projectId,
            agentNumber: 0,
        });
        console.log("Orchestrator response received.");

        // Extract JSON from response
        const jsonMatch = responseText.match(/```json\n([\s\S]*?)\n```/) || responseText.match(/{[\s\S]*}/);
        if (!jsonMatch) {
            console.error("Orchestrator response did not contain JSON:", responseText);
            throw new Error("Failed to generate a valid plan (no JSON found in orchestrator response)");
        }

        try {
            const planData = JSON.parse(jsonMatch[1] || jsonMatch[0]);
            const plan = await this.createPlan(goal, chatId);

            if (!Array.isArray(planData.tasks)) {
                throw new Error("Plan JSON does not contain a 'tasks' array");
            }

            for (const t of planData.tasks) {
                await this.addTask(plan.id, {
                    id: t.id,
                    title: t.title,
                    description: t.description,
                    role: t.role,
                    dependencies: t.dependencies
                });
            }

            return plan;
        } catch (e) {
            console.error("Failed to parse plan JSON:", e);
            throw new Error(`Failed to parse plan JSON: ${e instanceof Error ? e.message : String(e)}`);
        }
    }

    async addTask(planId: string, taskDef: {
        id: string;
        title: string;
        description: string;
        role: SubTask["role"];
        dependencies?: string[]
    }): Promise<TaskPlan> {
        const plan = await getPlan(planId);
        if (!plan) throw new Error(`Plan ${planId} not found`);

        const newTask: SubTask = {
            id: taskDef.id,
            title: taskDef.title,
            description: taskDef.description,
            role: taskDef.role,
            status: "pending",
            dependencies: taskDef.dependencies || [],
        };

        plan.tasks.push(newTask);
        await savePlan(plan);
        return plan;
    }

    async updateTaskStatus(
        planId: string,
        taskId: string,
        status: SubTask["status"],
        result?: string,
        error?: string
    ): Promise<TaskPlan> {
        const plan = await getPlan(planId);
        if (!plan) throw new Error(`Plan ${planId} not found`);

        const task = plan.tasks.find((t) => t.id === taskId);
        if (!task) throw new Error(`Task ${taskId} not found in plan ${planId}`);

        task.status = status;
        if (result !== undefined) task.result = result;
        if (error !== undefined) task.error = error;

        // Update overall plan status
        if (plan.tasks.every(t => t.status === 'completed')) {
            plan.status = 'completed';
        } else if (plan.tasks.some(t => t.status === 'failed')) {
            plan.status = 'failed';
        } else if (plan.tasks.some(t => t.status === 'in_progress')) {
            plan.status = 'executing';
        }

        await savePlan(plan);
        return plan;
    }

    async getPlanStatus(planId: string): Promise<TaskPlan> {
        const plan = await getPlan(planId);
        if (!plan) throw new Error(`Plan ${planId} not found`);
        return plan;
    }
}

export const orchestrationService = new OrchestrationService();
