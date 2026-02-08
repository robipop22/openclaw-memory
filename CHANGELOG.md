# Changelog

## 0.1.0 (2026-02-08)

### Initial Release

- Triple-layer memory system: SQLite + Qdrant + PostgreSQL/Apache AGE
- Three tier modes: Lite (SQLite only), Standard (+Qdrant), Full (+Qdrant+AGE)
- Graceful degradation — falls back silently when layers are unavailable
- HTTP API with bearer token auth
- Programmatic TypeScript API (`MemoryService` class)
- CLI (`openclaw-memory`) with commands: init, start, stop, status, store, search, migrate, infra
- Smart search with auto-strategy selection (fulltext, semantic, graph)
- Cross-layer result merging with recency and multi-layer scoring
- LLM-powered entity extraction (Person, Project, Decision, etc.)
- Conversation summarization
- Sync queue for failed L2/L3 writes with automatic retry
- Docker Compose templates for Standard and Full tiers
- Config file support (`openclaw-memory.config.ts`) with env var fallbacks
- OpenClaw skill definition (`skill/SKILL.md`)
- MIT license
