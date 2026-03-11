import { type AgentRole, type ModelConfig } from "@/lib/types";

/**
 * Agent Registry — maps each role to the optimal LLM provider + model.
 *
 * Routing strategy: Currently optimized for NVIDIA NIM with a preference for 
 * high-reasoning models for orchestration and specialized coding models.
 */

// Note: We use preferred defaults for 2026, but all can be overridden via environment variables
// to follow the "no hardcore bindings" principle.
export const AgentRegistry: Record<AgentRole, ModelConfig> = {
    orchestrator: {
        provider: "nvidia",
        model: process.env.ORCHESTRATOR_MODEL || "qwen/qwen3.5-397b-a17b",
    },
    coder: {
        provider: "nvidia",
        model: process.env.CODER_MODEL || "qwen/qwen3-coder-480b-a35b-instruct",
    },
    reviewer: {
        provider: "nvidia",
        model: process.env.REVIEWER_MODEL || "deepseek-ai/deepseek-v3.2",
    },
    researcher: {
        provider: "nvidia",
        model: process.env.RESEARCHER_MODEL || "mistralai/mistral-large-3-675b-instruct-2512",
    },
    browser: {
        provider: "nvidia",
        model: process.env.BROWSER_MODEL || "moonshotai/kimi-k2.5",
    }
};
