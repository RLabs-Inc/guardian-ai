/**
 * Unified Indexing Coordinator
 * 
 * Coordinates the entire indexing process and manages analyzers.
 */

import * as path from 'path';
import { v4 as uuidv4 } from 'uuid';
import * as os from 'os';
import {
  EmergentAnalyzer,
  IndexingPhase,
  UnifiedIndexingOptions,
  UnifiedIndexingResult,
  UnifiedCodebaseUnderstanding,
  FileNode,
  DirectoryNode,
  ExtendedIndexingOptions
} from './unifiedTypes.js';

// Extended types for incremental indexing
interface ExtendedOptions extends UnifiedIndexingOptions {
  targetFiles?: string[];
  analyzersToRun?: string[];
  incremental?: boolean;
  previousHash?: string;
}

// Import analyzers
import {
  LanguageDetectorAnalyzer,
  RelationshipAnalyzer,
  PatternAnalyzer,
  DependencyAnalyzer,
  DataFlowAnalyzer,
  SemanticAnalyzer,
  ClusteringAnalyzer
} from './analyzers/index.js';
import { SharedAnalysisContext } from './sharedAnalysisContext.js';
import { FileSystemService } from '../fileSystem/types.js';
import { getMemoryMonitor } from '../utils/memoryMonitor.js';

export class IndexingCoordinator {
  private analyzers: EmergentAnalyzer[] = [];
  private fileSystemService: FileSystemService;
  
  constructor(fileSystemService: FileSystemService) {
    this.fileSystemService = fileSystemService;
    
    // Register default analyzers
    this.registerDefaultAnalyzers();
  }
  
  /**
   * Register the default set of analyzers
   */
  private registerDefaultAnalyzers(): void {
    // Language detection must run first
    this.registerAnalyzer(new LanguageDetectorAnalyzer());
    
    // Relationships and patterns can run next
    this.registerAnalyzer(new RelationshipAnalyzer());
    this.registerAnalyzer(new PatternAnalyzer());
    
    // Dependency analysis
    this.registerAnalyzer(new DependencyAnalyzer());
    
    // Data flow analysis
    this.registerAnalyzer(new DataFlowAnalyzer());
    
    // Semantic analysis
    this.registerAnalyzer(new SemanticAnalyzer());
    
    // Clustering runs last
    this.registerAnalyzer(new ClusteringAnalyzer());
  }
  
  /**
   * Register an analyzer with the coordinator
   */
  registerAnalyzer(analyzer: EmergentAnalyzer): void {
    this.analyzers.push(analyzer);
    
    // Sort by priority
    this.analyzers.sort((a, b) => a.priority - b.priority);
  }
  
  /**
   * Main indexing process
   */
  async analyzeCodebase(
    rootPath: string, 
    options: Partial<UnifiedIndexingOptions> = {}
  ): Promise<UnifiedIndexingResult> {
    const startTime = Date.now();
    
    // Create shared context
    const context = new SharedAnalysisContext(rootPath, options, this.fileSystemService);
    
    try {
      // Phase 1: Initialization
      console.log('Phase 1: Initialization');
      context.setPhase(IndexingPhase.INITIALIZATION);
      await this.initialize(context);
      
      // Phase 2: Discovery
      console.log('Phase 2: Discovery');
      context.setPhase(IndexingPhase.DISCOVERY);
      await this.discoverFileSystem(context);
      await this.detectLanguages(context);
      
      // Phase 3: Content Analysis
      console.log('Phase 3: Content Analysis');
      context.setPhase(IndexingPhase.CONTENT_ANALYSIS);
      await this.processAllFiles(context);
      
      // Phase 4: Relationship Mapping
      console.log('Phase 4: Relationship Mapping');
      context.setPhase(IndexingPhase.RELATIONSHIP_MAPPING);
      await this.processRelationships(context);
      
      // Phase 5: Pattern Discovery
      console.log('Phase 5: Pattern Discovery');
      context.setPhase(IndexingPhase.PATTERN_DISCOVERY);
      await this.discoverPatterns(context);
      
      // Phase 6: Integration
      console.log('Phase 6: Integration');
      context.setPhase(IndexingPhase.INTEGRATION);
      await this.integrateAnalyses(context);
      
      // Create the final understanding model
      const understanding = this.buildUnderstandingModel(context);
      
      // Generate statistics
      const stats = this.collectStats(context, startTime);
      
      return {
        understanding,
        stats
      };
    } catch (error) {
      console.error('Error during indexing:', error);
      throw error;
    } finally {
      // Phase 7: Cleanup
      console.log('Phase 7: Cleanup');
      context.setPhase(IndexingPhase.CLEANUP);
      await this.cleanup(context);
    }
  }
  
  /**
   * Update an existing understanding incrementally
   */
  async updateUnderstanding(
    rootPath: string,
    existingUnderstanding: UnifiedCodebaseUnderstanding,
    options: Partial<UnifiedIndexingOptions> = {}
  ): Promise<UnifiedIndexingResult> {
    const startTime = Date.now();
    
    console.log('Incremental update requested for', rootPath);
    
    // Create shared context
    const context = new SharedAnalysisContext(rootPath, options, this.fileSystemService);
    
    try {
      // PHASE 1: Import existing understanding into context
      console.log('Phase 1: Importing existing understanding');
      context.setPhase(IndexingPhase.INITIALIZATION);
      await this.importExistingUnderstanding(existingUnderstanding, context);
      
      // Initialize analyzers (only the ones we need to run based on options)
      const extendedOptions = options as ExtendedOptions;
      const analyzersToRun = extendedOptions.analyzersToRun || this.analyzers.map(a => a.id);
      
      for (const analyzer of this.analyzers) {
        if (analyzersToRun.includes(analyzer.id)) {
          try {
            await analyzer.initialize(context);
          } catch (error) {
            console.error(`Error initializing analyzer ${analyzer.id}:`, error);
          }
        }
      }
      
      // PHASE 2: FOCUSED DISCOVERY
      console.log('Phase 2: Focused discovery');
      context.setPhase(IndexingPhase.DISCOVERY);
      
      // Only scan targeted files if specified
      if (extendedOptions.targetFiles && extendedOptions.targetFiles.length > 0) {
        console.log(`Processing ${extendedOptions.targetFiles.length} targeted files`);
        await this.processTargetedFiles(extendedOptions.targetFiles, context, analyzersToRun);
      } else {
        // Otherwise, update the whole file system tree but skip unchanged files
        await this.buildFileSystemTree(context);
        
        // Detect languages for any new or modified files
        await this.detectLanguages(context);
        
        // Process all files (analyzer will check if already processed)
        await this.processAllFiles(context);
      }
      
      // PHASE 3+: REMAINING PHASES (only for relevant analyzers)
      
      // Phase 3: Relationship Mapping
      console.log('Phase 3: Relationship Mapping (incremental)');
      context.setPhase(IndexingPhase.RELATIONSHIP_MAPPING);
      
      for (const analyzer of this.analyzers) {
        if (analyzersToRun.includes(analyzer.id)) {
          try {
            await analyzer.processRelationships(context);
          } catch (error) {
            console.error(`Error in relationship processing for ${analyzer.id}:`, error);
          }
        }
      }
      
      // Phase 4: Pattern Discovery
      console.log('Phase 4: Pattern Discovery (incremental)');
      context.setPhase(IndexingPhase.PATTERN_DISCOVERY);
      
      for (const analyzer of this.analyzers) {
        if (analyzersToRun.includes(analyzer.id)) {
          try {
            await analyzer.discoverPatterns(context);
          } catch (error) {
            console.error(`Error in pattern discovery for ${analyzer.id}:`, error);
          }
        }
      }
      
      // Phase 5: Integration
      console.log('Phase 5: Integration (incremental)');
      context.setPhase(IndexingPhase.INTEGRATION);
      
      for (const analyzer of this.analyzers) {
        if (analyzersToRun.includes(analyzer.id)) {
          try {
            await analyzer.integrateAnalysis(context);
          } catch (error) {
            console.error(`Error in analysis integration for ${analyzer.id}:`, error);
          }
        }
      }
      
      // Create the updated understanding model
      const understanding = this.buildUnderstandingModel(context);
      
      // Generate statistics
      const stats = this.collectStats(context, startTime);
      
      return {
        understanding,
        stats
      };
    } catch (error) {
      console.error('Error during incremental indexing:', error);
      throw error;
    } finally {
      // Phase 6: Cleanup
      console.log('Phase 6: Cleanup');
      context.setPhase(IndexingPhase.CLEANUP);
      
      for (const analyzer of this.analyzers) {
        try {
          await analyzer.cleanup();
        } catch (error) {
          console.error(`Error in cleanup for ${analyzer.id}:`, error);
        }
      }
    }
  }
  
  // Individual phase implementations
  
  private async initialize(context: SharedAnalysisContext): Promise<void> {
    // Initialize all analyzers
    for (const analyzer of this.analyzers) {
      try {
        await analyzer.initialize(context);
      } catch (error) {
        console.error(`Error initializing analyzer ${analyzer.id}:`, error);
      }
    }
  }
  
  private async discoverFileSystem(context: SharedAnalysisContext): Promise<void> {
    // Build the file system tree
    await this.buildFileSystemTree(context);
  }
  
  private async detectLanguages(context: SharedAnalysisContext): Promise<void> {
    // Find analyzers that can detect languages
    const languageDetectors = this.analyzers.filter(a => 'detectLanguages' in a);
    
    if (languageDetectors.length > 0) {
      // Use the first one that implements language detection
      const detector = languageDetectors[0];
      await (detector as any).detectLanguages(context);
    } else {
      console.warn('No language detector available');
      // Fallback implementation will be added during full refactoring
    }
  }
  
  private async processAllFiles(context: SharedAnalysisContext): Promise<void> {
    // Process in batches to manage memory
    const batchSize = this.calculateBatchSize(context);
    
    // Get all file nodes
    const allFiles = this.getAllFileNodes(context.fileSystem.root);
    
    // Process in batches
    for (let i = 0; i < allFiles.length; i += batchSize) {
      const batch = allFiles.slice(i, i + batchSize);
      
      console.log(`Processing batch ${Math.floor(i/batchSize) + 1} of ${Math.ceil(allFiles.length/batchSize)}: ${batch.length} files`);
      
      // Process each file in the batch
      for (const file of batch) {
        await this.processFile(file, context);
      }
      
      // Force memory cleanup after each batch
      await context.requestMemoryRelease(50);
      
      // Log progress
      console.log(`Processed ${Math.min(i + batchSize, allFiles.length)} of ${allFiles.length} files`);
    }
  }
  
  private async processFile(file: FileNode, context: SharedAnalysisContext): Promise<void> {
    // Skip already processed files
    if (context.processedFiles.has(file.path)) {
      return;
    }
    
    try {
      // Get file content
      const content = await context.getFileContent(file.path);
      
      // Have each analyzer process the file
      for (const analyzer of this.analyzers) {
        try {
          await analyzer.analyzeFile(file, content, context);
        } catch (error) {
          console.error(`Error in analyzer ${analyzer.id} for file ${file.path}:`, error);
        }
      }
      
      // Mark as processed
      context.processedFiles.add(file.path);
    } catch (error) {
      console.error(`Error processing file ${file.path}:`, error);
    } finally {
      // Release file content
      context.releaseFileContent(file.path);
    }
  }
  
  private async processRelationships(context: SharedAnalysisContext): Promise<void> {
    // Have each analyzer process relationships
    for (const analyzer of this.analyzers) {
      try {
        await analyzer.processRelationships(context);
      } catch (error) {
        console.error(`Error in relationship processing for ${analyzer.id}:`, error);
      }
    }
  }
  
  private async discoverPatterns(context: SharedAnalysisContext): Promise<void> {
    // Have each analyzer discover patterns
    for (const analyzer of this.analyzers) {
      try {
        await analyzer.discoverPatterns(context);
      } catch (error) {
        console.error(`Error in pattern discovery for ${analyzer.id}:`, error);
      }
    }
  }
  
  private async integrateAnalyses(context: SharedAnalysisContext): Promise<void> {
    // Have each analyzer integrate its results
    for (const analyzer of this.analyzers) {
      try {
        await analyzer.integrateAnalysis(context);
      } catch (error) {
        console.error(`Error in analysis integration for ${analyzer.id}:`, error);
      }
    }
  }
  
  private async cleanup(context: SharedAnalysisContext): Promise<void> {
    // Have each analyzer clean up
    for (const analyzer of this.analyzers) {
      try {
        await analyzer.cleanup();
      } catch (error) {
        console.error(`Error in cleanup for ${analyzer.id}:`, error);
      }
    }
  }
  
  // Helper methods
  
  private async buildFileSystemTree(context: SharedAnalysisContext): Promise<void> {
    // Implementation will be added during full refactoring
    // This is a placeholder for now
    console.log(`Building file system tree for ${context.rootPath}`);
  }
  
  private getAllFileNodes(root: DirectoryNode): FileNode[] {
    const files: FileNode[] = [];
    
    const traverse = (node: DirectoryNode | FileNode) => {
      if ('extension' in node) {
        files.push(node);
      } else if ('children' in node) {
        for (const child of node.children) {
          traverse(child);
        }
      }
    };
    
    traverse(root);
    return files;
  }
  
  private calculateBatchSize(context: SharedAnalysisContext): number {
    // If batch size specified in options, use that
    if (context.options.batchSize && context.options.batchSize > 0) {
      return context.options.batchSize;
    }
    
    // Adaptive batch size based on memory constraints
    const totalFiles = context.fileSystem.fileCount;
    const memoryMonitor = getMemoryMonitor();
    const latestSnapshot = memoryMonitor.getLatestSnapshot();
    const totalSystemMemory = require('os').totalmem();
    const freeSystemMemory = require('os').freemem();
    const availableMemoryMB = Math.floor(freeSystemMemory / (1024 * 1024));
    
    // Base calculation - adjust constants based on testing
    
    return 100; // Default value for now
  }
  
  /**
   * Import an existing understanding into the shared context
   */
  private async importExistingUnderstanding(
    understanding: UnifiedCodebaseUnderstanding,
    context: SharedAnalysisContext
  ): Promise<void> {
    // Copy file system tree
    context.fileSystem = understanding.fileSystem;
    
    // Copy language information
    context.languages = understanding.languages;
    
    // Copy code nodes
    for (const [id, node] of understanding.codeNodes.entries()) {
      context.codeNodes.set(id, node);
    }
    
    // Copy relationships
    context.relationships = [...understanding.relationships];
    
    // Copy patterns
    context.patterns = [...understanding.patterns];
    
    // Copy concepts
    context.concepts = [...understanding.concepts];
    
    // Copy dependencies
    context.dependencies = {
      dependencies: new Map(understanding.dependencies?.dependencies || new Map()),
      imports: [...(understanding.dependencies?.imports || [])],
      exports: [...(understanding.dependencies?.exports || [])]
    };
    
    // Copy data flow graph
    context.dataFlow = {
      nodes: new Map(understanding.dataFlow.nodes),
      flows: [...understanding.dataFlow.flows],
      paths: [...understanding.dataFlow.paths]
    };
    
    // Import understanding object
    context.understanding = {
      clusters: [...understanding.clusters],
      semanticUnits: [...understanding.semanticUnits],
      concepts: [...understanding.concepts],
      dataFlow: {
        nodes: new Map(understanding.dataFlow.nodes),
        flows: [...understanding.dataFlow.flows],
        paths: [...understanding.dataFlow.paths]
      }
    };
    
    console.log('Imported existing understanding with', 
      context.codeNodes.size, 'code nodes,',
      context.relationships.length, 'relationships,',
      context.patterns.length, 'patterns,',
      context.fileSystem.fileCount, 'files');
  }
  
  /**
   * Process targeted files for incremental updates
   */
  private async processTargetedFiles(
    targetFiles: string[],
    context: SharedAnalysisContext,
    analyzersToRun: string[]
  ): Promise<void> {
    // Clear processed state for targeted files to force reprocessing
    for (const filePath of targetFiles) {
      context.processedFiles.delete(filePath);
    }
    
    // Process in batches to manage memory
    const batchSize = this.calculateBatchSize(context);
    
    for (let i = 0; i < targetFiles.length; i += batchSize) {
      const batch = targetFiles.slice(i, i + batchSize);
      
      console.log(`Processing batch ${Math.floor(i/batchSize) + 1} of ${Math.ceil(targetFiles.length/batchSize)}: ${batch.length} files`);
      
      for (const filePath of batch) {
        try {
          // Find file node or create it if it doesn't exist
          let fileNode = this.findFileNode(context.fileSystem.root, filePath);
          
          if (!fileNode) {
            // Create the file node by reading from the file system
            const fileResult = await this.fileSystemService.readFile(filePath);
            
            if (fileResult && fileResult.content) {
              fileNode = {
                path: filePath,
                name: path.basename(filePath),
                extension: path.extname(filePath).slice(1),
                contentHash: '', // Will be calculated later
                size: fileResult.content.length,
                created: new Date(),
                modified: new Date(),
                metadata: {},
                parent: { path: path.dirname(filePath) }
              };
              
              // Add to file system tree
              this.addFileNodeToTree(context.fileSystem.root, fileNode);
            }
          }
          
          if (fileNode) {
            // Process the file with each analyzer
            for (const analyzer of this.analyzers) {
              if (analyzersToRun.includes(analyzer.id)) {
                try {
                  const content = await context.getFileContent(filePath);
                  await analyzer.analyzeFile(fileNode, content, context);
                } catch (error) {
                  console.error(`Error analyzing file ${filePath} with analyzer ${analyzer.id}:`, error);
                }
              }
            }
          }
        } catch (error) {
          console.error(`Error processing targeted file ${filePath}:`, error);
        }
      }
      
      // Log progress
      console.log(`Processed ${Math.min(i + batchSize, targetFiles.length)} of ${targetFiles.length} files`);
    }
  }
  
  /**
   * Find a file node in the file system tree
   */
  private findFileNode(root: DirectoryNode, filePath: string): FileNode | null {
    if (filePath === root.path) {
      return null; // This is a directory, not a file
    }
    
    // Check direct children
    for (const child of root.children) {
      if ('extension' in child && child.path === filePath) {
        return child;
      }
      
      if (!('extension' in child) && filePath.startsWith(child.path + '/')) {
        return this.findFileNode(child, filePath);
      }
    }
    
    return null;
  }
  
  /**
   * Add a file node to the file system tree
   */
  private addFileNodeToTree(root: DirectoryNode, fileNode: FileNode): void {
    const parentPath = path.dirname(fileNode.path);
    
    if (parentPath === root.path) {
      // Direct child of root
      root.children.push(fileNode);
      return;
    }
    
    // Find or create parent directory
    let parentDir = this.findOrCreateDirectory(root, parentPath);
    
    // Add file to parent directory
    parentDir.children.push(fileNode);
  }
  
  /**
   * Find or create a directory in the file system tree
   */
  private findOrCreateDirectory(root: DirectoryNode, dirPath: string): DirectoryNode {
    if (dirPath === root.path) {
      return root;
    }
    
    // Check direct children
    for (const child of root.children) {
      if (!('extension' in child) && child.path === dirPath) {
        return child;
      }
      
      if (!('extension' in child) && dirPath.startsWith(child.path + '/')) {
        return this.findOrCreateDirectory(child, dirPath);
      }
    }
    
    // Create path segments
    const segments = dirPath.substring(root.path.length).split('/').filter(Boolean);
    
    let currentDir = root;
    let currentPath = root.path;
    
    for (const segment of segments) {
      currentPath = currentPath === '/' ? `/${segment}` : `${currentPath}/${segment}`;
      
      let nextDir = currentDir.children.find(
        child => !('extension' in child) && child.path === currentPath
      ) as DirectoryNode;
      
      if (!nextDir) {
        // Create new directory
        nextDir = {
          path: currentPath,
          name: segment,
          contentHash: '',
          created: new Date(),
          modified: new Date(),
          metadata: {},
          children: [],
          parent: { path: currentDir.path }
        };
        
        currentDir.children.push(nextDir);
      }
      
      currentDir = nextDir;
    }
    
    return currentDir;
  }
  
  private buildUnderstandingModel(context: SharedAnalysisContext): UnifiedCodebaseUnderstanding {
    // Transform the shared context into the final understanding model
    // This is a placeholder for now
    return {
      id: uuidv4(),
      rootPath: context.rootPath,
      createdAt: new Date(),
      updatedAt: new Date(),
      fileSystem: context.fileSystem,
      languages: context.languages,
      codeNodes: context.codeNodes,
      patterns: context.patterns,
      relationships: context.relationships,
      concepts: context.concepts,
      semanticUnits: context.semantics.semanticUnits,
      clusters: [],
      dataFlow: { nodes: new Map(), flows: [], paths: [] },
      dependencies: context.dependencies,
      metadata: {
        // Additional metadata will be added during full implementation
      },
      options: context.options
    };
  }
  
  private collectStats(context: SharedAnalysisContext, startTime: number): UnifiedIndexingResult['stats'] {
    // Generate statistics about the indexing operation
    return {
      timeTakenMs: Date.now() - startTime,
      memoryUsageBytes: getMemoryMonitor().getLatestSnapshot()?.usage.heapUsed || 0,
      filesIndexed: context.fileSystem.fileCount,
      nodesExtracted: context.codeNodes.size,
      patternsDiscovered: context.patterns.length,
      relationshipsIdentified: context.relationships.length,
      conceptsExtracted: context.concepts.length,
      dataFlowsDiscovered: context.dataFlow?.flows.length,
      dataFlowPathsIdentified: context.dataFlow?.paths.length,
      dependenciesDiscovered: context.dependencies?.dependencies.size
    };
  }
}