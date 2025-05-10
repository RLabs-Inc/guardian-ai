// source/services/indexing/llmDirected/index.ts
export * from './agentProtocol.js';
export * from './storagePrimitives.js';
export * from './indexingAgent.js';
export * from './llmDirectedIndexingService.js';
export * from './vectorizedIndexingService.js';
export * from './symbolExtractor.js';
// Export specific items from relationshipMapper to avoid conflict with agentProtocol
export { RelationshipMapper } from './relationshipMapper.js';
export * from './patternInterpreter.js';

// Default exports for convenience
import { LLMDirectedIndexingService } from './llmDirectedIndexingService.js';
import { VectorizedIndexingService } from './vectorizedIndexingService.js';

export {
  LLMDirectedIndexingService,
  VectorizedIndexingService
};

// Prefer the vectorized service as default export when available
export default VectorizedIndexingService;
