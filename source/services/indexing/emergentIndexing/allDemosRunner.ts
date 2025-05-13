/**
 * All Demos Runner
 * 
 * Unified controller for running all emergent indexing demos in sequence
 * with proper configuration and comprehensive reporting.
 */

import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
// No need to import unused services
import { runEmergentIndexingDemo } from './demo.js';
import { runDataFlowDemo } from './demos/dataFlowDemo.js';
import { runClusteringDemo } from './demos/clusteringDemo.js';
import { runSemanticDemo } from './demos/semanticDemo.js';
import { runIncrementalDemo } from './demos/incrementalDemo.js';
import { EmergentIndexingOptions } from './types.js';

/**
 * Configuration for the demos runner
 */
interface DemosConfiguration {
  targetDir: string;
  outputDir: string;
  demos: {
    basicIndexing: boolean;
    dataFlowAnalysis: boolean;
    codeClustering: boolean;
    semanticAnalysis: boolean;
    incrementalIndexing: boolean;
  };
  options: EmergentIndexingOptions;
}

/**
 * Results from running all demos
 */
interface DemosResults {
  success: boolean;
  timeTakenMs: number;
  results: {
    basicIndexing?: any;
    dataFlowAnalysis?: any;
    codeClustering?: any;
    semanticAnalysis?: any;
    incrementalIndexing?: any;
  };
  errors: string[];
}

/**
 * Run all selected demos with the given configuration
 */
export async function runAllDemos(config: DemosConfiguration): Promise<DemosResults> {
  const startTime = Date.now();
  const results: DemosResults = {
    success: true,
    timeTakenMs: 0,
    results: {},
    errors: []
  };
  
  console.log('======================================================================');
  console.log('                 EMERGENT INDEXING SYSTEM - ALL DEMOS                 ');
  console.log('======================================================================');
  console.log(`Target Directory: ${config.targetDir}`);
  console.log(`Output Directory: ${config.outputDir}`);
  console.log('======================================================================');
  
  try {
    // Create output directory if it doesn't exist
    if (!fs.existsSync(config.outputDir)) {
      fs.mkdirSync(config.outputDir, { recursive: true });
    }
    
    // Each demo will create its own file system service
    
    // Run basic indexing demo if selected
    if (config.demos.basicIndexing) {
      console.log('\n======================================================================');
      console.log('                       BASIC INDEXING DEMO                          ');
      console.log('======================================================================\n');
      
      try {
        await runEmergentIndexingDemo(config.targetDir);
        results.results.basicIndexing = { success: true };
      } catch (error: any) {
        console.error('Error in basic indexing demo:', error.message);
        results.errors.push(`Basic Indexing: ${error.message}`);
        results.results.basicIndexing = { success: false, error: error.message };
        results.success = false;
      }
    }
    
    // Run data flow analysis demo if selected
    if (config.demos.dataFlowAnalysis) {
      console.log('\n======================================================================');
      console.log('                     DATA FLOW ANALYSIS DEMO                        ');
      console.log('======================================================================\n');
      
      try {
        const dataFlowOutputPath = path.join(config.outputDir, 'data-flow-results.json');
        await runDataFlowDemo(config.targetDir, dataFlowOutputPath);
        results.results.dataFlowAnalysis = { 
          success: true,
          outputPath: dataFlowOutputPath 
        };
      } catch (error: any) {
        console.error('Error in data flow analysis demo:', error.message);
        results.errors.push(`Data Flow Analysis: ${error.message}`);
        results.results.dataFlowAnalysis = { success: false, error: error.message };
        results.success = false;
      }
    }
    
    // Run code clustering demo if selected
    if (config.demos.codeClustering) {
      console.log('\n======================================================================');
      console.log('                       CODE CLUSTERING DEMO                         ');
      console.log('======================================================================\n');

      try {
        await runClusteringDemo(config.targetDir);
        results.results.codeClustering = { success: true };
      } catch (error: any) {
        console.error('Error in code clustering demo:', error.message);
        results.errors.push(`Code Clustering: ${error.message}`);
        results.results.codeClustering = { success: false, error: error.message };
        results.success = false;
      }
    }

    // Run semantic analysis demo if selected
    if (config.demos.semanticAnalysis) {
      console.log('\n======================================================================');
      console.log('                      SEMANTIC ANALYSIS DEMO                        ');
      console.log('======================================================================\n');

      try {
        const semanticOutputPath = path.join(config.outputDir, 'semantic-results.json');
        await runSemanticDemo(config.targetDir, config.outputDir);
        results.results.semanticAnalysis = {
          success: true,
          outputPath: semanticOutputPath
        };
      } catch (error: any) {
        console.error('Error in semantic analysis demo:', error.message);
        results.errors.push(`Semantic Analysis: ${error.message}`);
        results.results.semanticAnalysis = { success: false, error: error.message };
        results.success = false;
      }
    }

    // Run incremental indexing demo if selected
    if (config.demos.incrementalIndexing) {
      console.log('\n======================================================================');
      console.log('                     INCREMENTAL INDEXING DEMO                      ');
      console.log('======================================================================\n');

      try {
        await runIncrementalDemo(config.targetDir, config.outputDir);
        results.results.incrementalIndexing = {
          success: true,
          outputDir: config.outputDir
        };
      } catch (error: any) {
        console.error('Error in incremental indexing demo:', error.message);
        results.errors.push(`Incremental Indexing: ${error.message}`);
        results.results.incrementalIndexing = { success: false, error: error.message };
        results.success = false;
      }
    }

    // Calculate total time taken
    results.timeTakenMs = Date.now() - startTime;
    
    // Print summary
    console.log('\n======================================================================');
    console.log('                              SUMMARY                               ');
    console.log('======================================================================');
    console.log(`Total time: ${results.timeTakenMs}ms (${(results.timeTakenMs / 1000).toFixed(2)}s)`);
    
    console.log('\nResults:');
    if (config.demos.basicIndexing) {
      console.log(`  - Basic Indexing: ${results.results.basicIndexing?.success ? '✅ Success' : '❌ Failed'}`);
    }
    if (config.demos.dataFlowAnalysis) {
      console.log(`  - Data Flow Analysis: ${results.results.dataFlowAnalysis?.success ? '✅ Success' : '❌ Failed'}`);
    }
    if (config.demos.codeClustering) {
      console.log(`  - Code Clustering: ${results.results.codeClustering?.success ? '✅ Success' : '❌ Failed'}`);
    }
    if (config.demos.semanticAnalysis) {
      console.log(`  - Semantic Analysis: ${results.results.semanticAnalysis?.success ? '✅ Success' : '❌ Failed'}`);
    }
    if (config.demos.incrementalIndexing) {
      console.log(`  - Incremental Indexing: ${results.results.incrementalIndexing?.success ? '✅ Success' : '❌ Failed'}`);
    }
    
    if (results.errors.length > 0) {
      console.log('\nErrors:');
      results.errors.forEach(error => console.log(`  - ${error}`));
    }
    
    console.log('\nOutput files:');
    const files = fs.readdirSync(config.outputDir);
    files.forEach(file => {
      const filePath = path.join(config.outputDir, file);
      const stats = fs.statSync(filePath);
      console.log(`  - ${file} (${(stats.size / 1024).toFixed(2)} KB)`);
    });
    
    return results;
    
  } catch (error: any) {
    console.error('Unhandled error in demos runner:', error.message);
    results.success = false;
    results.errors.push(`Unhandled: ${error.message}`);
    results.timeTakenMs = Date.now() - startTime;
    return results;
  }
}

/**
 * Run when executed directly from the command line
 */
if (process.argv[1] === fileURLToPath(import.meta.url)) {
  // Parse command line arguments
  const targetDir = process.argv[2] || process.cwd();
  const outputDir = path.join(targetDir, '.guardian/emergent');
  
  // Create default configuration with all demos enabled
  const config: DemosConfiguration = {
    targetDir,
    outputDir,
    demos: {
      basicIndexing: true,
      dataFlowAnalysis: true,
      codeClustering: true,
      semanticAnalysis: true,
      incrementalIndexing: true
    },
    options: {
      exclude: ['node_modules', '.git', 'dist', 'build', '.cache'],
      includeGitHistory: false,
      semanticAnalysis: true,
      includeAsyncFlows: true,
      includeConditionalFlows: true,
      dataFlowMinConfidence: 0.6
    }
  };
  
  // Run all demos
  runAllDemos(config)
    .then(results => {
      process.exit(results.success ? 0 : 1);
    })
    .catch(error => {
      console.error('Fatal error:', error);
      process.exit(1);
    });
}