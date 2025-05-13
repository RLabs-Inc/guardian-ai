/**
 * Clustering Demo
 * 
 * Demonstrates the code element clustering capabilities on a codebase.
 */

import path from 'path';
import { NodeFileSystemService } from '../../../fileSystem/fileSystemService.js';
import { EmergentIndexingServiceFactory } from '../emergentIndexingServiceFactory.js';
import { ClusteringAlgorithm, ClusteringMetric } from '../types.js';

/**
 * Run the clustering demo on a specified project
 */
export async function runClusteringDemo(projectPath: string): Promise<void> {
  console.log('='.repeat(50));
  console.log('Emergent Code Clustering Demo');
  console.log('='.repeat(50));
  console.log(`Target codebase: ${projectPath}`);
  console.log('Starting demo...');
  console.log('-'.repeat(50));
  
  // Create the file system service
  const fileSystem = new NodeFileSystemService();
  
  // Create the emergent indexing service
  const indexingService = EmergentIndexingServiceFactory.create(fileSystem);
  
  try {
    // First, analyze the codebase
    console.log('Analyzing codebase...');
    const result = await indexingService.analyzeCodebase(projectPath, {
      exclude: ['node_modules', '.git', 'dist', 'build', '.cache'],
      includeGitHistory: false,
      semanticAnalysis: true
    });
    
    console.log(`Analysis complete! Found ${result.understanding.codeNodes.size} code nodes.`);
    
    // Now, cluster the code elements
    console.log('\nDiscovering natural code clusters...');
    const clusters = await indexingService.clusterCodeElements(
      result.understanding,
      {
        algorithm: ClusteringAlgorithm.HIERARCHICAL,
        metrics: [
          ClusteringMetric.NAMING_PATTERN,
          ClusteringMetric.STRUCTURAL_SIMILARITY,
          ClusteringMetric.RELATIONSHIP_GRAPH
        ],
        minSimilarity: 0.6,
        maxClusters: 20
      }
    );
    
    // Print cluster information
    console.log(`\nDiscovered ${clusters.length} natural code clusters:`);
    
    clusters.forEach((cluster, index) => {
      console.log(`\nCluster #${index + 1}: ${cluster.name}`);
      console.log(`Description: ${cluster.description}`);
      console.log(`Members: ${cluster.nodeIds.length} nodes`);
      console.log(`Dominant type: ${cluster.dominantType}`);
      
      if (cluster.namingPatterns.length > 0) {
        console.log(`Naming patterns: ${cluster.namingPatterns.join(', ')}`);
      }
      
      console.log(`Confidence: ${Math.round(cluster.confidence * 100)}%`);
      
      // Print a few example members
      const sampleSize = Math.min(3, cluster.nodeIds.length);
      if (sampleSize > 0) {
        console.log('\nSample members:');
        
        for (let i = 0; i < sampleSize; i++) {
          const nodeId = cluster.nodeIds[i];
          // Use optional chaining and null check to safely access node
          const node = nodeId ? result.understanding.codeNodes.get(nodeId) : undefined;
          
          if (node) {
            console.log(`- ${node.name} (${node.type}) at ${node.path}`);
          }
        }
      }
    });
    
    // Save the understanding with clusters
    const outputDir = path.join(projectPath, '.guardian/emergent');
    const outputPath = path.join(outputDir, 'understanding_with_clusters.json');
    
    console.log(`\nSaving understanding with clusters to ${outputPath}...`);
    await indexingService.saveUnderstanding(result.understanding, outputPath);
    
    console.log('-'.repeat(50));
    console.log('Demo completed successfully!');
    console.log(`Understanding with clusters is saved in ${outputPath}`);
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
  
  runClusteringDemo(absolutePath).catch(error => {
    console.error('Unhandled error:', error);
    process.exit(1);
  });
}