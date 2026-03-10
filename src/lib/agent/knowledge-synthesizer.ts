import { TaskPlan } from "./types";
import { runAgentText } from "./agent";
import { saveKnowledge, KnowledgeMetadata } from "../storage/knowledge-store";
import crypto from "crypto";

export class KnowledgeSynthesizer {
    /**
     * Synthesizes a Knowledge Item from a completed TaskPlan.
     */
    async synthesizeFromPlan(plan: TaskPlan, chatId: string): Promise<string> {
        if (plan.status !== 'completed') {
            throw new Error("Can only synthesize knowledge from completed plans.");
        }

        console.log(`Synthesizing knowledge from plan: ${plan.id}...`);

        const resultsContext = plan.tasks.map(t => {
            return `### Task: ${t.title} (${t.id})\nRole: ${t.role}\nDescription: ${t.description}\nResult:\n${t.result || "No result"}`;
        }).join("\n\n---\n\n");

        const prompt = `
You are the Knowledge Manager. Your task is to analyze the results of a multi-agent execution plan and distill them into a concise Knowledge Item (KI).

Goal of the plan: "${plan.goal}"

Execution Context:
${resultsContext}

Output a JSON block with the following structure:
{
  "title": "A short, descriptive title for this knowledge area",
  "summary": "A 1-2 sentence summary of what was learned or achieved",
  "artifacts": [
    {
      "name": "filename.md",
      "content": "Comprehensive markdown content documenting the findings, architecture, or solutions discovered."
    }
  ]
}

Ensure the artifacts are high quality and technical.
`;

        const responseText = await runAgentText({
            chatId,
            userMessage: prompt,
            agentNumber: 0, // Using Orchestrator (Kimi)
        });

        // Extract JSON from response
        const jsonMatch = responseText.match(/```json\n([\s\S]*?)\n```/) || responseText.match(/{[\s\S]*}/);
        if (!jsonMatch) {
            throw new Error("Failed to generate knowledge synthesis (no JSON found)");
        }

        try {
            const data = JSON.parse(jsonMatch[1] || jsonMatch[0]);
            const kiId = crypto.randomUUID();

            const metadata: KnowledgeMetadata = {
                title: data.title,
                summary: data.summary,
                created_at: new Date().toISOString(),
                updated_at: new Date().toISOString(),
                references: [plan.id]
            };

            await saveKnowledge(kiId, metadata, data.artifacts);
            console.log(`Knowledge Item created: ${kiId} (${data.title})`);
            return kiId;
        } catch (e) {
            console.error("Failed to parse knowledge synthesis JSON:", e);
            throw new Error("Failed to parse knowledge synthesis JSON");
        }
    }
}

export const knowledgeSynthesizer = new KnowledgeSynthesizer();
