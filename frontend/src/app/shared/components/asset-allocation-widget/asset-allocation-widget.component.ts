import {
  Component,
  computed,
  input,
  output,
  signal,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { PrivacyCurrencyPipe } from '../../../core/pipes/privacy-currency.pipe';
import { IconComponent } from '../icon/icon.component';
import {
  AssetAllocationSummary,
  AssetAllocationTargetUpdate,
  AssetClassBreakdown,
} from '../../../core/models/asset-allocation.model';

@Component({
  selector: 'app-asset-allocation-widget',
  standalone: true,
  imports: [CommonModule, FormsModule, PrivacyCurrencyPipe, IconComponent],
  template: `
    <div class="allocation-card">
      <!-- Cabeçalho Executivo -->
      <div class="allocation-header">
        <div class="header-titles">
          <div class="title-row">
            <span class="widget-title">Alocação de Ativos & Benchmark CDI</span>
            <span class="badge-ghostfolio">Ghostfolio Style</span>
          </div>
          <p class="widget-subtitle">
            Rebalanceamento da carteira e rentabilidade dos cofrinhos contra o CDI
          </p>
        </div>

        <button class="btn-text-link" (click)="openEditModal()" title="Configurar metas de alocação e CDI">
          <app-icon name="sliders" [size]="14" />
          <span>Ajustar Metas</span>
        </button>
      </div>

      @if (isLoading()) {
        <div class="allocation-skeleton"></div>
      } @else if (allocation()) {
        <!-- Resumo Patrimonial e Barras de Alocação Real vs Alvo -->
        <div class="allocation-visual-box">
          <div class="visual-header">
            <div class="patrimony-stat">
              <span class="stat-label">Patrimônio Líquido em Ativos</span>
              <span class="stat-value currency-val tabular-nums">
                {{ totalPatrimony() | privacyCurrency }}
              </span>
            </div>

            <div class="legend-row">
              <span class="legend-item checking">
                <span class="legend-dot dot-checking"></span>
                Caixa ({{ checkingTarget() }}%)
              </span>
              <span class="legend-item savings">
                <span class="legend-dot dot-savings"></span>
                Cofrinhos ({{ savingsTarget() }}%)
              </span>
              <span class="legend-item investment">
                <span class="legend-dot dot-investment"></span>
                Investimentos ({{ investmentTarget() }}%)
              </span>
            </div>
          </div>

          <!-- Barra 1: Distribuição Atual Real -->
          <div class="bar-group">
            <div class="bar-label-row">
              <span class="bar-name">Distribuição Atual (Real)</span>
              <span class="bar-desc">Posição de hoje</span>
            </div>
            <div class="multi-progress-bar">
              @if (totalPatrimony() === 0) {
                <div class="empty-bar-fill">Sem saldo em ativos cadastrado</div>
              } @else {
                <div
                  class="progress-slice slice-checking"
                  [style.width.%]="checkingClass()?.current_pct || 0"
                  [title]="'Caixa: ' + (checkingClass()?.current_pct || 0) + '%'"
                ></div>
                <div
                  class="progress-slice slice-savings"
                  [style.width.%]="savingsClass()?.current_pct || 0"
                  [title]="'Cofrinhos: ' + (savingsClass()?.current_pct || 0) + '%'"
                ></div>
                <div
                  class="progress-slice slice-investment"
                  [style.width.%]="investmentClass()?.current_pct || 0"
                  [title]="'Investimentos: ' + (investmentClass()?.current_pct || 0) + '%'"
                ></div>
              }
            </div>
          </div>

          <!-- Barra 2: Meta Alvo Desejada -->
          <div class="bar-group">
            <div class="bar-label-row">
              <span class="bar-name">Alocação Alvo (Meta)</span>
              <span class="bar-desc">Objetivo planejado</span>
            </div>
            <div class="multi-progress-bar target-bar">
              <div
                class="progress-slice slice-checking opacity-75"
                [style.width.%]="checkingTarget()"
                [title]="'Alvo Caixa: ' + checkingTarget() + '%'"
              ></div>
              <div
                class="progress-slice slice-savings opacity-75"
                [style.width.%]="savingsTarget()"
                [title]="'Alvo Cofrinhos: ' + savingsTarget() + '%'"
              ></div>
              <div
                class="progress-slice slice-investment opacity-75"
                [style.width.%]="investmentTarget()"
                [title]="'Alvo Investimentos: ' + investmentTarget() + '%'"
              ></div>
            </div>
          </div>
        </div>

        <!-- Grade com os 3 Cards de Classes e Rebalanceamento -->
        <div class="classes-grid">
          @for (cls of allocation()?.classes; track cls.asset_class) {
            <div class="class-card" [class]="'border-' + cls.asset_class.toLowerCase()">
              <div class="class-card-top">
                <div class="class-title-wrap">
                  <span class="class-dot" [class]="'bg-' + cls.asset_class.toLowerCase()"></span>
                  <span class="class-label">{{ cls.label }}</span>
                </div>
                <span class="status-badge" [class]="'badge-' + cls.status.toLowerCase()">
                  @if (cls.status === 'BALANCED') {
                    <app-icon name="check" [size]="12" />
                    <span>No Alvo</span>
                  } @else if (cls.status === 'UNDERWEIGHT') {
                    <app-icon name="arrow-up" [size]="12" />
                    <span>Aportar</span>
                  } @else {
                    <app-icon name="arrow-down" [size]="12" />
                    <span>Excedente</span>
                  }
                </span>
              </div>

              <div class="class-amounts">
                <div class="amount-primary currency-val tabular-nums">
                  {{ cls.current_amount | privacyCurrency }}
                </div>
                <div class="amount-pcts">
                  <span class="current-pct-text tabular-nums">{{ cls.current_pct }}%</span>
                  <span class="text-separator">•</span>
                  <span class="target-pct-text">Meta: {{ cls.target_pct }}% ({{ cls.target_amount | privacyCurrency }})</span>
                </div>
              </div>

              <div class="rebalance-footer">
                @if (cls.status === 'BALANCED') {
                  <span class="rebalance-text text-balanced">
                    Carteira equilibrada (dentro de 2% do alvo)
                  </span>
                } @else if (cls.status === 'UNDERWEIGHT') {
                  <span class="rebalance-text text-underweight">
                    Aporte recomendado: +{{ cls.rebalance_diff | privacyCurrency }}
                  </span>
                } @else {
                  <span class="rebalance-text text-overweight">
                    Excesso de peso: {{ cls.rebalance_diff | privacyCurrency }}
                  </span>
                }
              </div>
            </div>
          }
        </div>

        <!-- Card de Benchmark CDI dos Cofrinhos (Ghostfolio Benchmark) -->
        @if (cdiSummary()) {
          <div class="cdi-benchmark-card">
            <div class="cdi-header">
              <div class="cdi-title-row">
                <div class="cdi-icon-badge">
                  <app-icon name="trending-up" [size]="16" />
                </div>
                <div>
                  <h4 class="cdi-title">Benchmark de Rentabilidade (Cofrinhos / 100% CDI)</h4>
                  <p class="cdi-subtitle">
                    Taxa CDI: <span class="highlight-cdi">{{ cdiSummary()?.annual_rate_pct }}% a.a.</span>
                    ({{ cdiSummary()?.monthly_rate_pct }}% a.m. • {{ cdiSummary()?.daily_rate_pct }}% ao dia útil)
                  </p>
                </div>
              </div>

              <div class="cdi-real-yield-badge" title="Ganho real líquido acima da inflação anual projetada de 4.0%">
                <span class="real-label">Ganho Real s/ Inflação</span>
                <span class="real-val tabular-nums">+{{ cdiSummary()?.real_annual_yield_pct }}% a.a.</span>
              </div>
            </div>

            <div class="cdi-metrics-grid">
              <div class="cdi-metric">
                <span class="metric-title">Saldo Aplicado em Cofrinhos</span>
                <span class="metric-number currency-val tabular-nums">
                  {{ cdiSummary()?.savings_balance || 0 | privacyCurrency }}
                </span>
                <span class="metric-sub">Reserva de emergência & caixinhas</span>
              </div>

              <div class="cdi-metric">
                <span class="metric-title">Rendimento Estimado / Mês</span>
                <span class="metric-number text-success currency-val tabular-nums">
                  +{{ cdiSummary()?.monthly_estimated_yield || 0 | privacyCurrency }}
                </span>
                <span class="metric-sub">~{{ cdiSummary()?.daily_estimated_yield || 0 | privacyCurrency }} por dia útil</span>
              </div>

              <div class="cdi-metric">
                <span class="metric-title">Rendimento Estimado / Ano</span>
                <span class="metric-number text-success currency-val tabular-nums">
                  +{{ cdiSummary()?.annual_estimated_yield || 0 | privacyCurrency }}
                </span>
                <span class="metric-sub">Projeção a 100% do CDI atual</span>
              </div>

              <div class="cdi-metric highlight-metric">
                <span class="metric-title">Vantagem sobre a Poupança</span>
                <span class="metric-number text-emerald currency-val tabular-nums">
                  +{{ cdiSummary()?.extra_vs_poupanca_annual || 0 | privacyCurrency }} / ano
                </span>
                <span class="metric-sub">Poupança renderia apenas {{ cdiSummary()?.poupanca_annual_yield || 0 | privacyCurrency }}</span>
              </div>
            </div>
          </div>
        }
      }

      <!-- Modal de Edição de Metas de Alocação e Taxa do CDI -->
      @if (isModalOpen()) {
        <div class="modal-overlay" (click)="closeEditModal()">
          <div class="modal-dialog" (click)="$event.stopPropagation()">
            <div class="modal-header">
              <div class="modal-title-group">
                <h3 class="modal-title">Metas de Alocação Patrimonial</h3>
                <p class="modal-desc">
                  Defina os percentuais ideais entre classes e a taxa de referência do CDI
                </p>
              </div>
              <button class="btn-close" (click)="closeEditModal()" title="Fechar">
                <app-icon name="x" [size]="18" />
              </button>
            </div>

            <div class="modal-body">
              <div class="form-group">
                <label class="form-label" for="checkingPct">
                  <span>Caixa & Liquidez Imediata (%)</span>
                  <span class="text-hint">Conta corrente, carteira e dinheiro livre</span>
                </label>
                <div class="input-suffix-wrap">
                  <input
                    id="checkingPct"
                    type="number"
                    step="1"
                    min="0"
                    max="100"
                    [(ngModel)]="editCheckingPct"
                    class="form-control"
                  />
                  <span class="suffix">%</span>
                </div>
              </div>

              <div class="form-group">
                <label class="form-label" for="savingsPct">
                  <span>Cofrinhos & Reserva de Emergência (%)</span>
                  <span class="text-hint">Caixinhas Mercado Pago, Inter e Nubank</span>
                </label>
                <div class="input-suffix-wrap">
                  <input
                    id="savingsPct"
                    type="number"
                    step="1"
                    min="0"
                    max="100"
                    [(ngModel)]="editSavingsPct"
                    class="form-control"
                  />
                  <span class="suffix">%</span>
                </div>
              </div>

              <div class="form-group">
                <label class="form-label" for="investmentPct">
                  <span>Investimentos & Longo Prazo (%)</span>
                  <span class="text-hint">Ações, FIIs, Tesouro e Renda Fixa</span>
                </label>
                <div class="input-suffix-wrap">
                  <input
                    id="investmentPct"
                    type="number"
                    step="1"
                    min="0"
                    max="100"
                    [(ngModel)]="editInvestmentPct"
                    class="form-control"
                  />
                  <span class="suffix">%</span>
                </div>
              </div>

              <div class="form-group cdi-field-group">
                <label class="form-label" for="cdiRate">
                  <span>Taxa Anual do CDI (% a.a.)</span>
                  <span class="text-hint">Taxa Selic/CDI oficial para cálculos de rendimento</span>
                </label>
                <div class="input-suffix-wrap">
                  <input
                    id="cdiRate"
                    type="number"
                    step="0.25"
                    min="0"
                    max="100"
                    [(ngModel)]="editCdiRate"
                    class="form-control"
                  />
                  <span class="suffix">% a.a.</span>
                </div>
              </div>

              <!-- Indicador de Validação de Soma (Regra dos 100%) -->
              <div class="sum-validation-bar" [class.sum-valid]="isSumValid()" [class.sum-invalid]="!isSumValid()">
                <div class="sum-status">
                  @if (isSumValid()) {
                    <app-icon name="check" [size]="16" />
                    <span>Soma Exata: {{ totalEditSum() }}% (Válido para salvar)</span>
                  } @else {
                    <app-icon name="alert-triangle" [size]="16" />
                    <span>
                      Soma Atual: {{ totalEditSum() }}% •
                      @if (totalEditSum() < 100) {
                        Faltam {{ (100 - totalEditSum()).toFixed(1) }}%
                      } @else {
                        Excesso de {{ (totalEditSum() - 100).toFixed(1) }}%
                      }
                      (A soma deve ser exatamente 100%)
                    </span>
                  }
                </div>
              </div>
            </div>

            <div class="modal-footer">
              <button class="btn btn-secondary" (click)="closeEditModal()">
                Cancelar
              </button>
              <button
                class="btn btn-primary"
                [disabled]="!isSumValid()"
                (click)="saveTargets()"
              >
                Salvar Metas
              </button>
            </div>
          </div>
        </div>
      }
    </div>
  `,
  styles: `
    .allocation-card {
      background: #09090b; /* zinc-950 */
      border: 1px solid #27272a; /* zinc-800 */
      border-radius: 16px;
      padding: 20px;
      margin-bottom: 24px;
      display: flex;
      flex-direction: column;
      gap: 18px;
    }

    .allocation-header {
      display: flex;
      align-items: flex-start;
      justify-content: space-between;
      gap: 12px;
      flex-wrap: wrap;
    }

    .header-titles {
      display: flex;
      flex-direction: column;
      gap: 4px;
    }

    .title-row {
      display: flex;
      align-items: center;
      gap: 8px;
    }

    .widget-title {
      font-size: 1rem;
      font-weight: 600;
      color: #fafafa; /* zinc-50 */
    }

    .badge-ghostfolio {
      font-size: 0.6875rem;
      font-weight: 600;
      text-transform: uppercase;
      letter-spacing: 0.05em;
      padding: 2px 8px;
      border-radius: 9999px;
      background: rgba(139, 92, 246, 0.12); /* violeta sutil */
      color: #c4b5fd;
      border: 1px solid rgba(139, 92, 246, 0.25);
    }

    .widget-subtitle {
      font-size: 0.8125rem;
      color: #a1a1aa; /* zinc-400 */
      margin: 0;
    }

    .btn-text-link {
      display: inline-flex;
      align-items: center;
      gap: 6px;
      background: transparent;
      border: 1px solid #27272a;
      border-radius: 8px;
      color: #d4d4d8;
      font-size: 0.75rem;
      font-weight: 500;
      padding: 6px 10px;
      cursor: pointer;
      transition: all 0.15s ease;
    }

    .btn-text-link:hover {
      background: #18181b;
      color: #fafafa;
      border-color: #3f3f46;
    }

    .allocation-skeleton {
      height: 160px;
      background: #18181b;
      border-radius: 12px;
      animation: pulse 1.8s infinite ease-in-out;
    }

    @keyframes pulse {
      0%, 100% { opacity: 0.6; }
      50% { opacity: 0.3; }
    }

    /* Resumo e Barras */
    .allocation-visual-box {
      background: #121215;
      border: 1px solid #27272a;
      border-radius: 12px;
      padding: 16px;
      display: flex;
      flex-direction: column;
      gap: 14px;
    }

    .visual-header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      flex-wrap: wrap;
      gap: 12px;
    }

    .patrimony-stat {
      display: flex;
      flex-direction: column;
      gap: 2px;
    }

    .stat-label {
      font-size: 0.75rem;
      color: #71717a;
      text-transform: uppercase;
      letter-spacing: 0.04em;
    }

    .stat-value {
      font-size: 1.25rem;
      font-weight: 700;
      color: #fafafa;
    }

    .legend-row {
      display: flex;
      align-items: center;
      gap: 14px;
      flex-wrap: wrap;
    }

    .legend-item {
      display: inline-flex;
      align-items: center;
      gap: 6px;
      font-size: 0.75rem;
      color: #a1a1aa;
    }

    .legend-dot {
      width: 8px;
      height: 8px;
      border-radius: 50%;
    }

    .dot-checking, .bg-checking, .slice-checking {
      background: #38bdf8; /* sky-400 */
    }

    .dot-savings, .bg-savings, .slice-savings {
      background: #10b981; /* emerald-500 */
    }

    .dot-investment, .bg-investment, .slice-investment {
      background: #a855f7; /* purple-500 */
    }

    .border-checking { border-top: 3px solid #38bdf8; }
    .border-savings { border-top: 3px solid #10b981; }
    .border-investment { border-top: 3px solid #a855f7; }

    .bar-group {
      display: flex;
      flex-direction: column;
      gap: 6px;
    }

    .bar-label-row {
      display: flex;
      align-items: center;
      justify-content: space-between;
      font-size: 0.6875rem;
    }

    .bar-name {
      color: #d4d4d8;
      font-weight: 500;
    }

    .bar-desc {
      color: #71717a;
    }

    .multi-progress-bar {
      display: flex;
      height: 12px;
      width: 100%;
      border-radius: 6px;
      overflow: hidden;
      background: #18181b;
      border: 1px solid #27272a;
    }

    .progress-slice {
      height: 100%;
      transition: width 0.4s ease;
    }

    .target-bar {
      height: 8px;
      opacity: 0.9;
    }

    .opacity-75 {
      opacity: 0.75;
    }

    .empty-bar-fill {
      width: 100%;
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 0.6875rem;
      color: #71717a;
    }

    /* Cards das 3 Classes */
    .classes-grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(240px, 1fr));
      gap: 12px;
    }

    .class-card {
      background: #121215;
      border: 1px solid #27272a;
      border-radius: 12px;
      padding: 14px;
      display: flex;
      flex-direction: column;
      gap: 10px;
    }

    .class-card-top {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 8px;
    }

    .class-title-wrap {
      display: flex;
      align-items: center;
      gap: 8px;
    }

    .class-dot {
      width: 8px;
      height: 8px;
      border-radius: 50%;
    }

    .class-label {
      font-size: 0.8125rem;
      font-weight: 600;
      color: #f4f4f5;
    }

    .status-badge {
      display: inline-flex;
      align-items: center;
      gap: 4px;
      font-size: 0.6875rem;
      font-weight: 600;
      padding: 2px 7px;
      border-radius: 6px;
    }

    .badge-balanced {
      background: rgba(16, 185, 129, 0.12);
      color: #34d399;
      border: 1px solid rgba(16, 185, 129, 0.25);
    }

    .badge-underweight {
      background: rgba(245, 158, 11, 0.12);
      color: #fbbf24;
      border: 1px solid rgba(245, 158, 11, 0.25);
    }

    .badge-overweight {
      background: rgba(56, 189, 248, 0.12);
      color: #7dd3fc;
      border: 1px solid rgba(56, 189, 248, 0.25);
    }

    .class-amounts {
      display: flex;
      flex-direction: column;
      gap: 2px;
    }

    .amount-primary {
      font-size: 1.125rem;
      font-weight: 700;
      color: #fafafa;
    }

    .amount-pcts {
      display: flex;
      align-items: center;
      gap: 6px;
      font-size: 0.75rem;
    }

    .current-pct-text {
      color: #fafafa;
      font-weight: 600;
    }

    .text-separator {
      color: #52525b;
    }

    .target-pct-text {
      color: #a1a1aa;
    }

    .rebalance-footer {
      font-size: 0.75rem;
      padding-top: 6px;
      border-top: 1px solid #1f1f23;
    }

    .text-balanced {
      color: #34d399;
    }

    .text-underweight {
      color: #fbbf24;
      font-weight: 500;
    }

    .text-overweight {
      color: #7dd3fc;
      font-weight: 500;
    }

    /* CDI Benchmark Card */
    .cdi-benchmark-card {
      background: #141418;
      border: 1px solid #27272a;
      border-radius: 12px;
      padding: 16px;
      display: flex;
      flex-direction: column;
      gap: 14px;
    }

    .cdi-header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      flex-wrap: wrap;
      gap: 12px;
    }

    .cdi-title-row {
      display: flex;
      align-items: center;
      gap: 10px;
    }

    .cdi-icon-badge {
      width: 32px;
      height: 32px;
      border-radius: 8px;
      background: rgba(16, 185, 129, 0.12);
      color: #10b981;
      display: flex;
      align-items: center;
      justify-content: center;
    }

    .cdi-title {
      font-size: 0.875rem;
      font-weight: 600;
      color: #fafafa;
      margin: 0;
    }

    .cdi-subtitle {
      font-size: 0.75rem;
      color: #a1a1aa;
      margin: 0;
    }

    .highlight-cdi {
      color: #34d399;
      font-weight: 600;
    }

    .cdi-real-yield-badge {
      display: flex;
      flex-direction: column;
      align-items: flex-end;
      background: rgba(16, 185, 129, 0.08);
      border: 1px solid rgba(16, 185, 129, 0.2);
      border-radius: 8px;
      padding: 4px 10px;
    }

    .real-label {
      font-size: 0.625rem;
      text-transform: uppercase;
      color: #a1a1aa;
    }

    .real-val {
      font-size: 0.8125rem;
      font-weight: 700;
      color: #34d399;
    }

    .cdi-metrics-grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
      gap: 10px;
    }

    .cdi-metric {
      background: #09090b;
      border: 1px solid #27272a;
      border-radius: 10px;
      padding: 12px;
      display: flex;
      flex-direction: column;
      gap: 2px;
    }

    .highlight-metric {
      background: rgba(16, 185, 129, 0.05);
      border-color: rgba(16, 185, 129, 0.3);
    }

    .metric-title {
      font-size: 0.6875rem;
      color: #71717a;
      text-transform: uppercase;
      letter-spacing: 0.03em;
    }

    .metric-number {
      font-size: 1rem;
      font-weight: 700;
      color: #fafafa;
    }

    .text-success {
      color: #34d399;
    }

    .text-emerald {
      color: #10b981;
    }

    .metric-sub {
      font-size: 0.6875rem;
      color: #a1a1aa;
    }

    /* Modal */
    .modal-overlay {
      position: fixed;
      inset: 0;
      background: rgba(0, 0, 0, 0.75);
      backdrop-filter: blur(4px);
      z-index: 1000;
      display: flex;
      align-items: center;
      justify-content: center;
      padding: 16px;
    }

    .modal-dialog {
      background: #18181b;
      border: 1px solid #27272a;
      border-radius: 16px;
      width: 100%;
      max-width: 480px;
      overflow: hidden;
      display: flex;
      flex-direction: column;
    }

    .modal-header {
      padding: 18px 20px;
      border-bottom: 1px solid #27272a;
      display: flex;
      align-items: flex-start;
      justify-content: space-between;
    }

    .modal-title {
      font-size: 1.0625rem;
      font-weight: 600;
      color: #fafafa;
      margin: 0;
    }

    .modal-desc {
      font-size: 0.8125rem;
      color: #a1a1aa;
      margin: 4px 0 0 0;
    }

    .btn-close {
      background: transparent;
      border: none;
      color: #71717a;
      cursor: pointer;
      padding: 4px;
      border-radius: 6px;
    }

    .btn-close:hover {
      color: #fafafa;
      background: #27272a;
    }

    .modal-body {
      padding: 20px;
      display: flex;
      flex-direction: column;
      gap: 16px;
    }

    .form-group {
      display: flex;
      flex-direction: column;
      gap: 6px;
    }

    .form-label {
      display: flex;
      flex-direction: column;
      gap: 2px;
      font-size: 0.8125rem;
      font-weight: 500;
      color: #f4f4f5;
    }

    .text-hint {
      font-size: 0.6875rem;
      color: #71717a;
      font-weight: normal;
    }

    .input-suffix-wrap {
      position: relative;
      display: flex;
      align-items: center;
    }

    .form-control {
      width: 100%;
      background: #09090b;
      border: 1px solid #27272a;
      border-radius: 8px;
      padding: 10px 42px 10px 12px;
      color: #fafafa;
      font-size: 0.875rem;
      font-family: inherit;
    }

    .form-control:focus {
      outline: none;
      border-color: #3b82f6;
    }

    .suffix {
      position: absolute;
      right: 12px;
      color: #71717a;
      font-size: 0.8125rem;
      pointer-events: none;
    }

    .cdi-field-group {
      padding-top: 10px;
      border-top: 1px solid #27272a;
    }

    .sum-validation-bar {
      padding: 10px 12px;
      border-radius: 8px;
      font-size: 0.75rem;
      font-weight: 500;
    }

    .sum-valid {
      background: rgba(16, 185, 129, 0.12);
      border: 1px solid rgba(16, 185, 129, 0.3);
      color: #34d399;
    }

    .sum-invalid {
      background: rgba(239, 68, 68, 0.12);
      border: 1px solid rgba(239, 68, 68, 0.3);
      color: #f87171;
    }

    .sum-status {
      display: flex;
      align-items: center;
      gap: 8px;
    }

    .modal-footer {
      padding: 14px 20px;
      border-top: 1px solid #27272a;
      display: flex;
      justify-content: flex-end;
      gap: 10px;
    }

    .btn {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      gap: 8px;
      padding: 8px 16px;
      border-radius: 8px;
      font-size: 0.8125rem;
      font-weight: 500;
      cursor: pointer;
      transition: all 0.15s ease;
    }

    .btn-secondary {
      background: #27272a;
      color: #d4d4d8;
      border: 1px solid #3f3f46;
    }

    .btn-secondary:hover {
      background: #3f3f46;
      color: #fafafa;
    }

    .btn-primary {
      background: #2563eb;
      color: #ffffff;
      border: none;
    }

    .btn-primary:hover:not(:disabled) {
      background: #1d4ed8;
    }

    .btn-primary:disabled {
      opacity: 0.5;
      cursor: not-allowed;
    }
  `,
})
export class AssetAllocationWidgetComponent {
  allocation = input<AssetAllocationSummary | null>(null);
  isLoading = input<boolean>(false);

  onUpdateTargets = output<AssetAllocationTargetUpdate>();

  isModalOpen = signal<boolean>(false);

  editCheckingPct = signal<number>(20);
  editSavingsPct = signal<number>(40);
  editInvestmentPct = signal<number>(40);
  editCdiRate = signal<number>(11.25);

  totalPatrimony = computed(() => this.allocation()?.total_patrimony || 0);
  cdiSummary = computed(() => this.allocation()?.cdi_benchmark || null);
  targets = computed(() => this.allocation()?.targets || null);

  checkingClass = computed<AssetClassBreakdown | undefined>(() =>
    this.allocation()?.classes.find((c) => c.asset_class === 'CHECKING')
  );

  savingsClass = computed<AssetClassBreakdown | undefined>(() =>
    this.allocation()?.classes.find((c) => c.asset_class === 'SAVINGS')
  );

  investmentClass = computed<AssetClassBreakdown | undefined>(() =>
    this.allocation()?.classes.find((c) => c.asset_class === 'INVESTMENT')
  );

  checkingTarget = computed(() => this.targets()?.checking_target_pct ?? 20);
  savingsTarget = computed(() => this.targets()?.savings_target_pct ?? 40);
  investmentTarget = computed(() => this.targets()?.investment_target_pct ?? 40);

  totalEditSum = computed(() => {
    const sum =
      (Number(this.editCheckingPct()) || 0) +
      (Number(this.editSavingsPct()) || 0) +
      (Number(this.editInvestmentPct()) || 0);
    return Math.round(sum * 100) / 100;
  });

  isSumValid = computed(() => Math.abs(this.totalEditSum() - 100) < 0.01);

  openEditModal(): void {
    const currentTargets = this.targets();
    if (currentTargets) {
      this.editCheckingPct.set(Number(currentTargets.checking_target_pct));
      this.editSavingsPct.set(Number(currentTargets.savings_target_pct));
      this.editInvestmentPct.set(Number(currentTargets.investment_target_pct));
      this.editCdiRate.set(Number(currentTargets.cdi_annual_rate));
    }
    this.isModalOpen.set(true);
  }

  closeEditModal(): void {
    this.isModalOpen.set(false);
  }

  saveTargets(): void {
    if (!this.isSumValid()) return;

    const payload: AssetAllocationTargetUpdate = {
      checking_target_pct: Number(this.editCheckingPct()),
      savings_target_pct: Number(this.editSavingsPct()),
      investment_target_pct: Number(this.editInvestmentPct()),
      cdi_annual_rate: Number(this.editCdiRate()),
    };

    this.onUpdateTargets.emit(payload);
    this.closeEditModal();
  }
}
