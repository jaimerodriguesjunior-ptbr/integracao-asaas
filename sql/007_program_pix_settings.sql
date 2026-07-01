create table if not exists public.api_client_pix_settings (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references public.api_clients(id) on delete cascade,
  pix_key text not null,
  merchant_name text not null,
  merchant_city text not null,
  description text,
  txid_prefix text,
  active boolean not null default true,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  unique (client_id)
);

create index if not exists api_client_pix_settings_client_id_idx
  on public.api_client_pix_settings (client_id);

drop trigger if exists set_api_client_pix_settings_updated_at on public.api_client_pix_settings;
create trigger set_api_client_pix_settings_updated_at
before update on public.api_client_pix_settings
for each row
execute function public.set_updated_at();
