/**
 * Incremental Indexing Demo
 * 
 * Demonstrates the incremental update capabilities of the emergent indexing system,
 * showing how it efficiently updates understanding when files change.
 */

import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import { NodeFileSystemService } from '../../../fileSystem/fileSystemService.js';
import { EmergentIndexingServiceFactory } from '../emergentIndexingServiceFactory.js';
import { CodebaseUnderstanding } from '../types.js';

// Helper function for demo output
function printSeparator(title: string): void {
  console.log('\n' + '='.repeat(80));
  console.log(title);
  console.log('='.repeat(80) + '\n');
}

/**
 * Create a small test file to demonstrate incremental updates
 */
async function createTestFile(projectPath: string, fileName: string, content: string): Promise<string> {
  const testDir = path.join(projectPath, 'temp-demo');
  const filePath = path.join(testDir, fileName);
  
  // Create directory if it doesn't exist
  if (!fs.existsSync(testDir)) {
    fs.mkdirSync(testDir, { recursive: true });
  }
  
  // Write the file
  fs.writeFileSync(filePath, content);
  console.log(`Created test file: ${filePath}`);
  
  return filePath;
}

/**
 * Modify the test file to trigger an incremental update
 */
async function modifyTestFile(filePath: string, newContent: string): Promise<void> {
  fs.writeFileSync(filePath, newContent);
  console.log(`Modified test file: ${filePath}`);
}

/**
 * Clean up test files after the demo
 */
async function cleanupTestFiles(projectPath: string): Promise<void> {
  const testDir = path.join(projectPath, 'temp-demo');
  if (fs.existsSync(testDir)) {
    fs.rmSync(testDir, { recursive: true, force: true });
    console.log(`Cleaned up test directory: ${testDir}`);
  }
}

/**
 * Print a summary of the understanding
 */
function printUnderstandingSummary(understanding: CodebaseUnderstanding): void {
  console.log(`Understanding ID: ${understanding.id}`);
  console.log(`Created: ${understanding.createdAt}`);
  console.log(`Updated: ${understanding.updatedAt}`);
  console.log(`Files: ${understanding.fileSystem.fileCount}`);
  console.log(`Directories: ${understanding.fileSystem.directoryCount}`);
  console.log(`Code Nodes: ${understanding.codeNodes.size}`);
  console.log(`Relationships: ${understanding.relationships.length}`);
  console.log(`Patterns: ${understanding.patterns.length}`);
  console.log(`Concepts: ${understanding.concepts.length}`);
  console.log(`Semantic Units: ${understanding.semanticUnits.length}`);
}

/**
 * Run the incremental indexing demo
 */
export async function runIncrementalDemo(projectPath: string, outputPath?: string): Promise<void> {
  try {
    printSeparator('INCREMENTAL INDEXING DEMO');
    console.log(`Target directory: ${projectPath}`);
    
    // Create file system service
    const fileSystem = new NodeFileSystemService();
    const indexingService = EmergentIndexingServiceFactory.create(fileSystem);
    
    // Set up output path
    const outputDir = outputPath || path.join(projectPath, '.guardian/emergent');
    const initialPath = path.join(outputDir, 'initial-understanding.json');
    const updatedPath = path.join(outputDir, 'updated-understanding.json');
    
    // Make sure output directory exists
    if (!fs.existsSync(outputDir)) {
      fs.mkdirSync(outputDir, { recursive: true });
    }
    
    // Step 1: Create a test file
    printSeparator('CREATING TEST FILE');
    const testFilePath = await createTestFile(
      projectPath,
      'test-file.ts',
      `
/**
 * Test file for incremental indexing demo
 */
export class TestClass {
  private value: string;
  
  constructor(initialValue: string) {
    this.value = initialValue;
  }
  
  getValue(): string {
    return this.value;
  }
}
`
    );
    
    // Step 2: Initial indexing
    printSeparator('INITIAL INDEXING');
    console.log('Building initial understanding...');
    
    const initialResult = await indexingService.analyzeCodebase(projectPath, {
      exclude: ['node_modules', '.git', 'dist', 'build', '.cache'],
      includeGitHistory: false,
      semanticAnalysis: true
    });
    
    console.log('\nInitial Understanding Summary:');
    printUnderstandingSummary(initialResult.understanding);
    
    // Step 3: Save initial understanding
    console.log(`\nSaving initial understanding to: ${initialPath}`);
    await indexingService.saveUnderstanding(initialResult.understanding, initialPath);
    
    // Step 4: Modify the test file
    printSeparator('MODIFYING TEST FILE');
    await modifyTestFile(
      testFilePath,
      `
/**
 * Test file for incremental indexing demo (modified)
 */
export class TestClass {
  private value: string;
  
  constructor(initialValue: string) {
    this.value = initialValue;
  }
  
  getValue(): string {
    return this.value;
  }
  
  // Added a new method
  setValue(newValue: string): void {
    this.value = newValue;
  }
  
  // Added a new method
  logValue(): void {
    console.log(this.value);
  }
}
`
    );
    
    // Step 5: Incremental update
    printSeparator('INCREMENTAL UPDATE');
    console.log('Loading previous understanding...');
    
    // Load the saved understanding
    const savedUnderstanding = await indexingService.loadUnderstanding(initialPath);
    console.log('Performing incremental update...');
    
    // Start the incremental update timer
    const incrementalStartTime = Date.now();
    
    // Update the understanding
    const updatedResult = await indexingService.updateUnderstanding(
      projectPath,
      savedUnderstanding, 
      {
        exclude: ['node_modules', '.git', 'dist', 'build', '.cache'],
        includeGitHistory: false,
        semanticAnalysis: true
      }
    );
    
    // Calculate time taken
    const incrementalTime = Date.now() - incrementalStartTime;
    
    console.log('\nUpdated Understanding Summary:');
    printUnderstandingSummary(updatedResult.understanding);
    
    // Save updated understanding
    console.log(`\nSaving updated understanding to: ${updatedPath}`);
    await indexingService.saveUnderstanding(updatedResult.understanding, updatedPath);
    
    // Step 6: Compare initial and updated understanding
    printSeparator('COMPARING RESULTS');
    
    // Collect stats from both runs for comparison
    const stats = {
      initial: {
        timeTaken: initialResult.stats.timeTakenMs,
        filesIndexed: initialResult.stats.filesIndexed,
        nodesExtracted: initialResult.stats.nodesExtracted,
        patternsDiscovered: initialResult.stats.patternsDiscovered,
        relationshipsIdentified: initialResult.stats.relationshipsIdentified,
        concepts: initialResult.understanding.concepts.length,
        memoryUsage: initialResult.stats.memoryUsageBytes
      },
      incremental: {
        timeTaken: incrementalTime,
        filesIndexed: updatedResult.stats.filesIndexed,
        nodesExtracted: updatedResult.stats.nodesExtracted,
        patternsDiscovered: updatedResult.stats.patternsDiscovered,
        relationshipsIdentified: updatedResult.stats.relationshipsIdentified,
        concepts: updatedResult.understanding.concepts.length,
        memoryUsage: updatedResult.stats.memoryUsageBytes
      }
    };
    
    // Print comparison
    console.log('Comparison between initial and incremental indexing:');
    console.log('┌───────────────────────┬─────────────┬─────────────┬───────────────┐');
    console.log('│ Metric                │ Initial     │ Incremental │ Improvement   │');
    console.log('├───────────────────────┼─────────────┼─────────────┼───────────────┤');
    
    // Time taken
    const timeImprovement = ((stats.initial.timeTaken - stats.incremental.timeTaken) / stats.initial.timeTaken * 100).toFixed(1);
    console.log(`│ Time (ms)             │ ${stats.initial.timeTaken.toString().padStart(11)} │ ${stats.incremental.timeTaken.toString().padStart(11)} │ ${timeImprovement.padStart(11)}% │`);
    
    // Nodes extracted
    console.log(`│ Nodes extracted       │ ${stats.initial.nodesExtracted.toString().padStart(11)} │ ${stats.incremental.nodesExtracted.toString().padStart(11)} │ ${(stats.incremental.nodesExtracted - stats.initial.nodesExtracted).toString().padStart(11)}  │`);
    
    // Relationships
    console.log(`│ Relationships         │ ${stats.initial.relationshipsIdentified.toString().padStart(11)} │ ${stats.incremental.relationshipsIdentified.toString().padStart(11)} │ ${(stats.incremental.relationshipsIdentified - stats.initial.relationshipsIdentified).toString().padStart(11)}  │`);
    
    // Memory usage
    const memoryImprovement = ((stats.initial.memoryUsage - stats.incremental.memoryUsage) / stats.initial.memoryUsage * 100).toFixed(1);
    console.log(`│ Memory (MB)           │ ${(stats.initial.memoryUsage / (1024 * 1024)).toFixed(1).padStart(11)} │ ${(stats.incremental.memoryUsage / (1024 * 1024)).toFixed(1).padStart(11)} │ ${memoryImprovement.padStart(11)}% │`);
    
    console.log('└───────────────────────┴─────────────┴─────────────┴───────────────┘');
    
    // Step 7: Clean up
    printSeparator('CLEAN UP');
    await cleanupTestFiles(projectPath);
    
    printSeparator('DEMO COMPLETE');
    console.log('Incremental indexing has been successfully demonstrated.');
    console.log(`Full results saved to: ${initialPath} and ${updatedPath}`);
    
  } catch (error) {
    console.error('Error running incremental demo:', error);
  }
}

// Run the demo when this script is executed directly
if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const projectPath = process.argv[2] || process.cwd();
  const outputPath = process.argv[3];
  
  runIncrementalDemo(projectPath, outputPath)
    .then(() => process.exit(0))
    .catch(err => {
      console.error('Failed to run incremental demo:', err);
      process.exit(1);
    });
}

// Export is handled by the function declaration