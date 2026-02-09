<div align="center">

# 🧠 openclaw-memory

**Triple-layer memory for AI agents.**
Local cache · Semantic search · Knowledge graph

[![npm version](https://img.shields.io/npm/v/@poprobertdaniel/openclaw-memory)](https://www.npmjs.com/package/@poprobertdaniel/openclaw-memory)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](https://opensource.org/licenses/MIT)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.x-blue)](https://www.typescriptlang.org/)
[![Bun](https://img.shields.io/badge/Bun-%E2%89%A51.0-black)](https://bun.sh/)

[Quick Start](#quick-start) · [Architecture](#architecture) · [API](#api-reference) · [Configuration](#configuration) · [Contributing](#contributing)

</div>

---

Give your AI agents a brain that survives between sessions.

openclaw-memory is a standalone memory service with three storage layers — **SQLite** for instant local lookups, **Qdrant** for semantic vector search, and **PostgreSQL + Apache AGE** for knowledge graph traversal. Store memories, search by meaning, and traverse entity relationships through one unified API.

Start with zero dependencies (SQLite only). Scale to vectors and graphs when ready.

```ts
import { MemoryService } from '@poprobertdaniel/openclaw-memory';

const memory = new MemoryService({ tier: 'lite' });
await memory.init();

// Store a memory
await memory.store({
  agentId: 'assistant',
  scope: 'user',
  content: 'Alice leads the payments team. She reports to VP Bob Chen.',
  tags: ['org', 'people'],
});

// Search
const results = await memory.search({
  agentId: 'assistant',
  query: 'who leads payments?',
});
```

## Architecture

```
┌─────────────────────────────────────────────────────────┐
│                   openclaw-memory                       │
│                                                         │
│  ┌─────────────┐  ┌──────────────┐  ┌───────────────┐  │
│  │  Memory API  │  │  Entity      │  │  Conversation │  │
│  │  store()     │  │  Extractor   │  │  Summarizer   │  │
│  │  search()    │  │              │  │               │  │
│  │  delete()    │  │  LLM-powered │  │  Session →    │  │
│  │  list()      │  │  extraction  │  │  memory       │  │
│  │              │  │  of people,  │  │               │  │
│  │              │  │  projects,   │  │               │  │
│  │              │  │  decisions   │  │               │  │
│  └──────┬───────┘  └──────┬───────┘  └──────┬────────┘  │
│         │                 │                 │            │
│  ───────┴─────────────────┴─────────────────┴────────── │
│                  Storage Orchestrator                    │
│     (triple-write, fan-out read, merge/rank)            │
│  ────────────────────────────────────────────────────── │
│         │                 │                 │            │
│  ┌──────┴───────┐  ┌──────┴──────┐  ┌──────┴────────┐  │
│  │   SQLite     │  │   Qdrant    │  │  PostgreSQL   │  │
│  │              │  │             │  │  + Apache AGE │  │
│  │  • FTS5      │  │  • Vectors  │  │               │  │
│  │  • Key-value │  │  • Semantic │  │  • Entities   │  │
│  │  • Metadata  │  │    search   │  │  • Relations  │  │
│  │  • Tags      │  │  • Cosine   │  │  • Cypher     │  │
│  │              │  │    sim      │  │    queries    │  │
│  └──────────────┘  └─────────────┘  └───────────────┘  │
│                                                         │
│       Lite ▲              Standard ▲         Full ▲     │
│     (zero deps)        (+ Qdrant)     (+ Postgres/AGE)  │
└─────────────────────────────────────────────────────────┘
```

## Quick Start

### 1. Install

```bash
bun add @poprobertdaniel/openclaw-memory
# or
npm install @poprobertdaniel/openclaw-memory
```

### 2. Initialize

```bash
# Interactive setup wizard
npx @poprobertdaniel/openclaw-memory init

# Or start immediately with defaults (Lite mode)
npx @poprobertdaniel/openclaw-memory start
```

### 3. Use the CLI

```bash
# Store a memory
openclaw-memory store "Decided to use Bun for the API gateway" \
  --agent my-agent --scope global --tags decisions,infrastructure

# Search memories
openclaw-memory search "API gateway decision" --agent my-agent

# Check status
openclaw-memory status
```

### 4. Or use the programmatic API

```ts
import { MemoryService } from '@poprobertdaniel/openclaw-memory';

const memory = new MemoryService({
  tier: 'lite',
  sqlite: { path: './agent-memory.db' },
});
await memory.init();

await memory.store({
  agentId: 'architect',
  scope: 'global',
  content: 'Performance benchmarks showed 3x improvement with Bun.',
  tags: ['decisions', 'infrastructure'],
});

const results = await memory.search({
  agentId: 'architect',
  query: 'deployment performance',
  limit: 5,
});

await memory.close();
```

## Features

### 🗂 Three-Tier Storage

Choose your complexity level:

| Tier | Layers | Dependencies | Best For |
|------|--------|-------------|----------|
| **Lite** | SQLite only | None | CLI tools, local agents, prototyping |
| **Standard** | SQLite + Qdrant | Qdrant | Production agents needing semantic recall |
| **Full** | SQLite + Qdrant + Postgres/AGE | Qdrant + PostgreSQL | Multi-agent systems, knowledge-heavy domains |

Upgrade tiers without changing your code — the API is identical.

### 🔍 Semantic Search

Find memories by meaning, not just keywords. Requires Standard tier or above.

```ts
await memory.store({
  agentId: 'a', scope: 'global',
  content: 'The board approved a $2M budget for cloud migration',
});
await memory.store({
  agentId: 'a', scope: 'global',
  content: 'We decided to move from AWS to GCP next quarter',
});

// Finds both — understands "infrastructure spending" relates to cloud migration
const results = await memory.search({
  agentId: 'a',
  query: 'cloud infrastructure spending',
});
```

### 🕸 Knowledge Graph

Auto-extract entities and relationships from stored memories. Requires Full tier.

```ts
await memory.store({
  agentId: 'a', scope: 'global',
  content: 'Alice Chen (VP Engineering) approved the Kubernetes migration. Bob Smith will execute it.',
});

// Entities extracted automatically:
// Alice Chen (Person, VP Engineering)
// Bob Smith (Person)
// Kubernetes Migration (Project)
//
// Relationships created:
// Alice Chen -[DECIDED]-> Kubernetes Migration
// Bob Smith -[WORKS_ON]-> Kubernetes Migration
```

### 🤖 Multi-Agent Scoping

Isolate or share memories between agents.

```ts
// Each agent has its own namespace
await memory.store({ agentId: 'research-agent', scope: 'agent', content: '...' });
await memory.store({ agentId: 'coding-agent', scope: 'agent', content: '...' });

// Search within scope
const mine = await memory.search({ agentId: 'coding-agent', query: 'deployment' });

// Or search across all agents
const all = await memory.search({ agentId: 'hub', query: 'deployment', crossAgent: true });
```

### ⚡ Graceful Degradation

If a layer goes down at runtime, operations gracefully fall back:

- Full tier, AGE goes down → writes to SQLite ✓ + Qdrant ✓ + AGE queued for retry
- Standard tier, Qdrant goes down → writes to SQLite ✓ + Qdrant queued for retry
- Failed writes are automatically retried via a sync queue

### 🏷 Tags & Filtering

```ts
await memory.store({
  agentId: 'a', scope: 'global',
  content: 'Switched from REST to gRPC for inter-service communication',
  tags: ['architecture', 'decisions', 'api-gateway'],
});

const decisions = await memory.list({
  agentId: 'a',
  tags: 'decisions',
});
```

## CLI Reference

```
openclaw-memory init                    # Interactive setup wizard
openclaw-memory start [--bg] [--port]   # Start HTTP server
openclaw-memory stop                    # Stop running server
openclaw-memory status                  # Health check all layers
openclaw-memory store <content>         # Store a memory
openclaw-memory search <query>          # Search memories
openclaw-memory search <query> --recall # Format for LLM context injection
openclaw-memory migrate --paths <files> # Import from markdown files
openclaw-memory infra up [--tier]       # Docker compose up
openclaw-memory infra down              # Docker compose down
openclaw-memory infra status            # Show container status
```

## HTTP API

When running as a server (`openclaw-memory start`), the following endpoints are available:

| Method | Path | Description |
|--------|------|-------------|
| `POST` | `/api/memories` | Store a new memory |
| `GET` | `/api/memories/:id` | Get a memory by ID |
| `PUT` | `/api/memories/:id` | Update a memory |
| `DELETE` | `/api/memories/:id` | Delete a memory |
| `GET` | `/api/memories` | List memories (with filters) |
| `POST` | `/api/search` | Smart search (auto-selects layers) |
| `POST` | `/api/search/semantic` | Force Qdrant semantic search |
| `POST` | `/api/search/graph` | Force AGE graph traversal |
| `POST` | `/api/search/fulltext` | Force SQLite FTS search |
| `POST` | `/api/conversations/log` | Append conversation entry |
| `POST` | `/api/conversations/summarize` | Summarize a session |
| `GET` | `/api/entities/:type` | List entities by type |
| `GET` | `/api/entities/:type/:id` | Get entity with relationships |
| `GET` | `/api/entities/:type/:id/related` | Related entities (graph traversal) |
| `POST` | `/api/entities/extract` | Manual entity extraction |
| `GET` | `/api/health` | Health check |
| `POST` | `/api/sync/retry` | Retry failed L2/L3 syncs |
| `GET` | `/api/sync/queue` | View pending sync queue |
| `POST` | `/api/admin/migrate-markdown` | Migrate from markdown files |

All endpoints accept/return JSON. Authentication via `Authorization: Bearer <token>` header.

## Configuration

### Config File

Create `openclaw-memory.config.ts` in your project root:

```ts
import { defineConfig } from '@poprobertdaniel/openclaw-memory';

export default defineConfig({
  tier: 'standard',
  port: 7777,
  auth: {
    token: process.env.MEMORY_AUTH_TOKEN,
  },
  sqlite: {
    path: '~/.openclaw-memory/memory.sqlite',
  },
  qdrant: {
    url: 'http://localhost:6333',
    collection: 'openclaw_memories',
  },
  embedding: {
    apiKey: process.env.OPENAI_API_KEY,
    model: 'text-embedding-3-small',
    dimensions: 1536,
  },
  extraction: {
    apiKey: process.env.OPENAI_API_KEY,
    model: 'gpt-4o-mini',
    enabled: true,
  },
});
```

### Environment Variables

```bash
# Tier
OPENCLAW_MEMORY_TIER=lite

# Server
OPENCLAW_MEMORY_PORT=7777

# Auth
MEMORY_AUTH_TOKEN=my-secret

# SQLite
SQLITE_PATH=~/.openclaw-memory/memory.sqlite

# Qdrant (Standard/Full)
QDRANT_URL=http://localhost:6333

# Embedding (any OpenAI-compatible API)
OPENAI_API_KEY=sk-...
EMBEDDING_MODEL=text-embedding-3-small

# PostgreSQL + AGE (Full)
PGHOST=localhost
PGPORT=5432
PGUSER=openclaw
PGPASSWORD=secret
PGDATABASE=agent_memory
```

### Docker Compose

For Standard and Full tiers, use the included Docker templates:

```bash
# Start infrastructure
openclaw-memory infra up --tier standard

# Or manually
docker compose -f node_modules/openclaw-memory/docker/standard.yml up -d
docker compose -f node_modules/openclaw-memory/docker/full.yml up -d
```

## Comparison

| Feature | openclaw-memory | Mem0 | Zep | LangChain Memory | Letta/MemGPT |
|---------|----------------|------|-----|------------------|--------------|
| Language | TypeScript/Bun | Python | Python/TS client | Python | Python |
| Local-first | ✅ SQLite | ❌ Cloud | ❌ Server | ✅ In-memory | ❌ Server |
| Vector search | ✅ Qdrant | ✅ Various | ✅ Built-in | ✅ Various | ✅ Built-in |
| Knowledge graph | ✅ Apache AGE | ❌ | ❌ | ❌ | Partial |
| Entity extraction | ✅ Auto | ❌ | ❌ | ❌ | Partial |
| Multi-agent | ✅ Scoped | ✅ Users | ✅ Sessions | ❌ | ✅ Agents |
| Tiered modes | ✅ Lite→Full | ❌ | ❌ | ❌ | ❌ |
| Self-hosted | ✅ Always | Paid plan | ✅ | N/A | ✅ |
| License | MIT | Apache 2.0 | Apache 2.0 | MIT | Apache 2.0 |

## Contributing

```bash
# Clone
git clone https://github.com/robipop22/openclaw-memory.git
cd openclaw-memory

# Install
bun install

# Run with hot reload
bun run dev

# Build
bun run build

# Type check
bun run typecheck
```

### Guidelines

- TypeScript strict mode — no `any` unless absolutely necessary
- Conventional commits — `feat:`, `fix:`, `docs:`, `chore:`
- PR reviews — all changes go through PR review

## License

MIT © [OpenClaw](https://github.com/openclaw)

---

<div align="center">

**Built for [OpenClaw](https://openclaw.dev) · Works with any agent framework**

</div>
