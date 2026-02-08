"use strict";Object.defineProperty(exports, "__esModule", {value: true}); function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }



var _chunkCRPEAZ44cjs = require('./chunk-CRPEAZ44.cjs');







var _chunkZY2C2CJQcjs = require('./chunk-ZY2C2CJQ.cjs');

// src/server.ts
var _url = require('url');
var _path = require('path'); var _path2 = _interopRequireDefault(_path);

// src/api/router.ts
var _elysia = require('elysia');
var _cors = require('@elysiajs/cors');

// src/api/memories.ts

function memoriesRoutes(orchestrator) {
  return new (0, _elysia.Elysia)({ prefix: "/api/memories" }).post(
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
      body: _elysia.t.Object({
        agent_id: _elysia.t.String(),
        scope: _elysia.t.Union([
          _elysia.t.Literal("user"),
          _elysia.t.Literal("agent"),
          _elysia.t.Literal("global"),
          _elysia.t.Literal("project"),
          _elysia.t.Literal("session")
        ]),
        subject_id: _elysia.t.Optional(_elysia.t.Nullable(_elysia.t.String())),
        content: _elysia.t.String(),
        tags: _elysia.t.Optional(_elysia.t.Array(_elysia.t.String())),
        source: _elysia.t.Optional(
          _elysia.t.Union([
            _elysia.t.Literal("explicit"),
            _elysia.t.Literal("derived"),
            _elysia.t.Literal("observation"),
            _elysia.t.Literal("conversation_summary"),
            _elysia.t.Literal("entity_extraction"),
            _elysia.t.Literal("daily_digest"),
            _elysia.t.Literal("migration")
          ])
        ),
        created_by: _elysia.t.Optional(_elysia.t.Nullable(_elysia.t.String())),
        extract_entities: _elysia.t.Optional(_elysia.t.Boolean()),
        expires_at: _elysia.t.Optional(_elysia.t.Nullable(_elysia.t.String()))
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
      body: _elysia.t.Object({
        content: _elysia.t.Optional(_elysia.t.String()),
        tags: _elysia.t.Optional(_elysia.t.Array(_elysia.t.String())),
        scope: _elysia.t.Optional(
          _elysia.t.Union([
            _elysia.t.Literal("user"),
            _elysia.t.Literal("agent"),
            _elysia.t.Literal("global"),
            _elysia.t.Literal("project"),
            _elysia.t.Literal("session")
          ])
        ),
        subject_id: _elysia.t.Optional(_elysia.t.Nullable(_elysia.t.String())),
        expires_at: _elysia.t.Optional(_elysia.t.Nullable(_elysia.t.String())),
        extract_entities: _elysia.t.Optional(_elysia.t.Boolean())
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

var scopeEnum = _elysia.t.Union([
  _elysia.t.Literal("user"),
  _elysia.t.Literal("agent"),
  _elysia.t.Literal("global"),
  _elysia.t.Literal("project"),
  _elysia.t.Literal("session")
]);
function searchRoutes(orchestrator) {
  const searchEngine = new (0, _chunkCRPEAZ44cjs.SearchEngine)(orchestrator);
  return new (0, _elysia.Elysia)({ prefix: "/api/search" }).post(
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
      body: _elysia.t.Object({
        agent_id: _elysia.t.Optional(_elysia.t.String()),
        query: _elysia.t.String(),
        scopes: _elysia.t.Optional(_elysia.t.Array(scopeEnum)),
        subject_id: _elysia.t.Optional(_elysia.t.Nullable(_elysia.t.String())),
        limit: _elysia.t.Optional(_elysia.t.Number()),
        include_graph: _elysia.t.Optional(_elysia.t.Boolean()),
        cross_agent: _elysia.t.Optional(_elysia.t.Boolean()),
        strategy: _elysia.t.Optional(
          _elysia.t.Union([
            _elysia.t.Literal("auto"),
            _elysia.t.Literal("semantic"),
            _elysia.t.Literal("fulltext"),
            _elysia.t.Literal("graph"),
            _elysia.t.Literal("all")
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
      body: _elysia.t.Object({
        agent_id: _elysia.t.Optional(_elysia.t.String()),
        query: _elysia.t.String(),
        scopes: _elysia.t.Optional(_elysia.t.Array(scopeEnum)),
        subject_id: _elysia.t.Optional(_elysia.t.Nullable(_elysia.t.String())),
        limit: _elysia.t.Optional(_elysia.t.Number()),
        cross_agent: _elysia.t.Optional(_elysia.t.Boolean())
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
      body: _elysia.t.Object({
        agent_id: _elysia.t.Optional(_elysia.t.String()),
        query: _elysia.t.String(),
        scopes: _elysia.t.Optional(_elysia.t.Array(scopeEnum)),
        subject_id: _elysia.t.Optional(_elysia.t.Nullable(_elysia.t.String())),
        limit: _elysia.t.Optional(_elysia.t.Number())
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
      body: _elysia.t.Object({
        agent_id: _elysia.t.Optional(_elysia.t.String()),
        query: _elysia.t.String(),
        scopes: _elysia.t.Optional(_elysia.t.Array(_elysia.t.String())),
        subject_id: _elysia.t.Optional(_elysia.t.Nullable(_elysia.t.String())),
        limit: _elysia.t.Optional(_elysia.t.Number())
      })
    }
  );
}

// src/api/conversations.ts

function conversationRoutes(orchestrator, config) {
  const summarizer = config.extraction ? new (0, _chunkCRPEAZ44cjs.ConversationSummarizer)({
    apiKey: config.extraction.apiKey,
    baseUrl: config.extraction.baseUrl,
    model: config.extraction.model
  }) : null;
  return new (0, _elysia.Elysia)({ prefix: "/api/conversations" }).post(
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
      body: _elysia.t.Object({
        agent_id: _elysia.t.String(),
        session_id: _elysia.t.String(),
        user_id: _elysia.t.String(),
        channel: _elysia.t.String(),
        role: _elysia.t.Union([
          _elysia.t.Literal("user"),
          _elysia.t.Literal("assistant"),
          _elysia.t.Literal("system")
        ]),
        content: _elysia.t.String(),
        timestamp: _elysia.t.String()
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
      body: _elysia.t.Object({
        agent_id: _elysia.t.String(),
        session_id: _elysia.t.String(),
        user_id: _elysia.t.String(),
        channel: _elysia.t.String(),
        messages: _elysia.t.Array(
          _elysia.t.Object({
            role: _elysia.t.Union([
              _elysia.t.Literal("user"),
              _elysia.t.Literal("assistant"),
              _elysia.t.Literal("system")
            ]),
            content: _elysia.t.String(),
            timestamp: _elysia.t.String()
          })
        ),
        reason: _elysia.t.Optional(_elysia.t.String())
      })
    }
  );
}

// src/api/entities.ts

function entityRoutes(orchestrator) {
  return new (0, _elysia.Elysia)({ prefix: "/api/entities" }).get("/:type", async ({ params, query, set }) => {
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
      body: _elysia.t.Object({
        text: _elysia.t.String()
      })
    }
  );
}

// src/api/admin.ts

var _fs = require('fs'); var _fs2 = _interopRequireDefault(_fs);

function adminRoutes(orchestrator) {
  return new (0, _elysia.Elysia)().get("/api/health", async () => {
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
      body: _elysia.t.Object({
        markdown_paths: _elysia.t.Array(_elysia.t.String()),
        agent_id: _elysia.t.String(),
        dry_run: _elysia.t.Optional(_elysia.t.Boolean())
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
      if (!_fs2.default.existsSync(filePath)) {
        errors.push(`File not found: ${filePath}`);
        skipped++;
        continue;
      }
      const content = _fs2.default.readFileSync(filePath, "utf-8");
      const fileName = _path2.default.basename(filePath, ".md");
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
  const app = new (0, _elysia.Elysia)().use(_cors.cors.call(void 0, )).derive(({ headers, set, path: path2 }) => {
    if (path2 === "/api/health") return {};
    if (!config.auth.enabled || !config.auth.token) return {};
    const authHeader = headers.authorization;
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      set.status = 401;
      throw new (0, _chunkZY2C2CJQcjs.AuthError)("Missing or invalid Authorization header");
    }
    const token = authHeader.slice(7);
    if (token !== config.auth.token) {
      set.status = 403;
      throw new (0, _chunkZY2C2CJQcjs.AuthError)("Invalid token");
    }
    return {};
  }).onError(({ code, error, set }) => {
    if (error instanceof _chunkZY2C2CJQcjs.AuthError) {
      const status = error.message.includes("Invalid token") ? 403 : 401;
      set.status = status;
      return { error: error.message, code: error.code };
    }
    if (error instanceof _chunkZY2C2CJQcjs.NotFoundError) {
      set.status = 404;
      return { error: error.message, code: error.code };
    }
    if (error instanceof _chunkZY2C2CJQcjs.ValidationError) {
      set.status = 400;
      return { error: error.message, code: error.code, details: error.details };
    }
    if (error instanceof _chunkZY2C2CJQcjs.MemoryError) {
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
  const config = await _chunkZY2C2CJQcjs.loadConfig.call(void 0, configPath);
  const orchestrator = new (0, _chunkCRPEAZ44cjs.StorageOrchestrator)(config);
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
  console.log(_chunkZY2C2CJQcjs.configSummary.call(void 0, config).split("\n").map((l) => `  ${l}`).join("\n"));
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
      return bun.main === _url.fileURLToPath.call(void 0, import.meta.url);
    }
    if (process.argv[1]) {
      return _path.resolve.call(void 0, process.argv[1]) === _path.resolve.call(void 0, _url.fileURLToPath.call(void 0, import.meta.url));
    }
    return false;
  } catch (e) {
    return false;
  }
}
if (isMainModule()) {
  main().catch((error) => {
    console.error("[fatal]", error);
    process.exit(1);
  });
}




exports.createApp = createApp; exports.createServer = createServer;
//# sourceMappingURL=chunk-DWHY4TCN.cjs.map