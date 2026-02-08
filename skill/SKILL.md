---
name: memory
version: 0.1.0
description: Persistent triple-layer memory — store, search, and connect knowledge across sessions
author: openclaw
license: MIT
tags: [memory, knowledge-graph, vector-search, persistence]
tier: core
---

# Memory Skill

Give your agent persistent memory that survives across sessions. Store facts, search by meaning, and traverse entity relationships.

## What This Skill Does

When installed, your agent gains the ability to:

- **Remember** facts, decisions, conversations, and context
- **Search** memories by keyword (FTS) or meaning (semantic vectors)
- **Connect** entities — people, projects, teams, decisions — in a knowledge graph
- **Recall** memories by time, tags, agent, or metadata filters
- **Forget** specific memories when asked

## How Agents Should Use It

### Storing Memories

Store important information as it comes up in conversation. Don't store everything — store what matters: decisions, facts about people, project context, preferences, and lessons learned.

**Good memories to store:**
- "The user prefers dark mode and Vim keybindings"
- "Decided to use PostgreSQL instead of MongoDB for the user service"
- "Alice Chen is the VP of Engineering, reports to CEO David Park"
- "The deploy pipeline takes ~12 minutes and requires 2 approvals"

**Don't store:**
- Routine greetings or small talk
- Information already in files the agent can read
- Temporary context that won't matter tomorrow

### Searching Memories

Before answering questions about people, projects, or past decisions, search memory first. This prevents the agent from asking the user to repeat themselves.

### Graph Traversal

When the user asks relationship questions ("who reports to Alice?", "what projects is the platform team working on?"), use graph queries instead of text search.

## Quick Start

The memory service is available at `http://localhost:7777`. Check health:

```bash
curl http://localhost:7777/api/health
```

## Storing Memories

```bash
curl -X POST http://localhost:7777/api/memories \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $MEMORY_TOKEN" \
  -d '{
    "agent_id": "YOUR_AGENT_ID",
    "scope": "user",
    "subject_id": "USER_ID",
    "content": "The fact or preference to remember",
    "tags": ["optional", "tags"]
  }'
```

### Scopes
- `user` — About a specific person (requires subject_id)
- `agent` — Agent's private knowledge
- `global` — Shared across all agents
- `project` — About a specific project (subject_id = project slug)
- `session` — Conversation summaries

## Searching Memories

```bash
curl -X POST http://localhost:7777/api/search \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $MEMORY_TOKEN" \
  -d '{
    "agent_id": "YOUR_AGENT_ID",
    "query": "natural language question",
    "limit": 5
  }'
```

The search auto-selects the best strategy:
- **Semantic** for broad/exploratory queries
- **Fulltext** for specific keyword lookups
- **Graph** for relationship queries

## When to Use

- **Store** when the user tells you something important about themselves
- **Store** decisions, preferences, project details
- **Search** at the start of each session for relevant context
- **Search** when the user asks "do you remember..."
- **Summarize** conversations at session end

## Example Conversations

### Building Memory Over Time

```
User: We just hired Sarah Kim as the new DevOps lead. She'll report to Alice.

Agent: Got it — I'll remember that.
       [stores: "Sarah Kim hired as DevOps lead, reports to Alice Chen"]
       [graph: Sarah Kim (Person, DevOps Lead) -[REPORTS_TO]-> Alice Chen]

User: (3 days later) Who's on Alice's team now?

Agent: [graph query: related entities for Alice Chen]
       Based on what I know, Alice Chen's direct reports include:
       • Bob Smith (Team Lead)
       • Sarah Kim (DevOps Lead, joined recently)
```

### Semantic Recall

```
User: What did we decide about the message queue situation?

Agent: [search: "message queue decision"]
       Found a relevant memory from January 15th:
       "Decided to switch from Kafka to NATS for the event bus.
        Reasons: simpler ops, lower latency for our workload."
```

## Environment

- `MEMORY_URL` — Service URL (default: http://localhost:7777)
- `MEMORY_TOKEN` — Auth token
