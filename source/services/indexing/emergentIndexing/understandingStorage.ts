/**
 * Understanding Storage
 * 
 * Handles saving and loading codebase understanding to/from persistent storage.
 */

import fs from 'fs';
import path from 'path';
import { CodebaseUnderstanding } from './types.js';

/**
 * Storage for codebase understanding models
 */
export class UnderstandingStorage {
  /**
   * Save a codebase understanding to persistent storage
   */
  async saveUnderstanding(understanding: CodebaseUnderstanding, outputPath: string): Promise<void> {
    console.log(`Saving understanding to ${outputPath}...`);
    
    try {
      // Make sure the output directory exists
      const dir = path.dirname(outputPath);
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }
      
      // Convert Map to array for serialization
      const serializable = this.makeSerializable(understanding);
      
      // Write the file
      fs.writeFileSync(
        outputPath,
        JSON.stringify(serializable, null, 2),
        'utf8'
      );
      
      console.log(`Understanding saved to ${outputPath}`);
    } catch (error) {
      console.error(`Error saving understanding to ${outputPath}:`, error);
      throw error;
    }
  }
  
  /**
   * Load a codebase understanding from persistent storage
   */
  async loadUnderstanding(inputPath: string): Promise<CodebaseUnderstanding> {
    console.log(`Loading understanding from ${inputPath}...`);
    
    try {
      // Read the file
      const content = fs.readFileSync(inputPath, 'utf8');
      const data = JSON.parse(content);
      
      // Convert array back to Map
      const understanding = this.fromSerializable(data);
      
      console.log(`Understanding loaded from ${inputPath}`);
      
      return understanding;
    } catch (error) {
      console.error(`Error loading understanding from ${inputPath}:`, error);
      throw error;
    }
  }
  
  /**
   * Convert the understanding model to a serializable object
   * @private
   */
  private makeSerializable(understanding: CodebaseUnderstanding): any {
    // Create a new object with spread to avoid modifying the original
    const result: any = { ...understanding };

    // Convert code nodes Map to array
    result.codeNodes = Array.from(understanding.codeNodes.entries());

    // Convert languages Map to array
    result.languages = {
      ...understanding.languages,
      languages: Array.from(understanding.languages.languages.entries())
    };

    return result;
  }
  
  /**
   * Convert a serialized understanding back to the original structure
   * @private
   */
  private fromSerializable(data: any): CodebaseUnderstanding {
    const result = { ...data };
    
    // Convert code nodes array back to Map
    result.codeNodes = new Map(data.codeNodes);
    
    // Convert languages array back to Map
    result.languages = {
      ...data.languages,
      languages: new Map(data.languages.languages)
    };
    
    return result;
  }
}