import { createClient } from "webdav";
import type { AppSettings } from "@/lib/types";
import { insertMemory } from "./memory";
import fs from "fs/promises";
import path from "path";
import crypto from "crypto";

export interface ObsidianSyncConfig {
    webdavUrl: string;
    username: string;
    password?: string;
    remoteDir: string;
}

const SYNC_STATE_FILE = path.join(process.cwd(), "data", "memory", "obsidian_sync_state.json");

interface SyncState {
    lastSyncTime: string;
    fileHashes: Record<string, string>;
}

async function loadSyncState(): Promise<SyncState> {
    try {
        const data = await fs.readFile(SYNC_STATE_FILE, "utf-8");
        return JSON.parse(data);
    } catch {
        return { lastSyncTime: new Date(0).toISOString(), fileHashes: {} };
    }
}

async function saveSyncState(state: SyncState): Promise<void> {
    await fs.mkdir(path.dirname(SYNC_STATE_FILE), { recursive: true });
    await fs.writeFile(SYNC_STATE_FILE, JSON.stringify(state, null, 2), "utf-8");
}

function computeHash(content: string): string {
    return crypto.createHash("sha256").update(content).digest("hex");
}

function chunkText(text: string, maxTokens: number = 500): string[] {
    // Simple paragraph-based chunking for Obsidian notes
    const paragraphs = text.split(/\n\n+/);
    const chunks: string[] = [];
    let currentChunk = "";

    for (const p of paragraphs) {
        if ((currentChunk.length + p.length) > maxTokens * 4) { // Fast approx
            if (currentChunk.trim()) chunks.push(currentChunk.trim());
            currentChunk = p;
        } else {
            currentChunk += (currentChunk ? "\n\n" : "") + p;
        }
    }
    if (currentChunk.trim()) {
        chunks.push(currentChunk.trim());
    }
    return chunks;
}

/**
 * Connect to Yandex WebDAV and sync all markdown files
 * under the configured remote directory into Eggent's memory.
 */
export async function syncObsidianWebDAV(
    config: ObsidianSyncConfig,
    settings: AppSettings,
    projectId?: string
): Promise<{ success: boolean; syncedFiles: number; error?: string }> {
    try {
        if (!config.password) {
            throw new Error("WebDAV password (app password) is required");
        }

        const client = createClient(config.webdavUrl, {
            username: config.username,
            password: config.password,
        });

        // Check if remote dir exists
        const exists = await client.exists(config.remoteDir);
        if (!exists) {
            throw new Error(`Remote directory ${config.remoteDir} does not exist`);
        }

        const state = await loadSyncState();
        let syncedFilesCount = 0;
        const newFileHashes: Record<string, string> = {};

        // Recursively read all files (markdown)
        const items = await client.getDirectoryContents(config.remoteDir, { deep: true });

        // Array type depending on webdav version, handle safely
        const files = Array.isArray(items) ? items : [items];

        for (const file of files as any[]) {
            if (file.type !== "file") continue;
            if (!file.filename.toLowerCase().endsWith(".md")) continue;
            // Download content
            const buff = await client.getFileContents(file.filename);
            // Handle arraybuffer or buffer
            let content = "";
            if (buff instanceof ArrayBuffer) {
                content = Buffer.from(buff).toString("utf-8");
            } else if (Buffer.isBuffer(buff)) {
                content = buff.toString("utf-8");
            } else if (typeof buff === "string") {
                content = buff; // Just in case it returns string
            } else {
                content = Buffer.from(buff as any).toString("utf-8");
            }

            const currentHash = computeHash(content);
            newFileHashes[file.filename] = currentHash;

            // Deduplication: skip if content hasn't changed
            if (state.fileHashes[file.filename] === currentHash) {
                continue;
            }

            // It's changed or new. We need to index it.
            // (Optional: we would delete old chunks, but for now we just insert or rely on pgvector replace mechanics in next steps)

            const chunks = chunkText(content);
            const subdir = projectId ? projectId : "main";

            for (let i = 0; i < chunks.length; i++) {
                await insertMemory(chunks[i], "obsidian", subdir, settings, {
                    source: "(Obsidian WebDAV)",
                    filename: path.basename(file.filename),
                    filepath: file.filename,
                    chunkIndex: i,
                });
            }

            syncedFilesCount++;
        }

        // Update state
        state.fileHashes = newFileHashes;
        state.lastSyncTime = new Date().toISOString();
        await saveSyncState(state);

        return { success: true, syncedFiles: syncedFilesCount };

    } catch (error) {
        console.error("Obsidian WebDAV Sync failed:", error);
        return {
            success: false,
            syncedFiles: 0,
            error: error instanceof Error ? error.message : String(error),
        };
    }
}
