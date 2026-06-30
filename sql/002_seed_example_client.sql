-- Gere o hash SHA-256 do segredo que voce quer usar no cliente.
-- Exemplo em Node.js:
-- require("crypto").createHash("sha256").update("segredo-aqui", "utf8").digest("hex")

insert into public.api_clients (
  client_key,
  client_secret_hash,
  name,
  webhook_url,
  active
) values (
  'programa-manicure',
  'SUBSTITUA_PELO_HASH_SHA256_DO_SEGREDO',
  'Programa Manicure',
  'https://seu-sistema.com/api/cobranca/webhook',
  true
);
