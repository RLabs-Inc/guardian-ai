// src/screens/home.tsx
import React, {useState, useEffect} from 'react';
import {Box, Spacer} from 'ink';
import SelectInput from 'ink-select-input';
import {Text as ThemedText} from '../components/common/Text.js';
import Spinner from 'ink-spinner';
import path from 'path';
import os from 'os';
// import {useTheme} from '../themes/context.js';

interface HomeScreenProps {
	onSelectCommand: (command: string) => void;
	projectPath?: string;
	isLoading?: boolean;
	loadingMessage?: string;
}

// Define custom item type with description
interface CustomItem {
	label: string;
	value: string;
	description?: string;
}

// Define custom props for item component
interface CustomItemProps {
	isSelected: boolean;
	label: string;
	description?: string;
}

const HomeScreen: React.FC<HomeScreenProps> = ({
	onSelectCommand,
	projectPath,
	isLoading = false,
	loadingMessage = 'Loading...',
}) => {
	// const {currentTheme} = useTheme();
	const [currentTime, setCurrentTime] = useState(new Date());

	// Update time every minute
	useEffect(() => {
		const timer = setInterval(() => {
			setCurrentTime(new Date());
		}, 60000);
		return () => clearInterval(timer);
	}, []);

	const items: CustomItem[] = [
		{
			label: 'Initialize Project',
			value: 'init',
			description: 'Set up a new project with GuardianAI',
		},
		{
			label: 'Analyze Codebase',
			value: 'analyze',
			description: 'Index and analyze the current codebase',
		},
		{
			label: 'Ask a Question',
			value: 'ask',
			description: 'Ask questions about your code',
		},
		{
			label: 'Define a Task',
			value: 'task',
			description: 'Create a coding task for GuardianAI to help with',
		},
	];

	return (
		<Box flexDirection="column" padding={1}>
			{/* Header */}
			<Box marginBottom={1} borderStyle="single" borderColor="green" padding={1}>
				<ThemedText variant="highlight">
					GuardianAI - Codebase Steward
				</ThemedText>
				<Spacer />
				<ThemedText variant="dim">{currentTime.toLocaleTimeString()}</ThemedText>
			</Box>

			{/* Project info if available */}
			{projectPath && (
				<Box marginBottom={1} flexDirection="column">
					<ThemedText variant="highlight">Current Project:</ThemedText>
					<ThemedText>
						{path.basename(projectPath)} ({projectPath})
					</ThemedText>
				</Box>
			)}

			{/* Main welcome message */}
			<Box marginY={1}>
				<ThemedText>
					Welcome to GuardianAI. What would you like to do?
				</ThemedText>
			</Box>

			{/* Loading indicator or menu */}
			{isLoading ? (
				<Box>
					<Box marginRight={1}>
						<ThemedText variant="success">
							<Spinner type="dots" />
						</ThemedText>
					</Box>
					<ThemedText>{loadingMessage}</ThemedText>
				</Box>
			) : (
				<SelectInput
					items={items}
					onSelect={item => onSelectCommand(item.value)}
					itemComponent={(props) => {
						// Cast to our custom props type to access description
						const { isSelected, label } = props;
						const description = (props as unknown as CustomItemProps).description;
						return (
						<Box>
							<ThemedText variant={isSelected ? 'highlight' : 'default'}>
								{label}
							</ThemedText>
							{description && (
								<Box marginLeft={2}>
									<ThemedText variant="dim">
										{description}
									</ThemedText>
								</Box>
							)}
						</Box>
					)}}
				/>
			)}

			{/* Footer with system info */}
			<Box marginTop={1} borderStyle="single" paddingX={1}>
				<ThemedText variant="dim">
					{os.type()} | {os.arch()} | Node {process.version}
				</ThemedText>
			</Box>
		</Box>
	);
};

export default HomeScreen;
