#!/usr/bin/env node
import {
  getDataDir,
  getDefaultSqlitePath,
  getPidFilePath,
  loadConfig
} from "../chunk-JNWCMHOB.js";

// src/cli/index.ts
import { Command as Command9 } from "commander";

// src/cli/commands/init.ts
import { Command } from "commander";
import fs2 from "fs";
import path from "path";

// src/cli/utils.ts
import pc from "picocolors";
import fs from "fs";
function info(msg) {
  console.log(pc.blue("\u2139") + " " + msg);
}
function success(msg) {
  console.log(pc.green("\u2713") + " " + msg);
}
function warn(msg) {
  console.log(pc.yellow("\u26A0") + " " + msg);
}
function error(msg) {
  console.error(pc.red("\u2717") + " " + msg);
}
function header(title) {
  console.log();
  console.log(pc.bold(`  \u{1F9E0} OpenClaw Memory \u2014 ${title}`));
  console.log();
}
function bullet(label, value, status) {
  const dot = status === "ok" ? pc.green("\u25CF") : status === "error" ? pc.red("\u25CF") : status === "degraded" ? pc.yellow("\u25CF") : status === "disabled" ? pc.dim("\u25CB") : " ";
  console.log(`  ${dot} ${pc.bold(label)}  ${value}`);
}
function getServerPid() {
  const pidPath = getPidFilePath();
  if (!fs.existsSync(pidPath)) return null;
  try {
    const pid = parseInt(fs.readFileSync(pidPath, "utf-8").trim(), 10);
    if (isNaN(pid)) return null;
    try {
      process.kill(pid, 0);
      return pid;
    } catch {
      fs.unlinkSync(pidPath);
      return null;
    }
  } catch {
    return null;
  }
}
async function isServerRunning(baseUrl = "http://localhost:7777") {
  try {
    const res = await fetch(`${baseUrl}/api/health`, {
      signal: AbortSignal.timeout(2e3)
    });
    return res.ok;
  } catch {
    return false;
  }
}
function getBaseUrl(port) {
  return `http://localhost:${port || 7777}`;
}
async function apiGet(baseUrl, path3, token) {
  const headers = {};
  if (token) headers.Authorization = `Bearer ${token}`;
  const res = await fetch(`${baseUrl}${path3}`, { headers });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`HTTP ${res.status}: ${text}`);
  }
  return res.json();
}
async function apiPost(baseUrl, path3, body, token) {
  const headers = { "Content-Type": "application/json" };
  if (token) headers.Authorization = `Bearer ${token}`;
  const res = await fetch(`${baseUrl}${path3}`, {
    method: "POST",
    headers,
    body: JSON.stringify(body)
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`HTTP ${res.status}: ${text}`);
  }
  return res.json();
}
function output(data, format = "json") {
  if (format === "text") {
    console.log(JSON.stringify(data, null, 2));
  } else {
    console.log(JSON.stringify(data));
  }
}
async function readStdin() {
  if (process.stdin.isTTY) return "";
  const chunks = [];
  for await (const chunk of process.stdin) {
    chunks.push(Buffer.from(chunk));
  }
  return Buffer.concat(chunks).toString("utf-8").trim();
}

// src/cli/commands/init.ts
function initCommand() {
  return new Command("init").description("Interactive setup wizard").option("--tier <tier>", "Tier: lite, standard, or full").option("--non-interactive", "Skip prompts, use defaults + flags").action(async (opts) => {
    header("Setup Wizard");
    const tier = opts.tier || "lite";
    const dataDir = getDataDir();
    const sqlitePath = getDefaultSqlitePath();
    fs2.mkdirSync(dataDir, { recursive: true });
    info(`Data directory: ${dataDir}`);
    let qdrantAvailable = false;
    let ageAvailable = false;
    if (tier !== "lite") {
      info("Checking Qdrant connectivity...");
      try {
        const res = await fetch("http://localhost:6333/collections", {
          signal: AbortSignal.timeout(2e3)
        });
        qdrantAvailable = res.ok;
      } catch {
      }
      if (qdrantAvailable) {
        success("Qdrant is reachable at http://localhost:6333");
      } else {
        warn("Qdrant not reachable at http://localhost:6333");
      }
    }
    if (tier === "full") {
      info("Checking PostgreSQL/AGE connectivity...");
      try {
        const net = await import("net");
        ageAvailable = await new Promise((resolve) => {
          const socket = new net.Socket();
          socket.setTimeout(2e3);
          socket.connect(5432, "localhost", () => {
            socket.destroy();
            resolve(true);
          });
          socket.on("error", () => resolve(false));
          socket.on("timeout", () => {
            socket.destroy();
            resolve(false);
          });
        });
      } catch {
      }
      if (ageAvailable) {
        success("PostgreSQL is reachable at localhost:5432");
      } else {
        warn("PostgreSQL not reachable at localhost:5432");
      }
    }
    let effectiveTier = tier;
    if (tier === "full" && !ageAvailable) {
      effectiveTier = qdrantAvailable ? "standard" : "lite";
      warn(`Downgrading to ${effectiveTier} tier (missing dependencies)`);
    } else if (tier === "standard" && !qdrantAvailable) {
      effectiveTier = "lite";
      warn("Downgrading to lite tier (Qdrant not available)");
    }
    const configContent = generateConfig(effectiveTier, sqlitePath);
    const configPath = path.join(process.cwd(), "openclaw-memory.config.ts");
    fs2.writeFileSync(configPath, configContent, "utf-8");
    success(`Config written to ${configPath}`);
    const envExample = generateEnvExample(effectiveTier);
    const envPath = path.join(process.cwd(), ".env.example");
    fs2.writeFileSync(envPath, envExample, "utf-8");
    success(`Environment template written to ${envPath}`);
    console.log();
    info("Next steps:");
    console.log("  openclaw-memory start     # Start the server");
    console.log("  openclaw-memory status    # Check all layers");
    console.log();
  });
}
function generateConfig(tier, sqlitePath) {
  const lines = [
    `import { defineConfig } from 'openclaw-memory';`,
    ``,
    `export default defineConfig({`,
    `  tier: '${tier}',`,
    `  port: 7777,`,
    `  auth: {`,
    `    token: process.env.MEMORY_AUTH_TOKEN || 'change-me',`,
    `  },`,
    `  sqlite: {`,
    `    path: '${sqlitePath}',`,
    `  },`
  ];
  if (tier === "standard" || tier === "full") {
    lines.push(`  qdrant: {`);
    lines.push(`    url: process.env.QDRANT_URL || 'http://localhost:6333',`);
    lines.push(`    collection: 'openclaw_memories',`);
    lines.push(`  },`);
    lines.push(`  embedding: {`);
    lines.push(`    apiKey: process.env.OPENAI_API_KEY || '',`);
    lines.push(`    model: 'text-embedding-3-small',`);
    lines.push(`    dimensions: 1536,`);
    lines.push(`  },`);
    lines.push(`  extraction: {`);
    lines.push(`    apiKey: process.env.OPENAI_API_KEY || '',`);
    lines.push(`    model: 'gpt-4o-mini',`);
    lines.push(`    enabled: true,`);
    lines.push(`  },`);
  }
  if (tier === "full") {
    lines.push(`  age: {`);
    lines.push(`    host: process.env.PGHOST || 'localhost',`);
    lines.push(`    port: parseInt(process.env.PGPORT || '5432', 10),`);
    lines.push(`    user: process.env.PGUSER || 'openclaw',`);
    lines.push(`    password: process.env.PGPASSWORD || '',`);
    lines.push(`    database: process.env.PGDATABASE || 'agent_memory',`);
    lines.push(`    graph: 'agent_memory',`);
    lines.push(`  },`);
  }
  lines.push(`});`);
  lines.push(``);
  return lines.join("\n");
}
function generateEnvExample(tier) {
  const lines = [
    `# openclaw-memory environment variables`,
    ``,
    `# Server`,
    `# OPENCLAW_MEMORY_PORT=7777`,
    `# OPENCLAW_MEMORY_HOST=0.0.0.0`,
    ``,
    `# Authentication`,
    `MEMORY_AUTH_TOKEN=change-me-to-a-secure-token`,
    ``,
    `# SQLite (always required)`,
    `# SQLITE_PATH=~/.openclaw-memory/memory.sqlite`,
    ``
  ];
  if (tier === "standard" || tier === "full") {
    lines.push(`# Qdrant (Standard/Full tier)`);
    lines.push(`QDRANT_URL=http://localhost:6333`);
    lines.push(``);
    lines.push(`# Embedding provider`);
    lines.push(`OPENAI_API_KEY=sk-your-key-here`);
    lines.push(`# EMBEDDING_MODEL=text-embedding-3-small`);
    lines.push(`# EMBEDDING_BASE_URL=https://api.openai.com/v1`);
    lines.push(``);
    lines.push(`# Entity extraction`);
    lines.push(`# EXTRACTION_MODEL=gpt-4o-mini`);
    lines.push(``);
  }
  if (tier === "full") {
    lines.push(`# PostgreSQL + Apache AGE (Full tier)`);
    lines.push(`PGHOST=localhost`);
    lines.push(`PGPORT=5432`);
    lines.push(`PGUSER=openclaw`);
    lines.push(`PGPASSWORD=your-password`);
    lines.push(`PGDATABASE=agent_memory`);
    lines.push(`# AGE_GRAPH=agent_memory`);
    lines.push(``);
  }
  return lines.join("\n");
}

// src/cli/commands/start.ts
import { Command as Command2 } from "commander";
import fs3 from "fs";
import { spawn } from "child_process";
function startCommand() {
  return new Command2("start").description("Start the HTTP server").option("-p, --port <port>", "Server port").option("--bg", "Run in background (daemon mode)").option("--config <path>", "Path to config file").action(async (opts) => {
    if (opts.bg) {
      await startBackground(opts);
    } else {
      await startForeground(opts);
    }
  });
}
async function startForeground(opts) {
  if (opts.port) {
    process.env.OPENCLAW_MEMORY_PORT = opts.port;
    process.env.PORT = opts.port;
  }
  const { createServer } = await import("../server.js");
  const { app, config } = await createServer(opts.config);
  const port = opts.port ? parseInt(opts.port, 10) : config.port;
  app.listen(port);
  console.log(`[server] Listening on http://0.0.0.0:${port}`);
  const dataDir = getDataDir();
  fs3.mkdirSync(dataDir, { recursive: true });
  fs3.writeFileSync(getPidFilePath(), String(process.pid), "utf-8");
  const cleanup = () => {
    try {
      fs3.unlinkSync(getPidFilePath());
    } catch {
    }
    process.exit(0);
  };
  process.on("SIGINT", cleanup);
  process.on("SIGTERM", cleanup);
}
async function startBackground(opts) {
  header("Starting Server (background)");
  const dataDir = getDataDir();
  fs3.mkdirSync(dataDir, { recursive: true });
  const args = ["run", "src/server.ts"];
  const env = { ...process.env };
  if (opts.port) {
    env.OPENCLAW_MEMORY_PORT = opts.port;
    env.PORT = opts.port;
  }
  const runtime = typeof Bun !== "undefined" ? "bun" : "node";
  const execPath = runtime === "bun" ? "bun" : process.execPath;
  const execArgs = runtime === "bun" ? args : ["--import", "tsx", ...args];
  const child = spawn(execPath, execArgs, {
    env,
    detached: true,
    stdio: "ignore",
    cwd: process.cwd()
  });
  child.unref();
  if (child.pid) {
    fs3.writeFileSync(getPidFilePath(), String(child.pid), "utf-8");
    success(`Server started in background (PID: ${child.pid})`);
    info(`PID file: ${getPidFilePath()}`);
    info(`Stop with: openclaw-memory stop`);
  } else {
    error("Failed to start server");
    process.exit(1);
  }
}

// src/cli/commands/stop.ts
import { Command as Command3 } from "commander";
import fs4 from "fs";
function stopCommand() {
  return new Command3("stop").description("Stop the running server").action(async () => {
    header("Stopping Server");
    const pidPath = getPidFilePath();
    if (!fs4.existsSync(pidPath)) {
      warn("No PID file found \u2014 server may not be running");
      return;
    }
    const pidStr = fs4.readFileSync(pidPath, "utf-8").trim();
    const pid = parseInt(pidStr, 10);
    if (isNaN(pid)) {
      error(`Invalid PID in ${pidPath}: ${pidStr}`);
      return;
    }
    try {
      process.kill(pid, "SIGTERM");
      success(`Sent SIGTERM to PID ${pid}`);
      let alive = true;
      for (let i = 0; i < 30; i++) {
        await new Promise((r) => setTimeout(r, 100));
        try {
          process.kill(pid, 0);
        } catch {
          alive = false;
          break;
        }
      }
      if (alive) {
        warn("Process still running after 3s, sending SIGKILL...");
        try {
          process.kill(pid, "SIGKILL");
        } catch {
        }
      }
      success("Server stopped");
    } catch (err) {
      if (err.code === "ESRCH") {
        warn(`Process ${pid} not found \u2014 may have already stopped`);
      } else {
        error(`Failed to stop process ${pid}: ${err}`);
      }
    }
    try {
      fs4.unlinkSync(pidPath);
    } catch {
    }
  });
}

// src/cli/commands/status.ts
import { Command as Command4 } from "commander";
function statusCommand() {
  return new Command4("status").description("Show server and layer health status").option("-p, --port <port>", "Server port to check").option("--config <path>", "Path to config file").action(async (opts) => {
    header("Status");
    let config;
    try {
      config = await loadConfig(opts.config);
    } catch {
      config = null;
    }
    const port = opts.port ? parseInt(opts.port, 10) : config?.port || 7777;
    const baseUrl = getBaseUrl(port);
    const pid = getServerPid();
    const running = await isServerRunning(baseUrl);
    if (running && pid) {
      bullet("Server", `Running (PID ${pid}, port ${port})`, "ok");
    } else if (running) {
      bullet("Server", `Running (port ${port})`, "ok");
    } else if (pid) {
      bullet("Server", `PID file exists (${pid}) but not responding`, "error");
    } else {
      bullet("Server", "Not running", "disabled");
    }
    if (config) {
      bullet("Tier", config.tier, void 0);
    }
    console.log();
    if (running) {
      try {
        const health = await apiGet(baseUrl, "/api/health", config?.auth?.token);
        info("Layers:");
        const sqliteStatus = health.sqlite === "ok" ? "ok" : "error";
        bullet("L1 SQLite", String(health.sqlite), sqliteStatus);
        if (health.qdrant !== "disabled") {
          const qdrantStatus = health.qdrant === "ok" ? "ok" : "error";
          bullet("L2 Qdrant", String(health.qdrant), qdrantStatus);
        } else {
          bullet("L2 Qdrant", "disabled", "disabled");
        }
        if (health.age !== "disabled") {
          const ageStatus = health.age === "ok" ? "ok" : "error";
          bullet("L3 AGE", String(health.age), ageStatus);
        } else {
          bullet("L3 AGE", "disabled", "disabled");
        }
        if (health.uptime !== void 0) {
          const uptime = formatUptime(Number(health.uptime));
          console.log();
          info(`Uptime: ${uptime}`);
        }
      } catch (error2) {
        info("Could not fetch health status from server");
      }
    } else {
      if (config) {
        info("Server not running. Checking layers directly...");
        console.log();
        bullet("L1 SQLite", config.sqlite.path, "ok");
        if (config.qdrant) {
          try {
            const res = await fetch(`${config.qdrant.url}/collections`, {
              signal: AbortSignal.timeout(2e3)
            });
            bullet("L2 Qdrant", config.qdrant.url, res.ok ? "ok" : "error");
          } catch {
            bullet("L2 Qdrant", `${config.qdrant.url} (unreachable)`, "error");
          }
        } else {
          bullet("L2 Qdrant", "not configured", "disabled");
        }
        if (config.age) {
          try {
            const net = await import("net");
            const reachable = await new Promise((resolve) => {
              const socket = new net.Socket();
              socket.setTimeout(2e3);
              socket.connect(config.age.port, config.age.host, () => {
                socket.destroy();
                resolve(true);
              });
              socket.on("error", () => resolve(false));
              socket.on("timeout", () => {
                socket.destroy();
                resolve(false);
              });
            });
            bullet("L3 AGE", `${config.age.host}:${config.age.port}`, reachable ? "ok" : "error");
          } catch {
            bullet("L3 AGE", "unreachable", "error");
          }
        } else {
          bullet("L3 AGE", "not configured", "disabled");
        }
      }
    }
    console.log();
  });
}
function formatUptime(seconds) {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor(seconds % 3600 / 60);
  const s = seconds % 60;
  if (h > 0) return `${h}h ${m}m`;
  if (m > 0) return `${m}m ${s}s`;
  return `${s}s`;
}

// src/cli/commands/store.ts
import { Command as Command5 } from "commander";
function storeCommand() {
  return new Command5("store").description("Store a new memory").argument("[content]", "Memory content (or pipe via stdin)").requiredOption("--agent <id>", "Agent ID").requiredOption("--scope <scope>", "Memory scope (user, agent, global, project, session)").option("--subject <id>", "Subject ID").option("--tags <tags>", "Comma-separated tags").option("--source <source>", "Memory source", "explicit").option("--no-extract", "Skip entity extraction").option("--format <fmt>", "Output format (json, text)", "json").option("--config <path>", "Path to config file").action(async (contentArg, opts) => {
    const content = contentArg || await readStdin();
    if (!content) {
      console.error("Error: content is required (pass as argument or pipe via stdin)");
      process.exit(1);
    }
    const config = await loadConfig(opts.config);
    const baseUrl = getBaseUrl(config.port);
    const serverUp = await isServerRunning(baseUrl);
    const body = {
      agent_id: opts.agent,
      scope: opts.scope,
      subject_id: opts.subject || null,
      content,
      tags: opts.tags ? opts.tags.split(",").map((t) => t.trim()) : [],
      source: opts.source,
      extract_entities: opts.extract !== false
    };
    if (serverUp) {
      const result = await apiPost(baseUrl, "/api/memories", body, config.auth.token);
      output(result, opts.format);
    } else {
      const { MemoryService } = await import("../memory-service-GKEG6J2D.js");
      const service = new MemoryService();
      await service.init();
      try {
        const result = await service.store({
          agentId: opts.agent,
          scope: opts.scope,
          subjectId: opts.subject || null,
          content,
          tags: body.tags,
          source: opts.source,
          extractEntities: opts.extract !== false
        });
        output(result, opts.format);
      } finally {
        await service.close();
      }
    }
  });
}

// src/cli/commands/search.ts
import { Command as Command6 } from "commander";
function searchCommand() {
  const cmd = new Command6("search").description("Search memories");
  cmd.argument("<query>", "Search query").requiredOption("--agent <id>", "Agent ID").option("--limit <n>", "Max results", "10").option("--strategy <s>", "Search strategy (auto, semantic, fulltext, graph, all)", "auto").option("--scopes <scopes>", "Comma-separated scopes").option("--subject <id>", "Subject ID filter").option("--cross-agent", "Search across all agents").option("--no-graph", "Exclude graph results").option("--recall", "Format output for LLM context injection").option("--format <fmt>", "Output format (json, text)", "json").option("--config <path>", "Path to config file").action(async (query, opts) => {
    const config = await loadConfig(opts.config);
    const baseUrl = getBaseUrl(config.port);
    const serverUp = await isServerRunning(baseUrl);
    const body = {
      agent_id: opts.agent,
      query,
      limit: parseInt(opts.limit, 10),
      strategy: opts.strategy,
      scopes: opts.scopes ? opts.scopes.split(",") : void 0,
      subject_id: opts.subject || null,
      cross_agent: opts.crossAgent || false,
      include_graph: opts.graph !== false
    };
    let result;
    if (serverUp) {
      result = await apiPost(baseUrl, "/api/search", body, config.auth.token);
    } else {
      const { MemoryService } = await import("../memory-service-GKEG6J2D.js");
      const service = new MemoryService();
      await service.init();
      try {
        result = await service.search({
          agentId: opts.agent,
          query,
          limit: parseInt(opts.limit, 10),
          strategy: opts.strategy,
          scopes: opts.scopes ? opts.scopes.split(",") : void 0,
          subjectId: opts.subject || null,
          crossAgent: opts.crossAgent || false,
          includeGraph: opts.graph !== false
        });
      } finally {
        await service.close();
      }
    }
    if (opts.recall) {
      const data = result;
      if (data.results && data.results.length > 0) {
        console.log("## Relevant Memories");
        for (const r of data.results) {
          const date = new Date(r.memory.created_at).toLocaleDateString();
          console.log(`- ${r.memory.content} (${r.memory.scope}, ${date})`);
        }
      } else {
        console.log("No relevant memories found.");
      }
    } else {
      output(result, opts.format);
    }
  });
  return cmd;
}

// src/cli/commands/migrate.ts
import { Command as Command7 } from "commander";
function migrateCommand() {
  return new Command7("migrate").description("Import memories from markdown files").requiredOption("--paths <paths>", "Comma-separated file paths").requiredOption("--agent <id>", "Agent ID").option("--dry-run", "Preview without writing").option("--format <fmt>", "Output format (json, text)", "json").option("--config <path>", "Path to config file").action(async (opts) => {
    const config = await loadConfig(opts.config);
    const baseUrl = getBaseUrl(config.port);
    const serverUp = await isServerRunning(baseUrl);
    const paths = opts.paths.split(",").map((p) => p.trim());
    if (opts.dryRun) {
      header("Migration (dry run)");
    }
    const body = {
      markdown_paths: paths,
      agent_id: opts.agent,
      dry_run: opts.dryRun || false
    };
    let result;
    if (serverUp) {
      result = await apiPost(baseUrl, "/api/admin/migrate-markdown", body, config.auth.token);
    } else {
      const { MemoryService } = await import("../memory-service-GKEG6J2D.js");
      const service = new MemoryService();
      await service.init();
      try {
        const migrated = await service.migrateMarkdown(paths, opts.agent);
        result = migrated;
      } finally {
        await service.close();
      }
    }
    if (opts.format === "text") {
      const data = result;
      if (data.migrated !== void 0) {
        success(`Migrated ${data.migrated} memories`);
      }
      if (data.skipped) {
        info(`Skipped ${data.skipped} sections`);
      }
      if (data.errors && data.errors.length > 0) {
        for (const err of data.errors) {
          console.error(`  \u2717 ${err}`);
        }
      }
    } else {
      output(result, opts.format);
    }
  });
}

// src/cli/commands/infra.ts
import { Command as Command8 } from "commander";
import { execSync } from "child_process";
import fs5 from "fs";
import path2 from "path";
import { fileURLToPath } from "url";
var __filename = fileURLToPath(import.meta.url);
var __dirname = path2.dirname(__filename);
function infraCommand() {
  const infra = new Command8("infra").description("Manage Docker infrastructure");
  infra.command("up").description("Start Docker containers for the configured tier").option("--tier <tier>", "Override tier (standard, full)").action(async (opts) => {
    header("Infrastructure Up");
    let tier = opts.tier;
    if (!tier) {
      try {
        const config = await loadConfig();
        tier = config.tier;
      } catch {
        tier = "standard";
      }
    }
    if (tier === "lite") {
      info("Lite tier uses only SQLite \u2014 no Docker infrastructure needed.");
      return;
    }
    const templateFile = tier === "full" ? "full.yml" : "standard.yml";
    const templatePath = findTemplate(templateFile);
    if (!templatePath) {
      error(`Template not found: ${templateFile}`);
      error("Expected in ./docker/ or ./templates/ directory");
      process.exit(1);
    }
    const dataDir = getDataDir();
    fs5.mkdirSync(dataDir, { recursive: true });
    const targetPath = path2.join(dataDir, "docker-compose.yml");
    fs5.copyFileSync(templatePath, targetPath);
    info(`Using template: ${templatePath}`);
    try {
      execSync(`docker compose -f ${targetPath} up -d`, {
        stdio: "inherit",
        cwd: dataDir
      });
      success("Docker containers started");
    } catch (error2) {
      error("Failed to start Docker containers");
      error("Make sure Docker is installed and running");
      process.exit(1);
    }
  });
  infra.command("down").description("Stop Docker containers").action(async () => {
    header("Infrastructure Down");
    const dataDir = getDataDir();
    const composePath = path2.join(dataDir, "docker-compose.yml");
    if (!fs5.existsSync(composePath)) {
      warn("No docker-compose.yml found in data directory");
      return;
    }
    try {
      execSync(`docker compose -f ${composePath} down`, {
        stdio: "inherit",
        cwd: dataDir
      });
      success("Docker containers stopped");
    } catch (error2) {
      error("Failed to stop Docker containers");
      process.exit(1);
    }
  });
  infra.command("status").description("Show Docker container status").action(async () => {
    header("Infrastructure Status");
    const dataDir = getDataDir();
    const composePath = path2.join(dataDir, "docker-compose.yml");
    if (!fs5.existsSync(composePath)) {
      info("No docker-compose.yml found \u2014 infrastructure not set up");
      info("Run: openclaw-memory infra up");
      return;
    }
    try {
      execSync(`docker compose -f ${composePath} ps`, {
        stdio: "inherit",
        cwd: dataDir
      });
    } catch {
      error("Failed to get container status");
    }
  });
  return infra;
}
function findTemplate(filename) {
  const searchPaths = [
    path2.join(process.cwd(), "docker", filename),
    path2.join(process.cwd(), "templates", filename),
    // Look in the package's installed location
    path2.join(__dirname, "../../docker", filename),
    path2.join(__dirname, "../../templates", filename)
  ];
  for (const p of searchPaths) {
    if (fs5.existsSync(p)) return p;
  }
  return null;
}

// src/cli/index.ts
var program = new Command9();
program.name("openclaw-memory").description("Triple-layer memory system for AI agents \u2014 SQLite + Qdrant + Postgres/AGE").version("0.1.0");
program.addCommand(initCommand());
program.addCommand(startCommand());
program.addCommand(stopCommand());
program.addCommand(statusCommand());
program.addCommand(storeCommand());
program.addCommand(searchCommand());
program.addCommand(migrateCommand());
program.addCommand(infraCommand());
program.parse();
//# sourceMappingURL=index.js.map