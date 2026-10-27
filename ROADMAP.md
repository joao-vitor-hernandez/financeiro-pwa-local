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
- [Fase 7: Hardening, Validação & Documentação de Portfólio](#fase-7-hardening-validação--documentação-de-portfólio)

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

**Critério de Conclusão da Fase 3:**  
Concluída e validada. Ingestão de extratos categoriza lançamentos por regras Regex e ignora duplicatas sem alterar saldos; 14 testes passando no `pytest`.

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

## Fase 4: Exposição Segura (Cloudflare Tunnel)
> **Objetivo:** Expor a API do Homelab para a internet pública com conexão criptografada de saída, sem abrir portas no roteador residencial.  
> **Nota de Integração:** O projeto no Cloudflare Pages já foi pré-criado no painel e conectado ao repositório GitHub para futuro deploy do frontend.

- [ ] **4.1. Setup do `cloudflared` no Docker**
  - Adicionar o serviço `cloudflared` no `docker-compose.yml`.
  - Configurar autenticação via token gerenciado no painel Cloudflare Zero Trust.
- [ ] **4.2. Roteamento de Subdomínio**
  - Apontar o túnel para o domínio público da API (ex: `api.seudominio.com`).
  - Redirecionar o tráfego interno diretamente para o container do FastAPI (`http://backend:8000`).
- [ ] **4.3. Camada de Proteção no Cloudflare Edge (WAF)**
  - Ativação de HTTPS obrigatório (TLS 1.3).
  - Rate limiting na Cloudflare para mitigar ataques de força bruta.
  - Regra de bloqueio geográfico ou regras de cabeçalho personalizadas se desejado.

**Critério de Conclusão da Fase 4:**  
A API responde com sucesso via HTTPS no subdomínio público com o roteador local com 100% das portas de entrada fechadas.

---

## Fase 6: Esteira CI/CD (GitHub Actions)
> **Objetivo:** Automação completa de testes, verificações de qualidade e publicação contínua sem esforço manual.

- [ ] **6.1. Workflow de Segurança (`.github/workflows/security.yml`)**
  - Execução de `gitleaks` a cada push/PR para barrar vazamento de segredos.
- [ ] **6.2. Workflow do Backend (`.github/workflows/backend.yml`)**
  - Setup Python -> Linter com `ruff` -> Testes com `pytest` (usando container temporário de PostgreSQL) -> Teste de build do `Dockerfile`.
- [ ] **6.3. Workflow do Frontend (`.github/workflows/frontend.yml`)**
  - Setup Node.js -> Linter e testes -> `ng build --configuration production` -> Deploy automático no **Cloudflare Pages** via action oficial com credenciais em GitHub Secrets.

**Critério de Conclusão da Fase 6:**  
Um commit na branch `main` dispara os testes automaticamente e atualiza o PWA no Cloudflare Pages em menos de 3 minutos, com zero intervenção manual.

---

## Fase 7: Hardening, Validação & Documentação de Portfólio
> **Objetivo:** Ajustes finais de performance, auditoria de segurança e consolidação do repositório como peça de destaque no portfólio.

- [ ] **7.1. Auditoria de Performance (Lighthouse)**
  - Metas do PWA: Score 90+ em Performance, Acessibilidade, Melhores Práticas e PWA.
- [ ] **7.2. Teste de Carga e Resiliência da Conexão**
  - Validar reconexão automática do Cloudflare Tunnel após reinicialização do Homelab ou queda de internet residencial.
- [ ] **7.3. README Executivo de Portfólio**
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
| **Backup Resiliente** | `pg_dump` + `age` + Cloudflare R2 | Custo zero (10 GB free), zero egress fee e criptografia ponta a ponta. |
| **Frontend PWA** | Angular + Signals + IndexedDB | Tipagem forte corporativa, reatividade nativa e funcionamento offline. |
| **Deploy Automatizado** | GitHub Actions + Cloudflare Pages | CI/CD profissional que comprova proficiência DevOps no portfólio. |
