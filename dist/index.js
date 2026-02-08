import {
  createApp,
  createServer
} from "./chunk-WAIDPAXE.js";
import {
  MemoryService
} from "./chunk-NHFPLDZK.js";
import "./chunk-JSQBXYDM.js";
import {
  configSummary,
  defineConfig,
  loadConfig
} from "./chunk-JNWCMHOB.js";

// src/core/types.ts
var TIER_CAPABILITIES = {
  lite: {
    sqlite: true,
    qdrant: false,
    age: false,
    embeddings: false,
    extraction: false
  },
  standard: {
    sqlite: true,
    qdrant: true,
    age: false,
    embeddings: true,
    extraction: true
  },
  full: {
    sqlite: true,
    qdrant: true,
    age: true,
    embeddings: true,
    extraction: true
  }
};
export {
  MemoryService,
  TIER_CAPABILITIES,
  configSummary,
  createApp,
  createServer,
  defineConfig,
  loadConfig
};
//# sourceMappingURL=index.js.map