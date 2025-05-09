import {LLMService} from '../llm/types.js';
import {FileSystemService} from '../fileSystem/types.js';
import {IndexingService} from '../indexing/types.js';
import {RAGService} from '../rag/types.js';

// src/services/agent/types.ts
export interface TaskResult {
	success: boolean;
	output: string;
	error?: string;
	generatedCode?: string;
	modifiedFiles?: string[];
}

export interface AgentContext {
	projectPath: string;
	task: string;
	additionalContext?: string;
}

export interface AgentService {
	/**
	 * Initialize the agent service with dependencies
	 */
	initialize(
		llmService: LLMService,
		fileSystemService: FileSystemService,
		indexingService: IndexingService,
		ragService: RAGService,
	): Promise<void>;

	/**
	 * The Codebase Steward analyzes the codebase and provides context
	 */
	getCodebaseStewardBriefing(context: AgentContext): Promise<string>;

	/**
	 * The Implementer Agent generates code based on the Steward's briefing
	 */
	runImplementerAgent(
		briefing: string,
		context: AgentContext,
	): Promise<TaskResult>;

	/**
	 * Execute a full task using both agents
	 */
	executeTask(context: AgentContext): Promise<TaskResult>;
}
