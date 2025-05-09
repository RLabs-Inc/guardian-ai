// src/services/llm/openAIService.ts
import {OpenAI} from 'openai';
import {LLMService, LLMRequest, LLMResponse} from './types.js';
import * as dotenv from 'dotenv';

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
		try {
			const {prompt, systemPrompt, options} = request;

			const response = await this.client.chat.completions.create({
				model: options?.model || this.defaultModel,
				max_tokens: options?.maxTokens || 1024,
				temperature: options?.temperature || 0.7,
				messages: [
					{
						role: 'system',
						content: systemPrompt || 'You are a helpful AI assistant.',
					},
					{role: 'user', content: prompt},
				],
			});

			const responseText = response.choices[0]?.message?.content || '';

			return {
				text: responseText,
				usage: {
					promptTokens: response.usage?.prompt_tokens || 0,
					completionTokens: response.usage?.completion_tokens || 0,
					totalTokens: response.usage?.total_tokens || 0,
				},
			};
		} catch (error: unknown) {
			throw new Error(`LLM request failed: ${this.getErrorMessage(error)}`);
		}
	}

	async generateEmbeddings(text: string): Promise<number[]> {
		try {
			// Truncate text if it's too long
			const truncatedText = text.length > 8000 ? text.substring(0, 8000) : text;

			const response = await this.client.embeddings.create({
				model: this.defaultEmbeddingModel,
				input: truncatedText,
			});

			const data = response.data;
			if (!data || data.length === 0) {
				throw new Error('No embedding data returned from API');
			}

			return data[0]!.embedding;
		} catch (error: unknown) {
			throw new Error(
				`Embedding generation failed: ${this.getErrorMessage(error)}`,
			);
		}
	}

	async getAvailableModels(): Promise<string[]> {
		try {
			const response = await this.client.models.list();
			return response.data
				.filter(
					model =>
						model.id.startsWith('gpt-') || model.id.includes('embedding'),
				)
				.map(model => model.id);
		} catch (error: unknown) {
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
		try {
			const {prompt, systemPrompt, options} = request;

			const stream = await this.client.chat.completions.create({
				model: options?.model || this.defaultModel,
				max_tokens: options?.maxTokens || 1024,
				temperature: options?.temperature || 0.7,
				messages: [
					{
						role: 'system',
						content: systemPrompt || 'You are a helpful AI assistant.',
					},
					{role: 'user', content: prompt},
				],
				stream: true,
			});

			let fullText = '';
			let usage = {
				promptTokens: 0,
				completionTokens: 0,
				totalTokens: 0,
			};

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
			}

			return {
				text: fullText,
				usage,
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
