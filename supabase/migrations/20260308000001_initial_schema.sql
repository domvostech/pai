-- Enable UUID extension
create extension if not exists "uuid-ossp";

-- Clients
create table public.clients (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  email text,
  created_at timestamptz not null default now()
);

-- Projects
create table public.projects (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid not null references auth.users(id) on delete cascade,
  client_id uuid references public.clients(id) on delete set null,
  name text not null,
  total_budget numeric(12,2) not null default 0,
  created_at timestamptz not null default now()
);

-- Expense category enum
create type expense_category as enum ('general', 'transport');

-- Expenses
create table public.expenses (
  id uuid primary key default uuid_generate_v4(),
  project_id uuid references public.projects(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  vendor text,
  amount numeric(12,2) not null default 0,
  date date not null default current_date,
  category expense_category not null default 'general',
  notes text,
  receipt_path text,
  is_return boolean not null default false,
  ocr_confidence jsonb,
  created_at timestamptz not null default now()
);

-- Inbound email tokens
create table public.inbound_tokens (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid not null references auth.users(id) on delete cascade,
  token text not null unique default encode(gen_random_bytes(12), 'hex'),
  created_at timestamptz not null default now()
);
