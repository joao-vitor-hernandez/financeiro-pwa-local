import {
  Component,
  computed,
  ElementRef,
  input,
  signal,
  viewChild,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { PrivacyCurrencyPipe } from '../../../core/pipes/privacy-currency.pipe';
import { IconComponent } from '../icon/icon.component';
import { SavingsPoint } from '../../../core/models/savings-evolution.model';

export type ChartViewMode = 'all' | 'total' | 'lines';

interface ScaledPoint {
  x: number;
  yTotal: number;
  yChecking: number;
  ySavings: number;
  yInvestment: number;
  raw: SavingsPoint;
}

@Component({
  selector: 'app-savings-evolution-chart',
  standalone: true,
  imports: [CommonModule, PrivacyCurrencyPipe, IconComponent],
  template: `
    <div class="savings-chart-wrapper">
      <!-- Cabeçalho Executivo do Painel de Patrimônio -->
      <div class="chart-header">
        <div class="header-left">
          <div class="title-wrap">
            <span class="chart-title">Evolução do Dinheiro Guardado</span>
            <span class="period-tag">{{ period() }}</span>
          </div>
          <p class="chart-subtitle">
            Crescimento consolidado e divisão entre conta, cofrinhos e investimentos
          </p>

          <div class="balance-display">
            <span class="current-balance currency-val tabular-nums">
              {{ currentTotalValue() | privacyCurrency }}
            </span>
            @if (growthPercentage() !== null) {
              <div
                class="growth-badge"
                [class.positive]="(growthPercentage() ?? 0) >= 0"
                [class.negative]="(growthPercentage() ?? 0) < 0"
              >
                <app-icon
                  [name]="(growthPercentage() ?? 0) >= 0 ? 'arrow-up-right' : 'arrow-down-left'"
                  [size]="13"
                />
                <span>{{ (growthPercentage() ?? 0) >= 0 ? '+' : '' }}{{ growthPercentage() }}%</span>
                @if (growthAmount() !== null) {
                  <span class="growth-amount tabular-nums">
                    ({{ (growthPercentage() ?? 0) >= 0 ? '+' : '' }}{{ growthAmount() | privacyCurrency }})
                  </span>
                }
              </div>
            }
          </div>
        </div>

        <!-- Seletor de Modo de Visualização (Geral Total vs Por Linhas vs Todas) -->
        <div class="header-right">
          <div class="view-mode-tabs" role="tablist">
            <button
              type="button"
              class="tab-btn"
              [class.active]="viewMode() === 'all'"
              (click)="setViewMode('all')"
              title="Exibir Total Consolidado e linhas separadas"
            >
              Visão Completa
            </button>
            <button
              type="button"
              class="tab-btn"
              [class.active]="viewMode() === 'total'"
              (click)="setViewMode('total')"
              title="Focar apenas no valor total acumulado"
            >
              Total Geral
            </button>
            <button
              type="button"
              class="tab-btn"
              [class.active]="viewMode() === 'lines'"
              (click)="setViewMode('lines')"
              title="Comparar as linhas individuais de cada área"
            >
              Linhas Separadas
            </button>
          </div>
        </div>
      </div>

      <!-- Container SVG do Gráfico -->
      <div
        #svgContainer
        class="chart-canvas-container"
        (mousemove)="onMouseMove($event)"
        (mouseleave)="onMouseLeave()"
        (touchmove)="onTouchMove($event)"
        (touchend)="onMouseLeave()"
      >
        <svg
          [attr.viewBox]="'0 0 ' + svgWidth + ' ' + svgHeight"
          class="savings-svg"
          preserveAspectRatio="none"
        >
          <defs>
            <!-- Gradiente de Preenchimento da Área do Total -->
            <linearGradient id="totalAreaGrad" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stop-color="#34F5C5" stop-opacity="0.22" />
              <stop offset="80%" stop-color="#21D0B2" stop-opacity="0.04" />
              <stop offset="100%" stop-color="#1DCDFE" stop-opacity="0.00" />
            </linearGradient>

            <!-- Gradiente da Linha do Total ClariFin -->
            <linearGradient id="totalLineGrad" x1="0" y1="0" x2="1" y2="0">
              <stop offset="0%" stop-color="#1DCDFE" />
              <stop offset="50%" stop-color="#21D0B2" />
              <stop offset="100%" stop-color="#34F5C5" />
            </linearGradient>
          </defs>

          <!-- Linhas de Grade Cartesianas e Eixo Y -->
          @for (grid of yGridLines(); track grid.val) {
            <line
              [attr.x1]="paddingLeft"
              [attr.y1]="grid.y"
              [attr.x2]="svgWidth - paddingRight"
              [attr.y2]="grid.y"
              class="grid-line"
            />
            <text
              [attr.x]="paddingLeft - 8"
              [attr.y]="grid.y + 4"
              text-anchor="end"
              class="grid-label"
            >
              {{ grid.label }}
            </text>
          }

          <!-- Linha Base do Eixo X -->
          <line
            [attr.x1]="paddingLeft"
            [attr.y1]="zeroY"
            [attr.x2]="svgWidth - paddingRight"
            [attr.y2]="zeroY"
            class="axis-base-line"
          />

          <!-- Área sob a curva do Total (se ativa) -->
          @if (isTotalVisible() && totalAreaPath()) {
            <path
              [attr.d]="totalAreaPath()"
              fill="url(#totalAreaGrad)"
              class="area-total"
            />
          }

          <!-- Curvas Suaves (Splines) -->
          <!-- 1. Linha: Dinheiro na Conta Parado -->
          @if (isCheckingVisible() && checkingPath()) {
            <path
              [attr.d]="checkingPath()"
              fill="none"
              stroke="#38bdf8"
              stroke-width="2"
              class="line-curve checking-line"
            />
          }

          <!-- 2. Linha: Cofrinhos (Mercado Pago, Caixinhas) -->
          @if (isSavingsVisible() && savingsPath()) {
            <path
              [attr.d]="savingsPath()"
              fill="none"
              stroke="#21D0B2"
              stroke-width="2"
              class="line-curve savings-line"
            />
          }

          <!-- 3. Linha: Investido (Aplicações, Renda Fixa/Ações) -->
          @if (isInvestmentVisible() && investmentPath()) {
            <path
              [attr.d]="investmentPath()"
              fill="none"
              stroke="#1DCDFE"
              stroke-width="2"
              class="line-curve investment-line"
            />
          }

          <!-- 4. Linha Principal: Total Consolidado -->
          @if (isTotalVisible() && totalPath()) {
            <path
              [attr.d]="totalPath()"
              fill="none"
              stroke="url(#totalLineGrad)"
              stroke-width="3"
              class="line-curve total-line"
            />
          }

          <!-- Rótulos do Eixo X (Meses) -->
          @for (pt of scaledPoints(); track pt.raw.date) {
            <text
              [attr.x]="pt.x"
              [attr.y]="svgHeight - 10"
              text-anchor="middle"
              class="axis-x-label"
              [class.highlight]="hoveredIndex() === $index"
            >
              {{ pt.raw.label }}
            </text>
          }

          <!-- Linha Vertical do Cursor Interativo (Hover / Touch) -->
          @if (hoveredPoint(); as activePt) {
            <line
              [attr.x1]="activePt.x"
              [attr.y1]="paddingTop"
              [attr.x2]="activePt.x"
              [attr.y2]="zeroY"
              class="cursor-guide-line"
            />

            <!-- Dots de destaque nos pontos ativos -->
            @if (isCheckingVisible()) {
              <circle
                [attr.cx]="activePt.x"
                [attr.cy]="activePt.yChecking"
                r="4.5"
                fill="#38bdf8"
                class="hover-dot"
              />
            }
            @if (isSavingsVisible()) {
              <circle
                [attr.cx]="activePt.x"
                [attr.cy]="activePt.ySavings"
                r="4.5"
                fill="#21D0B2"
                class="hover-dot"
              />
            }
            @if (isInvestmentVisible()) {
              <circle
                [attr.cx]="activePt.x"
                [attr.cy]="activePt.yInvestment"
                r="4.5"
                fill="#1DCDFE"
                class="hover-dot"
              />
            }
            @if (isTotalVisible()) {
              <circle
                [attr.cx]="activePt.x"
                [attr.cy]="activePt.yTotal"
                r="5.5"
                fill="#34F5C5"
                class="hover-dot total-dot"
              />
            }
          }
        </svg>

        <!-- Tooltip Flutuante Interativo (shadcn ChartTooltip Content) -->
        @if (hoveredPoint(); as activePt) {
          <div
            class="chart-floating-tooltip"
            [style.left.px]="tooltipLeft()"
            [style.top.px]="tooltipTop()"
          >
            <div class="tooltip-header">
              <span class="tooltip-date">{{ activePt.raw.label }} / {{ activePt.raw.date }}</span>
              <span class="tooltip-total-badge currency-val tabular-nums">
                {{ activePt.raw.total | privacyCurrency }}
              </span>
            </div>

            <div class="tooltip-body">
              @if (isCheckingVisible()) {
                <div class="tooltip-row">
                  <div class="row-label">
                    <span class="dot-indicator" style="background-color: #38bdf8;"></span>
                    <span>Conta Parado</span>
                  </div>
                  <span class="row-val tabular-nums">{{ activePt.raw.checking | privacyCurrency }}</span>
                </div>
              }

              @if (isSavingsVisible()) {
                <div class="tooltip-row">
                  <div class="row-label">
                    <span class="dot-indicator" style="background-color: #21D0B2;"></span>
                    <span>Cofrinhos</span>
                  </div>
                  <span class="row-val tabular-nums">{{ activePt.raw.savings | privacyCurrency }}</span>
                </div>
              }

              @if (isInvestmentVisible()) {
                <div class="tooltip-row">
                  <div class="row-label">
                    <span class="dot-indicator" style="background-color: #1DCDFE;"></span>
                    <span>Investido</span>
                  </div>
                  <span class="row-val tabular-nums">{{ activePt.raw.investment | privacyCurrency }}</span>
                </div>
              }

              @if (isTotalVisible() && viewMode() === 'all') {
                <div class="tooltip-row total-row">
                  <div class="row-label">
                    <span class="dot-indicator" style="background-color: #34F5C5;"></span>
                    <span>Total Guardado</span>
                  </div>
                  <span class="row-val text-mint tabular-nums">{{ activePt.raw.total | privacyCurrency }}</span>
                </div>
              }
            </div>
          </div>
        }
      </div>

      <!-- Legenda Interativa com Alternância de Linhas (shadcn ChartLegend Content) -->
      @if (showLegend()) {
        <div class="chart-legend">
          <!-- Chip Total Consolidado -->
          <button
            type="button"
            class="legend-chip"
            [class.active]="toggleTotal()"
            [class.muted]="!toggleTotal()"
            (click)="toggleLine('total')"
            title="Ligar/desligar visualização do Total"
          >
            <span class="legend-color-box total-box"></span>
            <span class="legend-chip-title">Total Consolidado</span>
            <span class="chip-current-val tabular-nums">{{ latestTotal() | privacyCurrency }}</span>
          </button>

          <!-- Chip Dinheiro em Conta Parado -->
          <button
            type="button"
            class="legend-chip"
            [class.active]="toggleChecking()"
            [class.muted]="!toggleChecking()"
            (click)="toggleLine('checking')"
            title="Ligar/desligar visualização da Conta Parado"
          >
            <span class="legend-color-box checking-box"></span>
            <span class="legend-chip-title">Conta Parado</span>
            <span class="chip-current-val tabular-nums">{{ latestChecking() | privacyCurrency }}</span>
          </button>

          <!-- Chip Cofrinhos -->
          <button
            type="button"
            class="legend-chip"
            [class.active]="toggleSavings()"
            [class.muted]="!toggleSavings()"
            (click)="toggleLine('savings')"
            title="Ligar/desligar visualização dos Cofrinhos"
          >
            <span class="legend-color-box savings-box"></span>
            <span class="legend-chip-title">Cofrinhos</span>
            <span class="chip-current-val tabular-nums">{{ latestSavings() | privacyCurrency }}</span>
          </button>

          <!-- Chip Investido -->
          <button
            type="button"
            class="legend-chip"
            [class.active]="toggleInvestment()"
            [class.muted]="!toggleInvestment()"
            (click)="toggleLine('investment')"
            title="Ligar/desligar visualização dos Investimentos"
          >
            <span class="legend-color-box investment-box"></span>
            <span class="legend-chip-title">Investido</span>
            <span class="chip-current-val tabular-nums">{{ latestInvestment() | privacyCurrency }}</span>
          </button>
        </div>
      }
    </div>
  `,
  styles: `
    .savings-chart-wrapper {
      display: flex;
      flex-direction: column;
      width: 100%;
    }

    .chart-header {
      display: flex;
      flex-wrap: wrap;
      align-items: flex-start;
      justify-content: space-between;
      gap: 16px;
      margin-bottom: 16px;

      .header-left {
        display: flex;
        flex-direction: column;
        gap: 2px;
      }

      .title-wrap {
        display: flex;
        align-items: center;
        gap: 8px;
      }

      .chart-title {
        font-size: 16px;
        font-weight: 700;
        color: var(--text-primary);
        letter-spacing: -0.01em;
      }

      .period-tag {
        font-size: 11px;
        font-weight: 600;
        padding: 2px 8px;
        border-radius: var(--radius-full);
        background-color: var(--bg-surface-elevated);
        color: var(--text-secondary);
        border: 1px solid var(--border-subtle);
      }

      .chart-subtitle {
        font-size: 12px;
        color: var(--text-secondary);
        margin: 2px 0 10px;
      }

      .balance-display {
        display: flex;
        align-items: baseline;
        gap: 10px;
        flex-wrap: wrap;
      }

      .current-balance {
        font-size: 26px;
        font-weight: 800;
        letter-spacing: -0.02em;
        color: var(--text-primary);
      }

      .growth-badge {
        display: inline-flex;
        align-items: center;
        gap: 4px;
        font-size: 12px;
        font-weight: 600;
        padding: 3px 8px;
        border-radius: var(--radius-full);

        &.positive {
          color: #34F5C5;
          background: rgba(52, 245, 197, 0.12);
          border: 1px solid rgba(52, 245, 197, 0.25);
        }

        &.negative {
          color: var(--color-expense);
          background: rgba(244, 63, 94, 0.12);
          border: 1px solid rgba(244, 63, 94, 0.25);
        }

        .growth-amount {
          font-weight: 500;
          opacity: 0.85;
          margin-left: 2px;
        }
      }

      .view-mode-tabs {
        display: flex;
        background-color: var(--bg-surface-elevated);
        border: 1px solid var(--border-subtle);
        border-radius: var(--radius-md);
        padding: 3px;
        gap: 2px;
      }

      .tab-btn {
        background: transparent;
        border: none;
        color: var(--text-muted);
        font-size: 11px;
        font-weight: 600;
        padding: 5px 10px;
        border-radius: var(--radius-sm);
        cursor: pointer;
        transition: all 0.15s ease;

        &:hover {
          color: var(--text-primary);
        }

        &.active {
          background-color: var(--bg-surface);
          color: var(--color-accent);
          box-shadow: 0 1px 3px rgba(0, 0, 0, 0.2);
        }
      }
    }

    .chart-canvas-container {
      position: relative;
      width: 100%;
      height: 220px;
      margin: 8px 0 16px;
      user-select: none;
      cursor: crosshair;
    }

    .savings-svg {
      width: 100%;
      height: 100%;
      overflow: visible;
    }

    .grid-line {
      stroke: rgba(255, 255, 255, 0.05);
      stroke-dasharray: 3 3;
    }

    .axis-base-line {
      stroke: rgba(255, 255, 255, 0.1);
    }

    .grid-label {
      font-size: 10px;
      fill: var(--text-muted);
      font-family: inherit;
    }

    .axis-x-label {
      font-size: 11px;
      font-weight: 500;
      fill: var(--text-secondary);
      font-family: inherit;
      transition: fill 0.15s ease;

      &.highlight {
        fill: var(--color-accent);
        font-weight: 700;
      }
    }

    .line-curve {
      stroke-linecap: round;
      stroke-linejoin: round;
      transition: stroke-width 0.2s ease, opacity 0.2s ease;
    }

    .total-line {
      filter: drop-shadow(0px 2px 8px rgba(52, 245, 197, 0.35));
    }

    .cursor-guide-line {
      stroke: rgba(255, 255, 255, 0.2);
      stroke-dasharray: 4 4;
      stroke-width: 1.5;
    }

    .hover-dot {
      stroke: #09090b;
      stroke-width: 2;
      filter: drop-shadow(0 0 6px currentColor);

      &.total-dot {
        filter: drop-shadow(0 0 8px #34F5C5);
      }
    }

    .chart-floating-tooltip {
      position: absolute;
      transform: translate(-50%, -115%);
      background: rgba(18, 18, 22, 0.95);
      backdrop-filter: blur(12px);
      border: 1px solid rgba(255, 255, 255, 0.12);
      border-radius: var(--radius-md);
      padding: 10px 14px;
      min-width: 180px;
      box-shadow: 0 10px 25px -5px rgba(0, 0, 0, 0.5), 0 0 15px rgba(29, 205, 254, 0.15);
      pointer-events: none;
      z-index: 50;

      .tooltip-header {
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 12px;
        padding-bottom: 6px;
        margin-bottom: 6px;
        border-bottom: 1px solid rgba(255, 255, 255, 0.08);
      }

      .tooltip-date {
        font-size: 11px;
        font-weight: 600;
        color: var(--text-secondary);
        text-transform: capitalize;
      }

      .tooltip-total-badge {
        font-size: 12px;
        font-weight: 700;
        color: #34F5C5;
      }

      .tooltip-body {
        display: flex;
        flex-direction: column;
        gap: 5px;
      }

      .tooltip-row {
        display: flex;
        align-items: center;
        justify-content: space-between;
        font-size: 11px;

        &.total-row {
          margin-top: 4px;
          padding-top: 4px;
          border-top: 1px dashed rgba(255, 255, 255, 0.08);
          font-weight: 600;
        }

        .row-label {
          display: flex;
          align-items: center;
          gap: 6px;
          color: var(--text-muted);
        }

        .dot-indicator {
          width: 7px;
          height: 7px;
          border-radius: 50%;
        }

        .row-val {
          font-weight: 600;
          color: var(--text-primary);
        }

        .text-mint {
          color: #34F5C5;
        }
      }
    }

    .chart-legend {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(130px, 1fr));
      gap: 8px;
      width: 100%;
      padding-top: 14px;
      border-top: 1px solid var(--border-subtle);

      .legend-chip {
        display: flex;
        flex-direction: column;
        align-items: flex-start;
        padding: 8px 10px;
        background: var(--bg-surface-elevated);
        border: 1px solid var(--border-subtle);
        border-radius: var(--radius-sm);
        cursor: pointer;
        transition: all 0.15s ease;
        text-align: left;

        &:hover {
          border-color: rgba(255, 255, 255, 0.2);
          background: var(--bg-hover);
        }

        &.muted {
          opacity: 0.45;
          filter: grayscale(0.5);
        }

        &.active {
          opacity: 1;
        }

        .legend-color-box {
          width: 12px;
          height: 4px;
          border-radius: 2px;
          margin-bottom: 4px;

          &.total-box {
            background: linear-gradient(90deg, #1DCDFE, #34F5C5);
          }

          &.checking-box {
            background-color: #38bdf8;
          }

          &.savings-box {
            background-color: #21D0B2;
          }

          &.investment-box {
            background-color: #1DCDFE;
          }
        }

        .legend-chip-title {
          font-size: 11px;
          font-weight: 500;
          color: var(--text-secondary);
        }

        .chip-current-val {
          font-size: 13px;
          font-weight: 700;
          color: var(--text-primary);
          margin-top: 2px;
        }
      }
    }
  `,
})
export class SavingsEvolutionChartComponent {
  data = input.required<SavingsPoint[]>();
  period = input<string>('Últimos 6 meses');
  growthAmount = input<number | string | null>(null);
  growthPercentage = input<number | null>(null);
  currentTotal = input<number | string | null>(null);
  showLegend = input<boolean>(true);

  svgContainer = viewChild<ElementRef<HTMLDivElement>>('svgContainer');

  // Modo de visualização: 'all' (Tudo), 'total' (Somente Total), 'lines' (Somente Linhas Separadas)
  viewMode = signal<ChartViewMode>('all');

  // Alternadores individuais de linha (clicáveis na legenda)
  toggleTotal = signal<boolean>(true);
  toggleChecking = signal<boolean>(true);
  toggleSavings = signal<boolean>(true);
  toggleInvestment = signal<boolean>(true);

  hoveredIndex = signal<number | null>(null);
  mouseCoords = signal<{ x: number; y: number } | null>(null);

  // Dimensões SVG internas de renderização
  readonly svgWidth = 600;
  readonly svgHeight = 220;
  readonly paddingTop = 20;
  readonly paddingBottom = 34;
  readonly paddingLeft = 52;
  readonly paddingRight = 20;

  get zeroY(): number {
    return this.svgHeight - this.paddingBottom;
  }

  // Visibilidade resolvida com base no modo e no toggle manual
  isTotalVisible = computed(() => {
    if (this.viewMode() === 'lines') return false;
    return this.toggleTotal();
  });

  isCheckingVisible = computed(() => {
    if (this.viewMode() === 'total') return false;
    return this.toggleChecking();
  });

  isSavingsVisible = computed(() => {
    if (this.viewMode() === 'total') return false;
    return this.toggleSavings();
  });

  isInvestmentVisible = computed(() => {
    if (this.viewMode() === 'total') return false;
    return this.toggleInvestment();
  });

  // Teto máximo para cálculo da escala Y
  maxY = computed(() => {
    const list = this.data();
    if (!list || list.length === 0) return 1000;

    let maxVal = 0;
    list.forEach((pt) => {
      const tot = parseFloat(pt.total?.toString() || '0') || 0;
      const chk = parseFloat(pt.checking?.toString() || '0') || 0;
      const sav = parseFloat(pt.savings?.toString() || '0') || 0;
      const inv = parseFloat(pt.investment?.toString() || '0') || 0;
      maxVal = Math.max(maxVal, tot, chk, sav, inv);
    });

    if (maxVal <= 0) return 1000;
    // Margem de 15% para folga superior
    return maxVal * 1.15;
  });

  // Linhas horizontais e rótulos da escala Y
  yGridLines = computed(() => {
    const max = this.maxY();
    const steps = 4;
    const lines = [];
    const availableHeight = this.zeroY - this.paddingTop;

    for (let i = 0; i <= steps; i++) {
      const frac = i / steps;
      const val = max * frac;
      const y = this.zeroY - frac * availableHeight;

      let label = 'R$ 0';
      if (val >= 1000000) {
        label = `R$ ${(val / 1000000).toFixed(1)}M`;
      } else if (val >= 1000) {
        label = `R$ ${(val / 1000).toFixed(0)}k`;
      } else if (val > 0) {
        label = `R$ ${val.toFixed(0)}`;
      }

      lines.push({ val, y, label });
    }
    return lines;
  });

  // Mapeamento dos pontos em coordenadas de tela (X, Y)
  scaledPoints = computed<ScaledPoint[]>(() => {
    const list = this.data();
    if (!list || list.length === 0) return [];

    const max = this.maxY();
    const availableHeight = this.zeroY - this.paddingTop;
    const availableWidth = this.svgWidth - this.paddingLeft - this.paddingRight;
    const count = list.length;

    return list.map((pt, i) => {
      const x =
        count <= 1
          ? this.paddingLeft + availableWidth / 2
          : this.paddingLeft + (i / (count - 1)) * availableWidth;

      const numTot = parseFloat(pt.total?.toString() || '0') || 0;
      const numChk = parseFloat(pt.checking?.toString() || '0') || 0;
      const numSav = parseFloat(pt.savings?.toString() || '0') || 0;
      const numInv = parseFloat(pt.investment?.toString() || '0') || 0;

      const yTotal = this.zeroY - (numTot / max) * availableHeight;
      const yChecking = this.zeroY - (numChk / max) * availableHeight;
      const ySavings = this.zeroY - (numSav / max) * availableHeight;
      const yInvestment = this.zeroY - (numInv / max) * availableHeight;

      return {
        x,
        yTotal,
        yChecking,
        ySavings,
        yInvestment,
        raw: pt,
      };
    });
  });

  // Traçado cúbico suave (Catmull-Rom spline) para cada série
  totalPath = computed(() => {
    const pts = this.scaledPoints().map((p) => ({ x: p.x, y: p.yTotal }));
    return this.buildSmoothPath(pts);
  });

  totalAreaPath = computed(() => {
    const pts = this.scaledPoints().map((p) => ({ x: p.x, y: p.yTotal }));
    if (pts.length < 2) return '';
    const linePath = this.buildSmoothPath(pts);
    return `${linePath} L ${pts[pts.length - 1].x},${this.zeroY} L ${pts[0].x},${this.zeroY} Z`;
  });

  checkingPath = computed(() => {
    const pts = this.scaledPoints().map((p) => ({ x: p.x, y: p.yChecking }));
    return this.buildSmoothPath(pts);
  });

  savingsPath = computed(() => {
    const pts = this.scaledPoints().map((p) => ({ x: p.x, y: p.ySavings }));
    return this.buildSmoothPath(pts);
  });

  investmentPath = computed(() => {
    const pts = this.scaledPoints().map((p) => ({ x: p.x, y: p.yInvestment }));
    return this.buildSmoothPath(pts);
  });

  // Ponto ativo no momento de interação
  hoveredPoint = computed(() => {
    const idx = this.hoveredIndex();
    const pts = this.scaledPoints();
    if (idx === null || idx < 0 || idx >= pts.length) return null;
    return pts[idx];
  });

  // Posição calculada para o Tooltip flutuante
  tooltipLeft = computed(() => {
    const pt = this.hoveredPoint();
    if (!pt) return 0;
    const container = this.svgContainer()?.nativeElement;
    if (!container) return pt.x;
    const rect = container.getBoundingClientRect();
    const ratio = rect.width / this.svgWidth;
    return pt.x * ratio;
  });

  tooltipTop = computed(() => {
    const pt = this.hoveredPoint();
    if (!pt) return 0;
    const container = this.svgContainer()?.nativeElement;
    if (!container) return pt.yTotal;
    const rect = container.getBoundingClientRect();
    const ratio = rect.height / this.svgHeight;
    // Ancorado ligeiramente acima do ponto do total
    return Math.max(30, pt.yTotal * ratio);
  });

  // Valores consolidados mais recentes para os chips da legenda
  latestTotal = computed(() => {
    const list = this.data();
    if (!list || list.length === 0) return 0;
    return list[list.length - 1].total;
  });

  latestChecking = computed(() => {
    const list = this.data();
    if (!list || list.length === 0) return 0;
    return list[list.length - 1].checking;
  });

  latestSavings = computed(() => {
    const list = this.data();
    if (!list || list.length === 0) return 0;
    return list[list.length - 1].savings;
  });

  latestInvestment = computed(() => {
    const list = this.data();
    if (!list || list.length === 0) return 0;
    return list[list.length - 1].investment;
  });

  currentTotalValue = computed(() => {
    const propVal = this.currentTotal();
    if (propVal !== null && propVal !== undefined && parseFloat(propVal.toString()) > 0) {
      return propVal;
    }
    return this.latestTotal();
  });

  setViewMode(mode: ChartViewMode): void {
    this.viewMode.set(mode);
    if (mode === 'total') {
      this.toggleTotal.set(true);
    } else if (mode === 'lines') {
      this.toggleChecking.set(true);
      this.toggleSavings.set(true);
      this.toggleInvestment.set(true);
    } else {
      this.toggleTotal.set(true);
      this.toggleChecking.set(true);
      this.toggleSavings.set(true);
      this.toggleInvestment.set(true);
    }
  }

  toggleLine(key: 'total' | 'checking' | 'savings' | 'investment'): void {
    switch (key) {
      case 'total':
        this.toggleTotal.update((v) => !v);
        break;
      case 'checking':
        this.toggleChecking.update((v) => !v);
        break;
      case 'savings':
        this.toggleSavings.update((v) => !v);
        break;
      case 'investment':
        this.toggleInvestment.update((v) => !v);
        break;
    }
  }

  onMouseMove(evt: MouseEvent): void {
    const container = this.svgContainer()?.nativeElement;
    if (!container) return;
    const rect = container.getBoundingClientRect();
    const mouseX = evt.clientX - rect.left;
    const svgX = (mouseX / rect.width) * this.svgWidth;

    this.findClosestPoint(svgX);
  }

  onTouchMove(evt: TouchEvent): void {
    if (!evt.touches || evt.touches.length === 0) return;
    const container = this.svgContainer()?.nativeElement;
    if (!container) return;
    const rect = container.getBoundingClientRect();
    const touchX = evt.touches[0].clientX - rect.left;
    const svgX = (touchX / rect.width) * this.svgWidth;

    this.findClosestPoint(svgX);
  }

  onMouseLeave(): void {
    this.hoveredIndex.set(null);
  }

  private findClosestPoint(svgX: number): void {
    const pts = this.scaledPoints();
    if (pts.length === 0) return;

    let closestIdx = 0;
    let minDiff = Infinity;

    pts.forEach((pt, idx) => {
      const diff = Math.abs(pt.x - svgX);
      if (diff < minDiff) {
        minDiff = diff;
        closestIdx = idx;
      }
    });

    this.hoveredIndex.set(closestIdx);
  }

  /**
   * Constrói uma curva spline cúbica suave (Catmull-Rom) conectando os pontos
   */
  private buildSmoothPath(points: { x: number; y: number }[]): string {
    if (!points || points.length === 0) return '';
    if (points.length === 1) return `M ${points[0].x},${points[0].y}`;
    if (points.length === 2) {
      return `M ${points[0].x},${points[0].y} L ${points[1].x},${points[1].y}`;
    }

    let d = `M ${points[0].x.toFixed(1)},${points[0].y.toFixed(1)}`;
    for (let i = 0; i < points.length - 1; i++) {
      const p0 = points[i === 0 ? 0 : i - 1];
      const p1 = points[i];
      const p2 = points[i + 1];
      const p3 = points[i + 2 < points.length ? i + 2 : i + 1];

      const cp1x = p1.x + (p2.x - p0.x) / 6;
      const cp1y = p1.y + (p2.y - p0.y) / 6;
      const cp2x = p2.x - (p3.x - p1.x) / 6;
      const cp2y = p2.y - (p3.y - p1.y) / 6;

      d += ` C ${cp1x.toFixed(1)},${cp1y.toFixed(1)} ${cp2x.toFixed(1)},${cp2y.toFixed(1)} ${p2.x.toFixed(1)},${p2.y.toFixed(1)}`;
    }
    return d;
  }
}
