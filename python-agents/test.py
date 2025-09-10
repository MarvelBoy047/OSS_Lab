import requests
import json

BASE_URL = "http://127.0.0.1:8000/api"

def pretty_print(title, data):
    print(f"\n--- {title} ---")
    print(json.dumps(data, indent=2))

def create_chat():
    resp = requests.post(f"{BASE_URL}/chat/create")
    data = resp.json()
    pretty_print("Create Chat Response", data)
    return data.get("chat_id")

def send_message(chat_id, message):
    payload = {"chat_id": chat_id, "message": message}
    resp = requests.post(f"{BASE_URL}/chat", json=payload)
    data = resp.json()
    pretty_print(f"Send Message '{message}' Response", data)

def upload_reference_document(chat_id, file_path):
    with open(file_path, "rb") as f:
        files = {"file": (file_path, f, "application/octet-stream")}
        data = {"chat_id": chat_id}
        resp = requests.post(f"{BASE_URL}/upload/reference_document", files=files, data=data)
    result = resp.json()
    pretty_print("Upload Reference Document Response", result)

def get_conversation(chat_id):
    resp = requests.get(f"{BASE_URL}/conversation/{chat_id}")
    if resp.status_code == 200:
        pretty_print(f"Get Conversation {chat_id}", resp.json())
    else:
        print(f"Failed to get conversation {chat_id}: {resp.status_code}")

def list_conversations():
    resp = requests.get(f"{BASE_URL}/conversations")
    pretty_print("List All Conversations", resp.json())

def delete_chat(chat_id):
    resp = requests.delete(f"{BASE_URL}/conversation/{chat_id}")
    if resp.status_code == 200:
        pretty_print(f"Delete Chat {chat_id}", resp.json())
    else:
        print(f"Failed to delete chat {chat_id}: {resp.status_code}")

if __name__ == "__main__":
    # Create a new chat session
    chat_id = create_chat()
    if not chat_id:
        print("Failed to create chat session. Aborting test.")
        exit(1)

    # Send chat messages
    send_message(chat_id, "Hello, OSS Lab!")
    send_message(chat_id, "Please analyze my data.")

    # Upload a sample reference document - adjust path to a real file
    sample_file = r"C:\Users\Aniket\Downloads\OSS_Lab\python-agents\data\references\testchat\MumbaiHacks, Code of Conduct.pdf"
    upload_reference_document(chat_id, sample_file)

    # Retrieve conversation history for the chat
    get_conversation(chat_id)

    # List all chat sessions
    list_conversations()

    # Optionally delete the chat session (uncomment to test)
    # delete_chat(chat_id)
