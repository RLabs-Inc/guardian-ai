// source/services/indexing/types.ts

/**
 * Enum for symbol types
 */
export enum SymbolType {
  Function = 'function',
  Class = 'class',
  Variable = 'variable',
  Import = 'import',
  Export = 'export',
  Interface = 'interface',
  Type = 'type'
}

/**
 * Symbol location structure
 */
export interface SymbolLocation {
  filePath: string;
  startLine: number;
  endLine: number;
  startColumn: number;
  endColumn: number;
}

/**
 * Symbol interface for tree-sitter parsing
 */
export interface Symbol {
  name: string;
  type: SymbolType;
  location: SymbolLocation;
  scope?: string;
  parent?: string;
  children?: string[];
  signature?: string;
  documentation?: string;
}

/**
 * Import type enum
 */
export enum ImportType {
  Standard = 'standard',
  Default = 'default',
  Named = 'named',
  Namespace = 'namespace',
  Dynamic = 'dynamic',
  Import = 'import'
}

/**
 * Dependency target interface
 */
export interface DependencyTarget {
  name: string;
  path: string;
  type: ImportType;
}

/**
 * Import dependency interface
 */
export interface ImportDependency {
  source: string;
  target: DependencyTarget;
  importType: ImportType;
  type: 'import' | 'export' | 'call' | 'inheritance' | 'implementation';
}

/**
 * Standard code symbol interface
 */
export interface CodeSymbol {
  name: string;
  type:
    | 'function'
    | 'class'
    | 'variable'
    | 'import'
    | 'export'
    | 'interface'
    | 'type';
  location: {
    filePath: string;
    startLine: number;
    endLine: number;
    startColumn: number;
    endColumn: number;
  };
  scope?: string;
  parent?: string;
  children?: string[];
  signature?: string;
  documentation?: string;
}

/**
 * Standard code dependency interface
 */
export interface CodeDependency {
  source: string;
  target: string;
  type: 'import' | 'export' | 'call' | 'inheritance' | 'implementation';
}

/**
 * Indexed codebase structure
 */
export interface IndexedCodebase {
  symbols: Record<string, CodeSymbol>;
  dependencies: CodeDependency[];
  files: string[];
  statistics: {
    totalFiles: number;
    totalSymbols: number;
    totalDependencies: number;
    lastIndexed: string | Date;
  };
}

/**
 * Indexing options
 */
export interface IndexingOptions {
  includePatterns?: RegExp[];
  excludePatterns?: RegExp[];
  maxFiles?: number;
  parseDocumentation?: boolean;
  includeGitHistory?: boolean;
}

/**
 * Indexing service interface
 */
export interface IndexingService {
  /**
   * Indexes a codebase and returns the indexed data
   */
  indexCodebase(
    path: string,
    options?: IndexingOptions,
  ): Promise<IndexedCodebase>;

  /**
   * Updates the index for specific files
   */
  updateIndex(files: string[]): Promise<void>;

  /**
   * Retrieves symbols matching a query
   */
  findSymbols(query: string): Promise<CodeSymbol[]>;

  /**
   * Retrieves the current index
   */
  getIndex(): Promise<IndexedCodebase>;

  /**
   * Saves the current index to persistent storage
   */
  saveIndex(): Promise<void>;

  /**
   * Loads an index from persistent storage
   */
  loadIndex(path: string): Promise<IndexedCodebase>;
}