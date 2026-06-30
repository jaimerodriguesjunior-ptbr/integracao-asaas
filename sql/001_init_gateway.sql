create extension if not exists pgcrypto;

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = timezone('utc', now());
  return new;
end;
$$;

create table if not exists public.api_clients (
  id uuid primary key default gen_random_uuid(),
  client_key text not null unique,
  client_secret_hash text not null,
  name text not null,
  webhook_url text not null,
  active boolean not null default true,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create table if not exists public.billings (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references public.api_clients(id) on delete restrict,
  asaas_payment_id text unique,
  external_reference text,
  status text not null default 'PENDING',
  billing_type text not null,
  amount numeric(12,2) not null check (amount >= 0),
  due_date date,
  customer_name text,
  customer_email text,
  customer_phone text,
  description text,
  payload_original jsonb not null default '{}'::jsonb,
  asaas_response jsonb,
  last_webhook_at timestamptz,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create table if not exists public.webhook_deliveries (
  id uuid primary key default gen_random_uuid(),
  billing_id uuid not null references public.billings(id) on delete cascade,
  target_url text not null,
  attempt integer not null default 1 check (attempt > 0),
  delivery_status text not null default 'PENDING',
  status_code integer,
  response_body text,
  request_payload jsonb not null default '{}'::jsonb,
  delivered_at timestamptz,
  next_retry_at timestamptz,
  created_at timestamptz not null default timezone('utc', now())
);

create table if not exists public.billing_events (
  id uuid primary key default gen_random_uuid(),
  billing_id uuid references public.billings(id) on delete cascade,
  asaas_event_id text,
  event_type text not null,
  payload jsonb not null,
  received_at timestamptz not null default timezone('utc', now())
);

create unique index if not exists billing_events_asaas_event_id_idx
  on public.billing_events (asaas_event_id)
  where asaas_event_id is not null;

create index if not exists api_clients_active_idx
  on public.api_clients (active);

create index if not exists billings_client_id_idx
  on public.billings (client_id);

create index if not exists billings_status_idx
  on public.billings (status);

create index if not exists billings_external_reference_idx
  on public.billings (external_reference);

create index if not exists webhook_deliveries_billing_id_idx
  on public.webhook_deliveries (billing_id, created_at desc);

create index if not exists webhook_deliveries_retry_idx
  on public.webhook_deliveries (delivery_status, next_retry_at);

create index if not exists billing_events_billing_id_idx
  on public.billing_events (billing_id, received_at desc);

drop trigger if exists set_api_clients_updated_at on public.api_clients;
create trigger set_api_clients_updated_at
before update on public.api_clients
for each row
execute function public.set_updated_at();

drop trigger if exists set_billings_updated_at on public.billings;
create trigger set_billings_updated_at
before update on public.billings
for each row
execute function public.set_updated_at();
