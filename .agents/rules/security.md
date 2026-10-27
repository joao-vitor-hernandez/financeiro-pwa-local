# Regras de Segurança e Blindagem contra Vazamento de Dados

Estas regras são de cumprimento obrigatório em todas as gerações de código e operações de terminal neste projeto.

## 1. Zero Credenciais em Código (No Hardcoded Secrets)
- NUNCA inclua senhas, tokens de API, chaves privadas, segredos JWT ou certificados no código-fonte.
- Todas as variáveis sensíveis DEVEM ser consumidas via variáveis de ambiente (`os.environ` ou `pydantic-settings` no Python).
- Qualquer exemplo de código deve usar valores falsos claramente demarcados (ex: `exemplo_chave_falsa_123`).

## 2. Proteção contra SQL Injection e Injeção de Comandos
- NUNCA use concatenação de strings ou f-strings para construir queries SQL.
- Sempre use mapeamento ORM via SQLAlchemy 2.0 ou queries parametrizadas com bind variables.
- NUNCA execute comandos de shell com entrada do usuário não sanitizada (`subprocess` com `shell=True` é proibido).

## 3. Higienização e Sanitização de Entradas
- Todos os payloads de entrada na API devem ser validados estritamente com schemas Pydantic v2.
- Regex utilizadas no motor de categorização devem ter proteção contra ReDoS (Regular Expression Denial of Service).

## 4. Comunicação Segura
- Cookies devem sempre usar as flags: `HttpOnly`, `Secure` e `SameSite=Lax` ou `Strict`.
- Cabeçalhos de segurança (CORS restritivo, CSP, HSTS, X-Content-Type-Options) devem ser aplicados na API.
