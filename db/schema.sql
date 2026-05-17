-- db/schema.sql
-- Run this in your Supabase SQL Editor (supabase.com → SQL Editor → New Query → Paste → Run)
-- Graph-Based Node Memory Architecture

-- 1. Enable vector extension
create extension if not exists vector;

-- ============================================================
-- TIER 1: Raw conversation log (lightweight, no embeddings)
-- ============================================================
create table if not exists messages (
    id uuid primary key default gen_random_uuid(),
    user_id uuid references auth.users(id) on delete cascade not null,
    role text not null check (role in ('user', 'assistant')),
    content text not null,
    session_id text,
    created_at timestamptz default now()
);

-- ============================================================
-- TIER 2: Knowledge Graph (nodes + edges with embeddings)
-- ============================================================

-- 2a. Memory Nodes — distilled facts/entities extracted by AI
create table if not exists memory_nodes (
    id uuid primary key default gen_random_uuid(),
    user_id uuid references auth.users(id) on delete cascade not null,
    label text not null,
    node_type text not null default 'fact',
    content text not null,
    embedding vector(384),
    metadata jsonb default '{}',
    created_at timestamptz default now(),
    updated_at timestamptz default now()
);

-- 2b. Memory Edges — relationships between nodes
create table if not exists memory_edges (
    id uuid primary key default gen_random_uuid(),
    user_id uuid references auth.users(id) on delete cascade not null,
    source_id uuid references memory_nodes(id) on delete cascade not null,
    target_id uuid references memory_nodes(id) on delete cascade not null,
    relation text not null,
    strength float default 1.0,
    created_at timestamptz default now()
);

-- 3. Indexes
create index if not exists memory_nodes_embedding_idx
    on memory_nodes using ivfflat (embedding vector_cosine_ops)
    with (lists = 100);

create index if not exists memory_nodes_user_idx
    on memory_nodes (user_id);

create index if not exists memory_edges_source_idx
    on memory_edges (source_id);

create index if not exists memory_edges_target_idx
    on memory_edges (target_id);

create index if not exists memory_edges_user_idx
    on memory_edges (user_id);

-- ============================================================
-- 4. ROW LEVEL SECURITY
-- ============================================================

-- Messages RLS
alter table messages enable row level security;

drop policy if exists "Users can read own messages" on messages;
create policy "Users can read own messages"
    on messages for select using (auth.uid() = user_id);

drop policy if exists "Users can insert own messages" on messages;
create policy "Users can insert own messages"
    on messages for insert with check (auth.uid() = user_id);

drop policy if exists "Users can delete own messages" on messages;
create policy "Users can delete own messages"
    on messages for delete using (auth.uid() = user_id);

-- Memory Nodes RLS
alter table memory_nodes enable row level security;

drop policy if exists "Users can read own nodes" on memory_nodes;
create policy "Users can read own nodes"
    on memory_nodes for select using (auth.uid() = user_id);

drop policy if exists "Users can insert own nodes" on memory_nodes;
create policy "Users can insert own nodes"
    on memory_nodes for insert with check (auth.uid() = user_id);

drop policy if exists "Users can update own nodes" on memory_nodes;
create policy "Users can update own nodes"
    on memory_nodes for update using (auth.uid() = user_id);

drop policy if exists "Users can delete own nodes" on memory_nodes;
create policy "Users can delete own nodes"
    on memory_nodes for delete using (auth.uid() = user_id);

-- Memory Edges RLS
alter table memory_edges enable row level security;

drop policy if exists "Users can read own edges" on memory_edges;
create policy "Users can read own edges"
    on memory_edges for select using (auth.uid() = user_id);

drop policy if exists "Users can insert own edges" on memory_edges;
create policy "Users can insert own edges"
    on memory_edges for insert with check (auth.uid() = user_id);

drop policy if exists "Users can delete own edges" on memory_edges;
create policy "Users can delete own edges"
    on memory_edges for delete using (auth.uid() = user_id);

-- ============================================================
-- 5. RPC: Semantic node search
-- ============================================================
create or replace function match_nodes(
    query_embedding vector(384),
    match_user_id uuid,
    match_count int default 10
)
returns table (
    id uuid,
    label text,
    node_type text,
    content text,
    metadata jsonb,
    created_at timestamptz,
    similarity float
)
language sql stable
security definer
as $$
    select
        memory_nodes.id,
        memory_nodes.label,
        memory_nodes.node_type,
        memory_nodes.content,
        memory_nodes.metadata,
        memory_nodes.created_at,
        1 - (memory_nodes.embedding <=> query_embedding) as similarity
    from memory_nodes
    where memory_nodes.user_id = match_user_id
      and memory_nodes.embedding is not null
    order by memory_nodes.embedding <=> query_embedding
    limit match_count;
$$;

-- ============================================================
-- 6. RPC: Get neighbors of a node (1-hop traversal)
-- ============================================================
create or replace function get_node_neighbors(
    node_id uuid,
    match_user_id uuid
)
returns table (
    neighbor_id uuid,
    neighbor_label text,
    neighbor_type text,
    neighbor_content text,
    relation text,
    direction text
)
language sql stable
security definer
as $$
    -- Outgoing edges: this node -> neighbor
    select
        mn.id as neighbor_id,
        mn.label as neighbor_label,
        mn.node_type as neighbor_type,
        mn.content as neighbor_content,
        me.relation,
        'outgoing'::text as direction
    from memory_edges me
    join memory_nodes mn on mn.id = me.target_id
    where me.source_id = node_id
      and me.user_id = match_user_id
    union all
    -- Incoming edges: neighbor -> this node
    select
        mn.id as neighbor_id,
        mn.label as neighbor_label,
        mn.node_type as neighbor_type,
        mn.content as neighbor_content,
        me.relation,
        'incoming'::text as direction
    from memory_edges me
    join memory_nodes mn on mn.id = me.source_id
    where me.target_id = node_id
      and me.user_id = match_user_id;
$$;
