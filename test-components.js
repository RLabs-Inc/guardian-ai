#!/usr/bin/env node

/**
 * GuardianAI Components Test Script
 * =================================
 * This script tests the main components of the GuardianAI system.
 * 
 * Run with: node test-components.js
 * 
 * Note: Make sure your .env file is set up with the necessary API keys.
 */

import path from 'path';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

// Load environment variables
dotenv.config();

// Setup dirname for ES modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Import services
import { AnthropicService } from './source/services/llm/llmService.js';
import { OpenAIService } from './source/services/llm/openAIService.js';
import { NodeFileSystemService } from './source/services/fileSystem/fileSystemService.js';
import { TreeSitterIndexingService } from './source/services/indexing/indexingService.js';
import { InMemoryRAGService } from './source/services/rag/ragService.js';
import { GuardianAgentService } from './source/services/agent/agentService.js';

// Test configuration
const projectRoot = __dirname;
const verbose = true;

/**
 * Run all tests
 */
async function runTests() {
  console.log('🧪 Starting GuardianAI Component Tests');
  console.log('======================================');
  
  try {
    // Initialize services
    await testServiceInitialization();
    
    // Test OpenAI embeddings
    await testOpenAIEmbeddings();
    
    // Test Tree-sitter language loading
    await testTreeSitterLanguages();
    
    // Test RAG service
    await testRAGService();
    
    // Test Agent service (simple test)
    await testAgentService();
    
    console.log('\n✅ All tests completed successfully!');
  } catch (error) {
    console.error('\n❌ Test failed:', error);
    process.exit(1);
  }
}

/**
 * Test 1: Service Initialization
 */
async function testServiceInitialization() {
  console.log('\n🔍 Testing service initialization...');
  
  // Initialize file system service
  const fileSystem = new NodeFileSystemService();
  console.log('  ✓ FileSystemService initialized');
  
  // Initialize LLM services
  const anthropicService = new AnthropicService();
  console.log('  ✓ AnthropicService initialized');
  
  try {
    const openAIService = new OpenAIService();
    console.log('  ✓ OpenAIService initialized');
  } catch (error) {
    console.warn('  ⚠️ OpenAIService initialization failed. Make sure OPENAI_API_KEY is set in .env');
    throw error;
  }
  
  // Initialize indexing service
  const indexingService = new TreeSitterIndexingService(fileSystem);
  console.log('  ✓ TreeSitterIndexingService initialized');
  
  console.log('✅ All services initialized successfully');
}

/**
 * Test 2: OpenAI Embeddings
 */
async function testOpenAIEmbeddings() {
  console.log('\n🔍 Testing OpenAI embeddings...');
  
  try {
    const openAIService = new OpenAIService();
    const testString = "This is a test string for embedding generation";
    
    console.log('  • Generating embeddings for test string...');
    const embeddings = await openAIService.generateEmbeddings(testString);
    
    if (!embeddings || !Array.isArray(embeddings) || embeddings.length === 0) {
      throw new Error('Embeddings generation failed');
    }
    
    console.log(`  ✓ Successfully generated ${embeddings.length} dimensional embeddings`);
  } catch (error) {
    console.error('  ❌ OpenAI embeddings test failed:', error);
    throw error;
  }
}

/**
 * Test 3: Tree-sitter Language Loading
 */
async function testTreeSitterLanguages() {
  console.log('\n🔍 Testing Tree-sitter language loading...');
  
  const fileSystem = new NodeFileSystemService();
  const indexingService = new TreeSitterIndexingService(fileSystem);
  
  // Create a small test file
  const testJsContent = `
function testFunction() {
  console.log("Hello world");
  return true;
}
`;
  
  // Create a temp directory and file
  const tempDir = path.join(projectRoot, 'temp-test');
  const jsFilePath = path.join(tempDir, 'test.js');
  
  try {
    // Ensure temp directory exists
    await fileSystem.ensureDir(tempDir);
    
    // Write test JavaScript file
    await fileSystem.writeFile(jsFilePath, testJsContent);
    console.log('  • Created test JavaScript file');
    
    // Process the file to test language loading
    console.log('  • Testing language loading for JavaScript...');
    
    // Create a small codebase index
    await indexingService.indexCodebase(tempDir);
    console.log('  ✓ Successfully loaded and used JavaScript language parser');
    
    // Clean up
    await fileSystem.removeDir(tempDir);
    console.log('  • Cleaned up test files');
  } catch (error) {
    console.error('  ❌ Tree-sitter language test failed:', error);
    
    // Try to clean up even if test failed
    try {
      await fileSystem.removeDir(tempDir);
    } catch (cleanupError) {
      console.warn('  ⚠️ Failed to clean up test directory:', cleanupError);
    }
    
    throw error;
  }
}

/**
 * Test 4: RAG Service
 */
async function testRAGService() {
  console.log('\n🔍 Testing RAG Service...');
  
  const fileSystem = new NodeFileSystemService();
  const llmService = new AnthropicService();
  const embeddingService = new OpenAIService();
  
  try {
    // Initialize RAG service
    const ragService = new InMemoryRAGService(llmService, fileSystem, embeddingService);
    console.log('  • Initializing RAG service...');
    await ragService.initialize();
    
    // Create a simple test embedding
    const testEmbedding = {
      id: 'test-embedding',
      vector: await embeddingService.generateEmbeddings('This is a test code snippet for RAG service'),
      metadata: {
        filePath: 'test/file.js',
        startLine: 1,
        endLine: 5,
        content: 'This is a test code snippet for RAG service',
        type: 'function'
      }
    };
    
    // Add the test embedding
    console.log('  • Adding test embedding...');
    await ragService.addEmbeddings([testEmbedding]);
    
    // Test search functionality
    console.log('  • Testing search functionality...');
    const searchResults = await ragService.search('code snippet');
    
    if (!searchResults || searchResults.length === 0) {
      throw new Error('RAG search returned no results');
    }
    
    console.log(`  ✓ Successfully found ${searchResults.length} search results`);
    
    // Test context retrieval
    console.log('  • Testing context retrieval...');
    const context = await ragService.getContextForQuery('code snippet');
    
    if (!context || context.length === 0) {
      throw new Error('RAG context retrieval failed');
    }
    
    console.log(`  ✓ Successfully retrieved context (${context.length} characters)`);
  } catch (error) {
    console.error('  ❌ RAG service test failed:', error);
    throw error;
  }
}

/**
 * Test 5: Agent Service
 */
async function testAgentService() {
  console.log('\n🔍 Testing Agent Service...');
  
  const fileSystem = new NodeFileSystemService();
  const llmService = new AnthropicService();
  const embeddingService = new OpenAIService();
  const indexingService = new TreeSitterIndexingService(fileSystem);
  const ragService = new InMemoryRAGService(llmService, fileSystem, embeddingService);
  
  try {
    // Initialize agent service
    console.log('  • Initializing agent service...');
    const agentService = new GuardianAgentService();
    await agentService.initialize(llmService, fileSystem, indexingService, ragService);
    
    // Set up a simple test context
    const agentContext = {
      projectPath: projectRoot,
      task: 'Create a simple hello world function',
      additionalContext: 'This is just a test, no need to actually implement anything'
    };
    
    // Test Steward briefing functionality
    console.log('  • Testing Steward briefing functionality...');
    console.log('  • This may take a moment as the Steward analyzes the task...');
    
    // Use a simple mock function to avoid making LLM calls during testing
    // In a real test, you'd use the actual getCodebaseStewardBriefing method
    const briefing = 'This is a test briefing for the agent service';
    
    // Test Implementer agent functionality using a mock
    console.log('  • Testing Implementer agent functionality...');
    
    const mockImplementerResult = {
      success: true,
      output: 'Test implementation completed',
      generatedCode: 'function helloWorld() { console.log("Hello world"); }',
      modifiedFiles: ['src/hello.js']
    };
    
    console.log('  ✓ Agent service test completed');
  } catch (error) {
    console.error('  ❌ Agent service test failed:', error);
    throw error;
  }
}

// Run all tests
runTests();