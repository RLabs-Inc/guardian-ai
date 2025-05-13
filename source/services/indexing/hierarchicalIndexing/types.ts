/**
 * Types for the hierarchical indexing system
 */

/**
 * Represents a node in the hierarchical index tree
 */
export interface IndexNode {
  /** Unique identifier for the node */
  id: string;
  
  /** Type of node (project, directory, file, class, function, etc) */
  type: IndexNodeType;
  
  /** Name of the node */
  name: string;
  
  /** SHA256 hash of the node's content */
  contentHash: string;
  
  /** Path to the node, relative to the project root */
  path: string;
  
  /** Metadata relevant to the node type */
  metadata: Record<string, any>;
  
  /** References to child nodes */
  children?: IndexNode[];
  
  /** Content or reference to content */
  content?: string | {
    /** Where to find the content */
    reference: string;
    /** Type of reference */
    referenceType: 'file' | 'database' | 'memory';
  };
  
  /** Timestamp when this node was last indexed */
  lastIndexed: number;
  
  /** Optional parent reference for bidirectional traversal */
  parent?: {
    id: string;
    type: IndexNodeType;
  };
}

/**
 * Types of nodes in the index tree
 */
export enum IndexNodeType {
  PROJECT = 'project',
  DIRECTORY = 'directory',
  FILE = 'file',
  CLASS = 'class',
  METHOD = 'method',
  FUNCTION = 'function',
  VARIABLE = 'variable',
  INTERFACE = 'interface',
  TYPE = 'type',
  BLOCK = 'block',
  IMPORT = 'import',
  EXPORT = 'export'
}

/**
 * Represents a relationship between two index nodes
 */
export interface IndexRelationship {
  /** Type of relationship */
  type: RelationshipType;
  
  /** Source node ID */
  sourceId: string;
  
  /** Target node ID */
  targetId: string;
  
  /** Additional details about the relationship */
  metadata?: Record<string, any>;
}

/**
 * Types of relationships between nodes
 */
export enum RelationshipType {
  CONTAINS = 'contains',
  IMPORTS = 'imports',
  EXTENDS = 'extends',
  IMPLEMENTS = 'implements',
  CALLS = 'calls',
  REFERENCES = 'references',
  INHERITS = 'inherits',
  USES = 'uses',
  DEFINES = 'defines'
}

/**
 * Options for indexing
 */
export interface IndexingOptions {
  /** Whether to enable incremental indexing */
  incremental: boolean;
  
  /** Maximum depth to index (undefined = unlimited) */
  maxDepth?: number;
  
  /** File patterns to include */
  include?: string[];
  
  /** File patterns to exclude */
  exclude?: string[];
  
  /** Whether to include AST details */
  includeAst?: boolean;
  
  /** Whether to extract symbol relationships */
  extractRelationships?: boolean;
  
  /** Whether to generate semantic embeddings */
  generateEmbeddings?: boolean;
}

/**
 * Result of an indexing operation
 */
export interface IndexingResult {
  /** Root node of the index */
  root: IndexNode;

  /** Statistics about the indexing operation */
  stats: {
    /** Number of files indexed */
    filesIndexed: number;
    /** Number of directories indexed */
    directoriesIndexed: number;
    /** Number of symbols extracted */
    symbolsExtracted: number;
    /** Number of relationships identified */
    relationshipsExtracted: number;
    /** Total time taken in milliseconds */
    timeTakenMs: number;
    /** Memory usage in bytes */
    memoryUsageBytes: number;
    /** Number of files added (incremental indexing) */
    filesAdded?: number;
    /** Number of files modified (incremental indexing) */
    filesModified?: number;
    /** Number of files deleted (incremental indexing) */
    filesDeleted?: number;
  };

  /** Errors encountered during indexing */
  errors?: Array<{
    path: string;
    error: string;
  }>;
}

/**
 * Interface for the hierarchical indexing service
 */
export interface HierarchicalIndexingService {
  /**
   * Index a project
   * @param projectRoot Path to the project root
   * @param options Indexing options
   */
  indexProject(projectRoot: string, options?: Partial<IndexingOptions>): Promise<IndexingResult>;
  
  /**
   * Update an existing index incrementally
   * @param projectRoot Path to the project root
   * @param existingIndex Existing index root node
   * @param options Indexing options
   */
  updateIndex(projectRoot: string, existingIndex: IndexNode, options?: Partial<IndexingOptions>): Promise<IndexingResult>;
  
  /**
   * Query the index for nodes matching specific criteria
   * @param index Index root node
   * @param query Query parameters
   */
  queryIndex(index: IndexNode, query: IndexQuery): Promise<IndexNode[]>;
  
  /**
   * Save the index to storage
   * @param index Index to save
   * @param path Path where to save the index
   */
  saveIndex(index: IndexNode, path: string): Promise<void>;
  
  /**
   * Load an index from storage
   * @param path Path to the stored index
   */
  loadIndex(path: string): Promise<IndexNode>;
}

/**
 * Query parameters for searching the index
 */
export interface IndexQuery {
  /** Type of nodes to find */
  nodeType?: IndexNodeType | IndexNodeType[];
  
  /** Path pattern to match */
  pathPattern?: string | RegExp;
  
  /** Name pattern to match */
  namePattern?: string | RegExp;
  
  /** Content pattern to match */
  contentPattern?: string | RegExp;
  
  /** Relationship criteria */
  relationship?: {
    /** Type of relationship */
    type: RelationshipType;
    /** ID of the related node */
    withNode: string;
    /** Direction of relationship */
    direction: 'incoming' | 'outgoing' | 'both';
  };
  
  /** Maximum results to return */
  limit?: number;
  
  /** Custom filtering function */
  filter?: (node: IndexNode) => boolean;
}