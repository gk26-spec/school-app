-- Carnival scoring — multi-tenant schema (PostgreSQL 13+)
-- gen_random_uuid() is built into PostgreSQL 13+ (Azure Flexible Server), no extension needed.

create table if not exists schools (
  id            uuid primary key default gen_random_uuid(),
  name          text not null,
  carnival_name text not null default 'Cross Country Carnival',
  settings      jsonb not null default '{}'::jsonb,
  created_at    timestamptz not null default now()
);

create table if not exists users (
  id            uuid primary key default gen_random_uuid(),
  school_id     uuid not null references schools(id) on delete cascade,
  email         text not null,
  password_hash text not null,
  name          text,
  role          text not null default 'scorer' check (role in ('admin','scorer','viewer')),
  created_at    timestamptz not null default now(),
  unique (email)
);

create table if not exists factions (
  id          uuid primary key default gen_random_uuid(),
  school_id   uuid not null references schools(id) on delete cascade,
  name        text not null,
  color       text not null default '#64748b',
  sort_order  int  not null default 0
);

create table if not exists students (
  id          uuid primary key default gen_random_uuid(),
  school_id   uuid not null references schools(id) on delete cascade,
  name        text not null,
  year_group  text not null,
  gender      text not null,
  faction_id  uuid references factions(id) on delete set null,
  created_at  timestamptz not null default now()
);
create index if not exists idx_students_school on students(school_id);

create table if not exists results (
  id          uuid primary key default gen_random_uuid(),
  school_id   uuid not null references schools(id) on delete cascade,
  year_group  text not null,
  gender      text not null,
  place       int  not null check (place between 1 and 6),
  student_id  uuid not null references students(id) on delete cascade,
  created_at  timestamptz not null default now(),
  unique (school_id, year_group, gender, place)
);
create index if not exists idx_results_school on results(school_id);

create table if not exists participation (
  id          uuid primary key default gen_random_uuid(),
  school_id   uuid not null references schools(id) on delete cascade,
  year_group  text not null,
  gender      text not null,
  faction_id  uuid not null references factions(id) on delete cascade,
  count       int  not null default 0,
  unique (school_id, year_group, gender, faction_id)
);

create table if not exists audit_log (
  id          uuid primary key default gen_random_uuid(),
  school_id   uuid,
  user_id     uuid,
  action      text not null,
  detail      text,
  created_at  timestamptz not null default now()
);
create index if not exists idx_audit_school on audit_log(school_id);
