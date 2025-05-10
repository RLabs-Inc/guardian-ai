// source/services/embedding/openAIEmbeddingService.ts

import { EmbeddingService, EmbeddingOptions } from './types.js';
import { LLMService } from '../llm/types.js';

/**
 * OpenAI-based implementation of the embedding service
 * Uses the LLMService to access OpenAI's embedding APIs
 */
export class OpenAIEmbeddingService implements EmbeddingService {
  private llmService: LLMService;
  private dimensions: number = 1536; // Default for OpenAI's text-embedding-ada-002
  private options: EmbeddingOptions;
  private cache: Map<string, number[]> = new Map();

  /**
   * Create a new OpenAIEmbeddingService
   * @param llmService The LLM service to use for API calls
   * @param options Configuration options
   */
  constructor(llmService: LLMService, options?: EmbeddingOptions) {
    this.llmService = llmService;
    this.options = {
      batchSize: 20,
      maxTokensPerBatch: 8000,
      cache: {
        enabled: true,
        maxItems: 1000,
      },
      ...options,
    };
  }

  /**
   * Generate an embedding for a single text
   * @param text The text to generate an embedding for
   * @returns The embedding vector
   */
  async generateEmbedding(text: string): Promise<number[]> {
    // Check cache if enabled
    if (this.options.cache?.enabled) {
      const cacheKey = this.getCacheKey(text);
      const cached = this.cache.get(cacheKey);
      if (cached) {
        return cached;
      }
    }

    // Generate embedding via LLM service
    try {
      const result = await this.llmService.generateEmbeddings(text);

      // Store in cache if enabled
      if (this.options.cache?.enabled) {
        this.addToCache(text, result);
      }

      return result;
    } catch (error) {
      console.error('Error generating embedding:', error);
      throw new Error(
        `Failed to generate embedding: ${
          error instanceof Error ? error.message : String(error)
        }`,
      );
    }
  }

  /**
   * Generate embeddings for multiple texts
   * @param texts Array of texts to generate embeddings for
   * @returns Array of embedding vectors
   */
  async generateEmbeddings(texts: string[]): Promise<number[][]> {
    if (texts.length === 0) {
      return [];
    }

    if (texts.length === 1 && texts[0]) {
      const embeddings = await this.generateEmbedding(texts[0]);
      return [embeddings];
    }

    // Process in batches to avoid rate limits and large requests
    const batchSize = this.options.batchSize || 20;
    const batches: string[][] = [];

    // Split into batches
    for (let i = 0; i < texts.length; i += batchSize) {
      batches.push(texts.slice(i, i + batchSize));
    }

    // Process each batch
    const results: number[][] = [];
    for (const batch of batches) {
      // Check cache for each text in batch
      const toBeFetched: string[] = [];
      const cachedResults: (number[] | null)[] = [];

      if (this.options.cache?.enabled) {
        for (const text of batch) {
          if (!text) continue;

          const cacheKey = this.getCacheKey(text);
          const cached = this.cache.get(cacheKey);

          if (cached) {
            cachedResults.push(cached);
          } else {
            cachedResults.push(null);
            toBeFetched.push(text);
          }
        }
      } else {
        // If cache is disabled, fetch all
        toBeFetched.push(...batch.filter(Boolean));
        cachedResults.push(...Array(batch.length).fill(null));
      }

      // Fetch embeddings for non-cached texts
      if (toBeFetched.length > 0) {
        try {
          // Process each text individually since our LLM service doesn't support batches
          const batchEmbeddings: number[][] = [];
          for (const text of toBeFetched) {
            if (!text) continue;
            const embedding = await this.llmService.generateEmbeddings(text);
            batchEmbeddings.push(embedding);

            // Store in cache if enabled
            if (this.options.cache?.enabled) {
              this.addToCache(text, embedding);
            }
          }

          // Merge cached and newly fetched results
          let fetchedIndex = 0;
          for (let i = 0; i < cachedResults.length; i++) {
            if (cachedResults[i] === null && fetchedIndex < batchEmbeddings.length) {
              cachedResults[i] = batchEmbeddings[fetchedIndex++] || null;
            }
          }

          // Add to final results
          results.push(...(cachedResults.filter(Boolean) as number[][]));
        } catch (error) {
          console.error('Error generating batch embeddings:', error);
          throw new Error(
            `Failed to generate batch embeddings: ${
              error instanceof Error ? error.message : String(error)
            }`,
          );
        }
      } else {
        // All were cached
        results.push(...(cachedResults.filter(Boolean) as number[][]));
      }
    }

    return results;
  }

  /**
   * Get the embedding dimension size
   * @returns The number of dimensions in the embedding vectors
   */
  getDimensions(): number {
    return this.dimensions;
  }

  /**
   * Generate a cache key for a text
   */
  private getCacheKey(text: string): string {
    // Simple hash function for cache keys
    let hash = 0;
    for (let i = 0; i < text.length; i++) {
      const char = text.charCodeAt(i);
      hash = (hash << 5) - hash + char;
      hash = hash & hash; // Convert to 32bit integer
    }
    return `text_${hash}`;
  }

  /**
   * Add an embedding to the cache
   */
  private addToCache(text: string, embedding: number[]): void {
    if (!text) return;

    const cacheKey = this.getCacheKey(text);
    this.cache.set(cacheKey, embedding);

    // Manage cache size
    if (
      this.options.cache?.maxItems &&
      this.cache.size > this.options.cache.maxItems
    ) {
      // Simple LRU: remove oldest entry
      const firstKey = this.cache.keys().next().value;
      if (firstKey) {
        this.cache.delete(firstKey);
      }
    }
  }
}