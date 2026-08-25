# CodeLens AI 🔍

> **iQOO Hackathon 2026** — *"See the error. Understand the cause. Fix it. Verify it."*

CodeLens AI is a phone-first AI debugging assistant. A developer points their phone camera at a terminal error, stack trace, or log — and CodeLens extracts the error, understands it, retrieves relevant project context, identifies the root cause, generates a targeted fix, applies the fix after user approval, runs real pytest suites, and displays verified test results.

---

## 🚀 The Core Workflow

```
SEE → UNDERSTAND → FIX → VERIFY
```

Point. Capture. Understand. Apply Fix. Verify. Done.

---

## 🛠️ Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                    Frontend (React + Vite)                  │
│ Phone-first UI · Camera (getUserMedia) · Voice · Code Diff  │
└──────────────────────┬──────────────────────────────────────┘
                       │ HTTP API (Fetch Client)
┌──────────────────────▼──────────────────────────────────────┐
│                 Backend (Python + FastAPI)                  │
│ ┌─────────────┐  ┌──────────────────┐  ┌───────────────┐   │
│ │ Retrieval   │  │   LLM Service    │  │  Test Runner  │   │
│ │ Engine      │  │ ┌──────────────┐ │  │  (pytest)     │   │
│ └─────────────┘  │ │ Ollama (Qwen │ │  └───────────────┘   │
│                  │ │ 2.5/CodeLlama│ │                      │
│                  │ └──────┬───────┘ │                      │
│                  │ ┌──────▼───────┐ │                      │
│                  │ │ Fallback AI  │ │                      │
│                  │ └──────────────┘ │                      │
│                  └──────────────────┘                      │
└──────────────────────┬──────────────────────────────────────┘
                       │
┌──────────────────────▼──────────────────────────────────────┐
│                    demo-project                              │
│ FastAPI Auth Service · Intentional JWT Bug · Pytest Suite   │
└─────────────────────────────────────────────────────────────┘
```

---

## ✨ Features

| Feature | Status |
|---------|--------|
| 📱 **Phone-First Responsive Mobile UX** | ✅ |
| 📸 **Camera Error Capture (`getUserMedia`)** | ✅ |
| 🤖 **Real Local Open-Source AI via Ollama** | ✅ (`qwen2.5-coder:1.5b` / `codellama`) |
| ⚡ **Fast CPU Inference** | ✅ (10–12s responses with thread optimization) |
| 🔍 **Codebase Context Retrieval** | ✅ (Path scoring + file resolution) |
| 🧠 **Root Cause & Code Diff Analysis** | ✅ |
| 🛡️ **Explicit User Approval before Patching** | ✅ |
| 🔧 **Real Patch Engine with Backup Creation** | ✅ |
| 🧪 **Real Pytest Execution & Log Viewer** | ✅ (`20 / 20 TESTS PASSED`) |
| 🔄 **Deterministic Fallback Engine (Demo-Safe)**| ✅ |
| 🎯 **Instant Judge Demo Launcher** | ✅ (<1s scenario reset) |

---

## 💻 Setup & Installation

### Prerequisites

- **Python 3.10+**
- **Node.js 18+**
- **[Ollama](https://ollama.ai)** (For real local AI inference)

---

### 1. Clone & Navigate

```bash
git clone https://github.com/adavesh19/CodeLens-AI.git
cd CodeLens-AI
```

---

### 2. Ollama Local LLM Setup (Recommended)

Install Ollama and pull a lightweight code model:

```bash
# Pull fast lightweight code model (Recommended: 10s CPU response)
ollama pull qwen2.5-coder:1.5b

# Alternative standard model:
ollama pull codellama
```

Verify Ollama is running at `http://localhost:11434`.

---

### 3. Backend Setup

```bash
cd backend
pip install -r requirements.txt
python -m uvicorn main:app --reload --host 0.0.0.0 --port 8000
```

Backend will start at: `http://localhost:8000`

---

### 4. Frontend Setup

```bash
cd frontend
npm install
npm run dev
```

Frontend will start at: `http://localhost:5173`

---

## 🧪 Running Tests & Verification

### 1. Run Backend Unit Tests (29 Tests)

```bash
cd backend
python -m pytest tests/test_api.py -v
```

### 2. Run Demo Project Tests (20 Tests)

```bash
# Before patch application (8 failures expected):
cd demo-project
python -m pytest tests/ -v

# After patch application:
python -m pytest tests/ -v  # 20/20 PASSED
```

---

## 🏆 Judge Demo Walkthrough

1. Open `http://localhost:5173` on mobile or browser.
2. Click **⚡ START JUDGE DEMO** (resets demo project to buggy state instantly).
3. System extracts `HTTP 401 Unauthorized JWT validation failed auth.py:52`.
4. Click **ANALYZE ERROR** — Local AI identifies the milliseconds vs seconds comparison bug.
5. Review the **BEFORE / AFTER CODE DIFF**.
6. Click **APPLY FIX ✓** to approve and patch `demo-project/auth.py`.
7. Watch real test suite execution — **20 / 20 TESTS PASSED**.

---

## 🔒 Security

- **Path Traversal Protection**: Ensures patch targets remain strictly within project directory bounds.
- **Automatic Backups**: Creates `.bak` snapshot before applying any file modifications.

---

## 📄 License

Built for **iQOO Hackathon 2026**.
*CodeLens AI — See the error. Understand the cause. Fix it. Verify it.*
