/**
 * Default directory exclusions for codebase analysis
 * 
 * This list includes common directories that should be excluded from codebase analysis
 * across different programming languages and build systems.
 */

export const DEFAULT_EXCLUSIONS = [
  'node_modules',
  '.git',
  'dist',
  'build',
  '.cache',
  '.svn',
  '.hg',
  '.bzr',
  '_build',
  'vendor',
  'bower_components',
  'tmp',
  'temp',
  '__pycache__',
  '.pytest_cache',
  '.venv',
  'venv',
  'env',
  '.env',
  'bin',
  'obj',
  'target',
  'output',
  'out',
  'build-output',
  'coverage',
  'logs',
  '.logs',
  'log',
  '.DS_Store',
  'thumbs.db',
  '.idea',
  '.vscode',
  '.gradle',
  '.next',
  'deploy',
  '.terraform',
  '.guardian-ai'
];

/**
 * Gets the default exclusion list as a comma-separated string
 */
export const getDefaultExclusionsString = (): string => {
  return DEFAULT_EXCLUSIONS.join(',');
};

/**
 * Combines default exclusions with user-provided exclusions
 * 
 * @param userExclusions User-provided comma-separated exclusion string
 * @returns Complete list of exclusions as an array
 */
export const combineExclusions = (userExclusions?: string): string[] => {
  const exclusions = [...DEFAULT_EXCLUSIONS];
  
  if (userExclusions) {
    const userExclusionArray = userExclusions.split(',').map(item => item.trim());
    userExclusionArray.forEach(item => {
      if (item && !exclusions.includes(item)) {
        exclusions.push(item);
      }
    });
  }
  
  return exclusions;
};