-- صلاحيات محددة لمدراء لوحة التحكم
-- permissions = NULL  → صلاحيات كاملة (السلوك الحالي لكل المدراء)
-- permissions = {...} → الأقسام المسموحة فقط (مفاتيح من src/lib/adminPermissions.js)
alter table public.admin_users add column if not exists permissions text[];

create or replace function public.get_admin_user_permissions(p_username text)
returns text[]
language sql
stable
security definer
set search_path = public
as $$
  select permissions from public.admin_users
  where lower(username) = lower(p_username)
  limit 1;
$$;

create or replace function public.list_admin_users_permissions()
returns table(admin_username text, admin_permissions text[])
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  return query select a.username::text, a.permissions from public.admin_users a;
end;
$$;

create or replace function public.set_admin_user_permissions(p_username text, p_permissions text[])
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.admin_users
     set permissions = p_permissions
   where lower(username) = lower(p_username);
  if not found then
    return jsonb_build_object('success', false, 'error', 'المستخدم غير موجود');
  end if;
  return jsonb_build_object('success', true);
end;
$$;

grant execute on function public.get_admin_user_permissions(text) to anon, authenticated;
grant execute on function public.list_admin_users_permissions() to anon, authenticated;
grant execute on function public.set_admin_user_permissions(text, text[]) to anon, authenticated;
