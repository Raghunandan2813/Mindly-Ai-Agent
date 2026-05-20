-- db/security_v3_patches.sql
-- Run this in your Supabase SQL Editor to enforce Phase 1 advanced security:
-- active sessions limits, SHA-256 tokens, encrypted connectors, redaction logs, and RLS policies.

-- 1. Create active_sessions table
create table if not exists public.active_sessions (
    session_id uuid primary key default gen_random_uuid(),
    user_id uuid references auth.users(id) on delete cascade not null,
    device_name text,
    ip_address text,
    user_agent text,
    last_active timestamptz default now(),
    created_at timestamptz default now()
);

-- 2. Create api_tokens table
create table if not exists public.api_tokens (
    id uuid primary key default gen_random_uuid(),
    user_id uuid references auth.users(id) on delete cascade not null,
    token_hash text not null unique,
    name text,
    scope text default 'read:write',
    expires_at timestamptz default (now() + interval '90 days'),
    last_used_at timestamptz,
    is_revoked boolean default false,
    created_at timestamptz default now()
);

-- 3. Create redaction_logs table (session_id is plain text and fully nullable)
create table if not exists public.redaction_logs (
    id uuid primary key default gen_random_uuid(),
    user_id uuid references auth.users(id) on delete cascade not null,
    session_id text,
    redacted_type text not null,
    redacted_placeholder text,
    created_at timestamptz default now()
);

-- 4. Create connector_states table
create table if not exists public.connector_states (
    user_id uuid references auth.users(id) on delete cascade not null,
    connector_name text not null,
    enabled boolean default false,
    access_token text,
    refresh_token text,
    token_expires_at timestamptz,
    last_synced timestamptz,
    sync_frequency text default 'daily',
    last_error text,
    last_error_at timestamptz,
    primary key (user_id, connector_name)
);

-- 5. Enable Row Level Security (RLS) across all tables
alter table public.active_sessions enable row level security;
alter table public.api_tokens enable row level security;
alter table public.redaction_logs enable row level security;
alter table public.connector_states enable row level security;

-- 6. Define strict tenant-isolated RLS Policies
drop policy if exists "users manage own sessions" on public.active_sessions;
create policy "users manage own sessions"
    on public.active_sessions for all
    using (auth.uid() = user_id);

drop policy if exists "users manage own tokens" on public.api_tokens;
create policy "users manage own tokens"
    on public.api_tokens for all
    using (auth.uid() = user_id);

drop policy if exists "users manage own redaction logs" on public.redaction_logs;
create policy "users manage own redaction logs"
    on public.redaction_logs for all
    using (auth.uid() = user_id);

drop policy if exists "users manage own connectors" on public.connector_states;
create policy "users manage own connectors"
    on public.connector_states for all
    using (auth.uid() = user_id);

-- 7. Define explicit cleanup routines
-- This block can be run daily or via DB triggers to maintain storage and cleanup schedules safely.
create or replace function public.execute_security_cleanups()
returns void
language plpgsql
security definer
as $$
begin
    -- A. Clean expired locks dynamically checking if summarization_locks table exists
    if exists (
        select 1 from information_schema.tables 
        where table_schema = 'public' and table_name = 'summarization_locks'
    ) then
        execute 'delete from public.summarization_locks where expires_at < now();';
    end if;

    -- B. Clean stale sessions inactive for 30+ days
    delete from public.active_sessions where last_active < now() - interval '30 days';

    -- C. Clean expired API tokens
    delete from public.api_tokens where expires_at < now();

    -- D. Clean expired signed export files in storage (older than 24 hours in exports/ folder)
    delete from storage.objects 
    where bucket_id = 'exports' 
      and created_at < now() - interval '24 hours'
      and name like 'exports/%';
end;
$$;

-- Allow service role (cron / admin API) to invoke cleanup
grant execute on function public.execute_security_cleanups() to service_role;
