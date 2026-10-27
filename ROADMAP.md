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

- [ ] **1.1. Orquestração Local (`deploy/docker-compose.yml`)**
  - Serviço `postgres:16-alpine` com volume persistente local.
  - Rede Docker interna isolada (`finance_internal_net`).
  - Variáveis de conexão consumindo o `.env` local.
- [ ] **1.2. Padrões de Precisão Numérica e Identificadores**
  - Valores monetários modelados estritamente como `NUMERIC(15, 2)` (precisão de 15 dígitos com 2 casas decimais, suportando até trilhões de reais sem erro de arredondamento).
  - Identificadores e contadores modelados com `BIGINT` ou `UUIDv7` (ordenável por tempo, ideal para sincronização).
- [ ] **1.3. Pipeline de Backup Criptografado (Zero-Knowledge)**
  - Script autônomo de snapshot (`pg_dump`).
  - Criptografia local assimétrica via **`age`** (chave pública no servidor, chave privada mantida em local seguro offline).
  - Sincronização via `rclone` para o bucket do **Cloudflare R2** (10 GB Free Tier).
- [ ] **1.4. Teste de Disaster Recovery**
  - Simular desastre: derrubar o banco, baixar o arquivo `.age` do R2, descriptografar com a chave privada e restaurar o banco com sucesso.

**Critério de Conclusão da Fase 1:**  
PostgreSQL rodando no Docker; backup gerado, criptografado, enviado ao Cloudflare R2 e restauração validada sem perda de dados.

---

## Fase 2: Domínio Contábil & Core da API (FastAPI)
> **Objetivo:** Desenvolver o núcleo contábil em Python utilizando FastAPI, SQLAlchemy 2.0 e Pydantic v2 com precisão decimal absoluta e testes unitários.

- [ ] **2.1. Setup do Projeto Backend**
  - Estrutura modular: `app/routers/`, `app/services/`, `app/models/`, `app/schemas/`, `app/core/`.
  - Configuração do SQLAlchemy 2.0 com conexões assíncronas (`asyncpg`).
  - Migrações automáticas configuradas via Alembic.
- [ ] **2.2. Modelagem das Entidades Financeiras**
  - `Account`: Contas bancárias, carteiras e cartões de crédito.
  - `Category` e `Subcategory`: Árvore de classificação de despesas e receitas.
  - `Transaction`: Lançamentos com valor em `Decimal`, data, tipo, flag de transferência e metadados.
  - `CreditCardBill`: Ciclos de fatura (data de fechamento, data de vencimento, status: aberta/fechada/paga).
- [ ] **2.3. Regras de Negócio e Cálculos Contábeis (Services)**
  - **Uso estrito de `decimal.Decimal`:** Todas as operações matemáticas aplicam `ROUND_HALF_EVEN` (arredondamento bancário).
  - **Distribuição de Parcelas:** Algoritmo de divisão que garante a conservação exata dos centavos (ex: R$ 100,00 em 3x = R$ 33,34 + R$ 33,33 + R$ 33,33).
  - **Ciclo de Cartão de Crédito:** Lançamentos após o dia de corte são alocados automaticamente na fatura subsequente.
  - **Transferências Neutras (Partidas Dobradas):** Débito em uma conta e crédito em outra sem impacto no saldo geral de receitas/despesas.
- [ ] **2.4. Endpoints REST & Validação com Pydantic v2**
  - CRUD completo de contas, categorias e transações.
  - Endpoints de resumo consolidado (saldo atual, faturas em aberto, fluxo mensal).
- [ ] **2.5. Suíte de Testes Automatizados (`pytest`)**
  - Testes unitários com banco de dados de teste validando integridade matemática, divisões de parcelas e transações entre contas.

**Critério de Conclusão da Fase 2:**  
100% dos testes unitários de regras contábeis passando no `pytest`; zero divergência de centavos nas contas.

---

## Fase 3: Motor de Regras & Integração Open Finance (Pluggy)
> **Objetivo:** Ingestão de dados bancários reais sem duplicatas e motor de categorização determinístico baseado em expressões regulares (Regex).

- [ ] **3.1. Cliente de Integração Pluggy**
  - Comunicação assíncrona com os endpoints da Pluggy (`/auth`, `/accounts`, `/transactions`).
  - Armazenamento seguro dos IDs de conectores e itens.
- [ ] **3.2. Idempotência e Prevenção de Duplicatas**
  - Restrição única no PostgreSQL:
    `UNIQUE (account_id, external_id, transaction_date, amount)`
  - Lógica de `UPSERT` para lidar com transações cujo status muda de "pendente" para "processado".
- [ ] **3.3. Motor de Regras Determinístico (Rule Engine)**
  - Tabela `categorization_rules` (padrão regex, prioridade, categoria alvo).
  - Sanitizador de descrições (ex: `PAG*JoseLanches 123` -> `José Lanches`).
  - Auto-identificação de transferências entre contas próprias cadastradas.
- [ ] **3.4. Worker de Sincronização em Segundo Plano**
  - Agendador assíncrono (APScheduler) executando a cada 12/24 horas.

**Critério de Conclusão da Fase 3:**  
Simulação de ingestão de extrato bancário categoriza transações conhecidas e ignora duplicatas sem gerar erro ou alterar saldos indevidamente.

---

## Fase 4: Exposição Segura (Cloudflare Tunnel)
> **Objetivo:** Expor a API do Homelab para a internet pública com conexão criptografada de saída, sem abrir portas no roteador residencial.

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

## Fase 5: Frontend Angular PWA (Design Anti-IA & Offline-First)
> **Objetivo:** Construir uma interface agradável, rápida, pensada para usabilidade em smartphone, sem aparência genérica de template de IA.

- [ ] **5.1. Setup do Angular Moderno**
  - Angular CLI com TypeScript estrito, Standalone Components e Signals.
  - Adição do pacote `@angular/pwa` (Service Worker e `manifest.webmanifest`).
- [ ] **5.2. Design System Sóbrio e Humano**
  - Paleta neutra (tons de zinc/slate) com acentos semafóricos discretos (verde/vermelho contábeis).
  - Tipografia limpa e legível (Inter/Geist) com hierarquia visual clara.
  - Sem gradientes roxo/neon clichês ou cards hiper-aninhados.
  - Ergonomia mobile: botões e áreas de toque com mínimo de 44x44px; navegação inferior (*Bottom Navigation*).
- [ ] **5.3. Funcionalidades Chave da Interface**
  - **Cards Executivos:** Saldo líquido, fatura aberta e previsão até o fim do mês.
  - **Modo Privacidade:** Botão de alternância instantânea para ofuscar valores (`R$ •••••`) em ambientes públicos.
  - **Lançamento Rápido (*Quick Add*):** Gaveta que sobe de baixo (*bottom sheet*) exigindo apenas Valor e Categoria para inputs em 3 segundos.
  - **Extrato Inteligente:** Filtros por conta, categoria e mês com visualização clara de parcelas (ex: "Parcela 3 de 10").
- [ ] **5.4. Operação Offline e Cache (IndexedDB)**
  - Armazenamento local do último estado financeiro no IndexedDB.
  - O app abre instantaneamente no celular mesmo em modo avião ou sem sinal 4G.

**Critério de Conclusão da Fase 5:**  
PWA instalável no celular (iOS/Android) via navegador; interface ágil, fluida, operando com modo privacidade e cache offline validado.

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
