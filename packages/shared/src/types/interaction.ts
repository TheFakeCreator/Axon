/**
 * User interaction and conversation types
 */

/**
 * Interaction status
 */
export enum InteractionStatus {
  PENDING = 'pending',
  PROCESSING = 'processing',
  COMPLETED = 'completed',
  FAILED = 'failed',
}

/**
 * User interaction record
 */
export interface IInteraction {
  id: string;
  workspaceId: string;
  userId: string;
  promptId: string;
  status: InteractionStatus;
  request: IInteractionRequest;
  response?: IInteractionResponse;
  feedback?: IInteractionFeedback;
  createdAt: Date;
  completedAt?: Date;
  error?: IInteractionError;
}

/**
 * Interaction request
 */
export interface IInteractionRequest {
  rawPrompt: string;
  enrichedPrompt: string;
  analysis: Record<string, unknown>; // IPromptAnalysis (avoid circular dependency)
  contextUsed: string[]; // Context IDs
  metadata: Record<string, unknown>;
}

/**
 * Interaction response
 */
export interface IInteractionResponse {
  content: string;
  tokensUsed: number;
  model: string;
  provider: string;
  actions?: IExtractedAction[];
  qualityScore?: number;
  metadata: Record<string, unknown>;
}

/**
 * Extracted actions from LLM response
 */
export interface IExtractedAction {
  type: 'file_edit' | 'file_create' | 'file_delete' | 'command_run' | 'suggestion';
  description: string;
  parameters: Record<string, unknown>;
  confidence: number;
}

/**
 * User feedback on interaction
 */
export interface IInteractionFeedback {
  rating?: number; // 1-5
  wasHelpful?: boolean;
  wasAccurate?: boolean;
  corrections?: string;
  comments?: string;
  timestamp: Date;
}

/**
 * Interaction error
 */
export interface IInteractionError {
  code: string;
  message: string;
  stage: 'analysis' | 'retrieval' | 'synthesis' | 'llm' | 'post-processing';
  details?: Record<string, unknown>;
}

/**
 * Conversation context (for multi-turn interactions)
 */
export interface IConversationContext {
  workspaceId: string;
  userId: string;
  interactionIds: string[];
  summary?: string;
  activeTopics?: string[];
  lastUpdated: Date;
}
