// src/services/agent/index.ts
export * from './types.js';
export { GuardianAgentService } from './agentService.js';

// Default export for convenience
import { GuardianAgentService } from './agentService.js';
export default GuardianAgentService;