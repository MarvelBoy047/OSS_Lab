// src/lib/types/agent.ts
export type ChatHistory = [string, string][];

// Defines a single piece of content to be rendered in the UI
export interface ContentBlock {
  type: 'thought' | 'final_answer' | 'code' | 'search_results' | 'notebook_cell' | 'presentation_slide' | 'tool_result';
  content: any; // Can be a string for text, or an object/array for data
  title?: string;
  metadata?: Record<string, any>;
}

// Define the event types for the agent
export type AgentEvent = 
  | { type: 'status_update'; message: string }
  | { type: 'tool_result'; tool: string; output: any }
  | { type: 'notebook_cell_added'; cell: { chatId: string; cellNumber: number; type: string; content: string } }
  | { type: 'presentation_slide_added'; slide: { chatId: string; slideNumber: number; slideData: any } }
  | { type: 'final_response'; content: string }
  | { type: 'error'; message: string }
  | { type: 'agent_switch'; newAgent: string; message: string };

export interface AgentStep {
  step_id: string;
  tool: "search" | "llm_analysis" | "code_generation" | "synthesis" | "data_processing" | "user_input" | 
        "python_execution_environment" | "web_search" | "Result" | "python_notebook_environment" | "presentation_creation_environment";
  prompt?: string;
  args?: Record<string, any>;
  depends_on?: string[];
  output?: any;
  status: "pending" | "in_progress" | "complete" | "error";
  start_time?: string;
  end_time?: string;
  citations?: string[];
  error_message?: string;
  query?: string;
  input?: string;
}

export interface AgentPlan {
  plan_id: string;
  user_id?: string;
  steps: AgentStep[];
  trace: AgentStep[];
  status: "pending" | "running" | "complete" | "error" | "paused";
  created_at: string;
  completed_at?: string;
  final_output?: string;
  providerKey: string;
  modelKey: string;
}

// In-memory store
export const agentPlansStore: Record<string, AgentPlan> = {};

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
  chatId?: string;
  prompt?: string;
  history?: any[];
}