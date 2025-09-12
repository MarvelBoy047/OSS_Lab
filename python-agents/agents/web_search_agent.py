import json
import uuid
import asyncio
import aiohttp
from datetime import datetime, timezone
from pathlib import Path
from typing import Dict, Any, Optional

from groq import Groq
from config import CHAT_DIR, SEARXNG_BASE_URL
from core.settings_manager import settings_manager
from tools.definitions import WEB_SEARCH_SYSTEM_INSTRUCTIONS

class WebSearchAgent:
    def __init__(self):
        self.agent_id = "web_search_agent"
        self.searxng_url = SEARXNG_BASE_URL
        self.is_available = self._check_searxng_availability()

    def _get_client(self) -> Groq:
        """Get Groq client with current dynamic settings"""
        api_key = settings_manager.get("api_key")
        if not settings_manager.is_valid_api_key(api_key):
            raise ValueError("Invalid or missing API key")
        return Groq(api_key=api_key)

    def _check_searxng_availability(self) -> bool:
        try:
            import requests
            resp = requests.get(f"{self.searxng_url}/config", timeout=3)
            return resp.status_code == 200
        except Exception:
            return False

    def _extract_response_content(self, response) -> str:
        try:
            choice = response.choices[0]  # ✅ Already correct
            return choice.message.content.strip()
        except Exception:
            return str(response).strip()


    async def _search_searxng(self, query: str, categories: str = "general") -> Dict[str, Any]:
        if not self.is_available:
            return {"success": False, "error": "SearXNG not available", "results": [], "query": query}

        params = {
            "q": query, "format": "json", "categories": categories,
            "engines": "google,bing,duckduckgo", "safesearch": "1", "pageno": "1"
        }

        try:
            async with aiohttp.ClientSession() as session:
                async with session.get(f"{self.searxng_url}/search", params=params, timeout=15) as resp:
                    if resp.status != 200:
                        return {"success": False, "error": f"Status {resp.status}", "results": [], "query": query}

                    data = await resp.json()
                    results = []
                    for r in data.get("results", [])[:10]:
                        results.append({
                            "title": r.get("title", ""), "url": r.get("url", ""),
                            "content": r.get("content", "")[:500], "engine": r.get("engine", "")
                        })

                    return {"success": True, "results": results, "query": query, "total_results": len(results)}

        except Exception as e:
            return {"success": False, "error": str(e), "results": [], "query": query}

    def _generate_search_summary(self, search_data: Dict[str, Any]) -> str:
        if not search_data.get("success") or not search_data.get("results"):
            return f"Search failed: {search_data.get('error', 'No results')}"

        context = f"Search Query: {search_data['query']}\n\n"
        for i, r in enumerate(search_data["results"][:5], 1):
            context += f"{i}. {r['title']}\n {r['content'][:200]}...\n Source: {r['url']}\n\n"

        try:
            client = self._get_client()
            model = settings_manager.get("model")

            resp = client.chat.completions.create(
                model=model,
                messages=[
                    {"role": "system", "content": WEB_SEARCH_SYSTEM_INSTRUCTIONS},
                    {"role": "user", "content": f"Summarize these results:\n{context}"}
                ],
                max_tokens=800, temperature=0.3
            )

            return self._extract_response_content(resp)

        except Exception:
            top = search_data["results"][0]
            return f"Top result: {top['title']} - {top['content'][:100]}..."

    async def process_tool_call(self, tool_call: Dict[str, Any], parent_chat_id: str = None) -> Dict[str, Any]:
        session_id = uuid.uuid4().hex[:8]
        ts = datetime.now(timezone.utc).isoformat()

        folder = CHAT_DIR / (parent_chat_id or session_id)
        folder.mkdir(parents=True, exist_ok=True)

        raw_file = folder / f"search_raw_{session_id}.json"
        conv_file = folder / f"{self.agent_id}_{session_id}.json"

        query = tool_call["arguments"].get("query", "").strip()
        cat = tool_call["arguments"].get("categories", "general")

        if not query:
            return {
                "agent_id": self.agent_id,
                "summary": "Query empty",
                "status": "failed",
                "error": "Empty query",
                "timestamp": ts
            }

        data = await self._search_searxng(query, cat)

        with open(raw_file, "w") as f:
            json.dump(data, f, indent=2)

        if data.get("success"):
            summary = self._generate_search_summary(data)
            status = "completed"
        else:
            summary = f"Search failed: {data.get('error')}"
            status = "failed"

        result = {
            "agent_id": self.agent_id,
            "summary": summary,
            "status": status,
            "timestamp": ts,
            "raw_data_file": str(raw_file)
        }

        with open(conv_file, "w") as f:
            json.dump(result, f, indent=2)

        return result

    def is_enabled(self) -> bool:
        return self.is_available

    def get_status(self) -> Dict[str, Any]:
        return {
            "agent_id": self.agent_id,
            "is_available": self.is_available,
            "url": self.searxng_url
        }
