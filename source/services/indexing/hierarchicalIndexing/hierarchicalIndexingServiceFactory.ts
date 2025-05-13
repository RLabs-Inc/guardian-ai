/**
 * Factory for creating instances of the hierarchical indexing service
 */

import { FileSystemService } from '../../fileSystem/types.js';
import { HierarchicalIndexingService } from './hierarchicalIndexingService.js';
import { AstParser } from './astParser.js';
import { HashTracker } from './hashTracker.js';
import { RelationshipDetector } from './relationshipDetector.js';
import { IndexStorage } from './indexStorage.js';

export class HierarchicalIndexingServiceFactory {
  /**
   * Create a new instance of the hierarchical indexing service
   * @param fileSystem File system service implementation
   */
  static createService(fileSystem: FileSystemService): HierarchicalIndexingService {
    // Create required components
    const astParser = new AstParser();
    const hashTracker = new HashTracker();
    const relationshipDetector = new RelationshipDetector();
    const indexStorage = new IndexStorage();
    
    // Create and return the service
    return new HierarchicalIndexingService(
      fileSystem,
      astParser,
      hashTracker,
      relationshipDetector,
      indexStorage
    );
  }
}