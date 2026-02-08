import { R as ResolvedConfig, C as Config, S as StoreParams, a as StoreResult, M as Memory, U as UpdateParams, L as ListParams, b as SearchParams, c as SearchResponse, d as ConversationLogEntry, e as SummarizeResponse, H as HealthResponse, T as Tier, f as StorageOrchestrator, g as CreateMemoryResponse, E as ExtractionResult, h as SyncQueueItem } from './server-BD88L598.js';
export { i as CreateMemoryRequest, j as EntityType, k as ExtractedEntity, l as ExtractedRelationship, m as ListMemoriesQuery, n as MemoryScope, o as MemorySource, p as MigrateMarkdownRequest, q as RelationshipType, r as ScoredMemory, s as SearchRequest, t as SummarizeRequest, u as SyncStatus, v as TIER_CAPABILITIES, w as TierCapabilities, x as UpdateMemoryRequest, y as createServer } from './server-BD88L598.js';
import { Elysia } from 'elysia';

declare function loadConfig(configPath?: string): Promise<ResolvedConfig>;
declare function defineConfig(config: Config): Config;
declare function configSummary(config: ResolvedConfig): string;

declare class MemoryService {
    private orchestrator;
    private searchEngine;
    private summarizer;
    private config;
    private initialized;
    private pendingConfig;
    constructor(config?: Config | string);
    init(): Promise<void>;
    close(): Promise<void>;
    store(params: StoreParams): Promise<StoreResult>;
    get(id: string): Promise<Memory | null>;
    update(id: string, params: UpdateParams): Promise<Memory | null>;
    delete(id: string): Promise<boolean>;
    list(params?: ListParams): Promise<Memory[]>;
    search(params: SearchParams): Promise<SearchResponse>;
    searchSemantic(params: SearchParams): Promise<SearchResponse>;
    searchFulltext(params: SearchParams): Promise<SearchResponse>;
    searchGraph(params: SearchParams): Promise<SearchResponse>;
    logConversation(entry: ConversationLogEntry): Promise<void>;
    summarizeConversation(params: {
        agentId: string;
        sessionId: string;
        userId: string;
        channel: string;
        messages: Array<{
            role: "user" | "assistant" | "system";
            content: string;
            timestamp: string;
        }>;
    }): Promise<SummarizeResponse | null>;
    getEntity(type: string, id: string): Promise<Record<string, unknown> | null>;
    listEntities(type?: string): Promise<Array<Record<string, unknown>>>;
    getRelatedEntities(entityId: string, depth?: number): Promise<Array<Record<string, unknown>>>;
    health(): Promise<HealthResponse>;
    retrySyncQueue(): Promise<{
        processed: number;
        succeeded: number;
        failed: number;
    }>;
    migrateMarkdown(paths: string[], agentId: string): Promise<{
        migrated: number;
        errors: string[];
    }>;
    get tier(): Tier;
    get resolvedConfig(): ResolvedConfig;
    getOrchestrator(): StorageOrchestrator;
    private ensureInit;
}

declare function createApp(orchestrator: StorageOrchestrator, config: ResolvedConfig): Elysia<"", {
    decorator: {};
    store: {};
    derive: {};
    resolve: {};
}, {
    typebox: {};
    error: {};
} & {
    typebox: {};
    error: {};
}, {
    schema: {};
    standaloneSchema: {};
    macro: {};
    macroFn: {};
    parser: {};
    response: {};
} & {
    schema: {};
    standaloneSchema: {};
    macro: {};
    macroFn: {};
    parser: {};
    response: {};
}, {
    api: {
        memories: {
            post: {
                body: {
                    subject_id?: string | null | undefined;
                    tags?: string[] | undefined;
                    source?: "explicit" | "derived" | "observation" | "conversation_summary" | "entity_extraction" | "daily_digest" | "migration" | undefined;
                    created_by?: string | null | undefined;
                    expires_at?: string | null | undefined;
                    extract_entities?: boolean | undefined;
                    agent_id: string;
                    scope: "user" | "agent" | "global" | "project" | "session";
                    content: string;
                };
                params: {};
                query: unknown;
                headers: unknown;
                response: {
                    200: CreateMemoryResponse | {
                        error: string;
                        details: string;
                    };
                    422: {
                        type: "validation";
                        on: string;
                        summary?: string;
                        message?: string;
                        found?: unknown;
                        property?: string;
                        expected?: string;
                    };
                };
            };
        };
    };
} & {
    api: {
        memories: {
            ":id": {
                get: {
                    body: unknown;
                    params: {
                        id: string;
                    } & {};
                    query: unknown;
                    headers: unknown;
                    response: {
                        200: Memory | {
                            error: string;
                        };
                        422: {
                            type: "validation";
                            on: string;
                            summary?: string;
                            message?: string;
                            found?: unknown;
                            property?: string;
                            expected?: string;
                        };
                    };
                };
            };
        };
    };
} & {
    api: {
        memories: {
            ":id": {
                put: {
                    body: {
                        scope?: "user" | "agent" | "global" | "project" | "session" | undefined;
                        subject_id?: string | null | undefined;
                        content?: string | undefined;
                        tags?: string[] | undefined;
                        expires_at?: string | null | undefined;
                        extract_entities?: boolean | undefined;
                    };
                    params: {
                        id: string;
                    } & {};
                    query: unknown;
                    headers: unknown;
                    response: {
                        200: CreateMemoryResponse | {
                            error: string;
                            details?: undefined;
                        } | {
                            error: string;
                            details: string;
                        };
                        422: {
                            type: "validation";
                            on: string;
                            summary?: string;
                            message?: string;
                            found?: unknown;
                            property?: string;
                            expected?: string;
                        };
                    };
                };
            };
        };
    };
} & {
    api: {
        memories: {
            ":id": {
                delete: {
                    body: unknown;
                    params: {
                        id: string;
                    } & {};
                    query: unknown;
                    headers: unknown;
                    response: {
                        200: {
                            error: string;
                            deleted?: undefined;
                            id?: undefined;
                            details?: undefined;
                        } | {
                            deleted: boolean;
                            id: string;
                            error?: undefined;
                            details?: undefined;
                        } | {
                            error: string;
                            details: string;
                            deleted?: undefined;
                            id?: undefined;
                        };
                        422: {
                            type: "validation";
                            on: string;
                            summary?: string;
                            message?: string;
                            found?: unknown;
                            property?: string;
                            expected?: string;
                        };
                    };
                };
            };
        };
    };
} & {
    api: {
        memories: {
            get: {
                body: unknown;
                params: {};
                query: unknown;
                headers: unknown;
                response: {
                    200: {
                        memories: Memory[];
                        count: number;
                    };
                };
            };
        };
    };
} & {
    api: {
        search: {
            post: {
                body: {
                    agent_id?: string | undefined;
                    subject_id?: string | null | undefined;
                    limit?: number | undefined;
                    scopes?: ("user" | "agent" | "global" | "project" | "session")[] | undefined;
                    include_graph?: boolean | undefined;
                    cross_agent?: boolean | undefined;
                    strategy?: "auto" | "semantic" | "fulltext" | "graph" | "all" | undefined;
                    query: string;
                };
                params: {};
                query: unknown;
                headers: unknown;
                response: {
                    200: SearchResponse | {
                        error: string;
                        details: string;
                    };
                    422: {
                        type: "validation";
                        on: string;
                        summary?: string;
                        message?: string;
                        found?: unknown;
                        property?: string;
                        expected?: string;
                    };
                };
            };
        };
    };
} & {
    api: {
        search: {
            semantic: {
                post: {
                    body: {
                        agent_id?: string | undefined;
                        subject_id?: string | null | undefined;
                        limit?: number | undefined;
                        scopes?: ("user" | "agent" | "global" | "project" | "session")[] | undefined;
                        cross_agent?: boolean | undefined;
                        query: string;
                    };
                    params: {};
                    query: unknown;
                    headers: unknown;
                    response: {
                        200: SearchResponse | {
                            error: string;
                            details: string;
                        };
                        422: {
                            type: "validation";
                            on: string;
                            summary?: string;
                            message?: string;
                            found?: unknown;
                            property?: string;
                            expected?: string;
                        };
                    };
                };
            };
        };
    };
} & {
    api: {
        search: {
            graph: {
                post: {
                    body: {
                        agent_id?: string | undefined;
                        subject_id?: string | null | undefined;
                        limit?: number | undefined;
                        scopes?: ("user" | "agent" | "global" | "project" | "session")[] | undefined;
                        query: string;
                    };
                    params: {};
                    query: unknown;
                    headers: unknown;
                    response: {
                        200: SearchResponse | {
                            error: string;
                            details: string;
                        };
                        422: {
                            type: "validation";
                            on: string;
                            summary?: string;
                            message?: string;
                            found?: unknown;
                            property?: string;
                            expected?: string;
                        };
                    };
                };
            };
        };
    };
} & {
    api: {
        search: {
            fulltext: {
                post: {
                    body: {
                        agent_id?: string | undefined;
                        subject_id?: string | null | undefined;
                        limit?: number | undefined;
                        scopes?: string[] | undefined;
                        query: string;
                    };
                    params: {};
                    query: unknown;
                    headers: unknown;
                    response: {
                        200: SearchResponse | {
                            error: string;
                            details: string;
                        };
                        422: {
                            type: "validation";
                            on: string;
                            summary?: string;
                            message?: string;
                            found?: unknown;
                            property?: string;
                            expected?: string;
                        };
                    };
                };
            };
        };
    };
} & {
    api: {
        conversations: {
            log: {
                post: {
                    body: {
                        agent_id: string;
                        content: string;
                        session_id: string;
                        user_id: string;
                        channel: string;
                        role: "user" | "assistant" | "system";
                        timestamp: string;
                    };
                    params: {};
                    query: unknown;
                    headers: unknown;
                    response: {
                        200: {
                            ok: boolean;
                            error?: undefined;
                            details?: undefined;
                        } | {
                            error: string;
                            details: string;
                            ok?: undefined;
                        };
                        422: {
                            type: "validation";
                            on: string;
                            summary?: string;
                            message?: string;
                            found?: unknown;
                            property?: string;
                            expected?: string;
                        };
                    };
                };
            };
        };
    };
} & {
    api: {
        conversations: {
            summarize: {
                post: {
                    body: {
                        reason?: string | undefined;
                        agent_id: string;
                        session_id: string;
                        user_id: string;
                        channel: string;
                        messages: {
                            content: string;
                            role: "user" | "assistant" | "system";
                            timestamp: string;
                        }[];
                    };
                    params: {};
                    query: unknown;
                    headers: unknown;
                    response: {
                        200: SummarizeResponse | {
                            error: string;
                            details?: undefined;
                        } | {
                            error: string;
                            details: string;
                        };
                        422: {
                            type: "validation";
                            on: string;
                            summary?: string;
                            message?: string;
                            found?: unknown;
                            property?: string;
                            expected?: string;
                        };
                    };
                };
            };
        };
    };
} & {
    api: {
        entities: {
            ":type": {
                get: {
                    body: unknown;
                    params: {
                        type: string;
                    } & {};
                    query: unknown;
                    headers: unknown;
                    response: {
                        200: {
                            error: string;
                            entities?: undefined;
                            count?: undefined;
                            details?: undefined;
                        } | {
                            entities: Record<string, unknown>[];
                            count: number;
                            error?: undefined;
                            details?: undefined;
                        } | {
                            error: string;
                            details: string;
                            entities?: undefined;
                            count?: undefined;
                        };
                        422: {
                            type: "validation";
                            on: string;
                            summary?: string;
                            message?: string;
                            found?: unknown;
                            property?: string;
                            expected?: string;
                        };
                    };
                };
            };
        };
    };
} & {
    api: {
        entities: {
            ":type": {
                ":id": {
                    get: {
                        body: unknown;
                        params: {
                            id: string;
                            type: string;
                        } & {};
                        query: unknown;
                        headers: unknown;
                        response: {
                            200: {
                                entity: Record<string, unknown> | null;
                                relationships: Array<{
                                    type: string;
                                    direction: string;
                                    target: Record<string, unknown>;
                                }>;
                            } | {
                                error: string;
                                details?: undefined;
                            } | {
                                error: string;
                                details: string;
                            };
                            422: {
                                type: "validation";
                                on: string;
                                summary?: string;
                                message?: string;
                                found?: unknown;
                                property?: string;
                                expected?: string;
                            };
                        };
                    };
                };
            };
        };
    };
} & {
    api: {
        entities: {
            ":type": {
                ":id": {
                    related: {
                        get: {
                            body: unknown;
                            params: {
                                id: string;
                                type: string;
                            } & {};
                            query: unknown;
                            headers: unknown;
                            response: {
                                200: {
                                    error: string;
                                    related?: undefined;
                                    count?: undefined;
                                    details?: undefined;
                                } | {
                                    related: {
                                        entity: Record<string, unknown>;
                                        relationship: string;
                                        distance: number;
                                    }[];
                                    count: number;
                                    error?: undefined;
                                    details?: undefined;
                                } | {
                                    error: string;
                                    details: string;
                                    related?: undefined;
                                    count?: undefined;
                                };
                                422: {
                                    type: "validation";
                                    on: string;
                                    summary?: string;
                                    message?: string;
                                    found?: unknown;
                                    property?: string;
                                    expected?: string;
                                };
                            };
                        };
                    };
                };
            };
        };
    };
} & {
    api: {
        entities: {
            extract: {
                post: {
                    body: {
                        text: string;
                    };
                    params: {};
                    query: unknown;
                    headers: unknown;
                    response: {
                        200: ExtractionResult | {
                            error: string;
                            details?: undefined;
                        } | {
                            error: string;
                            details: string;
                        };
                        422: {
                            type: "validation";
                            on: string;
                            summary?: string;
                            message?: string;
                            found?: unknown;
                            property?: string;
                            expected?: string;
                        };
                    };
                };
            };
        };
    };
} & {
    api: {
        health: {
            get: {
                body: unknown;
                params: {};
                query: unknown;
                headers: unknown;
                response: {
                    200: HealthResponse;
                };
            };
        };
    };
} & {
    api: {
        sync: {
            retry: {
                post: {
                    body: unknown;
                    params: {};
                    query: unknown;
                    headers: unknown;
                    response: {
                        200: {
                            processed: number;
                            succeeded: number;
                            failed: number;
                        } | {
                            error: string;
                            details: string;
                        };
                    };
                };
            };
        };
    };
} & {
    api: {
        sync: {
            queue: {
                get: {
                    body: unknown;
                    params: {};
                    query: unknown;
                    headers: unknown;
                    response: {
                        200: {
                            items: SyncQueueItem[];
                            count: number;
                        };
                    };
                };
            };
        };
    };
} & {
    api: {
        admin: {
            "migrate-markdown": {
                post: {
                    body: {
                        dry_run?: boolean | undefined;
                        agent_id: string;
                        markdown_paths: string[];
                    };
                    params: {};
                    query: unknown;
                    headers: unknown;
                    response: {
                        200: {
                            migrated: number;
                            skipped: number;
                            errors: string[];
                            memories: Array<{
                                id: string;
                                content_preview: string;
                            }>;
                        } | {
                            error: string;
                            details: string;
                        };
                        422: {
                            type: "validation";
                            on: string;
                            summary?: string;
                            message?: string;
                            found?: unknown;
                            property?: string;
                            expected?: string;
                        };
                    };
                };
            };
        };
    };
} & {
    api: {
        admin: {
            "daily-digest": {
                post: {
                    body: unknown;
                    params: {};
                    query: unknown;
                    headers: unknown;
                    response: {
                        200: {
                            error: string;
                        };
                    };
                };
            };
        };
    };
}, {
    derive: {};
    resolve: {};
    schema: {};
    standaloneSchema: {};
    response: {};
}, {
    derive: {};
    resolve: {};
    schema: {};
    standaloneSchema: {};
    response: {
        200: {
            error: string;
            code: string;
            details?: undefined;
        } | {
            error: string;
            code: string;
            details: unknown;
        } | {
            error: string;
            details: string;
            code?: undefined;
        } | {
            error: string;
            code?: undefined;
            details?: undefined;
        };
    };
} & {
    derive: {};
    resolve: {};
    schema: {};
    standaloneSchema: {};
    response: {};
}>;

export { Config, ConversationLogEntry, CreateMemoryResponse, ExtractionResult, HealthResponse, ListParams, Memory, MemoryService, ResolvedConfig, SearchParams, SearchResponse, StoreParams, StoreResult, SummarizeResponse, SyncQueueItem, Tier, UpdateParams, configSummary, createApp, defineConfig, loadConfig };
