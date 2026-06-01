-- Vérification e-mail (profil + trigger mise à jour après confirmation Supabase Auth)

alter table public.profiles
  add column if not exists email_verified boolean not null default false;

-- Comptes existants : considérés vérifiés
update public.profiles p
set email_verified = true
where exists (
  select 1 from auth.users u
  where u.id = p.id and (u.email_confirmed_at is not null or u.confirmed_at is not null)
);

create or replace function public.sync_profile_email_verified()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.email_confirmed_at is not null or new.confirmed_at is not null then
    update public.profiles set email_verified = true where id = new.id;
  end if;
  return new;
end;
$$;

drop trigger if exists on_auth_user_email_confirmed on auth.users;
create trigger on_auth_user_email_confirmed
  after update of email_confirmed_at, confirmed_at on auth.users
  for each row
  execute function public.sync_profile_email_verified();
