import { syncObsidianWebDAV, ObsidianSyncConfig } from "./obsidian-sync";
import { pushMemoryToGitHub, pullMemoryFromGitHub } from "./github-sync";
import { getSettings } from "@/lib/storage/settings-store";

/**
 * SyncManager coordinates data synchronizations across various sources 
 * (Obsidian via WebDAV, GitHub Memory sync, etc).
 */
export class SyncManager {
    private isSyncing = false;

    constructor() { }

    /**
     * Performs an Obsidian WebDAV sync if configured in settings/env.
     */
    async syncObsidian(projectId?: string): Promise<{ success: boolean; synced: number; error?: string }> {
        if (this.isSyncing) return { success: false, synced: 0, error: "Sync already in progress" };

        // In actual implementation, these should be securely stored in DB or .env
        const url = process.env.YANDEX_WEBDAV_URL;
        const user = process.env.YANDEX_WEBDAV_USER;
        const pass = process.env.YANDEX_WEBDAV_PASSWORD;
        const dir = process.env.YANDEX_WEBDAV_DIR || "/Obsidian";

        if (!url || !user || !pass) {
            return { success: false, synced: 0, error: "WebDAV credentials not found in environment." };
        }

        const config: ObsidianSyncConfig = {
            webdavUrl: url,
            username: user,
            password: pass,
            remoteDir: dir,
        };

        try {
            this.isSyncing = true;
            const settings = await getSettings();
            const result = await syncObsidianWebDAV(config, settings, projectId);
            return { success: result.success, synced: result.syncedFiles, error: result.error };
        } finally {
            this.isSyncing = false;
        }
    }

    /**
     * Pulls remote memory state from GitHub
     */
    async pullMemoryGitHub(): Promise<{ success: boolean; error?: string }> {
        const remoteUrl = process.env.GITHUB_MEMORY_REPO_URL;
        if (!remoteUrl) return { success: false, error: "GitHub remote URL not found" };

        return pullMemoryFromGitHub({
            remoteUrl,
            branch: process.env.GITHUB_MEMORY_BRANCH || "main",
        });
    }

    /**
     * Pushes current memory state to GitHub
     */
    async pushMemoryGitHub(reason: string = "Auto-sync memory"): Promise<{ success: boolean; error?: string }> {
        const remoteUrl = process.env.GITHUB_MEMORY_REPO_URL;
        if (!remoteUrl) return { success: false, error: "GitHub remote URL not found" };

        return pushMemoryToGitHub({
            remoteUrl,
            branch: process.env.GITHUB_MEMORY_BRANCH || "main",
            authorName: process.env.GITHUB_MEMORY_AUTHOR_NAME || "Eggent Sync",
            authorEmail: process.env.GITHUB_MEMORY_AUTHOR_EMAIL,
        }, reason);
    }

    /**
     * Runs a full sync (WebDAV -> local -> Supabase -> GitHub)
     */
    async fullSync(projectId?: string): Promise<{ success: boolean; logs: string[] }> {
        const logs: string[] = [];

        // 1. Pull Memory from GitHub
        logs.push("Pulling memory from GitHub...");
        const pullResult = await this.pullMemoryGitHub();
        if (pullResult.success) logs.push("GitHub pull successful");
        else logs.push(`GitHub pull failed or skipped: ${pullResult.error}`);

        // 2. Sync from Obsidian
        logs.push("Syncing Obsidian WebDAV notes...");
        const obResult = await this.syncObsidian(projectId);
        if (obResult.success) logs.push(`Obsidian sync verified/synced ${obResult.synced} files.`);
        else logs.push(`Obsidian sync failed or skipped: ${obResult.error}`);

        // 3. Push resulting local vector memory to GitHub (saving changes from Obsidian indexing / normal usage)
        // Only conditionally push if a save was triggered. (Often handled on-save incrementally)
        logs.push("Pushing data to GitHub...");
        const pushResult = await this.pushMemoryGitHub("Full Sync Update");
        if (pushResult.success) logs.push("GitHub push successful");
        else logs.push(`GitHub push failed or skipped: ${pushResult.error}`);

        return { success: true, logs };
    }
}

export const syncManager = new SyncManager();
