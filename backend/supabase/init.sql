begin;

create table if not exists public.patients (
  id serial primary key,
  record_type text not null default 'privato',
  first_name text not null,
  last_name text not null,
  date_of_birth text not null,
  codice_fiscale text,
  gender text,
  company_name text,
  vat_number text,
  contact_person text,
  convention_active boolean not null default false,
  convention_expires_at text,
  convention_text text,
  convention_services text,
  linked_convention_ids text,
  email text not null,
  phone text not null,
  notes text,
  billing_address text,
  billing_cap text,
  billing_city text,
  billing_provincia text,
  created_at timestamp not null default now()
);

alter table public.patients
  add column if not exists record_type text not null default 'privato',
  add column if not exists company_name text,
  add column if not exists vat_number text,
  add column if not exists contact_person text,
  add column if not exists convention_active boolean not null default false,
  add column if not exists convention_expires_at text,
  add column if not exists convention_text text,
  add column if not exists convention_services text,
  add column if not exists linked_convention_ids text;

create table if not exists public.exams (
  id serial primary key,
  codice_analisi text not null,
  descrizione text not null,
  color_provetta text,
  synlab boolean not null default false,
  um text,
  metodo text,
  regola text,
  importo numeric(10,2),
  valore_riferimento text,
  preparation_instructions text not null default '',
  tipo text not null default 'singolo'
);

create table if not exists public.bookings (
  id serial primary key,
  date text not null,
  time text not null,
  first_name text not null,
  last_name text not null,
  date_of_birth text not null,
  codice_fiscale text,
  gender text,
  email text not null,
  phone text not null,
  notes text,
  status text not null default 'confirmed',
  payment_status text not null default 'unpaid',
  paid_at timestamp,
  created_at timestamp not null default now()
);

create table if not exists public.booking_exams (
  id serial primary key,
  booking_id integer not null references public.bookings(id) on delete cascade,
  exam_id integer not null references public.exams(id)
);

create table if not exists public.referti (
  id serial primary key,
  booking_id integer not null references public.bookings(id) on delete cascade,
  exam_id integer not null references public.exams(id),
  parent_exam_id integer references public.exams(id),
  valore text not null,
  note text,
  refertata_at timestamp not null default now(),
  constraint referti_booking_exam_unique unique (booking_id, exam_id)
);

create table if not exists public.exam_components (
  id serial primary key,
  package_exam_id integer not null references public.exams(id) on delete cascade,
  component_exam_id integer not null references public.exams(id) on delete cascade,
  ordinamento integer not null default 0,
  constraint exam_components_unique unique (package_exam_id, component_exam_id)
);

create table if not exists public.exam_reference_ranges (
  id serial primary key,
  exam_id integer not null references public.exams(id) on delete cascade,
  gender text,
  age_min integer,
  age_max integer,
  stato_fisiologico text,
  tipo text not null default 'range',
  valore_min numeric,
  valore_max numeric,
  valori_accettabili text,
  fasce jsonb,
  unita text,
  note text,
  ordinamento integer not null default 0
);

create table if not exists public.admin_settings (
  key text primary key,
  value jsonb not null,
  updated_at timestamp not null default now()
);

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

insert into storage.buckets (
  id,
  name,
  public,
  file_size_limit,
  allowed_mime_types
)
values (
  'certificati-infortunistica',
  'certificati-infortunistica',
  false,
  52428800,
  array[
    'application/pdf',
    'image/jpeg',
    'image/png',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
  ]::text[]
)
on conflict (id) do update set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

create table if not exists public.infortunistica_certificati_files (
  certificato_id text primary key,
  cliente_id text not null,
  pratica_id text not null,
  bucket text not null default 'certificati-infortunistica',
  storage_path text not null,
  file_name text not null,
  content_type text not null,
  size_bytes integer not null,
  uploaded_at timestamp not null default now()
);

create index if not exists patients_email_idx on public.patients(email);
create index if not exists patients_codice_fiscale_idx on public.patients(codice_fiscale);
create index if not exists bookings_date_idx on public.bookings(date);
create index if not exists booking_exams_booking_id_idx on public.booking_exams(booking_id);
create index if not exists referti_booking_id_idx on public.referti(booking_id);
create index if not exists exam_reference_ranges_exam_id_idx on public.exam_reference_ranges(exam_id);
create index if not exists infortunistica_certificati_files_cliente_id_idx on public.infortunistica_certificati_files(cliente_id);
create index if not exists infortunistica_certificati_files_pratica_id_idx on public.infortunistica_certificati_files(pratica_id);
create index if not exists audit_logs_created_at_idx on public.audit_logs(created_at desc);
create index if not exists audit_logs_actor_account_id_idx on public.audit_logs(actor_account_id);
create index if not exists audit_logs_action_idx on public.audit_logs(action);

alter table public.patients enable row level security;
alter table public.exams enable row level security;
alter table public.bookings enable row level security;
alter table public.booking_exams enable row level security;
alter table public.referti enable row level security;
alter table public.exam_components enable row level security;
alter table public.exam_reference_ranges enable row level security;
alter table public.admin_settings enable row level security;
alter table public.admin_roles enable row level security;
alter table public.admin_role_permissions enable row level security;
alter table public.admin_accounts enable row level security;
alter table public.audit_logs enable row level security;
alter table public.infortunistica_certificati_files enable row level security;

alter table public.bookings
  add column if not exists payment_status text not null default 'unpaid',
  add column if not exists paid_at timestamp;

revoke all on all tables in schema public from anon, authenticated;
revoke all on all sequences in schema public from anon, authenticated;

commit;
