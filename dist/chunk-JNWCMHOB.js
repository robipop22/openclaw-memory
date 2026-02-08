// src/config/index.ts
import path from "path";
import os from "os";
import fs from "fs";

// src/core/errors.ts
var MemoryError = class extends Error {
  constructor(message, code) {
    super(message);
    this.code = code;
    this.name = "MemoryError";
  }
};
var ConfigError = class extends MemoryError {
  constructor(message) {
    super(message, "CONFIG_ERROR");
    this.name = "ConfigError";
  }
};
var ValidationError = class extends MemoryError {
  constructor(message, details) {
    super(message, "VALIDATION_ERROR");
    this.details = details;
    this.name = "ValidationError";
  }
};
var NotFoundError = class extends MemoryError {
  constructor(resource, id) {
    super(`${resource} not found: ${id}`, "NOT_FOUND");
    this.name = "NotFoundError";
  }
};
var AuthError = class extends MemoryError {
  constructor(message = "Unauthorized") {
    super(message, "AUTH_ERROR");
    this.name = "AuthError";
  }
};

// src/config/defaults.ts
var DEFAULTS = {
  port: 7777,
  host: "0.0.0.0",
  sqlite: {
    path: "~/.openclaw-memory/memory.sqlite"
  },
  qdrant: {
    collection: "openclaw_memories"
  },
  age: {
    port: 5432,
    graph: "agent_memory"
  },
  embedding: {
    model: "text-embedding-3-small",
    dimensions: 1536
  },
  extraction: {
    model: "gpt-4o-mini",
    enabled: true
  },
  auth: {
    enabled: true
  }
};

// src/config/index.ts
function expandHome(p) {
  if (p.startsWith("~/") || p === "~") {
    return path.join(os.homedir(), p.slice(1));
  }
  return p;
}
function getDataDir() {
  return process.env.OPENCLAW_MEMORY_DATA_DIR || path.join(os.homedir(), ".openclaw-memory");
}
function getDefaultSqlitePath() {
  return path.join(getDataDir(), "memory.sqlite");
}
function getPidFilePath() {
  return path.join(getDataDir(), "server.pid");
}
function getConfigSearchPaths(cwd) {
  return [
    path.join(cwd, "openclaw-memory.config.ts"),
    path.join(cwd, "openclaw-memory.config.js"),
    path.join(cwd, "openclaw-memory.config.json"),
    path.join(getDataDir(), "config.ts"),
    path.join(getDataDir(), "config.json")
  ];
}
async function loadConfigFile(configPath) {
  const searchPaths = configPath ? [configPath] : getConfigSearchPaths(process.cwd());
  for (const p of searchPaths) {
    if (fs.existsSync(p)) {
      if (p.endsWith(".json")) {
        const content = fs.readFileSync(p, "utf-8");
        return JSON.parse(content);
      }
      try {
        const mod = await import(p);
        return mod.default || mod;
      } catch {
      }
    }
  }
  return null;
}
function loadFromEnv() {
  const config = {};
  try {
    const dotenvPath = path.join(process.cwd(), ".env");
    if (fs.existsSync(dotenvPath)) {
      const envContent = fs.readFileSync(dotenvPath, "utf-8");
      for (const line of envContent.split("\n")) {
        const trimmed = line.trim();
        if (!trimmed || trimmed.startsWith("#")) continue;
        const eqIdx = trimmed.indexOf("=");
        if (eqIdx === -1) continue;
        const key = trimmed.slice(0, eqIdx).trim();
        const value = trimmed.slice(eqIdx + 1).trim().replace(/^["']|["']$/g, "");
        if (!process.env[key]) {
          process.env[key] = value;
        }
      }
    }
  } catch {
  }
  const env = process.env;
  const tier = env.OPENCLAW_MEMORY_TIER || env.MEMORY_TIER;
  if (tier && ["lite", "standard", "full"].includes(tier)) {
    config.tier = tier;
  }
  const port = env.OPENCLAW_MEMORY_PORT || env.PORT;
  if (port) config.port = parseInt(port, 10);
  const host = env.OPENCLAW_MEMORY_HOST;
  if (host) config.host = host;
  const authToken = env.OPENCLAW_MEMORY_AUTH__TOKEN || env.AUTH_TOKEN || env.MEMORY_TOKEN;
  if (authToken) {
    config.auth = { token: authToken, enabled: true };
  }
  const sqlitePath = env.OPENCLAW_MEMORY_SQLITE__PATH || env.SQLITE_PATH;
  if (sqlitePath) {
    config.sqlite = { path: sqlitePath };
  }
  const qdrantUrl = env.OPENCLAW_MEMORY_QDRANT__URL || env.QDRANT_URL;
  if (qdrantUrl) {
    config.qdrant = {
      url: qdrantUrl,
      collection: env.OPENCLAW_MEMORY_QDRANT__COLLECTION || env.QDRANT_COLLECTION || DEFAULTS.qdrant.collection,
      apiKey: env.OPENCLAW_MEMORY_QDRANT__API_KEY
    };
  }
  const ageHost = env.OPENCLAW_MEMORY_AGE__HOST || env.PGHOST;
  if (ageHost) {
    config.age = {
      host: ageHost,
      port: parseInt(env.OPENCLAW_MEMORY_AGE__PORT || env.PGPORT || String(DEFAULTS.age.port), 10),
      user: env.OPENCLAW_MEMORY_AGE__USER || env.PGUSER || "",
      password: env.OPENCLAW_MEMORY_AGE__PASSWORD || env.PGPASSWORD || "",
      database: env.OPENCLAW_MEMORY_AGE__DATABASE || env.PGDATABASE || "",
      graph: env.OPENCLAW_MEMORY_AGE__GRAPH || env.AGE_GRAPH || DEFAULTS.age.graph
    };
  }
  const embeddingApiKey = env.OPENCLAW_MEMORY_EMBEDDING__API_KEY || env.OPENROUTER_API_KEY || env.OPENAI_API_KEY;
  if (embeddingApiKey) {
    config.embedding = {
      apiKey: embeddingApiKey,
      baseUrl: env.OPENCLAW_MEMORY_EMBEDDING__BASE_URL || env.EMBEDDING_BASE_URL,
      model: env.OPENCLAW_MEMORY_EMBEDDING__MODEL || env.EMBEDDING_MODEL || DEFAULTS.embedding.model,
      dimensions: parseInt(env.OPENCLAW_MEMORY_EMBEDDING__DIMENSIONS || String(DEFAULTS.embedding.dimensions), 10)
    };
  }
  const extractionApiKey = env.OPENCLAW_MEMORY_EXTRACTION__API_KEY || env.OPENROUTER_API_KEY || env.OPENAI_API_KEY;
  if (extractionApiKey) {
    config.extraction = {
      apiKey: extractionApiKey,
      baseUrl: env.OPENCLAW_MEMORY_EXTRACTION__BASE_URL || env.EXTRACTION_BASE_URL,
      model: env.OPENCLAW_MEMORY_EXTRACTION__MODEL || env.EXTRACTION_MODEL || DEFAULTS.extraction.model,
      enabled: env.OPENCLAW_MEMORY_EXTRACTION__ENABLED !== "false"
    };
  }
  return config;
}
function inferTier(config) {
  if (config.tier) return config.tier;
  if (config.qdrant && config.age) return "full";
  if (config.qdrant) return "standard";
  return "lite";
}
async function loadConfig(configPath) {
  const fileConfig = await loadConfigFile(configPath);
  const envConfig = loadFromEnv();
  const merged = {
    ...fileConfig,
    ...envConfig,
    // Deep merge nested objects
    auth: { ...fileConfig?.auth, ...envConfig.auth },
    sqlite: { ...fileConfig?.sqlite, ...envConfig.sqlite }
  };
  if (envConfig.qdrant || fileConfig?.qdrant) {
    merged.qdrant = { ...fileConfig?.qdrant, ...envConfig.qdrant };
  }
  if (envConfig.age || fileConfig?.age) {
    merged.age = { ...fileConfig?.age, ...envConfig.age };
  }
  if (envConfig.embedding || fileConfig?.embedding) {
    merged.embedding = { ...fileConfig?.embedding, ...envConfig.embedding };
  }
  if (envConfig.extraction || fileConfig?.extraction) {
    merged.extraction = { ...fileConfig?.extraction, ...envConfig.extraction };
  }
  const tier = inferTier(merged);
  const sqlitePath = expandHome(merged.sqlite?.path || DEFAULTS.sqlite.path);
  let qdrant = null;
  if (tier !== "lite" && merged.qdrant?.url) {
    qdrant = {
      url: merged.qdrant.url,
      collection: merged.qdrant.collection || DEFAULTS.qdrant.collection,
      apiKey: merged.qdrant.apiKey
    };
  }
  let age = null;
  if (tier === "full" && merged.age?.host) {
    if (!merged.age.user || !merged.age.password || !merged.age.database) {
      throw new ConfigError("Full tier requires age.user, age.password, and age.database");
    }
    age = {
      host: merged.age.host,
      port: merged.age.port || DEFAULTS.age.port,
      user: merged.age.user,
      password: merged.age.password,
      database: merged.age.database,
      graph: merged.age.graph || DEFAULTS.age.graph
    };
  }
  let embedding = null;
  if (tier !== "lite" && merged.embedding?.apiKey) {
    embedding = {
      apiKey: merged.embedding.apiKey,
      baseUrl: merged.embedding.baseUrl,
      model: merged.embedding.model || DEFAULTS.embedding.model,
      dimensions: merged.embedding.dimensions || DEFAULTS.embedding.dimensions
    };
  }
  let extraction = null;
  if (tier !== "lite" && merged.extraction?.apiKey) {
    extraction = {
      apiKey: merged.extraction.apiKey,
      baseUrl: merged.extraction.baseUrl,
      model: merged.extraction.model || DEFAULTS.extraction.model,
      enabled: merged.extraction.enabled ?? DEFAULTS.extraction.enabled
    };
  }
  return {
    tier,
    port: merged.port || DEFAULTS.port,
    host: merged.host || DEFAULTS.host,
    auth: {
      token: merged.auth?.token,
      enabled: merged.auth?.enabled ?? DEFAULTS.auth.enabled
    },
    sqlite: { path: sqlitePath },
    qdrant,
    age,
    embedding,
    extraction,
    agents: merged.agents || fileConfig?.agents || []
  };
}
function defineConfig(config) {
  return config;
}
function configSummary(config) {
  const lines = [
    `Tier: ${config.tier}`,
    `Port: ${config.port}`,
    `Host: ${config.host}`,
    `SQLite: ${config.sqlite.path}`,
    `Auth: ${config.auth.enabled ? "enabled" : "disabled"}`
  ];
  if (config.qdrant) {
    lines.push(`Qdrant: ${config.qdrant.url} (collection: ${config.qdrant.collection})`);
  }
  if (config.age) {
    lines.push(`AGE: ${config.age.host}:${config.age.port}/${config.age.database}`);
  }
  if (config.embedding) {
    lines.push(`Embedding: ${config.embedding.model}${config.embedding.baseUrl ? ` via ${config.embedding.baseUrl}` : ""}`);
  }
  if (config.extraction) {
    lines.push(`Extraction: ${config.extraction.model}${config.extraction.enabled ? "" : " (disabled)"}`);
  }
  return lines.join("\n");
}

export {
  MemoryError,
  ValidationError,
  NotFoundError,
  AuthError,
  getDataDir,
  getDefaultSqlitePath,
  getPidFilePath,
  loadConfig,
  defineConfig,
  configSummary
};
//# sourceMappingURL=chunk-JNWCMHOB.js.map