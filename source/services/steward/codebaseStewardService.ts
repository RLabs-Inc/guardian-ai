// source/services/steward/codebaseStewardService.ts
// Removed unused imports
import {
	CodebaseStewardService,
	StewardQueryType,
	StewardQueryOptions,
	StewardQueryResult,
	CodePattern,
} from './types.js';
import {LLMService} from '../llm/types.js';
import {FileSystemService} from '../fileSystem/types.js';
import {IndexingService} from '../indexing/types.js';
import {RAGService} from '../rag/types.js';
import {AnthropicService} from '../llm/llmService.js';
import {NodeFileSystemService} from '../fileSystem/fileSystemService.js';

/**
 * Implementation of the Codebase Steward service
 * Provides advanced code understanding through vector search and LLM analysis
 */
export class VectorizedCodebaseStewardService
	implements CodebaseStewardService
{
	private llmService: LLMService;
	// fileSystem service used in constructor
	private indexingService: IndexingService;
	private ragService: RAGService;
	// Removed unused properties
	private livingStandardsCache: Record<string, any> = {};
	private patternsCache: CodePattern[] = [];
	private relationshipsCache: Record<string, any[]> = {};

	constructor(
		llmService?: LLMService,
		fileSystemService?: FileSystemService,
		indexingService?: IndexingService,
		ragService?: RAGService,
	) {
		this.llmService = llmService || new AnthropicService();
		// FileSystem service created but not directly used in this class
		fileSystemService = fileSystemService || new NodeFileSystemService();
		this.indexingService = indexingService || (null as any);
		this.ragService = ragService || (null as any);
	}

	/**
	 * Initialize the Codebase Steward service
	 */
	async initialize(): Promise<void> {
		if (!this.indexingService || !this.ragService) {
			throw new Error('Codebase Steward requires indexing and RAG services');
		}

		console.log('Initializing Codebase Steward service...');
	}

	/**
	 * Process a query about the codebase
	 */
	async query(
		queryText: string,
		queryType: StewardQueryType = StewardQueryType.EXPLANATION,
		options: StewardQueryOptions = {},
	): Promise<StewardQueryResult> {
		try {
			// Default options
			const maxTokens = options.maxTokens || 4000;
			const includeAnalysis = options.includeAnalysis || false;
			
			options.maxContextItems = options.maxContextItems || 10; // Setting option but not using directly

			// Validate query
			if (!queryText || queryText.trim() === '') {
				return {
					success: false,
					response: 'Query text cannot be empty',
					error: 'Empty query',
				};
			}

			// Map our query type to the RAG query type
			const ragQueryType = this.mapQueryTypeToRagType(queryType);

			// Get relevant context from the RAG service
			const context = await this.ragService.getContextForCodeQuery(
				queryText,
				ragQueryType,
				maxTokens / 2, // Allocate half the tokens for context
			);

			// Construct a steward prompt based on the query type
			const prompt = await this.constructPromptForQueryType(
				queryText,
				queryType,
				context,
				options.additionalContext || '',
			);

			// Use different system prompts based on query type
			const systemPrompt = this.getSystemPromptForQueryType(queryType);

			// Get the response from the LLM
			const response = await this.llmService.complete({
				prompt,
				systemPrompt,
				options: {
					temperature: this.getTemperatureForQueryType(queryType),
					maxTokens,
				},
			});

			// Build the result
			const result: StewardQueryResult = {
				success: true,
				response: response.text,
				tokensUsed: response.usage?.totalTokens || 0,
				relevantFiles: this.extractRelevantFilesFromContext(context),
			};

			// Include detailed analysis if requested
			if (includeAnalysis) {
				result.analysis = await this.generateAnalysisForQuery(
					queryText,
					queryType,
				);
			}

			return result;
		} catch (error) {
			return {
				success: false,
				response: 'Failed to process query',
				error: error instanceof Error ? error.message : String(error),
			};
		}
	}

	/**
	 * Get architectural patterns identified in the codebase
	 */
	async getPatterns(options?: {
		confidence?: number;
		limit?: number;
	}): Promise<CodePattern[]> {
		const confidence = options?.confidence || 0.7;
		const limit = options?.limit || 10;

		// Use cached patterns if available
		if (this.patternsCache.length > 0) {
			return this.patternsCache
				.filter(pattern => pattern.confidence >= confidence)
				.slice(0, limit);
		}

		try {
			// Create a query specifically for architectural patterns
			const patternQuery =
				'Identify architectural patterns, design patterns, and code conventions used in this codebase';

			// Get relevant context for pattern analysis
			const context = await this.ragService.getContextForCodeQuery(
				patternQuery,
				'architecture',
				6000, // Use more tokens for comprehensive pattern analysis
			);

			// Pattern analysis system prompt
			const systemPrompt = `
You are a Pattern Recognition expert working with the Codebase Steward system.
Your goal is to identify architectural patterns, design patterns, and coding conventions in the provided code context.
For each pattern you identify:
1. Provide a name for the pattern
2. Give a detailed description
3. Include specific examples from the codebase
4. Assess your confidence in this pattern identification (0.0-1.0)
5. List the files where this pattern appears

Return your analysis in a structured JSON format.
      `;

			// Pattern analysis prompt
			const prompt = `
# Pattern Analysis Request

I need to identify architectural patterns, design patterns, and coding conventions in this codebase.

## Code Context
${context}

Please analyze this code and identify patterns with the following information for each:
1. Pattern name
2. Description of the pattern
3. Examples from the codebase
4. Confidence score (0.0-1.0)
5. Files where the pattern appears

Return the results in valid JSON format.
      `;

			// Get pattern analysis from LLM
			const response = await this.llmService.complete({
				prompt,
				systemPrompt,
				options: {
					temperature: 0.2,
					maxTokens: 3000,
				},
			});

			// Parse the response to extract patterns
			const patterns = this.extractPatternsFromResponse(response.text);

			// Cache patterns for future use
			this.patternsCache = patterns;

			// Filter and limit results
			return patterns
				.filter(pattern => pattern.confidence >= confidence)
				.slice(0, limit);
		} catch (error) {
			console.error('Error getting patterns:', error);
			return [];
		}
	}

	/**
	 * Get relationships between components
	 */
	async getRelationships(
		componentName?: string,
		options?: {types?: string[]; depth?: number},
	): Promise<
		Array<{source: string; target: string; type: string; description: string}>
	> {
		const types = options?.types || [];
		const depth = options?.depth || 1;

		// Check cache for the component
		const cacheKey = componentName || 'all';
		if (this.relationshipsCache[cacheKey]) {
			let relationships = this.relationshipsCache[cacheKey];

			// Filter by type if requested
			if (types && types.length > 0) {
				relationships = relationships.filter(rel => types.includes(rel.type));
			}

			return relationships;
		}

		try {
			// Create a relationships query
			let relationshipsQuery = 'Identify relationships between code components';
			if (componentName) {
				relationshipsQuery = `Identify relationships between the component '${componentName}' and other components`;
			}

			// Get context specifically for relationship analysis
			const context = await this.ragService.getContextForCodeQuery(
				relationshipsQuery,
				'architecture',
				5000,
			);

			// Construct the system prompt
			const systemPrompt = `
You are a Component Relationship expert working with the Codebase Steward system.
Your goal is to identify relationships between software components in the provided code context.
Identify relationships such as:
- Imports/Dependencies
- Inheritance/Implementation
- Composition/Aggregation
- API Consumer/Provider
- Event Emitter/Listener
- Data Flow relationships

For each relationship, specify:
1. Source component
2. Target component
3. Relationship type
4. Brief description of the relationship

Return your analysis in a structured JSON format.
      `;

			// Construct the prompt
			const prompt = `
# Component Relationship Analysis Request

${
	componentName
		? `I need to understand how the '${componentName}' component relates to other components in the codebase.`
		: 'I need to understand the relationships between components in this codebase.'
}

${
	depth > 1
		? `Include relationships up to ${depth} levels deep (i.e., components that are ${depth} steps away).`
		: 'Only include direct relationships.'
}

## Code Context
${context}

Please analyze this code and identify component relationships with the following information for each:
1. Source component
2. Target component
3. Relationship type
4. Brief description explaining the relationship

Return the results in valid JSON format.
      `;

			// Get relationship analysis from LLM
			const response = await this.llmService.complete({
				prompt,
				systemPrompt,
				options: {
					temperature: 0.3,
					maxTokens: 3000,
				},
			});

			// Parse the response to extract relationships
			const relationships = this.extractRelationshipsFromResponse(
				response.text,
			);

			// Cache results
			this.relationshipsCache[cacheKey] = relationships;

			// Filter by type if requested
			if (types && types.length > 0) {
				return relationships.filter(rel => types.includes(rel.type));
			}

			return relationships;
		} catch (error) {
			console.error('Error getting relationships:', error);
			return [];
		}
	}

	/**
	 * Analyze a specific aspect of the codebase
	 */
	async analyzeAspect(
		aspect: 'architecture' | 'patterns' | 'conventions' | 'dependencies',
		options?: {depth?: number; focus?: string},
	): Promise<{analysis: string; recommendations: string[]}> {
		const depth = options?.depth || 2;
		const focus = options?.focus || '';

		try {
			// Create an aspect-specific query
			let aspectQuery = `Analyze the ${aspect} of this codebase`;
			if (focus) {
				aspectQuery += ` with a focus on ${focus}`;
			}

			// Map aspect to the most appropriate RAG query type
			const queryType =
				aspect === 'architecture' || aspect === 'patterns'
					? 'architecture'
					: 'explanation';

			// Get relevant context for the analysis
			const context = await this.ragService.getContextForCodeQuery(
				aspectQuery,
				queryType as any,
				6000, // Use more tokens for comprehensive analysis
			);

			// Construct the system prompt
			const systemPrompt = `
You are a Code Analysis expert working with the Codebase Steward system.
Your goal is to provide a detailed analysis of the ${aspect} of the provided codebase.
${
	depth === 1
		? 'Provide a high-level overview.'
		: depth === 2
		? 'Provide a moderately detailed analysis.'
		: 'Provide an in-depth analysis with fine details.'
}
${focus ? `Focus your analysis specifically on ${focus}.` : ''}

Include:
1. A comprehensive analysis section
2. A list of actionable recommendations for improvement

Base your analysis strictly on the code context provided. If information is missing, acknowledge the limitations.
`;

			// Construct the prompt
			const prompt = `
# Codebase ${aspect.charAt(0).toUpperCase() + aspect.slice(1)} Analysis Request

${
	focus
		? `I need a detailed analysis of the ${aspect} of this codebase with a focus on ${focus}.`
		: `I need a detailed analysis of the ${aspect} of this codebase.`
}
${
	depth === 1
		? 'Please provide a high-level overview.'
		: depth === 2
		? 'Please provide a moderately detailed analysis.'
		: 'Please provide an in-depth analysis with fine details.'
}

## Code Context
${context}

Please analyze this code and provide:
1. A comprehensive analysis section
2. A list of actionable recommendations for improvement
`;

			// Get analysis from LLM
			const response = await this.llmService.complete({
				prompt,
				systemPrompt,
				options: {
					temperature: 0.3,
					maxTokens: 4000,
				},
			});

			// Extract recommendations from the analysis
			const recommendations = this.extractRecommendationsFromAnalysis(
				response.text,
			);

			return {
				analysis: response.text,
				recommendations,
			};
		} catch (error) {
			console.error(`Error analyzing ${aspect}:`, error);
			return {
				analysis: `Failed to analyze ${aspect}`,
				recommendations: [],
			};
		}
	}

	/**
	 * Get guidance for implementing a new feature
	 */
	async getImplementationGuidance(
		featureDescription: string,
		options?: {existingComponents?: string[]; technicalConstraints?: string[]},
	): Promise<{
		architecture: string;
		filesToModify: string[];
		newFilesToCreate: string[];
		implementationSteps: string[];
	}> {
		const existingComponents = options?.existingComponents || [];
		const technicalConstraints = options?.technicalConstraints || [];

		try {
			// Create a feature implementation query
			let implementationQuery = `How to implement this feature: ${featureDescription}`;

			// Get relevant context for implementation guidance
			const context = await this.ragService.getContextForCodeQuery(
				implementationQuery,
				'implementation',
				5000,
			);

			// Get patterns from the codebase for implementation consistency
			const patterns = await this.getPatterns({confidence: 0.8, limit: 5});

			// Construct the system prompt
			const systemPrompt = `
You are an Implementation Architect working with the Codebase Steward system.
Your goal is to provide detailed guidance for implementing a new feature in an existing codebase.
Base your guidance strictly on the code context provided, existing patterns, and any constraints specified.

Provide:
1. A high-level architectural description for the implementation
2. A list of existing files that need to be modified
3. A list of new files that need to be created
4. A step-by-step implementation plan

Be specific with file paths, component names, and implementation details.
`;

			// Format the patterns as a string for inclusion in the prompt
			const patternsText = patterns
				.map(
					pattern =>
						`- ${pattern.name}: ${
							pattern.description
						}\n  Examples: ${pattern.examples.slice(0, 2).join(', ')}`,
				)
				.join('\n');

			// Construct the prompt
			const prompt = `
# Implementation Guidance Request

## Feature Description
${featureDescription}

## Existing Components to Leverage
${
	existingComponents.length > 0
		? existingComponents.join('\n')
		: 'No specific components specified.'
}

## Technical Constraints
${
	technicalConstraints.length > 0
		? technicalConstraints.join('\n')
		: 'No specific constraints specified.'
}

## Identified Codebase Patterns
${patternsText || 'No specific patterns identified.'}

## Relevant Code Context
${context}

Please provide detailed implementation guidance including:
1. A high-level architectural description for the implementation
2. A list of existing files that need to be modified (with exact paths)
3. A list of new files that need to be created (with exact paths)
4. A step-by-step implementation plan
`;

			// Get implementation guidance from LLM
			const response = await this.llmService.complete({
				prompt,
				systemPrompt,
				options: {
					temperature: 0.3,
					maxTokens: 4000,
				},
			});

			// Parse the response to extract implementation details
			const guidance = this.extractImplementationGuidance(response.text);

			return {
				architecture: guidance.architecture,
				filesToModify: guidance.filesToModify,
				newFilesToCreate: guidance.newFilesToCreate,
				implementationSteps: guidance.implementationSteps,
			};
		} catch (error) {
			console.error('Error getting implementation guidance:', error);
			return {
				architecture: 'Failed to generate implementation guidance',
				filesToModify: [],
				newFilesToCreate: [],
				implementationSteps: [],
			};
		}
	}

	/**
	 * Get or create living standards documentation
	 */
	async getLivingStandards(
		category?:
			| 'code-style'
			| 'architecture'
			| 'testing'
			| 'security'
			| 'performance',
	): Promise<{
		standards: string;
		examples: Record<string, string[]>;
		violations?: Record<string, string[]>;
	}> {
		// Check cache first
		const cacheKey = category || 'all';
		if (this.livingStandardsCache[cacheKey]) {
			return this.livingStandardsCache[cacheKey];
		}

		try {
			// Create a standards-specific query
			let standardsQuery = 'Identify coding standards and best practices';
			if (category) {
				standardsQuery = `Identify ${category} standards and best practices`;
			}

			// Get relevant context for standards analysis
			const context = await this.ragService.getContextForCodeQuery(
				standardsQuery,
				'explanation',
				5000,
			);

			// Get patterns to inform standards
			const patterns = await this.getPatterns({confidence: 0.8, limit: 5});

			// Construct the system prompt
			const systemPrompt = `
You are a Living Standards expert working with the Codebase Steward system.
Your goal is to identify, document, and maintain coding standards based on the actual codebase practices.
${
	category
		? `Focus specifically on ${category} standards.`
		: 'Cover all standard categories including code-style, architecture, testing, security, and performance.'
}

For each standard:
1. Provide a clear description of the standard
2. Give positive examples from the codebase that follow this standard
3. Optionally identify violations that don't follow the standard

Return your standards documentation in a well-structured format.
`;

			// Format the patterns as a string for inclusion in the prompt
			const patternsText = patterns
				.map(
					pattern =>
						`- ${pattern.name}: ${
							pattern.description
						}\n  Examples: ${pattern.examples.slice(0, 2).join(', ')}`,
				)
				.join('\n');

			// Construct the prompt
			const prompt = `
# Living Standards Documentation Request

${
	category
		? `I need to document the ${category} standards used in this codebase.`
		: 'I need to document all coding standards used in this codebase.'
}

## Identified Codebase Patterns
${patternsText || 'No specific patterns identified.'}

## Relevant Code Context
${context}

Please analyze this code and extract:
1. A comprehensive set of standards that are followed in the codebase
2. For each standard, provide positive examples from the actual code
3. Optionally identify any violations of these standards

The goal is to create a "living standards" document that reflects what's actually in the code, not theoretical best practices.
`;

			// Get standards from LLM
			const response = await this.llmService.complete({
				prompt,
				systemPrompt,
				options: {
					temperature: 0.3,
					maxTokens: 4000,
				},
			});

			// Parse the response to extract standards
			const standards = this.extractStandards(response.text, category);

			// Cache for future use
			this.livingStandardsCache[cacheKey] = standards;

			return standards;
		} catch (error) {
			console.error('Error getting living standards:', error);
			return {
				standards: 'Failed to generate living standards documentation',
				examples: {},
			};
		}
	}

	/**
	 * Helper method to map our query type to RAG query type
	 */
	private mapQueryTypeToRagType(
		queryType: StewardQueryType,
	): 'explanation' | 'implementation' | 'architecture' | 'bug' {
		switch (queryType) {
			case StewardQueryType.EXPLANATION:
				return 'explanation';
			case StewardQueryType.IMPLEMENTATION:
			case StewardQueryType.STANDARD:
				return 'implementation';
			case StewardQueryType.ARCHITECTURE:
			case StewardQueryType.PATTERN:
			case StewardQueryType.RELATIONSHIP:
				return 'architecture';
			case StewardQueryType.BUG:
				return 'bug';
			default:
				return 'explanation';
		}
	}

	/**
	 * Construct a prompt based on the query type
	 */
	private async constructPromptForQueryType(
		queryText: string,
		queryType: StewardQueryType,
		context: string,
		additionalContext: string,
	): Promise<string> {
		// Base prompt structure
		let prompt = `
# ${this.getQueryTypeTitle(queryType)} Request

## Query
${queryText}

## Code Context
${context}
`;

		// Add additional context if provided
		if (additionalContext) {
			prompt += `\n## Additional Context\n${additionalContext}\n`;
		}

		// Add specialized sections based on query type
		switch (queryType) {
			case StewardQueryType.PATTERN:
				const patterns = await this.getPatterns({limit: 5});
				const patternsText = patterns
					.map(pattern => `- ${pattern.name}: ${pattern.description}`)
					.join('\n');

				prompt += `\n## Known Patterns in this Codebase\n${
					patternsText || 'No patterns identified yet.'
				}\n`;
				break;

			case StewardQueryType.RELATIONSHIP:
				prompt += `\n## Response Format\nPlease explain the relationships between components using diagrams if helpful. For each relationship, explain how the components interact.\n`;
				break;

			case StewardQueryType.IMPLEMENTATION:
				prompt += `\n## Response Format\nPlease provide a step-by-step implementation plan, including specific files to modify and code examples.\n`;
				break;

			case StewardQueryType.STANDARD:
				prompt += `\n## Response Format\nPlease extract and document the standards being followed in this codebase with specific examples.\n`;
				break;
		}

		return prompt;
	}

	/**
	 * Get a system prompt based on the query type
	 */
	private getSystemPromptForQueryType(queryType: StewardQueryType): string {
		const basePrompt = `
You are the Codebase Steward, an expert software architect who analyzes codebases and provides deep insights.

- Always base your responses on the actual code provided in the context
- Be specific with file names, line numbers, and code references
- If information is missing or incomplete, acknowledge the limitations
- For code references, use standard format: filename:line_number
`;

		switch (queryType) {
			case StewardQueryType.EXPLANATION:
				return `${basePrompt}
- Focus on explaining the code clearly and accurately
- Include relevant context and implementation details
- Use clear, concise language suitable for developers
`;

			case StewardQueryType.ARCHITECTURE:
				return `${basePrompt}
- Focus on the high-level architecture and component relationships
- Explain the separation of concerns and module boundaries
- Describe data flow and control flow between components
- Identify architectural patterns and design choices
`;

			case StewardQueryType.IMPLEMENTATION:
				return `${basePrompt}
- Focus on providing actionable implementation guidance
- Suggest specific approaches consistent with the existing codebase
- Reference similar implementations in the codebase when available
- Consider cross-cutting concerns like error handling and testing
`;

			case StewardQueryType.PATTERN:
				return `${basePrompt}
- Focus on identifying and explaining code patterns
- Provide comprehensive pattern descriptions with examples
- Explain the rationale behind the pattern usage
- Suggest appropriate contexts for applying these patterns
`;

			case StewardQueryType.RELATIONSHIP:
				return `${basePrompt}
- Focus on relationships between components, modules, and services
- Explain dependencies, data flow, and control flow
- Describe the interface boundaries and contracts
- Identify potential coupling issues or improvements
`;

			case StewardQueryType.BUG:
				return `${basePrompt}
- Focus on identifying potential issues, bugs, or edge cases
- Use careful analysis to diagnose the problem
- Suggest specific fixes with code examples when possible
- Consider related components that might be affected
`;

			case StewardQueryType.STANDARD:
				return `${basePrompt}
- Focus on identifying coding standards and conventions
- Extract patterns from the actual code rather than theoretical best practices
- Provide concrete examples for each standard
- Organize standards by category for clarity
`;

			default:
				return basePrompt;
		}
	}

	/**
	 * Get a title for each query type
	 */
	private getQueryTypeTitle(queryType: StewardQueryType): string {
		switch (queryType) {
			case StewardQueryType.EXPLANATION:
				return 'Code Explanation';
			case StewardQueryType.ARCHITECTURE:
				return 'Architecture Analysis';
			case StewardQueryType.IMPLEMENTATION:
				return 'Implementation Guidance';
			case StewardQueryType.PATTERN:
				return 'Pattern Analysis';
			case StewardQueryType.RELATIONSHIP:
				return 'Component Relationship';
			case StewardQueryType.BUG:
				return 'Bug Investigation';
			case StewardQueryType.STANDARD:
				return 'Living Standards';
			default:
				return 'Code Analysis';
		}
	}

	/**
	 * Get appropriate temperature for different query types
	 */
	private getTemperatureForQueryType(queryType: StewardQueryType): number {
		switch (queryType) {
			case StewardQueryType.EXPLANATION:
				return 0.3; // More creativity for explanations
			case StewardQueryType.IMPLEMENTATION:
				return 0.2; // More focused for implementation guidance
			case StewardQueryType.BUG:
				return 0.1; // Very focused for bug hunting
			default:
				return 0.2; // Default temperature
		}
	}

	/**
	 * Extract filenames from context
	 */
	private extractRelevantFilesFromContext(context: string): string[] {
		const fileRegex = /## File: (.+?)\n/g;
		const files: string[] = [];
		let match;

		while ((match = fileRegex.exec(context)) !== null) {
			if (match[1] && !files.includes(match[1])) {
				files.push(match[1]);
			}
		}

		return files;
	}

	/**
	 * Generate detailed analysis for a query
	 */
	private async generateAnalysisForQuery(
		queryText: string,
		queryType: StewardQueryType,
	): Promise<StewardQueryResult['analysis']> {
		const analysis: StewardQueryResult['analysis'] = {
			relevantFiles: [],
		};

		try {
			// Add patterns if relevant to the query type
			if (
				queryType === StewardQueryType.ARCHITECTURE ||
				queryType === StewardQueryType.PATTERN ||
				queryType === StewardQueryType.STANDARD
			) {
				const patterns = await this.getPatterns({confidence: 0.7, limit: 5});
				analysis.patterns = patterns.map(p => ({
					name: p.name,
					description: p.description,
					examples: p.examples,
					confidence: p.confidence,
				}));
			}

			// Add relationships if relevant to the query type
			if (
				queryType === StewardQueryType.ARCHITECTURE ||
				queryType === StewardQueryType.RELATIONSHIP
			) {
				const relationships = await this.getRelationships();
				analysis.relationships = relationships;
			}

			// Get relevant files
			const context = await this.ragService.getContextForCodeQuery(
				queryText,
				this.mapQueryTypeToRagType(queryType),
				2000,
			);

			analysis.relevantFiles = this.extractRelevantFilesFromContext(context);

			return analysis;
		} catch (error) {
			console.error('Error generating analysis:', error);
			return analysis;
		}
	}

	/**
	 * Extract pattern information from LLM response
	 */
	private extractPatternsFromResponse(response: string): CodePattern[] {
		try {
			// First, try to find a JSON block
			const jsonMatch =
				response.match(/```json\n([\s\S]*?)\n```/) ||
				response.match(/```\n([\s\S]*?)\n```/) ||
				response.match(/\{[\s\S]*\}/);

			if (jsonMatch) {
				// Try to parse the JSON
				try {
					const json = JSON.parse(jsonMatch[1] || jsonMatch[0]);

					// If it's an array, treat as array of patterns
					if (Array.isArray(json)) {
						return json.map(p => this.normalizePattern(p));
					}

					// If it has a patterns field, use that
					if (json.patterns && Array.isArray(json.patterns)) {
						return json.patterns.map((p: any) => this.normalizePattern(p));
					}

					// Otherwise, maybe the whole object is a single pattern
					if (json.name && json.description) {
						return [this.normalizePattern(json)];
					}
				} catch (e) {
					console.warn('Failed to parse pattern JSON:', e);
				}
			}

			// Fallback: Use regex to extract pattern information
			const patterns: CodePattern[] = [];
			const patternSections = response.split(
				/(?=#{2,3}\s+Pattern:|Pattern \d+:)/,
			);

			for (const section of patternSections) {
				if (!section.trim()) continue;

				const nameMatch = section.match(
					/(?:#{2,3}\s+Pattern:|Pattern \d+:)\s*(.*?)(?:\n|$)/,
				);
				const name = nameMatch ? nameMatch[1]!.trim() : 'Unnamed Pattern';

				const descMatch = section.match(
					/Description:?\s*(.*?)(?=Examples:|Confidence:|Files:|$)/s,
				);
				const description = descMatch ? descMatch[1]!.trim() : '';

				const examplesMatch = section.match(
					/Examples:?\s*(.*?)(?=Confidence:|Files:|$)/s,
				);
				const examplesText = examplesMatch ? examplesMatch[1]!.trim() : '';
				const examples = examplesText
					.split(/\n(?:-|\d+\.)/)
					.map(e => e.trim())
					.filter(e => e.length > 0);

				const confidenceMatch = section.match(/Confidence:?\s*(0\.\d+|1\.0|1)/);
				const confidence = confidenceMatch
					? parseFloat(confidenceMatch[1]!)
					: 0.7;

				const filesMatch = section.match(/Files:?\s*(.*?)(?=#{2,3}|$)/s);
				const filesText = filesMatch ? filesMatch[1]!.trim() : '';
				const files = filesText
					.split(/\n(?:-|\d+\.)/)
					.map(f => f.trim())
					.filter(f => f.length > 0);

				patterns.push({
					name,
					description,
					examples: examples.length > 0 ? examples : ['No examples provided'],
					confidence,
					files: files.length > 0 ? files : [],
				});
			}

			return patterns.length > 0
				? patterns
				: [
						{
							name: 'No Patterns Detected',
							description: 'No clear patterns were identified in the codebase.',
							examples: [],
							confidence: 0.5,
							files: [],
						},
				  ];
		} catch (error) {
			console.error('Error extracting patterns:', error);
			return [];
		}
	}

	/**
	 * Normalize a pattern object from JSON
	 */
	private normalizePattern(pattern: any): CodePattern {
		return {
			name: pattern.name || 'Unnamed Pattern',
			description: pattern.description || '',
			examples: Array.isArray(pattern.examples)
				? pattern.examples
				: pattern.example
				? [pattern.example]
				: [],
			confidence:
				typeof pattern.confidence === 'number' ? pattern.confidence : 0.7,
			files: Array.isArray(pattern.files)
				? pattern.files
				: pattern.file
				? [pattern.file]
				: [],
		};
	}

	/**
	 * Extract relationships from LLM response
	 */
	private extractRelationshipsFromResponse(response: string): Array<{
		source: string;
		target: string;
		type: string;
		description: string;
	}> {
		try {
			// First, try to find a JSON block
			const jsonMatch =
				response.match(/```json\n([\s\S]*?)\n```/) ||
				response.match(/```\n([\s\S]*?)\n```/) ||
				response.match(/\{[\s\S]*\}/);

			if (jsonMatch) {
				// Try to parse the JSON
				try {
					const json = JSON.parse(jsonMatch[1] || jsonMatch[0]);

					// If it's an array, treat as array of relationships
					if (Array.isArray(json)) {
						return json.map(r => this.normalizeRelationship(r));
					}

					// If it has a relationships field, use that
					if (json.relationships && Array.isArray(json.relationships)) {
						return json.relationships.map((r: any) => this.normalizeRelationship(r));
					}

					// Otherwise, maybe the whole object is a single relationship
					if (json.source && json.target) {
						return [this.normalizeRelationship(json)];
					}
				} catch (e) {
					console.warn('Failed to parse relationship JSON:', e);
				}
			}

			// Fallback: Use regex to extract relationship information
			const relationships: Array<{
				source: string;
				target: string;
				type: string;
				description: string;
			}> = [];

			// Look for relationship sections
			const relSections = response.split(
				/(?=#{2,3}\s+Relationship:|Relationship \d+:)/,
			);

			for (const section of relSections) {
				if (!section.trim()) continue;

				const sourceMatch = section.match(/Source:?\s*(.*?)(?:\n|$)/);
				const source = sourceMatch ? sourceMatch[1]!.trim() : '';

				const targetMatch = section.match(/Target:?\s*(.*?)(?:\n|$)/);
				const target = targetMatch ? targetMatch[1]!.trim() : '';

				const typeMatch = section.match(/Type:?\s*(.*?)(?:\n|$)/);
				const type = typeMatch ? typeMatch[1]!.trim() : 'Undefined';

				const descMatch = section.match(
					/Description:?\s*(.*?)(?=#{2,3}|Source:|$)/s,
				);
				const description = descMatch ? descMatch[1]!.trim() : '';

				if (source && target) {
					relationships.push({
						source,
						target,
						type,
						description,
					});
				}
			}

			return relationships;
		} catch (error) {
			console.error('Error extracting relationships:', error);
			return [];
		}
	}

	/**
	 * Normalize a relationship object from JSON
	 */
	private normalizeRelationship(rel: any): {
		source: string;
		target: string;
		type: string;
		description: string;
	} {
		return {
			source: rel.source || rel.from || '',
			target: rel.target || rel.to || '',
			type: rel.type || rel.relationshipType || 'Undefined',
			description: rel.description || '',
		};
	}

	/**
	 * Extract recommendations from analysis text
	 */
	private extractRecommendationsFromAnalysis(analysisText: string): string[] {
		try {
			// Look for recommendations section
			const recommendationsMatch = analysisText.match(
				/(?:#{2,3}\s*Recommendations|Recommendations:)[\s\S]*?$([\s\S]*?)(?=#{2,3}|$)/im,
			);

			if (recommendationsMatch) {
				// Extract bullet points
				const recommendations = recommendationsMatch[1]!
					.split(/\n(?:-|\d+\.)/)
					.map(r => r.trim())
					.filter(r => r.length > 0);

				return recommendations;
			}

			// If no section is found, look for any bullet points that seem like recommendations
			const recommendationRegex =
				/(?:-|\d+\.)\s*(?:Consider|Implement|Add|Remove|Refactor|Improve|Update|Enhance|Fix|Create|Maintain|Ensure)/g;
			const fullText = analysisText;
			const matches = fullText.match(recommendationRegex);

			if (matches && matches.length > 0) {
				const recommendations = matches.map(m => {
					const lineStart = fullText.indexOf(m);
					const lineEnd = fullText.indexOf('\n', lineStart + 1);
					return fullText
						.substring(lineStart, lineEnd > 0 ? lineEnd : undefined)
						.trim();
				});

				return recommendations;
			}

			return [];
		} catch (error) {
			console.error('Error extracting recommendations:', error);
			return [];
		}
	}

	/**
	 * Extract implementation guidance from LLM response
	 */
	private extractImplementationGuidance(response: string): {
		architecture: string;
		filesToModify: string[];
		newFilesToCreate: string[];
		implementationSteps: string[];
	} {
		try {
			// Initialize result object with typed arrays
			const result: {
				architecture: string;
				filesToModify: string[];
				newFilesToCreate: string[];
				implementationSteps: string[];
			} = {
				architecture: '',
				filesToModify: [],
				newFilesToCreate: [],
				implementationSteps: [],
			};

			// Extract architecture section
			const architectureMatch = response.match(
				/(?:#{2,3}\s*Architecture|High-Level Architecture|Architectural Approach):?[\s\S]*?$([\s\S]*?)(?=#{2,3}|Files to Modify|New Files|$)/im,
			);
			if (architectureMatch && architectureMatch[1]) {
				result.architecture = architectureMatch[1].trim();
			}

			// Extract files to modify
			const filesToModifyMatch = response.match(
				/(?:#{2,3}\s*Files to Modify|Existing Files to Modify|Modified Files):?[\s\S]*?$([\s\S]*?)(?=#{2,3}|New Files|Implementation Steps|$)/im,
			);
			if (filesToModifyMatch && filesToModifyMatch[1]) {
				const filesToModify = filesToModifyMatch[1]
					.split(/\n(?:-|\d+\.)/)
					.map(f => {
						// Try to extract just the file path
						const fileMatch = f.match(/`?([^`\s:]+(?:\.[a-zA-Z]+))`?/);
						return fileMatch ? fileMatch[1]!.trim() : f.trim();
					})
					.filter(f => f.length > 0);
				result.filesToModify = filesToModify;
			}

			// Extract new files to create
			const newFilesMatch = response.match(
				/(?:#{2,3}\s*New Files|Files to Create|New Files to Create):?[\s\S]*?$([\s\S]*?)(?=#{2,3}|Implementation Steps|$)/im,
			);
			if (newFilesMatch && newFilesMatch[1]) {
				const newFiles = newFilesMatch[1]
					.split(/\n(?:-|\d+\.)/)
					.map(f => {
						// Try to extract just the file path
						const fileMatch = f.match(/`?([^`\s:]+(?:\.[a-zA-Z]+))`?/);
						return fileMatch ? fileMatch[1]!.trim() : f.trim();
					})
					.filter(f => f.length > 0);
				result.newFilesToCreate = newFiles;
			}

			// Extract implementation steps
			const stepsMatch = response.match(
				/(?:#{2,3}\s*Implementation Steps|Step-by-Step Implementation|Implementation Plan):?[\s\S]*?$([\s\S]*?)(?=#{2,3}|$)/im,
			);
			if (stepsMatch && stepsMatch[1]) {
				const steps = stepsMatch[1]
					.split(/\n(?:-|\d+\.)/)
					.map(s => s.trim())
					.filter(s => s.length > 0);
				result.implementationSteps = steps;
			}

			return result;
		} catch (error) {
			console.error('Error extracting implementation guidance:', error);
			return {
				architecture: '',
				filesToModify: [],
				newFilesToCreate: [],
				implementationSteps: [],
			};
		}
	}

	/**
	 * Extract standards from LLM response
	 */
	private extractStandards(
		response: string,
		// Category is used for caching but not in the extraction logic
		_category?: string,
	): {
		standards: string;
		examples: Record<string, string[]>;
		violations?: Record<string, string[]>;
	} {
		try {
			// Initialize result
			const result = {
				standards: response,
				examples: {} as Record<string, string[]>,
				violations: {} as Record<string, string[]>,
			};

			// Try to extract standards sections
			const standardSections = response.split(
				/(?=#{2,3}\s+Standard:|Standard \d+:|#{2,3}\s+[A-Z][a-zA-Z\s]+ Standards:)/,
			);

			for (const section of standardSections) {
				if (!section.trim()) continue;

				// Try to get the standard name/title
				const titleMatch = section.match(
					/(?:#{2,3}\s+Standard:|Standard \d+:|#{2,3}\s+([A-Z][a-zA-Z\s]+) Standards:)\s*(.*?)(?:\n|$)/,
				);
				let standardName = titleMatch
					? (titleMatch[2] || titleMatch[1] || '').trim()
					: 'Unnamed Standard';

				// If no name was found, try to use the first line
				if (standardName === 'Unnamed Standard') {
					const lines = section.split('\n');
					if (lines[0] && lines[0].trim()) {
						standardName = lines[0].trim();
					}
				}

				// Extract examples
				const examplesMatch = section.match(
					/(?:Examples|Positive Examples|Good Examples):?\s*([\s\S]*?)(?=Violations|Bad Examples|#{2,3}|$)/i,
				);
				let examples: string[] = [];

				if (examplesMatch && examplesMatch[1]) {
					examples = examplesMatch[1]
						.split(/\n(?:-|\d+\.)/)
						.map(e => e.trim())
						.filter(e => e.length > 0 && e !== 'Examples:');
				}

				// Extract violations
				const violationsMatch = section.match(
					/(?:Violations|Bad Examples):?\s*([\s\S]*?)(?=#{2,3}|$)/i,
				);
				let violations: string[] = [];

				if (violationsMatch && violationsMatch[1]) {
					violations = violationsMatch[1]
						.split(/\n(?:-|\d+\.)/)
						.map(v => v.trim())
						.filter(v => v.length > 0 && v !== 'Violations:');
				}

				// Add to result if we have a title
				if (standardName !== 'Unnamed Standard') {
					result.examples[standardName] = examples;
					if (violations.length > 0) {
						result.violations![standardName] = violations;
					}
				}
			}

			return result;
		} catch (error) {
			console.error('Error extracting standards:', error);
			return {
				standards: response,
				examples: {},
			};
		}
	}
}
