# Roadmap de Engenharia: PWA de Finanças Pessoais

> **Repositório Oficial:** [github.com/joao-vitor-hernandez/financeiro-pwa-local](https://github.com/joao-vitor-hernandez/financeiro-pwa-local)  
> **Autor:** João Vitor Hernandez (<jvhernandez.dev@gmail.com>)  
> **Licenciamento:** Proprietary / Direitos Reservados (*All Rights Reserved*). Sem licença open-source permissiva no momento para resguardo de propriedade intelectual e viabilidade de futura monetização/SaaS.  
> **Diretriz de Execução:** Evolução gradual, modular e testável.  
> **Regra de Ouro:** Nenhuma fase deve ser iniciada sem que os critérios de aceite e testes da fase anterior estejam validados.  
> **Padrão de Precisão Numérica:** Proibido uso de tipos de ponto flutuante (`float`, `double`) no domínio financeiro. Obrigatório o uso de precisão arbitrária (`Decimal`/`NUMERIC(15, 2)`) e inteiros de alta capacidade (`BigInteger`/`BIGINT`/`UUIDv7`).

---

## Índice das Fases
- [Fase 0: Fundação, Governança & Blindagem de Segurança](#fase-0-fundação-governança--blindagem-de-segurança)
- [Fase 1: Infraestrutura Homelab & Banco de Dados (PostgreSQL)](#fase-1-infraestrutura-homelab--banco-de-dados-postgresql)
- [Fase 2: Domínio Contábil & Core da API (FastAPI)](#fase-2-domínio-contábil--core-da-api-fastapi)
- [Fase 3: Motor de Regras & Integração Open Finance (Pluggy)](#fase-3-motor-de-regras--integração-open-finance-pluggy)
- [Fase 4: Exposição Segura (Cloudflare Tunnel)](#fase-4-exposição-segura-cloudflare-tunnel)
- [Fase 5: Frontend Angular PWA (Design Anti-IA & Offline-First)](#fase-5-frontend-angular-pwa-design-anti-ia--offline-first)
- [Fase 6: Esteira CI/CD (GitHub Actions)](#fase-6-esteira-cicd-github-actions)
- [Fase 7: Inteligência Financeira, Orçamentos & Alertas Web Push](#fase-7-inteligência-financeira-orçamentos--alertas-web-push)
- [Fase 8: Inteligência Preditiva & Gestão Patrimonial Avançada (Inspirada no Open-Source)](#fase-8-inteligência-preditiva--gestão-patrimonial-avançada-inspirada-no-open-source)
- [Fase 9: Hardening, Validação & Documentação de Portfólio](#fase-9-hardening-validação--documentação-de-portfólio)

---

## Fase 0: Fundação, Governança & Blindagem de Segurança
> **Objetivo:** Estabelecer as regras do repositório, proteção contra vazamento de credenciais e diretrizes para o agente antes de qualquer linha de aplicação.

- [x] **0.1. Inicialização do Repositório Git**
  - Inicializar git local (`git init`).
  - Configurar branch principal como `main`.
- [x] **0.2. Blindagem com `.gitignore` Rigoroso**
  - Barrar arquivos de ambiente (`.env*`, com exceção de `.env.example`).
  - Barrar certificados, chaves (`*.pem`, `*.key`, `cloudflared-cert.json`).
  - Barrar dados e backups locais (`*.dump`, `*.sql`, `postgres-data/`).
  - Barrar caches de runtime Python (`__pycache__`, `.venv/`) e Node (`node_modules/`, `dist/`).
- [x] **0.3. Modelo de Variáveis de Ambiente (`.env.example`)**
  - Mapear todas as chaves necessárias sem valores reais (banco, JWT, Pluggy, Cloudflare).
- [x] **0.4. Regras Locais do Antigravity (`.agents/rules/`)**
  - `security.md`: Regras para barrar geração de senhas em código e exigir validação de inputs.
  - `architecture.md`: Padrão de camadas FastAPI (Routers -> Services -> Models/Schemas) e Angular Signals.
  - `financial-rules.md`: Exigência estrita de `Decimal`, regras de arredondamento bancário e partidas dobradas.
  - `ui-ux-guidelines.md`: Diretrizes anti-"cara de IA" (paleta sóbria, mobile-first, áreas de toque).
- [x] **0.5. Ferramentas Locais de Desenvolvimento**
  - Python 3.12.10, Node.js v24.20.0, npm 11.19.0 e Git 2.56.0 instalados e validados.
  - Identidade do Git configurada para João Vitor Hernandez (`jvhernandez.dev@gmail.com`).
  - Primeiro commit efetuado com sucesso.

**Critério de Conclusão da Fase 0:**  
Concluída e validada. Tentativas simuladas de commit de dados sensíveis bloqueadas pelo `.gitignore`. Repositório inicializado e pronto para a infraestrutura.

---

## Fase 1: Infraestrutura Homelab & Banco de Dados (PostgreSQL)
> **Objetivo:** Subir o banco de dados relacional localmente via Docker, estruturar tipos com precisão financeira e implementar rotina de backup criptografado para o Cloudflare R2.

- [x] **1.1. Orquestração Local (`deploy/docker-compose.yml`)**
  - Serviço `postgres:16-alpine` com volume persistente local (`financeiro_postgres_data`).
  - Rede Docker interna isolada (`finance_internal_net`).
  - Variáveis de conexão consumindo o `.env` local.
  - Healthcheck ativo e porta 5432 mapeada para desenvolvimento local.
- [x] **1.2. Padrões de Precisão Numérica e Identificadores**
  - Script `init-db.sql` configurado e executado com sucesso.
  - Extensões `uuid-ossp` e `pgcrypto` habilitadas.
  - Timezone padrão configurado em `UTC`.
- [x] **1.3. Pipeline de Backup Criptografado (Zero-Knowledge)**
  - Ferramenta `age` (v1.3.2) instalada para criptografia assimétrica ponta a ponta.
  - Script de backup para Linux/Homelab ([deploy/backup-r2.sh](file:///e:/code/Antigravity/FinanceiroLocal/deploy/backup-r2.sh)).
  - Script de backup para Windows PowerShell ([deploy/backup-r2.ps1](file:///e:/code/Antigravity/FinanceiroLocal/deploy/backup-r2.ps1)).
- [ ] **1.4. Teste de Disaster Recovery & Configuração R2**
  - Configurar credenciais do bucket Cloudflare R2 e chave `age` pública.
  - Testar ciclo completo de restauração de snapshot.

**Critério de Conclusão da Fase 1:**  
PostgreSQL rodando no Docker; backup gerado, criptografado, enviado ao Cloudflare R2 e restauração validada sem perda de dados.

---

## Fase 2: Domínio Contábil & Core da API (FastAPI)
> **Objetivo:** Desenvolver o núcleo contábil em Python utilizando FastAPI, SQLAlchemy 2.0 e Pydantic v2 com precisão decimal absoluta e testes unitários.

- [x] **2.1. Setup do Projeto Backend**
  - Ambiente virtual Python 3.12 (`.venv`) configurado com FastAPI, Uvicorn, SQLAlchemy 2.0 (async), asyncpg, Alembic e Ruff.
  - Configurações centralizadas via `pydantic-settings` lendo [.env](file:///e:/code/Antigravity/FinanceiroLocal/.env).
- [x] **2.2. Modelagem das Entidades Financeiras**
  - `Account`: Contas correntes, carteiras, investimentos e cartões de crédito.
  - `Category`: Categorias e subcategorias com árvore hierárquica e `lazy="selectin"`.
  - `CreditCardBill`: Faturas de cartão com ciclo de corte (`closing_day`), vencimento (`due_day`) e status (`OPEN`, `CLOSED`, `PAID`).
  - `Transaction`: Lançamentos com valor estritamente em `Decimal`/`NUMERIC(15, 2)`, flags contábeis de transferência e metadados JSONB.
  - Migração inicial autogerada e aplicada via Alembic (`39c4cd671cfa_initial_accounting_schema`).
- [x] **2.3. Regras de Negócio e Cálculos Contábeis (Services)**
  - **Conservação de Centavos em Parcelamentos:** Algoritmo `distribute_installments` garantindo que `sum(parcelas) == total_amount` exato (centavos residuais absorvidos na 1ª parcela).
  - **Ciclo de Cartão de Crédito:** Algoritmo `calculate_bill_dates` alocando compras após o dia de corte automaticamente na fatura subsequente.
  - **Partidas Dobradas:** Transferências neutras (`is_transfer = True`) gerando débito na conta de origem e crédito na conta de destino sem distorcer demonstrativos de receitas e despesas.
  - **Liquidação de Faturas:** Endpoint para quitação de fatura com débito em conta corrente e proteção contra duplo pagamento.
- [x] **2.4. Endpoints REST & Validação com Pydantic v2**
  - CRUD e listagem de contas (`/api/v1/accounts`).
  - CRUD e listagem de categorias e subcategorias (`/api/v1/categories`).
  - Criação de transações simples, parceladas e transferências (`/api/v1/transactions`).
  - Consulta de faturas e liquidação (`/api/v1/bills`).
  - Resumo executivo para o Dashboard (`/api/v1/dashboard/summary`).
- [x] **2.5. Suíte de Testes Automatizados (`pytest`)**
  - 8 testes unitários e de integração executados contra o PostgreSQL 16 com 100% de sucesso.
  - Linter Ruff sem nenhum erro ou aviso.

**Critério de Conclusão da Fase 2:**  
100% dos testes unitários de regras contábeis passando no `pytest`; zero divergência de centavos nas contas; banco de dados migrado via Alembic.

---

## Fase 3: Motor de Regras & Integração Open Finance (Pluggy)
> **Objetivo:** Ingestão de dados bancários reais sem duplicatas e motor de categorização determinístico baseado em expressões regulares (Regex).

- [x] **3.1. Cliente de Integração Pluggy**
  - Cliente HTTP assíncrono (`PluggyClient`) com cache de autenticação JWT e paginação.
  - Endpoints para consulta de contas conectadas e transações de extrato.
- [x] **3.2. Idempotência e Prevenção de Duplicatas**
  - Pipeline de ingestão com verificação de unicidade por `(account_id, external_id)`.
  - Tratamento resiliente: re-execução do sync não duplica lançamentos e não altera saldos indevidamente.
- [x] **3.3. Motor de Regras Determinístico (Rule Engine)**
  - Tabela e migração Alembic para `categorization_rules` (`526fcddd2054_add_categorization_rules`).
  - Higienizador de descrições bancárias (remoção de prefixos `PAG*`, `PG*`, `COMPRA COM CARTAO -`, etc.).
  - Avaliação de regras por prioridade e atribuição automática de categorias e nomes limpos.
  - Endpoints CRUD completos para gerenciamento de regras (`/api/v1/rules`).
- [x] **3.4. Worker de Sincronização em Segundo Plano**
  - Agendador assíncrono configurado via `APScheduler` com inicialização e encerramento gracioso no ciclo de vida do FastAPI (`app/main.py`).
  - Endpoint para disparo de sincronização manual sob demanda (`/api/v1/sync/pluggy`).
- [x] **3.5. Suíte de Testes da Fase 3**
  - 14 testes unitários e de integração cobrindo higienização de texto, prioridade de regras, idempotência bancária e endpoints da API, todos aprovados com 100% de sucesso.
- [x] **3.6. Pluggy Connect Widget & Webhooks em Tempo Real**
  - Geração de Connect Token temporário no backend (`POST /api/v1/sync/connect-token`).
  - Integração do SDK Pluggy Connect v2 no Angular PWA com acionamento nativo em "Conectar Banco".
  - Endpoint de pós-conexão (`POST /api/v1/sync/item-connected`) para descoberta automática de contas correntes e cartões.
  - Endpoint público de webhook (`POST /api/v1/webhooks/pluggy`) com resposta < 2s e ingestão contábil assíncrona em background.

**Critério de Conclusão da Fase 3:**  
Concluída e validada. Ingestão de extratos categoriza lançamentos por regras Regex e ignora duplicatas sem alterar saldos; fluxo completo de consentimento Pluggy Connect e Webhooks ativos; suíte com 20 testes passando no `pytest`.

---

## Fase 5: Frontend Angular PWA (Design Anti-IA & Offline-First) *(Concluída)*
> **Ordem de Execução:** Priorizada para o PC principal antes da Fase 4 para possibilitar validação visual e uso local imediato da interface.  
> **Objetivo:** Construir uma interface agradável, rápida, pensada para usabilidade em smartphone, sem aparência genérica de template de IA.

- [x] **5.1. Setup do Angular Moderno**
  - Angular CLI com TypeScript estrito, Standalone Components e Signals.
  - Adição do pacote `@angular/pwa` (Service Worker, ícones e `manifest.webmanifest`).
  - IndexedDB configurado via Dexie para persistência e resiliência offline.
- [x] **5.2. Design System Sóbrio e Humano**
  - Paleta neutra (tons de Zinc 950/900/800) com acentos semafóricos discretos (verde/vermelho contábeis).
  - Tipografia limpa com `tabular-nums` para moedas e valores contábeis.
  - Sem gradientes roxo/neon clichês ou cards hiper-aninhados.
  - Ergonomia mobile: botões e áreas de toque com mínimo de 44x44px; navegação inferior (*Bottom Navigation*).
  - Componente de ícones SVG nativos otimizados (zero dependências externas e 0KB de sobrecarga).
- [x] **5.3. Funcionalidades Chave da Interface**
  - **Cards Executivos:** Saldo líquido disponível, fatura aberta, passivo total e fluxo de resultado do mês.
  - **Modo Privacidade:** Botão de alternância instantânea para ofuscar valores (`R$ •••••`) em ambientes públicos com persistência local.
  - **Lançamento Rápido (*Quick Add*):** Gaveta inferior (*bottom sheet*) com seletor de tipo (despesa/receita/transferência), parcelamento e teclado numérico decimal.
  - **Extrato Inteligente:** Agrupamento por data, subtotais diários, filtros por tipo, busca em tempo real e visualização de parcelas.
  - **Gestão de Contas & Faturas:** Visualização de limites de cartões e fluxo de pagamento de faturas com débito em conta corrente.
- [x] **5.4. Operação Offline e Cache (IndexedDB)**
  - Armazenamento local de contas, transações e sumário no IndexedDB via Dexie.
  - Fallback transparente do `ApiService` para IndexedDB em caso de indisponibilidade de rede.
  - Roteamento SPA configurado via `_redirects` para Cloudflare Pages.

**Critério de Conclusão da Fase 5:**  
Bundle de produção gerado com 100% de sucesso (apenas 127 kB transfer size), PWA instalável com Service Worker, Modo Privacidade e navegação fluida.

---

## Fase 4: Exposição Segura (Cloudflare Tunnel) *(Concluída)*
> **Objetivo:** Expor a API do Homelab para a internet pública com conexão criptografada de saída, sem abrir portas no roteador residencial.  

- [x] **4.1. Setup do `cloudflared` no Docker**
  - Serviço `cloudflared` configurado na rede interna Docker (`finance_internal_net`).
  - Conexão de saída criptografada via protocolo QUIC conectada à borda global da Cloudflare.
- [x] **4.2. Roteamento de Subdomínio Dedicado**
  - Subdomínio público isolado `https://api-fin.entrefilas.com.br` apontado para o container `http://backend:8000`.
  - Frontend SPA hospedado no Cloudflare Pages em `https://financeiro.entrefilas.com.br` integrado com sucesso.
- [x] **4.3. Camada de Segurança e In-App PIN Lockscreen**
  - Autenticação bancária nativa com PIN numérico de 6 dígitos criptografado com BCrypt (cost factor 12).
  - Bloqueio automático contra força bruta após 5 tentativas consecutivas incorretas (15 minutos).
  - Sessões protegidas por JSON Web Tokens (JWT) com assinatura HS256 e interceptor HTTP Angular.

**Critério de Conclusão da Fase 4:**  
Concluída e validada. A API responde com sucesso via HTTPS em `api-fin.entrefilas.com.br` e o PWA foi acessado com sucesso via celular em rede externa sem nenhuma porta de entrada aberta no roteador.

---

## Fase 6: Esteira CI/CD (GitHub Actions) *(Concluída)*
> **Objetivo:** Automação completa de testes, verificações de qualidade e publicação contínua sem esforço manual.

- [x] **6.1. Workflow de Segurança (`.github/workflows/security.yml`)**
  - Execução de `gitleaks` a cada push/PR para barrar vazamento de segredos.
- [x] **6.2. Workflow do Backend (`.github/workflows/backend.yml`)**
  - Setup Python 3.12 -> Linter com `ruff` -> Testes com `pytest` (usando container de serviço PostgreSQL 16) -> Teste de build do `Dockerfile`.
- [x] **6.3. Workflow do Frontend (`.github/workflows/frontend.yml`)**
  - Setup Node.js 22.x -> Testes unitários (`vitest`) -> `ng build --configuration production` -> Validação de SPA routing (`_redirects`) e deploy no Cloudflare Pages.

**Critério de Conclusão da Fase 6:**  
Concluída e validada. Workflows estruturados e ativados no repositório; testes, linter, segurança e publicação contínua automatizados no GitHub Actions.

---

## Fase 7: Inteligência Financeira, Orçamentos & Alertas Web Push
> **Objetivo:** Implementar camadas proativas de planejamento e proteção financeira: tetos orçamentários por categoria, metas patrimoniais, gestão visual de regras de categorização, sincronização de lançamentos offline e notificações Web Push nativas para o PWA com alta prioridade no fuso de Brasília.

- [x] **7.1. Orçamentos Mensais e Tetos de Gastos por Categoria (Budgeting)**
  - Tabela `budgets` no PostgreSQL (`category_id`, `month`, `year`, `limit_amount: NUMERIC(15, 2)`).
  - Cálculo de consumo em tempo real com barra de progresso semafórica (Verde < 80%, Amarelo 80-99%, Vermelho >= 100%).
  - Alerta antecipado no dashboard e em cards ao se aproximar ou ultrapassar o teto estipulado.
  - Endpoints REST para criação, duplicação mensal e ajuste de orçamentos (`/api/v1/budgets`).

- [x] **7.2. Central de Metas Financeiras & Objetivos (Goals & Cofrinhos)**
  - Tabela `financial_goals` para rastreamento de metas específicas (ex: "Reserva de Emergência", "Troca de Celular", "Viagem").
  - Vínculo direto com contas do tipo `SAVINGS` (cofrinhos/caixinhas) ou montantes aportados (`goal_contributions`).
  - Componente de barra de progresso percentual, cálculo automático de prazo estimado para conclusão, ritmo mensal necessário (`monthly_pace_needed`) e histórico de aportes.
  - Widget interativo no dashboard (`FinancialGoalsWidgetComponent`) com modais de criação, edição, aportes/resgates e vínculo de cofrinho.

- [x] **7.3. Gerenciador Visual de Regras de Categorização no PWA**
  - Tela dedicada (`/rules`) e item na barra de navegação (`BottomNavComponent`) com ícone e atalho rápido.
  - Interface visual conectada aos endpoints (`/api/v1/rules`) para criar, editar, reordenar prioridades e excluir regras.
  - Simulador interativo na tela (Playground): testa texto de fatura bancária em tempo real contra todas as regras ativas, exibindo a higienização de prefixos (`PAG*`), a categoria correspondente e a descrição final.
  - Validador de sintaxe Regex em tempo real no modal com mini-tester embutido antes de salvar a regra.
  - Reordenação em lote via API (`POST /api/v1/rules/reorder`) para controle fino da precedência contábil.

- [ ] **7.4. Fila de Lançamento Offline Resiliente (Outbox Sync)**
  - Fila local no IndexedDB (Dexie) para capturar lançamentos rápidos feitos no smartphone quando desconectado da rede.
  - Worker de sincronização com detecção automática do evento `online` do navegador (`navigator.onLine` / `window.addEventListener('online')`).
  - Envio sequencial e ordenado para a API com reconciliação idempotente e atualização dos saldos locais.

- [ ] **7.5. Sistema de Alertas & Notificações Web Push de Vencimentos (PWA)**
  - **Arquitetura Web Push (VAPID):**
    - Par de chaves criptográficas VAPID gerado no backend (`pywebpush`).
    - Registro e persistência da assinatura de push (`PushSubscription`) do Service Worker do Angular PWA no PostgreSQL (`user_push_subscriptions`).
  - **Janelas de Disparo (Fuso de Brasília / `America/Sao_Paulo` - UTC-3):**
    - **Dia Anterior ao Vencimento (D-1):** Notificação emitida às **09:00** e reforço às **18:00**.
    - **Dia do Vencimento (D-0):** Notificação emitida às **09:00** e reforço vespertino às **18:00**.
  - **Configuração de Alta Prioridade:**
    - Header HTTP Web Push `Urgency: high`, payload com prioridade alta e vibração nativa (`vibrate: [200, 100, 200]`) para garantir despertar em tela bloqueada.
    - Notificação informativa com nome da conta/cartão, valor formatado e botão de ação direta ("Abrir no ClariFin").
  - **Agendador Cron Backend:**
    - Rotina assíncrona agendada no `APScheduler` rodando às 09:00 e 18:00 (`timezone="America/Sao_Paulo"`), consultando faturas de cartão e contas com vencimento em D-1 ou D-0 com status `OPEN`.

**Critério de Conclusão da Fase 7:**  
Orçamentos com barras de progresso ativos no dashboard; metas cadastradas e monitoradas; regras editáveis pela UI; lançamentos offline sincronizando automaticamente ao recuperar conexão; notificações Web Push disparadas pontualmente às 09h e 18h no fuso de Brasília com alta prioridade em D-1 e D-0.

---

## Fase 8: Inteligência Preditiva & Gestão Patrimonial Avançada (Inspirada no Open-Source)
> **Objetivo:** Incorporar as melhores práticas arquiteturais consolidadas por Actual Budget, Firefly III e Ghostfolio, trazendo previsibilidade de fluxo de caixa, limite diário de gastos, anexos de recibos no Cloudflare R2 e benchmarks de rentabilidade.

- [ ] **8.1. Previsão de Saldo a 30 Dias (*Cash Flow Forecast* - Inspirado no Firefly III)**
  - Algoritmo de projeção preditiva no backend: `Saldo Atual + Receitas Previstas - Faturas de Cartão Abertas - Despesas Fixas Recorrentes`.
  - Curva pontilhada de projeção futura no gráfico de evolução patrimonial para os próximos 30 dias.
  - Indicador de saldo estimado para o último dia do mês corrente, emitindo alertas proativos se houver risco de saldo negativo antes do fechamento.

- [ ] **8.2. Indicador "Livre para Gastar por Dia" (*Safe to Spend* - Inspirado no Actual Budget)**
  - Cálculo dinâmico contábil: `(Saldo Disponível - Contas e Faturas a Vencer até o fim do mês) / Dias Restantes no Mês`.
  - Métrica executiva de alto impacto visual no topo do dashboard (ex: *"R$ 48,00 / dia livre para gastar"*).
  - Atualização automática em tempo real a cada lançamento de despesa, pagamento de fatura ou entrada de receita.

- [ ] **8.3. Anexo de Comprovantes & Notas Fiscais via Cloudflare R2 (Inspirado no Firefly III)**
  - Tabela `transaction_attachments` vinculando arquivos de imagem (PNG, JPG, WebP) e documentos (PDF) a lançamentos contábeis.
  - Upload direto do smartphone no modal de lançamento rápido (*Quick Add*), aproveitando a câmera do celular.
  - Armazenamento no bucket Cloudflare R2 via URLs pré-assinadas com criptografia de ponta a ponta e zero custo de tráfego de saída (*zero egress fees*).
  - Visualizador de recibos e comprovantes integrado ao Extrato Inteligente.

- [ ] **8.4. Alocação de Ativos & Benchmark CDI dos Cofrinhos (Inspirado no Ghostfolio)**
  - Definição de alocação patrimonial alvo (*Target Allocation*): percentual ideal entre Dinheiro em Conta, Cofrinhos (Mercado Pago / Reserva) e Investimentos.
  - Gráfico Donut de rebalanceamento comparando a distribuição patrimonial real versus a meta desejada.
  - Comparador de rendimento dos Cofrinhos contra a taxa CDI acumulada no período, indicando o ganho real líquido sobre a inflação.

**Critério de Conclusão da Fase 8:**  
Previsão de saldo a 30 dias funcional no gráfico; métrica de valor diário livre visível no dashboard; upload de fotos de comprovantes salvando no Cloudflare R2 e abrindo no extrato; comparador de rendimento dos cofrinhos contra o CDI ativo.

---

## Fase 9: Hardening, Validação & Documentação de Portfólio
> **Objetivo:** Ajustes finais de performance, auditoria de segurança e consolidação do repositório como peça de destaque no portfólio.

- [ ] **9.1. Auditoria de Performance (Lighthouse)**
  - Metas do PWA: Score 90+ em Performance, Acessibilidade, Melhores Práticas e PWA.
- [ ] **9.2. Teste de Carga e Resiliência da Conexão**
  - Validar reconexão automática do Cloudflare Tunnel após reinicialização do Homelab ou queda de internet residencial.
- [ ] **9.3. README Executivo de Portfólio**
  - Diagrama de arquitetura de rede e fluxo de dados.
  - Demonstração em GIF/vídeo curto do PWA funcionando (incluindo Quick Add e Modo Privacidade).
  - Justificativa das decisões de engenharia (PostgreSQL, `Decimal`, Cloudflare Tunnel, R2, Angular Signals).

---

## Matriz de Rastreabilidade e Decisões Técnicas

| Requisito | Solução Técnica | Por que essa escolha? |
|---|---|---|
| **Precisão Monetária** | `Decimal` / `NUMERIC(15, 2)` | Elimina imprecisões binárias de `float` (ex: `0.1 + 0.2 != 0.3`). |
| **Identificadores** | `BIGINT` / `UUIDv7` | Suporta escala massiva e ordenação temporal nativa sem colisão. |
| **Segurança do Homelab** | Cloudflare Tunnel | Não abre portas no roteador; túnel de saída TLS 1.3 seguro. |
| **Autenticação & Bloqueio** | BCrypt (rounds=12) + JWT + PIN 6D + Cloudflare Zero Trust | Protege contra força bruta com key stretching, lockout após 5 erros e blindagem na borda com OTP de e-mail. |
| **Backup Resiliente** | `pg_dump` + `age` + Cloudflare R2 | Custo zero (10 GB free), zero egress fee e criptografia ponta a ponta. |
| **Frontend PWA** | Angular + Signals + IndexedDB | Tipagem forte corporativa, reatividade nativa e funcionamento offline. |
| **Deploy Automatizado** | GitHub Actions + Cloudflare Pages | CI/CD profissional que comprova proficiência DevOps no portfólio. |
| **Alertas de Vencimento** | Web Push (VAPID) + `APScheduler` (`America/Sao_Paulo`) | Notificações push nativas de alta prioridade às 09h e 18h em D-1 e D-0 sem custos de provedores pagos (Twilio/SMS). |
| **Lançamentos Offline** | Outbox Pattern (IndexedDB / Dexie) | Registro imediato de gastos sem internet com reconciliação idempotente automática ao reconectar. |
| **Planejamento Orçamentário** | Metas por Categoria + Alertas Semafóricos | Controle proativo de teto de gastos antes do fechamento das faturas. |
| **Previsão de Fluxo de Caixa** | Modelo Preditivo a 30 Dias (Firefly III) | Previne inadimplência ao cruzar passivo de cartões com contas fixas futuras. |
| **Orientação a Gastos Diários** | Indicador *Safe to Spend* (Actual Budget) | Dá clareza psicológica imediata de quanto pode ser gasto hoje sem endividamento. |
| **Custódia de Documentos** | Anexos no Cloudflare R2 (Zero Egress) | Preserva notas fiscais e comprovantes PIX sem inflar o banco relacional. |
| **Inteligência de Ativos** | Benchmark CDI & Alocação Alvo (Ghostfolio) | Garante que o dinheiro guardado nos cofrinhos e investimentos acompanhe o mercado. |
