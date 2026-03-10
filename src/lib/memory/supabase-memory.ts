import { createClient } from "@supabase/supabase-js";
import { embedTexts } from "@/lib/memory/embeddings";
import type { AppSettings } from "@/lib/types";

const supabaseUrl = process.env.SUPABASE_URL || "";
const supabaseServiceKey = process.env.SUPABASE_SERVICE_KEY || "";

const supabase = (supabaseUrl && supabaseServiceKey)
  ? createClient(supabaseUrl, supabaseServiceKey)
  : null;

/**
 * Check if Supabase memory is available and configured
 */
export function isSupabaseAvailable(): boolean {
  return !!supabase;
}

/**
 * Insert text into the Supabase vector database
 */
export async function insertMemory(
  text: string,
  area: string,
  subdir: string,
  settings: AppSettings,
  additionalMetadata: Record<string, unknown> = {}
): Promise<string> {
  if (!supabase) throw new Error("Supabase is not configured");

  const embeddings = await embedTexts([text], settings.embeddingsModel);
  if (!embeddings || embeddings.length === 0) {
    throw new Error("Failed to generate embedding");
  }

  const { data, error } = await supabase
    .from("eggent_memory")
    .insert({
      text,
      embedding: embeddings[0],
      metadata: { ...additionalMetadata, area },
      subdir,
    })
    .select("id")
    .single();

  if (error) throw error;
  return data.id;
}

/**
 * Search for similar documents in Supabase
 */
export async function searchMemory(
  query: string,
  limit: number,
  threshold: number,
  subdir: string,
  settings: AppSettings,
  areaFilter?: string
): Promise<{ id: string; text: string; score: number; metadata: Record<string, unknown> }[]> {
  if (!supabase) return [];

  const embeddings = await embedTexts([query], settings.embeddingsModel);
  if (!embeddings || embeddings.length === 0) return [];

  const { data, error } = await supabase.rpc("match_memories", {
    query_embedding: embeddings[0],
    match_threshold: threshold,
    match_count: limit,
    p_subdir: subdir,
    p_area: areaFilter || null,
  });

  if (error) {
    console.error("Supabase search error:", error);
    return [];
  }

  return (data || []).map((r: any) => ({
    id: r.id,
    text: r.text,
    score: r.similarity,
    metadata: r.metadata,
  }));
}

/**
 * Delete documents by query (finds similar and removes)
 */
export async function deleteMemoryByQuery(
  query: string,
  subdir: string,
  settings: AppSettings
): Promise<number> {
  if (!supabase) return 0;

  const matches = await searchMemory(query, 5, 0.8, subdir, settings);
  if (matches.length === 0) return 0;

  const idsToDelete = matches.map((m) => m.id);
  const { error, count } = await supabase
    .from("eggent_memory")
    .delete({ count: "exact" })
    .in("id", idsToDelete)
    .eq("subdir", subdir);

  if (error) throw error;
  return count || idsToDelete.length;
}

/**
 * Delete a specific document by ID
 */
export async function deleteMemoryById(
  id: string,
  subdir: string
): Promise<boolean> {
  if (!supabase) return false;

  const { error, count } = await supabase
    .from("eggent_memory")
    .delete({ count: "exact" })
    .eq("id", id)
    .eq("subdir", subdir);

  if (error) throw error;
  return (count || 0) > 0;
}

/**
 * Delete documents by metadata key/value match
 */
export async function deleteMemoryByMetadata(
  key: string,
  value: unknown,
  subdir: string
): Promise<number> {
  if (!supabase) return 0;

  const { error, count } = await supabase
    .from("eggent_memory")
    .delete({ count: "exact" })
    .eq(`metadata->>${key}`, value)
    .eq("subdir", subdir);

  if (error) throw error;
  return count || 0;
}

/**
 * Get all memory entries
 */
export async function getAllMemories(
  subdir: string
): Promise<{ id: string; text: string; metadata: Record<string, unknown> }[]> {
  if (!supabase) return [];

  const { data, error } = await supabase
    .from("eggent_memory")
    .select("id, text, metadata")
    .eq("subdir", subdir)
    .order("created_at", { ascending: false });

  if (error) throw error;
  return data || [];
}

const KNOWLEDGE_AREA = "knowledge";
const FILENAME_META = "filename";

/**
 * Get chunk counts per filename for knowledge area from Supabase
 */
export async function getChunkCountsByFilename(
  subdir: string
): Promise<Record<string, number>> {
  if (!supabase) return {};

  const { data, error } = await supabase
    .from("eggent_memory")
    .select("metadata->filename")
    .eq("subdir", subdir)
    .eq("metadata->>area", KNOWLEDGE_AREA);

  if (error) throw error;

  const counts: Record<string, number> = {};
  for (const row of (data || [])) {
    const name = row.filename;
    if (typeof name === "string") {
      counts[name] = (counts[name] ?? 0) + 1;
    }
  }
  return counts;
}

/**
 * Get all chunks for a given knowledge file (by filename)
 */
export async function getChunksByFilename(
  subdir: string,
  filename: string
): Promise<{ id: string; text: string; index: number }[]> {
  if (!supabase) return [];

  const { data, error } = await supabase
    .from("eggent_memory")
    .select("id, text")
    .eq("subdir", subdir)
    .eq("metadata->>area", KNOWLEDGE_AREA)
    .eq("metadata->>filename", filename)
    .order("created_at", { ascending: true });

  if (error) throw error;

  return (data || []).map((d, i) => ({
    id: d.id,
    text: d.text,
    index: i + 1,
  }));
}
