import {
  ConversationSummarizer,
  SearchEngine,
  StorageOrchestrator
} from "./chunk-JSQBXYDM.js";
import {
  AuthError,
  MemoryError,
  NotFoundError,
  ValidationError,
  configSummary,
  loadConfig
} from "./chunk-JNWCMHOB.js";

// src/server.ts
import { fileURLToPath } from "url";
import { resolve } from "path";

// src/api/router.ts
import { Elysia as Elysia6 } from "elysia";
import { cors } from "@elysiajs/cors";

// src/api/memories.ts
import { Elysia, t } from "elysia";
function memoriesRoutes(orchestrator) {
  return new Elysia({ prefix: "/api/memories" }).post(
    "/",
    async ({ body, set }) => {
      try {
        const result = await orchestrator.createMemory(body);
        set.status = 201;
        return result;
      } catch (error) {
        set.status = 500;
        return {
          error: "Failed to create memory",
          details: error instanceof Error ? error.message : String(error)
        };
      }
    },
    {
      body: t.Object({
        agent_id: t.String(),
        scope: t.Union([
          t.Literal("user"),
          t.Literal("agent"),
          t.Literal("global"),
          t.Literal("project"),
          t.Literal("session")
        ]),
        subject_id: t.Optional(t.Nullable(t.String())),
        content: t.String(),
        tags: t.Optional(t.Array(t.String())),
        source: t.Optional(
          t.Union([
            t.Literal("explicit"),
            t.Literal("derived"),
            t.Literal("observation"),
            t.Literal("conversation_summary"),
            t.Literal("entity_extraction"),
            t.Literal("daily_digest"),
            t.Literal("migration")
          ])
        ),
        created_by: t.Optional(t.Nullable(t.String())),
        extract_entities: t.Optional(t.Boolean()),
        expires_at: t.Optional(t.Nullable(t.String()))
      })
    }
  ).get("/:id", ({ params, set }) => {
    const memory = orchestrator.sqlite.getMemory(params.id);
    if (!memory) {
      set.status = 404;
      return { error: "Memory not found" };
    }
    return memory;
  }).put(
    "/:id",
    async ({ params, body, set }) => {
      try {
        const result = await orchestrator.updateMemory(
          params.id,
          body
        );
        if (!result) {
          set.status = 404;
          return { error: "Memory not found" };
        }
        return result;
      } catch (error) {
        set.status = 500;
        return {
          error: "Failed to update memory",
          details: error instanceof Error ? error.message : String(error)
        };
      }
    },
    {
      body: t.Object({
        content: t.Optional(t.String()),
        tags: t.Optional(t.Array(t.String())),
        scope: t.Optional(
          t.Union([
            t.Literal("user"),
            t.Literal("agent"),
            t.Literal("global"),
            t.Literal("project"),
            t.Literal("session")
          ])
        ),
        subject_id: t.Optional(t.Nullable(t.String())),
        expires_at: t.Optional(t.Nullable(t.String())),
        extract_entities: t.Optional(t.Boolean())
      })
    }
  ).delete("/:id", async ({ params, set }) => {
    try {
      const deleted = await orchestrator.deleteMemory(params.id);
      if (!deleted) {
        set.status = 404;
        return { error: "Memory not found" };
      }
      return { deleted: true, id: params.id };
    } catch (error) {
      set.status = 500;
      return {
        error: "Failed to delete memory",
        details: error instanceof Error ? error.message : String(error)
      };
    }
  }).get("/", ({ query }) => {
    const memories = orchestrator.sqlite.listMemories({
      agent_id: query.agent_id,
      scope: query.scope,
      subject_id: query.subject_id,
      source: query.source,
      tags: query.tags,
      limit: query.limit ? parseInt(String(query.limit), 10) : void 0,
      offset: query.offset ? parseInt(String(query.offset), 10) : void 0,
      order: query.order || "desc"
    });
    return { memories, count: memories.length };
  });
}

// src/api/search.ts
import { Elysia as Elysia2, t as t2 } from "elysia";
var scopeEnum = t2.Union([
  t2.Literal("user"),
  t2.Literal("agent"),
  t2.Literal("global"),
  t2.Literal("project"),
  t2.Literal("session")
]);
function searchRoutes(orchestrator) {
  const searchEngine = new SearchEngine(orchestrator);
  return new Elysia2({ prefix: "/api/search" }).post(
    "/",
    async ({ body, set }) => {
      try {
        const req = body;
        if (!req.agent_id) req.cross_agent = true;
        return await searchEngine.search(req);
      } catch (error) {
        set.status = 500;
        return {
          error: "Search failed",
          details: error instanceof Error ? error.message : String(error)
        };
      }
    },
    {
      body: t2.Object({
        agent_id: t2.Optional(t2.String()),
        query: t2.String(),
        scopes: t2.Optional(t2.Array(scopeEnum)),
        subject_id: t2.Optional(t2.Nullable(t2.String())),
        limit: t2.Optional(t2.Number()),
        include_graph: t2.Optional(t2.Boolean()),
        cross_agent: t2.Optional(t2.Boolean()),
        strategy: t2.Optional(
          t2.Union([
            t2.Literal("auto"),
            t2.Literal("semantic"),
            t2.Literal("fulltext"),
            t2.Literal("graph"),
            t2.Literal("all")
          ])
        )
      })
    }
  ).post(
    "/semantic",
    async ({ body, set }) => {
      try {
        const req = { ...body, strategy: "semantic" };
        if (!req.agent_id) req.cross_agent = true;
        return await searchEngine.search(req);
      } catch (error) {
        set.status = 500;
        return {
          error: "Semantic search failed",
          details: error instanceof Error ? error.message : String(error)
        };
      }
    },
    {
      body: t2.Object({
        agent_id: t2.Optional(t2.String()),
        query: t2.String(),
        scopes: t2.Optional(t2.Array(scopeEnum)),
        subject_id: t2.Optional(t2.Nullable(t2.String())),
        limit: t2.Optional(t2.Number()),
        cross_agent: t2.Optional(t2.Boolean())
      })
    }
  ).post(
    "/graph",
    async ({ body, set }) => {
      try {
        const req = {
          ...body,
          strategy: "graph",
          include_graph: true
        };
        if (!req.agent_id) req.cross_agent = true;
        return await searchEngine.search(req);
      } catch (error) {
        set.status = 500;
        return {
          error: "Graph search failed",
          details: error instanceof Error ? error.message : String(error)
        };
      }
    },
    {
      body: t2.Object({
        agent_id: t2.Optional(t2.String()),
        query: t2.String(),
        scopes: t2.Optional(t2.Array(scopeEnum)),
        subject_id: t2.Optional(t2.Nullable(t2.String())),
        limit: t2.Optional(t2.Number())
      })
    }
  ).post(
    "/fulltext",
    async ({ body, set }) => {
      try {
        const req = {
          ...body,
          strategy: "fulltext",
          include_graph: false
        };
        if (!req.agent_id) req.cross_agent = true;
        return await searchEngine.search(req);
      } catch (error) {
        set.status = 500;
        return {
          error: "Fulltext search failed",
          details: error instanceof Error ? error.message : String(error)
        };
      }
    },
    {
      body: t2.Object({
        agent_id: t2.Optional(t2.String()),
        query: t2.String(),
        scopes: t2.Optional(t2.Array(t2.String())),
        subject_id: t2.Optional(t2.Nullable(t2.String())),
        limit: t2.Optional(t2.Number())
      })
    }
  );
}

// src/api/conversations.ts
import { Elysia as Elysia3, t as t3 } from "elysia";
function conversationRoutes(orchestrator, config) {
  const summarizer = config.extraction ? new ConversationSummarizer({
    apiKey: config.extraction.apiKey,
    baseUrl: config.extraction.baseUrl,
    model: config.extraction.model
  }) : null;
  return new Elysia3({ prefix: "/api/conversations" }).post(
    "/log",
    ({ body, set }) => {
      try {
        orchestrator.sqlite.appendConversationLog(body);
        set.status = 201;
        return { ok: true };
      } catch (error) {
        set.status = 500;
        return {
          error: "Failed to append conversation log",
          details: error instanceof Error ? error.message : String(error)
        };
      }
    },
    {
      body: t3.Object({
        agent_id: t3.String(),
        session_id: t3.String(),
        user_id: t3.String(),
        channel: t3.String(),
        role: t3.Union([
          t3.Literal("user"),
          t3.Literal("assistant"),
          t3.Literal("system")
        ]),
        content: t3.String(),
        timestamp: t3.String()
      })
    }
  ).post(
    "/summarize",
    async ({ body, set }) => {
      if (!summarizer) {
        set.status = 501;
        return { error: "Summarization not available \u2014 extraction config required" };
      }
      try {
        const { agent_id, session_id, user_id, channel, messages } = body;
        const summary = await summarizer.summarize(messages);
        if (!summary) {
          set.status = 422;
          return { error: "Failed to generate summary" };
        }
        const memoryReq = {
          agent_id,
          scope: "session",
          subject_id: user_id,
          content: summary,
          tags: ["conversation_summary", channel, `session:${session_id}`],
          source: "conversation_summary",
          created_by: agent_id,
          extract_entities: true
        };
        const result = await orchestrator.createMemory(memoryReq);
        const response = {
          memory_id: result.id,
          summary,
          entities_extracted: result.entities,
          relationships_created: 0
        };
        set.status = 201;
        return response;
      } catch (error) {
        set.status = 500;
        return {
          error: "Summarization failed",
          details: error instanceof Error ? error.message : String(error)
        };
      }
    },
    {
      body: t3.Object({
        agent_id: t3.String(),
        session_id: t3.String(),
        user_id: t3.String(),
        channel: t3.String(),
        messages: t3.Array(
          t3.Object({
            role: t3.Union([
              t3.Literal("user"),
              t3.Literal("assistant"),
              t3.Literal("system")
            ]),
            content: t3.String(),
            timestamp: t3.String()
          })
        ),
        reason: t3.Optional(t3.String())
      })
    }
  );
}

// src/api/entities.ts
import { Elysia as Elysia4, t as t4 } from "elysia";
function entityRoutes(orchestrator) {
  return new Elysia4({ prefix: "/api/entities" }).get("/:type", async ({ params, query, set }) => {
    if (!orchestrator.age) {
      set.status = 501;
      return { error: "Graph layer not available \u2014 requires Full tier" };
    }
    try {
      const entities = await orchestrator.age.listEntities(
        params.type,
        query.agent_id,
        query.limit ? parseInt(String(query.limit), 10) : 50
      );
      return { entities, count: entities.length };
    } catch (error) {
      set.status = 500;
      return {
        error: "Failed to list entities",
        details: error instanceof Error ? error.message : String(error)
      };
    }
  }).get("/:type/:id", async ({ params, set }) => {
    if (!orchestrator.age) {
      set.status = 501;
      return { error: "Graph layer not available \u2014 requires Full tier" };
    }
    try {
      const result = await orchestrator.age.getEntityWithRelationships(
        params.type,
        params.id
      );
      if (!result.entity) {
        set.status = 404;
        return { error: "Entity not found" };
      }
      return result;
    } catch (error) {
      set.status = 500;
      return {
        error: "Failed to get entity",
        details: error instanceof Error ? error.message : String(error)
      };
    }
  }).get("/:type/:id/related", async ({ params, query, set }) => {
    if (!orchestrator.age) {
      set.status = 501;
      return { error: "Graph layer not available \u2014 requires Full tier" };
    }
    try {
      const depth = query.depth ? parseInt(String(query.depth), 10) : 2;
      const related = await orchestrator.age.getRelatedEntities(
        params.id,
        depth
      );
      return { related, count: related.length };
    } catch (error) {
      set.status = 500;
      return {
        error: "Failed to get related entities",
        details: error instanceof Error ? error.message : String(error)
      };
    }
  }).post(
    "/extract",
    async ({ body, set }) => {
      if (!orchestrator.entityExtractor) {
        set.status = 501;
        return { error: "Entity extraction not available \u2014 requires extraction config" };
      }
      try {
        const result = await orchestrator.entityExtractor.extract(body.text);
        return result;
      } catch (error) {
        set.status = 500;
        return {
          error: "Entity extraction failed",
          details: error instanceof Error ? error.message : String(error)
        };
      }
    },
    {
      body: t4.Object({
        text: t4.String()
      })
    }
  );
}

// src/api/admin.ts
import { Elysia as Elysia5, t as t5 } from "elysia";
import fs from "fs";
import path from "path";
function adminRoutes(orchestrator) {
  return new Elysia5().get("/api/health", async () => {
    return await orchestrator.healthCheck();
  }).post("/api/sync/retry", async ({ set }) => {
    try {
      const result = await orchestrator.retrySyncQueue();
      return result;
    } catch (error) {
      set.status = 500;
      return {
        error: "Sync retry failed",
        details: error instanceof Error ? error.message : String(error)
      };
    }
  }).get("/api/sync/queue", () => {
    const items = orchestrator.sqlite.getSyncQueue(100);
    return { items, count: items.length };
  }).post(
    "/api/admin/migrate-markdown",
    async ({ body, set }) => {
      try {
        const results = await migrateMarkdownFiles(orchestrator, body);
        return results;
      } catch (error) {
        set.status = 500;
        return {
          error: "Migration failed",
          details: error instanceof Error ? error.message : String(error)
        };
      }
    },
    {
      body: t5.Object({
        markdown_paths: t5.Array(t5.String()),
        agent_id: t5.String(),
        dry_run: t5.Optional(t5.Boolean())
      })
    }
  ).post("/api/admin/daily-digest", async ({ set }) => {
    set.status = 501;
    return { error: "Not yet implemented" };
  });
}
async function migrateMarkdownFiles(orchestrator, request) {
  const { markdown_paths, agent_id, dry_run } = request;
  let migrated = 0;
  let skipped = 0;
  const errors = [];
  const memories = [];
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
            content_preview: section.content.slice(0, 100)
          });
          migrated++;
          continue;
        }
        const scope = inferScope(section.heading, fileName);
        const source = inferSource(fileName);
        const tags = inferTags(section.heading, fileName);
        const req = {
          agent_id,
          scope,
          subject_id: null,
          content: section.content.trim(),
          tags,
          source: source || "migration",
          created_by: "migration",
          extract_entities: true
        };
        try {
          const result = await orchestrator.createMemory(req);
          memories.push({
            id: result.id,
            content_preview: section.content.slice(0, 100)
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
function parseMarkdownSections(markdown) {
  const lines = markdown.split("\n");
  const sections = [];
  let currentHeading = "root";
  let currentLevel = 0;
  let currentContent = [];
  for (const line of lines) {
    const headingMatch = line.match(/^(#{1,3})\s+(.+)/);
    if (headingMatch) {
      if (currentContent.length > 0) {
        sections.push({
          heading: currentHeading,
          content: currentContent.join("\n").trim(),
          level: currentLevel
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
      level: currentLevel
    });
  }
  return sections;
}
function inferScope(heading, fileName) {
  const h = heading.toLowerCase();
  const f = fileName.toLowerCase();
  if (h.includes("about") || h.includes("personal")) return "user";
  if (h.includes("project")) return "project";
  if (h.includes("agent")) return "agent";
  if (h.includes("session") || f.match(/^\d{4}-\d{2}-\d{2}/)) return "session";
  return "global";
}
function inferSource(fileName) {
  if (fileName.match(/^\d{4}-\d{2}-\d{2}/)) return "daily_digest";
  return "migration";
}
function inferTags(heading, fileName) {
  const tags = ["migration"];
  if (fileName.match(/^\d{4}-\d{2}-\d{2}/)) {
    tags.push("daily", fileName);
  }
  if (heading !== "root") {
    tags.push(heading.toLowerCase().replace(/[^a-z0-9]+/g, "-"));
  }
  return tags;
}

// src/api/router.ts
function createApp(orchestrator, config) {
  const app = new Elysia6().use(cors()).derive(({ headers, set, path: path2 }) => {
    if (path2 === "/api/health") return {};
    if (!config.auth.enabled || !config.auth.token) return {};
    const authHeader = headers.authorization;
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      set.status = 401;
      throw new AuthError("Missing or invalid Authorization header");
    }
    const token = authHeader.slice(7);
    if (token !== config.auth.token) {
      set.status = 403;
      throw new AuthError("Invalid token");
    }
    return {};
  }).onError(({ code, error, set }) => {
    if (error instanceof AuthError) {
      const status = error.message.includes("Invalid token") ? 403 : 401;
      set.status = status;
      return { error: error.message, code: error.code };
    }
    if (error instanceof NotFoundError) {
      set.status = 404;
      return { error: error.message, code: error.code };
    }
    if (error instanceof ValidationError) {
      set.status = 400;
      return { error: error.message, code: error.code, details: error.details };
    }
    if (error instanceof MemoryError) {
      set.status = 500;
      return { error: error.message, code: error.code };
    }
    if (code === "VALIDATION") {
      const msg2 = error && "message" in error ? error.message : String(error);
      set.status = 400;
      return { error: "Validation error", details: msg2 };
    }
    const msg = error instanceof Error ? error.stack || error.message : String(error);
    console.error(`[api] Unhandled error: ${msg}`);
    set.status = 500;
    return { error: "Internal server error" };
  }).use(memoriesRoutes(orchestrator)).use(searchRoutes(orchestrator)).use(conversationRoutes(orchestrator, config)).use(entityRoutes(orchestrator)).use(adminRoutes(orchestrator));
  return app;
}

// src/server.ts
async function createServer(configPath) {
  const config = await loadConfig(configPath);
  const orchestrator = new StorageOrchestrator(config);
  await orchestrator.init();
  const app = createApp(orchestrator, config);
  return { app, orchestrator, config };
}
async function main() {
  console.log("\u250C\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2510");
  console.log("\u2502       openclaw-memory service v0.1.0      \u2502");
  console.log("\u2502       Triple-Layer Memory System          \u2502");
  console.log("\u2514\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2518");
  const { app, orchestrator, config } = await createServer();
  console.log("[config]");
  console.log(configSummary(config).split("\n").map((l) => `  ${l}`).join("\n"));
  app.listen(config.port);
  console.log(`[server] Listening on http://${config.host}:${config.port}`);
  console.log(`[server] Health check: http://localhost:${config.port}/api/health`);
  const shutdown = async () => {
    console.log("\n[server] Shutting down...");
    await orchestrator.close();
    process.exit(0);
  };
  process.on("SIGINT", shutdown);
  process.on("SIGTERM", shutdown);
}
function isMainModule() {
  try {
    if (typeof globalThis.Bun !== "undefined") {
      const bun = globalThis.Bun;
      return bun.main === fileURLToPath(import.meta.url);
    }
    if (process.argv[1]) {
      return resolve(process.argv[1]) === resolve(fileURLToPath(import.meta.url));
    }
    return false;
  } catch {
    return false;
  }
}
if (isMainModule()) {
  main().catch((error) => {
    console.error("[fatal]", error);
    process.exit(1);
  });
}

export {
  createApp,
  createServer
};
//# sourceMappingURL=chunk-WAIDPAXE.js.map