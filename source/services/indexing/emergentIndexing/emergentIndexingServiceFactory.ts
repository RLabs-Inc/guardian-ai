/**
 * Emergent Indexing Service Factory
 * 
 * Creates and configures the emergent indexing service and its dependencies.
 */

import { FileSystemService } from '../../fileSystem/types.js';
import { EmergentIndexingService } from './emergentIndexingService.js';
import { LanguageDetector } from './languageDetector.js';
import { PatternDiscovery } from './patternDiscovery.js';
import { RelationshipDetector } from './relationshipDetector.js';
import { SemanticAnalyzer } from './semanticAnalyzer.js';
import { UnderstandingStorage } from './understandingStorage.js';
import { HashTracker } from './hashTracker.js';
import { DataFlowAnalyzer } from './dataFlowAnalyzer.js';
import { DependencyAnalyzer } from './dependencyAnalyzer.js';

/**
 * Factory for creating emergent indexing service instances
 */
export class EmergentIndexingServiceFactory {
  /**
   * Create an emergent indexing service with all its dependencies
   */
  static create(fileSystem: FileSystemService): EmergentIndexingService {
    // Create dependencies
    const languageDetector = new LanguageDetector();
    const patternDiscovery = new PatternDiscovery();
    const relationshipDetector = new RelationshipDetector();
    
    // Create semantic analyzer - now we always use the enhanced version (formerly called "enhanced")
    const semanticAnalyzer = new SemanticAnalyzer();
      
    const storage = new UnderstandingStorage();
    const hashTracker = new HashTracker();
    const dataFlowAnalyzer = new DataFlowAnalyzer(patternDiscovery);
    const dependencyAnalyzer = new DependencyAnalyzer(fileSystem);

    // Create and return the service
    // The options are used when calling methods on the service, not in the constructor
    // The merged options with defaults are applied in the analyzeCodebase and updateUnderstanding methods
    return new EmergentIndexingService(
      fileSystem,
      languageDetector,
      patternDiscovery,
      relationshipDetector,
      semanticAnalyzer,
      storage,
      hashTracker,
      dataFlowAnalyzer,
      dependencyAnalyzer
    );
  }
}