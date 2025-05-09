// src/services/storage/types.ts
export type StorageKey = string;
export type StorageValue = string | number | boolean | object | null;

export interface StorageOptions {
	ttl?: number; // Time to live in seconds
}

export interface StorageService {
	/**
	 * Initializes the storage service
	 */
	initialize(): Promise<void>;

	/**
	 * Stores a value with the given key
	 */
	set(
		key: StorageKey,
		value: StorageValue,
		options?: StorageOptions,
	): Promise<void>;

	/**
	 * Retrieves a value by key
	 */
	get<T extends StorageValue>(key: StorageKey): Promise<T | null>;

	/**
	 * Deletes a value by key
	 */
	delete(key: StorageKey): Promise<boolean>;

	/**
	 * Checks if a key exists
	 */
	has(key: StorageKey): Promise<boolean>;

	/**
	 * Clears all stored values
	 */
	clear(): Promise<void>;
}
