# Fluxo Manual de Cobranca por Loja

## Objetivo

O gateway deixa de ser apenas um intermediario de pagamento e passa a ser o centro de controle das mensalidades das lojas.

O pagamento continua acontecendo fora do sistema. A diferenca e que a confirmacao, a liberacao temporaria, a carencia e o bloqueio passam a ser gerenciados aqui no gateway.

## Ideia Central

- Cada programa cliente tem seu cadastro no gateway.
- Cada loja desse programa tambem tem seu cadastro financeiro no gateway.
- O gateway guarda o valor mensal, `pago_ate`, carencia, status calculado, observacao e dados opcionais de QR Code.
- Cada programa consulta esse estado e decide como reagir.

## Status

### `vip`

Cliente parceiro que nao entra na regua de cobranca.

- Nao mostra lembrete.
- Nao bloqueia.
- Pode nao ter vencimento relevante.

### `ativo`

Cliente adimplente.

Uma loja fica ativa quando `pago_ate` ainda cobre a data atual.

### `liberado`

Liberacao manual temporaria por acordo.

Cada clique em `Liberar 3 dias` soma mais 3 dias de acesso. A liberacao fica registrada em `manual_release_until`.

### `pendente`

Cliente vencido, mas ainda dentro da carencia configurada.

A carencia e em dias corridos e deve ser configuravel por loja na UI. O padrao esperado e 15 dias.

### `bloqueado`

Cliente vencido fora da carencia.

O bloqueio nao deve impedir acesso a dados e relatorios antigos. Cada programa cliente decide como aplicar o bloqueio, normalmente limitando novas operacoes.

## Fluxo do Gateway

1. A loja e cadastrada no gateway com programa, ID da loja, mensalidade, `pago_ate`, carencia e observacao.
2. O gateway calcula o status financeiro da loja.
3. O operador do gateway pode editar manualmente:
   - valor mensal
   - `pago_ate`
   - carencia
   - VIP
   - QR Code
   - copia e cola
   - observacao
4. Quando o pagamento for confirmado pelo operador, ele clica em `Pago esse mes`.
5. Cada clique em `Pago esse mes` regulariza exatamente 1 mes.
6. O novo `pago_ate` e calculado a partir do vencimento atual, nao da data real do pagamento.
7. Se o cliente pagar 2 meses, o operador clica duas vezes.
8. Quando houver acordo, o operador pode clicar em `Liberar 3 dias`.

## Fluxo nos Programas Clientes

1. O programa consulta o gateway para saber o status daquela loja.
2. Se estiver `ativo`, `liberado` ou `vip`, segue sem bloqueio.
3. Se estiver `pendente`, pode mostrar lembrete de pagamento.
4. Se estiver `bloqueado`, deve limitar novas operacoes conforme a regra do programa.
5. O cliente pode abrir um modal para gerar ou visualizar QR Code/copia e cola.
6. O cliente nao informa mais que pagou.

## Onde Fica Cada Coisa

### No Gateway

- Cadastro de programas clientes
- Cadastro financeiro das lojas
- Valor mensal por loja
- `pago_ate`
- Carencia em dias corridos
- VIP
- Liberacao manual temporaria
- Observacao
- QR Code e copia e cola opcionais
- Historico de acoes
- Calculo de status

### Nos Programas

- Consulta de status da loja
- Banner ou modal de lembrete
- Modal de QR Code/copia e cola
- Reacao ao bloqueio
- Preservacao de acesso a dados e relatorios antigos

## Papel Do QR Code

Se houver uma forma de pagamento com QR Code ou copia e cola, ela aparece no modal da loja.

Nesse MVP o QR Code e apenas apoio de pagamento, nao confirmacao automatica.

## O Que Muda Em Relacao Ao Fluxo Anterior

- A Asaas deixa de ser a base do MVP.
- O botao `Pago esse mes` e interno do gateway, usado pelo operador.
- O cliente nao marca pagamento.
- O controle fica manual e barato.
- A automacao financeira pode entrar depois, quando fizer sentido economico.
- O sistema passa a existir primeiro como controle de mensalidade, carencia, liberacao e bloqueio.
