/**
 * Example usage of the Hierarchical Indexing Service
 * 
 * This file demonstrates how to use the hierarchical indexing service
 * to index a project and perform queries.
 */

import { FileSystemService } from '../../fileSystem/types.js';
import { HierarchicalIndexingServiceFactory } from './hierarchicalIndexingServiceFactory.js';
import { IndexNodeType, IndexQuery } from './types.js';

/**
 * Example function to index a project and perform some sample queries
 */
export async function indexProjectExample(
  fileSystem: FileSystemService,
  projectPath: string
): Promise<void> {
  console.log(`Starting indexing of project: ${projectPath}`);
  
  // Create the indexing service
  const indexingService = HierarchicalIndexingServiceFactory.createService(fileSystem);
  
  // Index the project
  console.log('Indexing project...');
  const indexingResult = await indexingService.indexProject(projectPath, {
    incremental: true,
    exclude: ['node_modules', '.git', 'dist', 'build'],
    includeAst: true,
    extractRelationships: true
  });
  
  // Print statistics
  console.log('Indexing complete!');
  console.log('Statistics:');
  console.log(`- Files indexed: ${indexingResult.stats.filesIndexed}`);
  console.log(`- Directories indexed: ${indexingResult.stats.directoriesIndexed}`);
  console.log(`- Symbols extracted: ${indexingResult.stats.symbolsExtracted}`);
  console.log(`- Relationships extracted: ${indexingResult.stats.relationshipsExtracted}`);
  console.log(`- Time taken: ${indexingResult.stats.timeTakenMs}ms`);
  console.log(`- Memory usage: ${Math.round(indexingResult.stats.memoryUsageBytes / 1024 / 1024)}MB`);
  
  // Save the index
  const indexPath = `${projectPath}/.guardian/index.json`;
  console.log(`Saving index to ${indexPath}...`);
  await indexingService.saveIndex(indexingResult.root, indexPath);
  
  // Example queries
  console.log('\nPerforming sample queries:');
  
  // Find all TypeScript files
  const tsFilesQuery: IndexQuery = {
    nodeType: IndexNodeType.FILE,
    pathPattern: /\.tsx?$/
  };
  
  const tsFiles = await indexingService.queryIndex(indexingResult.root, tsFilesQuery);
  console.log(`\nFound ${tsFiles.length} TypeScript files:`);
  tsFiles.slice(0, 5).forEach(file => {
    console.log(`- ${file.path}`);
  });
  
  // Find all React components
  const reactComponentsQuery: IndexQuery = {
    nodeType: IndexNodeType.FUNCTION,
    filter: node => {
      if (typeof node.content !== 'string') return false;
      // Look for JSX in the function body and Component name pattern
      const hasJsx = node.content.includes('return (') && node.content.includes('</');
      const hasComponentName = /[A-Z][a-zA-Z]*(?:Component)?$/.test(node.name);
      return hasJsx || hasComponentName;
    }
  };
  
  const reactComponents = await indexingService.queryIndex(indexingResult.root, reactComponentsQuery);
  console.log(`\nFound ${reactComponents.length} potential React components:`);
  reactComponents.slice(0, 5).forEach(component => {
    console.log(`- ${component.name} (${component.path})`);
  });
  
  // Find all API endpoints
  const apiEndpointsQuery: IndexQuery = {
    nodeType: [IndexNodeType.FUNCTION, IndexNodeType.METHOD],
    filter: node => {
      if (typeof node.content !== 'string') return false;
      // Look for common API patterns
      return (
        (node.path.includes('/api/') || node.path.includes('/routes/')) &&
        (node.content.includes('request') && node.content.includes('response'))
      );
    }
  };
  
  const apiEndpoints = await indexingService.queryIndex(indexingResult.root, apiEndpointsQuery);
  console.log(`\nFound ${apiEndpoints.length} potential API endpoints:`);
  apiEndpoints.slice(0, 5).forEach(endpoint => {
    console.log(`- ${endpoint.name} (${endpoint.path})`);
  });
  
  console.log('\nExample complete!');
}

/**
 * Example function to demonstrate incremental indexing
 */
export async function incrementalIndexingExample(
  fileSystem: FileSystemService,
  projectPath: string
): Promise<void> {
  console.log(`Starting incremental indexing of project: ${projectPath}`);
  
  // Create the indexing service
  const indexingService = HierarchicalIndexingServiceFactory.createService(fileSystem);
  
  // Load the existing index
  const indexPath = `${projectPath}/.guardian/index.json`;
  console.log(`Loading existing index from ${indexPath}...`);
  const existingIndex = await indexingService.loadIndex(indexPath);
  
  // Update the index
  console.log('Updating index...');
  const indexingResult = await indexingService.updateIndex(projectPath, existingIndex, {
    incremental: true,
    exclude: ['node_modules', '.git', 'dist', 'build'],
    includeAst: true,
    extractRelationships: true
  });
  
  // Print statistics
  console.log('Incremental indexing complete!');
  console.log('Statistics:');
  console.log(`- Files added: ${indexingResult.stats.filesAdded || 0}`);
  console.log(`- Files modified: ${indexingResult.stats.filesModified || 0}`);
  console.log(`- Files deleted: ${indexingResult.stats.filesDeleted || 0}`);
  console.log(`- Total files: ${indexingResult.stats.filesIndexed}`);
  console.log(`- Total symbols: ${indexingResult.stats.symbolsExtracted}`);
  console.log(`- Time taken: ${indexingResult.stats.timeTakenMs}ms`);
  
  // Save the updated index
  console.log(`Saving updated index to ${indexPath}...`);
  await indexingService.saveIndex(indexingResult.root, indexPath);
  
  console.log('\nIncremental indexing example complete!');
}