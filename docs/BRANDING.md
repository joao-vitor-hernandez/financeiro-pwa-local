# Identidade Visual & Branding: ClariFin

Documentação oficial da identidade visual do **ClariFin**, definindo a logo vetorial/rasterizada no degradê financeiro moderno, especificações de cor, ícones para PWA e tipografia.

---

## 1. Logo Oficial & Ícone de Aplicação

A identidade do ClariFin une a solidez da gestão contábil (gráfico de barras e precisão percentual) à proximidade humana (mão de suporte).

- **Logo Principal (Degradê Transparente):** Localizada em [`frontend/public/logo.png`](../frontend/public/logo.png).
- **Ícone do App PWA (Dark Canvas):** Localizado em [`frontend/public/icons/icon-512x512.png`](../frontend/public/icons/icon-512x512.png).

---

## 2. Paleta do Degradê Oficial

A marca utiliza uma transição contínua em ângulo diagonal de 135º (do topo esquerdo à base direita), representando crescimento e equilíbrio:

| Etapa | Hex Code | RGB | Cor | Significado & Aplicação |
|---|---|---|---|---|
| **Início** | `#1DCDFE` | `rgb(29, 205, 254)` | **Cyan / Sky Blue** | Clareza, tecnologia e leveza. Aplicado no topo do gráfico e contornos superiores. |
| **Transição** | `#21D0B2` | `rgb(33, 208, 178)` | **Teal / Turquesa** | Equilíbrio, precisão e estabilidade. Centro das barras e elementos estruturais. |
| **Fim** | `#34F5C5` | `rgb(52, 245, 197)` | **Mint / Seafoam** | Prosperidade, saúde financeira e energia. Base e indicador percentual. |

### CSS Variables Oficial:
```css
:root {
  --brand-gradient: linear-gradient(135deg, #1DCDFE 0%, #21D0B2 50%, #34F5C5 100%);
  --brand-color-1: #1DCDFE;
  --brand-color-2: #21D0B2;
  --brand-color-3: #34F5C5;
  --font-brand: 'Montserrat', sans-serif;
}
```

---

## 3. Tipografia Oficial: Montserrat

- **Família:** `Montserrat` (Google Fonts).
- **Pesos Utilizados:**
  - `800 (ExtraBold)`: Título de impacto da marca (`brand-title` na tela de PIN/Login).
  - `700 (Bold)`: Logo textual no Header (`ClariFin`) e títulos de métricas.
  - `600 (SemiBold)`: Subtítulos e botões de ação primária.
  - `500 (Medium)` e `400 (Regular)`: Rótulos de formulário e textos de navegação.
- **Precisão Numérica:** Valores monetários utilizam obrigatoriamente `font-variant-numeric: tabular-nums` para alinhamento vertical perfeito de centavos e dígitos.

---

## 4. Estrutura de Ativos Multiplataforma

### Aba do Navegador (Favicons):
- `frontend/public/favicon.ico`: Formato universal multi-resolução com camadas de 16x16, 32x32 e 48x48.
- `frontend/public/favicon-32x32.png`: Renderização nítida para navegadores modernos em abas claras ou escuras.
- `frontend/public/favicon-16x16.png`: Favicon compacto para visualização em modo lista de abas.

### Instalação Mobile (PWA Android & iOS):
- **iOS Safari:** `frontend/public/apple-touch-icon.png` (180x180) para ícones na tela de início do iPhone e iPad.
- **Android & Chrome:** Ícones com `purpose: "maskable any"` cobrindo todas as densidades de tela do Android:
  - `icon-72x72.png` (ldpi)
  - `icon-96x96.png` (mdpi)
  - `icon-128x128.png` (tvdpi)
  - `icon-144x144.png` (hdpi)
  - `icon-152x152.png` (pad)
  - `icon-192x192.png` (xhdpi)
  - `icon-384x384.png` (xxhdpi)
  - `icon-512x512.png` (xxxhdpi & splash screen)
- **Safe Area:** Todos os ícones do PWA possuem padding de 22% sobre fundo escuro `#09090b`, garantindo que o ícone nunca seja cortado por máscaras redondas ou quadradas do Android.

### Script de Automação de Ativos:
Os ativos podem ser regenerados a qualquer momento pelo script:
```bash
python backend/scripts/generate_branding.py
```
