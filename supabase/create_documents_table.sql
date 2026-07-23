-- Run this in your Supabase project's SQL editor to create the `documents` table.

create extension if not exists pgcrypto;

create table if not exists public.documents (
  id uuid default gen_random_uuid() primary key,
  user_id text not null,
  title text,
  prompt text,
  content text,
  created_at timestamptz default now()
);
