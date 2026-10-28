# ClariFin — Gestão Financeira Pessoal com Precisão e Open Finance

> **Repositório:** [github.com/joao-vitor-hernandez/financeiro-pwa-local](https://github.com/joao-vitor-hernandez/financeiro-pwa-local)  
> **Autor:** João Vitor Hernandez (<jvhernandez.dev@gmail.com>)  
> **Status:** Produção Homelab & Cloudflare Edge  
> **Frontend:** [https://financeiro.entrefilas.com.br](https://financeiro.entrefilas.com.br)  
> **API:** [https://api-fin.entrefilas.com.br](https://api-fin.entrefilas.com.br)  

O **ClariFin** é um sistema completo de finanças pessoais desenvolvido com arquitetura híbrida (Local-First / Homelab), precisão decimal absoluta (`Decimal` / `NUMERIC(15, 2)`), integração Open Finance via Pluggy e interface PWA moderna inspirada em fintechs como Nubank e Wise.

---

## 🎨 Identidade Visual & Branding

Consulte as diretrizes de cores, degradê oficial (`#1DCDFE -> #21D0B2 -> #34F5C5`), tipografia **Montserrat** e especificações de ícones em:
👉 [**Documentação de Branding (docs/BRANDING.md)**](docs/BRANDING.md)

---

## 🛠️ Stack Tecnológica

### Backend (Core Contábil & APIs):
- **Python 3.12** com **FastAPI**
- **SQLAlchemy 2.0 (Async)** com driver **asyncpg**
- **PostgreSQL 16** com precisão `NUMERIC(15, 2)` e chaves primárias `UUIDv7`
- **Alembic** para migrações automatizadas
- **Pluggy Open Finance SDK** para sincronização bancária sob demanda e webhooks em tempo real
- **Autenticação Nativa:** PIN mestre de 6 dígitos criptografado com BCrypt (rounds=12) e bloqueio contra força bruta (5 tentativas / 15 min)

### Frontend (PWA & Client):
- **Angular 19+** com Standalone Components e Signals
- **Service Worker (`@angular/pwa`)** e cache offline com **Dexie (IndexedDB)**
- **Design System Sóbrio e Anti-IA:** Paleta Dark (Zinc 950/900/800), áreas táteis ergonômicas (44px+) e números com `tabular-nums`
- **Modo Privacidade:** Ocultamento instantâneo de valores (`R$ •••••`)

### Infraestrutura & Segurança:
- **Cloudflare Pages:** Hospedagem global com cache na borda para o frontend PWA
- **Cloudflare Tunnel (`cloudflared`):** Conexão criptografada de saída direta do Docker para a internet, mantendo 100% das portas do roteador residencial fechadas
- **Backups Criptografados:** Snapshots com criptografia assimétrica ponta a ponta via `age` enviados para o Cloudflare R2

---

## 📋 Roadmap de Engenharia
Consulte o status detalhado de todas as fases em [ROADMAP.md](ROADMAP.md).
