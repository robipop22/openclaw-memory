<<<<<<< conflict 1 of 1
+++++++ zzzzzzzz 00000000 (rebase destination)
%%%%%%% diff from: xkkukkxx 0d503f04 "feat: openclaw-memory v0.1.0 — triple-layer memory system for AI agents" (parents of rebased revision)
\\\\\\\        to: xztpzyto a507a3e3 (rebased revision)
 import { Elysia, t } from "elysia";
 import { SearchEngine } from "../search/engine.js";
 import type { StorageOrchestrator } from "../storage/orchestrator.js";
 import type { SearchRequest } from "../core/types.js";
 
 // ── Search Routes ───────────────────────────────────────────────────────
 
+const scopeEnum = t.Union([
+  t.Literal("user"),
+  t.Literal("agent"),
+  t.Literal("global"),
+  t.Literal("project"),
+  t.Literal("session"),
+]);
+
 export function searchRoutes(orchestrator: StorageOrchestrator) {
   const searchEngine = new SearchEngine(orchestrator);
 
   return new Elysia({ prefix: "/api/search" })
     // POST /api/search — Smart search (auto-selects layers)
     .post(
       "/",
       async ({ body, set }) => {
         try {
-          return await searchEngine.search(body as SearchRequest);
+          const req = body as SearchRequest;
+          if (!req.agent_id) req.cross_agent = true;
+          return await searchEngine.search(req);
         } catch (error) {
           set.status = 500;
           return {
             error: "Search failed",
             details: error instanceof Error ? error.message : String(error),
           };
         }
       },
       {
         body: t.Object({
-          agent_id: t.String(),
+          agent_id: t.Optional(t.String()),
           query: t.String(),
-          scopes: t.Optional(
-            t.Array(
-              t.Union([
-                t.Literal("user"),
-                t.Literal("agent"),
-                t.Literal("global"),
-                t.Literal("project"),
-                t.Literal("session"),
-              ])
-            )
-          ),
+          scopes: t.Optional(t.Array(scopeEnum)),
           subject_id: t.Optional(t.Nullable(t.String())),
           limit: t.Optional(t.Number()),
           include_graph: t.Optional(t.Boolean()),
           cross_agent: t.Optional(t.Boolean()),
           strategy: t.Optional(
             t.Union([
               t.Literal("auto"),
               t.Literal("semantic"),
               t.Literal("fulltext"),
               t.Literal("graph"),
               t.Literal("all"),
             ])
           ),
         }),
       }
     )
 
     // POST /api/search/semantic — Force Qdrant semantic search
     .post(
       "/semantic",
       async ({ body, set }) => {
         try {
-          return await searchEngine.search({
-            ...(body as SearchRequest),
-            strategy: "semantic",
-          });
+          const req = { ...(body as SearchRequest), strategy: "semantic" as const };
+          if (!req.agent_id) req.cross_agent = true;
+          return await searchEngine.search(req);
         } catch (error) {
           set.status = 500;
           return {
             error: "Semantic search failed",
             details: error instanceof Error ? error.message : String(error),
           };
         }
       },
       {
         body: t.Object({
-          agent_id: t.String(),
+          agent_id: t.Optional(t.String()),
           query: t.String(),
-          scopes: t.Optional(
-            t.Array(
-              t.Union([
-                t.Literal("user"),
-                t.Literal("agent"),
-                t.Literal("global"),
-                t.Literal("project"),
-                t.Literal("session"),
-              ])
-            )
-          ),
+          scopes: t.Optional(t.Array(scopeEnum)),
           subject_id: t.Optional(t.Nullable(t.String())),
           limit: t.Optional(t.Number()),
           cross_agent: t.Optional(t.Boolean()),
         }),
       }
     )
 
     // POST /api/search/graph — Force AGE graph traversal
     .post(
       "/graph",
       async ({ body, set }) => {
         try {
-          return await searchEngine.search({
+          const req = {
             ...(body as SearchRequest),
-            strategy: "graph",
+            strategy: "graph" as const,
             include_graph: true,
-          });
+          };
+          if (!req.agent_id) req.cross_agent = true;
+          return await searchEngine.search(req);
         } catch (error) {
           set.status = 500;
           return {
             error: "Graph search failed",
             details: error instanceof Error ? error.message : String(error),
           };
         }
       },
       {
         body: t.Object({
-          agent_id: t.String(),
+          agent_id: t.Optional(t.String()),
           query: t.String(),
-          scopes: t.Optional(
-            t.Array(
-              t.Union([
-                t.Literal("user"),
-                t.Literal("agent"),
-                t.Literal("global"),
-                t.Literal("project"),
-                t.Literal("session"),
-              ])
-            )
-          ),
+          scopes: t.Optional(t.Array(scopeEnum)),
           subject_id: t.Optional(t.Nullable(t.String())),
           limit: t.Optional(t.Number()),
         }),
       }
     )
 
     // POST /api/search/fulltext — Force SQLite FTS search
     .post(
       "/fulltext",
       async ({ body, set }) => {
         try {
-          return await searchEngine.search({
+          const req = {
             ...(body as SearchRequest),
-            strategy: "fulltext",
+            strategy: "fulltext" as const,
             include_graph: false,
-          });
+          };
+          if (!req.agent_id) req.cross_agent = true;
+          return await searchEngine.search(req);
         } catch (error) {
           set.status = 500;
           return {
             error: "Fulltext search failed",
             details: error instanceof Error ? error.message : String(error),
           };
         }
       },
       {
         body: t.Object({
-          agent_id: t.String(),
+          agent_id: t.Optional(t.String()),
           query: t.String(),
           scopes: t.Optional(t.Array(t.String())),
           subject_id: t.Optional(t.Nullable(t.String())),
           limit: t.Optional(t.Number()),
         }),
       }
     );
 }
>>>>>>> conflict 1 of 1 ends
