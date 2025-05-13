/**
 * Hierarchical Indexing Service
 *
 * This module provides a sophisticated approach to code indexing using:
 * - Hash-based change detection
 * - AST-aware code parsing
 * - Multi-level hierarchy for files, directories, and code structures
 */

export { HierarchicalIndexingService } from './hierarchicalIndexingService.js';
export * from './hierarchicalIndexingServiceFactory.js';
export { AstParser } from './astParser.js';
export { HashTracker } from './hashTracker.js';
export { RelationshipDetector } from './relationshipDetector.js';
export { IndexStorage } from './indexStorage.js';
export type {
  IndexNode,
  IndexNodeType,
  IndexRelationship,
  RelationshipType,
  IndexingOptions,
  IndexingResult,
  IndexQuery,
  HierarchicalIndexingService as HierarchicalIndexingServiceInterface
} from './types.js';