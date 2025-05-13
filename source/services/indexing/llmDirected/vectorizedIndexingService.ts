// source/services/indexing/llmDirected/vectorizedIndexingService.ts

import * as path from 'path';
import * as fs from 'fs-extra';
import {
	IndexingService,
	IndexedCodebase,
	CodeSymbol,
	IndexingOptions,
	CodeDependency,
} from '../types.js';
import {FileSystemService} from '../../fileSystem/types.js';
import {LLMService} from '../../llm/types.js';
import {EmbeddingService} from '../../embedding/types.js';
import {VectorStorageService} from '../../vectorStorage/types.js';
import {LLMDirectedIndexingService} from './llmDirectedIndexingService.js';
import {getMemoryMonitor} from '../../utils/memoryMonitor.js';

/**
 * Enhanced LLM-directed indexing service with vector storage for efficient retrieval
 */
export class VectorizedIndexingService implements IndexingService {
	private baseIndexingService: LLMDirectedIndexingService;
	private embeddingService: EmbeddingService;
	private vectorStorage: VectorStorageService;
	// Removed unused property

	constructor(
		fileSystem: FileSystemService,
		llmService: LLMService,
		embeddingService: EmbeddingService,
		vectorStorage: VectorStorageService,
	) {
		this.baseIndexingService = new LLMDirectedIndexingService(
			fileSystem,
			llmService,
		);
		this.embeddingService = embeddingService;
		this.vectorStorage = vectorStorage;
	}

	/**
	 * Index a codebase with vector embeddings
	 */
	async indexCodebase(
		projectPath: string,
		options?: IndexingOptions,
	): Promise<IndexedCodebase> {
		// Get memory monitor
		const memoryMonitor = getMemoryMonitor();

		try {
			// Initialize memory monitoring
			memoryMonitor.logMemoryUsage('indexing_start', { projectPath });
			console.log(`Starting vectorized indexing of ${projectPath}`);

			// Ensure the vector storage is initialized
			const vectorStoragePath = path.join(
				projectPath,
				'.guardian-ai',
				'vector-storage',
			);
			await fs.ensureDir(vectorStoragePath);
			await this.vectorStorage.initialize();

			memoryMonitor.logMemoryUsage('vector_storage_initialized');

			// First, perform the base indexing
			console.log('Performing base indexing...');
			const indexedCodebase = await this.baseIndexingService.indexCodebase(
				projectPath,
				options,
			);

			memoryMonitor.logMemoryUsage('base_indexing_complete', {
				symbolCount: Object.keys(indexedCodebase.symbols).length,
				relationshipCount: indexedCodebase.dependencies.length
			});

			// Force garbage collection after the memory-intensive base indexing
			memoryMonitor.forceGC();

			// Generate and store embeddings for all symbols
			console.log('Generating vector embeddings for symbols...');
			await this.generateAndStoreSymbolEmbeddings(indexedCodebase);

			// Force garbage collection between major operations
			memoryMonitor.forceGC();
			memoryMonitor.logMemoryUsage('symbol_embeddings_completed');

			// Generate and store embeddings for relationships
			console.log('Generating vector embeddings for relationships...');
			await this.generateAndStoreRelationshipEmbeddings(indexedCodebase);

			// Final garbage collection
			memoryMonitor.forceGC();
			memoryMonitor.logMemoryUsage('indexing_complete');

			console.log('Vectorized indexing complete.');

			// Clean up some memory before returning the result
			// but keep essential data like symbol names and locations
			Object.values(indexedCodebase.symbols).forEach(symbol => {
				if (symbol.content && symbol.content.length > 1000) {
					symbol.content = ''; // Clear large content strings
				}
			});

			return indexedCodebase;
		} catch (error) {
			memoryMonitor.logMemoryUsage('indexing_error', {
				errorType: error instanceof Error ? error.constructor.name : 'Unknown',
				message: error instanceof Error ? error.message : String(error)
			});

			console.error('Error in vectorized indexing:', error);
			throw new Error(
				`Failed to index codebase with vector embeddings: ${
					error instanceof Error ? error.message : String(error)
				}`,
			);
		}
	}

	/**
	 * Update the index for specific files
	 */
	async updateIndex(files: string[]): Promise<void> {
		try {
			// Update the base index
			await this.baseIndexingService.updateIndex(files);

			// Get the updated index
			const indexedCodebase = await this.baseIndexingService.getIndex();

			// Extract symbols and relationships for the updated files
			const symbolsToUpdate: CodeSymbol[] = [];
			const relationshipsToUpdate: CodeDependency[] = [];

			// Find symbols for updated files
			for (const symbolId in indexedCodebase.symbols) {
				const symbol = indexedCodebase.symbols[symbolId];
				if (files.includes(symbol!.location.filePath)) {
					symbolsToUpdate.push(symbol!);
				}
			}

			// Find relationships for updated files
			for (const relationship of indexedCodebase.dependencies) {
				const sourceSymbol = indexedCodebase.symbols[relationship.source];
				const targetSymbol = indexedCodebase.symbols[relationship.target];

				if (
					(sourceSymbol && files.includes(sourceSymbol.location.filePath)) ||
					(targetSymbol && files.includes(targetSymbol.location.filePath))
				) {
					relationshipsToUpdate.push(relationship);
				}
			}

			// Update symbol embeddings
			for (const symbol of symbolsToUpdate) {
				await this.updateSymbolEmbedding(symbol);
			}

			// Update relationship embeddings
			for (const relationship of relationshipsToUpdate) {
				await this.updateRelationshipEmbedding(
					relationship,
					indexedCodebase.symbols[relationship.source],
					indexedCodebase.symbols[relationship.target],
				);
			}
		} catch (error) {
			console.error('Error updating vectorized index:', error);
			throw new Error(
				`Failed to update vectorized index: ${
					error instanceof Error ? error.message : String(error)
				}`,
			);
		}
	}

	/**
	 * Find symbols matching a query
	 */
	async findSymbols(query: string): Promise<CodeSymbol[]> {
		try {
			// Generate an embedding for the query
			const queryEmbedding = await this.embeddingService.generateEmbedding(
				query,
			);

			// Search for similar symbols in vector storage
			const results = await this.vectorStorage.querySimilar(queryEmbedding, {
				limit: 20,
				minScore: 0.7,
				filter: {
					type: 'symbol',
				},
			});

			// Get the base index
			const indexedCodebase = await this.baseIndexingService.getIndex();

			// Collect matching symbols
			const symbols: CodeSymbol[] = [];
			for (const result of results) {
				const symbolId = result.item.metadata['symbolId'];
				if (symbolId && indexedCodebase.symbols[symbolId]) {
					symbols.push(indexedCodebase.symbols[symbolId]);
				}
			}

			// If we didn't find any symbols through vector search, fall back to the base implementation
			if (symbols.length === 0) {
				return this.baseIndexingService.findSymbols(query);
			}

			return symbols;
		} catch (error) {
			console.error('Error finding symbols by vector similarity:', error);
			// Fall back to the base implementation
			return this.baseIndexingService.findSymbols(query);
		}
	}

	/**
	 * Find relationships relevant to a query
	 * @param query The search query
	 * @returns Relationships ordered by relevance
	 */
	async findRelationships(query: string): Promise<CodeDependency[]> {
		try {
			// Generate an embedding for the query
			const queryEmbedding = await this.embeddingService.generateEmbedding(
				query,
			);

			// Search for similar relationships in vector storage
			const results = await this.vectorStorage.querySimilar(queryEmbedding, {
				limit: 20,
				minScore: 0.7,
				filter: {
					type: 'relationship',
				},
			});

			// Get the base index
			const indexedCodebase = await this.baseIndexingService.getIndex();

			// Find all relationships that match the results
			const relationships: CodeDependency[] = [];
			for (const result of results) {
				const sourceId = result.item.metadata['source'];
				const targetId = result.item.metadata['target'];
				const relType = result.item.metadata['relType'];

				// Find the actual relationship in the indexed codebase
				const matchingRelationship = indexedCodebase.dependencies.find(
					rel =>
						rel.source === sourceId &&
						rel.target === targetId &&
						rel.type === relType,
				);

				if (matchingRelationship) {
					relationships.push(matchingRelationship);
				}
			}

			return relationships;
		} catch (error) {
			console.error('Error finding relationships by vector similarity:', error);
			// Return an empty array as fallback
			return [];
		}
	}

	/**
	 * Get the current index
	 */
	async getIndex(): Promise<IndexedCodebase> {
		return this.baseIndexingService.getIndex();
	}

	/**
	 * Save the current index to persistent storage
	 */
	async saveIndex(): Promise<void> {
		return this.baseIndexingService.saveIndex();
	}

	/**
	 * Load an index from persistent storage
	 */
	async loadIndex(path: string): Promise<IndexedCodebase> {
		const indexedCodebase = await this.baseIndexingService.loadIndex(path);
		// No need to store path

		// Initialize vector storage
		// Need to use separate import for path to avoid confusion with parameter
		const fsPath = require('path');
		const vectorStoragePath = fsPath.join(String(path), '.guardian-ai', 'vector-storage');
		await fs.ensureDir(vectorStoragePath);
		await this.vectorStorage.initialize();

		return indexedCodebase;
	}

	/**
	 * Generate and store embeddings for all symbols
	 */
	private async generateAndStoreSymbolEmbeddings(
		indexedCodebase: IndexedCodebase,
	): Promise<void> {
		// Get memory monitor
		const memoryMonitor = getMemoryMonitor();
		memoryMonitor.logMemoryUsage('symbol_embeddings_start', {
			symbolCount: Object.keys(indexedCodebase.symbols).length
		});

		const symbols = Object.values(indexedCodebase.symbols);
		const batchSize = 25; // Reduced batch size from 50 to 25 for better memory efficiency

		let batchCount = 0;
		const totalBatches = Math.ceil(symbols.length / batchSize);

		for (let i = 0; i < symbols.length; i += batchSize) {
			batchCount++;
			const batch = symbols.slice(i, i + batchSize);

			memoryMonitor.logMemoryUsage(`symbol_batch_${batchCount}_start`, {
				batchCount,
				totalBatches,
				batchSize: batch.length
			});

			console.log(
				`Processing symbol embeddings batch ${batchCount}/${totalBatches}`,
			);

			try {
				// Process in smaller micro-batches for improved memory management
				const microBatchSize = 5; // Process just 5 items at a time
				const microBatches = Math.ceil(batch.length / microBatchSize);
				
				// Store results from all micro-batches
				const allVectorItems = [];
				
				// Process each micro-batch
				for (let j = 0; j < batch.length; j += microBatchSize) {
					const microBatch = batch.slice(j, j + microBatchSize);
					const microBatchNum = Math.floor(j / microBatchSize) + 1;
					
					console.log(`Processing micro-batch ${microBatchNum}/${microBatches} of batch ${batchCount}`);
					
					// Generate embeddings for the micro-batch - one at a time for better memory control
					const embeddings = [];
					
					for (const symbol of microBatch) {
						try {
							// Process symbols one at a time to minimize memory pressure
							const symbolText = this.createSymbolText(symbol);
							const embedding = await this.embeddingService.generateEmbedding(symbolText);
							embeddings.push(embedding);
							
							// Create vector item immediately after processing each symbol
							allVectorItems.push({
								vector: embedding,
								metadata: {
									type: 'symbol',
									symbolId: `${symbol.name}:${symbol.location.filePath}:${symbol.location.startLine}`,
									name: symbol.name,
									symbolType: symbol.type,
									filePath: symbol.location.filePath,
								},
							});
							
							// Clear symbol content immediately after use
							if (symbol.content && symbol.content.length > 500) {
								symbol.content = '';
							}
						} catch (microError) {
							console.error(`Error generating embedding for symbol in micro-batch ${microBatchNum}:`, microError);
						}
					}
					
					// Force garbage collection after each micro-batch
					memoryMonitor.forceGC();
					
					// Add a small delay to allow memory to be reclaimed
					await new Promise(resolve => setTimeout(resolve, 50));
				}

				// Store all vector items from this batch
				if (allVectorItems.length > 0) {
					memoryMonitor.logMemoryUsage(`symbol_batch_${batchCount}_before_storage`, {
						vectorItemCount: allVectorItems.length
					});
					
					await this.vectorStorage.storeItems(allVectorItems);
					
					memoryMonitor.logMemoryUsage(`symbol_batch_${batchCount}_embeddings_stored`);
				}
				
				// Clear references to help garbage collection
				allVectorItems.length = 0;
				
				// Run garbage collection after every batch
				memoryMonitor.forceGC();
				
				// Add a small delay between batches to allow memory to be reclaimed
				await new Promise(resolve => setTimeout(resolve, 100));

			} catch (error) {
				console.error(`Error processing symbol batch ${batchCount}:`, error);
				// Continue processing other batches even if one fails
				memoryMonitor.forceGC();
			}
		}

		// Final cleanup
		memoryMonitor.forceGC();
		memoryMonitor.logMemoryUsage('symbol_embeddings_complete', {
			symbolCount: symbols.length,
			batchesProcessed: batchCount
		});

		console.log(
			`Generated and stored embeddings for ${symbols.length} symbols`,
		);
	}

	/**
	 * Generate and store embeddings for relationships
	 */
	private async generateAndStoreRelationshipEmbeddings(
		indexedCodebase: IndexedCodebase,
	): Promise<void> {
		// Get memory monitor
		const memoryMonitor = getMemoryMonitor();
		memoryMonitor.logMemoryUsage('relationship_embeddings_start', {
			relationshipCount: indexedCodebase.dependencies.length
		});

		const relationships = indexedCodebase.dependencies;
		const batchSize = 20; // Reduced batch size from 40 to 20 for better memory management

		let batchCount = 0;
		const totalBatches = Math.ceil(relationships.length / batchSize);

		for (let i = 0; i < relationships.length; i += batchSize) {
			batchCount++;
			const batch = relationships.slice(i, i + batchSize);

			memoryMonitor.logMemoryUsage(`relationship_batch_${batchCount}_start`, {
				batchCount,
				totalBatches,
				batchSize: batch.length
			});

			console.log(
				`Processing relationship embeddings batch ${batchCount}/${totalBatches}`,
			);

			try {
				// Use micro-batches similar to symbol processing
				const microBatchSize = 4; // Even smaller micro-batches for relationships
				const microBatches = Math.ceil(batch.length / microBatchSize);
				
				// Store all vector items from micro-batches
				const allVectorItems = [];
				
				// Process each micro-batch
				for (let j = 0; j < batch.length; j += microBatchSize) {
					const microBatch = batch.slice(j, j + microBatchSize);
					const microBatchNum = Math.floor(j / microBatchSize) + 1;
					
					console.log(`Processing relationship micro-batch ${microBatchNum}/${microBatches} of batch ${batchCount}`);
					
					// Process each relationship individually
					for (const relationship of microBatch) {
						try {
							const sourceSymbol = indexedCodebase.symbols[relationship.source];
							const targetSymbol = indexedCodebase.symbols[relationship.target];
							
							// Generate text and embedding one at a time
							const relationshipText = this.createRelationshipText(
								relationship,
								sourceSymbol,
								targetSymbol,
							);
							
							const embedding = await this.embeddingService.generateEmbedding(relationshipText);
							
							// Create and store vector item immediately
							allVectorItems.push({
								vector: embedding,
								metadata: {
									type: 'relationship',
									source: relationship.source,
									target: relationship.target,
									relType: relationship.type,
									metadata: relationship.metadata || {},
								},
							});
							
							// Add memory checkpoint after each relationship
							if (j % 2 === 0) {
								memoryMonitor.logMemoryUsage(`relationship_processing_checkpoint`, {
									batch: batchCount,
									microBatch: microBatchNum,
									processed: j
								});
							}
						} catch (microError) {
							console.error(`Error processing relationship in micro-batch ${microBatchNum}:`, microError);
						}
					}
					
					// Force garbage collection after each micro-batch
					memoryMonitor.forceGC();
					
					// Add a small delay to help with memory reclamation
					await new Promise(resolve => setTimeout(resolve, 50));
				}

				// Store all vector items from this batch
				if (allVectorItems.length > 0) {
					await this.vectorStorage.storeItems(allVectorItems);
					
					memoryMonitor.logMemoryUsage(`relationship_batch_${batchCount}_embeddings_stored`);
				}
				
				// Explicitly clear arrays to free memory
				allVectorItems.length = 0;
				
				// Force garbage collection after every batch
				memoryMonitor.forceGC();
				
				// Add a small delay between batches for better memory management
				await new Promise(resolve => setTimeout(resolve, 100));

			} catch (error) {
				console.error(`Error processing relationship batch ${batchCount}:`, error);
				// Continue processing other batches even if one fails
				memoryMonitor.forceGC();
			}
		}

		// Final cleanup
		memoryMonitor.forceGC();
		memoryMonitor.logMemoryUsage('relationship_embeddings_complete', {
			relationshipCount: relationships.length,
			batchesProcessed: batchCount
		});

		console.log(
			`Generated and stored embeddings for ${relationships.length} relationships`,
		);
	}

	/**
	 * Update the embedding for a symbol
	 */
	private async updateSymbolEmbedding(symbol: CodeSymbol): Promise<void> {
		// Generate text representation
		const symbolText = this.createSymbolText(symbol);

		// Generate embedding
		const embedding = await this.embeddingService.generateEmbedding(symbolText);

		// Create symbol ID
		const symbolId = `${symbol.name}:${symbol.location.filePath}:${symbol.location.startLine}`;

		// Store or update in vector storage
		await this.vectorStorage.updateItem(symbolId, {
			vector: embedding,
			metadata: {
				type: 'symbol',
				symbolId,
				name: symbol.name,
				symbolType: symbol.type,
				filePath: symbol.location.filePath,
			},
		});
	}

	/**
	 * Update the embedding for a relationship
	 */
	private async updateRelationshipEmbedding(
		relationship: CodeDependency,
		sourceSymbol?: CodeSymbol,
		targetSymbol?: CodeSymbol,
	): Promise<void> {
		// Generate text representation
		const relationshipText = this.createRelationshipText(
			relationship,
			sourceSymbol,
			targetSymbol,
		);

		// Generate embedding
		const embedding = await this.embeddingService.generateEmbedding(
			relationshipText,
		);

		// Create relationship ID
		const relationshipId = `${relationship.source}:${relationship.target}:${relationship.type}`;

		// Store or update in vector storage
		await this.vectorStorage.updateItem(relationshipId, {
			vector: embedding,
			metadata: {
				type: 'relationship',
				source: relationship.source,
				target: relationship.target,
				relType: relationship.type,
				metadata: relationship.metadata || {},
			},
		});
	}

	/**
	 * Create a text representation of a symbol for embedding
	 */
	private createSymbolText(symbol: CodeSymbol): string {
		let text = `Symbol: ${symbol.name}\nType: ${symbol.type}\nFile: ${symbol.location.filePath}\n`;

		if (symbol.signature) {
			text += `Signature: ${symbol.signature}\n`;
		}

		if (symbol.parent) {
			text += `Parent: ${symbol.parent}\n`;
		}

		if (symbol.scope) {
			text += `Scope: ${symbol.scope}\n`;
		}

		if (symbol.documentation) {
			text += `Documentation: ${symbol.documentation}\n`;
		}

		if (symbol.content) {
			text += `\nCode Content:\n${symbol.content}\n`;
		}

		return text;
	}

	/**
	 * Create a text representation of a relationship for embedding
	 */
	private createRelationshipText(
		relationship: CodeDependency,
		sourceSymbol?: CodeSymbol,
		targetSymbol?: CodeSymbol,
	): string {
		let text = `Relationship Type: ${relationship.type}\n`;

		if (sourceSymbol) {
			text += `Source: ${sourceSymbol.name} (${sourceSymbol.type})\n`;
			text += `Source File: ${sourceSymbol.location.filePath}\n`;

			if (sourceSymbol.signature) {
				text += `Source Signature: ${sourceSymbol.signature}\n`;
			}
		} else {
			text += `Source: ${relationship.source}\n`;
		}

		if (targetSymbol) {
			text += `Target: ${targetSymbol.name} (${targetSymbol.type})\n`;
			text += `Target File: ${targetSymbol.location.filePath}\n`;

			if (targetSymbol.signature) {
				text += `Target Signature: ${targetSymbol.signature}\n`;
			}
		} else {
			text += `Target: ${relationship.target}\n`;
		}

		if (relationship.metadata) {
			for (const [key, value] of Object.entries(relationship.metadata)) {
				text += `Metadata ${key}: ${value}\n`;
			}
		}

		return text;
	}
}