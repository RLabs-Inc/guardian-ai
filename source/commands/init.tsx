// source/commands/init.tsx
import React, {useState, useEffect} from 'react';
import {Box} from 'ink';
import Spinner from 'ink-spinner';
import {Text as ThemedText} from '../components/common/Text.js';
import {NodeFileSystemService} from '../services/fileSystem/fileSystemService.js';
import fs from 'fs-extra';

interface InitCommandProps {
	path?: string;
	options: {
		verbose: boolean;
		[key: string]: any;
	};
}

const InitCommand: React.FC<InitCommandProps> = ({path, options}) => {
	const [status, setStatus] = useState<'initializing' | 'success' | 'error'>(
		'initializing',
	);
	const [message, setMessage] = useState<string>('');

	useEffect(() => {
		const initialize = async () => {
			try {
				// Create file system service
				const fileSystem = new NodeFileSystemService();

				// Use current directory if no path provided
				const projectPath = path || process.cwd();

				// Check if directory exists
				const pathExists = await fs.pathExists(projectPath);
				if (!pathExists) {
					throw new Error(`Directory ${projectPath} does not exist.`);
				}

				// Make sure we can list files in the directory
				await fileSystem.listFiles(projectPath, false);

				// Create GuardianAI config file
				await fileSystem.writeFile(
					`${projectPath}/.guardian-ai.json`,
					JSON.stringify(
						{
							initialized: true,
							timestamp: new Date().toISOString(),
							model: options['model'],
						},
						null,
						2,
					),
				);

				setStatus('success');
				setMessage(`GuardianAI initialized in ${projectPath}`);
			} catch (error) {
				setStatus('error');
				setMessage(error instanceof Error ? error.message : String(error));
			}
		};

		initialize();
	}, [path, options]);

	return (
		<Box flexDirection="column">
			{status === 'initializing' && (
				<Box>
					<Spinner />
					<ThemedText> Initializing GuardianAI...</ThemedText>
				</Box>
			)}

			{status === 'success' && (
				<ThemedText variant="success">{message}</ThemedText>
			)}

			{status === 'error' && <ThemedText variant="error">{message}</ThemedText>}
		</Box>
	);
};

export default InitCommand;