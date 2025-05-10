// source/services/indexing/llmDirected/indexingAgent.ts

import * as path from 'path';
import { LLMService } from '../../llm/types.js';
import { StoragePrimitives } from './storagePrimitives.js';
import {
  AgentActionType,
  AgentRequest,
  AgentResponse,
  AnalyzeCodebaseRequest,
  AnalyzeCodebaseResponse,
  DesignIndexStrategyRequest,
  DesignIndexStrategyResponse,
  AnalyzeFileRequest,
  AnalyzeFileResponse,
  DesignFileChunkingRequest,
  DesignFileChunkingResponse,
  ExtractSymbolsRequest,
  ExtractSymbolsResponse,
  AnalyzeRelationshipsRequest,
  AnalyzeRelationshipsResponse,
  EnhanceSymbolMetadataRequest,
  EnhanceSymbolMetadataResponse,
  parseAgentResponse
} from './agentProtocol.js';
import { FileSystemService } from '../../fileSystem/types.js';
import { CodeSymbol, CodeDependency } from '../types.js';
import { PatternInterpreter } from './patternInterpreter.js';
import { SymbolExtractor } from './symbolExtractor.js';
import { RelationshipMapper } from './relationshipMapper.js';
import { getMemoryMonitor } from '../../utils/memoryMonitor.js';

/**
 * Manages communication with the LLM for indexing decisions
 */
export class IndexingAgent {
  private llmService: LLMService;
  // We don't directly use these fields, but keeping them for future use
  // @ts-ignore
  private fileSystem: FileSystemService;
  private storagePrimitives: StoragePrimitives;
  // @ts-ignore
  private projectRoot: string;

  private patternInterpreter: PatternInterpreter;
  private symbolExtractor: SymbolExtractor;

  private relationshipMapper: RelationshipMapper;

  constructor(
    llmService: LLMService,
    fileSystem: FileSystemService,
    projectRoot: string
  ) {
    this.llmService = llmService;
    this.fileSystem = fileSystem;
    this.projectRoot = projectRoot;
    this.storagePrimitives = new StoragePrimitives(fileSystem, projectRoot);
    this.patternInterpreter = new PatternInterpreter(this.storagePrimitives);
    this.symbolExtractor = new SymbolExtractor();
    this.relationshipMapper = new RelationshipMapper();
  }

  /**
   * Performs an initial analysis of the codebase structure
   */
  async analyzeCodebase(
    fileTypes: Record<string, number>,
    directoryStructure: Record<string, number>,
    sampleFiles: Array<{ path: string; size: number; snippet?: string }>
  ): Promise<AnalyzeCodebaseResponse['data']> {
    try {
      // Build the request for the LLM
      const request: AnalyzeCodebaseRequest = {
        action: AgentActionType.ANALYZE_CODEBASE,
        data: {
          codebaseStructure: {
            fileTypes,
            directoryStructure,
            sampleFiles,
          },
        },
      };

      // Send the request to the LLM
      const response = await this.makeAgentRequest<AnalyzeCodebaseRequest, AnalyzeCodebaseResponse>(
        request
      );

      if (!response.success) {
        throw new Error(`Failed to analyze codebase: ${response.message}`);
      }

      return response.data;
    } catch (error) {
      console.error('Error analyzing codebase:', error);
      throw error;
    }
  }

  /**
   * Designs the overall indexing strategy for the codebase
   */
  async designIndexingStrategy(
    codebaseAnalysis: AnalyzeCodebaseResponse['data'],
    constraints: { maxMemoryUsage?: number; maxProcessingTime?: number }
  ): Promise<DesignIndexStrategyResponse['data']> {
    try {
      // Build the request for the LLM
      const request: DesignIndexStrategyRequest = {
        action: AgentActionType.DESIGN_INDEX_STRATEGY,
        data: {
          codebaseAnalysis,
          constraints,
        },
      };

      // Send the request to the LLM
      const response = await this.makeAgentRequest<DesignIndexStrategyRequest, DesignIndexStrategyResponse>(
        request
      );

      if (!response.success) {
        throw new Error(`Failed to design indexing strategy: ${response.message}`);
      }

      return response.data;
    } catch (error) {
      console.error('Error designing indexing strategy:', error);
      throw error;
    }
  }

  /**
   * Analyzes a specific file to determine how to best process it
   */
  async analyzeFile(
    filePath: string,
    content: string
  ): Promise<AnalyzeFileResponse['data']> {
    try {
      const extension = path.extname(filePath);

      // Build the request for the LLM
      const request: AnalyzeFileRequest = {
        action: AgentActionType.ANALYZE_FILE,
        data: {
          filePath,
          content,
          extension,
        },
      };

      // Send the request to the LLM
      const response = await this.makeAgentRequest<AnalyzeFileRequest, AnalyzeFileResponse>(
        request
      );

      if (!response.success) {
        throw new Error(`Failed to analyze file: ${response.message}`);
      }

      return response.data;
    } catch (error) {
      console.error(`Error analyzing file ${filePath}:`, error);
      throw error;
    }
  }

  /**
   * Designs the chunking strategy for a specific file
   */
  async designFileChunking(
    filePath: string,
    content: string,
    fileAnalysis: AnalyzeFileResponse['data']
  ): Promise<DesignFileChunkingResponse['data']> {
    try {
      // Build the request for the LLM
      const request: DesignFileChunkingRequest = {
        action: AgentActionType.DESIGN_FILE_CHUNKING,
        data: {
          filePath,
          content,
          fileAnalysis,
        },
      };

      // Send the request to the LLM
      const response = await this.makeAgentRequest<DesignFileChunkingRequest, DesignFileChunkingResponse>(
        request
      );

      if (!response.success) {
        throw new Error(`Failed to design file chunking: ${response.message}`);
      }

      return response.data;
    } catch (error) {
      console.error(`Error designing chunking for file ${filePath}:`, error);
      throw error;
    }
  }

  /**
   * Extracts symbols from chunks of a file
   */
  async extractSymbols(
    filePath: string,
    content: string,
    chunks: Array<{ content: string; startLine: number; endLine: number; type?: string }>
  ): Promise<CodeSymbol[]> {
    try {
      // Get file extension for file type-specific handling
      const extension = path.extname(filePath);

      // Build the request for the LLM
      const request: ExtractSymbolsRequest = {
        action: AgentActionType.EXTRACT_SYMBOLS,
        data: {
          filePath,
          content,
          chunks,
          fileType: extension,
        },
      };

      // Send the request to the LLM
      const response = await this.makeAgentRequest<ExtractSymbolsRequest, ExtractSymbolsResponse>(
        request
      );

      if (!response.success) {
        throw new Error(`Failed to extract symbols: ${response.message}`);
      }

      // Check if we got extraction patterns from the LLM
      let allSymbols: CodeSymbol[] = [];

      if (response.data.extractionPatterns && response.data.extractionPatterns.length > 0) {
        console.log(`Using ${response.data.extractionPatterns.length} LLM-provided extraction patterns for ${filePath}`);

        // Use the LLM-provided patterns to extract symbols from chunks
        for (const chunk of chunks) {
          for (const pattern of response.data.extractionPatterns) {
            try {
              const extractedSymbols = await this.symbolExtractor.extractSymbols(filePath, chunk, pattern);
              if (extractedSymbols.length > 0) {
                console.log(`Extracted ${extractedSymbols.length} symbols from chunk ${chunk.startLine}-${chunk.endLine} using pattern type ${pattern.type}`);
                allSymbols.push(...extractedSymbols);
              }
            } catch (extractError) {
              console.error(`Error applying extraction pattern to chunk:`, extractError);
            }
          }
        }

        // If we extracted symbols using patterns, combine them with any direct symbols provided by the LLM
        if (allSymbols.length > 0) {
          console.log(`Extracted ${allSymbols.length} symbols using patterns for ${filePath}`);

          // Combine with any directly provided symbols
          if (response.data.symbols && response.data.symbols.length > 0) {
            console.log(`Combining with ${response.data.symbols.length} directly provided symbols`);

            // Convert string types to the enum-constrained types required by CodeSymbol
            const llmSymbols = response.data.symbols.map((symbol: any): CodeSymbol => ({
              ...symbol,
              // Ensure type is one of the valid types
              type: symbol.type as "function" | "class" | "variable" | "import" | "export" | "interface" | "type" | "method"
            }));

            // Remove duplicates by comparing name and location
            const seenSymbols = new Set<string>();
            const uniqueSymbols: CodeSymbol[] = [];

            // First add all pattern-extracted symbols
            for (const symbol of allSymbols) {
              // Create a unique key safely, ensuring location fields exist
              let key = symbol.name;
              if (symbol.location &&
                  typeof symbol.location.startLine === 'number' &&
                  typeof symbol.location.endLine === 'number') {
                key = `${symbol.name}:${symbol.location.startLine}:${symbol.location.endLine}`;
              } else if (symbol.location && symbol.location.filePath) {
                // Use file path as a fallback if available
                key = `${symbol.name}:${symbol.location.filePath}`;
              }

              if (!seenSymbols.has(key)) {
                seenSymbols.add(key);
                uniqueSymbols.push(symbol);
              }
            }

            // Then add non-duplicate LLM-provided symbols
            for (const symbol of llmSymbols) {
              // Ensure symbols have a valid location object with required fields
              if (!symbol.location) {
                // Create a default location for symbols that are missing it
                symbol.location = {
                  filePath: filePath,
                  startLine: 1,
                  endLine: 1,
                  startColumn: 1,
                  endColumn: 1
                };
              } else {
                // Ensure all required location fields are set
                symbol.location.filePath = symbol.location.filePath || filePath;
                symbol.location.startLine = symbol.location.startLine || 1;
                symbol.location.endLine = symbol.location.endLine || (symbol.location.startLine || 1);
                symbol.location.startColumn = symbol.location.startColumn || 1;
                symbol.location.endColumn = symbol.location.endColumn || 1;
              }

              // Create a unique key using the validated location
              const key = `${symbol.name}:${symbol.location.startLine}:${symbol.location.endLine}`;
              if (!seenSymbols.has(key)) {
                seenSymbols.add(key);
                uniqueSymbols.push(symbol);
              }
            }

            return uniqueSymbols;
          }

          return allSymbols;
        }
      }

      // If no patterns provided or no symbols extracted using patterns,
      // fall back to using the symbols directly from the LLM response
      if (response.data.symbols && response.data.symbols.length > 0) {
        console.log(`Using ${response.data.symbols.length} LLM-provided symbols for ${filePath}`);

        // Convert string types to the enum-constrained types required by CodeSymbol
        return response.data.symbols.map((symbol: any): CodeSymbol => ({
          ...symbol,
          // Ensure type is one of the valid types
          type: symbol.type as "function" | "class" | "variable" | "import" | "export" | "interface" | "type" | "method"
        }));
      }

      // If LLM didn't provide patterns or direct symbols, fall back to default extraction
      console.log(`No symbols provided by LLM, using default extraction patterns for ${filePath}`);
      const defaultPatterns = this.symbolExtractor.generateDefaultPatterns(extension);

      for (const chunk of chunks) {
        for (const pattern of defaultPatterns) {
          try {
            const extractedSymbols = await this.symbolExtractor.extractSymbols(filePath, chunk, pattern);

            // Validate and enhance each symbol to ensure it has the minimum required fields
            // while preserving any flexibility the LLM might have introduced
            const validatedSymbols = extractedSymbols.map(symbol => {
              // Ensure symbol has a name
              if (!symbol.name) {
                console.warn(`Symbol missing name, generating placeholder name`);
                symbol.name = `unnamed_symbol_${Math.random().toString(36).substring(2, 9)}`;
              }

              // Ensure symbol has a complete location object
              if (!symbol.location) {
                console.warn(`Symbol ${symbol.name} missing location, creating default location`);
                symbol.location = {
                  filePath: filePath,
                  startLine: chunk.startLine,
                  endLine: chunk.endLine,
                  startColumn: 1,
                  endColumn: 1
                };
              } else {
                // Ensure all location fields are set with reasonable defaults
                if (!symbol.location.filePath) {
                  symbol.location.filePath = filePath;
                }
                if (!symbol.location.startLine || isNaN(symbol.location.startLine)) {
                  symbol.location.startLine = chunk.startLine;
                }
                if (!symbol.location.endLine || isNaN(symbol.location.endLine)) {
                  symbol.location.endLine = chunk.endLine;
                }
                if (!symbol.location.startColumn || isNaN(symbol.location.startColumn)) {
                  symbol.location.startColumn = 1;
                }
                if (!symbol.location.endColumn || isNaN(symbol.location.endColumn)) {
                  symbol.location.endColumn = 1;
                }
              }

              return symbol;
            });

            if (validatedSymbols.length > 0) {
              allSymbols.push(...validatedSymbols);
            }
          } catch (extractError) {
            console.error(`Error applying default extraction pattern to chunk:`, extractError);
          }
        }
      }

      console.log(`Extracted ${allSymbols.length} symbols using default patterns for ${filePath}`);
      return allSymbols;
    } catch (error) {
      console.error(`Error extracting symbols from file ${filePath}:`, error);
      throw error;
    }
  }

  /**
   * Analyzes relationships between symbols
   */
  async analyzeRelationships(
    filePath: string,
    content: string,
    symbols: CodeSymbol[],
    otherSymbols?: Array<{ id: string; name: string; type: string; filePath: string }>
  ): Promise<CodeDependency[]> {
    try {
      console.log(`Analyzing relationships for ${symbols.length} symbols in ${filePath}`);

      // Start with any existing dependencies that might have been previously detected
      let dependencies: CodeDependency[] = [];

      // Build the request for the LLM to get relationship patterns
      const request: AnalyzeRelationshipsRequest = {
        action: AgentActionType.ANALYZE_RELATIONSHIPS,
        data: {
          filePath,
          content,
          symbols,
          otherSymbols,
        },
      };

      // Send the request to the LLM
      const response = await this.makeAgentRequest<AnalyzeRelationshipsRequest, AnalyzeRelationshipsResponse>(
        request
      );

      if (!response.success) {
        console.warn(`LLM relationship analysis failed: ${response.message}. Using fallback approach.`);
      } else {
        // First, check if we got LLM-provided relationships directly
        if (response.data.relationships && response.data.relationships.length > 0) {
          console.log(`LLM directly provided ${response.data.relationships.length} relationships`);

          // Convert the direct relationships to CodeDependency objects
          const llmRelationships = response.data.relationships.map((rel: any) => ({
            source: rel.sourceSymbol,
            target: rel.targetSymbol,
            type: rel.type as 'import' | 'export' | 'call' | 'inheritance' | 'implementation',
          }));

          dependencies.push(...llmRelationships);
        }

        // Check if we got relationship patterns from the LLM response
        if (response.data.relationshipPatterns && response.data.relationshipPatterns.length > 0) {
          console.log(`Using ${response.data.relationshipPatterns.length} LLM-provided relationship patterns`);

          // Use the RelationshipMapper to detect relationships using the patterns
          const patternRelationships = await this.relationshipMapper.mapRelationships(
            symbols,
            response.data.relationshipPatterns,
            dependencies // Include any existing direct relationships
          );

          // If we got relationships from patterns, use those (they already include the direct relationships)
          if (patternRelationships.length > 0) {
            console.log(`Extracted ${patternRelationships.length} relationships using LLM patterns`);
            return patternRelationships;
          }
        }
      }

      // If we have relationships from the LLM but no patterns worked, return those
      if (dependencies.length > 0) {
        console.log(`Using ${dependencies.length} directly LLM-provided relationships`);
        return dependencies;
      }

      // Fallback: If LLM analysis failed or no relationships were found, use default patterns
      console.log(`No LLM patterns or direct relationships provided, using default relationship patterns`);
      const defaultPatterns = this.relationshipMapper.generateDefaultPatterns();

      const defaultRelationships = await this.relationshipMapper.mapRelationships(
        symbols,
        defaultPatterns
      );

      console.log(`Detected ${defaultRelationships.length} relationships using default patterns`);
      return defaultRelationships;
    } catch (error) {
      console.error(`Error analyzing relationships in file ${filePath}:`, error);

      // Last resort fallback: return an empty array to avoid breaking the indexing process
      return [];
    }
  }

  /**
   * Enhances a symbol with additional metadata
   */
  async enhanceSymbolMetadata(
    symbol: CodeSymbol,
    relationships: Array<{ type: string; targetSymbol: string }>
  ): Promise<Record<string, any>> {
    try {
      // Build the request for the LLM
      const request: EnhanceSymbolMetadataRequest = {
        action: AgentActionType.ENHANCE_SYMBOL_METADATA,
        data: {
          symbol: {
            id: `${symbol.name}:${symbol.location.filePath}:${symbol.location.startLine}`,
            name: symbol.name,
            type: symbol.type,
            content: symbol.content || '',
            location: {
              filePath: symbol.location.filePath,
              startLine: symbol.location.startLine,
              endLine: symbol.location.endLine,
            },
          },
          codebaseContext: {
            relationships,
          },
        },
      };

      // Send the request to the LLM
      const response = await this.makeAgentRequest<EnhanceSymbolMetadataRequest, EnhanceSymbolMetadataResponse>(
        request
      );

      if (!response.success) {
        throw new Error(`Failed to enhance symbol metadata: ${response.message}`);
      }

      return response.data.enhancedMetadata;
    } catch (error) {
      console.error(`Error enhancing metadata for symbol ${symbol.name}:`, error);
      throw error;
    }
  }

  /**
   * Processes a file using the indexing agent
   * This is a higher-level method that combines multiple agent actions
   */
  async processFile(filePath: string): Promise<{
    symbols: CodeSymbol[];
    dependencies: CodeDependency[];
  }> {
    try {
      // Read the file
      const content = await this.storagePrimitives.readFile(filePath);
      
      // Step 1: Analyze the file
      console.log(`Analyzing file: ${filePath}`);
      const fileAnalysis = await this.analyzeFile(filePath, content);
      
      // Step 2: Design the chunking strategy
      console.log(`Designing chunking strategy for: ${filePath}`);
      const chunkingStrategy = await this.designFileChunking(filePath, content, fileAnalysis);
      
      // Step 3: Implement the chunking strategy
      console.log(`Chunking file: ${filePath}`);
      let chunks: Array<{ content: string; startLine: number; endLine: number; type?: string }> = [];

      try {
        // First, check if we have a pattern definition from the LLM
        if (chunkingStrategy.patternDefinition) {
          // Log the pattern definition for diagnostics
          console.log(`Using LLM-defined pattern for ${filePath}:`);
          console.log(`Pattern type: ${chunkingStrategy.patternDefinition.type}`);
          console.log(`Pattern definition: ${JSON.stringify(chunkingStrategy.patternDefinition.definition, null, 2)}`);
          console.log(`Application rules: ${JSON.stringify(chunkingStrategy.patternDefinition.applicationRules, null, 2)}`);

          // Use the PatternInterpreter to execute the chunking pattern
          try {
            const patternResult = await this.patternInterpreter.executeChunkingPattern(
              filePath,
              content,
              chunkingStrategy.patternDefinition
            );

            console.log(`PatternInterpreter created ${patternResult.length} chunks for ${filePath}`);
            chunks = patternResult;
          } catch (patternError) {
            console.error(`Error executing pattern definition: ${patternError}. Falling back to legacy chunking.`);
            // Continue to legacy chunking approach if pattern execution fails
          }
        }

        // If no pattern definition or pattern execution failed, use the legacy approach
        if (chunks.length === 0) {
          console.log(`No valid pattern definition or pattern execution failed. Using legacy chunking for ${filePath}`);

          // Normalize chunking method by handling various possible formats
          const normalizedChunkingMethod = this.normalizeChunkingMethod(chunkingStrategy.chunkingMethod);
          console.log(`Normalized chunking method: ${normalizedChunkingMethod} (original: ${chunkingStrategy.chunkingMethod})`);

          // Find potential chunks from different property names the LLM might use
          const potentialChunks = this.findPotentialChunks(chunkingStrategy);

          switch (normalizedChunkingMethod) {
            case 'function-based':
              // Use the suggested chunks from the LLM with robust error handling
              console.log(`Using function-based chunking for ${filePath}`);

              if (!potentialChunks || !potentialChunks.length) {
                console.warn(`No function-based chunks found despite 'function-based' method being specified for ${filePath}, falling back to pattern detection`);
                // Fall back to pattern detection
                chunks = await this.storagePrimitives.chunkByPattern(filePath, [
                  { pattern: /function\s+\w+|\w+\s*=\s*function|\w+\s*:\s*function|\(\s*\)\s*=>\s*{/, type: 'function' }
                ]);
              } else {
                console.log(`Processing ${potentialChunks.length} function-based chunks`);
                chunks = potentialChunks.map(chunk => {
                  try {
                    // Extract chunk content from the file content with safety checks
                    const lines = content.split('\n');
                    // Ensure startLine and endLine are valid numbers and within bounds
                    const startLine = Math.max(1, Math.min(chunk.startLine || 1, lines.length));
                    const endLine = Math.max(startLine, Math.min(chunk.endLine || lines.length, lines.length));

                    const chunkContent = lines.slice(startLine - 1, endLine).join('\n');
                    return {
                      ...chunk,
                      startLine, // Use validated values
                      endLine,   // Use validated values
                      content: chunkContent,
                      type: chunk.type || 'function' // Ensure type is always set
                    };
                  } catch (error) {
                    console.error(`Error processing function chunk: ${error}`, chunk);
                    // Return a safe fallback chunk
                    return {
                      startLine: chunk.startLine || 1,
                      endLine: chunk.endLine || 2,
                      content: "// Error processing chunk",
                      type: 'error'
                    };
                  }
                });
              }
              break;

            case 'class-based':
            case 'class_based':
            case 'structure-based':
            case 'structure_based':
              // Use pattern-based chunking for classes with extended pattern support
              console.log(`Using class/structure-based chunking for ${filePath}`);

              if (potentialChunks && potentialChunks.length > 0) {
                console.log(`Using ${potentialChunks.length} LLM-provided class chunks`);
                chunks = potentialChunks.map(chunk => {
                  try {
                    const lines = content.split('\n');
                    const startLine = Math.max(1, Math.min(chunk.startLine || 1, lines.length));
                    const endLine = Math.max(startLine, Math.min(chunk.endLine || lines.length, lines.length));

                    const chunkContent = lines.slice(startLine - 1, endLine).join('\n');
                    return {
                      ...chunk,
                      startLine,
                      endLine,
                      content: chunkContent,
                      type: chunk.type || 'class'
                    };
                  } catch (error) {
                    console.error(`Error processing class chunk: ${error}`, chunk);
                    return {
                      startLine: chunk.startLine || 1,
                      endLine: chunk.endLine || 2,
                      content: "// Error processing chunk",
                      type: 'error'
                    };
                  }
                });
              } else {
                console.log(`No class chunks provided, using pattern detection for ${filePath}`);
                // Expanded pattern set to detect various class declarations across languages
                chunks = await this.storagePrimitives.chunkByPattern(filePath, [
                  { pattern: /class\s+\w+/, type: 'class' },
                  { pattern: /interface\s+\w+/, type: 'interface' },
                  { pattern: /struct\s+\w+/, type: 'struct' },
                  { pattern: /enum\s+\w+/, type: 'enum' },
                  { pattern: /type\s+\w+\s*=/, type: 'type' }
                ]);
              }
              break;

            case 'fixed-size':
            case 'fixed_size':
            case 'line-based':
            case 'line_based':
              // Use line-based chunking with robust property access
              console.log(`Using fixed-size/line-based chunking for ${filePath}`);

              // Safely access chunkSizeGuidelines with optional chaining
              const chunkSizeGuidelines = chunkingStrategy.chunkSizeGuidelines || {};
              const linesPerChunk = this.getSafeLinesPerChunk(chunkSizeGuidelines);

              // Safely access overlapStrategy properties with robust null checking
              const overlapStrategy = chunkingStrategy.overlapStrategy || {};
              const overlap = this.getSafeOverlap(overlapStrategy);

              console.log(`Using line-based chunking with ${linesPerChunk} lines per chunk and ${overlap} lines overlap`);
              chunks = await this.storagePrimitives.chunkByLineCount(filePath, linesPerChunk, overlap);
              break;

            case 'section-based':
            case 'section_based':
            case 'comment-based':
            case 'comment_based':
              // Section-based chunking looks for comment headers or natural divisions
              console.log(`Using section/comment-based chunking for ${filePath}`);

              if (potentialChunks && potentialChunks.length > 0) {
                console.log(`Using ${potentialChunks.length} LLM-provided section chunks`);
                chunks = potentialChunks.map(chunk => {
                  try {
                    const lines = content.split('\n');
                    const startLine = Math.max(1, Math.min(chunk.startLine || 1, lines.length));
                    const endLine = Math.max(startLine, Math.min(chunk.endLine || lines.length, lines.length));

                    const chunkContent = lines.slice(startLine - 1, endLine).join('\n');
                    return {
                      ...chunk,
                      startLine,
                      endLine,
                      content: chunkContent,
                      type: chunk.type || 'section'
                    };
                  } catch (error) {
                    console.error(`Error processing section chunk: ${error}`, chunk);
                    return {
                      startLine: chunk.startLine || 1,
                      endLine: chunk.endLine || 2,
                      content: "// Error processing chunk",
                      type: 'error'
                    };
                  }
                });
              } else {
                console.log(`No section chunks provided, using pattern detection for ${filePath}`);
                // Use patterns to detect section comments
                chunks = await this.storagePrimitives.chunkByPattern(filePath, [
                  { pattern: /\/\/\s*-{3,}|\/\/\s*={3,}|\/\*{1,2}\s*[-=]{3,}|\/\*\*\s*\n|\*\s@section|\#{3,}\s+\w+/, type: 'section' },
                  { pattern: /\/\/\s*MARK:|\*\s@group|\/\/\s*SECTION:/, type: 'section' }
                ]);

                // If no sections found, fall back to line-based
                if (chunks.length === 0) {
                  console.log(`No sections detected, falling back to line-based chunking for ${filePath}`);
                  chunks = await this.storagePrimitives.chunkByLineCount(filePath, 100);
                }
              }
              break;

            default:
              // Handle any other chunking method with robust fallbacks
              console.log(`Using fallback chunking for method '${normalizedChunkingMethod}' in ${filePath}`);

              // First try to use any provided chunks regardless of the method name
              if (potentialChunks && potentialChunks.length > 0) {
                console.log(`Using ${potentialChunks.length} chunks from unknown method '${normalizedChunkingMethod}'`);

                chunks = potentialChunks.map(chunk => {
                  try {
                    const lines = content.split('\n');
                    const startLine = Math.max(1, Math.min(chunk.startLine || 1, lines.length));
                    const endLine = Math.max(startLine, Math.min(chunk.endLine || lines.length, lines.length));

                    const chunkContent = lines.slice(startLine - 1, endLine).join('\n');
                    return {
                      ...chunk,
                      startLine,
                      endLine,
                      content: chunkContent,
                      type: chunk.type || 'unknown'
                    };
                  } catch (error) {
                    console.error(`Error processing unknown chunk: ${error}`, chunk);
                    return {
                      startLine: chunk.startLine || 1,
                      endLine: chunk.endLine || 2,
                      content: "// Error processing chunk",
                      type: 'error'
                    };
                  }
                });
              } else {
                // If no chunks provided, try to intelligently select a chunking strategy based on file type
                console.log(`No valid chunks provided, selecting appropriate strategy for ${filePath}`);
                const extension = path.extname(filePath).toLowerCase();

                if (['.js', '.ts', '.jsx', '.tsx', '.java', '.cs', '.py', '.rb'].includes(extension)) {
                  console.log(`Using language-specific pattern chunking for ${extension} file`);
                  chunks = await this.storagePrimitives.chunkByPattern(filePath, [
                    { pattern: /class\s+\w+/, type: 'class' },
                    { pattern: /function\s+\w+|\w+\s*=\s*function|\w+\s*:\s*function|\(\s*\)\s*=>\s*{/, type: 'function' },
                    { pattern: /interface\s+\w+/, type: 'interface' },
                    { pattern: /type\s+\w+\s*=/, type: 'type' }
                  ]);

                  // If no patterns matched, fall back to line-based
                  if (chunks.length === 0) {
                    console.log(`No patterns matched, falling back to line-based chunking for ${filePath}`);
                    chunks = await this.storagePrimitives.chunkByLineCount(filePath, 100);
                  }
                } else {
                  // Default fallback for unrecognized file types
                  console.log(`Using default line-based chunking for ${filePath} (unrecognized type)`);
                  chunks = await this.storagePrimitives.chunkByLineCount(filePath, 100);
                }
              }
          }
        }

        // Validate all chunks as a final safety measure
        chunks = this.validateChunks(chunks, content);
        console.log(`Final chunk count: ${chunks.length} for ${filePath}`);

      } catch (error) {
        // Robust error handling with fallback to line-based chunking
        console.error(`Error during chunking strategy implementation for ${filePath}: ${error}. Falling back to line-based chunking.`);
        chunks = await this.storagePrimitives.chunkByLineCount(filePath, 100);
        console.log(`Fallback chunking created ${chunks.length} chunks for ${filePath}`);
      }
      
      // Step 4: Extract symbols from chunks
      console.log(`Extracting symbols from: ${filePath}`);
      let symbols: CodeSymbol[] = [];

      // Determine if we should use our enhanced extraction or simple extraction
      const shouldUseEnhancedExtraction =
        fileAnalysis.complexity > 3 || // More complex files
        chunks.length > 5 ||           // Many chunks
        path.extname(filePath) === '.tsx' || // React files tend to be complex
        path.extname(filePath) === '.jsx' ||
        fileAnalysis.estimatedSymbolCount > 10; // Many expected symbols

      if (shouldUseEnhancedExtraction) {
        console.log(`Using enhanced symbol extraction for ${filePath} (complexity: ${fileAnalysis.complexity})`);
        symbols = await this.extractSymbols(filePath, content, chunks);
      } else {
        console.log(`Using simple symbol extraction for ${filePath} (complexity: ${fileAnalysis.complexity})`);
        // For simple files, use our default patterns directly
        const extension = path.extname(filePath);
        const defaultPatterns = this.symbolExtractor.generateDefaultPatterns(extension);

        for (const chunk of chunks) {
          // Try our pattern-based extraction first
          let patternsExtracted = false;
          for (const pattern of defaultPatterns) {
            try {
              const extractedSymbols = await this.symbolExtractor.extractSymbols(filePath, chunk, pattern);
              if (extractedSymbols.length > 0) {
                symbols.push(...extractedSymbols);
                patternsExtracted = true;
              }
            } catch (error) {
              console.error(`Error in pattern extraction: ${error}`);
            }
          }

          // If pattern extraction didn't work, fall back to simple extraction
          if (!patternsExtracted) {
            const chunkSymbols = this.storagePrimitives.extractSymbolsFromChunk(filePath, chunk);
            symbols.push(...chunkSymbols);
          }
        }
      }

      console.log(`Extracted ${symbols.length} symbols from ${filePath}`);

      // Step 5: Extract dependencies
      console.log(`Extracting dependencies from: ${filePath}`);
      let dependencies: CodeDependency[] = [];

      // First use any dependency extraction methods from the chunks
      for (const chunk of chunks) {
        const chunkDependencies = this.storagePrimitives.extractDependenciesFromChunk(filePath, chunk);
        dependencies.push(...chunkDependencies);
      }

      // If we have symbols, we can also try to infer dependencies between them
      if (symbols.length > 1) {
        try {
          // Look for symbol usage within other symbols
          for (const symbol of symbols) {
            const symbolContent = symbol.content || "";

            // Check if other symbols are used within this symbol
            for (const otherSymbol of symbols) {
              if (symbol.name !== otherSymbol.name &&
                  symbolContent.includes(otherSymbol.name)) {

                dependencies.push({
                  source: symbol.name,
                  target: otherSymbol.name,
                  type: 'call' // Default to 'call' as the most common dependency type
                });
              }
            }
          }
        } catch (error) {
          console.error(`Error inferring dependencies: ${error}`);
        }
      }
      
      // Step 6: Analyze relationships between symbols
      if (symbols.length > 0) {
        console.log(`Analyzing relationships in: ${filePath}`);

        // For large files with many symbols, we may want to batch the analysis to avoid context issues
        if (symbols.length > 15) {
          console.log(`Large number of symbols (${symbols.length}), using batched relationship analysis`);

          // Break the symbols into batches for analysis
          const BATCH_SIZE = 10;
          const allRelationships: CodeDependency[] = [];

          // Process symbols in batches with overlap to catch cross-batch relationships
          for (let i = 0; i < symbols.length; i += BATCH_SIZE) {
            const endIdx = Math.min(i + BATCH_SIZE + 5, symbols.length); // Add 5 symbol overlap
            const batchSymbols = symbols.slice(i, endIdx);

            console.log(`Processing relationship batch ${i/BATCH_SIZE + 1} with ${batchSymbols.length} symbols`);

            // Map symbols to a format that conforms to the expected interface
            // while still preserving essential information
            const symbolReferenceList = symbols.map(s => {
              // Create an object with the required properties that matches the interface
              return {
                id: s.name || `unnamed_symbol_${Math.random().toString(36).substring(2, 9)}`,
                name: s.name || `unnamed_symbol_${Math.random().toString(36).substring(2, 9)}`,
                type: s.type || 'unknown',
                filePath: s.location?.filePath || filePath
              };
            });

            const batchRelationships = await this.analyzeRelationships(
              filePath,
              content,
              batchSymbols,
              symbolReferenceList
            );

            allRelationships.push(...batchRelationships);
          }

          // Deduplicate the relationships
          const relationshipSet = new Set<string>();
          const uniqueRelationships = allRelationships.filter(rel => {
            const key = `${rel.source}:${rel.target}:${rel.type}`;
            if (relationshipSet.has(key)) {
              return false;
            }
            relationshipSet.add(key);
            return true;
          });

          console.log(`Found ${uniqueRelationships.length} relationships after deduplication`);
          dependencies.push(...uniqueRelationships);
        } else {
          // For smaller files, analyze relationships all at once
          const relationshipDependencies = await this.analyzeRelationships(filePath, content, symbols);
          console.log(`Found ${relationshipDependencies.length} relationships in ${filePath}`);
          dependencies.push(...relationshipDependencies);
        }
      }
      
      // Store results
      this.storagePrimitives.storeSymbols(symbols);
      this.storagePrimitives.storeDependencies(dependencies);
      
      return {
        symbols,
        dependencies
      };
    } catch (error) {
      console.error(`Error processing file ${filePath}:`, error);
      throw error;
    }
  }

  /**
   * Makes a request to the LLM agent and parses the response
   * Handles truncated responses by requesting continuations or using a multi-step approach
   */
  private async makeAgentRequest<Req extends AgentRequest, Res extends AgentResponse>(
    request: Req
  ): Promise<Res> {
    // Get memory monitor
    const memoryMonitor = getMemoryMonitor();
    const requestType = request.action.toString();

    try {
      // Log memory usage at the start of the request
      memoryMonitor.logMemoryUsage(`${requestType}_start`, {
        requestType,
        dataSize: this.estimateRequestSize(request)
      });

      // Check if this is a large request that might result in truncation
      const isLargeRequest = this.isLikelyLargeRequest(request);

      if (isLargeRequest) {
        console.log("Detected potentially large request, using multi-step approach...");
        memoryMonitor.logMemoryUsage(`${requestType}_large_request_detected`);
        const result = await this.makeMultiStepRequest<Req, Res>(request);

        // Log memory after multi-step approach
        memoryMonitor.logMemoryUsage(`${requestType}_multi_step_complete`);

        // Try to free memory
        this.cleanupRequest(request);
        memoryMonitor.forceGC();

        return result;
      }

      // Standard approach for normal-sized requests
      // Convert the request to a prompt for the LLM
      const prompt = this.createAgentPrompt(request);
      memoryMonitor.logMemoryUsage(`${requestType}_prompt_created`);

      // Get the agent's response
      const llmResponse = await this.llmService.complete({
        prompt,
        systemPrompt: this.getSystemPrompt(request.action),
        options: {
          temperature: 0.2, // Low temperature for more deterministic responses
          maxTokens: 8000, // Increased for larger responses
        }
      });

      // Log memory after LLM response
      memoryMonitor.logMemoryUsage(`${requestType}_llm_response_received`, {
        responseSize: llmResponse.text.length
      });

      // Extract JSON from the response
      let jsonResponse = this.extractJsonFromResponse(llmResponse.text);

      // Free memory by clearing the full text response
      if (llmResponse.text.length > 10000) {
        llmResponse.text = '';
      }

      // Check if the response is potentially truncated by looking for signs of incompleteness
      if (this.isJsonTruncated(jsonResponse)) {
        console.log("Detected truncated JSON response, requesting continuation...");
        memoryMonitor.logMemoryUsage(`${requestType}_truncated_response_detected`);
        const result = await this.handleTruncatedResponse<Req, Res>(request, jsonResponse);

        // Log memory after handling truncated response
        memoryMonitor.logMemoryUsage(`${requestType}_truncated_response_handled`);
        return result;
      }

      // Parse the final response
      try {
        const result = parseAgentResponse<Res>(jsonResponse);

        // Log memory after successful response parsing
        memoryMonitor.logMemoryUsage(`${requestType}_response_parsed_success`);

        // Cleanup to free memory
        this.cleanupRequest(request);
        if (jsonResponse.length > 10000) {
          jsonResponse = '';
        }

        return result;
      } catch (parseError) {
        console.error("Error parsing JSON response:", parseError);
        console.error("JSON content was:", jsonResponse.substring(0, 500) + (jsonResponse.length > 500 ? "..." : ""));

        memoryMonitor.logMemoryUsage(`${requestType}_parse_error`, { errorType: 'parseError' });

        // Attempt to repair the JSON before giving up
        try {
          const repairedJson = this.repairJsonResponse(jsonResponse, request.action);
          const result = parseAgentResponse<Res>(repairedJson);

          memoryMonitor.logMemoryUsage(`${requestType}_repair_success`);

          // Cleanup to free memory
          this.cleanupRequest(request);
          jsonResponse = '';

          return result;
        } catch (repairError) {
          console.error("Failed to repair JSON:", repairError);
          memoryMonitor.logMemoryUsage(`${requestType}_repair_failed`, { errorType: 'repairError' });

          // Create a fallback response with the original action
          const fallbackResponse = {
            action: request.action,
            success: false,
            message: `Failed to parse response: ${parseError}`,
            data: {},
          } as unknown as Res;

          // Cleanup to free memory
          this.cleanupRequest(request);
          jsonResponse = '';

          return fallbackResponse;
        }
      }
    } catch (error) {
      console.error('Error making agent request:', error);
      memoryMonitor.logMemoryUsage(`${requestType}_request_error`, {
        errorType: error instanceof Error ? error.constructor.name : 'Unknown',
        message: error instanceof Error ? error.message : String(error)
      });

      // Create a generic error response
      const errorResponse = {
        action: request.action,
        success: false,
        message: error instanceof Error ? error.message : String(error),
      } as unknown as Res;

      // Try to clean up memory even on error
      try {
        this.cleanupRequest(request);
      } catch (cleanupError) {
        console.error('Error during cleanup after error:', cleanupError);
      }

      return errorResponse;
    }

    // Log memory at the end of processing
    finally {
      memoryMonitor.logMemoryUsage(`${requestType}_request_complete`);

      // If the snapshot list is getting too large, clear it to prevent memory bloat
      if (memoryMonitor.getSnapshots().length > 1000) {
        memoryMonitor.clearSnapshots();
      }
    }
  }

  /**
   * Handles a truncated response by requesting continuations and merging them
   */
  private async handleTruncatedResponse<Req extends AgentRequest, Res extends AgentResponse>(
    request: Req,
    initialResponse: string
  ): Promise<Res> {
    // Try to get continuation up to 5 times (increased from 3)
    let fullResponse = initialResponse;
    let continuationCount = 0;
    const MAX_CONTINUATIONS = 5;

    while (this.isJsonTruncated(fullResponse) && continuationCount < MAX_CONTINUATIONS) {
      continuationCount++;
      console.log(`Requesting continuation #${continuationCount}...`);

      // Create a continuation prompt
      const continuationPrompt = this.createContinuationPrompt(request, fullResponse);

      // Request continuation
      const continuationResponse = await this.llmService.complete({
        prompt: continuationPrompt,
        systemPrompt: this.getContinuationSystemPrompt(),
        options: {
          temperature: 0.1, // Even lower temperature for consistency
          maxTokens: 8000, // Increased from 4000
        },
      });

      // Extract the continuation JSON and attempt to merge
      const continuationJson = this.extractJsonFromResponse(continuationResponse.text);
      fullResponse = this.mergeJsonResponses(fullResponse, continuationJson);

      console.log(`Merged response length: ${fullResponse.length} characters`);

      // If we now have valid JSON, break the loop
      if (!this.isJsonTruncated(fullResponse)) {
        console.log("Successfully completed the JSON response after continuation");
        break;
      }
    }

    // If we still have a truncated response after max continuations,
    // try to fix it with more aggressive JSON repair methods
    if (this.isJsonTruncated(fullResponse)) {
      console.log("Still have truncated JSON after continuations, attempting advanced repair...");
      try {
        // First try our enhanced parsing
        return parseAgentResponse<Res>(fullResponse);
      } catch (parseError) {
        console.error("Failed to parse with enhanced parsing:", parseError);

        // Then try an even more aggressive repair approach
        try {
          const repairedJson = this.aggressiveJsonRepair(fullResponse, request.action);
          return parseAgentResponse<Res>(repairedJson);
        } catch (repairError) {
          console.error("Failed with aggressive repair:", repairError);
          throw new Error(`Failed to complete JSON response after ${MAX_CONTINUATIONS} continuations and repairs`);
        }
      }
    }

    // Parse the completed response
    try {
      return parseAgentResponse<Res>(fullResponse);
    } catch (parseError) {
      console.error("Error parsing final merged response:", parseError);
      throw parseError;
    }
  }

  /**
   * Makes a multi-step request for potentially large responses
   * Breaks the request into smaller pieces that are less likely to be truncated
   */
  private async makeMultiStepRequest<Req extends AgentRequest, Res extends AgentResponse>(
    request: Req
  ): Promise<Res> {
    // This approach depends on the specific action type
    switch (request.action) {
      case AgentActionType.EXTRACT_SYMBOLS:
        return await this.extractSymbolsMultiStep(request as unknown as ExtractSymbolsRequest) as unknown as Res;

      case AgentActionType.ANALYZE_RELATIONSHIPS:
        return await this.analyzeRelationshipsMultiStep(request as unknown as AnalyzeRelationshipsRequest) as unknown as Res;

      case AgentActionType.DESIGN_FILE_CHUNKING:
        // For chunking, if content is very large, we can break it into sections
        const chunkingRequest = request as unknown as DesignFileChunkingRequest;
        if (chunkingRequest.data.content.length > 50000) {
          return await this.designChunkingForLargeFile(chunkingRequest) as unknown as Res;
        }
        break;

      default:
        // For other requests, just try the standard approach
        break;
    }

    // If no special handling, fall back to standard approach but with higher token limit
    const prompt = this.createAgentPrompt(request);
    const llmResponse = await this.llmService.complete({
      prompt,
      systemPrompt: this.getSystemPrompt(request.action),
      options: {
        temperature: 0.2,
        maxTokens: 16000, // Use maximum available tokens
      }
    });

    const jsonResponse = this.extractJsonFromResponse(llmResponse.text);

    // If still truncated, fall back to the continuation approach
    if (this.isJsonTruncated(jsonResponse)) {
      return await this.handleTruncatedResponse<Req, Res>(request, jsonResponse);
    }

    return parseAgentResponse<Res>(jsonResponse);
  }

  /**
   * Creates an even more aggressive repair for JSON
   */
  private aggressiveJsonRepair(json: string, action: AgentActionType): string {
    console.log("Performing aggressive JSON repair");
    let repairedJson = json;

    // First, make sure we have a valid JSON structure
    if (!repairedJson.startsWith('{')) {
      repairedJson = '{' + repairedJson;
    }

    // Count braces to find imbalance
    const openBraces = (repairedJson.match(/\{/g) || []).length;
    const closeBraces = (repairedJson.match(/\}/g) || []).length;

    // Add missing closing braces
    if (openBraces > closeBraces) {
      repairedJson += '}'.repeat(openBraces - closeBraces);
    }

    // Check if we need minimum required properties
    if (!repairedJson.includes('"action"')) {
      // Insert the action field near the beginning
      repairedJson = repairedJson.replace('{', `{\n  "action": "${action}",`);
    }

    if (!repairedJson.includes('"success"')) {
      // Insert success field after action
      const actionRegex = /"action"\s*:\s*"[^"]+"\s*,?/;
      const match = repairedJson.match(actionRegex);
      if (match) {
        const insertPos = match.index! + match[0].length;
        const needsComma = !match[0].endsWith(',');
        repairedJson =
          repairedJson.slice(0, insertPos) +
          (needsComma ? ',' : '') +
          '\n  "success": true' +
          repairedJson.slice(insertPos);
      } else {
        // If we can't find action, just insert after first brace
        repairedJson = repairedJson.replace('{', `{\n  "success": true,`);
      }
    }

    if (!repairedJson.includes('"data"')) {
      // Insert empty data object before the end
      repairedJson = repairedJson.replace(/\}\s*$/, ',\n  "data": {}\n}');
    }

    // Try to parse to see if we've fixed it
    try {
      JSON.parse(repairedJson);
      console.log("Aggressive repair successful");
      return repairedJson;
    } catch (error) {
      console.error("Aggressive repair failed:", error);

      // Last resort: create a minimal valid response
      const minimalResponse = {
        action: action,
        success: false,
        message: "Failed to parse or repair JSON response",
        data: {}
      };

      return JSON.stringify(minimalResponse, null, 2);
    }
  }

  /**
   * A more targeted approach to repairing JSON responses
   */
  private repairJsonResponse(json: string, action: AgentActionType): string {
    // Try to extract and repair specific parts of the JSON
    const actionMatch = json.match(/"action"\s*:\s*"([^"]+)"/);
    const successMatch = json.match(/"success"\s*:\s*(true|false)/);
    const messageMatch = json.match(/"message"\s*:\s*"([^"]*)"/);

    // Try to extract the data object, which is the most complex part
    const dataStartMatch = json.match(/"data"\s*:\s*\{/);

    if (!actionMatch) {
      // If we don't have an action field, this is severely broken
      // Create a minimal valid JSON
      return JSON.stringify({
        action: action,
        success: false,
        message: "Repaired severely broken JSON response",
        data: {}
      }, null, 2);
    }

    // Try to reconstruct a valid JSON
    const repairedJson = {
      action: actionMatch[1],
      success: successMatch ? successMatch[1] === 'true' : false,
      message: messageMatch ? messageMatch[1] : "Repaired JSON response",
      data: {}
    };

    // If we can find the data section, try to extract it
    if (dataStartMatch) {
      const dataStartIndex = dataStartMatch.index! + dataStartMatch[0].length - 1; // Start of the {

      // Find the matching closing brace
      let openBraces = 1;
      let closingIndex = -1;

      for (let i = dataStartIndex + 1; i < json.length; i++) {
        if (json[i] === '{') openBraces++;
        else if (json[i] === '}') openBraces--;

        if (openBraces === 0) {
          closingIndex = i;
          break;
        }
      }

      if (closingIndex > 0) {
        const dataSection = json.substring(dataStartIndex, closingIndex + 1);
        try {
          const dataParsed = JSON.parse(dataSection);
          repairedJson.data = dataParsed;
        } catch (e) {
          console.error("Couldn't parse data section:", e);
        }
      }
    }

    return JSON.stringify(repairedJson, null, 2);
  }

  /**
   * Estimate the size of a request in bytes to track memory usage
   */
  private estimateRequestSize(request: AgentRequest): number {
    try {
      let totalSize = 0;

      // Add action type size
      totalSize += (request.action.toString().length * 2); // Unicode chars are 2 bytes

      // Add context size if present
      if (request.context) {
        totalSize += request.context.length * 2;
      }

      // Handle different request types
      switch (request.action) {
        case AgentActionType.EXTRACT_SYMBOLS:
          const extractRequest = request as ExtractSymbolsRequest;
          totalSize += extractRequest.data.content.length * 2;

          // Estimate chunks size
          if (extractRequest.data.chunks) {
            for (const chunk of extractRequest.data.chunks) {
              totalSize += (chunk.content?.length || 0) * 2;
            }
          }
          break;

        case AgentActionType.ANALYZE_RELATIONSHIPS:
          const relRequest = request as AnalyzeRelationshipsRequest;
          totalSize += (relRequest.data.content?.length || 0) * 2;

          // Estimate symbols size
          if (relRequest.data.symbols) {
            totalSize += JSON.stringify(relRequest.data.symbols).length * 2;
          }

          // Estimate other symbols size
          if (relRequest.data.otherSymbols) {
            totalSize += JSON.stringify(relRequest.data.otherSymbols).length * 2;
          }
          break;

        case AgentActionType.DESIGN_FILE_CHUNKING:
          const chunkRequest = request as DesignFileChunkingRequest;
          totalSize += chunkRequest.data.content.length * 2;
          totalSize += JSON.stringify(chunkRequest.data.fileAnalysis).length * 2;
          break;

        default:
          // For other request types, just stringify the data
          totalSize += JSON.stringify(request.data || {}).length * 2;
      }

      return totalSize;
    } catch (error) {
      console.error("Error estimating request size:", error);
      return 0;
    }
  }

  /**
   * Clean up request data to free memory
   */
  private cleanupRequest(request: AgentRequest): void {
    try {
      // For request types with large content
      switch (request.action) {
        case AgentActionType.EXTRACT_SYMBOLS:
          const extractRequest = request as ExtractSymbolsRequest;
          // Clear content after use
          if (extractRequest.data.content && extractRequest.data.content.length > 10000) {
            extractRequest.data.content = '';
          }

          // Clear chunk content
          if (extractRequest.data.chunks) {
            for (const chunk of extractRequest.data.chunks) {
              if (chunk.content && chunk.content.length > 5000) {
                chunk.content = '';
              }
            }
          }
          break;

        case AgentActionType.ANALYZE_RELATIONSHIPS:
          const relRequest = request as AnalyzeRelationshipsRequest;
          // Clear content after use
          if (relRequest.data.content && relRequest.data.content.length > 10000) {
            relRequest.data.content = '';
          }
          break;

        case AgentActionType.DESIGN_FILE_CHUNKING:
          const chunkRequest = request as DesignFileChunkingRequest;
          // Clear content after use
          if (chunkRequest.data.content && chunkRequest.data.content.length > 10000) {
            chunkRequest.data.content = '';
          }
          break;
      }

      // Clear context if present and large
      if (request.context && request.context.length > 10000) {
        request.context = '';
      }
    } catch (error) {
      console.error("Error cleaning up request:", error);
    }
  }

  private isLikelyLargeRequest(request: AgentRequest): boolean {
    // Check specific large request types
    switch (request.action) {
      case AgentActionType.EXTRACT_SYMBOLS:
        // Large files or many chunks are likely to produce large responses
        const symbolsRequest = request as unknown as ExtractSymbolsRequest;
        return symbolsRequest.data.content.length > 30000 ||
               symbolsRequest.data.chunks.length > 20;

      case AgentActionType.ANALYZE_RELATIONSHIPS:
        // Many symbols are likely to produce large responses
        const relRequest = request as unknown as AnalyzeRelationshipsRequest;
        return relRequest.data.symbols.length > 15;

      case AgentActionType.DESIGN_FILE_CHUNKING:
        // Very large files are likely to produce large responses
        const chunkRequest = request as unknown as DesignFileChunkingRequest;
        return chunkRequest.data.content.length > 50000;

      default:
        return false;
    }
  }

  /**
   * Processes symbol extraction for large files by breaking it into smaller batches
   */
  private async extractSymbolsMultiStep(request: ExtractSymbolsRequest): Promise<ExtractSymbolsResponse> {
    const chunks = request.data.chunks;
    console.log(`Breaking symbol extraction into batches for ${chunks.length} chunks`);

    // Process chunks in batches
    const BATCH_SIZE = 10;
    const allSymbols: any[] = [];

    for (let i = 0; i < chunks.length; i += BATCH_SIZE) {
      const batchChunks = chunks.slice(i, i + BATCH_SIZE);
      console.log(`Processing batch ${i/BATCH_SIZE + 1} with ${batchChunks.length} chunks`);

      // Create a batch request
      const batchRequest: ExtractSymbolsRequest = {
        action: AgentActionType.EXTRACT_SYMBOLS,
        data: {
          filePath: request.data.filePath,
          content: request.data.content,
          chunks: batchChunks
        }
      };

      // Process this batch
      const batchResponse = await this.makeAgentRequest<ExtractSymbolsRequest, ExtractSymbolsResponse>(
        batchRequest
      );

      if (batchResponse.success && batchResponse.data.symbols) {
        allSymbols.push(...batchResponse.data.symbols);
      } else {
        console.error(`Failed to extract symbols for batch ${i/BATCH_SIZE + 1}:`, batchResponse.message);
      }
    }

    // Combine all results
    return {
      action: AgentActionType.EXTRACT_SYMBOLS,
      success: true,
      data: {
        symbols: allSymbols
      }
    };
  }

  /**
   * Analyzes relationships in batches for files with many symbols
   */
  private async analyzeRelationshipsMultiStep(request: AnalyzeRelationshipsRequest): Promise<AnalyzeRelationshipsResponse> {
    const symbols = request.data.symbols;
    console.log(`Breaking relationship analysis into batches for ${symbols.length} symbols`);

    // Process symbols in batches
    const BATCH_SIZE = 10;
    const allRelationships: any[] = [];

    for (let i = 0; i < symbols.length; i += BATCH_SIZE) {
      const batchSymbols = symbols.slice(i, i + BATCH_SIZE);
      console.log(`Processing batch ${i/BATCH_SIZE + 1} with ${batchSymbols.length} symbols`);

      // Create a batch request
      const batchRequest: AnalyzeRelationshipsRequest = {
        action: AgentActionType.ANALYZE_RELATIONSHIPS,
        data: {
          filePath: request.data.filePath,
          content: request.data.content,
          symbols: batchSymbols,
          otherSymbols: request.data.otherSymbols
        }
      };

      // Process this batch
      const batchResponse = await this.makeAgentRequest<AnalyzeRelationshipsRequest, AnalyzeRelationshipsResponse>(
        batchRequest
      );

      if (batchResponse.success && batchResponse.data.relationships) {
        allRelationships.push(...batchResponse.data.relationships);
      } else {
        console.error(`Failed to analyze relationships for batch ${i/BATCH_SIZE + 1}:`, batchResponse.message);
      }
    }

    // Combine all results
    return {
      action: AgentActionType.ANALYZE_RELATIONSHIPS,
      success: true,
      data: {
        relationships: allRelationships
      }
    };
  }

  /**
   * Designs chunking strategy for very large files by analyzing sections
   */
  private async designChunkingForLargeFile(request: DesignFileChunkingRequest): Promise<DesignFileChunkingResponse> {
    console.log(`File is very large (${request.data.content.length} chars), analyzing in sections`);

    // First, try analyzing just the structure by using sample sections
    const content = request.data.content;
    const lines = content.split('\n');

    // Take samples from beginning, middle, and end
    const beginSample = lines.slice(0, Math.min(200, lines.length / 3)).join('\n');
    const middleSample = lines.slice(Math.floor(lines.length / 3), Math.floor(lines.length / 3) + Math.min(200, lines.length / 3)).join('\n');
    const endSample = lines.slice(Math.max(0, lines.length - 200)).join('\n');

    // Create a request with just the samples
    const sampleRequest: DesignFileChunkingRequest = {
      action: AgentActionType.DESIGN_FILE_CHUNKING,
      data: {
        filePath: request.data.filePath,
        // Include metadata about the sampling
        content: `// SAMPLING: This is a sampling of a large file
// First ${Math.min(200, lines.length / 3)} lines:
${beginSample}

// Middle ${Math.min(200, lines.length / 3)} lines:
${middleSample}

// Last ${Math.min(200, lines.length / 3)} lines:
${endSample}

// TOTAL LINES: ${lines.length}
// FILE TYPE: ${path.extname(request.data.filePath)}`,
        fileAnalysis: request.data.fileAnalysis
      }
    };

    // Get chunking strategy based on samples
    const strategyResponse = await this.makeAgentRequest<DesignFileChunkingRequest, DesignFileChunkingResponse>(
      sampleRequest
    );

    if (!strategyResponse.success) {
      console.error("Failed to design chunking strategy from samples:", strategyResponse.message);

      // Fall back to a default chunking approach
      return {
        action: AgentActionType.DESIGN_FILE_CHUNKING,
        success: true,
        data: {
          chunkingMethod: "line-based",
          reason: "Fallback for large file",
          chunkSizeGuidelines: {
            maxLines: 100
          },
          overlapStrategy: {
            enabled: true,
            amount: 10
          }
        }
      };
    }

    return strategyResponse;
  }

  /**
   * Checks if a JSON string appears to be truncated or incomplete
   */
  private isJsonTruncated(jsonString: string): boolean {
    try {
      // Try to parse the JSON - if it parses successfully, it's not truncated
      JSON.parse(jsonString);
      return false;
    } catch (error) {
      console.log("JSON parsing failed, likely truncated:", error);

      // Check for common signs of truncation
      const braceCount = (jsonString.match(/{/g) || []).length - (jsonString.match(/}/g) || []).length;
      const bracketCount = (jsonString.match(/\[/g) || []).length - (jsonString.match(/\]/g) || []).length;

      // If we have more opening braces/brackets than closing ones, it's likely truncated
      return braceCount > 0 || bracketCount > 0;
    }
  }

  /**
   * Creates a prompt for continuing a truncated response
   */
  private createContinuationPrompt(request: AgentRequest, truncatedResponse: string): string {
    // Find the last complete structure (object or array) in the truncated response
    const lastCompleteObject = this.findLastCompleteStructure(truncatedResponse);

    // Identify potential truncation patterns to help the model continue properly
    let truncationContext = "";

    // Check for truncated objects
    const lastOpenBrace = truncatedResponse.lastIndexOf('{');
    const lastCloseBrace = truncatedResponse.lastIndexOf('}');
    if (lastOpenBrace > lastCloseBrace) {
      const objectStart = truncatedResponse.substring(lastOpenBrace);
      truncationContext += `\nYou were in the middle of an object that started with: \`${objectStart}\`\n`;
    }

    // Check for truncated arrays
    const lastOpenBracket = truncatedResponse.lastIndexOf('[');
    const lastCloseBracket = truncatedResponse.lastIndexOf(']');
    if (lastOpenBracket > lastCloseBracket) {
      const arrayStart = truncatedResponse.substring(lastOpenBracket);
      truncationContext += `\nYou were in the middle of an array that started with: \`${arrayStart}\`\n`;
    }

    // Check for truncated strings
    const quoteCount = (truncatedResponse.match(/"/g) || []).length;
    if (quoteCount % 2 !== 0) {
      // Find the last unmatched quote
      const lastQuote = truncatedResponse.lastIndexOf('"');
      if (lastQuote >= 0) {
        const stringStart = truncatedResponse.substring(lastQuote);
        truncationContext += `\nYou were in the middle of a string that started with: \`${stringStart}\`\n`;
      }
    }

    // Check for property names without values
    const propertyMatch = truncatedResponse.match(/"([^"]+)"\s*:\s*$/);
    if (propertyMatch) {
      truncationContext += `\nYou were in the middle of setting a value for property: \`"${propertyMatch[1]}"\`\n`;
    }

    // Additional analysis of the truncation point
    const lastFewLines = truncatedResponse.split('\n').slice(-3).join('\n');

    // Include original request context to maintain continuity
    const originalContext = JSON.stringify(request.data, null, 2);

    return `
# Continuation Request for ${request.action}

Your previous response was truncated. You need to continue your expert codebase analysis exactly where you left off.

## Original Request Data For Context:
\`\`\`json
${originalContext}
\`\`\`

## Last part of your truncated response:
\`\`\`
${lastFewLines}
\`\`\`

## Truncation Analysis:${truncationContext}

## Full Context for Reference:
\`\`\`
${lastCompleteObject}
\`\`\`

## Instructions
1. Continue EXACTLY where the response was cut off - do not repeat any information
2. Your response should start with the exact next character needed to continue the truncated JSON
3. Do not add any introduction, explanation, or markdown formatting to your output
4. Just provide the raw continuation of the JSON
5. Ensure all opened JSON structures (objects, arrays, strings) are properly closed
6. Your continuation must be valid JSON when merged with the truncated response
7. Maintain the same indentation and formatting style as the original
8. If you were in the middle of a string, continue that string (don't add extra quotes)
9. If you were in the middle of an array or object, continue with the next elements
10. Complete the entire response and ensure all required closing braces/brackets are included
11. Do not include the triple backticks in your response - just the raw continuation

Remember to maintain the high quality, thorough code analysis from your original response.
Please provide ONLY the raw continuation part with NO additional explanations.
`;
  }

  /**
   * Finds the last complete JSON structure in a truncated string
   */
  private findLastCompleteStructure(jsonString: string): string {
    // This is a simple implementation - in a real system you might want more sophisticated parsing

    // Find the last complete object or array by looking for closing brackets
    let lastCompleteIndex = -1;
    let depth = 0;
    let inString = false;
    let escapeNext = false;

    // Scan backward to find last balanced structure
    for (let i = jsonString.length - 1; i >= 0; i--) {
      const char = jsonString[i];

      if (escapeNext) {
        escapeNext = false;
        continue;
      }

      if (char === '\\') {
        escapeNext = true;
        continue;
      }

      if (char === '"' && (i === 0 || jsonString[i-1] !== '\\')) {
        inString = !inString;
        continue;
      }

      if (!inString) {
        if (char === '}' || char === ']') {
          depth++;
        } else if (char === '{' || char === '[') {
          depth--;
          if (depth === 0) {
            // Found a balanced structure
            lastCompleteIndex = i;
            break;
          }
        }
      }
    }

    // Return the last ~100 characters of the last complete structure
    if (lastCompleteIndex >= 0) {
      const contextStart = Math.max(0, lastCompleteIndex - 100);
      return jsonString.substring(contextStart, jsonString.length);
    }

    // If no complete structure found, just return the last 150 characters
    return jsonString.substring(Math.max(0, jsonString.length - 150));
  }

  /**
   * Merges an original truncated JSON with a continuation
   */
  private mergeJsonResponses(original: string, continuation: string): string {
    // Clean the inputs
    const cleanedOriginal = original.trim();
    const cleanedContinuation = continuation.trim();

    // Log for debugging
    console.log("Original (last 100 chars):", cleanedOriginal.substring(Math.max(0, cleanedOriginal.length - 100)));
    console.log("Continuation (first 100 chars):", cleanedContinuation.substring(0, Math.min(100, cleanedContinuation.length)));

    // First, handle special cases where the continuation is a full object/array that should replace the original
    if ((cleanedContinuation.startsWith('{') && cleanedContinuation.endsWith('}')) ||
        (cleanedContinuation.startsWith('[') && cleanedContinuation.endsWith(']'))) {
      try {
        // Check if the continuation is valid JSON by itself
        JSON.parse(cleanedContinuation);

        // If it's valid and the original is known to be truncated, use the continuation
        if (this.isJsonTruncated(cleanedOriginal)) {
          console.log("Continuation is valid JSON, using it exclusively");
          return cleanedContinuation;
        }
      } catch (e) {
        // Not valid JSON, continue with merge logic
      }
    }

    // Check for specific continuation patterns

    // Case 1: Continuation of a string value
    if (cleanedOriginal.match(/"\s*$/)) {
      // Original ends with an opening quote, likely a truncated string
      const continuationStringMatch = cleanedContinuation.match(/^([^"]*)"(.*)/);
      if (continuationStringMatch) {
        console.log("Detected string continuation pattern");
        // Combine the original with the string completion and the rest of the continuation
        return cleanedOriginal + continuationStringMatch[1] + '"' + continuationStringMatch[2];
      }
    }

    // Case 2: Continuation of an object
    if (cleanedOriginal.match(/\{\s*$/)) {
      // Original ends with an opening brace
      if (cleanedContinuation.startsWith('"') || cleanedContinuation.startsWith('//') ||
          cleanedContinuation.trim() === '') {
        console.log("Detected object start continuation");
        return cleanedOriginal + cleanedContinuation;
      }
    }

    // Case 3: Continuation of an array
    if (cleanedOriginal.match(/\[\s*$/)) {
      // Original ends with an opening bracket
      console.log("Detected array start continuation");
      return cleanedOriginal + cleanedContinuation;
    }

    // Case 4: Continuation after a comma in an array or object
    if (cleanedOriginal.match(/,\s*$/)) {
      // Original ends with a comma
      console.log("Detected comma-separated continuation");
      return cleanedOriginal + cleanedContinuation;
    }

    // Case 5: Continuation of a property name
    const propertyMatch = cleanedOriginal.match(/"([^"]+)"\s*:\s*$/);
    if (propertyMatch) {
      // Original ends with a property name and colon
      console.log("Detected property value continuation");
      return cleanedOriginal + cleanedContinuation;
    }

    // Find common structure markers to determine merge points
    const structureTypes = [
      { start: '{', end: '}' },
      { start: '[', end: ']' },
      { start: '"', end: '"' }
    ];

    // Track stack of opened structures
    const stack: { type: string, position: number }[] = [];

    // Scan the original string to track structure
    for (let i = 0; i < cleanedOriginal.length; i++) {
      const char = cleanedOriginal[i];
      const prevChar = i > 0 ? cleanedOriginal[i - 1] : '';

      // Handle escape sequences
      if (prevChar === '\\') {
        continue;
      }

      // Check for structure markers
      for (const structure of structureTypes) {
        if (char === structure.start) {
          stack.push({ type: structure.start, position: i });
        } else if (char === structure.end && stack.length > 0) {
          const top = stack[stack.length - 1];
          if (top && top.type === structure.start) {
            stack.pop();
          }
        }
      }
    }

    // If we have open structures, we can use them to find merge points
    if (stack.length > 0) {
      console.log(`Found ${stack.length} unclosed structures:`, stack.map(s => s.type).join(', '));

      // Last opened structure is our merge point
      const lastStructure = stack.length > 0 ? stack[stack.length - 1] : null;

      // Special handling based on structure type
      if (lastStructure && lastStructure.type === '{') {
        // Continuing an object
        if (cleanedContinuation.startsWith('"') || cleanedContinuation.startsWith('}')) {
          console.log("Merging as object continuation");
          // Continue the object directly
          return cleanedOriginal + cleanedContinuation;
        }
      } else if (lastStructure && lastStructure.type === '[') {
        // Continuing an array
        if (cleanedContinuation.startsWith('{') ||
            cleanedContinuation.startsWith('[') ||
            cleanedContinuation.startsWith('"') ||
            cleanedContinuation.startsWith(']')) {
          console.log("Merging as array continuation");
          // Check if we need a comma
          if (!cleanedOriginal.endsWith('[') &&
              !cleanedOriginal.endsWith(',') &&
              !cleanedContinuation.startsWith(',') &&
              !cleanedContinuation.startsWith(']')) {
            console.log("Adding missing comma in array continuation");
            return cleanedOriginal + ',' + cleanedContinuation;
          }
          return cleanedOriginal + cleanedContinuation;
        }
      } else if (lastStructure && lastStructure.type === '"') {
        // Continuing a string
        console.log("Merging as string continuation");
        // Close the string and continue
        const stringEnd = cleanedContinuation.indexOf('"');
        if (stringEnd >= 0) {
          return cleanedOriginal + cleanedContinuation.substring(0, stringEnd + 1) +
                 cleanedContinuation.substring(stringEnd + 1);
        } else {
          // No closing quote in continuation, add one
          return cleanedOriginal + cleanedContinuation + '"';
        }
      }
    }

    // Handle duplicate structure markers between original and continuation
    if (cleanedOriginal.endsWith('{') && cleanedContinuation.startsWith('{')) {
      console.log("Removing duplicate opening brace");
      return cleanedOriginal + cleanedContinuation.substring(1);
    }
    if (cleanedOriginal.endsWith('[') && cleanedContinuation.startsWith('[')) {
      console.log("Removing duplicate opening bracket");
      return cleanedOriginal + cleanedContinuation.substring(1);
    }
    if (cleanedOriginal.endsWith(',') && cleanedContinuation.startsWith(',')) {
      console.log("Removing duplicate comma");
      return cleanedOriginal + cleanedContinuation.substring(1);
    }
    if (cleanedOriginal.endsWith(':') && cleanedContinuation.startsWith(':')) {
      console.log("Removing duplicate colon");
      return cleanedOriginal + cleanedContinuation.substring(1);
    }
    if (cleanedOriginal.endsWith('"') && cleanedContinuation.startsWith('"')) {
      console.log("Handling adjacent quotes");
      // Check if this is the end of one string and start of another
      const lastNonWhitespace = cleanedOriginal.substring(0, cleanedOriginal.lastIndexOf('"')).trim().slice(-1);
      if (lastNonWhitespace === ':' || lastNonWhitespace === ',') {
        // This is likely a property value or array element, keep both quotes
        return cleanedOriginal + cleanedContinuation;
      } else {
        // This might be a string continuation, remove one quote
        return cleanedOriginal + cleanedContinuation.substring(1);
      }
    }

    // Default: append the continuation
    console.log("Using default concatenation");
    return cleanedOriginal + cleanedContinuation;
  }

  /**
   * System prompt for continuation requests
   */
  private getContinuationSystemPrompt(): string {
    // Use the same system prompt as for the original request to maintain consistent behavior
    // but add specialized continuation instructions
    return `
You are an expert code indexing agent that specializes in analyzing codebases and optimizing indexing strategies.
Your goal is to help build the most effective representation of code for retrieval and understanding.
You have deep knowledge of programming languages, code structure, and semantic analysis.

YOUR PREVIOUS RESPONSE WAS TRUNCATED. You must continue exactly where you left off.

CONTINUATION REQUIREMENTS:
1. Your output must directly continue the truncated response exactly where it left off
2. Do NOT repeat any information from the original response
3. Do NOT add explanatory text or markdown formatting around your response
4. Your response should start with the exact next character that would continue the truncated JSON
5. Complete any open arrays, objects, or strings
6. Add closing braces, brackets, or quotes as needed to make the final combined JSON valid
7. Match the formatting and indentation style of the original response
8. Focus only on completing the truncated data, not adding new information

For example, if the original response was truncated like this:
\`\`\`
{
  "action": "ANALYZE_FILE",
  "success": true,
  "data": {
    "fileType": "JavaScript",
    "complexity": 7,
    "estimatedSymbolCount": 15,
    "detectedPatterns": [
      "Module pattern",
      "Factory functions",
      "Async/await",
      "Event-driven
\`\`\`

Your continuation might be:
\`\`\`
 architecture"
    ],
    "suggestedChunkingStrategy": "function-based",
    "estimatedChunks": 8,
    "potentialSymbolTypes": ["function", "class", "variable"],
    "uniqueCharacteristics": ["Heavy use of closures", "Dynamic imports"]
  }
}
\`\`\`

Notice that the continuation starts with exactly where the original was cut off (inside the string "Event-driven") and includes all remaining content to complete the JSON structure.

DO NOT leave any part of the JSON structure incomplete. Ensure all opened structures are properly closed.
`;
  }

  /**
   * Creates a prompt for the LLM agent based on the request
   */
  private createAgentPrompt<Req extends AgentRequest>(request: Req): string {
    return `
# Indexing Agent Request

## Action
${request.action}

## Data
\`\`\`json
${JSON.stringify(request.data, null, 2)}
\`\`\`

## Instructions
You are the LLM Indexing Agent responsible for analyzing and directing the indexing of a codebase.
Your task is to respond to this specific request with a well-structured analysis.

YOU MUST provide your response as a valid, properly formatted JSON object with EXACTLY this structure:
\`\`\`json
{
  "action": "${request.action}",
  "success": true,
  "data": {
    "field1": "Example value",
    "field2": ["example", "array", "items"],
    "field3": {
      "nested": "object example"
    }
  }
}
\`\`\`

CRITICAL REQUIREMENTS:
1. Your response MUST be properly formatted JSON that can be parsed with JSON.parse()
2. DO NOT include any explanatory text before or after the JSON object
3. ENSURE all quotes are double-quotes, not single quotes
4. ENSURE all property names have double-quotes around them
5. ALL arrays and objects must be properly closed with matching brackets
6. The response MUST start with '{' and end with '}'
7. DO NOT use JavaScript features like comments, trailing commas, or unquoted property names
8. REMOVE any explanatory comments in the JSON like // comments

Be thorough in your analysis but focus on practical, implementable strategies.
VALIDATE your JSON structure before returning it to ensure it's properly formatted.
`;
  }

  /**
   * Gets the system prompt for a specific action type
   */
  private getSystemPrompt(action: AgentActionType): string {
    const basePrompt = `
You are an expert code indexing agent that specializes in analyzing codebases and optimizing indexing strategies.
Your goal is to help build the most effective representation of code for retrieval and understanding.
You have deep knowledge of programming languages, code structure, and semantic analysis.

IMPORTANT:
- Always provide output as valid JSON that matches the expected response format for the requested action
- Ensure all JSON keys have double quotes and values are properly formatted
- Do not include comments in your JSON output
- Always use double quotes (") for strings in JSON, never single quotes (')
- Validate your JSON before returning to ensure it can be parsed
`;

    switch (action) {
      case AgentActionType.ANALYZE_CODEBASE:
        return `${basePrompt}
For codebase analysis, focus on identifying:
- The type of codebase (web app, library, CLI tool, etc.)
- Dominant programming languages and their versions
- Major frameworks or libraries in use
- Project structure patterns (MVC, microservices, etc.)
- Potential complexity challenges
`;

      case AgentActionType.DESIGN_INDEX_STRATEGY:
        return `${basePrompt}
For indexing strategy design, focus on:
- Creating a coherent approach to indexing the entire codebase
- Prioritizing the most important parts of the code
- Defining specific chunking strategies per file type
- Identifying the most important symbol types to extract
- Planning for efficient relationship mapping
- Considering constraints like memory usage and processing time

IMPORTANT FILE TYPE INSTRUCTIONS:
- Include a "fileExtensions" property in your response that is an array of file extensions (like [".ts", ".tsx", ".js"])
- Do NOT include full file paths or glob patterns - only pure extensions starting with a dot
- Example: ["*.ts", "*.tsx"] is wrong, [".ts", ".tsx"] is correct
- This is critical for the indexing system to work properly
`;

      case AgentActionType.ANALYZE_FILE:
        return `${basePrompt}
For file analysis, focus on:
- Identifying the specific language features used
- Estimating the complexity of the code
- Detecting code patterns and architectural choices
- Determining the best approach for chunking this specific file
- Identifying the types of symbols that should be extracted
`;

      case AgentActionType.DESIGN_FILE_CHUNKING:
        return `${basePrompt}
For file chunking design, focus on:
- Selecting the optimal chunking method for this specific file
- Defining clear chunk boundaries based on code structure
- Determining if overlap between chunks is beneficial
- Providing concrete examples of how the file should be chunked
- Considering both semantic meaning and size constraints

You have complete freedom to design any chunking pattern that's appropriate for this file.
You can define patterns based on:
- Regular expressions
- Delimiter pairs
- Block structures
- Semantic boundaries
- Hierarchical structures
- Markup elements
- Structured data formats
- Or any custom approach you think is appropriate

Define a custom pattern by including a 'patternDefinition' object in your response with these fields:
- type: The pattern type (e.g., 'regex', 'delimiter', 'block', 'semantic', etc.)
- definition: A detailed description of how to identify chunks (can include any properties you want)
- applicationRules: Rules for how to apply the pattern (can include any properties you want)

EXAMPLE PATTERN DEFINITIONS:

For a semantic section-based approach:
\`\`\`
"patternDefinition": {
  "type": "semantic",
  "definition": {
    "boundaryType": "heading",
    "headingLevel": [1, 2]
  },
  "applicationRules": {
    "includeHeading": true,
    "minimumSectionSize": 10
  }
}
\`\`\`

For a regex-based approach:
\`\`\`
"patternDefinition": {
  "type": "regex",
  "definition": {
    "pattern": "function\\s+\\w+\\s*\\([^)]*\\)\\s*\\{[\\s\\S]*?\\}",
    "flags": "g"
  },
  "applicationRules": {
    "minimumSize": 50,
    "mergeSmallChunks": true
  }
}
\`\`\`

For a delimiter-based approach:
\`\`\`
"patternDefinition": {
  "type": "delimiter",
  "definition": {
    "start": "/**",
    "end": "*/"
  },
  "applicationRules": {
    "includeDelimiters": true,
    "skipEmpty": true
  }
}
\`\`\`

The pattern will be dynamically interpreted and executed, so be as specific as possible.
`;

      case AgentActionType.EXTRACT_SYMBOLS:
        return `${basePrompt}
For symbol extraction, focus on:
- Identifying all relevant symbols in the provided chunks
- Extracting accurate metadata for each symbol
- Capturing the hierarchical relationship between symbols
- Providing useful descriptions of each symbol's purpose
- Ensuring all important symbols are captured

EXTRACTION PATTERNS:
You should also include extraction patterns in your response. These are structured descriptions of how to identify specific types of symbols in the code.

For each pattern, include:
- type: The pattern type (regex, ast, semantic)
- targetSymbolTypes: Types of symbols this pattern targets (function, class, etc.)
- definition: Configuration details including pattern definition
- refinement: Optional rules for filtering extracted symbols

EXAMPLES OF PATTERN DEFINITIONS:

For TypeScript/JavaScript functions:
"extractionPatterns": [
  {
    "type": "regex",
    "targetSymbolTypes": ["function"],
    "definition": {
      "pattern": "function\\\\s+(\\\\w+)\\\\s*\\\\(([^)]*)\\\\)",
      "flags": "g",
      "group2Name": "parameters"
    }
  }
]

For class-based patterns:
"extractionPatterns": [
  {
    "type": "regex",
    "targetSymbolTypes": ["class"],
    "definition": {
      "pattern": "class\\\\s+(\\\\w+)(?:\\\\s+extends\\\\s+(\\\\w+))?",
      "flags": "g",
      "group2Name": "extends"
    }
  }
]

For semantic patterns:
"extractionPatterns": [
  {
    "type": "semantic",
    "targetSymbolTypes": ["interface", "type"],
    "definition": {
      "structureType": "declaration",
      "identifierPosition": "after-keyword"
    }
  }
]

Your patterns should be tailored to the specific file type and content structure.
`;

      case AgentActionType.ANALYZE_RELATIONSHIPS:
        return `${basePrompt}
For relationship analysis, focus on:
- Identifying dependencies between symbols
- Detecting inheritance and implementation relationships
- Finding function calls and references
- Understanding import/export patterns
- Mapping the data flow between components

RELATIONSHIP PATTERNS:
You should include relationship patterns in your response. These are structured descriptions of how to identify relationships between symbols in code. I encourage you to be creative and define any relationship types that make sense for this specific codebase.

For each pattern, you can include:
- type: Define ANY relationship type that makes sense (not limited to predefined categories - be creative!)
- sourceType: Types of symbols that can be the source of this relationship (array of strings)
- targetType: Types of symbols that can be the target of this relationship (array of strings)
- detection: Configuration details for detecting the relationship (completely up to you)
- refinement: Optional rules for filtering detected relationships
- Any other fields you think would be helpful

The detection field can include ANY properties you think would help identify this relationship:
- pattern: A regex pattern string for matching relationships in code
- contentPattern: A template string that can include \${targetName} which will be replaced with actual symbol names
- Any custom detection logic you can describe

EXAMPLES OF PATTERN DEFINITIONS:

For import relationships:
"relationshipPatterns": [
  {
    "type": "import",
    "sourceType": ["function", "class", "variable"],
    "detection": {
      "pattern": "(?:import|require)[\\\\s\\\\(]*[\\\\'\\\\"]([^\\\\'\\\\\"]+)[\\\\'\\\\"]",
      "includeExternal": true
    }
  }
]

For inheritance relationships:
"relationshipPatterns": [
  {
    "type": "inheritance",
    "sourceType": ["class", "interface"],
    "targetType": ["class", "interface"],
    "detection": {
      "pattern": "(?:extends|implements)\\\\s+([\\\\w\\\\.,\\\\s]+)",
      "includeExternal": true
    }
  }
]

For custom relationship types:
"relationshipPatterns": [
  {
    "type": "dataflow",
    "description": "Function modifies or reads data from a variable/property",
    "sourceType": ["function", "method"],
    "targetType": ["variable", "property"],
    "detection": {
      "contentPattern": "$\\{targetName\\}\\\\s*[=\\\\[]|\\\\breturn\\\\s+[$\\{targetName\\}]|\\\\b$\\{targetName\\}\\\\.\\\\w+"
    },
    "strength": "medium", // Custom field showing relationship strength
    "directionality": "bidirectional" // Custom field for flow direction
  }
]

For domain-specific relationships:
"relationshipPatterns": [
  {
    "type": "renders",
    "description": "UI component renders another component",
    "sourceType": ["class", "function"],
    "targetType": ["class", "function"],
    "detection": {
      "jsxPattern": "<$\\{targetName\\}[\\\\s>]",
      "importCheck": true,
      "requiresProps": false
    },
    "visualWeight": 2, // Custom field for visualization
    "category": "ui" // Custom categorization
  }
]

Your patterns should be tailored to the specific code structure, language features, and relationship types present in the analyzed file. Include patterns for all relevant relationship types you can identify. Be sure to include both the relationships and the patterns in your response.
`;

      case AgentActionType.ENHANCE_SYMBOL_METADATA:
        return `${basePrompt}
For metadata enhancement, focus on:
- Providing deeper semantic understanding of the symbol
- Estimating the symbol's importance in the overall codebase
- Identifying potential use cases and purposes
- Suggesting optimal embedding strategies
- Extracting documentation or generating it if missing
`;

      default:
        return basePrompt;
    }
  }

  /**
   * Extracts JSON from the LLM's response with enhanced recovery mechanisms
   * for handling truncated or malformed JSON
   */
  private extractJsonFromResponse(response: string): string {
    // Log the original response for debugging
    console.log("Raw LLM response:", response.substring(0, 500) + (response.length > 500 ? "..." : ""));

    // Try to find JSON object in the response (some LLMs wrap it in ```json``` blocks)
    const jsonRegex = /```(?:json)?([\s\S]*?)```|(\{[\s\S]*\})/g;
    const match = jsonRegex.exec(response);

    if (match) {
      // Return the captured JSON (either from inside code block or direct match)
      const extracted = (match[1] || match[2] || '').trim();
      console.log("Extracted JSON:", extracted.substring(0, 200) + (extracted.length > 200 ? "..." : ""));
      return extracted;
    }

    // If no JSON block found, try more aggressive extraction techniques
    try {
      // Step 1: Try to parse the whole response directly
      try {
        JSON.parse(response.trim());
        return response.trim();
      } catch (parseError) {
        // Continue to more advanced recovery methods
      }

      // Step 2: Clean up the response and look for JSON-like structures
      let cleaned = response.trim()
        .replace(/[\r\n\t]+/g, ' ') // Replace newlines and tabs with spaces
        .replace(/\s{2,}/g, ' ');   // Replace multiple spaces with a single space

      // Step 3: Find the first opening brace and last closing brace
      const jsonStart = cleaned.indexOf('{');
      const jsonEnd = cleaned.lastIndexOf('}');

      if (jsonStart >= 0 && jsonEnd > jsonStart) {
        // Extract what looks like JSON
        const jsonPart = cleaned.substring(jsonStart, jsonEnd + 1);
        console.log("JSON-like part found:", jsonPart.substring(0, 200) + (jsonPart.length > 200 ? "..." : ""));

        // Step 4: Try to validate and fix common JSON issues
        try {
          // Check if this is valid JSON already
          JSON.parse(jsonPart);
          return jsonPart;
        } catch (error) {
          // JSON repair attempts for truncated responses
          console.log("Attempting to repair extracted JSON");

          // Step 4.1: Try to make it a valid JSON by checking and repairing structural issues
          let repairedJson = jsonPart;

          // Analyze brace balance
          const openBraces = (repairedJson.match(/\{/g) || []).length;
          const closeBraces = (repairedJson.match(/\}/g) || []).length;

          // Analyze bracket balance
          const openBrackets = (repairedJson.match(/\[/g) || []).length;
          const closeBrackets = (repairedJson.match(/\]/g) || []).length;

          // Analyze quote balance (simplified approach)
          const quoteCount = (repairedJson.match(/"/g) || []).length;

          // Fix unbalanced braces, brackets, and quotes
          if (openBraces > closeBraces) {
            console.log(`Adding ${openBraces - closeBraces} missing closing braces`);
            repairedJson += '}' .repeat(openBraces - closeBraces);
          }

          if (openBrackets > closeBrackets) {
            console.log(`Adding ${openBrackets - closeBrackets} missing closing brackets`);
            repairedJson += ']' .repeat(openBrackets - closeBrackets);
          }

          if (quoteCount % 2 !== 0) {
            console.log(`Fixing unbalanced quotes`);
            repairedJson += '"';
          }

          // Check for specific truncated patterns
          if (repairedJson.match(/,\s*$/)) {
            console.log("Fixing trailing comma");
            repairedJson = repairedJson.replace(/,\s*$/, '');
          }

          if (repairedJson.match(/:\s*$/)) {
            console.log("Fixing truncated property");
            repairedJson = repairedJson.replace(/:\s*$/, ': null');
          }

          // Step 4.2: One final verification
          try {
            JSON.parse(repairedJson);
            console.log("JSON repair successful");
            return repairedJson;
          } catch (finalError) {
            console.log("JSON repair unsuccessful, returning extracted JSON for further processing");
            return jsonPart; // Return the original extracted part for further processing
          }
        }
      }

      // Step 5: If we can't find a JSON-like structure, try to find an action key and create minimal JSON
      const actionMatch = cleaned.match(/"action"\s*:\s*"([^"]+)"/);
      if (actionMatch) {
        console.log("Creating minimal valid JSON from action field");
        return `{"action": "${actionMatch[1]}", "success": false, "data": {}}`;
      }

      // Step 6: Last resort - return the cleaned response for further processing
      console.log("No JSON pattern found, returning cleaned response");
      return cleaned;
    } catch (error) {
      console.error(`Error in JSON extraction: ${error instanceof Error ? error.message : String(error)}`);
      console.log("Using emergency JSON repair");

      // Emergency fallback - create a minimal valid JSON object
      return '{"success": false, "data": {}, "error": "JSON extraction failed"}';
    }
  }

  /**
   * Gets the storage primitives for direct use
   */
  getStoragePrimitives(): StoragePrimitives {
    return this.storagePrimitives;
  }

  /**
   * Normalizes chunking method strings to handle different formats from LLMs
   * @param method The raw chunking method string from the LLM
   * @returns Normalized chunking method string
   */
  private normalizeChunkingMethod(method?: string): string {
    if (!method) {
      console.log('No chunking method provided, defaulting to line-based');
      return 'line-based';
    }

    // Convert to lowercase and trim whitespace
    const normalizedMethod = method.toLowerCase().trim();

    // Handle various naming conventions
    if (normalizedMethod.includes('function') || normalizedMethod === 'functional' || normalizedMethod === 'by-function') {
      return 'function-based';
    }

    if (normalizedMethod.includes('class') || normalizedMethod === 'by-class') {
      return 'class-based';
    }

    if (normalizedMethod.includes('fixed') || normalizedMethod.includes('size')) {
      return 'fixed-size';
    }

    if (normalizedMethod.includes('line')) {
      return 'line-based';
    }

    if (normalizedMethod.includes('section') || normalizedMethod.includes('heading') || normalizedMethod.includes('comment')) {
      return 'section-based';
    }

    // If no match, return the original but with hyphens instead of underscores for consistency
    console.log(`Using custom chunking method: ${normalizedMethod}`);
    return normalizedMethod.replace(/_/g, '-');
  }

  /**
   * Find potential chunks from different property names the LLM might use
   * @param chunkingStrategy The chunking strategy object from the LLM
   * @returns Array of chunks with standardized fields
   */
  private findPotentialChunks(chunkingStrategy: any): Array<{ startLine: number; endLine: number; type?: string }> {
    if (!chunkingStrategy || typeof chunkingStrategy !== 'object') {
      console.warn('Invalid chunking strategy provided');
      return [];
    }

    // Try different property names the LLM might use for chunks
    const potentialChunkProperties = [
      'suggestedChunks',
      'recommendedChunks',
      'chunks',
      'proposedChunks',
      'definedChunks',
      'sections',
      'functions',
      'classes',
      'codeBlocks'
    ];

    // Try to find chunks using different property names
    for (const prop of potentialChunkProperties) {
      const chunks = chunkingStrategy[prop];

      if (chunks && Array.isArray(chunks) && chunks.length > 0) {
        console.log(`Found ${chunks.length} chunks using property '${prop}'`);

        // Validate and normalize chunks
        return chunks.filter(chunk => {
          // Check if chunk is a valid object
          if (!chunk || typeof chunk !== 'object') {
            console.warn('Skipping invalid chunk:', chunk);
            return false;
          }

          // Check if chunk has required startLine and endLine properties
          const hasStartLine = 'startLine' in chunk && !isNaN(Number(chunk.startLine));
          const hasEndLine = 'endLine' in chunk && !isNaN(Number(chunk.endLine));

          // Alternative property names
          if (!hasStartLine && ('start' in chunk) && !isNaN(Number(chunk.start))) {
            chunk.startLine = Number(chunk.start);
          }

          if (!hasEndLine && ('end' in chunk) && !isNaN(Number(chunk.end))) {
            chunk.endLine = Number(chunk.end);
          }

          // Check again after potential conversions
          const isValid =
            'startLine' in chunk &&
            'endLine' in chunk &&
            !isNaN(Number(chunk.startLine)) &&
            !isNaN(Number(chunk.endLine));

          if (!isValid) {
            console.warn('Skipping chunk with missing or invalid line numbers:', chunk);
          }

          return isValid;
        }).map(chunk => ({
          startLine: Number(chunk.startLine),
          endLine: Number(chunk.endLine),
          type: chunk.type || chunkingStrategy.chunkingMethod || 'unknown'
        }));
      }
    }

    // If we get here, no chunks were found with any of the expected property names
    console.log('No chunks found in chunking strategy with any known property names');
    return [];
  }

  /**
   * Safely extract lines per chunk from chunk size guidelines
   * @param chunkSizeGuidelines The chunk size guidelines object
   * @returns Number of lines per chunk
   */
  private getSafeLinesPerChunk(chunkSizeGuidelines: any): number {
    const DEFAULT_LINES_PER_CHUNK = 100;

    if (!chunkSizeGuidelines || typeof chunkSizeGuidelines !== 'object') {
      return DEFAULT_LINES_PER_CHUNK;
    }

    // Try different property names for line count
    const possibleProperties = ['maxLines', 'lines', 'linesPerChunk', 'lineCount', 'chunkSize'];

    for (const prop of possibleProperties) {
      if (prop in chunkSizeGuidelines && !isNaN(Number(chunkSizeGuidelines[prop]))) {
        const lines = Number(chunkSizeGuidelines[prop]);
        // Ensure value is reasonable (between 5 and 500 lines)
        if (lines >= 5 && lines <= 500) {
          return lines;
        } else {
          console.log(`Found ${prop} property but value ${lines} is outside reasonable range`);
        }
      }
    }

    return DEFAULT_LINES_PER_CHUNK;
  }

  /**
   * Safely extract overlap from overlap strategy
   * @param overlapStrategy The overlap strategy object
   * @returns Number of lines to overlap
   */
  private getSafeOverlap(overlapStrategy: any): number {
    const DEFAULT_OVERLAP = 0;
    const MAX_OVERLAP = 50;

    if (!overlapStrategy || typeof overlapStrategy !== 'object') {
      return DEFAULT_OVERLAP;
    }

    // Check if overlap is enabled
    const isEnabled =
      (overlapStrategy.enabled === true) ||
      (overlapStrategy.enable === true) ||
      (overlapStrategy.useOverlap === true);

    if (!isEnabled) {
      return DEFAULT_OVERLAP;
    }

    // Try different property names for overlap amount
    const possibleProperties = ['amount', 'lines', 'overlapLines', 'size', 'value'];

    for (const prop of possibleProperties) {
      if (prop in overlapStrategy && !isNaN(Number(overlapStrategy[prop]))) {
        const overlap = Number(overlapStrategy[prop]);

        // Ensure value is reasonable (between 0 and MAX_OVERLAP lines)
        if (overlap >= 0 && overlap <= MAX_OVERLAP) {
          return overlap;
        } else {
          console.log(`Found ${prop} property but value ${overlap} is outside reasonable range`);
          // Return a safe value within range
          return Math.min(Math.max(0, overlap), MAX_OVERLAP);
        }
      }
    }

    // If enabled but no amount specified, use a reasonable default
    return 10; // Default to 10 lines overlap when enabled but amount not specified
  }

  /**
   * Validates chunks to ensure they contain valid line ranges
   * @param chunks Array of chunks to validate
   * @param content File content for reference
   * @returns Validated and corrected chunks
   */
  private validateChunks(chunks: Array<any>, content: string): Array<{ content: string; startLine: number; endLine: number; type?: string }> {
    if (!chunks || !Array.isArray(chunks)) {
      console.warn('No valid chunks array provided for validation');
      return [];
    }

    const lines = content.split('\n');
    const totalLines = lines.length;

    console.log(`Validating ${chunks.length} chunks against ${totalLines} lines of content`);

    return chunks.map(chunk => {
      try {
        // Create a new object with safe default values
        const safeChunk: { content: string; startLine: number; endLine: number; type?: string } = {
          content: '',
          startLine: 1,
          endLine: 2,
          type: chunk.type || 'unknown'
        };

        // Validate startLine
        if (typeof chunk.startLine === 'number' && chunk.startLine >= 1 && chunk.startLine <= totalLines) {
          safeChunk.startLine = chunk.startLine;
        } else {
          console.warn(`Invalid startLine ${chunk.startLine}, using default line 1`);
          safeChunk.startLine = 1;
        }

        // Validate endLine
        if (typeof chunk.endLine === 'number' && chunk.endLine >= safeChunk.startLine && chunk.endLine <= totalLines) {
          safeChunk.endLine = chunk.endLine;
        } else {
          // Set reasonable endLine if invalid
          const defaultEnd = Math.min(safeChunk.startLine + 20, totalLines);
          console.warn(`Invalid endLine ${chunk.endLine}, using calculated end line ${defaultEnd}`);
          safeChunk.endLine = defaultEnd;
        }

        // Extract content from the file based on validated line numbers
        safeChunk.content = lines.slice(safeChunk.startLine - 1, safeChunk.endLine).join('\n');

        // Preserve other properties that might be useful
        // Use type assertion with interface that includes optional properties
        interface ExtendedChunk {
          content: string;
          startLine: number;
          endLine: number;
          type?: string;
          name?: string;
          description?: string;
        }

        const extendedChunk = chunk as ExtendedChunk;
        const extendedSafeChunk = safeChunk as ExtendedChunk;

        if (extendedChunk.name) extendedSafeChunk.name = extendedChunk.name;
        if (extendedChunk.description) extendedSafeChunk.description = extendedChunk.description;

        return safeChunk;
      } catch (error) {
        console.error(`Error validating chunk: ${error}`, chunk);
        // Return a minimal valid chunk in case of errors
        return {
          content: '// Error in chunk validation',
          startLine: 1,
          endLine: 2,
          type: 'error'
        };
      }
    }).filter(chunk => {
      // Filter out chunks with no content or identical start/end lines
      if (!chunk.content || chunk.startLine === chunk.endLine) {
        console.warn(`Removing empty chunk or zero-length chunk at line ${chunk.startLine}`);
        return false;
      }
      return true;
    });
  }
}
