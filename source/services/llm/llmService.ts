// src/services/llm/llmService.ts
import Anthropic from '@anthropic-ai/sdk';
import {LLMService, LLMRequest, LLMResponse} from './types.js';
import * as dotenv from 'dotenv';

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
		try {
			const {prompt, systemPrompt, options} = request;

			const response = await this.client.messages.create({
				model: options?.model || this.defaultModel,
				max_tokens: options?.maxTokens || 64000,
				temperature: options?.temperature || 0.7,
				system: systemPrompt || 'You are a helpful AI assistant.',
				messages: [{role: 'user', content: prompt}],
			});

			// First, check if there is content and it's a text block
			const firstContent = response.content[0];
			const responseText =
				firstContent && firstContent.type === 'text' ? firstContent.text : '';

			return {
				text: responseText,
				usage: {
					promptTokens: response.usage.input_tokens,
					completionTokens: response.usage.output_tokens,
					totalTokens:
						response.usage.input_tokens + response.usage.output_tokens,
				},
			};
		} catch (error: unknown) {
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
		try {
			const {prompt, systemPrompt, options} = request;

			const stream = this.client.messages.stream({
				model: options?.model || this.defaultModel,
				max_tokens: options?.maxTokens || 64000,
				temperature: options?.temperature || 0.7,
				system: systemPrompt || 'You are a helpful AI assistant.',
				messages: [{role: 'user', content: prompt}],
			});

			// Set up event handler for streaming
			stream.on('text', onText);

			// Wait for final message
			const message = await stream.finalMessage();

			// First, check if there is content and it's a text block
			const firstContent = message.content[0];
			const responseText =
				firstContent && firstContent.type === 'text' ? firstContent.text : '';

			return {
				text: responseText,
				usage: {
					promptTokens: message.usage?.input_tokens || 0,
					completionTokens: message.usage?.output_tokens || 0,
					totalTokens:
						(message.usage?.input_tokens || 0) +
						(message.usage?.output_tokens || 0),
				},
			};
		} catch (error: unknown) {
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
