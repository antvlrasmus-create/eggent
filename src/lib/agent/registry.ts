import { type AgentRole, type ModelConfig } from "@/lib/types";

export const AgentRegistry: Record<AgentRole, ModelConfig> = {
    orchestrator: {
        provider: "openrouter",
        model: "qwen/qwen3-next-80b-instruct",
    },
    coder: {
        provider: "nvidia",
        model: "moonshotai/kimi-k2.5",
    },
    reviewer: {
        provider: "openrouter",
        model: "deepseek/deepseek-r1",
    },
    researcher: {
        provider: "groq",
        model: "llama-3.3-70b-versatile",
    },
    browser: {
        provider: "pollinations",
        model: "gemini",
    }
};
