import { defineConfig } from 'openclaw-memory';

export default defineConfig({
  // Tier: 'lite' (SQLite only), 'standard' (+Qdrant), 'full' (+Qdrant+AGE)
  tier: 'lite',

  // HTTP server
  port: 7777,
  host: '0.0.0.0',

  // Authentication
  auth: {
    token: process.env.MEMORY_AUTH_TOKEN || 'change-me',
    enabled: true,
  },

  // SQLite — always required (all tiers)
  sqlite: {
    path: '~/.openclaw-memory/memory.sqlite',
  },

  // ── Uncomment for Standard tier ─────────────────────────────────────

  // qdrant: {
  //   url: 'http://localhost:6333',
  //   collection: 'openclaw_memories',
  // },
  // embedding: {
  //   apiKey: process.env.OPENAI_API_KEY || '',
  //   model: 'text-embedding-3-small',
  //   dimensions: 1536,
  // },
  // extraction: {
  //   apiKey: process.env.OPENAI_API_KEY || '',
  //   model: 'gpt-4o-mini',
  //   enabled: true,
  // },

  // ── Uncomment for Full tier ─────────────────────────────────────────

  // age: {
  //   host: 'localhost',
  //   port: 5432,
  //   user: 'openclaw',
  //   password: process.env.PGPASSWORD || '',
  //   database: 'agent_memory',
  //   graph: 'agent_memory',
  // },
});
