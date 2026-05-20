-- db/security_patches.sql
-- Run this in your Supabase SQL Editor to add security flagging, redaction, and locks support.

-- 1. Alter messages table to add prompt injection and redaction columns
alter table messages add column if not exists is_flagged boolean default false;
alter table messages add column if not exists flag_reason text;
alter table messages add column if not exists was_redacted boolean default false;

-- Add index on is_flagged to optimize standard unflagged message queries
create index if not exists messages_is_flagged_idx on messages (is_flagged) where is_flagged = false;

-- 2. Unique constraint for Session Summaries to prevent double summarization
-- Check first if constraint already exists; if not, add it.
do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'unique_session_summary'
  ) then
    alter table session_summaries add constraint unique_session_summary unique (user_id, session_id);
  end if;
end;
$$;

-- 3. Create summarization locks table for application-level distributed locking
create table if not exists summarization_locks (
  session_id text primary key,
  user_id uuid not null,
  locked_at timestamptz default now(),
  expires_at timestamptz default now() + interval '2 minutes'
);

-- Index to query expired locks quickly
create index if not exists summarization_locks_expires_at_idx on summarization_locks (expires_at);
