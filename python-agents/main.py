from fastapi import FastAPI, WebSocket, WebSocketDisconnect, HTTPException, Request, UploadFile, File, Form, status
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import Optional
import uvicorn
import json
import traceback
import shutil
from pathlib import Path
from websocket import manager
from core.chat_manager import ChatManager
from config import WS_HOST, WS_PORT, CHAT_DIR
import os
import datetime

app = FastAPI(title="OSS Lab Backend")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

chat_manager = ChatManager()

class ChatRequest(BaseModel):
    chat_id: Optional[str] = None
    message: str
    temperature: Optional[float] = None


class SettingsUpdate(BaseModel):
    api_key: str

# Get current settings
@app.get("/api/settings")
async def get_settings():
    """Get current API settings"""
    from config import GROQ_API_KEY
    return {
        "api_key": GROQ_API_KEY[:10] + "..." if GROQ_API_KEY else "",  # Show only first 10 chars
        "provider": "Groq",
        "model": "openai/gpt-oss-120b"
    }

# Update API key
@app.post("/api/settings")
async def update_settings(settings: SettingsUpdate):
    """Update API settings"""
    try:
        # Update the config file
        config_path = Path(__file__).parent / "config.py"
        
        # Read current config
        with open(config_path, 'r', encoding='utf-8') as f:
            content = f.read()
        
        # Replace the API key line
        import re
        pattern = r'GROQ_API_KEY = ".*?"'
        replacement = f'GROQ_API_KEY = "{settings.api_key}"'
        new_content = re.sub(pattern, replacement, content)
        
        # Write back to config
        with open(config_path, 'w', encoding='utf-8') as f:
            f.write(new_content)
        
        # Update the global variable (for immediate effect)
        global GROQ_API_KEY
        GROQ_API_KEY = settings.api_key
        
        return {"message": "Settings updated successfully"}
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to update settings: {str(e)}")

# Chat message sending and retrieval
@app.post("/api/chat")
async def chat_endpoint(request: Request):
    try:
        body = await request.json()
        chat_req = ChatRequest(**body)
        chat_id = chat_req.chat_id or chat_manager.create_conversation()
        result = await chat_manager.process_user_message(chat_id, chat_req.message)

        await manager.manager.send("chat", chat_id, {
            "type": "message_processed",
            "result": result
        })

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
        else:
            response.update({
                "response_type": "text",
                "message": result["message"]["content"]
            })
        return response
    except Exception as e:
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=str(e))


# Create new chat
@app.post("/api/chat/create")
async def create_chat():
    chat_id = chat_manager.create_conversation()
    await manager.manager.send("chat_create", "", {
        "type": "chat_created",
        "chat_id": chat_id
    })
    return {"chat_id": chat_id, "message": "New chat created"}


# Delete chat and notify
@app.delete("/api/conversation/{chat_id}")
async def delete_chat(chat_id: str):
    folder = CHAT_DIR / chat_id
    if not folder.exists():
        raise HTTPException(status_code=404, detail="Chat not found")
    try:
        shutil.rmtree(folder)
        await manager.manager.send("delete", chat_id, {
            "type": "chat_deleted",
            "chat_id": chat_id,
            "message": f"Chat {chat_id} deleted"
        })
        return {"message": "Chat deleted"}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


# Upload reference document file
@app.post("/api/upload/reference_document")
async def upload_reference(chat_id: str = Form(...), file: UploadFile = File(...)):
    folder = CHAT_DIR / chat_id
    folder.mkdir(parents=True, exist_ok=True)
    path = folder / file.filename
    try:
        with open(path, "wb") as f:
            shutil.copyfileobj(file.file, f)
        await manager.manager.send("file_upload", chat_id, {
            "type": "file_uploaded",
            "chat_id": chat_id,
            "file_name": file.filename,
            "file_type": "reference_document",
            "file_path": str(path),
            "message": f"{file.filename} uploaded"
        })
        return {"filename": file.filename, "chat_id": chat_id}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


# WebSocket: Chat interaction
@app.websocket("/ws/{chat_id}")
async def websocket_chat(websocket: WebSocket, chat_id: str):
    route = "chat"
    await manager.connect(websocket, chat_id, route)
    try:
        while True:
            await websocket.receive_text()
    except WebSocketDisconnect:
        manager.disconnect(websocket, chat_id, route)
    except Exception:
        manager.disconnect(websocket, chat_id, route)
        await websocket.close(code=status.WS_1011_INTERNAL_ERROR)


# WebSocket: Notebook streaming
@app.websocket("/ws/{chat_id}/notebook")
async def websocket_notebook(websocket: WebSocket, chat_id: str):
    route = "notebook"
    folder = CHAT_DIR / chat_id
    notebooks = list(folder.glob("analysis_*.ipynb"))
    if not notebooks:
        await websocket.accept()
        await websocket.send_text(json.dumps({
            "type": "no_notebook_found",
            "chat_id": chat_id
        }))
        await websocket.close()
        return
    await manager.connect(websocket, chat_id, route)
    try:
        while True:
            await websocket.receive_text()
    except WebSocketDisconnect:
        manager.disconnect(websocket, chat_id, route)
    except Exception:
        manager.disconnect(websocket, chat_id, route)
        await websocket.close(code=status.WS_1011_INTERNAL_ERROR)


# WebSocket: Config changes (if still needed; remove if config route is removed)
@app.websocket("/ws/{chat_id}/config")
async def websocket_config(websocket: WebSocket, chat_id: str):
    route = "config"
    await manager.connect(websocket, chat_id, route)
    try:
        while True:
            data = await websocket.receive_text()
            try:
                update = json.loads(data)
                await manager.manager.send("config", chat_id, {
                    "type": "config_updated",
                    "chat_id": chat_id,
                    "fields": list(update.keys())
                })
            except json.JSONDecodeError:
                await manager.manager.send("config", chat_id, {
                    "type": "error",
                    "chat_id": chat_id,
                    "message": "Invalid JSON"
                })
    except WebSocketDisconnect:
        manager.disconnect(websocket, chat_id, route)
    except Exception:
        manager.disconnect(websocket, chat_id, route)
        await websocket.close(code=status.WS_1011_INTERNAL_ERROR)


# WebSocket: Chat history streaming
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


@app.get("/api/conversations")
async def list_conversations():
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
        
        # Count experiments (notebooks) - this is correct
        notebook_files = list(chat_dir.glob("*.ipynb"))
        notebook_count = len(notebook_files)
        
        # Count ONLY actual user datasets - FIX THE FILTERING
        csv_files = list(chat_dir.glob("*.csv"))
        xlsx_files = list(chat_dir.glob("*.xlsx"))
        
        # For JSON files, be very selective - exclude ALL system files
        user_json_files = []
        for json_file in chat_dir.glob("*.json"):
            # Skip ALL system-generated files
            if json_file.name in ["main_conversation.json"]:
                continue
            if json_file.name.startswith(("full_analysis_agent_", "metadata_agent_", "agent_")):
                continue
            # Only count files that are clearly user datasets
            user_json_files.append(json_file)
        
        # Total dataset count for this chat
        dataset_count = len(csv_files) + len(xlsx_files) + len(user_json_files)
        
        # Add to totals
        total_experiments += notebook_count
        total_datasets += dataset_count

        # Debug logging (remove after testing)
        print(f"Chat {chat_id}:")
        print(f"  Notebooks: {[f.name for f in notebook_files]} = {notebook_count}")
        print(f"  CSV files: {[f.name for f in csv_files]} = {len(csv_files)}")
        print(f"  User JSON files: {[f.name for f in user_json_files]} = {len(user_json_files)}")
        print(f"  Total datasets: {dataset_count}")
        print("---")

        # Get chat metadata (rest of your existing code remains the same)
        main_conversation_path = chat_dir / "main_conversation.json"
        if main_conversation_path.exists():
            try:
                content = json.loads(main_conversation_path.read_text(encoding="utf-8"))
                chat_history = content.get("chat_history", [])
                for msg in chat_history:
                    if (
                        msg.get("role") in ("user", "human")
                        and isinstance(msg.get("content"), str)
                        and msg["content"].strip()
                    ):
                        title = msg["content"].strip()
                        break
                if "created_at" in content:
                    created_at = content["created_at"]
            except Exception:
                pass

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

    print(f"TOTAL: {total_experiments} experiments, {total_datasets} datasets")
    
    return {
        "conversations": conversations,
        "total_experiments": total_experiments,
        "total_datasets": total_datasets
    }

# Add this new endpoint to get notebook content
@app.get("/api/conversation/{chat_id}/notebook")
async def get_conversation_notebook(chat_id: str):
    folder = CHAT_DIR / chat_id
    if not folder.exists():
        raise HTTPException(status_code=404, detail="Chat folder not found")
    
    # Find notebook files
    notebooks = list(folder.glob("analysis_*.ipynb"))
    if not notebooks:
        raise HTTPException(status_code=404, detail="No notebook found for this conversation")
    
    # Get the most recent notebook
    latest_notebook = max(notebooks, key=lambda p: p.stat().st_mtime)
    
    try:
        with open(latest_notebook, 'r', encoding='utf-8') as f:
            notebook_content = json.load(f)
        
        return {
            "chat_id": chat_id,
            "notebook_file": latest_notebook.name,
            "notebook_content": notebook_content,
            "created_at": datetime.datetime.fromtimestamp(latest_notebook.stat().st_mtime).isoformat()
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error reading notebook: {str(e)}")

# Enhanced conversation endpoint that includes notebook info
@app.get("/api/conversation/{chat_id}")
async def get_conversation(chat_id: str):
    if chat_manager.load_conversation(chat_id):
        conversation_data = chat_manager.conversations[chat_id]
        
        # Check for associated notebook files
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
        
        return conversation_data
    raise HTTPException(status_code=404, detail="Not found")

if __name__ == "__main__":
    uvicorn.run(app, host=WS_HOST, port=WS_PORT, reload=True)
