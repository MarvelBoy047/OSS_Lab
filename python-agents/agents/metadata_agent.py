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
from config import MODELS, CHAT_DIR
from tools.definitions import METADATA_AGENT_SYSTEM_INSTRUCTIONS

class MetadataAgent:
    def __init__(self):
        self.client = Groq(api_key=MODELS["default"]["api_key"])
        self.agent_id = "metadata_agent"

    def _fix_file_path(self, file_path: str) -> str:
        if file_path.startswith('/data/'):
            return str(Path("data") / file_path[6:])
        return file_path

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

    async def process_tool_call(self, tool_call: dict, parent_chat_id: str = None) -> dict:
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

            # Extract parameters
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

            # Generate code using AI ONLY
            code_prompt = f"""Generate Python code for dataset metadata analysis.
File: {file_path}
Instructions: {instructions}

Generate clean, executable Python code only."""

            response = self.client.chat.completions.create(
                model=MODELS["default"]["model"],
                messages=[
                    {"role": "system", "content": METADATA_AGENT_SYSTEM_INSTRUCTIONS},
                    {"role": "user", "content": code_prompt}
                ],
                max_tokens=600,
                temperature=0.1
            )

            # Extract generated code
            generated_code = self._extract_response_content(response)

            if not generated_code:
                raise Exception("AI failed to generate code")

            # Clean code formatting
            if "```python" in generated_code:
                generated_code = generated_code.split("```python")[1]
                if "```" in generated_code:
                    generated_code = generated_code.split("```")[0].strip()
            elif "```" in generated_code:
                generated_code = generated_code.split("```")[1]
                if "```" in generated_code:
                    generated_code = generated_code.split("```")[0].strip()

            if not generated_code:
                raise Exception("Generated code is empty after cleaning")

            # Execute the AI-generated code
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
            return {
                "agent_id": self.agent_id,
                "summary": f"Analysis failed: {str(e)}",
                "status": "failed",
                "error": str(e),
                "timestamp": datetime.now(timezone.utc).isoformat()
            }

    async def _execute_code_async(self, code: str) -> dict:
        return await asyncio.get_event_loop().run_in_executor(None, self._execute_code, code)

    def _execute_code(self, code: str) -> dict:
        try:
            with tempfile.NamedTemporaryFile(mode='w', suffix='.py', delete=False, encoding='utf-8') as f:
                f.write(code)
                temp_file = f.name

            result = subprocess.run([sys.executable, temp_file], capture_output=True, text=True, timeout=15, cwd=Path.cwd())
            os.unlink(temp_file)

            return {
                "stdout": result.stdout.strip(),
                "stderr": result.stderr.strip(),
                "return_code": result.returncode,
                "success": result.returncode == 0
            }
        except Exception as e:
            return {"stdout": "", "stderr": str(e), "return_code": -1, "success": False}

    async def _generate_summary(self, execution_result: dict, file_path: str) -> str:
        summary_prompt = f"""Dataset analysis completed for {file_path}.

Execution output:
{execution_result['stdout']}

Generate a concise, professional summary explaining what was found in the dataset."""

        response = self.client.chat.completions.create(
            model=MODELS["default"]["model"],
            messages=[
                {"role": "system", "content": "Generate a clear, professional analysis summary."},
                {"role": "user", "content": summary_prompt}
            ],
            max_tokens=5000,
            temperature=0.6
        )

        return self._extract_response_content(response)
