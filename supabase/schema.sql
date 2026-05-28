create extension if not exists "pgcrypto";

create table if not exists organizations (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  domain text,
  created_at timestamptz not null default now()
);

create table if not exists user_profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  organization_id uuid references organizations(id) on delete set null,
  full_name text,
  company text,
  role text,
  created_at timestamptz not null default now()
);

create table if not exists organization_members (
  organization_id uuid references organizations(id) on delete cascade,
  user_id uuid references auth.users(id) on delete cascade,
  role text not null default 'member',
  created_at timestamptz not null default now(),
  primary key (organization_id, user_id)
);

create table if not exists meetings (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid references organizations(id) on delete set null,
  created_by uuid references auth.users(id) on delete set null,
  title text not null,
  meeting_date date,
  source text not null default 'website',
  transcript_url text,
  language text,
  summary text,
  readiness_score integer check (readiness_score between 0 and 100),
  quality_score integer check (quality_score between 0 and 100),
  productivity_score integer check (productivity_score between 0 and 100),
  preparedness_score integer check (preparedness_score between 0 and 100),
  efficiency_score integer check (efficiency_score between 0 and 100),
  status text not null default 'intake_received',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists participants (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid references organizations(id) on delete set null,
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
  organization_id uuid references organizations(id) on delete set null,
  meeting_id uuid references meetings(id) on delete cascade,
  task text not null,
  owner text,
  team text,
  due_date date,
  priority text not null default 'Medium',
  status text not null default 'pending',
  evidence text,
  update_token text unique default encode(gen_random_bytes(18), 'hex'),
  stakeholder_email text,
  notion_page_id text,
  follow_up_count integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists prep_questions (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid references organizations(id) on delete set null,
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
  organization_id uuid references organizations(id) on delete set null,
  meeting_id uuid references meetings(id) on delete set null,
  action_item_id uuid references action_items(id) on delete set null,
  channel text not null,
  recipient text,
  status text not null,
  error text,
  sent_at timestamptz not null default now()
);

create index if not exists idx_meetings_status on meetings(status);
create index if not exists idx_meetings_org_created on meetings(organization_id, created_at desc);
create index if not exists idx_action_items_status_due on action_items(status, due_date);
create index if not exists idx_action_items_owner on action_items(owner);
create index if not exists idx_action_items_update_token on action_items(update_token);
create index if not exists idx_delivery_logs_meeting on delivery_logs(meeting_id, sent_at desc);

alter table meetings enable row level security;
alter table participants enable row level security;
alter table action_items enable row level security;
alter table prep_questions enable row level security;
alter table delivery_logs enable row level security;
alter table organizations enable row level security;
alter table user_profiles enable row level security;
alter table organization_members enable row level security;

drop policy if exists "members read meetings" on meetings;
create policy "members read meetings" on meetings
  for select using (
    organization_id in (select organization_id from organization_members where user_id = auth.uid())
  );

drop policy if exists "members read action items" on action_items;
create policy "members read action items" on action_items
  for select using (
    organization_id in (select organization_id from organization_members where user_id = auth.uid())
  );

drop policy if exists "members read prep questions" on prep_questions;
create policy "members read prep questions" on prep_questions
  for select using (
    organization_id in (select organization_id from organization_members where user_id = auth.uid())
  );

drop policy if exists "members read delivery logs" on delivery_logs;
create policy "members read delivery logs" on delivery_logs
  for select using (
    organization_id in (select organization_id from organization_members where user_id = auth.uid())
  );

drop policy if exists "users read own profile" on user_profiles;
create policy "users read own profile" on user_profiles
  for select using (id = auth.uid());
