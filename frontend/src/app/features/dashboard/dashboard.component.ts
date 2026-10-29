import { Component, computed, inject, OnInit, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import { ApiService } from '../../core/services/api.service';
import { FinanceSyncService } from '../../core/services/finance-sync.service';
import { DashboardSummary } from '../../core/models/summary.model';
import { Transaction } from '../../core/models/transaction.model';
import { CardExpensesResponse, CategoryExpenseSegment } from '../../core/models/card-expenses.model';
import { SavingsEvolutionResponse, SavingsPoint } from '../../core/models/savings-evolution.model';
import { BudgetSummaryResponse } from '../../core/models/budget.model';
import { FinancialGoalSummaryResponse, FinancialGoalCreate, FinancialGoalUpdate, GoalContributionCreate } from '../../core/models/goal.model';
import { Category } from '../../core/models/category.model';
import { Account } from '../../core/models/account.model';
import { PrivacyCurrencyPipe } from '../../core/pipes/privacy-currency.pipe';
import { IconComponent } from '../../shared/components/icon/icon.component';
import { DonutChartComponent } from '../../shared/components/donut-chart/donut-chart.component';
import { SavingsEvolutionChartComponent } from '../../shared/components/savings-evolution-chart/savings-evolution-chart.component';
import { CategoryBudgetsWidgetComponent } from '../../shared/components/category-budgets-widget/category-budgets-widget.component';
import { FinancialGoalsWidgetComponent } from '../../shared/components/financial-goals-widget/financial-goals-widget.component';

@Component({
  selector: 'app-dashboard',
  standalone: true,
  imports: [
    CommonModule,
    RouterLink,
    PrivacyCurrencyPipe,
    IconComponent,
    DonutChartComponent,
    SavingsEvolutionChartComponent,
    CategoryBudgetsWidgetComponent,
    FinancialGoalsWidgetComponent,
  ],
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

      <!-- Painel de Crescimento Patrimonial: Dinheiro Guardado (Conta Parado, Cofrinhos, Investido) -->
      <section class="chart-section savings-section">
        @if (isSavingsLoading()) {
          <div class="chart-skeleton"></div>
        } @else {
          <app-savings-evolution-chart
            [data]="savingsPoints()"
            [period]="savingsEvolution()?.period || 'Últimos 6 meses'"
            [growthAmount]="savingsEvolution()?.period_growth_amount || null"
            [growthPercentage]="savingsEvolution()?.period_growth_percentage ?? null"
            [currentTotal]="savingsEvolution()?.current_total || null"
          />

          @if (isZeroSavings() && !isSavingsSimulating()) {
            <div class="simulation-prompt-box">
              <div class="prompt-text">
                <span class="prompt-title">Nenhum histórico acumulado ainda</span>
                <span class="prompt-desc">
                  Visualize como seu dinheiro parado, cofrinhos do Mercado Pago e investimentos crescem ao longo do tempo.
                </span>
              </div>
              <button class="btn btn-secondary demo-btn" (click)="loadSampleSavingsData()">
                <app-icon name="repeat" [size]="14" />
                <span>Simular Exemplo Interativo</span>
              </button>
            </div>
          } @else if (isSavingsSimulating()) {
            <div class="simulation-status-bar">
              <span class="status-text">Simulação ativa com valores distribuídos entre Conta, Cofrinhos e Investimentos</span>
              <button class="btn-text-link" (click)="resetSavingsToRealData()">
                <app-icon name="repeat" [size]="12" />
                <span>Restaurar dados reais</span>
              </button>
            </div>
          }
        }
      </section>

      <!-- Gráfico Donut: Distribuição Dinâmica de Gastos nos Cartões -->
      <section class="chart-section">
        <div class="section-header">
          <div>
            <h2 class="section-title">Gastos nos Cartões por Sessão</h2>
            <p class="section-subtitle">Visualização dinâmica por área de gasto</p>
          </div>
          <div class="header-actions">
            @if (isSimulating()) {
              <button class="btn-text-link" (click)="resetChartToRealData()" title="Voltar aos dados reais">
                <app-icon name="repeat" [size]="12" />
                <span>Limpar Simulação</span>
              </button>
            }
            <span class="period-badge" [class.simulation-badge]="isSimulating()">
              {{ cardExpenses()?.period || 'Mês Atual' }}
            </span>
          </div>
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
              [gap]="3"
              defaultLabel="Fatura Cartões"
            />
          }
        </div>
      </section>

      <!-- Painel de Orçamentos por Categoria (Budgeting - Fase 7.1) -->
      <section class="budget-section">
        <app-category-budgets-widget
          [summary]="budgetSummary()"
          [categories]="categories()"
          [isLoading]="isBudgetsLoading()"
          (onSaveBudget)="handleSaveBudget($event)"
          (onDeleteBudget)="handleDeleteBudget($event)"
          (onCopyPreviousMonth)="handleCopyPreviousMonth($event)"
        />
      </section>

      <!-- Central de Metas & Cofrinhos (Fase 7.2) -->
      <section class="goals-section">
        <app-financial-goals-widget
          [summary]="goalsSummary()"
          [accounts]="accounts()"
          [isLoading]="isGoalsLoading()"
          (onCreateGoal)="handleCreateGoal($event)"
          (onUpdateGoal)="handleUpdateGoal($event)"
          (onContribute)="handleGoalContribution($event)"
          (onDeleteGoal)="handleDeleteGoal($event)"
        />
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

        .header-actions {
          display: flex;
          align-items: center;
          gap: 8px;
        }

        .btn-text-link {
          display: flex;
          align-items: center;
          gap: 4px;
          font-size: 11px;
          font-weight: 500;
          color: var(--text-muted);
          background: transparent;
          border: none;
          cursor: pointer;
          padding: 2px 6px;
          border-radius: var(--radius-sm);
          transition: color 0.15s ease, background 0.15s ease;

          &:hover {
            color: var(--color-accent);
            background: var(--bg-surface-elevated);
          }
        }

        .period-badge {
          font-size: 11px;
          font-weight: 600;
          padding: 2px 8px;
          border-radius: var(--radius-full);
          background-color: var(--bg-surface-elevated);
          color: var(--text-secondary);
          border: 1px solid var(--border-subtle);

          &.simulation-badge {
            color: var(--color-accent);
            border-color: rgba(29, 205, 254, 0.3);
            background-color: rgba(29, 205, 254, 0.08);
          }
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
        width: 100%;
        height: 220px;
        border-radius: var(--radius-md);
        background-color: var(--bg-surface-elevated);
        animation: pulse 1.5s infinite ease-in-out;
        margin: 10px 0;
      }

      .simulation-prompt-box {
        display: flex;
        flex-wrap: wrap;
        align-items: center;
        justify-content: space-between;
        gap: 12px;
        margin-top: 14px;
        padding: 12px 16px;
        background: var(--bg-surface-elevated);
        border: 1px dashed var(--border-subtle);
        border-radius: var(--radius-md);

        .prompt-text {
          display: flex;
          flex-direction: column;
          gap: 2px;
        }

        .prompt-title {
          font-size: 13px;
          font-weight: 600;
          color: var(--text-primary);
        }

        .prompt-desc {
          font-size: 12px;
          color: var(--text-secondary);
          max-width: 480px;
        }
      }

      .simulation-status-bar {
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 12px;
        margin-top: 12px;
        padding: 8px 12px;
        background: rgba(29, 205, 254, 0.06);
        border: 1px solid rgba(29, 205, 254, 0.2);
        border-radius: var(--radius-sm);

        .status-text {
          font-size: 12px;
          color: var(--color-accent);
          font-weight: 500;
        }
      }
    }

    .budget-section {
      margin-bottom: 28px;
    }

    .goals-section {
      margin-bottom: 28px;
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

  // Gráfico Donut - Gastos nos Cartões por Sessão
  cardExpenses = signal<CardExpensesResponse | null>(null);
  chartSegments = signal<CategoryExpenseSegment[]>([]);
  isChartLoading = signal<boolean>(true);
  isSimulating = computed(() => this.cardExpenses()?.period === 'Simulação');

  // Painel de Crescimento Patrimonial - Dinheiro Guardado
  savingsEvolution = signal<SavingsEvolutionResponse | null>(null);
  savingsPoints = signal<SavingsPoint[]>([]);
  isSavingsLoading = signal<boolean>(true);
  isSavingsSimulating = signal<boolean>(false);

  // Orçamentos por Categoria (Budgeting - Fase 7.1)
  budgetSummary = signal<BudgetSummaryResponse | null>(null);
  categories = signal<Category[]>([]);
  isBudgetsLoading = signal<boolean>(true);

  // Central de Metas & Cofrinhos (Fase 7.2)
  goalsSummary = signal<FinancialGoalSummaryResponse | null>(null);
  accounts = signal<Account[]>([]);
  isGoalsLoading = signal<boolean>(true);

  isZeroSavings = computed(() => {
    const pts = this.savingsPoints();
    if (!pts || pts.length === 0) return true;
    return pts.every((p) => (parseFloat(p.total?.toString() || '0') || 0) === 0);
  });

  ngOnInit(): void {
    this.fetchData();
    this.syncService.refresh$.subscribe(() => this.fetchData());
  }

  fetchData(): void {
    this.isLoading.set(true);
    this.isChartLoading.set(true);
    this.isSavingsLoading.set(true);
    this.isBudgetsLoading.set(true);
    this.isGoalsLoading.set(true);

    this.api.getDashboardSummary().subscribe({
      next: (data) => {
        this.summary.set(data);
      },
      error: () => {},
    });

    this.loadGoals();

    this.api.getAccounts().subscribe({
      next: (accs) => {
        this.accounts.set(accs);
      },
      error: () => {},
    });

    this.api.getBudgets().subscribe({
      next: (b) => {
        this.budgetSummary.set(b);
        this.isBudgetsLoading.set(false);
      },
      error: () => {
        this.isBudgetsLoading.set(false);
      },
    });

    this.api.getCategories().subscribe({
      next: (cats) => {
        this.categories.set(cats);
      },
      error: () => {},
    });

    this.api.getCardExpenses().subscribe({
      next: (resp) => {
        this.cardExpenses.set(resp);
        this.chartSegments.set(resp.segments || []);
        this.isChartLoading.set(false);
      },
      error: () => {
        this.isChartLoading.set(false);
      },
    });

    this.api.getSavingsEvolution(6).subscribe({
      next: (resp) => {
        this.savingsEvolution.set(resp);
        this.savingsPoints.set(resp.points || []);
        this.isSavingsLoading.set(false);
      },
      error: () => {
        this.isSavingsLoading.set(false);
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

  loadSampleSavingsData(): void {
    const samplePoints: SavingsPoint[] = [
      { date: '2026-05', label: 'Mai', checking: '2100.00', savings: '3500.00', investment: '4000.00', total: '9600.00' },
      { date: '2026-06', label: 'Jun', checking: '1850.00', savings: '4200.00', investment: '4800.00', total: '10850.00' },
      { date: '2026-07', label: 'Jul', checking: '2400.00', savings: '5100.00', investment: '5500.00', total: '13000.00' },
      { date: '2026-08', label: 'Ago', checking: '1950.00', savings: '5900.00', investment: '6300.00', total: '14150.00' },
      { date: '2026-09', label: 'Set', checking: '2300.00', savings: '6700.00', investment: '7100.00', total: '16100.00' },
      { date: '2026-10', label: 'Out', checking: '2750.00', savings: '7650.00', investment: '8100.00', total: '18500.00' },
    ];
    this.savingsEvolution.set({
      current_total: '18500.00',
      current_checking: '2750.00',
      current_savings: '7650.00',
      current_investment: '8100.00',
      period_growth_amount: '8900.00',
      period_growth_percentage: 92.7,
      period: 'Simulação (6 meses)',
      points: samplePoints,
    });
    this.savingsPoints.set(samplePoints);
    this.isSavingsSimulating.set(true);
  }

  resetSavingsToRealData(): void {
    this.isSavingsLoading.set(true);
    this.isSavingsSimulating.set(false);
    this.api.getSavingsEvolution(6).subscribe({
      next: (resp) => {
        this.savingsEvolution.set(resp);
        this.savingsPoints.set(resp.points || []);
        this.isSavingsLoading.set(false);
      },
      error: () => {
        this.isSavingsLoading.set(false);
      },
    });
  }

  loadSampleChartData(): void {
    const sampleSegments: CategoryExpenseSegment[] = [
      { label: 'Alimentação & Mercado', value: '1240.50', color: '#1DCDFE', percentage: 43.2, count: 14 },
      { label: 'Assinaturas & SaaS', value: '680.00', color: '#21D0B2', percentage: 23.7, count: 6 },
      { label: 'Transporte & Uber', value: '430.20', color: '#34F5C5', percentage: 15.0, count: 12 },
      { label: 'Lazer & Restaurantes', value: '310.00', color: '#fbbf24', percentage: 10.8, count: 4 },
      { label: 'Saúde & Farmácia', value: '189.90', color: '#f43f5e', percentage: 6.6, count: 3 },
      { label: 'Outros Lançamentos', value: '20.00', color: '#94a3b8', percentage: 0.7, count: 1 },
    ];
    this.cardExpenses.set({
      total_value: '2870.60',
      period: 'Simulação',
      segments: sampleSegments,
    });
    this.chartSegments.set(sampleSegments);
  }

  resetChartToRealData(): void {
    this.isChartLoading.set(true);
    this.api.getCardExpenses().subscribe({
      next: (resp) => {
        this.cardExpenses.set(resp);
        this.chartSegments.set(resp.segments || []);
        this.isChartLoading.set(false);
      },
      error: () => {
        this.isChartLoading.set(false);
      },
    });
  }

  loadBudgets(month?: number, year?: number): void {
    this.isBudgetsLoading.set(true);
    this.api.getBudgets(month, year).subscribe({
      next: (b) => {
        this.budgetSummary.set(b);
        this.isBudgetsLoading.set(false);
      },
      error: () => {
        this.isBudgetsLoading.set(false);
      },
    });
  }

  handleSaveBudget(event: { category_id: string; limit_amount: string; month: number; year: number }): void {
    this.api.createBudget(event).subscribe({
      next: () => this.loadBudgets(event.month, event.year),
      error: (err) => console.error('Erro ao salvar orçamento:', err),
    });
  }

  handleDeleteBudget(budgetId: string): void {
    this.api.deleteBudget(budgetId).subscribe({
      next: () => this.loadBudgets(),
      error: (err) => console.error('Erro ao remover orçamento:', err),
    });
  }

  handleCopyPreviousMonth(event: { source_month: number; source_year: number; target_month: number; target_year: number }): void {
    this.api.copyPreviousMonthBudgets(event).subscribe({
      next: (res) => this.budgetSummary.set(res),
      error: (err) => alert(err?.error?.detail || 'Erro ao copiar orçamentos do mês anterior.'),
    });
  }

  loadGoals(): void {
    this.isGoalsLoading.set(true);
    this.api.getGoals().subscribe({
      next: (g) => {
        this.goalsSummary.set(g);
        this.isGoalsLoading.set(false);
      },
      error: () => {
        this.isGoalsLoading.set(false);
      },
    });
  }

  handleCreateGoal(data: FinancialGoalCreate): void {
    this.api.createGoal(data).subscribe({
      next: () => this.loadGoals(),
      error: (err: unknown) => console.error('Erro ao criar meta:', err),
    });
  }

  handleUpdateGoal(event: { id: string; data: FinancialGoalUpdate }): void {
    this.api.updateGoal(event.id, event.data).subscribe({
      next: () => this.loadGoals(),
      error: (err: unknown) => console.error('Erro ao atualizar meta:', err),
    });
  }

  handleGoalContribution(event: { id: string; data: GoalContributionCreate }): void {
    this.api.contributeToGoal(event.id, event.data).subscribe({
      next: () => this.loadGoals(),
      error: (err: unknown) => console.error('Erro ao registrar aporte:', err),
    });
  }

  handleDeleteGoal(id: string): void {
    this.api.deleteGoal(id).subscribe({
      next: () => this.loadGoals(),
      error: (err: unknown) => console.error('Erro ao remover meta:', err),
    });
  }

  isResultPositive(): boolean {
    const val = parseFloat(this.summary()?.monthly_result || '0');
    return val >= 0;
  }
}
