// src/services/agent/agentService.ts
// These imports are kept for potential future use
// @ts-ignore
import * as path from 'path';
// @ts-ignore
import * as fs from 'fs-extra';
import { AgentService, AgentContext, TaskResult } from './types.js';
import { LLMService } from '../llm/types.js';
import { FileSystemService } from '../fileSystem/types.js';
import { IndexingService, IndexedCodebase } from '../indexing/types.js';
import { RAGService } from '../rag/types.js';

/**
 * Implementation of the Agent Service using a Steward-Implementer architecture
 */
export class GuardianAgentService implements AgentService {
  private llmService: LLMService | null = null;
  // Kept for future use
  // @ts-ignore
  private fileSystemService: FileSystemService | null = null;
  private indexingService: IndexingService | null = null;
  private ragService: RAGService | null = null;
  private codebaseIndex: IndexedCodebase | null = null;

  /**
   * Initialize the agent service with required dependencies
   */
  async initialize(
    llmService: LLMService,
    fileSystemService: FileSystemService,
    indexingService: IndexingService,
    ragService: RAGService,
  ): Promise<void> {
    this.llmService = llmService;
    this.fileSystemService = fileSystemService;
    this.indexingService = indexingService;
    this.ragService = ragService;
    
    console.log('Agent service initialized with all dependencies');
  }

  /**
   * Get a comprehensive briefing from the Codebase Steward
   * The Steward analyzes the codebase structure and provides context for implementation
   */
  async getCodebaseStewardBriefing(context: AgentContext): Promise<string> {
    if (!this.llmService || !this.indexingService || !this.ragService) {
      throw new Error('Agent service not properly initialized');
    }

    try {
      console.log('Getting codebase briefing from Steward agent...');
      
      // Load or create codebase index
      try {
        this.codebaseIndex = await this.indexingService.loadIndex(context.projectPath);
        console.log('Loaded existing codebase index');
      } catch (error) {
        console.log('Creating new codebase index...');
        this.codebaseIndex = await this.indexingService.indexCodebase(context.projectPath);
        await this.indexingService.saveIndex();
      }
      
      // Generate embeddings for the indexed codebase if needed
      await this.ragService.embedCodebase(this.codebaseIndex);
      
      // Gather codebase statistics
      const stats = this.codebaseIndex.statistics;
      
      // Create a targeted query for the codebase structure
      const query = `I need to understand the structure and architecture of this codebase to help implement: ${context.task}`;
      
      // Get specific context from the RAG service
      const architectureContext = await this.ragService.getContextForCodeQuery(
        query, 
        'architecture', 
        4000
      );
      
      // Get implementation-specific context
      const implementationContext = await this.ragService.getContextForCodeQuery(
        query,
        'implementation',
        4000
      );
      
      // Construct the steward prompt
      const stewardPrompt = `
# Project Analysis Request

## Task Description
${context.task}

## Codebase Statistics
- Total Files: ${stats.totalFiles}
- Total Symbols: ${stats.totalSymbols}
- Total Dependencies: ${stats.totalDependencies}
- Last Indexed: ${stats.lastIndexed}

## Additional Context
${context.additionalContext || 'No additional context provided.'}

## Architectural Context
${architectureContext}

## Implementation Context
${implementationContext}

---

As the Codebase Steward, please provide:
1. An architectural overview of the relevant components for this task
2. Specifically which files will need to be modified or created
3. Key dependencies and interfaces that must be respected
4. Potential edge cases or challenges to consider
5. A step-by-step plan for implementing this task
6. Design patterns to follow that are consistent with the existing codebase

Your role is to guide the Implementer Agent with a clear, structured plan. Be specific and thorough.
`;

      // Get the steward's briefing
      const stewardResponse = await this.llmService.complete({
        prompt: stewardPrompt,
        systemPrompt: `
You are the Codebase Steward, an expert software architect who analyzes codebases and provides implementation guidance.

- Always think systematically about the architecture and how components interact
- Focus on the specific task at hand while respecting the existing patterns
- Provide clear, actionable guidance for implementation
- Include specific file paths, function names, and implementation details when possible
- Be comprehensive but concise
`,
        options: {
          temperature: 0.2, // Lower temperature for more focused, consistent output
          maxTokens: 4000,
        }
      });
      
      return stewardResponse.text;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      throw new Error(`Steward agent failed: ${errorMessage}`);
    }
  }

  /**
   * Run the Implementer Agent to generate code based on the Steward's briefing
   */
  async runImplementerAgent(
    briefing: string,
    context: AgentContext,
  ): Promise<TaskResult> {
    if (!this.llmService || !this.ragService) {
      throw new Error('Agent service not properly initialized');
    }

    try {
      console.log('Running implementer agent to generate code...');
      
      // Get targeted implementation context for specific parts of the task
      const implementationContext = await this.ragService.getContextForCodeQuery(
        context.task,
        'implementation',
        3000
      );
      
      // Construct the implementer prompt
      const implementerPrompt = `
# Implementation Task

## Task Description
${context.task}

## Steward's Briefing
${briefing}

## Relevant Implementation Context
${implementationContext}

## Additional Context
${context.additionalContext || 'No additional context provided.'}

---

As the Implementer Agent, please provide:
1. The complete code for each file that needs to be created or modified
2. Clear explanations for significant implementation decisions
3. Any necessary configuration changes
4. Testing considerations

For each file you need to create or modify, use the following format:

FILE: [full/path/to/filename.ext]
\`\`\`
// Complete file content here
\`\`\`

EXPLANATION:
Brief explanation of what this file does and key implementation details.

`;

      // Get the implementer's response
      const implementerResponse = await this.llmService.complete({
        prompt: implementerPrompt,
        systemPrompt: `
You are the Implementer Agent, an expert software engineer who writes clean, efficient code based on architectural guidance.

- Follow the Steward's guidance precisely
- Generate complete, working code for each file
- Use consistent coding styles that match the existing codebase
- Include proper error handling and edge cases
- Focus on code correctness, readability, and maintainability
- Use modern programming practices and patterns
`,
        options: {
          temperature: 0.3,
          maxTokens: 8000,
        }
      });
      
      // Parse the implementation response to extract files
      const modifiedFiles = this.parseImplementationFiles(implementerResponse.text);
      
      return {
        success: true,
        output: implementerResponse.text,
        generatedCode: implementerResponse.text,
        modifiedFiles
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      return {
        success: false,
        output: '',
        error: `Implementer agent failed: ${errorMessage}`
      };
    }
  }

  /**
   * Execute a complete task using both the Steward and Implementer agents
   */
  async executeTask(context: AgentContext): Promise<TaskResult> {
    try {
      console.log(`Executing task: ${context.task}`);
      
      // Step 1: Get the Steward's briefing
      const briefing = await this.getCodebaseStewardBriefing(context);
      
      // Step 2: Run the Implementer agent
      const implementationResult = await this.runImplementerAgent(briefing, context);
      
      if (!implementationResult.success) {
        return implementationResult;
      }
      
      // Step 3: Apply the implementation if requested
      // Note: For safety, we don't automatically apply changes - this would be a separate step
      
      return {
        success: true,
        output: `
# Task Execution Complete

## Steward's Briefing
${briefing}

## Implementation Result
${implementationResult.output}

## Files Modified
${implementationResult.modifiedFiles?.join('\n') || 'No files modified'}
`,
        generatedCode: implementationResult.generatedCode,
        modifiedFiles: implementationResult.modifiedFiles
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      return {
        success: false,
        output: '',
        error: `Task execution failed: ${errorMessage}`
      };
    }
  }
  
  /**
   * Parse the implementation response to extract the file paths that would be modified
   */
  private parseImplementationFiles(implementation: string): string[] {
    const modifiedFiles: string[] = [];
    const filePattern = /FILE:\s+\[(.+?)\]/g;
    
    let match;
    while ((match = filePattern.exec(implementation)) !== null) {
      if (match[1]) {
        modifiedFiles.push(match[1]);
      }
    }
    
    return modifiedFiles;
  }
}