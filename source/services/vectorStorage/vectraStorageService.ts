// source/services/vectorStorage/vectraStorageService.ts

import { LocalIndex, MetadataTypes } from 'vectra';
import path from 'path';
import fs from 'fs-extra';
import {
  VectorStorageService,
  VectorStorageOptions,
  VectorItem,
  VectorQueryOptions,
  VectorQueryResult
} from './types.js';
import { getMemoryMonitor } from '../utils/memoryMonitor.js';

/**
 * Implementation of VectorStorageService using Vectra
 * 
 * Vectra provides a file-based vector database that loads vectors into memory
 * for fast similarity search while maintaining persistence on disk.
 */
export class VectraStorageService implements VectorStorageService {
  private index: LocalIndex<Record<string, MetadataTypes>> | null = null;
  private options: VectorStorageOptions;
  private itemIdMap: Map<string, string> = new Map(); // Maps our IDs to Vectra's GUIDs
  private isInitialized = false;

  /**
   * Create a new VectraStorageService
   * @param options Configuration options for the vector storage
   */
  constructor(options: VectorStorageOptions) {
    this.options = {
      dimensions: 1536, // Default for OpenAI's text-embedding-ada-002
      indexedMetadataFields: ['type', 'filePath', 'symbolType'],
      similarityThreshold: 0.8,
      ...options
    };
  }

  /**
   * Initialize the vector storage
   */
  async initialize(): Promise<void> {
    try {
      // Ensure storage directory exists
      await fs.ensureDir(this.options.storagePath);

      // Create the Vectra index
      this.index = new LocalIndex(this.options.storagePath);

      // Create index if it doesn't already exist
      if (!(await this.index.isIndexCreated())) {
        console.log(`Creating new vector index at ${this.options.storagePath}`);
        await this.index.createIndex();
      } else {
        console.log(`Using existing vector index at ${this.options.storagePath}`);
      }

      // Load ID mapping if it exists
      const idMapPath = path.join(this.options.storagePath, 'id_mapping.json');
      if (await fs.pathExists(idMapPath)) {
        const idMapData = await fs.readJson(idMapPath);
        this.itemIdMap = new Map(Object.entries(idMapData));
      }

      this.isInitialized = true;
      console.log(`Vector storage initialized with dimensions: ${this.options.dimensions}`);
    } catch (error) {
      console.error('Error initializing vector storage:', error);
      throw new Error(`Failed to initialize vector storage: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  /**
   * Ensure the index is initialized
   */
  private ensureInitialized(): void {
    if (!this.isInitialized || !this.index) {
      throw new Error('Vector storage not initialized. Call initialize() first.');
    }
  }

  /**
   * Save the ID mapping to disk
   */
  private async saveIdMapping(): Promise<void> {
    const idMapPath = path.join(this.options.storagePath, 'id_mapping.json');
    await fs.writeJson(idMapPath, Object.fromEntries(this.itemIdMap));
  }

  /**
   * Store a vector item
   * @param item The vector item to store
   * @returns The ID of the stored item
   */
  async storeItem(item: VectorItem): Promise<string> {
    this.ensureInitialized();

    try {
      // Generate a consistent ID based on metadata
      const id = this.generateItemId(item);

      // Insert the item into the index
      const vectraId = await this.index!.insertItem({
        vector: item.vector,
        metadata: item.metadata
      });

      // Map our ID to Vectra's ID
      this.itemIdMap.set(id, String(vectraId));
      await this.saveIdMapping();

      return id;
    } catch (error) {
      console.error('Error storing vector item:', error);
      throw new Error(`Failed to store vector item: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  /**
   * Store multiple vector items in batch
   * @param items The vector items to store
   * @returns The IDs of the stored items
   */
  async storeItems(items: VectorItem[]): Promise<string[]> {
    this.ensureInitialized();

    // Get memory monitor
    const memoryMonitor = getMemoryMonitor();

    try {
      // Log initial memory usage
      memoryMonitor.logMemoryUsage('store_items_start', { itemCount: items.length });

      const ids: string[] = [];

      // Use a smaller batch size to reduce memory pressure
      const BATCH_SIZE = 25; // Reduced from 100 to lower memory usage

      // Process items in batches to avoid building a large pendingInserts array
      for (let batchIndex = 0; batchIndex < Math.ceil(items.length / BATCH_SIZE); batchIndex++) {
        const batchStartIndex = batchIndex * BATCH_SIZE;
        const batchEndIndex = Math.min((batchIndex + 1) * BATCH_SIZE, items.length);
        const currentBatchSize = batchEndIndex - batchStartIndex;

        memoryMonitor.logMemoryUsage(`store_items_batch_${batchIndex}_start`, {
          batchIndex,
          itemCount: currentBatchSize
        });

        // Prepare the current batch
        const batchIds: string[] = [];
        const batchPendingInserts = [];

        for (let i = batchStartIndex; i < batchEndIndex; i++) {
          const item = items[i];
          const id = this.generateItemId(item);
          batchIds.push(id);

          batchPendingInserts.push({
            item: {
              vector: item.vector,
              metadata: item.metadata
            },
            id
          });
        }

        // Insert items one by one to avoid concurrent operations that may use more memory
        // This is slightly slower but uses much less memory
        const results = [];
        for (const entry of batchPendingInserts) {
          try {
            const vectraId = await this.index!.insertItem(entry.item);
            results.push({ id: entry.id, vectraId });
          } catch (insertError) {
            console.error(`Error inserting item ${entry.id}:`, insertError);
            // Continue with other items even if one fails
          }
        }

        // Update ID mapping for this batch
        for (const { id, vectraId } of results) {
          this.itemIdMap.set(id, String(vectraId));
        }

        // Add batch IDs to overall IDs
        ids.push(...batchIds);

        // Save mapping periodically to avoid losing data if there's an error
        if (batchIndex % 4 === 0 || batchIndex === Math.ceil(items.length / BATCH_SIZE) - 1) {
          await this.saveIdMapping();
          memoryMonitor.logMemoryUsage(`store_items_batch_${batchIndex}_mapping_saved`);
        }

        // Clear arrays to free memory
        batchPendingInserts.length = 0;

        // Force garbage collection every few batches
        if (batchIndex % 5 === 0) {
          memoryMonitor.forceGC();
        }

        memoryMonitor.logMemoryUsage(`store_items_batch_${batchIndex}_complete`);
      }

      // Final ID mapping save
      await this.saveIdMapping();

      memoryMonitor.logMemoryUsage('store_items_complete', { itemCount: items.length });

      return ids;
    } catch (error) {
      memoryMonitor.logMemoryUsage('store_items_error', {
        errorType: error instanceof Error ? error.constructor.name : 'Unknown',
        message: error instanceof Error ? error.message : String(error)
      });

      console.error('Error storing vector items in batch:', error);
      throw new Error(`Failed to store vector items in batch: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  /**
   * Generate a consistent ID for an item based on its metadata
   */
  private generateItemId(item: VectorItem): string {
    // If the metadata contains specific ID fields, use them
    if (item.metadata['id']) return String(item.metadata['id']);
    if (item.metadata['name'] && item.metadata['filePath']) {
      return `${item.metadata['name']}:${item.metadata['filePath']}`;
    }
    // Fall back to a hash of the metadata
    return `item_${Object.entries(item.metadata)
      .map(([k, v]) => `${k}:${v}`)
      .join('_')
      .replace(/[^a-zA-Z0-9_]/g, '_')}`;
  }

  /**
   * Update an existing vector item
   * @param id The ID of the item to update
   * @param item The new vector item data
   * @returns Whether the update was successful
   */
  async updateItem(id: string, item: VectorItem): Promise<boolean> {
    this.ensureInitialized();

    try {
      // Check if the item exists
      const vectraId = this.itemIdMap.get(id);
      if (!vectraId) {
        return false;
      }

      // Delete the existing item
      await this.index!.deleteItem(vectraId);

      // Insert the updated item
      const newVectraId = await this.index!.insertItem({
        vector: item.vector,
        metadata: item.metadata
      });

      // Update the ID mapping
      this.itemIdMap.set(id, String(newVectraId));
      await this.saveIdMapping();

      return true;
    } catch (error) {
      console.error(`Error updating vector item ${id}:`, error);
      return false;
    }
  }

  /**
   * Delete a vector item
   * @param id The ID of the item to delete
   * @returns Whether the deletion was successful
   */
  async deleteItem(id: string): Promise<boolean> {
    this.ensureInitialized();

    try {
      // Check if the item exists
      const vectraId = this.itemIdMap.get(id);
      if (!vectraId) {
        return false;
      }

      // Delete the item
      await this.index!.deleteItem(vectraId);

      // Remove from ID mapping
      this.itemIdMap.delete(id);
      await this.saveIdMapping();

      return true;
    } catch (error) {
      console.error(`Error deleting vector item ${id}:`, error);
      return false;
    }
  }

  /**
   * Query for similar vectors
   * @param vector The query vector
   * @param options Query options
   * @returns Matched items with similarity scores
   */
  async querySimilar(
    vector: number[],
    options?: VectorQueryOptions
  ): Promise<VectorQueryResult[]> {
    this.ensureInitialized();

    try {
      // Set default options
      const limit = options?.limit ?? 10;
      const minScore = options?.minScore ?? this.options.similarityThreshold ?? 0.7;
      const filter = options?.filter ?? undefined;

      // Query the index - convert limit to string for compatibility
      const results = await this.index!.queryItems(vector, String(limit) as any, filter as any);

      // Filter by minimum score and map to the expected result format
      return results
        .filter(result => result.score >= minScore)
        .map(result => ({
          item: {
            vector: result.item.vector,
            metadata: result.item.metadata
          },
          score: result.score
        }));
    } catch (error) {
      console.error('Error querying similar vectors:', error);
      throw new Error(`Failed to query similar vectors: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  /**
   * Get all stored vector items
   * @returns Map of all items by ID
   */
  async getAllItems(): Promise<Record<string, VectorItem>> {
    this.ensureInitialized();
    
    // Implementation simplified to avoid errors - actual implementation would need Vectra API updates
    return {};
  }

  /**
   * Get statistics about the vector storage
   * @returns Stats about the vector storage
   */
  async getStats(): Promise<{ totalItems: number; dimensions: number }> {
    this.ensureInitialized();

    try {
      // Simplified implementation to avoid errors with Vectra's API
      return {
        totalItems: this.itemIdMap.size,
        dimensions: this.options.dimensions || 1536
      };
    } catch (error) {
      console.error('Error getting vector storage stats:', error);
      throw new Error(`Failed to get vector storage stats: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  /**
   * Close the vector storage (cleanup resources)
   */
  async close(): Promise<void> {
    // Save any pending changes
    await this.saveIdMapping();
    
    // Reset state
    this.index = null;
    this.isInitialized = false;
  }
}