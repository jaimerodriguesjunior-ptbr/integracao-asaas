insert into public.api_clients (
  client_key,
  client_secret_hash,
  name,
  webhook_url,
  active
) values (
  'autoeletrica',
  'baba6a7eca88dcbb73c51570c96441e690a828d6f02ad88d13089d424745acaa',
  'Autoeletrica',
  'https://autoeletrica.vercel.app/api/cobranca/webhook',
  true
)
on conflict (client_key) do update set
  client_secret_hash = excluded.client_secret_hash,
  name = excluded.name,
  webhook_url = excluded.webhook_url,
  active = excluded.active;
