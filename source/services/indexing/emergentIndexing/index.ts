/**
 * Emergent Codebase Understanding System
 * 
 * A completely adaptive approach to code understanding that builds an emergent model
 * of any codebase, regardless of language, framework, or organization.
 */

// Main service and factory
export { EmergentIndexingService } from './emergentIndexingService.js';
export { EmergentIndexingServiceFactory } from './emergentIndexingServiceFactory.js';

// Core components
export { LanguageDetector } from './languageDetector.js';
export { PatternDiscovery } from './patternDiscovery.js';
export { RelationshipDetector } from './relationshipDetector.js';
export { SemanticAnalyzer } from './semanticAnalyzer.js';
export { EnhancedSemanticAnalyzer } from './semanticAnalyzer.enhanced.js';
export { UnderstandingStorage } from './understandingStorage.js';

// Types
export type {
  EmergentIndexingOptions,
  EmergentIndexingResult,
  CodebaseUnderstanding,
  FileNode,
  DirectoryNode,
  FileSystemTree,
  LanguageDetails,
  LanguageStructure,
  CodeNode,
  CodePattern,
  Relationship,
  Concept,
  SemanticUnit,
  SemanticResults,
  ISemanticAnalyzer
} from './types.js';

export { CodeNodeType, RelationshipType } from './types.js';