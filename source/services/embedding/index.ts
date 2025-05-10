// source/services/embedding/index.ts

// Export public types and implementations
export * from './types.js';
export * from './openAIEmbeddingService.js';

// Default export
import { OpenAIEmbeddingService } from './openAIEmbeddingService.js';
export default OpenAIEmbeddingService;