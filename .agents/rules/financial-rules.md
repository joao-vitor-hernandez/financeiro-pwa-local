# Regras de Domínio Financeiro e Precisão Contábil

Diretrizes estritas para manipulação de valores numéricos, datas e contabilidade prática no backend e banco de dados.

## 1. Precisão Numérica Absoluta (BigDecimal / Decimal)
- **Proibição de Ponto Flutuante:** É terminantemente PROIBIDO o uso de `float` ou `double` para valores monetários, taxas ou saldos.
- **Backend (Python):** Use exclusivamente `decimal.Decimal` do módulo padrão `decimal`.
- **Validação (Pydantic):** Use tipos `Decimal` ou `condecimal(max_digits=15, decimal_places=2)`.
- **Banco de Dados (PostgreSQL):** Mapeie todas as colunas de valores monetários como `NUMERIC(15, 2)` ou `DECIMAL(15, 2)`.
- **Arredondamento:** Quando necessário arredondar, utilize a estratégia contábil padrão `ROUND_HALF_EVEN` (arredondamento bancário).

## 2. Conservação Exata de Centavos em Parcelamentos
- Ao dividir uma transação parcelada de valor $V$ em $N$ parcelas:
  - O valor base da parcela é `floor(V / N, 2 casas)`.
  - A diferença residual de centavos (`V - (parcela_base * N)`) DEVE ser adicionada à primeira parcela.
  - Exemplo: R$ 100,00 em 3x $\to$ Parcela 1: R$ 33,34; Parcela 2: R$ 33,33; Parcela 3: R$ 33,33. A soma exata deve ser sempre R$ 100,00.

## 3. Transferências Neutras (Partidas Dobradas)
- Movimentações financeiras entre contas do mesmo titular (ex: Conta Corrente $\to$ Investimento) são marcadas com `is_transfer = True`.
- Uma transferência gera:
  1. Uma saída (débito) na conta de origem.
  2. Uma entrada (crédito) na conta de destino.
- Relatórios de DRE, Despesas Totais e Receitas Totais DEVEM desconsiderar transações onde `is_transfer = True` para evitar inflar o fluxo de caixa.

## 4. Ciclo de Cartão de Crédito
- Todo cartão possui `closing_day` (dia de corte) e `due_day` (dia de vencimento).
- Compras realizadas até o dia de corte caem na fatura do mês corrente.
- Compras realizadas após o dia de corte são automaticamente atribuídas à fatura do mês subsequente.
- Gastos no cartão de crédito alimentam o passivo da fatura aberta e NÃO abatem o saldo disponível de contas correntes até o momento do pagamento da fatura.

## 5. Fuso Horário e Datas
- Todas as datas e timestamps no banco de dados devem ser armazenados em UTC (`TIMESTAMP WITH TIME ZONE`).
- A conversão para o fuso horário do usuário (padrão Brasil: `America/Sao_Paulo`, UTC-3) deve ocorrer na camada de apresentação/serialização.
