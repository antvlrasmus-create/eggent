import { tool } from "ai";
import type { ToolSet } from "ai";
import { z } from "zod";
import fs from "fs/promises";
// import { constants as fsConstants } from "fs";
import path from "path";
import type { AgentContext } from "@/lib/agent/types";
import type { AppSettings /*, McpServerConfig */ } from "@/lib/types";
import {
  clearFinishedManagedProcessSessions,
  executeCode,
  killManagedProcessSession,
  listManagedProcessSessions,
  pollManagedProcessSession,
  readManagedProcessSessionLog,
  removeManagedProcessSession,
} from "@/lib/tools/code-execution";
import { memorySave, memoryLoad, memoryDelete, memorySync } from "@/lib/tools/memory-tools";
import { knowledgeQuery } from "@/lib/tools/knowledge-query";
// import { searchWeb } from "@/lib/tools/search-engine";
import { callSubordinate } from "@/lib/tools/call-subordinate";
import { orchestrationService } from "@/lib/agent/orchestration-service";
// import { createCronTool } from "@/lib/tools/cron-tool";
import { installPackages } from "@/lib/tools/install-orchestrator";
// import { loadPdf } from "@/lib/memory/loaders/pdf-loader";
import {
  getAllProjects,
  createProject,
  getProject,
  getWorkDir,
  /*
  loadProjectSkillsMetadata,
  loadSkillInstructions,
  createSkill,
  installSkillFromGitHub,
  updateSkill,
  deleteSkill,
  writeSkillFile,
  upsertProjectMcpServer,
  deleteProjectMcpServer,
  */
  deleteProject,
} from "@/lib/storage/project-store";

/*
const SKILL_RESOURCE_LIST_LIMIT = 60;
const SKILL_REQUIRED_AUTOLOAD_MAX_FILES = 4;
const SKILL_REQUIRED_AUTOLOAD_MAX_CHARS_TOTAL = 50000;
const SKILL_REQUIRED_AUTOLOAD_MAX_CHARS_PER_FILE = 18000;
*/
/*
const CODE_EXEC_MAX_CHARS = 20000;
const CODE_EXEC_MAX_LINES = 800;
const TEXT_FILE_READ_MAX_CHARS = 30000;
const TEXT_FILE_WRITE_MAX_CHARS = 400000;
const PDF_FILE_READ_MAX_CHARS = 30000;
const TELEGRAM_SEND_FILE_MAX_BYTES = 45 * 1024 * 1024;
*/

/*
interface TelegramRuntimeData {
  botToken: string;
  chatId: string | number;
}
*/

/*
function getCurrentUserMessageText(context: AgentContext): string {
  const value = context.data?.currentUserMessage;
  return typeof value === "string" ? value.trim() : "";
}
*/

/*
function userExplicitlyRequestedProcessKill(context: AgentContext): boolean {
  const text = getCurrentUserMessageText(context);
  if (!text) return false;

  const killIntent =
    /\b(stop|terminate|kill|cancel|abort|end|прервать|прерви|остановить|останови|убить|убей|завершить|заверши|отменить|отмени)\b/i;
  const negatedIntent =
    /\b(do not|don't|dont|не)\b.{0,20}\b(stop|terminate|kill|cancel|abort|прерв|останов|убива|заверш|отмен)\b/i;

  if (negatedIntent.test(text)) {
    return false;
  }

  return killIntent.test(text);
}
*/

/*
function getTelegramRuntimeData(context: AgentContext): TelegramRuntimeData | null {
  const raw = context.data?.telegram;
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return null;
  const record = raw as Record<string, unknown>;
  const botToken = typeof record.botToken === "string" ? record.botToken.trim() : "";
  const chatIdRaw = record.chatId;
  const chatId =
    typeof chatIdRaw === "string" || typeof chatIdRaw === "number"
      ? chatIdRaw
      : null;
  if (!botToken || chatId === null) return null;
  return { botToken, chatId };
}
*/

function resolveOutgoingFilePath(context: AgentContext, rawPath: string): string {
  const value = rawPath.trim();
  if (!value) {
    throw new Error("file_path is required");
  }
  if (path.isAbsolute(value)) {
    return path.resolve(value);
  }

  const cwd = resolveContextCwd(context);
  return path.resolve(cwd, value);
}

async function isExistingRegularFile(filePath: string): Promise<boolean> {
  try {
    const stat = await fs.stat(filePath);
    return stat.isFile();
  } catch {
    return false;
  }
}

function uniquePaths(paths: string[]): string[] {
  const seen = new Set<string>();
  const result: string[] = [];
  for (const candidate of paths) {
    const normalized = path.normalize(candidate);
    if (!normalized || seen.has(normalized)) continue;
    seen.add(normalized);
    result.push(normalized);
  }
  return result;
}

async function resolveReadableFilePath(
  context: AgentContext,
  rawPath: string
): Promise<string> {
  const value = rawPath.trim();
  if (!value) {
    throw new Error("file_path is required");
  }

  const normalizedInput = value.replace(/\\/g, "/").replace(/^\.\/+/, "");
  const candidates: string[] = [resolveOutgoingFilePath(context, value)];

  if (!path.isAbsolute(value) && /^(Users|home|var|tmp)\//.test(normalizedInput)) {
    candidates.push(path.resolve(path.sep, normalizedInput));
  }

  if (path.isAbsolute(value)) {
    candidates.push(path.resolve(value));
  }

  const chatId = context.chatId?.trim();
  if (chatId) {
    const chatFilesDir = path.join(process.cwd(), "data", "chat-files", chatId);
    const sanitized = value.replace(/^\.\/+/, "");

    if (!path.isAbsolute(value) && !sanitized.includes("/") && !sanitized.includes("\\")) {
      candidates.push(path.join(chatFilesDir, sanitized));
    }

    if (!path.isAbsolute(value)) {
      if (normalizedInput.startsWith("chat-files/")) {
        candidates.push(path.resolve(process.cwd(), "data", normalizedInput));
      } else if (normalizedInput.startsWith("data/chat-files/")) {
        candidates.push(path.resolve(process.cwd(), normalizedInput));
      }
    }
  }

  const uniqueCandidates = uniquePaths(candidates);
  for (const candidate of uniqueCandidates) {
    if (await isExistingRegularFile(candidate)) {
      return candidate;
    }
  }

  return uniqueCandidates[0];
}

function resolveContextCwd(context: AgentContext): string {
  const baseDir = getWorkDir(context.projectId);
  const rawCurrentPath = context.currentPath?.trim();
  if (!rawCurrentPath) {
    return baseDir;
  }

  const normalized = path.normalize(rawCurrentPath).replace(/^[/\\\\]+/, "");
  const resolved = path.resolve(baseDir, normalized);

  if (
    resolved === baseDir ||
    resolved.startsWith(baseDir + path.sep)
  ) {
    return resolved;
  }

  return baseDir;
}

function normalizeContextPathForOutput(rawPath: string | null | undefined): string {
  const raw = rawPath?.trim();
  if (!raw) {
    return "";
  }
  const normalized = path.normalize(raw).replace(/^[/\\\\]+/, "").replace(/\\/g, "/");
  return normalized === "." ? "" : normalized;
}

function slugifyProjectId(value: string): string {
  return (
    value
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "") || crypto.randomUUID().slice(0, 8)
  );
}

async function allocateProjectId(baseId: string): Promise<string> {
  const normalizedBase = slugifyProjectId(baseId);
  let candidate = normalizedBase;
  let counter = 2;
  while (await getProject(candidate)) {
    candidate = `${normalizedBase}-${counter}`;
    counter += 1;
  }
  return candidate;
}

/*
function parseLocalMarkdownLinks(markdown: string): string[] {
  const result: string[] = [];
  const seen = new Set<string>();
  const regex = /!?\[[^\]]*\]\(([^)]+)\)/g;
  let match: RegExpExecArray | null;

  while ((match = regex.exec(markdown)) !== null) {
    const cleaned = normalizeLocalMarkdownLinkTarget(match[1] ?? "");
    if (!cleaned || seen.has(cleaned)) continue;
    seen.add(cleaned);
    result.push(cleaned);
  }

  return result;
}

function normalizeLocalMarkdownLinkTarget(rawTarget: string): string | null {
  const trimmed = rawTarget.trim();
  if (!trimmed) return null;

  let target = trimmed;
  if (target.startsWith("<") && target.endsWith(">")) {
    target = target.slice(1, -1).trim();
  }

  const spaceQuoteIdx = target.search(/\s+["']/);
  if (spaceQuoteIdx >= 0) {
    target = target.slice(0, spaceQuoteIdx).trim();
  }

  const lower = target.toLowerCase();
  if (
    lower.startsWith("http://") ||
    lower.startsWith("https://") ||
    lower.startsWith("mailto:") ||
    lower.startsWith("#")
  ) {
    return null;
  }

  const cleaned = target.split("#")[0].split("?")[0].trim();
  return cleaned || null;
}
*/

/*
function parseRequiredSkillResourceLinks(markdown: string): string[] {
  return parseLocalMarkdownLinks(markdown);
}
*/

/*
function inferLanguageFromPath(filePath: string): string {
  const ext = path.extname(filePath).toLowerCase();
  switch (ext) {
    case ".md":
      return "markdown";
    case ".json":
      return "json";
    case ".ts":
      return "typescript";
    case ".tsx":
      return "tsx";
    case ".js":
      return "javascript";
    case ".jsx":
      return "jsx";
    case ".py":
      return "python";
    case ".sh":
      return "bash";
    case ".yml":
    case ".yaml":
      return "yaml";
    case ".sql":
      return "sql";
    default:
      return "text";
  }
}
*/

/*
async function resolveSkillLocalFile(
  skillDir: string,
  relativePath: string
): Promise<string | null> {
  const normalized = path.normalize(relativePath).replace(/^[/\\\\]+/, "");
  if (!normalized || normalized.includes("..")) return null;

  const skillRoot = path.resolve(skillDir);
  const fullPath = path.resolve(skillRoot, normalized);
  if (!fullPath.startsWith(skillRoot + path.sep) && fullPath !== skillRoot) {
    return null;
  }

  try {
    const stat = await fs.stat(fullPath);
    if (!stat.isFile()) return null;
    return fullPath;
  } catch {
    return null;
  }
}
*/

/*
async function isDirectory(dirPath: string): Promise<boolean> {
  try {
    const stat = await fs.stat(dirPath);
    return stat.isDirectory();
  } catch {
    return false;
  }
}
*/

/*
async function collectSkillFilesRecursive(
  rootDir: string,
  skillDir: string,
  limit: number
): Promise<string[]> {
  const results: string[] = [];
  const queue: string[] = [rootDir];

  while (queue.length > 0 && results.length < limit) {
    const dir = queue.shift()!;
    const entries = await fs
      .readdir(dir, { withFileTypes: true })
      .catch(() => null);
    if (!entries) {
      continue;
    }

    for (const entry of entries) {
      if (results.length >= limit) break;
      if (entry.name.startsWith(".")) continue;

      const fullPath = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        queue.push(fullPath);
        continue;
      }
      if (!entry.isFile()) continue;

      const relative = path.relative(skillDir, fullPath).replace(/\\/g, "/");
      results.push(relative);
    }
  }

  return results;
}
*/

/*
async function listSkillResourcePaths(
  skillDir: string,
  skillBody: string
): Promise<string[]> {
  const result: string[] = [];
  const seen = new Set<string>();
  const pushUnique = (value: string) => {
    if (seen.has(value) || result.length >= SKILL_RESOURCE_LIST_LIMIT) return;
    seen.add(value);
    result.push(value);
  };

  const links = parseLocalMarkdownLinks(skillBody);
  for (const link of links) {
    if (result.length >= SKILL_RESOURCE_LIST_LIMIT) break;
    const fullPath = await resolveSkillLocalFile(skillDir, link);
    if (!fullPath) continue;
    const relative = path.relative(skillDir, fullPath).replace(/\\/g, "/");
    pushUnique(relative);
  }

  const resourceDirs = ["references", "scripts", "assets"];
  for (const dirName of resourceDirs) {
    if (result.length >= SKILL_RESOURCE_LIST_LIMIT) break;
    const dirPath = path.join(skillDir, dirName);
    if (!(await isDirectory(dirPath))) continue;
    const remaining = SKILL_RESOURCE_LIST_LIMIT - result.length;
    const files = await collectSkillFilesRecursive(dirPath, skillDir, remaining);
    for (const file of files) {
      pushUnique(file);
    }
  }

  return result;
}
*/

interface RequiredSkillResourceContent {
  relativePath: string;
  language: string;
  content: string;
  truncated: boolean;
}

type RequiredResourceSkipReason =
  | "not_found"
  | "read_error"
  | "file_limit"
  | "char_limit";

interface RequiredSkillResourceSkip {
  relativePath: string;
  reason: RequiredResourceSkipReason;
}

interface RequiredSkillResourceAutoloadReport {
  detectedLinks: string[];
  loaded: RequiredSkillResourceContent[];
  skipped: RequiredSkillResourceSkip[];
}

/*
async function loadRequiredSkillResources(
  skillDir: string,
  skillBody: string
): Promise<RequiredSkillResourceAutoloadReport> {
  const requiredLinks = parseRequiredSkillResourceLinks(skillBody);
  const loaded: RequiredSkillResourceContent[] = [];
  const skipped: RequiredSkillResourceSkip[] = [];
  let totalChars = 0;

  for (const link of requiredLinks) {
    const normalizedLink = link.replace(/\\/g, "/");
    if (loaded.length >= SKILL_REQUIRED_AUTOLOAD_MAX_FILES) {
      skipped.push({ relativePath: normalizedLink, reason: "file_limit" });
      continue;
    }
    if (totalChars >= SKILL_REQUIRED_AUTOLOAD_MAX_CHARS_TOTAL) {
      skipped.push({ relativePath: normalizedLink, reason: "char_limit" });
      continue;
    }

    const fullPath = await resolveSkillLocalFile(skillDir, link);
    if (!fullPath) {
      skipped.push({ relativePath: normalizedLink, reason: "not_found" });
      continue;
    }

    let raw: string;
    try {
      raw = await fs.readFile(fullPath, "utf-8");
    } catch {
      skipped.push({ relativePath: normalizedLink, reason: "read_error" });
      continue;
    }

    const remaining = SKILL_REQUIRED_AUTOLOAD_MAX_CHARS_TOTAL - totalChars;
    const maxForFile = Math.min(SKILL_REQUIRED_AUTOLOAD_MAX_CHARS_PER_FILE, remaining);
    if (maxForFile <= 0) {
      skipped.push({ relativePath: normalizedLink, reason: "char_limit" });
      continue;
    }

    const truncated = raw.length > maxForFile;
    const content = truncated ? raw.slice(0, maxForFile) : raw;
    totalChars += content.length;

    loaded.push({
      relativePath: path.relative(skillDir, fullPath).replace(/\\/g, "/"),
      language: inferLanguageFromPath(fullPath),
      content,
      truncated,
    });
  }

  return {
    detectedLinks: requiredLinks,
    loaded,
    skipped,
  };
}
*/

/*
function formatRequiredResourceSkipReason(reason: RequiredResourceSkipReason): string {
  switch (reason) {
    case "not_found":
      return "not found";
    case "read_error":
      return "read error";
    case "file_limit":
      return `file limit (${SKILL_REQUIRED_AUTOLOAD_MAX_FILES})`;
    case "char_limit":
      return `char limit (${SKILL_REQUIRED_AUTOLOAD_MAX_CHARS_TOTAL})`;
    default:
      return reason;
  }
}
*/

export function createAgentTools(
  context: AgentContext,
  settings: AppSettings
): ToolSet {
  const tools: ToolSet = {};

  tools.response = tool({
    description:
      "Provide your final response to the user. Use this tool when you have the answer or have completed the task. The message will be displayed to the user as your response.",
    inputSchema: z.object({
      message: z
        .string()
        .describe("Your final response message to the user in markdown format"),
    }),
    execute: async ({ message }: { message: string }) => {
      return message;
    },
  });

  tools.list_projects = tool({
    description:
      "List all available projects. Use this when the user asks what projects exist, to browse projects, or before switching projects.",
    inputSchema: z.object({}),
    execute: async () => {
      const projects = await getAllProjects();
      return {
        success: true,
        activeProjectId: context.projectId ?? null,
        activeProjectName: context.projectId
          ? (await getProject(context.projectId))?.name ?? null
          : null,
        count: projects.length,
        projects: projects.map((project) => ({
          id: project.id,
          name: project.name,
          description: project.description,
          updatedAt: project.updatedAt,
        })),
      };
    },
  });

  tools.get_current_project = tool({
    description:
      "Get the currently active project context for this chat, including current folder path and work directory.",
    inputSchema: z.object({}),
    execute: async () => {
      if (!context.projectId) {
        return {
          success: true,
          isGlobal: true,
          projectId: null,
          projectName: null,
          currentPath: normalizeContextPathForOutput(context.currentPath),
          workDir: getWorkDir(undefined),
          message: "No project is selected (global context).",
        };
      }

      const project = await getProject(context.projectId);
      return {
        success: true,
        isGlobal: false,
        projectId: context.projectId,
        projectName: project?.name ?? null,
        currentPath: normalizeContextPathForOutput(context.currentPath),
        workDir: getWorkDir(context.projectId),
      };
    },
  });

  tools.switch_project = tool({
    description:
      "Switch chat context to another project by project ID or name. Use this when the user asks to move to another project.",
    inputSchema: z
      .object({
        project_id: z
          .string()
          .optional()
          .describe("Exact project ID to switch to"),
        project_name: z
          .string()
          .optional()
          .describe("Project name (exact or partial, case-insensitive)"),
      })
      .refine(
        (value: { project_id?: string; project_name?: string }) => Boolean(value.project_id?.trim() || value.project_name?.trim()),
        "Provide project_id or project_name"
      ),
    execute: async ({ project_id, project_name }: { project_id?: string; project_name?: string }) => {
      const projects = await getAllProjects();
      if (projects.length === 0) {
        return {
          success: false,
          action: "switch_project",
          error: "No projects available. Create a project first.",
        };
      }

      const idQuery = project_id?.trim() ?? "";
      const nameQuery = project_name?.trim().toLowerCase() ?? "";
      let target = idQuery
        ? projects.find((project) => project.id === idQuery)
        : undefined;

      if (!target && nameQuery) {
        const exactMatches = projects.filter(
          (project) =>
            project.name.trim().toLowerCase() === nameQuery ||
            project.id.trim().toLowerCase() === nameQuery
        );

        if (exactMatches.length === 1) {
          target = exactMatches[0];
        } else if (exactMatches.length > 1) {
          return {
            success: false,
            action: "switch_project",
            error: `Ambiguous project name \"${project_name}\".`,
            matches: exactMatches.map((project) => ({
              id: project.id,
              name: project.name,
            })),
          };
        }
      }

      if (!target && nameQuery) {
        const partialMatches = projects.filter(
          (project) =>
            project.name.toLowerCase().includes(nameQuery) ||
            project.id.toLowerCase().includes(nameQuery)
        );

        if (partialMatches.length === 1) {
          target = partialMatches[0];
        } else if (partialMatches.length > 1) {
          return {
            success: false,
            action: "switch_project",
            error: `Project query \"${project_name}\" is ambiguous.`,
            matches: partialMatches.map((project) => ({
              id: project.id,
              name: project.name,
            })),
          };
        }
      }

      if (!target) {
        return {
          success: false,
          action: "switch_project",
          error:
            idQuery.length > 0
              ? `Project with id \"${idQuery}\" not found.`
              : `Project \"${project_name}\" not found.`,
          availableProjects: projects.map((project) => ({
            id: project.id,
            name: project.name,
          })),
        };
      }

      return {
        success: true,
        action: "switch_project",
        projectId: target.id,
        projectName: target.name,
        currentPath: "",
        message: `Switching to project \"${target.name}\" (${target.id}).`,
      };
    },
  });

  tools.create_project = tool({
    description:
      "Create a new project workspace. Use this when the user asks to create/add a new project, especially if no project exists yet.",
    inputSchema: z.object({
      name: z.string().describe("Project name (human-readable)"),
      description: z
        .string()
        .optional()
        .describe("Optional project description"),
      instructions: z
        .string()
        .optional()
        .describe("Optional default instructions for the agent in this project"),
      memory_mode: z
        .enum(["global", "isolated"])
        .optional()
        .describe("Project memory mode; default is isolated"),
      project_id: z
        .string()
        .optional()
        .describe("Optional custom project id; if taken, a unique suffix is added"),
    }),
    execute: async ({
      name,
      description,
      instructions,
      memory_mode,
      project_id,
    }: {
      name: string;
      description?: string;
      instructions?: string;
      memory_mode?: "global" | "isolated";
      project_id?: string;
    }) => {
      const trimmedName = name.trim();
      if (!trimmedName) {
        return {
          success: false,
          action: "create_project",
          error: "Project name is required.",
        };
      }

      const preferredId = project_id?.trim()
        ? slugifyProjectId(project_id)
        : slugifyProjectId(trimmedName);
      const id = await allocateProjectId(preferredId);

      try {
        const project = await createProject({
          id,
          name: trimmedName,
          description: (description ?? "").trim(),
          instructions: (instructions ?? "").trim(),
          memoryMode: memory_mode ?? "isolated",
        });
        return {
          success: true,
          action: "create_project",
          projectId: project.id,
          projectName: project.name,
          message: `Project \"${project.name}\" created with id \"${project.id}\".`,
        };
      } catch (error) {
        return {
          success: false,
          action: "create_project",
          error:
            error instanceof Error
              ? error.message
              : "Failed to create project.",
        };
      }
    },
  });

  tools.delete_project = tool({
    description:
      "Delete a project workspace and all its data (memory, chats, skills). Use this when the user asks to delete or remove a project.",
    inputSchema: z.object({
      project_id: z.string().describe("The exact ID of the project to delete"),
    }),
    execute: async ({ project_id }: { project_id: string }) => {
      const trimmedId = project_id.trim();
      if (!trimmedId) {
        return {
          success: false,
          action: "delete_project",
          error: "Project ID is required.",
        };
      }

      if (trimmedId === "none") {
        return {
          success: false,
          action: "delete_project",
          error: "Cannot delete the global project context.",
        };
      }

      const project = await getProject(trimmedId);
      if (!project) {
        return {
          success: false,
          action: "delete_project",
          error: `Project with id "${trimmedId}" not found.`,
        };
      }

      const success = await deleteProject(trimmedId);
      if (success) {
        return {
          success: true,
          action: "delete_project",
          message: `Project "${project.name}" (${trimmedId}) has been successfully deleted.`,
        };
      } else {
        return {
          success: false,
          action: "delete_project",
          error: `Failed to delete project "${project.name}" (${trimmedId}).`,
        };
      }
    },
  });

  if (settings.codeExecution.enabled) {
    tools.code_execution = tool({
      description:
        "Execute code in Python, Node.js, or Shell terminal. Use this to run scripts, install packages, manipulate files, perform calculations, or any task that requires code execution.",
      inputSchema: z.object({
        runtime: z
          .enum(["python", "nodejs", "terminal"])
          .describe(
            "The runtime to use: 'python' for Python code, 'nodejs' for JavaScript/Node.js code, 'terminal' for shell commands"
          ),
        code: z
          .string()
          .describe("The code to execute"),
        session: z
          .number()
          .default(0)
          .describe(
            "Session ID (0-9). Reuse a session to keep terminal working-directory state."
          ),
        background: z
          .boolean()
          .default(false)
          .describe(
            "Run execution in background."
          ),
        yield_ms: z
          .number()
          .int()
          .min(10)
          .max(120000)
          .optional(),
      }),
      execute: async ({
        runtime,
        code,
        session,
        background,
        yield_ms,
      }: {
        runtime: string;
        code: string;
        session: number;
        background?: boolean;
        yield_ms?: number;
      }) => {
        const normalizedCode = code.replace(/\r\n/g, "\n");
        const sanitizedCode = normalizedCode.replace(/\s+$/, "");
        const cwd = resolveContextCwd(context);
        return executeCode(runtime as any, sanitizedCode, session, settings.codeExecution, cwd, {
          background,
          yieldMs: typeof yield_ms === "number" ? yield_ms : undefined,
        });
      },
    });

    tools.install_packages = tool({
      description:
        "Install dependencies with installer fallback logic.",
      inputSchema: z.object({
        kind: z.enum(["auto", "node", "python", "go", "uv", "apt"]).default("auto"),
        packages: z.array(z.string()).min(1),
        prefer_manager: z.string().optional(),
        global: z.boolean().default(false),
        timeout_seconds: z.number().int().min(1).max(1800).default(600),
      }),
      execute: async ({
        kind,
        packages,
        prefer_manager,
        global,
        timeout_seconds,
      }: {
        kind: "auto" | "node" | "python" | "go" | "uv" | "apt";
        packages: string[];
        prefer_manager?: string;
        global?: boolean;
        timeout_seconds?: number;
      }) => {
        const cwd = resolveContextCwd(context);
        return installPackages({
          kind,
          packages,
          preferManager: prefer_manager,
          global,
          cwd,
          timeoutMs: timeout_seconds! * 1000,
        });
      },
    });

    tools.process = tool({
      description: "Manage background sessions.",
      inputSchema: z.object({
        action: z.enum(["list", "poll", "log", "kill", "clear", "remove"]),
        session_id: z.string().optional(),
        timeout_ms: z.number().int().optional(),
        offset: z.number().int().optional(),
        limit: z.number().int().optional(),
      }),
      execute: async ({
        action,
        session_id,
        timeout_ms,
        offset,
        limit,
      }: {
        action: "list" | "poll" | "log" | "kill" | "clear" | "remove";
        session_id?: string;
        timeout_ms?: number;
        offset?: number;
        limit?: number;
      }) => {
        if (action === "list") return { success: true, sessions: listManagedProcessSessions() };
        if (action === "poll") return pollManagedProcessSession(session_id!, timeout_ms);
        if (action === "log") return readManagedProcessSessionLog(session_id!, offset, limit);
        if (action === "kill") return killManagedProcessSession(session_id!);
        if (action === "remove") return removeManagedProcessSession(session_id!);
        return clearFinishedManagedProcessSessions();
      },
    });
  }

  tools.read_text_file = tool({
    description: "Read a local text file.",
    inputSchema: z.object({
      file_path: z.string(),
      start_line: z.number().int().default(1),
      max_lines: z.number().int().default(300),
      max_chars: z.number().int().default(12000),
    }),
    execute: async ({
      file_path,
      start_line,
      max_lines,
      max_chars,
    }: {
      file_path: string;
      start_line: number;
      max_lines: number;
      max_chars: number;
    }) => {
      const resolvedPath = await resolveReadableFilePath(context, file_path);
      const raw = await fs.readFile(resolvedPath, "utf-8");
      const lines = raw.split("\n");
      const selected = lines.slice(start_line - 1, start_line - 1 + max_lines).join("\n");
      return { success: true, content: selected.slice(0, max_chars) };
    },
  });

  tools.write_text_file = tool({
    description: "Write a local text file.",
    inputSchema: z.object({
      file_path: z.string(),
      content: z.string(),
      overwrite: z.boolean().default(true),
    }),
    execute: async ({
      file_path,
      content,
      _overwrite,
    }: {
      file_path: string;
      content: string;
      _overwrite: boolean;
    }) => {
      const resolvedPath = resolveOutgoingFilePath(context, file_path);
      await fs.mkdir(path.dirname(resolvedPath), { recursive: true });
      await fs.writeFile(resolvedPath, content, "utf-8");
      return { success: true, path: resolvedPath };
    },
  });

  if (settings.memory.enabled) {
    tools.memory_save = tool({
      description: "Save information to persistent memory.",
      inputSchema: z.object({
        text: z.string(),
        area: z.enum(["main", "fragments", "solutions", "instruments"]).default("main"),
      }),
      execute: async ({ text, area }: { text: string; area: "main" | "fragments" | "solutions" | "instruments" }) => {
        return memorySave(text, area, context.memorySubdir, settings);
      },
    });

    tools.memory_load = tool({
      description: "Search persistent memory.",
      inputSchema: z.object({
        query: z.string(),
        limit: z.number().default(5),
      }),
      execute: async ({ query, limit }: { query: string; limit: number }) => {
        return memoryLoad(query, limit, context.memorySubdir, settings);
      },
    });

    tools.memory_delete = tool({
      description: "Delete from persistent memory.",
      inputSchema: z.object({
        query: z.string(),
      }),
      execute: async ({ query }: { query: string }) => {
        return memoryDelete(query, context.memorySubdir, settings);
      },
    });

    tools.memory_sync = tool({
      description: "Sync local memory to Supabase. Call this to migrate local history to the cloud.",
      inputSchema: z.object({}),
      execute: async () => {
        return memorySync(context.memorySubdir, settings);
      },
    });
  }

  tools.knowledge_query = tool({
    description: "Search the knowledge base.",
    inputSchema: z.object({
      query: z.string(),
      limit: z.number().default(5),
    }),
    execute: async ({ query, limit }: { query: string; limit: number }) => {
      return knowledgeQuery(query, limit, context.knowledgeSubdirs, settings);
    },
  });

  if ((context.agentNumber ?? 0) < 3) {
    tools.call_subordinate = tool({
      description: "Delegate a subtask.",
      inputSchema: z.object({
        task: z.string(),
        role: z.enum(["orchestrator", "coder", "reviewer", "researcher", "browser"]).optional(),
      }),
      execute: async ({ task, role }: { task: string; role?: "orchestrator" | "coder" | "reviewer" | "researcher" | "browser" }) => {
        return callSubordinate(task, context.projectId, context.agentNumber, context.history, role as any);
      },
    });
  }

  tools.manage_tasks = tool({
    description: "Manage a multi-task plan. Use this to create a plan with sub-tasks, add tasks, and track their status. Ideal for complex workflows like codebase refactoring.",
    inputSchema: z.object({
      action: z.enum(["create_plan", "add_task", "update_task", "get_plan"]),
      goal: z.string().optional().describe("Main goal for create_plan"),
      planId: z.string().optional().describe("Required for all actions except create_plan"),
      task: z.object({
        id: z.string().describe("Unique short ID for the task (e.g. 'ui-1')"),
        title: z.string(),
        description: z.string().describe("Specific instructions for the specialist"),
        role: z.enum(["orchestrator", "coder", "reviewer", "researcher"]),
        dependencies: z.array(z.string()).optional()
      }).optional(),
      status: z.enum(["pending", "in_progress", "completed", "failed"]).optional(),
      result: z.string().optional(),
      error: z.string().optional()
    }),
    execute: async (input: any) => {
      try {
        if (input.action === "create_plan") {
          if (!input.goal) return "Goal is required to create a plan.";
          const plan = await orchestrationService.createPlan(input.goal);
          return `Plan created successfully. ID: ${plan.id}\nGoal: ${plan.goal}`;
        }

        if (!input.planId) return "planId is required.";

        if (input.action === "add_task") {
          if (!input.task) return "task object is required.";
          const _plan = await orchestrationService.addTask(input.planId, input.task as any);
          return `Task "${input.task.id}" added to plan ${input.planId}.`;
        }

        if (input.action === "update_task") {
          if (!input.task?.id || !input.status) return "task.id and status are required.";
          await orchestrationService.updateTaskStatus(input.planId, input.task.id, input.status as any, input.result, input.error);
          return `Task "${input.task.id}" updated to ${input.status} in plan ${input.planId}.`;
        }

        if (input.action === "get_plan") {
          const plan = await orchestrationService.getPlanStatus(input.planId);
          return JSON.stringify(plan, null, 2);
        }

        return "Unknown action.";
      } catch (e) {
        return `Error: ${e instanceof Error ? e.message : String(e)}`;
      }
    }
  });

  return tools;
}

