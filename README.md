<div align="center">
  # OSS_Lab - AI Research Assistant Platform
</div>

<div align="center">

**Democratizing AI research with an open-source, full-stack platform powered by open-source LLMs**

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![Python 3.11+](https://img.shields.io/badge/python-3.11+-blue.svg)](https://www.python.org/downloads/)
[![Next.js](https://img.shields.io/badge/Next.js-14-black)](https://nextjs.org/)
[![FastAPI](https://img.shields.io/badge/FastAPI-latest-green)](https://fastapi.tiangolo.com/)

</div>

## 🎥 Demo Video

[![OSS_Lab Demo - AI Research Assistant Platform](https://img.youtube.com/vi/Bpcilc9F40I/maxresdefault.jpg)](https://youtu.be/Bpcilc9F40I?si=WTcL1B_rf89mRYjr)

> [!NOTE]
> **Watch the complete demo**: See OSS_Lab in action - from simple conversations to automated Jupyter notebook generation with Llama-3-70B models!

## 🌟 Overview

OSS_Lab is a comprehensive AI research platform that combines the power of open-source LLMs with intuitive interfaces and automated analysis workflows. Transform complex data analysis into interactive notebooks and insights with just a conversation.

### ✨ Key Features

- 🤖 **AI-Powered Chat Interface** - Stream responses from Llama-3-70B in real-time.
- 📊 **Automated Notebook Generation** - Let the AI create complete Jupyter notebooks from your conversations.
- 🎨 **Professional UI/UX** - Thoughtfully designed interface with dark/light themes and responsive layouts.
- 🔍 **Integrated Web Search** - Enhance your research with built-in web search capabilities.
- 📁 **Multi-Format Support** - Handle CSV, JSON, Excel, and notebook files with ease.
- ⚡ **Real-Time Updates** - WebSocket architecture ensures instant, streaming responses from the AI.

## 🚀 Quick Start

> [!IMPORTANT]
> To use OSS_Lab quickly, simply double-click on the `run.bat` file in the main directory. This script handles the complete setup and launches the application for you.

## 🗺️ Roadmap

Here is the current status of our key features and future development goals.

- ✅ Dataset reference through select datasets button
- ✅ Chat with web search
- ✅ Settings page
- ✅ Discover page
- ✅ Dashboard minimal build
- ✅ Notebook generation
- ✅ Realtime system vital monitor
- ❌ Dashboard accurate data
- ❌ Chat with reference documents (RAG)
- ❌ Presentation generation
- ❌ Multiple providers (only GROQ)
- ❌ Token and temperature control

> [!TIP]
> Want to help bring the unchecked features to life? We welcome contributions! See our [Contributing](#-contributing) section to get started.

## 🏗️ Architecture

### Backend (`python-agents/`)
```
python-agents/
├── main.py              # FastAPI application entry point
├── config.py            # Configuration and API keys
├── core/
│   ├── chat_manager.py  # Conversation management
│   └── agents/          # AI agent implementations
├── websocket/           # WebSocket connection management
└── conversations/       # Chat history and notebooks
```

### Frontend (`OSS_UI/`)
```
OSS_UI/
├── src/
│   ├── app/             # Next.js app router pages
│   ├── components/      # Reusable React components
│   ├── lib/             # Utility functions and hooks
│   └── styles/          # Global styles and themes
├── public/              # Static assets
└── package.json         # Dependencies and scripts
```

### Search Engine (`searxng-master/`)
- Privacy-focused, hackable metasearch engine.
- Provides enhanced web search capabilities for research queries.

## 🤖 AI Integration

### LLM Integration

OSS_Lab leverages high-performance open-source models like **Llama-3-70B** through the Groq API for:

- **Conversational AI**: Natural language interactions with context awareness.
- **Code Generation**: Automatic creation of analysis scripts and notebooks.
- **Data Analysis**: Intelligent interpretation of datasets and trends.
- **Research Assistance**: Comprehensive answers with integrated web search.

### Example Workflow

1. **Upload Data**: Drop a CSV file into the chat interface.
2. **Ask Questions**: "Analyze this sales data and show trends".
3. **Get Insights**: The AI generates analysis and creates a Jupyter notebook.
4. **Explore Results**: Open the interactive notebook with code, visualizations, and explanations.

## 📖 Usage Guide

### Basic Chat

1. The application will open at `http://localhost:3000`.
2. Start typing in the chat interface to get answers from the AI.
3. Upload files for analysis by clicking the paperclip icon.

### Data Analysis

1. Upload a CSV, JSON, or Excel file.
2. Ask questions about your data (e.g., "Find the correlation between column A and B").
3. The AI will automatically generate analysis code and a notebook.
4. View results in the integrated notebook viewer and export for sharing.

### Settings Configuration

> [!NOTE]
> Your Groq API key is required to power the AI features. You can get a free key from [Groq](https://console.groq.com/keys).

1. Navigate to **Settings** in the sidebar.
2. Enter your Groq API key.
3. Configure AI features and choose between light and dark themes.

## 🤝 Contributing

We welcome contributions to OSS_Lab! Here's how to get started:

### Development Setup

1. Fork the repository.
2. Create a feature branch: `git checkout -b OSS_Lab`
3. Make your changes.
4. Commit your changes: `git commit -m 'Add amazing feature'`
5. Push to the branch: `git push origin OSS_Lab`
6. Open a Pull Request.

### Contribution Guidelines

- Follow existing code style and conventions.
- Add tests for new functionality where applicable.
- Update documentation as needed.

## 🙏 Acknowledgments

- **Groq** for providing ultra-fast inference infrastructure for open-source models.
- **SearXNG** for its powerful, privacy-focused search capabilities.
- **The open-source community** for creating the amazing tools and libraries that make this project possible.

## 📞 Support

- **Issues**: [GitHub Issues](https://github.com/MarvelBoy047/OSS_Lab/issues)
- **Discussions**: [GitHub Discussions](https://github.com/MarvelBoy047/OSS_Lab/discussions)
- **Demo Video**: [Watch on YouTube](https://youtu.be/Bpcilc9F40I?si=WTcL1B_rf89mRYjr)

---

<div align="center">

**Built with ❤️ for the OpenAI Open Model Hackathon 2025**

*Empowering researchers, students, and innovators worldwide*

[![Watch Demo](https://img.shields.io/badge/▶️%20Watch%20Demo-YouTube-red?style=for-the-badge)](https://youtu.be/Bpcilc9F40I?si=WTcL1B_rf89mRYjr)

</div>
