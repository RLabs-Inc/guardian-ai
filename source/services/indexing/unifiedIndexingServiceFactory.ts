/**
 * Unified Indexing Service Factory
 * 
 * Creates and configures the integrated indexing service and its analyzers.
 */

import { FileSystemService } from '../fileSystem/types.js';
import { UnifiedIndexingService } from './unifiedIndexingService.js';
import { IndexingCoordinator } from './indexingCoordinator.js';

// Import all analyzers from the unified index
import {
  LanguageDetectorAnalyzer,
  RelationshipAnalyzer,
  PatternAnalyzer,
  DependencyAnalyzer,
  DataFlowAnalyzer,
  SemanticAnalyzer,
  ClusteringAnalyzer
} from './analyzers/index.js';

/**
 * Factory for creating the integrated emergent indexing service
 */
export class UnifiedIndexingServiceFactory {
  /**
   * Create a unified indexing service with all its analyzers
   */
  static create(fileSystem: FileSystemService): UnifiedIndexingService {
    // Create indexing coordinator
    const coordinator = new IndexingCoordinator(fileSystem);
    
    // Register all analyzers in priority order
    // Language detector must be first as other analyzers rely on language information
    coordinator.registerAnalyzer(new LanguageDetectorAnalyzer());
    
    // Core structure analyzers
    coordinator.registerAnalyzer(new RelationshipAnalyzer());
    coordinator.registerAnalyzer(new PatternAnalyzer());
    coordinator.registerAnalyzer(new DependencyAnalyzer());
    
    // Advanced analyzers that build on core structure
    coordinator.registerAnalyzer(new DataFlowAnalyzer());
    coordinator.registerAnalyzer(new SemanticAnalyzer());
    
    // Final integrative analyzer
    coordinator.registerAnalyzer(new ClusteringAnalyzer());
    
    // Create and return the unified service
    return new UnifiedIndexingService(coordinator, fileSystem);
  }
}