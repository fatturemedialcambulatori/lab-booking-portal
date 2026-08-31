begin;

create table if not exists public.admin_roles (
  id text primary key,
  nome text not null,
  descrizione text not null default '',
  system boolean not null default false,
  created_at timestamp not null default now(),
  updated_at timestamp not null default now()
);

create table if not exists public.admin_role_permissions (
  id serial primary key,
  role_id text not null references public.admin_roles(id) on delete cascade,
  permission_id text not null
);

create unique index if not exists admin_role_permissions_role_permission_unique
  on public.admin_role_permissions(role_id, permission_id);

create table if not exists public.admin_accounts (
  id text primary key,
  nome text not null,
  email text not null default '',
  username text not null unique,
  password_hash text not null,
  role_id text not null references public.admin_roles(id),
  status text not null default 'attivo',
  must_change_password boolean not null default false,
  last_login_at timestamp,
  created_at timestamp not null default now(),
  updated_at timestamp not null default now()
);

alter table public.admin_accounts
  add column if not exists must_change_password boolean not null default false,
  add column if not exists last_login_at timestamp;

create unique index if not exists admin_accounts_username_unique
  on public.admin_accounts(username);

create table if not exists public.audit_logs (
  id serial primary key,
  created_at timestamp not null default now(),
  actor_account_id text,
  actor_username text,
  actor_role_id text,
  action text not null,
  entity_type text not null,
  entity_id text,
  outcome text not null,
  reason text,
  request_method text,
  request_path text,
  ip_address text,
  user_agent text,
  metadata jsonb not null default '{}'::jsonb
);

create index if not exists audit_logs_created_at_idx
  on public.audit_logs(created_at desc);

create index if not exists audit_logs_actor_account_id_idx
  on public.audit_logs(actor_account_id);

create index if not exists audit_logs_action_idx
  on public.audit_logs(action);

alter table public.admin_roles enable row level security;
alter table public.admin_role_permissions enable row level security;
alter table public.admin_accounts enable row level security;
alter table public.audit_logs enable row level security;

revoke all on public.admin_roles from anon, authenticated;
revoke all on public.admin_role_permissions from anon, authenticated;
revoke all on public.admin_accounts from anon, authenticated;
revoke all on public.audit_logs from anon, authenticated;

revoke all on sequence public.admin_role_permissions_id_seq from anon, authenticated;
revoke all on sequence public.audit_logs_id_seq from anon, authenticated;

commit;
