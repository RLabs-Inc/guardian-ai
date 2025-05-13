/**
 * Hierarchical Indexing Service implementation
 * 
 * This service provides a sophisticated approach to code indexing using:
 * - Hash-based change detection
 * - AST-aware code parsing
 * - Multi-level hierarchy for files, directories, and code structures
 */

import path from 'path';
import crypto from 'crypto';

import {
  IndexNode,
  IndexNodeType,
  IndexRelationship,
  IndexingOptions,
  IndexingResult,
  IndexQuery,
  HierarchicalIndexingService as IHierarchicalIndexingService
} from './types.js';

import { FileSystemService } from '../../fileSystem/types.js';
import { AstParser } from './astParser.js';
import { HashTracker } from './hashTracker.js';
import { RelationshipDetector } from './relationshipDetector.js';
import { IndexStorage } from './indexStorage.js';

const DEFAULT_INDEXING_OPTIONS: IndexingOptions = {
  incremental: true,
  exclude: ['node_modules', '.git', 'dist', 'build'],
  includeAst: true,
  extractRelationships: true,
  generateEmbeddings: false
};

/**
 * Implementation of the hierarchical indexing service
 */
export class HierarchicalIndexingService implements IHierarchicalIndexingService {
  private fileSystem: FileSystemService;
  private astParser: AstParser;
  private hashTracker: HashTracker;
  // @ts-ignore: Will be used in the future
  private relationshipDetector: RelationshipDetector;
  private indexStorage: IndexStorage;
  
  constructor(
    fileSystem: FileSystemService, 
    astParser: AstParser, 
    hashTracker: HashTracker,
    relationshipDetector: RelationshipDetector,
    indexStorage: IndexStorage
  ) {
    this.fileSystem = fileSystem;
    this.astParser = astParser;
    this.hashTracker = hashTracker;
    this.relationshipDetector = relationshipDetector;
    this.indexStorage = indexStorage;
  }
  
  /**
   * Index a project
   * @param projectRoot Path to the project root
   * @param options Indexing options
   */
  async indexProject(
    projectRoot: string, 
    options?: Partial<IndexingOptions>
  ): Promise<IndexingResult> {
    const startTime = Date.now();
    const mergedOptions = { ...DEFAULT_INDEXING_OPTIONS, ...options };
    
    console.log(`Starting full indexing of ${projectRoot}`);
    
    // Create the project root node
    const projectNode: IndexNode = {
      id: crypto.randomUUID(),
      type: IndexNodeType.PROJECT,
      name: path.basename(projectRoot),
      contentHash: '', // Will be computed after children
      path: '/',
      metadata: {},
      children: [],
      lastIndexed: Date.now()
    };
    
    // Process the directory structure
    await this.processDirectory(projectRoot, projectNode, '', mergedOptions);
    
    // Compute the project hash based on all children
    projectNode.contentHash = this.hashTracker.computeNodeHash(projectNode);
    
    // Extract relationships between nodes if enabled
    const relationships: IndexRelationship[] = [];
    if (mergedOptions.extractRelationships) {
      await this.extractRelationships(projectNode, relationships);
    }
    
    // Gather statistics
    const stats = this.collectStats(projectNode, relationships, startTime);
    
    return {
      root: projectNode,
      stats
    };
  }
  
  /**
   * Update an existing index incrementally
   * @param projectRoot Path to the project root
   * @param existingIndex Existing index root node
   * @param options Indexing options
   */
  async updateIndex(
    projectRoot: string, 
    existingIndex: IndexNode, 
    options?: Partial<IndexingOptions>
  ): Promise<IndexingResult> {
    const startTime = Date.now();
    const mergedOptions = { ...DEFAULT_INDEXING_OPTIONS, ...options };
    
    if (!mergedOptions.incremental) {
      // If incremental is disabled, just do a full index
      return this.indexProject(projectRoot, options);
    }
    
    console.log(`Starting incremental indexing of ${projectRoot}`);
    
    // Clone the existing index to avoid modifying the original
    const updatedIndex = this.cloneIndexNode(existingIndex);
    
    // Track changes
    const changes = {
      added: [] as string[],
      modified: [] as string[],
      deleted: [] as string[]
    };
    
    // Update the directory structure
    await this.updateDirectory(projectRoot, updatedIndex, '', mergedOptions, changes);
    
    // Recompute all hashes in the tree
    this.hashTracker.updateNodeHash(updatedIndex);
    
    // Extract relationships between nodes if enabled
    const relationships: IndexRelationship[] = [];
    if (mergedOptions.extractRelationships) {
      await this.extractRelationships(updatedIndex, relationships, true);
    }
    
    // Gather statistics
    const stats = this.collectStats(updatedIndex, relationships, startTime);
    
    // Add change information to stats
    stats.filesAdded = changes.added.length;
    stats.filesModified = changes.modified.length;
    stats.filesDeleted = changes.deleted.length;
    
    return {
      root: updatedIndex,
      stats: stats as any
    };
  }
  
  /**
   * Query the index for nodes matching specific criteria
   * @param index Index root node
   * @param query Query parameters
   */
  async queryIndex(index: IndexNode, query: IndexQuery): Promise<IndexNode[]> {
    // Start with all nodes in a flat array
    const allNodes = this.flattenNodes(index);
    
    // Filter based on query criteria
    let results = allNodes.filter(node => {
      // Filter by node type if specified
      if (query.nodeType) {
        if (Array.isArray(query.nodeType)) {
          if (!query.nodeType.includes(node.type)) return false;
        } else if (node.type !== query.nodeType) {
          return false;
        }
      }
      
      // Filter by path pattern if specified
      if (query.pathPattern) {
        if (query.pathPattern instanceof RegExp) {
          if (!query.pathPattern.test(node.path)) return false;
        } else if (!node.path.includes(query.pathPattern)) {
          return false;
        }
      }
      
      // Filter by name pattern if specified
      if (query.namePattern) {
        if (query.namePattern instanceof RegExp) {
          if (!query.namePattern.test(node.name)) return false;
        } else if (!node.name.includes(query.namePattern)) {
          return false;
        }
      }
      
      // Filter by content pattern if specified
      if (query.contentPattern && typeof node.content === 'string') {
        if (query.contentPattern instanceof RegExp) {
          if (!query.contentPattern.test(node.content)) return false;
        } else if (!node.content.includes(query.contentPattern)) {
          return false;
        }
      }
      
      // Apply custom filter if specified
      if (query.filter && !query.filter(node)) {
        return false;
      }
      
      return true;
    });
    
    // Apply relationship filtering if specified
    if (query.relationship) {
      // This would require the relationship data which we haven't fully implemented yet
      // For now, this is a placeholder
      console.log('Relationship filtering not yet implemented');
    }
    
    // Apply limit if specified
    if (query.limit && query.limit > 0 && results.length > query.limit) {
      results = results.slice(0, query.limit);
    }
    
    return results;
  }
  
  /**
   * Save the index to storage
   * @param index Index to save
   * @param path Path where to save the index
   */
  async saveIndex(index: IndexNode, path: string): Promise<void> {
    return this.indexStorage.saveIndex(index, path);
  }
  
  /**
   * Load an index from storage
   * @param path Path to the stored index
   */
  async loadIndex(path: string): Promise<IndexNode> {
    return this.indexStorage.loadIndex(path);
  }
  
  /**
   * Process a directory and its contents recursively
   * @private
   */
  private async processDirectory(
    dirPath: string,
    parentNode: IndexNode,
    relativePath: string,
    options: IndexingOptions
  ): Promise<void> {
    // Read directory contents
    const entries = await this.fileSystem.readDirectory(dirPath);
    // Convert to array of objects with name property
    const entriesWithNames = entries.map(name => ({ name }));
    
    // Process each entry
    for (const entry of entriesWithNames) {
      const entryName = entry.name;
      const entryPath = path.join(dirPath, entryName);
      const entryRelativePath = path.join(relativePath, entryName);
      
      // Skip excluded patterns
      if (this.shouldExclude(entryRelativePath, options.exclude)) {
        continue;
      }
      
      // Check if it's a directory or file
      const stats = await this.fileSystem.stat(entryPath);
      
      if (stats.isDirectory) {
        // Create a directory node
        const dirNode: IndexNode = {
          id: crypto.randomUUID(),
          type: IndexNodeType.DIRECTORY,
          name: entryName,
          contentHash: '', // Will be computed after children
          path: entryRelativePath,
          metadata: {
            size: stats.size,
            created: stats.created,
            modified: stats.modified
          },
          children: [],
          lastIndexed: Date.now(),
          parent: {
            id: parentNode.id,
            type: parentNode.type
          }
        };
        
        // Add to parent's children
        parentNode.children = parentNode.children || [];
        parentNode.children.push(dirNode);
        
        // Process the subdirectory recursively
        await this.processDirectory(entryPath, dirNode, entryRelativePath, options);
        
        // Compute the directory hash based on its children
        dirNode.contentHash = this.hashTracker.computeNodeHash(dirNode);
      } else if (!stats.isDirectory) { // If not a directory, treat as a file
        // Process the file
        await this.processFile(entryPath, parentNode, entryRelativePath, options);
      }
    }
  }
  
  /**
   * Process a file and extract its structure
   * @private
   */
  private async processFile(
    filePath: string,
    parentNode: IndexNode,
    relativePath: string,
    options: IndexingOptions
  ): Promise<void> {
    try {
      // Read file content
      const fileContent = await this.fileSystem.readFile(filePath);
      const content = fileContent.content;

      // Compute content hash
      const contentHash = crypto.createHash('sha256').update(content).digest('hex');
      
      // Create file node
      const fileNode: IndexNode = {
        id: crypto.randomUUID(),
        type: IndexNodeType.FILE,
        name: path.basename(filePath),
        contentHash,
        path: relativePath,
        metadata: {
          extension: path.extname(filePath),
          size: Buffer.byteLength(content),
          lineCount: content.split('\n').length
        },
        children: [],
        content: {
          reference: filePath,
          referenceType: 'file'
        },
        lastIndexed: Date.now(),
        parent: {
          id: parentNode.id,
          type: parentNode.type
        }
      };
      
      // Add to parent's children
      parentNode.children = parentNode.children || [];
      parentNode.children.push(fileNode);
      
      // Parse file structure if AST parsing is enabled
      if (options.includeAst) {
        await this.parseFileStructure(filePath, content, fileNode, options);
      }
    } catch (error) {
      console.error(`Error processing file ${filePath}:`, error);
    }
  }
  
  /**
   * Parse a file's structure using the AST parser
   * @private
   */
  private async parseFileStructure(
    filePath: string,
    content: string,
    fileNode: IndexNode,
    _options: IndexingOptions
  ): Promise<void> {
    try {
      // Only parse supported file types
      const extension = path.extname(filePath).toLowerCase();
      if (!this.astParser.isSupportedFileType(extension)) {
        return;
      }
      
      // Parse the file
      const ast = await this.astParser.parseFile(filePath, content);
      
      // Extract structure from AST and add as children to the file node
      const symbols = await this.astParser.extractSymbols(ast, filePath);
      
      // Convert symbols to index nodes
      for (const symbol of symbols) {
        const symbolNode: IndexNode = {
          id: crypto.randomUUID(),
          type: this.mapSymbolTypeToNodeType(symbol.type),
          name: symbol.name,
          contentHash: crypto.createHash('sha256').update(symbol.content || '').digest('hex'),
          path: `${fileNode.path}#${symbol.name}`,
          metadata: {
            ...symbol.metadata,
            location: symbol.location
          },
          content: symbol.content,
          lastIndexed: Date.now(),
          parent: {
            id: fileNode.id,
            type: fileNode.type
          }
        };
        
        // Add children if the symbol has nested symbols
        if (symbol.children && symbol.children.length > 0) {
          symbolNode.children = [];
          this.processNestedSymbols(symbol.children, symbolNode);
        }
        
        if (!fileNode.children) {
          fileNode.children = [];
        }
        fileNode.children.push(symbolNode);
      }
    } catch (error) {
      console.error(`Error parsing file structure for ${filePath}:`, error);
    }
  }
  
  /**
   * Process nested symbols recursively
   * @private
   */
  private processNestedSymbols(
    symbols: any[],
    parentNode: IndexNode
  ): void {
    for (const symbol of symbols) {
      const symbolNode: IndexNode = {
        id: crypto.randomUUID(),
        type: this.mapSymbolTypeToNodeType(symbol.type),
        name: symbol.name,
        contentHash: crypto.createHash('sha256').update(symbol.content || '').digest('hex'),
        path: `${parentNode.path}#${symbol.name}`,
        metadata: {
          ...symbol.metadata,
          location: symbol.location
        },
        content: symbol.content,
        lastIndexed: Date.now(),
        parent: {
          id: parentNode.id,
          type: parentNode.type
        }
      };
      
      // Process nested symbols recursively
      if (symbol.children && symbol.children.length > 0) {
        symbolNode.children = [];
        this.processNestedSymbols(symbol.children, symbolNode);
      }
      
      if (!parentNode.children) {
        parentNode.children = [];
      }
      parentNode.children.push(symbolNode);
    }
  }
  
  /**
   * Update a directory incrementally
   * @private
   */
  private async updateDirectory(
    dirPath: string,
    dirNode: IndexNode,
    relativePath: string,
    options: IndexingOptions,
    changes: { added: string[], modified: string[], deleted: string[] }
  ): Promise<void> {
    // Read current directory contents
    const entries = await this.fileSystem.readDirectory(dirPath);
    // Convert to array of objects with name property
    const entriesWithNames = entries.map(name => ({ name }));
    const currentEntries = new Set(entries);
    
    // Track existing children in the index
    const existingChildren = new Map<string, IndexNode>();
    if (dirNode.children) {
      for (const child of dirNode.children) {
        existingChildren.set(child.name, child);
      }
    }
    
    // Check for deleted items
    for (const [name, node] of existingChildren.entries()) {
      if (!currentEntries.has(name)) {
        // This node no longer exists in the filesystem
        changes.deleted.push(node.path);
        // Remove from children
        if (dirNode.children) {
          dirNode.children = dirNode.children.filter(child => child.name !== name);
        }
      }
    }
    
    // Process each current entry
    for (const entry of entriesWithNames) {
      const entryName = entry.name;
      const entryPath = path.join(dirPath, entryName);
      const entryRelativePath = path.join(relativePath, entryName);
      
      // Skip excluded patterns
      if (this.shouldExclude(entryRelativePath, options.exclude)) {
        continue;
      }
      
      // Check if it's a directory or file
      const stats = await this.fileSystem.stat(entryPath);
      const existingNode = existingChildren.get(entryName);
      
      if (stats.isDirectory) {
        if (existingNode && existingNode.type === IndexNodeType.DIRECTORY) {
          // Directory exists, update it recursively
          await this.updateDirectory(
            entryPath, 
            existingNode, 
            entryRelativePath, 
            options, 
            changes
          );
        } else {
          // New directory or type changed, create a new node
          const newDirNode: IndexNode = {
            id: crypto.randomUUID(),
            type: IndexNodeType.DIRECTORY,
            name: entryName,
            contentHash: '', // Will be computed after children
            path: entryRelativePath,
            metadata: {
              size: stats.size,
              created: stats.created,
              modified: stats.modified
            },
            children: [],
            lastIndexed: Date.now(),
            parent: {
              id: dirNode.id,
              type: dirNode.type
            }
          };
          
          // Add to parent's children
          dirNode.children = dirNode.children || [];
          dirNode.children.push(newDirNode);
          changes.added.push(entryRelativePath);

          // Process the subdirectory recursively
          await this.processDirectory(entryPath, newDirNode, entryRelativePath, options);

          // Compute the directory hash based on its children
          newDirNode.contentHash = this.hashTracker.computeNodeHash(newDirNode);
        }
      } else if (!stats.isDirectory) { // If not a directory, treat as a file
        // Read file content for hash comparison
        const fileContent = await this.fileSystem.readFile(entryPath);
        const content = fileContent.content;
        const contentHash = crypto.createHash('sha256').update(content).digest('hex');
        
        if (existingNode && existingNode.type === IndexNodeType.FILE) {
          // File exists, check if modified
          if (existingNode.contentHash !== contentHash) {
            // File was modified, update it
            changes.modified.push(entryRelativePath);
            await this.processFile(entryPath, dirNode, entryRelativePath, options);
          }
        } else {
          // New file or type changed, create a new node
          changes.added.push(entryRelativePath);
          await this.processFile(entryPath, dirNode, entryRelativePath, options);
        }
      }
    }
    
    // Update the directory hash
    dirNode.contentHash = this.hashTracker.computeNodeHash(dirNode);
  }
  
  /**
   * Extract relationships between nodes
   * @private
   */
  private async extractRelationships(
    _rootNode: IndexNode,
    _relationships: IndexRelationship[],
    _incrementalOnly: boolean = false
  ): Promise<void> {
    // This would be implemented with the RelationshipDetector
    // For now, just log a placeholder
    console.log('Relationship extraction not yet fully implemented');
  }
  
  /**
   * Collect statistics about the indexing operation
   * @private
   */
  private collectStats(
    rootNode: IndexNode,
    relationships: IndexRelationship[],
    startTime: number
  ): any {
    // Count various node types
    const counts = {
      filesIndexed: 0,
      directoriesIndexed: 0,
      symbolsExtracted: 0
    };
    
    // Helper function to count recursively
    const countNodes = (node: IndexNode) => {
      if (node.type === IndexNodeType.FILE) {
        counts.filesIndexed++;
      } else if (node.type === IndexNodeType.DIRECTORY) {
        counts.directoriesIndexed++;
      } else {
        counts.symbolsExtracted++;
      }
      
      if (node.children) {
        for (const child of node.children) {
          countNodes(child);
        }
      }
    };
    
    // Start counting from the root
    countNodes(rootNode);
    
    return {
      ...counts,
      relationshipsExtracted: relationships.length,
      timeTakenMs: Date.now() - startTime,
      memoryUsageBytes: process.memoryUsage().heapUsed
    };
  }
  
  /**
   * Check if a path should be excluded
   * @private
   */
  private shouldExclude(relativePath: string, excludePatterns?: string[]): boolean {
    if (!excludePatterns || excludePatterns.length === 0) {
      return false;
    }
    
    for (const pattern of excludePatterns) {
      if (relativePath.includes(pattern)) {
        return true;
      }
    }
    
    return false;
  }
  
  /**
   * Map symbol types to index node types
   * @private
   */
  private mapSymbolTypeToNodeType(symbolType: string): IndexNodeType {
    switch (symbolType.toLowerCase()) {
      case 'class': return IndexNodeType.CLASS;
      case 'function': return IndexNodeType.FUNCTION;
      case 'method': return IndexNodeType.METHOD;
      case 'variable': return IndexNodeType.VARIABLE;
      case 'interface': return IndexNodeType.INTERFACE;
      case 'type': return IndexNodeType.TYPE;
      case 'import': return IndexNodeType.IMPORT;
      case 'export': return IndexNodeType.EXPORT;
      default: return IndexNodeType.BLOCK;
    }
  }
  
  /**
   * Clone an index node (deep copy)
   * @private
   */
  private cloneIndexNode(node: IndexNode): IndexNode {
    const clone: IndexNode = {
      ...node,
      metadata: { ...node.metadata },
      parent: node.parent ? { ...node.parent } : undefined,
      children: node.children ? [] : undefined
    };
    
    // Handle content reference
    if (typeof node.content === 'object' && node.content !== null) {
      clone.content = { ...node.content };
    } else {
      clone.content = node.content;
    }
    
    // Clone children recursively
    if (node.children) {
      for (const child of node.children) {
        const childClone = this.cloneIndexNode(child);
        childClone.parent = {
          id: clone.id,
          type: clone.type
        };
        if (clone.children) {
          clone.children.push(childClone);
        }
      }
    }
    
    return clone;
  }
  
  /**
   * Flatten the index tree into an array of nodes
   * @private
   */
  private flattenNodes(rootNode: IndexNode): IndexNode[] {
    const result: IndexNode[] = [rootNode];
    
    if (rootNode.children) {
      for (const child of rootNode.children) {
        result.push(...this.flattenNodes(child));
      }
    }
    
    return result;
  }
}