# OSS_Lab Installation & Setup Guide

## 📋 Prerequisites

**For guaranteed execution on Windows OS, please install these exact versions:**

### Required Software
- **Node.js v22.15.0** - [Download](https://nodejs.org/dist/v22.15.0/node-v22.15.0-x64.msi)
- **Python 3.11.9** - [Download](https://www.python.org/ftp/python/3.11.9/python-3.11.9-amd64.exe)
- **Git** - [Download](https://git-scm.com/download/win)

### System Requirements
- **OS**: Windows 10/11 (64-bit)
- **RAM**: Minimum 8GB, Recommended 16GB
- **Storage**: At least 5GB free space
- **Internet**: Required for initial setup and web search functionality

***

## 🚀 Installation Steps

### Step 1: Install Prerequisites

1. **Install Node.js v22.15.0**
   - Download from the link above
   - Run the installer as Administrator
   - **Important**: Check "Add to PATH" during installation
   - Verify installation:  
     ```powershell
     node --version
     npm --version
     ```
     Expected output: `v22.15.0` and an npm version

2. **Install Python 3.11.9**
   - Download from the link above
   - Run the installer as Administrator
   - **Critical**: Check "Add Python to PATH" checkbox
   - Choose "Install Now"
   - Verify installation:  
     ```powershell
     python --version
     pip --version
     ```
     Expected output: `Python 3.11.9` and pip version

3. **Install Git**
   - Download and install with default settings
   - Verify:  
     ```powershell
     git --version
     ```

### Step 2: Clone the Repository

```powershell
git clone https://github.com/MarvelBoy047/OSS_Lab.git
cd OSS_Lab
````
---

## 🤖 Automated Setup
## For windows OS only
# Double-click on the ``` Run.bat``` you're app wil run but you must have the prerequesites installed still!  
---

## ⚡ Manual Setup (For development purpose)

Run these steps in **three separate terminals**:

### Terminal 1: Frontend (Electron + Next.js)

```powershell
cd OSS_UI
npm install
npm run electron-dev
```

### Terminal 2: Backend (FastAPI + Agents)

```powershell
cd python-agents
pip install -r requirements.txt
uvicorn main:app --host 127.0.0.1 --port 8000 --reload --log-level debug
```

### Terminal 3: SearXNG (Search Engine)

```powershell
cd searxng-master
python -m venv venv
venv\Scripts\Activate.ps1
pip install -r requirements.txt
$env:FLASK_APP = "searx.webapp"
flask run --host=127.0.0.1 --port=8888
```
---

## 🌐 Application Access Points

Once all services are running:

| Service               | URL                                                      | Description                |
| --------------------- | -------------------------------------------------------- | -------------------------- |
| **Main Application**  | Electron Window                                          | Auto-opens the desktop app |
| **Backend API**       | [http://localhost:8000](http://localhost:8000)           | FastAPI backend server     |
| **API Documentation** | [http://localhost:8000/docs](http://localhost:8000/docs) | Interactive API docs       |
| **SearXNG Search**    | [http://localhost:8888](http://localhost:8888)           | Search engine interface    |

---

## 📁 Project Structure

```
OSS_Lab/
├── OSS_UI/                 # Frontend (Next.js + Electron)
├── python-agents/          # Backend (FastAPI + AI Agents)
├── searxng-master/         # Search Engine (SearXNG)
└── .gitignore              # Git ignore rules
```

---

## 🛠️ Troubleshooting

### Common Issues & Solutions

#### "Node is not recognized"

* Reinstall Node.js v22.15.0 with "Add to PATH" checked
* Restart PowerShell
* If problem persists, manually add Node.js to PATH

#### "Python is not recognized"

* Reinstall Python 3.11.9 with "Add Python to PATH" checked
* Restart PowerShell
* Manually add Python to PATH if needed

#### Port already in use

* Stop processes using ports 3000, 8000, or 8888
* Restart computer if necessary

#### Frontend won't start

```powershell
cd OSS_UI
rm -rf node_modules
rm package-lock.json
npm install
```

#### Backend dependencies fail

```powershell
cd python-agents
pip install --upgrade pip
pip install -r requirements.txt --force-reinstall
```

#### SearXNG virtual environment errors

```powershell
cd searxng-master
rmdir /s venv
python -m venv venv
venv\Scripts\activate
pip install -r requirements.txt
```
# First time launches can be buggy so after Main window is live try Ctrl+R for quick refersh the application will work like charm ✨
---

## ✅ Quick Start Checklist

* [ ] Node.js v22.15.0 installed and in PATH
* [ ] Python 3.11.9 installed and in PATH
* [ ] Git installed
* [ ] Repository cloned
* [ ] Frontend running
* [ ] Backend running
* [ ] SearXNG running
* [ ] Electron app window appeared
* [ ] Backend API responding at `http://localhost:8000`
* [ ] SearXNG responding at `http://localhost:8888`

---

**🎉 Congratulations! OSS\_Lab is ready. Happy analyzing!**


```


