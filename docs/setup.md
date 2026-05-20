# Local Development & Setup Guide 🛠️💻

This guide provides step-by-step instructions to get **Mindly AI** running successfully on your local machine.

---

## 📋 Prerequisites

Before starting, ensure you have the following installed:
*   **Node.js** (v18.0.0 or higher)
*   **npm** (or pnpm/yarn/bun)
*   A **Supabase** account (Free tier is 100% sufficient)
*   A **Groq Cloud** account (For ultra-fast, free cloud embeddings/chat) OR **Ollama** installed locally (For 100% offline, private operations)

---

## 🗄️ Step 1: Database Setup (Supabase)

Mindly AI utilizes Supabase as a PostgreSQL backend with `pgvector` enabled to perform knowledge graph traversals and semantic memory searches.

### 1. Create a New Project
1.  Go to the **[Supabase Dashboard](https://supabase.com)** and create a new project.
2.  Choose a database password and select the region closest to you.

### 2. Enable Vector Extensions
Before running the schema migrations, you must enable the vector database extension:
1.  In your Supabase project left sidebar, click on **Database**.
2.  Click on **Extensions**.
3.  Search for **`vector`** and toggle it on (or ensure it is active).

### 3. Run the Database Schema Migration
1.  In the left sidebar, click on **SQL Editor**.
2.  Click **New query**.
3.  Open the file **`db/schema.sql`** in this project repository.
4.  Copy the entire SQL content and paste it into the Supabase SQL editor.
5.  Click **Run** to execute the query.
    *   *This will automatically create the `messages`, `memory_nodes`, and `memory_edges` tables, set up their cascading foreign key relationships, configure Row Level Security (RLS) rules, and register the specialized database RPC functions (`match_nodes`, `get_node_neighbors`).*

### 4. Storage buckets (avatars & exports)

Profile photo uploads use the **`avatars`** bucket. Large GDPR exports use the **`exports`** bucket (private).

1.  Open **SQL Editor** → **New query**.
2.  Run **`db/storage_avatars_bucket.sql`** (creates `avatars`, public read, user-scoped write policies).
3.  For exports: **Storage** → **New bucket** → id **`exports`**, leave **Public** off (signed URLs only).  
    *Or* create it from the dashboard only; the app uploads under `exports/<userId>/...`.

If you skip this step, avatar upload will fail with a message about the missing **`avatars`** bucket.

---

## 🔑 Step 2: Extracting API Keys

Go to **Project Settings (gear icon)** ➔ **API** in the Supabase Dashboard:

1.  **Project URL**: Copy this URL (under Project API keys) ➔ paste as `NEXT_PUBLIC_SUPABASE_URL`.
2.  **Anon Key**: Copy this public key ➔ paste as `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` and `NEXT_PUBLIC_SUPABASE_ANON_KEY`.
3.  **Service Role Key (Secret)**: Scroll down to **Secret keys**, click **Reveal**, and copy the `service_role` key ➔ paste as `SUPABASE_SERVICE_ROLE_KEY`.
    *   > [!IMPORTANT]
    *   > The `SUPABASE_SERVICE_ROLE_KEY` is absolutely required for Vercel and local background server operations to bypass RLS policies and successfully save memory nodes asynchronously!

---

## 🌐 Step 3: Configuring Authentication & Redirects

To support secure Sign Ins (email or Google OAuth) on both your local machine and your Vercel production deployment, you must whitelist your callback URLs:

1.  In your Supabase project left sidebar, click on **Authentication** ➔ **URL Configuration**.
2.  **Site URL**: Set this to your production domain (e.g. `https://your-app.vercel.app`) or `http://localhost:3000` during testing.
3.  **Redirect URLs**: Add both of the following URLs to the whitelist:
    *   `http://localhost:3000/api/auth/callback`
    *   `https://your-app.vercel.app/api/auth/callback` (Replace with your actual Vercel domain!)

---

## 💻 Step 4: Local Application Configuration

1.  Copy the environment template:
    ```bash
    cp .env.example .env.local
    ```
2.  Open **`.env.local`** and populate it with the API keys you copied in **Step 2**:
    ```env
    NEXT_PUBLIC_SUPABASE_URL=https://your-id.supabase.co
    NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
    SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
    PROVIDER=groq
    GROQ_API_KEY=gsk_your_groq_key_here
    ```

---

## 🚀 Step 5: Run the Development Server

1.  Install dependencies:
    ```bash
    npm install
    ```
2.  Start the development server:
    ```bash
    npm run dev
    ```
3.  Open your browser and navigate to **`http://localhost:3000`**!

---

## 📴 Option: 100% Offline Local Setup (Ollama)

If you prefer absolute privacy and want to run Mindly AI completely local on your PC with zero network requests:

1.  Download and install **[Ollama](https://ollama.com)** on your PC.
2.  Pull the chat model in your command line:
    ```bash
    ollama run llama3
    ```
3.  Pull the vector embedding model:
    ```bash
    ollama pull nomic-embed-text
    ```
4.  Update your local **`.env.local`** file to enforce Ollama:
    ```env
    PROVIDER=ollama
    OLLAMA_URL=http://localhost:11434
    OLLAMA_MODEL=llama3
    ```
5.  Start Next.js (`npm run dev`) and chat privately! The embedding model and chat engine will run entirely on your graphics card (GPU) or CPU offline!
