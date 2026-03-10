/**
 * Available model providers and their models
 */

import type { ChatAuthMethod } from "@/lib/types";

export interface ProviderConfig {
  name: string;
  models: { id: string; name: string }[];
  embeddingModels?: { id: string; name: string; dimensions: number }[];
  envKey?: string;
  baseUrl?: string;
  defaultPath?: string;
  requiresApiKey: boolean;
  authMethods?: ChatAuthMethod[];
  defaultAuthMethod?: ChatAuthMethod;
  connectionHelp?: {
    apiKey?: {
      title: string;
      steps: string[];
      command?: string;
    };
    oauth?: {
      title: string;
      steps: string[];
      command?: string;
    };
  };
}

export const MODEL_PROVIDERS: Record<string, ProviderConfig> = {
  openai: {
    name: "OpenAI",
    models: [],
    embeddingModels: [
      { id: "text-embedding-3-small", name: "Embedding 3 Small", dimensions: 1536 },
      { id: "text-embedding-3-large", name: "Embedding 3 Large", dimensions: 3072 },
    ],
    envKey: "OPENAI_API_KEY",
    requiresApiKey: true,
    authMethods: ["api_key"],
    defaultAuthMethod: "api_key",
  },
  nvidia: {
    name: "NVIDIA NIM",
    models: [
      { id: "moonshotai/kimi-k2.5", name: "Kimi K2.5 (NIM)" },
      { id: "meta/llama-3.3-70b-instruct", name: "Llama 3.3 70B Instruct" },
      { id: "nvidia/llama-3.1-nemotron-70b-instruct", name: "Llama 3.1 Nemotron 70B" },
      { id: "deepseek-ai/deepseek-v3", name: "DeepSeek V3 (NIM)" },
    ],
    embeddingModels: [
      { id: "nvidia/embed-qa-4", name: "NVIDIA Embed QA 4", dimensions: 1024 },
      { id: "baai/bge-m3", name: "BGE-M3 (NIM)", dimensions: 1024 },
    ],
    envKey: "NVIDIA_API_KEY",
    requiresApiKey: true,
    authMethods: ["api_key"],
    defaultAuthMethod: "api_key",
    baseUrl: "https://integrate.api.nvidia.com/v1",
  },
  anthropic: {
    name: "Anthropic",
    models: [],
    envKey: "ANTHROPIC_API_KEY",
    requiresApiKey: true,
    authMethods: ["api_key"],
    defaultAuthMethod: "api_key",
  },
  google: {
    name: "Google",
    models: [],
    envKey: "GOOGLE_API_KEY",
    requiresApiKey: true,
    authMethods: ["api_key"],
    defaultAuthMethod: "api_key",
  },
  openrouter: {
    name: "OpenRouter",
    models: [],
    envKey: "OPENROUTER_API_KEY",
    requiresApiKey: true,
    authMethods: ["api_key"],
    defaultAuthMethod: "api_key",
  },
  ollama: {
    name: "Ollama",
    models: [],
    embeddingModels: [
      { id: "nomic-embed-text", name: "Nomic Embed Text", dimensions: 768 },
      { id: "mxbai-embed-large", name: "MxBai Embed Large", dimensions: 1024 },
    ],
    baseUrl: "http://localhost:11434",
    requiresApiKey: false,
    authMethods: ["api_key"],
    defaultAuthMethod: "api_key",
  },
  "codex-cli": {
    name: "Codex CLI",
    models: [
      { id: "gpt-5.3-codex", name: "gpt-5.3-codex" },
      { id: "gpt-5.4", name: "gpt-5.4" },
      { id: "gpt-5.2-codex", name: "gpt-5.2-codex" },
      { id: "gpt-5.1-codex-max", name: "gpt-5.1-codex-max" },
      { id: "gpt-5.2", name: "gpt-5.2" },
      { id: "gpt-5.1-codex-mini", name: "gpt-5.1-codex-mini" },
    ],
    requiresApiKey: false,
    authMethods: ["oauth"],
    defaultAuthMethod: "oauth",
    connectionHelp: {
      oauth: {
        title: "Connect with OAuth via Codex CLI",
        command: "codex login",
        steps: [
          "Install Codex CLI if needed: npm i -g @openai/codex",
          "Run codex login in your terminal.",
          "Complete browser authorization.",
          "Return here and click Check connection.",
        ],
      },
    },
  },
  "gemini-cli": {
    name: "Gemini CLI",
    models: [
      { id: "gemini-3.1-pro-preview", name: "gemini-3.1-pro-preview" },
      { id: "gemini-3-flash-preview", name: "gemini-3-flash-preview" },
      { id: "gemini-2.5-pro", name: "gemini-2.5-pro" },
      { id: "gemini-2.5-flash", name: "gemini-2.5-flash" },
      { id: "gemini-2.5-flash-lite", name: "gemini-2.5-flash-lite" },
    ],
    requiresApiKey: false,
    authMethods: ["oauth"],
    defaultAuthMethod: "oauth",
    connectionHelp: {
      oauth: {
        title: "Connect with OAuth via Gemini CLI",
        command: "gemini",
        steps: [
          "Install Gemini CLI if needed: npm i -g @google/gemini-cli",
          "Run gemini in your terminal.",
          "Choose Login with Google and complete browser authorization.",
          "Return here and click Check connection.",
        ],
      },
    },
  },
  groq: {
    name: "Groq",
    models: [
      { id: "llama-3.3-70b-versatile", name: "Llama 3.3 70B Versatile" },
      { id: "llama-3.1-70b-versatile", name: "Llama 3.1 70B Versatile" },
      { id: "llama3-70b-8192", name: "Llama 3 70B" },
      { id: "mixtral-8x7b-32768", name: "Mixtral 8x7B" },
    ],
    envKey: "GROQ_API_KEY",
    requiresApiKey: true,
    authMethods: ["api_key"],
    defaultAuthMethod: "api_key",
    baseUrl: "https://api.groq.com/openai/v1",
    defaultPath: "/v1",
  },
  pollinations: {
    name: "Pollinations",
    models: [
      { id: "openai", name: "OpenAI (Pollinations)" },
      { id: "mistral", name: "Mistral (Pollinations)" },
    ],
    requiresApiKey: false,
    authMethods: ["api_key"],
    defaultAuthMethod: "api_key",
  },
};
