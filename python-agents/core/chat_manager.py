import json
import uuid
from datetime import datetime, timezone
from pathlib import Path
from typing import Dict, List, Any
from groq import Groq

from config import MODELS, CHAT_DIR
from tools.definitions import TOOLS, MAIN_CHAT_SYSTEM_INSTRUCTIONS
from core.agent_orchestrator import AgentOrchestrator


class ChatManager:
    def __init__(self):
        self.client = Groq(api_key=MODELS["default"]["api_key"])
        self.conversations: Dict[str, Dict] = {}
        self.agent_orchestrator = AgentOrchestrator()

    def create_conversation(self, chat_id: str = None) -> str:
        chat_id = chat_id or str(uuid.uuid4())[:8]

        conversation_folder = CHAT_DIR / chat_id
        conversation_folder.mkdir(exist_ok=True)

        self.conversations[chat_id] = {
            "conversation_id": chat_id,
            "created_at": datetime.now(timezone.utc).isoformat(),
            "conversation_folder": str(conversation_folder),
            "system_instructions": {
                "role": "system",
                "content": MAIN_CHAT_SYSTEM_INSTRUCTIONS
            },
            "chat_history": []
        }

        self._save_main_conversation(chat_id)
        return chat_id

    def add_message(self, chat_id: str, role: str, content: str, **kwargs) -> Dict[str, Any]:
        if chat_id not in self.conversations:
            self.create_conversation(chat_id)

        message = {
            "id": str(uuid.uuid4())[:8],
            "role": role,
            "content": content,
            "timestamp": datetime.now(timezone.utc).isoformat(),
            **kwargs
        }

        self.conversations[chat_id]["chat_history"].append(message)
        self._save_main_conversation(chat_id)
        return message

    def _extract_response_content(self, response) -> str:
        try:
            if hasattr(response, "choices") and len(response.choices) > 0:
                first_choice = response.choices[0]
                if hasattr(first_choice, "message") and hasattr(first_choice.message, "content"):
                    return first_choice.message.content.strip()
                else:
                    return str(first_choice).strip()
            return str(response).strip()
        except Exception:
            return ""
        
    def load_conversation(self, chat_id: str) -> bool:
        conversation_folder = CHAT_DIR / chat_id
        main_chat_file = conversation_folder / "main_conversation.json"
        if not main_chat_file.exists():
            return False
        try:
            with open(main_chat_file, "r", encoding="utf-8") as f:
                self.conversations[chat_id] = json.load(f)
            return True
        except Exception as e:
            print(f"[CHAT_MANAGER] Error loading conversation {chat_id}: {e}")
            return False

    def _clean_messages_for_api(self, messages: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
        cleaned = []
        for msg in messages:
            if msg.get("role") in ["system", "user", "assistant"]:
                cleaned.append({
                    "role": msg["role"],
                    "content": msg["content"]
                })
        return cleaned

    async def process_user_message(self, chat_id: str, user_message: str) -> Dict[str, Any]:
        """Let AI decide everything through system instructions and tools"""

        # Add user message
        self.add_message(chat_id, "user", user_message)

        # Get conversation context
        conv = self.conversations[chat_id]
        raw_messages = [conv["system_instructions"]] + conv["chat_history"]
        api_messages = self._clean_messages_for_api(raw_messages)

        # Let AI decide what to do (including tool calls)
        response = self.client.chat.completions.create(
            model=MODELS["default"]["model"],
            messages=api_messages,
            tools=TOOLS,                # include all defined tools
            tool_choice="auto",         # let AI pick the tool
            temperature=MODELS["default"]["temperature"]
        )

        # Extract response safely
        if hasattr(response, "choices") and len(response.choices) > 0:
            choice = response.choices[0]

            # Check if AI wants to use tools
            if hasattr(choice, "message") and hasattr(choice.message, "tool_calls") and choice.message.tool_calls:
                try:
                    tool_call = choice.message.tool_calls[0]
                    function_name = tool_call.function.name
                    arguments = json.loads(tool_call.function.arguments)

                    # Add AI's tool call intention to main chat
                    tool_call_msg = self.add_message(
                        chat_id,
                        "assistant",
                        f"I'll analyze that for you using {function_name}..."
                    )

                    # Route to appropriate agent
                    agent_result = await self.agent_orchestrator.process_tool_call({
                        "function_name": function_name,
                        "arguments": arguments
                    }, parent_chat_id=chat_id)

                    # Extract agent response
                    response_content = agent_result.get("summary") or agent_result.get("conclusion") or "Analysis completed."
                    if agent_result.get("status") == "failed":
                        response_content = f"Analysis failed: {agent_result.get('error', 'Unknown error')}"

                    # Add agent response to main chat
                    agent_response_msg = self.add_message(chat_id, "assistant", response_content)

                    return {
                        "type": "tool_call_processed",
                        "tool_call_message": tool_call_msg,
                        "agent_response": agent_response_msg,
                        "agent_metadata": {
                            "agent_id": agent_result.get("agent_id"),
                            "status": agent_result.get("status"),
                            "notebook_path": agent_result.get("notebook_path"),
                            "agent_conversation_file": agent_result.get("agent_conversation_file")
                        }
                    }

                except Exception as e:
                    error_msg = f"Tool execution failed: {str(e)}"
                    error_response = self.add_message(chat_id, "assistant", error_msg)
                    return {"type": "tool_error", "message": error_response}

            else:
                # Normal AI text response (including confirmation requests)
                content = self._extract_response_content(response)
                if not content:
                    content = "I'm OSS_Labs, here to help with your data analysis needs."

                assistant_msg = self.add_message(chat_id, "assistant", content)
                return {"type": "text_response", "message": assistant_msg}

        # Fallback response
        fallback_msg = self.add_message(chat_id, "assistant", "I'm OSS_Labs, here to help with your data analysis needs.")
        return {"type": "text_response", "message": fallback_msg}

    def _save_main_conversation(self, chat_id: str):
        try:
            conversation_folder = Path(self.conversations[chat_id]["conversation_folder"])
            main_chat_file = conversation_folder / "main_conversation.json"

            with open(main_chat_file, "w", encoding='utf-8') as f:
                json.dump(self.conversations[chat_id], f, indent=2)
        except Exception as e:
            print(f"[CHAT_MANAGER] Error saving conversation: {e}")
