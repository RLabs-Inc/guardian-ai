// source/services/utils/memoryMonitor.ts

/**
 * Utility to monitor and log memory usage during operations
 * Helps identify memory leaks and optimize memory usage
 */

import os from 'os';

export interface MemoryUsage {
  rss: number; // Resident Set Size - total memory allocated in bytes
  heapTotal: number; // Total size of the allocated heap
  heapUsed: number; // Actual memory used during execution
  external: number; // Memory used by C++ objects bound to JavaScript objects
  arrayBuffers: number; // Memory used by ArrayBuffers and SharedArrayBuffers
}

export interface MemorySnapshot {
  timestamp: number;
  operation: string;
  usage: MemoryUsage;
  details?: Record<string, any>;
}

export class MemoryMonitor {
  private snapshots: MemorySnapshot[] = [];
  private thresholds: {
    warning: number; // Threshold in MB for warning
    critical: number; // Threshold in MB for critical warning
  };
  private enabled: boolean = true;
  private logHandler: (level: 'info' | 'warning' | 'error', message: string) => void;

  constructor(options?: {
    enabled?: boolean;
    warningThresholdMB?: number;
    criticalThresholdMB?: number;
    logHandler?: (level: 'info' | 'warning' | 'error', message: string) => void;
  }) {
    this.enabled = options?.enabled ?? true;
    this.thresholds = {
      warning: (options?.warningThresholdMB ?? 1000) * 1024 * 1024, // Convert MB to bytes
      critical: (options?.criticalThresholdMB ?? 2000) * 1024 * 1024, // Convert MB to bytes
    };

    // Default log handler just uses console
    this.logHandler = options?.logHandler ?? ((level, message) => {
      switch (level) {
        case 'info':
          console.info(message);
          break;
        case 'warning':
          console.warn(message);
          break;
        case 'error':
          console.error(message);
          break;
      }
    });

    // Take initial snapshot
    if (this.enabled) {
      this.takeSnapshot('initialization');
    }
  }

  /**
   * Take a snapshot of current memory usage
   */
  takeSnapshot(operation: string, details?: Record<string, any>): MemorySnapshot {
    if (!this.enabled) {
      return { timestamp: Date.now(), operation, usage: { rss: 0, heapTotal: 0, heapUsed: 0, external: 0, arrayBuffers: 0 } };
    }

    const memoryUsage = process.memoryUsage();
    const snapshot: MemorySnapshot = {
      timestamp: Date.now(),
      operation,
      usage: {
        rss: memoryUsage.rss,
        heapTotal: memoryUsage.heapTotal,
        heapUsed: memoryUsage.heapUsed,
        external: memoryUsage.external,
        arrayBuffers: memoryUsage.arrayBuffers || 0,
      },
      details,
    };

    this.snapshots.push(snapshot);
    this.checkThresholds(snapshot);
    return snapshot;
  }

  /**
   * Force garbage collection if available
   * Note: This requires running Node with --expose-gc flag
   */
  forceGC(): void {
    if (!this.enabled) return;

    if (global.gc) {
      this.logHandler('info', `Forcing garbage collection`);
      global.gc();
    } else {
      this.logHandler('warning', `Cannot force garbage collection. Run with --expose-gc flag.`);
    }
  }

  /**
   * Get all recorded snapshots
   */
  getSnapshots(): MemorySnapshot[] {
    return [...this.snapshots];
  }

  /**
   * Get the latest snapshot
   */
  getLatestSnapshot(): MemorySnapshot | null {
    if (this.snapshots.length > 0) {
      const snapshot = this.snapshots[this.snapshots.length - 1];
      return snapshot || null;
    }
    return null;
  }

  /**
   * Log memory usage for the specified operation
   */
  logMemoryUsage(operation: string, details?: Record<string, any>): void {
    if (!this.enabled) return;

    const snapshot = this.takeSnapshot(operation, details);
    const { rss, heapTotal, heapUsed } = snapshot.usage;

    // Format memory values in MB for easier reading
    const rssMB = Math.round(rss / 1024 / 1024);
    const heapTotalMB = Math.round(heapTotal / 1024 / 1024);
    const heapUsedMB = Math.round(heapUsed / 1024 / 1024);
    
    // Calculate system memory
    const totalSystemMemory = os.totalmem();
    const freeSystemMemory = os.freemem();
    const systemUsedMemory = totalSystemMemory - freeSystemMemory;
    
    const totalSystemMemoryGB = Math.round(totalSystemMemory / 1024 / 1024 / 1024 * 10) / 10;
    const systemUsedMemoryGB = Math.round(systemUsedMemory / 1024 / 1024 / 1024 * 10) / 10;
    const memoryUsagePercent = Math.round(systemUsedMemory / totalSystemMemory * 100);

    this.logHandler(
      'info',
      `[Memory] ${operation}: RSS: ${rssMB}MB | Heap Total: ${heapTotalMB}MB | Heap Used: ${heapUsedMB}MB | System: ${systemUsedMemoryGB}GB/${totalSystemMemoryGB}GB (${memoryUsagePercent}%)`
    );
  }

  /**
   * Compare memory usage between operations
   */
  compareMemoryUsage(startOperation: string, endOperation: string): void {
    if (!this.enabled) return;

    const startIndex = this.snapshots.findIndex(s => s.operation === startOperation);
    const endIndex = this.snapshots.findIndex(s => s.operation === endOperation);

    if (startIndex === -1 || endIndex === -1) {
      this.logHandler('warning', `Cannot compare memory usage: operations not found`);
      return;
    }

    const startSnapshot = this.snapshots[startIndex];
    const endSnapshot = this.snapshots[endIndex];

    // Extra safety check to prevent TypeScript errors
    if (!startSnapshot || !endSnapshot) {
      this.logHandler('warning', `Cannot compare memory usage: snapshot data missing`);
      return;
    }

    const rssDiff = endSnapshot.usage.rss - startSnapshot.usage.rss;
    const heapTotalDiff = endSnapshot.usage.heapTotal - startSnapshot.usage.heapTotal;
    const heapUsedDiff = endSnapshot.usage.heapUsed - startSnapshot.usage.heapUsed;

    // Format memory values in MB for easier reading
    const rssDiffMB = Math.round(rssDiff / 1024 / 1024);
    const heapTotalDiffMB = Math.round(heapTotalDiff / 1024 / 1024);
    const heapUsedDiffMB = Math.round(heapUsedDiff / 1024 / 1024);

    this.logHandler(
      'info',
      `[Memory Comparison] ${startOperation} → ${endOperation}: RSS: ${rssDiffMB > 0 ? '+' : ''}${rssDiffMB}MB | Heap Total: ${heapTotalDiffMB > 0 ? '+' : ''}${heapTotalDiffMB}MB | Heap Used: ${heapUsedDiffMB > 0 ? '+' : ''}${heapUsedDiffMB}MB`
    );
  }

  /**
   * Check if memory usage has crossed thresholds
   */
  private checkThresholds(snapshot: MemorySnapshot): void {
    const { rss } = snapshot.usage;
    
    if (rss > this.thresholds.critical) {
      this.logHandler(
        'error',
        `[Memory Critical] ${snapshot.operation}: RSS usage (${Math.round(rss / 1024 / 1024)}MB) exceeded critical threshold of ${Math.round(this.thresholds.critical / 1024 / 1024)}MB`
      );
    } else if (rss > this.thresholds.warning) {
      this.logHandler(
        'warning',
        `[Memory Warning] ${snapshot.operation}: RSS usage (${Math.round(rss / 1024 / 1024)}MB) exceeded warning threshold of ${Math.round(this.thresholds.warning / 1024 / 1024)}MB`
      );
    }
  }

  /**
   * Clear accumulated snapshots to free memory
   */
  clearSnapshots(): void {
    this.snapshots = [];
  }
}

// Singleton instance for global use
let globalInstance: MemoryMonitor | null = null;

export function getMemoryMonitor(options?: {
  enabled?: boolean;
  warningThresholdMB?: number;
  criticalThresholdMB?: number;
  logHandler?: (level: 'info' | 'warning' | 'error', message: string) => void;
}): MemoryMonitor {
  if (!globalInstance) {
    globalInstance = new MemoryMonitor(options);
  }
  return globalInstance;
}