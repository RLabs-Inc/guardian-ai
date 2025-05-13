// source/commands/analyze.tsx
import React, {useState} from 'react';
import {Box} from 'ink';
import Spinner from 'ink-spinner';
import {Text as ThemedText} from '../components/common/Text.js';
import {NodeFileSystemService} from '../services/fileSystem/fileSystemService.js';
import {EmergentIndexingServiceFactory} from '../services/indexing/emergentIndexing/emergentIndexingServiceFactory.js';
import DirectorySelector from '../components/common/DirectorySelector.js';
import * as path from 'path';
import * as fs from 'fs-extra';

interface AnalyzeCommandProps {
  options: {
    verbose: boolean;
    incremental?: boolean;
    maxDepth?: number;
    projectPath?: string;
    onComplete?: (results: any) => void;
    [key: string]: any;
  };
}

const AnalyzeCommand: React.FC<AnalyzeCommandProps> = ({options}) => {
  const [status, setStatus] = useState<'selecting' | 'analyzing' | 'clustering' | 'data-flow' | 'success' | 'error'>(
    options.projectPath ? 'analyzing' : 'selecting'
  );
  const [message, setMessage] = useState<string>('');
  const [analyzeProgress, setAnalyzeProgress] = useState<string>('Initializing...');
  const [dataFlowProgress, setDataFlowProgress] = useState<string>('');
  const [clusteringProgress, setClusteringProgress] = useState<string>('');
  const [indexResults, setIndexResults] = useState<any | null>(null);
  const [projectRoot, setProjectRoot] = useState<string>(options.projectPath || '');

  // Handle directory selection
  const handleDirectorySelected = async (selectedPath: string) => {
    setProjectRoot(selectedPath);
    setStatus('analyzing');
    await analyzeCodebase(selectedPath);
  };

  // Handle cancellation of directory selection
  const handleDirectorySelectCancel = () => {
    process.exit(0);
  };
  
  // Start analysis if project path is provided via command line
  React.useEffect(() => {
    if (options.projectPath && status === 'analyzing') {
      analyzeCodebase(options.projectPath);
    }
  }, []);

  // Execute codebase analysis
  const analyzeCodebase = async (selectedPath: string) => {
    try {
      setAnalyzeProgress(`Analyzing project at ${selectedPath}...`);
      
      // Create services
      const fileSystem = new NodeFileSystemService();
      
      // Configure indexing options
      const indexingOptions = {
        exclude: ['node_modules', '.git', 'dist', 'build', '.cache', '.guardian-ai'],
        maxDepth: options.maxDepth || 5,
        semanticAnalysis: true,
        semanticAnalyzerType: 'enhanced' as const, // Always use enhanced semantic analyzer
        includeGitHistory: false,
        includeTests: true,
        includeAsyncFlows: true,
        includeConditionalFlows: true
      };
      
      // Create indexing service
      const indexingService = EmergentIndexingServiceFactory.create(fileSystem, indexingOptions);

      // Ensure target directories exist
      const guardianDir = path.join(selectedPath, '.guardian-ai');
      const indexDir = path.join(guardianDir, 'index');
      await fs.ensureDir(indexDir);
      
      // Check if there's an existing index to determine if we should do incremental update
      const existingIndexPath = path.join(indexDir, 'understanding.json');
      const existingIndex = await fs.pathExists(existingIndexPath);
      
      // Determine if we should do incremental update
      // If user explicitly specified incremental flag, use that, otherwise auto-detect
      const shouldDoIncremental = options.incremental !== undefined 
        ? options.incremental 
        : existingIndex;
      
      let result;
      let understanding;
      
      if (shouldDoIncremental && existingIndex) {
        setAnalyzeProgress('Found existing index. Performing incremental update...');
        try {
          // Load existing understanding
          const existingUnderstanding = await indexingService.loadUnderstanding(existingIndexPath);
          
          // Perform incremental update
          result = await indexingService.updateUnderstanding(selectedPath, existingUnderstanding, indexingOptions);
          understanding = result.understanding;
        } catch (error) {
          console.error('Error during incremental update:', error);
          setAnalyzeProgress('Error loading existing understanding. Performing full analysis...');
          
          // Fallback to full analysis
          result = await indexingService.analyzeCodebase(selectedPath, indexingOptions);
          understanding = result.understanding;
        }
      } else {
        setAnalyzeProgress('Performing full semantic analysis of codebase...');
        result = await indexingService.analyzeCodebase(selectedPath, indexingOptions);
        understanding = result.understanding;
      }

      // Perform data flow analysis
      setStatus('data-flow');
      setDataFlowProgress('Analyzing data flows...');
      try {
        const dataFlows = await indexingService.analyzeDataFlows(understanding);
        setDataFlowProgress(`Discovered ${dataFlows.flows.length} data flows and ${dataFlows.paths.length} paths`);
      } catch (error) {
        console.error('Error in data flow analysis:', error);
        setDataFlowProgress('Data flow analysis failed. Continuing with other analyses...');
      }

      // Perform clustering
      setStatus('clustering');
      setClusteringProgress('Discovering natural code clusters...');
      try {
        const clusters = await indexingService.clusterCodeElements(understanding);
        setClusteringProgress(`Discovered ${clusters.length} natural code clusters`);
      } catch (error) {
        console.error('Error in clustering:', error);
        setClusteringProgress('Clustering failed. Continuing...');
      }

      // Save the complete understanding
      await indexingService.saveUnderstanding(understanding, existingIndexPath);
      
      // Prepare results for display
      const stats = result.stats;
      const indexSummary = {
        files: understanding.fileSystem.fileCount,
        codeNodes: understanding.codeNodes.size,
        patterns: understanding.patterns.length,
        relationships: understanding.relationships.length,
        concepts: understanding.concepts.length,
        semanticUnits: understanding.semanticUnits.length,
        dataFlows: understanding.dataFlow.flows.length,
        clusters: understanding.clusters?.length || 0,
        memory: Math.round(stats.memoryUsageBytes / (1024 * 1024)),
        time: stats.timeTakenMs
      };
      
      setIndexResults(indexSummary);
      
      // Update status
      setStatus('success');
      setMessage(
        `Analysis complete! Indexed ${indexSummary.files} files with ${indexSummary.codeNodes} code nodes. ` +
        `Discovered ${indexSummary.patterns} patterns, ${indexSummary.relationships} relationships, ` +
        `${indexSummary.concepts} concepts, and ${indexSummary.clusters} natural clusters.`
      );
      
      // Notify that indexing is complete
      if (options.onComplete) {
        options.onComplete(indexSummary);
      }
    } catch (error) {
      setStatus('error');
      setMessage(`Analysis failed: ${error instanceof Error ? error.message : String(error)}`);
    }
  };

  // If in selecting mode, show directory selector
  if (status === 'selecting') {
    return (
      <DirectorySelector
        initialPath={process.cwd()}
        onSelect={handleDirectorySelected}
        onCancel={handleDirectorySelectCancel}
      />
    );
  }

  // Otherwise show analysis UI
  return (
    <Box flexDirection="column">
      {status === 'analyzing' && (
        <Box flexDirection="column">
          <Box>
            <Spinner />
            <ThemedText> Analyzing codebase structure...</ThemedText>
          </Box>
          <ThemedText variant="dim">{analyzeProgress}</ThemedText>
        </Box>
      )}

      {status === 'data-flow' && (
        <Box flexDirection="column">
          <Box>
            <Spinner />
            <ThemedText> Analyzing data flows...</ThemedText>
          </Box>
          <ThemedText variant="dim">{dataFlowProgress}</ThemedText>
        </Box>
      )}

      {status === 'clustering' && (
        <Box flexDirection="column">
          <Box>
            <Spinner />
            <ThemedText> Discovering code clusters...</ThemedText>
          </Box>
          <ThemedText variant="dim">{clusteringProgress}</ThemedText>
        </Box>
      )}

      {status === 'success' && (
        <Box flexDirection="column">
          <ThemedText variant="success">{message}</ThemedText>
          
          {indexResults && (
            <Box flexDirection="column" marginTop={1}>
              <ThemedText variant="highlight">Semantic Index Statistics:</ThemedText>
              <ThemedText>- Files analyzed: {indexResults.files}</ThemedText>
              <ThemedText>- Code nodes extracted: {indexResults.codeNodes}</ThemedText>
              <ThemedText>- Patterns discovered: {indexResults.patterns}</ThemedText>
              <ThemedText>- Relationships identified: {indexResults.relationships}</ThemedText>
              <ThemedText>- Concepts extracted: {indexResults.concepts}</ThemedText>
              <ThemedText>- Semantic units created: {indexResults.semanticUnits}</ThemedText>
              <ThemedText>- Data flows discovered: {indexResults.dataFlows}</ThemedText>
              <ThemedText>- Natural clusters found: {indexResults.clusters}</ThemedText>
              <ThemedText>- Memory used: {indexResults.memory} MB</ThemedText>
              <ThemedText>- Time taken: {indexResults.time}ms</ThemedText>
              
              {options.verbose && (
                <Box flexDirection="column" marginTop={1}>
                  <ThemedText variant="highlight">Detailed Insights:</ThemedText>
                  <ThemedText>- Project path: {projectRoot}</ThemedText>
                  <ThemedText>- Analysis depth: {options.maxDepth || 5} levels</ThemedText>
                  <ThemedText>- Analysis mode: {options.incremental ? 'incremental' : 'full'}</ThemedText>
                </Box>
              )}
            </Box>
          )}
        </Box>
      )}

      {status === 'error' && <ThemedText variant="error">{message}</ThemedText>}
    </Box>
  );
};

export default AnalyzeCommand;