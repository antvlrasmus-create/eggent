import { type AgentRole, type ModelConfig } from "@/lib/types";

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
