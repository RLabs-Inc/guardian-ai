// source/services/fileSystem/fileSystemService.ts
import fs from 'fs-extra';
import * as path from 'path';
import {simpleGit, SimpleGit} from 'simple-git';
import {
	FileSystemService,
	FileInfo,
	FileContent,
	FileSystemFilter,
	GitCommit,
	ProjectInfo,
} from './types.js';

export class NodeFileSystemService implements FileSystemService {
	private git: SimpleGit;

	constructor() {
		this.git = simpleGit();
	}

	private getErrorMessage(error: unknown): string {
		if (error instanceof Error) {
			return error.message;
		}
		return String(error);
	}

	/**
	 * Reads the contents of a directory
	 */
	async readDirectory(path: string): Promise<string[]> {
		try {
			return await fs.readdir(path);
		} catch (error) {
			throw new Error(
				`Failed to read directory ${path}: ${this.getErrorMessage(error)}`,
			);
		}
	}

	/**
	 * Gets information about a file or directory
	 */
	async stat(path: string): Promise<{ isDirectory: boolean; size: number; created: Date; modified: Date; }> {
		try {
			const stats = await fs.stat(path);
			return {
				isDirectory: stats.isDirectory(),
				size: stats.size,
				created: stats.birthtime,
				modified: stats.mtime
			};
		} catch (error) {
			throw new Error(
				`Failed to get stats for ${path}: ${this.getErrorMessage(error)}`,
			);
		}
	}

	async readFile(filePath: string): Promise<FileContent> {
		try {
			const content = await fs.readFile(filePath, 'utf8');
			const stats = await fs.stat(filePath);

			const info: FileInfo = {
				path: filePath,
				name: path.basename(filePath),
				extension: path.extname(filePath),
				size: stats.size,
				created: stats.birthtime,
				modified: stats.mtime,
				isDirectory: stats.isDirectory(),
			};

			return {
				content,
				info,
			};
		} catch (error) {
			throw new Error(
				`Failed to read file ${filePath}: ${this.getErrorMessage(error)}`,
			);
		}
	}

	async writeFile(filePath: string, content: string): Promise<void> {
		try {
			// Ensure directory exists
			await fs.ensureDir(path.dirname(filePath));
			await fs.writeFile(filePath, content, 'utf8');
		} catch (error) {
			throw new Error(
				`Failed to write file ${filePath}: ${this.getErrorMessage(error)}`,
			);
		}
	}

	async listFiles(
		directoryPath: string,
		recursive = false,
		filter?: FileSystemFilter,
	): Promise<FileInfo[]> {
		try {
			const allFiles: FileInfo[] = [];

			// Read directory contents
			const entries = await fs.readdir(directoryPath);

			for (const entry of entries) {
				const entryPath = path.join(directoryPath, entry);
				const stats = await fs.stat(entryPath);

				const fileInfo: FileInfo = {
					path: entryPath,
					name: entry,
					extension: path.extname(entry),
					size: stats.size,
					created: stats.birthtime,
					modified: stats.mtime,
					isDirectory: stats.isDirectory(),
				};

				// Apply filters
				if (this.shouldIncludeFile(fileInfo, filter)) {
					if (!fileInfo.isDirectory) {
						allFiles.push(fileInfo);
					} else if (recursive) {
						// If it's a directory and we're recursing, process it
						const nestedFiles = await this.listFiles(
							entryPath,
							recursive,
							filter,
						);
						allFiles.push(...nestedFiles);

						// Only include the directory itself if there's no extension filter
						// or if we're explicitly including directories
						if (!filter?.includeExtensions?.length) {
							allFiles.push(fileInfo);
						}
					} else if (!filter?.includeExtensions?.length) {
						// Include directory in non-recursive mode if no extension filter
						allFiles.push(fileInfo);
					}
				}
			}

			return allFiles;
		} catch (error) {
			throw new Error(
				`Failed to list files in ${directoryPath}: ${this.getErrorMessage(
					error,
				)}`,
			);
		}
	}

	async getFileHistory(
		filePath: string,
		maxEntries = 10,
	): Promise<GitCommit[]> {
		try {
			// Initialize git in the file's directory
			this.git = simpleGit(path.dirname(filePath));

			// Ensure the repo is valid
			const isRepo = await this.git.checkIsRepo();
			if (!isRepo) {
				return [];
			}

			// Get the file logs
			const logs = await this.git.log({
				file: filePath,
				maxCount: maxEntries,
			});

			return logs.all.map(log => ({
				hash: log.hash,
				author: log.author_name,
				date: new Date(log.date),
				message: log.message,
				changes: {
					additions: 0, // These would require more detailed git commands
					deletions: 0, // These would require more detailed git commands
				},
			}));
		} catch (error) {
			// Don't throw for git issues, just return empty array
			console.warn(
				`Could not get git history for ${filePath}: ${this.getErrorMessage(
					error,
				)}`,
			);
			return [];
		}
	}

	async createDiff(filePath: string, newContent: string): Promise<string> {
		try {
			// Check if file exists
			const fileExists = await fs.pathExists(filePath);
			if (!fileExists) {
				return `File ${filePath} would be created with the following content:\n\n${newContent}`;
			}

			// Read current content
			const currentContent = await fs.readFile(filePath, 'utf8');

			// If identical, no diff needed
			if (currentContent === newContent) {
				return 'No changes detected.';
			}

			// Create a simple diff (this is a basic implementation)
			// For a real project, you might want to use a more sophisticated diff library
			const currentLines = currentContent.split('\n');
			const newLines = newContent.split('\n');

			let diffOutput = `Diff for ${filePath}:\n`;

			// Very simple diff algorithm for demonstration
			let i = 0,
				j = 0;
			while (i < currentLines.length || j < newLines.length) {
				if (i >= currentLines.length) {
					// All remaining lines are additions
					diffOutput += `+ ${newLines[j]}\n`;
					j++;
				} else if (j >= newLines.length) {
					// All remaining lines are deletions
					diffOutput += `- ${currentLines[i]}\n`;
					i++;
				} else if (currentLines[i] === newLines[j]) {
					// Lines match, keep going
					diffOutput += `  ${currentLines[i]}\n`;
					i++;
					j++;
				} else {
					// Lines differ
					diffOutput += `- ${currentLines[i]}\n`;
					diffOutput += `+ ${newLines[j]}\n`;
					i++;
					j++;
				}
			}

			return diffOutput;
		} catch (error) {
			throw new Error(
				`Failed to create diff for ${filePath}: ${this.getErrorMessage(error)}`,
			);
		}
	}

	/**
	 * Detects the root directory of a project based on common project markers
	 * @param startPath The path to start the search from
	 * @param maxDepth Maximum directory depth to search up from startPath
	 * @returns Information about the detected project
	 */
	async detectProjectRoot(
		startPath: string,
		maxDepth = 5
	): Promise<ProjectInfo> {
		try {
			const projectMarkers: Record<
				string,
				'node' | 'git' | 'python' | 'java' | 'unknown'
			> = {
				'package.json': 'node',
				'.git': 'git',
				'pyproject.toml': 'python',
				'requirements.txt': 'python',
				'pom.xml': 'java',
				'build.gradle': 'java',
				'.guardianai': 'unknown', // Our own marker
			};

			// Normalize and resolve the start path
			const currentPath = path.resolve(startPath);
			let searchPath = currentPath;
			let depth = 0;
			let foundMarkers: string[] = [];
			let projectType: 'node' | 'git' | 'python' | 'java' | 'unknown' = 'unknown';

			// Search up the directory tree
			while (depth < maxDepth) {
				// Check for project markers in this directory
				const entries = await fs.readdir(searchPath);

				// Look for marker files/directories
				for (const entry of entries) {
					if (entry in projectMarkers) {
						foundMarkers.push(entry);
						// Prioritize more specific project types over git
						if (projectType === 'unknown' || projectType === 'git') {
							projectType = projectMarkers[entry] || 'unknown';
						}
					}
				}

				// If we found markers, consider this a project root
				if (foundMarkers.length > 0) {
					return {
						rootPath: searchPath,
						type: projectType,
						markers: foundMarkers,
					};
				}

				// Move up one directory
				const parentPath = path.dirname(searchPath);
				
				// If we're at the filesystem root, stop searching
				if (parentPath === searchPath) {
					break;
				}
				
				searchPath = parentPath;
				depth++;
			}

			// If we didn't find anything, return the starting directory as unknown
			return {
				rootPath: currentPath,
				type: 'unknown',
				markers: [],
			};
		} catch (error) {
			throw new Error(
				`Failed to detect project root: ${this.getErrorMessage(error)}`
			);
		}
	}

	/**
	 * Traverses a project directory and gathers information about all files
	 * @param projectRoot The root directory of the project to traverse
	 * @param filter Optional filter to apply to the traversal
	 * @returns A structured representation of the project
	 */
	async traverseProject(
		projectRoot: string,
		filter?: FileSystemFilter
	): Promise<{
		root: string;
		files: FileInfo[];
		totalSize: number;
		totalFiles: number;
		extensions: Record<string, number>;
		directories: Record<string, number>;
	}> {
		try {
			// Ensure project root exists
			const rootExists = await fs.pathExists(projectRoot);
			if (!rootExists) {
				throw new Error(`Project root does not exist: ${projectRoot}`);
			}

			// Get all files in the project
			const files = await this.listFiles(projectRoot, true, filter);

			// Calculate statistics
			let totalSize = 0;
			const extensions: Record<string, number> = {};
			const directories: Record<string, number> = {};

			// Process each file
			files.forEach(file => {
				// Update total size
				totalSize += file.size;

				// Count file extensions
				if (!file.isDirectory) {
					const ext = file.extension || '(no extension)';
					extensions[ext] = (extensions[ext] || 0) + 1;
				}

				// Count files per directory
				const dirPath = path.dirname(file.path);
				const relativeDir = path.relative(projectRoot, dirPath);
				const dirKey = relativeDir || '.';
				directories[dirKey] = (directories[dirKey] || 0) + 1;
			});

			return {
				root: projectRoot,
				files,
				totalSize,
				totalFiles: files.length,
				extensions,
				directories,
			};
		} catch (error) {
			throw new Error(
				`Failed to traverse project: ${this.getErrorMessage(error)}`
			);
		}
	}

	private shouldIncludeFile(
		fileInfo: FileInfo,
		filter?: FileSystemFilter,
	): boolean {
		// If no filter, include everything
		if (!filter) return true;

		// First check custom includeFilter if it exists (highest priority)
		if (filter.includeFilter) {
			if (!filter.includeFilter(fileInfo.path)) {
				return false;
			}
			// If the custom filter matched, we still need to check exclusions
		}
		// Otherwise check standard filters if no custom filter or if custom filter passed
		else {
			// Check extension inclusions
			if (filter.includeExtensions?.length && !fileInfo.isDirectory) {
				if (!filter.includeExtensions.includes(fileInfo.extension)) {
					return false;
				}
			}

			// Check pattern inclusions
			if (filter.includePatterns?.length) {
				const matchesInclude = filter.includePatterns.some(pattern =>
					pattern.test(fileInfo.path),
				);
				if (!matchesInclude) {
					return false;
				}
			}
		}

		// Check extension exclusions (these always apply)
		if (filter.excludeExtensions?.length && !fileInfo.isDirectory) {
			if (filter.excludeExtensions.includes(fileInfo.extension)) {
				return false;
			}
		}

		// Check pattern exclusions (these always apply)
		if (filter.excludePatterns?.length) {
			const matchesExclude = filter.excludePatterns.some(pattern =>
				pattern.test(fileInfo.path),
			);
			if (matchesExclude) {
				return false;
			}
		}

		return true;
	}
}
