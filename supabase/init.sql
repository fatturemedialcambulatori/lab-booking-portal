begin;

create table if not exists public.patients (
  id serial primary key,
  first_name text not null,
  last_name text not null,
  date_of_birth text not null,
  codice_fiscale text,
  gender text,
  email text not null,
  phone text not null,
  notes text,
  billing_address text,
  billing_cap text,
  billing_city text,
  billing_provincia text,
  created_at timestamp not null default now()
);

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

create index if not exists patients_email_idx on public.patients(email);
create index if not exists patients_codice_fiscale_idx on public.patients(codice_fiscale);
create index if not exists bookings_date_idx on public.bookings(date);
create index if not exists booking_exams_booking_id_idx on public.booking_exams(booking_id);
create index if not exists referti_booking_id_idx on public.referti(booking_id);
create index if not exists exam_reference_ranges_exam_id_idx on public.exam_reference_ranges(exam_id);

alter table public.patients enable row level security;
alter table public.exams enable row level security;
alter table public.bookings enable row level security;
alter table public.booking_exams enable row level security;
alter table public.referti enable row level security;
alter table public.exam_components enable row level security;
alter table public.exam_reference_ranges enable row level security;
alter table public.admin_settings enable row level security;

revoke all on all tables in schema public from anon, authenticated;
revoke all on all sequences in schema public from anon, authenticated;

commit;
