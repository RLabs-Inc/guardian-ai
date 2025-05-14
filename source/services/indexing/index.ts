// source/services/indexing/index.ts

// Transitional - support both old and new exports
export * from './emergentIndexing/index.js';

// Export core types first to avoid circular references
export {
  IndexingPhase,
  UnifiedIndexingOptions,
  ExtendedIndexingOptions,
  CodeNodeType,
  RelationshipType,
  DataNodeRole,
  DataFlowType,
  DependencyType,
  ClusteringAlgorithm,
  ClusteringMetric
} from './unifiedTypes.js';

// Export data structures
export type {
  UnifiedIndexingResult,
  UnifiedCodebaseUnderstanding,
  FileNode,
  DirectoryNode,
  FileSystemTree,
  CodeNode,
  Relationship,
  CodePattern,
  Dependency,
  ImportStatement,
  ExportStatement,
  DependencyGraph,
  DataNode,
  DataFlow,
  DataFlowPath,
  DataFlowGraph,
  Concept,
  SemanticUnit,
  CodeCluster
} from './unifiedTypes.js';

// Export interface
export type { UnifiedIndexingService as IndexingServiceInterface } from './unifiedTypes.js';

// Export analyzers implementations
export * from './analyzers/index.js';

// Export legacy service for backward compatibility
export { TreeSitterIndexingService } from './indexingService.js';

// Export the unified services
import { 
  UnifiedIndexingService, 
  UnifiedIndexingServiceFactory 
} from './unifiedIndexingService.js';

export {
  UnifiedIndexingService,
  UnifiedIndexingServiceFactory
};

// Default export
export default UnifiedIndexingService;