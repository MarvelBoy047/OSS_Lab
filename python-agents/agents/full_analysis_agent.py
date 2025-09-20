import json
import uuid
import asyncio
from datetime import datetime, timezone
from pathlib import Path
from groq import Groq

from config import CHAT_DIR
from core.settings_manager import settings_manager
from tools.definitions import FULLY_CONTROLLED_INSTRUCTIONS
from utils.notebook_executor import NotebookExecutor

class FullAnalysisAgent:
    def __init__(self):
        self.agent_id = "full_analysis_agent"
        self.notebook_executor = NotebookExecutor()

    def _get_client(self) -> Groq:
        """Get Groq client with current dynamic settings"""
        api_key = settings_manager.get("api_key")
        if not settings_manager.is_valid_api_key(api_key):
            raise ValueError("Invalid or missing API key")
        return Groq(api_key=api_key)

    def _fix_path(self, path: str) -> str:
        """Convert path to absolute path"""
        return str(Path(path).expanduser().resolve())

    def _extract_content(self, response):
        """Extract content from Groq response"""
        try:
            choice = response.choices[0]
            return getattr(choice.message, "content", str(choice)).strip()
        except Exception as e:
            print(f"[AGENT] Error extracting content: {e}")
            return ""

    def _save_conversation_checkpoint(self, conv_file: Path, agent_flow: list, tool_call: dict,
                                    parent_id: str, session_id: str, notebook_path: str,
                                    cell_count: int, status: str = "in_progress"):
        """Save conversation state after each step for live UI updates"""
        try:
            conversation_data = {
                "agent_session_id": session_id,
                "parent_id": parent_id,
                "agent_id": self.agent_id,
                "timestamp": datetime.now(timezone.utc).isoformat(),
                "tool_call": tool_call,
                "agent_flow": agent_flow,
                "notebook_path": str(notebook_path),
                "status": status,
                "cells_executed": cell_count,
                "last_updated": datetime.now(timezone.utc).isoformat()
            }

            # Atomic write for thread safety
            temp_file = conv_file.with_suffix('.tmp')
            with open(temp_file, "w", encoding="utf-8") as f:
                json.dump(conversation_data, f, indent=2)
            temp_file.replace(conv_file)

            print(f"[AGENT] Checkpoint saved - Status: {status}, Cells: {cell_count}")

        except Exception as e:
            print(f"[AGENT] Error saving checkpoint: {e}")

    def _create_critical_reminder(self, feedback: str = "") -> str:
        """Create critical reminder that's sent with every user message"""
        base_reminder = """🚨 CRITICAL REMINDER - NEVER FORGET:

- Output exactly ONE JSON object with ONE key only
- Choose from: "python", "markdown", "visualization", "conclusion"
- Code cells: 5-15 lines maximum
- NEVER combine multiple objects or keys
- ONLY 40 cells are allowed in total even visualization cell or markdown cell are considered as a cell count.
- THIS IS ABSOLUTE - VIOLATION BREAKS THE SYSTEM

"""
        return base_reminder + feedback

    async def process(self, tool_call: dict, parent_id=None) -> dict:
        """Main processing method for full dataset analysis"""
        session_id = uuid.uuid4().hex[:8]
        folder = Path(CHAT_DIR) / (parent_id or uuid.uuid4().hex[:8])
        folder.mkdir(parents=True, exist_ok=True)
        conv_file = folder / f"{self.agent_id}_{session_id}.json"

        # Get inputs from tool_call with validation
        try:
            file_path = self._fix_path(tool_call["arguments"]["file_path"])
            tasks = tool_call.get("arguments", {}).get("tasks", [])
            instructions = tool_call.get("arguments", {}).get("instructions", "")
        except Exception as e:
            return {"error": f"Invalid tool call arguments: {e}", "status": "failed"}

        # Validate file exists
        if not Path(file_path).exists():
            return {"error": f"File not found: {file_path}", "status": "failed"}

        # Create notebook with error handling
        try:
            notebooks = list(folder.glob("analysis_*.ipynb"))
            notebook_path = notebooks[0] if notebooks else folder / f"analysis_{session_id}.ipynb"
            
            if not notebooks:
                notebook_created = self.notebook_executor.create_notebook(str(notebook_path))
                if not notebook_created:
                    return {"error": "Failed to create notebook", "status": "failed"}

        except Exception as e:
            return {"error": f"Notebook creation failed: {e}", "status": "failed"}

        # Initialize conversation with enhanced system instructions
        agent_flow = [
            {"role": "system", "content": FULLY_CONTROLLED_INSTRUCTIONS},
            {"role": "user", "content": self._create_critical_reminder() +
                f"Analyze dataset at {file_path}\nTasks: {tasks}\nInstructions: {instructions}"}
        ]

        messages = agent_flow.copy()

        # Initialize counters and status
        cell_count = 0
        step_count = 0
        done = False
        final_conclusion = ""
        max_steps = 100  # Prevent infinite loops

        # Save initial state
        self._save_conversation_checkpoint(conv_file, agent_flow, tool_call, parent_id,
                                         session_id, notebook_path, cell_count, "started")

        try:
            while not done and step_count < max_steps:
                step_count += 1
                print(f"[AGENT] Processing step {step_count}/{max_steps}")

                try:
                    # Get client and model config dynamically
                    client = self._get_client()
                    model_config = settings_manager.get_model_config()

                    # Call Groq API with current dynamic settings
                    response = client.chat.completions.create(
                        model=model_config["model"],
                        messages=messages,
                        max_tokens=20000,  # Reduced to prevent overly long responses
                        temperature=model_config["temperature"],
                        top_p=model_config["top_p"],
                        tool_choice="none"  # Prevent function calling
                    )

                    content = self._extract_content(response)

                    if not content:
                        print("[AGENT] No content received, breaking loop")
                        break

                    print(f"[AGENT] Received response: {content[:150]}...")

                    # Add AI response to conversation flows
                    ai_message = {"role": "assistant", "content": content}
                    agent_flow.append(ai_message)
                    messages.append(ai_message)

                    # Save checkpoint after AI response
                    self._save_conversation_checkpoint(conv_file, agent_flow, tool_call, parent_id,
                                                     session_id, notebook_path, cell_count, "processing")

                    # Parse AI response with enhanced error handling
                    try:
                        parsed = json.loads(content)
                        if not isinstance(parsed, dict):
                            raise ValueError("Response is not a JSON object")

                        # Validate single key rule
                        if len(parsed.keys()) != 1:
                            raise ValueError(f"Multiple keys found: {list(parsed.keys())}")

                        print(f"[AGENT] Parsed JSON with key: {list(parsed.keys())[0]}")

                    except (json.JSONDecodeError, ValueError) as e:
                        print(f"[AGENT] JSON/validation error: {e}")
                        # Handle malformed response by treating as markdown
                        self.notebook_executor.add_markdown_cell(str(notebook_path),
                                                                f"### Malformed Response\n``````")

                        # Send recovery message
                        user_message = {"role": "user", "content": self._create_critical_reminder(
                            "Previous response was malformed. Please provide valid JSON with ONE key only.")}
                        agent_flow.append(user_message)
                        messages.append(user_message)
                        continue

                    # Process different response types
                    if isinstance(parsed, dict):
                        key = list(parsed.keys())[0]
                        
                        if key == "conclusion":
                            done = True
                            final_conclusion = parsed["conclusion"]
                            self.notebook_executor.add_markdown_cell(str(notebook_path),
                                                                    f"## Final Conclusion\n\n{final_conclusion}")
                            print("[AGENT] Analysis completed with conclusion")
                            break

                        elif key == "python":
                            cell_count += 1
                            code = parsed["python"]
                            print(f"[AGENT] Executing Python code cell #{cell_count}")

                            # Execute code with comprehensive error handling
                            try:
                                exec_res = await self.notebook_executor.execute_code_cell(
                                    str(notebook_path), code, cell_count)
                            except Exception as exec_error:
                                exec_res = {
                                    "success": False,
                                    "error": f"Execution exception: {exec_error}",
                                    "output": "",
                                    "stderr": str(exec_error)
                                }

                            # Process execution results
                            if exec_res.get("success"):
                                if exec_res.get("is_graph", False):
                                    feedback = "Visualization generated successfully in notebook."
                                else:
                                    stdout = exec_res.get("output", "").strip()
                                    stderr = exec_res.get("stderr", "").strip()
                                    if stdout:
                                        feedback = f"Output: {stdout[:500]}..."  # Limit output length
                                    elif stderr and "warning" in stderr.lower():
                                        feedback = f"Warning: {stderr[:200]}..."
                                    else:
                                        feedback = "Code executed successfully with no output."
                            else:
                                error_msg = exec_res.get('error', 'Unknown error')
                                feedback = f"Execution failed: {error_msg[:300]}..."

                            # Continue conversation with execution feedback
                            user_message = {"role": "user", "content": self._create_critical_reminder(feedback)}
                            agent_flow.append(user_message)
                            messages.append(user_message)

                        elif key == "markdown":
                            markdown_text = parsed["markdown"]
                            self.notebook_executor.add_markdown_cell(str(notebook_path), markdown_text)
                            print(f"[AGENT] Added markdown cell")

                            # Continue conversation
                            user_message = {"role": "user", "content": self._create_critical_reminder(
                                "Continue with next step")}
                            agent_flow.append(user_message)
                            messages.append(user_message)

                        elif key == "visualization":
                            cell_count += 1
                            vis_code = parsed["visualization"]
                            print(f"[AGENT] Executing visualization cell #{cell_count}")

                            # Execute visualization with error handling
                            try:
                                exec_res = await self.notebook_executor.execute_code_cell(
                                    str(notebook_path), vis_code, cell_count)
                            except Exception as exec_error:
                                exec_res = {
                                    "success": False,
                                    "error": f"Visualization exception: {exec_error}",
                                    "output": "",
                                    "stderr": str(exec_error)
                                }

                            feedback = ("Visualization generated successfully in notebook"
                                      if exec_res.get("success")
                                      else f"Visualization failed: {exec_res.get('error', 'Unknown error')}")

                            # Continue conversation
                            user_message = {"role": "user", "content": self._create_critical_reminder(feedback)}
                            agent_flow.append(user_message)
                            messages.append(user_message)

                        else:
                            # Unknown key - treat as markdown but warn
                            print(f"[AGENT] Unknown JSON key: {key}")
                            self.notebook_executor.add_markdown_cell(str(notebook_path),
                                                                    f"### Unknown Response Type\n``````")

                            user_message = {"role": "user", "content": self._create_critical_reminder(
                                f"Unknown key '{key}'. Use only: python, markdown, visualization, conclusion")}
                            agent_flow.append(user_message)
                            messages.append(user_message)

                    # Save checkpoint after processing step
                    self._save_conversation_checkpoint(conv_file, agent_flow, tool_call, parent_id,
                                                     session_id, notebook_path, cell_count, "processing")

                except Exception as step_error:
                    print(f"[AGENT] Error in processing step {step_count}: {step_error}")
                    # Add error to notebook
                    self.notebook_executor.add_markdown_cell(str(notebook_path),
                                                            f"### Error in Step {step_count}\n``````")

                    # Try to recover
                    user_message = {"role": "user", "content": self._create_critical_reminder(
                        f"Error occurred: {step_error}. Please continue with next step.")}
                    agent_flow.append(user_message)
                    messages.append(user_message)

                    # Save error checkpoint
                    self._save_conversation_checkpoint(conv_file, agent_flow, tool_call, parent_id,
                                                     session_id, notebook_path, cell_count, "error_recovered")

        except Exception as e:
            print(f"[AGENT] Critical error in main loop: {e}")
            final_conclusion = f"Analysis failed due to critical error: {e}"
            done = True

        # Determine final status
        if step_count >= max_steps:
            final_conclusion = f"Analysis incomplete - reached maximum steps ({max_steps})"
            status = "incomplete"
        elif not done and not final_conclusion:
            final_conclusion = "Analysis incomplete - ended without conclusion"
            status = "incomplete"
        elif final_conclusion and "failed" in final_conclusion.lower():
            status = "failed"
        else:
            status = "completed"

        # Save final conversation state
        final_conversation_data = {
            "agent_session_id": session_id,
            "parent_id": parent_id,
            "agent_id": self.agent_id,
            "timestamp": datetime.now(timezone.utc).isoformat(),
            "tool_call": tool_call,
            "agent_flow": agent_flow,
            "notebook_path": str(notebook_path),
            "conclusion": final_conclusion,
            "status": status,
            "cells_executed": cell_count,
            "steps_processed": step_count
        }

        try:
            with open(conv_file, "w", encoding="utf-8") as f:
                json.dump(final_conversation_data, f, indent=2)
        except Exception as save_error:
            print(f"[AGENT] Error saving final conversation: {save_error}")

        # Clean up notebook executor
        try:
            self.notebook_executor.shutdown()
        except Exception as cleanup_error:
            print(f"[AGENT] Error during cleanup: {cleanup_error}")

        # Return comprehensive result
        return {
            "agent_id": self.agent_id,
            "conclusion": final_conclusion,
            "notebook_path": str(notebook_path),
            "agent_conversation_file": str(conv_file),
            "status": status,
            "cells_executed": cell_count,
            "steps_processed": step_count,
        }


