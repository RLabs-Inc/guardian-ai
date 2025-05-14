// source/screens/home.tsx
import React, {useState, useEffect} from 'react';
import {Box, Spacer, useInput} from 'ink';
import SelectInput from 'ink-select-input';
import {Text as ThemedText} from '../components/common/Text.js';
import Spinner from 'ink-spinner';
import DirectorySelector from '../components/common/DirectorySelector.js';
import path from 'path';
import os from 'os';
import {useTheme} from '../themes/context.js';
import * as fs from 'fs-extra';

interface HomeScreenProps {
	onSelectCommand: (command: string, options?: any) => void;
	isLoading?: boolean;
	loadingMessage?: string;
	currentDirectory?: string;
	directoryExclusions?: string;
}

// Define custom item type with description
interface CustomItem {
	label: string;
	value: string;
	description?: string;
}

const HomeScreen: React.FC<HomeScreenProps> = ({
	onSelectCommand,
	isLoading = false,
	loadingMessage = 'Loading...',
	currentDirectory = '',
	directoryExclusions = '',
}) => {
	const {currentTheme} = useTheme();
	const [currentTime, setCurrentTime] = useState(new Date());
	const [showDirectorySelector, setShowDirectorySelector] = useState(false);
	const [projectDirectory, setProjectDirectory] = useState<string>(currentDirectory);
	const [exclusions, setExclusions] = useState<string>(directoryExclusions);
	const [hasGuardianIndex, setHasGuardianIndex] = useState(false);
	const [systemInfo] = useState({
		os: os.type(),
		arch: os.arch(),
		node: process.version,
		memory: Math.round(os.totalmem() / (1024 * 1024 * 1024)),
	});

	// Update time every minute
	// This useEffect is actually necessary as it sets up an interval timer
	// that needs to be cleaned up when the component unmounts
	useEffect(() => {
		const timer = setInterval(() => {
			setCurrentTime(new Date());
		}, 60000);
		return () => clearInterval(timer);
	}, []);

	// Check if project directory has Guardian index
	const checkGuardianIndex = async (dirPath: string) => {
		if (dirPath) {
			const indexDir = path.join(dirPath, '.guardian-ai', 'index');
			const exists = await fs.pathExists(indexDir);
			setHasGuardianIndex(exists);
			return exists;
		} else {
			setHasGuardianIndex(false);
			return false;
		}
	};

	// Handle keyboard shortcuts
	useInput((_, key) => {
		if (key.escape && showDirectorySelector) {
			setShowDirectorySelector(false);
		}
	});

	// Handle directory selection
	const handleDirectorySelected = async (selectedDirectory: string, selectedExclusions?: string) => {
		setProjectDirectory(selectedDirectory);
		if (selectedExclusions) {
			setExclusions(selectedExclusions);
		}
		await checkGuardianIndex(selectedDirectory);
		setShowDirectorySelector(false);
	};

	// Handle directory selection cancellation
	const handleDirectorySelectCancel = () => {
		setShowDirectorySelector(false);
	};

	// Handle command selection with project directory
	const handleCommandSelect = (item: {value: string}) => {
		if (item.value === 'select-directory') {
			setShowDirectorySelector(true);
		} else {
			onSelectCommand(item.value, {
				projectPath: projectDirectory,
				exclusions: exclusions
			});
		}
	};

	const items: CustomItem[] = [
		{
			label: projectDirectory ? 'Change Project Directory' : 'Select Project Directory',
			value: 'select-directory',
			description: projectDirectory ? `Current: ${path.basename(projectDirectory)}` : 'Choose a directory to work with',
		},
		{
			label: 'Initialize Project',
			value: 'init',
			description: 'Set up a new project with GuardianAI',
		},
		{
			label: 'Analyze Codebase',
			value: 'analyze',
			description: hasGuardianIndex 
				? 'Update the existing semantic index (incremental)' 
				: 'Create a new semantic index of the codebase',
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

	if (showDirectorySelector) {
		return (
			<DirectorySelector
				initialPath={projectDirectory || process.cwd()}
				initialExclusions={exclusions}
				onSelect={handleDirectorySelected}
				onCancel={handleDirectorySelectCancel}
			/>
		);
	}

	return (
		<Box flexDirection="column" padding={1}>
			{/* Header */}
			<Box 
				marginBottom={1} 
				borderStyle="single" 
				borderColor={currentTheme.colors.primary} 
				padding={1}
			>
				<ThemedText variant="highlight">GuardianAI - Codebase Steward</ThemedText>
				<Spacer />
				<ThemedText variant="dim">{currentTime.toLocaleTimeString()}</ThemedText>
			</Box>

			{/* Project info if available */}
			{projectDirectory && (
				<Box 
					marginBottom={1} 
					flexDirection="column"
					borderStyle="single"
					borderColor={currentTheme.colors.dimText}
					padding={1}
				>
					<ThemedText variant="highlight">Current Project:</ThemedText>
					<Box>
						<ThemedText color={currentTheme.colors.secondary}>
							{path.basename(projectDirectory)}
						</ThemedText>
						<ThemedText variant="dim"> ({projectDirectory})</ThemedText>
					</Box>
					<Box marginTop={1}>
						<ThemedText>Status: </ThemedText>
						{hasGuardianIndex ? (
							<ThemedText color={currentTheme.colors.success}>
								Indexed ✓
							</ThemedText>
						) : (
							<ThemedText color={currentTheme.colors.warning}>
								Not indexed
							</ThemedText>
						)}
					</Box>
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
					onSelect={handleCommandSelect}
					itemComponent={(props) => {
						// Cast to our custom props type to access description
						const { isSelected, label } = props;
						const description = (props as unknown as {description?: string}).description;
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
			<Box 
				marginTop={1} 
				borderStyle="single" 
				borderColor={currentTheme.colors.dimText}
				paddingX={1}
			>
				<ThemedText variant="dim">
					{systemInfo.os} | {systemInfo.arch} | Node {systemInfo.node} | {systemInfo.memory}GB RAM
				</ThemedText>
			</Box>
		</Box>
	);
};

export default HomeScreen;