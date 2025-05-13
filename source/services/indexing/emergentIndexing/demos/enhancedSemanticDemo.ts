/**
 * Enhanced Semantic Analyzer Demo
 * 
 * This script demonstrates the enhanced semantic analyzer which provides deeper,
 * more nuanced understanding of code through multi-dimensional concept extraction.
 */

import path from 'path';
import { fileURLToPath } from 'url';
import { EmergentIndexingServiceFactory } from '../emergentIndexingServiceFactory.js';
import { FileSystemService } from '../../../fileSystem/types.js';
import { NodeFileSystemService } from '../../../fileSystem/fileSystemService.js';
import { 
  printSeparator, 
  printSection, 
  printConcept, 
  printSemanticUnit, 
  printKeyValue,
  printSuccess, 
  printInfo
} from '../utils/cliColors.js';

// Get the current directory
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Configuration
const targetDir = process.argv[2] || path.join(__dirname, '../../');
const maxDepth = parseInt(process.argv[3] || '4', 10);

/**
 * Run the enhanced semantic analyzer demo
 */
async function runDemo() {
  printSeparator('ENHANCED SEMANTIC ANALYZER DEMO');
  
  printKeyValue('Target Directory', targetDir);
  printKeyValue('Max Directory Depth', maxDepth);
  
  // Create file system service
  const fileSystem: FileSystemService = new NodeFileSystemService();
  
  // Create the emergent indexing service with enhanced semantic analyzer
  printSection('Creating Indexing Service');
  const indexingService = EmergentIndexingServiceFactory.create(fileSystem, {
    semanticAnalysis: true,
    semanticAnalyzerType: 'enhanced', // Use the enhanced semantic analyzer
    maxDepth,
    exclude: ['node_modules', '.git', 'dist', 'build', '.cache'],
  });
  
  printInfo('Indexing service created with enhanced semantic analyzer');
  
  // Run the emergent indexing
  printSection('Running Codebase Analysis');
  console.log('Analyzing the codebase using emergent indexing with enhanced semantic analysis...');
  
  const startTime = Date.now();
  const result = await indexingService.analyzeCodebase(targetDir);
  const timeTaken = Date.now() - startTime;
  
  printSuccess(`Analysis completed in ${timeTaken}ms`);
  
  // Access the understanding
  const understanding = result.understanding;
  
  // Print concepts
  printSection('Extracted Concepts');
  printKeyValue('Total Concepts', understanding.concepts.length);
  
  if (understanding.concepts.length > 0) {
    // Sort concepts by confidence
    const sortedConcepts = [...understanding.concepts].sort((a, b) => b.confidence - a.confidence);
    
    // Get the top 10 concepts
    const topConcepts = sortedConcepts.slice(0, 10);
    
    printInfo(`Top ${topConcepts.length} concepts by confidence:`);
    
    topConcepts.forEach((concept, index) => {
      printConcept(concept, index + 1, understanding);
    });
    
    // Count concepts by confidence ranges
    const confidenceRanges = {
      high: sortedConcepts.filter(c => c.confidence >= 0.7).length,
      medium: sortedConcepts.filter(c => c.confidence >= 0.4 && c.confidence < 0.7).length,
      low: sortedConcepts.filter(c => c.confidence < 0.4).length
    };
    
    printKeyValue('High Confidence Concepts (≥70%)', confidenceRanges.high);
    printKeyValue('Medium Confidence Concepts (40-69%)', confidenceRanges.medium);
    printKeyValue('Low Confidence Concepts (<40%)', confidenceRanges.low);
  } else {
    console.log('No concepts were extracted from the codebase.');
  }
  
  // Print concept relationship stats
  printSection('Concept Relationships');
  
  if (understanding.concepts.length > 0) {
    // Calculate relationship statistics
    const relationshipCounts = understanding.concepts.map(c => c.relatedConcepts.length);
    const totalRelationships = relationshipCounts.reduce((sum, count) => sum + count, 0) / 2; // Divide by 2 since relationships are bidirectional
    const avgRelationships = totalRelationships / understanding.concepts.length;
    const maxRelationships = Math.max(...relationshipCounts);
    
    printKeyValue('Total Relationships', totalRelationships);
    printKeyValue('Average Relationships Per Concept', avgRelationships.toFixed(2));
    printKeyValue('Max Relationships For A Concept', maxRelationships);
    
    // Show concepts with the most relationships
    const topRelatedConcepts = [...understanding.concepts]
      .sort((a, b) => b.relatedConcepts.length - a.relatedConcepts.length)
      .slice(0, 5);
    
    if (topRelatedConcepts.length > 0) {
      printInfo('Concepts with most relationships:');
      
      topRelatedConcepts.forEach((concept, index) => {
        console.log(`${index + 1}. ${concept.name}: ${concept.relatedConcepts.length} relationships`);
      });
    }
  } else {
    console.log('No concept relationships found.');
  }
  
  // Print semantic units
  printSection('Semantic Units');
  printKeyValue('Total Semantic Units', understanding.semanticUnits.length);
  
  if (understanding.semanticUnits.length > 0) {
    // Sort units by confidence
    const sortedUnits = [...understanding.semanticUnits].sort((a, b) => b.confidence - a.confidence);
    
    // Get the top units
    const topUnits = sortedUnits.slice(0, 7);
    
    printInfo(`Top ${topUnits.length} semantic units by confidence:`);
    
    topUnits.forEach((unit, index) => {
      printSemanticUnit(unit, index + 1, understanding);
    });
    
    // Count by type
    const unitTypes = new Map<string, number>();
    understanding.semanticUnits.forEach(unit => {
      unitTypes.set(unit.type, (unitTypes.get(unit.type) || 0) + 1);
    });
    
    printInfo('Semantic units by type:');
    for (const [type, count] of unitTypes.entries()) {
      printKeyValue(type, count);
    }
  } else {
    console.log('No semantic units were created.');
  }
  
  // Print overall statistics
  printSection('Analysis Statistics');
  printKeyValue('Files Indexed', result.stats.filesIndexed);
  printKeyValue('Code Nodes Extracted', result.stats.nodesExtracted);
  printKeyValue('Patterns Discovered', result.stats.patternsDiscovered);
  printKeyValue('Relationships Identified', result.stats.relationshipsIdentified);
  printKeyValue('Concepts Extracted', result.stats.conceptsExtracted);
  printKeyValue('Data Flows Discovered', result.stats.dataFlowsDiscovered);
  printKeyValue('Memory Used', `${Math.round(result.stats.memoryUsageBytes / (1024 * 1024))} MB`);
  printKeyValue('Total Time', `${result.stats.timeTakenMs}ms`);
}

// Run the demo
runDemo().catch(error => {
  console.error('Error running enhanced semantic analyzer demo:', error);
});