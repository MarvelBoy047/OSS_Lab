import json
import uuid
import asyncio
import tempfile
import subprocess
import sys
import os
from datetime import datetime, timezone
from pathlib import Path
from groq import Groq

from config import CHAT_DIR
from core.settings_manager import settings_manager
from tools.definitions import METADATA_AGENT_SYSTEM_INSTRUCTIONS

class MetadataAgent:
    def __init__(self):
        self.agent_id = "metadata_agent"

    def _get_client(self) -> Groq:
        """Get Groq client with current dynamic settings"""
        api_key = settings_manager.get("api_key")
        if not settings_manager.is_valid_api_key(api_key):
            raise ValueError("Invalid or missing API key")
        return Groq(api_key=api_key)

    def _fix_file_path(self, file_path: str) -> str:
        """Convert to proper file path"""
        if file_path.startswith('/data/'):
            return str(Path("data") / file_path[6:])
        return str(Path(file_path).resolve())

    def _extract_response_content(self, response) -> str:
        """Extract content from Groq response with detailed debugging"""
        try:
            print(f"[METADATA_AGENT] Raw response type: {type(response)}")
            print(f"[METADATA_AGENT] Response attributes: {dir(response)}")

            if hasattr(response, "choices") and len(response.choices) > 0:
                print(f"[METADATA_AGENT] Choices count: {len(response.choices)}")
                first_choice = response.choices[0]
                print(f"[METADATA_AGENT] First choice type: {type(first_choice)}")
                print(f"[METADATA_AGENT] Choice attributes: {dir(first_choice)}")

                if hasattr(first_choice, "message") and hasattr(first_choice.message, "content"):
                    content = first_choice.message.content
                    print(f"[METADATA_AGENT] Content type: {type(content)}")
                    print(f"[METADATA_AGENT] Content length: {len(content) if content else 0}")
                    print(f"[METADATA_AGENT] Content preview: {str(content)[:200]}...")
                    return content.strip() if content else ""
                else:
                    print(f"[METADATA_AGENT] No message.content attribute")
                    return str(first_choice).strip()
            else:
                print(f"[METADATA_AGENT] No choices in response")
                return str(response).strip()
        except Exception as e:
            print(f"[METADATA_AGENT] Exception in content extraction: {e}")
            import traceback
            print(f"[METADATA_AGENT] Full traceback: {traceback.format_exc()}")
            return ""

    
    def _clean_generated_code(self, raw_code: str) -> str:
        """Clean AI-generated code properly without breaking syntax"""
        if not raw_code or not raw_code.strip():
            raise ValueError("Generated code is empty")
        
        code = raw_code.strip()
        
        # Handle ```python blocks
        if code.startswith("```python"):
            code = code[len("```python"):].strip()
            if code.endswith("```"):
                code = code[:-3].strip()
        # Handle ``` blocks without language specifier
        elif code.startswith("```"):
            code = code[3:].strip()
            if code.endswith("```"):
                code = code[:-3].strip()
        
        if not code:
            raise ValueError("Code is empty after cleaning")
        
        # Validate basic Python syntax
        try:
            compile(code, '<string>', 'exec')
        except SyntaxError as e:
            raise ValueError(f"Generated code has syntax error: {e}")
        
        return code

    async def process_tool_call(self, tool_call: dict, parent_chat_id: str = None) -> dict:
        """Process metadata analysis tool call"""
        agent_session_id = str(uuid.uuid4())[:8]

        try:
            # Create conversation folder
            if parent_chat_id:
                conversation_folder = CHAT_DIR / parent_chat_id
                conversation_folder.mkdir(exist_ok=True)
            else:
                conversation_folder = CHAT_DIR
                parent_chat_id = str(uuid.uuid4())[:8]

            agent_conversation_file = conversation_folder / f"{self.agent_id}_{agent_session_id}.json"

            # Extract and validate parameters
            file_path = self._fix_file_path(tool_call["arguments"].get("file_path", ""))
            instructions = tool_call["arguments"].get("instructions", "quick metadata analysis")

            # Validate file exists
            if not Path(file_path).exists():
                error_msg = f"File not found: {file_path}"
                return {
                    "agent_id": self.agent_id,
                    "summary": f"Could not analyze dataset. {error_msg}",
                    "status": "failed",
                    "error": error_msg,
                    "timestamp": datetime.now(timezone.utc).isoformat()
                }

            # Generate code using AI with dynamic settings
            client = self._get_client()
            model = settings_manager.get("model")

            # Create focused prompt for metadata analysis
            code_prompt = f"""Generate Python code for dataset metadata analysis.

File: {file_path}
Instructions: {instructions}

Requirements:
- Use pandas to read the file
- Show shape, columns, data types, missing values, basic statistics
- Handle file reading errors with try-except
- Keep code under 15 lines
- Output only executable Python code, no explanations

Generate clean, working Python code:"""

            response = client.chat.completions.create(
                model=model,
                messages=[
                    {"role": "system", "content": METADATA_AGENT_SYSTEM_INSTRUCTIONS},
                    {"role": "user", "content": code_prompt}
                ],
                max_tokens=6000,
                temperature=0.7
            )

            # Extract and clean generated code
            raw_code = self._extract_response_content(response)
            if not raw_code:
                raise Exception("AI failed to generate code")

            try:
                generated_code = self._clean_generated_code(raw_code)
            except ValueError as e:
                raise Exception(f"Code cleaning failed: {e}")

            print(f"[METADATA_AGENT] Generated code:\n{generated_code}")

            # Execute the cleaned code
            execution_result = await self._execute_code_async(generated_code)

            if not execution_result["success"]:
                raise Exception(f"Code execution failed: {execution_result['stderr']}")

            # Generate summary using AI
            summary = await self._generate_summary(execution_result, file_path)

            if not summary:
                raise Exception("AI failed to generate summary")

            # Save agent conversation
            agent_conversation = {
                "agent_session_id": agent_session_id,
                "parent_chat_id": parent_chat_id,
                "agent_id": self.agent_id,
                "timestamp": datetime.now(timezone.utc).isoformat(),
                "tool_call": tool_call,
                "file_path": file_path,
                "generated_code": generated_code,
                "execution_result": execution_result,
                "summary": summary,
                "status": "completed"
            }

            with open(agent_conversation_file, 'w', encoding='utf-8') as f:
                json.dump(agent_conversation, f, indent=2)

            return {
                "agent_id": self.agent_id,
                "summary": summary,
                "agent_conversation_file": str(agent_conversation_file),
                "status": "completed",
                "timestamp": datetime.now(timezone.utc).isoformat()
            }

        except Exception as e:
            print(f"[METADATA_AGENT] Error: {e}")
            return {
                "agent_id": self.agent_id,
                "summary": f"Analysis failed: {str(e)}",
                "status": "failed",
                "error": str(e),
                "timestamp": datetime.now(timezone.utc).isoformat()
            }

    async def _execute_code_async(self, code: str) -> dict:
        """Execute code asynchronously"""
        return await asyncio.get_event_loop().run_in_executor(None, self._execute_code, code)

    def _execute_code(self, code: str) -> dict:
        """Execute Python code in subprocess"""
        try:
            with tempfile.NamedTemporaryFile(mode='w', suffix='.py', delete=False, encoding='utf-8') as f:
                f.write(code)
                temp_file = f.name

            result = subprocess.run(
                [sys.executable, temp_file], 
                capture_output=True, 
                text=True, 
                timeout=15, 
                cwd=Path.cwd()
            )
            
            os.unlink(temp_file)

            return {
                "stdout": result.stdout.strip(),
                "stderr": result.stderr.strip(),
                "return_code": result.returncode,
                "success": result.returncode == 0
            }

        except Exception as e:
            return {
                "stdout": "", 
                "stderr": str(e), 
                "return_code": -1, 
                "success": False
            }

    async def _generate_summary(self, execution_result: dict, file_path: str) -> str:
        """Generate summary from execution results"""
        try:
            client = self._get_client()
            model = settings_manager.get("model")

            summary_prompt = f"""Dataset analysis completed for {file_path}.

Execution output:
{execution_result['stdout']}

Generate a concise, professional summary explaining what was found in the dataset. Include key insights about the data structure, quality, and potential analysis opportunities."""

            response = client.chat.completions.create(
                model=model,
                messages=[
                    {"role": "system", "content": "Generate a clear, professional analysis summary."},
                    {"role": "user", "content": summary_prompt}
                ],
                max_tokens=5000,
                temperature=0.6
            )

            return self._extract_response_content(response)
        except Exception as e:

            return f"Analysis completed but summary generation failed: {e}"
