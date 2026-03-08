-- Enable RLS on all tables
alter table public.clients enable row level security;
alter table public.projects enable row level security;
alter table public.expenses enable row level security;
alter table public.inbound_tokens enable row level security;

-- Clients: users can only see/modify their own
create policy "clients_select" on public.clients for select using (auth.uid() = user_id);
create policy "clients_insert" on public.clients for insert with check (auth.uid() = user_id);
create policy "clients_update" on public.clients for update using (auth.uid() = user_id);
create policy "clients_delete" on public.clients for delete using (auth.uid() = user_id);

-- Projects
create policy "projects_select" on public.projects for select using (auth.uid() = user_id);
create policy "projects_insert" on public.projects for insert with check (auth.uid() = user_id);
create policy "projects_update" on public.projects for update using (auth.uid() = user_id);
create policy "projects_delete" on public.projects for delete using (auth.uid() = user_id);

-- Expenses
create policy "expenses_select" on public.expenses for select using (auth.uid() = user_id);
create policy "expenses_insert" on public.expenses for insert with check (auth.uid() = user_id);
create policy "expenses_update" on public.expenses for update using (auth.uid() = user_id);
create policy "expenses_delete" on public.expenses for delete using (auth.uid() = user_id);

-- Inbound tokens
create policy "tokens_select" on public.inbound_tokens for select using (auth.uid() = user_id);
create policy "tokens_insert" on public.inbound_tokens for insert with check (auth.uid() = user_id);
create policy "tokens_delete" on public.inbound_tokens for delete using (auth.uid() = user_id);
create policy "tokens_update" on public.inbound_tokens for update using (auth.uid() = user_id);
