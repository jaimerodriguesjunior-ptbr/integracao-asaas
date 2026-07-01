create table if not exists public.client_stores (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references public.api_clients(id) on delete restrict,
  store_id text not null,
  store_name text not null,
  store_document text,
  monthly_amount numeric(12,2) not null default 0 check (monthly_amount >= 0),
  paid_until date,
  grace_days integer not null default 15 check (grace_days >= 0),
  is_vip boolean not null default false,
  manual_release_until date,
  payment_qr_code text,
  payment_copy_paste text,
  notes text,
  active boolean not null default true,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  unique (client_id, store_id)
);

create table if not exists public.client_store_events (
  id uuid primary key default gen_random_uuid(),
  client_store_id uuid not null references public.client_stores(id) on delete cascade,
  event_type text not null,
  previous_paid_until date,
  next_paid_until date,
  previous_release_until date,
  next_release_until date,
  notes text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default timezone('utc', now())
);

create index if not exists client_stores_client_id_idx
  on public.client_stores (client_id);

create index if not exists client_stores_store_id_idx
  on public.client_stores (store_id);

create index if not exists client_stores_billing_idx
  on public.client_stores (is_vip, paid_until, manual_release_until, grace_days);

create index if not exists client_store_events_store_idx
  on public.client_store_events (client_store_id, created_at desc);

drop trigger if exists set_client_stores_updated_at on public.client_stores;
create trigger set_client_stores_updated_at
before update on public.client_stores
for each row
execute function public.set_updated_at();
