# Diretrizes de Arquitetura de Software e Clean Code

Estas regras orientam a organização estrutural do projeto para evitar complexidade desnecessária e overengineering.

## 1. Princípios Gerais
- **Pragmatismo sobre Dogmatismo:** Escreva código simples, legível e direto. Não crie camadas de abstração sem necessidade comprovada (evite DTOs duplicados, factories vazias ou padrões de design forçados).
- **Separação Estrita de Responsabilidades:**
  - `routers/`: Tratam requisições HTTP, cabeçalhos, status codes e chamam services. Não contêm lógica de negócio.
  - `services/`: Contêm 100% das regras de negócio, cálculos contábeis e orquestração de dados. Não dependem de objetos `Request` ou `Response` do FastAPI.
  - `models/`: Mapeamento relacional SQLAlchemy 2.0 (tabelas e relacionamentos).
  - `schemas/`: Contratos de dados de entrada e saída validados com Pydantic v2.
  - `core/`: Configurações de ambiente, segurança e banco de dados.

## 2. Frontend Angular (PWA Moderno)
- **Standalone Components:** Todos os componentes devem ser Standalone (`standalone: true`). Não use `NgModule`.
- **Reatividade com Signals:** Priorize Angular Signals (`signal`, `computed`, `effect`) sobre `BehaviorSubject`/RxJS complexo para gerenciamento de estado local.
- **Smart vs. Dumb Components:**
  - Componentes de Página (Smart): Injetam services, chamam a API e gerenciam estado.
  - Componentes de Apresentação (Dumb): Recebem dados via `input()` e emitem ações via `output()`.
- **Tipagem Forte:** Proibido o uso de `any`. Toda resposta da API deve possuir uma interface TypeScript correspondente.

## 3. Testabilidade
- Toda regra de negócio em `services/` deve ser coberta por testes unitários independentes com `pytest`.
- Testes devem usar banco de dados SQLite em memória ou PostgreSQL de teste em container, nunca o banco de dados principal.
