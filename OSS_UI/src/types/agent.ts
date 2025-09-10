// This file defines the core data structures for our multi-step agent.

// The history format matches what the rest of your application uses.
export type ChatHistory = [string, string][];

export interface AgentStep {
  step_id: string;
  tool: "search" | "llm_analysis" | "code_generation" | "synthesis" | "data_processing" | "user_input";
  prompt?: string;
  args?: Record<string, any>;
  depends_on?: string[];
  output?: any;
  status: "pending" | "in_progress" | "complete" | "error" | "waiting_for_user";
  start_time?: string; // ISO timestamp
  end_time?: string; // ISO timestamp
  citations?: string[];
  user_input_required?: boolean;
  error_message?: string;
}

export interface AgentPlan {
  plan_id: string;
  original_prompt: string;
  original_history: ChatHistory;
  steps: AgentStep[];
  trace: AgentStep[]; // Stores completed/errored steps for auditing
  status: "pending" | "running" | "complete" | "error" | "paused";
  created_at: string; // ISO timestamp
  completed_at?: string; // ISO timestamp
  final_output?: string;
  
  // CRITICAL: We store the model context here to ensure the executor uses the same model as the planner.
  providerKey: string;
  modelKey: string;
}

// In-memory store for agent plans.
// IMPORTANT: This is for development ONLY. It will be lost on server restart.
// In a production environment, this should be replaced with a database (e.g., Redis, or our SQLite DB).
declare global {
  var agentPlansStore: Record<string, AgentPlan> | undefined;
}

if (typeof window === 'undefined') {
  if (!global.agentPlansStore) {
    global.agentPlansStore = {};
  }
}

export const agentPlansStore: Record<string, AgentPlan> = global.agentPlansStore || {};


// Request body types for our API endpoints
export interface PlanRequestBody {
    prompt: string;
    history?: ChatHistory;
    providerKey: string;
    modelKey: string;
}

export interface ExecuteRequestBody {
  plan_id: string;
  step_id?: string;
  user_input?: any;
}