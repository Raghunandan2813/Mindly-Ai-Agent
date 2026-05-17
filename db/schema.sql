-- db/schema.sql
-- Run this in your Supabase SQL Editor (supabase.com → SQL Editor → New Query → Paste → Run)
-- NOTE: Run this AGAIN to add the new RLS security policies!

-- 1. Enable vector extension
create extension if not exists vector;

-- 2. Messages table with vector embeddings (384 dimensions for all-MiniLM-L6-v2)
--    user_id references Supabase Auth's built-in users table (auth.users)
create table if not exists messages (
    id uuid primary key default gen_random_uuid(),
    user_id uuid references auth.users(id) on delete cascade not null,
    role text not null check (role in ('user', 'assistant')),
    content text not null,
    embedding vector(384),
    session_id text,
    created_at timestamptz default now()
);

-- 3. Index for fast vector similarity search
create index if not exists messages_embedding_idx
    on messages using ivfflat (embedding vector_cosine_ops)
    with (lists = 100);

-- ============================================================
-- 4. ROW LEVEL SECURITY — prevents data leaks between users
-- ============================================================
alter table messages enable row level security;

-- Policy: Users can only READ their own messages
create policy "Users can read own messages"
    on messages for select
    using (auth.uid() = user_id);

-- Policy: Users can only INSERT their own messages
create policy "Users can insert own messages"
    on messages for insert
    with check (auth.uid() = user_id);

-- Policy: Users can only DELETE their own messages
create policy "Users can delete own messages"
    on messages for delete
    using (auth.uid() = user_id);

-- 5. RPC function for semantic memory search (also respects RLS via auth.uid())
create or replace function match_messages(
    query_embedding vector(384),
    match_user_id uuid,
    match_count int default 10
)
returns table (
    id uuid,
    content text,
    role text,
    created_at timestamptz,
    similarity float
)
language sql stable
security definer
as $$
    select
        messages.id,
        messages.content,
        messages.role,
        messages.created_at,
        1 - (messages.embedding <=> query_embedding) as similarity
    from messages
    where messages.user_id = match_user_id
    order by messages.embedding <=> query_embedding
    limit match_count;
$$;
