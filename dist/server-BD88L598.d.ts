import * as elysia from 'elysia';

type MemoryScope = "user" | "agent" | "global" | "project" | "session";
type MemorySource = "explicit" | "derived" | "observation" | "conversation_summary" | "entity_extraction" | "daily_digest" | "migration";
type EntityType = "Person" | "Project" | "Organization" | "Decision" | "Preference" | "Event" | "Tool" | "Location" | "Concept";
type RelationshipType = "WORKS_ON" | "DECIDED" | "PREFERS" | "KNOWS" | "USES" | "LOCATED_AT" | "BELONGS_TO" | "MENTIONED_IN" | "RELATED_TO" | "CREATED_BY" | "DEPENDS_ON";
type Tier = "lite" | "standard" | "full";
interface ExtractedEntity {
    name: string;
    type: EntityType;
    properties: Record<string, string>;
}
interface ExtractedRelationship {
    from_entity: string;
    to_entity: string;
    relationship: RelationshipType;
    properties: Record<string, string>;
}
interface ExtractionResult {
    entities: ExtractedEntity[];
    relationships: ExtractedRelationship[];
}
interface Memory {
    id: string;
    agent_id: string;
    scope: MemoryScope;
    subject_id: string | null;
    content: string;
    tags: string[];
    entities: ExtractedEntity[];
    source: MemorySource;
    created_by: string | null;
    created_at: string;
    updated_at: string;
    expires_at: string | null;
    embedding_hash: string | null;
}
interface CreateMemoryRequest {
    agent_id: string;
    scope: MemoryScope;
    subject_id?: string | null;
    content: string;
    tags?: string[];
    source?: MemorySource;
    created_by?: string | null;
    extract_entities?: boolean;
    expires_at?: string | null;
}
interface UpdateMemoryRequest {
    content?: string;
    tags?: string[];
    scope?: MemoryScope;
    subject_id?: string | null;
    expires_at?: string | null;
    extract_entities?: boolean;
}
interface SearchRequest {
    agent_id?: string;
    query: string;
    scopes?: MemoryScope[];
    subject_id?: string | null;
    limit?: number;
    include_graph?: boolean;
    cross_agent?: boolean;
    strategy?: "auto" | "semantic" | "fulltext" | "graph" | "all";
}
interface ScoredMemory {
    memory: Memory;
    score: number;
    source_layer: "sqlite" | "qdrant" | "age";
    graph_context?: {
        related_entities: Array<{
            type: EntityType;
            name: string;
            relationship: string;
        }>;
    };
}
interface SearchResponse {
    results: ScoredMemory[];
    strategy_used: string;
    layer_stats: {
        sqlite: {
            count: number;
            ms: number;
        };
        qdrant: {
            count: number;
            ms: number;
        };
        age: {
            count: number;
            ms: number;
        };
    };
}
interface SyncStatus {
    sqlite: "ok";
    qdrant: "ok" | "queued" | "failed" | "disabled";
    age: "ok" | "queued" | "failed" | "disabled";
}
interface CreateMemoryResponse {
    id: string;
    agent_id: string;
    scope: MemoryScope;
    content: string;
    tags?: string[];
    entities: ExtractedEntity[];
    created_at: string;
    updated_at?: string;
    sync_status: SyncStatus;
}
interface ConversationLogEntry {
    agent_id: string;
    session_id: string;
    user_id: string;
    channel: string;
    role: string;
    content: string;
    timestamp: string;
}
interface SummarizeRequest {
    agent_id: string;
    session_id: string;
    user_id: string;
    channel: string;
    messages: Array<{
        role: "user" | "assistant" | "system";
        content: string;
        timestamp: string;
    }>;
    reason?: string;
}
interface SummarizeResponse {
    memory_id: string;
    summary: string;
    entities_extracted: ExtractedEntity[];
    relationships_created: number;
}
interface HealthResponse {
    sqlite: "ok" | "error" | "disabled";
    qdrant: "ok" | "error" | "disabled";
    age: "ok" | "error" | "disabled";
    tier: Tier;
    uptime: number;
    details?: Record<string, string>;
}
interface SyncQueueItem {
    id: number;
    memory_id: string;
    layer: "qdrant" | "age";
    operation: "upsert" | "delete";
    attempts: number;
    last_error: string | null;
    created_at: string;
}
interface ListMemoriesQuery {
    agent_id?: string;
    scope?: MemoryScope;
    subject_id?: string;
    source?: MemorySource;
    tags?: string;
    limit?: number;
    offset?: number;
    order?: "asc" | "desc";
}
interface MigrateMarkdownRequest {
    markdown_paths: string[];
    agent_id: string;
    dry_run?: boolean;
}
interface StoreParams {
    agentId: string;
    scope: MemoryScope;
    subjectId?: string | null;
    content: string;
    tags?: string[];
    source?: MemorySource;
    createdBy?: string | null;
    extractEntities?: boolean;
    expiresAt?: string | null;
}
interface StoreResult {
    id: string;
    agentId: string;
    scope: MemoryScope;
    content: string;
    entities: ExtractedEntity[];
    createdAt: string;
    syncStatus: {
        sqlite: "ok";
        qdrant: "ok" | "queued" | "failed" | "disabled";
        age: "ok" | "queued" | "failed" | "disabled";
    };
}
interface SearchParams {
    agentId: string;
    query: string;
    scopes?: MemoryScope[];
    subjectId?: string | null;
    limit?: number;
    includeGraph?: boolean;
    crossAgent?: boolean;
    strategy?: "auto" | "semantic" | "fulltext" | "graph" | "all";
}
interface UpdateParams {
    content?: string;
    tags?: string[];
    scope?: MemoryScope;
    subjectId?: string | null;
    expiresAt?: string | null;
    extractEntities?: boolean;
}
interface ListParams {
    agentId?: string;
    scope?: MemoryScope;
    subjectId?: string;
    source?: MemorySource;
    tags?: string;
    limit?: number;
    offset?: number;
    order?: "asc" | "desc";
}
interface TierCapabilities {
    sqlite: true;
    qdrant: boolean;
    age: boolean;
    embeddings: boolean;
    extraction: boolean;
}
declare const TIER_CAPABILITIES: Record<Tier, TierCapabilities>;

interface SqliteConfig {
    path: string;
}
interface QdrantConfig {
    url: string;
    collection: string;
    apiKey?: string;
}
interface AgeConfig {
    host: string;
    port: number;
    user: string;
    password: string;
    database: string;
    graph: string;
}
interface EmbeddingConfig$1 {
    apiKey: string;
    baseUrl?: string;
    model: string;
    dimensions: number;
}
interface ExtractionConfig$1 {
    apiKey: string;
    baseUrl?: string;
    model: string;
    enabled: boolean;
}
interface AuthConfig {
    token?: string;
    enabled: boolean;
}
interface AgentConfig {
    id: string;
    name: string;
    role?: string;
    crossAgentRead?: boolean;
}
interface Config {
    tier?: Tier;
    port?: number;
    host?: string;
    auth?: Partial<AuthConfig>;
    sqlite?: Partial<SqliteConfig>;
    qdrant?: Partial<QdrantConfig> & {
        url: string;
    };
    age?: Partial<AgeConfig> & {
        host: string;
        user: string;
        password: string;
        database: string;
    };
    embedding?: Partial<EmbeddingConfig$1> & {
        apiKey: string;
    };
    extraction?: Partial<ExtractionConfig$1> & {
        apiKey: string;
    };
    agents?: AgentConfig[];
}
interface ResolvedConfig {
    tier: Tier;
    port: number;
    host: string;
    auth: AuthConfig;
    sqlite: SqliteConfig;
    qdrant: QdrantConfig | null;
    age: AgeConfig | null;
    embedding: EmbeddingConfig$1 | null;
    extraction: ExtractionConfig$1 | null;
    agents: AgentConfig[];
}

declare class SqliteStorage {
    private db;
    constructor(dbPath: string);
    private initSchema;
    createMemory(memory: Memory): Memory;
    getMemory(id: string): Memory | null;
    updateMemory(id: string, updates: Partial<Memory>): Memory | null;
    deleteMemory(id: string): boolean;
    listMemories(query: ListMemoriesQuery): Memory[];
    searchFullText(query: string, agentId?: string, scopes?: MemoryScope[], subjectId?: string | null, limit?: number): Array<Memory & {
        fts_rank: number;
    }>;
    appendConversationLog(entry: ConversationLogEntry): void;
    getConversationLog(agentId: string, sessionId: string, limit?: number): ConversationLogEntry[];
    addToSyncQueue(memoryId: string, layer: "qdrant" | "age", operation: "upsert" | "delete"): void;
    getSyncQueue(limit?: number): SyncQueueItem[];
    updateSyncQueueItem(id: number, attempts: number, lastError: string | null): void;
    removeSyncQueueItem(id: number): void;
    clearCompletedSyncItems(): number;
    getMemoryCount(): number;
    getDatabaseSize(): number;
    healthCheck(): boolean;
    private rowToMemory;
    close(): void;
}

interface QdrantStorageConfig {
    url: string;
    collection: string;
    apiKey?: string;
}
declare class QdrantStorage {
    private client;
    private collection;
    private config;
    private ready;
    constructor(config: QdrantStorageConfig);
    private getClient;
    ensureCollection(vectorSize?: number): Promise<void>;
    upsertMemory(memory: Memory, vector: number[]): Promise<void>;
    deleteMemory(id: string): Promise<void>;
    search(queryVector: number[], agentId?: string, scopes?: MemoryScope[], subjectId?: string | null, limit?: number, crossAgent?: boolean): Promise<ScoredMemory[]>;
    healthCheck(): Promise<boolean>;
    getCollectionInfo(): Promise<{
        vectorCount: number;
    } | null>;
    private buildFilter;
    private payloadToMemory;
}

interface AgeStorageConfig {
    host: string;
    port: number;
    user: string;
    password: string;
    database: string;
    graph: string;
}
declare class AgeStorage {
    private pool;
    private config;
    private graph;
    private initialized;
    constructor(config: AgeStorageConfig);
    private getPool;
    ensureGraph(): Promise<void>;
    private cypherQuery;
    private cypherExec;
    upsertMemoryNode(memory: Memory): Promise<void>;
    upsertEntityNode(entity: ExtractedEntity, agentId: string): Promise<string>;
    createRelationship(rel: ExtractedRelationship, agentId: string): Promise<void>;
    linkMemoryToEntity(memoryId: string, entityId: string): Promise<void>;
    deleteMemoryNode(memoryId: string): Promise<void>;
    getEntityWithRelationships(entityType: string, entityId: string): Promise<{
        entity: Record<string, unknown> | null;
        relationships: Array<{
            type: string;
            direction: string;
            target: Record<string, unknown>;
        }>;
    }>;
    getRelatedEntities(entityId: string, depth?: number): Promise<Array<{
        entity: Record<string, unknown>;
        relationship: string;
        distance: number;
    }>>;
    searchByEntity(entityName: string, entityType?: string, agentId?: string, limit?: number): Promise<ScoredMemory[]>;
    private searchByEntityNameFuzzy;
    listEntities(entityType?: string, agentId?: string, limit?: number): Promise<Array<Record<string, unknown>>>;
    ensureAgentNode(agentId: string, name: string, role: string): Promise<void>;
    getStats(): Promise<{
        entityCount: number;
        relationshipCount: number;
    } | null>;
    healthCheck(): Promise<boolean>;
    close(): Promise<void>;
    private parseAgtype;
    private propsToMemory;
    private graphResultToScoredMemory;
    private guessEntityType;
}

interface EmbeddingConfig {
    apiKey: string;
    baseUrl?: string;
    model: string;
    dimensions: number;
}
declare class EmbeddingService {
    private client;
    private model;
    private dimensions;
    constructor(config: EmbeddingConfig);
    embed(text: string): Promise<number[] | null>;
    embedBatch(texts: string[]): Promise<(number[] | null)[]>;
    getDimensions(): number;
}

interface ExtractionConfig {
    apiKey: string;
    baseUrl?: string;
    model: string;
    enabled: boolean;
}
declare class EntityExtractor {
    private client;
    private model;
    constructor(config: ExtractionConfig);
    extract(text: string): Promise<ExtractionResult>;
    private validateExtractionResult;
}

declare class StorageOrchestrator {
    readonly tier: Tier;
    readonly sqlite: SqliteStorage;
    readonly qdrant: QdrantStorage | null;
    readonly age: AgeStorage | null;
    readonly embeddings: EmbeddingService | null;
    readonly entityExtractor: EntityExtractor | null;
    private syncProcessor;
    private startTime;
    constructor(config: ResolvedConfig);
    init(): Promise<void>;
    createMemory(req: CreateMemoryRequest): Promise<CreateMemoryResponse>;
    updateMemory(id: string, req: UpdateMemoryRequest): Promise<CreateMemoryResponse | null>;
    deleteMemory(id: string): Promise<boolean>;
    healthCheck(): Promise<HealthResponse>;
    retrySyncQueue(): Promise<{
        processed: number;
        succeeded: number;
        failed: number;
    }>;
    close(): Promise<void>;
    private asyncL2Upsert;
    private asyncL3Upsert;
}

declare function createServer(configPath?: string): Promise<{
    app: elysia.default<"", {
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
    orchestrator: StorageOrchestrator;
    config: ResolvedConfig;
}>;

export { type Config as C, type ExtractionResult as E, type HealthResponse as H, type ListParams as L, type Memory as M, type ResolvedConfig as R, type StoreParams as S, type Tier as T, type UpdateParams as U, type StoreResult as a, type SearchParams as b, type SearchResponse as c, type ConversationLogEntry as d, type SummarizeResponse as e, StorageOrchestrator as f, type CreateMemoryResponse as g, type SyncQueueItem as h, type CreateMemoryRequest as i, type EntityType as j, type ExtractedEntity as k, type ExtractedRelationship as l, type ListMemoriesQuery as m, type MemoryScope as n, type MemorySource as o, type MigrateMarkdownRequest as p, type RelationshipType as q, type ScoredMemory as r, type SearchRequest as s, type SummarizeRequest as t, type SyncStatus as u, TIER_CAPABILITIES as v, type TierCapabilities as w, type UpdateMemoryRequest as x, createServer as y };
