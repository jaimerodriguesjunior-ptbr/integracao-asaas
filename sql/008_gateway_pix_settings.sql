create table if not exists public.gateway_pix_settings (
  id uuid primary key default gen_random_uuid(),
  pix_key text not null,
  merchant_name text not null,
  merchant_city text not null,
  description text,
  txid_prefix text,
  active boolean not null default true,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create unique index if not exists gateway_pix_settings_single_active_idx
  on public.gateway_pix_settings (active)
  where active = true;

drop trigger if exists set_gateway_pix_settings_updated_at on public.gateway_pix_settings;
create trigger set_gateway_pix_settings_updated_at
before update on public.gateway_pix_settings
for each row
execute function public.set_updated_at();

insert into public.gateway_pix_settings (
  pix_key,
  merchant_name,
  merchant_city,
  description,
  txid_prefix,
  active
)
select
  pix_key,
  merchant_name,
  merchant_city,
  description,
  txid_prefix,
  active
from public.api_client_pix_settings
where active = true
order by updated_at desc
limit 1
on conflict do nothing;
