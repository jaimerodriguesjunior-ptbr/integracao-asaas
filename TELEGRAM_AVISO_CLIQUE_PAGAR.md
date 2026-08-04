# Aviso no Telegram ao clicar em “Pagar”

**Status:** especificação para implementação futura

## Objetivo

Sempre que um cliente da AutoEletrica clicar no botão **Pagar** para consultar o QR Code ou o Pix copia e cola, o administrador deve receber uma mensagem no Telegram.

O aviso representa uma **intenção de pagamento**. Ele não confirma que o pagamento foi realizado. A confirmação continua dependendo da baixa da cobrança no gateway.

## Fluxo proposto

1. O cliente autenticado clica em **Pagar** na AutoEletrica.
2. A AutoEletrica registra o evento em uma rota de servidor própria, sem expor credenciais do Telegram no navegador.
3. A rota envia o evento autenticado ao gateway `integracao-asaas`.
4. O gateway envia a mensagem pela API do Telegram.
5. A abertura do modal PIX continua acontecendo mesmo que o Telegram esteja indisponível. A notificação não pode impedir o pagamento.

## Informações da mensagem

Mensagem sugerida:

```text
🔔 Cliente clicou em Pagar

Loja: Auto Center
Organização: Autoeletrica
Cliente: Nome do usuário
Valor: R$ 150,00
Vencimento: 05/08/2026
Situação: mensalidade pendente
Horário: 02/08/2026 14:35
```

Quando algum dado não estiver disponível, ele deve ser omitido ou identificado como “não informado”. Nunca enviar token, QR Code, Pix copia e cola ou dados desnecessários do cliente.

## Contrato sugerido entre os sistemas

Rota no gateway:

```text
POST /api/notifications/payment-click
```

Payload mínimo:

```json
{
  "organizationId": "uuid-da-organizacao",
  "storeId": "uuid-da-loja",
  "storeName": "Auto Center",
  "customerName": "Nome do usuário",
  "customerId": "uuid-do-usuario",
  "amount": 150,
  "paidUntil": "2026-08-05",
  "billingStatus": "pendente",
  "occurredAt": "2026-08-02T17:35:00.000Z",
  "eventId": "uuid-do-evento"
}
```

O endpoint deve exigir autenticação servidor-servidor, por exemplo um segredo compartilhado em `COBRANCA_TELEGRAM_WEBHOOK_SECRET`. A rota não deve aceitar esse segredo em código executado no navegador.

## Variáveis de ambiente do gateway

```text
TELEGRAM_BOT_TOKEN=
TELEGRAM_CHAT_ID=
COBRANCA_TELEGRAM_WEBHOOK_SECRET=
```

Essas variáveis devem ser cadastradas na Vercel nos ambientes necessários. O token nunca deve ser commitado no repositório nem exposto em respostas HTTP ou logs.

## Duplicidade e limites

- Cada clique intencional pode gerar um evento.
- O `eventId` deve ser único para permitir deduplicação.
- Recomenda-se ignorar eventos repetidos com o mesmo `eventId`.
- Um limite simples por loja e usuário pode evitar dezenas de mensagens causadas por cliques repetidos acidentais, por exemplo uma notificação a cada 5 minutos.
- O envio deve ser assíncrono ou tolerante a falhas; erro no Telegram não pode bloquear o modal PIX.

## Critérios de aceite

- Ao clicar em **Pagar**, o cliente vê o modal normalmente.
- O administrador recebe uma mensagem no Telegram contendo loja, valor, vencimento, situação e horário.
- Recarregar ou navegar pela aplicação não gera uma nova notificação sem um novo clique.
- Falha, timeout ou indisponibilidade do Telegram não impede o pagamento.
- Nenhuma credencial do Telegram aparece no navegador, no bundle público ou nos logs.
- O evento não é tratado como confirmação de pagamento; a baixa continua sendo feita pelo fluxo existente.

## Implementação futura sugerida

1. Criar um tipo compartilhado para o evento de clique.
2. Criar a rota de registro na AutoEletrica.
3. Criar a rota autenticada correspondente no gateway.
4. Implementar um pequeno cliente Telegram no gateway usando `sendMessage`.
5. Adicionar deduplicação e logs sem dados sensíveis.
6. Disparar o registro no ponto em que o modal PIX é aberto.
7. Testar com Telegram configurado e também com o Telegram indisponível.

