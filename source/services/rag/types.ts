import {IndexedCodebase} from '../indexing/types.js';

// src/services/rag/types.ts
export interface EmbeddingVector {
	id: string;
	vector: number[];
	metadata: {
		filePath: string;
		startLine: number;
		endLine: number;
		content: string;
		type?: string;
	};
}

export interface SearchResult {
	id: string;
	score: number;
	content: string;
	metadata: {
		filePath: string;
		startLine: number;
		endLine: number;
		type: string | undefined;
	};
}

export interface RAGService {
	/**
	 * Initializes the vector database
	 */
	initialize(): Promise<void>;

	/**
	 * Adds embeddings to the vector database
	 */
	addEmbeddings(embeddings: EmbeddingVector[]): Promise<void>;

	/**
	 * Searches for similar embeddings
	 */
	search(
		query: string,
		options?: {
			limit?: number;
			minScore?: number;
			filters?: Record<string, any>;
		},
	): Promise<SearchResult[]>;

	/**
	 * Gets relevant context for a query
	 */
	getContextForQuery(query: string, maxTokens?: number): Promise<string>;
	
	/**
	 * Gets context optimized for a specific type of coding query
	 */
	getContextForCodeQuery(
		query: string, 
		queryType: 'explanation' | 'implementation' | 'architecture' | 'bug',
		maxTokens?: number
	): Promise<string>;

	/**
	 * Creates embeddings for the indexed codebase
	 */
	embedCodebase(indexedCodebase: IndexedCodebase): Promise<void>;

	/**
	 * Saves the vector database to disk
	 */
	saveVectorDB(): Promise<void>;

	/**
	 * Loads a vector database from disk
	 */
	loadVectorDB(path: string): Promise<void>;
}
