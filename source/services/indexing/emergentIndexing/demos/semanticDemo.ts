/**
 * Semantic Analysis Demo
 * 
 * Demonstrates the semantic understanding capabilities of the emergent indexing system,
 * showing how it extracts concepts, identifies semantic units, and builds a conceptual 
 * understanding of the codebase.
 */

import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import { NodeFileSystemService } from '../../../fileSystem/fileSystemService.js';
import { EmergentIndexingServiceFactory } from '../emergentIndexingServiceFactory.js';
import { Concept, SemanticUnit } from '../types.js';

import * as colors from '../utils/cliColors.js';

// Use the themed output helper for consistent styling

/**
 * Print detailed information about a concept
 */
function printConcept(concept: Concept, index: number): void {
  console.log(`\n${colors.boldColorize(`Concept #${index + 1}: ${concept.name}`, 'secondary')}`);
  colors.printKeyValue('Description', concept.description);
  colors.printKeyValue('Elements', concept.codeElements.length);
  colors.printKeyValue('Importance', `${Math.round(concept.importance * 100)}%`);
  colors.printKeyValue('Confidence', `${Math.round(concept.confidence * 100)}%`);

  if (concept.relatedConcepts.length > 0) {
    colors.printKeyValue('Related concepts', concept.relatedConcepts.join(', '));
  }
}

/**
 * Print detailed information about a semantic unit
 */
function printSemanticUnit(unit: SemanticUnit, index: number): void {
  console.log(`\n${colors.boldColorize(`Semantic Unit #${index + 1}: ${unit.name}`, 'secondary')}`);
  colors.printKeyValue('Type', unit.type);
  colors.printKeyValue('Description', unit.description);
  colors.printKeyValue('Components', `${unit.codeNodeIds.length} code elements`);
  colors.printKeyValue('Confidence', `${Math.round(unit.confidence * 100)}%`);

  if (unit.concepts.length > 0) {
    colors.printKeyValue('Associated concepts', unit.concepts.join(', '));
  }

  if (Object.keys(unit.semanticProperties).length > 0) {
    console.log(colors.colorize('Properties:', 'dimText'));
    for (const [key, value] of Object.entries(unit.semanticProperties)) {
      colors.printListItem(`${colors.colorize(key, 'secondary')}: ${JSON.stringify(value)}`, 1);
    }
  }
}

/**
 * Run the semantic analysis demo
 */
export async function runSemanticDemo(projectPath: string, outputPath?: string): Promise<void> {
  try {
    colors.printSeparator('SEMANTIC ANALYSIS DEMO', 'primary');
    colors.printKeyValue('Target directory', projectPath);
    
    // Create file system service and indexing service
    const fileSystem = new NodeFileSystemService();
    const indexingService = EmergentIndexingServiceFactory.create(fileSystem);
    
    // Set output path
    const outputDir = outputPath || path.join(projectPath, '.guardian/emergent');
    const conceptsOutputPath = path.join(outputDir, 'concepts.json');
    
    // Make sure output directory exists
    if (!fs.existsSync(outputDir)) {
      fs.mkdirSync(outputDir, { recursive: true });
    }
    
    // Step 1: Analyze the codebase with semantic analysis enabled
    colors.printSection('CODEBASE ANALYSIS');
    colors.printInfo('Analyzing codebase with semantic analysis...');
    
    const result = await indexingService.analyzeCodebase(projectPath, {
      exclude: ['node_modules', '.git', 'dist', 'build', '.cache'],
      includeGitHistory: false,
      semanticAnalysis: true  // Ensure semantic analysis is enabled
    });
    
    const understanding = result.understanding;
    
    // Step 2: Print concept information
    colors.printSection('CONCEPTS DISCOVERED');

    if (understanding.concepts.length === 0) {
      colors.printWarning('No concepts were discovered in this codebase.');
    } else {
      colors.printSuccess(`Discovered ${understanding.concepts.length} concepts in the codebase:`);
      
      // Sort concepts by importance
      const sortedConcepts = [...understanding.concepts]
        .sort((a, b) => b.importance - a.importance);
      
      // Print the top concepts in detail
      const topConcepts = sortedConcepts.slice(0, Math.min(5, sortedConcepts.length));
      topConcepts.forEach((concept, index) => {
        printConcept(concept, index);
      });
      
      // Print a summary of remaining concepts if there are more
      if (sortedConcepts.length > 5) {
        console.log(colors.colorize('\nOther concepts:', 'dimText'));
        for (let i = 5; i < sortedConcepts.length; i++) {
          const concept = sortedConcepts[i];
          if (concept) {
            colors.printListItem(`${concept.name} (${Math.round(concept.importance * 100)}% importance)`);
          }
        }
      }
    }
    
    // Step 3: Print semantic unit information
    colors.printSection('SEMANTIC UNITS DISCOVERED');

    if (understanding.semanticUnits.length === 0) {
      colors.printWarning('No semantic units were discovered in this codebase.');
    } else {
      colors.printSuccess(`Discovered ${understanding.semanticUnits.length} semantic units in the codebase:`);
      
      // Sort semantic units by confidence
      const sortedUnits = [...understanding.semanticUnits]
        .sort((a, b) => b.confidence - a.confidence);
      
      // Print the top semantic units in detail
      const topUnits = sortedUnits.slice(0, Math.min(5, sortedUnits.length));
      topUnits.forEach((unit, index) => {
        printSemanticUnit(unit, index);
      });
      
      // Print a summary of remaining units if there are more
      if (sortedUnits.length > 5) {
        console.log(colors.colorize('\nOther semantic units:', 'dimText'));
        for (let i = 5; i < sortedUnits.length; i++) {
          const unit = sortedUnits[i];
          if (unit) {
            colors.printListItem(`${unit.name} (${unit.type})`);
          }
        }
      }
    }
    
    // Step 4: Print concept relationships
    colors.printSection('CONCEPT RELATIONSHIPS');

    if (understanding.concepts.length <= 1) {
      colors.printWarning('Not enough concepts to form relationships.');
    } else {
      colors.printInfo('Concept relationship network:');

      // Find concepts with related concepts
      const conceptsWithRelations = understanding.concepts
        .filter(c => c.relatedConcepts.length > 0);

      if (conceptsWithRelations.length === 0) {
        colors.printWarning('No relationships between concepts were discovered.');
      } else {
        for (const concept of conceptsWithRelations) {
          console.log(`\n${colors.boldColorize(concept.name, 'secondary')} is related to:`);

          // For each related concept, find its importance and confidence
          concept.relatedConcepts.forEach(relatedId => {
            const related = understanding.concepts.find(c => c.id === relatedId);
            if (related) {
              colors.printListItem(`${related.name} (${Math.round(related.importance * 100)}% importance)`);
            }
          });
        }
      }
    }
    
    // Step 5: Save the concepts and semantic units to a file
    colors.printSection('SAVING SEMANTIC INFORMATION');

    const semanticData = {
      concepts: understanding.concepts,
      semanticUnits: understanding.semanticUnits,
      metadata: {
        codebase: projectPath,
        timestamp: new Date().toISOString(),
        totalCodeNodes: understanding.codeNodes.size
      }
    };

    fs.writeFileSync(conceptsOutputPath, JSON.stringify(semanticData, null, 2));
    colors.printSuccess(`Semantic information saved to: ${conceptsOutputPath}`);

    colors.printSeparator('DEMO COMPLETE', 'success');
    colors.printSuccess('Semantic analysis has been successfully demonstrated.');
    colors.printInfo(`Results saved to: ${conceptsOutputPath}`);
    
  } catch (error) {
    colors.printError(`Error running semantic demo: ${error instanceof Error ? error.message : String(error)}`);
  }
}

// Run the demo when this script is executed directly
if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const projectPath = process.argv[2] || process.cwd();
  const outputPath = process.argv[3];
  
  runSemanticDemo(projectPath, outputPath)
    .then(() => process.exit(0))
    .catch(err => {
      console.error('Failed to run semantic demo:', err);
      process.exit(1);
    });
}

// Export is handled by the function declaration