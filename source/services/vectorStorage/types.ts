// source/services/vectorStorage/types.ts

/**
 * Interface for vector storage configuration options
 */
export interface VectorStorageOptions {
  /** Directory path for storing vector data */
  storagePath: string;

  /** Dimensionality of the vectors */
  dimensions?: number;

  /** Fields to index in metadata for faster filtering */
  indexedMetadataFields?: string[];

  /** Maximum comparison distance to consider items similar (0-1) */
  similarityThreshold?: number;
}

/**
 * Interface for vector items to be stored
 */
export interface VectorItem {
  /** The vector representation (embedding) */
  vector: number[];

  /** Additional metadata about the item */
  metadata: Record<string, any>;
}

/**
 * Interface for query options
 */
export interface VectorQueryOptions {
  /** Maximum number of results to return */
  limit?: number;

  /** Minimum similarity score to include in results (0-1) */
  minScore?: number;

  /** Metadata filter query (MongoDB-like) */
  filter?: Record<string, any>;
}

/**
 * Interface for query results
 */
export interface VectorQueryResult {
  /** The matched item */
  item: VectorItem;

  /** Similarity score (0-1, higher is more similar) */
  score: number;
}

/**
 * Interface for a vector storage service
 */
export interface VectorStorageService {
  /**
   * Initialize the vector storage
   */
  initialize(): Promise<void>;

  /**
   * Store a vector item
   */
  storeItem(item: VectorItem): Promise<string>;

  /**
   * Store multiple vector items
   */
  storeItems(items: VectorItem[]): Promise<string[]>;

  /**
   * Update an existing vector item
   */
  updateItem(id: string, item: VectorItem): Promise<boolean>;

  /**
   * Delete a vector item
   */
  deleteItem(id: string): Promise<boolean>;

  /**
   * Query similar vectors
   */
  querySimilar(
    vector: number[],
    options?: VectorQueryOptions
  ): Promise<VectorQueryResult[]>;

  /**
   * Get all stored vectors
   */
  getAllItems(): Promise<Record<string, VectorItem>>;

  /**
   * Get statistics about the vector storage
   */
  getStats(): Promise<{
    totalItems: number;
    dimensions: number;
  }>;

  /**
   * Close the vector storage (cleanup resources)
   */
  close(): Promise<void>;
}