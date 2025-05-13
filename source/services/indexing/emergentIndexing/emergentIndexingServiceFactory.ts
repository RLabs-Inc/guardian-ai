/**
 * Emergent Indexing Service Factory
 * 
 * Creates and configures the emergent indexing service and its dependencies.
 */

import { FileSystemService } from '../../fileSystem/types.js';
import { EmergentIndexingOptions } from './types.js';
import { EmergentIndexingService } from './emergentIndexingService.js';
import { LanguageDetector } from './languageDetector.js';
import { PatternDiscovery } from './patternDiscovery.js';
import { RelationshipDetector } from './relationshipDetector.js';
import { SemanticAnalyzer } from './semanticAnalyzer.js';
import { EnhancedSemanticAnalyzer } from './semanticAnalyzer.enhanced.js';
import { UnderstandingStorage } from './understandingStorage.js';
import { HashTracker } from './hashTracker.js';
import { DataFlowAnalyzer } from './dataFlowAnalyzer.js';

/**
 * Factory for creating emergent indexing service instances
 */
export class EmergentIndexingServiceFactory {
  /**
   * Create an emergent indexing service with all its dependencies
   */
  static create(fileSystem: FileSystemService, options?: Partial<EmergentIndexingOptions>): EmergentIndexingService {
    // Create dependencies
    const languageDetector = new LanguageDetector();
    const patternDiscovery = new PatternDiscovery();
    const relationshipDetector = new RelationshipDetector();
    
    // Choose the semantic analyzer based on options
    const semanticAnalyzerType = options?.semanticAnalyzerType || 'standard';
    const semanticAnalyzer = semanticAnalyzerType === 'enhanced' 
      ? new EnhancedSemanticAnalyzer() 
      : new SemanticAnalyzer();
      
    const storage = new UnderstandingStorage();
    const hashTracker = new HashTracker();
    const dataFlowAnalyzer = new DataFlowAnalyzer(patternDiscovery);

    // Create and return the service
    return new EmergentIndexingService(
      fileSystem,
      languageDetector,
      patternDiscovery,
      relationshipDetector,
      semanticAnalyzer,
      storage,
      hashTracker,
      dataFlowAnalyzer
    );
  }
}