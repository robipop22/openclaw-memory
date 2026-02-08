import {
  ConversationSummarizer,
  SearchEngine,
  StorageOrchestrator
} from "./chunk-JSQBXYDM.js";
import {
  loadConfig
} from "./chunk-JNWCMHOB.js";

// src/core/memory-service.ts
var MemoryService = class {
  orchestrator;
  searchEngine;
  summarizer = null;
  config;
  initialized = false;
  pendingConfig;
  constructor(config) {
    this.pendingConfig = config;
  }
  async init() {
    if (this.initialized) return;
    if (typeof this.pendingConfig === "string") {
      this.config = await loadConfig(this.pendingConfig);
    } else if (this.pendingConfig) {
      this.config = await loadConfig();
      if (this.pendingConfig.tier) this.config.tier = this.pendingConfig.tier;
      if (this.pendingConfig.port) this.config.port = this.pendingConfig.port;
    } else {
      this.config = await loadConfig();
    }
    this.orchestrator = new StorageOrchestrator(this.config);
    await this.orchestrator.init();
    this.searchEngine = new SearchEngine(this.orchestrator);
    if (this.config.extraction) {
      this.summarizer = new ConversationSummarizer({
        apiKey: this.config.extraction.apiKey,
        baseUrl: this.config.extraction.baseUrl,
        model: this.config.extraction.model
      });
    }
    this.initialized = true;
  }
  async close() {
    if (!this.initialized) return;
    await this.orchestrator.close();
    this.initialized = false;
  }
  // ── Memory CRUD ─────────────────────────────────────────────────────
  async store(params) {
    this.ensureInit();
    const result = await this.orchestrator.createMemory({
      agent_id: params.agentId,
      scope: params.scope,
      subject_id: params.subjectId ?? null,
      content: params.content,
      tags: params.tags,
      source: params.source,
      created_by: params.createdBy ?? null,
      extract_entities: params.extractEntities,
      expires_at: params.expiresAt ?? null
    });
    return {
      id: result.id,
      agentId: result.agent_id,
      scope: result.scope,
      content: result.content,
      entities: result.entities,
      createdAt: result.created_at,
      syncStatus: result.sync_status
    };
  }
  async get(id) {
    this.ensureInit();
    return this.orchestrator.sqlite.getMemory(id);
  }
  async update(id, params) {
    this.ensureInit();
    const result = await this.orchestrator.updateMemory(id, {
      content: params.content,
      tags: params.tags,
      scope: params.scope,
      subject_id: params.subjectId,
      expires_at: params.expiresAt,
      extract_entities: params.extractEntities
    });
    if (!result) return null;
    return this.orchestrator.sqlite.getMemory(id);
  }
  async delete(id) {
    this.ensureInit();
    return this.orchestrator.deleteMemory(id);
  }
  async list(params) {
    this.ensureInit();
    return this.orchestrator.sqlite.listMemories({
      agent_id: params?.agentId,
      scope: params?.scope,
      subject_id: params?.subjectId,
      source: params?.source,
      tags: params?.tags,
      limit: params?.limit,
      offset: params?.offset,
      order: params?.order
    });
  }
  // ── Search ──────────────────────────────────────────────────────────
  async search(params) {
    this.ensureInit();
    return this.searchEngine.search({
      agent_id: params.agentId,
      query: params.query,
      scopes: params.scopes,
      subject_id: params.subjectId,
      limit: params.limit,
      include_graph: params.includeGraph,
      cross_agent: params.crossAgent,
      strategy: params.strategy
    });
  }
  async searchSemantic(params) {
    return this.search({ ...params, strategy: "semantic" });
  }
  async searchFulltext(params) {
    return this.search({ ...params, strategy: "fulltext" });
  }
  async searchGraph(params) {
    return this.search({ ...params, strategy: "graph" });
  }
  // ── Conversations ───────────────────────────────────────────────────
  async logConversation(entry) {
    this.ensureInit();
    this.orchestrator.sqlite.appendConversationLog(entry);
  }
  async summarizeConversation(params) {
    this.ensureInit();
    if (!this.summarizer) return null;
    const summary = await this.summarizer.summarize(params.messages);
    if (!summary) return null;
    const result = await this.orchestrator.createMemory({
      agent_id: params.agentId,
      scope: "session",
      subject_id: params.userId,
      content: summary,
      tags: ["conversation_summary", params.channel, `session:${params.sessionId}`],
      source: "conversation_summary",
      created_by: params.agentId,
      extract_entities: true
    });
    return {
      memory_id: result.id,
      summary,
      entities_extracted: result.entities,
      relationships_created: 0
    };
  }
  // ── Entities ────────────────────────────────────────────────────────
  async getEntity(type, id) {
    this.ensureInit();
    if (!this.orchestrator.age) return null;
    const result = await this.orchestrator.age.getEntityWithRelationships(type, id);
    return result.entity;
  }
  async listEntities(type) {
    this.ensureInit();
    if (!this.orchestrator.age) return [];
    return this.orchestrator.age.listEntities(type);
  }
  async getRelatedEntities(entityId, depth) {
    this.ensureInit();
    if (!this.orchestrator.age) return [];
    const results = await this.orchestrator.age.getRelatedEntities(entityId, depth);
    return results.map((r) => r.entity);
  }
  // ── Admin ───────────────────────────────────────────────────────────
  async health() {
    this.ensureInit();
    return this.orchestrator.healthCheck();
  }
  async retrySyncQueue() {
    this.ensureInit();
    return this.orchestrator.retrySyncQueue();
  }
  async migrateMarkdown(paths, agentId) {
    this.ensureInit();
    const fs = await import("fs");
    const pathLib = await import("path");
    let migrated = 0;
    const errors = [];
    for (const filePath of paths) {
      try {
        if (!fs.existsSync(filePath)) {
          errors.push(`File not found: ${filePath}`);
          continue;
        }
        const content = fs.readFileSync(filePath, "utf-8");
        const req = {
          agent_id: agentId,
          scope: "global",
          content: content.trim(),
          source: "migration",
          created_by: "migration",
          extract_entities: true
        };
        await this.orchestrator.createMemory(req);
        migrated++;
      } catch (error) {
        errors.push(`${filePath}: ${error instanceof Error ? error.message : String(error)}`);
      }
    }
    return { migrated, errors };
  }
  // ── Config ──────────────────────────────────────────────────────────
  get tier() {
    return this.config.tier;
  }
  get resolvedConfig() {
    return this.config;
  }
  // ── Internal: expose orchestrator for server mode ───────────────────
  getOrchestrator() {
    this.ensureInit();
    return this.orchestrator;
  }
  // ── Helpers ─────────────────────────────────────────────────────────
  ensureInit() {
    if (!this.initialized) {
      throw new Error("MemoryService not initialized. Call .init() first.");
    }
  }
};

export {
  MemoryService
};
//# sourceMappingURL=chunk-NHFPLDZK.js.map