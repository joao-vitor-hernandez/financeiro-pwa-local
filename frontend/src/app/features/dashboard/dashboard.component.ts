import { Component, inject, OnInit, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import { ApiService } from '../../core/services/api.service';
import { FinanceSyncService } from '../../core/services/finance-sync.service';
import { DashboardSummary } from '../../core/models/summary.model';
import { Transaction } from '../../core/models/transaction.model';
import { CardExpensesResponse, CategoryExpenseSegment } from '../../core/models/card-expenses.model';
import { PrivacyCurrencyPipe } from '../../core/pipes/privacy-currency.pipe';
import { IconComponent } from '../../shared/components/icon/icon.component';
import { DonutChartComponent } from '../../shared/components/donut-chart/donut-chart.component';

@Component({
  selector: 'app-dashboard',
  standalone: true,
  imports: [CommonModule, RouterLink, PrivacyCurrencyPipe, IconComponent, DonutChartComponent],
  template: `
    <div class="dashboard-page">
      <!-- Cabeçalho de Boas-Vindas & Ações Rápidas -->
      <section class="welcome-section">
        <div>
          <h1 class="welcome-title">Visão Geral</h1>
          <p class="welcome-subtitle">Posição financeira consolidada</p>
        </div>

        <button class="btn btn-primary quick-action-btn" (click)="syncService.openQuickAdd()">
          <app-icon name="plus" [size]="18" />
          <span>Lançar</span>
        </button>
      </section>

      <!-- Grade de Métricas Executivas (4 Cards Contábeis Sóbrios) -->
      <section class="metrics-grid">
        <!-- Saldo Líquido em Contas Correntes -->
        <div class="metric-card">
          <div class="metric-header">
            <span class="metric-label">Saldo Disponível</span>
            <div class="metric-icon-wrap neutral">
              <app-icon name="wallet" [size]="18" />
            </div>
          </div>
          <div class="metric-value currency-val">
            {{ summary()?.total_checking_balance || '0.00' | privacyCurrency }}
          </div>
          <span class="metric-hint">Contas correntes e carteiras</span>
        </div>

        <!-- Fatura Aberta Atual -->
        <div class="metric-card">
          <div class="metric-header">
            <span class="metric-label">Fatura Aberta</span>
            <div class="metric-icon-wrap warning">
              <app-icon name="credit-card" [size]="18" />
            </div>
          </div>
          <div class="metric-value currency-val text-expense">
            {{ summary()?.current_card_bill || '0.00' | privacyCurrency }}
          </div>
          <span class="metric-hint">Vencimento do mês vigente</span>
        </div>

        <!-- Passivo Total em Cartões (Todas as Parcelas Futuras) -->
        <div class="metric-card">
          <div class="metric-header">
            <span class="metric-label">Passivo Total Cartões</span>
            <div class="metric-icon-wrap neutral">
              <app-icon name="repeat" [size]="18" />
            </div>
          </div>
          <div class="metric-value currency-val">
            {{ summary()?.total_credit_card_debt || '0.00' | privacyCurrency }}
          </div>
          <span class="metric-hint">Fatura atual + parcelamentos futuros</span>
        </div>

        <!-- Resultado do Mês (Entradas - Saídas) -->
        <div class="metric-card">
          <div class="metric-header">
            <span class="metric-label">Resultado do Mês</span>
            <div
              class="metric-icon-wrap"
              [class.income]="isResultPositive()"
              [class.expense]="!isResultPositive()"
            >
              <app-icon [name]="isResultPositive() ? 'arrow-up-right' : 'arrow-down-left'" [size]="18" />
            </div>
          </div>
          <div
            class="metric-value currency-val"
            [class.text-income]="isResultPositive()"
            [class.text-expense]="!isResultPositive()"
          >
            {{ summary()?.monthly_result || '0.00' | privacyCurrency }}
          </div>
          <div class="monthly-breakdown">
            <span class="breakdown-item text-income">
              +{{ summary()?.monthly_income || '0.00' | privacyCurrency }}
            </span>
            <span class="breakdown-separator">•</span>
            <span class="breakdown-item text-muted">
              -{{ summary()?.monthly_expenses || '0.00' | privacyCurrency }}
            </span>
          </div>
        </div>
      </section>

      <!-- Gráfico Donut: Distribuição Dinâmica de Gastos nos Cartões -->
      <section class="chart-section">
        <div class="section-header">
          <div>
            <h2 class="section-title">Gastos nos Cartões por Sessão</h2>
            <p class="section-subtitle">Visualização dinâmica por área de gasto</p>
          </div>
          <span class="period-badge">{{ cardExpenses()?.period || 'Mês Atual' }}</span>
        </div>

        <div class="chart-card">
          @if (isChartLoading()) {
            <div class="chart-skeleton"></div>
          } @else if (chartSegments().length === 0) {
            <div class="empty-chart">
              <div class="empty-chart-icon">
                <app-icon name="chart" [size]="28" />
              </div>
              <p class="empty-chart-title">Nenhum gasto em cartões registrado</p>
              <p class="empty-chart-subtitle">
                Conecte seu banco ou faça um lançamento manual com cartão para visualizar a divisão.
              </p>
              <button class="btn btn-secondary demo-btn" (click)="loadSampleChartData()">
                <app-icon name="repeat" [size]="14" />
                <span>Simular Exemplo Interativo</span>
              </button>
            </div>
          } @else {
            <app-donut-chart
              [data]="chartSegments()"
              [totalValue]="cardExpenses()?.total_value || null"
              [size]="240"
              [strokeWidth]="26"
              defaultLabel="Fatura Cartões"
            />
          }
        </div>
      </section>

      <!-- Transações Recentes -->
      <section class="recent-section">
        <div class="section-header">
          <h2 class="section-title">Últimas Transações</h2>
          <a routerLink="/transactions" class="view-all-link">
            <span>Ver extrato</span>
            <app-icon name="chevron-right" [size]="14" />
          </a>
        </div>

        @if (isLoading()) {
          <div class="loading-skeleton">
            <div class="skeleton-row"></div>
            <div class="skeleton-row"></div>
            <div class="skeleton-row"></div>
          </div>
        } @else if (recentTransactions().length === 0) {
          <div class="empty-state">
            <div class="empty-icon-box">
              <app-icon name="list" [size]="28" />
            </div>
            <p class="empty-title">Nenhum lançamento recente</p>
            <p class="empty-subtitle">
              Seus lançamentos manuais ou sincronizados pelo Open Finance aparecerão aqui.
            </p>
            <button class="btn btn-secondary mt-12" (click)="syncService.openQuickAdd()">
              <app-icon name="plus" [size]="16" />
              <span>Fazer primeiro lançamento</span>
            </button>
          </div>
        } @else {
          <div class="transactions-list">
            @for (tx of recentTransactions(); track tx.id) {
              <div class="tx-item">
                <div class="tx-leading">
                  <div
                    class="tx-icon"
                    [class.icon-income]="tx.type === 'INCOME'"
                    [class.icon-expense]="tx.type === 'EXPENSE' && !tx.is_transfer"
                    [class.icon-transfer]="tx.is_transfer"
                  >
                    @if (tx.is_transfer) {
                      <app-icon name="repeat" [size]="16" />
                    } @else if (tx.type === 'INCOME') {
                      <app-icon name="arrow-up-right" [size]="16" />
                    } @else {
                      <app-icon name="arrow-down-left" [size]="16" />
                    }
                  </div>
                  <div class="tx-details">
                    <span class="tx-desc">{{ tx.description }}</span>
                    <span class="tx-meta">
                      {{ tx.transaction_date | date: 'dd/MM' }}
                      @if (tx.installment_number && tx.total_installments && tx.total_installments > 1) {
                        • Parcela {{ tx.installment_number }}/{{ tx.total_installments }}
                      }
                    </span>
                  </div>
                </div>

                <div
                  class="tx-amount currency-val"
                  [class.text-income]="tx.type === 'INCOME'"
                  [class.text-muted]="tx.is_transfer"
                >
                  {{ tx.type === 'INCOME' ? '+' : '-' }}{{ tx.amount | privacyCurrency }}
                </div>
              </div>
            }
          </div>
        }
      </section>
    </div>
  `,
  styles: `
    .dashboard-page {
      padding: 18px 16px 40px;
      max-width: 768px;
      margin: 0 auto;
    }

    .welcome-section {
      display: flex;
      align-items: center;
      justify-content: space-between;
      margin-bottom: 24px;

      .welcome-title {
        font-size: 22px;
        font-weight: 700;
        letter-spacing: -0.03em;
        color: var(--text-primary);
      }

      .welcome-subtitle {
        font-size: 13px;
        color: var(--text-secondary);
        margin-top: 2px;
      }

      .quick-action-btn {
        min-height: 40px;
        padding: 0 14px;
        font-size: 13px;
      }
    }

    .metrics-grid {
      display: grid;
      grid-template-columns: repeat(2, 1fr);
      gap: 12px;
      margin-bottom: 28px;

      @media (max-width: 480px) {
        grid-template-columns: 1fr;
      }
    }

    .metric-card {
      background-color: var(--bg-surface);
      border: 1px solid var(--border-subtle);
      border-radius: var(--radius-lg);
      padding: 16px;
      display: flex;
      flex-direction: column;
      gap: 8px;

      .metric-header {
        display: flex;
        align-items: center;
        justify-content: space-between;
      }

      .metric-label {
        font-size: 12px;
        font-weight: 500;
        color: var(--text-secondary);
        text-transform: uppercase;
        letter-spacing: 0.04em;
      }

      .metric-icon-wrap {
        width: 32px;
        height: 32px;
        border-radius: var(--radius-sm);
        display: flex;
        align-items: center;
        justify-content: center;

        &.neutral {
          background-color: var(--bg-surface-elevated);
          color: var(--text-secondary);
        }

        &.income {
          background-color: var(--color-income-bg);
          color: var(--color-income);
        }

        &.expense, &.warning {
          background-color: var(--color-expense-bg);
          color: var(--color-expense);
        }
      }

      .metric-value {
        font-size: 24px;
        font-weight: 700;
        letter-spacing: -0.03em;
        color: var(--text-primary);
      }

      .metric-hint {
        font-size: 11px;
        color: var(--text-muted);
      }

      .monthly-breakdown {
        display: flex;
        align-items: center;
        gap: 6px;
        font-size: 11px;
        font-weight: 500;

        .breakdown-separator {
          color: var(--text-muted);
        }
      }
    }

    .text-income {
      color: var(--color-income) !important;
    }

    .text-expense {
      color: var(--color-expense) !important;
    }

    .text-muted {
      color: var(--text-muted) !important;
    }

    .chart-section {
      background-color: var(--bg-surface);
      border: 1px solid var(--border-subtle);
      border-radius: var(--radius-lg);
      padding: 20px;
      margin-bottom: 24px;

      .section-header {
        display: flex;
        align-items: flex-start;
        justify-content: space-between;
        margin-bottom: 12px;

        .section-title {
          font-size: 16px;
          font-weight: 700;
          color: var(--text-primary);
        }

        .section-subtitle {
          font-size: 12px;
          color: var(--text-secondary);
          margin-top: 2px;
        }

        .period-badge {
          font-size: 11px;
          font-weight: 600;
          padding: 2px 8px;
          border-radius: var(--radius-full);
          background-color: var(--bg-surface-elevated);
          color: var(--text-secondary);
          border: 1px solid var(--border-subtle);
        }
      }

      .chart-card {
        display: flex;
        flex-direction: column;
        align-items: center;
        width: 100%;
      }

      .empty-chart {
        padding: 32px 16px;
        text-align: center;
        display: flex;
        flex-direction: column;
        align-items: center;

        .empty-chart-icon {
          width: 48px;
          height: 48px;
          border-radius: 50%;
          background-color: var(--bg-surface-elevated);
          display: flex;
          align-items: center;
          justify-content: center;
          color: var(--text-muted);
          margin-bottom: 12px;
        }

        .empty-chart-title {
          font-size: 14px;
          font-weight: 600;
          color: var(--text-primary);
          margin-bottom: 4px;
        }

        .empty-chart-subtitle {
          font-size: 12px;
          color: var(--text-secondary);
          max-width: 300px;
          line-height: 1.4;
          margin-bottom: 16px;
        }

        .demo-btn {
          min-height: 36px;
          padding: 0 14px;
          font-size: 12px;
        }
      }

      .chart-skeleton {
        width: 220px;
        height: 220px;
        border-radius: 50%;
        background-color: var(--bg-surface-elevated);
        animation: pulse 1.5s infinite ease-in-out;
        margin: 20px 0;
      }
    }

    .recent-section {
      background-color: var(--bg-surface);
      border: 1px solid var(--border-subtle);
      border-radius: var(--radius-lg);
      padding: 18px;

      .section-header {
        display: flex;
        align-items: center;
        justify-content: space-between;
        margin-bottom: 16px;
      }

      .section-title {
        font-size: 16px;
        font-weight: 600;
        letter-spacing: -0.02em;
      }

      .view-all-link {
        display: inline-flex;
        align-items: center;
        gap: 4px;
        font-size: 12px;
        font-weight: 500;
        color: var(--text-secondary);
        text-decoration: none;

        &:hover {
          color: var(--text-primary);
        }
      }
    }

    .transactions-list {
      display: flex;
      flex-direction: column;
    }

    .tx-item {
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: 12px 0;
      border-bottom: 1px solid var(--border-muted);

      &:last-child {
        border-bottom: none;
        padding-bottom: 0;
      }

      &:first-child {
        padding-top: 0;
      }
    }

    .tx-leading {
      display: flex;
      align-items: center;
      gap: 12px;
    }

    .tx-icon {
      width: 38px;
      height: 38px;
      border-radius: var(--radius-md);
      display: flex;
      align-items: center;
      justify-content: center;
      background-color: var(--bg-surface-elevated);
      color: var(--text-secondary);

      &.icon-income {
        background-color: var(--color-income-bg);
        color: var(--color-income);
      }

      &.icon-expense {
        background-color: var(--color-expense-bg);
        color: var(--color-expense);
      }

      &.icon-transfer {
        background-color: var(--color-accent-bg);
        color: var(--color-accent);
      }
    }

    .tx-details {
      display: flex;
      flex-direction: column;
      gap: 2px;

      .tx-desc {
        font-size: 14px;
        font-weight: 500;
        color: var(--text-primary);
      }

      .tx-meta {
        font-size: 12px;
        color: var(--text-muted);
      }
    }

    .tx-amount {
      font-size: 15px;
      font-weight: 600;
    }

    .empty-state {
      padding: 32px 16px;
      text-align: center;
      display: flex;
      flex-direction: column;
      align-items: center;

      .empty-icon-box {
        width: 48px;
        height: 48px;
        border-radius: 50%;
        background-color: var(--bg-surface-elevated);
        display: flex;
        align-items: center;
        justify-content: center;
        color: var(--text-muted);
        margin-bottom: 12px;
      }

      .empty-title {
        font-size: 15px;
        font-weight: 600;
        color: var(--text-primary);
        margin-bottom: 4px;
      }

      .empty-subtitle {
        font-size: 13px;
        color: var(--text-secondary);
        max-width: 320px;
        line-height: 1.4;
      }
    }

    .mt-12 {
      margin-top: 12px;
    }

    .loading-skeleton {
      display: flex;
      flex-direction: column;
      gap: 12px;

      .skeleton-row {
        height: 48px;
        background-color: var(--bg-surface-elevated);
        border-radius: var(--radius-sm);
        animation: pulse 1.5s infinite ease-in-out;
      }
    }

    @keyframes pulse {
      0%, 100% { opacity: 0.6; }
      50% { opacity: 0.3; }
    }
  `,
})
export class DashboardComponent implements OnInit {
  syncService = inject(FinanceSyncService);
  private api = inject(ApiService);

  summary = signal<DashboardSummary | null>(null);
  recentTransactions = signal<Transaction[]>([]);
  isLoading = signal<boolean>(true);

  // Donut Chart - Gastos nos Cartões por Sessão
  cardExpenses = signal<CardExpensesResponse | null>(null);
  chartSegments = signal<CategoryExpenseSegment[]>([]);
  isChartLoading = signal<boolean>(true);

  ngOnInit(): void {
    this.fetchData();
    this.syncService.refresh$.subscribe(() => this.fetchData());
  }

  fetchData(): void {
    this.isLoading.set(true);
    this.isChartLoading.set(true);

    this.api.getDashboardSummary().subscribe({
      next: (data) => {
        this.summary.set(data);
      },
      error: () => {},
    });

    this.api.getCardExpenses().subscribe({
      next: (resp) => {
        this.cardExpenses.set(resp);
        this.chartSegments.set(resp.segments);
        this.isChartLoading.set(false);
      },
      error: () => {
        this.isChartLoading.set(false);
      },
    });

    this.api.getTransactions(undefined, undefined, 5).subscribe({
      next: (txs) => {
        this.recentTransactions.set(txs);
        this.isLoading.set(false);
      },
      error: () => {
        this.isLoading.set(false);
      },
    });
  }

  loadSampleChartData(): void {
    this.chartSegments.set([
      { label: 'Alimentação & Mercado', value: '1240.50', color: '#1DCDFE', percentage: 43.2, count: 14 },
      { label: 'Assinaturas & SaaS', value: '680.00', color: '#21D0B2', percentage: 23.7, count: 6 },
      { label: 'Transporte & Uber', value: '430.20', color: '#34F5C5', percentage: 15.0, count: 12 },
      { label: 'Lazer & Restaurantes', value: '310.00', color: '#fbbf24', percentage: 10.8, count: 4 },
      { label: 'Saúde & Farmácia', value: '189.90', color: '#f43f5e', percentage: 6.6, count: 3 },
      { label: 'Outros Lançamentos', value: '20.00', color: '#94a3b8', percentage: 0.7, count: 1 },
    ]);
  }

  isResultPositive(): boolean {
    const val = parseFloat(this.summary()?.monthly_result || '0');
    return val >= 0;
  }
}
