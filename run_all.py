import subprocess
import os
import sys
import time
import socket
import re

# === Configuration ===
PORTS = {
    "frontend": 3000,
    "backend": 8000,
    "searxng": 8888
}
LOGS = {
    "frontend": "logs/frontend.log",
    "backend": "logs/backend.log",
    "searxng": "logs/searxng.log"
}
FRONTEND_HOST = "127.0.0.1"
MAX_FAILED_CHECKS = 3
CHECK_INTERVAL = 5  # seconds

# === Setup ===
os.makedirs("logs", exist_ok=True)
for name, path in LOGS.items():
    with open(path, "w") as f:
        f.write(f"--- New log for {name} ---\n")

# === Utility Functions ===
def is_port_open(host, port):
    try:
        with socket.create_connection((host, port), timeout=2):
            return True
    except Exception:
        return False

def free_port_windows(port):
    try:
        result = subprocess.check_output(f'netstat -ano | findstr :{port}', shell=True).decode()
        pids = set(re.findall(r'\d+\s*$', result, re.MULTILINE))
        for pid in pids:
            print(f"🛑 Port {port} is in use. Killing PID {pid}...")
            subprocess.run(f'taskkill /PID {pid} /F', shell=True, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
    except subprocess.CalledProcessError:
        # Nothing is using the port
        pass

# === Free Up All Required Ports ===
print("🔍 Checking for port conflicts...")
for name, port in PORTS.items():
    if is_port_open(FRONTEND_HOST, port):
        free_port_windows(port)
    else:
        print(f"✅ Port {port} is free.")

# === Commands ===
is_windows = os.name == 'nt'
shell = True if is_windows else False

frontend_cmd = 'cd OSS_UI && npm install && npm run electron-dev'
backend_cmd = 'cd python-agents && pip install -r requirements.txt && uvicorn main:app --host 127.0.0.1 --port 8000 --reload --log-level debug'
searxng_cmd = (
    'powershell -Command "'
    'Set-ExecutionPolicy -Scope Process -ExecutionPolicy Bypass -Force; '
    'cd searxng-master; '
    'python -m venv venv; '
    '.\\venv\\Scripts\\Activate.ps1; '
    'pip install -r requirements.txt; '
    '$env:FLASK_APP=\'searx.webapp\'; '
    'flask run --host=127.0.0.1 --port=8888"'
)

# === Start Processes ===
try:
    print("🚀 Launching Electron Frontend...")
    frontend = subprocess.Popen(frontend_cmd, shell=shell,
                                stdout=open(LOGS["frontend"], "a"),
                                stderr=subprocess.STDOUT)

    print("🚀 Launching Backend (FastAPI)...")
    backend = subprocess.Popen(backend_cmd, shell=shell,
                               stdout=open(LOGS["backend"], "a"),
                               stderr=subprocess.STDOUT)

    print("🚀 Launching SearXNG (Flask)...")
    searxng = subprocess.Popen(searxng_cmd, shell=shell,
                               stdout=open(LOGS["searxng"], "a"),
                               stderr=subprocess.STDOUT)

    print("✅ All services are running. Monitoring frontend health...\n")

    # === Monitor Frontend Health ===
    failed_checks = 0
    while True:
        if frontend.poll() is not None:
            print("❌ Frontend process exited. Terminating all services.")
            backend.terminate()
            searxng.terminate()
            break

        if not is_port_open(FRONTEND_HOST, PORTS["frontend"]):
            failed_checks += 1
            print(f"⚠️ Frontend port {PORTS['frontend']} unreachable ({failed_checks}/{MAX_FAILED_CHECKS})")
            if failed_checks >= MAX_FAILED_CHECKS:
                print("🚨 Frontend unresponsive. Shutting down all services.")
                frontend.terminate()
                backend.terminate()
                searxng.terminate()
                break
        else:
            failed_checks = 0  # Reset on success

        time.sleep(CHECK_INTERVAL)

except KeyboardInterrupt:
    print("\n🛑 Ctrl+C detected. Cleaning up...")
    frontend.terminate()
    backend.terminate()
    searxng.terminate()

except Exception as e:
    print(f"\n❌ Unexpected error: {e}")
    frontend.terminate()
    backend.terminate()
    searxng.terminate()

finally:
    print("✅ Cleanup complete. Exiting.")
    sys.exit(0)
