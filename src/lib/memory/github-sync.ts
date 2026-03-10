import { exec } from "child_process";
import { promisify } from "util";
import path from "path";

const execAsync = promisify(exec);
const MEMORY_DIR = path.join(process.cwd(), "data", "memory");

export interface GitHubSyncConfig {
    remoteUrl: string; // e.g. https://<token>@github.com/user/eggent-memory.git
    branch?: string;
    authorName?: string;
    authorEmail?: string;
}

/**
 * Initialize git in the memory directory if not present
 */
async function ensureGitInit(config: GitHubSyncConfig): Promise<void> {
    try {
        // Check if .git exists
        await execAsync(`git -C "${MEMORY_DIR}" rev-parse --is-inside-work-tree`);
    } catch (e) {
        // Init git
        await execAsync(`git -C "${MEMORY_DIR}" init`);
        await execAsync(`git -C "${MEMORY_DIR}" remote add origin "${config.remoteUrl}"`);

        if (config.authorName) {
            await execAsync(`git -C "${MEMORY_DIR}" config user.name "${config.authorName}"`);
        }
        if (config.authorEmail) {
            await execAsync(`git -C "${MEMORY_DIR}" config user.email "${config.authorEmail}"`);
        }
    }
}

/**
 * Pull latest memory changes from GitHub
 */
export async function pullMemoryFromGitHub(config: GitHubSyncConfig): Promise<{ success: boolean; output?: string; error?: string }> {
    try {
        await ensureGitInit(config);
        const branch = config.branch || "main";
        // Fetch and rebase/merge to avoid diverge
        await execAsync(`git -C "${MEMORY_DIR}" pull origin ${branch} --rebase`);
        return { success: true };
    } catch (error) {
        return { success: false, error: error instanceof Error ? error.message : String(error) };
    }
}

/**
 * Push current memory state to GitHub
 */
export async function pushMemoryToGitHub(config: GitHubSyncConfig, commitMessage: string = "Auto-sync memory"): Promise<{ success: boolean; error?: string }> {
    try {
        await ensureGitInit(config);
        const branch = config.branch || "main";
        await execAsync(`git -C "${MEMORY_DIR}" add .`);

        // Check if there are changes to commit
        try {
            await execAsync(`git -C "${MEMORY_DIR}" commit -m "${commitMessage}"`);
        } catch (commitErr: any) {
            // If no changes, commit will fail with exit code 1, which is fine
            if (!commitErr.message.includes("nothing to commit")) {
                throw commitErr;
            }
        }

        await execAsync(`git -C "${MEMORY_DIR}" push origin ${branch}`);
        return { success: true };
    } catch (error) {
        return { success: false, error: error instanceof Error ? error.message : String(error) };
    }
}
