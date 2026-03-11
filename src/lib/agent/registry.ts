import { type AgentRole, type ModelConfig } from "@/lib/types";

/**
 * Agent Registry — maps each role to the optimal LLM provider + model.
 *
 * Routing strategy (Optimized for stability on NVIDIA NIM):
 *  - orchestrator: Kimi K2.5 — best-in-class instruction following & planning
 *  - coder:        Kimi K2.5 — state-of-the-art code generation
 *  - reviewer:     Kimi K2.5 — stable fallback for code review
 *  - researcher:   Kimi K2.5 — stable fallback for research
 *  - browser:      Kimi K2.5 — handles multi-step web tasks reliably
 */
export const AgentRegistry: Record<AgentRole, ModelConfig> = {
    orchestrator: {
        provider: "nvidia",
        model: "moonshotai/kimi-k2.5",
    },
    coder: {
        provider: "nvidia",
        model: "moonshotai/kimi-k2.5",
    },
    reviewer: {
        provider: "nvidia",
        model: "moonshotai/kimi-k2.5",
    },
    researcher: {
        provider: "nvidia",
        model: "moonshotai/kimi-k2.5",
    },
    browser: {
        provider: "nvidia",
        model: "moonshotai/kimi-k2.5",
    }
};
