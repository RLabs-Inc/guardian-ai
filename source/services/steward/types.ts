// source/services/steward/types.ts
// Removed unused import

/**
 * The types of queries the Codebase Steward can answer
 */
export enum StewardQueryType {
  /**
   * General explanation or information about code
   */
  EXPLANATION = 'explanation',
  
  /**
   * Questions about architecture and structure
   */
  ARCHITECTURE = 'architecture',
  
  /**
   * Requests for implementation guidance
   */
  IMPLEMENTATION = 'implementation',
  
  /**
   * Queries about code patterns and conventions
   */
  PATTERN = 'pattern',
  
  /**
   * Queries about component relationships
   */
  RELATIONSHIP = 'relationship',
  
  /**
   * Questions about potential bugs or issues
   */
  BUG = 'bug',
  
  /**
   * Requests for living standards and guidelines
   */
  STANDARD = 'standard'
}

/**
 * Options for a Steward query
 */
export interface StewardQueryOptions {
  /**
   * The maximum number of tokens to use in the response
   */
  maxTokens?: number;
  
  /**
   * Additional context to include in the query
   */
  additionalContext?: string;
  
  /**
   * Should return detailed analysis with the response
   */
  includeAnalysis?: boolean;
  
  /**
   * Vector similarity threshold
   */
  similarityThreshold?: number;
  
  /**
   * Maximum number of context items to include
   */
  maxContextItems?: number;
}

/**
 * A query result from the Codebase Steward
 */
export interface StewardQueryResult {
  /**
   * The detailed response to the query
   */
  response: string;
  
  /**
   * Whether the query was successful
   */
  success: boolean;
  
  /**
   * Error message, if any
   */
  error?: string;
  
  /**
   * Detailed analysis of the codebase related to the query
   * Only included if includeAnalysis was true
   */
  analysis?: {
    patterns?: Array<{
      name: string;
      description: string;
      examples: string[];
      confidence: number;
    }>;
    relationships?: Array<{
      source: string;
      target: string;
      type: string;
      description: string;
    }>;
    relevantFiles?: string[];
  };
  
  /**
   * The files that were most relevant to answering the query
   */
  relevantFiles?: string[];
  
  /**
   * The total tokens used to generate the response
   */
  tokensUsed?: number;
}

/**
 * Pattern description from the Codebase Steward
 */
export interface CodePattern {
  /**
   * The name of the pattern
   */
  name: string;
  
  /**
   * Description of the pattern
   */
  description: string;
  
  /**
   * Examples of the pattern in the codebase
   */
  examples: string[];
  
  /**
   * Confidence score (0-1)
   */
  confidence: number;
  
  /**
   * The files where this pattern is applied
   */
  files: string[];
}

/**
 * Service interface for the Codebase Steward
 */
export interface CodebaseStewardService {
  /**
   * Initialize the steward service
   */
  initialize(): Promise<void>;
  
  /**
   * Process a query about the codebase
   */
  query(
    queryText: string,
    queryType?: StewardQueryType,
    options?: StewardQueryOptions
  ): Promise<StewardQueryResult>;
  
  /**
   * Get architectural patterns identified in the codebase
   */
  getPatterns(options?: {
    confidence?: number;
    limit?: number;
  }): Promise<CodePattern[]>;
  
  /**
   * Get relationships between components
   */
  getRelationships(
    componentName?: string,
    options?: {
      types?: string[];
      depth?: number;
    }
  ): Promise<Array<{
    source: string;
    target: string;
    type: string;
    description: string;
  }>>;
  
  /**
   * Analyze a specific aspect of the codebase
   */
  analyzeAspect(
    aspect: 'architecture' | 'patterns' | 'conventions' | 'dependencies',
    options?: {
      depth?: number;
      focus?: string;
    }
  ): Promise<{
    analysis: string;
    recommendations: string[];
  }>;
  
  /**
   * Get guidance for implementing a new feature
   */
  getImplementationGuidance(
    featureDescription: string,
    options?: {
      existingComponents?: string[];
      technicalConstraints?: string[];
    }
  ): Promise<{
    architecture: string;
    filesToModify: string[];
    newFilesToCreate: string[];
    implementationSteps: string[];
  }>;
  
  /**
   * Get or create living standards documentation
   */
  getLivingStandards(
    category?: 'code-style' | 'architecture' | 'testing' | 'security' | 'performance'
  ): Promise<{
    standards: string;
    examples: Record<string, string[]>;
    violations?: Record<string, string[]>;
  }>;
}