// src/services/llm/types.ts
export interface ModelOptions {
	model?: string;
	temperature?: number;
	maxTokens?: number;
	topP?: number;
	stop?: string[];
}

export interface LLMRequest {
	prompt: string;
	systemPrompt?: string;
	options?: ModelOptions;
}

export interface LLMResponse {
	text: string;
	usage?: {
		promptTokens: number;
		completionTokens: number;
		totalTokens: number;
	};
}

export interface LLMService {
	/**
	 * Sends a request to the LLM and returns the generated response
	 */
	complete(request: LLMRequest): Promise<LLMResponse>;

	/**
	 * Generates text embeddings for a given text
	 */
	generateEmbeddings(text: string): Promise<number[]>;

	/**
	 * Returns information about available models
	 */
	getAvailableModels(): Promise<string[]>;
}
