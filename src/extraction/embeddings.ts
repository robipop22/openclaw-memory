import OpenAI from "openai";

// ── Embedding Service ───────────────────────────────────────────────────

export interface EmbeddingConfig {
  apiKey: string;
  baseUrl?: string;
  model: string;
  dimensions: number;
}

export class EmbeddingService {
  private client: OpenAI;
  private model: string;
  private dimensions: number;

  constructor(config: EmbeddingConfig) {
    this.client = new OpenAI({
      apiKey: config.apiKey,
      baseURL: config.baseUrl,
    });
    this.model = config.model;
    this.dimensions = config.dimensions;
  }

  async embed(text: string): Promise<number[] | null> {
    if (!text || text.trim().length === 0) return null;

    try {
      const response = await this.client.embeddings.create({
        model: this.model,
        input: text.slice(0, 8000),
      });

      const embedding = response.data[0]?.embedding;
      if (!embedding || embedding.length === 0) {
        console.warn("[embeddings] Empty embedding returned");
        return null;
      }

      return embedding;
    } catch (error) {
      console.error(`[embeddings] Failed to generate embedding: ${error}`);
      return null;
    }
  }

  async embedBatch(texts: string[]): Promise<(number[] | null)[]> {
    if (texts.length === 0) return [];

    try {
      const cleanTexts = texts.map((t) => (t || "").slice(0, 8000));
      const response = await this.client.embeddings.create({
        model: this.model,
        input: cleanTexts,
      });

      return response.data.map((item) =>
        item.embedding && item.embedding.length > 0 ? item.embedding : null
      );
    } catch (error) {
      console.error(`[embeddings] Batch embedding failed: ${error}`);
      return texts.map(() => null);
    }
  }

  getDimensions(): number {
    return this.dimensions;
  }
}
