import { Elysia, t } from "elysia";
import fs from "node:fs";
import path from "node:path";
import type { StorageOrchestrator } from "../storage/orchestrator.js";
import type { CreateMemoryRequest, MigrateMarkdownRequest } from "../core/types.js";

// ── Admin Routes ────────────────────────────────────────────────────────

export function adminRoutes(orchestrator: StorageOrchestrator) {
  return new Elysia()
    // GET /api/health — Health check
    .get("/api/health", async () => {
      return await orchestrator.healthCheck();
    })

    // POST /api/sync/retry — Retry failed L2/L3 syncs
    .post("/api/sync/retry", async ({ set }) => {
      try {
        const result = await orchestrator.retrySyncQueue();
        return result;
      } catch (error) {
        set.status = 500;
        return {
          error: "Sync retry failed",
          details: error instanceof Error ? error.message : String(error),
        };
      }
    })

    // GET /api/sync/queue — View pending sync queue
    .get("/api/sync/queue", () => {
      const items = orchestrator.sqlite.getSyncQueue(100);
      return { items, count: items.length };
    })

    // POST /api/admin/migrate-markdown — Migrate markdown files
    .post(
      "/api/admin/migrate-markdown",
      async ({ body, set }) => {
        try {
          const results = await migrateMarkdownFiles(orchestrator, body);
          return results;
        } catch (error) {
          set.status = 500;
          return {
            error: "Migration failed",
            details: error instanceof Error ? error.message : String(error),
          };
        }
      },
      {
        body: t.Object({
          markdown_paths: t.Array(t.String()),
          agent_id: t.String(),
          dry_run: t.Optional(t.Boolean()),
        }),
      }
    )

    // POST /api/admin/daily-digest — Trigger daily digest
    .post("/api/admin/daily-digest", async ({ set }) => {
      set.status = 501;
      return { error: "Not yet implemented" };
    });
}

// ── Markdown Migration ──────────────────────────────────────────────────

async function migrateMarkdownFiles(
  orchestrator: StorageOrchestrator,
  request: MigrateMarkdownRequest
): Promise<{
  migrated: number;
  skipped: number;
  errors: string[];
  memories: Array<{ id: string; content_preview: string }>;
}> {
  const { markdown_paths, agent_id, dry_run } = request;
  let migrated = 0;
  let skipped = 0;
  const errors: string[] = [];
  const memories: Array<{ id: string; content_preview: string }> = [];

  for (const filePath of markdown_paths) {
    try {
      if (!fs.existsSync(filePath)) {
        errors.push(`File not found: ${filePath}`);
        skipped++;
        continue;
      }

      const content = fs.readFileSync(filePath, "utf-8");
      const fileName = path.basename(filePath, ".md");
      const sections = parseMarkdownSections(content);

      for (const section of sections) {
        if (section.content.trim().length < 10) {
          skipped++;
          continue;
        }

        if (dry_run) {
          memories.push({
            id: "(dry-run)",
            content_preview: section.content.slice(0, 100),
          });
          migrated++;
          continue;
        }

        const scope = inferScope(section.heading, fileName);
        const source = inferSource(fileName);
        const tags = inferTags(section.heading, fileName);

        const req: CreateMemoryRequest = {
          agent_id,
          scope,
          subject_id: null,
          content: section.content.trim(),
          tags,
          source: source || "migration",
          created_by: "migration",
          extract_entities: true,
        };

        try {
          const result = await orchestrator.createMemory(req);
          memories.push({
            id: result.id,
            content_preview: section.content.slice(0, 100),
          });
          migrated++;
        } catch (error) {
          errors.push(
            `Failed to migrate section "${section.heading}": ${error instanceof Error ? error.message : String(error)}`
          );
        }
      }
    } catch (error) {
      errors.push(
        `Failed to process ${filePath}: ${error instanceof Error ? error.message : String(error)}`
      );
    }
  }

  return { migrated, skipped, errors, memories };
}

// ── Markdown Parsing Helpers ────────────────────────────────────────────

interface MarkdownSection {
  heading: string;
  content: string;
  level: number;
}

function parseMarkdownSections(markdown: string): MarkdownSection[] {
  const lines = markdown.split("\n");
  const sections: MarkdownSection[] = [];
  let currentHeading = "root";
  let currentLevel = 0;
  let currentContent: string[] = [];

  for (const line of lines) {
    const headingMatch = line.match(/^(#{1,3})\s+(.+)/);
    if (headingMatch) {
      if (currentContent.length > 0) {
        sections.push({
          heading: currentHeading,
          content: currentContent.join("\n").trim(),
          level: currentLevel,
        });
      }
      currentHeading = headingMatch[2].trim();
      currentLevel = headingMatch[1].length;
      currentContent = [];
    } else {
      currentContent.push(line);
    }
  }

  if (currentContent.length > 0) {
    sections.push({
      heading: currentHeading,
      content: currentContent.join("\n").trim(),
      level: currentLevel,
    });
  }

  return sections;
}

function inferScope(heading: string, fileName: string): CreateMemoryRequest["scope"] {
  const h = heading.toLowerCase();
  const f = fileName.toLowerCase();

  if (h.includes("about") || h.includes("personal")) return "user";
  if (h.includes("project")) return "project";
  if (h.includes("agent")) return "agent";
  if (h.includes("session") || f.match(/^\d{4}-\d{2}-\d{2}/)) return "session";
  return "global";
}

function inferSource(fileName: string): CreateMemoryRequest["source"] | null {
  if (fileName.match(/^\d{4}-\d{2}-\d{2}/)) return "daily_digest";
  return "migration";
}

function inferTags(heading: string, fileName: string): string[] {
  const tags: string[] = ["migration"];
  if (fileName.match(/^\d{4}-\d{2}-\d{2}/)) {
    tags.push("daily", fileName);
  }
  if (heading !== "root") {
    tags.push(heading.toLowerCase().replace(/[^a-z0-9]+/g, "-"));
  }
  return tags;
}
