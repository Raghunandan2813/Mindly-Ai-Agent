-- db/migration_profiles_v4.sql
-- Run this in your Supabase SQL Editor (supabase.com → SQL Editor → New Query → Paste → Run)
-- Extends public.profiles with onboarding support, full name, country, and mobile columns.

alter table public.profiles 
add column if not exists full_name text,
add column if not exists country text,
add column if not exists mobile text,
add column if not exists onboarding_completed boolean default false;
