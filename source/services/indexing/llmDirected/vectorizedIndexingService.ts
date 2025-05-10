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
		try {
			console.log(`Starting vectorized indexing of ${projectPath}`);
			// projectRoot is not needed

			// Ensure the vector storage is initialized
			const vectorStoragePath = path.join(
				projectPath,
				'.guardian-ai',
				'vector-storage',
			);
			await fs.ensureDir(vectorStoragePath);
			await this.vectorStorage.initialize();

			// First, perform the base indexing
			console.log('Performing base indexing...');
			const indexedCodebase = await this.baseIndexingService.indexCodebase(
				projectPath,
				options,
			);

			// Generate and store embeddings for all symbols
			console.log('Generating vector embeddings for symbols...');
			await this.generateAndStoreSymbolEmbeddings(indexedCodebase);

			// Generate and store embeddings for relationships
			console.log('Generating vector embeddings for relationships...');
			await this.generateAndStoreRelationshipEmbeddings(indexedCodebase);

			console.log('Vectorized indexing complete.');
			return indexedCodebase;
		} catch (error) {
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
		const batchSize = 50; // Using smaller batches (reduced from 100) to prevent memory spikes

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
				// Generate embeddings for the batch
				const symbolTexts = batch.map(symbol => this.createSymbolText(symbol));

				// Memory efficient approach - clear batch references after use
				const embeddings = await this.embeddingService.generateEmbeddings(symbolTexts);

				// Free memory by clearing large text content
				symbolTexts.length = 0;

				memoryMonitor.logMemoryUsage(`symbol_batch_${batchCount}_embeddings_generated`);

				// Store embeddings
				const vectorItems = batch.map((symbol, index) => ({
					vector: embeddings[index] || [],
					metadata: {
						type: 'symbol',
						symbolId: `${symbol.name}:${symbol.location.filePath}:${symbol.location.startLine}`,
						name: symbol.name,
						symbolType: symbol.type,
						filePath: symbol.location.filePath,
					},
				}));

				await this.vectorStorage.storeItems(vectorItems);

				memoryMonitor.logMemoryUsage(`symbol_batch_${batchCount}_embeddings_stored`);

				// Clean up large objects to free memory
				batch.forEach(symbol => {
					if (symbol.content && symbol.content.length > 1000) {
						symbol.content = '';
					}
				});

				// Explicitly clear arrays after use
				embeddings.length = 0;

				// Every few batches, run garbage collection if possible
				if (batchCount % 5 === 0) {
					memoryMonitor.forceGC();
				}

			} catch (error) {
				console.error(`Error processing symbol batch ${batchCount}:`, error);
				// Continue processing other batches even if one fails
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
		const batchSize = 40; // Using slightly smaller batches to prevent memory spikes

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
				// Generate embeddings for the batch
				const relationshipTexts = batch.map(relationship => {
					const sourceSymbol = indexedCodebase.symbols[relationship.source];
					const targetSymbol = indexedCodebase.symbols[relationship.target];
					return this.createRelationshipText(
						relationship,
						sourceSymbol,
						targetSymbol,
					);
				});

				const embeddings = await this.embeddingService.generateEmbeddings(
					relationshipTexts,
				);

				// Free memory by clearing large text content
				relationshipTexts.length = 0;

				memoryMonitor.logMemoryUsage(`relationship_batch_${batchCount}_embeddings_generated`);

				// Store embeddings
				const vectorItems = batch.map((relationship, index) => ({
					vector: embeddings[index] || [],
					metadata: {
						type: 'relationship',
						source: relationship.source,
						target: relationship.target,
						relType: relationship.type,
						metadata: relationship.metadata || {},
					},
				}));

				await this.vectorStorage.storeItems(vectorItems);

				memoryMonitor.logMemoryUsage(`relationship_batch_${batchCount}_embeddings_stored`);

				// Explicitly clear arrays after use
				embeddings.length = 0;

				// Every few batches, force garbage collection if available
				if (batchCount % 5 === 0) {
					memoryMonitor.forceGC();
				}

			} catch (error) {
				console.error(`Error processing relationship batch ${batchCount}:`, error);
				// Continue processing other batches even if one fails
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
