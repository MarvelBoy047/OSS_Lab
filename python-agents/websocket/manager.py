# websocket/manager.py

import json
from typing import Dict, Set
from fastapi import WebSocket

class WebSocketMultiManager:
    def __init__(self):
        # key: (route, chat_id), value: set of active WebSocket connections
        self.active_connections: Dict[tuple[str, str], Set[WebSocket]] = {}

    async def connect(self, websocket: WebSocket, chat_id: str, route: str):
        """
        Accept a new WebSocket connection and register it.
        """
        await websocket.accept()
        key = (route, chat_id)
        if key not in self.active_connections:
            self.active_connections[key] = set()
        self.active_connections[key].add(websocket)
        # Notify connection established
        await self.send(route, chat_id, {
            "type": "connection_established",
            "route": route,
            "chat_id": chat_id,
            "message": "WebSocket connected successfully"
        })

    def disconnect(self, websocket: WebSocket, chat_id: str, route: str):
        """
        Remove a WebSocket connection.
        """
        key = (route, chat_id)
        if key in self.active_connections and websocket in self.active_connections[key]:
            self.active_connections[key].remove(websocket)
            if not self.active_connections[key]:
                del self.active_connections[key]

    async def send(self, route: str, chat_id: str, message: dict):
        """
        Send a JSON message to all WebSockets registered for given route and chat_id.
        Removes closed/broken connections.
        """
        key = (route, chat_id)
        connections = self.active_connections.get(key, set())
        disconnected = set()
        for ws in connections:
            try:
                await ws.send_text(json.dumps(message))
            except Exception:
                disconnected.add(ws)
        for ws in disconnected:
            self.disconnect(ws, chat_id, route)

    async def broadcast_tool_call(self, chat_id: str, tool_call: dict):
        """
        Broadcast tool call event to 'chat' route listeners for chat_id.
        """
        msg = {
            "type": "tool_call_triggered",
            "chat_id": chat_id,
            "tool_name": tool_call.get("function_name"),
            "arguments": tool_call.get("arguments"),
            "timestamp": tool_call.get("timestamp")
        }
        await self.send("chat", chat_id, msg)

# Singleton instance
manager = WebSocketMultiManager()
