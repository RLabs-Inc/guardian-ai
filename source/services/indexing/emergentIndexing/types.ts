/**
 * Core types for the Emergent Codebase Understanding system
 */

/**
 * CodeElement interface for data flow analysis
 * This represents code elements in a format optimized for data flow discovery
 */
export interface CodeElement {
  id: string;
  name?: string;
  type?: string;
  category?: string;
  location?: {
    start: { line: number; column: number; };
    end: { line: number; column: number; };
  };
  dataType?: string;
  content?: string;
  children?: CodeElement[];
  isDataSource?: boolean;
  isDataSink?: boolean;
  isDataTransformer?: boolean;
  isDataStore?: boolean;
  metadata?: Record<string, any>;
}

/**
 * Data Flow types and enums
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

export interface DataFlowGraph {
  nodes: Map<string, DataNode>;
  flows: DataFlow[];
  paths: DataFlowPath[];
}

/**
 * Clustering types and enums
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

export type SimilarityMatrix = Map<string, Map<string, number>>;

/**
 * Options for emergent indexing
 */
export interface EmergentIndexingOptions {
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
  
  /** Which semantic analyzer to use ('standard' or 'enhanced') */
  semanticAnalyzerType?: 'standard' | 'enhanced';
  
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
}

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

export interface SemanticResults {
  concepts: Concept[];
  semanticUnits: SemanticUnit[];
}

/**
 * Interface for Semantic Analyzers
 */
export interface ISemanticAnalyzer {
  analyzeSemantics(understanding: CodebaseUnderstanding): Promise<SemanticResults>;
}

/**
 * The core codebase understanding model
 */
export interface CodebaseUnderstanding {
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

  /* Derived code elements for data flow analysis */
  elements?: CodeElement[];

  /* Entry points for code navigation and data flow analysis */
  entryPoints?: string[];

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

  /* Metadata */
  metadata: Record<string, any>;

  /* Settings used for this understanding */
  options: EmergentIndexingOptions;
}

/**
 * Result of the indexing operation
 */
export interface EmergentIndexingResult {
  understanding: CodebaseUnderstanding;
  
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
  };
  
  errors?: Array<{
    path: string;
    error: string;
  }>;
}

/**
 * Main service interface for emergent codebase indexing
 */
export interface EmergentIndexingService {
  /**
   * Analyze a codebase and build an emergent understanding of it
   */
  analyzeCodebase(
    rootPath: string, 
    options?: Partial<EmergentIndexingOptions>
  ): Promise<EmergentIndexingResult>;
  
  /**
   * Update an existing understanding incrementally
   */
  updateUnderstanding(
    rootPath: string, 
    existingUnderstanding: CodebaseUnderstanding,
    options?: Partial<EmergentIndexingOptions>
  ): Promise<EmergentIndexingResult>;
  
  /**
   * Query the codebase understanding
   */
  queryUnderstanding(
    understanding: CodebaseUnderstanding,
    query: any
  ): Promise<any>;
  
  /**
   * Save the understanding to persistent storage
   */
  saveUnderstanding(
    understanding: CodebaseUnderstanding,
    path: string
  ): Promise<void>;
  
  /**
   * Load an understanding from persistent storage
   */
  loadUnderstanding(path: string): Promise<CodebaseUnderstanding>;

  /**
   * Cluster code elements to find natural groupings
   */
  clusterCodeElements(
    understanding: CodebaseUnderstanding,
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
    understanding: CodebaseUnderstanding,
    options?: {
      maxDepth?: number;
      includeAsyncFlows?: boolean;
      includeConditionalFlows?: boolean;
      minConfidence?: number;
    }
  ): Promise<DataFlowGraph>;
}