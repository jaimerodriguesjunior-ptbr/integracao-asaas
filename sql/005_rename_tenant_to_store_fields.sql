alter table public.billings
  add column if not exists store_id text,
  add column if not exists store_name text,
  add column if not exists store_document text;

update public.billings
set
  store_id = coalesce(store_id, tenant_id),
  store_name = coalesce(store_name, tenant_name),
  store_document = coalesce(store_document, tenant_document)
where
  tenant_id is not null
  or tenant_name is not null
  or tenant_document is not null;

drop index if exists public.billings_client_tenant_idx;
drop index if exists public.billings_tenant_document_idx;

alter table public.billings
  drop column if exists tenant_id,
  drop column if exists tenant_name,
  drop column if exists tenant_document;

create index if not exists billings_client_store_idx
  on public.billings (client_id, store_id);

create index if not exists billings_store_document_idx
  on public.billings (store_document);
