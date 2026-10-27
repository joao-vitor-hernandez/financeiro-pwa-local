# Especificação de Arquitetura e Engenharia: PWA de Finanças Pessoais

> **Status do Documento:** Versão 1.0 (Baseline do Projeto)  
> **Objetivo:** Documento histórico e guia técnico para concepção, desenvolvimento, segurança e infraestrutura do sistema financeiro pessoal e portfólio fullstack.

---

## 1. Visão Geral e Proposta de Valor

O projeto consiste em um **Progressive Web App (PWA)** de alta maturidade para gestão financeira pessoal com **custo operacional zero**, **privacidade rigorosa** e **arquitetura de nível corporativo**.

### Pilares Fundamentais:
1. **Controle Total e Privacidade:** O banco de dados e as regras de negócio residem exclusivamente no **Homelab local** do desenvolvedor. Nenhum dado sensível fica armazenado em servidores de terceiros desprotegidos.
2. **Impacto de Portfólio Fullstack:** Demonstra domínio em arquitetura distribuída, contabilidade prática (partidas dobradas, ciclos de cartão), PWA offline-first com Angular, pipelines de dados em Python, automação de CI/CD via GitHub Actions e segurança de rede com Cloudflare.
3. **Custo Zero:** Uso inteligente de camadas gratuitas (Free Tier):
   - **Cloudflare Pages:** Hospedagem global de alta performance do frontend.
   - **Cloudflare Tunnel (`cloudflared`):** Comunicação segura sem necessidade de IP fixo ou abertura de portas residenciais.
   - **Cloudflare R2:** 10 GB de armazenamento de objetos compatível com S3 para backups cifrados sem taxas de tráfego de saída (*zero egress fees*).
   - **Meu Pluggy:** Conexão Open Finance gratuita com bancos brasileiros.

---

## 2. Topologia de Rede e Arquitetura do Sistema

```
 [ Dispositivo do Usuário: Mobile / Desktop ]
                     │
                     ▼
  [ Cloudflare Pages: Angular PWA (Static Assets) ]
                     │
                     │ HTTPS + JWT / Bearer Token
                     ▼
       [ Cloudflare Edge / WAF ]
                     │
                     │ Túnel Criptografado (Sem portas abertas)
                     ▼
        [ Homelab: cloudflared ]
                     │
         Rede Interna Docker (Bridge)
         ├── [ Backend: Python FastAPI ]
         ├── [ Worker: Sincronização Pluggy + Regras ]
         ├── [ Database: PostgreSQL 16 ]
         └── [ Backup Agent: Dump + Age/GPG -> Cloudflare R2 ]
```

---

## 3. Decisões Técnicas e Stack Tecnológica

### 3.1. Frontend: Angular (TypeScript) + PWA
- **Por que Angular?** Tipagem estrita robusta, injeção de dependências nativa, excelente estrutura modular e suporte de primeiro nível a Progressive Web Apps (`@angular/pwa`).
- **Offline-First:** Uso de *Service Workers* para cache dos assets da aplicação e *IndexedDB* (via Dexie.js ou idb) para leitura rápida do histórico local quando sem conexão.
- **Modo Privacidade:** Toggle rápido na UI para mascarar cifras monetárias (`R$ •••••`).

### 3.2. Backend: Python (FastAPI)
- **Por que FastAPI?** Assíncrono nativo (ASGI), validação automática com Pydantic v2, geração de documentação OpenAPI/Swagger integrada e alta performance comparável a Go/Node.js.
- **Worker Assíncrono:** Módulo dedicado para agendamento (APScheduler ou Celery/Redis leve) para disparar rotinas de coleta do Open Finance e rotinas de backup.

### 3.3. Banco de Dados: PostgreSQL (vs. MySQL)
> **Decisão Arquitetural:** O projeto adota **PostgreSQL** pelas seguintes vantagens cruciais sobre o MySQL para sistemas contábeis:
1. **JSONB Nativo:** Permite armazenar o payload bruto retornado pela API da Pluggy para auditoria sem alterar o esquema relacional fixo.
2. **UUIDs Nativos:** Melhor geração de chaves primárias seguras para sincronização offline.
3. **Restrições Estritas e Índices Parciais:** Confiabilidade contábil impecável em verificações de saldos e transações duplicadas.
4. **Maturidade de Backup:** Facilidade para scripts de snapshot (`pg_dump`) atômicos e consistentes.

### 3.4. Backups Criptografados: Cloudflare R2
- **Por que Cloudflare R2 e não Google Drive?**
  - O Google Drive requer fluxos OAuth complexos de usuário (com renovação de *refresh tokens* que costumam expirar ou exigir intervenção humana).
  - O **Cloudflare R2** possui API 100% compatível com Amazon S3, oferece **10 GB gratuitos perpétuos** e **zero taxa de tráfego de saída**.
  - O processo de backup utiliza ferramentas padronizadas de linha de comando (`rclone` ou `awscli`) de forma totalmente autônoma.
- **Criptografia Zero-Knowledge:** O dump do banco (`pg_dump`) é comprimido e criptografado localmente com chave simétrica/assimétrica via **`age`** ou **`gpg`** *antes* de ser enviado ao bucket. O bucket armazena apenas arquivos binários ilegíveis sem a sua chave mestra.

---

## 4. Política de Segurança e Prevenção de Vazamento de Dados

Como o código será versionado no GitHub e executado em Homelab pessoal, a blindagem contra vazamento de segredos é prioridade máxima:

### 4.1. Camadas de Proteção
1. **Isolamento de Credenciais:** Nenhuma chave de API (Pluggy, Cloudflare, JWT Secret, senhas de DB) é inserida em código-fonte.
2. **Gestão de Variáveis de Ambiente:**
   - No ambiente local: arquivos `.env` estritamente ignorados pelo Git.
   - Fornecimento de arquivo modelo: `.env.example` contendo apenas chaves vazias e comentários.
3. **Varredura Preventiva de Segredos (Gitleaks):**
   - Configuração de *pre-commit hooks* locais para barrar commits contendo padrões de chaves/tokens.
   - GitHub Action automatizada que escaneia cada Pull Request/Push em busca de segredos acidentais.

### 4.2. Estrutura Padrão do `.gitignore`
```gitignore
# Arquivos de ambiente e segredos
.env
.env.*
!.env.example
*.pem
*.key
*.cert
*.crt
cloudflared-cert.json
credentials.json

# Banco de dados e Backups
*.sql
*.sql.gz
*.sql.age
*.dump
postgres-data/
backups/

# Python
__pycache__/
*.py[cod]
*$py.class
.venv/
venv/
.pytest_cache/
.coverage
htmlcov/

# Angular / Node
node_modules/
dist/
.angular/
coverage/

# IDEs e Sistema
.vscode/
.idea/
.DS_Store
Thumbs.db
```

---

## 5. Estratégia de CI/CD com GitHub Actions

O **GitHub Actions** automatizará testes de qualidade e a publicação do frontend, garantindo que o portfólio demonstre maturidade em DevOps.

### 5.1. O que é o GitHub Actions?
É uma plataforma de automação integrada ao GitHub que roda tarefas em contêineres na nuvem sempre que um evento acontece no repositório (ex: um `git push` na branch `main` ou abertura de um Pull Request).

### 5.2. Workflows Planejados

#### A. Frontend CI/CD (`.github/workflows/frontend.yml`)
- **Gatilho:** `push` na branch `main` com alterações em `frontend/**`.
- **Etapas:**
  1. *Checkout* do repositório.
  2. Instalação do Node.js e dependências via `npm ci`.
  3. Validação de linting e formatação (`npm run lint`).
  4. Execução de testes unitários (`npm run test -- --watch=false --browsers=ChromeHeadless`).
  5. Compilação de produção (`npm run build --configuration production`).
  6. **Deploy Direto no Cloudflare Pages:** Utiliza a action oficial da Cloudflare (`cloudflare/pages-action` ou `wrangler`) para publicar o diretório `dist/` usando credenciais configuradas com segurança nos **GitHub Secrets**.

#### B. Backend CI (`.github/workflows/backend.yml`)
- **Gatilho:** `push` na branch `main` ou Pull Requests com alterações em `backend/**`.
- **Etapas:**
  1. *Checkout* do repositório.
  2. Setup do Python.
  3. Linting e verificação de estilo com `ruff` e formatação com `black`.
  4. Execução de testes com `pytest` (instanciando um serviço efêmero de PostgreSQL na nuvem do GitHub Actions para testar queries e regras contábeis reais).
  5. Teste de build da imagem Docker (`docker build`) para garantir que o contêiner do Homelab nunca quebre ao atualizar.

#### C. Secret Scanning (`.github/workflows/security.yml`)
- Execução do `gitleaks-action` em todos os branches para garantir que nenhum token ou informação privada seja aceita no histórico do repositório.

---

## 6. Modelo Contábil e Regras de Negócio

### 6.1. Tipos de Conta e Comportamentos
- **Conta Corrente / Dinheiro:** Impacto imediato no saldo líquido disponível.
- **Cartão de Crédito:**
  - Possui `dia_fechamento` (corte) e `dia_vencimento`.
  - Gastos feitos antes do fechamento caem na fatura do mês atual.
  - Gastos após o fechamento caem na fatura do mês subsequente.
  - Não reduzem o saldo em conta imediatamente; alimentam o passivo da fatura aberta.
- **Contas de Investimento / Reserva:** Acompanhamento de patrimônio líquido com rentabilidade calculada.

### 6.2. Compras Parceladas
- Ao lançar uma compra parcelada de $R\$ X$ em $N$ vezes:
  - O sistema gera $N$ transações vinculadas às faturas correspondentes dos meses subsequentes.
  - Campos de rastreamento: `installment_number` (ex: 3) e `total_installments` (ex: 10).

### 6.3. Transferências Neutras (Partidas Dobradas)
- Uma movimentação entre contas próprias (ex: da Conta Corrente para a Caixinha Nubank) é registrada com status `is_transfer = true`:
  - Não computa como "Despesa" na conta de origem nem como "Receita" na de destino.
  - Não distorce os gráficos de fluxo de caixa e relatórios mensais.

### 6.4. Pipeline de Sincronização Pluggy (Open Finance)
1. **Poller Agendado:** Roda a cada $X$ horas consultando novos lançamentos da API Pluggy.
2. **Idempotência Rigorosa:** A tabela de transações possui chave única composta:
   ```sql
   UNIQUE (account_id, external_id, transaction_date, amount);
   ```
   No PostgreSQL, as inserções aplicam `ON CONFLICT DO UPDATE` para atualizar descrições que mudaram de "pendente" para "processado".
3. **Motor Determinístico de Categorização (Regex):**
   - Transforma nomes sujos de estabelecimentos em termos limpos (ex: `UBER* PENDING 123` $\to$ `Uber`).
   - Atribui categoria automaticamente baseando-se em dicionário de regras regex definido pelo usuário.
   - Detecta transferências entre contas do mesmo CPF (auto-atribuição de transferência).

---

## 7. Roteiro de Execução (Roadmap em Fases)

| Fase | Título | Entregas Principais |
|---|---|---|
| **Fase 0** | **Fundação do Repositório & Segurança** | Configuração do `.gitignore`, `.env.example`, pre-commit hooks, estrutura de pastas limpa (monorepo com `frontend/`, `backend/`, `deploy/`). |
| **Fase 1** | **Infraestrutura Local (Homelab) & Banco** | `docker-compose.yml` com PostgreSQL 16 e FastAPI inicial; script de backup com criptografia (`age` + `rclone` -> Cloudflare R2). |
| **Fase 2** | **Core do Backend & Modelagem Contábil** | Schemas e Migrations (SQLAlchemy 2.0 / Alembic); endpoints CRUD de contas, categorias e transações; lógica de parcelamento e faturas de cartão. |
| **Fase 3** | **Open Finance (Worker Pluggy) & Regras** | Worker de ingestão assíncrona; prevenção de duplicatas; motor de regras regex determinístico. |
| **Fase 4** | **Exposição Segura (Cloudflare Tunnel)** | Configuração do `cloudflared` no Homelab conectando com a API sem abrir portas do roteador. |
| **Fase 5** | **Frontend Angular PWA** | Estruturação de componentes no Angular; Dashboard (cards de saldo, gráficos de fluxo e rosca de categorias); Modo Privacidade; Quick-Add; Service Workers e IndexedDB para modo offline. |
| **Fase 6** | **Esteira CI/CD (GitHub Actions)** | Workflows de lint, testes automatizados e deploy automático do frontend no Cloudflare Pages. |

---

## 8. Glossário e Links de Referência
- **Cloudflare Tunnel Docs:** [developers.cloudflare.com/cloudflare-one/connections/connect-networks](https://developers.cloudflare.com/cloudflare-one/connections/connect-networks/)
- **Cloudflare R2 Docs:** [developers.cloudflare.com/r2](https://developers.cloudflare.com/r2/)
- **Pluggy Developer Docs:** [docs.pluggy.ai](https://docs.pluggy.ai)
- **Age Encryption Tool:** [github.com/FiloSottile/age](https://github.com/FiloSottile/age)
