/**
 * Emergent Indexing Service
 * 
 * A service that builds an emergent understanding of any codebase.
 */

import path from 'path';
import { v4 as uuidv4 } from 'uuid';

import {
  EmergentIndexingOptions,
  EmergentIndexingResult,
  CodebaseUnderstanding,
  FileNode,
  DirectoryNode,
  CodeNode,
  CodeNodeType,
  CodeCluster,
  ClusteringAlgorithm,
  ClusteringMetric,
  DataFlowGraph,
  EmergentIndexingService as IEmergentIndexingService
} from './types.js';

import { FileSystemService } from '../../fileSystem/types.js';
import { LanguageDetector } from './languageDetector.js';
import { PatternDiscovery } from './patternDiscovery.js';
import { RelationshipDetector } from './relationshipDetector.js';
import { ISemanticAnalyzer } from './types.js';
import { UnderstandingStorage } from './understandingStorage.js';
import { HashTracker } from './hashTracker.js';
import { CodeElementClustering } from './clustering/codeElementClustering.js';
import { DataFlowAnalyzer } from './dataFlowAnalyzer.js';

// Default options for emergent indexing
const DEFAULT_OPTIONS: EmergentIndexingOptions = {
  adaptiveThreshold: 0.7,
  exclude: ['node_modules', '.git', 'dist', 'build', '.cache'],
  includeGitHistory: false,
  semanticAnalysis: true,
  semanticAnalyzerType: 'standard',
  includeTests: true,
  generateEmbeddings: false,
  includeAsyncFlows: true,
  includeConditionalFlows: true
};

/**
 * Emergent Indexing Service implementation
 */
export class EmergentIndexingService implements IEmergentIndexingService {
  private fileSystem: FileSystemService;
  private languageDetector: LanguageDetector;
  private patternDiscovery: PatternDiscovery;
  private relationshipDetector: RelationshipDetector;
  private semanticAnalyzer: ISemanticAnalyzer;
  private storage: UnderstandingStorage;
  private hashTracker: HashTracker;
  private codeElementClustering: CodeElementClustering;
  private dataFlowAnalyzer: DataFlowAnalyzer;

  constructor(
    fileSystem: FileSystemService,
    languageDetector: LanguageDetector,
    patternDiscovery: PatternDiscovery,
    relationshipDetector: RelationshipDetector,
    semanticAnalyzer: ISemanticAnalyzer,
    storage: UnderstandingStorage,
    hashTracker: HashTracker,
    dataFlowAnalyzer?: DataFlowAnalyzer
  ) {
    this.fileSystem = fileSystem;
    this.languageDetector = languageDetector;
    this.patternDiscovery = patternDiscovery;
    this.relationshipDetector = relationshipDetector;
    this.semanticAnalyzer = semanticAnalyzer;
    this.storage = storage;
    this.hashTracker = hashTracker;
    this.codeElementClustering = new CodeElementClustering();
    this.dataFlowAnalyzer = dataFlowAnalyzer || new DataFlowAnalyzer(this.patternDiscovery);
  }
  
  /**
   * Analyze a codebase and build an emergent understanding of it
   */
  async analyzeCodebase(
    rootPath: string, 
    options?: Partial<EmergentIndexingOptions>
  ): Promise<EmergentIndexingResult> {
    const startTime = Date.now();
    const mergedOptions = { ...DEFAULT_OPTIONS, ...options };
    
    console.log(`Starting emergent analysis of ${rootPath}`);
    
    // Create the understanding model
    const understanding: CodebaseUnderstanding = {
      id: uuidv4(),
      rootPath,
      createdAt: new Date(),
      updatedAt: new Date(),
      fileSystem: {
        root: {
          path: rootPath,
          name: path.basename(rootPath),
          contentHash: '',
          created: new Date(),
          modified: new Date(),
          metadata: {},
          children: []
        },
        fileCount: 0,
        directoryCount: 0,
        languageCounts: {},
        fileExtensions: {},
        totalSize: 0
      },
      languages: {
        languages: new Map(),
        dominant: '',
        paradigms: {}
      },
      codeNodes: new Map(),
      patterns: [],
      relationships: [],
      concepts: [],
      semanticUnits: [],
      clusters: [],
      dataFlow: {
        nodes: new Map(),
        flows: [],
        paths: []
      },
      metadata: {},
      options: mergedOptions
    };
    
    // Build the file system tree
    await this.buildFileSystemTree(rootPath, understanding, mergedOptions);
    
    // Detect languages used in the codebase
    await this.detectLanguages(understanding);
    
    // Extract code structure
    await this.extractCodeStructure(understanding);
    
    // Discover patterns
    if (understanding.fileSystem.fileCount > 0) {
      await this.discoverPatterns(understanding);
    }
    
    // Detect relationships
    await this.detectRelationships(understanding);
    
    // Perform semantic analysis if enabled
    if (mergedOptions.semanticAnalysis) {
      await this.analyzeSemantics(understanding);
    }
    
    // Analyze data flows 
    await this.processDataFlows(understanding, {
      includeAsyncFlows: mergedOptions.includeAsyncFlows,
      includeConditionalFlows: mergedOptions.includeConditionalFlows,
      minConfidence: mergedOptions.dataFlowMinConfidence
    });
    
    // Generate statistics
    const stats = this.collectStats(understanding, startTime);
    
    return {
      understanding,
      stats
    };
  }
  
  /**
   * Update an existing understanding incrementally
   */
  async updateUnderstanding(
    rootPath: string,
    existingUnderstanding: CodebaseUnderstanding,
    options?: Partial<EmergentIndexingOptions>
  ): Promise<EmergentIndexingResult> {
    const startTime = Date.now();
    const mergedOptions = { ...DEFAULT_OPTIONS, ...options };

    console.log(`Starting incremental indexing of ${rootPath}`);

    // Create a new understanding based on the existing one
    const understanding: CodebaseUnderstanding = {
      ...existingUnderstanding,
      updatedAt: new Date(),
      options: mergedOptions,
      // Make sure required properties exist (in case loading from older version)
      clusters: existingUnderstanding.clusters || [],
      dataFlow: existingUnderstanding.dataFlow || { nodes: new Map(), flows: [], paths: [] }
    };

    // Build a new file system tree
    const newFileSystem = {
      root: {
        path: rootPath,
        name: path.basename(rootPath),
        contentHash: '',
        created: new Date(),
        modified: new Date(),
        metadata: {},
        children: []
      },
      fileCount: 0,
      directoryCount: 0,
      languageCounts: {},
      fileExtensions: {},
      totalSize: 0
    };

    // Build the file system tree
    await this.buildFileSystemTree(rootPath, newFileSystem, mergedOptions as EmergentIndexingOptions);

    // Compare with old file system tree to detect changes
    const comparison = this.hashTracker.compareFileSystemTrees(
      existingUnderstanding.fileSystem.root,
      newFileSystem.root
    );

    console.log(`Changes detected: ${comparison.added.length} added, ${comparison.modified.length} modified, ${comparison.deleted.length} deleted`);

    if (comparison.added.length === 0 &&
        comparison.modified.length === 0 &&
        comparison.deleted.length === 0) {
      console.log('No changes detected, returning existing understanding');
      return {
        understanding: existingUnderstanding,
        stats: {
          timeTakenMs: Date.now() - startTime,
          memoryUsageBytes: process.memoryUsage().heapUsed,
          filesIndexed: existingUnderstanding.fileSystem.fileCount,
          nodesExtracted: existingUnderstanding.codeNodes.size,
          patternsDiscovered: existingUnderstanding.patterns.length,
          relationshipsIdentified: existingUnderstanding.relationships.length,
          conceptsExtracted: existingUnderstanding.concepts.length,
          dataFlowsDiscovered: existingUnderstanding.dataFlow?.flows.length || 0,
          dataFlowPathsIdentified: existingUnderstanding.dataFlow?.paths.length || 0
        }
      };
    }

    // Handle incremental update based on detected changes

    // 1. Update the file system tree
    understanding.fileSystem = newFileSystem;

    // 2. Update affected language information
    await this.updateLanguageInfo(understanding, comparison);

    // 3. Update affected code nodes
    await this.updateCodeNodes(understanding, comparison);

    // 4. Update patterns
    if (understanding.fileSystem.fileCount > 0) {
      understanding.patterns = await this.patternDiscovery.discoverPatterns(understanding);
    }

    // 5. Update relationships
    understanding.relationships = await this.relationshipDetector.detectRelationships(understanding);

    // 6. Update semantic information if enabled
    if (mergedOptions.semanticAnalysis) {
      const semanticResults = await this.semanticAnalyzer.analyzeSemantics(understanding);
      understanding.concepts = semanticResults.concepts;
      understanding.semanticUnits = semanticResults.semanticUnits;
    }
    
    // 7. Update data flow analysis
    await this.processDataFlows(understanding, {
      includeAsyncFlows: mergedOptions.includeAsyncFlows,
      includeConditionalFlows: mergedOptions.includeConditionalFlows,
      minConfidence: mergedOptions.dataFlowMinConfidence
    });

    // Generate statistics
    const stats = this.collectStats(understanding, startTime);

    // Add change statistics
    const statsWithChanges = {
      ...stats,
      filesAdded: comparison.added.length,
      filesModified: comparison.modified.length,
      filesDeleted: comparison.deleted.length
    };

    return {
      understanding,
      stats: statsWithChanges
    };
  }

  /**
   * Update language information based on file changes
   * @private
   */
  private async updateLanguageInfo(
    understanding: CodebaseUnderstanding,
    _changes: { added: string[], modified: string[], deleted: string[] }
  ): Promise<void> {
    // For simplicity in the incremental update, re-detect all languages
    // TODO: Use changes parameter for incremental updates in future versions
    understanding.languages = await this.languageDetector.detectLanguages(understanding.fileSystem);
  }

  /**
   * Update code nodes based on file changes
   * @private
   */
  private async updateCodeNodes(
    understanding: CodebaseUnderstanding,
    _changes: { added: string[], modified: string[], deleted: string[] }
  ): Promise<void> {
    // For simplicity in this version, we'll re-extract all code structure
    // In a more optimized version, we would only update affected nodes based on changes
    understanding.codeNodes = new Map();
    await this.extractCodeStructure(understanding);
  }
  
  /**
   * Query the codebase understanding
   */
  async queryUnderstanding(
    _understanding: CodebaseUnderstanding,
    query: any
  ): Promise<any> {
    // This will be implemented in a future version
    console.log('Query functionality not yet implemented');
    return {
      results: [],
      metadata: {
        query
      }
    };
  }
  
  /**
   * Save the understanding to persistent storage
   */
  async saveUnderstanding(
    understanding: CodebaseUnderstanding,
    path: string
  ): Promise<void> {
    return this.storage.saveUnderstanding(understanding, path);
  }
  
  /**
   * Load an understanding from persistent storage
   */
  async loadUnderstanding(path: string): Promise<CodebaseUnderstanding> {
    return this.storage.loadUnderstanding(path);
  }
  
  /**
   * Build the file system tree
   * @private
   */
  private async buildFileSystemTree(
    rootPath: string,
    fileSystem: {
      root: DirectoryNode;
      fileCount: number;
      directoryCount: number;
      languageCounts: Record<string, number>;
      fileExtensions: Record<string, number>;
      totalSize: number;
    } | CodebaseUnderstanding,
    options: EmergentIndexingOptions
  ): Promise<void> {
    console.log('Building file system tree...');

    // Check if we received a CodebaseUnderstanding instead of a fileSystem object
    const fsObject = 'languages' in fileSystem ? fileSystem.fileSystem : fileSystem;

    // Start with the root directory
    const root = fsObject.root;

    // Process the directory and its contents recursively
    await this.processDirectory(rootPath, root, "", options, fsObject);

    // Compute content hash for the root directory
    root.contentHash = this.computeDirectoryHash(root);

    console.log(`File system tree built: ${fsObject.fileCount} files, ${fsObject.directoryCount} directories`);
  }
  
  /**
   * Process a directory recursively
   * @private
   */
  private async processDirectory(
    dirPath: string,
    parentNode: DirectoryNode,
    _relativePath: string,
    options: EmergentIndexingOptions,
    fileSystem?: {
      fileCount: number;
      directoryCount: number;
      fileExtensions: Record<string, number>;
      totalSize: number;
    },
    currentDepth: number = 0
  ): Promise<void> {
    // Check depth limit if specified
    if (options.maxDepth !== undefined && currentDepth > options.maxDepth) {
      return;
    }
    
    // Read directory contents
    const entries = await this.fileSystem.readDirectory(dirPath);
    const entryNames = entries.map(name => ({ name }));
    
    for (const entry of entryNames) {
      const entryName = entry.name;
      const entryPath = path.join(dirPath, entryName);
      const relativePath = path.relative(parentNode.path, entryPath);
      
      // Skip excluded patterns
      if (this.shouldExclude(relativePath, options.exclude)) {
        continue;
      }
      
      // Get file/directory stats
      const stats = await this.fileSystem.stat(entryPath);
      
      if (stats.isDirectory) {
        // Create directory node
        const dirNode: DirectoryNode = {
          path: entryPath,
          name: entryName,
          contentHash: '', // Will be computed after processing children
          created: stats.created,
          modified: stats.modified,
          metadata: {},
          children: [],
          parent: { path: parentNode.path }
        };
        
        // Add to parent
        parentNode.children.push(dirNode);
        
        // Increment directory count
        if (fileSystem) {
          fileSystem.directoryCount++;
        }

        // Process subdirectory recursively
        await this.processDirectory(entryPath, dirNode, relativePath, options, fileSystem, currentDepth + 1);
        
        // Compute content hash based on children
        dirNode.contentHash = this.computeDirectoryHash(dirNode);
      } else {
        // Process file
        if (fileSystem) {
          await this.processFile(entryPath, parentNode, stats, fileSystem);
        } else {
          // Handle the case where fileSystem is undefined
          const dummyStats = {
            fileCount: 0,
            fileExtensions: {},
            totalSize: 0
          };
          await this.processFile(entryPath, parentNode, stats, dummyStats);
        }
      }
    }
  }
  
  /**
   * Process a file
   * @private
   */
  private async processFile(
    filePath: string,
    parentNode: DirectoryNode,
    stats: { size: number; created: Date; modified: Date; },
    fileSystemStats: {
      fileCount: number;
      fileExtensions: Record<string, number>;
      totalSize: number;
    }
  ): Promise<void> {
    // Read file content
    const fileContent = await this.fileSystem.readFile(filePath);
    const content = fileContent.content;

    // Compute content hash
    const contentHash = this.hashTracker.computeFileHash(content);

    // Get file extension
    const extension = path.extname(filePath).toLowerCase();

    // Create file node
    const fileNode: FileNode = {
      path: filePath,
      name: path.basename(filePath),
      extension,
      contentHash,
      size: stats.size,
      created: stats.created,
      modified: stats.modified,
      metadata: {
        lineCount: content.split('\n').length
      },
      content: {
        reference: filePath
      },
      parent: { path: parentNode.path }
    };

    // Add to parent
    parentNode.children.push(fileNode);

    // Update file system stats
    fileSystemStats.fileCount++;
    fileSystemStats.totalSize += stats.size;

    // Update extension stats
    fileSystemStats.fileExtensions[extension] =
      (fileSystemStats.fileExtensions[extension] || 0) + 1;
  }
  
  /**
   * Detect languages used in the codebase
   * @private
   */
  private async detectLanguages(understanding: CodebaseUnderstanding): Promise<void> {
    console.log('Detecting languages...');
    
    // Use the language detector to identify languages
    understanding.languages = await this.languageDetector.detectLanguages(understanding.fileSystem);
    
    console.log(`Languages detected: ${understanding.languages.languages.size}`);
  }
  
  /**
   * Extract code structure
   * @private
   */
  private async extractCodeStructure(understanding: CodebaseUnderstanding): Promise<void> {
    console.log('Extracting code structure...');
    
    // This will be implemented more fully later
    // For now, we'll just ensure the structure is in place
    
    // Create a simple root node for each file
    for (const lang of understanding.languages.languages.values()) {
      for (const filePath of lang.paths) {
        const fileNode = this.findFileNode(understanding.fileSystem.root, filePath);
        
        if (fileNode) {
          const rootCodeNode: CodeNode = {
            id: uuidv4(),
            type: CodeNodeType.MODULE,
            name: path.basename(filePath),
            qualifiedName: filePath,
            path: filePath,
            language: lang.name,
            contentHash: fileNode.contentHash,
            location: {
              start: { line: 1, column: 1 },
              end: { line: fileNode.metadata['lineCount'] || 1, column: 1 }
            },
            metadata: {
              fileNode: fileNode.path
            },
            confidence: 1.0
          };
          
          understanding.codeNodes.set(rootCodeNode.id, rootCodeNode);
        }
      }
    }
    
    console.log(`Code structure extracted: ${understanding.codeNodes.size} nodes`);
  }
  
  /**
   * Discover patterns in the codebase
   * @private
   */
  private async discoverPatterns(understanding: CodebaseUnderstanding): Promise<void> {
    console.log('Discovering patterns...');
    
    // Use the pattern discovery service
    understanding.patterns = await this.patternDiscovery.discoverPatterns(understanding);
    
    console.log(`Patterns discovered: ${understanding.patterns.length}`);
  }
  
  /**
   * Detect relationships between code entities
   * @private
   */
  private async detectRelationships(understanding: CodebaseUnderstanding): Promise<void> {
    console.log('Detecting relationships...');
    
    // Use the relationship detector service
    understanding.relationships = await this.relationshipDetector.detectRelationships(understanding);
    
    console.log(`Relationships detected: ${understanding.relationships.length}`);
  }
  
  /**
   * Analyze semantics of the codebase
   * @private
   */
  private async analyzeSemantics(understanding: CodebaseUnderstanding): Promise<void> {
    console.log('Analyzing semantics...');
    
    // Use the semantic analyzer service
    const semanticResults = await this.semanticAnalyzer.analyzeSemantics(understanding);
    
    understanding.concepts = semanticResults.concepts;
    understanding.semanticUnits = semanticResults.semanticUnits;
    
    console.log(`Semantic analysis complete: ${understanding.concepts.length} concepts, ${understanding.semanticUnits.length} semantic units`);
  }
  
  /**
   * Analyze data flows in the codebase
   * @private
   */
  private async processDataFlows(
    understanding: CodebaseUnderstanding,
    options?: {
      includeAsyncFlows?: boolean;
      includeConditionalFlows?: boolean;
      minConfidence?: number;
    }
  ): Promise<void> {
    console.log('Analyzing data flows...');
    
    // Use the data flow analyzer to discover data flows
    understanding.dataFlow = await this.dataFlowAnalyzer.analyzeDataFlows(understanding, {
      maxDepth: understanding.options?.maxDepth,
      includeAsyncFlows: options?.includeAsyncFlows,
      includeConditionalFlows: options?.includeConditionalFlows,
      minConfidence: options?.minConfidence
    });
    
    console.log(`Data flow analysis complete: ${understanding.dataFlow.flows.length} flows, ${understanding.dataFlow.paths.length} paths`);
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
   * Compute a hash for a directory based on its children
   * @private
   */
  private computeDirectoryHash(dirNode: DirectoryNode): string {
    return this.hashTracker.computeDirectoryHash(dirNode);
  }
  
  /**
   * Find a file node by path
   * @private
   */
  private findFileNode(rootNode: DirectoryNode, filePath: string): FileNode | null {
    // Helper function to search recursively
    const search = (node: DirectoryNode | FileNode): FileNode | null => {
      if ('extension' in node && node.path === filePath) {
        return node;
      }
      
      if ('children' in node && node.children) {
        for (const child of node.children) {
          if ('extension' in child && child.path === filePath) {
            return child;
          } else if ('children' in child) {
            const found = search(child);
            if (found) return found;
          }
        }
      }
      
      return null;
    };
    
    return search(rootNode);
  }
  
  /**
   * Collect statistics about the indexing operation
   * @private
   */
  private collectStats(understanding: CodebaseUnderstanding, startTime: number): EmergentIndexingResult['stats'] {
    return {
      timeTakenMs: Date.now() - startTime,
      memoryUsageBytes: process.memoryUsage().heapUsed,
      filesIndexed: understanding.fileSystem.fileCount,
      nodesExtracted: understanding.codeNodes.size,
      patternsDiscovered: understanding.patterns.length,
      relationshipsIdentified: understanding.relationships.length,
      conceptsExtracted: understanding.concepts.length,
      dataFlowsDiscovered: understanding.dataFlow.flows.length,
      dataFlowPathsIdentified: understanding.dataFlow.paths.length
    };
  }

  /**
   * Cluster code elements to find natural groupings
   */
  async clusterCodeElements(
    understanding: CodebaseUnderstanding,
    options?: {
      algorithm?: ClusteringAlgorithm;
      metrics?: ClusteringMetric[];
      minSimilarity?: number;
      maxClusters?: number;
    }
  ): Promise<CodeCluster[]> {
    console.log('Clustering code elements...');

    // Use the clustering service to discover natural clusters
    const clusters = await this.codeElementClustering.clusterCodeElements(understanding, options);

    // Update the understanding with the discovered clusters
    understanding.clusters = clusters;
    understanding.updatedAt = new Date();

    console.log(`Discovered ${clusters.length} natural clusters`);

    return clusters;
  }

  /**
   * Analyze data flows in the codebase
   */
  async analyzeDataFlows(
    understanding: CodebaseUnderstanding,
    options?: {
      maxDepth?: number;
      includeAsyncFlows?: boolean;
      includeConditionalFlows?: boolean;
      minConfidence?: number;
    }
  ): Promise<DataFlowGraph> {
    console.log('Analyzing data flows explicitly...');

    // Use the data flow analyzer to discover data flows
    const dataFlowGraph = await this.dataFlowAnalyzer.analyzeDataFlows(understanding, options);

    // Update the understanding with the discovered data flows
    understanding.dataFlow = dataFlowGraph;
    understanding.updatedAt = new Date();

    console.log(`Discovered ${dataFlowGraph.flows.length} data flows and ${dataFlowGraph.paths.length} data flow paths`);

    return dataFlowGraph;
  }
}