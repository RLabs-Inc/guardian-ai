import * as path from 'path';
import * as dotenv from 'dotenv';
// LLM service isn't needed for unified indexing
// import {AnthropicService} from './services/llm/llmService.js';
import {NodeFileSystemService} from './services/fileSystem/fileSystemService.js';
// LLMDirectedIndexingService no longer exists after refactor
import {UnifiedIndexingService} from './services/indexing/unifiedIndexingService.js';
import {IndexingCoordinator} from './services/indexing/indexingCoordinator.js';

// Load environment variables
dotenv.config();

// Check for required environment variables
if (!process.env['ANTHROPIC_API_KEY']) {
	console.error('Error: ANTHROPIC_API_KEY environment variable is required');
	process.exit(1);
}

/**
 * Demo script for testing the unified indexing approach
 */
async function runDemo() {
	try {
		console.log('Starting unified indexing demo...');

		// Get the target directory to analyze
		const targetDir = process.argv[2] || '.';
		const absoluteTargetDir = path.resolve(targetDir);

		console.log(`Target directory: ${absoluteTargetDir}`);

		// Create the required services
		const fileSystem = new NodeFileSystemService();
		// LLM service isn't needed for unified indexing
		// const llmService = new AnthropicService();

		// Create the unified indexing service
		const coordinator = new IndexingCoordinator(fileSystem);
		const indexingService = new UnifiedIndexingService(coordinator, fileSystem);

		// Run the indexing process with a small sample size for the demo
		console.log('Starting indexing process...');
		const startTime = Date.now();

		const result = await indexingService.analyzeCodebase(
			absoluteTargetDir,
			{
				batchSize: 50,
				maxDepth: 5
			},
		);

		const indexedCodebase = {
			statistics: {
				totalFiles: result.stats.filesIndexed,
				totalSymbols: result.stats.nodesExtracted,
				totalDependencies: result.stats.dependenciesDiscovered || 0
			},
			symbols: Array.from(result.understanding.codeNodes.entries())
				.map(([id, node]) => ({
					id,
					type: node.type,
					name: node.name,
					location: {
						filePath: node.path,
						startLine: node.location.start.line,
						endLine: node.location.end.line
					}
				}))
		};

		const endTime = Date.now();
		const duration = (endTime - startTime) / 1000; // in seconds

		// Print results
		console.log(
			'\n--- Indexing Results ---',
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
				'\n--- Sample Symbols ---',
			);
			const symbols = indexedCodebase.symbols.slice(0, 5);
			for (const symbol of symbols) {
				console.log(
					`${String(symbol.type)}: ${String(symbol.name)} (${String(symbol.location.filePath)}:${symbol.location.startLine})`,
				);
			}
		}

		// Save understanding to file
		const outputPath = path.join(absoluteTargetDir, '.guardian/emergent/understanding.json');
		await indexingService.saveUnderstanding(result.understanding, outputPath);
		console.log(`Saved understanding to: ${outputPath}`);

	} catch (error) {
		console.error('Error in demo:', error);
		process.exit(1);
	}
}

// Run the demo
runDemo();