"use strict";Object.defineProperty(exports, "__esModule", {value: true});


var _chunkDWHY4TCNcjs = require('./chunk-DWHY4TCN.cjs');


var _chunkVXULEX3Acjs = require('./chunk-VXULEX3A.cjs');
require('./chunk-CRPEAZ44.cjs');




var _chunkZY2C2CJQcjs = require('./chunk-ZY2C2CJQ.cjs');

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








exports.MemoryService = _chunkVXULEX3Acjs.MemoryService; exports.TIER_CAPABILITIES = TIER_CAPABILITIES; exports.configSummary = _chunkZY2C2CJQcjs.configSummary; exports.createApp = _chunkDWHY4TCNcjs.createApp; exports.createServer = _chunkDWHY4TCNcjs.createServer; exports.defineConfig = _chunkZY2C2CJQcjs.defineConfig; exports.loadConfig = _chunkZY2C2CJQcjs.loadConfig;
//# sourceMappingURL=index.cjs.map