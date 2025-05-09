// src/commands/task.tsx
import React, {useState, useEffect} from 'react';
import {Box} from 'ink';
import Spinner from 'ink-spinner';
import {Text as ThemedText} from '../components/common/Text.js';
import {AnthropicService} from '../services/llm/llmService.js';
import {OpenAIService} from '../services/llm/openAIService.js'; 
// import {LLMResponse} from '../services/llm/types.js';
import {TreeSitterIndexingService} from '../services/indexing/indexingService.js';
import {NodeFileSystemService} from '../services/fileSystem/fileSystemService.js';
import {InMemoryRAGService} from '../services/rag/ragService.js';
import {GuardianAgentService} from '../services/agent/agentService.js';
import {AgentContext, TaskResult} from '../services/agent/types.js';
import * as path from 'path';
import * as fs from 'fs-extra';

interface TaskCommandProps {
	description: string;
	options: {
		verbose: boolean;
		model?: string;
		autoApply?: boolean;
		maxFiles?: number;
		[key: string]: any;
	};
}

// Removed unused interfaces

const TaskCommand: React.FC<TaskCommandProps> = ({description, options}) => {
	const [status, setStatus] = useState<
		'initializing' | 'analyzing' | 'loading-context' | 'planning' | 'implementing' | 'success' | 'error'
	>('initializing');
	const [message, setMessage] = useState<string>('');
	const [progressStep, setProgressStep] = useState<string>('');
	const [stewardBriefing, setStewardBriefing] = useState<string>('');
	const [taskResult, setTaskResult] = useState<TaskResult | null>(null);
	const [, setProjectRoot] = useState<string>('');

	useEffect(() => {
		if (!description) {
			setStatus('error');
			setMessage('Please provide a task description.');
			return;
		}

		const executeTask = async () => {
			try {
				// Step 1: Initialize all required services
				setStatus('initializing');
				setProgressStep('Initializing services...');
				
				// Create service instances
				const fileSystemService = new NodeFileSystemService();
				const indexingService = new TreeSitterIndexingService(fileSystemService);
				const llmService = new AnthropicService();
				const embeddingService = new OpenAIService();
				const ragService = new InMemoryRAGService(llmService, fileSystemService, embeddingService);
				const agentService = new GuardianAgentService();
				
				// Initialize the agent service with all dependencies
				await agentService.initialize(
					llmService,
					fileSystemService,
					indexingService,
					ragService
				);
				
				// Step 2: Find project root
				setStatus('analyzing');
				setProgressStep('Finding project root...');
				const root = await findProjectRoot();
				setProjectRoot(root);
				
				// Step 3: Create agent context with task description
				const agentContext: AgentContext = {
					projectPath: root,
					task: description,
					additionalContext: options.verbose ? 'Provide detailed explanations for each step.' : undefined
				};
				
				// Step 4: Get Steward's analysis
				setStatus('planning');
				setProgressStep('Codebase Steward is analyzing the task...');
				const briefing = await agentService.getCodebaseStewardBriefing(agentContext);
				setStewardBriefing(briefing);
				
				// Step 5: Run Implementer Agent
				setStatus('implementing');
				setProgressStep('Implementer Agent is creating solution...');
				const result = await agentService.runImplementerAgent(briefing, agentContext);
				setTaskResult(result);
				
				// Handle result
				if (result.success) {
					setStatus('success');
					setMessage('Task analysis and implementation plan complete!');
				} else {
					setStatus('error');
					setMessage(`Implementation failed: ${result.error}`);
				}
			} catch (error) {
				setStatus('error');
				setMessage(`Task failed: ${error instanceof Error ? error.message : String(error)}`);
			}
		};
		
		executeTask();
	}, [description, options]);
	
	// Function to find the project root
	const findProjectRoot = async (): Promise<string> => {
		// Look for .guardian-ai.json or package.json to determine project root
		let currentDir = process.cwd();
		let configFound = false;
		
		// Try to find config file by traversing up directories
		while (currentDir !== path.parse(currentDir).root && !configFound) {
			const guardianConfigPath = path.join(currentDir, '.guardian-ai.json');
			const packageJsonPath = path.join(currentDir, 'package.json');
			
			if (await fs.pathExists(guardianConfigPath)) {
				configFound = true;
				break;
			}
			
			if (await fs.pathExists(packageJsonPath)) {
				configFound = true;
				break;
			}
			
			// Move up one directory
			currentDir = path.dirname(currentDir);
		}
		
		if (!configFound) {
			// Use current directory if no config found
			return process.cwd();
		}
		
		return currentDir;
	};
	
	// Function to find the project root - no changes needed

	return (
		<Box flexDirection="column">
			<Box marginBottom={1}>
				<ThemedText variant="highlight">Task: {description}</ThemedText>
			</Box>

			{status === 'initializing' && (
				<Box>
					<Spinner />
					<ThemedText> Initializing agent services: {progressStep}</ThemedText>
				</Box>
			)}

			{status === 'analyzing' && (
				<Box>
					<Spinner />
					<ThemedText> Analyzing codebase: {progressStep}</ThemedText>
				</Box>
			)}
			
			{status === 'loading-context' && (
				<Box>
					<Spinner />
					<ThemedText> {progressStep}</ThemedText>
				</Box>
			)}

			{status === 'planning' && (
				<Box>
					<Spinner />
					<ThemedText> Planning implementation: {progressStep}</ThemedText>
				</Box>
			)}

			{status === 'implementing' && (
				<Box>
					<Spinner />
					<ThemedText> {progressStep}</ThemedText>
				</Box>
			)}

			{status === 'success' && (
				<Box flexDirection="column">
					<ThemedText variant="success">{message}</ThemedText>
					
					{stewardBriefing && (
						<Box flexDirection="column" marginTop={1}>
							<ThemedText variant="highlight">Codebase Steward Briefing:</ThemedText>
							<Box marginLeft={1} flexDirection="column">
								<ThemedText>{stewardBriefing}</ThemedText>
							</Box>
						</Box>
					)}
					
					{taskResult && taskResult.success && (
						<Box flexDirection="column" marginTop={1}>
							<ThemedText variant="highlight">Implementation Result:</ThemedText>
							<Box marginLeft={1} flexDirection="column">
								<ThemedText variant="highlight">Generated Code:</ThemedText>
								<ThemedText>{taskResult.generatedCode}</ThemedText>
								
								<ThemedText variant="highlight" marginTop={1}>Files to Modify:</ThemedText>
								{taskResult.modifiedFiles && taskResult.modifiedFiles.length > 0 ? (
									taskResult.modifiedFiles.map((file, i) => (
										<ThemedText key={i}>- {file}</ThemedText>
									))
								) : (
									<ThemedText>No files specified</ThemedText>
								)}
							</Box>
						</Box>
					)}
				</Box>
			)}

			{status === 'error' && <ThemedText variant="error">{message}</ThemedText>}
		</Box>
	);
};

export default TaskCommand;
