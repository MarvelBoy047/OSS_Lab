import warnings
warnings.simplefilter('ignore')
warnings.filterwarnings("ignore", category=FutureWarning)
warnings.filterwarnings("ignore", category=DeprecationWarning)
warnings.filterwarnings("ignore", category=UserWarning)


import os
import json
import uuid
import asyncio
from pathlib import Path
from typing import Dict, Any, List

from langchain_huggingface import HuggingFaceEmbeddings
from langchain_chroma import Chroma
from langchain.text_splitter import RecursiveCharacterTextSplitter

from config import DATA_REFERENCES_DIR, DEFAULT_EMBEDDING_MODEL, MODELS
from utils.document_processor import extract_text_from_file
from groq import Groq


class RAGAgent:
    def __init__(self):
        self.agent_id = "rag_agent"
        self.references_root = DATA_REFERENCES_DIR
        self.references_root.mkdir(parents=True, exist_ok=True)

    def is_enabled(self) -> bool:
        return True

    def get_embedding_model(self, model_name: str):
        if model_name == "BGE Small":
            return HuggingFaceEmbeddings(model_name="BAAI/bge-small-en-v1.5")
        elif model_name == "GTE Small":
            return HuggingFaceEmbeddings(model_name="thenlper/gte-small")
        elif model_name == "Bert Multilingual":
            return HuggingFaceEmbeddings(model_name="sentence-transformers/bert-base-multilingual-cased")
        else:
            return HuggingFaceEmbeddings(model_name="BAAI/bge-small-en-v1.5")

    async def ingest_documents(self, chat_id: str, files: List[Path], embedding_model_name: str):
        chat_ref_dir = self.references_root / chat_id
        chat_ref_dir.mkdir(exist_ok=True)

        all_texts = []
        metadatas = []
        doc_ids = []

        for file_path in files:
            text = extract_text_from_file(file_path)
            if not text:
                continue
            splitter = RecursiveCharacterTextSplitter(chunk_size=1000, chunk_overlap=200)
            chunks = splitter.split_text(text)
            all_texts.extend(chunks)

            for i in range(len(chunks)):
                metadatas.append({"source": file_path.name, "chunk": i})
                doc_ids.append(str(uuid.uuid4()))

        embedder = self.get_embedding_model(embedding_model_name)
        vectordb_path = chat_ref_dir / "chroma"

        vector_store = Chroma(
            persist_directory=str(vectordb_path),
            embedding_function=embedder
        )

        vector_store.add_texts(
            texts=all_texts,
            metadatas=metadatas,
            ids=doc_ids
        )
        # Chroma now persists automatically

        return {"ingested_chunks": len(all_texts)}

    async def query_documents(self, chat_id: str, query: str, embedding_model_name: str, max_docs: int):
        chat_ref_dir = self.references_root / chat_id
        vectordb_path = chat_ref_dir / "chroma"
        if not vectordb_path.exists():
            return {"success": False, "error": "No reference documents indexed for this chat."}

        embedder = self.get_embedding_model(embedding_model_name)
        vector_store = Chroma(
            persist_directory=str(vectordb_path),
            embedding_function=embedder
        )
        retriever = vector_store.as_retriever(search_kwargs={"k": max_docs})

        # Initialize Groq client fresh here
        client = Groq(api_key=MODELS["default"]["api_key"])

        docs = await retriever.ainvoke(query)
        context = "\n".join([doc.page_content for doc in docs])

        prompt = f"Context from documents:\n{context}\n\nQuestion: {query}\nAnswer based on the context:"

        response = client.chat.completions.create(
            model=MODELS["default"]["model"],
            messages=[{"role": "user", "content": prompt}],
            temperature=0.3
        )

        answer = response.choices[0].message.content if response.choices else "No answer generated"

        return {"success": True, "query": query, "answer": answer}

    async def process_tool_call(self, tool_call: Dict[str, Any], parent_chat_id: str = None) -> Dict[str, Any]:
        query = tool_call["arguments"].get("query", "")
        embedding_model = tool_call["arguments"].get("embedding_model", DEFAULT_EMBEDDING_MODEL)
        max_docs = tool_call["arguments"].get("max_documents", 5)
        chat_id = parent_chat_id or str(uuid.uuid4())[:8]

        if not query:
            return {"agent_id": self.agent_id, "summary": "Query text required", "status": "failed", "error": "Missing query"}

        try:
            response = await self.query_documents(chat_id, query, embedding_model, max_docs)
            if response.get("success"):
                return {
                    "agent_id": self.agent_id,
                    "summary": response.get("answer", "No answer generated"),
                    "status": "completed"
                }
            else:
                return {
                    "agent_id": self.agent_id,
                    "summary": f"RAG query failed: {response.get('error', 'Unknown error')}",
                    "status": "failed"
                }
        except Exception as e:
            return {"agent_id": self.agent_id, "summary": f"Processing error: {str(e)}", "status": "failed"}
