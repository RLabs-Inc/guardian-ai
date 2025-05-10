// source/services/indexing/index.ts

// Export submodules
export * from './types.js';
export * from './indexingService.js';
export * from './llmDirected/index.js';

// Default exports
import { TreeSitterIndexingService } from './indexingService.js';
import {
  LLMDirectedIndexingService,
  VectorizedIndexingService
} from './llmDirected/index.js';

export {
  TreeSitterIndexingService,
  LLMDirectedIndexingService,
  VectorizedIndexingService
};

// Default export - Now we prefer the Vectorized LLM-directed version as default
export default VectorizedIndexingService;