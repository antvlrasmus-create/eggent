import type { ModelMessage } from "ai";
import type { AgentRole } from "@/lib/types";


// Minimal definition for ModelConfig based on how it's used
export interface ModelConfig {
  provider: string;
  model: string;
  temperature?: number;
  maxTokens?: number;
}

export interface AgentConfig {
  role: AgentRole;
  model: ModelConfig;
  systemPrompt: string;
  tools: string[];
  maxSteps: number;
  temperature: number;
}

export interface AgentContext {
  chatId: string;
  projectId?: string;
  currentPath?: string; // relative path within the project for cwd
  memorySubdir: string;
  knowledgeSubdirs: string[];
  history: ModelMessage[];
  agentNumber: number;
  parentContext?: AgentContext;
  data: Record<string, unknown>;
}

export interface AgentLoopResult {
  response: string;
  toolCalls: AgentToolCallRecord[];
}

export interface AgentToolCallRecord {
  toolName: string;
  args: Record<string, unknown>;
  result: string;
  timestamp: string;
}

export interface StreamCallbacks {
  onTextDelta?: (delta: string) => void;
  onToolCall?: (toolName: string, args: Record<string, unknown>) => void;
  onToolResult?: (toolName: string, result: string) => void;
  onFinish?: (result: AgentLoopResult) => void;
}

// --- Orchestration ---

export interface SubTask {
  id: string;
  title: string;
  description: string;
  role: AgentRole;
  status: 'pending' | 'in_progress' | 'completed' | 'failed';
  dependencies: string[]; // IDs of other tasks
  result?: string;
  error?: string;
}

export interface TaskPlan {
  id: string;
  goal: string;
  tasks: SubTask[];
  status: 'planning' | 'executing' | 'completed' | 'failed';
}
