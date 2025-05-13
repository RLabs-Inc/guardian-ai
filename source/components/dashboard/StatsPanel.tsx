// source/components/dashboard/StatsPanel.tsx
import React from 'react';
import {Box} from 'ink';
import {Text as ThemedText} from '../common/Text.js';
import {useTheme} from '../../themes/context.js';

interface StatItem {
  label: string;
  value: string | number;
  unit?: string;
  type?: string;
}

interface StatsPanelProps {
  title: string;
  stats: StatItem[];
  width?: number;
}

export const StatsPanel: React.FC<StatsPanelProps> = ({
  title,
  stats,
  width = 30,
}) => {
  const {currentTheme} = useTheme();
  
  // Transform any stat type to a valid type for ThemedText
  const transformType = (type: string): 'default' | 'dim' | 'highlight' | 'error' | 'success' => {
    switch (type) {
      case 'warning':
        return 'highlight';
      case 'error':
        return 'error';
      case 'success':
        return 'success';
      case 'highlight':
        return 'highlight';
      case 'dim':
        return 'dim';
      default:
        return 'default';
    }
  };
  
  return (
    <Box 
      flexDirection="column" 
      borderStyle="single" 
      borderColor={currentTheme.colors.dimText}
      width={width}
      padding={0}
      minHeight={6}
    >
      {/* Header */}
      <Box 
        paddingX={1}
        paddingY={0}
        borderStyle="single"
        borderColor={currentTheme.colors.primary}
      >
        <ThemedText variant="highlight">{title}</ThemedText>
      </Box>
      
      {/* Stats content area */}
      <Box flexDirection="column" paddingX={1} flexGrow={1}>
        {stats.length === 0 ? (
          <ThemedText>No statistics available</ThemedText>
        ) : (
          stats.map((stat, index) => (
            <Box key={index} justifyContent="space-between" marginY={0}>
              <ThemedText>{stat.label}</ThemedText>
              <ThemedText
                variant={transformType(stat.type || 'default')}
                bold={stat.type === 'highlight' || stat.type === 'success'}
              >
                {stat.value}{stat.unit ? ` ${stat.unit}` : ''}
              </ThemedText>
            </Box>
          ))
        )}
      </Box>
    </Box>
  );
};

export default StatsPanel;