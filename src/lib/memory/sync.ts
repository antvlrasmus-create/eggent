import { getLocalMemories } from "./memory";
import { insertMemory, isSupabaseAvailable } from "./supabase-memory";
import type { AppSettings } from "@/lib/types";

/**
 * Sync local memory to Supabase
 * This will read all local memories and insert them into Supabase
 * Note: it won't check for duplicates, so use only for migration.
 */
export async function syncLocalToSupabase(
  subdir: string,
  settings: AppSettings
): Promise<{ success: boolean; migrated: number; total: number; error?: string }> {
  if (!isSupabaseAvailable()) {
    return { success: false, migrated: 0, total: 0, error: "Supabase not configured" };
  }

  try {
    const localMemories = await getLocalMemories(subdir);
    if (localMemories.length === 0) {
      return { success: true, migrated: 0, total: 0 };
    }

    let migratedCount = 0;
    for (const mem of localMemories) {
      try {
        const area = (mem.metadata.area as string) || "main";
        await insertMemory(mem.text, area, subdir, settings, mem.metadata);
        migratedCount++;
      } catch (e) {
        console.error(`Failed to migrate memory ${mem.id}:`, e);
      }
    }

    return { success: true, migrated: migratedCount, total: localMemories.length };
  } catch (error) {
    return { 
      success: false, 
      migrated: 0, 
      total: 0, 
      error: error instanceof Error ? error.message : String(error) 
    };
  }
}
