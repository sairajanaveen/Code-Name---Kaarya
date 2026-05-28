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

alter table meetings add column if not exists organization_id uuid references organizations(id) on delete set null;
alter table meetings add column if not exists created_by uuid references auth.users(id) on delete set null;
alter table meetings add column if not exists quality_score integer check (quality_score between 0 and 100);
alter table meetings add column if not exists productivity_score integer check (productivity_score between 0 and 100);
alter table meetings add column if not exists preparedness_score integer check (preparedness_score between 0 and 100);

alter table participants add column if not exists organization_id uuid references organizations(id) on delete set null;

alter table action_items add column if not exists organization_id uuid references organizations(id) on delete set null;
alter table action_items add column if not exists update_token text unique default encode(gen_random_bytes(18), 'hex');
alter table action_items add column if not exists stakeholder_email text;
alter table action_items add column if not exists notion_page_id text;

alter table prep_questions add column if not exists organization_id uuid references organizations(id) on delete set null;
alter table delivery_logs add column if not exists organization_id uuid references organizations(id) on delete set null;

create index if not exists idx_meetings_org_created on meetings(organization_id, created_at desc);
create index if not exists idx_action_items_update_token on action_items(update_token);
create index if not exists idx_delivery_logs_meeting on delivery_logs(meeting_id, sent_at desc);
