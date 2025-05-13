/**
 * Data Flow Analysis Demo
 * 
 * This demo demonstrates the organic discovery of data flows in a codebase
 * using the assumption-free emergent indexing approach.
 */

import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';

import { EmergentIndexingServiceFactory } from '../emergentIndexingServiceFactory.js';
import { CodebaseUnderstanding, DataFlow, DataFlowPath, DataNodeRole } from '../types.js';

// Helper function for demo output
function printSeparator(title: string): void {
  console.log('\n' + '='.repeat(80));
  console.log(`${title}`);
  console.log('='.repeat(80) + '\n');
}

// Helper function to print data flow information
function printDataFlow(flow: DataFlow, understanding: CodebaseUnderstanding): void {
  const sourceNode = understanding.dataFlow.nodes.get(flow.sourceId);
  const targetNode = understanding.dataFlow.nodes.get(flow.targetId);
  
  console.log(`Data Flow: ${sourceNode?.name || 'Unknown'} -> ${targetNode?.name || 'Unknown'}`);
  console.log(`  Type: ${flow.type}`);
  console.log(`  Source Role: ${sourceNode?.role}`);
  console.log(`  Target Role: ${targetNode?.role}`);
  console.log(`  Async: ${flow.async ? 'Yes' : 'No'}`);
  console.log(`  Conditional: ${flow.conditional ? 'Yes' : 'No'}`);
  console.log(`  Confidence: ${Math.round(flow.confidence * 100)}%`);
  
  if (flow.transformations.length > 0) {
    console.log(`  Transformations: ${flow.transformations.join(', ')}`);
  }
  
  console.log();
}

// Helper function to print data flow path information
function printDataFlowPath(path: DataFlowPath, understanding: CodebaseUnderstanding): void {
  console.log(`Path: ${path.name}`);
  console.log(`  Description: ${path.description}`);
  console.log(`  Confidence: ${Math.round(path.confidence * 100)}%`);
  console.log(`  Nodes: ${path.nodes.length}`);
  
  console.log('  Flow:');
  let pathStr = '  ';
  
  for (const nodeId of path.nodes) {
    const node = understanding.dataFlow.nodes.get(nodeId);
    if (node) {
      pathStr += node.name;
      if (nodeId !== path.nodes[path.nodes.length - 1]) {
        pathStr += ' -> ';
      }
    }
  }
  
  console.log(pathStr);
  console.log();
}

// Helper function to save the results to a file
function saveResults(understanding: CodebaseUnderstanding, outputPath: string): void {
  // Convert Map to object for serialization
  const dataFlowForStorage = {
    ...understanding.dataFlow,
    nodes: Object.fromEntries(understanding.dataFlow.nodes.entries())
  };

  // Save data flow analysis results
  const outputData = {
    dataFlow: dataFlowForStorage,
    stats: {
      nodes: understanding.dataFlow.nodes.size,
      flows: understanding.dataFlow.flows.length,
      paths: understanding.dataFlow.paths.length,
      sources: Array.from(understanding.dataFlow.nodes.values()).filter(n => n.role === DataNodeRole.SOURCE).length,
      sinks: Array.from(understanding.dataFlow.nodes.values()).filter(n => n.role === DataNodeRole.SINK).length,
      transformers: Array.from(understanding.dataFlow.nodes.values()).filter(n => n.role === DataNodeRole.TRANSFORMER).length,
      stores: Array.from(understanding.dataFlow.nodes.values()).filter(n => n.role === DataNodeRole.STORE).length,
    }
  };

  // Create directory if it doesn't exist
  const outputDir = path.dirname(outputPath);
  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
  }

  // Save the results
  fs.writeFileSync(outputPath, JSON.stringify(outputData, null, 2));
  console.log(`Results saved to ${outputPath}`);
}

/**
 * Run the data flow analysis demo on a target codebase
 */
async function runDataFlowDemo(targetDir: string, outputPath?: string): Promise<void> {
  try {
    printSeparator('DATA FLOW ANALYSIS DEMO');
    console.log(`Target directory: ${targetDir}`);
    
    // Step 1: Initialize services
    console.log('\nInitializing services...');
    const fsService = await import('../../../fileSystem/fileSystemService.js').then(module => {
      return new module.NodeFileSystemService(); 
    });
    const indexingService = EmergentIndexingServiceFactory.create(fsService);
    
    // Step 2: Analyze the codebase
    printSeparator('ANALYZING CODEBASE');
    console.log('Building emergent understanding of the codebase...');
    
    const result = await indexingService.analyzeCodebase(targetDir, {
      semanticAnalysis: true,
      includeAsyncFlows: true,
      includeConditionalFlows: true
    });
    
    const understanding = result.understanding;
    
    // Step 3: Display statistics
    printSeparator('ANALYSIS RESULTS');
    console.log(`Files analyzed: ${result.stats.filesIndexed}`);
    console.log(`Code nodes extracted: ${result.stats.nodesExtracted}`);
    console.log(`Patterns discovered: ${result.stats.patternsDiscovered}`);
    console.log(`Relationships identified: ${result.stats.relationshipsIdentified}`);
    console.log(`Data flows discovered: ${result.stats.dataFlowsDiscovered}`);
    console.log(`Data flow paths identified: ${result.stats.dataFlowPathsIdentified}`);
    console.log(`Time taken: ${result.stats.timeTakenMs}ms`);
    
    // Step 4: Display data node summary
    printSeparator('DATA NODE SUMMARY');
    const nodes = Array.from(understanding.dataFlow.nodes.values());
    const sources = nodes.filter(n => n.role === DataNodeRole.SOURCE);
    const sinks = nodes.filter(n => n.role === DataNodeRole.SINK);
    const transformers = nodes.filter(n => n.role === DataNodeRole.TRANSFORMER);
    const stores = nodes.filter(n => n.role === DataNodeRole.STORE);
    
    console.log(`Total data nodes: ${nodes.length}`);
    console.log(`Sources: ${sources.length}`);
    console.log(`Sinks: ${sinks.length}`);
    console.log(`Transformers: ${transformers.length}`);
    console.log(`Stores: ${stores.length}`);
    
    // Print top sources
    if (sources.length > 0) {
      console.log('\nTop data sources:');
      sources
        .sort((a, b) => b.confidence - a.confidence)
        .slice(0, 5)
        .forEach(source => {
          console.log(`  - ${source.name} (${Math.round(source.confidence * 100)}% confidence)`);
        });
    }
    
    // Print top sinks
    if (sinks.length > 0) {
      console.log('\nTop data sinks:');
      sinks
        .sort((a, b) => b.confidence - a.confidence)
        .slice(0, 5)
        .forEach(sink => {
          console.log(`  - ${sink.name} (${Math.round(sink.confidence * 100)}% confidence)`);
        });
    }
    
    // Step 5: Display data flow summary
    printSeparator('DATA FLOW SUMMARY');
    const flows = understanding.dataFlow.flows;
    console.log(`Total data flows: ${flows.length}`);
    
    // Count flow types
    const flowTypes = flows.reduce((acc, flow) => {
      acc[flow.type] = (acc[flow.type] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);
    
    console.log('\nFlow types:');
    Object.entries(flowTypes)
      .sort((a, b) => b[1] - a[1])
      .forEach(([type, count]) => {
        console.log(`  - ${type}: ${count}`);
      });
    
    // Count async/conditional flows
    const asyncFlows = flows.filter(flow => flow.async);
    const conditionalFlows = flows.filter(flow => flow.conditional);
    
    if (flows.length > 0) {
      console.log(`\nAsync flows: ${asyncFlows.length} (${Math.round((asyncFlows.length / flows.length) * 100)}%)`);
      console.log(`Conditional flows: ${conditionalFlows.length} (${Math.round((conditionalFlows.length / flows.length) * 100)}%)`);
    } else {
      console.log("\nNo flows discovered.");
    }
    
    // Step 6: Display data flow paths
    printSeparator('DATA FLOW PATHS');
    const paths = understanding.dataFlow.paths;
    console.log(`Total data flow paths: ${paths.length}`);
    
    // Show top paths by confidence
    if (paths.length > 0) {
      console.log('\nTop data flow paths:');
      paths
        .sort((a, b) => b.confidence - a.confidence)
        .slice(0, 5)
        .forEach(path => {
          printDataFlowPath(path, understanding);
        });
    }
    
    // Step 7: Display noteworthy data flows
    printSeparator('NOTEWORTHY DATA FLOWS');
    
    // Show high-confidence flows
    const highConfidenceFlows = flows
      .filter(flow => flow.confidence > 0.8)
      .sort((a, b) => b.confidence - a.confidence)
      .slice(0, 5);
    
    if (highConfidenceFlows.length > 0) {
      console.log('High-confidence flows:');
      highConfidenceFlows.forEach(flow => {
        printDataFlow(flow, understanding);
      });
    }
    
    // Show async flows
    const topAsyncFlows = asyncFlows
      .sort((a, b) => b.confidence - a.confidence)
      .slice(0, 3);
    
    if (topAsyncFlows.length > 0) {
      console.log('Top asynchronous flows:');
      topAsyncFlows.forEach(flow => {
        printDataFlow(flow, understanding);
      });
    }
    
    // Step 8: Save results if outputPath is provided
    if (outputPath) {
      printSeparator('SAVING RESULTS');
      saveResults(understanding, outputPath);
    }
    
    printSeparator('DEMO COMPLETE');
    console.log('Data flow analysis has been successfully demonstrated using a zero-assumptions approach.');
    console.log('The analysis discovered natural data flows in the codebase without predefined patterns.');
    
  } catch (error) {
    console.error('Error running data flow demo:', error);
  }
}

// Run the demo when this script is executed directly
if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const targetDir = process.argv[2] || process.cwd();
  const outputPath = process.argv[3] || path.join(process.cwd(), '.guardian', 'data-flow-results.json');
  
  runDataFlowDemo(targetDir, outputPath)
    .then(() => process.exit(0))
    .catch(err => {
      console.error('Failed to run data flow demo:', err);
      process.exit(1);
    });
}

export { runDataFlowDemo };