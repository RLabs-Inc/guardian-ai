// source/components/dashboard/IndexingDashboard.tsx
import React from 'react';
import {Box} from 'ink';
import Spinner from 'ink-spinner';
import {Text as ThemedText} from '../common/Text.js';
import {useTheme} from '../../themes/context.js';
import LogsViewer from './LogsViewer.js';
import StatsPanel from './StatsPanel.js';
import ProgressBar from './ProgressBar.js';
import RelationshipGraph from './RelationshipGraph.js';

interface LogEntry {
  message: string;
  type: 'info' | 'success' | 'warning' | 'error' | 'system';
  timestamp: Date;
}

interface IndexStats {
  files: number;
  totalSize: number;
  codeNodes: number;
  patterns: number;
  relationships: number;
  concepts: number;
  semanticUnits: number;
  dataFlows: number;
  clusters: number;
  memory: number;
  time: number;
}

interface GraphData {
  nodes: Array<{
    id: string;
    label: string;
    type?: 'file' | 'class' | 'function' | 'variable' | 'other';
  }>;
  edges: Array<{
    source: string;
    target: string;
    type?: 'imports' | 'extends' | 'calls' | 'uses' | 'other';
  }>;
}

interface IndexingDashboardProps {
  projectPath: string;
  indexingStatus: 'initializing' | 'analyzing' | 'data-flow' | 'clustering' | 'success' | 'error';
  progress?: number; // 0-100
  logs: LogEntry[];
  stats?: Partial<IndexStats>;
  graphData?: GraphData;
  message?: string;
  error?: string;
  onComplete?: () => void;
}

export const IndexingDashboard: React.FC<IndexingDashboardProps> = ({
  projectPath,
  indexingStatus,
  progress = 0,
  logs,
  stats = {},
  graphData = {nodes: [], edges: []},
  message,
  error,
}) => {
  // NOTE: We're not calling onComplete here anymore.
  // Instead, the component using IndexingDashboard should call
  // onComplete when it sets the indexingStatus to 'success'
  const {currentTheme} = useTheme();
  
  // Derive status text directly from props
  const getStatusText = () => {
    switch (indexingStatus) {
      case 'initializing':
        return 'Initializing indexing engine...';
      case 'analyzing':
        return 'Analyzing codebase structure...';
      case 'data-flow':
        return 'Analyzing data flows...';
      case 'clustering':
        return 'Discovering code clusters...';
      case 'success':
        return 'Analysis complete!';
      case 'error':
        return `Analysis failed: ${error}`;
      default:
        return 'Initializing...';
    }
  };
  
  // Derive progress type directly from props
  const getProgressType = (): 'default' | 'success' | 'warning' | 'error' => {
    if (indexingStatus === 'success') return 'success';
    if (indexingStatus === 'error') return 'error';
    return 'default';
  };
  
  // Generate stats items
  const generateStatsItems = () => {
    return [
      { label: 'Files Analyzed', value: stats.files || 0 },
      { label: 'Code Nodes', value: stats.codeNodes || 0 },
      { label: 'Patterns Discovered', value: stats.patterns || 0, type: 'highlight' },
      { label: 'Relationships', value: stats.relationships || 0, type: 'highlight' },
      { label: 'Semantic Concepts', value: stats.concepts || 0, type: 'success' },
      { label: 'Semantic Units', value: stats.semanticUnits || 0 },
      { label: 'Data Flows', value: stats.dataFlows || 0, type: 'highlight' },
      { label: 'Natural Clusters', value: stats.clusters || 0, type: 'highlight' },
    ];
  };
  
  // Generate performance stats
  const generatePerformanceStats = () => {
    return [
      { label: 'Memory Used', value: stats.memory || 0, unit: 'MB' },
      { label: 'Processing Time', value: Math.round((stats.time || 0) / 1000), unit: 's' },
      { label: 'Nodes per Second', value: Math.round((stats.codeNodes || 0) / ((stats.time || 1) / 1000)) },
    ];
  };
  
  return (
    <Box flexDirection="column">
      {/* Header with project info and status */}
      <Box 
        borderStyle="single" 
        borderColor={currentTheme.colors.primary}
        paddingX={1}
        paddingY={0}
        marginBottom={1}
      >
        <ThemedText variant="highlight">GuardianAI Semantic Analysis</ThemedText>
        <Box flexGrow={1} />
        <ThemedText>Project: </ThemedText>
        <ThemedText color={currentTheme.colors.secondary}>{projectPath}</ThemedText>
      </Box>
      
      {/* Status bar */}
      <Box marginBottom={1}>
        {indexingStatus !== 'success' && indexingStatus !== 'error' && (
          <Box marginRight={1}>
            <ThemedText color={currentTheme.colors.info}>
              <Spinner />
            </ThemedText>
          </Box>
        )}
        <ThemedText 
          color={
            indexingStatus === 'success' 
              ? currentTheme.colors.success 
              : indexingStatus === 'error'
                ? currentTheme.colors.error
                : currentTheme.colors.text
          }
          bold={indexingStatus === 'success' || indexingStatus === 'error'}
        >
          {getStatusText()}
        </ThemedText>
      </Box>
      
      {/* Progress bar */}
      <Box marginBottom={1}>
        <ProgressBar 
          value={indexingStatus === 'success' ? 100 : progress} 
          width={80} 
          type={getProgressType()}
          label="Overall Progress"
        />
      </Box>
      
      {/* Main dashboard area */}
      <Box>
        {/* Left column - logs */}
        <Box flexDirection="column" width={50}>
          <LogsViewer logs={logs} title="Indexing Process Logs" height={20} />
        </Box>
        
        {/* Right column - stats and visualizations */}
        <Box flexDirection="column" marginLeft={2}>
          <StatsPanel 
            title="Index Statistics" 
            stats={generateStatsItems()} 
            width={40}
          />
          
          <Box marginTop={1}>
            <StatsPanel 
              title="Performance Metrics" 
              stats={generatePerformanceStats()} 
              width={40}
            />
          </Box>
          
          <Box marginTop={1}>
            <RelationshipGraph 
              title="Codebase Relationships" 
              nodes={graphData.nodes} 
              edges={graphData.edges} 
              width={40}
              height={12}
            />
          </Box>
        </Box>
      </Box>
      
      {/* Message or error display */}
      {(message || error) && (
        <Box 
          borderStyle="single" 
          borderColor={error ? currentTheme.colors.error : currentTheme.colors.success}
          paddingX={1}
          marginTop={1}
        >
          <ThemedText 
            variant={error ? 'error' : 'success'}
          >
            {error || message}
          </ThemedText>
        </Box>
      )}
    </Box>
  );
};

export default IndexingDashboard;