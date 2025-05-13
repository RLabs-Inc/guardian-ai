// source/services/indexing/llmDirected/agentProtocol.ts

/**
 * Defines the protocol for communication between the indexing service and the LLM agent
 */

// The types of actions the LLM agent can perform
export enum AgentActionType {
  ANALYZE_CODEBASE = 'ANALYZE_CODEBASE',     // Initial analysis of codebase structure
  DESIGN_INDEX_STRATEGY = 'DESIGN_INDEX_STRATEGY', // Design the indexing strategy
  ANALYZE_FILE = 'ANALYZE_FILE',           // Analyze a specific file
  DESIGN_FILE_CHUNKING = 'DESIGN_FILE_CHUNKING', // Design the chunking strategy for a file
  EXTRACT_SYMBOLS = 'EXTRACT_SYMBOLS',       // Extract symbols from a file
  ANALYZE_RELATIONSHIPS = 'ANALYZE_RELATIONSHIPS', // Analyze relationships between symbols
  ENHANCE_SYMBOL_METADATA = 'ENHANCE_SYMBOL_METADATA', // Add additional metadata to symbols
  SUGGEST_IMPROVEMENTS = 'SUGGEST_IMPROVEMENTS',   // Suggest improvements to the indexing strategy
}

// Base structure for agent requests
export interface AgentRequest {
  action: AgentActionType;
  context?: string;
  data?: any;
}

// Base structure for agent responses
export interface AgentResponse {
  action: AgentActionType | 'CONTINUATION';
  success: boolean;
  message?: string;
  data?: any;
}

// Pagination-aware response type
export interface PaginatedResponse extends AgentResponse {
  data: {
    continuation?: boolean;
    continuation_token?: string;
    [key: string]: any;
  }
}

// Request for initial codebase analysis
export interface AnalyzeCodebaseRequest extends AgentRequest {
  action: AgentActionType.ANALYZE_CODEBASE;
  data: {
    codebaseStructure: {
      fileTypes: Record<string, number>; // Extension -> count
      directoryStructure: Record<string, number>; // Directory -> file count
      sampleFiles: Array<{
        path: string;
        size: number;
        snippet?: string; // First few lines of the file
      }>;
    };
  };
}

// Response from initial codebase analysis
export interface AnalyzeCodebaseResponse extends AgentResponse {
  action: AgentActionType.ANALYZE_CODEBASE;
  data: {
    codebaseType: string;  // E.g., "Node.js", "Python", "Mixed"
    dominantLanguages: string[];
    estimatedComplexity: 'simple' | 'moderate' | 'complex' | 'very complex';
    suggestedFileTypes: string[]; // File extensions to focus on
    suggestedExclusions: string[]; // Patterns to exclude
    additionalInsights: string[];
  };
}

// Request to design overall indexing strategy
export interface DesignIndexStrategyRequest extends AgentRequest {
  action: AgentActionType.DESIGN_INDEX_STRATEGY;
  data: {
    codebaseAnalysis: AnalyzeCodebaseResponse['data'];
    constraints: {
      maxMemoryUsage?: number; // In MB
      maxProcessingTime?: number; // In minutes
    };
  };
}

// Response for indexing strategy design
export interface DesignIndexStrategyResponse extends AgentResponse {
  action: AgentActionType.DESIGN_INDEX_STRATEGY;
  data: {
    indexingApproach: string; // Description of the overall approach
    prioritizedFileTypes: Array<{
      extension: string;
      priority: number;
      reason: string;
    }>;
    chunkingStrategies: Record<string, {
      strategy: string; // E.g., "function-based", "class-based", "semantic-blocks"
      reason: string;
    }>;
    symbolExtractionPriorities: Array<{
      symbolType: string; // E.g., "function", "class", "interface"
      importance: number; // 1-10
      reason: string;
    }>;
    relationshipTypes: Array<{
      type: string; // E.g., "import", "inheritance", "function-call"
      description: string;
      extractionMethod: string;
    }>;
    progressiveIndexingPlan: {
      phases: Array<{
        description: string;
        estimatedCompletion: number; // 0-100%
      }>;
    };
  };
}

// Request to analyze a specific file
export interface AnalyzeFileRequest extends AgentRequest {
  action: AgentActionType.ANALYZE_FILE;
  data: {
    filePath: string;
    content: string;
    extension: string;
  };
}

// Response for file analysis
export interface AnalyzeFileResponse extends AgentResponse {
  action: AgentActionType.ANALYZE_FILE;
  data: {
    fileType: string; // Language or file type
    complexity: number; // 1-10
    estimatedSymbolCount: number;
    detectedPatterns: string[];
    suggestedChunkingStrategy: string;
    estimatedChunks: number;
    potentialSymbolTypes: string[];
    uniqueCharacteristics: string[];
  };
}

// Request to design chunking strategy for a file
export interface DesignFileChunkingRequest extends AgentRequest {
  action: AgentActionType.DESIGN_FILE_CHUNKING;
  data: {
    filePath: string;
    content: string;
    fileAnalysis: AnalyzeFileResponse['data'];
  };
}

// Response for chunking strategy
/**
 * Defines a generalizable chunking pattern that can be interpreted and executed
 */
export interface ChunkingPattern {
  type: string;  // Free-form description of the pattern type (e.g., 'regex', 'delimiter', 'semantic')
  definition: {
    // A structured description of the pattern that can be interpreted
    // This can include any properties the LLM wants to define
    [key: string]: any;
  };
  applicationRules: {
    // Rules for how to apply the pattern
    // This can include any properties the LLM wants to define
    [key: string]: any;
  };
}

export interface DesignFileChunkingResponse extends AgentResponse {
  action: AgentActionType.DESIGN_FILE_CHUNKING;
  data: {
    chunkingMethod: string; // E.g., "function-based", "class-based", "fixed-size"
    reason: string;

    // A generalizable pattern description allowing the LLM to define custom chunking logic
    patternDefinition?: ChunkingPattern;

    // Legacy fields (kept for backward compatibility)
    chunkSizeGuidelines?: {
      minLines?: number;
      maxLines?: number;
      minTokens?: number;
      maxTokens?: number;
      description?: string;
    };
    boundaryMarkers?: {
      start?: string[];
      end?: string[];
      description?: string;
    };
    overlapStrategy?: {
      enabled?: boolean;
      amount?: number; // Lines or tokens
      description?: string;
    };
    suggestedChunks?: Array<{
      startLine: number;
      endLine: number;
      description?: string;
      type?: string;
    }>;
  };
}

// Request to extract symbols from a file
export interface ExtractSymbolsRequest extends AgentRequest {
  action: AgentActionType.EXTRACT_SYMBOLS;
  data: {
    filePath: string;
    content: string;
    chunks: Array<{
      content: string;
      startLine: number;
      endLine: number;
      type?: string;
    }>;
    fileType?: string; // Language or file type info
  };
}

/**
 * Extraction pattern for symbol extraction
 */
export interface ExtractionPattern {
  type: string;  // The type of extraction pattern (regex, ast, semantic, etc.)
  targetSymbolTypes: string[];  // Types of symbols this pattern targets (function, class, etc.)
  definition: {
    // Pattern-specific configuration
    [key: string]: any;
  };
  refinement?: {
    // Rules for refining/filtering extracted symbols
    [key: string]: any;
  };
}

// Response for symbol extraction
export interface ExtractSymbolsResponse extends AgentResponse {
  action: AgentActionType.EXTRACT_SYMBOLS;
  data: {
    symbols: Array<{
      name: string;
      type: string; // E.g., "function", "class", "variable"
      location: {
        startLine: number;
        endLine: number;
        startColumn?: number;
        endColumn?: number;
      };
      signature?: string;
      description?: string;
      parentSymbol?: string;
      children?: string[];
      properties?: Record<string, any>;
    }>;
    extractionPatterns?: ExtractionPattern[]; // Patterns used or suggested for extraction
  };
}

// Request to analyze relationships between symbols
export interface AnalyzeRelationshipsRequest extends AgentRequest {
  action: AgentActionType.ANALYZE_RELATIONSHIPS;
  data: {
    filePath: string;
    content: string;
    symbols: ExtractSymbolsResponse['data']['symbols'];
    otherSymbols?: Array<{
      id: string;
      name: string;
      type: string;
      filePath: string;
    }>;
  };
}

/**
 * Define the relationship pattern interface for use in the response
 *
 * This interface is intentionally flexible to allow the LLM to define any type
 * of relationship detection pattern it deems appropriate for the codebase.
 */
export interface RelationshipPattern {
  // The type of relationship - can be any string the LLM decides is appropriate
  type: string;

  // Types of symbols that can be the source of this relationship
  sourceType?: string[];

  // Types of symbols that can be the target of this relationship
  targetType?: string[];

  // Pattern-specific detection configuration
  // The contents are entirely up to the LLM - our code will handle whatever is provided
  detection: {
    [key: string]: any;
  };

  // Optional rules for refining/filtering detected relationships
  refinement?: {
    [key: string]: any;
  };

  // Allow for any additional properties the LLM might want to define
  [key: string]: any;
}

// Response for relationship analysis
export interface AnalyzeRelationshipsResponse extends AgentResponse {
  action: AgentActionType.ANALYZE_RELATIONSHIPS;
  data: {
    relationships: Array<{
      sourceSymbol: string;
      targetSymbol: string;
      type: string; // E.g., "calls", "imports", "extends"
      description?: string;
      properties?: Record<string, any>;
    }>;
    // Patterns for identifying relationships, allowing pattern-based extraction
    relationshipPatterns?: RelationshipPattern[];
  };
}

// Request to enhance symbol metadata
export interface EnhanceSymbolMetadataRequest extends AgentRequest {
  action: AgentActionType.ENHANCE_SYMBOL_METADATA;
  data: {
    symbol: {
      id: string;
      name: string;
      type: string;
      content: string;
      location: {
        filePath: string;
        startLine: number;
        endLine: number;
      };
    };
    codebaseContext: {
      relationships: Array<{
        type: string;
        targetSymbol: string;
      }>;
    };
  };
}

// Response for symbol metadata enhancement
export interface EnhanceSymbolMetadataResponse extends AgentResponse {
  action: AgentActionType.ENHANCE_SYMBOL_METADATA;
  data: {
    enhancedMetadata: {
      purpose: string;
      complexity: number; // 1-10
      semanticDescription: string;
      potentialUseCase: string[];
      keyInsights: string[];
      documentation?: string;
      suggestedEmbeddingStrategy?: string;
    };
  };
}

// Request to suggest improvements to the indexing strategy
export interface SuggestImprovementsRequest extends AgentRequest {
  action: AgentActionType.SUGGEST_IMPROVEMENTS;
  data: {
    currentStrategy: DesignIndexStrategyResponse['data'];
    indexingProgress: number; // 0-100%
    issues: Array<{
      type: string;
      description: string;
      affectedComponents: string[];
    }>;
    performance: {
      avgProcessingTimePerFile: number; // In ms
      memoryUsage: number; // In MB
      totalFilesProcessed: number;
      totalSymbolsExtracted: number;
    };
  };
}

// Response for improvement suggestions
export interface SuggestImprovementsResponse extends AgentResponse {
  action: AgentActionType.SUGGEST_IMPROVEMENTS;
  data: {
    suggestedImprovements: Array<{
      target: string; // E.g., "chunking", "symbolExtraction", "relationshipAnalysis"
      description: string;
      expectedBenefit: string;
      implementationSuggestion: string;
      priority: number; // 1-10
    }>;
  };
}

// Utility to create a request object for the agent
export function createAgentRequest<T extends AgentRequest>(request: T): T {
  return request;
}

// Utility to parse agent response
export function parseAgentResponse<T extends AgentResponse>(response: string): T {
  try {
    // Try to clean and sanitize the JSON first
    let cleanedJson = response.trim();

    // Remove any markdown code block markers
    cleanedJson = cleanedJson.replace(/```(json)?|```/g, '');

    // Sometimes LLMs add extra text before or after the JSON
    // Try to extract just the JSON part (assuming it starts with { and ends with })
    const jsonMatch = cleanedJson.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      cleanedJson = jsonMatch[0];
    }

    // Try to parse the cleaned JSON
    try {
      return JSON.parse(cleanedJson) as T;
    } catch (jsonError) {
      console.error("Failed to parse JSON after cleaning:", jsonError);

      // If JSON parsing failed, attempt more aggressive recovery methods
      try {
        // First, try to fix common JSON syntax errors
        let fixedJson = fixJsonSyntax(cleanedJson);
        return JSON.parse(fixedJson) as T;
      } catch (fixError) {
        console.error("Failed to fix JSON syntax:", fixError);

        // Try to detect if the JSON is truncated and attempt to repair it
        try {
          let repairedJson = repairTruncatedJson(cleanedJson);
          return JSON.parse(repairedJson) as T;
        } catch (repairError) {
          console.error("Failed to repair truncated JSON:", repairError);

          // As a last resort, create a minimal valid response
          console.error("Creating minimal valid response due to parsing failures");
          const actionMatch = cleanedJson.match(/"action"\s*:\s*"([^"]+)"/);
          const action = actionMatch ? actionMatch[1] : "UNKNOWN";

          // Construct a minimal valid response with error info
          const fallbackResponse = {
            action: action as AgentActionType,
            success: false,
            message: `Failed to parse response: ${jsonError}`,
            data: {}
          };

          return fallbackResponse as T;
        }
      }
    }
  } catch (error) {
    console.error("Complete response string:", response);
    throw new Error(`Failed to parse agent response: ${error}`);
  }
}

/**
 * Fixes common JSON syntax errors
 */
function fixJsonSyntax(json: string): string {
  let fixedJson = json;

  // Replace single quotes with double quotes (but not inside already properly quoted strings)
  fixedJson = fixedJson.replace(/(\w+)'(\w+)/g, '$1"$2'); // Fix words with apostrophes first
  fixedJson = fixedJson.replace(/'/g, '"');

  // Add missing quotes around property names
  fixedJson = fixedJson.replace(/(\s*)(\w+)(\s*):(\s*)/g, '$1"$2"$3:$4');

  // Fix trailing commas in objects and arrays
  fixedJson = fixedJson.replace(/,(\s*[\]}])/g, '$1');

  // Fix missing commas between array elements or object properties
  fixedJson = fixedJson.replace(/(["}])\s*["{\[](?!\s*[,:])/g, '$1,');

  // Remove JS-style comments
  fixedJson = fixedJson.replace(/\/\/.*$/gm, '');
  fixedJson = fixedJson.replace(/\/\*[\s\S]*?\*\//g, '');

  return fixedJson;
}

/**
 * Utility to detect if a JSON is likely to be too large and should be paginated
 * @param data The data object to evaluate
 * @param maxSize Optional maximum size threshold in characters
 * @returns Boolean indicating if pagination is recommended
 */
export function shouldPaginateResponse(data: any, maxSize: number = 50000): boolean {
  try {
    // Stringify the data to estimate its size
    const jsonString = JSON.stringify(data);

    // Check if it exceeds the threshold
    if (jsonString.length > maxSize) {
      return true;
    }

    // Check if it has many array elements that could be split
    for (const key in data) {
      if (Array.isArray(data[key]) && data[key].length > 100) {
        return true;
      }
    }

    // Check for specific response types that often lead to large outputs
    if (data.action === AgentActionType.EXTRACT_SYMBOLS ||
        data.action === AgentActionType.ANALYZE_RELATIONSHIPS) {
      // These actions typically produce large outputs if:
      // - There are many chunks in the file
      // - The file is large (content > 10K characters)
      // - Many symbols are being analyzed (>20)
      if ((data.data?.chunks?.length || 0) > 20 ||
          (data.data?.content?.length || 0) > 10000 ||
          (data.data?.symbols?.length || 0) > 20) {
        return true;
      }
    }

    return false;
  } catch (error) {
    // If we can't stringify, assume it's complex enough to warrant pagination
    console.warn("Error checking pagination need:", error);
    return true;
  }
}

/**
 * Repairs truncated JSON by balancing brackets and completing structures
 */
function repairTruncatedJson(json: string): string {
  // Count opening and closing brackets/braces to check for imbalance
  const openBraces = (json.match(/\{/g) || []).length;
  const closeBraces = (json.match(/\}/g) || []).length;
  const openBrackets = (json.match(/\[/g) || []).length;
  const closeBrackets = (json.match(/\]/g) || []).length;

  let repairedJson = json;

  // Function to check if we're inside a string at a given position
  const isInString = (str: string, pos: number): boolean => {
    let inString = false;
    let escapeNext = false;

    for (let i = 0; i < pos; i++) {
      if (escapeNext) {
        escapeNext = false;
        continue;
      }

      if (str[i] === '\\') {
        escapeNext = true;
        continue;
      }

      if (str[i] === '"') {
        inString = !inString;
      }
    }

    return inString;
  };

  // Check if we need to close strings at the end
  const lastQuotePos = repairedJson.lastIndexOf('"');
  if (lastQuotePos >= 0 && !isInString(repairedJson, repairedJson.length)) {
    // Count quotes to see if we have an odd number (indicating an unclosed string)
    let inEscapeSequence = false;
    let realQuoteCount = 0;

    for (let i = 0; i < repairedJson.length; i++) {
      if (inEscapeSequence) {
        inEscapeSequence = false;
        continue;
      }

      if (repairedJson[i] === '\\') {
        inEscapeSequence = true;
        continue;
      }

      if (repairedJson[i] === '"') {
        realQuoteCount++;
      }
    }

    if (realQuoteCount % 2 !== 0) {
      // Add a closing quote to the last unclosed string
      repairedJson += '"';
    }
  }

  // Add missing closing braces and brackets
  if (openBraces > closeBraces) {
    repairedJson += '}' .repeat(openBraces - closeBraces);
  }

  if (openBrackets > closeBrackets) {
    repairedJson += ']' .repeat(openBrackets - closeBrackets);
  }

  // Try to fix incomplete property-value pairs at the end
  const propertyMatch = repairedJson.match(/("[^"]+"\s*:\s*)$/);
  if (propertyMatch) {
    // Property name with colon but no value - add null value
    repairedJson += 'null';
  }

  return repairedJson;
}
