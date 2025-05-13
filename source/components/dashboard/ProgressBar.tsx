// source/components/dashboard/ProgressBar.tsx
import React from 'react';
import {Box} from 'ink';
import {Text as ThemedText} from '../common/Text.js';
import {useTheme} from '../../themes/context.js';

interface ProgressBarProps {
  value: number; // 0-100
  width?: number;
  showLabel?: boolean;
  label?: string;
  type?: 'default' | 'success' | 'warning' | 'error';
}

export const ProgressBar: React.FC<ProgressBarProps> = ({
  value,
  width = 30,
  showLabel = true,
  label,
  type = 'default',
}) => {
  const {currentTheme} = useTheme();
  
  // Ensure value is between 0 and 100
  const normalizedValue = Math.max(0, Math.min(100, value));
  
  // Calculate number of filled and empty segments
  const filledSegments = Math.round((normalizedValue / 100) * (width - 2));
  const emptySegments = width - 2 - filledSegments;
  
  // Get color based on type
  let color;
  switch (type) {
    case 'success':
      color = currentTheme.colors.success;
      break;
    case 'warning':
      color = currentTheme.colors.warning;
      break;
    case 'error':
      color = currentTheme.colors.error;
      break;
    default:
      color = currentTheme.colors.info;
  }
  
  return (
    <Box flexDirection="column">
      {label && <ThemedText>{label}</ThemedText>}
      <Box>
        <ThemedText color={color}>{'['}</ThemedText>
        <ThemedText color={color}>
          {filledSegments > 0 ? '█'.repeat(filledSegments) : ''}
        </ThemedText>
        <ThemedText color={currentTheme.colors.dimText}>
          {emptySegments > 0 ? ' '.repeat(emptySegments) : ''}
        </ThemedText>
        <ThemedText color={color}>{']'}</ThemedText>
        {showLabel && (
          <Box marginLeft={1}>
            <ThemedText>{`${normalizedValue.toFixed(0)}%`}</ThemedText>
          </Box>
        )}
      </Box>
    </Box>
  );
};

export default ProgressBar;