-- db/summaries.sql
-- Run this in your Supabase SQL Editor to create the session summaries table

-- Enable vector extension if not already enabled
create extension if not exists vector;

create table if not exists session_summaries (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade not null,
  session_id text not null,
  summary text not null,
  topics text[],                      -- array of topic tags
  priority int default 5,             -- 1-10 priority score
  message_count int,
  duration_minutes int,
  has_decisions boolean default false,
  has_action_items boolean default false,
  embedding vector(384),              -- vector embedding of the summary
  created_at timestamptz default now()
);

-- Row Level Security (RLS) policies
alter table session_summaries enable row level security;

drop policy if exists "Users can read own summaries" on session_summaries;
create policy "Users can read own summaries"
  on session_summaries for select using (auth.uid() = user_id);

drop policy if exists "Users can insert own summaries" on session_summaries;
create policy "Users can insert own summaries"
  on session_summaries for insert with check (auth.uid() = user_id);

drop policy if exists "Users can update own summaries" on session_summaries;
create policy "Users can update own summaries"
  on session_summaries for update using (auth.uid() = user_id);

drop policy if exists "Users can delete own summaries" on session_summaries;
create policy "Users can delete own summaries"
  on session_summaries for delete using (auth.uid() = user_id);

-- Performance indices
create index if not exists session_summaries_embedding_idx
  on session_summaries using ivfflat (embedding vector_cosine_ops)
  with (lists = 100);

create index if not exists session_summaries_user_priority_idx
  on session_summaries (user_id, priority desc);

-- Vector Similarity Search RPC for Summaries
create or replace function match_session_summaries (
  query_embedding vector(384),
  match_user_id uuid,
  match_count int
)
returns table (
  id uuid,
  session_id text,
  summary text,
  topics text[],
  priority int,
  message_count int,
  duration_minutes int,
  has_decisions boolean,
  has_action_items boolean,
  created_at timestamptz,
  similarity float
)
language plpgsql
as $$
begin
  return query
  select
    session_summaries.id,
    session_summaries.session_id,
    session_summaries.summary,
    session_summaries.topics,
    session_summaries.priority,
    session_summaries.message_count,
    session_summaries.duration_minutes,
    session_summaries.has_decisions,
    session_summaries.has_action_items,
    session_summaries.created_at,
    1 - (session_summaries.embedding <=> query_embedding) as similarity
  from session_summaries
  where session_summaries.user_id = match_user_id
    and session_summaries.embedding is not null
  order by session_summaries.embedding <=> query_embedding
  limit match_count;
end;
$$;
