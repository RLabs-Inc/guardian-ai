// src/services/llm/llmService.ts
import Anthropic from '@anthropic-ai/sdk';
import {LLMService, LLMRequest, LLMResponse} from './types.js';
import * as dotenv from 'dotenv';
import { getMemoryMonitor } from '../utils/memoryMonitor.js';

// Load environment variables
dotenv.config();

export class AnthropicService implements LLMService {
	private client: Anthropic;
	private defaultModel = 'claude-3-7-sonnet-latest'; // Using the latest model

	constructor() {
		const apiKey = process.env['ANTHROPIC_API_KEY'];

		if (!apiKey) {
			throw new Error('ANTHROPIC_API_KEY environment variable is required');
		}

		this.client = new Anthropic({
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

			memoryMonitor.logMemoryUsage('llm_request_start', {
				model: request.options?.model || this.defaultModel,
				promptLength,
				systemPromptLength,
				maxTokens: request.options?.maxTokens || 64000
			});

			const {prompt, systemPrompt, options} = request;

			// Create a memory-efficient request
			const apiRequest = {
				model: options?.model || this.defaultModel,
				max_tokens: options?.maxTokens || 64000,
				temperature: options?.temperature || 0.7,
				system: systemPrompt || 'You are a helpful AI assistant.',
				messages: [{role: 'user' as const, content: prompt}],
			};

			// Call the API
			const response = await this.client.messages.create(apiRequest);

			memoryMonitor.logMemoryUsage('llm_response_received');

			// First, check if there is content and it's a text block
			const firstContent = response.content[0];
			const responseText =
				firstContent && firstContent.type === 'text' ? firstContent.text : '';

			// Create the response object
			const result = {
				text: responseText,
				usage: {
					promptTokens: response.usage.input_tokens,
					completionTokens: response.usage.output_tokens,
					totalTokens:
						response.usage.input_tokens + response.usage.output_tokens,
				},
			};

			// Aggressively clear references to large objects
			// @ts-ignore - This is intentional to help with memory cleanup
			response.content = null;
			// @ts-ignore - This is intentional to help with memory cleanup
			response.stop_reason = null;
			// @ts-ignore - This is intentional to help with memory cleanup
			response.usage = null;
			// @ts-ignore - This is intentional to help with memory cleanup
			response.id = null;
			// @ts-ignore - This is intentional to help with memory cleanup
			response.model = null;
			// @ts-ignore - This is intentional to help with memory cleanup
			response = null;

			memoryMonitor.logMemoryUsage('llm_request_complete', {
				responseLength: responseText.length,
				totalTokens: result.usage.totalTokens
			});

			// Force garbage collection after processing large responses
			memoryMonitor.forceGC();

			return result;
		} catch (error: unknown) {
			memoryMonitor.logMemoryUsage('llm_request_error', {
				errorType: error instanceof Error ? error.constructor.name : 'Unknown',
				message: error instanceof Error ? error.message : String(error)
			});

			throw new Error(`LLM request failed: ${this.getErrorMessage(error)}`);
		}
	}

	async generateEmbeddings(text: string): Promise<number[]> {
		// Anthropic doesn't directly provide embeddings
		// We'll need to implement this with another provider (e.g., OpenAI)
		throw new Error(
			`Embedding generation not implemented with Anthropic ${text}`,
		);
	}

	async getAvailableModels(): Promise<string[]> {
		// Latest available models as of latest check
		return [
			'claude-3-7-sonnet-20250219', // The latest Claude 3.7 Sonnet snapshot
			'claude-3-7-sonnet-latest', // Always points to the latest 3.7 Sonnet
			'claude-3-5-sonnet-20240620', // The Claude 3.5 Sonnet snapshot
			'claude-3-5-sonnet-latest', // Always points to the latest 3.5 Sonnet
			'claude-3-opus-20240229', // Claude 3 Opus snapshot
			'claude-3-sonnet-20240229', // Claude 3 Sonnet snapshot
			'claude-3-haiku-20240307', // Claude 3 Haiku snapshot
		];
	}

	// Add a streaming method for real-time responses
	async streamComplete(
		request: LLMRequest,
		onText: (text: string) => void,
	): Promise<LLMResponse> {
		const memoryMonitor = getMemoryMonitor();

		try {
			// Record memory usage at start
			const promptLength = request.prompt ? request.prompt.length : 0;
			const systemPromptLength = request.systemPrompt ? request.systemPrompt.length : 0;

			memoryMonitor.logMemoryUsage('llm_stream_request_start', {
				model: request.options?.model || this.defaultModel,
				promptLength,
				systemPromptLength,
				maxTokens: request.options?.maxTokens || 64000
			});

			const {prompt, systemPrompt, options} = request;

			// Create a memory-efficient request
			const stream = this.client.messages.stream({
				model: options?.model || this.defaultModel,
				max_tokens: options?.maxTokens || 64000,
				temperature: options?.temperature || 0.7,
				system: systemPrompt || 'You are a helpful AI assistant.',
				messages: [{role: 'user' as const, content: prompt}],
			});

			memoryMonitor.logMemoryUsage('llm_stream_created');

			// Set up memory-optimized event handler for streaming
			let totalTextLength = 0;
			const wrappedOnText = (text: string) => {
				totalTextLength += text.length;
				// Call the original handler
				onText(text);

				// Periodically log memory usage on long generations
				if (totalTextLength % 10000 === 0) {
					memoryMonitor.logMemoryUsage('llm_stream_progress', {
						totalTextLength
					});
				}
			};

			stream.on('text', wrappedOnText);

			// Wait for final message
			const message = await stream.finalMessage();

			memoryMonitor.logMemoryUsage('llm_stream_completed', {
				totalTextLength
			});

			// First, check if there is content and it's a text block
			const firstContent = message.content[0];
			const responseText =
				firstContent && firstContent.type === 'text' ? firstContent.text : '';
				
			// Create response object
			const result = {
				text: responseText,
				usage: {
					promptTokens: message.usage?.input_tokens || 0,
					completionTokens: message.usage?.output_tokens || 0,
					totalTokens:
						(message.usage?.input_tokens || 0) +
						(message.usage?.output_tokens || 0),
				},
			};
			
			// Clean up large objects - helps with memory management
			// @ts-ignore - This is intentional to help with memory cleanup
			message.content = null;
			
			// Try to clean up stream resources
			try {
				// @ts-ignore - This is intentional to help with memory cleanup
				stream.controller.abort();
			} catch (abortError) {
				// Ignore abort errors, just trying to free resources
			}
			
			memoryMonitor.logMemoryUsage('llm_stream_cleanup_complete');
			
			return result;
		} catch (error: unknown) {
			memoryMonitor.logMemoryUsage('llm_stream_error', {
				errorType: error instanceof Error ? error.constructor.name : 'Unknown',
				message: error instanceof Error ? error.message : String(error)
			});
			
			throw new Error(
				`LLM streaming request failed: ${this.getErrorMessage(error)}`,
			);
		} finally {
			// Try to run garbage collection at the end
			memoryMonitor.forceGC();
		}
	}

	private getErrorMessage(error: unknown): string {
		if (error instanceof Error) {
			return error.message;
		}
		return String(error);
	}
}