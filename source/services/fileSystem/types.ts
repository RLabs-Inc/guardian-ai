// src/services/fileSystem/types.ts
export interface FileInfo {
	path: string;
	name: string;
	extension: string;
	size: number;
	created: Date;
	modified: Date;
	isDirectory: boolean;
}

export interface FileContent {
	content: string;
	info: FileInfo;
}

export interface FileSystemFilter {
	includeExtensions?: string[];
	excludeExtensions?: string[];
	includePatterns?: RegExp[];
	excludePatterns?: RegExp[];
	includeFilter?: (filePath: string) => boolean;
	maxDepth?: number;
}

export interface ProjectInfo {
	rootPath: string;
	type: 'node' | 'git' | 'python' | 'java' | 'unknown';
	markers: string[];
}

export interface FileSystemService {
	/**
	 * Reads a file and returns its content
	 */
	readFile(path: string): Promise<FileContent>;

	/**
	 * Writes content to a file
	 */
	writeFile(path: string, content: string): Promise<void>;
	
	/**
	 * Reads the contents of a directory
	 */
	readDirectory(path: string): Promise<string[]>;
	
	/**
	 * Gets information about a file or directory
	 */
	stat(path: string): Promise<{ isDirectory: boolean; size: number; created: Date; modified: Date; }>;

	/**
	 * Lists all files in a directory (recursively if specified)
	 */
	listFiles(
		directoryPath: string,
		recursive?: boolean,
		filter?: FileSystemFilter,
	): Promise<FileInfo[]>;

	/**
	 * Reads Git history for a file
	 */
	getFileHistory(filePath: string, maxEntries?: number): Promise<GitCommit[]>;

	/**
	 * Creates a diff between a file and new content
	 */
	createDiff(filePath: string, newContent: string): Promise<string>;

	/**
	 * Detects the root directory of a project
	 */
	detectProjectRoot(startPath: string, maxDepth?: number): Promise<ProjectInfo>;

	/**
	 * Traverses a project directory and gathers information about all files
	 */
	traverseProject(
		projectRoot: string,
		filter?: FileSystemFilter
	): Promise<{
		root: string;
		files: FileInfo[];
		totalSize: number;
		totalFiles: number;
		extensions: Record<string, number>;
		directories: Record<string, number>;
	}>;
}

export interface GitCommit {
	hash: string;
	author: string;
	date: Date;
	message: string;
	changes: {
		additions: number;
		deletions: number;
	};
}
