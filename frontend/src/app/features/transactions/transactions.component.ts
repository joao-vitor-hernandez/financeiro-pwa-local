import { Component, computed, inject, OnInit, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ApiService } from '../../core/services/api.service';
import { FinanceSyncService } from '../../core/services/finance-sync.service';
import { Transaction } from '../../core/models/transaction.model';
import { Account } from '../../core/models/account.model';
import { Category } from '../../core/models/category.model';
import { PrivacyCurrencyPipe } from '../../core/pipes/privacy-currency.pipe';
import { IconComponent } from '../../shared/components/icon/icon.component';

type FilterType = 'ALL' | 'EXPENSE' | 'INCOME' | 'TRANSFER';

@Component({
  selector: 'app-transactions',
  standalone: true,
  imports: [CommonModule, FormsModule, PrivacyCurrencyPipe, IconComponent],
  template: `
    <div class="transactions-page">
      <header class="page-header">
        <h1 class="page-title">Extrato de Transações</h1>
        <p class="page-subtitle">Histórico contábil unificado de todas as contas</p>
      </header>

      <!-- Barra de Busca & Filtros de Tipo -->
      <div class="filters-container">
        <div class="search-box">
          <app-icon name="search" [size]="16" class="search-icon" />
          <input
            type="text"
            [(ngModel)]="searchQuery"
            placeholder="Buscar por descrição..."
            class="search-input"
          />
          @if (searchQuery()) {
            <button class="clear-search-btn" (click)="searchQuery.set('')">
              <app-icon name="x" [size]="14" />
            </button>
          }
        </div>

        <div class="filter-pills">
          <button
            class="pill-btn"
            [class.active]="activeFilter() === 'ALL'"
            (click)="setFilter('ALL')"
          >
            Todas
          </button>
          <button
            class="pill-btn"
            [class.active]="activeFilter() === 'EXPENSE'"
            (click)="setFilter('EXPENSE')"
          >
            Despesas
          </button>
          <button
            class="pill-btn"
            [class.active]="activeFilter() === 'INCOME'"
            (click)="setFilter('INCOME')"
          >
            Receitas
          </button>
          <button
            class="pill-btn"
            [class.active]="activeFilter() === 'TRANSFER'"
            (click)="setFilter('TRANSFER')"
          >
            Transferências
          </button>
        </div>
      </div>

      <!-- Lista de Transações ou Estados Vazios -->
      <section class="list-section">
        @if (isLoading()) {
          <div class="loading-skeleton">
            <div class="skeleton-row"></div>
            <div class="skeleton-row"></div>
            <div class="skeleton-row"></div>
            <div class="skeleton-row"></div>
          </div>
        } @else if (filteredTransactions().length === 0) {
          <div class="empty-state">
            <div class="empty-icon-box">
              <app-icon name="search" [size]="28" />
            </div>
            <p class="empty-title">Nenhum lançamento encontrado</p>
            <p class="empty-subtitle">
              @if (searchQuery() || activeFilter() !== 'ALL') {
                Nenhuma transação corresponde aos filtros selecionados.
              } @else {
                Seu extrato está limpo. Toque no botão central abaixo para registrar seu primeiro gasto.
              }
            </p>
          </div>
        } @else {
          <!-- Agrupamento por Data -->
          @for (group of groupedTransactions(); track group.date) {
            <div class="date-group">
              <div class="date-header">
                <span class="date-title">{{ group.label }}</span>
                <span class="date-subtotal tabular-nums">
                  {{ group.dailyTotal | privacyCurrency }}
                </span>
              </div>

              <div class="group-items">
                @for (tx of group.items; track tx.id) {
                  <div class="tx-row">
                    <div class="tx-left">
                      <div
                        class="tx-icon-badge"
                        [class.bg-income]="tx.type === 'INCOME'"
                        [class.bg-expense]="tx.type === 'EXPENSE' && !tx.is_transfer"
                        [class.bg-transfer]="tx.is_transfer"
                      >
                        @if (tx.is_transfer) {
                          <app-icon name="repeat" [size]="16" />
                        } @else if (tx.type === 'INCOME') {
                          <app-icon name="arrow-up-right" [size]="16" />
                        } @else {
                          <app-icon name="arrow-down-left" [size]="16" />
                        }
                      </div>

                      <div class="tx-info">
                        <div class="tx-desc-line">
                          <span class="tx-description">{{ tx.description }}</span>
                          @if (tx.installment_number && tx.total_installments && tx.total_installments > 1) {
                            <span class="badge badge-neutral installment-pill">
                              {{ tx.installment_number }}/{{ tx.total_installments }}
                            </span>
                          }
                        </div>
                        <div class="tx-meta-line">
                          <span class="account-tag">{{ getAccountName(tx.account_id) }}</span>
                          @if (getCategoryName(tx.category_id)) {
                            <span class="category-tag">• {{ getCategoryName(tx.category_id) }}</span>
                          }
                        </div>
                      </div>
                    </div>

                    <div
                      class="tx-value currency-val"
                      [class.text-income]="tx.type === 'INCOME'"
                      [class.text-muted]="tx.is_transfer"
                    >
                      {{ tx.type === 'INCOME' ? '+' : '-' }}{{ tx.amount | privacyCurrency }}
                    </div>
                  </div>
                }
              </div>
            </div>
          }
        }
      </section>
    </div>
  `,
  styles: `
    .transactions-page {
      padding: 18px 16px 40px;
      max-width: 768px;
      margin: 0 auto;
    }

    .page-header {
      margin-bottom: 20px;

      .page-title {
        font-size: 22px;
        font-weight: 700;
        letter-spacing: -0.03em;
        color: var(--text-primary);
      }

      .page-subtitle {
        font-size: 13px;
        color: var(--text-secondary);
        margin-top: 2px;
      }
    }

    .filters-container {
      display: flex;
      flex-direction: column;
      gap: 12px;
      margin-bottom: 20px;
    }

    .search-box {
      position: relative;
      display: flex;
      align-items: center;

      .search-icon {
        position: absolute;
        left: 14px;
        color: var(--text-muted);
        pointer-events: none;
      }

      .search-input {
        padding-left: 40px;
        padding-right: 40px;
      }

      .clear-search-btn {
        position: absolute;
        right: 12px;
        background: transparent;
        border: none;
        color: var(--text-muted);
        min-height: unset;
        min-width: unset;
        cursor: pointer;
        padding: 4px;

        &:hover {
          color: var(--text-primary);
        }
      }
    }

    .filter-pills {
      display: flex;
      align-items: center;
      gap: 6px;
      overflow-x: auto;
      padding-bottom: 4px;

      &::-webkit-scrollbar {
        display: none;
      }
    }

    .pill-btn {
      min-height: 34px;
      padding: 0 14px;
      font-size: 12px;
      font-weight: 500;
      border-radius: var(--radius-full);
      background-color: var(--bg-surface);
      border: 1px solid var(--border-subtle);
      color: var(--text-secondary);
      white-space: nowrap;
      cursor: pointer;
      transition: all 0.15s ease;

      &.active {
        background-color: var(--text-primary);
        color: var(--bg-app);
        border-color: var(--text-primary);
        font-weight: 600;
      }
    }

    .list-section {
      display: flex;
      flex-direction: column;
      gap: 20px;
    }

    .date-group {
      background-color: var(--bg-surface);
      border: 1px solid var(--border-subtle);
      border-radius: var(--radius-lg);
      overflow: hidden;
    }

    .date-header {
      padding: 12px 16px;
      background-color: rgba(255, 255, 255, 0.02);
      border-bottom: 1px solid var(--border-muted);
      display: flex;
      align-items: center;
      justify-content: space-between;

      .date-title {
        font-size: 12px;
        font-weight: 600;
        text-transform: uppercase;
        letter-spacing: 0.04em;
        color: var(--text-secondary);
      }

      .date-subtotal {
        font-size: 12px;
        color: var(--text-muted);
      }
    }

    .group-items {
      display: flex;
      flex-direction: column;
    }

    .tx-row {
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: 14px 16px;
      border-bottom: 1px solid var(--border-muted);

      &:last-child {
        border-bottom: none;
      }
    }

    .tx-left {
      display: flex;
      align-items: center;
      gap: 12px;
      min-width: 0;
    }

    .tx-icon-badge {
      width: 36px;
      height: 36px;
      border-radius: var(--radius-md);
      display: flex;
      align-items: center;
      justify-content: center;
      flex-shrink: 0;

      &.bg-income {
        background-color: var(--color-income-bg);
        color: var(--color-income);
      }

      &.bg-expense {
        background-color: var(--color-expense-bg);
        color: var(--color-expense);
      }

      &.bg-transfer {
        background-color: var(--color-accent-bg);
        color: var(--color-accent);
      }
    }

    .tx-info {
      display: flex;
      flex-direction: column;
      gap: 2px;
      min-width: 0;

      .tx-desc-line {
        display: flex;
        align-items: center;
        gap: 6px;
        min-width: 0;
      }

      .tx-description {
        font-size: 14px;
        font-weight: 500;
        color: var(--text-primary);
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
      }

      .installment-pill {
        font-size: 10px;
        padding: 1px 5px;
      }

      .tx-meta-line {
        font-size: 11px;
        color: var(--text-muted);
        display: flex;
        align-items: center;
        gap: 4px;
      }
    }

    .tx-value {
      font-size: 15px;
      font-weight: 600;
      white-space: nowrap;
      margin-left: 12px;
    }

    .text-income {
      color: var(--color-income) !important;
    }

    .text-muted {
      color: var(--text-muted) !important;
    }

    .empty-state {
      padding: 40px 16px;
      text-align: center;
      display: flex;
      flex-direction: column;
      align-items: center;

      .empty-icon-box {
        width: 48px;
        height: 48px;
        border-radius: 50%;
        background-color: var(--bg-surface);
        border: 1px solid var(--border-subtle);
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

    .loading-skeleton {
      display: flex;
      flex-direction: column;
      gap: 12px;

      .skeleton-row {
        height: 52px;
        background-color: var(--bg-surface);
        border-radius: var(--radius-md);
        animation: pulse 1.5s infinite ease-in-out;
      }
    }

    @keyframes pulse {
      0%, 100% { opacity: 0.6; }
      50% { opacity: 0.3; }
    }
  `,
})
export class TransactionsComponent implements OnInit {
  private api = inject(ApiService);
  private syncService = inject(FinanceSyncService);

  transactions = signal<Transaction[]>([]);
  accounts = signal<Account[]>([]);
  categories = signal<Category[]>([]);
  isLoading = signal<boolean>(true);

  activeFilter = signal<FilterType>('ALL');
  searchQuery = signal<string>('');

  ngOnInit(): void {
    this.loadData();
    this.syncService.refresh$.subscribe(() => this.loadData());
  }

  loadData(): void {
    this.isLoading.set(true);

    this.api.getAccounts().subscribe({
      next: (accs) => this.accounts.set(accs),
    });

    this.api.getCategories().subscribe({
      next: (cats) => this.categories.set(cats),
    });

    this.api.getTransactions(undefined, undefined, 100).subscribe({
      next: (txs) => {
        this.transactions.set(txs);
        this.isLoading.set(false);
      },
      error: () => this.isLoading.set(false),
    });
  }

  setFilter(filter: FilterType): void {
    this.activeFilter.set(filter);
  }

  getAccountName(accountId: string): string {
    const acc = this.accounts().find((a) => a.id === accountId);
    return acc ? acc.name : 'Conta';
  }

  getCategoryName(categoryId?: string | null): string | null {
    if (!categoryId) return null;
    const cat = this.categories().find((c) => c.id === categoryId);
    return cat ? cat.name : null;
  }

  filteredTransactions = computed(() => {
    const query = this.searchQuery().toLowerCase().trim();
    const filter = this.activeFilter();

    return this.transactions().filter((tx) => {
      // Filtro de Tipo
      if (filter === 'TRANSFER' && !tx.is_transfer) return false;
      if (filter === 'EXPENSE' && (tx.type !== 'EXPENSE' || tx.is_transfer)) return false;
      if (filter === 'INCOME' && tx.type !== 'INCOME') return false;

      // Filtro de Busca
      if (query) {
        const matchesDesc = tx.description.toLowerCase().includes(query);
        const accName = this.getAccountName(tx.account_id).toLowerCase();
        const matchesAccount = accName.includes(query);
        return matchesDesc || matchesAccount;
      }

      return true;
    });
  });

  groupedTransactions = computed(() => {
    const list = this.filteredTransactions();
    const groupsMap = new Map<string, { label: string; date: string; items: Transaction[]; dailyTotal: number }>();

    for (const tx of list) {
      const dateKey = tx.transaction_date.substring(0, 10);
      if (!groupsMap.has(dateKey)) {
        groupsMap.set(dateKey, {
          label: this.formatDateLabel(dateKey),
          date: dateKey,
          items: [],
          dailyTotal: 0,
        });
      }

      const group = groupsMap.get(dateKey)!;
      group.items.push(tx);

      const val = parseFloat(tx.amount) || 0;
      if (tx.type === 'INCOME') {
        group.dailyTotal += val;
      } else if (!tx.is_transfer) {
        group.dailyTotal -= val;
      }
    }

    return Array.from(groupsMap.values());
  });

  private formatDateLabel(dateStr: string): string {
    const today = new Date().toISOString().substring(0, 10);
    const yesterday = new Date(Date.now() - 86400000).toISOString().substring(0, 10);

    if (dateStr === today) return 'Hoje';
    if (dateStr === yesterday) return 'Ontem';

    // Formata como DD/MM/AAAA
    const parts = dateStr.split('-');
    if (parts.length === 3) {
      return `${parts[2]}/${parts[1]}/${parts[0]}`;
    }
    return dateStr;
  }
}
