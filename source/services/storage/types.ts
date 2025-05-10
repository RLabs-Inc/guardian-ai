// source/services/storage/types.ts
export interface StorageService {
  /**
   * Initializes the storage service
   */
  initialize(): Promise<void>;
  
  /**
   * Saves data to storage
   */
  saveData(key: string, data: any): Promise<void>;
  
  /**
   * Loads data from storage
   */
  loadData<T>(key: string): Promise<T | null>;
  
  /**
   * Deletes data from storage
   */
  deleteData(key: string): Promise<void>;
  
  /**
   * Checks if data exists
   */
  exists(key: string): Promise<boolean>;
}