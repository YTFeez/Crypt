-- Studio de création (documents type Canva)
create table if not exists public.designs (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references public.profiles(id) on delete cascade,
  name text not null default 'Sans titre',
  width int not null default 1080,
  height int not null default 1080,
  background text not null default '#ffffff',
  elements jsonb not null default '[]',
  is_shared boolean not null default false,
  updated_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);

create table if not exists public.design_members (
  design_id uuid not null references public.designs(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  primary key (design_id, user_id)
);

alter publication supabase_realtime add table public.designs;

alter table public.designs enable row level security;
alter table public.design_members enable row level security;

create policy "designs_select" on public.designs for select using (
  auth.uid() = owner_id
  or exists (select 1 from public.design_members dm where dm.design_id = id and dm.user_id = auth.uid())
);

create policy "designs_insert" on public.designs for insert with check (auth.uid() = owner_id);
create policy "designs_update" on public.designs for update using (
  auth.uid() = owner_id
  or exists (select 1 from public.design_members dm where dm.design_id = id and dm.user_id = auth.uid())
);
create policy "designs_delete" on public.designs for delete using (auth.uid() = owner_id);

create policy "design_members_all" on public.design_members for all using (auth.uid() = user_id);
