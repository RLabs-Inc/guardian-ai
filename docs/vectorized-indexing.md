# Vectorized Code Indexing

## Overview

The vectorized indexing system in GuardianAI enhances the LLM-directed pattern execution framework with vector embeddings for efficient semantic search. This document explains the implementation, integration points, and usage of the vectorized system.

## Architecture

The vectorized indexing system consists of three main components:

1. **Vector Storage Service** - Stores and retrieves code embeddings
2. **Embedding Service** - Generates vector embeddings for code elements
3. **Vectorized Indexing Service** - Integrates with the LLM-directed indexing service

### Vector Storage

We use Vectra, a lightweight file-based vector database for Node.js. Key features:

- **Local Storage** - All vectors are stored in the project's `.guardian-ai/vector-storage` directory
- **In-Memory Search** - Vectors are loaded into memory for fast similarity search
- **Persistent Storage** - Data is saved to disk for reuse across sessions
- **Metadata Filtering** - Support for filtering by metadata properties

Vectra stores each index in a folder with an `index.json` file containing vectors and indexed metadata. Other metadata is stored in separate files keyed by GUID.

### Embedding Generation

The embedding service converts code elements into vector representations using OpenAI's embedding API. Features include:

- **Caching** - Frequently used embeddings are cached to reduce API calls
- **Batching** - Multiple embeddings are generated in batches for efficiency
- **Configurable Model** - Can use different embedding models as needed

### Integration with LLM-Directed Indexing

The vectorized system enhances the original LLM-directed indexing service by:

1. Preserving all the flexibility of the original Pattern Execution Framework
2. Adding vector storage for code symbols and relationships
3. Enabling semantic search capabilities for codebase analysis

## Implementation Details

### Embedding Code Symbols

Each code symbol (function, class, variable, etc.) is converted to a text representation that includes:

- Symbol name, type, and file path
- Signature and documentation (if available)
- Parent and scope information
- Full code content

This text representation is then embedded into a vector using the embedding service.

### Embedding Relationships

Relationships between symbols (imports, inheritance, calls, etc.) are converted to text representations that include:

- Relationship type
- Source and target symbol information
- Source and target file paths
- Associated metadata

This text representation is then embedded into a vector for semantic relationship search.

### Semantic Search

The vectorized indexing service enables several semantic search capabilities:

1. **Finding Similar Symbols** - Find symbols semantically related to a query
2. **Finding Relevant Relationships** - Discover relationships that match the query's intent
3. **Context-Aware Search** - Search based on meaning rather than just text matching

## Usage

To use the vectorized indexing system:

```typescript
import { VectorizedIndexingService } from './source/services/indexing';
import { VectraStorageService } from './source/services/vectorStorage';
import { OpenAIEmbeddingService } from './source/services/embedding';
import { LLMService } from './source/services/llm';
import { FileSystemService } from './source/services/fileSystem';

// Create services
const llmService = new LLMService(/* ... */);
const fileSystem = new FileSystemService();

// Create vector storage service
const vectorStorage = new VectraStorageService({
  storagePath: '/path/to/project/.guardian-ai/vector-storage',
  dimensions: 1536, // OpenAI's embedding dimension
  indexedMetadataFields: ['type', 'filePath', 'symbolType']
});

// Create embedding service
const embeddingService = new OpenAIEmbeddingService(llmService, {
  cache: { enabled: true, maxItems: 1000 }
});

// Create vectorized indexing service
const indexingService = new VectorizedIndexingService(
  fileSystem,
  llmService,
  embeddingService,
  vectorStorage
);

// Initialize and use
await indexingService.indexCodebase('/path/to/project');

// Find symbols semantically
const symbols = await indexingService.findSymbols('handle user authentication');

// Find relevant relationships
const relationships = await indexingService.findRelationships('data flow between auth and database');
```

## Benefits for Codebase Steward

The vectorized indexing system provides significant benefits for the Codebase Steward:

1. **Deeper Understanding** - Semantic search helps the Steward understand code patterns beyond just keyword matching
2. **Efficient Context Retrieval** - The Steward can quickly find relevant context for user queries
3. **Better Pattern Recognition** - Similar code patterns can be found even when different naming conventions are used
4. **Flexible Knowledge Representation** - The system can adapt to any codebase patterns the LLM discovers
5. **Improved Implementation Guidance** - The Steward can provide more relevant guidance to the Implementer Agent

## Performance Considerations

- **Memory Usage** - Vectra loads all vectors into memory, so very large codebases may require significant RAM
- **Embedding Generation** - The initial embedding generation can take time for large codebases
- **API Usage** - Using OpenAI's embedding API incurs costs based on token count

For most projects, the performance impact is minimal and the benefits of semantic search far outweigh the costs.

## Future Improvements

Potential enhancements to the vectorized indexing system:

1. **Local Embedding Models** - Use local models for embedding generation to remove API dependency
2. **Hierarchical Storage** - Implement a hierarchical storage system for better scaling to very large codebases
3. **Incremental Updates** - Optimize incremental updates to minimize re-embedding
4. **Custom Embedding Schemes** - Develop specialized embedding approaches for different code elements
5. **Cross-Modal Embeddings** - Generate embeddings that can link code, documentation, and tasks in the same vector space

## Conclusion

The vectorized indexing system enhances the LLM-directed indexing service with efficient semantic search capabilities while preserving the flexible, schema-free approach of the Pattern Execution Framework. This enables the Codebase Steward to develop a deeper understanding of codebases and provide more relevant guidance to the Implementer Agent.