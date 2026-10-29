import { Component, computed, inject, OnInit, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ApiService } from '../../core/services/api.service';
import { FinanceSyncService } from '../../core/services/finance-sync.service';
import { OfflineDbService } from '../../core/services/offline-db.service';
import { OutboxSyncService } from '../../core/services/outbox-sync.service';
import { Account } from '../../core/models/account.model';
import { Category } from '../../core/models/category.model';
import { TransactionType } from '../../core/models/transaction.model';
import { IconComponent } from '../../shared/components/icon/icon.component';

@Component({
  selector: 'app-quick-add',
  standalone: true,
  imports: [CommonModule, FormsModule, IconComponent],
  template: `
    @if (syncService.isQuickAddOpen()) {
      <div class="drawer-overlay" (click)="close()">
        <div class="drawer-sheet" (click)="$event.stopPropagation()">
          <header class="drawer-header">
            <div>
              <h2 class="drawer-title">Novo Lançamento</h2>
              @if (!outboxSync.isOnline()) {
                <span class="offline-tag">
                  <app-icon name="repeat" [size]="12" />
                  <span>Modo Offline (Irá para a fila)</span>
                </span>
              }
            </div>
            <button class="btn btn-ghost btn-icon close-btn" (click)="close()">
              <app-icon name="x" [size]="20" />
            </button>
          </header>

          <form (ngSubmit)="submit()" class="quick-add-form">
            <!-- Seletor de Tipo (Despesa / Receita / Transferência) -->
            <div class="type-selector">
              <button
                type="button"
                class="type-btn"
                [class.active-expense]="txType() === 'EXPENSE'"
                (click)="setType('EXPENSE')"
              >
                <app-icon name="arrow-down-left" [size]="16" />
                <span>Despesa</span>
              </button>

              <button
                type="button"
                class="type-btn"
                [class.active-income]="txType() === 'INCOME'"
                (click)="setType('INCOME')"
              >
                <app-icon name="arrow-up-right" [size]="16" />
                <span>Receita</span>
              </button>

              <button
                type="button"
                class="type-btn"
                [class.active-transfer]="txType() === 'TRANSFER'"
                (click)="setType('TRANSFER')"
              >
                <app-icon name="repeat" [size]="16" />
                <span>Transferência</span>
              </button>
            </div>

            <!-- Entrada de Valor com Tipografia de Destaque e Teclado Decimal -->
            <div class="amount-field">
              <span class="currency-prefix">R$</span>
              <input
                type="text"
                inputmode="decimal"
                [(ngModel)]="amountInput"
                name="amount"
                placeholder="0,00"
                class="amount-input tabular-nums"
                required
                autocomplete="off"
              />
            </div>

            <!-- Descrição -->
            <div class="form-group">
              <label class="form-label">Descrição</label>
              <input
                type="text"
                [(ngModel)]="description"
                name="description"
                placeholder="Ex: Supermercado, Aluguel, Uber..."
                class="form-input"
                required
              />
            </div>

            <!-- Seleção de Conta Origem -->
            <div class="form-group">
              <label class="form-label">
                {{ txType() === 'TRANSFER' ? 'Conta de Origem (Debitar)' : 'Conta / Cartão' }}
              </label>
              <select [(ngModel)]="selectedAccountId" name="accountId" class="form-input" required>
                <option value="" disabled selected>Selecione uma conta</option>
                @for (acc of accounts(); track acc.id) {
                  <option [value]="acc.id">
                    {{ acc.name }} ({{ acc.type === 'CREDIT_CARD' ? 'Cartão' : 'Conta' }})
                  </option>
                }
              </select>
            </div>

            <!-- Destino de Transferência -->
            @if (txType() === 'TRANSFER') {
              <div class="form-group">
                <label class="form-label">Conta de Destino (Creditar)</label>
                <select [(ngModel)]="targetAccountId" name="targetAccountId" class="form-input" required>
                  <option value="" disabled selected>Selecione a conta destino</option>
                  @for (acc of destinationAccounts(); track acc.id) {
                    <option [value]="acc.id">{{ acc.name }}</option>
                  }
                </select>
              </div>
            }

            <!-- Seleção de Categoria (apenas para Receita ou Despesa) -->
            @if (txType() !== 'TRANSFER') {
              <div class="form-group">
                <label class="form-label">Categoria</label>
                <select [(ngModel)]="selectedCategoryId" name="categoryId" class="form-input">
                  <option [value]="null">Sem Categoria</option>
                  @for (cat of filteredCategories(); track cat.id) {
                    <option [value]="cat.id">{{ cat.name }}</option>
                  }
                </select>
              </div>
            }

            <!-- Parcelamento (visível apenas para Despesa em Cartão de Crédito) -->
            @if (isCreditCardSelected() && txType() === 'EXPENSE') {
              <div class="form-group">
                <label class="form-label">Parcelamento</label>
                <select [(ngModel)]="installments" name="installments" class="form-input">
                  <option [value]="1">À vista (1x)</option>
                  <option [value]="2">2x</option>
                  <option [value]="3">3x</option>
                  <option [value]="4">4x</option>
                  <option [value]="5">5x</option>
                  <option [value]="6">6x</option>
                  <option [value]="10">10x</option>
                  <option [value]="12">12x</option>
                  <option [value]="18">18x</option>
                  <option [value]="24">24x</option>
                </select>
              </div>
            }

            <!-- Data do Lançamento -->
            <div class="form-group">
              <label class="form-label">Data</label>
              <input type="date" [(ngModel)]="transactionDate" name="date" class="form-input" required />
            </div>

            <!-- Mensagem de Erro se houver -->
            @if (errorMessage()) {
              <div class="error-banner">
                {{ errorMessage() }}
              </div>
            }

            <!-- Ações -->
            <div class="drawer-actions">
              <button
                type="submit"
                class="btn btn-primary submit-btn"
                [disabled]="isSubmitting() || !isFormValid()"
              >
                @if (isSubmitting()) {
                  <span>Gravando...</span>
                } @else if (!outboxSync.isOnline()) {
                  <app-icon name="repeat" [size]="18" />
                  <span>Salvar na Fila Offline</span>
                } @else {
                  <app-icon name="check" [size]="18" />
                  <span>Confirmar Lançamento</span>
                }
              </button>
            </div>
          </form>
        </div>
      </div>
    }
  `,
  styles: `
    .drawer-overlay {
      position: fixed;
      inset: 0;
      background-color: rgba(0, 0, 0, 0.7);
      backdrop-filter: blur(4px);
      z-index: 100;
      display: flex;
      flex-direction: column;
      justify-content: flex-end;
      animation: fadeIn 0.15s ease-out;
    }

    .drawer-sheet {
      background-color: var(--bg-surface-elevated);
      border-top: 1px solid var(--border-subtle);
      border-radius: var(--radius-lg) var(--radius-lg) 0 0;
      padding: 20px 20px calc(24px + var(--safe-area-bottom));
      max-height: 90dvh;
      overflow-y: auto;
      box-shadow: 0 -8px 30px rgba(0, 0, 0, 0.5);
      animation: slideUp 0.2s cubic-bezier(0.16, 1, 0.3, 1);
    }

    @keyframes fadeIn {
      from { opacity: 0; }
      to { opacity: 1; }
    }

    @keyframes slideUp {
      from { transform: translateY(100%); }
      to { transform: translateY(0); }
    }

    .drawer-header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      margin-bottom: 20px;
    }

    .drawer-title {
      font-size: 18px;
      font-weight: 600;
      letter-spacing: -0.02em;
    }

    .offline-tag {
      display: inline-flex;
      align-items: center;
      gap: 5px;
      font-size: 11px;
      font-weight: 600;
      color: #fbbf24;
      background: rgba(251, 191, 36, 0.12);
      border: 1px solid rgba(251, 191, 36, 0.25);
      padding: 2px 8px;
      border-radius: 10px;
      margin-top: 4px;
    }

    .close-btn {
      min-height: 36px;
      min-width: 36px;
      border-radius: 50%;
    }

    .type-selector {
      display: grid;
      grid-template-columns: 1fr 1fr 1fr;
      gap: 8px;
      background-color: var(--bg-surface);
      padding: 4px;
      border-radius: var(--radius-md);
      margin-bottom: 20px;
    }

    .type-btn {
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 6px;
      padding: 10px 4px;
      min-height: 40px;
      border-radius: var(--radius-sm);
      border: 1px solid transparent;
      background: transparent;
      color: var(--text-muted);
      font-size: 12px;
      font-weight: 500;
      cursor: pointer;
      transition: all 0.15s ease;

      &.active-expense {
        background-color: var(--color-expense-bg);
        color: var(--color-expense);
        border-color: rgba(244, 63, 94, 0.3);
      }

      &.active-income {
        background-color: var(--color-income-bg);
        color: var(--color-income);
        border-color: rgba(16, 185, 129, 0.3);
      }

      &.active-transfer {
        background-color: var(--color-accent-bg);
        color: var(--color-accent);
        border-color: rgba(59, 130, 246, 0.3);
      }
    }

    .amount-field {
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 6px;
      margin-bottom: 20px;
      padding: 12px;
      background-color: var(--bg-surface);
      border: 1px solid var(--border-subtle);
      border-radius: var(--radius-md);

      .currency-prefix {
        font-size: 22px;
        font-weight: 600;
        color: var(--text-muted);
      }

      .amount-input {
        background: transparent;
        border: none;
        outline: none;
        font-size: 32px;
        font-weight: 700;
        color: var(--text-primary);
        text-align: left;
        padding: 0;
        min-height: unset;
        width: 100%;
        max-width: 220px;

        &::placeholder {
          color: var(--text-muted);
        }
      }
    }

    .form-group {
      margin-bottom: 14px;
    }

    .form-label {
      display: block;
      font-size: 13px;
      font-weight: 500;
      color: var(--text-secondary);
      margin-bottom: 6px;
    }

    .form-input {
      width: 100%;
      background-color: var(--bg-surface);
    }

    .error-banner {
      background-color: var(--color-expense-bg);
      color: var(--color-expense);
      border: 1px solid rgba(244, 63, 94, 0.2);
      border-radius: var(--radius-md);
      padding: 10px 14px;
      font-size: 13px;
      margin-bottom: 16px;
    }

    .drawer-actions {
      margin-top: 20px;
    }

    .submit-btn {
      width: 100%;
      height: 48px;
      font-size: 15px;
      font-weight: 600;
    }
  `,
})
export class QuickAddComponent implements OnInit {
  syncService = inject(FinanceSyncService);
  outboxSync = inject(OutboxSyncService);
  private offlineDb = inject(OfflineDbService);
  private api = inject(ApiService);

  accounts = signal<Account[]>([]);
  categories = signal<Category[]>([]);

  txType = signal<'EXPENSE' | 'INCOME' | 'TRANSFER'>('EXPENSE');
  amountInput = '';
  description = '';
  selectedAccountId = '';
  targetAccountId = '';
  selectedCategoryId: string | null = null;
  installments = 1;
  transactionDate = new Date().toISOString().substring(0, 10);

  isSubmitting = signal<boolean>(false);
  errorMessage = signal<string | null>(null);

  destinationAccounts = computed(() => {
    return this.accounts().filter((a) => a.id !== this.selectedAccountId);
  });

  filteredCategories = computed(() => {
    const currentType = this.txType();
    if (currentType === 'TRANSFER') return [];
    return this.categories().filter((c) => c.type === currentType);
  });

  isCreditCardSelected = computed(() => {
    const acc = this.accounts().find((a) => a.id === this.selectedAccountId);
    return acc?.type === 'CREDIT_CARD';
  });

  ngOnInit(): void {
    this.loadData();
    this.syncService.refresh$.subscribe(() => this.loadData());
  }

  loadData(): void {
    this.api.getAccounts().subscribe({
      next: (accs) => {
        this.accounts.set(accs);
        this.offlineDb.cacheAccounts(accs);
        if (accs.length > 0 && !this.selectedAccountId) {
          this.selectedAccountId = accs[0].id;
        }
      },
      error: async () => {
        const cached = await this.offlineDb.getCachedAccounts();
        if (cached.length > 0) {
          this.accounts.set(cached);
          if (!this.selectedAccountId) {
            this.selectedAccountId = cached[0].id;
          }
        }
      },
    });

    this.api.getCategories().subscribe({
      next: (cats) => {
        this.categories.set(cats);
        this.offlineDb.cacheCategories(cats);
      },
      error: async () => {
        const cached = await this.offlineDb.getCachedCategories();
        if (cached.length > 0) {
          this.categories.set(cached);
        }
      },
    });
  }

  setType(type: 'EXPENSE' | 'INCOME' | 'TRANSFER'): void {
    this.txType.set(type);
    if (type === 'TRANSFER') {
      this.selectedCategoryId = null;
    }
  }

  close(): void {
    this.syncService.closeQuickAdd();
    this.resetForm();
  }

  private resetForm(): void {
    this.amountInput = '';
    this.description = '';
    this.targetAccountId = '';
    this.selectedCategoryId = null;
    this.installments = 1;
    this.errorMessage.set(null);
    this.transactionDate = new Date().toISOString().substring(0, 10);
  }

  isFormValid(): boolean {
    const sanitized = this.amountInput.replace(',', '.').trim();
    const val = parseFloat(sanitized);
    if (isNaN(val) || val <= 0) return false;
    if (!this.description.trim()) return false;
    if (!this.selectedAccountId) return false;
    if (this.txType() === 'TRANSFER' && !this.targetAccountId) return false;
    return true;
  }

  async submit(): Promise<void> {
    if (!this.isFormValid() || this.isSubmitting()) return;

    this.isSubmitting.set(true);
    this.errorMessage.set(null);

    // Formata o valor monetário com precisão decimal exata
    const sanitizedAmount = parseFloat(this.amountInput.replace(',', '.')).toFixed(2);
    const isTransfer = this.txType() === 'TRANSFER';
    const clientTxId = crypto.randomUUID();

    const payload = {
      account_id: this.selectedAccountId,
      category_id: isTransfer ? null : this.selectedCategoryId,
      description: this.description.trim(),
      amount: sanitizedAmount,
      transaction_date: this.transactionDate,
      type: (isTransfer ? 'EXPENSE' : this.txType()) as TransactionType,
      is_transfer: isTransfer,
      transfer_target_account_id: isTransfer ? this.targetAccountId : null,
      installments: this.isCreditCardSelected() && this.txType() === 'EXPENSE' ? Number(this.installments) : 1,
      client_tx_id: clientTxId,
    };

    const accName = this.accounts().find((a) => a.id === this.selectedAccountId)?.name;
    const catName = this.categories().find((c) => c.id === this.selectedCategoryId)?.name;

    // 1. Se estiver explicitamente OFFLINE: enfileira direto no IndexedDB
    if (!this.outboxSync.isOnline()) {
      await this.outboxSync.enqueue(payload, accName, catName);
      this.isSubmitting.set(false);
      this.close();
      return;
    }

    // 2. Se estiver ONLINE: tenta enviar via API com fallback para a fila se a rede oscilar
    this.api.createTransaction(payload).subscribe({
      next: () => {
        this.isSubmitting.set(false);
        this.syncService.notifyDataChanged();
        this.close();
      },
      error: async (err: unknown) => {
        const httpErr = err as { status?: number; error?: { detail?: string } };
        const isNetworkDrop = !httpErr.status || httpErr.status === 0;

        if (isNetworkDrop) {
          // Conexão caiu durante a requisição: salva com segurança na fila offline
          await this.outboxSync.enqueue(payload, accName, catName);
          this.isSubmitting.set(false);
          this.close();
        } else {
          // Erro contábil ou validação (ex: saldo insuficiente, conta inválida)
          this.isSubmitting.set(false);
          const detail = httpErr?.error?.detail || 'Erro ao registrar transação. Verifique os dados.';
          this.errorMessage.set(typeof detail === 'string' ? detail : JSON.stringify(detail));
        }
      },
    });
  }
}
