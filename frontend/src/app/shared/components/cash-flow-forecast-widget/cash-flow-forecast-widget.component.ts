import {
  Component,
  computed,
  input,
  signal,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { PrivacyCurrencyPipe } from '../../../core/pipes/privacy-currency.pipe';
import { IconComponent } from '../icon/icon.component';
import {
  CashFlowForecastResponse,
  ForecastDailyPoint,
} from '../../../core/models/forecast.model';

interface ScaledForecastPoint {
  x: number;
  y: number;
  raw: ForecastDailyPoint;
}

@Component({
  selector: 'app-cash-flow-forecast-widget',
  standalone: true,
  imports: [CommonModule, PrivacyCurrencyPipe, IconComponent],
  template: `
    <div class="forecast-card">
      <!-- Cabeçalho Executivo do Widget -->
      <div class="forecast-header">
        <div class="header-titles">
          <div class="title-row">
            <span class="widget-title">Inteligência Preditiva & Caixa</span>
            <span class="badge-30d">Projeção 30 Dias</span>
          </div>
          <p class="widget-subtitle">
            Previsão contábil do fluxo de caixa e limite seguro diário para gastar
          </p>
        </div>

        @if (isSimulating()) {
          <button class="btn-text-link" (click)="resetSimulation()" title="Restaurar dados reais">
            <app-icon name="repeat" [size]="12" />
            <span>Restaurar Real</span>
          </button>
        }
      </div>

      <!-- Card Destaque: Indicador Livre para Gastar por Dia (Actual Budget) -->
      <div class="safe-to-spend-banner" [class]="statusClass()">
        <div class="safe-left">
          <div class="safe-tag">
            <app-icon [name]="statusIcon()" [size]="14" />
            <span>{{ statusLabel() }}</span>
          </div>
          <div class="safe-daily-val currency-val tabular-nums">
            {{ activeSafeToSpend()?.daily_amount || '0.00' | privacyCurrency }}
            <span class="unit-text">/ dia</span>
          </div>
          <div class="safe-subtext">
            <span>{{ activeSafeToSpend()?.days_remaining || 0 }} dias restantes até o fim do mês</span>
          </div>
        </div>

        <div class="safe-right">
          <div class="metric-mini">
            <span class="mini-label">Disponível no Mês</span>
            <span class="mini-val currency-val tabular-nums">
              {{ activeSafeToSpend()?.disposable_month_amount || '0.00' | privacyCurrency }}
            </span>
          </div>
          <div class="metric-mini">
            <span class="mini-label">Faturas a Vencer</span>
            <span class="mini-val currency-val tabular-nums text-warning">
              -{{ activeSafeToSpend()?.upcoming_bills_amount || '0.00' | privacyCurrency }}
            </span>
          </div>
        </div>
      </div>

      <!-- Alerta Proativo de Déficit / Risco -->
      @if (activeForecast()?.has_deficit_risk) {
        <div class="deficit-alert">
          <div class="alert-icon">
            <app-icon name="alert-triangle" [size]="16" />
          </div>
          <div class="alert-content">
            <span class="alert-title">Risco de Saldo Negativo Detectado</span>
            <span class="alert-desc">
              Com as faturas programadas, seu saldo pode ficar negativo em torno de
              {{ activeForecast()?.deficit_date | date: 'dd/MM' }}. Menor saldo projetado:
              {{ activeForecast()?.lowest_projected_balance || '0.00' | privacyCurrency }}.
            </span>
          </div>
        </div>
      }

      <!-- Gráfico da Curva de Projeção Diária -->
      <div class="chart-wrapper">
        <div class="chart-metrics-row">
          <div class="metric-pill">
            <span class="pill-label">Saldo em 30 Dias:</span>
            <span
              class="pill-val tabular-nums"
              [class.text-expense]="isThirtyDaysNegative()"
              [class.text-income]="!isThirtyDaysNegative()"
            >
              {{ activeForecast()?.thirty_days_balance || '0.00' | privacyCurrency }}
            </span>
          </div>
          <div class="metric-pill">
            <span class="pill-label">Saldo Fim do Mês:</span>
            <span
              class="pill-val tabular-nums"
              [class.text-expense]="isEndOfMonthNegative()"
              [class.text-income]="!isEndOfMonthNegative()"
            >
              {{ activeForecast()?.end_of_month_balance || '0.00' | privacyCurrency }}
            </span>
          </div>
        </div>

        @if (isLoading()) {
          <div class="chart-skeleton"></div>
        } @else if (scaledPoints().length === 0) {
          <div class="empty-forecast">
            <p>Nenhuma movimentação para projeção</p>
            <button class="btn btn-secondary demo-btn" (click)="simulateData()">
              <app-icon name="sparkles" [size]="14" />
              <span>Simular Projeção Preditiva</span>
            </button>
          </div>
        } @else {
          <!-- SVG Interativo da Projeção -->
          <div class="svg-container">
            <svg
              viewBox="0 0 600 160"
              class="forecast-svg"
              (mouseleave)="hoveredIndex.set(null)"
            >
              <defs>
                <linearGradient id="forecastFill" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stop-color="#38bdf8" stop-opacity="0.25" />
                  <stop offset="100%" stop-color="#38bdf8" stop-opacity="0.0" />
                </linearGradient>
                <linearGradient id="forecastDeficitFill" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stop-color="#ef4444" stop-opacity="0.3" />
                  <stop offset="100%" stop-color="#ef4444" stop-opacity="0.0" />
                </linearGradient>
              </defs>

              <!-- Linha Base de R$ 0,00 -->
              @if (zeroLineY() !== null) {
                <line
                  x1="20"
                  [attr.y1]="zeroLineY()"
                  x2="580"
                  [attr.y2]="zeroLineY()"
                  stroke="#ef4444"
                  stroke-dasharray="4 4"
                  stroke-width="1"
                  stroke-opacity="0.6"
                />
                <text
                  x="24"
                  [attr.y]="(zeroLineY() ?? 0) - 4"
                  fill="#ef4444"
                  font-size="9"
                  opacity="0.7"
                >
                  R$ 0,00
                </text>
              }

              <!-- Área Preenchida -->
              <path [attr.d]="areaPath()" fill="url(#forecastFill)" />

              <!-- Linha da Projeção -->
              <path
                [attr.d]="linePath()"
                fill="none"
                stroke="#38bdf8"
                stroke-width="2.5"
                stroke-linecap="round"
                stroke-linejoin="round"
              />

              <!-- Linhas Verticais e Pontos Hover Interativos -->
              @for (pt of scaledPoints(); track pt.raw.date; let idx = $index) {
                <circle
                  [attr.cx]="pt.x"
                  [attr.cy]="pt.y"
                  r="3.5"
                  [attr.fill]="pt.raw.is_negative ? '#ef4444' : '#38bdf8'"
                  stroke="#09090b"
                  stroke-width="1.5"
                  class="point-circle"
                  (mouseenter)="hoveredIndex.set(idx)"
                />
              }

              <!-- Indicador do Ponto Selecionado -->
              @if (currentHoverPoint(); as hoverPt) {
                <line
                  [attr.x1]="hoverPt.x"
                  y1="10"
                  [attr.x2]="hoverPt.x"
                  y2="140"
                  stroke="#71717a"
                  stroke-width="1"
                  stroke-dasharray="2 2"
                />
                <circle
                  [attr.cx]="hoverPt.x"
                  [attr.cy]="hoverPt.y"
                  r="6"
                  fill="#ffffff"
                  stroke="#38bdf8"
                  stroke-width="2.5"
                />
              }
            </svg>

            <!-- Tooltip Interativo -->
            @if (currentHoverPoint(); as hoverPt) {
              <div
                class="hover-tooltip"
                [style.left.px]="tooltipX(hoverPt.x)"
                [style.top.px]="30"
              >
                <div class="tooltip-header">
                  <span class="tooltip-date">{{ hoverPt.raw.label }}</span>
                  @if (hoverPt.raw.is_negative) {
                    <span class="tooltip-deficit">Negativo</span>
                  }
                </div>
                <div class="tooltip-balance tabular-nums">
                  Saldo: {{ hoverPt.raw.projected_balance | privacyCurrency }}
                </div>
                @if (hasDailyMovement(hoverPt.raw)) {
                  <div class="tooltip-movements">
                    @if (hoverPt.raw.outflow !== '0.00') {
                      <span class="text-expense">-{{ hoverPt.raw.outflow | privacyCurrency }}</span>
                    }
                    @if (hoverPt.raw.inflow !== '0.00') {
                      <span class="text-income">+{{ hoverPt.raw.inflow | privacyCurrency }}</span>
                    }
                  </div>
                }
              </div>
            }
          </div>

          <!-- Legenda Inferior dos Eixos -->
          <div class="chart-axis-labels">
            <span>Hoje ({{ activeForecast()?.points?.[0]?.label }})</span>
            <span>+15 Dias ({{ activeForecast()?.points?.[15]?.label }})</span>
            <span>+30 Dias ({{ activeForecast()?.points?.[30]?.label }})</span>
          </div>
        }
      </div>
    </div>
  `,
  styles: `
    .forecast-card {
      background: #18181b;
      border: 1px solid #27272a;
      border-radius: 12px;
      padding: 18px 16px;
      margin-bottom: 20px;
    }

    .forecast-header {
      display: flex;
      justify-content: space-between;
      align-items: flex-start;
      margin-bottom: 14px;
    }

    .title-row {
      display: flex;
      align-items: center;
      gap: 8px;
    }

    .widget-title {
      font-size: 15px;
      font-weight: 600;
      color: #fafafa;
    }

    .badge-30d {
      font-size: 11px;
      font-weight: 500;
      padding: 2px 7px;
      border-radius: 9999px;
      background: #27272a;
      color: #a1a1aa;
      border: 1px solid #3f3f46;
    }

    .widget-subtitle {
      font-size: 12px;
      color: #a1a1aa;
      margin: 2px 0 0;
    }

    .btn-text-link {
      background: none;
      border: none;
      color: #38bdf8;
      font-size: 12px;
      cursor: pointer;
      display: inline-flex;
      align-items: center;
      gap: 4px;
      padding: 4px 6px;
      border-radius: 6px;
    }
    .btn-text-link:hover {
      background: #27272a;
    }

    /* Safe to Spend Banner */
    .safe-to-spend-banner {
      display: flex;
      justify-content: space-between;
      align-items: center;
      padding: 14px 16px;
      border-radius: 10px;
      margin-bottom: 14px;
      background: #27272a;
      border: 1px solid #3f3f46;
    }

    .safe-to-spend-banner.status-healthy {
      border-left: 4px solid #22c55e;
    }

    .safe-to-spend-banner.status-caution {
      border-left: 4px solid #f59e0b;
    }

    .safe-to-spend-banner.status-critical {
      border-left: 4px solid #ef4444;
      background: rgba(239, 68, 68, 0.08);
    }

    .safe-tag {
      display: inline-flex;
      align-items: center;
      gap: 5px;
      font-size: 11px;
      font-weight: 600;
      text-transform: uppercase;
      letter-spacing: 0.03em;
      margin-bottom: 4px;
    }

    .status-healthy .safe-tag {
      color: #4ade80;
    }
    .status-caution .safe-tag {
      color: #fbbf24;
    }
    .status-critical .safe-tag {
      color: #f87171;
    }

    .safe-daily-val {
      font-size: 24px;
      font-weight: 700;
      color: #ffffff;
      line-height: 1.1;
    }

    .unit-text {
      font-size: 13px;
      font-weight: 400;
      color: #a1a1aa;
      margin-left: 4px;
    }

    .safe-subtext {
      font-size: 11px;
      color: #a1a1aa;
      margin-top: 4px;
    }

    .safe-right {
      display: flex;
      flex-direction: column;
      gap: 6px;
      text-align: right;
    }

    .metric-mini {
      display: flex;
      flex-direction: column;
    }

    .mini-label {
      font-size: 10px;
      color: #71717a;
      text-transform: uppercase;
    }

    .mini-val {
      font-size: 13px;
      font-weight: 600;
      color: #e4e4e7;
    }

    .text-warning {
      color: #f59e0b;
    }

    /* Deficit Alert */
    .deficit-alert {
      display: flex;
      align-items: flex-start;
      gap: 10px;
      background: rgba(239, 68, 68, 0.1);
      border: 1px solid rgba(239, 68, 68, 0.3);
      border-radius: 8px;
      padding: 10px 12px;
      margin-bottom: 14px;
    }

    .alert-icon {
      color: #ef4444;
      margin-top: 2px;
    }

    .alert-title {
      display: block;
      font-size: 12px;
      font-weight: 600;
      color: #fca5a5;
    }

    .alert-desc {
      display: block;
      font-size: 11px;
      color: #f87171;
      margin-top: 2px;
      line-height: 1.4;
    }

    /* Chart Section */
    .chart-wrapper {
      position: relative;
    }

    .chart-metrics-row {
      display: flex;
      gap: 12px;
      margin-bottom: 10px;
    }

    .metric-pill {
      font-size: 11px;
      background: #27272a;
      padding: 4px 8px;
      border-radius: 6px;
      display: flex;
      align-items: center;
      gap: 6px;
    }

    .pill-label {
      color: #a1a1aa;
    }

    .pill-val {
      font-weight: 600;
    }

    .text-expense {
      color: #ef4444;
    }
    .text-income {
      color: #22c55e;
    }

    .svg-container {
      position: relative;
      width: 100%;
      height: 160px;
    }

    .forecast-svg {
      width: 100%;
      height: 100%;
      overflow: visible;
    }

    .point-circle {
      cursor: pointer;
      transition: r 0.15s ease;
    }
    .point-circle:hover {
      r: 6;
    }

    .hover-tooltip {
      position: absolute;
      transform: translateX(-50%);
      background: #18181b;
      border: 1px solid #3f3f46;
      border-radius: 6px;
      padding: 6px 10px;
      font-size: 11px;
      pointer-events: none;
      box-shadow: 0 4px 12px rgba(0, 0, 0, 0.4);
      z-index: 10;
      white-space: nowrap;
    }

    .tooltip-header {
      display: flex;
      justify-content: space-between;
      gap: 8px;
      margin-bottom: 2px;
    }

    .tooltip-date {
      color: #a1a1aa;
      font-weight: 500;
    }

    .tooltip-deficit {
      color: #ef4444;
      font-weight: 600;
    }

    .tooltip-balance {
      font-size: 13px;
      font-weight: 700;
      color: #ffffff;
    }

    .tooltip-movements {
      display: flex;
      gap: 6px;
      font-size: 10px;
      margin-top: 2px;
    }

    .chart-axis-labels {
      display: flex;
      justify-content: space-between;
      font-size: 10px;
      color: #71717a;
      margin-top: 6px;
      padding: 0 4px;
    }

    .chart-skeleton {
      height: 150px;
      background: #27272a;
      border-radius: 8px;
      animation: pulse 1.5s infinite ease-in-out;
    }

    .empty-forecast {
      text-align: center;
      padding: 30px 10px;
      color: #a1a1aa;
      font-size: 12px;
    }

    .demo-btn {
      margin-top: 10px;
      display: inline-flex;
      align-items: center;
      gap: 6px;
      font-size: 12px;
      padding: 6px 12px;
      background: #27272a;
      border: 1px solid #3f3f46;
      border-radius: 6px;
      color: #ffffff;
      cursor: pointer;
    }
    .demo-btn:hover {
      background: #3f3f46;
    }

    @keyframes pulse {
      0%, 100% { opacity: 0.6; }
      50% { opacity: 0.3; }
    }
  `,
})
export class CashFlowForecastWidgetComponent {
  forecast = input<CashFlowForecastResponse | null>(null);
  isLoading = input<boolean>(false);

  hoveredIndex = signal<number | null>(null);
  simulatedForecast = signal<CashFlowForecastResponse | null>(null);

  isSimulating = computed(() => this.simulatedForecast() !== null);

  activeForecast = computed<CashFlowForecastResponse | null>(() => {
    return this.simulatedForecast() || this.forecast();
  });

  activeSafeToSpend = computed(() => {
    return this.activeForecast()?.safe_to_spend || null;
  });

  statusClass = computed(() => {
    const s = this.activeSafeToSpend()?.status;
    if (s === 'HEALTHY') return 'status-healthy';
    if (s === 'CAUTION') return 'status-caution';
    return 'status-critical';
  });

  statusIcon = computed(() => {
    const s = this.activeSafeToSpend()?.status;
    if (s === 'HEALTHY') return 'check';
    if (s === 'CAUTION') return 'alert-triangle';
    return 'alert-triangle';
  });

  statusLabel = computed(() => {
    const s = this.activeSafeToSpend()?.status;
    if (s === 'HEALTHY') return 'Livre para Gastar';
    if (s === 'CAUTION') return 'Atenção Orçamentária';
    return 'Déficit no Mês';
  });

  isThirtyDaysNegative = computed(() => {
    const val = parseFloat(this.activeForecast()?.thirty_days_balance || '0');
    return val < 0;
  });

  isEndOfMonthNegative = computed(() => {
    const val = parseFloat(this.activeForecast()?.end_of_month_balance || '0');
    return val < 0;
  });

  scaledPoints = computed<ScaledForecastPoint[]>(() => {
    const pts = this.activeForecast()?.points;
    if (!pts || pts.length === 0) return [];

    const width = 600;
    const height = 150;
    const paddingX = 20;
    const paddingTop = 20;
    const paddingBottom = 25;

    const values = pts.map((p) => parseFloat(p.projected_balance));
    let minVal = Math.min(...values);
    let maxVal = Math.max(...values);

    // Garante que o intervalo seja pelo menos R$ 100 para evitar divisão por zero
    if (maxVal - minVal < 100) {
      maxVal += 50;
      minVal -= 50;
    }

    const usableWidth = width - 2 * paddingX;
    const usableHeight = height - paddingTop - paddingBottom;

    return pts.map((p, idx) => {
      const val = parseFloat(p.projected_balance);
      const x = paddingX + (idx / (pts.length - 1)) * usableWidth;
      const normalizedY = (val - minVal) / (maxVal - minVal);
      const y = height - paddingBottom - normalizedY * usableHeight;
      return { x, y, raw: p };
    });
  });

  zeroLineY = computed<number | null>(() => {
    const pts = this.activeForecast()?.points;
    if (!pts || pts.length === 0) return null;

    const values = pts.map((p) => parseFloat(p.projected_balance));
    const minVal = Math.min(...values);
    const maxVal = Math.max(...values);

    if (minVal >= 0) return null; // Sem valores negativos

    const height = 150;
    const paddingTop = 20;
    const paddingBottom = 25;
    const usableHeight = height - paddingTop - paddingBottom;
    const normalizedZero = (0 - minVal) / (maxVal - minVal);
    return height - paddingBottom - normalizedZero * usableHeight;
  });

  linePath = computed<string>(() => {
    const points = this.scaledPoints();
    if (points.length === 0) return '';
    return points.reduce((acc, curr, idx) => {
      return idx === 0 ? `M ${curr.x} ${curr.y}` : `${acc} L ${curr.x} ${curr.y}`;
    }, '');
  });

  areaPath = computed<string>(() => {
    const points = this.scaledPoints();
    if (points.length === 0) return '';
    const first = points[0];
    const last = points[points.length - 1];
    const baseY = 150 - 25;
    return `${this.linePath()} L ${last.x} ${baseY} L ${first.x} ${baseY} Z`;
  });

  currentHoverPoint = computed<ScaledForecastPoint | null>(() => {
    const idx = this.hoveredIndex();
    if (idx === null) return null;
    const pts = this.scaledPoints();
    return pts[idx] || null;
  });

  tooltipX(pointX: number): number {
    return Math.max(70, Math.min(pointX, 530));
  }

  hasDailyMovement(pt: ForecastDailyPoint): boolean {
    return pt.inflow !== '0.00' || pt.outflow !== '0.00';
  }

  simulateData(): void {
    const now = new Date();
    const mockPoints: ForecastDailyPoint[] = [];
    let running = 2850.0;

    const months = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'];

    for (let i = 0; i < 31; i++) {
      const d = new Date(now);
      d.setDate(now.getDate() + i);

      let inflow = 0;
      let outflow = 0;

      // Fatura no dia 10
      if (i === 10) {
        outflow = 1200.0;
      }
      // Entrada no dia 20
      if (i === 20) {
        inflow = 3500.0;
      }

      running = running + inflow - outflow - (i > 0 ? 35.0 : 0);

      mockPoints.push({
        date: d.toISOString().split('T')[0],
        label: `${d.getDate().toString().padStart(2, '0')}/${months[d.getMonth()]}`,
        day_number: d.getDate(),
        projected_balance: running.toFixed(2),
        inflow: inflow.toFixed(2),
        outflow: outflow.toFixed(2),
        is_negative: running < 0,
      });
    }

    this.simulatedForecast.set({
      start_date: mockPoints[0].date,
      end_date: mockPoints[30].date,
      initial_balance: '2850.00',
      thirty_days_balance: running.toFixed(2),
      end_of_month_balance: (running + 500).toFixed(2),
      lowest_projected_balance: '1420.00',
      has_deficit_risk: false,
      deficit_date: null,
      points: mockPoints,
      safe_to_spend: {
        daily_amount: '58.50',
        days_remaining: 18,
        disposable_month_amount: '1053.00',
        upcoming_bills_amount: '1200.00',
        current_checking_balance: '2850.00',
        status: 'HEALTHY',
        message: 'Ritmo diário seguro sem comprometer faturas ou saldo de fechamento.',
      },
    });
  }

  resetSimulation(): void {
    this.simulatedForecast.set(null);
    this.hoveredIndex.set(null);
  }
}
