import fs from "fs/promises";
import path from "path";
import { TaskPlan } from "../agent/types";

const PLANS_DIR = path.join(process.cwd(), "data", "plans");

export async function savePlan(plan: TaskPlan): Promise<void> {
    await fs.mkdir(PLANS_DIR, { recursive: true });
    const filePath = path.join(PLANS_DIR, `${plan.id}.json`);
    await fs.writeFile(filePath, JSON.stringify(plan, null, 2), "utf-8");
}

export async function getPlan(planId: string): Promise<TaskPlan | null> {
    const filePath = path.join(PLANS_DIR, `${planId}.json`);
    try {
        const data = await fs.readFile(filePath, "utf-8");
        return JSON.parse(data);
    } catch {
        return null;
    }
}

export async function listPlans(): Promise<TaskPlan[]> {
    try {
        const files = await fs.readdir(PLANS_DIR);
        const plans: TaskPlan[] = [];
        for (const file of files) {
            if (file.endsWith(".json")) {
                const plan = await getPlan(file.replace(".json", ""));
                if (plan) plans.push(plan);
            }
        }
        return plans;
    } catch {
        return [];
    }
}

export async function deletePlan(planId: string): Promise<void> {
    const filePath = path.join(PLANS_DIR, `${planId}.json`);
    try {
        await fs.unlink(filePath);
    } catch {
        // ignore
    }
}
