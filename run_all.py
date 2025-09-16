import sys
import subprocess
import os
import time
import socket
import threading
import random
import re

# Ensure dependencies
def ensure_package(pkg):
    try:
        __import__(pkg)
    except ImportError:
        subprocess.check_call([sys.executable, "-m", "pip", "install", pkg])

ensure_package("pyfiglet")
ensure_package("colorama")

import pyfiglet
from colorama import Fore, Style, init

init(autoreset=True)

# Generate creative ASCII art for any text
def creative_print(text):
    fonts = ["slant", "big", "banner3-D", "block", "starwars", "digital"]
    font = random.choice(fonts)
    fig = pyfiglet.Figlet(font=font)
    ascii_art = fig.renderText(text)
    
    colors = [Fore.RED, Fore.GREEN, Fore.YELLOW, Fore.BLUE, Fore.MAGENTA, Fore.CYAN]
    color = random.choice(colors)
    
    print(color + Style.BRIGHT + ascii_art)

# === CONFIGURATION ===
LOG_DIR = "logs"
PORTS = {
    "searxng": 8888,
    "backend": 8000,
    "frontend": 3000
}
LOG_FILES = {
    "searxng": f"{LOG_DIR}/searxng.log",
    "backend": f"{LOG_DIR}/backend.log",
    "frontend": f"{LOG_DIR}/frontend.log",
}
FRONTEND_HOST = "127.0.0.1"
FRONTEND_CHECK_DELAY = 5  # seconds to wait after launch before checking frontend

# === SETUP ===
def setup_logs():
    """Purge old logs and create new ones."""
    os.makedirs(LOG_DIR, exist_ok=True)
    for path in LOG_FILES.values():
        with open(path, "w", encoding='utf-8') as f:
            f.write(f"--- New log for {path} ---\n")

# === UTILITY FUNCTIONS ===
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
            print(f"Port {port} is in use. Killing PID {pid}...")
            subprocess.run(f'taskkill /PID {pid} /F', shell=True, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
    except subprocess.CalledProcessError:
        pass

def kill_process_tree(proc):
    """Kill a process and all its children on Windows."""
    if proc.poll() is None:
        subprocess.run(
            f'taskkill /F /T /PID {proc.pid}',
            shell=True,
            stdout=subprocess.DEVNULL,
            stderr=subprocess.DEVNULL
        )

# === PHASE 1: INSTALL DEPENDENCIES ===
def run_install(cmd, label, log_path):
    """Run install command silently in background (no window)."""
    print(f"Installing {label} dependencies...")
    with open(log_path, "w", encoding='utf-8') as log_file:
        proc = subprocess.Popen(
            cmd,
            shell=True,
            stdout=log_file,
            stderr=subprocess.STDOUT,
            text=True,
            creationflags=subprocess.CREATE_NO_WINDOW
        )
        proc.wait()

        if proc.returncode != 0:
            print(f"Error: {label} installation failed. Check {log_path}")
            sys.exit(1)
        else:
            print(f"Success: {label} installation completed.")

# === MAIN EXECUTION ===
try:
    # === PRINT DYNAMIC OSS LABS LOGO ===
    creative_print("OSS Labs")
    print("\nOSS Labs Terminal Controller\n")

    # === PURGE OLD LOGS ===
    setup_logs()

    # === CHECK REQUIRED DIRECTORIES ===
    required_dirs = [
        "searxng-master",
        "python-agents",
        "OSS_UI"
    ]
    for d in required_dirs:
        if not os.path.exists(d):
            print(f"Error: Required directory '{d}' not found. Exiting.")
            sys.exit(1)

    # === FREE PORTS (Windows Only) ===
    is_windows = os.name == 'nt'
    if is_windows:
        for name, port in PORTS.items():
            if is_port_open(FRONTEND_HOST, port):
                free_port_windows(port)

    # === PHASE 1: RUN INSTALLS IN PARALLEL (HIDDEN) ===
    print("\nPHASE 1: Installing dependencies... This will take lot of time in first run Please wait...\n")
    install_threads = []

    # SearXNG Install — hidden
    searxng_install_cmd = 'cd searxng-master && pip install -r requirements.txt'
    t = threading.Thread(target=run_install, args=(searxng_install_cmd, "SearXNG", LOG_FILES["searxng"]))
    t.start()
    install_threads.append(t)

    # Backend Install — hidden
    backend_install_cmd = 'cd python-agents && pip install -r requirements.txt'
    t = threading.Thread(target=run_install, args=(backend_install_cmd, "Backend", LOG_FILES["backend"]))
    t.start()
    install_threads.append(t)

    # Frontend Install — hidden
    frontend_install_cmd = 'cd OSS_UI && npm install'
    t = threading.Thread(target=run_install, args=(frontend_install_cmd, "Frontend", LOG_FILES["frontend"]))
    t.start()
    install_threads.append(t)

    # Wait for all installs to finish
    for t in install_threads:
        t.join()

    # === PHASE 2: LAUNCH SERVICES IN THREE SEPARATE HIDDEN POWERSHELL WINDOWS ===
    print("\nPHASE 2: Launching services in hidden PowerShell windows...\n")

    processes = []

    # Get absolute path of current directory (where run_all.py lives)
    base_dir = os.getcwd()

    # 🔹 SearXNG
    searxng_cmd = f'$env:FLASK_APP="searx.webapp"; cd "{base_dir}\\searxng-master"; flask run --host=127.0.0.1 --port=8888'
    searxng_proc = subprocess.Popen(
        ["powershell.exe", "-NoProfile", "-ExecutionPolicy", "Bypass", "-WindowStyle", "Hidden", "-Command", searxng_cmd],
        stdout=open(LOG_FILES["searxng"], "a", encoding='utf-8'),
        stderr=subprocess.STDOUT,
        text=True,
        creationflags=subprocess.CREATE_NO_WINDOW
    )
    processes.append(searxng_proc)

    # 🔹 Backend
    backend_cmd = f'cd "{base_dir}\\python-agents"; $env:PYTHONIOENCODING="utf-8"; $env:PYTHONLEGACYWINDOWSSTDIO="utf-8"; uvicorn main:app --host 127.0.0.1 --port 8000 --reload --log-level debug'
    backend_proc = subprocess.Popen(
        ["powershell.exe", "-NoProfile", "-ExecutionPolicy", "Bypass", "-WindowStyle", "Hidden", "-Command", backend_cmd],
        stdout=open(LOG_FILES["backend"], "a", encoding='utf-8'),
        stderr=subprocess.STDOUT,
        text=True,
        creationflags=subprocess.CREATE_NO_WINDOW
    )
    processes.append(backend_proc)

    # 🔹 Frontend
    frontend_cmd = f'cd "{base_dir}\\OSS_UI"; npm run electron-dev'
    frontend_proc = subprocess.Popen(
        ["powershell.exe", "-NoProfile", "-ExecutionPolicy", "Bypass", "-WindowStyle", "Hidden", "-Command", frontend_cmd],
        stdout=open(LOG_FILES["frontend"], "a", encoding='utf-8'),
        stderr=subprocess.STDOUT,
        text=True,
        creationflags=subprocess.CREATE_NO_WINDOW
    )
    processes.append(frontend_proc)

    print("✅ All three services launched in hidden PowerShell windows.\n")

    # === WAIT 5 SECONDS THEN CHECK ONLY FRONTEND PORT ===
    time.sleep(FRONTEND_CHECK_DELAY)

    if is_port_open(FRONTEND_HOST, PORTS["frontend"]):
        print("✅ Frontend is responsive. All systems go.\n")
    else:
        print("❌ Frontend did not start within 5 seconds. Terminating all services...\n")
        for proc in processes:
            kill_process_tree(proc)
        sys.exit(1)

    # === MONITOR FRONTEND FOREVER ===
    while True:
        if not is_port_open(FRONTEND_HOST, PORTS["frontend"]):
            print("⚠️ Frontend became unreachable. Shutting down all services.")
            for proc in processes:
                kill_process_tree(proc)
            sys.exit(1)
        time.sleep(5)

except KeyboardInterrupt:
    print("\n🛑 Ctrl+C detected. Cleaning up...")
    for proc in processes:
        kill_process_tree(proc)
    sys.exit(0)

except Exception as e:
    print(f"\n❌ Unexpected error: {e}")
    for proc in processes:
        kill_process_tree(proc)
    sys.exit(1)

finally:
    print("✅ Cleanup complete. Exiting.")
    for proc in processes:
        kill_process_tree(proc)
    sys.exit(0)
