// source/services/embedding/chunkedEmbeddingService.ts

import {EmbeddingService, EmbeddingOptions} from './types.js';
import {LLMService} from '../llm/types.js';
import {getMemoryMonitor} from '../utils/memoryMonitor.js';
import * as fs from 'fs-extra';
import * as path from 'path';
import * as crypto from 'crypto';

/**
 * Memory-efficient implementation of the embedding service
 * Processes embeddings in small batches with memory monitoring and disk-based caching
 */
export class ChunkedEmbeddingService implements EmbeddingService {
	private llmService: LLMService;
	private dimensions: number = 1536; // Default for OpenAI's text-embedding-ada-002
	private options: EmbeddingOptions;
	private memoryMonitor = getMemoryMonitor();
	private cacheDir: string | null = null;

	/**
	 * Create a new ChunkedEmbeddingService
	 * @param llmService The LLM service to use for API calls
	 * @param options Configuration options
	 */
	constructor(llmService: LLMService, options?: EmbeddingOptions) {
		this.llmService = llmService;
		this.options = {
			batchSize: 10, // Smaller default batch size for memory efficiency
			maxTokensPerBatch: 4000, // Reduced tokens per batch
			cache: {
				enabled: true,
				maxItems: 500, // Reduced cache size
				diskBased: true, // Use disk-based caching to reduce memory usage
				cacheDir: '.guardian-ai/embeddings-cache',
			},
			memoryLimit: 500, // Memory limit in MB before forced GC
			...options,
		};

		// Initialize disk cache if enabled
		if (this.options.cache?.enabled && this.options.cache.diskBased) {
			this.initializeDiskCache();
		}
	}

	/**
	 * Initialize disk-based cache
	 */
	private async initializeDiskCache(): Promise<void> {
		try {
			if (!this.options.cache?.cacheDir) {
				console.warn('No cache directory specified for disk-based cache');
				return;
			}

			this.cacheDir = this.options.cache.cacheDir;
			await fs.ensureDir(this.cacheDir);
			console.log(`Disk-based embedding cache initialized at ${this.cacheDir}`);
		} catch (error) {
			console.error('Failed to initialize disk-based cache:', error);
			this.cacheDir = null;
		}
	}

	/**
	 * Generate an embedding for a single text
	 * @param text The text to generate an embedding for
	 * @returns The embedding vector
	 */
	async generateEmbedding(text: string): Promise<number[]> {
		this.memoryMonitor.logMemoryUsage('embedding_single_start', {
			textLength: text.length,
		});

		try {
			// Check cache first if enabled
			if (this.options.cache?.enabled) {
				const cachedEmbedding = await this.getFromCache(text);
				if (cachedEmbedding) {
					this.memoryMonitor.logMemoryUsage('embedding_single_cached_hit');
					return cachedEmbedding;
				}
			}

			// Generate embedding via LLM service
			const embedding = await this.llmService.generateEmbeddings(text);

			// Store in cache if enabled
			if (this.options.cache?.enabled) {
				await this.addToCache(text, embedding);
			}

			this.memoryMonitor.logMemoryUsage('embedding_single_complete');

			// Check if we should run garbage collection
			this.checkMemoryAndGC();

			return embedding;
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
	 * Generate embeddings for multiple texts in an extremely memory-efficient way
	 * @param texts Array of texts to generate embeddings for
	 * @returns Array of embedding vectors
	 */
	async generateEmbeddings(texts: string[]): Promise<number[][]> {
		if (texts.length === 0) {
			return [];
		}

		this.memoryMonitor.logMemoryUsage('embedding_batch_start', {
			totalTexts: texts.length,
			avgTextLength: Math.round(
				texts.reduce((sum, text) => sum + (text?.length || 0), 0) /
					texts.length,
			),
		});

		try {
			// Process in very small batches to control memory usage
			const batchSize = Math.min(this.options.batchSize || 10, 20); // Cap at 20 even if configured higher
			const results: number[][] = new Array(texts.length);
			let processedCount = 0;

			// Process each batch
			for (let i = 0; i < texts.length; i += batchSize) {
				const batchStart = i;
				const batchEnd = Math.min(i + batchSize, texts.length);
				const batchTexts = texts.slice(batchStart, batchEnd);

				this.memoryMonitor.logMemoryUsage(
					`embedding_batch_${Math.floor(i / batchSize)}_start`,
					{
						batchSize: batchTexts.length,
					},
				);

				// For each text in the batch, first check cache
				const batchRequests: {index: number; text: string}[] = [];

				if (this.options.cache?.enabled) {
					for (let j = 0; j < batchTexts.length; j++) {
						const text = batchTexts[j];
						if (!text) continue;

						const cacheResult = await this.getFromCache(text);
						if (cacheResult) {
							// Cache hit - store directly in results array
							results[batchStart + j] = cacheResult;
						} else {
							// Cache miss - add to batch requests
							batchRequests.push({index: batchStart + j, text});
						}
					}
				} else {
					// No cache - all texts need processing
					for (let j = 0; j < batchTexts.length; j++) {
						if (batchTexts[j]) {
							batchRequests.push({index: batchStart + j, text: batchTexts[j]!});
						}
					}
				}

				// Process texts that weren't in cache
				if (batchRequests.length > 0) {
					// Process each non-cached text individually to avoid memory issues
					for (const request of batchRequests) {
						if (!request.text) continue;

						try {
							const embedding = await this.llmService.generateEmbeddings(
								request.text,
							);

							// Store result
							results[request.index] = embedding;

							// Add to cache
							if (this.options.cache?.enabled) {
								await this.addToCache(request.text, embedding);
							}

							// Track progress
							processedCount++;

							// Periodically log progress
							if (
								processedCount % 10 === 0 ||
								processedCount === texts.length
							) {
								const progress = Math.round(
									(processedCount / texts.length) * 100,
								);
								console.log(
									`Embedding progress: ${progress}% (${processedCount}/${texts.length})`,
								);
								this.memoryMonitor.logMemoryUsage(
									`embedding_progress_${progress}`,
								);
							}

							// Check if we need to run garbage collection
							this.checkMemoryAndGC();

							// Clear text from memory after processing
							request.text = '';
						} catch (embedError) {
							console.error(
								`Error generating embedding for batch item:`,
								embedError,
							);
							// Use an empty array as placeholder for failed embedding
							results[request.index] = [];
						}
					}
				}

				this.memoryMonitor.logMemoryUsage(
					`embedding_batch_${Math.floor(i / batchSize)}_complete`,
				);

				// Force garbage collection between batches
				this.memoryMonitor.forceGC();

				// Small delay to allow other operations
				await new Promise(resolve => setTimeout(resolve, 10));
			}

			// Final cleanup
			this.memoryMonitor.logMemoryUsage('embedding_batch_complete', {
				totalProcessed: processedCount,
			});

			// Force final garbage collection
			this.memoryMonitor.forceGC();

			// Filter out any undefined or null results as a safety measure
			return results.filter(Boolean);
		} catch (error) {
			console.error('Error in batch embedding generation:', error);
			throw new Error(
				`Failed to generate batch embeddings: ${
					error instanceof Error ? error.message : String(error)
				}`,
			);
		}
	}

	/**
	 * Get the embedding dimension size
	 * @returns The number of dimensions in the embedding vectors
	 */
	getDimensions(): number {
		return this.dimensions;
	}

	/**
	 * Get a cached embedding
	 * @param text The text to lookup in cache
	 * @returns The cached embedding vector or null if not found
	 */
	private async getFromCache(text: string): Promise<number[] | null> {
		try {
			// If using disk-based cache
			if (this.options.cache?.diskBased && this.cacheDir) {
				const cacheKey = this.getCacheKey(text);
				const cachePath = path.join(this.cacheDir, `${cacheKey}.json`);

				if (await fs.pathExists(cachePath)) {
					const cached = await fs.readJson(cachePath);
					return cached.vector;
				}
				return null;
			}

			// No memory cache in this implementation to save memory
			return null;
		} catch (error) {
			console.warn('Cache read error:', error);
			return null;
		}
	}

	/**
	 * Add an embedding to the cache
	 * @param text The text being embedded
	 * @param embedding The embedding vector
	 */
	private async addToCache(text: string, embedding: number[]): Promise<void> {
		try {
			// Skip caching if text is empty
			if (!text) return;

			// If using disk-based cache
			if (this.options.cache?.diskBased && this.cacheDir) {
				const cacheKey = this.getCacheKey(text);
				const cachePath = path.join(this.cacheDir, `${cacheKey}.json`);

				// Store the embedding with metadata
				await fs.writeJson(cachePath, {
					vector: embedding,
					createdAt: new Date().toISOString(),
				});

				// Check cache size periodically
				await this.manageDiskCacheSize();
			}
		} catch (error) {
			console.warn('Cache write error:', error);
		}
	}

	/**
	 * Generate a cache key for a text
	 * @param text The text to generate a cache key for
	 * @returns A cache key string
	 */
	private getCacheKey(text: string): string {
		// Use SHA-256 for more reliable and distributed hashing
		return crypto.createHash('sha256').update(text).digest('hex');
	}

	/**
	 * Manage disk cache size
	 */
	private async manageDiskCacheSize(): Promise<void> {
		try {
			if (!this.cacheDir || !this.options.cache?.maxItems) return;

			// Only check periodically (1 in 20 operations) to reduce disk I/O
			if (Math.random() > 0.05) return;

			// Get all cache files
			const files = await fs.readdir(this.cacheDir);
			const jsonFiles = files.filter(f => f.endsWith('.json'));

			// If we're under the limit, no action needed
			if (jsonFiles.length <= this.options.cache.maxItems) return;

			// We need to remove some files - get stats for each file
			const fileStats = await Promise.all(
				jsonFiles.map(async filename => {
					const filePath = path.join(this.cacheDir!, filename);
					const stats = await fs.stat(filePath);
					return {filename, path: filePath, mtime: stats.mtime};
				}),
			);

			// Sort by last modified time (oldest first)
			fileStats.sort((a, b) => a.mtime.getTime() - b.mtime.getTime());

			// Remove the oldest files to get under the limit
			const filesToRemove = fileStats.slice(
				0,
				fileStats.length - this.options.cache.maxItems,
			);

			for (const file of filesToRemove) {
				await fs.remove(file.path);
			}

			console.log(`Cleaned ${filesToRemove.length} old embedding cache files`);
		} catch (error) {
			console.error('Error managing disk cache size:', error);
		}
	}

	/**
	 * Check memory usage and run garbage collection if needed
	 */
	private checkMemoryAndGC(): void {
		if (!this.options.memoryLimit) return;

		const snapshot = this.memoryMonitor.takeSnapshot('memory_check');
		const memoryUsageMB = Math.round(snapshot.usage.heapUsed / 1024 / 1024);

		if (memoryUsageMB > this.options.memoryLimit) {
			console.log(
				`Memory usage (${memoryUsageMB}MB) exceeded limit (${this.options.memoryLimit}MB). Running garbage collection.`,
			);
			this.memoryMonitor.forceGC();
		}
	}
}
