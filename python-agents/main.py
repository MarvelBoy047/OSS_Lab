from fastapi import FastAPI, WebSocket, WebSocketDisconnect, HTTPException, Request, UploadFile, File, Form, status
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from pydantic import BaseModel
from typing import Optional, Dict, Any
import uvicorn
import json
import traceback
import shutil
from pathlib import Path
from ws_manager.manager import manager
from core.chat_manager import ChatManager
from core.settings_manager import settings_manager
from config import WS_HOST, WS_PORT, CHAT_DIR, AVAILABLE_PROVIDERS, AVAILABLE_MODELS, EMBEDDING_MODELS
import sys
import os
sys.path.append(os.path.join(os.path.dirname(__file__), 'websocket'))
import datetime

# Add notebook execution imports
import nbformat
from nbclient import NotebookClient
import asyncio

app = FastAPI(title="OSS Lab Backend")

# Global exception handler for better error reporting
@app.exception_handler(Exception)
async def global_exception_handler(request: Request, exc: Exception):
    tb = traceback.format_exc()
    print(f"[ERROR] Exception in {request.method} {request.url}: {str(exc)}")
    print(f"[ERROR] Traceback:\n{tb}")
    return JSONResponse(
        status_code=500,
        content={
            "detail": str(exc),
            "traceback": tb.split('\n') if tb else [],
            "url": str(request.url),
            "method": request.method
        }
    )

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

async def execute_complete_notebook(notebook_path: str) -> bool:
    """Clear all outputs then execute all cells in notebook using nbclient for proper context and outputs"""
    try:
        notebook_file = Path(notebook_path)
        if not notebook_file.exists():
            print(f"[NOTEBOOK] File not found: {notebook_path}")
            return False

        print(f"[NOTEBOOK] Starting execution of: {notebook_file.name}")
        
        # Read the notebook
        with open(notebook_file, 'r', encoding='utf-8') as f:
            nb = nbformat.read(f, as_version=4)

        # CRITICAL: Clear all outputs from code cells first
        print(f"[NOTEBOOK] Clearing all outputs from {notebook_file.name}")
        for cell in nb.cells:
            if cell.cell_type == 'code':
                # Clear all outputs
                cell.outputs = []
                # Clear execution count
                cell.execution_count = None
                # Clear any metadata that might interfere
                if 'execution' in cell.metadata:
                    del cell.metadata['execution']

        # Save the cleared notebook first
        with open(notebook_file, 'w', encoding='utf-8') as f:
            nbformat.write(nb, f)
        
        print(f"[NOTEBOOK] Cleared all outputs, now executing: {notebook_file.name}")

        # Create client with proper settings
        client = NotebookClient(
            nb, 
            timeout=600,  # 10 minutes timeout
            kernel_name='python3',
            allow_errors=True,  # Continue even if some cells error
            record_timing=True  # Record execution times
        )

        # Execute all cells in one fresh session (preserves variables and context)
        await asyncio.to_thread(client.execute)
        
        print(f"[NOTEBOOK] Execution completed: {notebook_file.name}")

        # Save the executed notebook with fresh outputs
        with open(notebook_file, 'w', encoding='utf-8') as f:
            nbformat.write(nb, f)
            
        print(f"[NOTEBOOK] Saved with fresh outputs: {notebook_file.name}")
        return True

    except Exception as e:
        print(f"[NOTEBOOK] Execution failed for {notebook_path}: {e}")
        import traceback
        traceback.print_exc()
        return False


# FIXED: Always re-execute notebook once before broadcasting
async def broadcast_notebook_created(chat_id: str):
    """Always re-execute notebook completely then broadcast to UI clients"""
    try:
        folder = CHAT_DIR / chat_id
        notebooks = list(folder.glob("analysis_*.ipynb"))
        if not notebooks:
            print(f"[NOTEBOOK] No notebooks found for chat {chat_id}")
            return
            
        latest_notebook = max(notebooks, key=lambda p: p.stat().st_mtime)
        notebook_path = str(latest_notebook)
        
        print(f"[NOTEBOOK] Re-executing notebook: {latest_notebook.name}")
        
        # ALWAYS re-execute the notebook (no conditions)
        execution_success = await execute_complete_notebook(notebook_path)
        
        if execution_success:
            print(f"[NOTEBOOK] Successfully re-executed: {latest_notebook.name}")
        else:
            print(f"[NOTEBOOK] Re-execution failed: {latest_notebook.name}")
        
        # Send to notebook page clients
        await manager.manager.send("notebook", chat_id, {
            "type": "notebook_created",
            "chat_id": chat_id,
            "notebook_path": notebook_path,
            "notebook_name": latest_notebook.name,
            "executed": execution_success,
            "timestamp": datetime.datetime.now(datetime.timezone.utc).isoformat()
        })
        
        # Send to dashboard for conversation list updates
        await manager.manager.send("global", None, {
            "type": "notebook_available", 
            "chat_id": chat_id,
            "has_notebook": True,
            "timestamp": datetime.datetime.now(datetime.timezone.utc).isoformat()
        })
        
        print(f"[NOTEBOOK] Broadcasted re-executed notebook for chat {chat_id}")
        
    except Exception as e:
        print(f"[NOTEBOOK] Failed to broadcast notebook: {e}")
        import traceback
        traceback.print_exc()

# Initialize chat manager (will use dynamic settings)
chat_manager = ChatManager()

# Pydantic models
class ChatRequest(BaseModel):
    chat_id: Optional[str] = None
    message: str
    temperature: Optional[float] = None
    web_search_enabled: Optional[bool] = False

class SettingsUpdate(BaseModel):
    api_key: Optional[str] = None
    model: Optional[str] = None
    temperature: Optional[float] = None
    top_p: Optional[float] = None
    embedding_model: Optional[str] = None
    system_instructions: Optional[str] = None
    web_search_enabled: Optional[bool] = None
    auto_image_search: Optional[bool] = None
    auto_video_search: Optional[bool] = None
    measure_unit: Optional[str] = None

class WebSearchToggle(BaseModel):
    enabled: bool

# Settings endpoints with dynamic management
@app.get("/api/settings")
async def get_settings():
    """Get current user settings with available options"""
    try:
        current_settings = settings_manager.get_all()
        
        # Mask API key for security
        if current_settings.get("api_key"):
            current_settings["api_key"] = current_settings["api_key"][:10] + "..."
        
        return {
            **current_settings,
            "available_providers": AVAILABLE_PROVIDERS,
            "available_models": AVAILABLE_MODELS,
            "available_embedding_models": EMBEDDING_MODELS,
            "api_key_valid": settings_manager.is_valid_api_key(),
            "backend_status": "connected"
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to get settings: {str(e)}")

@app.post("/api/settings")
async def update_settings(settings: SettingsUpdate):
    """Update user settings dynamically (no restart required)"""
    try:
        # Build update dictionary from non-None values
        updates = {}
        for field, value in settings.dict().items():
            if value is not None:
                updates[field] = value

        # Validate API key if provided
        if "api_key" in updates:
            if not settings_manager.is_valid_api_key(updates["api_key"]):
                raise HTTPException(status_code=400, detail="Invalid API key format. Must be at least 20 characters long.")

        # Validate model if provided
        if "model" in updates:
            provider = settings_manager.get("provider", "Groq")
            available_models = AVAILABLE_MODELS.get(provider, [])
            if updates["model"] not in available_models:
                raise HTTPException(status_code=400, detail=f"Model '{updates['model']}' not available for {provider}")

        # Validate temperature
        if "temperature" in updates:
            temp = updates["temperature"]
            if not (0.0 <= temp <= 2.0):
                raise HTTPException(status_code=400, detail="Temperature must be between 0.0 and 2.0")

        # Validate top_p
        if "top_p" in updates:
            top_p = updates["top_p"]
            if not (0.0 <= top_p <= 1.0):
                raise HTTPException(status_code=400, detail="Top_p must be between 0.0 and 1.0")

        # Validate embedding model
        if "embedding_model" in updates:
            if updates["embedding_model"] not in EMBEDDING_MODELS:
                raise HTTPException(status_code=400, detail=f"Embedding model '{updates['embedding_model']}' not available")

        # Apply updates
        success = settings_manager.update(updates)
        
        if not success:
            raise HTTPException(status_code=500, detail="Failed to save settings to disk")

        return {
            "message": "Settings updated successfully",
            "updated_fields": list(updates.keys()),
            "api_key_valid": settings_manager.is_valid_api_key(),
            "timestamp": datetime.datetime.now(datetime.timezone.utc).isoformat()
        }

    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to update settings: {str(e)}")

@app.post("/api/settings/reset")
async def reset_settings():
    """Reset all settings to defaults"""
    try:
        success = settings_manager.reset_to_defaults()
        if success:
            return {
                "message": "Settings reset to defaults successfully",
                "timestamp": datetime.datetime.now(datetime.timezone.utc).isoformat()
            }
        else:
            raise HTTPException(status_code=500, detail="Failed to reset settings")
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to reset settings: {str(e)}")

# Reference Document Upload (for RAG) - KEEP THIS
@app.post("/api/upload/reference_document")
async def upload_reference(chat_id: str = Form(...), file: UploadFile = File(...)):
    """Upload reference document for RAG system"""
    # Validate file type for references
    allowed_extensions = {'.txt', '.md', '.pdf', '.docx', '.json'}
    file_extension = Path(file.filename).suffix.lower()
    
    if file_extension not in allowed_extensions:
        raise HTTPException(
            status_code=400, 
            detail=f"Reference file type '{file_extension}' not supported. Allowed: {', '.join(allowed_extensions)}"
        )
    
    folder = CHAT_DIR / chat_id
    folder.mkdir(parents=True, exist_ok=True)
    path = folder / file.filename
    
    try:
        with open(path, "wb") as f:
            shutil.copyfileobj(file.file, f)
        
        # Validate file size (max 50MB for references)
        file_size = path.stat().st_size
        max_size = 50 * 1024 * 1024  # 50MB
        if file_size > max_size:
            path.unlink()
            raise HTTPException(status_code=400, detail=f"Reference file too large. Maximum size is 50MB.")
        
        # Add hidden message for reference document context
        hidden_content = f"[REFERENCE_DOC]:{str(path)}"
        message = chat_manager.add_message(chat_id, "system", hidden_content, hidden=True)
        
        await manager.manager.send("file_upload", chat_id, {
            "type": "reference_uploaded",
            "chat_id": chat_id,
            "file_name": file.filename,
            "file_type": "reference_document", 
            "file_path": str(path),
            "file_size": file_size,
            "message": f"{file.filename} uploaded for reference",
            "message_id": message["id"]
        })
        
        return {
            "filename": file.filename,
            "chat_id": chat_id,
            "file_size": file_size,
            "message": f"Reference document {file.filename} uploaded successfully"
        }
        
    except HTTPException:
        raise
    except Exception as e:
        if path.exists():
            path.unlink()
        raise HTTPException(status_code=500, detail=f"Failed to upload reference: {str(e)}")

# Web Search Toggle Endpoint
@app.post("/api/chat/{chat_id}/toggle_websearch")
async def toggle_websearch(chat_id: str, toggle: WebSearchToggle):
    """Toggle web search agent for enhanced responses"""
    try:
        # Validate chat exists
        if not chat_manager.load_conversation(chat_id):
            raise HTTPException(status_code=404, detail="Chat not found")
        
        if toggle.enabled:
            hidden_content = "[WEB_SEARCH_ENABLED]:Use web search agent tool for enhanced responses with current information"
            chat_manager.add_message(chat_id, "system", hidden_content, hidden=True)
        else:
            hidden_content = "[WEB_SEARCH_DISABLED]:Disable web search agent tool"  
            chat_manager.add_message(chat_id, "system", hidden_content, hidden=True)
            
        await manager.manager.send("chat", chat_id, {
            "type": "websearch_toggled",
            "chat_id": chat_id,
            "enabled": toggle.enabled,
            "message": f"Web search {'enabled' if toggle.enabled else 'disabled'}",
            "timestamp": datetime.datetime.now(datetime.timezone.utc).isoformat()
        })
            
        return {
            "message": f"Web search {'enabled' if toggle.enabled else 'disabled'}",
            "chat_id": chat_id,
            "enabled": toggle.enabled
        }
        
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to toggle web search: {str(e)}")

@app.post("/api/chat")
async def chat_endpoint(request: Request):
    """Process chat message with auto-generated conversation and real-time updates"""
    try:
        # Check if API key is configured
        if not settings_manager.is_valid_api_key():
            raise HTTPException(
                status_code=400, 
                detail="No valid API key configured. Please set your Groq API key in settings."
            )
        
        body = await request.json()
        chat_req = ChatRequest(**body)
        
        # Validate that the incoming message is not empty or just whitespace
        if not chat_req.message or not chat_req.message.strip():
            raise HTTPException(
                status_code=400,
                detail="Message cannot be empty"
            )
        
        # Auto-generate chat ID if not provided
        is_new_conversation = not chat_req.chat_id
        chat_id = chat_req.chat_id or chat_manager.create_conversation()
        
        # Add web search context if enabled in request
        if chat_req.web_search_enabled:
            hidden_content = "[WEB_SEARCH_ENABLED]:Use web search agent tool for this response"
            chat_manager.add_message(chat_id, "system", hidden_content, hidden=True)
        
        # Process user message with current settings
        result = await chat_manager.process_user_message(chat_id, chat_req.message)

        # FIXED: Always re-execute notebooks when detected
        try:
            folder = CHAT_DIR / chat_id
            if folder.exists():
                notebooks = list(folder.glob("analysis_*.ipynb"))
                if notebooks:
                    print(f"[NOTEBOOK] Found {len(notebooks)} notebooks for chat {chat_id}")
                    # Always broadcast and re-execute (no time conditions)
                    await broadcast_notebook_created(chat_id)
        except Exception as e:
            print(f"[NOTEBOOK] Error checking for notebooks: {e}")

        # Broadcast new conversation creation if this is a new chat
        if is_new_conversation:
            # Generate title from first user message (truncated)
            title = chat_req.message[:50] + "..." if len(chat_req.message) > 50 else chat_req.message
            
            await manager.manager.send("global", None, {
                "type": "conversation_created",
                "chat_id": chat_id, 
                "title": title,
                "created_at": datetime.datetime.now(datetime.timezone.utc).isoformat(),
                "has_notebook": False,
                "notebook_count": 0,
                "dataset_count": 0
            })

        # Broadcast message processing result
        await manager.manager.send("chat", chat_id, {
            "type": "message_processed",
            "chat_id": chat_id,
            "result": result,
            "timestamp": datetime.datetime.now(datetime.timezone.utc).isoformat()
        })

        # Build response based on result type
        response = {"chat_id": chat_id}
        if result.get("type") == "tool_call_processed":
            response.update({
                "response_type": "tool_call",
                "tool_call": result["tool_call_message"]["content"],
                "agent_result": result["agent_response"]["content"],
                "agent_details": result["agent_metadata"]
            })
        elif result.get("type") == "confirmation_requested":
            response.update({
                "response_type": "confirmation_requested", 
                "confirmation_message": result["message"]["content"]
            })
        elif result.get("type") == "api_error":
            response.update({
                "response_type": "error",
                "error_message": result["message"]["content"]
            })
        else:
            response.update({
                "response_type": "text",
                "message": result["message"]["content"]
            })
            
        return response
        
    except HTTPException:
        raise
    except Exception as e:
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=f"Chat processing failed: {str(e)}")

@app.post("/api/chat/create")
async def create_chat():
    """Create a new empty conversation"""
    try:
        print("[DEBUG] Starting chat creation...")
        chat_id = chat_manager.create_conversation()
        print(f"[DEBUG] Chat ID created: {chat_id}")
        
        # Define title for the new chat
        title = f"New Chat {chat_id[:8]}"
        
        # Broadcast conversation creation to global listeners
        await manager.manager.send("global", None, {
            "type": "conversation_created",
            "chat_id": chat_id,
            "title": title,
            "created_at": datetime.datetime.now(datetime.timezone.utc).isoformat(),
            "has_notebook": False,
            "notebook_count": 0,
            "dataset_count": 0
        })
        
        return {
            "chat_id": chat_id,
            "message": "New chat created successfully",
            "title": title
        }
        
    except Exception as e:
        print(f"[API ERROR] Chat creation failed: {e}")
        import traceback
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=f"Chat creation failed: {str(e)}")

# Delete chat and notify all clients
@app.delete("/api/conversation/{chat_id}")
async def delete_chat(chat_id: str):
    """Delete conversation and broadcast to all clients"""
    folder = CHAT_DIR / chat_id
    if not folder.exists():
        raise HTTPException(status_code=404, detail="Chat not found")
        
    try:
        shutil.rmtree(folder)
        
        # Remove from chat_manager memory
        chat_manager.cleanup_conversation(chat_id)
        
        # Broadcast deletion to all clients
        await manager.manager.send("global", None, {
            "type": "conversation_deleted",
            "chat_id": chat_id,
            "message": f"Chat {chat_id} deleted",
            "timestamp": datetime.datetime.now(datetime.timezone.utc).isoformat()
        })
        
        return {"message": "Chat deleted successfully", "chat_id": chat_id}
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to delete chat: {str(e)}")

# Health check endpoint
@app.get("/api/health")
async def health_check():
    """Health check endpoint"""
    return {
        "status": "healthy",
        "timestamp": datetime.datetime.now(datetime.timezone.utc).isoformat(),
        "api_key_configured": settings_manager.is_valid_api_key(),
        "settings_version": settings_manager.get("version", "unknown")
    }

# WebSocket endpoints
@app.websocket("/ws/{chat_id}")
async def websocket_chat(websocket: WebSocket, chat_id: str):
    route = "chat"
    await manager.connect(websocket, chat_id, route)
    try:
        while True:
            await websocket.receive_text()
    except WebSocketDisconnect:
        manager.disconnect(websocket, chat_id, route)
        print(f"WebSocket disconnected for chat: {chat_id}")
    except Exception as e:
        manager.disconnect(websocket, chat_id, route)
        print(f"WebSocket error for chat {chat_id}: {e}")
        await websocket.close(code=status.WS_1011_INTERNAL_ERROR)

@app.websocket("/ws/dashboard")
async def websocket_dashboard(websocket: WebSocket):
    route = "dashboard"
    await manager.connect(websocket, "global", route)
    try:
        while True:
            await websocket.receive_text()
    except WebSocketDisconnect:
        manager.disconnect(websocket, "global", route)
    except Exception:
        manager.disconnect(websocket, "global", route) 
        await websocket.close(code=status.WS_1011_INTERNAL_ERROR)

# Root endpoint for connectivity checks
@app.get("/")
async def root():
    """Root endpoint for connectivity checks"""
    return {
        "message": "OSSLAB Backend is running",
        "status": "healthy",
        "timestamp": datetime.datetime.now(datetime.timezone.utc).isoformat(),
        "version": "1.0.0"
    }

# FIXED: Enhanced notebook WebSocket with proper chat_id isolation
@app.websocket("/ws/{chat_id}/notebook")
async def websocket_notebook(websocket: WebSocket, chat_id: str):
    route = "notebook"
    await manager.connect(websocket, chat_id, route)
    
    try:
        # Check for notebooks in this specific chat's folder
        folder = CHAT_DIR / chat_id
        notebooks = list(folder.glob("analysis_*.ipynb")) if folder.exists() else []
        
        if notebooks:
            latest_notebook = max(notebooks, key=lambda p: p.stat().st_mtime)
            await websocket.send_text(json.dumps({
                "type": "notebook_found",
                "chat_id": chat_id,
                "notebook_path": str(latest_notebook),
                "notebook_name": latest_notebook.name,
                "has_notebook": True,
                "created_at": datetime.datetime.fromtimestamp(latest_notebook.stat().st_mtime).isoformat()
            }))
        else:
            await websocket.send_text(json.dumps({
                "type": "no_notebook_found",
                "chat_id": chat_id,
                "has_notebook": False,
                "message": "No notebook available for this conversation"
            }))
        
        while True:
            await websocket.receive_text()
            
    except WebSocketDisconnect:
        manager.disconnect(websocket, chat_id, route)
    except Exception as e:
        print(f"[NOTEBOOK] WebSocket error: {e}")
        manager.disconnect(websocket, chat_id, route)
        await websocket.close(code=status.WS_1011_INTERNAL_ERROR)

@app.websocket("/ws/{chat_id}/history")
async def websocket_history(websocket: WebSocket, chat_id: str):
    route = "history"
    file_path = CHAT_DIR / chat_id / "main_conversation.json"
    if not file_path.exists():
        await websocket.accept()
        await websocket.send_text(json.dumps({
            "type": "no_history",
            "chat_id": chat_id
        }))
        await websocket.close()
        return
        
    await manager.connect(websocket, chat_id, route)
    try:
        while True:
            content = json.loads(file_path.read_text(encoding="utf-8"))
            await manager.manager.send(route, chat_id, {
                "type": "history_update",
                "chat_id": chat_id,
                "history": content
            })
            await websocket.receive_text()
    except WebSocketDisconnect:
        manager.disconnect(websocket, chat_id, route)
    except Exception:
        manager.disconnect(websocket, chat_id, route)
        await websocket.close(code=status.WS_1011_INTERNAL_ERROR)

# ✅ FIXED: Get all conversations with enhanced metadata
@app.get("/api/conversations")
async def list_conversations():
    """List all conversations with metadata"""
    try:
        if not CHAT_DIR.exists():
            return {"conversations": [], "total_experiments": 0, "total_datasets": 0}

        conversations = []
        total_experiments = 0
        total_datasets = 0

        for chat_dir in CHAT_DIR.iterdir():
            if not chat_dir.is_dir():
                continue

            chat_id = chat_dir.name
            title = None
            created_at = None

            # Count experiments (notebooks) - ONLY in this chat's folder
            notebooks = list(chat_dir.glob("analysis_*.ipynb"))
            notebook_count = len(notebooks)

            # Count user datasets (exclude system files)
            csv_files = list(chat_dir.glob("*.csv"))
            xlsx_files = list(chat_dir.glob("*.xlsx"))
            
            user_json_files = [f for f in chat_dir.glob("*.json") 
                               if f.name not in ("main_conversation.json",) 
                               and not f.name.startswith(("agent_", "metadata_agent_", "full_analysis_agent_"))]

            dataset_count = len(csv_files) + len(xlsx_files) + len(user_json_files)

            total_experiments += notebook_count
            total_datasets += dataset_count

            # Get chat metadata
            main_conversation_path = chat_dir / "main_conversation.json"
            if main_conversation_path.exists():
                try:
                    content = json.loads(main_conversation_path.read_text(encoding="utf-8"))
                    chat_history = content.get("chat_history", [])
                    
                    # Find first non-hidden user message for title
                    for msg in chat_history:
                        if (msg.get("role") in ("user", "human") and 
                            not msg.get("hidden", False) and
                            isinstance(msg.get("content"), str) and 
                            msg["content"].strip()):
                            title = msg["content"].strip()
                            break
                            
                    created_at = content.get("created_at")
                except Exception:
                    pass

            # Generate fallback title and timestamp
            if not title:
                title = f"Chat {chat_id[:8]}"
            if not created_at:
                try:
                    stat = chat_dir.stat()
                    timestamp = getattr(stat, "st_mtime", stat.st_ctime)
                    created_at = datetime.datetime.fromtimestamp(timestamp).isoformat()
                except Exception:
                    created_at = datetime.datetime.now().isoformat()

            conversations.append({
                "id": chat_id,
                "title": title,
                "created_at": created_at,
                "has_notebook": notebook_count > 0,
                "notebook_count": notebook_count,
                "dataset_count": dataset_count,
                "focusMode": "webSearch"
            })

        # Sort conversations by creation date (newest first)
        conversations.sort(key=lambda x: x["created_at"], reverse=True)

        return {
            "conversations": conversations,
            "total_experiments": total_experiments,
            "total_datasets": total_datasets
        }

    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to list conversations: {str(e)}")

@app.get("/api/conversation/{chat_id}/notebook")
async def get_conversation_notebook(chat_id: str):
    """Get notebook content for a specific conversation - ALWAYS RE-EXECUTE FIRST"""
    # Ensure we only look in this chat's specific folder
    folder = CHAT_DIR / chat_id
    if not folder.exists():
        raise HTTPException(status_code=404, detail=f"Chat folder not found for chat_id: {chat_id}")
    
    # Only look for notebooks in THIS chat's folder
    notebooks = list(folder.glob("analysis_*.ipynb"))
    if not notebooks:
        raise HTTPException(status_code=404, detail=f"No notebook found for this conversation: {chat_id}. Come back later after analysis completes.")
    
    latest_notebook = max(notebooks, key=lambda p: p.stat().st_mtime)
    notebook_path = str(latest_notebook)
    
    print(f"[NOTEBOOK] Request for notebook {latest_notebook.name} - re-executing first")
    
    # ALWAYS re-execute before serving
    execution_success = await execute_complete_notebook(notebook_path)
    
    if not execution_success:
        print(f"[NOTEBOOK] Re-execution failed for {latest_notebook.name}, serving anyway")
    
    try:
        with open(latest_notebook, 'r', encoding='utf-8') as f:
            notebook_content = json.load(f)
        
        print(f"[NOTEBOOK] Serving re-executed notebook for chat {chat_id}: {latest_notebook.name}")
        
        return {
            "chat_id": chat_id,
            "notebook_file": latest_notebook.name,
            "notebook_content": notebook_content,
            "created_at": datetime.datetime.fromtimestamp(latest_notebook.stat().st_mtime).isoformat(),
            "executed": execution_success
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error reading notebook for chat {chat_id}: {str(e)}")

# FIXED: Get conversation details with proper chat_id isolation
@app.get("/api/conversation/{chat_id}")
async def get_conversation(chat_id: str):
    """Get conversation details with notebook info - CHAT_ID ISOLATED"""
    try:
        if chat_manager.load_conversation(chat_id):
            conversation_data = chat_manager.conversations[chat_id]
            
            # Check for associated notebook files ONLY in this chat's folder
            folder = CHAT_DIR / chat_id
            notebooks = list(folder.glob("analysis_*.ipynb")) if folder.exists() else []
            
            # Add notebook information to response
            conversation_data["has_notebook"] = len(notebooks) > 0
            if notebooks:
                latest_notebook = max(notebooks, key=lambda p: p.stat().st_mtime)
                conversation_data["notebook_info"] = {
                    "filename": latest_notebook.name,
                    "created_at": datetime.datetime.fromtimestamp(latest_notebook.stat().st_mtime).isoformat()
                }
            else:
                conversation_data["notebook_info"] = {
                    "message": "No notebook available for this conversation"
                }
            
            print(f"[CONVERSATION] Serving conversation {chat_id} - has_notebook: {conversation_data['has_notebook']}")
            
            return conversation_data
        else:
            raise HTTPException(status_code=404, detail=f"Conversation not found: {chat_id}")
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to get conversation {chat_id}: {str(e)}")

if __name__ == "__main__":
    print("🚀 Starting OSS Lab Backend...")
    print(f"   Settings file: {settings_manager.settings_file}")
    print(f"   API key configured: {settings_manager.is_valid_api_key()}")
    print(f"   Chat directory: {CHAT_DIR}")
    print(f"   WebSocket: ws://{WS_HOST}:{WS_PORT}")
    
    uvicorn.run(app, host=WS_HOST, port=WS_PORT, reload=True)