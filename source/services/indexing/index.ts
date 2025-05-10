// source/services/indexing/index.ts

// Export submodules
export * from './types.js';
export * from './indexingService.js';
export * from './llmDirected/index.js';

// Default exports
import { TreeSitterIndexingService } from './indexingService.js';
import { LLMDirectedIndexingService } from './llmDirected/llmDirectedIndexingService.js';

export { 
  TreeSitterIndexingService, 
  LLMDirectedIndexingService 
};

// Default export - we'll keep the TreeSitter version as the default for now
export default TreeSitterIndexingService;