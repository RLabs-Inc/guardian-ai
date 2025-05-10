import * as path from 'path';
import * as dotenv from 'dotenv';
import {AnthropicService} from './services/llm/llmService.js';
import {NodeFileSystemService} from './services/fileSystem/fileSystemService.js';
import {LLMDirectedIndexingService} from './services/indexing/llmDirected/llmDirectedIndexingService.js';

// Load environment variables
dotenv.config();

// Check for required environment variables
if (!process.env['ANTHROPIC_API_KEY']) {
	console.error('Error: ANTHROPIC_API_KEY environment variable is required');
	process.exit(1);
}

/**
 * Demo script for testing the LLM-directed indexing approach
 */
async function runDemo() {
	try {
		console.log('Starting LLM-directed indexing demo...');

		// Get the target directory to analyze
		const targetDir = process.argv[2] || '.';
		const absoluteTargetDir = path.resolve(targetDir);

		console.log(`Target directory: ${absoluteTargetDir}`);

		// Create the required services
		const fileSystem = new NodeFileSystemService();
		const llmService = new AnthropicService();

		// Create the LLM-directed indexing service
		const indexingService = new LLMDirectedIndexingService(
			fileSystem,
			llmService,
		);

		// Run the indexing process with a small sample size for the demo
		console.log('Starting indexing process...');
		const startTime = Date.now();

		const indexedCodebase = await indexingService.indexCodebase(
			absoluteTargetDir,
			{
				maxFiles: 5, // Limit to 5 files for the demo
			},
		);

		const endTime = Date.now();
		const duration = (endTime - startTime) / 1000; // in seconds

		// Print results
		console.log(
			'\
--- Indexing Results ---',
		);
		console.log(`Files indexed: ${indexedCodebase.statistics.totalFiles}`);
		console.log(
			`Symbols extracted: ${indexedCodebase.statistics.totalSymbols}`,
		);
		console.log(
			`Dependencies mapped: ${indexedCodebase.statistics.totalDependencies}`,
		);
		console.log(`Time taken: ${duration.toFixed(2)} seconds`);

		// Print some sample symbols if available
		if (indexedCodebase.statistics.totalSymbols > 0) {
			console.log(
				'\
--- Sample Symbols ---',
			);
			const symbols = Object.values(indexedCodebase.symbols).slice(0, 5);
			for (const symbol of symbols) {
				console.log(
					`${symbol.type}: ${symbol.name} (${symbol.location.filePath}:${symbol.location.startLine})`,
				);
			}
		}

		// Print some sample dependencies if available
		if (indexedCodebase.statistics.totalDependencies > 0) {
			console.log(
				'\
--- Sample Dependencies ---',
			);
			const dependencies = indexedCodebase.dependencies.slice(0, 5);
			for (const dependency of dependencies) {
				console.log(
					`${dependency.source} -> ${dependency.target} (${dependency.type})`,
				);
			}
		}

		console.log(
			'\
Demo completed successfully!',
		);
	} catch (error) {
		console.error('Error running demo:', error);
		process.exit(1);
	}
}

// Run the demo
runDemo();
