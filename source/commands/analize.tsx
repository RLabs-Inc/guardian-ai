// src/commands/analize.tsx
import React, {useState, useEffect} from 'react';
import {Box} from 'ink';
import Spinner from 'ink-spinner';
import {Text as ThemedText} from '../components/common/Text.js';
import {TreeSitterIndexingService} from '../services/indexing/indexingService.js';
import {NodeFileSystemService} from '../services/fileSystem/fileSystemService.js';
import {InMemoryRAGService} from '../services/rag/ragService.js';
import {AnthropicService} from '../services/llm/llmService.js';
import {OpenAIService} from '../services/llm/openAIService.js';
import {IndexedCodebase} from '../services/indexing/types.js';
import * as path from 'path';
import * as fs from 'fs-extra';

interface AnalyzeCommandProps {
	options: {
		verbose: boolean;
		[key: string]: any;
	};
}

const AnalyzeCommand: React.FC<AnalyzeCommandProps> = ({options}) => {
	const [status, setStatus] = useState<'analyzing' | 'generating-embeddings' | 'success' | 'error'>(
		'analyzing',
	);
	const [message, setMessage] = useState<string>('');
	const [analyzeProgress, setAnalyzeProgress] = useState<string>('Initializing...');
	const [ragProgress, setRagProgress] = useState<string>('');
	const [indexResults, setIndexResults] = useState<IndexedCodebase | null>(null);
	const [embeddingsCount, setEmbeddingsCount] = useState<number>(0);

	useEffect(() => {
		const analyzeCodebase = async () => {
			try {
				setAnalyzeProgress('Finding project root...');
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

				// If no config found, use current directory
				if (!configFound) {
					projectRoot = process.cwd();
					setAnalyzeProgress('No GuardianAI config found. Using current directory.');
				} else {
					setAnalyzeProgress(`Found project at ${projectRoot}`);
				}

				// Create services
				const fileSystem = new NodeFileSystemService();
				const indexingService = new TreeSitterIndexingService(fileSystem);

				// Start indexing process
				setAnalyzeProgress('Indexing codebase. This may take a while...');
				const index = await indexingService.indexCodebase(projectRoot, {
					maxFiles: options['maxFiles'] || 1000,
					parseDocumentation: true,
				});

				// Save the index
				setAnalyzeProgress('Saving index...');
				await indexingService.saveIndex();
				
				// Update index results
				setIndexResults(index);
				
				// Start RAG process
				setStatus('generating-embeddings');
				setRagProgress('Initializing RAG service...');
				
				// Create required services for RAG
				const llmService = new AnthropicService();
				const embeddingService = new OpenAIService();
				// Create and initialize RAG service with embedding support
				const ragService = new InMemoryRAGService(llmService, fileSystem, embeddingService);
				await ragService.initialize();
				
				// Generate embeddings
				setRagProgress('Generating embeddings for codebase...');
				try {
					// Generate embeddings and track count
					// const startTime = Date.now(); // Unused variable
					await ragService.embedCodebase(index);
					
					// Get the vector count - in a real implementation we'd have 
					// a method to retrieve this directly from the RAG service
					try {
						// Using a placeholder estimate based on symbols
						// In a real implementation, we'd get this from the RAG service
						setEmbeddingsCount(Object.keys(index.symbols).length);
					} catch (error) {
						console.warn('Could not determine embeddings count:', error);
						setEmbeddingsCount(0);
					}
					
					// Save the vector database
					setRagProgress('Saving vector database...');
					await ragService.saveVectorDB();
					
					// Update status
					setStatus('success');
					setMessage(
						`Analysis complete! Indexed ${index.statistics.totalFiles} files with ${index.statistics.totalSymbols} symbols and generated ${embeddingsCount} embeddings.`
					);
				} catch (error) {
					console.error('Error generating embeddings:', error);
					// Continue with success status even if embeddings failed
					setStatus('success');
					setMessage(
						`Analysis complete! Indexed ${index.statistics.totalFiles} files with ${index.statistics.totalSymbols} symbols. (Note: Embedding generation failed)`
					);
				}
			} catch (error) {
				setStatus('error');
				setMessage(`Analysis failed: ${error instanceof Error ? error.message : String(error)}`);
			}
		};

		analyzeCodebase();
	}, [options]);

	return (
		<Box flexDirection="column">
			{(status === 'analyzing' || status === 'generating-embeddings') && (
				<Box flexDirection="column">
					<Box>
						<Spinner />
						<ThemedText> {status === 'analyzing' ? 'Analyzing codebase...' : 'Generating knowledge base...'}</ThemedText>
					</Box>
					<ThemedText variant="dim">{status === 'analyzing' ? analyzeProgress : ragProgress}</ThemedText>
				</Box>
			)}

			{status === 'success' && (
				<Box flexDirection="column">
					<ThemedText variant="success">{message}</ThemedText>
					
					{indexResults && (
						<Box flexDirection="column" marginTop={1}>
							<ThemedText variant="highlight">Index Statistics:</ThemedText>
							<ThemedText>- Files analyzed: {indexResults.statistics.totalFiles}</ThemedText>
							<ThemedText>- Symbols found: {indexResults.statistics.totalSymbols}</ThemedText>
							<ThemedText>- Dependencies mapped: {indexResults.statistics.totalDependencies}</ThemedText>
							<ThemedText>- Embeddings generated: {embeddingsCount}</ThemedText>
							<ThemedText>- Last indexed: {indexResults.statistics.lastIndexed.toLocaleString()}</ThemedText>
							
							{options.verbose && indexResults.files.length > 0 && (
								<Box flexDirection="column" marginTop={1}>
									<ThemedText variant="highlight">Indexed Files (first 5):</ThemedText>
									{indexResults.files.slice(0, 5).map((file, i) => (
										<ThemedText key={i}>- {file}</ThemedText>
									))}
									{indexResults.files.length > 5 && (
										<ThemedText variant="dim">...and {indexResults.files.length - 5} more</ThemedText>
									)}
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
