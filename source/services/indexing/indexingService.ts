// source/services/indexing/indexingService.ts
import * as path from 'path';
import * as fs from 'fs-extra';
import {
  IndexingService,
  IndexedCodebase,
  CodeSymbol,
  IndexingOptions,
  CodeDependency
} from './types.js';
import { FileSystemService, FileSystemFilter } from '../fileSystem/types.js';

/**
 * Implementation of the Tree-sitter based code indexing service
 */
export class TreeSitterIndexingService implements IndexingService {
  private fileSystem: FileSystemService;
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

  constructor(fileSystem: FileSystemService) {
    this.fileSystem = fileSystem;
  }

  /**
   * Index a codebase and extract symbols and dependencies
   */
  async indexCodebase(
    projectPath: string,
    options?: IndexingOptions
  ): Promise<IndexedCodebase> {
    try {
      this.projectRoot = projectPath;
      console.log(`Indexing codebase at ${projectPath}`);
      
      // Create a fresh index
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

      // Filter for code files
      const filter: FileSystemFilter = {
        excludePatterns: [
          /node_modules/,
          /\.git/,
          /\.DS_Store/,
          /dist/,
          /build/,
          /\.guardian-ai/
        ],
        includeExtensions: [
          '.js', '.jsx', '.ts', '.tsx', '.py', '.java', '.c', '.cpp',
          '.cs', '.go', '.rb', '.php', '.swift', '.rs'
        ]
      };

      // Customize filter based on options
      if (options?.includePatterns) {
        filter.includePatterns = options.includePatterns;
      }
      
      if (options?.excludePatterns) {
        filter.excludePatterns = [
          ...(filter.excludePatterns || []),
          ...options.excludePatterns
        ];
      }

      // List all code files in the project
      const files = await this.fileSystem.listFiles(projectPath, true, filter);
      console.log(`Found ${files.length} code files to index`);

      // Apply max files limit if specified
      const filesToProcess = options?.maxFiles 
        ? files.slice(0, options.maxFiles) 
        : files;
      
      // Process each file
      for (const file of filesToProcess) {
        if (!file.isDirectory) {
          await this.processFile(file.path, options);
        }
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
        lastIndexed: new Date()
      };

      // Store the index
      await this.saveIndex();

      return this.indexedCodebase;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      throw new Error(`Failed to index codebase: ${errorMessage}`);
    }
  }

  /**
   * Process a single file and extract symbols and dependencies
   */
  private async processFile(
    filePath: string,
    _options?: IndexingOptions
  ): Promise<void> {
    try {
      // Read file content
      const fileContent = await this.fileSystem.readFile(filePath);
      
      // Extract file extension to determine language
      const extension = path.extname(filePath).toLowerCase();
      
      // Get relative path to project root
      const relativePath = path.relative(this.projectRoot, filePath);
      
      // Mock simple parsing for now (in a real implementation, this would use Tree-sitter)
      const symbols = this.mockParseFile(relativePath, fileContent.content, extension);
      
      // Add symbols to the index
      for (const symbol of symbols) {
        const symbolId = `${symbol.name}:${symbol.location.filePath}:${symbol.location.startLine}`;
        this.indexedCodebase.symbols[symbolId] = symbol;
      }
      
      // Mock dependencies (in a real implementation, this would be more sophisticated)
      const dependencies = this.mockExtractDependencies(relativePath, fileContent.content, extension);
      this.indexedCodebase.dependencies.push(...dependencies);
      
    } catch (error) {
      console.warn(`Error processing file ${filePath}: ${error}`);
      // Continue with next file
    }
  }

  /**
   * Mock implementation of file parsing (would use Tree-sitter in full implementation)
   */
  private mockParseFile(
    filePath: string, 
    content: string, 
    extension: string
  ): CodeSymbol[] {
    const symbols: CodeSymbol[] = [];
    
    // Very basic mock parsing based on file extension
    if (['.js', '.jsx', '.ts', '.tsx'].includes(extension)) {
      // Simple regex-based extraction of JavaScript/TypeScript symbols
      // Functions
      const functionMatches = content.matchAll(/function\s+(\w+)\s*\(([^)]*)\)/g);
      for (const match of functionMatches) {
        const name = match[1] || '';
        const lineIndex = this.findLineIndex(content, match.index || 0);

        symbols.push({
          name,
          type: 'function',
          location: {
            filePath,
            startLine: lineIndex,
            endLine: lineIndex + 5, // Arbitrary end line
            startColumn: 0,
            endColumn: 0
          },
          signature: `function ${name}(${match[2] || ''})`,
        });
      }
      
      // Classes
      const classMatches = content.matchAll(/class\s+(\w+)/g);
      for (const match of classMatches) {
        const name = match[1] || '';
        const lineIndex = this.findLineIndex(content, match.index || 0);

        symbols.push({
          name,
          type: 'class',
          location: {
            filePath,
            startLine: lineIndex,
            endLine: lineIndex + 10, // Arbitrary end line
            startColumn: 0,
            endColumn: 0
          }
        });
      }
      
      // Interfaces (TypeScript)
      if (['.ts', '.tsx'].includes(extension)) {
        const interfaceMatches = content.matchAll(/interface\s+(\w+)/g);
        for (const match of interfaceMatches) {
          const name = match[1] || '';
          const lineIndex = this.findLineIndex(content, match.index || 0);

          symbols.push({
            name,
            type: 'interface',
            location: {
              filePath,
              startLine: lineIndex,
              endLine: lineIndex + 5, // Arbitrary end line
              startColumn: 0,
              endColumn: 0
            }
          });
        }
      }
    } else if (extension === '.py') {
      // Basic Python symbol extraction
      const functionMatches = content.matchAll(/def\s+(\w+)\s*\(([^)]*)\):/g);
      for (const match of functionMatches) {
        const name = match[1] || '';
        const lineIndex = this.findLineIndex(content, match.index || 0);

        symbols.push({
          name,
          type: 'function',
          location: {
            filePath,
            startLine: lineIndex,
            endLine: lineIndex + 5, // Arbitrary end line
            startColumn: 0,
            endColumn: 0
          },
          signature: `def ${name}(${match[2] || ''})`,
        });
      }
      
      // Python classes
      const classMatches = content.matchAll(/class\s+(\w+)/g);
      for (const match of classMatches) {
        const name = match[1] || '';
        const lineIndex = this.findLineIndex(content, match.index || 0);

        symbols.push({
          name,
          type: 'class',
          location: {
            filePath,
            startLine: lineIndex,
            endLine: lineIndex + 10, // Arbitrary end line
            startColumn: 0,
            endColumn: 0
          }
        });
      }
    }
    
    return symbols;
  }

  /**
   * Mock extraction of dependencies
   */
  private mockExtractDependencies(
    filePath: string, 
    content: string, 
    extension: string
  ): CodeDependency[] {
    const dependencies: CodeDependency[] = [];
    
    // Very basic mock dependency extraction
    if (['.js', '.jsx', '.ts', '.tsx'].includes(extension)) {
      // Look for imports
      const importMatches = content.matchAll(/import\s+(?:(\w+)|{([^}]+)})\s+from\s+['"]([^'"]+)['"]/g);
      for (const match of importMatches) {
        const source = filePath;
        // const importName = match[1] || match[2]; // Not used
        const target = match[3];
        
        dependencies.push({
          source,
          target: target || '',
          type: 'import'
        });
      }
    } else if (extension === '.py') {
      // Python imports
      const importMatches = content.matchAll(/(?:import|from)\s+(\w+)/g);
      for (const match of importMatches) {
        dependencies.push({
          source: filePath,
          target: match[1] || '',
          type: 'import'
        });
      }
    }
    
    return dependencies;
  }

  /**
   * Find the line index for a character position
   */
  private findLineIndex(content: string, position: number): number {
    const lines = content.substring(0, position).split('\n');
    return lines.length;
  }

  /**
   * Update the index for a specific set of files
   */
  async updateIndex(files: string[]): Promise<void> {
    try {
      for (const file of files) {
        const fullPath = path.join(this.projectRoot, file);
        await this.processFile(fullPath);
      }
      
      // Update statistics
      this.indexedCodebase.statistics = {
        totalFiles: this.indexedCodebase.files.length,
        totalSymbols: Object.keys(this.indexedCodebase.symbols).length,
        totalDependencies: this.indexedCodebase.dependencies.length,
        lastIndexed: new Date()
      };
      
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
      const indexPath = path.join(indexDir, 'codebase-index.json');
      
      // Ensure directory exists
      await fs.ensureDir(indexDir);
      
      // Convert dates to strings for JSON serialization
      const serializedIndex = {
        ...this.indexedCodebase,
        statistics: {
          ...this.indexedCodebase.statistics,
          lastIndexed: typeof this.indexedCodebase.statistics.lastIndexed === 'string' ? this.indexedCodebase.statistics.lastIndexed : this.indexedCodebase.statistics.lastIndexed.toISOString()
        }
      };
      
      // Write the index file
      await fs.writeJson(indexPath, serializedIndex, { spaces: 2 });
      console.log(`Index saved to ${indexPath}`);
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
      
      const indexPath = path.join(projectPath, '.guardian-ai', 'codebase-index.json');
      
      // Check if the index file exists
      if (!await fs.pathExists(indexPath)) {
        throw new Error(`Index file not found at ${indexPath}`);
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
      
      console.log(`Loaded index from ${indexPath}`);
      return this.indexedCodebase;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      throw new Error(`Failed to load index: ${errorMessage}`);
    }
  }
}