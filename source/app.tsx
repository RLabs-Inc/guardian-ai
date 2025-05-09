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
	const [error, _setError] = useState<string | null>(null);
	const [command, setCommand] = useState<string | undefined>(initialCommand);
	const [args, setArgs] = useState<string[]>(initialArgs);
	const [inputValue, setInputValue] = useState<string>('');
	const {exit} = useApp();

	useInput((input, key) => {
		if (input === 'q') {
			exit();
		}
		if (key.escape) {
			handleEscape();
		}
	});

	// Handle command selection from home screen
	const handleCommandSelect = (selectedCommand: string) => {
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
			return <HomeScreen onSelectCommand={handleCommandSelect} />;
		}

		switch (command.toLowerCase()) {
			case 'init':
				return <InitCommand path={args[0]} options={options} />;
			case 'analyze':
				return <AnalyzeCommand options={options} />;
			case 'ask':
				return args.length > 0 ? (
					<AskCommand question={args.join(' ')} options={options} />
				) : (
					renderInputPrompt('Ask a question about your code:')
				);
			case 'task':
				return args.length > 0 ? (
					<TaskCommand description={args.join(' ')} options={options} />
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
