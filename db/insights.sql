-- db/insights.sql
-- Run this in your Supabase SQL Editor (supabase.com → SQL Editor → New Query → Paste → Run)

-- Create the insights table for proactive reflection alerts
create table if not exists insights (
    id uuid primary key default gen_random_uuid(),
    user_id uuid references auth.users(id) on delete cascade not null,
    type text not null check (type in ('repetition', 'commitment', 'deadline', 'pattern')),
    message text not null,
    suggestion text,
    urgency_score int not null check (urgency_score >= 0 and urgency_score <= 100),
    is_acknowledged boolean default false not null,
    evidence_memory_ids uuid[] default '{}' not null,
    created_at timestamptz default now() not null,
    expires_at timestamptz not null
);

-- Indexes for lightning-fast lookups
create index if not exists idx_insights_user_active 
on insights (user_id, is_acknowledged, expires_at)
where is_acknowledged = false;

-- Enable Row Level Security
alter table insights enable row level security;

-- Setup RLS Policies
drop policy if exists "Users can read own insights" on insights;
create policy "Users can read own insights"
    on insights for select using (auth.uid() = user_id);

drop policy if exists "Users can insert own insights" on insights;
create policy "Users can insert own insights"
    on insights for insert with check (auth.uid() = user_id);

drop policy if exists "Users can update own insights" on insights;
create policy "Users can update own insights"
    on insights for update using (auth.uid() = user_id);

drop policy if exists "Users can delete own insights" on insights;
create policy "Users can delete own insights"
    on insights for delete using (auth.uid() = user_id);
