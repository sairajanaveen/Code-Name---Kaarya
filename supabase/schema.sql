create extension if not exists "pgcrypto";

create table if not exists meetings (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  meeting_date date,
  source text not null default 'website',
  transcript_url text,
  language text,
  summary text,
  readiness_score integer check (readiness_score between 0 and 100),
  status text not null default 'intake_received',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists participants (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  email text,
  team text,
  notion_user_id text,
  teams_id text,
  slack_id text,
  created_at timestamptz not null default now()
);

create table if not exists action_items (
  id uuid primary key default gen_random_uuid(),
  meeting_id uuid references meetings(id) on delete cascade,
  task text not null,
  owner text,
  team text,
  due_date date,
  priority text not null default 'Medium',
  status text not null default 'pending',
  evidence text,
  follow_up_count integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists prep_questions (
  id uuid primary key default gen_random_uuid(),
  meeting_id uuid references meetings(id) on delete cascade,
  question text not null,
  intended_owner text,
  intended_team text,
  reason text,
  next_meeting_date date,
  created_at timestamptz not null default now()
);

create table if not exists delivery_logs (
  id uuid primary key default gen_random_uuid(),
  meeting_id uuid references meetings(id) on delete set null,
  action_item_id uuid references action_items(id) on delete set null,
  channel text not null,
  recipient text,
  status text not null,
  error text,
  sent_at timestamptz not null default now()
);

create index if not exists idx_meetings_status on meetings(status);
create index if not exists idx_action_items_status_due on action_items(status, due_date);
create index if not exists idx_action_items_owner on action_items(owner);
