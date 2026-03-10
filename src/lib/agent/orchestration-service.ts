import { TaskPlan, SubTask } from "./types";
import { savePlan, getPlan } from "../storage/plan-store";
import crypto from "crypto";

/**
 * Service to manage Task Plans (DAG of tasks for multi-agent execution)
 */
export class OrchestrationService {
    async createPlan(goal: string): Promise<TaskPlan> {
        const plan: TaskPlan = {
            id: crypto.randomUUID(),
            goal,
            tasks: [],
            status: "planning",
        };
        await savePlan(plan);
        return plan;
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

        // Check if plan is completed
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
