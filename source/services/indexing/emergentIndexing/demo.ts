/**
 * Emergent Indexing Demo
 * 
 * Demonstrates the emergent indexing system on a codebase.
 */

import path from 'path';
import { NodeFileSystemService } from '../../fileSystem/fileSystemService.js';
import { EmergentIndexingServiceFactory } from './emergentIndexingServiceFactory.js';

/**
 * Run the demo on a specified project
 */
export async function runEmergentIndexingDemo(projectPath: string): Promise<void> {
  console.log('='.repeat(50));
  console.log('Emergent Codebase Understanding Demo');
  console.log('='.repeat(50));
  console.log(`Target codebase: ${projectPath}`);
  console.log('Starting demo...');
  console.log('-'.repeat(50));
  
  // Create the file system service
  const fileSystem = new NodeFileSystemService();
  
  // Create the emergent indexing service
  const indexingService = EmergentIndexingServiceFactory.create(fileSystem);
  
  // Create output directory
  const outputDir = path.join(projectPath, '.guardian/emergent');
  const outputPath = path.join(outputDir, 'understanding.json');
  
  try {
    // Analyze the codebase
    console.log('Analyzing codebase...');
    const result = await indexingService.analyzeCodebase(projectPath, {
      exclude: ['node_modules', '.git', 'dist', 'build', '.cache'],
      includeGitHistory: false,
      semanticAnalysis: true
    });
    
    // Print statistics
    console.log('Analysis complete!');
    console.log('Statistics:');
    console.log(`- Files analyzed: ${result.stats.filesIndexed}`);
    console.log(`- Code nodes extracted: ${result.stats.nodesExtracted}`);
    console.log(`- Patterns discovered: ${result.stats.patternsDiscovered}`);
    console.log(`- Relationships identified: ${result.stats.relationshipsIdentified}`);
    console.log(`- Concepts extracted: ${result.stats.conceptsExtracted}`);
    console.log(`- Time taken: ${result.stats.timeTakenMs}ms`);
    console.log(`- Memory used: ${Math.round(result.stats.memoryUsageBytes / (1024 * 1024))}MB`);
    
    // Save the understanding
    console.log(`Saving understanding to ${outputPath}...`);
    await indexingService.saveUnderstanding(result.understanding, outputPath);
    console.log(`Understanding saved to ${outputPath}`);
    
    // Print some insights
    console.log('\nKey insights:');
    
    // Language distribution
    console.log('\nLanguage distribution:');
    for (const [lang, details] of result.understanding.languages.languages.entries()) {
      console.log(`- ${lang}: ${details.fileCount} files`);
    }
    
    // Top patterns
    console.log('\nTop patterns:');
    for (const pattern of result.understanding.patterns.slice(0, 5)) {
      console.log(`- ${pattern.name}: ${pattern.instances.length} instances (confidence: ${Math.round(pattern.confidence * 100)}%)`);
    }
    
    // Top concepts
    console.log('\nTop concepts:');
    const sortedConcepts = [...result.understanding.concepts].sort((a, b) => b.importance - a.importance);
    for (const concept of sortedConcepts.slice(0, 5)) {
      console.log(`- ${concept.name}: ${concept.codeElements.length} elements (importance: ${Math.round(concept.importance * 100)}%)`);
    }
    
    console.log('-'.repeat(50));
    console.log('Demo completed successfully!');
    console.log(`Understanding is saved in ${outputPath}`);
    console.log('='.repeat(50));
  } catch (error) {
    console.error('Error running demo:', error);
    process.exit(1);
  }
}

// If this script is run directly, execute the demo on the specified path or current directory
if (require.main === module) {
  const projectPath = process.argv[2] || process.cwd();
  const absolutePath = path.resolve(projectPath);
  
  runEmergentIndexingDemo(absolutePath).catch(error => {
    console.error('Unhandled error:', error);
    process.exit(1);
  });
}