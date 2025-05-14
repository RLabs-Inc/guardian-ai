/**
 * Shared Analysis Context
 * 
 * The central shared state and data structure for the integrated indexing system.
 * All analyzers read from and write to this context during the analysis process.
 */

import path from 'path';
import { v4 as uuidv4 } from 'uuid';
import {
  FileSystemTree,
  LanguageStructure,
  CodeNode,
  Relationship,
  CodePattern,
  DependencyGraph,
  SemanticResult,
  PatternDefinition,
  PatternMatch,
  IndexingPhase,
  FileNode,
  Concept,
  DataNode,
  DataFlow,
  DataFlowPath,
  ExtendedIndexingOptions
} from './unifiedTypes.js';
import { FileSystemService } from '../fileSystem/types.js';
import { getMemoryMonitor } from '../utils/memoryMonitor.js';

export class SharedAnalysisContext {
  // Core data structures
  readonly rootPath: string;
  readonly options: Partial<ExtendedIndexingOptions>;
  
  fileSystem: FileSystemTree;
  languages: LanguageStructure;
  codeNodes: Map<string, CodeNode> = new Map();
  relationships: Relationship[] = [];
  patterns: CodePattern[] = [];
  dependencies: DependencyGraph = {
    dependencies: new Map(),
    imports: [],
    exports: []
  };
  semantics: SemanticResult = {
    concepts: [],
    semanticUnits: []
  };
  
  // Data flow structure
  dataFlow: {
    nodes: Map<string, DataNode>;
    flows: DataFlow[];
    paths: DataFlowPath[];
  } = {
    nodes: new Map(),
    flows: [],
    paths: []
  };
  
  // Concepts collection for semantic analysis
  concepts: Concept[] = [];
  
  // The unified understanding model being built
  understanding: {
    clusters: CodeCluster[];
    semanticUnits: SemanticUnit[];
    concepts: Concept[];
    dataFlow: DataFlowGraph;
  } = {
    clusters: [],
    semanticUnits: [],
    concepts: [],
    dataFlow: { 
      nodes: new Map(),
      flows: [],
      paths: []
    }
  };
  
  // State tracking
  processedFiles: Set<string> = new Set();
  currentPhase: IndexingPhase = IndexingPhase.INITIALIZATION;
  metrics: Map<string, number> = new Map();
  events: any[] = [];
  
  // Resources
  private fileContents: Map<string, { content: string, refCount: number }> = new Map();
  private patternRegistry: Map<string, PatternDefinition> = new Map();
  private fileSystemService: FileSystemService;
  
  constructor(rootPath: string, options: Partial<ExtendedIndexingOptions>, fileSystemService: FileSystemService) {
    this.rootPath = rootPath;
    this.options = options;
    this.fileSystemService = fileSystemService;
    
    // Initialize with empty file system tree
    this.fileSystem = {
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
    
    // Initialize with empty language structure
    this.languages = {
      languages: new Map(),
      dominant: '',
      paradigms: {}
    };
  }
  
  // File content management
  async getFileContent(filePath: string): Promise<string> {
    if (this.fileContents.has(filePath)) {
      const record = this.fileContents.get(filePath)!;
      record.refCount++;
      return record.content;
    }
    
    // Load content from file system
    const fileResult = await this.fileSystemService.readFile(filePath);
    if (!fileResult || !fileResult.content) {
      throw new Error(`Failed to read file content: ${filePath}`);
    }
    
    // Store with reference count
    this.fileContents.set(filePath, {
      content: fileResult.content,
      refCount: 1
    });
    
    return fileResult.content;
  }
  
  releaseFileContent(filePath: string): void {
    if (!this.fileContents.has(filePath)) return;
    
    const record = this.fileContents.get(filePath)!;
    record.refCount--;
    
    // Remove from cache if no more references
    if (record.refCount <= 0) {
      this.fileContents.delete(filePath);
    }
  }
  
  // Pattern management
  registerPattern(pattern: PatternDefinition): string {
    const id = pattern.id || uuidv4();
    this.patternRegistry.set(id, pattern);
    return id;
  }
  
  findMatchingPatterns(content: string, patternType: string): PatternMatch[] {
    const matches: PatternMatch[] = [];
    
    for (const [id, pattern] of this.patternRegistry.entries()) {
      if (pattern.type !== patternType) continue;
      
      try {
        // Apply pattern to content
        if (pattern.regex) {
          const regex = new RegExp(pattern.regex, pattern.flags || 'g');
          const regexMatches = [...content.matchAll(regex)];
          
          for (const match of regexMatches) {
            matches.push({
              patternId: id,
              match: match[0],
              groups: match.slice(1),
              index: match.index || 0,
              confidence: pattern.confidence || 0.8
            });
          }
        }
      } catch (error) {
        console.error(`Error applying pattern ${id}:`, error);
      }
    }
    
    return matches;
  }
  
  // Metrics and events
  recordMetric(name: string, value: number): void {
    this.metrics.set(name, value);
  }
  
  recordEvent(name: string, data: any): void {
    this.events.push({
      name,
      timestamp: new Date(),
      data
    });
  }
  
  // Memory management
  async requestMemoryRelease(targetMB: number): Promise<number> {
    const memoryMonitor = getMemoryMonitor();
    memoryMonitor.logMemoryUsage('beforeMemoryRelease');
    
    // Try to release unused file contents first
    for (const [filePath, record] of this.fileContents.entries()) {
      if (record.refCount <= 0) {
        this.fileContents.delete(filePath);
      }
    }
    
    // Force garbage collection if available
    memoryMonitor.forceGC();
    
    memoryMonitor.logMemoryUsage('afterMemoryRelease');
    return targetMB; // Return requested amount as approximate
  }
  
  // Phase transition
  setPhase(phase: IndexingPhase): void {
    this.currentPhase = phase;
    this.recordEvent('phase-transition', { phase });
  }
}