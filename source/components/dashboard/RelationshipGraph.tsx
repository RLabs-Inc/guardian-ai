// source/components/dashboard/RelationshipGraph.tsx
import React from 'react';
import {Box} from 'ink';
import {Text as ThemedText} from '../common/Text.js';
import {useTheme} from '../../themes/context.js';

interface RelationshipNode {
  id: string;
  label: string;
  size?: number; // 1-5, influences visual representation
  type?: 'file' | 'class' | 'function' | 'variable' | 'other';
}

interface RelationshipEdge {
  source: string; // Node ID
  target: string; // Node ID
  type?: 'imports' | 'extends' | 'calls' | 'uses' | 'other';
  strength?: number; // 1-3, influences visual representation
}

interface RelationshipGraphProps {
  title?: string;
  nodes: RelationshipNode[];
  edges: RelationshipEdge[];
  width?: number;
  height?: number;
  focusNode?: string; // ID of the node to focus on
}

export const RelationshipGraph: React.FC<RelationshipGraphProps> = ({
  title = 'Relationship Graph',
  nodes,
  edges,
  width = 40,
  height = 15,
  focusNode,
}) => {
  const {currentTheme} = useTheme();
  
  // This is a very simplified ASCII representation of a graph
  // In a real implementation, we'd use a proper graph layout algorithm
  
  // Find focus node and its directly connected nodes
  const focusedNode = focusNode ? nodes.find(n => n.id === focusNode) : null;
  const connectedEdges = focusNode 
    ? edges.filter(e => e.source === focusNode || e.target === focusNode)
    : [];
  const connectedNodeIds = new Set<string>();
  connectedEdges.forEach(e => {
    connectedNodeIds.add(e.source);
    connectedNodeIds.add(e.target);
  });
  const connectedNodes = nodes.filter(n => connectedNodeIds.has(n.id));
  
  // Get color for node type
  const getNodeColor = (type?: string) => {
    switch (type) {
      case 'file':
        return currentTheme.colors.info;
      case 'class':
        return currentTheme.colors.success;
      case 'function':
        return currentTheme.colors.warning;
      case 'variable':
        return currentTheme.colors.error;
      default:
        return currentTheme.colors.text;
    }
  };
  
  // Create a simplified visual representation
  const renderSimpleGraph = () => {
    if (nodes.length === 0) {
      return <ThemedText>No nodes to display</ThemedText>;
    }
    
    if (focusedNode) {
      // Render focus node and its connections
      return (
        <Box flexDirection="column">
          <Box justifyContent="center">
            <ThemedText
              color={getNodeColor(focusedNode.type)}
              bold
            >
              {`[${focusedNode.label}]`}
            </ThemedText>
          </Box>
          
          {connectedNodes.length > 0 && (
            <Box flexDirection="column" marginTop={1}>
              {connectedEdges.map((edge, idx) => {
                const otherNodeId = edge.source === focusNode ? edge.target : edge.source;
                const otherNode = nodes.find(n => n.id === otherNodeId);
                if (!otherNode) return null;
                
                const isIncoming = edge.target === focusNode;
                const symbol = isIncoming ? '↑' : '↓';
                const relationText = edge.type || 'relates to';
                
                return (
                  <Box key={idx} justifyContent="center">
                    <ThemedText color={getNodeColor(otherNode.type)}>
                      {`${isIncoming ? otherNode.label : ''} ${symbol} ${relationText} ${isIncoming ? '' : otherNode.label}`}
                    </ThemedText>
                  </Box>
                );
              })}
            </Box>
          )}
        </Box>
      );
    }
    
    // Simple representation showing all nodes
    return (
      <Box flexDirection="column">
        <ThemedText>Node types:</ThemedText>
        <Box flexWrap="wrap">
          {nodes.slice(0, Math.min(nodes.length, 10)).map((node, idx) => (
            <Box key={idx} marginRight={1} marginY={0}>
              <ThemedText color={getNodeColor(node.type)}>
                {node.label}
              </ThemedText>
            </Box>
          ))}
          {nodes.length > 10 && <ThemedText>... and {nodes.length - 10} more</ThemedText>}
        </Box>
        
        <Box marginTop={1}>
          <ThemedText>Relationships: {edges.length}</ThemedText>
        </Box>
      </Box>
    );
  };
  
  return (
    <Box 
      flexDirection="column" 
      borderStyle="single" 
      borderColor={currentTheme.colors.dimText}
      width={width}
      height={height}
      padding={0}
    >
      {/* Header */}
      <Box 
        paddingX={1}
        paddingY={0}
        borderStyle="single"
        borderColor={currentTheme.colors.primary}
      >
        <ThemedText variant="highlight">{title}</ThemedText>
        <Box flexGrow={1} />
        <ThemedText variant="dim">{`[${nodes.length} nodes, ${edges.length} edges]`}</ThemedText>
      </Box>
      
      {/* Graph content area */}
      <Box flexDirection="column" padding={1} flexGrow={1} justifyContent="center" alignItems="center">
        {renderSimpleGraph()}
      </Box>
    </Box>
  );
};

export default RelationshipGraph;