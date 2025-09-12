import json
import uuid
from datetime import datetime, timezone
from pathlib import Path
from typing import Dict, List, Any, Optional

from groq import Groq
from config import CHAT_DIR
from tools.definitions import TOOLS, MAIN_CHAT_SYSTEM_INSTRUCTIONS
from core.agent_orchestrator import AgentOrchestrator
from core.settings_manager import settings_manager


class ChatManager:
    def __init__(self):
        self.conversations: Dict[str, Dict] = {}
        self.agent_orchestrator = AgentOrchestrator()

    def _get_client(self) -> Groq:
        """Get Groq client with current dynamic settings"""
        config = settings_manager.get_model_config()
        
        if not config["api_key"]:
            raise ValueError("No API key configured. Please set your Groq API key in settings.")
            
        if not settings_manager.is_valid_api_key(config["api_key"]):
            raise ValueError("Invalid API key format. Please check your Groq API key in settings.")
            
        return Groq(api_key=config["api_key"])

    def create_conversation(self, chat_id: Optional[str] = None) -> str:
        """Create a new conversation with auto-generated ID"""
        try:
            if chat_id is None:
                chat_id = str(uuid.uuid4())[:8]
            
            conversation_folder = CHAT_DIR / chat_id
            conversation_folder.mkdir(exist_ok=True)
            
            base_instructions = (
                settings_manager.get("system_instructions") or 
                MAIN_CHAT_SYSTEM_INSTRUCTIONS
            )
            
            self.conversations[chat_id] = {
                "conversation_id": chat_id,
                "created_at": datetime.now(timezone.utc).isoformat(),
                "conversation_folder": str(conversation_folder),
                "system_instructions": {
                    "role": "system",
                    "content": base_instructions
                },
                "chat_history": []
            }
            
            self._save_main_conversation(chat_id)
            return chat_id
            
        except Exception as e:
            import traceback
            traceback.print_exc()
            raise

    def add_message(self, chat_id: str, role: str, content: str, hidden: bool = False, **kwargs) -> Dict[str, Any]:
        """Add message to conversation with support for hidden messages"""
        if chat_id not in self.conversations:
            self.create_conversation(chat_id)

        message = {
            "id": str(uuid.uuid4())[:8],
            "role": role,
            "content": content,
            "timestamp": datetime.now(timezone.utc).isoformat(),
            "hidden": hidden,
            **kwargs
        }

        self.conversations[chat_id]["chat_history"].append(message)
        self._save_main_conversation(chat_id)
        return message

    def get_hidden_reference_docs(self, chat_id: str) -> List[str]:
        """Extract reference document paths from hidden messages"""
        if chat_id not in self.conversations:
            return []
        
        ref_docs = []
        for msg in self.conversations[chat_id]["chat_history"]:
            if (msg.get("hidden") and 
                msg["content"].startswith("[REFERENCE_DOC]:")):
                path = msg["content"].split(":", 1)[1]
                ref_docs.append(path)
        
        return ref_docs

    def is_web_search_enabled(self, chat_id: str) -> bool:
        """Check if web search is enabled from hidden messages or global setting"""
        if chat_id not in self.conversations:
            return settings_manager.get("web_search_enabled", True)
        
        # Check most recent web search toggle (latest takes precedence)
        for msg in reversed(self.conversations[chat_id]["chat_history"]):
            if msg.get("hidden"):
                if "[WEB_SEARCH_ENABLED]" in msg["content"]:
                    return True
                elif "[WEB_SEARCH_DISABLED]" in msg["content"]:
                    return False
        
        return settings_manager.get("web_search_enabled", True)

    def _extract_response_content(self, response) -> str:
        """Safely extract content from Groq API response"""
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
        """Load conversation from disk"""
        if chat_id in self.conversations:
            return True

        conversation_folder = CHAT_DIR / chat_id
        main_chat_file = conversation_folder / "main_conversation.json"
        
        if not main_chat_file.exists():
            return False

        try:
            with open(main_chat_file, "r", encoding="utf-8") as f:
                loaded_conversation = json.load(f)
                
            # Migrate old conversations to include system instructions if missing
            if "system_instructions" not in loaded_conversation:
                base_instructions = (
                    settings_manager.get("system_instructions") or 
                    MAIN_CHAT_SYSTEM_INSTRUCTIONS
                )
                loaded_conversation["system_instructions"] = {
                    "role": "system",
                    "content": base_instructions
                }
                
            self.conversations[chat_id] = loaded_conversation
            return True
            
        except Exception as e:
            print(f"[CHAT_MANAGER] Error loading conversation {chat_id}: {e}")
            return False

    def _clean_messages_for_api(self, messages: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
        """Clean messages for API, excluding hidden messages"""
        cleaned = []
        
        for msg in messages:
            # Skip hidden messages from API
            if msg.get("hidden"):
                continue
                
            # Include visible messages
            if msg.get("role") in ["system", "user", "assistant"]:
                cleaned.append({
                    "role": msg["role"],
                    "content": msg["content"]
                })
        
        return cleaned

    def _augment_system_instructions(self, chat_id: str, base_instructions: Optional[str] = None) -> str:
        """Augment system instructions with references and web search context"""
        if base_instructions is None:
            base_instructions = (
                settings_manager.get("system_instructions") or 
                MAIN_CHAT_SYSTEM_INSTRUCTIONS
            )
        
        augmented_instructions = base_instructions
        
        # Add reference document context
        ref_docs = self.get_hidden_reference_docs(chat_id)
        if ref_docs:
            ref_context = "\n\nAVAILABLE REFERENCE DOCUMENTS:\n"
            ref_context += "\n".join(f"- {path}" for path in ref_docs)
            ref_context += "\n\nConsult these reference documents when relevant to provide accurate information."
            augmented_instructions += ref_context
        
        # Add web search context
        if self.is_web_search_enabled(chat_id):
            web_search_context = "\n\nWEB SEARCH ENABLED: Use web search tools when relevant to enhance responses with current information."
            augmented_instructions += web_search_context
        
        return augmented_instructions

    async def process_user_message(self, chat_id: str, user_message: str) -> Dict[str, Any]:
        """Process user message with dynamic settings and enhanced context"""
        
        try:
            # Validate settings before processing
            if not settings_manager.is_valid_api_key():
                error_msg = "No valid API key configured. Please set your Groq API key in settings."
                error_response = self.add_message(chat_id, "assistant", error_msg)
                return {"type": "api_error", "message": error_response}
            
            # Get current model configuration
            model_config = settings_manager.get_model_config()
            client = self._get_client()
            
            # Add user message (visible)
            self.add_message(chat_id, "user", user_message)

            # Get conversation context with augmented system instructions
            conv = self.conversations[chat_id]
            
            # Create augmented system instructions using current settings
            base_instructions = conv["system_instructions"]["content"]
            augmented_content = self._augment_system_instructions(chat_id, base_instructions)
            
            augmented_system_instructions = {
                "role": "system",
                "content": augmented_content
            }
            
            # Build message history (excluding hidden messages)
            raw_messages = [augmented_system_instructions] + conv["chat_history"]
            api_messages = self._clean_messages_for_api(raw_messages)

            # Call Groq API with current dynamic settings
            try:
                response = client.chat.completions.create(
                    model=model_config["model"],
                    messages=api_messages,
                    tools=TOOLS,
                    tool_choice="auto",
                    temperature=model_config["temperature"],
                    top_p=model_config["top_p"],
                    stream=model_config.get("stream", False)
                )
            except Exception as e:
                # Handle specific API errors
                error_str = str(e).lower()
                if "invalid api key" in error_str or "unauthorized" in error_str:
                    error_msg = "Invalid API key. Please check your Groq API key in settings."
                elif "quota" in error_str or "rate limit" in error_str:
                    error_msg = "API quota exceeded or rate limited. Please try again later."
                elif "model" in error_str and "not found" in error_str:
                    error_msg = f"Model '{model_config['model']}' not available. Please check your model selection."
                else:
                    error_msg = f"API call failed: {str(e)}"
                    
                error_response = self.add_message(chat_id, "assistant", error_msg)
                return {"type": "api_error", "message": error_response}

            # Process response
            if hasattr(response, "choices") and len(response.choices) > 0:
                choice = response.choices[0]

                # Handle tool calls
                if hasattr(choice, "message") and hasattr(choice.message, "tool_calls") and choice.message.tool_calls:
                    try:
                        tool_call = choice.message.tool_calls[0]
                        function_name = tool_call.function.name
                        arguments = json.loads(tool_call.function.arguments)

                        # Add AI's tool call intention to chat
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

                        # Process agent response
                        response_content = (agent_result.get("summary") or 
                                          agent_result.get("conclusion") or 
                                          "Analysis completed.")
                        
                        if agent_result.get("status") == "failed":
                            response_content = f"Analysis failed: {agent_result.get('error', 'Unknown error')}"

                        # Add agent response to chat
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
                    # Normal AI text response
                    content = self._extract_response_content(response)
                    if not content:
                        content = "I'm OSS_Labs, here to help with your data analysis needs."

                    assistant_msg = self.add_message(chat_id, "assistant", content)
                    return {"type": "text_response", "message": assistant_msg}

            # Fallback response
            fallback_msg = self.add_message(
                chat_id, 
                "assistant", 
                "I'm OSS_Labs, here to help with your data analysis needs."
            )
            return {"type": "text_response", "message": fallback_msg}
            
        except ValueError as e:
            # Handle settings/configuration errors
            error_response = self.add_message(chat_id, "assistant", str(e))
            return {"type": "configuration_error", "message": error_response}
        except Exception as e:
            # Handle unexpected errors
            error_msg = f"Unexpected error: {str(e)}"
            error_response = self.add_message(chat_id, "assistant", error_msg)
            return {"type": "unexpected_error", "message": error_response}

    def get_conversation_title(self, chat_id: str) -> str:
        """Generate conversation title from first user message"""
        if chat_id not in self.conversations:
            return f"Chat {chat_id[:8]}"
        
        # Find first non-hidden user message
        for msg in self.conversations[chat_id]["chat_history"]:
            if (msg.get("role") in ("user", "human") and 
                isinstance(msg.get("content"), str) and 
                msg["content"].strip() and 
                not msg.get("hidden", False)):
                
                title = msg["content"].strip()
                # Truncate long titles
                return title[:50] + "..." if len(title) > 50 else title
        
        return f"Chat {chat_id[:8]}"

    def update_conversation_system_instructions(self, chat_id: str, new_instructions: Optional[str] = None):
        """Update system instructions for a conversation"""
        if chat_id not in self.conversations:
            return False
            
        if new_instructions is None:
            new_instructions = (
                settings_manager.get("system_instructions") or 
                MAIN_CHAT_SYSTEM_INSTRUCTIONS
            )
            
        self.conversations[chat_id]["system_instructions"]["content"] = new_instructions
        self._save_main_conversation(chat_id)
        return True

    def _save_main_conversation(self, chat_id: str):
        """Save conversation to disk"""
        try:
            conversation_folder = Path(self.conversations[chat_id]["conversation_folder"])
            main_chat_file = conversation_folder / "main_conversation.json"

            # Add metadata
            self.conversations[chat_id]["updated_at"] = datetime.now(timezone.utc).isoformat()
            self.conversations[chat_id]["version"] = "2.0"  # Version for compatibility

            with open(main_chat_file, "w", encoding='utf-8') as f:
                json.dump(self.conversations[chat_id], f, indent=2, ensure_ascii=False)
        except Exception as e:
            print(f"[CHAT_MANAGER] Error saving conversation {chat_id}: {e}")

    def cleanup_conversation(self, chat_id: str):
        """Remove conversation from memory (for deletion)"""
        if chat_id in self.conversations:
            del self.conversations[chat_id]

    def get_conversation_stats(self, chat_id: str) -> Dict[str, Any]:
        """Get statistics for a conversation"""
        if chat_id not in self.conversations:
            return {
                "message_count": 0, 
                "dataset_count": 0,  # Always 0 - no dataset tracking
                "reference_doc_count": 0,
                "has_notebooks": False,
                "web_search_enabled": False
            }
        
        chat_history = self.conversations[chat_id]["chat_history"]
        visible_messages = [msg for msg in chat_history if not msg.get("hidden")]
        ref_doc_count = len(self.get_hidden_reference_docs(chat_id))
        
        # Check for notebooks
        folder = CHAT_DIR / chat_id
        has_notebooks = len(list(folder.glob("*.ipynb"))) > 0 if folder.exists() else False
        
        return {
            "message_count": len(visible_messages),
            "dataset_count": 0,  # Always 0 - no dataset tracking
            "reference_doc_count": ref_doc_count,
            "has_notebooks": has_notebooks,
            "web_search_enabled": self.is_web_search_enabled(chat_id),
            "api_key_configured": settings_manager.is_valid_api_key(),
            "current_model": settings_manager.get("model", "unknown"),
            "current_provider": settings_manager.get("provider", "unknown")
        }

    def get_model_status(self) -> Dict[str, Any]:
        """Get current model and API status"""
        config = settings_manager.get_model_config()
        
        return {
            "api_key_configured": settings_manager.is_valid_api_key(),
            "current_model": config["model"],
            "current_provider": settings_manager.get("provider", "Groq"),
            "temperature": config["temperature"],
            "top_p": config["top_p"],
            "system_instructions_custom": bool(settings_manager.get("system_instructions")),
            "web_search_global": settings_manager.get("web_search_enabled", True)
        }

    def test_api_connection(self) -> Dict[str, Any]:
        """Test API connection with current settings"""
        try:
            client = self._get_client()
            config = settings_manager.get_model_config()
            
            # Simple test call
            test_response = client.chat.completions.create(
                model=config["model"],
                messages=[{"role": "user", "content": "Hello"}],
                max_tokens=10,
                temperature=0.1
            )
            
            return {
                "status": "success",
                "message": "API connection successful",
                "model": config["model"],
                "provider": settings_manager.get("provider", "Groq")
            }
            
        except ValueError as e:
            return {
                "status": "configuration_error",
                "message": str(e)
            }
        except Exception as e:
            return {
                "status": "api_error", 
                "message": f"API test failed: {str(e)}"
            }
