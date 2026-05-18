# Mindly AI 🧠✨

> An intelligent, self-evolving AI Memory Agent with a persistent Vector Knowledge Graph that remembers, learns, and evolves with you across every conversation.

[![Vercel Deployment](https://img.shields.io/badge/Vercel-Live-success?style=flat-square&logo=vercel&logoColor=white)](https://mindly-ai-agent.vercel.app)
[![Database](https://img.shields.io/badge/Supabase-Database-blue?style=flat-square&logo=supabase&logoColor=white)](https://supabase.com)
[![License](https://img.shields.io/badge/License-MIT-orange?style=flat-square)](LICENSE)
[![PRs Welcome](https://img.shields.io/badge/PRs-Welcome-brightgreen?style=flat-square)](CONTRIBUTING.md)

**Mindly AI** is a state-of-the-art AI assistant designed to solve the "context forgetfulness" problem inherent in standard LLMs. By combining **Short-Term chronological chat contexts** with a **Long-Term persistent Vector Knowledge Graph**, Mindly AI builds an evolving digital memory of your relationships, facts, preferences, and conversations — allowing it to recall details discussed months ago, across completely different sessions.

---

## 🌟 Premium Features

*   🧠 **Dynamic Cognitive Recall**: Automatic extraction of entities and relationships in the background. Uses `pgvector` cosine similarity checks (`threshold: 0.25`) to inject highly targeted context blocks straight into the LLM system prompt.
*   ⚡ **Resilient 4-Stage Embedding Chain**: An immune, fail-safe embedding pipeline using Groq Cloud (`nomic-embed-text-v1.5` with Matryoshka-slice to 384 dimensions), Hugging Face serverless, dynamic local `transformers.js`, and hard mathematical fail-safes. Fully serverless-safe!
*   📱 **60fps Mobile-Native Interactive Canvas**: A responsive, touch-supported force-directed canvas. Features node dragging, throwing, and instant inspection, backed by `ResizeObserver` to guarantee it never sizing-lags or goes invisible on mobile devices.
*   🔒 **Zero-Leak Security & RLS**: Secure email & Google OAuth authentication with cascading database deletions, whitelisted callbacks, and Row-Level Security (RLS) keeping your memory graph completely private.
*   🔌 **Dynamic Multi-Provider AI Backend**: Fully configurable to run on ultra-fast **Groq Cloud** (Llama 3.1, default), **Google Gemini**, **OpenRouter (DeepSeek)**, or **100% offline and private** on your own graphics card via **Ollama**.
*   🌓 **Cybernetic Monochrome Aesthetics**: A stunning dark-mode glassmorphic layout utilizing custom CSS grids, outfit typography, glowing canvas particle systems, and elegant micro-animations.

---

## 🏗️ How it Works (The Cognitive Architecture)

```
                       [ USER QUERY ]
                             │
                             ▼
               ┌───────────────────────────┐
               │  Vector Embedding Search  │ (pgvector similarity)
               └─────────────┬─────────────┘
                             │
                             ▼
               ┌───────────────────────────┐
               │ Recall Connected Neighbors│ (Knowledge Graph Edges)
               └─────────────┬─────────────┘
                             │
                             ▼
        ┌─────────────────────────────────────────┐
        │   "Sarah is your sister"                │ (Inject into System Prompt)
        │   "Sarah prefers strong black coffee"   │
        └────────────────────┬────────────────────┘
                             │
                             ▼
               ┌───────────────────────────┐
               │    LLM Generation Step    │ ◄─── Chronological history
               └─────────────┬─────────────┘
                             │
                             ▼
                   [ COGNITIVE RESPONSE ]
```

For an in-depth code-level analysis of this memory loop and background RLS bypassing, read our **[System Architecture Guide](docs/architecture.md)**.

---

## 🛠️ Technology Stack

| Layer | Technologies |
| :--- | :--- |
| **Frontend Framework** | Next.js 15 (App Router), React 19, TypeScript |
| **Database & Auth** | Supabase Cloud, PostgreSQL, `pgvector`, Next.js middleware sessions |
| **Styling** | Vanilla CSS, Glassmorphic CSS variables, TailwindCSS |
| **Interactive Graph** | HTML5 Canvas API, Force-Directed simulation math |
| **AI Processing** | Groq (Llama-3.1-8b-instant), Google Gemini, OpenRouter, Ollama |

---

## 🚀 Rapid Local Setup

Getting Mindly AI up and running locally is extremely straightforward:

1.  **Clone the Repo**:
    ```bash
    git clone https://github.com/Raghunandan2813/Mindly-Ai-Agent.git
    cd Mindly-Ai-Agent
    ```
2.  **Environment Variables**:
    ```bash
    cp .env.example .env.local
    ```
    *Populate `.env.local` with your Supabase URL, Anon Key, Secret Service Role Key, and Groq API Key.*
3.  **Database Migration**:
    *   Enable the **`vector`** extension in your Supabase Dashboard.
    *   Copy and run the migrations inside **`db/schema.sql`** in the Supabase SQL editor.
4.  **Install & Run**:
    ```bash
    npm install
    npm run dev
    ```

For a comprehensive walkthrough of account creations, Google OAuth configuration, and running **100% offline and private local models with Ollama**, check out our **[Local Development Setup Guide](docs/setup.md)**.

---

## 🤝 Contributing

Contributions are what make the open-source community an incredible place to learn and build! Any contribution you make is **greatly appreciated**. 

Please read our **[Contributing Guidelines](CONTRIBUTING.md)** to understand our coding styles, branching strategies, and Pull Request checklists.

---

## 📄 License

Distributed under the MIT License. See **[LICENSE](LICENSE)** for more information.
