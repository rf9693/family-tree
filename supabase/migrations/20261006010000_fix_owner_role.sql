-- Fix: protect_profile_fields reverted the owner assignment made from the SQL Editor
-- (auth.uid() is null there). Requests without a user (SQL Editor, service role) are trusted.
-- Set the owner e-mail below before running.

create or replace function public.protect_profile_fields()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.role is distinct from old.role and auth.uid() is not null and not public.is_owner() then
    new.role := old.role;
  end if;
  if auth.uid() is not null then
    new.email := old.email;
  end if;
  return new;
end;
$$;

update public.profiles p set role = 'owner'
from auth.users u
where u.id = p.id and lower(u.email) = lower('rf9339945@gmail.com') and p.role <> 'owner';

select p.email, p.role from public.profiles p where p.role = 'owner';
