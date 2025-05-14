/**
 * Legacy IndexingService Interface
 * Only kept for backward compatibility during transition
 * This file will be removed in a future release
 */

import { FileSystemService } from '../fileSystem/types.js';
import { UnifiedIndexingService } from './unifiedIndexingService.js';
import { UnifiedIndexingServiceFactory } from './unifiedIndexingServiceFactory.js';

/**
 * @deprecated Use UnifiedIndexingService instead
 */
export class TreeSitterIndexingService {
  private unifiedService: UnifiedIndexingService;

  constructor(fileSystemService: FileSystemService) {
    // Create the unified service with all analyzers
    this.unifiedService = UnifiedIndexingServiceFactory.create(fileSystemService);
  }

  /**
   * @deprecated Use unifiedService.analyzeCodebase() instead
   */
  async analyzeCodebase(rootPath: string, options?: any): Promise<any> {
    return this.unifiedService.analyzeCodebase(rootPath, options);
  }

  /**
   * @deprecated Use unifiedService.saveUnderstanding() instead
   */
  async saveIndex(rootPath: string): Promise<void> {
    // Analyze and immediately save
    const result = await this.unifiedService.analyzeCodebase(rootPath);
    await this.unifiedService.saveUnderstanding(result.understanding, rootPath);
  }

  /**
   * @deprecated Use unifiedService.loadUnderstanding() instead
   */
  async loadIndex(rootPath: string): Promise<any> {
    // Delegate to unified service
    return this.unifiedService.loadUnderstanding(rootPath);
  }
}