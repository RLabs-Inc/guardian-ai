// source/services/indexing/llmDirected/llmDirectedIndexingService.ts

import * as path from 'path';
import * as fs from 'fs-extra';
import {
  IndexingService,
  IndexedCodebase,
  CodeSymbol,
  CodeDependency,
  IndexingOptions
} from '../types.js';
import { FileSystemService, FileSystemFilter } from '../../fileSystem/types.js';
import { LLMService } from '../../llm/types.js';
import { IndexingAgent } from './indexingAgent.js';
import { PatternInterpreter } from './patternInterpreter.js';
import { StoragePrimitives } from './storagePrimitives.js';
import { getMemoryMonitor } from '../../utils/memoryMonitor.js';

/**
 * Implementation of the LLM-directed code indexing service
 * This service uses an LLM to analyze the codebase and direct the indexing process
 */
export class LLMDirectedIndexingService implements IndexingService {
  private fileSystem: FileSystemService;
  private llmService: LLMService;
  private indexingAgent: IndexingAgent | null = null;
  private projectRoot: string = '';
  private indexedCodebase: IndexedCodebase = {
    symbols: {},
    dependencies: [],
    files: [],
    statistics: {
      totalFiles: 0,
      totalSymbols: 0,
      totalDependencies: 0,
      lastIndexed: new Date()
    }
  };

  // Cache for file type strategies
  private fileTypeStrategies: Map<string, {
    fileAnalysis: any;
    chunkingStrategy: any;
  }> = new Map();

  // Statistics for caching metrics
  private cacheHits: number = 0;
  private cacheMisses: number = 0;

  // Access to helpers for file operations
  private patternInterpreter: PatternInterpreter | null = null;
  private storagePrimitives: StoragePrimitives | null = null;

  /**
   * Normalizes chunking method strings to a consistent format
   * @param method The chunking method to normalize
   * @returns A normalized chunking method string
   */
  private normalizeChunkingMethod(method: any): string {
    // Normalize the chunking method to a consistent format
    if (!method) return 'line-based'; // Default to line-based chunking

    const methodStr = String(method).toLowerCase();

    // Handle common aliases and variations
    if (methodStr.includes('function')) return 'function-based';
    if (methodStr.includes('class')) return 'class-based';
    if (methodStr.includes('line')) return 'line-based';
    if (methodStr.includes('fixed')) return 'fixed-size';
    if (methodStr.includes('section')) return 'section-based';
    if (methodStr.includes('comment')) return 'comment-based';
    if (methodStr.includes('whole')) return 'whole-file';
    if (methodStr.includes('semantic')) return 'semantic';

    // Return a reasonable default
    return 'line-based';
  }

  constructor(fileSystem: FileSystemService, llmService: LLMService) {
    this.fileSystem = fileSystem;
    this.llmService = llmService;
  }

  /**
   * Initialize helpers after projectRoot is set
   */
  private initializeHelpers() {
    if (!this.projectRoot) {
      throw new Error('Project root must be set before initializing helpers');
    }

    // Initialize storage primitives if not already done
    if (!this.storagePrimitives) {
      this.storagePrimitives = new StoragePrimitives(this.fileSystem, this.projectRoot);
    }

    // Initialize pattern interpreter if not already done
    if (!this.patternInterpreter) {
      this.patternInterpreter = new PatternInterpreter(this.storagePrimitives);
    }
  }

  /**
   * Get a cached file type strategy or create one for the given extension
   * This helps avoid redundant LLM calls for similar file types
   */
  private async getOrCreateFileTypeStrategy(extension: string, sampleFilePath: string): Promise<{
    fileAnalysis: any;
    chunkingStrategy: any;
  }> {
    // Check if we already have a strategy for this extension
    if (this.fileTypeStrategies.has(extension)) {
      this.cacheHits++;
      console.log(`Cache hit for ${extension} files (${this.cacheHits} hits, ${this.cacheMisses} misses)`);
      return this.fileTypeStrategies.get(extension)!;
    }

    // No cached strategy, need to analyze a sample file
    this.cacheMisses++;
    console.log(`Cache miss for ${extension} files, analyzing sample: ${sampleFilePath}`);

    try {
      if (!this.indexingAgent) {
        throw new Error('Indexing agent not initialized');
      }

      // Read the sample file
      const content = await this.indexingAgent.processFileContent(sampleFilePath);

      // Analyze the file to determine how to best process it
      const fileAnalysis = await this.indexingAgent.analyzeFile(sampleFilePath, content);

      // Design the chunking strategy
      const chunkingStrategy = await this.indexingAgent.designFileChunking(
        sampleFilePath,
        content,
        fileAnalysis
      );

      // Cache the strategy for this extension
      const strategy = { fileAnalysis, chunkingStrategy };
      this.fileTypeStrategies.set(extension, strategy);

      console.log(`Created and cached strategy for ${extension} files (${this.fileTypeStrategies.size} extensions cached)`);

      return strategy;
    } catch (error) {
      console.error(`Error creating file type strategy for ${extension}:`, error);
      // Create a default strategy
      const defaultStrategy = {
        fileAnalysis: {
          fileType: extension.slice(1) || 'unknown',
          language: extension.slice(1) || 'unknown',
          complexity: 'medium',
          purpose: 'code',
          summary: `A ${extension} file`
        },
        chunkingStrategy: {
          chunkingMethod: 'line-based',
          chunkSizeGuidelines: { linesPerChunk: 100 },
          overlapStrategy: { overlap: 10 }
        }
      };

      // Cache even the default strategy to avoid repeated failures
      this.fileTypeStrategies.set(extension, defaultStrategy);

      return defaultStrategy;
    }
  }

  /**
   * Process a file using predefined strategy components
   * This avoids redundant LLM calls for similar files
   */
  private async processFileWithStrategy(
    filePath: string,
    _fileAnalysis: any, // Renamed with underscore to mark as unused
    chunkingStrategy: any
  ): Promise<{
    symbols: CodeSymbol[];
    dependencies: CodeDependency[];
  }> {
    if (!this.indexingAgent) {
      throw new Error('Indexing agent not initialized');
    }

    try {
      // Read the file content
      const content = await this.indexingAgent.processFileContent(filePath);

      // Implement the chunking strategy
      let chunks: Array<{ content: string; startLine: number; endLine: number; type?: string }> = [];

      // Use the pattern from the chunking strategy
      if (chunkingStrategy.patternDefinition) {
        try {
          chunks = await this.indexingAgent.executeChunkingPattern(
            filePath,
            content,
            chunkingStrategy.patternDefinition
          );
        } catch (error) {
          console.error(`Error executing chunking pattern for ${filePath}:`, error);
          // Fall back to line-based chunking
          chunks = await this.indexingAgent.chunkByLineCount(filePath, 100);
        }
      } else {
        // Use the legacy approach with predefined strategy
        const normalizedChunkingMethod = this.normalizeChunkingMethod(chunkingStrategy.chunkingMethod);

        // Implement appropriate chunking based on method
        switch (normalizedChunkingMethod) {
          case 'function-based':
            chunks = await this.indexingAgent.chunkByPattern(filePath, [
              { pattern: /function\s+\w+|\w+\s*=\s*function|\w+\s*:\s*function|\(\s*\)\s*=>\s*{/, type: 'function' }
            ]);
            break;
          case 'class-based':
          case 'class_based':
            chunks = await this.indexingAgent.chunkByPattern(filePath, [
              { pattern: /class\s+\w+/, type: 'class' },
              { pattern: /interface\s+\w+/, type: 'interface' }
            ]);
            break;
          case 'fixed-size':
          case 'fixed_size':
          case 'line-based':
          case 'line_based':
          default:
            // Get chunking parameters or use defaults
            const linesPerChunk = chunkingStrategy.chunkSizeGuidelines?.linesPerChunk || 100;
            const overlap = chunkingStrategy.overlapStrategy?.overlap || 10;
            chunks = await this.indexingAgent.chunkByLineCount(filePath, linesPerChunk, overlap);
            break;
        }
      }

      // Extract symbols from chunks
      const symbols = await this.indexingAgent.extractSymbols(filePath, content, chunks);

      // Analyze relationships between symbols
      const dependencies = await this.indexingAgent.analyzeRelationships(filePath, content, symbols);

      // Clean up resources to prevent memory leaks
      this.cleanupFileResources(filePath);

      return { symbols, dependencies };
    } catch (error) {
      console.error(`Error processing file ${filePath} with strategy:`, error);

      // Still clean up resources even on error
      try {
        this.cleanupFileResources(filePath);
      } catch (cleanupError) {
        console.error(`Error during cleanup for ${filePath}:`, cleanupError);
      }

      throw error;
    }
  }

  /**
   * Index a codebase using LLM-directed strategy
   */
  /**
   * Cleanup resources after processing a file to prevent memory leaks
   */
  private cleanupFileResources(filePath: string): void {
    // Clear file-specific caches
    if (this.storagePrimitives) {
      // Remove file content from cache
      this.storagePrimitives.clearFileContent(filePath);

      // Remove chunks from cache
      this.storagePrimitives.clearFileChunks(filePath);
    }

    // Force garbage collection
    const memoryMonitor = getMemoryMonitor();
    memoryMonitor.forceGC();

    console.log(`Cleaned up resources for file: ${filePath}`);
  }

  async indexCodebase(
    projectPath: string,
    options?: IndexingOptions
  ): Promise<IndexedCodebase> {
    try {
      console.log(`Starting LLM-directed indexing of ${projectPath}`);
      // Set project root only once
      this.projectRoot = projectPath;

      // Initialize the indexing agent and helpers
      this.indexingAgent = new IndexingAgent(this.llmService, this.fileSystem, projectPath);
      this.initializeHelpers();

      // Initialize fresh index
      this.indexedCodebase = {
        symbols: {},
        dependencies: [],
        files: [],
        statistics: {
          totalFiles: 0,
          totalSymbols: 0,
          totalDependencies: 0,
          lastIndexed: new Date()
        }
      };

      // Step 1: Analyze codebase structure
      console.log('Analyzing codebase structure...');
      const { fileTypes, directoryStructure, sampleFiles } = await this.analyzeCodebaseStructure(
        projectPath,
        options
      );

      // Step 2: Get LLM to analyze the codebase
      console.log('Getting LLM analysis of codebase...');

      // Add memory checkpoint before the LLM-heavy operation
      this.indexingAgent.performMemoryCheckpoint('before_analyze_codebase', {
        fileTypesCount: Object.keys(fileTypes).length,
        dirCount: Object.keys(directoryStructure).length,
        sampleFilesCount: sampleFiles.length
      });

      const codebaseAnalysis = await this.indexingAgent.analyzeCodebase(
        fileTypes,
        directoryStructure,
        sampleFiles
      );

      // Add memory checkpoint after the LLM operation
      this.indexingAgent.performMemoryCheckpoint('after_analyze_codebase', {
        analysisKeys: Object.keys(codebaseAnalysis).join(',')
      });

      // Log the structure for debugging
      console.log('Codebase analysis structure:',
        Object.keys(codebaseAnalysis).join(', '));

      // Step 3: Design indexing strategy
      console.log('Designing indexing strategy...');

      // Add memory checkpoint before this LLM-heavy operation
      this.indexingAgent.performMemoryCheckpoint('before_design_strategy', {
        codebaseAnalysisSize: JSON.stringify(codebaseAnalysis).length,
        maxMemoryUsage: options?.maxFiles ? options.maxFiles * 0.5 : 'undefined'
      });

      const indexingStrategy = await this.indexingAgent.designIndexingStrategy(
        codebaseAnalysis,
        {
          maxMemoryUsage: options?.maxFiles ? options.maxFiles * 0.5 : undefined, // Rough estimate
          maxProcessingTime: 600 // 10 minutes
        }
      );

      // Add memory checkpoint after the LLM operation
      this.indexingAgent.performMemoryCheckpoint('after_design_strategy', {
        strategySize: JSON.stringify(indexingStrategy).length
      });

      // Log the strategy structure for debugging
      console.log('Indexing strategy structure:',
        Object.keys(indexingStrategy).join(', '));

      // Step 4: Create a file filter based on the indexing strategy
      console.log('Creating file filter from indexing strategy...');

      // Handle potentially mismatched response structure using type assertions
      // We need to use type assertions because the actual LLM response may not match our expected interface
      const indexingStrategyAny = indexingStrategy as any;
      const codebaseAnalysisAny = codebaseAnalysis as any;

      // Log the full structure for debugging
      console.log('indexingStrategy full structure:', JSON.stringify(indexingStrategyAny).substring(0, 300) + '...');

      // Deep search for fileExtensions, prioritizedFileTypes, or any equivalent property in any structure
      const findPrioritizedFileTypes = (obj: any): any => {
        // Early exit for nullish values
        if (!obj || typeof obj !== 'object') return null;

        // Direct property match - check for fileExtensions first (highest priority)
        if (obj.fileExtensions) {
          console.log('[findPrioritizedFileTypes] Found fileExtensions property:', JSON.stringify(obj.fileExtensions).substring(0, 100));
          return obj.fileExtensions;
        }
        if (obj.prioritizedFileTypes) return obj.prioritizedFileTypes;
        if (obj.fileTypes) return obj.fileTypes;

        // Recursive search through all properties
        for (const key in obj) {
          // Skip non-object properties unless they look like file extensions
          if (typeof obj[key] === 'object' && obj[key] !== null) {
            const result = findPrioritizedFileTypes(obj[key]);
            if (result) return result;
          }

          // Handle array of file extensions directly at the top level
          if (Array.isArray(obj[key]) &&
              obj[key].length > 0 &&
              typeof obj[key][0] === 'string' &&
              (key.toLowerCase().includes('file') || key.toLowerCase() === 'fileextensions')) {
            console.log(`[findPrioritizedFileTypes] Found file extensions in array property '${key}'`);
            return obj[key];
          }
        }

        return null;
      };

      // Similar function for exclusions
      const findExclusions = (obj: any): any => {
        if (!obj || typeof obj !== 'object') return null;

        // Direct property match for exclusion-like properties
        if (obj.suggestedExclusions) return obj.suggestedExclusions;
        if (obj.exclusions) return obj.exclusions;
        if (obj.excludePatterns) return obj.excludePatterns;
        if (obj.ignorePatterns) return obj.ignorePatterns;

        // Recursive search
        for (const key in obj) {
          if (typeof obj[key] === 'object' && obj[key] !== null) {
            const result = findExclusions(obj[key]);
            if (result) return result;
          }
        }

        return null;
      };

      // Extract the properties from both the indexing strategy and codebase analysis
      const fileExtensionsFromStrategy = findPrioritizedFileTypes(indexingStrategyAny);
      const fileExtensionsFromAnalysis = findPrioritizedFileTypes(codebaseAnalysisAny);

      // Use strategy file extensions if available, otherwise fall back to analysis
      const prioritizedFileTypes = fileExtensionsFromStrategy || fileExtensionsFromAnalysis;

      // Log whether fileExtensions were found or we're falling back
      if (fileExtensionsFromStrategy) {
        console.log('[createFileFilter] Using fileExtensions from indexing strategy');
      } else if (fileExtensionsFromAnalysis) {
        console.log('[createFileFilter] No fileExtensions in strategy, falling back to codebase analysis');
      } else {
        console.log('[createFileFilter] No fileExtensions found in strategy or analysis, will use defaults');
      }

      const suggestedExclusions = findExclusions(codebaseAnalysisAny) ||
                                findExclusions(indexingStrategyAny) ||
                                [];

      const filter: FileSystemFilter = this.createFileFilter(
        prioritizedFileTypes,
        suggestedExclusions
      );

      // Step 5: List all files to process
      console.log('Listing files to process...');
      const files = await this.fileSystem.listFiles(projectPath, true, filter);
      console.log(`Found ${files.length} files to process`);

      // Apply max files limit if specified
      const filesToProcess = options?.maxFiles
        ? files.slice(0, options.maxFiles)
        : files;

      // Step 6: Group files by extension for more efficient processing
      const filesByExtension: Record<string, string[]> = {};
      for (const file of filesToProcess) {
        if (!file.isDirectory) {
          const extension = path.extname(file.path).toLowerCase();
          if (!filesByExtension[extension]) {
            filesByExtension[extension] = [];
          }
          filesByExtension[extension].push(path.relative(projectPath, file.path));
        }
      }

      console.log(`Files grouped by ${Object.keys(filesByExtension).length} extensions: ${Object.keys(filesByExtension).join(', ')}`);

      // Process files by extension to leverage cached strategies
      for (const [extension, filePaths] of Object.entries(filesByExtension)) {
        console.log(`Processing ${filePaths.length} ${extension} files...`);

        // Add memory checkpoint before processing each file extension batch
        this.indexingAgent.performMemoryCheckpoint('before_extension_batch', {
          extension,
          fileCount: filePaths.length
        });

        // First, get the strategy for this file type to reuse for all files
        const sampleFilePath = filePaths[0]; // Use the first file as sample
        if (!sampleFilePath) {
          console.warn(`No sample file for extension ${extension}, skipping batch`);
          continue;
        }
        const strategy = await this.getOrCreateFileTypeStrategy(extension, sampleFilePath);

        // Use parallel processing for files of this extension
        // Limit concurrency to avoid excessive memory usage
        const parallelProcessLimit = 3; // Process 3 files in parallel
        let extensionProcessedCount = 0;
        let totalProcessed = 0;

        console.log(`Using parallel processing with concurrency of ${parallelProcessLimit} for ${extension} files`);

        // Process files in batches to limit concurrency
        for (let i = 0; i < filePaths.length; i += parallelProcessLimit) {
          const currentBatch = filePaths.slice(i, i + parallelProcessLimit);

          // Process this batch in parallel
          const processingPromises = currentBatch.map(async (relativePath) => {
            try {
              console.log(`Started processing file ${++extensionProcessedCount}/${filePaths.length}: ${relativePath}`);

              // Process file with the shared strategy
              const result = await this.processFileWithStrategy(
                relativePath,
                strategy.fileAnalysis,
                strategy.chunkingStrategy
              );

              return {
                path: relativePath,
                success: true,
                result
              };
            } catch (error) {
              console.warn(`Error processing file ${relativePath}:`, error);
              return {
                path: relativePath,
                success: false,
                error
              };
            }
          });

          // Wait for all files in this batch to complete
          const batchResults = await Promise.all(processingPromises);

          // Process results and add to index
          for (const result of batchResults) {
            totalProcessed++;

            if (result.success && result.result) {
              const { symbols, dependencies } = result.result;

              // Add symbols to the index
              for (const symbol of symbols) {
                const symbolId = `${symbol.name}:${symbol.location.filePath}:${symbol.location.startLine}`;
                this.indexedCodebase.symbols[symbolId] = symbol;
              }

              // Add dependencies to the index
              this.indexedCodebase.dependencies.push(...dependencies);

              console.log(`Completed processing file ${result.path} (${totalProcessed}/${filePaths.length})`);
            }
          }

          // Add memory checkpoint after each parallel batch
          this.indexingAgent.performMemoryCheckpoint('parallel_batch_complete', {
            extension,
            batchSize: currentBatch.length,
            totalProcessed,
            total: filePaths.length
          }, true); // Force GC cleanup after each batch
        }

        // Add memory checkpoint after completing each file extension batch
        this.indexingAgent.performMemoryCheckpoint('after_extension_batch', {
          extension,
          filesProcessed: totalProcessed,
          totalInBatch: filePaths.length
        }, true); // Force GC cleanup after each extension batch
      }

      // Store list of indexed files
      this.indexedCodebase.files = filesToProcess
        .filter(f => !f.isDirectory)
        .map(f => path.relative(projectPath, f.path));

      // Update statistics
      this.indexedCodebase.statistics = {
        totalFiles: this.indexedCodebase.files.length,
        totalSymbols: Object.keys(this.indexedCodebase.symbols).length,
        totalDependencies: this.indexedCodebase.dependencies.length,
        lastIndexed: new Date(),
        cacheHits: this.cacheHits,
        cacheMisses: this.cacheMisses,
      };

      // Log cache statistics
      console.log(`File type strategy cache: ${this.cacheHits} hits, ${this.cacheMisses} misses, ${this.fileTypeStrategies.size} cached extensions`);

      // Store the index
      await this.saveIndex();

      return this.indexedCodebase;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      throw new Error(`Failed to index codebase with LLM-directed approach: ${errorMessage}`);
    }
  }

  /**
   * Create file filter based on the indexing strategy
   * Highly adaptable method that extracts file patterns and extensions
   * from any LLM response structure, without any assumptions
   */
  private createFileFilter(
    prioritizedFileTypes: any, // Use any type to handle different response structures
    suggestedExclusions: any   // Also accept any type for exclusions
  ): FileSystemFilter {
    console.log('[createFileFilter] Starting with input:',
      typeof prioritizedFileTypes === 'object' ?
        `${JSON.stringify(prioritizedFileTypes ?? 'null').substring(0, 100)}...` :
        String(prioritizedFileTypes));

    // Initialize collection for extensions
    
    let includeExtensions: string[] = [];

    try {
      // Handle null/undefined input gracefully
      if (prioritizedFileTypes === null || prioritizedFileTypes === undefined) {
        console.log('[createFileFilter] Input is null or undefined');
      }
      // First try array format handling
      else if (Array.isArray(prioritizedFileTypes)) {
        console.log(`[createFileFilter] Processing array with ${prioritizedFileTypes.length} items`);

        // Adaptive approach: examine array elements to determine what we're working with
        includeExtensions = prioritizedFileTypes.map(type => {
            try {
              // Process different object structures that may contain extensions
              if (typeof type === 'object' && type !== null) {
                // Check all common extension property names
                const extensionProperties = ['extension', 'fileType', 'ext', 'type', 'name'];
                for (const prop of extensionProperties) {
                  if (prop in type && type[prop] !== null) {
                    const extValue = type[prop];
                    if (typeof extValue === 'string') {
                      console.log(`[createFileFilter] Found extension in '${prop}' property: ${extValue}`);
                      return extValue;
                    }
                  }
                }

                // If no properties matched, check if the object itself is stringifiable as an extension
                const stringValue = String(type);
                if (stringValue && (stringValue.startsWith('.') || stringValue.includes('.'))) {
                  console.log(`[createFileFilter] Found extension in stringified object: ${stringValue}`);
                  return stringValue;
                }
              }
              // Handle direct string values
              else if (typeof type === 'string') {
                console.log(`[createFileFilter] Found string extension: ${type}`);
                return type;
              }
              // Handle number values that might be string indices
              else if (typeof type === 'number') {
                return null; // Skip numbers
              }

              return null; // Return null for items we can't process
            } catch (err) {
              console.warn(`[createFileFilter] Error processing array item: ${err instanceof Error ? err.message : String(err)}`);
              return null;
            }
          })
          .filter(Boolean) as string[]; // Remove null/undefined values
      }
      // Handle object format with recursive property search
      else if (typeof prioritizedFileTypes === 'object') {
        console.log('[createFileFilter] Processing object structure');

        // Helper function to recursively extract extensions from nested objects
        const extractExtensionsFromObject = (obj: any, depth = 0, path = ''): string[] => {
          if (obj === null || depth > 5) return []; // Limit recursion depth
          if (typeof obj !== 'object') return [];

          const extractedExtensions: string[] = [];

          // Process all properties of the object
          for (const key in obj) {
            try {
              const currentPath = path ? `${path}.${key}` : key;
              const value = obj[key];

              // Case 1: Extension-like keys
              if (typeof key === 'string' &&
                  (key.startsWith('.') || key.startsWith('*.') ||
                   ['extension', 'fileType', 'ext', 'extensions'].includes(key.toLowerCase()))) {
                const cleanKey = key.replace(/^\*\./, '.');
                if (cleanKey.startsWith('.')) {
                  console.log(`[createFileFilter] Found extension in key: ${cleanKey} at ${currentPath}`);
                  extractedExtensions.push(cleanKey);
                }
              }

              // Case 2: Extension-like string values
              if (typeof value === 'string') {
                // Check if string looks like an extension
                if (value.startsWith('.') ||
                    (value.includes('.') && !value.includes(' ') && value.length < 10)) {
                  console.log(`[createFileFilter] Found extension in value: ${value} at ${currentPath}`);
                  extractedExtensions.push(value);
                }
                // Check for common programming language names that could imply extensions
                else if (['typescript', 'javascript', 'python', 'ruby', 'java', 'c++', 'csharp'].includes(value.toLowerCase())) {
                  const langMap: Record<string, string> = {
                    'typescript': '.ts',
                    'javascript': '.js',
                    'python': '.py',
                    'ruby': '.rb',
                    'java': '.java',
                    'c++': '.cpp',
                    'c#': '.cs',
                    'csharp': '.cs'
                  };
                  const ext = langMap[value.toLowerCase()];
                  if (ext) {
                    console.log(`[createFileFilter] Converted language name to extension: ${value} → ${ext}`);
                    extractedExtensions.push(ext);
                  }
                }
              }

              // Case 3: Extension-like values in arrays
              if (Array.isArray(value)) {
                // Check for arrays of extensions
                if (value.length > 0 && value.every(item => typeof item === 'string')) {
                  const possibleExtensions = value
                    .filter(item =>
                      typeof item === 'string' &&
                      (item.startsWith('.') ||
                       (item.includes('.') && !item.includes(' ') && item.length < 10)))
                    .map(item => item.startsWith('.') ? item : `.${item}`);

                  if (possibleExtensions.length > 0) {
                    console.log(`[createFileFilter] Found extensions in array at ${currentPath}: ${possibleExtensions.join(', ')}`);
                    extractedExtensions.push(...possibleExtensions);
                  }
                }
              }

              // Case 4: Recursively process nested objects
              if (typeof value === 'object' && value !== null) {
                const nestedExtensions = extractExtensionsFromObject(value, depth + 1, currentPath);
                extractedExtensions.push(...nestedExtensions);
              }
            } catch (err) {
              console.warn(`[createFileFilter] Error processing object property ${key}: ${err instanceof Error ? err.message : String(err)}`);
            }
          }

          return extractedExtensions;
        };

        // Extract extensions from the object structure
        const extractedExtensions = extractExtensionsFromObject(prioritizedFileTypes);
        includeExtensions.push(...extractedExtensions);
      }

      // Deduplicate and clean up the extensions
      includeExtensions = [...new Set(includeExtensions)]
        .filter(Boolean)
        .map(ext => {
          // Clean up the extension format
          let cleaned = ext.trim();
          // Handle special cases like "*.ts" or "ts"
          cleaned = cleaned.replace(/^\*\./, '.');
          // Ensure extensions start with a dot
          cleaned = cleaned.startsWith('.') ? cleaned : `.${cleaned}`;
          return cleaned;
        });

      console.log(`[createFileFilter] Extracted ${includeExtensions.length} file extensions: ${includeExtensions.join(', ')}`);
    } catch (error) {
      console.error(`[createFileFilter] Error extracting extensions: ${error instanceof Error ? error.message : String(error)}`);
      console.error(`[createFileFilter] Input was: ${typeof prioritizedFileTypes} ${JSON.stringify(prioritizedFileTypes ?? 'null').substring(0, 100)}...`);
    }

    // Intelligent fallback if no extensions were found
    if (includeExtensions.length === 0) {
      // Infer project type from structure/data we have access to
      console.warn('[createFileFilter] No extensions found in LLM response, using smart defaults');

      // Load defaults based on project context
      let projectBasedDefaults: string[] = [];

      try {
        // You could enhance this with actual project detection logic
        // For now we'll use generic code file defaults
        projectBasedDefaults = ['.ts', '.tsx', '.js', '.jsx', '.json', '.md'];
      } catch (err) {
        console.warn(`[createFileFilter] Error determining project-based defaults: ${err instanceof Error ? err.message : String(err)}`);
      }

      includeExtensions = projectBasedDefaults;
      console.log(`[createFileFilter] Using project-based defaults: ${includeExtensions.join(', ')}`);
    }

    // Process exclusion patterns
    let exclusionPatterns: RegExp[] = [];
    try {
      // Ensure suggestedExclusions is an array and handle null values
      const exclusions = Array.isArray(suggestedExclusions) ? suggestedExclusions : [];

      // Log what we received
      console.log(`[createFileFilter] Processing ${exclusions.length} exclusion patterns`);

      // Process each exclusion pattern
      exclusionPatterns = exclusions
        .filter(pattern => pattern !== null && pattern !== undefined && pattern !== '')
        .map(pattern => {
          try {
            // Replace glob-like patterns with RegExp equivalents
            const regexPattern = String(pattern)
              .replace(/\./g, '\\.')
              .replace(/\*/g, '.*')
              .replace(/\?/g, '.');
            return new RegExp(regexPattern);
          } catch (err) {
            console.warn(`[createFileFilter] Error creating RegExp from pattern '${pattern}': ${err instanceof Error ? err.message : String(err)}`);
            return null;
          }
        })
        .filter(Boolean) as RegExp[];
    } catch (error) {
      console.error(`[createFileFilter] Error processing exclusions: ${error instanceof Error ? error.message : String(error)}`);
    }

    // Always include common exclusions regardless of LLM response
    const commonExclusions = [
      /node_modules/,
      /\.git/,
      /\.DS_Store/,
      /dist/,
      /build/,
      /\.guardian-ai/,
      /coverage/,
      /\.cache/
    ];

    // Log the final filter configuration
    console.log(`[createFileFilter] Final file filter configuration:`);
    console.log(`  - Include extensions (${includeExtensions.length}): ${includeExtensions.join(', ')}`);
    console.log(`  - Exclude patterns (${exclusionPatterns.length + commonExclusions.length}): ${
      [...exclusionPatterns, ...commonExclusions].map(p => p.toString()).join(', ')
    }`);

    // Return the completed filter
    return {
      includeExtensions,
      excludePatterns: [...exclusionPatterns, ...commonExclusions]
    };
  }

  /**
   * Analyze the structure of the codebase
   */
  private async analyzeCodebaseStructure(
    projectPath: string,
    options?: IndexingOptions
  ): Promise<{
    fileTypes: Record<string, number>;
    directoryStructure: Record<string, number>;
    sampleFiles: Array<{ path: string; size: number; snippet?: string }>;
  }> {
    try {
      // Filter for initial analysis
      const filter: FileSystemFilter = {
        excludePatterns: [
          /node_modules/,
          /\.git/,
          /\.DS_Store/,
          /dist/,
          /build/,
          /\.guardian-ai/
        ]
      };

      // If specific include patterns were provided, use them
      if (options?.includePatterns) {
        filter.includePatterns = options.includePatterns;
      }

      // If specific exclude patterns were provided, add them
      if (options?.excludePatterns) {
        filter.excludePatterns = [
          ...(filter.excludePatterns || []),
          ...options.excludePatterns
        ];
      }

      // List all files in the project
      const files = await this.fileSystem.listFiles(projectPath, true, filter);

      // Count file types
      const fileTypes: Record<string, number> = {};
      for (const file of files) {
        if (!file.isDirectory) {
          const extension = path.extname(file.path).toLowerCase();
          fileTypes[extension] = (fileTypes[extension] || 0) + 1;
        }
      }

      // Analyze directory structure
      const directoryStructure: Record<string, number> = {};
      for (const file of files) {
        if (!file.isDirectory) {
          const dirPath = path.dirname(path.relative(projectPath, file.path));
          directoryStructure[dirPath] = (directoryStructure[dirPath] || 0) + 1;
        }
      }

      // Get samples of the most common file types
      const sampleFiles: Array<{ path: string; size: number; snippet?: string }> = [];

      // Get the top 5 file types
      const topFileTypes = Object.entries(fileTypes)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 5)
        .map(([ext]) => ext);

      // For each top file type, get up to 2 sample files
      for (const ext of topFileTypes) {
        const typeFiles = files.filter(f => !f.isDirectory && path.extname(f.path).toLowerCase() === ext);

        // Sort by size (prefer medium-sized files, not too small, not too large)
        const sortedFiles = typeFiles.sort((a, b) => {
          // Prefer files between 1KB and 10KB
          const aScore = Math.abs(a.size - 5000);
          const bScore = Math.abs(b.size - 5000);
          return aScore - bScore;
        });

        // Take up to 2 files
        const samples = sortedFiles.slice(0, 2);

        for (const sample of samples) {
          try {
            const relativePath = path.relative(projectPath, sample.path);
            const fileContent = await this.fileSystem.readFile(sample.path);
            const lines = fileContent.content.split('\n');
            const snippet = lines.slice(0, Math.min(20, lines.length)).join('\n');

            sampleFiles.push({
              path: relativePath,
              size: sample.size,
              snippet
            });
          } catch (error) {
            console.warn(`Error getting snippet for ${sample.path}:`, error);
            sampleFiles.push({
              path: path.relative(projectPath, sample.path),
              size: sample.size
            });
          }
        }
      }

      return { fileTypes, directoryStructure, sampleFiles };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      throw new Error(`Failed to analyze codebase structure: ${errorMessage}`);
    }
  }

  /**
   * Update the index for specific files
   */
  async updateIndex(files: string[]): Promise<void> {
    try {
      if (!this.indexingAgent) {
        throw new Error('Indexing agent not initialized. Please index the codebase first.');
      }

      for (const file of files) {
        // const fullPath = path.join(this.projectRoot, file); // Not needed

        try {
          console.log(`Updating index for file: ${file}`);
          const { symbols, dependencies } = await this.indexingAgent.processFile(file);

          // Remove existing symbols for this file
          for (const symbolId in this.indexedCodebase.symbols) {
            if (this.indexedCodebase.symbols[symbolId]?.location?.filePath === file) {
              delete this.indexedCodebase.symbols[symbolId];
            }
          }

          // Remove existing dependencies for this file
          this.indexedCodebase.dependencies = this.indexedCodebase.dependencies.filter(
            dep => dep.source !== file
          );

          // Add new symbols to the index
          for (const symbol of symbols) {
            const symbolId = `${symbol.name}:${symbol.location.filePath}:${symbol.location.startLine}`;
            this.indexedCodebase.symbols[symbolId] = symbol;
          }

          // Add new dependencies to the index
          this.indexedCodebase.dependencies.push(...dependencies);
        } catch (error) {
          console.warn(`Error updating index for file ${file}:`, error);
          // Continue with next file
        }
      }

      // Update statistics
      this.indexedCodebase.statistics = {
        totalFiles: this.indexedCodebase.files.length,
        totalSymbols: Object.keys(this.indexedCodebase.symbols).length,
        totalDependencies: this.indexedCodebase.dependencies.length,
        lastIndexed: new Date(),
        cacheHits: this.cacheHits,
        cacheMisses: this.cacheMisses,
      };

      // Log cache statistics
      console.log(`File type strategy cache: ${this.cacheHits} hits, ${this.cacheMisses} misses, ${this.fileTypeStrategies.size} cached extensions`);

      // Save the updated index
      await this.saveIndex();
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      throw new Error(`Failed to update index: ${errorMessage}`);
    }
  }

  /**
   * Find symbols matching a query
   */
  async findSymbols(query: string): Promise<CodeSymbol[]> {
    const queryLower = query.toLowerCase();
    return Object.values(this.indexedCodebase.symbols)
      .filter(symbol => symbol.name.toLowerCase().includes(queryLower));
  }

  /**
   * Get the current index
   */
  async getIndex(): Promise<IndexedCodebase> {
    return this.indexedCodebase;
  }

  /**
   * Save the current index to persistent storage
   */
  async saveIndex(): Promise<void> {
    try {
      if (!this.projectRoot) {
        throw new Error('Project root not set');
      }

      const indexDir = path.join(this.projectRoot, '.guardian-ai');
      const indexPath = path.join(indexDir, 'llm-directed-index.json');

      // Ensure directory exists
      await fs.ensureDir(indexDir);

      // Convert dates to strings for JSON serialization
      const serializedIndex = {
        ...this.indexedCodebase,
        statistics: {
          ...this.indexedCodebase.statistics,
          lastIndexed: typeof this.indexedCodebase.statistics.lastIndexed === 'string'
            ? this.indexedCodebase.statistics.lastIndexed
            : this.indexedCodebase.statistics.lastIndexed.toISOString()
        }
      };

      // Write the index file
      await fs.writeJson(indexPath, serializedIndex, { spaces: 2 });
      console.log(`LLM-directed index saved to ${indexPath}`);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      throw new Error(`Failed to save index: ${errorMessage}`);
    }
  }

  /**
   * Load an index from persistent storage
   */
  async loadIndex(projectPath: string): Promise<IndexedCodebase> {
    try {
      this.projectRoot = projectPath;

      const indexPath = path.join(projectPath, '.guardian-ai', 'llm-directed-index.json');

      // Check if the index file exists
      if (!await fs.pathExists(indexPath)) {
        throw new Error(`LLM-directed index file not found at ${indexPath}`);
      }

      // Read and parse the index file
      const serializedIndex = await fs.readJson(indexPath);

      // Convert date strings back to Date objects
      this.indexedCodebase = {
        ...serializedIndex,
        statistics: {
          ...serializedIndex.statistics,
          lastIndexed: new Date(serializedIndex.statistics.lastIndexed)
        }
      };

      // Recreate the indexing agent
      this.indexingAgent = new IndexingAgent(this.llmService, this.fileSystem, projectPath);

      console.log(`Loaded LLM-directed index from ${indexPath}`);
      return this.indexedCodebase;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      throw new Error(`Failed to load index: ${errorMessage}`);
    }
  }
}
