-- supabase/schema.sql
create extension if not exists "pgcrypto";

create table if not exists items (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade,
  qr_code text not null,
  sku text,
  name text not null,
  quantity integer not null default 0,
  reorder_at integer,
  location text,
  category text,
  notes text,
  cost numeric,
  price numeric,
  photo_url text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (owner_id, qr_code)
);

create index if not exists items_owner_id_idx on items (owner_id);
create index if not exists items_location_idx on items (location);
create index if not exists items_category_idx on items (category);

create or replace function set_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

drop trigger if exists items_set_updated_at on items;
create trigger items_set_updated_at
before update on items
for each row
execute function set_updated_at();

insert into storage.buckets (id, name, public)
values ('photos', 'photos', false)
on conflict (id) do nothing;
