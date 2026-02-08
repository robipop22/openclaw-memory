"use strict";Object.defineProperty(exports, "__esModule", {value: true}); function _interopRequireWildcard(obj) { if (obj && obj.__esModule) { return obj; } else { var newObj = {}; if (obj != null) { for (var key in obj) { if (Object.prototype.hasOwnProperty.call(obj, key)) { newObj[key] = obj[key]; } } } newObj.default = obj; return newObj; } } function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; } function _nullishCoalesce(lhs, rhsFn) { if (lhs != null) { return lhs; } else { return rhsFn(); } } function _optionalChain(ops) { let lastAccessLHS = undefined; let value = ops[0]; let i = 1; while (i < ops.length) { const op = ops[i]; const fn = ops[i + 1]; i += 2; if ((op === 'optionalAccess' || op === 'optionalCall') && value == null) { return undefined; } if (op === 'access' || op === 'optionalAccess') { lastAccessLHS = value; value = fn(value); } else if (op === 'call' || op === 'optionalCall') { value = fn((...args) => value.call(lastAccessLHS, ...args)); lastAccessLHS = undefined; } } return value; } var _class; var _class2; var _class3;// src/storage/orchestrator.ts
var _crypto = require('crypto');

// src/storage/sqlite.ts
var _fs = require('fs'); var _fs2 = _interopRequireDefault(_fs);
var _path = require('path'); var _path2 = _interopRequireDefault(_path);
var _module = require('module');
function createDatabase(dbPath) {
  if (typeof globalThis.Bun !== "undefined") {
    const req = _module.createRequire.call(void 0, import.meta.url);
    const { Database } = req("bun:sqlite");
    const db = new Database(dbPath, { create: true });
    return {
      exec: (sql) => db.exec(sql),
      prepare: (sql) => {
        const stmt = db.prepare(sql);
        return {
          run: (params) => stmt.run(params || {}),
          get: (params) => stmt.get(params || {}),
          all: (params) => stmt.all(params || {})
        };
      },
      close: () => db.close()
    };
  }
  try {
    const req = _module.createRequire.call(void 0, import.meta.url);
    const Database = req("better-sqlite3");
    const db = new Database(dbPath);
    return {
      exec: (sql) => db.exec(sql),
      prepare: (sql) => {
        const stmt = db.prepare(sql);
        return {
          run: (params) => {
            const result = stmt.run(params || {});
            return { changes: result.changes };
          },
          get: (params) => stmt.get(params || {}),
          all: (params) => stmt.all(params || {})
        };
      },
      close: () => db.close()
    };
  } catch (e2) {
    throw new Error(
      "No SQLite driver available. Install better-sqlite3 for Node.js, or use Bun runtime."
    );
  }
}
var SqliteStorage = class {
  
  constructor(dbPath) {
    _fs2.default.mkdirSync(_path2.default.dirname(dbPath), { recursive: true });
    this.db = createDatabase(dbPath);
    this.db.exec("PRAGMA journal_mode = WAL");
    this.db.exec("PRAGMA busy_timeout = 5000");
    this.db.exec("PRAGMA synchronous = NORMAL");
    this.db.exec("PRAGMA foreign_keys = ON");
    this.initSchema();
  }
  // ── Schema ──────────────────────────────────────────────────────────
  initSchema() {
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS memories (
        id             TEXT PRIMARY KEY,
        agent_id       TEXT NOT NULL,
        scope          TEXT NOT NULL CHECK (scope IN ('user', 'agent', 'global', 'project', 'session')),
        subject_id     TEXT,
        content        TEXT NOT NULL,
        tags           TEXT NOT NULL DEFAULT '[]',
        entities       TEXT NOT NULL DEFAULT '[]',
        source         TEXT NOT NULL DEFAULT 'explicit',
        created_by     TEXT,
        created_at     TEXT NOT NULL,
        updated_at     TEXT NOT NULL,
        expires_at     TEXT,
        embedding_hash TEXT
      );

      CREATE INDEX IF NOT EXISTS idx_mem_agent       ON memories(agent_id);
      CREATE INDEX IF NOT EXISTS idx_mem_scope        ON memories(scope);
      CREATE INDEX IF NOT EXISTS idx_mem_subject      ON memories(subject_id);
      CREATE INDEX IF NOT EXISTS idx_mem_agent_scope  ON memories(agent_id, scope);
      CREATE INDEX IF NOT EXISTS idx_mem_created      ON memories(created_at);
      CREATE INDEX IF NOT EXISTS idx_mem_source       ON memories(source);
    `);
    const ftsExists = this.db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='memories_fts'").get();
    if (!ftsExists) {
      this.db.exec(`
        CREATE VIRTUAL TABLE memories_fts USING fts5(
          content,
          tags,
          content=memories,
          content_rowid=rowid
        );

        CREATE TRIGGER mem_fts_insert AFTER INSERT ON memories BEGIN
          INSERT INTO memories_fts(rowid, content, tags)
          VALUES (new.rowid, new.content, new.tags);
        END;

        CREATE TRIGGER mem_fts_delete AFTER DELETE ON memories BEGIN
          INSERT INTO memories_fts(memories_fts, rowid, content, tags)
          VALUES ('delete', old.rowid, old.content, old.tags);
        END;

        CREATE TRIGGER mem_fts_update AFTER UPDATE ON memories BEGIN
          INSERT INTO memories_fts(memories_fts, rowid, content, tags)
          VALUES ('delete', old.rowid, old.content, old.tags);
          INSERT INTO memories_fts(rowid, content, tags)
          VALUES (new.rowid, new.content, new.tags);
        END;
      `);
    }
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS conversation_log (
        id         INTEGER PRIMARY KEY AUTOINCREMENT,
        agent_id   TEXT NOT NULL,
        session_id TEXT NOT NULL,
        user_id    TEXT NOT NULL,
        channel    TEXT NOT NULL,
        role       TEXT NOT NULL,
        content    TEXT NOT NULL,
        timestamp  TEXT NOT NULL
      );

      CREATE INDEX IF NOT EXISTS idx_convlog_agent   ON conversation_log(agent_id);
      CREATE INDEX IF NOT EXISTS idx_convlog_session  ON conversation_log(session_id);
      CREATE INDEX IF NOT EXISTS idx_convlog_ts       ON conversation_log(timestamp);
    `);
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS sync_queue (
        id         INTEGER PRIMARY KEY AUTOINCREMENT,
        memory_id  TEXT NOT NULL,
        layer      TEXT NOT NULL CHECK (layer IN ('qdrant', 'age')),
        operation  TEXT NOT NULL CHECK (operation IN ('upsert', 'delete')),
        attempts   INTEGER NOT NULL DEFAULT 0,
        last_error TEXT,
        created_at TEXT NOT NULL,
        UNIQUE(memory_id, layer, operation)
      );
    `);
  }
  // ── Memory CRUD ─────────────────────────────────────────────────────
  createMemory(memory) {
    this.db.prepare(`
      INSERT INTO memories (id, agent_id, scope, subject_id, content, tags, entities, source, created_by, created_at, updated_at, expires_at, embedding_hash)
      VALUES ($id, $agent_id, $scope, $subject_id, $content, $tags, $entities, $source, $created_by, $created_at, $updated_at, $expires_at, $embedding_hash)
    `).run({
      $id: memory.id,
      $agent_id: memory.agent_id,
      $scope: memory.scope,
      $subject_id: memory.subject_id,
      $content: memory.content,
      $tags: JSON.stringify(memory.tags),
      $entities: JSON.stringify(memory.entities),
      $source: memory.source,
      $created_by: memory.created_by,
      $created_at: memory.created_at,
      $updated_at: memory.updated_at,
      $expires_at: memory.expires_at,
      $embedding_hash: memory.embedding_hash
    });
    return memory;
  }
  getMemory(id) {
    const row = this.db.prepare("SELECT * FROM memories WHERE id = $id").get({ $id: id });
    if (!row) return null;
    return this.rowToMemory(row);
  }
  updateMemory(id, updates) {
    const existing = this.getMemory(id);
    if (!existing) return null;
    const updated = {
      ...existing,
      ...updates,
      id: existing.id,
      updated_at: (/* @__PURE__ */ new Date()).toISOString()
    };
    this.db.prepare(`
      UPDATE memories SET
        content = $content, tags = $tags, entities = $entities, scope = $scope, subject_id = $subject_id,
        expires_at = $expires_at, embedding_hash = $embedding_hash, updated_at = $updated_at
      WHERE id = $id
    `).run({
      $content: updated.content,
      $tags: JSON.stringify(updated.tags),
      $entities: JSON.stringify(updated.entities),
      $scope: updated.scope,
      $subject_id: updated.subject_id,
      $expires_at: updated.expires_at,
      $embedding_hash: updated.embedding_hash,
      $updated_at: updated.updated_at,
      $id: id
    });
    return updated;
  }
  deleteMemory(id) {
    const result = this.db.prepare("DELETE FROM memories WHERE id = $id").run({ $id: id });
    return result.changes > 0;
  }
  listMemories(query) {
    const conditions = [];
    const params = {};
    if (query.agent_id) {
      conditions.push("agent_id = $agent_id");
      params.$agent_id = query.agent_id;
    }
    if (query.scope) {
      conditions.push("scope = $scope");
      params.$scope = query.scope;
    }
    if (query.subject_id) {
      conditions.push("subject_id = $subject_id");
      params.$subject_id = query.subject_id;
    }
    if (query.source) {
      conditions.push("source = $source");
      params.$source = query.source;
    }
    const where = conditions.length > 0 ? `WHERE ${conditions.join(" AND ")}` : "";
    const order = query.order === "asc" ? "ASC" : "DESC";
    const limit = query.limit || 50;
    const offset = query.offset || 0;
    params.$limit = limit;
    params.$offset = offset;
    const sql = `SELECT * FROM memories ${where} ORDER BY created_at ${order} LIMIT $limit OFFSET $offset`;
    const rows = this.db.prepare(sql).all(params);
    if (query.tags) {
      const tagList = query.tags.split(",").map((t) => t.trim().toLowerCase());
      return rows.map((r) => this.rowToMemory(r)).filter((m) => {
        const memTags = m.tags.map((t) => t.toLowerCase());
        return tagList.some((t) => memTags.includes(t));
      });
    }
    return rows.map((r) => this.rowToMemory(r));
  }
  // ── Full-Text Search ────────────────────────────────────────────────
  searchFullText(query, agentId, scopes, subjectId, limit = 10) {
    const ftsQuery = query.split(/\s+/).filter(Boolean).map((term) => `"${term.replace(/"/g, "")}"`).join(" OR ");
    if (!ftsQuery) return [];
    const conditions = [];
    const params = { $fts: ftsQuery, $limit: limit };
    if (agentId) {
      conditions.push("m.agent_id = $agent_id");
      params.$agent_id = agentId;
    }
    if (scopes && scopes.length > 0) {
      const scopePlaceholders = scopes.map((_, i) => `$scope_${i}`);
      conditions.push(`m.scope IN (${scopePlaceholders.join(",")})`);
      scopes.forEach((s, i) => {
        params[`$scope_${i}`] = s;
      });
    }
    if (subjectId !== void 0 && subjectId !== null) {
      conditions.push("m.subject_id = $subject_id");
      params.$subject_id = subjectId;
    }
    const where = conditions.length > 0 ? `AND ${conditions.join(" AND ")}` : "";
    const sql = `
      SELECT m.*, rank
      FROM memories_fts fts
      JOIN memories m ON m.rowid = fts.rowid
      WHERE memories_fts MATCH $fts
      ${where}
      ORDER BY rank
      LIMIT $limit
    `;
    const rows = this.db.prepare(sql).all(params);
    return rows.map((r) => ({
      ...this.rowToMemory(r),
      fts_rank: r.rank
    }));
  }
  // ── Conversation Log ────────────────────────────────────────────────
  appendConversationLog(entry) {
    this.db.prepare(
      `INSERT INTO conversation_log (agent_id, session_id, user_id, channel, role, content, timestamp)
       VALUES ($agent_id, $session_id, $user_id, $channel, $role, $content, $timestamp)`
    ).run({
      $agent_id: entry.agent_id,
      $session_id: entry.session_id,
      $user_id: entry.user_id,
      $channel: entry.channel,
      $role: entry.role,
      $content: entry.content,
      $timestamp: entry.timestamp
    });
  }
  getConversationLog(agentId, sessionId, limit = 100) {
    return this.db.prepare(
      `SELECT agent_id, session_id, user_id, channel, role, content, timestamp
       FROM conversation_log
       WHERE agent_id = $agent_id AND session_id = $session_id
       ORDER BY timestamp ASC
       LIMIT $limit`
    ).all({ $agent_id: agentId, $session_id: sessionId, $limit: limit });
  }
  // ── Sync Queue ──────────────────────────────────────────────────────
  addToSyncQueue(memoryId, layer, operation) {
    this.db.prepare(
      `INSERT INTO sync_queue (memory_id, layer, operation, created_at)
       VALUES ($memory_id, $layer, $operation, $created_at)
       ON CONFLICT(memory_id, layer, operation) DO UPDATE SET
         attempts = 0,
         last_error = NULL,
         created_at = excluded.created_at`
    ).run({
      $memory_id: memoryId,
      $layer: layer,
      $operation: operation,
      $created_at: (/* @__PURE__ */ new Date()).toISOString()
    });
  }
  getSyncQueue(limit = 50) {
    const rows = this.db.prepare(
      `SELECT * FROM sync_queue
       WHERE attempts < 5
       ORDER BY created_at ASC
       LIMIT $limit`
    ).all({ $limit: limit });
    return rows.map((r) => ({
      id: r.id,
      memory_id: r.memory_id,
      layer: r.layer,
      operation: r.operation,
      attempts: r.attempts,
      last_error: r.last_error,
      created_at: r.created_at
    }));
  }
  updateSyncQueueItem(id, attempts, lastError) {
    this.db.prepare("UPDATE sync_queue SET attempts = $attempts, last_error = $last_error WHERE id = $id").run({ $attempts: attempts, $last_error: lastError, $id: id });
  }
  removeSyncQueueItem(id) {
    this.db.prepare("DELETE FROM sync_queue WHERE id = $id").run({ $id: id });
  }
  clearCompletedSyncItems() {
    const result = this.db.prepare("DELETE FROM sync_queue WHERE attempts >= 5").run();
    return result.changes;
  }
  // ── Stats ───────────────────────────────────────────────────────────
  getMemoryCount() {
    const row = this.db.prepare("SELECT COUNT(*) as count FROM memories").get();
    return row.count;
  }
  getDatabaseSize() {
    try {
      const row = this.db.prepare("SELECT page_count * page_size as size FROM pragma_page_count(), pragma_page_size()").get();
      return row.size;
    } catch (e3) {
      return 0;
    }
  }
  // ── Health Check ────────────────────────────────────────────────────
  healthCheck() {
    try {
      this.db.prepare("SELECT 1").get();
      return true;
    } catch (e4) {
      return false;
    }
  }
  // ── Helpers ─────────────────────────────────────────────────────────
  rowToMemory(row) {
    return {
      id: row.id,
      agent_id: row.agent_id,
      scope: row.scope,
      subject_id: row.subject_id,
      content: row.content,
      tags: JSON.parse(row.tags || "[]"),
      entities: JSON.parse(row.entities || "[]"),
      source: row.source,
      created_by: row.created_by,
      created_at: row.created_at,
      updated_at: row.updated_at,
      expires_at: row.expires_at,
      embedding_hash: row.embedding_hash
    };
  }
  close() {
    this.db.close();
  }
};

// src/storage/qdrant.ts
var QdrantStorage = (_class = class {
  __init() {this.client = null}
  
  
  __init2() {this.ready = false}
  constructor(config) {;_class.prototype.__init.call(this);_class.prototype.__init2.call(this);
    this.config = config;
    this.collection = config.collection;
  }
  // ── Lazy Client Init ────────────────────────────────────────────────
  async getClient() {
    if (this.client) return this.client;
    try {
      const mod = await Promise.resolve().then(() => _interopRequireWildcard(require("@qdrant/js-client-rest")));
      const QdrantClientClass = mod.QdrantClient;
      this.client = new QdrantClientClass({
        url: this.config.url,
        apiKey: this.config.apiKey
      });
      return this.client;
    } catch (e5) {
      throw new Error(
        "Qdrant client not available. Install @qdrant/js-client-rest: bun add @qdrant/js-client-rest"
      );
    }
  }
  // ── Collection Init ─────────────────────────────────────────────────
  async ensureCollection(vectorSize = 1536) {
    if (this.ready) return;
    const client = await this.getClient();
    try {
      const collections = await client.getCollections();
      const exists = _optionalChain([collections, 'access', _2 => _2.collections, 'optionalAccess', _3 => _3.some, 'call', _4 => _4(
        (c) => c.name === this.collection
      )]);
      if (!exists) {
        await client.createCollection(this.collection, {
          vectors: {
            size: vectorSize,
            distance: "Cosine"
          },
          optimizers_config: {
            default_segment_number: 2
          },
          replication_factor: 1
        });
        const indexFields = [
          { field_name: "agent_id", field_schema: "keyword" },
          { field_name: "scope", field_schema: "keyword" },
          { field_name: "subject_id", field_schema: "keyword" },
          { field_name: "tags", field_schema: "keyword" },
          { field_name: "entity_types", field_schema: "keyword" },
          { field_name: "entity_names", field_schema: "keyword" },
          { field_name: "source", field_schema: "keyword" }
        ];
        for (const idx of indexFields) {
          await client.createPayloadIndex(this.collection, idx);
        }
        console.log(`[qdrant] Created collection: ${this.collection}`);
      }
      this.ready = true;
    } catch (error) {
      console.error(`[qdrant] Failed to ensure collection: ${error}`);
      throw error;
    }
  }
  // ── Upsert ──────────────────────────────────────────────────────────
  async upsertMemory(memory, vector) {
    const client = await this.getClient();
    await this.ensureCollection(vector.length);
    const entityTypes = memory.entities.map((e) => e.type);
    const entityNames = memory.entities.map((e) => e.name);
    await client.upsert(this.collection, {
      points: [
        {
          id: memory.id,
          vector,
          payload: {
            agent_id: memory.agent_id,
            scope: memory.scope,
            subject_id: memory.subject_id,
            content: memory.content,
            tags: memory.tags,
            entity_types: entityTypes,
            entity_names: entityNames,
            source: memory.source,
            created_by: memory.created_by,
            created_at: memory.created_at,
            updated_at: memory.updated_at
          }
        }
      ]
    });
  }
  // ── Delete ──────────────────────────────────────────────────────────
  async deleteMemory(id) {
    const client = await this.getClient();
    if (!this.ready) await this.ensureCollection();
    await client.delete(this.collection, {
      points: [id]
    });
  }
  // ── Semantic Search ─────────────────────────────────────────────────
  async search(queryVector, agentId, scopes, subjectId, limit = 10, crossAgent = false) {
    const client = await this.getClient();
    await this.ensureCollection(queryVector.length);
    const filter = this.buildFilter(agentId, scopes, subjectId, crossAgent);
    const results = await client.search(this.collection, {
      vector: queryVector,
      limit,
      with_payload: true,
      filter: filter || void 0,
      score_threshold: 0.3
    });
    return results.map((point) => {
      const payload = point.payload || {};
      return {
        memory: this.payloadToMemory(String(point.id), payload),
        score: point.score,
        source_layer: "qdrant"
      };
    });
  }
  // ── Health Check ────────────────────────────────────────────────────
  async healthCheck() {
    try {
      const client = await this.getClient();
      await client.getCollections();
      return true;
    } catch (e6) {
      return false;
    }
  }
  // ── Collection Info ─────────────────────────────────────────────────
  async getCollectionInfo() {
    try {
      const client = await this.getClient();
      const info = await client.getCollection(this.collection);
      return { vectorCount: info.points_count || 0 };
    } catch (e7) {
      return null;
    }
  }
  // ── Helpers ─────────────────────────────────────────────────────────
  buildFilter(agentId, scopes, subjectId, crossAgent = false) {
    const must = [];
    if (agentId && !crossAgent) {
      must.push({ key: "agent_id", match: { value: agentId } });
    }
    if (scopes && scopes.length > 0) {
      must.push({ key: "scope", match: { any: scopes } });
    }
    if (subjectId !== void 0 && subjectId !== null) {
      must.push({ key: "subject_id", match: { value: subjectId } });
    }
    if (must.length === 0) return null;
    return { must };
  }
  payloadToMemory(id, payload) {
    return {
      id,
      agent_id: payload.agent_id || "",
      scope: payload.scope || "agent",
      subject_id: _nullishCoalesce(payload.subject_id, () => ( null)),
      content: payload.content || "",
      tags: payload.tags || [],
      entities: (payload.entity_names || []).map(
        (name, i) => ({
          name,
          type: (payload.entity_types || [])[i] || "Concept",
          properties: {}
        })
      ),
      source: payload.source || "explicit",
      created_by: _nullishCoalesce(payload.created_by, () => ( null)),
      created_at: payload.created_at || "",
      updated_at: payload.updated_at || "",
      expires_at: null,
      embedding_hash: null
    };
  }
}, _class);

// src/storage/age.ts
var MAX_CYPHER_INPUT_LENGTH = 1e3;
var AgeStorage = (_class2 = class {
  __init3() {this.pool = null}
  
  
  __init4() {this.initialized = false}
  constructor(config) {;_class2.prototype.__init3.call(this);_class2.prototype.__init4.call(this);
    this.config = config;
    this.graph = config.graph;
  }
  // ── Lazy Pool Init ──────────────────────────────────────────────────
  async getPool() {
    if (this.pool) return this.pool;
    try {
      const pg = await Promise.resolve().then(() => _interopRequireWildcard(require("pg")));
      const PoolClass = _optionalChain([pg, 'access', _5 => _5.default, 'optionalAccess', _6 => _6.Pool]) || pg.Pool;
      this.pool = new PoolClass({
        host: this.config.host,
        port: this.config.port,
        user: this.config.user,
        password: this.config.password,
        database: this.config.database,
        max: 5,
        idleTimeoutMillis: 3e4
      });
      return this.pool;
    } catch (e8) {
      throw new Error(
        "pg client not available. Install pg: bun add pg"
      );
    }
  }
  // ── Graph Init ──────────────────────────────────────────────────────
  async ensureGraph() {
    if (this.initialized) return;
    const pool = await this.getPool();
    const client = await pool.connect();
    try {
      await client.query("LOAD 'age';");
      await client.query('SET search_path = ag_catalog, "$user", public;');
      const exists = await client.query(
        "SELECT 1 FROM ag_catalog.ag_graph WHERE name = $1",
        [this.graph]
      );
      if (exists.rowCount === 0) {
        await client.query("SELECT ag_catalog.create_graph($1)", [this.graph]);
        console.log(`[age] Created graph: ${this.graph}`);
      }
      this.initialized = true;
    } catch (error) {
      console.error(`[age] Failed to ensure graph: ${error}`);
      throw error;
    } finally {
      client.release();
    }
  }
  // ── Cypher Query Helper ─────────────────────────────────────────────
  async cypherQuery(query, resultColumns = "v agtype") {
    await this.ensureGraph();
    const pool = await this.getPool();
    const client = await pool.connect();
    try {
      await client.query("LOAD 'age';");
      await client.query('SET search_path = ag_catalog, "$user", public;');
      const sql = `SELECT * FROM ag_catalog.cypher('${escGraphName(this.graph)}', $$${query}$$) as (${resultColumns})`;
      const result = await client.query(sql);
      return result.rows.map((row) => {
        const parsed = {};
        for (const key of Object.keys(row)) {
          parsed[key] = this.parseAgtype(row[key]);
        }
        if (Object.keys(parsed).length === 1 && "v" in parsed) {
          return parsed.v;
        }
        return parsed;
      });
    } finally {
      client.release();
    }
  }
  async cypherExec(query) {
    await this.ensureGraph();
    const pool = await this.getPool();
    const client = await pool.connect();
    try {
      await client.query("LOAD 'age';");
      await client.query('SET search_path = ag_catalog, "$user", public;');
      const sql = `SELECT * FROM ag_catalog.cypher('${escGraphName(this.graph)}', $$${query}$$) as (v agtype)`;
      await client.query(sql);
    } finally {
      client.release();
    }
  }
  // ── Memory Node Operations ──────────────────────────────────────────
  async upsertMemoryNode(memory) {
    const contentTruncated = memory.content.slice(0, 500);
    const now = (/* @__PURE__ */ new Date()).toISOString();
    try {
      await this.cypherExec(
        `MERGE (m:Memory {id: '${esc(memory.id)}'})
         SET m.agent_id = '${esc(memory.agent_id)}',
             m.scope = '${esc(memory.scope)}',
             m.subject_id = '${esc(memory.subject_id || "")}',
             m.content = '${esc(contentTruncated)}',
             m.source = '${esc(memory.source)}',
             m.created_at = '${esc(memory.created_at)}',
             m.updated_at = '${esc(now)}'
         RETURN m`
      );
    } catch (error) {
      console.error(`[age] Failed to upsert memory node: ${error}`);
      throw error;
    }
  }
  // ── Entity Node Operations ──────────────────────────────────────────
  async upsertEntityNode(entity, agentId) {
    const entityId = slugify(`${entity.type}:${entity.name}`);
    const now = (/* @__PURE__ */ new Date()).toISOString();
    const propsJson = JSON.stringify(entity.properties || {});
    try {
      await this.cypherExec(
        `MERGE (e:Entity {id: '${esc(entityId)}'})
         SET e.name = '${esc(entity.name)}',
             e.entity_type = '${esc(entity.type)}',
             e.agent_id = '${esc(agentId)}',
             e.properties = '${esc(propsJson)}',
             e.updated_at = '${esc(now)}'
         RETURN e`
      );
    } catch (error) {
      console.error(`[age] Failed to upsert entity node ${entityId}: ${error}`);
      throw error;
    }
    return entityId;
  }
  // ── Relationship Operations ─────────────────────────────────────────
  async createRelationship(rel, agentId) {
    const fromId = slugify(`${this.guessEntityType(rel.from_entity)}:${rel.from_entity}`);
    const toId = slugify(`${this.guessEntityType(rel.to_entity)}:${rel.to_entity}`);
    const context = _optionalChain([rel, 'access', _7 => _7.properties, 'optionalAccess', _8 => _8.context]) || "";
    const relType = sanitizeLabel(rel.relationship);
    if (!relType) {
      console.warn(`[age] Invalid relationship type: ${rel.relationship}`);
      return;
    }
    try {
      await this.cypherExec(
        `MATCH (a:Entity {id: '${esc(fromId)}'}), (b:Entity {id: '${esc(toId)}'})
         MERGE (a)-[r:${relType}]->(b)
         SET r.context = '${esc(context)}',
             r.agent_id = '${esc(agentId)}'
         RETURN r`
      );
    } catch (error) {
      console.warn(`[age] Failed to create relationship ${fromId} -[${relType}]-> ${toId}: ${error}`);
    }
  }
  async linkMemoryToEntity(memoryId, entityId) {
    try {
      await this.cypherExec(
        `MATCH (m:Memory {id: '${esc(memoryId)}'}), (e:Entity {id: '${esc(entityId)}'})
         MERGE (m)-[r:MENTIONS]->(e)
         RETURN r`
      );
    } catch (error) {
      console.warn(`[age] Failed to link memory ${memoryId} to entity ${entityId}: ${error}`);
    }
  }
  // ── Delete ──────────────────────────────────────────────────────────
  async deleteMemoryNode(memoryId) {
    try {
      try {
        await this.cypherExec(
          `MATCH (m:Memory {id: '${esc(memoryId)}'})-[r]-()
           DELETE r
           RETURN r`
        );
      } catch (e9) {
      }
      await this.cypherExec(
        `MATCH (m:Memory {id: '${esc(memoryId)}'})
         DELETE m
         RETURN m`
      );
    } catch (error) {
      console.warn(`[age] Failed to delete memory node ${memoryId}: ${error}`);
      throw error;
    }
  }
  // ── Graph Queries ───────────────────────────────────────────────────
  async getEntityWithRelationships(entityType, entityId) {
    try {
      const entities = await this.cypherQuery(
        `MATCH (e:Entity {id: '${esc(entityId)}'})
         RETURN properties(e) as v`
      );
      if (entities.length === 0) {
        return { entity: null, relationships: [] };
      }
      const relationships = [];
      try {
        const outgoing = await this.cypherQuery(
          `MATCH (e:Entity {id: '${esc(entityId)}'})-[r]->(target)
           RETURN type(r) as rel_type, properties(target) as target_props`,
          "rel_type agtype, target_props agtype"
        );
        for (const r of outgoing) {
          relationships.push({
            type: String(r.rel_type || ""),
            direction: "outgoing",
            target: r.target_props || {}
          });
        }
      } catch (e10) {
      }
      try {
        const incoming = await this.cypherQuery(
          `MATCH (e:Entity {id: '${esc(entityId)}'})<-[r]-(source)
           RETURN type(r) as rel_type, properties(source) as source_props`,
          "rel_type agtype, source_props agtype"
        );
        for (const r of incoming) {
          relationships.push({
            type: String(r.rel_type || ""),
            direction: "incoming",
            target: r.source_props || {}
          });
        }
      } catch (e11) {
      }
      return { entity: entities[0], relationships };
    } catch (error) {
      console.error(`[age] Failed to get entity: ${error}`);
      return { entity: null, relationships: [] };
    }
  }
  async getRelatedEntities(entityId, depth = 2) {
    try {
      const maxDepth = Math.min(depth, 4);
      const results = await this.cypherQuery(
        `MATCH (start:Entity {id: '${esc(entityId)}'})-[*1..${maxDepth}]-(target:Entity)
         WHERE target.id <> '${esc(entityId)}'
         RETURN DISTINCT properties(target) as target_props`,
        "target_props agtype"
      );
      return results.map((r) => ({
        entity: r.target_props || r,
        relationship: "RELATED_TO",
        distance: 1
      }));
    } catch (error) {
      console.error(`[age] Failed to get related entities: ${error}`);
      return [];
    }
  }
  async searchByEntity(entityName, entityType, agentId, limit = 10) {
    if (entityName.length > MAX_CYPHER_INPUT_LENGTH) {
      console.warn("[age] Entity name too long, truncating");
      entityName = entityName.slice(0, MAX_CYPHER_INPUT_LENGTH);
    }
    try {
      const entityId = slugify(`${entityType || "Concept"}:${entityName}`);
      const safeLimit = Math.min(Math.max(1, limit), 100);
      let results = [];
      try {
        results = await this.cypherQuery(
          `MATCH (m:Memory)-[:MENTIONS]->(e:Entity {id: '${esc(entityId)}'})
           ${agentId ? `WHERE m.agent_id = '${esc(agentId)}'` : ""}
           RETURN properties(m) as mem_props
           ORDER BY m.created_at DESC
           LIMIT ${safeLimit}`,
          "mem_props agtype"
        );
      } catch (e12) {
      }
      if (results.length === 0) {
        return await this.searchByEntityNameFuzzy(entityName, agentId, safeLimit);
      }
      return results.map((r, i) => this.graphResultToScoredMemory(r, entityName, entityType, i));
    } catch (error) {
      console.error(`[age] Graph search failed: ${error}`);
      return [];
    }
  }
  async searchByEntityNameFuzzy(name, agentId, limit = 10) {
    if (name.length > MAX_CYPHER_INPUT_LENGTH) {
      console.warn("[age] Fuzzy search name too long, truncating");
      name = name.slice(0, MAX_CYPHER_INPUT_LENGTH);
    }
    try {
      const escapedName = escRegex(esc(name));
      const safeLimit = Math.min(Math.max(1, limit), 100);
      const results = await this.cypherQuery(
        `MATCH (m:Memory)-[:MENTIONS]->(e:Entity)
         WHERE e.name =~ '(?i).*${escapedName}.*'
         ${agentId ? `AND m.agent_id = '${esc(agentId)}'` : ""}
         RETURN properties(m) as mem_props, e.name as entity_name, e.entity_type as entity_type
         ORDER BY m.created_at DESC
         LIMIT ${safeLimit}`,
        "mem_props agtype, entity_name agtype, entity_type agtype"
      );
      return results.map((r, i) => {
        const props = r.mem_props || {};
        return {
          memory: this.propsToMemory(props),
          score: 0.8 / (1 + i * 0.1),
          source_layer: "age",
          graph_context: {
            related_entities: [
              {
                type: String(r.entity_type) || "Concept",
                name: String(r.entity_name || name),
                relationship: "MENTIONED_IN"
              }
            ]
          }
        };
      });
    } catch (error) {
      console.error(`[age] Fuzzy entity search failed: ${error}`);
      return [];
    }
  }
  async listEntities(entityType, agentId, limit = 50) {
    try {
      const conditions = [];
      if (entityType) conditions.push(`e.entity_type = '${esc(entityType)}'`);
      if (agentId) conditions.push(`e.agent_id = '${esc(agentId)}'`);
      const where = conditions.length > 0 ? `WHERE ${conditions.join(" AND ")}` : "";
      const safeLimit = Math.min(Math.max(1, limit), 200);
      const results = await this.cypherQuery(
        `MATCH (e:Entity)
         ${where}
         RETURN properties(e) as props
         ORDER BY e.updated_at DESC
         LIMIT ${safeLimit}`,
        "props agtype"
      );
      return results.map((r) => r.props || r);
    } catch (error) {
      console.error(`[age] Failed to list entities: ${error}`);
      return [];
    }
  }
  // ── Agent Node ──────────────────────────────────────────────────────
  async ensureAgentNode(agentId, name, role) {
    const now = (/* @__PURE__ */ new Date()).toISOString();
    try {
      await this.cypherExec(
        `MERGE (a:Agent {id: '${esc(agentId)}'})
         SET a.name = '${esc(name)}',
             a.role = '${esc(role)}',
             a.created_at = '${esc(now)}'
         RETURN a`
      );
    } catch (error) {
      console.warn(`[age] Failed to ensure agent node: ${error}`);
    }
  }
  // ── Stats ───────────────────────────────────────────────────────────
  async getStats() {
    try {
      const entities = await this.cypherQuery(
        `MATCH (e:Entity) RETURN count(e) as cnt`,
        "cnt agtype"
      );
      const rels = await this.cypherQuery(
        `MATCH ()-[r]->() RETURN count(r) as cnt`,
        "cnt agtype"
      );
      return {
        entityCount: Number(entities[0] || 0),
        relationshipCount: Number(rels[0] || 0)
      };
    } catch (e13) {
      return null;
    }
  }
  // ── Health Check ────────────────────────────────────────────────────
  async healthCheck() {
    try {
      const pool = await this.getPool();
      const client = await pool.connect();
      try {
        await client.query("SELECT 1");
        return true;
      } finally {
        client.release();
      }
    } catch (e14) {
      return false;
    }
  }
  // ── Cleanup ─────────────────────────────────────────────────────────
  async close() {
    if (this.pool) {
      await this.pool.end();
    }
  }
  // ── Helpers ─────────────────────────────────────────────────────────
  parseAgtype(value) {
    if (value === null || value === void 0) return null;
    if (typeof value === "string") {
      try {
        return JSON.parse(value);
      } catch (e15) {
        const cleaned = value.replace(/::(?:vertex|edge|path|agtype)$/g, "").trim();
        try {
          return JSON.parse(cleaned);
        } catch (e16) {
          return cleaned;
        }
      }
    }
    return value;
  }
  propsToMemory(props) {
    return {
      id: String(props.id || ""),
      agent_id: String(props.agent_id || ""),
      scope: String(props.scope || "agent"),
      subject_id: props.subject_id || null,
      content: String(props.content || ""),
      tags: [],
      entities: [],
      source: String(props.source || "explicit"),
      created_by: null,
      created_at: String(props.created_at || ""),
      updated_at: String(props.updated_at || ""),
      expires_at: null,
      embedding_hash: null
    };
  }
  graphResultToScoredMemory(r, entityName, entityType, index) {
    const props = r.mem_props || {};
    return {
      memory: this.propsToMemory(props),
      score: 1 / (1 + index * 0.1),
      source_layer: "age",
      graph_context: {
        related_entities: [
          {
            type: entityType || "Concept",
            name: entityName,
            relationship: "MENTIONED_IN"
          }
        ]
      }
    };
  }
  guessEntityType(_name) {
    return "Concept";
  }
}, _class2);
function esc(value) {
  if (!value) return "";
  const truncated = value.slice(0, MAX_CYPHER_INPUT_LENGTH);
  return truncated.replace(/\\/g, "\\\\").replace(/'/g, "\\'").replace(/\n/g, "\\n").replace(/\r/g, "\\r").replace(/\$/g, "").replace(/\0/g, "");
}
function escGraphName(name) {
  return name.replace(/[^a-zA-Z0-9_]/g, "");
}
function escRegex(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
function sanitizeLabel(label) {
  const sanitized = label.replace(/[^a-zA-Z0-9_]/g, "");
  return sanitized.length > 0 ? sanitized : null;
}
function slugify(input) {
  return input.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 128);
}

// src/storage/sync-queue.ts
var SyncQueueProcessor = (_class3 = class {
  
  
  
  
  __init5() {this.interval = null}
  __init6() {this.processing = false}
  constructor(sqlite, qdrant, age, embeddings) {;_class3.prototype.__init5.call(this);_class3.prototype.__init6.call(this);
    this.sqlite = sqlite;
    this.qdrant = qdrant;
    this.age = age;
    this.embeddings = embeddings;
  }
  start(intervalMs = 6e4) {
    if (this.interval) return;
    console.log(`[sync-queue] Starting processor (every ${intervalMs / 1e3}s)`);
    this.interval = setInterval(() => {
      void this.processQueue();
    }, intervalMs);
    void this.processQueue();
  }
  stop() {
    if (this.interval) {
      clearInterval(this.interval);
      this.interval = null;
      console.log("[sync-queue] Stopped");
    }
  }
  async processQueue() {
    if (this.processing) return { processed: 0, succeeded: 0, failed: 0 };
    this.processing = true;
    let processed = 0;
    let succeeded = 0;
    let failed = 0;
    try {
      const items = this.sqlite.getSyncQueue(50);
      if (items.length === 0) {
        return { processed: 0, succeeded: 0, failed: 0 };
      }
      console.log(`[sync-queue] Processing ${items.length} items`);
      for (const item of items) {
        processed++;
        try {
          await this.processItem(item);
          this.sqlite.removeSyncQueueItem(item.id);
          succeeded++;
        } catch (error) {
          const errorMsg = error instanceof Error ? error.message : String(error);
          this.sqlite.updateSyncQueueItem(item.id, item.attempts + 1, errorMsg);
          failed++;
          console.warn(
            `[sync-queue] Failed item ${item.id} (${item.layer}/${item.operation}/${item.memory_id}): ${errorMsg}`
          );
        }
      }
      const cleared = this.sqlite.clearCompletedSyncItems();
      if (cleared > 0) {
        console.log(`[sync-queue] Cleared ${cleared} items that exceeded max retries`);
      }
    } finally {
      this.processing = false;
    }
    if (processed > 0) {
      console.log(`[sync-queue] Done: ${succeeded} ok, ${failed} failed out of ${processed}`);
    }
    return { processed, succeeded, failed };
  }
  async processItem(item) {
    if (item.layer === "qdrant") {
      await this.processQdrantItem(item);
    } else if (item.layer === "age") {
      await this.processAgeItem(item);
    }
  }
  async processQdrantItem(item) {
    if (!this.qdrant) throw new Error("Qdrant layer not configured");
    if (item.operation === "delete") {
      await this.qdrant.deleteMemory(item.memory_id);
      return;
    }
    const memory = this.sqlite.getMemory(item.memory_id);
    if (!memory) return;
    if (!this.embeddings) throw new Error("Embedding service not configured");
    const vector = await this.embeddings.embed(memory.content);
    if (!vector) throw new Error("Failed to generate embedding");
    await this.qdrant.upsertMemory(memory, vector);
  }
  async processAgeItem(item) {
    if (!this.age) throw new Error("AGE layer not configured");
    if (item.operation === "delete") {
      await this.age.deleteMemoryNode(item.memory_id);
      return;
    }
    const memory = this.sqlite.getMemory(item.memory_id);
    if (!memory) return;
    await this.age.upsertMemoryNode(memory);
    for (const entity of memory.entities) {
      const entityId = await this.age.upsertEntityNode(entity, memory.agent_id);
      await this.age.linkMemoryToEntity(memory.id, entityId);
    }
  }
}, _class3);

// src/extraction/embeddings.ts
var _openai = require('openai'); var _openai2 = _interopRequireDefault(_openai);
var EmbeddingService = class {
  
  
  
  constructor(config) {
    this.client = new (0, _openai2.default)({
      apiKey: config.apiKey,
      baseURL: config.baseUrl
    });
    this.model = config.model;
    this.dimensions = config.dimensions;
  }
  async embed(text) {
    if (!text || text.trim().length === 0) return null;
    try {
      const response = await this.client.embeddings.create({
        model: this.model,
        input: text.slice(0, 8e3)
      });
      const embedding = _optionalChain([response, 'access', _9 => _9.data, 'access', _10 => _10[0], 'optionalAccess', _11 => _11.embedding]);
      if (!embedding || embedding.length === 0) {
        console.warn("[embeddings] Empty embedding returned");
        return null;
      }
      return embedding;
    } catch (error) {
      console.error(`[embeddings] Failed to generate embedding: ${error}`);
      return null;
    }
  }
  async embedBatch(texts) {
    if (texts.length === 0) return [];
    try {
      const cleanTexts = texts.map((t) => (t || "").slice(0, 8e3));
      const response = await this.client.embeddings.create({
        model: this.model,
        input: cleanTexts
      });
      return response.data.map(
        (item) => item.embedding && item.embedding.length > 0 ? item.embedding : null
      );
    } catch (error) {
      console.error(`[embeddings] Batch embedding failed: ${error}`);
      return texts.map(() => null);
    }
  }
  getDimensions() {
    return this.dimensions;
  }
};

// src/extraction/entity-extractor.ts

var ENTITY_EXTRACTION_PROMPT = `Extract entities and relationships from this memory text.

Return JSON with this exact structure:
{
  "entities": [
    {
      "name": "exact name as mentioned",
      "type": "Person|Project|Organization|Decision|Preference|Event|Tool|Location|Concept",
      "properties": { "key": "value" }
    }
  ],
  "relationships": [
    {
      "from_entity": "entity name",
      "to_entity": "entity name",
      "relationship": "WORKS_ON|DECIDED|PREFERS|KNOWS|USES|LOCATED_AT|BELONGS_TO|RELATED_TO|CREATED_BY|DEPENDS_ON",
      "properties": { "context": "brief context" }
    }
  ]
}

Rules:
- Only extract clearly stated entities, don't infer
- Use the most specific entity type possible
- Normalize person names to their full form when possible
- For preferences, use key/value format (key = category, value = preference)
- Keep properties minimal \u2014 only include what's explicitly stated
- If no entities are found, return {"entities": [], "relationships": []}`;
var EntityExtractor = class {
  
  
  constructor(config) {
    this.client = new (0, _openai2.default)({
      apiKey: config.apiKey,
      baseURL: config.baseUrl
    });
    this.model = config.model;
  }
  async extract(text) {
    if (!text || text.trim().length < 20) {
      return { entities: [], relationships: [] };
    }
    try {
      const response = await this.client.chat.completions.create({
        model: this.model,
        messages: [
          { role: "system", content: ENTITY_EXTRACTION_PROMPT },
          { role: "user", content: text.slice(0, 4e3) }
        ],
        temperature: 0.1,
        max_tokens: 1500,
        response_format: { type: "json_object" }
      });
      const content = _optionalChain([response, 'access', _12 => _12.choices, 'access', _13 => _13[0], 'optionalAccess', _14 => _14.message, 'optionalAccess', _15 => _15.content]);
      if (!content) {
        return { entities: [], relationships: [] };
      }
      const parsed = JSON.parse(content);
      return this.validateExtractionResult(parsed);
    } catch (error) {
      console.error(`[entity-extractor] Extraction failed: ${error}`);
      return { entities: [], relationships: [] };
    }
  }
  validateExtractionResult(data) {
    if (!data || typeof data !== "object") {
      return { entities: [], relationships: [] };
    }
    const raw = data;
    const entities = [];
    const relationships = [];
    const validTypes = [
      "Person",
      "Project",
      "Organization",
      "Decision",
      "Preference",
      "Event",
      "Tool",
      "Location",
      "Concept"
    ];
    const validRels = [
      "WORKS_ON",
      "DECIDED",
      "PREFERS",
      "KNOWS",
      "USES",
      "LOCATED_AT",
      "BELONGS_TO",
      "RELATED_TO",
      "CREATED_BY",
      "DEPENDS_ON"
    ];
    if (Array.isArray(raw.entities)) {
      for (const e of raw.entities) {
        if (e && typeof e === "object" && typeof e.name === "string" && typeof e.type === "string") {
          entities.push({
            name: e.name,
            type: validTypes.includes(e.type) ? e.type : "Concept",
            properties: typeof e.properties === "object" && e.properties !== null ? Object.fromEntries(
              Object.entries(e.properties).map(([k, v]) => [k, String(v)])
            ) : {}
          });
        }
      }
    }
    if (Array.isArray(raw.relationships)) {
      for (const r of raw.relationships) {
        if (r && typeof r === "object" && typeof r.from_entity === "string" && typeof r.to_entity === "string" && typeof r.relationship === "string") {
          relationships.push({
            from_entity: r.from_entity,
            to_entity: r.to_entity,
            relationship: validRels.includes(r.relationship) ? r.relationship : "RELATED_TO",
            properties: typeof r.properties === "object" && r.properties !== null ? Object.fromEntries(
              Object.entries(r.properties).map(([k, v]) => [k, String(v)])
            ) : {}
          });
        }
      }
    }
    return { entities, relationships };
  }
};

// src/storage/orchestrator.ts
var _uuid = require('uuid');
var StorageOrchestrator = class {
  
  
  
  
  
  
  
  
  constructor(config) {
    this.tier = config.tier;
    this.sqlite = new SqliteStorage(config.sqlite.path);
    this.startTime = Date.now();
    if (config.qdrant) {
      this.qdrant = new QdrantStorage(config.qdrant);
    } else {
      this.qdrant = null;
    }
    if (config.age) {
      this.age = new AgeStorage(config.age);
    } else {
      this.age = null;
    }
    if (config.embedding) {
      this.embeddings = new EmbeddingService(config.embedding);
    } else {
      this.embeddings = null;
    }
    if (config.extraction && config.extraction.enabled) {
      this.entityExtractor = new EntityExtractor(config.extraction);
    } else {
      this.entityExtractor = null;
    }
    this.syncProcessor = new SyncQueueProcessor(
      this.sqlite,
      this.qdrant,
      this.age,
      this.embeddings
    );
  }
  async init() {
    if (this.qdrant) {
      try {
        const dimensions = _optionalChain([this, 'access', _16 => _16.embeddings, 'optionalAccess', _17 => _17.getDimensions, 'call', _18 => _18()]) || 1536;
        await this.qdrant.ensureCollection(dimensions);
        console.log("[orchestrator] Qdrant collection ready");
      } catch (error) {
        console.warn(`[orchestrator] Qdrant init failed (will retry): ${error}`);
      }
    }
    if (this.age) {
      try {
        await this.age.ensureGraph();
        console.log("[orchestrator] AGE graph ready");
      } catch (error) {
        console.warn(`[orchestrator] AGE init failed (will retry): ${error}`);
      }
    }
    if (this.qdrant || this.age) {
      this.syncProcessor.start(6e4);
    }
  }
  // ── Create Memory ───────────────────────────────────────────────────
  async createMemory(req) {
    const now = (/* @__PURE__ */ new Date()).toISOString();
    const id = _uuid.v7.call(void 0, );
    let entities = [];
    let relationships = [];
    const shouldExtract = this.entityExtractor && req.extract_entities !== false && req.content.length >= 20 && req.source !== "entity_extraction";
    if (shouldExtract) {
      try {
        const extraction = await this.entityExtractor.extract(req.content);
        entities = extraction.entities;
        relationships = extraction.relationships;
      } catch (error) {
        console.warn(`[orchestrator] Entity extraction failed: ${error}`);
      }
    }
    const embeddingHash = contentHash(req.content);
    const memory = {
      id,
      agent_id: req.agent_id,
      scope: req.scope,
      subject_id: _nullishCoalesce(req.subject_id, () => ( null)),
      content: req.content,
      tags: req.tags || [],
      entities,
      source: req.source || "explicit",
      created_by: _nullishCoalesce(req.created_by, () => ( null)),
      created_at: now,
      updated_at: now,
      expires_at: _nullishCoalesce(req.expires_at, () => ( null)),
      embedding_hash: embeddingHash
    };
    this.sqlite.createMemory(memory);
    const qdrantStatus = await this.asyncL2Upsert(memory);
    const ageStatus = await this.asyncL3Upsert(memory, entities, relationships);
    return {
      id: memory.id,
      agent_id: memory.agent_id,
      scope: memory.scope,
      content: memory.content,
      entities: memory.entities,
      created_at: memory.created_at,
      sync_status: {
        sqlite: "ok",
        qdrant: qdrantStatus,
        age: ageStatus
      }
    };
  }
  // ── Update Memory ───────────────────────────────────────────────────
  async updateMemory(id, req) {
    const existing = this.sqlite.getMemory(id);
    if (!existing) return null;
    let entities = existing.entities;
    let relationships = [];
    if (req.content && req.content !== existing.content) {
      const shouldExtract = this.entityExtractor && req.extract_entities !== false && req.content.length >= 20;
      if (shouldExtract) {
        try {
          const extraction = await this.entityExtractor.extract(req.content);
          entities = extraction.entities;
          relationships = extraction.relationships;
        } catch (error) {
          console.warn(`[orchestrator] Entity extraction failed on update: ${error}`);
        }
      }
    }
    const embeddingHash = req.content ? contentHash(req.content) : existing.embedding_hash;
    const updates = {
      ...req.content !== void 0 && { content: req.content },
      ...req.tags !== void 0 && { tags: req.tags },
      ...req.scope !== void 0 && { scope: req.scope },
      ...req.subject_id !== void 0 && { subject_id: req.subject_id },
      ...req.expires_at !== void 0 && { expires_at: req.expires_at },
      entities,
      embedding_hash: embeddingHash
    };
    const updated = this.sqlite.updateMemory(id, updates);
    if (!updated) return null;
    const qdrantStatus = await this.asyncL2Upsert(updated);
    const ageStatus = await this.asyncL3Upsert(updated, entities, relationships);
    return {
      id: updated.id,
      agent_id: updated.agent_id,
      scope: updated.scope,
      content: updated.content,
      tags: updated.tags,
      entities: updated.entities,
      created_at: updated.created_at,
      updated_at: updated.updated_at,
      sync_status: {
        sqlite: "ok",
        qdrant: qdrantStatus,
        age: ageStatus
      }
    };
  }
  // ── Delete Memory ───────────────────────────────────────────────────
  async deleteMemory(id) {
    const deleted = this.sqlite.deleteMemory(id);
    if (!deleted) return false;
    if (this.qdrant) {
      try {
        await this.qdrant.deleteMemory(id);
      } catch (error) {
        console.warn(`[orchestrator] Qdrant delete failed, queuing: ${error}`);
        this.sqlite.addToSyncQueue(id, "qdrant", "delete");
      }
    }
    if (this.age) {
      try {
        await this.age.deleteMemoryNode(id);
      } catch (error) {
        console.warn(`[orchestrator] AGE delete failed, queuing: ${error}`);
        this.sqlite.addToSyncQueue(id, "age", "delete");
      }
    }
    return true;
  }
  // ── Health Check ────────────────────────────────────────────────────
  async healthCheck() {
    const details = {};
    const sqliteOk = this.sqlite.healthCheck();
    if (!sqliteOk) details.sqlite = "SQLite health check failed";
    let qdrantStatus = "disabled";
    if (this.qdrant) {
      try {
        qdrantStatus = await this.qdrant.healthCheck() ? "ok" : "error";
      } catch (error) {
        qdrantStatus = "error";
        details.qdrant = String(error);
      }
    }
    let ageStatus = "disabled";
    if (this.age) {
      try {
        ageStatus = await this.age.healthCheck() ? "ok" : "error";
      } catch (error) {
        ageStatus = "error";
        details.age = String(error);
      }
    }
    return {
      sqlite: sqliteOk ? "ok" : "error",
      qdrant: qdrantStatus,
      age: ageStatus,
      tier: this.tier,
      uptime: Math.floor((Date.now() - this.startTime) / 1e3),
      ...Object.keys(details).length > 0 && { details }
    };
  }
  // ── Retry Sync ──────────────────────────────────────────────────────
  async retrySyncQueue() {
    return this.syncProcessor.processQueue();
  }
  // ── Cleanup ─────────────────────────────────────────────────────────
  async close() {
    this.syncProcessor.stop();
    this.sqlite.close();
    if (this.age) await this.age.close();
  }
  // ── Private Helpers ─────────────────────────────────────────────────
  async asyncL2Upsert(memory) {
    if (!this.qdrant || !this.embeddings) return "disabled";
    try {
      const vector = await this.embeddings.embed(memory.content);
      if (!vector) {
        this.sqlite.addToSyncQueue(memory.id, "qdrant", "upsert");
        return "queued";
      }
      await this.qdrant.upsertMemory(memory, vector);
      this.sqlite.updateMemory(memory.id, {
        embedding_hash: contentHash(memory.content)
      });
      return "ok";
    } catch (error) {
      console.warn(`[orchestrator] Qdrant upsert failed, queuing: ${error}`);
      this.sqlite.addToSyncQueue(memory.id, "qdrant", "upsert");
      return "queued";
    }
  }
  async asyncL3Upsert(memory, entities, relationships) {
    if (!this.age) return "disabled";
    try {
      await this.age.upsertMemoryNode(memory);
      for (const entity of entities) {
        const entityId = await this.age.upsertEntityNode(entity, memory.agent_id);
        await this.age.linkMemoryToEntity(memory.id, entityId);
      }
      for (const rel of relationships) {
        await this.age.createRelationship(rel, memory.agent_id);
      }
      return "ok";
    } catch (error) {
      console.warn(`[orchestrator] AGE upsert failed, queuing: ${error}`);
      this.sqlite.addToSyncQueue(memory.id, "age", "upsert");
      return "queued";
    }
  }
};
function contentHash(content) {
  return _crypto.createHash.call(void 0, "sha256").update(content).digest("hex").slice(0, 16);
}

// src/search/strategy.ts
var KEY_LOOKUP_PATTERNS = [
  /what is .+'s/i,
  /what are .+'s/i,
  /.+'s (email|phone|address|preference|setting)/i,
  /^(get|find|show|tell me) .+'s/i,
  /^what (does|did) .+ (like|prefer|use|want)/i
];
var RELATIONSHIP_PATTERNS = [
  /who (works on|knows|created|manages|uses)/i,
  /what.+(connected|related|linked|associated) (to|with)/i,
  /how (is|are) .+ (related|connected)/i,
  /relationship between/i,
  /(works on|belongs to|depends on|uses)/i,
  /what projects does/i,
  /who is involved (in|with)/i
];
function selectStrategy(request) {
  if (request.strategy && request.strategy !== "auto") {
    switch (request.strategy) {
      case "semantic":
        return "semantic";
      case "fulltext":
        return "fulltext";
      case "graph":
        return "graph";
      case "all":
        return "all";
      default:
        break;
    }
  }
  const query = request.query.toLowerCase();
  if (isKeyLookup(query)) return "fulltext+graph";
  if (isRelationshipQuery(query)) return "graph+semantic";
  return "semantic+graph";
}
function isKeyLookup(query) {
  return KEY_LOOKUP_PATTERNS.some((pattern) => pattern.test(query));
}
function isRelationshipQuery(query) {
  return RELATIONSHIP_PATTERNS.some((pattern) => pattern.test(query));
}

// src/search/ranker.ts
function normalizeFtsScore(rank) {
  const normalized = Math.min(1, Math.max(0, -rank / 20));
  return normalized;
}
function recencyBoost(createdAt) {
  const created = new Date(createdAt).getTime();
  const now = Date.now();
  const daysOld = (now - created) / (1e3 * 60 * 60 * 24);
  return Math.max(0.5, Math.pow(0.95, daysOld));
}
function multiLayerBoost(layerCount) {
  return (layerCount - 1) * 0.1;
}
function applyBoosts(result, layerAppearances) {
  let score = result.score;
  if (result.memory.created_at) {
    score *= recencyBoost(result.memory.created_at);
  }
  score += multiLayerBoost(layerAppearances);
  score = Math.min(1, Math.max(0, score));
  return { ...result, score };
}

// src/search/engine.ts
var SearchEngine = class {
  
  constructor(orchestrator) {
    this.orchestrator = orchestrator;
  }
  async search(request) {
    const strategy = selectStrategy(request);
    const limit = request.limit || 10;
    const scopes = request.scopes || ["user", "agent", "global"];
    const includeGraph = request.include_graph !== false;
    const layerStats = {
      sqlite: { count: 0, ms: 0 },
      qdrant: { count: 0, ms: 0 },
      age: { count: 0, ms: 0 }
    };
    const allResults = [];
    const searches = [];
    if (shouldSearchFulltext(strategy)) {
      searches.push(
        this.searchFulltext(request, scopes, limit).then((results) => {
          layerStats.sqlite.count = results.length;
          allResults.push(...results);
        })
      );
    }
    if (shouldSearchSemantic(strategy) && this.orchestrator.qdrant && this.orchestrator.embeddings) {
      searches.push(
        this.searchSemantic(request, scopes, limit).then((results) => {
          layerStats.qdrant.count = results.length;
          allResults.push(...results);
        })
      );
    }
    if (shouldSearchGraph(strategy) && includeGraph && this.orchestrator.age) {
      searches.push(
        this.searchGraph(request, limit).then((results) => {
          layerStats.age.count = results.length;
          allResults.push(...results);
        })
      );
    }
    const startTime = Date.now();
    await Promise.allSettled(searches);
    const elapsed = Date.now() - startTime;
    if (layerStats.sqlite.count > 0) layerStats.sqlite.ms = elapsed;
    if (layerStats.qdrant.count > 0) layerStats.qdrant.ms = elapsed;
    if (layerStats.age.count > 0) layerStats.age.ms = elapsed;
    const merged = this.mergeResults(allResults, limit);
    return {
      results: merged,
      strategy_used: strategy,
      layer_stats: layerStats
    };
  }
  // ── Layer-Specific Searches ─────────────────────────────────────────
  async searchFulltext(request, scopes, limit) {
    try {
      const results = this.orchestrator.sqlite.searchFullText(
        request.query,
        request.cross_agent ? void 0 : request.agent_id,
        scopes,
        request.subject_id,
        limit
      );
      return results.map((r) => ({
        memory: r,
        score: normalizeFtsScore(r.fts_rank),
        source_layer: "sqlite"
      }));
    } catch (error) {
      console.warn(`[search] Fulltext search failed: ${error}`);
      return [];
    }
  }
  async searchSemantic(request, scopes, limit) {
    try {
      if (!this.orchestrator.embeddings || !this.orchestrator.qdrant) return [];
      const queryVector = await this.orchestrator.embeddings.embed(request.query);
      if (!queryVector) return [];
      return await this.orchestrator.qdrant.search(
        queryVector,
        request.cross_agent ? void 0 : request.agent_id,
        scopes,
        request.subject_id,
        limit,
        request.cross_agent
      );
    } catch (error) {
      console.warn(`[search] Semantic search failed: ${error}`);
      return [];
    }
  }
  async searchGraph(request, limit) {
    try {
      if (!this.orchestrator.age) return [];
      const entityName = extractEntityFromQuery(request.query);
      if (!entityName) return [];
      return await this.orchestrator.age.searchByEntity(
        entityName,
        void 0,
        request.cross_agent ? void 0 : request.agent_id,
        limit
      );
    } catch (error) {
      console.warn(`[search] Graph search failed: ${error}`);
      return [];
    }
  }
  // ── Result Merging ──────────────────────────────────────────────────
  mergeResults(allResults, limit) {
    const byId = /* @__PURE__ */ new Map();
    for (const result of allResults) {
      const existing = byId.get(result.memory.id) || [];
      existing.push(result);
      byId.set(result.memory.id, existing);
    }
    const merged = [];
    for (const [_id, results] of byId) {
      results.sort((a, b) => b.score - a.score);
      const best = results[0];
      const graphContext = results.filter((r) => r.graph_context).flatMap((r) => r.graph_context.related_entities);
      const boosted = applyBoosts(best, results.length);
      if (graphContext.length > 0) {
        boosted.graph_context = { related_entities: graphContext };
      }
      merged.push(boosted);
    }
    merged.sort((a, b) => b.score - a.score);
    return merged.slice(0, limit);
  }
};
function shouldSearchFulltext(strategy) {
  return ["fulltext", "fulltext+graph", "all"].includes(strategy);
}
function shouldSearchSemantic(strategy) {
  return ["semantic", "semantic+graph", "graph+semantic", "all"].includes(strategy);
}
function shouldSearchGraph(strategy) {
  return ["graph", "fulltext+graph", "graph+semantic", "semantic+graph", "all"].includes(strategy);
}
function extractEntityFromQuery(query) {
  const quoted = query.match(/["']([^"']+)["']/);
  if (quoted) return quoted[1];
  const aboutMatch = query.match(
    /(?:about|on|for|regarding|related to|connected to)\s+([A-Z][a-zA-Z]*(?:\s+[A-Z][a-zA-Z]*)*)/i
  );
  if (aboutMatch) return aboutMatch[1];
  const capitalWords = query.match(/\b[A-Z][a-zA-Z]+(?:\s+[A-Z][a-zA-Z]+)*/g);
  if (capitalWords && capitalWords.length > 0) {
    return capitalWords.sort((a, b) => b.length - a.length)[0];
  }
  const whoPattern = query.match(
    /who\s+(?:works on|knows|created|uses|manages)\s+(.+)/i
  );
  if (whoPattern) return whoPattern[1].trim();
  if (query.split(/\s+/).length <= 3) {
    return query.trim();
  }
  return null;
}

// src/extraction/summarizer.ts

var SUMMARIZE_PROMPT = `Summarize this conversation into 5-10 concise bullet points.
Focus on:
- Decisions made
- Tasks discussed or assigned
- Preferences expressed
- Important facts learned
- Action items or next steps

Be specific. Use names and details. Skip pleasantries and meta-conversation.
Return the summary as a plain text bulleted list.`;
var ConversationSummarizer = class {
  
  
  constructor(config) {
    this.client = new (0, _openai2.default)({
      apiKey: config.apiKey,
      baseURL: config.baseUrl
    });
    this.model = config.model;
  }
  async summarize(messages) {
    if (messages.length === 0) return null;
    const transcript = messages.map((m) => {
      const prefix = m.role === "user" ? "User" : m.role === "assistant" ? "Assistant" : "System";
      return `${prefix}: ${m.content}`;
    }).join("\n");
    const truncated = transcript.slice(-6e3);
    try {
      const response = await this.client.chat.completions.create({
        model: this.model,
        messages: [
          { role: "system", content: SUMMARIZE_PROMPT },
          { role: "user", content: truncated }
        ],
        temperature: 0.2,
        max_tokens: 500
      });
      const content = _optionalChain([response, 'access', _19 => _19.choices, 'access', _20 => _20[0], 'optionalAccess', _21 => _21.message, 'optionalAccess', _22 => _22.content, 'optionalAccess', _23 => _23.trim, 'call', _24 => _24()]);
      return content || null;
    } catch (error) {
      console.error(`[summarizer] Summarization failed: ${error}`);
      return null;
    }
  }
};





exports.StorageOrchestrator = StorageOrchestrator; exports.SearchEngine = SearchEngine; exports.ConversationSummarizer = ConversationSummarizer;
//# sourceMappingURL=chunk-CRPEAZ44.cjs.map