import { Component, computed, inject, OnInit, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ApiService } from '../../core/services/api.service';
import { FinanceSyncService } from '../../core/services/finance-sync.service';
import { Account, AccountCreate, AccountType } from '../../core/models/account.model';
import { CreditCardBill } from '../../core/models/bill.model';
import { PrivacyCurrencyPipe } from '../../core/pipes/privacy-currency.pipe';
import { IconComponent } from '../../shared/components/icon/icon.component';

@Component({
  selector: 'app-accounts',
  standalone: true,
  imports: [CommonModule, FormsModule, PrivacyCurrencyPipe, IconComponent],
  template: `
    <div class="accounts-page">
      <header class="page-header">
        <div>
          <h1 class="page-title">Contas e Cartões</h1>
          <p class="page-subtitle">Gestão de saldos, limites e pagamento de faturas</p>
        </div>

        <button class="btn btn-secondary new-account-btn" (click)="openNewAccountModal()">
          <app-icon name="plus" [size]="16" />
          <span>Nova Conta</span>
        </button>
      </header>

      @if (isLoading()) {
        <div class="loading-skeleton">
          <div class="skeleton-row"></div>
          <div class="skeleton-row"></div>
        </div>
      } @else {
        <!-- Seção: Contas Correntes & Carteiras -->
        <section class="accounts-section">
          <h2 class="section-title">Contas Correntes</h2>

          @if (checkingAccounts().length === 0) {
            <div class="empty-hint">Nenhuma conta corrente cadastrada.</div>
          } @else {
            <div class="accounts-grid">
              @for (acc of checkingAccounts(); track acc.id) {
                <div class="account-card">
                  <div class="acc-top">
                    <div class="acc-icon-box checking">
                      <app-icon name="wallet" [size]="20" />
                    </div>
                    <span class="acc-name">{{ acc.name }}</span>
                  </div>
                  <div class="acc-balance">
                    <span class="acc-balance-label">Saldo Disponível</span>
                    <span class="acc-balance-value currency-val tabular-nums">
                      {{ acc.balance | privacyCurrency }}
                    </span>
                  </div>
                </div>
              }
            </div>
          }
        </section>

        <!-- Seção: Cartões de Crédito -->
        <section class="accounts-section mt-24">
          <h2 class="section-title">Cartões de Crédito</h2>

          @if (creditCards().length === 0) {
            <div class="empty-hint">Nenhum cartão de crédito cadastrado.</div>
          } @else {
            <div class="cards-grid">
              @for (card of creditCards(); track card.id) {
                <div class="card-item">
                  <div class="card-main">
                    <div class="card-left">
                      <div class="acc-icon-box credit">
                        <app-icon name="credit-card" [size]="20" />
                      </div>
                      <div>
                        <h3 class="card-name">{{ card.name }}</h3>
                        <div class="card-dates">
                          <span>Fecha dia {{ card.closing_day || '--' }}</span>
                          <span>•</span>
                          <span>Vence dia {{ card.due_day || '--' }}</span>
                        </div>
                      </div>
                    </div>

                    <div class="card-limits">
                      <span class="limit-label">Limite Total</span>
                      <span class="limit-value tabular-nums">
                        {{ card.credit_limit || '0.00' | privacyCurrency }}
                      </span>
                    </div>
                  </div>

                  <!-- Fatura e Ação de Pagamento -->
                  <div class="card-footer">
                    <div class="bill-info">
                      <span class="bill-label">Fatura Aberta Atual</span>
                      <span class="bill-value text-expense tabular-nums">
                        {{ getCardBillAmount(card.id) | privacyCurrency }}
                      </span>
                    </div>

                    <button
                      class="btn btn-secondary pay-btn"
                      (click)="openPayBillModal(card)"
                      [disabled]="isBillZero(card.id)"
                    >
                      <span>Pagar Fatura</span>
                    </button>
                  </div>
                </div>
              }
            </div>
          }
        </section>
      }

      <!-- MODAL: Nova Conta / Cartão -->
      @if (isNewAccountModalOpen()) {
        <div class="modal-overlay" (click)="closeNewAccountModal()">
          <div class="modal-sheet" (click)="$event.stopPropagation()">
            <header class="modal-header">
              <h2 class="modal-title">Cadastrar Conta / Cartão</h2>
              <button class="btn btn-ghost btn-icon close-btn" (click)="closeNewAccountModal()">
                <app-icon name="x" [size]="20" />
              </button>
            </header>

            <form (ngSubmit)="saveAccount()" class="modal-form">
              <div class="form-group">
                <label class="form-label">Nome da Conta / Cartão</label>
                <input
                  type="text"
                  [(ngModel)]="newAccountName"
                  name="accName"
                  placeholder="Ex: Nubank, Itaú Principal..."
                  required
                />
              </div>

              <div class="form-group">
                <label class="form-label">Tipo</label>
                <select [(ngModel)]="newAccountType" name="accType" class="form-input">
                  <option value="CHECKING">Conta Corrente / Carteira</option>
                  <option value="CREDIT_CARD">Cartão de Crédito</option>
                  <option value="INVESTMENT">Investimentos</option>
                </select>
              </div>

              @if (newAccountType !== 'CREDIT_CARD') {
                <div class="form-group">
                  <label class="form-label">Saldo Inicial</label>
                  <input
                    type="text"
                    inputmode="decimal"
                    [(ngModel)]="newAccountBalance"
                    name="accBalance"
                    placeholder="0,00"
                    required
                  />
                </div>
              } @else {
                <div class="form-group">
                  <label class="form-label">Limite Total de Crédito</label>
                  <input
                    type="text"
                    inputmode="decimal"
                    [(ngModel)]="newAccountLimit"
                    name="accLimit"
                    placeholder="Ex: 5000,00"
                    required
                  />
                </div>

                <div class="form-row">
                  <div class="form-group flex-1">
                    <label class="form-label">Dia de Fechamento</label>
                    <input
                      type="number"
                      min="1"
                      max="31"
                      [(ngModel)]="newAccountClosingDay"
                      name="accClosing"
                      placeholder="Ex: 5"
                      required
                    />
                  </div>

                  <div class="form-group flex-1">
                    <label class="form-label">Dia de Vencimento</label>
                    <input
                      type="number"
                      min="1"
                      max="31"
                      [(ngModel)]="newAccountDueDay"
                      name="accDue"
                      placeholder="Ex: 12"
                      required
                    />
                  </div>
                </div>
              }

              @if (formError()) {
                <div class="error-banner">{{ formError() }}</div>
              }

              <div class="modal-actions">
                <button
                  type="submit"
                  class="btn btn-primary w-full"
                  [disabled]="isSavingAccount()"
                >
                  @if (isSavingAccount()) {
                    <span>Salvando...</span>
                  } @else {
                    <span>Salvar Conta</span>
                  }
                </button>
              </div>
            </form>
          </div>
        </div>
      }

      <!-- MODAL: Pagar Fatura -->
      @if (isPayBillModalOpen() && selectedCard()) {
        <div class="modal-overlay" (click)="closePayBillModal()">
          <div class="modal-sheet" (click)="$event.stopPropagation()">
            <header class="modal-header">
              <h2 class="modal-title">Pagar Fatura de Cartão</h2>
              <button class="btn btn-ghost btn-icon close-btn" (click)="closePayBillModal()">
                <app-icon name="x" [size]="20" />
              </button>
            </header>

            <div class="pay-bill-details">
              <p class="pay-card-name">Cartão: <strong>{{ selectedCard()?.name }}</strong></p>
              <div class="pay-amount-box">
                <span class="pay-amount-label">Valor da Fatura</span>
                <span class="pay-amount-val currency-val tabular-nums text-expense">
                  {{ selectedBill()?.total_amount || '0.00' | privacyCurrency }}
                </span>
              </div>
            </div>

            <form (ngSubmit)="confirmPayBill()" class="modal-form">
              <div class="form-group">
                <label class="form-label">Debitar da Conta Corrente</label>
                <select [(ngModel)]="paymentSourceAccountId" name="paySource" class="form-input" required>
                  <option value="" disabled selected>Selecione a conta para débito</option>
                  @for (acc of checkingAccounts(); track acc.id) {
                    <option [value]="acc.id">
                      {{ acc.name }} (Saldo: {{ acc.balance | privacyCurrency }})
                    </option>
                  }
                </select>
              </div>

              @if (formError()) {
                <div class="error-banner">{{ formError() }}</div>
              }

              <div class="modal-actions">
                <button
                  type="submit"
                  class="btn btn-primary w-full"
                  [disabled]="isPayingBill() || !paymentSourceAccountId"
                >
                  @if (isPayingBill()) {
                    <span>Processando Pagamento...</span>
                  } @else {
                    <app-icon name="check" [size]="18" />
                    <span>Confirmar Pagamento</span>
                  }
                </button>
              </div>
            </form>
          </div>
        </div>
      }
    </div>
  `,
  styles: `
    .accounts-page {
      padding: 18px 16px 40px;
      max-width: 768px;
      margin: 0 auto;
    }

    .page-header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      margin-bottom: 24px;

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

      .new-account-btn {
        min-height: 40px;
        padding: 0 14px;
        font-size: 13px;
      }
    }

    .section-title {
      font-size: 15px;
      font-weight: 600;
      color: var(--text-secondary);
      text-transform: uppercase;
      letter-spacing: 0.04em;
      margin-bottom: 12px;
    }

    .mt-24 {
      margin-top: 24px;
    }

    .accounts-grid {
      display: grid;
      grid-template-columns: repeat(2, 1fr);
      gap: 12px;

      @media (max-width: 480px) {
        grid-template-columns: 1fr;
      }
    }

    .account-card {
      background-color: var(--bg-surface);
      border: 1px solid var(--border-subtle);
      border-radius: var(--radius-lg);
      padding: 16px;
      display: flex;
      flex-direction: column;
      gap: 14px;

      .acc-top {
        display: flex;
        align-items: center;
        gap: 10px;
      }

      .acc-icon-box {
        width: 36px;
        height: 36px;
        border-radius: var(--radius-sm);
        display: flex;
        align-items: center;
        justify-content: center;

        &.checking {
          background-color: var(--color-accent-bg);
          color: var(--color-accent);
        }

        &.credit {
          background-color: var(--color-expense-bg);
          color: var(--color-expense);
        }
      }

      .acc-name {
        font-size: 15px;
        font-weight: 600;
        color: var(--text-primary);
      }

      .acc-balance {
        display: flex;
        flex-direction: column;
        gap: 2px;

        .acc-balance-label {
          font-size: 11px;
          color: var(--text-muted);
        }

        .acc-balance-value {
          font-size: 20px;
          font-weight: 700;
          color: var(--text-primary);
        }
      }
    }

    .cards-grid {
      display: flex;
      flex-direction: column;
      gap: 12px;
    }

    .card-item {
      background-color: var(--bg-surface);
      border: 1px solid var(--border-subtle);
      border-radius: var(--radius-lg);
      padding: 16px;
      display: flex;
      flex-direction: column;
      gap: 16px;

      .card-main {
        display: flex;
        align-items: center;
        justify-content: space-between;
      }

      .card-left {
        display: flex;
        align-items: center;
        gap: 12px;
      }

      .acc-icon-box.credit {
        width: 36px;
        height: 36px;
        border-radius: var(--radius-sm);
        display: flex;
        align-items: center;
        justify-content: center;
        background-color: var(--color-expense-bg);
        color: var(--color-expense);
      }

      .card-name {
        font-size: 15px;
        font-weight: 600;
        color: var(--text-primary);
      }

      .card-dates {
        display: flex;
        align-items: center;
        gap: 6px;
        font-size: 12px;
        color: var(--text-muted);
        margin-top: 2px;
      }

      .card-limits {
        display: flex;
        flex-direction: column;
        align-items: flex-end;
        gap: 2px;

        .limit-label {
          font-size: 11px;
          color: var(--text-muted);
        }

        .limit-value {
          font-size: 13px;
          font-weight: 500;
          color: var(--text-secondary);
        }
      }

      .card-footer {
        padding-top: 12px;
        border-top: 1px solid var(--border-muted);
        display: flex;
        align-items: center;
        justify-content: space-between;

        .bill-info {
          display: flex;
          flex-direction: column;
          gap: 2px;

          .bill-label {
            font-size: 11px;
            color: var(--text-muted);
          }

          .bill-value {
            font-size: 18px;
            font-weight: 700;
          }
        }

        .pay-btn {
          min-height: 36px;
          padding: 0 14px;
          font-size: 13px;
        }
      }
    }

    .empty-hint {
      padding: 16px;
      background-color: var(--bg-surface);
      border: 1px dashed var(--border-subtle);
      border-radius: var(--radius-md);
      font-size: 13px;
      color: var(--text-muted);
      text-align: center;
    }

    .modal-overlay {
      position: fixed;
      inset: 0;
      background-color: rgba(0, 0, 0, 0.75);
      backdrop-filter: blur(4px);
      z-index: 100;
      display: flex;
      flex-direction: column;
      justify-content: flex-end;
      animation: fadeIn 0.15s ease-out;
    }

    .modal-sheet {
      background-color: var(--bg-surface-elevated);
      border-top: 1px solid var(--border-subtle);
      border-radius: var(--radius-lg) var(--radius-lg) 0 0;
      padding: 20px 20px calc(24px + var(--safe-area-bottom));
      max-height: 90dvh;
      overflow-y: auto;
      box-shadow: 0 -8px 30px rgba(0, 0, 0, 0.5);
      animation: slideUp 0.2s cubic-bezier(0.16, 1, 0.3, 1);
    }

    .modal-header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      margin-bottom: 20px;
    }

    .modal-title {
      font-size: 18px;
      font-weight: 600;
    }

    .close-btn {
      min-height: 36px;
      min-width: 36px;
      border-radius: 50%;
    }

    .form-group {
      margin-bottom: 14px;
    }

    .form-row {
      display: flex;
      gap: 12px;
    }

    .flex-1 {
      flex: 1;
    }

    .form-label {
      display: block;
      font-size: 13px;
      font-weight: 500;
      color: var(--text-secondary);
      margin-bottom: 6px;
    }

    .error-banner {
      background-color: var(--color-expense-bg);
      color: var(--color-expense);
      padding: 10px 14px;
      border-radius: var(--radius-md);
      font-size: 13px;
      margin-bottom: 14px;
    }

    .modal-actions {
      margin-top: 20px;
    }

    .w-full {
      width: 100%;
    }

    .pay-bill-details {
      background-color: var(--bg-surface);
      border: 1px solid var(--border-subtle);
      border-radius: var(--radius-md);
      padding: 14px;
      margin-bottom: 18px;

      .pay-card-name {
        font-size: 13px;
        color: var(--text-secondary);
        margin-bottom: 8px;
      }

      .pay-amount-box {
        display: flex;
        align-items: baseline;
        justify-content: space-between;

        .pay-amount-label {
          font-size: 12px;
          color: var(--text-muted);
        }

        .pay-amount-val {
          font-size: 22px;
          font-weight: 700;
        }
      }
    }

    .text-expense {
      color: var(--color-expense) !important;
    }

    .loading-skeleton {
      display: flex;
      flex-direction: column;
      gap: 12px;

      .skeleton-row {
        height: 80px;
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
export class AccountsComponent implements OnInit {
  private api = inject(ApiService);
  private syncService = inject(FinanceSyncService);

  accounts = signal<Account[]>([]);
  billsMap = signal<Map<string, CreditCardBill>>(new Map());
  isLoading = signal<boolean>(true);

  // Modais
  isNewAccountModalOpen = signal<boolean>(false);
  isPayBillModalOpen = signal<boolean>(false);

  // Form Nova Conta
  newAccountName = '';
  newAccountType: AccountType = 'CHECKING';
  newAccountBalance = '0,00';
  newAccountLimit = '';
  newAccountClosingDay: number | null = null;
  newAccountDueDay: number | null = null;
  isSavingAccount = signal<boolean>(false);

  // Form Pagamento de Fatura
  selectedCard = signal<Account | null>(null);
  selectedBill = signal<CreditCardBill | null>(null);
  paymentSourceAccountId = '';
  isPayingBill = signal<boolean>(false);

  formError = signal<string | null>(null);

  checkingAccounts = computed(() => {
    return this.accounts().filter((a) => a.type === 'CHECKING' || a.type === 'CASH');
  });

  creditCards = computed(() => {
    return this.accounts().filter((a) => a.type === 'CREDIT_CARD');
  });

  ngOnInit(): void {
    this.loadAccounts();
    this.syncService.refresh$.subscribe(() => this.loadAccounts());
  }

  loadAccounts(): void {
    this.isLoading.set(true);

    this.api.getAccounts().subscribe({
      next: (accs) => {
        this.accounts.set(accs);
        this.isLoading.set(false);

        // Para cada cartão de crédito, carrega a fatura mais recente
        const cards = accs.filter((a) => a.type === 'CREDIT_CARD');
        for (const card of cards) {
          this.loadCardBills(card.id);
        }
      },
      error: () => this.isLoading.set(false),
    });
  }

  loadCardBills(cardId: string): void {
    this.api.getBills(cardId).subscribe({
      next: (bills) => {
        // Encontra a fatura aberta ou a última
        const activeBill = bills.find((b) => b.status === 'OPEN' || b.status === 'CLOSED') || bills[0];
        if (activeBill) {
          const map = new Map(this.billsMap());
          map.set(cardId, activeBill);
          this.billsMap.set(map);
        }
      },
    });
  }

  getCardBillAmount(cardId: string): string {
    const bill = this.billsMap().get(cardId);
    return bill ? bill.total_amount : '0.00';
  }

  isBillZero(cardId: string): boolean {
    const amount = parseFloat(this.getCardBillAmount(cardId));
    return isNaN(amount) || amount <= 0;
  }

  openNewAccountModal(): void {
    this.newAccountName = '';
    this.newAccountType = 'CHECKING';
    this.newAccountBalance = '0,00';
    this.newAccountLimit = '';
    this.newAccountClosingDay = null;
    this.newAccountDueDay = null;
    this.formError.set(null);
    this.isNewAccountModalOpen.set(true);
  }

  closeNewAccountModal(): void {
    this.isNewAccountModalOpen.set(false);
  }

  saveAccount(): void {
    if (!this.newAccountName.trim()) {
      this.formError.set('Informe o nome da conta.');
      return;
    }

    this.isSavingAccount.set(true);
    this.formError.set(null);

    const initialBal = this.newAccountType === 'CREDIT_CARD'
      ? '0.00'
      : (parseFloat(this.newAccountBalance.replace(',', '.')) || 0).toFixed(2);

    const creditLim = this.newAccountType === 'CREDIT_CARD' && this.newAccountLimit
      ? (parseFloat(this.newAccountLimit.replace(',', '.')) || 0).toFixed(2)
      : null;

    const payload: AccountCreate = {
      name: this.newAccountName.trim(),
      type: this.newAccountType,
      initial_balance: initialBal,
      credit_limit: creditLim,
      closing_day: this.newAccountClosingDay ? Number(this.newAccountClosingDay) : null,
      due_day: this.newAccountDueDay ? Number(this.newAccountDueDay) : null,
    };

    this.api.createAccount(payload).subscribe({
      next: () => {
        this.isSavingAccount.set(false);
        this.closeNewAccountModal();
        this.syncService.notifyDataChanged();
      },
      error: (err) => {
        this.isSavingAccount.set(false);
        const detail = err?.error?.detail || 'Erro ao criar conta. Verifique os dados.';
        this.formError.set(typeof detail === 'string' ? detail : JSON.stringify(detail));
      },
    });
  }

  openPayBillModal(card: Account): void {
    const bill = this.billsMap().get(card.id);
    if (!bill) return;

    this.selectedCard.set(card);
    this.selectedBill.set(bill);
    this.paymentSourceAccountId = this.checkingAccounts()[0]?.id || '';
    this.formError.set(null);
    this.isPayBillModalOpen.set(true);
  }

  closePayBillModal(): void {
    this.isPayBillModalOpen.set(false);
    this.selectedCard.set(null);
    this.selectedBill.set(null);
  }

  confirmPayBill(): void {
    const bill = this.selectedBill();
    if (!bill || !this.paymentSourceAccountId || this.isPayingBill()) return;

    this.isPayingBill.set(true);
    this.formError.set(null);

    this.api.payBill(bill.id, this.paymentSourceAccountId).subscribe({
      next: () => {
        this.isPayingBill.set(false);
        this.closePayBillModal();
        this.syncService.notifyDataChanged();
      },
      error: (err) => {
        this.isPayingBill.set(false);
        const detail = err?.error?.detail || 'Erro ao processar pagamento da fatura.';
        this.formError.set(typeof detail === 'string' ? detail : JSON.stringify(detail));
      },
    });
  }
}
