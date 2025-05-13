// source/components/dashboard/LogsViewer.tsx
import React, {useState, useEffect} from 'react';
import {Box, useInput} from 'ink';
import {Text as ThemedText} from '../common/Text.js';
import {useTheme} from '../../themes/context.js';

interface LogEntry {
  message: string;
  type: 'info' | 'success' | 'warning' | 'error' | 'system';
  timestamp: Date;
}

interface LogsViewerProps {
  logs: LogEntry[];
  title?: string;
  height?: number;
  autoscroll?: boolean;
}

export const LogsViewer: React.FC<LogsViewerProps> = ({
  logs,
  title = 'Process Logs',
  height = 15,
  autoscroll = true,
}) => {
  const {currentTheme} = useTheme();
  const [scrollPosition, setScrollPosition] = useState(0);
  const [autoScrollEnabled, setAutoScrollEnabled] = useState(autoscroll);
  
  // Auto-scroll to bottom when new logs are added
  useEffect(() => {
    if (autoScrollEnabled && logs.length > 0) {
      setScrollPosition(Math.max(0, logs.length - height));
    }
  }, [logs.length, height, autoScrollEnabled]);
  
  // Handle keyboard input for scrolling
  useInput((input, key) => {
    // Arrow up/down for scrolling
    if (key.upArrow) {
      setAutoScrollEnabled(false);
      setScrollPosition(Math.max(0, scrollPosition - 1));
    } else if (key.downArrow) {
      setScrollPosition(Math.min(logs.length - height, scrollPosition + 1));
      // Re-enable auto-scroll if we reach the bottom
      if (scrollPosition >= logs.length - height - 1) {
        setAutoScrollEnabled(true);
      }
    } else if (input === 'a') {
      // Toggle auto-scroll with 'a' key
      setAutoScrollEnabled(!autoScrollEnabled);
    }
  });
  
  // Calculate visible logs based on scroll position
  const visibleLogs = logs.slice(scrollPosition, scrollPosition + height);
  
  // Map log type to color
  const getLogColor = (type: LogEntry['type']) => {
    switch (type) {
      case 'info':
        return currentTheme.colors.info;
      case 'success':
        return currentTheme.colors.success;
      case 'warning':
        return currentTheme.colors.warning;
      case 'error':
        return currentTheme.colors.error;
      case 'system':
        return currentTheme.colors.highlightText;
      default:
        return currentTheme.colors.text;
    }
  };
  
  // Format timestamp
  const formatTime = (date: Date) => {
    return date.toLocaleTimeString([], {hour: '2-digit', minute: '2-digit', second: '2-digit'});
  };
  
  return (
    <Box 
      flexDirection="column" 
      borderStyle="single" 
      borderColor={currentTheme.colors.dimText}
      width={50}
      height={height + 2} // Add space for header and footer
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
        <ThemedText variant="dim">{`[${logs.length} entries]`}</ThemedText>
      </Box>
      
      {/* Logs content area */}
      <Box flexDirection="column" paddingX={1} flexGrow={1}>
        {visibleLogs.length === 0 ? (
          <ThemedText>No logs to display</ThemedText>
        ) : (
          visibleLogs.map((log, index) => (
            <Box key={index}>
              <ThemedText color={currentTheme.colors.dimText} bold>
                {formatTime(log.timestamp)}
              </ThemedText>
              <Box marginLeft={1} flexGrow={1}>
                <ThemedText color={getLogColor(log.type)}>
                  {log.message}
                </ThemedText>
              </Box>
            </Box>
          ))
        )}
      </Box>
      
      {/* Footer with scroll indicator */}
      <Box 
        paddingX={1}
        borderStyle="single"
        borderColor={currentTheme.colors.dimText}
      >
        <ThemedText variant="dim">
          {autoScrollEnabled ? 'Auto-scroll ON' : 'Auto-scroll OFF'}
        </ThemedText>
        <Box flexGrow={1} />
        <ThemedText variant="dim">
          {`${scrollPosition + 1}-${Math.min(logs.length, scrollPosition + height)}/${logs.length}`}
        </ThemedText>
      </Box>
    </Box>
  );
};

export default LogsViewer;