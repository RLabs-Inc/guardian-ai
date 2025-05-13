// source/components/common/DirectorySelector.tsx
import React, {useState} from 'react';
import {Box, useInput} from 'ink';
import SelectInput from 'ink-select-input';
import {Text as ThemedText} from './Text.js';
import * as path from 'path';
import fs from 'fs-extra';
import os from 'os';
import {useTheme} from '../../themes/context.js';

interface DirectoryItem {
	label: string;
	value: string;
	isDirectory: boolean;
}

interface DirectorySelectorProps {
	initialPath?: string;
	onSelect: (directoryPath: string) => void;
	onCancel?: () => void;
}

export const DirectorySelector: React.FC<DirectorySelectorProps> = ({
	initialPath = process.cwd(),
	onSelect,
	onCancel,
}) => {
	const {currentTheme} = useTheme();
	const [currentPath, setCurrentPath] = useState<string>(initialPath);
	const [items, setItems] = useState<DirectoryItem[]>([]);
	const [error, setError] = useState<string | null>(null);
	const [isLoading, setIsLoading] = useState<boolean>(false);

	const loadDirectory = async (selectedPath: string) => {
		try {
			setIsLoading(true);
			setCurrentPath(selectedPath);
			setError(null);

			// Check if directory exists
			const exists = await fs.pathExists(selectedPath);
			if (!exists) {
				setError(`Directory does not exist: ${selectedPath}`);
				setIsLoading(false);
				return;
			}

			// Read directory contents
			const entries = await fs.readdir(selectedPath, {withFileTypes: true});

			// Create special items for navigation
			const navigationItems: DirectoryItem[] = [
				{
					label: '[Select Current Directory]',
					value: '_select_current_',
					isDirectory: false,
				},
				{
					label: '[Up One Level]',
					value: '_up_',
					isDirectory: false,
				},
				{
					label: '[Home Directory]',
					value: '_home_',
					isDirectory: false,
				},
			];

			// Create items for directories (exclude files and hidden directories)
			const directoryItems = entries
				.filter(entry => entry.isDirectory() && !entry.name.startsWith('.'))
				.map(entry => ({
					label: entry.name,
					value: path.join(selectedPath, entry.name),
					isDirectory: true,
				}))
				.sort((a, b) => a.label.localeCompare(b.label));

			// Combine navigation and directory items
			setItems([...navigationItems, ...directoryItems]);
			setIsLoading(false);
		} catch (error) {
			console.error('Error loading directory:', error);
			setError(
				`Failed to load directory: ${
					error instanceof Error ? error.message : String(error)
				}`,
			);
			setIsLoading(false);
		}
	};

	// Load initial directory when component mounts
	// We call this directly in the component body instead of using useEffect
	// to follow React best practices
	if (!isLoading && items.length === 0) {
		loadDirectory(initialPath);
	}

	// Handle input for keyboard shortcuts
	useInput((_input, key) => {
		if (key.escape && onCancel) {
			// Exit directory selection mode
			onCancel();
		}
	});

	const handleSelect = (item: {value: string}) => {
		if (item.value === '_select_current_') {
			// Select the current directory
			onSelect(currentPath);
		} else if (item.value === '_up_') {
			// Go up one level
			const parentDir = path.dirname(currentPath);
			if (parentDir !== currentPath) {
				loadDirectory(parentDir);
			}
		} else if (item.value === '_home_') {
			// Go to home directory
			loadDirectory(os.homedir());
		} else {
			// Navigate to selected directory
			loadDirectory(item.value);
		}
	};

	return (
		<Box flexDirection="column">
			<Box
				marginBottom={1}
				borderStyle="single"
				borderColor={currentTheme.colors.primary}
				padding={1}
			>
				<ThemedText variant="highlight">Select Project Directory</ThemedText>
			</Box>

			<Box marginBottom={1}>
				<ThemedText>Current path: </ThemedText>
				<ThemedText color={currentTheme.colors.secondary}>
					{currentPath}
				</ThemedText>
			</Box>

			{error ? (
				<ThemedText variant="error">{error}</ThemedText>
			) : isLoading ? (
				<ThemedText>Loading directory contents...</ThemedText>
			) : (
				<Box flexDirection="column">
					<SelectInput
						items={items}
						onSelect={handleSelect}
						itemComponent={({isSelected, label}) => {
							// Find the item to determine if it's a directory
							const item = items.find(i => i.label === label);
							const isDir = item?.isDirectory;

							return (
								<Box>
									<ThemedText
										variant={isSelected ? 'highlight' : 'default'}
										color={isDir ? currentTheme.colors.info : undefined}
										bold={isSelected}
									>
										{isDir ? `📁 ${label}` : label}
									</ThemedText>
								</Box>
							);
						}}
					/>

					<Box
						marginTop={1}
						borderStyle="single"
						borderColor={currentTheme.colors.dimText}
						padding={1}
					>
						<ThemedText variant="dim">
							(Use arrow keys to navigate, Enter to select, Esc to cancel)
						</ThemedText>
					</Box>
				</Box>
			)}
		</Box>
	);
};

export default DirectorySelector;
