// src/services/rag/ragService.ts
import * as path from 'path';
import * as fs from 'fs-extra';
import { RAGService, EmbeddingVector, SearchResult } from './types.js';
import { IndexedCodebase, CodeSymbol } from '../indexing/types.js';
import { LLMService } from '../llm/types.js';
import { FileSystemService } from '../fileSystem/types.js';
import { AnthropicService } from '../llm/llmService.js';
import { OpenAIService } from '../llm/openAIService.js';
import { NodeFileSystemService } from '../fileSystem/fileSystemService.js';

/**
 * Basic in-memory vector database for RAG
 */
export class InMemoryRAGService implements RAGService {
  private vectors: EmbeddingVector[] = [];
  // @ts-ignore: Will be used in future implementations
  private readonly llmService: LLMService;
  private readonly embeddingsService: LLMService;
  private readonly fileSystem: FileSystemService;
  private projectRoot: string = '';
  private dimension: number = 0;

  constructor(llmService?: LLMService, fileSystem?: FileSystemService, embeddingsService?: LLMService) {
    this.llmService = llmService || new AnthropicService();
    this.embeddingsService = embeddingsService || new OpenAIService();
    this.fileSystem = fileSystem || new NodeFileSystemService();
  }

  /**
   * Initializes the vector database
   */
  async initialize(): Promise<void> {
    // For our in-memory implementation, initialization is simple
    this.vectors = [];
    console.log('In-memory vector database initialized');
  }

  /**
   * Adds embeddings to the vector database
   */
  async addEmbeddings(embeddings: EmbeddingVector[]): Promise<void> {
    if (embeddings.length === 0) {
      return;
    }
    
    // Set the dimension if this is the first batch
    if (this.dimension === 0 && embeddings[0]?.vector?.length) {
      this.dimension = embeddings[0].vector.length;
    }
    
    // Verify all vectors have the correct dimension
    for (const embedding of embeddings) {
      if (this.dimension > 0 && embedding.vector.length !== this.dimension) {
        throw new Error(`Vector dimension mismatch: expected ${this.dimension}, got ${embedding.vector.length}`);
      }
    }
    
    this.vectors.push(...embeddings);
    console.log(`Added ${embeddings.length} embeddings to vector database`);
  }

  /**
   * Searches for similar embeddings using cosine similarity
   */
  async search(
    query: string,
    options?: {
      limit?: number;
      minScore?: number;
      filters?: Record<string, any>;
    }
  ): Promise<SearchResult[]> {
    const limit = options?.limit || 5;
    const minScore = options?.minScore || 0.7;
    
    // Get query embedding
    const queryEmbedding = await this.embeddingsService.generateEmbeddings(query);
    
  if (!queryEmbedding || queryEmbedding.length === 0) {
    throw new Error('Failed to generate embedding for query');
  }
  
  if (this.dimension > 0 && queryEmbedding.length !== this.dimension) {
    throw new Error(`Query embedding dimension mismatch: expected ${this.dimension}, got ${queryEmbedding.length}`);
  }
    
    // Calculate similarities
    const resultsWithNulls = this.vectors
      .map(vec => {
        // Apply filters if they exist
        if (options?.filters) {
          for (const [key, value] of Object.entries(options.filters)) {
            if (vec.metadata[key as keyof typeof vec.metadata] !== value) {
              return null;
            }
          }
        }

        const similarity = this.cosineSimilarity(queryEmbedding, vec.vector);
        return {
          id: vec.id,
          score: similarity,
          content: vec.metadata.content,
          metadata: {
            filePath: vec.metadata.filePath,
            startLine: vec.metadata.startLine,
            endLine: vec.metadata.endLine,
            type: vec.metadata.type
          }
        } as SearchResult;
      });

    // Filter out nulls and apply score filter
    const filteredResults = resultsWithNulls.filter((result): result is SearchResult =>
      result !== null && result.score >= minScore
    );

    // Sort and limit
    const results = filteredResults
      .sort((a, b) => b.score - a.score)
      .slice(0, limit);
    
    return results;
  }
  
  /**
   * Gets context optimized for a specific type of query
   */
  async getContextForCodeQuery(
    query: string, 
    queryType: 'explanation' | 'implementation' | 'architecture' | 'bug' = 'explanation',
    maxTokens: number = 4000
  ): Promise<string> {
    try {
      // Different search parameters based on query type
      const searchParams: {limit: number, minScore: number} = {
        limit: 10,
        minScore: 0.7
      };
      
      // Adjust search parameters based on query type
      switch (queryType) {
        case 'explanation':
          // For explanations, we want more diverse but highly relevant results
          searchParams.limit = 8;
          searchParams.minScore = 0.75;
          break;
        case 'implementation':
          // For implementation details, we want more focused results
          searchParams.limit = 5;
          searchParams.minScore = 0.8;
          break;
        case 'architecture':
          // For architecture questions, we want breadth
          searchParams.limit = 15;
          searchParams.minScore = 0.65;
          break;
        case 'bug':
          // For bug hunting, we want more context
          searchParams.limit = 12;
          searchParams.minScore = 0.6;
          break;
      }
      
      // Search for similar vectors with the adjusted parameters
      const searchResults = await this.search(query, searchParams);
      
      if (searchResults.length === 0) {
        return "No relevant context found for the query.";
      }
      
      // Special formatting based on query type
      let contextPrefix = '';
      switch (queryType) {
        case 'explanation':
          contextPrefix = `# Context for explaining: "${query}"\n\nThe following code snippets are relevant to this explanation:\n\n`;
          break;
        case 'implementation':
          contextPrefix = `# Implementation details for: "${query}"\n\nRelevant implementation code:\n\n`;
          break;
        case 'architecture':
          contextPrefix = `# Architectural overview related to: "${query}"\n\nThese code components work together in the following way:\n\n`;
          break;
        case 'bug':
          contextPrefix = `# Debugging context for: "${query}"\n\nPotential areas to investigate:\n\n`;
          break;
      }
      
      // Format the results with the special prefix
      const formattedContext = this.formatContextFromResults(searchResults, query, maxTokens - (contextPrefix.length * 0.25));
      return contextPrefix + formattedContext;
    } catch (error) {
      console.error('Error getting specialized context:', error);
      return "Failed to retrieve context due to an error.";
    }
  }

  /**
   * Gets relevant context for a query by searching for similar code snippets
   */
  async getContextForQuery(query: string, maxTokens: number = 4000): Promise<string> {
    try {
      // Search for similar vectors
      const searchResults = await this.search(query, { limit: 10 });
      
      if (searchResults.length === 0) {
        return "No relevant context found for the query.";
      }
      
      return this.formatContextFromResults(searchResults, query, maxTokens);
    } catch (error) {
      console.error('Error getting context for query:', error);
      return "Failed to retrieve context due to an error.";
    }
  }
  
  /**
   * Formats search results into a structured context string
   */
  private formatContextFromResults(
    results: SearchResult[], 
    query: string, 
    maxTokens: number = 4000
  ): string {
    // Build context string from search results
    let context = `Relevant code snippets for: ${query}\n\n`;
    let tokenCount = 0;
    const estimatedTokensPerChar = 0.25; // Rough estimation
    
    // Group results by file path for better organization
    const resultsByFile: Record<string, SearchResult[]> = {};
    
    // Group and sort results
    for (const result of results) {
      if (!resultsByFile[result.metadata.filePath]) {
        resultsByFile[result.metadata.filePath] = [];
      }
      const filePath = result.metadata.filePath;
      if (resultsByFile[filePath]) {
        resultsByFile[filePath].push(result);
      }
    }
    
    // Process each file's snippets
    for (const [filePath, fileResults] of Object.entries(resultsByFile)) {
      // Sort by line number to keep proper file order
      fileResults.sort((a, b) => a.metadata.startLine - b.metadata.startLine);
      
      // Add file header
      const fileHeader = `\n## File: ${filePath}\n\n`;
      context += fileHeader;
      tokenCount += fileHeader.length * estimatedTokensPerChar;
      
      // Add each result from this file
      for (const result of fileResults) {
        const snippet = `
### ${result.metadata.type || 'Code Snippet'} (Lines ${result.metadata.startLine}-${result.metadata.endLine})
Relevance: ${Math.round(result.score * 100)}%

\`\`\`
${result.content}
\`\`\`

`;
        
        const snippetTokens = snippet.length * estimatedTokensPerChar;
        
        if (tokenCount + snippetTokens > maxTokens) {
          context += "\n(Additional relevant snippets omitted due to token limit)";
          break;
        }
        
        context += snippet;
        tokenCount += snippetTokens;
      }
      
      // Check if we've exceeded token limit
      if (tokenCount > maxTokens) {
        break;
      }
    }
    
    return context;
  }

  /**
   * Creates embeddings for the indexed codebase
   */
  async embedCodebase(indexedCodebase: IndexedCodebase): Promise<void> {
    const symbols = Object.values(indexedCodebase.symbols);
    console.log(`Creating embeddings for ${symbols.length} symbols...`);
    
    const embeddings: EmbeddingVector[] = [];
    const batchSize = 10; // Process in small batches to avoid overloading the embedding API
    
    for (let i = 0; i < symbols.length; i += batchSize) {
      const batch = symbols.slice(i, i + batchSize);
      await Promise.all(
        batch.map(async (symbol) => {
          try {
            // Get the content for this symbol
            const content = await this.getSymbolContent(symbol);
            if (!content || content.trim() === '') {
              console.warn(`Empty content for symbol ${symbol.name}, skipping`);
              return;
            }
            
            // Add surrounding context if available - makes embeddings more useful
            const enrichedContent = await this.enrichSymbolWithContext(symbol, content);
            
            // Generate embedding
            const vector = await this.embeddingsService.generateEmbeddings(enrichedContent);
            
            if (!vector || vector.length === 0) {
              console.warn(`Empty embedding vector for symbol ${symbol.name}, skipping`);
              return;
            }
            
            // Create embedding object
            const embedding: EmbeddingVector = {
              id: symbol.name + '-' + symbol.location.filePath,
              vector,
              metadata: {
                filePath: symbol.location.filePath,
                startLine: symbol.location.startLine,
                endLine: symbol.location.endLine,
                content: enrichedContent,
                type: symbol.type
              }
            };
            
            embeddings.push(embedding);
          } catch (error) {
            console.error(`Error embedding symbol ${symbol.name}:`, error);
          }
        })
      );
      
      console.log(`Processed ${Math.min(i + batchSize, symbols.length)}/${symbols.length} symbols`);
    }
    
    // Add all embeddings to the vector database
    if (embeddings.length > 0) {
      await this.addEmbeddings(embeddings);
    } else {
      console.warn('No valid embeddings were generated from the codebase');
    }
  }
  
  /**
   * Enriches a symbol's content with additional context
   */
  private async enrichSymbolWithContext(symbol: CodeSymbol, content: string): Promise<string> {
    try {
      if (!this.projectRoot) {
        console.warn(`No project root set, cannot enrich symbol ${symbol.name}`);
        return content;
      }
      
      // For functions and methods, try to add docstrings or comments
      if (symbol.type === 'function' || symbol.type === 'class') {
        try {
          const filePath = path.join(this.projectRoot, symbol.location.filePath);
          
          // Check if file exists before trying to read it
          if (!await fs.pathExists(filePath)) {
            console.warn(`File not found for symbol ${symbol.name}: ${filePath}`);
            return content;
          }
          
          const fileContent = await this.fileSystem.readFile(filePath);
          if (!fileContent || !fileContent.content) {
            console.warn(`Invalid file content for symbol ${symbol.name}`);
            return content;
          }
          
          const lines = fileContent.content.split('\n');
          
          // Check for comments before the symbol definition
          const commentLines: string[] = [];
          let lineIndex = Math.max(0, symbol.location.startLine - 2); // -2 to check line before function
          const maxLookupLines = 10;
          
          // Collect comments above the symbol
          while (lineIndex >= 0 && 
                 lineIndex >= symbol.location.startLine - maxLookupLines && 
                 lineIndex < lines.length) {
            const line = lines[lineIndex]?.trim() || '';
            
            if (line.startsWith('//') || line.startsWith('*') || line.startsWith('#')) {
              const currentLine = lines[lineIndex];
              if (currentLine) {
                commentLines.unshift(currentLine);
              }
            } else if (line.startsWith('/*') || line.startsWith('"""') || line.startsWith("'''")) {
              const currentLine = lines[lineIndex];
              if (currentLine) {
                commentLines.unshift(currentLine);
              }
              break;
            } else if (line === '') {
              // Skip empty lines
            } else {
              // Stop when we hit non-comment code
              break;
            }
            lineIndex--;
          }
          
          if (commentLines.length > 0) {
            return `${commentLines.join('\n')}\n${content}`;
          }
        } catch (fileError) {
          console.warn(`Error reading file for symbol ${symbol.name}:`, fileError);
          // Continue and return original content
        }
      }
      
      return content;
    } catch (error) {
      console.warn(`Could not enrich symbol ${symbol.name}:`, error);
      return content;
    }
  }

  /**
   * Helper method to get the content for a symbol
   */
  private async getSymbolContent(symbol: CodeSymbol): Promise<string> {
    try {
      if (!this.projectRoot) {
        throw new Error('Project root not set');
      }
      
      const filePath = path.join(this.projectRoot, symbol.location.filePath);
      
      // Check if file exists first
      if (!await fs.pathExists(filePath)) {
        throw new Error(`File not found: ${filePath}`);
      }
      
      const fileContent = await this.fileSystem.readFile(filePath);
      
      // Extract just the lines for this symbol
      const lines = fileContent.content.split('\n');
      
      // Validate line range to prevent out-of-bounds errors
      const startLine = Math.max(0, Math.min(symbol.location.startLine - 1, lines.length - 1));
      const endLine = Math.max(startLine, Math.min(symbol.location.endLine, lines.length));
      
      const symbolLines = lines.slice(startLine, endLine);
      
      return symbolLines.join('\n');
    } catch (error) {
      console.error(`Error getting content for symbol ${symbol.name}:`, error);
      return `Symbol ${symbol.name} (${symbol.type}) at ${symbol.location.filePath}:${symbol.location.startLine}`;
    }
  }

  /**
   * Saves the vector database to disk
   */
  async saveVectorDB(): Promise<void> {
    if (!this.projectRoot) {
      throw new Error('Project root not set. Index a codebase first.');
    }
    
    const dbPath = path.join(this.projectRoot, '.guardian-ai', 'vector-db.json');
    
    // Create directory if it doesn't exist
    await fs.ensureDir(path.dirname(dbPath));
    
    // Convert to a serializable format
    const dbData = {
      dimension: this.dimension,
      vectors: this.vectors
    };
    
    // Save the database
    await fs.writeJson(dbPath, dbData, { spaces: 2 });
    console.log(`Vector database saved to ${dbPath}`);
  }

  /**
   * Loads a vector database from disk
   */
  async loadVectorDB(projectPath: string): Promise<void> {
    this.projectRoot = projectPath;
    const dbPath = path.join(projectPath, '.guardian-ai', 'vector-db.json');
    
    try {
      if (await fs.pathExists(dbPath)) {
        const dbData = await fs.readJson(dbPath);
        this.dimension = dbData.dimension;
        this.vectors = dbData.vectors;
        console.log(`Vector database loaded from ${dbPath}`);
      } else {
        throw new Error(`Vector database file not found: ${dbPath}`);
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      throw new Error(`Failed to load vector database: ${errorMessage}`);
    }
  }

  /**
   * Helper method to calculate cosine similarity between two vectors
   */
  private cosineSimilarity(a: number[], b: number[]): number {
    if (!a || !b || a.length !== b.length) {
      throw new Error(`Vectors must have the same length - got ${a?.length} and ${b?.length}`);
    }
    
    let dotProduct = 0;
    let normA = 0;
    let normB = 0;
    
    for (let i = 0; i < a.length; i++) {
      // Make sure array elements are defined before using them
      const aVal = a[i];
      const bVal = b[i];
      if (aVal !== undefined && bVal !== undefined) {
        dotProduct += aVal * bVal;
        normA += aVal * aVal;
        normB += bVal * bVal;
      }
    }
    
    if (normA === 0 || normB === 0) {
      return 0;
    }
    
    return dotProduct / (Math.sqrt(normA) * Math.sqrt(normB));
  }
}