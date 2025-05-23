// src/services/llm/openAIService.ts
import {OpenAI} from 'openai';
import {LLMService, LLMRequest, LLMResponse} from './types.js';
import * as dotenv from 'dotenv';
import { getMemoryMonitor } from '../utils/memoryMonitor.js';

// Load environment variables
dotenv.config();

export class OpenAIService implements LLMService {
	private client: OpenAI;
	private defaultModel = 'gpt-4o';
	private defaultEmbeddingModel = 'text-embedding-3-small';

	constructor() {
		const apiKey = process.env['OPENAI_API_KEY'];

		if (!apiKey) {
			throw new Error('OPENAI_API_KEY environment variable is required');
		}

		this.client = new OpenAI({
			apiKey,
		});
	}

	async complete(request: LLMRequest): Promise<LLMResponse> {
		const memoryMonitor = getMemoryMonitor();

		try {
			// Force GC at the start to reclaim memory from previous operations
			memoryMonitor.forceGC();

			// Record memory usage at start
			const promptLength = request.prompt ? request.prompt.length : 0;
			const systemPromptLength = request.systemPrompt ? request.systemPrompt.length : 0;

			memoryMonitor.logMemoryUsage('openai_request_start', {
				model: request.options?.model || this.defaultModel,
				promptLength,
				systemPromptLength,
				maxTokens: request.options?.maxTokens || 1024
			});

			// Use local variables to avoid holding references
			const model = request.options?.model || this.defaultModel;
			const maxTokens = request.options?.maxTokens || 1024;
			const temperature = request.options?.temperature || 0.7;
			const system = request.systemPrompt || 'You are a helpful AI assistant.';

			// Store prompt in local variable so we can clear request
			const userPrompt = request.prompt;

			// Clear request fields to free memory
			if (request.prompt && request.prompt.length > 5000) {
				// @ts-ignore - This is intentional to help with memory cleanup
				(request as any).prompt = undefined;
			}

			// Create a memory-efficient request
			const apiRequest = {
				model,
				max_tokens: maxTokens,
				temperature,
				messages: [
					{
						role: 'system' as const,
						content: system,
					},
					{role: 'user' as const, content: userPrompt},
				],
			};

			// Call the API
			const response = await this.client.chat.completions.create(apiRequest);

			memoryMonitor.logMemoryUsage('openai_response_received');

			// Extract response text immediately
			const responseText = response.choices[0]?.message?.content || '';

			// Copy usage values to local variables
			const promptTokens = response.usage?.prompt_tokens || 0;
			const completionTokens = response.usage?.completion_tokens || 0;
			const totalTokens = response.usage?.total_tokens || 0;

			// Create result object
			const result = {
				text: responseText,
				usage: {
					promptTokens,
					completionTokens,
					totalTokens,
				},
			};

			// Aggressively clear references to large objects
			if (response) {
				// Use type assertions to avoid TypeScript errors
				// @ts-ignore - This is intentional to help with memory cleanup
				(response as any).choices = undefined;
				// @ts-ignore - This is intentional to help with memory cleanup
				(response as any).usage = undefined;
				// @ts-ignore - This is intentional to help with memory cleanup
				(response as any).system_fingerprint = undefined;
				// @ts-ignore - This is intentional to help with memory cleanup
				(response as any).id = undefined;
				// @ts-ignore - This is intentional to help with memory cleanup
				(response as any).model = undefined;
				// @ts-ignore - This is intentional to help with memory cleanup
				(response as any).object = undefined;
			}

			memoryMonitor.logMemoryUsage('openai_request_complete', {
				responseLength: responseText.length,
				totalTokens: result.usage.totalTokens
			});

			// Force GC after processing large response
			memoryMonitor.forceGC();

			return result;
		} catch (error: unknown) {
			memoryMonitor.logMemoryUsage('openai_request_error', {
				errorType: error instanceof Error ? error.constructor.name : 'Unknown',
				message: error instanceof Error ? error.message : String(error)
			});

			throw new Error(`LLM request failed: ${this.getErrorMessage(error)}`);
		}
	}

	async generateEmbeddings(text: string): Promise<number[]> {
		const memoryMonitor = getMemoryMonitor();

		try {
			// Record memory usage at start
			memoryMonitor.logMemoryUsage('openai_embedding_start', {
				textLength: text.length,
				model: this.defaultEmbeddingModel
			});

			// Truncate text if it's too long - reduces API costs and memory usage
			const truncatedText = text.length > 8000 ? text.substring(0, 8000) : text;

			// Make sure overly long strings are freed from memory
			if (text.length > 10000) {
				// Remove reference to the original text to help garbage collection
				text = '';
			}

			// API request
			const response = await this.client.embeddings.create({
				model: this.defaultEmbeddingModel,
				input: truncatedText,
			});

			memoryMonitor.logMemoryUsage('openai_embedding_response_received');

			const data = response.data;
			if (!data || data.length === 0) {
				throw new Error('No embedding data returned from API');
			}

			// Get the embedding vector
			const embedding = data[0]!.embedding;

			// Clear references to free memory
			if (response) {
				// @ts-ignore - This is intentional to help with memory cleanup
				(response as any).data = undefined;
			}

			memoryMonitor.logMemoryUsage('openai_embedding_complete', {
				embeddingDimensions: embedding.length,
				truncatedTextLength: truncatedText.length
			});

			// Check if memory usage is high and force GC if needed
			const snapshot = memoryMonitor.getLatestSnapshot();
			if (snapshot && snapshot.usage.heapUsed > 500 * 1024 * 1024) { // 500MB threshold
				memoryMonitor.forceGC();
			}

			return embedding;
		} catch (error: unknown) {
			memoryMonitor.logMemoryUsage('openai_embedding_error', {
				errorType: error instanceof Error ? error.constructor.name : 'Unknown',
				message: error instanceof Error ? error.message : String(error)
			});

			throw new Error(
				`Embedding generation failed: ${this.getErrorMessage(error)}`,
			);
		}
	}

	async getAvailableModels(): Promise<string[]> {
		const memoryMonitor = getMemoryMonitor();

		try {
			memoryMonitor.logMemoryUsage('openai_get_models_start');

			const response = await this.client.models.list();

			// Extract just the model IDs to reduce memory usage
			const filteredModelIds = response.data
				.filter(
					model =>
						model.id.startsWith('gpt-') || model.id.includes('embedding'),
				)
				.map(model => model.id);

			// Clear response data to free memory
			if (response) {
				// @ts-ignore - This is intentional to help with memory cleanup
				(response as any).data = undefined;
			}

			memoryMonitor.logMemoryUsage('openai_get_models_complete', {
				modelCount: filteredModelIds.length
			});

			return filteredModelIds;
		} catch (error: unknown) {
			memoryMonitor.logMemoryUsage('openai_get_models_error');

			console.error(
				`Failed to retrieve models: ${this.getErrorMessage(error)}`,
			);
			// Return a default list of models if API call fails
			return [
				'gpt-4o',
				'gpt-4-turbo',
				'gpt-4',
				'gpt-3.5-turbo',
				'text-embedding-3-small',
				'text-embedding-3-large',
			];
		}
	}

	async streamComplete(
		request: LLMRequest,
		onText: (text: string) => void,
	): Promise<LLMResponse> {
		const memoryMonitor = getMemoryMonitor();

		try {
			// Force GC at the start to reclaim memory from previous operations
			memoryMonitor.forceGC();

			// Record memory usage at start
			const promptLength = request.prompt ? request.prompt.length : 0;
			const systemPromptLength = request.systemPrompt ? request.systemPrompt.length : 0;

			memoryMonitor.logMemoryUsage('openai_stream_request_start', {
				model: request.options?.model || this.defaultModel,
				promptLength,
				systemPromptLength,
				maxTokens: request.options?.maxTokens || 1024
			});

			// Use local variables to avoid holding references
			const model = request.options?.model || this.defaultModel;
			const maxTokens = request.options?.maxTokens || 1024;
			const temperature = request.options?.temperature || 0.7;
			const system = request.systemPrompt || 'You are a helpful AI assistant.';

			// Store prompt in local variable so we can clear request
			const userPrompt = request.prompt;

			// Clear request fields to free memory for long prompts
			if (request.prompt && request.prompt.length > 5000) {
				// @ts-ignore - This is intentional to help with memory cleanup
				(request as any).prompt = undefined;
			}

			const stream = await this.client.chat.completions.create({
				model,
				max_tokens: maxTokens,
				temperature,
				messages: [
					{
						role: 'system' as const,
						content: system,
					},
					{role: 'user' as const, content: userPrompt},
				],
				stream: true,
			});

			memoryMonitor.logMemoryUsage('openai_stream_started');

			let fullText = '';
			let usage = {
				promptTokens: 0,
				completionTokens: 0,
				totalTokens: 0,
			};

			// Track frequency of memory logging to avoid excessive logging
			let chunkCounter = 0;
			const logFrequency = 10; // Increased frequency: Log memory every 10 chunks

			for await (const chunk of stream) {
				const content = chunk.choices[0]?.delta?.content || '';
				if (content) {
					fullText += content;
					onText(content);
				}

				// Update usage if available in the chunk
				if (chunk.usage) {
					usage = {
						promptTokens: chunk.usage.prompt_tokens || 0,
						completionTokens: chunk.usage.completion_tokens || 0,
						totalTokens: chunk.usage.total_tokens || 0,
					};
				}

				// Log memory usage more frequently during streaming
				if (++chunkCounter % logFrequency === 0) {
					memoryMonitor.logMemoryUsage('openai_stream_chunk_processed', {
						chunkCount: chunkCounter,
						currentTextLength: fullText.length
					});

					// Clear chunk objects aggressively to help with GC
					if (chunk) {
						// @ts-ignore - This is intentional to help with memory cleanup
						(chunk as any).choices = undefined;
						// @ts-ignore - This is intentional to help with memory cleanup
						(chunk as any).id = undefined;
						// @ts-ignore - This is intentional to help with memory cleanup
						(chunk as any).model = undefined;
						// @ts-ignore - This is intentional to help with memory cleanup
						(chunk as any).object = undefined;
						// @ts-ignore - This is intentional to help with memory cleanup
						(chunk as any).created = undefined;
					}

					// Run GC more frequently for long generations
					if (chunkCounter % 50 === 0) {
						memoryMonitor.forceGC();
					}
				}
			}

			// Try to clean up stream resources
			try {
				if (stream && typeof stream.controller !== 'undefined' && stream.controller) {
					stream.controller.abort();
				}
				// DO NOT attempt to set stream = null as it's a const
			} catch (abortError) {
				// Ignore abort errors, just trying to free resources
			}

			memoryMonitor.logMemoryUsage('openai_stream_request_complete', {
				responseLength: fullText.length,
				totalChunks: chunkCounter
			});

			// Force GC after processing stream
			memoryMonitor.forceGC();

			return {
				text: fullText,
				usage,
			};
		} catch (error: unknown) {
			memoryMonitor.logMemoryUsage('openai_stream_request_error', {
				errorType: error instanceof Error ? error.constructor.name : 'Unknown',
				message: error instanceof Error ? error.message : String(error)
			});

			throw new Error(
				`LLM streaming request failed: ${this.getErrorMessage(error)}`,
			);
		}
	}

	private getErrorMessage(error: unknown): string {
		if (error instanceof Error) {
			return error.message;
		}
		return String(error);
	}
}