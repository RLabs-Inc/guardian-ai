// source/app.tsx
import React, {useState} from 'react';
import {Box, Text, useApp, useInput} from 'ink';
import TextInput from 'ink-text-input';
import {ThemeProvider} from './themes/context.js';
import {Text as ThemedText} from './components/common/Text.js';
import InitCommand from './commands/init.js';
import AnalyzeCommand from './commands/analyze.js';
import AskCommand from './commands/ask.js';
import TaskCommand from './commands/task.js';
import HomeScreen from './screens/home.js';

interface AppProps {
	command?: string;
	args: string[];
	options: {
		model: string;
		verbose: boolean;
		[key: string]: any;
	};
}

const App: React.FC<AppProps> = ({
	command: initialCommand,
	args: initialArgs,
	options,
}) => {
	const [loading, _setLoading] = useState(false);
	const [error, setError] = useState<string | null>(null);
	const [command, setCommand] = useState<string | undefined>(initialCommand);
	const [args, setArgs] = useState<string[]>(initialArgs);
	const [inputValue, setInputValue] = useState<string>('');
	const [projectDirectory, setProjectDirectory] = useState<string>('');
	const [directoryExclusions, setDirectoryExclusions] = useState<string>('');
	const {exit} = useApp();

	useInput((input, key) => {
		if (input === 'q') {
			exit();
		}
		if (key.escape) {
			handleEscape();
		}
	});

	// Handle command selection from home screen with options
	const handleCommandSelect = (
		selectedCommand: string,
		commandOptions?: any,
	) => {
		// If options were provided, update state and merge with options
		if (commandOptions) {
			// Extract project directory and exclusions if provided
			if (commandOptions.projectPath || projectDirectory) {
				if (commandOptions.projectPath) {
					setProjectDirectory(commandOptions.projectPath);
				} else {
					setProjectDirectory(projectDirectory);
				}
			} else {
				// Show message to select directory first
				setError('Please select the project directory first');
				setTimeout(() => setError(null), 3000); // Clear error after 3 seconds
				return;
			}
			if (commandOptions.exclusions) {
				setDirectoryExclusions(commandOptions.exclusions);
			}
			options = {...options, ...commandOptions};
		}
		// Set command and clear args
		setCommand(selectedCommand);
		setArgs([]);
	};

	// Handle submitting input for ask/task commands
	const handleInputSubmit = (value: string) => {
		if (value.trim().length > 0) {
			setArgs([value]);
		}
	};

	// Command handlers
	const handleCommand = () => {
		if (!command) {
			// No command specified, show home screen
			return (
				<HomeScreen
					onSelectCommand={handleCommandSelect}
					currentDirectory={projectDirectory}
					directoryExclusions={directoryExclusions}
				/>
			);
		}

		// Ensure project directory is in options for all commands
		const commandOptions = {
			...options,
			projectPath: projectDirectory || options['projectPath'],
			exclusions: directoryExclusions || options['exclusions'],
		};

		// If there's an error, show it
		if (error) {
			return (
				<Box flexDirection="column">
					<ThemedText variant="error">{error}</ThemedText>
				</Box>
			);
		}

		switch (command.toLowerCase()) {
			case 'init':
				return (
					<InitCommand
						path={args[0] || projectDirectory}
						options={commandOptions}
					/>
				);
			case 'analyze':
				return <AnalyzeCommand options={commandOptions} />;
			case 'ask':
				return args.length > 0 ? (
					<AskCommand question={args.join(' ')} options={commandOptions} />
				) : (
					renderInputPrompt('Ask a question about your code:')
				);
			case 'task':
				return args.length > 0 ? (
					<TaskCommand description={args.join(' ')} options={commandOptions} />
				) : (
					renderInputPrompt('Define a development task:')
				);
			default:
				return (
					<Box flexDirection="column">
						<ThemedText variant="error">Unknown command: {command}</ThemedText>
						<ThemedText>
							Run 'guardian-ai --help' for available commands.
						</ThemedText>
					</Box>
				);
		}
	};

	// Render input prompt for ask/task commands
	const renderInputPrompt = (promptText: string) => {
		return (
			<Box flexDirection="column" marginY={1}>
				<ThemedText variant="highlight">{promptText}</ThemedText>
				<Box>
					<ThemedText>{'> '}</ThemedText>
					<TextInput
						value={inputValue}
						onChange={setInputValue}
						onSubmit={handleInputSubmit}
					/>
				</Box>
				<ThemedText variant="dim">Type and press Enter</ThemedText>
				<Box marginTop={1}>
					<ThemedText variant="dim">
						(Press Escape to return to menu)
					</ThemedText>
				</Box>
			</Box>
		);
	};

	// Return to home screen when Escape is pressed
	const handleEscape = () => {
		setCommand(undefined);
		setInputValue('');
	};

	return (
		<ThemeProvider>
			<Box flexDirection="column" padding={1}>
				<Box marginBottom={1}>
					<ThemedText variant="highlight">GuardianAI</ThemedText>
					<Text> - AI-powered codebase guardian</Text>
				</Box>

				{error ? (
					<ThemedText variant="error">{error}</ThemedText>
				) : loading ? (
					<ThemedText>Loading...</ThemedText>
				) : (
					handleCommand()
				)}
			</Box>
		</ThemeProvider>
	);
};

export default App;
