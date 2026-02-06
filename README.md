# Aegis AI – Offline-First Intelligent Document & Ops Assistant

> **🎯 New to this project?** Start with [START_HERE.md](./START_HERE.md) to know what to run first!

## Phase 1: Production-Ready RAG Web App

Aegis AI is an intelligent document assistant that uses Retrieval-Augmented Generation (RAG) to answer questions from uploaded documents with citations and risk classification.

## Features

### Phase 1: Web App
- 📄 **PDF Upload & Processing**: Upload PDF files and extract text
- 🔍 **Intelligent Chunking**: Text chunking with overlap for better context
- 🧠 **RAG System**: Answer questions using retrieved context to avoid hallucinations
- 📚 **Citations**: Grounded answers with source citations
- ⚠️ **Risk Classification**: Classify documents as Critical, Warning, or Normal
- 🌍 **Multi-language Support**: Support for multiple output languages

### Phase 2: Mobile App (NEW)
- 📷 **On-Device OCR**: Scan documents using camera with Google ML Kit
- 🧠 **Offline AI**: Document classification and RAG without internet
- 📱 **Hybrid Mode**: Seamlessly switch between offline and cloud AI
- 🔄 **Vector Sync**: Sync vectors to Pinecone when online
- 💾 **Local Storage**: SQLite + MMKV for fast vector storage
- ⚡ **Native Performance**: Native modules for OCR and ML inference

## Tech Stack

### Backend
- Node.js + TypeScript
- Express.js
- LangChain (orchestration)
- LlamaIndex (document ingestion)
- pgvector (vector database)
- PostgreSQL with pgvector extension

### Frontend
- React + TypeScript
- Modern UI components

## Getting Started

### Prerequisites

- Node.js 18+
- PostgreSQL 14+ with pgvector extension
- npm or yarn

### Installation

1. Install dependencies:
```bash
npm install
```

2. Set up PostgreSQL with pgvector:
```bash
# Install pgvector extension in your PostgreSQL database
CREATE EXTENSION IF NOT EXISTS vector;
```

3. Configure environment variables:
```bash
cp apps/backend/.env.example apps/backend/.env
# Edit .env with your database credentials and API keys
```

4. Run database migrations:
```bash
cd apps/backend
npm run migrate
```

5. Start the backend:
```bash
cd apps/backend
npm run dev
```

6. Start the frontend (in a new terminal):
```bash
cd apps/web
npm run dev
```

## Project Structure

```
aegis-ai/
├── apps/
│   ├── web/                      # React frontend
│   ├── backend/                  # Node.js backend
│   └── mobile/                   # React Native mobile app (Phase 2)
├── docs/
│   ├── architecture.md
│   ├── rag-flow.md
│   └── mobile-architecture.md
└── README.md
```

## Quick Start

**🎯 Not sure what to run first?** See [START_HERE.md](./START_HERE.md)

**Want to get running fast?** See [QUICK_START.md](./QUICK_START.md)

**Want detailed instructions?** See [RUN_GUIDE.md](./RUN_GUIDE.md)

**Want to see what you'll get?** See [OUTPUT_EXAMPLES.md](./OUTPUT_EXAMPLES.md)

## Documentation

- **[Product documentation](./docs/PRODUCT_DOCUMENTATION.md)** – What we've built (features, APIs, architecture)
- [Architecture](./docs/architecture.md)
- [RAG Flow](./docs/rag-flow.md)
- [Mobile Architecture](./docs/mobile-architecture.md) (Phase 2)
- [Hybrid Decision Logic](./docs/hybrid-decision-logic.md) (Phase 2)

## License

MIT
