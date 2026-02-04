# OFAI

AI-assisted e-commerce platform for tracking price reductions and deals.

## Project Structure

```
AppReduceri/
├── appredueri_backend/     # Node.js backend API
├── appredueri_mobile/      # React Native mobile app
├── directives/             # Layer 1: SOPs and instructions (Markdown)
├── execution/              # Layer 3: Deterministic Python scripts
├── .tmp/                   # Temporary files (not committed)
├── CLAUDE.md               # Agent instructions
└── README.md               # This file
```

## 3-Layer AI Agent Architecture

This project uses a specialized architecture for AI-assisted development and automation:

### Layer 1: Directive (What to do)
- **Location**: `directives/`
- **Format**: Markdown SOPs
- **Purpose**: Define goals, inputs, tools, outputs, and edge cases
- Natural language instructions for the AI agent

### Layer 2: Orchestration (Decision making)
- **Agent**: Claude/AI assistant
- **Purpose**: Intelligent routing and decision-making
- Reads directives, calls execution tools, handles errors, updates learnings

### Layer 3: Execution (Doing the work)
- **Location**: `execution/`
- **Format**: Python scripts
- **Purpose**: Deterministic, reliable execution
- Handles API calls, data processing, file operations

### Why This Works
LLMs are probabilistic (90% accuracy per step = 59% success over 5 steps). By pushing complexity into deterministic code, the AI agent focuses only on decision-making, dramatically improving reliability.

## Getting Started

### Backend Setup
```bash
cd appredueri_backend
npm install
cp .env.example .env
# Configure your .env file
npm run dev
```

### Mobile App Setup
```bash
cd appredueri_mobile
npm install
npx expo start
```

### Python Scripts Setup
```bash
# Install Python dependencies
pip install -r requirements.txt

# Configure environment variables
cp .env.example .env
# Edit .env with your API keys
```

## AI Agent Usage

The AI agent (Claude) operates by:

1. Reading directives from `directives/`
2. Making intelligent decisions about execution flow
3. Calling deterministic Python scripts from `execution/`
4. Handling errors and updating directives with learnings
5. Self-annealing when things break

See [CLAUDE.md](./CLAUDE.md) for detailed agent instructions.

## File Organization

- **Deliverables**: Cloud-based outputs (Google Sheets, Slides, etc.)
- **Intermediates**: Temporary files in `.tmp/` (regenerable, not committed)

## Development

- Backend: Node.js + Express + PostgreSQL
- Mobile: React Native + Expo
- Automation: Python scripts + AI orchestration

## Environment Variables

Required environment variables are documented in:
- `appredueri_backend/.env.example` - Backend API configuration
- `.env.example` - Python scripts configuration
