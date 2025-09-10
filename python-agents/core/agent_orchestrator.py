from agents.metadata_agent import MetadataAgent
from agents.full_analysis_agent import FullAnalysisAgent
from agents.web_search_agent import WebSearchAgent
from agents.rag_agent import RAGAgent  # new agent for RAG
from typing import Dict, Any

class AgentOrchestrator:
    def __init__(self):
        self.metadata_agent = MetadataAgent()
        self.full_analysis_agent = FullAnalysisAgent()
        try:
            self.web_search_agent = WebSearchAgent()
            print("[ORCHESTRATOR] ✅ Web search agent initialized")
        except Exception as e:
            print(f"[ORCHESTRATOR] ⚠️ Web search agent init failed: {e}")
            self.web_search_agent = None
        try:
            self.rag_agent = RAGAgent()
            print("[ORCHESTRATOR] ✅ RAG agent initialized")
        except Exception as e:
            print(f"[ORCHESTRATOR] ⚠️ RAG agent init failed: {e}")
            self.rag_agent = None

    async def process_tool_call(self, tool_call: Dict[str, Any], parent_chat_id: str = None) -> Dict[str, Any]:
        try:
            fn = tool_call.get("function_name")
            if fn == "dataset_metadata_analysis":
                return await self.metadata_agent.process_tool_call(tool_call, parent_chat_id)
            elif fn == "full_dataset_analysis":
                return await self.full_analysis_agent.process(tool_call, parent_chat_id)
            elif fn == "web_search":
                if self.web_search_agent and self.web_search_agent.is_enabled():
                    return await self.web_search_agent.process_tool_call(tool_call, parent_chat_id)
                return {
                    "agent_id": "web_search_agent",
                    "summary": "Web search unavailable (SearXNG down or misconfigured)",
                    "status": "unavailable",
                    "error": "SearXNG service not available"
                }
            elif fn == "rag_knowledge_retrieval":
                if self.rag_agent and self.rag_agent.is_enabled():
                    return await self.rag_agent.process_tool_call(tool_call, parent_chat_id)
                return {
                    "agent_id": "rag_agent",
                    "summary": "RAG knowledge retrieval unavailable (initialization failure or misconfigured)",
                    "status": "unavailable",
                    "error": "RAG agent not available"
                }
            else:
                return {
                    "agent_id": "unknown",
                    "error": f"No agent found for function '{fn}'",
                    "status": "failed"
                }
        except Exception as ex:
            import traceback
            traceback.print_exc()
            return {
                "agent_id": "agent_orchestrator",
                "error": str(ex),
                "status": "failed"
            }

    def is_web_search_available(self) -> bool:
        return bool(self.web_search_agent and self.web_search_agent.is_enabled())

    def is_rag_available(self) -> bool:
        return bool(self.rag_agent and self.rag_agent.is_enabled())

    def get_available_tools(self) -> Dict[str, Any]:
        return {
            "dataset_metadata_analysis": "available",
            "full_dataset_analysis": "available",
            "web_search": "available" if self.is_web_search_available() else "unavailable",
            "rag_knowledge_retrieval": "available" if self.is_rag_available() else "unavailable"
        }
