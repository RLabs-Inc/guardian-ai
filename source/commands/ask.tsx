// source/commands/ask.tsx
import React, {useState, useEffect} from 'react';
import {Box} from 'ink';
import Spinner from 'ink-spinner';
import {Text as ThemedText} from '../components/common/Text.js';
import {AnthropicService} from '../services/llm/llmService.js';
import {OpenAIService} from '../services/llm/openAIService.js';
import {InMemoryRAGService} from '../services/rag/ragService.js';
import {NodeFileSystemService} from '../services/fileSystem/fileSystemService.js';
import {TreeSitterIndexingService} from '../services/indexing/indexingService.js';
import * as path from 'path';
import fs from 'fs-extra';
import {
  VectorizedCodebaseStewardService,
  StewardQueryType,
  StewardQueryResult
} from '../services/steward/index.js';

interface AskCommandProps {
  question: string;
  options: {
    verbose: boolean;
    type?: string;
    analysis?: boolean;
    context?: string;
    [key: string]: any;
  };
}

const AskCommand: React.FC<AskCommandProps> = ({question, options}) => {
  const [status, setStatus] = useState<'finding-project' | 'loading-index' | 'retrieving-context' | 'analyzing' | 'thinking' | 'success' | 'error'>(
    'finding-project',
  );
  const [answer, setAnswer] = useState<string>('');
  const [analysisDetails, setAnalysisDetails] = useState<string>('');
  const [statusMessage, setStatusMessage] = useState<string>('Finding project root...');

  useEffect(() => {
    if (!question) {
      setStatus('error');
      setAnswer('Please provide a question to ask about the codebase.');
      return;
    }

    const askQuestion = async () => {
      try {
        // Create file system service
        const fileSystem = new NodeFileSystemService();
        
        // Find project root
        setStatus('finding-project');
        setStatusMessage('Finding project root...');
        
        // Find the nearest .guardian-ai.json file to determine project root
        let currentDir = process.cwd();
        let projectRoot = '';
        let configFound = false;

        // Try to find config file by traversing up directories
        while (currentDir !== path.parse(currentDir).root && !configFound) {
          const configPath = path.join(currentDir, '.guardian-ai.json');
          if (await fs.pathExists(configPath)) {
            projectRoot = currentDir;
            configFound = true;
            break;
          }
          currentDir = path.dirname(currentDir);
        }

        if (!configFound) {
          setStatus('error');
          setAnswer('No GuardianAI project found. Please run "guardian-ai init" in your project directory first.');
          return;
        }
        
        // Load index
        setStatus('loading-index');
        setStatusMessage(`Loading codebase index from ${projectRoot}...`);
        
        const indexingService = new TreeSitterIndexingService(fileSystem);
        
        try {
          await indexingService.loadIndex(projectRoot);
        } catch (error) {
          setStatus('error');
          setAnswer(`Codebase index not found. Please run "guardian-ai analyze" first.\nError: ${error instanceof Error ? error.message : String(error)}`);
          return;
        }
        
        // Create LLM services
        const llmService = new AnthropicService();
        const embeddingService = new OpenAIService();

        // Setup RAG service
        setStatus('retrieving-context');
        setStatusMessage('Retrieving relevant code context...');
        
        const ragService = new InMemoryRAGService(llmService, fileSystem, embeddingService);
        try {
          await ragService.loadVectorDB(projectRoot);
        } catch (error) {
          console.warn('Vector DB not found, continuing without context:', error);
        }

        // Determine the query type
        let queryType = determineQueryType(question, options.type);
        
        // Create and initialize the Codebase Steward
        setStatus('analyzing');
        setStatusMessage(`Analyzing codebase with Steward (query type: ${queryType})...`);
        
        const stewardService = new VectorizedCodebaseStewardService(
          llmService,
          fileSystem,
          indexingService as any, // Type conversion during refactoring
          ragService
        );
        
        await stewardService.initialize();
        
        // Process the query using the Steward
        setStatus('thinking');
        setStatusMessage(`Processing query with Codebase Steward...`);
        
        const queryResult: StewardQueryResult = await stewardService.query(
          question,
          queryType as StewardQueryType,
          {
            maxTokens: 2000,
            includeAnalysis: options.analysis || options.verbose,
            additionalContext: options['context']
          }
        );
        
        // If we have analysis details, format them
        let formattedAnalysis = '';
        if (queryResult.analysis) {
          formattedAnalysis = formatAnalysisDetails(queryResult.analysis);
        }
        
        // Update state with the response
        setStatus('success');
        setAnswer(queryResult.response);
        setAnalysisDetails(formattedAnalysis);
      } catch (error) {
        setStatus('error');
        setAnswer(`Failed to get answer: ${error instanceof Error ? error.message : String(error)}`);
      }
    };

    // Execute the async function
    askQuestion();
  }, [question, options]);

  return (
    <Box flexDirection="column">
      <Box marginBottom={1}>
        <ThemedText variant="highlight">Q: {question}</ThemedText>
      </Box>

      {(status === 'finding-project' || status === 'loading-index' || status === 'retrieving-context' || status === 'analyzing' || status === 'thinking') && (
        <Box>
          <Spinner />
          <ThemedText> {statusMessage}</ThemedText>
        </Box>
      )}

      {status === 'success' && (
        <Box flexDirection="column">
          <ThemedText variant="highlight">A:</ThemedText>
          <ThemedText>{answer}</ThemedText>
          
          {analysisDetails && (
            <Box flexDirection="column" marginTop={1}>
              <ThemedText variant="dim">Analysis Details:</ThemedText>
              <ThemedText variant="dim">{analysisDetails}</ThemedText>
            </Box>
          )}
        </Box>
      )}

      {status === 'error' && <ThemedText variant="error">{answer}</ThemedText>}
    </Box>
  );
};

/**
 * Determine the query type based on the question and options
 */
function determineQueryType(question: string, type?: string): StewardQueryType {
  // If type is provided as an option, use that
  if (type) {
    const typeUpperCase = type.toUpperCase();
    
    // Try to map to our enum
    for (const [key, value] of Object.entries(StewardQueryType)) {
      if (key === typeUpperCase) {
        return value as StewardQueryType;
      }
    }
  }
  
  // Otherwise, analyze the question to determine the type
  const lowerQuestion = question.toLowerCase();
  
  // Check for patterns in the question
  if (
    lowerQuestion.includes('pattern') || 
    lowerQuestion.includes('architecture') || 
    lowerQuestion.includes('design') || 
    lowerQuestion.includes('structure')
  ) {
    return StewardQueryType.PATTERN;
  }
  
  if (
    lowerQuestion.includes('relationship') || 
    lowerQuestion.includes('connect') || 
    lowerQuestion.includes('between') ||
    lowerQuestion.includes('interact') || 
    lowerQuestion.includes('depends')
  ) {
    return StewardQueryType.RELATIONSHIP;
  }
  
  if (
    lowerQuestion.includes('implement') || 
    lowerQuestion.includes('add feature') || 
    lowerQuestion.includes('create') || 
    lowerQuestion.includes('extend') || 
    lowerQuestion.includes('write code')
  ) {
    return StewardQueryType.IMPLEMENTATION;
  }
  
  if (
    lowerQuestion.includes('bug') || 
    lowerQuestion.includes('fix') || 
    lowerQuestion.includes('error') || 
    lowerQuestion.includes('issue') || 
    lowerQuestion.includes('problem')
  ) {
    return StewardQueryType.BUG;
  }
  
  if (
    lowerQuestion.includes('standard') || 
    lowerQuestion.includes('convention') || 
    lowerQuestion.includes('best practice') || 
    lowerQuestion.includes('guideline')
  ) {
    return StewardQueryType.STANDARD;
  }
  
  // Default to explanation
  return StewardQueryType.EXPLANATION;
}

/**
 * Format analysis details for display
 */
function formatAnalysisDetails(analysis: StewardQueryResult['analysis']): string {
  let formattedAnalysis = '';
  
  // Add patterns
  if (analysis?.patterns && analysis.patterns.length > 0) {
    formattedAnalysis += '\nPatterns:\n';
    analysis.patterns.forEach(pattern => {
      formattedAnalysis += `- ${pattern.name} (${Math.round(pattern.confidence * 100)}% confidence): ${pattern.description}\n`;
    });
  }
  
  // Add relationships
  if (analysis?.relationships && analysis.relationships.length > 0) {
    formattedAnalysis += '\nRelationships:\n';
    analysis.relationships.forEach(rel => {
      formattedAnalysis += `- ${rel.source} → ${rel.target} (${rel.type}): ${rel.description}\n`;
    });
  }
  
  // Add relevant files
  if (analysis?.relevantFiles && analysis.relevantFiles.length > 0) {
    formattedAnalysis += '\nRelevant Files:\n';
    analysis.relevantFiles.forEach(file => {
      formattedAnalysis += `- ${file}\n`;
    });
  }
  
  return formattedAnalysis;
}

export default AskCommand;