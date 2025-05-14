/**
 * Unified Types for Integrated Indexing System
 * 
 * Core type definitions for the integrated emergent indexing system.
 */

// Important: Do not import SharedAnalysisContext here to avoid circular dependency
// Instead, use the type directly in the interface definitions

/**
 * Phases of the indexing process
 */
export enum IndexingPhase {
  INITIALIZATION = 'initialization',
  DISCOVERY = 'discovery',
  CONTENT_ANALYSIS = 'content_analysis',
  RELATIONSHIP_MAPPING = 'relationship_mapping',
  PATTERN_DISCOVERY = 'pattern_discovery',
  INTEGRATION = 'integration',
  CLEANUP = 'cleanup'
}

/**
 * Pattern definition structure
 */
export interface PatternDefinition {
  id?: string;
  type: string;
  name: string;
  description?: string;
  regex?: string;
  flags?: string;
  confidence?: number;
  metadata?: Record<string, any>;
}

/**
 * Pattern match result
 */
export interface PatternMatch {
  patternId: string;
  match: string;
  groups: string[];
  index: number;
  confidence: number;
}

/**
 * Interface for all analyzers to implement
 */
export interface EmergentAnalyzer {
  /**
   * Unique identifier for this analyzer
   */
  readonly id: string;
  
  /**
   * Human-readable analyzer name
   */
  readonly name: string;
  
  /**
   * Analyzer priority (lower is higher priority)
   */
  readonly priority: number;
  
  /**
   * Dependencies on other analyzers, if any
   */
  readonly dependencies: string[];
  
  /**
   * Called once at the start of analysis
   */
  initialize(context: any): Promise<void>;
  
  /**
   * Called for each file during the content analysis phase
   */
  analyzeFile(file: FileNode, content: string, context: any): Promise<void>;
  
  /**
   * Called after all files have been processed
   */
  processRelationships(context: any): Promise<void>;
  
  /**
   * Called to discover and refine patterns
   */
  discoverPatterns(context: any): Promise<void>;
  
  /**
   * Final integration phase
   */
  integrateAnalysis(context: any): Promise<void>;
  
  /**
   * Clean up resources
   */
  cleanup(): Promise<void>;
}

// ---------------------------------------------------------------------------
// CORE DATA STRUCTURES
// ---------------------------------------------------------------------------

/**
 * Physical structure types
 */
export interface FileNode {
  path: string;
  name: string;
  extension: string;
  content?: string | { reference: string };
  contentHash: string;
  size: number;
  created: Date;
  modified: Date;
  metadata: Record<string, any>;
  languageType?: string;
  children?: FileNode[];
  parent?: { path: string };
}

export interface DirectoryNode {
  path: string;
  name: string;
  contentHash: string;
  created: Date;
  modified: Date;
  metadata: Record<string, any>;
  children: (FileNode | DirectoryNode)[];
  parent?: { path: string };
}

export interface FileSystemTree {
  root: DirectoryNode;
  fileCount: number;
  directoryCount: number;
  languageCounts: Record<string, number>;
  fileExtensions: Record<string, number>;
  totalSize: number;
}

/**
 * Language structure types
 */
export interface LanguageDetails {
  name: string;
  extensions: string[];
  parser?: any;
  paths: string[];
  fileCount: number;
  totalSize: number;
  dominantParadigms: string[];
  filesByPath: Record<string, FileNode>;
}

export interface LanguageStructure {
  languages: Map<string, LanguageDetails>;
  dominant: string;
  paradigms: Record<string, number>;
}

/**
 * Code structure types
 */
export enum CodeNodeType {
  NAMESPACE = 'namespace',
  CLASS = 'class',
  INTERFACE = 'interface',
  FUNCTION = 'function',
  METHOD = 'method',
  PROPERTY = 'property',
  VARIABLE = 'variable',
  CONSTANT = 'constant',
  ENUM = 'enum',
  TYPE = 'type',
  IMPORT = 'import',
  EXPORT = 'export',
  MODULE = 'module',
  TEST = 'test',
  COMMENT = 'comment',
  EXPRESSION = 'expression',
  STATEMENT = 'statement',
  BLOCK = 'block',
  UNKNOWN = 'unknown'
}

export interface CodeNode {
  id: string;
  type: CodeNodeType;
  name: string;
  qualifiedName: string;
  path: string;
  language: string;
  content?: string;
  contentHash: string;
  location: {
    start: { line: number; column: number; };
    end: { line: number; column: number; };
  };
  metadata: Record<string, any>;
  children?: CodeNode[];
  parent?: { id: string; type: CodeNodeType; };
  confidence: number;
}

/**
 * Pattern types
 */
export interface PatternInstance {
  nodeId: string;
  nodePath: string;
  matchScore: number;
  metadata: Record<string, any>;
}

export interface CodePattern {
  id: string;
  type: string;
  name: string;
  description: string;
  signature: any;
  instances: PatternInstance[];
  confidence: number;
  frequency: number;
  importance: number;
}

/**
 * Relationship types
 */
export enum RelationshipType {
  CONTAINS = 'contains',
  IMPORTS = 'imports',
  EXPORTS = 'exports',
  EXTENDS = 'extends',
  IMPLEMENTS = 'implements',
  CALLS = 'calls',
  REFERENCES = 'references',
  CREATES = 'creates',
  USES = 'uses',
  TESTS = 'tests',
  CO_CHANGES = 'co_changes',
  SIMILAR_TO = 'similar_to',
  DEPENDS_ON = 'depends_on'
}

export interface Relationship {
  id: string;
  type: RelationshipType;
  sourceId: string;
  targetId: string;
  metadata: Record<string, any>;
  weight: number;
  confidence: number;
}

/**
 * Semantic types
 */
export interface Concept {
  id: string;
  name: string;
  description: string;
  codeElements: string[];
  confidence: number;
  importance: number;
  relatedConcepts: string[];
}

export interface SemanticUnit {
  id: string;
  type: string;
  name: string;
  description: string;
  codeNodeIds: string[];
  confidence: number;
  concepts: string[];
  semanticProperties: Record<string, any>;
}

export interface SemanticResult {
  concepts: Concept[];
  semanticUnits: SemanticUnit[];
}

/**
 * Dependency Analysis Types
 */
export enum DependencyType {
  LANGUAGE_CORE = 'language_core',
  STANDARD_LIBRARY = 'standard_library',
  INTERNAL_MODULE = 'internal_module',
  EXTERNAL_PACKAGE = 'external_package',
  LOCAL_FILE = 'local_file',
  UNKNOWN = 'unknown'
}

export interface ImportStatement {
  id: string;
  moduleSpecifier: string;
  importedSymbols: string[];  // Can be empty for side-effect only imports
  defaultImport?: string;
  sourceFileId: string;
  sourceFilePath: string;
  line: number;
  dependencyType: DependencyType;
  resolvedPath?: string;
  confidence: number;
}

export interface ExportStatement {
  id: string;
  exportedSymbols: string[];
  defaultExport?: string;
  sourceFileId: string;
  sourceFilePath: string;
  line: number;
  confidence: number;
}

export interface Dependency {
  id: string;
  name: string;
  type: DependencyType;
  version?: string;
  importCount: number;
  importedSymbols: Map<string, number>; // Symbol -> usage count
  importingFiles: Set<string>;
  confidence: number;
}

export interface DependencyGraph {
  dependencies: Map<string, Dependency>;
  imports: ImportStatement[];
  exports: ExportStatement[];
}

/**
 * Data Flow types
 */
export enum DataFlowType {
  ASSIGNMENT = 'assignment',
  PARAMETER = 'parameter',
  RETURN = 'return',
  PROPERTY_ACCESS = 'property_access',
  METHOD_CALL = 'method_call',
  EVENT_EMISSION = 'event_emission',
  EVENT_HANDLING = 'event_handling',
  STATE_MUTATION = 'state_mutation',
  IMPORT = 'import',
  EXPORT = 'export'
}

export enum DataNodeRole {
  SOURCE = 'source',
  TRANSFORMER = 'transformer',
  SINK = 'sink',
  STORE = 'store'
}

export interface DataNode {
  id: string;
  name: string;
  nodeId: string;
  role: DataNodeRole;
  dataType?: string;
  confidence: number;
  metadata: Record<string, any>;
}

export interface DataFlow {
  id: string;
  type: DataFlowType;
  sourceId: string;
  targetId: string;
  transformations: string[];
  async: boolean;
  conditional: boolean;
  confidence: number;
  metadata: Record<string, any>;
}

export interface DataFlowGraph {
  nodes: Map<string, DataNode>;
  flows: DataFlow[];
  paths: DataFlowPath[];
}

export interface DataFlowPath {
  id: string;
  name: string;
  description: string;
  nodes: string[];
  flows: string[];
  entryPoints: string[];
  exitPoints: string[];
  confidence: number;
  metadata: Record<string, any>;
}

/**
 * Clustering types
 */
export enum ClusteringAlgorithm {
  HIERARCHICAL = 'hierarchical',
  DBSCAN = 'dbscan',
  KMEANS = 'kmeans'
}

export enum ClusteringMetric {
  NAMING_PATTERN = 'naming_pattern',
  STRUCTURAL_SIMILARITY = 'structural_similarity',
  RELATIONSHIP_GRAPH = 'relationship_graph',
  SEMANTIC_SIMILARITY = 'semantic_similarity',
  CONTENT_SIMILARITY = 'content_similarity'
}

export interface CodeCluster {
  id: string;
  name: string;
  description: string;
  nodeIds: string[];
  dominantType: string;
  namingPatterns: string[];
  confidence: number;
  metadata: Record<string, any>;
}

/**
 * Indexing options
 */
export interface UnifiedIndexingOptions {
  /** Maximum depth to analyze (undefined = no limit) */
  maxDepth?: number;
  
  /** Memory limit in MB (undefined = no limit) */
  memoryLimit?: number;
  
  /** How quickly to adjust to newly discovered patterns (0-1) */
  adaptiveThreshold?: number;
  
  /** File patterns to exclude */
  exclude?: string[];
  
  /** Whether to include git history analysis */
  includeGitHistory?: boolean;
  
  /** Whether to perform semantic analysis */
  semanticAnalysis?: boolean;
  
  /** Whether to analyze test files */
  includeTests?: boolean;
  
  /** Whether to generate embeddings */
  generateEmbeddings?: boolean;
  
  /** Whether to include asynchronous data flows in analysis */
  includeAsyncFlows?: boolean;
  
  /** Whether to include conditional data flows in analysis */
  includeConditionalFlows?: boolean;
  
  /** Minimum confidence level for including data flows */
  dataFlowMinConfidence?: number;
  
  /** Whether to analyze dependencies */
  analyzeDependencies?: boolean;
  
  /** Batch size for processing files (0 = auto) */
  batchSize?: number;
}

/**
 * The core codebase understanding model
 */
export interface UnifiedCodebaseUnderstanding {
  /* Core identification */
  id: string;
  rootPath: string;
  createdAt: Date;
  updatedAt: Date;

  /* Physical structure */
  fileSystem: FileSystemTree;

  /* Language structure */
  languages: LanguageStructure;

  /* Code structure */
  codeNodes: Map<string, CodeNode>;

  /* Patterns */
  patterns: CodePattern[];

  /* Relationships */
  relationships: Relationship[];

  /* Semantic layer */
  concepts: Concept[];
  semanticUnits: SemanticUnit[];

  /* Clusters */
  clusters: CodeCluster[];

  /* Data Flow */
  dataFlow: DataFlowGraph;

  /* Dependencies */
  dependencies?: DependencyGraph;

  /* Metadata */
  metadata: Record<string, any>;

  /* Settings used for this understanding */
  options: UnifiedIndexingOptions;
}

/**
 * Result of the indexing operation
 */
export interface UnifiedIndexingResult {
  understanding: UnifiedCodebaseUnderstanding;
  
  stats: {
    /** Time taken in milliseconds */
    timeTakenMs: number;
    
    /** Memory used in bytes */
    memoryUsageBytes: number;
    
    /** Number of files indexed */
    filesIndexed: number;
    
    /** Number of code nodes extracted */
    nodesExtracted: number;
    
    /** Number of patterns discovered */
    patternsDiscovered: number;
    
    /** Number of relationships identified */
    relationshipsIdentified: number;
    
    /** Number of concepts extracted */
    conceptsExtracted: number;

    /** Number of data flows discovered */
    dataFlowsDiscovered?: number;

    /** Number of data flow paths identified */
    dataFlowPathsIdentified?: number;
    
    /** Number of dependencies discovered */
    dependenciesDiscovered?: number;
  };
  
  errors?: Array<{
    path: string;
    error: string;
  }>;
}

/**
 * Unified indexing service interface
 */
export interface UnifiedIndexingService {
  /**
   * Analyze a codebase and build an emergent understanding of it
   */
  analyzeCodebase(
    rootPath: string, 
    options?: Partial<UnifiedIndexingOptions>
  ): Promise<UnifiedIndexingResult>;
  
  /**
   * Update an existing understanding incrementally
   */
  updateUnderstanding(
    rootPath: string, 
    existingUnderstanding: UnifiedCodebaseUnderstanding,
    options?: Partial<UnifiedIndexingOptions>
  ): Promise<UnifiedIndexingResult>;
  
  /**
   * Save the understanding to persistent storage
   */
  saveUnderstanding(
    understanding: UnifiedCodebaseUnderstanding,
    path: string
  ): Promise<void>;
  
  /**
   * Load an understanding from persistent storage
   */
  loadUnderstanding(path: string): Promise<UnifiedCodebaseUnderstanding>;

  /**
   * Cluster code elements to find natural groupings
   */
  clusterCodeElements(
    understanding: UnifiedCodebaseUnderstanding,
    options?: {
      algorithm?: ClusteringAlgorithm;
      metrics?: ClusteringMetric[];
      minSimilarity?: number;
      maxClusters?: number;
    }
  ): Promise<CodeCluster[]>;

  /**
   * Analyze data flows in the codebase
   */
  analyzeDataFlows(
    understanding: UnifiedCodebaseUnderstanding,
    options?: {
      maxDepth?: number;
      includeAsyncFlows?: boolean;
      includeConditionalFlows?: boolean;
      minConfidence?: number;
    }
  ): Promise<DataFlowGraph>;
  
  /**
   * Analyze dependencies in the codebase
   */
  analyzeDependencies(
    understanding: UnifiedCodebaseUnderstanding
  ): Promise<DependencyGraph>;
}

/**
 * Extended options for UnifiedIndexingOptions
 * Additional properties for incremental and targeted indexing
 */
export interface ExtendedIndexingOptions extends UnifiedIndexingOptions {
  /**
   * List of specific files to process (for targeted updates)
   */
  targetFiles?: string[];
  
  /**
   * List of analyzer IDs to run (for selective analysis)
   */
  analyzersToRun?: string[];
  
  /**
   * Flag to enable incremental updates
   */
  incremental?: boolean;
  
  /**
   * Hash of previous indexing operation for comparison
   */
  previousHash?: string;
}