// src/commands/ask.tsx
import React, {useState, useEffect} from 'react';
import {Box} from 'ink';
import Spinner from 'ink-spinner';
import {Text as ThemedText} from '../components/common/Text.js';
import {AnthropicService} from '../services/llm/llmService.js';
import {OpenAIService} from '../services/llm/openAIService.js';
import {LLMResponse} from '../services/llm/types.js';
import {InMemoryRAGService} from '../services/rag/ragService.js';
import {NodeFileSystemService} from '../services/fileSystem/fileSystemService.js';
import {TreeSitterIndexingService} from '../services/indexing/indexingService.js';
import * as path from 'path';
import * as fs from 'fs-extra';

interface AskCommandProps {
	question: string;
	options: {
		verbose: boolean;
		[key: string]: any;
	};
}

const AskCommand: React.FC<AskCommandProps> = ({question, options}) => {
	const [status, setStatus] = useState<'finding-project' | 'loading-index' | 'retrieving-context' | 'thinking' | 'success' | 'error'>(
		'finding-project',
	);
	const [answer, setAnswer] = useState<string>('');
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
				
				// Get relevant context using RAG
				setStatus('retrieving-context');
				setStatusMessage('Retrieving relevant code context...');
				
				// Create services for RAG
				const llmService = new AnthropicService();
				const embeddingService = new OpenAIService();
				const ragService = new InMemoryRAGService(llmService, fileSystem, embeddingService);
				
				try {
					await ragService.loadVectorDB(projectRoot);
				} catch (error) {
					console.warn('Vector DB not found, continuing without context:', error);
				}
				
				// Get context for the question
				const contextForQuery = await ragService.getContextForQuery(question, 2000);
				
				// Use the LLM service for generating the answer
				setStatus('thinking');
				setStatusMessage('Generating answer...');
				
				// Prepare system prompt
				const systemPrompt = 'You are GuardianAI, an AI assistant specialized in helping developers understand their codebase. ' +
					'You will be given relevant code context from the user\'s project. ' +
					'Use this context to provide accurate, specific answers about their code. ' +
					'If the context doesn\'t contain enough information to answer fully, acknowledge the limitations ' +
					'while still providing the best response possible based on available information.';
				
				// Compose the prompt with the question and context
				const prompt = `Question about codebase: ${question}\n\n` +
					`Here is relevant context from your codebase:\n\n` +
					`${contextForQuery}\n\n` +
					`Please provide a detailed and helpful response based on this context.`;
				
				// Make the API call
				const response: LLMResponse = await llmService.complete({
					prompt,
					systemPrompt,
					options: {
						model: options['model'],
						temperature: 0.7,
						maxTokens: 1500,
					}
				});
				
				// Update state with the response
				setStatus('success');
				setAnswer(response.text);
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

			{(status === 'finding-project' || status === 'loading-index' || status === 'retrieving-context' || status === 'thinking') && (
				<Box>
					<Spinner />
					<ThemedText> {statusMessage}</ThemedText>
				</Box>
			)}

			{status === 'success' && (
				<Box flexDirection="column">
					<ThemedText variant="highlight">A:</ThemedText>
					<ThemedText>{answer}</ThemedText>
				</Box>
			)}

			{status === 'error' && <ThemedText variant="error">{answer}</ThemedText>}
		</Box>
	);
};

export default AskCommand;
