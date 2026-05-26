-- db/security_v2_patches.sql
-- Run this in your Supabase SQL Editor to enforce advanced security, GDPR, blocklists, and graceful purges.

-- 1. Create profiles table to enforce display name uniqueness
create table if not exists public.profiles (
    id uuid primary key references auth.users(id) on delete cascade,
    display_name text unique not null,
    profile_photo text,
    created_at timestamptz default now()
);

-- Row Level Security for profiles
alter table public.profiles enable row level security;

drop policy if exists "Public profiles are readable by everyone" on public.profiles;
create policy "Public profiles are readable by everyone"
    on public.profiles for select using (true);

drop policy if exists "Users can update own profile" on public.profiles;
create policy "Users can update own profile"
    on public.profiles for update using (auth.uid() = id);

drop policy if exists "Users can insert own profile" on public.profiles;
create policy "Users can insert own profile"
    on public.profiles for insert with check (auth.uid() = id);

-- 2. Create blocklisted_users table for immediate JWT invalidation
create table if not exists public.blocklisted_users (
    user_id uuid primary key,
    revoked_at timestamptz default now()
);

-- Enable RLS
alter table public.blocklisted_users enable row level security;
create policy "Internal lookup only" on public.blocklisted_users for select using (true);

-- 3. Create deletion_queue table to handle 24-hour grace periods
create table if not exists public.deletion_queue (
    user_id uuid primary key references auth.users(id) on delete cascade,
    scheduled_for timestamptz not null,
    created_at timestamptz default now()
);

-- Enable RLS
alter table public.deletion_queue enable row level security;
create policy "Users can manage own deletion queue"
    on public.deletion_queue for select using (auth.uid() = user_id);

-- 4. Validate or update foreign keys for cascade deletes on child tables
-- session_summaries
alter table if exists public.session_summaries 
    drop constraint if exists session_summaries_user_id_fkey,
    add constraint session_summaries_user_id_fkey foreign key (user_id) references auth.users(id) on delete cascade;

-- summarization_locks (Add foreign key with delete cascade)
alter table if exists public.summarization_locks 
    drop constraint if exists summarization_locks_user_id_fkey,
    add constraint summarization_locks_user_id_fkey foreign key (user_id) references auth.users(id) on delete cascade;

-- messages
alter table if exists public.messages 
    drop constraint if exists messages_user_id_fkey,
    add constraint messages_user_id_fkey foreign key (user_id) references auth.users(id) on delete cascade;

-- memory_nodes
alter table if exists public.memory_nodes 
    drop constraint if exists memory_nodes_user_id_fkey,
    add constraint memory_nodes_user_id_fkey foreign key (user_id) references auth.users(id) on delete cascade;

-- memory_edges
alter table if exists public.memory_edges 
    drop constraint if exists memory_edges_user_id_fkey,
    add constraint memory_edges_user_id_fkey foreign key (user_id) references auth.users(id) on delete cascade;

-- insights
alter table if exists public.insights 
    drop constraint if exists insights_user_id_fkey,
    add constraint insights_user_id_fkey foreign key (user_id) references auth.users(id) on delete cascade;

-- 5. Separate Admin protection table
create table if not exists public.app_admins (
    user_id uuid primary key references auth.users(id) on delete restrict,
    email text unique not null,
    created_at timestamptz default now()
);

-- Prevent regular settings deletes for users listed in public.app_admins
create or replace function public.prevent_admin_deletion()
returns trigger as $$
begin
    if exists (select 1 from public.app_admins where user_id = old.id) then
        raise exception 'Administrators cannot be deleted through standard settings. Please transfer administrative ownership first.';
    end if;
    return old;
end;
$$ language plpgsql security definer set search_path = public;

drop trigger if exists trg_prevent_admin_deletion on auth.users;
create trigger trg_prevent_admin_deletion
    before delete on auth.users
    for each row execute function public.prevent_admin_deletion();

-- 6. Atomic transactional user memory clearing (Race condition safeguard)
create or replace function public.clear_user_memories(target_user_id uuid)
returns void as $$
begin
    -- Acquire locking row handles to halt concurrent background processing
    perform 1 from public.session_summaries where user_id = target_user_id for update;
    perform 1 from public.messages where user_id = target_user_id for update;
    perform 1 from public.memory_nodes where user_id = target_user_id for update;
    perform 1 from public.memory_edges where user_id = target_user_id for update;
    perform 1 from public.insights where user_id = target_user_id for update;

    -- Delete all child structures atomically
    delete from public.session_summaries where user_id = target_user_id;
    delete from public.messages where user_id = target_user_id;
    delete from public.summarization_locks where user_id = target_user_id;
    delete from public.memory_nodes where user_id = target_user_id;
    delete from public.memory_edges where user_id = target_user_id;
    delete from public.insights where user_id = target_user_id;
end;
$$ language plpgsql security definer;
