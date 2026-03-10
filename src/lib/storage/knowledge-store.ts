import fs from "fs/promises";
import path from "path";

export interface KnowledgeMetadata {
    title: string;
    summary: string;
    created_at: string;
    updated_at: string;
    references: string[]; // List of plan IDs or chat IDs
}

const KNOWLEDGE_DIR = path.join(process.cwd(), "data", "knowledge");

export async function saveKnowledge(id: string, metadata: KnowledgeMetadata, artifacts: { name: string, content: string }[]): Promise<void> {
    const kiDir = path.join(KNOWLEDGE_DIR, id);
    const artifactsDir = path.join(kiDir, "artifacts");

    await fs.mkdir(artifactsDir, { recursive: true });

    // Save metadata
    await fs.writeFile(
        path.join(kiDir, "metadata.json"),
        JSON.stringify(metadata, null, 2),
        "utf-8"
    );

    // Save artifacts
    for (const artifact of artifacts) {
        await fs.writeFile(
            path.join(artifactsDir, artifact.name),
            artifact.content,
            "utf-8"
        );
    }
}

export async function getKnowledge(id: string): Promise<{ metadata: KnowledgeMetadata, artifacts: string[] } | null> {
    const kiDir = path.join(KNOWLEDGE_DIR, id);
    try {
        const metadataRaw = await fs.readFile(path.join(kiDir, "metadata.json"), "utf-8");
        const metadata = JSON.parse(metadataRaw);
        const artifactFiles = await fs.readdir(path.join(kiDir, "artifacts"));
        return { metadata, artifacts: artifactFiles };
    } catch {
        return null;
    }
}

export async function listKnowledge(): Promise<{ id: string, title: string, summary: string }[]> {
    try {
        const dirs = await fs.readdir(KNOWLEDGE_DIR);
        const result = [];
        for (const id of dirs) {
            const ki = await getKnowledge(id);
            if (ki) {
                result.push({
                    id,
                    title: ki.metadata.title,
                    summary: ki.metadata.summary
                });
            }
        }
        return result;
    } catch {
        return [];
    }
}
