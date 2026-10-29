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
import { Budget, BudgetSummaryResponse } from '../../../core/models/budget.model';
import { Category } from '../../../core/models/category.model';

@Component({
  selector: 'app-category-budgets-widget',
  standalone: true,
  imports: [CommonModule, FormsModule, PrivacyCurrencyPipe, IconComponent],
  template: `
    <div class="budgets-widget-wrapper">
      <!-- Cabeçalho Executivo de Orçamentos -->
      <div class="widget-header">
        <div class="header-left">
          <div class="title-row">
            <h2 class="widget-title">Orçamentos por Categoria</h2>
            <span class="period-badge">
              {{ formattedPeriod() }}
            </span>
          </div>
          <p class="widget-subtitle">
            Tetos de gastos mensais com acompanhamento semafórico em tempo real
          </p>
        </div>

        <div class="header-actions">
          <button class="btn btn-secondary action-btn" (click)="openCopyModal()" title="Copiar do mês anterior">
            <app-icon name="repeat" [size]="14" />
            <span class="action-btn-text">Copiar Mês Anterior</span>
          </button>
          <button class="btn btn-primary action-btn" (click)="openCreateModal()">
            <app-icon name="plus" [size]="14" />
            <span>Definir Teto</span>
          </button>
        </div>
      </div>

      <!-- Resumo Executivo Global (Consolidado do Mês) -->
      @if (summary() && (summary()?.budgets?.length ?? 0) > 0) {
        <div class="summary-cards-row">
          <div class="summary-card">
            <span class="summary-label">Total Orçado</span>
            <span class="summary-value currency-val tabular-nums">
              {{ summary()?.total_budgeted || '0.00' | privacyCurrency }}
            </span>
          </div>

          <div class="summary-card">
            <span class="summary-label">Total Consumido</span>
            <div class="summary-val-wrap">
              <span class="summary-value currency-val tabular-nums" [class.text-expense]="(summary()?.exceeded_count ?? 0) > 0">
                {{ summary()?.total_spent || '0.00' | privacyCurrency }}
              </span>
              <span
                class="status-chip"
                [class.chip-safe]="summaryOverallStatus() === 'SAFE'"
                [class.chip-warning]="summaryOverallStatus() === 'WARNING'"
                [class.chip-exceeded]="summaryOverallStatus() === 'EXCEEDED'"
              >
                {{ summary()?.overall_percentage || '0.0' }}%
              </span>
            </div>
          </div>

          <div class="summary-card">
            <span class="summary-label">Restante Livre</span>
            <span
              class="summary-value currency-val tabular-nums"
              [class.text-income]="(summaryRemainingDecimal() ?? 0) >= 0"
              [class.text-expense]="(summaryRemainingDecimal() ?? 0) < 0"
            >
              {{ summary()?.total_remaining || '0.00' | privacyCurrency }}
            </span>
          </div>
        </div>

        <!-- Barra Global Consolidada -->
        <div class="global-progress-bar-bg">
          <div
            class="global-progress-fill"
            [class.fill-safe]="summaryOverallStatus() === 'SAFE'"
            [class.fill-warning]="summaryOverallStatus() === 'WARNING'"
            [class.fill-exceeded]="summaryOverallStatus() === 'EXCEEDED'"
            [style.width.%]="summaryProgressBarWidth()"
          ></div>
        </div>

        <!-- Alertas Antecipados Proativos -->
        @if ((summary()?.exceeded_count ?? 0) > 0) {
          <div class="alert-box alert-exceeded">
            <app-icon name="arrow-up-right" [size]="16" />
            <span>
              Atenção: <strong>{{ summary()?.exceeded_count }} categoria(s)</strong> ultrapassaram o teto estipulado para este mês!
            </span>
          </div>
        } @else if ((summary()?.warning_count ?? 0) > 0) {
          <div class="alert-box alert-warning">
            <app-icon name="repeat" [size]="16" />
            <span>
              Aviso: <strong>{{ summary()?.warning_count }} categoria(s)</strong> atingiram mais de 80% do orçamento.
            </span>
          </div>
        }
      }

      <!-- Listagem de Orçamentos por Categoria -->
      <div class="budgets-list-container">
        @if (isLoading()) {
          <div class="budget-skeleton-loader">
            <div class="skeleton-row"></div>
            <div class="skeleton-row"></div>
            <div class="skeleton-row"></div>
          </div>
        } @else if (!summary() || (summary()?.budgets?.length ?? 0) === 0) {
          <div class="empty-budgets-state">
            <div class="empty-icon-wrap">
              <app-icon name="chart" [size]="28" />
            </div>
            <p class="empty-title">Nenhum orçamento configurado para este mês</p>
            <p class="empty-desc">
              Defina tetos mensais por categoria (ex: Alimentação, Lazer) para acompanhar gastos com alertas semafóricos.
            </p>
            <div class="empty-actions">
              <button class="btn btn-primary" (click)="openCreateModal()">
                <app-icon name="plus" [size]="14" />
                <span>Definir Primeiro Orçamento</span>
              </button>
              <button class="btn btn-secondary" (click)="openCopyModal()">
                <app-icon name="repeat" [size]="14" />
                <span>Copiar do Mês Anterior</span>
              </button>
            </div>
          </div>
        } @else {
          <div class="budgets-grid">
            @for (item of summary()?.budgets; track item.id) {
              <div
                class="budget-card"
                [class.border-warning]="item.status === 'WARNING'"
                [class.border-exceeded]="item.status === 'EXCEEDED'"
              >
                <!-- Cabeçalho do Card da Categoria -->
                <div class="card-top">
                  <div class="cat-info">
                    <div
                      class="cat-icon-box"
                      [style.backgroundColor]="(item.category_color || '#21D0B2') + '22'"
                      [style.color]="item.category_color || '#21D0B2'"
                    >
                      <app-icon [name]="item.category_icon || 'tag'" [size]="16" />
                    </div>
                    <div>
                      <span class="cat-name">{{ item.category_name }}</span>
                      <span class="cat-limit-hint">Teto: {{ item.limit_amount | privacyCurrency }}</span>
                    </div>
                  </div>

                  <div class="card-right-stats">
                    <div class="spent-display">
                      <span class="spent-value currency-val tabular-nums" [class.text-expense]="item.status === 'EXCEEDED'">
                        {{ item.spent_amount | privacyCurrency }}
                      </span>
                      <span class="limit-divider">/ {{ item.limit_amount | privacyCurrency }}</span>
                    </div>
                    <span
                      class="status-chip"
                      [class.chip-safe]="item.status === 'SAFE'"
                      [class.chip-warning]="item.status === 'WARNING'"
                      [class.chip-exceeded]="item.status === 'EXCEEDED'"
                    >
                      {{ item.percentage }}%
                    </span>
                  </div>
                </div>

                <!-- Barra de Progresso Semafórica -->
                <div class="progress-track">
                  <div
                    class="progress-fill"
                    [class.fill-safe]="item.status === 'SAFE'"
                    [class.fill-warning]="item.status === 'WARNING'"
                    [class.fill-exceeded]="item.status === 'EXCEEDED'"
                    [style.width.%]="calcBarWidth(item.percentage)"
                  ></div>
                </div>

                <!-- Rodapé do Card com Saldo Restante & Ações -->
                <div class="card-bottom">
                  <span class="remaining-text" [class.text-danger]="item.status === 'EXCEEDED'">
                    @if (item.status === 'EXCEEDED') {
                      Excedido em {{ calcExceededAbs(item.remaining_amount) | privacyCurrency }}
                    } @else {
                      {{ item.remaining_amount | privacyCurrency }} restantes
                    }
                  </span>

                  <div class="card-actions">
                    <button class="btn-icon-subtle" (click)="openEditModal(item)" title="Ajustar limite">
                      <app-icon name="credit-card" [size]="13" />
                    </button>
                    <button class="btn-icon-subtle delete-action" (click)="requestDelete(item.id)" title="Remover orçamento">
                      <app-icon name="plus" [size]="13" class="rotate-45" />
                    </button>
                  </div>
                </div>
              </div>
            }
          </div>
        }
      </div>

      <!-- Modal de Criação / Edição de Orçamento -->
      @if (isModalOpen()) {
        <div class="modal-backdrop" (click)="closeModal()">
          <div class="modal-dialog" (click)="$event.stopPropagation()">
            <div class="modal-header">
              <h3 class="modal-title">
                {{ editingBudget() ? 'Ajustar Limite de Gastos' : 'Novo Teto de Orçamento' }}
              </h3>
              <button class="btn-icon-subtle" (click)="closeModal()">
                <app-icon name="plus" [size]="16" class="rotate-45" />
              </button>
            </div>

            <div class="modal-body">
              @if (!editingBudget()) {
                <div class="form-group">
                  <label class="form-label">Categoria de Despesa</label>
                  <select class="form-select" [(ngModel)]="modalCategoryId">
                    <option value="" disabled>Selecione uma categoria...</option>
                    @for (cat of availableExpenseCategories(); track cat.id) {
                      <option [value]="cat.id">{{ cat.name }}</option>
                    }
                  </select>
                </div>
              } @else {
                <div class="editing-cat-badge">
                  <span class="badge-label">Categoria:</span>
                  <span class="badge-name">{{ editingBudget()?.category_name }}</span>
                </div>
              }

              <div class="form-group">
                <label class="form-label">Limite Mensal (R$)</label>
                <input
                  type="number"
                  step="0.01"
                  min="0.01"
                  placeholder="Ex: 500.00"
                  class="form-input"
                  [(ngModel)]="modalLimitAmount"
                />
              </div>

              @if (modalErrorMessage()) {
                <span class="form-error">{{ modalErrorMessage() }}</span>
              }
            </div>

            <div class="modal-footer">
              <button class="btn btn-secondary" (click)="closeModal()">Cancelar</button>
              <button class="btn btn-primary" (click)="submitBudgetModal()">
                <span>Salvar Teto</span>
              </button>
            </div>
          </div>
        </div>
      }

      <!-- Modal de Cópia do Mês Anterior -->
      @if (isCopyModalOpen()) {
        <div class="modal-backdrop" (click)="closeCopyModal()">
          <div class="modal-dialog" (click)="$event.stopPropagation()">
            <div class="modal-header">
              <h3 class="modal-title">Replicar Orçamentos do Mês Anterior</h3>
              <button class="btn-icon-subtle" (click)="closeCopyModal()">
                <app-icon name="plus" [size]="16" class="rotate-45" />
              </button>
            </div>

            <div class="modal-body">
              <p class="copy-desc">
                Deseja copiar todos os tetos orçamentários configurados no mês anterior ({{ previousMonthLabel() }})
                para o mês corrente ({{ currentMonthLabel() }})?
              </p>
              <p class="copy-hint">
                Categorias já personalizadas neste mês não serão sobrescritas.
              </p>
            </div>

            <div class="modal-footer">
              <button class="btn btn-secondary" (click)="closeCopyModal()">Cancelar</button>
              <button class="btn btn-primary" (click)="confirmCopyPreviousMonth()">
                <span>Confirmar Cópia</span>
              </button>
            </div>
          </div>
        </div>
      }
    </div>
  `,
  styles: [`
    .budgets-widget-wrapper {
      background: #121215;
      border: 1px solid rgba(255, 255, 255, 0.08);
      border-radius: 16px;
      padding: 24px;
      display: flex;
      flex-direction: column;
      gap: 20px;
      color: #fafafa;
    }

    .widget-header {
      display: flex;
      justify-content: space-between;
      align-items: flex-start;
      gap: 16px;
      flex-wrap: wrap;
    }

    .title-row {
      display: flex;
      align-items: center;
      gap: 12px;
    }

    .widget-title {
      font-size: 1.15rem;
      font-weight: 700;
      letter-spacing: -0.02em;
      margin: 0;
      color: #ffffff;
    }

    .period-badge {
      font-size: 0.72rem;
      font-weight: 600;
      background: rgba(29, 205, 254, 0.12);
      color: #1DCDFE;
      padding: 3px 10px;
      border-radius: 12px;
      border: 1px solid rgba(29, 205, 254, 0.25);
    }

    .widget-subtitle {
      font-size: 0.85rem;
      color: #a1a1aa;
      margin: 4px 0 0;
    }

    .header-actions {
      display: flex;
      gap: 8px;
    }

    .action-btn {
      display: inline-flex;
      align-items: center;
      gap: 6px;
      padding: 8px 14px;
      font-size: 0.82rem;
      font-weight: 600;
      border-radius: 8px;
      cursor: pointer;
    }

    @media (max-width: 640px) {
      .action-btn-text {
        display: none;
      }
    }

    /* Resumo Executivo */
    .summary-cards-row {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
      gap: 12px;
    }

    .summary-card {
      background: rgba(255, 255, 255, 0.03);
      border: 1px solid rgba(255, 255, 255, 0.05);
      border-radius: 12px;
      padding: 14px 16px;
      display: flex;
      flex-direction: column;
      gap: 4px;
    }

    .summary-label {
      font-size: 0.75rem;
      color: #71717a;
      text-transform: uppercase;
      letter-spacing: 0.04em;
      font-weight: 600;
    }

    .summary-val-wrap {
      display: flex;
      align-items: center;
      gap: 8px;
    }

    .summary-value {
      font-size: 1.25rem;
      font-weight: 700;
      color: #fafafa;
    }

    /* Barra Global Consolidada */
    .global-progress-bar-bg {
      height: 6px;
      background: rgba(255, 255, 255, 0.08);
      border-radius: 4px;
      overflow: hidden;
    }

    .global-progress-fill {
      height: 100%;
      border-radius: 4px;
      transition: width 0.4s ease-out;
    }

    /* Semáforos e Cores */
    .fill-safe {
      background: #21D0B2;
    }
    .fill-warning {
      background: #eab308;
    }
    .fill-exceeded {
      background: #ef4444;
    }

    .chip-safe {
      background: rgba(33, 208, 178, 0.12);
      color: #21D0B2;
      border: 1px solid rgba(33, 208, 178, 0.25);
    }
    .chip-warning {
      background: rgba(234, 179, 8, 0.12);
      color: #facc15;
      border: 1px solid rgba(234, 179, 8, 0.25);
    }
    .chip-exceeded {
      background: rgba(239, 68, 68, 0.12);
      color: #f87171;
      border: 1px solid rgba(239, 68, 68, 0.25);
    }

    .status-chip {
      font-size: 0.72rem;
      font-weight: 700;
      padding: 2px 8px;
      border-radius: 10px;
    }

    /* Caixas de Alerta */
    .alert-box {
      display: flex;
      align-items: center;
      gap: 10px;
      padding: 12px 16px;
      border-radius: 10px;
      font-size: 0.85rem;
      font-weight: 500;
    }

    .alert-warning {
      background: rgba(234, 179, 8, 0.08);
      border: 1px solid rgba(234, 179, 8, 0.2);
      color: #fde047;
    }

    .alert-exceeded {
      background: rgba(239, 68, 68, 0.08);
      border: 1px solid rgba(239, 68, 68, 0.25);
      color: #fca5a5;
    }

    /* Grid de Cards de Categoria */
    .budgets-grid {
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
      gap: 14px;
    }

    .budget-card {
      background: rgba(255, 255, 255, 0.02);
      border: 1px solid rgba(255, 255, 255, 0.06);
      border-radius: 12px;
      padding: 14px 16px;
      display: flex;
      flex-direction: column;
      gap: 12px;
      transition: all 0.2s ease;
    }

    .budget-card:hover {
      background: rgba(255, 255, 255, 0.04);
      border-color: rgba(255, 255, 255, 0.12);
    }

    .budget-card.border-warning {
      border-color: rgba(234, 179, 8, 0.35);
    }

    .budget-card.border-exceeded {
      border-color: rgba(239, 68, 68, 0.35);
    }

    .card-top {
      display: flex;
      justify-content: space-between;
      align-items: flex-start;
      gap: 8px;
    }

    .cat-info {
      display: flex;
      align-items: center;
      gap: 10px;
    }

    .cat-icon-box {
      width: 34px;
      height: 34px;
      border-radius: 8px;
      display: flex;
      align-items: center;
      justify-content: center;
    }

    .cat-name {
      font-size: 0.9rem;
      font-weight: 600;
      color: #ffffff;
      display: block;
    }

    .cat-limit-hint {
      font-size: 0.72rem;
      color: #71717a;
      display: block;
    }

    .card-right-stats {
      text-align: right;
      display: flex;
      flex-direction: column;
      align-items: flex-end;
      gap: 3px;
    }

    .spent-value {
      font-size: 0.92rem;
      font-weight: 700;
      color: #fafafa;
    }

    .limit-divider {
      font-size: 0.72rem;
      color: #71717a;
      margin-left: 2px;
    }

    /* Barra de Progresso Interna */
    .progress-track {
      height: 6px;
      background: rgba(255, 255, 255, 0.08);
      border-radius: 3px;
      overflow: hidden;
    }

    .progress-fill {
      height: 100%;
      border-radius: 3px;
      transition: width 0.35s ease;
    }

    .card-bottom {
      display: flex;
      justify-content: space-between;
      align-items: center;
      font-size: 0.75rem;
    }

    .remaining-text {
      color: #a1a1aa;
      font-weight: 500;
    }

    .remaining-text.text-danger {
      color: #ef4444;
      font-weight: 600;
    }

    .card-actions {
      display: flex;
      gap: 4px;
    }

    .btn-icon-subtle {
      background: transparent;
      border: none;
      color: #71717a;
      cursor: pointer;
      padding: 4px;
      border-radius: 6px;
      display: inline-flex;
      align-items: center;
      justify-content: center;
      transition: color 0.15s, background 0.15s;
    }

    .btn-icon-subtle:hover {
      color: #ffffff;
      background: rgba(255, 255, 255, 0.08);
    }

    .btn-icon-subtle.delete-action:hover {
      color: #ef4444;
      background: rgba(239, 68, 68, 0.12);
    }

    .rotate-45 {
      transform: rotate(45deg);
    }

    /* Estado Vazio */
    .empty-budgets-state {
      padding: 36px 20px;
      text-align: center;
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 12px;
    }

    .empty-icon-wrap {
      width: 52px;
      height: 52px;
      background: rgba(255, 255, 255, 0.04);
      border-radius: 50%;
      display: flex;
      align-items: center;
      justify-content: center;
      color: #71717a;
    }

    .empty-title {
      font-size: 0.95rem;
      font-weight: 600;
      color: #fafafa;
      margin: 0;
    }

    .empty-desc {
      font-size: 0.82rem;
      color: #a1a1aa;
      max-width: 420px;
      margin: 0;
    }

    .empty-actions {
      display: flex;
      gap: 10px;
      margin-top: 8px;
      flex-wrap: wrap;
      justify-content: center;
    }

    /* Modais */
    .modal-backdrop {
      position: fixed;
      inset: 0;
      background: rgba(0, 0, 0, 0.7);
      backdrop-filter: blur(4px);
      z-index: 999;
      display: flex;
      align-items: center;
      justify-content: center;
      padding: 16px;
    }

    .modal-dialog {
      background: #18181b;
      border: 1px solid rgba(255, 255, 255, 0.12);
      border-radius: 16px;
      width: 100%;
      max-width: 440px;
      padding: 24px;
      display: flex;
      flex-direction: column;
      gap: 18px;
      box-shadow: 0 20px 40px rgba(0, 0, 0, 0.5);
    }

    .modal-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
    }

    .modal-title {
      font-size: 1.05rem;
      font-weight: 700;
      margin: 0;
      color: #ffffff;
    }

    .modal-body {
      display: flex;
      flex-direction: column;
      gap: 14px;
    }

    .form-group {
      display: flex;
      flex-direction: column;
      gap: 6px;
    }

    .form-label {
      font-size: 0.8rem;
      font-weight: 600;
      color: #a1a1aa;
    }

    .form-select,
    .form-input {
      background: #09090b;
      border: 1px solid rgba(255, 255, 255, 0.12);
      border-radius: 8px;
      padding: 10px 12px;
      color: #ffffff;
      font-size: 0.9rem;
      outline: none;
    }

    .form-select:focus,
    .form-input:focus {
      border-color: #21D0B2;
    }

    .editing-cat-badge {
      display: flex;
      gap: 8px;
      padding: 10px 12px;
      background: rgba(255, 255, 255, 0.03);
      border-radius: 8px;
      border: 1px solid rgba(255, 255, 255, 0.08);
    }

    .badge-label {
      color: #71717a;
      font-size: 0.85rem;
    }

    .badge-name {
      color: #21D0B2;
      font-weight: 600;
      font-size: 0.85rem;
    }

    .form-error {
      color: #ef4444;
      font-size: 0.8rem;
    }

    .modal-footer {
      display: flex;
      justify-content: flex-end;
      gap: 10px;
    }

    .copy-desc {
      font-size: 0.88rem;
      color: #e4e4e7;
      margin: 0;
      line-height: 1.4;
    }

    .copy-hint {
      font-size: 0.78rem;
      color: #71717a;
      margin: 0;
    }

    /* Skeleton Loader */
    .budget-skeleton-loader {
      display: flex;
      flex-direction: column;
      gap: 12px;
    }

    .skeleton-row {
      height: 70px;
      background: rgba(255, 255, 255, 0.04);
      border-radius: 12px;
      animation: pulse 1.5s infinite;
    }

    @keyframes pulse {
      0%, 100% { opacity: 0.6; }
      50% { opacity: 0.25; }
    }
  `],
})
export class CategoryBudgetsWidgetComponent {
  summary = input<BudgetSummaryResponse | null>(null);
  categories = input<Category[]>([]);
  isLoading = input<boolean>(false);

  onSaveBudget = output<{ category_id: string; limit_amount: string; month: number; year: number }>();
  onDeleteBudget = output<string>();
  onCopyPreviousMonth = output<{ source_month: number; source_year: number; target_month: number; target_year: number }>();

  // Estados locais dos modais
  isModalOpen = signal<boolean>(false);
  isCopyModalOpen = signal<boolean>(false);
  editingBudget = signal<Budget | null>(null);

  modalCategoryId = '';
  modalLimitAmount: number | null = null;
  modalErrorMessage = signal<string>('');

  // Período formatado (ex: "10/2026")
  formattedPeriod = computed(() => {
    const s = this.summary();
    if (!s) {
      const now = new Date();
      return `${(now.getMonth() + 1).toString().padStart(2, '0')}/${now.getFullYear()}`;
    }
    return `${s.month.toString().padStart(2, '0')}/${s.year}`;
  });

  // Categorias de despesa disponíveis que ainda não têm orçamento no mês
  availableExpenseCategories = computed(() => {
    const all = this.categories().filter((c) => c.type === 'EXPENSE');
    const existingCatIds = new Set((this.summary()?.budgets || []).map((b) => b.category_id));
    return all.filter((c) => !existingCatIds.has(c.id));
  });

  summaryOverallStatus = computed(() => {
    const s = this.summary();
    if (!s) return 'SAFE';
    const pct = parseFloat(s.overall_percentage || '0');
    if (pct >= 100) return 'EXCEEDED';
    if (pct >= 80) return 'WARNING';
    return 'SAFE';
  });

  summaryProgressBarWidth = computed(() => {
    const s = this.summary();
    if (!s) return 0;
    const pct = parseFloat(s.overall_percentage || '0');
    return Math.min(100, Math.max(0, pct));
  });

  summaryRemainingDecimal = computed(() => {
    const s = this.summary();
    if (!s) return 0;
    return parseFloat(s.total_remaining || '0');
  });

  previousMonthLabel = computed(() => {
    const s = this.summary();
    const currMonth = s ? s.month : new Date().getMonth() + 1;
    const currYear = s ? s.year : new Date().getFullYear();
    const prevMonth = currMonth === 1 ? 12 : currMonth - 1;
    const prevYear = currMonth === 1 ? currYear - 1 : currYear;
    return `${prevMonth.toString().padStart(2, '0')}/${prevYear}`;
  });

  currentMonthLabel = computed(() => this.formattedPeriod());

  calcBarWidth(percentageStr: string): number {
    const pct = parseFloat(percentageStr || '0');
    return Math.min(100, Math.max(0, pct));
  }

  calcExceededAbs(remainingStr: string): string {
    const rem = parseFloat(remainingStr || '0');
    return Math.abs(rem).toFixed(2);
  }

  openCreateModal() {
    this.editingBudget.set(null);
    this.modalCategoryId = '';
    this.modalLimitAmount = null;
    this.modalErrorMessage.set('');
    this.isModalOpen.set(true);
  }

  openEditModal(budget: Budget) {
    this.editingBudget.set(budget);
    this.modalCategoryId = budget.category_id;
    this.modalLimitAmount = parseFloat(budget.limit_amount);
    this.modalErrorMessage.set('');
    this.isModalOpen.set(true);
  }

  closeModal() {
    this.isModalOpen.set(false);
    this.editingBudget.set(null);
  }

  submitBudgetModal() {
    if (!this.editingBudget() && !this.modalCategoryId) {
      this.modalErrorMessage.set('Por favor, selecione uma categoria.');
      return;
    }
    if (!this.modalLimitAmount || this.modalLimitAmount <= 0) {
      this.modalErrorMessage.set('Informe um valor de limite positivo.');
      return;
    }

    const s = this.summary();
    const now = new Date();
    const targetMonth = s ? s.month : now.getMonth() + 1;
    const targetYear = s ? s.year : now.getFullYear();

    this.onSaveBudget.emit({
      category_id: this.editingBudget() ? this.editingBudget()!.category_id : this.modalCategoryId,
      limit_amount: this.modalLimitAmount.toFixed(2),
      month: targetMonth,
      year: targetYear,
    });

    this.closeModal();
  }

  requestDelete(budgetId: string) {
    if (confirm('Deseja realmente remover o orçamento desta categoria?')) {
      this.onDeleteBudget.emit(budgetId);
    }
  }

  openCopyModal() {
    this.isCopyModalOpen.set(true);
  }

  closeCopyModal() {
    this.isCopyModalOpen.set(false);
  }

  confirmCopyPreviousMonth() {
    const s = this.summary();
    const currMonth = s ? s.month : new Date().getMonth() + 1;
    const currYear = s ? s.year : new Date().getFullYear();
    const sourceMonth = currMonth === 1 ? 12 : currMonth - 1;
    const sourceYear = currMonth === 1 ? currYear - 1 : currYear;

    this.onCopyPreviousMonth.emit({
      source_month: sourceMonth,
      source_year: sourceYear,
      target_month: currMonth,
      target_year: currYear,
    });

    this.closeCopyModal();
  }
}
