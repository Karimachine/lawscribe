-- Migration: 20260609_create_documents_table
-- Description: Create documents table for storing generated legal documents

create extension if not exists pgcrypto;

create table if not exists public.documents (
  id uuid default gen_random_uuid() primary key,
  user_id text not null,
  title text,
  prompt text,
  content text,
  created_at timestamptz default now()
);

-- Create index on user_id for faster queries
create index if not exists idx_documents_user_id on public.documents(user_id);
