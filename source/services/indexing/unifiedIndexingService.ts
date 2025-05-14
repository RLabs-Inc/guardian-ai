/**
 * Unified Indexing Service
 * 
 * Main implementation of the integrated indexing service with enhanced memory optimization.
 */

import {
  UnifiedIndexingOptions,
  UnifiedIndexingResult,
  UnifiedCodebaseUnderstanding,
  ClusteringAlgorithm,
  ClusteringMetric,
  CodeCluster,
  DataFlowGraph,
  DependencyGraph,
  ExtendedIndexingOptions
} from './unifiedTypes.js';
import { IndexingCoordinator } from './indexingCoordinator.js';
import { FileSystemService } from '../fileSystem/types.js';
import { HashTracker } from './hashTracker.js';
import { getMemoryMonitor } from '../utils/memoryMonitor.js';
import * as fs from 'fs-extra';
import * as os from 'os';

/**
 * Integrated implementation of the indexing service
 */
export class UnifiedIndexingService {
  private coordinator: IndexingCoordinator;
  // FileSystem service used for file operations
  private readonly _fileSystem: FileSystemService;
  private hashTracker: HashTracker;
  private memoryMonitor = getMemoryMonitor();
  
  // Advanced memory management settings
  private memorySettings = {
    // Default batch sizes with adaptive adjustment
    batchSizeDefault: 100, 
    batchSizeMin: 10,
    batchSizeMax: 500,
    
    // Memory thresholds (percentage of total memory)
    highMemoryThreshold: 0.7, // 70% of total memory
    criticalMemoryThreshold: 0.85, // 85% of total memory
    
    // Memory cleanup triggers
    cleanupThresholdMB: 1000, // Trigger cleanup when heap exceeds 1GB
    aggressiveCleanupThresholdMB: 2000, // Trigger aggressive cleanup when heap exceeds 2GB
    
    // Content caching limits
    maxCachedContentMB: 500, // Maximum content to keep in memory
    
    // Adaptive batch sizing factors
    batchSizeAdjustmentFactor: 0.8, // Reduce by 20% when memory pressure is high
    batchSizeGrowthFactor: 1.1, // Grow by 10% when memory usage is low
  };
  
  constructor(coordinator: IndexingCoordinator, fileSystem: FileSystemService) {
    this.coordinator = coordinator;
    this._fileSystem = fileSystem;
    this.hashTracker = new HashTracker();
    
    // Initialize memory monitoring with appropriate thresholds
    const totalMemory = os.totalmem();
    this.memoryMonitor = getMemoryMonitor({
      warningThresholdMB: Math.floor(totalMemory / 1024 / 1024 * this.memorySettings.highMemoryThreshold),
      criticalThresholdMB: Math.floor(totalMemory / 1024 / 1024 * this.memorySettings.criticalMemoryThreshold)
    });
  }
  
  /**
   * Analyze a codebase and build an emergent understanding of it with memory optimization
   */
  async analyzeCodebase(
    rootPath: string,
    options?: Partial<UnifiedIndexingOptions>
  ): Promise<UnifiedIndexingResult> {
    console.log(`Analyzing codebase at ${rootPath} with unified indexing service`);
    this.memoryMonitor.logMemoryUsage('Before codebase analysis');
    
    try {
      // Start with default batch size (or use provided value)
      const initialBatchSize = options?.batchSize || this.memorySettings.batchSizeDefault;
      
      // Calculate memory-aware batch size
      const adaptiveBatchSize = this.calculateAdaptiveBatchSize(initialBatchSize);
      
      // Apply memory-optimized options
      const memoryAwareOptions: Partial<UnifiedIndexingOptions> = {
        ...options,
        batchSize: adaptiveBatchSize,
        memoryLimit: this.calculateMemoryLimit(),
      };
      
      console.log(`Using adaptive batch size of ${adaptiveBatchSize} files`);
      
      // Set up memory cleanup hook during analysis
      // Use this in coordinator when needed
      // Memory cleanup hook - to be used in coordinator
    // this.coordinator.setMemoryCleanupHook(() => this.performMemoryCleanup());
      
      // Delegate to coordinator for actual analysis with memory optimization
      const result = await this.coordinator.analyzeCodebase(rootPath, memoryAwareOptions);
      
      // Schedule post-analysis garbage collection
      this.scheduleGarbageCollection();
      
      // Update hashes for the understanding to enable future incremental updates
      this.hashTracker.updateHashes(result.understanding);
      
      this.memoryMonitor.logMemoryUsage('After codebase analysis');
      return result;
    } catch (error) {
      console.error('Error analyzing codebase:', error);
      this.memoryMonitor.logMemoryUsage('Analysis error');
      throw error;
    }
  }
  
  /**
   * Update an existing understanding incrementally with memory optimization
   */
  async updateUnderstanding(
    rootPath: string,
    existingUnderstanding: UnifiedCodebaseUnderstanding,
    options?: Partial<UnifiedIndexingOptions>
  ): Promise<UnifiedIndexingResult> {
    console.log(`Updating understanding for ${rootPath}`);
    this.memoryMonitor.logMemoryUsage('Before understanding update');
    
    try {
      // First, identify what has changed since the last indexing
      const newUnderstanding = await this.performIncrementalAnalysis(rootPath, existingUnderstanding, options);
      
      // Ensure updates are reflected in hashes
      this.hashTracker.updateHashes(newUnderstanding.understanding);
      
      // Clean up memory after update
      this.scheduleGarbageCollection();
      
      this.memoryMonitor.logMemoryUsage('After understanding update');
      return newUnderstanding;
    } catch (error) {
      console.error('Error updating understanding:', error);
      this.memoryMonitor.logMemoryUsage('Update error');
      throw error;
    }
  }
  
  /**
   * Perform incremental analysis by detecting changes first
   */
  private async performIncrementalAnalysis(
    rootPath: string,
    existingUnderstanding: UnifiedCodebaseUnderstanding,
    options?: Partial<UnifiedIndexingOptions>
  ): Promise<UnifiedIndexingResult> {
    // Generate a small fresh understanding to compare with
    const quickScanOptions: Partial<UnifiedIndexingOptions> = {
      ...options,
      batchSize: this.memorySettings.batchSizeMin,
      maxDepth: 1, // Start with shallow scan to identify changes
      analyzeDependencies: false, // Skip expensive operations for initial scan
      semanticAnalysis: false,    // Skip expensive operations for initial scan
      includeGitHistory: false    // Skip expensive operations for initial scan
    };
    
    console.log(`Performing quick scan to identify changes...`);
    const quickScan = await this.coordinator.analyzeCodebase(rootPath, quickScanOptions);
    
    // Compare the quick scan with existing understanding to find changes
    console.log(`Comparing changes with existing understanding...`);
    const changes = this.hashTracker.compareUnderstandings(
      existingUnderstanding, 
      quickScan.understanding
    );
    
    // Prepare incremental update plan based on detected changes
    const updatePlan = this.hashTracker.prepareIncrementalUpdate(
      existingUnderstanding,
      changes
    );
    
    console.log(`Found ${updatePlan.modifiedFiles.length} modified files, ${updatePlan.addedFiles.length} added files, ${updatePlan.deletedFiles.length} deleted files`);
    console.log(`Need to run analyzers: ${updatePlan.analyzersToRun.join(', ')}`);
    
    // If no significant changes, return the existing understanding with updated timestamp
    if (updatePlan.addedFiles.length === 0 && 
        updatePlan.modifiedFiles.length === 0 && 
        updatePlan.deletedFiles.length === 0) {
      console.log('No significant changes detected, using existing understanding');
      
      const noChangeResult: UnifiedIndexingResult = {
        understanding: {
          ...existingUnderstanding,
          updatedAt: new Date()
        },
        stats: {
          timeTakenMs: 0,
          memoryUsageBytes: this.memoryMonitor.getLatestSnapshot()?.usage.heapUsed || 0,
          filesIndexed: 0,
          nodesExtracted: existingUnderstanding.codeNodes.size,
          patternsDiscovered: existingUnderstanding.patterns.length,
          relationshipsIdentified: existingUnderstanding.relationships.length,
          conceptsExtracted: existingUnderstanding.concepts.length,
          dataFlowsDiscovered: existingUnderstanding.dataFlow?.flows.length,
          dataFlowPathsIdentified: existingUnderstanding.dataFlow?.paths.length,
          dependenciesDiscovered: existingUnderstanding.dependencies?.dependencies.size
        }
      };
      
      return noChangeResult;
    }
    
    // If significant changes, perform targeted update
    // Create an optimized set of options for the incremental update
    const incrementalOptions: Partial<UnifiedIndexingOptions> = {
      ...options,
      batchSize: this.calculateAdaptiveBatchSize(options?.batchSize || this.memorySettings.batchSizeDefault),
      // Focus only on changed files
      // Use typed options for target files
      ...(updatePlan.modifiedFiles.length > 0 || updatePlan.addedFiles.length > 0 ? {
        targetFiles: [...updatePlan.modifiedFiles, ...updatePlan.addedFiles]
      } : {}),
      // Exclude deleted files
      exclude: [...(options?.exclude || []), ...updatePlan.deletedFiles],
      // Selective analyzer execution based on changes
      // Use typed options for analyzers
      ...(updatePlan.analyzersToRun.length > 0 ? {
        analyzersToRun: updatePlan.analyzersToRun
      } : {}),
      // Memory constraints
      memoryLimit: this.calculateMemoryLimit()
    };
    
    const targetFilesCount = (incrementalOptions as ExtendedIndexingOptions)?.targetFiles?.length || 0;
    console.log(`Performing targeted update with ${targetFilesCount} files...`);
    
    // Use the coordinator to perform the update with the optimized options
    return await this.coordinator.updateUnderstanding(
      rootPath, 
      existingUnderstanding,
      incrementalOptions
    );
  }
  
  /**
   * Save the understanding to persistent storage
   */
  async saveUnderstanding(
    understanding: UnifiedCodebaseUnderstanding,
    path: string
  ): Promise<void> {
    console.log(`Saving understanding to ${path}`);
    
    try {
      // Ensure directory exists
      await fs.ensureDir(path.substring(0, path.lastIndexOf('/')));
      
      // Convert Maps to object since they're not directly serializable
      const serializedUnderstanding = this.prepareForSerialization(understanding);
      
      // Save to disk
      await fs.writeJSON(path, serializedUnderstanding, { spaces: 2 });
    } catch (error) {
      console.error('Error saving understanding:', error);
      throw error;
    }
  }
  
  /**
   * Load an understanding from persistent storage
   */
  async loadUnderstanding(path: string): Promise<UnifiedCodebaseUnderstanding> {
    console.log(`Loading understanding from ${path}`);
    
    try {
      // Read from disk
      const data = await fs.readJSON(path);
      
      // Convert serialized objects back to Maps
      return this.restoreFromSerialization(data);
    } catch (error) {
      console.error('Error loading understanding:', error);
      throw error;
    }
  }

  /**
   * Cluster code elements to find natural groupings
   */
  async clusterCodeElements(
    understanding: UnifiedCodebaseUnderstanding,
    _options?: {
      algorithm?: ClusteringAlgorithm;
      metrics?: ClusteringMetric[];
      minSimilarity?: number;
      maxClusters?: number;
    }
  ): Promise<CodeCluster[]> {
    console.log('Clustering code elements');
    
    // This is a placeholder that will be fully implemented during refactoring
    return understanding.clusters; 
  }

  /**
   * Analyze data flows in the codebase
   */
  async analyzeDataFlows(
    understanding: UnifiedCodebaseUnderstanding,
    _options?: {
      maxDepth?: number;
      includeAsyncFlows?: boolean;
      includeConditionalFlows?: boolean;
      minConfidence?: number;
    }
  ): Promise<DataFlowGraph> {
    console.log('Analyzing data flows');
    
    // This is a placeholder that will be fully implemented during refactoring
    return understanding.dataFlow;
  }
  
  /**
   * Analyze dependencies in the codebase
   */
  async analyzeDependencies(
    understanding: UnifiedCodebaseUnderstanding
  ): Promise<DependencyGraph> {
    console.log('Analyzing dependencies');
    
    // This is a placeholder that will be fully implemented during refactoring
    return understanding.dependencies || {
      dependencies: new Map(),
      imports: [],
      exports: []
    };
  }
  
  // Memory optimization helper methods
  
  /**
   * Calculate an adaptive batch size based on available memory
   */
  private calculateAdaptiveBatchSize(requestedBatchSize: number): number {
    const memorySnapshot = this.memoryMonitor.getLatestSnapshot();
    if (!memorySnapshot) return requestedBatchSize;
    
    const totalMemory = os.totalmem();
    const freeMemory = os.freemem();
    const usedMemoryRatio = (totalMemory - freeMemory) / totalMemory;
    
    // Calculate batch size based on memory pressure
    let adaptiveBatchSize = requestedBatchSize;
    
    if (usedMemoryRatio > this.memorySettings.criticalMemoryThreshold) {
      // Critical memory pressure - reduce batch size significantly
      adaptiveBatchSize = Math.max(
        this.memorySettings.batchSizeMin,
        Math.floor(requestedBatchSize * Math.pow(this.memorySettings.batchSizeAdjustmentFactor, 2))
      );
      console.log(`Critical memory pressure detected (${Math.round(usedMemoryRatio * 100)}% used), reducing batch size to ${adaptiveBatchSize}`);
    } 
    else if (usedMemoryRatio > this.memorySettings.highMemoryThreshold) {
      // High memory pressure - reduce batch size
      adaptiveBatchSize = Math.max(
        this.memorySettings.batchSizeMin,
        Math.floor(requestedBatchSize * this.memorySettings.batchSizeAdjustmentFactor)
      );
      console.log(`High memory pressure detected (${Math.round(usedMemoryRatio * 100)}% used), reducing batch size to ${adaptiveBatchSize}`);
    }
    else if (usedMemoryRatio < 0.3) {
      // Low memory pressure - can increase batch size
      adaptiveBatchSize = Math.min(
        this.memorySettings.batchSizeMax,
        Math.floor(requestedBatchSize * this.memorySettings.batchSizeGrowthFactor)
      );
    }
    
    return adaptiveBatchSize;
  }
  
  /**
   * Calculate memory limit based on system resources
   */
  private calculateMemoryLimit(): number {
    const totalMemory = os.totalmem();
    // Use at most 80% of total memory as a limit
    return Math.floor(totalMemory / 1024 / 1024 * 0.8);
  }
  
  /**
   * Perform memory cleanup during processing
   */
  private performMemoryCleanup(): void {
    const memorySnapshot = this.memoryMonitor.getLatestSnapshot();
    if (!memorySnapshot) return;
    
    const heapUsedMB = Math.round(memorySnapshot.usage.heapUsed / 1024 / 1024);
    
    if (heapUsedMB > this.memorySettings.aggressiveCleanupThresholdMB) {
      console.log(`Performing aggressive memory cleanup (heap: ${heapUsedMB}MB)`);
      
      // Request that coordinator release all cached file contents
      // This would be implemented in IndexingCoordinator
      // this.coordinator.releaseAllFileContents();
      
      // Force garbage collection if available
      this.memoryMonitor.forceGC();
      
      // Clear memory monitor snapshots to free memory
      this.memoryMonitor.clearSnapshots();
    }
    else if (heapUsedMB > this.memorySettings.cleanupThresholdMB) {
      console.log(`Performing regular memory cleanup (heap: ${heapUsedMB}MB)`);
      
      // Request that coordinator release unused file contents
      // this.coordinator.releaseUnusedFileContents();
      
      // Schedule garbage collection
      this.scheduleGarbageCollection();
    }
  }
  
  /**
   * Schedule a garbage collection run
   */
  private scheduleGarbageCollection(): void {
    // Schedule GC for the next event loop tick to avoid blocking current execution
    setTimeout(() => {
      this.memoryMonitor.forceGC();
    }, 0);
  }
  
  // Serialization helper methods
  
  private prepareForSerialization(understanding: UnifiedCodebaseUnderstanding): any {
    this.memoryMonitor.logMemoryUsage('Before serialization');
    
    // Deep clone the understanding with memory-efficient approach
    // Instead of using JSON.parse(JSON.stringify()) which duplicates everything in memory,
    // create a new object structure with manual transformations
    
    const serialized = {
      id: understanding.id,
      rootPath: understanding.rootPath,
      createdAt: understanding.createdAt,
      updatedAt: understanding.updatedAt,
      
      // Replace Maps with objects for serialization
      fileSystem: understanding.fileSystem,
      
      languages: {
        ...understanding.languages,
        languages: Object.fromEntries(understanding.languages.languages)
      },
      
      codeNodes: Object.fromEntries(understanding.codeNodes),
      
      patterns: understanding.patterns,
      relationships: understanding.relationships,
      concepts: understanding.concepts,
      semanticUnits: understanding.semanticUnits,
      clusters: understanding.clusters,
      
      dataFlow: {
        ...understanding.dataFlow,
        nodes: Object.fromEntries(understanding.dataFlow.nodes)
      },
      
      // Handle dependencies if present
      dependencies: understanding.dependencies ? {
        dependencies: Object.fromEntries(
          [...understanding.dependencies.dependencies.entries()].map(([key, dep]) => [
            key,
            {
              ...dep,
              importedSymbols: Object.fromEntries(dep.importedSymbols),
              importingFiles: Array.from(dep.importingFiles)
            }
          ])
        ),
        imports: understanding.dependencies.imports,
        exports: understanding.dependencies.exports
      } : undefined,
      
      metadata: understanding.metadata,
      options: understanding.options
    };
    
    this.memoryMonitor.logMemoryUsage('After serialization');
    return serialized;
  }
  
  private async restoreFromSerialization(data: any): Promise<UnifiedCodebaseUnderstanding> {
    this.memoryMonitor.logMemoryUsage('Before deserialization');
    
    // Create Maps from serialized objects
    const codeNodes = new Map(Object.entries(data.codeNodes || {}));
    const languageMap = new Map(Object.entries(data.languages?.languages || {}));
    const dataFlowNodes = new Map(Object.entries(data.dataFlow?.nodes || {}));
    
    // Handle dependencies if present
    let dependencies;
    if (data.dependencies) {
      const dependenciesMap = new Map();
      
      // Process dependencies in batches to avoid memory pressure
      const batchSize = 1000;
      const deps = Object.entries(data.dependencies.dependencies || {});
      
      for (let i = 0; i < deps.length; i += batchSize) {
        const batch = deps.slice(i, i + batchSize);
        
        for (const [key, dep] of batch) {
          if (dep && typeof dep === 'object' && 'importedSymbols' in dep) {
            dependenciesMap.set(key, {
              // Create a properly typed dependency object
              id: typeof dep.id === 'string' ? dep.id : '',
              name: typeof dep.name === 'string' ? dep.name : '',
              type: typeof dep.type === 'string' ? dep.type as any : 'unknown',
              version: typeof dep.version === 'string' ? dep.version : undefined,
              importCount: typeof dep.importCount === 'number' ? dep.importCount : 0,
              confidence: typeof dep.confidence === 'number' ? dep.confidence : 0.5,
              importedSymbols: new Map(Object.entries(dep.importedSymbols as Record<string, number>)),
              importingFiles: new Set(Array.isArray(dep.importingFiles) ? dep.importingFiles : [])
            });
          } else {
            dependenciesMap.set(key, dep);
          }
        }
        
        // Allow GC to clean up after each batch
        if (i + batchSize < deps.length) {
          // Force a small delay to allow event loop to process other tasks
          await new Promise(resolve => setTimeout(resolve, 0));
        }
      }
      
      dependencies = {
        dependencies: dependenciesMap,
        imports: data.dependencies.imports || [],
        exports: data.dependencies.exports || []
      };
    }
    
    // Recreate the understanding with Maps
    const result = {
      ...data,
      createdAt: new Date(data.createdAt),
      updatedAt: new Date(data.updatedAt),
      codeNodes,
      languages: {
        ...data.languages,
        languages: languageMap
      },
      dataFlow: {
        ...data.dataFlow,
        nodes: dataFlowNodes
      },
      dependencies
    };
    
    this.memoryMonitor.logMemoryUsage('After deserialization');
    return result;
  }
}