# api/routes.py

from fastapi import APIRouter, HTTPException, UploadFile, File, Form, Request
from fastapi.responses import JSONResponse
from typing import List, Optional
import shutil
import json
from pathlib import Path
from core.chat_manager import ChatManager
from websocket.manager import manager
from config import CHAT_DIR, EMBEDDING_MODELS

router = APIRouter()
chat_manager = ChatManager()

# 1. Send chat message (main chat interaction)
@router.post("/chat")
async def send_chat_message(request: Request):
    body = await request.json()
    chat_id = body.get("chat_id")
    message = body.get("message")
    if not message:
        raise HTTPException(status_code=400, detail="Message is required")
    
    chat_id = chat_id or chat_manager.create_conversation()
    result = await chat_manager.process_user_message(chat_id, message)
    
    await manager.send("chat", chat_id, {
        "type": "message_processed",
        "result": result
    })
    
    response = {"chat_id": chat_id}
    response_type = result.get("type")
    
    if response_type == "tool_call_processed":
        response.update({
            "response_type": "tool_call_processed",
            "tool_call": result["tool_call_message"]["content"],
            "agent_result": result["agent_response"]["content"],
            "agent_details": result["agent_metadata"],
        })
    elif response_type == "confirmation_requested":
        response.update({
            "response_type": "confirmation_requested",
            "confirmation_message": result["message"]["content"],
        })
    else:
        response.update({
            "response_type": "text_response",
            "message": result["message"]["content"],
        })
    return response

# 2. Create a new chat session
@router.post("/chat/create")
async def create_chat():
    chat_id = chat_manager.create_conversation()
    await manager.send("chat_create", "", {
        "type": "chat_created",
        "chat_id": chat_id
    })
    return {"chat_id": chat_id, "message": "New chat created"}

# 3. Delete chat session
@router.delete("/conversation/{chat_id}")
async def delete_chat(chat_id: str):
    chat_folder = CHAT_DIR / chat_id
    if not chat_folder.exists():
        raise HTTPException(status_code=404, detail="Chat not found")
    try:
        shutil.rmtree(chat_folder)
        await manager.send("delete", chat_id, {
            "type": "chat_deleted",
            "chat_id": chat_id,
            "message": f"Chat {chat_id} deleted"
        })
        return {"message": "Chat deleted"}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

# 4. Retrieve a full conversation
@router.get("/conversation/{chat_id}")
async def get_conversation(chat_id: str):
    if chat_manager.load_conversation(chat_id):
        return chat_manager.conversations[chat_id]
    raise HTTPException(status_code=404, detail="Conversation not found")

# 5. List all chat sessions (metadata)
@router.get("/conversations")
async def list_conversations():
    chat_ids = []
    # List directories under CHAT_DIR
    if CHAT_DIR.exists():
        for c in CHAT_DIR.iterdir():
            if c.is_dir():
                chat_ids.append(str(c.name))
    return {"conversations": chat_ids}

# 6. Upload reference document
@router.post("/upload/reference_document")
async def upload_reference_document(chat_id: str = Form(...), file: UploadFile = File(...)):
    folder = CHAT_DIR / chat_id
    folder.mkdir(parents=True, exist_ok=True)
    path = folder / file.filename
    try:
        with open(path, "wb") as f:
            shutil.copyfileobj(file.file, f)
        # Optionally notify websocket clients of new reference document upload
        await manager.send("file_upload", chat_id, {
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

# 7. Get current config (sample implementation returns embedding models)
@router.get("/config")
async def get_config():
    config = {
        "embedding_models": EMBEDDING_MODELS,
        # Add other config fields if needed
    }
    return config

# 8. Update config (partial update allowed)
@router.post("/config")
async def update_config(request: Request):
    data = await request.json()
    # Validate and update config here (customize as per your backend)
    # For example, save to file or update in-memory settings
    # For demo, just echo back validated keys
    valid_keys = {"api_key", "embedding_model", "extra_system_instructions"}
    updated_keys = [k for k in data.keys() if k in valid_keys]
    # TODO: persist updates as needed
    # Optionally broadcast config update via websocket to all interested parties
    return {"updated_fields": updated_keys, "message": "Config updated"}

# 9. Get available tools metadata (optional)
@router.get("/tools")
async def get_tools():
    # Example hard-coded list; replace with dynamic if you want
    return {
        "tools": [
            "dataset_metadata_analysis",
            "full_dataset_analysis",
            "web_search",
            "rag_knowledge_retrieval"
        ]
    }
