# websocket/manager.py

import json
import asyncio
from typing import Dict, Set, List
from fastapi import WebSocket
from datetime import datetime, timezone


class WebSocketMultiManager:
    def __init__(self):
        # key: (route, chat_id), value: set of active WebSocket connections
        self.active_connections: Dict[tuple[str, str], Set[WebSocket]] = {}

    async def connect(self, websocket: WebSocket, chat_id: str, route: str):
        """
        Accept a new WebSocket connection and register it.
        """
        try:
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
                "message": "WebSocket connected successfully",
                "timestamp": datetime.now(timezone.utc).isoformat()
            })
            
        except Exception as e:
            print(f"[WebSocket] Failed to connect {route}/{chat_id}: {e}")

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
        connections = self.active_connections.get(key, set()).copy()

        if not connections:
            return

        disconnected = set()
        for ws in connections:
            try:
                await ws.send_text(json.dumps(message))
            except Exception:
                disconnected.add(ws)

        # Clean up disconnected websockets
        for ws in disconnected:
            self.disconnect(ws, chat_id, route)

    async def broadcast_to_all_routes(self, message: dict):
        """
        Broadcast a message to all connected WebSocket clients across all routes.
        Used for dashboard updates, new conversation creation, etc.
        """
        all_websockets = []
        for connections in self.active_connections.values():
            all_websockets.extend(connections)

        if not all_websockets:
            return

        # Add timestamp to broadcast messages
        message["broadcast_timestamp"] = datetime.now(timezone.utc).isoformat()

        disconnected = []
        for ws in all_websockets:
            try:
                await ws.send_text(json.dumps(message))
            except Exception:
                disconnected.append(ws)

        # Clean up broken connections
        await self._cleanup_disconnected_websockets(disconnected)

    async def broadcast_to_route(self, route: str, message: dict):
        """
        Broadcast to all connections on a specific route (e.g., all dashboard connections).
        """
        matching_connections = []
        for (r, _), connections in self.active_connections.items():
            if r == route:
                matching_connections.extend(connections)

        if not matching_connections:
            return

        disconnected = []
        for ws in matching_connections:
            try:
                await ws.send_text(json.dumps(message))
            except Exception:
                disconnected.append(ws)

        await self._cleanup_disconnected_websockets(disconnected)

    async def broadcast_conversation_created(self, chat_id: str, title: str):
        """
        Broadcast new conversation creation to all connected clients.
        """
        message = {
            "type": "conversation_created",
            "chat_id": chat_id,
            "title": title,
            "created_at": datetime.now(timezone.utc).isoformat(),
            "has_notebook": False,
            "notebook_count": 0,
            "dataset_count": 0,
            "focusMode": "webSearch"
        }
        await self.broadcast_to_all_routes(message)

    async def broadcast_conversation_deleted(self, chat_id: str):
        """
        Broadcast conversation deletion to all connected clients.
        """
        message = {
            "type": "conversation_deleted",
            "chat_id": chat_id,
            "timestamp": datetime.now(timezone.utc).isoformat()
        }
        await self.broadcast_to_all_routes(message)

    async def broadcast_dataset_uploaded(self, chat_id: str, filename: str):
        """
        Broadcast dataset upload event to relevant clients.
        """
        message = {
            "type": "dataset_uploaded",
            "chat_id": chat_id,
            "filename": filename,
            "timestamp": datetime.now(timezone.utc).isoformat()
        }
        # Send to specific chat and broadcast to dashboard
        await self.send("chat", chat_id, message)
        await self.broadcast_to_route("dashboard", message)

    async def broadcast_message_processed(self, chat_id: str, result: dict):
        """
        Broadcast message processing completion to chat clients.
        """
        message = {
            "type": "message_processed",
            "chat_id": chat_id,
            "result": result,
            "timestamp": datetime.now(timezone.utc).isoformat()
        }
        await self.send("chat", chat_id, message)

    async def broadcast_tool_call_triggered(self, chat_id: str, tool_call: dict):
        """
        Broadcast tool call initiation to chat clients.
        """
        message = {
            "type": "tool_call_triggered",
            "chat_id": chat_id,
            "tool_name": tool_call.get("function_name"),
            "arguments": tool_call.get("arguments"),
            "timestamp": datetime.now(timezone.utc).isoformat()
        }
        await self.send("chat", chat_id, message)

    async def broadcast_notebook_generated(self, chat_id: str, notebook_path: str):
        """
        Broadcast notebook generation completion.
        """
        message = {
            "type": "notebook_generated",
            "chat_id": chat_id,
            "notebook_path": notebook_path,
            "timestamp": datetime.now(timezone.utc).isoformat()
        }
        await self.send("chat", chat_id, message)
        await self.send("notebook", chat_id, message)

    async def broadcast_web_search_toggled(self, chat_id: str, enabled: bool):
        """
        Broadcast web search toggle status change.
        """
        message = {
            "type": "websearch_toggled",
            "chat_id": chat_id,
            "enabled": enabled,
            "timestamp": datetime.now(timezone.utc).isoformat()
        }
        await self.send("chat", chat_id, message)

    async def notify_typing_indicator(self, chat_id: str, is_typing: bool = True):
        """
        Send typing indicator to chat clients.
        """
        message = {
            "type": "typing_indicator",
            "chat_id": chat_id,
            "is_typing": is_typing,
            "timestamp": datetime.now(timezone.utc).isoformat()
        }
        await self.send("chat", chat_id, message)

    async def _cleanup_disconnected_websockets(self, disconnected_websockets: List[WebSocket]):
        """
        Helper method to clean up disconnected websockets from all routes.
        """
        for ws in disconnected_websockets:
            # Find and remove the websocket from active connections
            keys_to_update = []
            for key, connections in self.active_connections.items():
                if ws in connections:
                    keys_to_update.append((key, ws))
            
            for key, ws_to_remove in keys_to_update:
                route, chat_id = key
                self.disconnect(ws_to_remove, chat_id, route)

    def get_connection_stats(self) -> dict:
        """
        Get statistics about active WebSocket connections.
        """
        stats = {
            "total_connections": sum(len(conns) for conns in self.active_connections.values()),
            "routes": {},
            "active_chats": set()
        }
        
        for (route, chat_id), connections in self.active_connections.items():
            if route not in stats["routes"]:
                stats["routes"][route] = 0
            stats["routes"][route] += len(connections)
            stats["active_chats"].add(chat_id)
        
        stats["active_chats"] = len(stats["active_chats"])
        return stats

    async def ping_all_connections(self):
        """
        Send ping to all connections to keep them alive and identify dead ones.
        """
        ping_message = {
            "type": "ping",
            "timestamp": datetime.now(timezone.utc).isoformat()
        }
        await self.broadcast_to_all_routes(ping_message)


# Singleton instance
manager = WebSocketMultiManager()


# Enhanced wrapper with backwards compatibility
class EnhancedManager:
    def __init__(self):
        self.manager = manager

    async def send(self, route: str, chat_id: str, message: dict):
        """Backwards compatible send method"""
        await self.manager.send(route, chat_id, message)

    async def connect(self, websocket: WebSocket, chat_id: str, route: str):
        """Backwards compatible connect method"""
        await self.manager.connect(websocket, chat_id, route)

    def disconnect(self, websocket: WebSocket, chat_id: str, route: str):
        """Backwards compatible disconnect method"""
        self.manager.disconnect(websocket, chat_id, route)

    async def broadcast_tool_call(self, chat_id: str, tool_call: dict):
        """Backwards compatible tool call broadcast"""
        await self.manager.broadcast_tool_call_triggered(chat_id, tool_call)
    


# Create enhanced manager instance for backwards compatibility
manager = EnhancedManager()
