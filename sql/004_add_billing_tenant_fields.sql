alter table public.billings
  add column if not exists tenant_id text,
  add column if not exists tenant_name text,
  add column if not exists tenant_document text;

create index if not exists billings_client_tenant_idx
  on public.billings (client_id, tenant_id);

create index if not exists billings_tenant_document_idx
  on public.billings (tenant_document);
