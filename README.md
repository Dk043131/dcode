# DCODE — AI-Native Agentic Coding Environment

**Dcode** is a professional, developer-first AI coding environment engineered for real software repositories. Unlike generic chat interfaces, Dcode puts the AI agent directly into the development loop: inspecting files, understanding architecture, planning work, safely mutating code, executing terminal processes, and verifying results with automatic checkpoints and rollbacks.

---

## Key Highlights

- **First-Class OpenRouter Support**: Query free and paid frontier models with live capabilities, context windows, and pricing tags.
- **Provider Interchangeability**: Run with OpenRouter, local Ollama models, OpenAI, Gemini, Anthropic, or any custom OpenAI-compatible endpoint.
- **Automatic Model Router & Failovers**: Seamless failover to fallback models or local offline Ollama models without breaking context.
- **Autonomous Multi-Step Agent Loop**: Agent analyzes files, requests permissions, executes tools sequentially, runs tests, and applies fixes.
- **Deterministic Security & Permissions**: Command classification (`SAFE`, `CAUTION`, `DANGEROUS`, `BLOCKED`) with workspace boundary enforcement and automatic secret masking (`.env`, private keys).
- **Pro Developer UI**: Monochromatic dark theme (`#050505`), Monaco code editor with split tabs, XTerm.js terminal with live WebSocket PTY, restorable checkpoints, and Cmd+K command palette.

---

## Architecture Overview

```
                      +-----------------------------------+
                      |         Dcode IDE UI              |
                      |   (Vite + React + Monaco + Xterm) |
                      +-----------------+-----------------+
                                        | (REST + WebSocket)
                      +-----------------v-----------------+
                      |       Dcode Core Backend          |
                      |      (Node.js / Express / WS)     |
                      +---+-----------+-------------+-----+
                          |           |             |
        +-----------------+           |             +------------------+
        |                             |                                |
+-------v-------+             +-------v-------+                +-------v--------+
| Provider Hub  |             | Tool Registry |                | Security Engine|
| - OpenRouter  |             | - read_file   |                | - Boundary Box |
| - Ollama      |             | - write_file  |                | - Command Gate |
| - Custom API  |             | - run_tests   |                | - Secret Mask  |
| - Model Router|             | - checkpoints |                | - Policy Rules |
+---------------+             +---------------+                +----------------+
```

---

## Getting Started

### 1. Installation
```bash
npm install
```

### 2. Run Development Servers
Start both backend runtime and Vite frontend:
```bash
npm run dev
```

The application will be live at `http://localhost:5173`, with the backend server listening on `http://localhost:3001`.

### 3. Running Tests
```bash
npx tsx --test test/security.test.ts
```
