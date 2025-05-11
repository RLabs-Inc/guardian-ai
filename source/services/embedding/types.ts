// source/services/embedding/types.ts

/**
 * Options for embedding generation
 */
export interface EmbeddingOptions {
	/** Optional batch size for processing multiple texts at once */
	batchSize?: number;

	/** Maximum number of tokens allowed in a batch */
	maxTokensPerBatch?: number;

	/** Memory limit for embedding generation */
	memoryLimit?: number;

	/** Optional cache settings */
	cache?: {
		/** Whether to use cache */
		enabled: boolean;
		/** Maximum cache items */
		maxItems?: number;
		/** Disk based? */
		diskBased?: boolean;
		/** Cache directory */
		cacheDir?: string;
	};
}

/**
 * Interface for embedding services
 */
export interface EmbeddingService {
	/**
	 * Generate an embedding for a single text
	 * @param text The text to generate an embedding for
	 * @returns The embedding vector
	 */
	generateEmbedding(text: string): Promise<number[]>;

	/**
	 * Generate embeddings for multiple texts
	 * @param texts Array of texts to generate embeddings for
	 * @returns Array of embedding vectors
	 */
	generateEmbeddings(texts: string[]): Promise<number[][]>;

	/**
	 * Get the embedding dimension size
	 * @returns The number of dimensions in the embedding vectors
	 */
	getDimensions(): number;
}
