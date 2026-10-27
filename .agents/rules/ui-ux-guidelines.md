# Diretrizes de UI/UX e Design Anti-IA

Diretrizes obrigatórias para o frontend Angular PWA para evitar o visual genérico, artificial e clichê de interfaces geradas por inteligência artificial.

## 1. O que é Proibido (Padrões Clichês de IA)
- **Gradientes Roxo / Neon:** Proibido o uso de gradientes como `from-purple-600 to-indigo-600` ou acentos fluorescentes despropositados.
- **Cards Aninhados Excessivos:** Não crie cards dentro de cards com múltiplas bordas e sombras concorrentes.
- **Complexidade Vazia de Dashboards:** Não preencha a tela com gráficos circulares (pie charts) ou dados irrelevantes apenas para "decorar".
- **Botões Minúsculos:** Proibido colocar botões menores que 44x44 pixels em elementos de toque interativos.

## 2. Princípios de Design Humano e Sóbrio
- **Inspiração:** Interfaces minimalistas, utilitárias e refinadas (referências: **Linear, Wise, Nubank, Vercel**).
- **Tipografia:** Fonte limpa e neutra (`Inter`, `Geist` ou fonte sans do sistema). Hierarquia tipográfica evidente por tamanho e peso (600 para títulos, 400 para corpo, tabular figures `font-variant-numeric: tabular-nums` para números e moedas).
- **Paleta de Cores Contábil:**
  - Fundo claro limpo ou Dark Mode sóbrio (tons de `zinc` / `slate`, ex: `#09090b` para o dark).
  - Verde contábil discreto (entradas / receitas): ex: Emerald `#059669`.
  - Vermelho contábil discreto (saídas / despesas): ex: Rose `#e11d48`.
  - Acentos primários neutros e elegantes (preto/branco ou azul marinho discreto).

## 3. Ergonomia Mobile-First (PWA)
- **Operação com uma Mão (Polegar):**
  - Navegação principal posicionada na parte inferior da tela (*Bottom Navigation Bar*).
  - Ações rápidas (como adicionar transação) devem abrir em gavetas que deslizam de baixo para cima (*Bottom Sheets*), e não modais flutuantes centralizados que exigem alcançar o topo da tela.
- **Teclado Otimizado:**
  - Campos de entrada monetária devem acionar o teclado numérico do smartphone (`inputmode="decimal"` ou `inputmode="numeric"`).
- **Modo Privacidade:**
  - O aplicativo deve ter um botão no header para ofuscar instantaneamente todos os valores monetários (`R$ •••••`), permitindo uso seguro em locais públicos.

## 4. Estados de Interface Obrigatórios
- **Empty States:** Toda lista ou tabela deve conter um estado vazio desenhado com carinho e instrução amigável de como adicionar o primeiro item.
- **Loading Skeletons:** Ao carregar dados da API, utilize esqueletos de carregamento sutis com animação de pulso, nunca spinners genéricos que travam a tela.
- **Feedback Háptico e Transições:** Transições suaves de 150ms a 200ms para cliques e aberturas de drawer.
