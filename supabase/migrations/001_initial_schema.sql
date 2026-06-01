-- Talkeo — schéma messagerie entreprise
-- Exécuter dans Supabase SQL Editor ou via CLI: supabase db push

create extension if not exists "uuid-ossp";

-- ─── Profils ───────────────────────────────────────────────────────────────
create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text not null,
  display_name text not null default '',
  handle text unique not null,
  avatar_url text,
  public_key text not null default '',
  org_name text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index profiles_handle_idx on public.profiles (handle);

-- ─── Amitiés ─────────────────────────────────────────────────────────────────
create type friendship_status as enum ('pending', 'accepted', 'blocked');

create table public.friendships (
  id uuid primary key default gen_random_uuid(),
  requester_id uuid not null references public.profiles(id) on delete cascade,
  addressee_id uuid not null references public.profiles(id) on delete cascade,
  status friendship_status not null default 'pending',
  created_at timestamptz not null default now(),
  unique (requester_id, addressee_id),
  check (requester_id <> addressee_id)
);

create index friendships_addressee_idx on public.friendships (addressee_id, status);

-- ─── Conversations (DM + groupes) ────────────────────────────────────────────
create type conversation_type as enum ('dm', 'group');

create table public.conversations (
  id uuid primary key default gen_random_uuid(),
  type conversation_type not null default 'dm',
  name text,
  avatar_url text,
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now()
);

create table public.conversation_members (
  conversation_id uuid not null references public.conversations(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  role text not null default 'member' check (role in ('owner', 'admin', 'member')),
  joined_at timestamptz not null default now(),
  primary key (conversation_id, user_id)
);

-- ─── Messages (contenu chiffré côté client) ──────────────────────────────────
create type message_kind as enum ('text', 'voice', 'file', 'system');

create table public.messages (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references public.conversations(id) on delete cascade,
  sender_id uuid not null references public.profiles(id) on delete cascade,
  kind message_kind not null default 'text',
  ciphertext text not null,
  iv text not null default '',
  meta jsonb not null default '{}',
  created_at timestamptz not null default now()
);

create index messages_conversation_idx on public.messages (conversation_id, created_at desc);

alter publication supabase_realtime add table public.messages;

-- ─── Dossiers (personnels + partagés) ──────────────────────────────────────
create table public.folders (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references public.profiles(id) on delete cascade,
  parent_id uuid references public.folders(id) on delete cascade,
  name text not null,
  is_shared boolean not null default false,
  created_at timestamptz not null default now()
);

create table public.folder_members (
  folder_id uuid not null references public.folders(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  permission text not null default 'read' check (permission in ('read', 'write', 'admin')),
  primary key (folder_id, user_id)
);

create table public.folder_items (
  id uuid primary key default gen_random_uuid(),
  folder_id uuid not null references public.folders(id) on delete cascade,
  name text not null,
  storage_path text not null,
  mime text,
  size_bytes bigint default 0,
  encrypted_key text,
  uploaded_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now()
);

-- ─── Tableaux blancs collaboratifs ───────────────────────────────────────────
create table public.boards (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references public.profiles(id) on delete cascade,
  conversation_id uuid references public.conversations(id) on delete set null,
  name text not null default 'Tableau',
  strokes jsonb not null default '[]',
  is_shared boolean not null default false,
  updated_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);

create table public.board_members (
  board_id uuid not null references public.boards(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  primary key (board_id, user_id)
);

alter publication supabase_realtime add table public.boards;

-- ─── Appels (audio / vidéo) ──────────────────────────────────────────────────
create type call_kind as enum ('audio', 'video');
create type call_status as enum ('ringing', 'active', 'ended');

create table public.calls (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references public.conversations(id) on delete cascade,
  started_by uuid not null references public.profiles(id) on delete cascade,
  kind call_kind not null default 'video',
  status call_status not null default 'ringing',
  room_token text,
  started_at timestamptz not null default now(),
  ended_at timestamptz
);

create table public.call_participants (
  call_id uuid not null references public.calls(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  joined_at timestamptz,
  left_at timestamptz,
  primary key (call_id, user_id)
);

alter publication supabase_realtime add table public.calls;

-- ─── Trigger profil à l'inscription ────────────────────────────────────────
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
declare
  base_handle text;
  final_handle text;
  n int := 0;
begin
  base_handle := lower(regexp_replace(split_part(new.email, '@', 1), '[^a-z0-9_]', '', 'g'));
  if base_handle = '' then base_handle := 'user'; end if;
  final_handle := base_handle;
  while exists (select 1 from public.profiles where handle = final_handle) loop
    n := n + 1;
    final_handle := base_handle || n::text;
  end loop;

  insert into public.profiles (id, email, display_name, handle)
  values (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data->>'display_name', split_part(new.email, '@', 1)),
    final_handle
  );
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ─── Storage buckets ─────────────────────────────────────────────────────────
insert into storage.buckets (id, name, public)
values
  ('avatars', 'avatars', true),
  ('attachments', 'attachments', false),
  ('voice', 'voice', false)
on conflict (id) do nothing;

-- ─── RLS ─────────────────────────────────────────────────────────────────────
alter table public.profiles enable row level security;
alter table public.friendships enable row level security;
alter table public.conversations enable row level security;
alter table public.conversation_members enable row level security;
alter table public.messages enable row level security;
alter table public.folders enable row level security;
alter table public.folder_members enable row level security;
alter table public.folder_items enable row level security;
alter table public.boards enable row level security;
alter table public.board_members enable row level security;
alter table public.calls enable row level security;
alter table public.call_participants enable row level security;

-- Profiles
create policy "profiles_select" on public.profiles for select using (true);
create policy "profiles_update_own" on public.profiles for update using (auth.uid() = id);

-- Friendships
create policy "friendships_select" on public.friendships for select
  using (auth.uid() in (requester_id, addressee_id));
create policy "friendships_insert" on public.friendships for insert
  with check (auth.uid() = requester_id);
create policy "friendships_update" on public.friendships for update
  using (auth.uid() in (requester_id, addressee_id));

-- Conversation members helper
create or replace function public.is_conversation_member(cid uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.conversation_members
    where conversation_id = cid and user_id = auth.uid()
  );
$$;

create policy "conversations_select" on public.conversations for select
  using (public.is_conversation_member(id));
create policy "conversations_insert" on public.conversations for insert
  with check (auth.uid() = created_by);
create policy "conversation_members_select" on public.conversation_members for select
  using (public.is_conversation_member(conversation_id));
create policy "conversation_members_insert" on public.conversation_members for insert
  with check (
    auth.uid() = user_id
    or exists (
      select 1 from public.conversation_members cm
      where cm.conversation_id = conversation_members.conversation_id
        and cm.user_id = auth.uid() and cm.role in ('owner', 'admin')
    )
    or not exists (
      select 1 from public.conversation_members cm2
      where cm2.conversation_id = conversation_members.conversation_id
    )
  );

-- Messages
create policy "messages_select" on public.messages for select
  using (public.is_conversation_member(conversation_id));
create policy "messages_insert" on public.messages for insert
  with check (
    auth.uid() = sender_id and public.is_conversation_member(conversation_id)
  );

-- Folders
create policy "folders_select" on public.folders for select using (
  owner_id = auth.uid()
  or exists (select 1 from public.folder_members fm where fm.folder_id = id and fm.user_id = auth.uid())
);
create policy "folders_insert" on public.folders for insert with check (auth.uid() = owner_id);
create policy "folders_update" on public.folders for update using (
  owner_id = auth.uid()
  or exists (select 1 from public.folder_members fm where fm.folder_id = id and fm.user_id = auth.uid() and fm.permission in ('write', 'admin'))
);
create policy "folder_members_select" on public.folder_members for select using (
  exists (select 1 from public.folders f where f.id = folder_id and (f.owner_id = auth.uid() or folder_members.user_id = auth.uid()))
);
create policy "folder_items_select" on public.folder_items for select using (
  exists (
    select 1 from public.folders f
    left join public.folder_members fm on fm.folder_id = f.id
    where f.id = folder_id and (f.owner_id = auth.uid() or fm.user_id = auth.uid())
  )
);
create policy "folder_items_insert" on public.folder_items for insert with check (
  exists (
    select 1 from public.folders f
    left join public.folder_members fm on fm.folder_id = f.id and fm.user_id = auth.uid()
    where f.id = folder_id and (f.owner_id = auth.uid() or fm.permission in ('write', 'admin'))
  )
);

-- Boards
create policy "boards_select" on public.boards for select using (
  owner_id = auth.uid()
  or exists (select 1 from public.board_members bm where bm.board_id = id and bm.user_id = auth.uid())
  or (conversation_id is not null and public.is_conversation_member(conversation_id))
);
create policy "boards_insert" on public.boards for insert with check (auth.uid() = owner_id);
create policy "boards_update" on public.boards for update using (
  owner_id = auth.uid()
  or exists (select 1 from public.board_members bm where bm.board_id = id and bm.user_id = auth.uid())
);

-- Calls
create policy "calls_select" on public.calls for select
  using (public.is_conversation_member(conversation_id));
create policy "calls_insert" on public.calls for insert
  with check (auth.uid() = started_by and public.is_conversation_member(conversation_id));
create policy "calls_update" on public.calls for update
  using (public.is_conversation_member(conversation_id));

create policy "call_participants_all" on public.call_participants for all
  using (
    exists (
      select 1 from public.calls c
      where c.id = call_id and public.is_conversation_member(c.conversation_id)
    )
  );

-- Storage policies
create policy "avatars_public_read" on storage.objects for select using (bucket_id = 'avatars');
create policy "avatars_upload_own" on storage.objects for insert
  with check (bucket_id = 'avatars' and auth.uid()::text = (storage.foldername(name))[1]);
create policy "attachments_member" on storage.objects for all
  using (bucket_id = 'attachments' and auth.uid()::text = (storage.foldername(name))[1]);
create policy "voice_member" on storage.objects for all
  using (bucket_id = 'voice' and auth.uid()::text = (storage.foldername(name))[1]);
