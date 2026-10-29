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
  FinancialGoal,
  FinancialGoalCreate,
  FinancialGoalSummaryResponse,
  FinancialGoalUpdate,
  GoalContributionCreate,
} from '../../../core/models/goal.model';
import { Account } from '../../../core/models/account.model';

@Component({
  selector: 'app-financial-goals-widget',
  standalone: true,
  imports: [CommonModule, FormsModule, PrivacyCurrencyPipe, IconComponent],
  template: `
    <div class="goals-widget-wrapper">
      <!-- Cabeçalho da Central de Metas -->
      <div class="widget-header">
        <div class="header-left">
          <div class="title-row">
            <h2 class="widget-title">Central de Metas & Objetivos</h2>
            <span class="count-badge">
              {{ summary()?.goals?.length || 0 }} {{ (summary()?.goals?.length === 1) ? 'meta' : 'metas' }}
            </span>
          </div>
          <p class="widget-subtitle">
            Acompanhamento de objetivos de médio/longo prazo e saldo de cofrinhos
          </p>
        </div>

        <button class="btn btn-primary action-btn" (click)="openCreateModal()">
          <app-icon name="plus" [size]="14" />
          <span>Nova Meta</span>
        </button>
      </div>

      <!-- Resumo Executivo Consolidado -->
      @if (summary() && (summary()?.goals?.length ?? 0) > 0) {
        <div class="summary-cards-row">
          <div class="summary-card">
            <span class="summary-label">Total Alvo</span>
            <span class="summary-value currency-val tabular-nums">
              {{ summary()?.total_target || '0.00' | privacyCurrency }}
            </span>
          </div>

          <div class="summary-card">
            <span class="summary-label">Total Acumulado</span>
            <div class="summary-val-wrap">
              <span class="summary-value currency-val text-income tabular-nums">
                {{ summary()?.total_current || '0.00' | privacyCurrency }}
              </span>
              <span class="status-chip chip-income">
                {{ summary()?.overall_percentage || '0.0' }}%
              </span>
            </div>
          </div>

          <div class="summary-card">
            <span class="summary-label">Concluídas / Em Andamento</span>
            <span class="summary-value tabular-nums">
              <span class="text-income">{{ summary()?.goals_completed_count || 0 }}</span>
              <span class="text-muted"> / {{ summary()?.goals_in_progress_count || 0 }}</span>
            </span>
          </div>
        </div>

        <!-- Barra Global de Progresso Patrimonial das Metas -->
        <div class="global-progress-bar-bg">
          <div
            class="global-progress-fill"
            [style.width.%]="calcProgressBarWidth(summary()?.overall_percentage || '0')"
          ></div>
        </div>
      }

      <!-- Grid de Metas -->
      <div class="goals-list-container">
        @if (isLoading()) {
          <div class="goal-skeleton-loader">
            <div class="skeleton-row"></div>
            <div class="skeleton-row"></div>
          </div>
        } @else if (!summary() || (summary()?.goals?.length ?? 0) === 0) {
          <div class="empty-goals-state">
            <div class="empty-icon-wrap">
              <app-icon name="repeat" [size]="28" />
            </div>
            <p class="empty-title">Nenhuma meta cadastrada ainda</p>
            <p class="empty-desc">
              Crie objetivos claros como "Reserva de Emergência", "Troca de Celular" ou "Viagem" para acompanhar seu progresso e ritmo de economia.
            </p>
            <button class="btn btn-primary mt-12" (click)="openCreateModal()">
              <app-icon name="plus" [size]="14" />
              <span>Cadastrar Primeira Meta</span>
            </button>
          </div>
        } @else {
          <div class="goals-grid">
            @for (goal of summary()?.goals; track goal.id) {
              <div class="goal-card" [class.goal-completed]="goal.status === 'COMPLETED'">
                <!-- Topo do Card -->
                <div class="card-header-row">
                  <div class="goal-title-wrap">
                    <div
                      class="goal-icon-box"
                      [style.backgroundColor]="(goal.color || '#21D0B2') + '22'"
                      [style.color]="goal.color || '#21D0B2'"
                    >
                      <app-icon [name]="goal.icon || 'target'" [size]="18" />
                    </div>
                    <div>
                      <span class="goal-name">{{ goal.name }}</span>
                      @if (goal.description) {
                        <span class="goal-desc">{{ goal.description }}</span>
                      }
                    </div>
                  </div>

                  <span
                    class="status-chip"
                    [class.chip-completed]="goal.status === 'COMPLETED'"
                    [class.chip-in-progress]="goal.status === 'IN_PROGRESS'"
                  >
                    @if (goal.status === 'COMPLETED') {
                      Concluída 🎉
                    } @else {
                      {{ goal.percentage }}%
                    }
                  </span>
                </div>

                <!-- Valores: Atual / Alvo -->
                <div class="card-values-row">
                  <div class="amount-current">
                    <span class="val-number currency-val tabular-nums" [class.text-income]="goal.status === 'COMPLETED'">
                      {{ goal.current_amount | privacyCurrency }}
                    </span>
                    <span class="val-target">de {{ goal.target_amount | privacyCurrency }}</span>
                  </div>
                  <span class="amount-remaining">
                    @if (goal.status === 'COMPLETED') {
                      Meta atingida!
                    } @else {
                      Faltam {{ goal.remaining_amount | privacyCurrency }}
                    }
                  </span>
                </div>

                <!-- Barra de Progresso Individual -->
                <div class="goal-progress-track">
                  <div
                    class="goal-progress-fill"
                    [style.backgroundColor]="goal.color || '#21D0B2'"
                    [style.width.%]="calcProgressBarWidth(goal.percentage)"
                  ></div>
                </div>

                <!-- Metadados de Prazo, Ritmo e Conta Vinculada -->
                <div class="goal-meta-row">
                  @if (goal.status !== 'COMPLETED' && goal.days_remaining !== null) {
                    <div class="meta-item">
                      <app-icon name="repeat" [size]="12" />
                      <span>Restam {{ goal.days_remaining }} dias</span>
                    </div>
                  }
                  @if (goal.status !== 'COMPLETED' && goal.monthly_pace_needed && goal.monthly_pace_needed !== '0.00') {
                    <div class="meta-item text-income">
                      <app-icon name="arrow-up-right" [size]="12" />
                      <span>Poupe {{ goal.monthly_pace_needed | privacyCurrency }}/mês</span>
                    </div>
                  }
                  @if (goal.account_name) {
                    <div class="meta-item text-muted">
                      <app-icon name="wallet" [size]="12" />
                      <span>{{ goal.account_name }}</span>
                    </div>
                  }
                </div>

                <!-- Ações do Card -->
                <div class="card-footer-actions">
                  <button class="btn btn-secondary btn-sm" (click)="openContributeModal(goal)">
                    <app-icon name="plus" [size]="13" />
                    <span>Aportar / Resgatar</span>
                  </button>

                  <div class="aux-actions">
                    <button class="btn-icon-subtle" (click)="openEditModal(goal)" title="Editar meta">
                      <app-icon name="credit-card" [size]="13" />
                    </button>
                    <button class="btn-icon-subtle delete-action" (click)="requestDelete(goal.id)" title="Excluir meta">
                      <app-icon name="plus" [size]="13" class="rotate-45" />
                    </button>
                  </div>
                </div>
              </div>
            }
          </div>
        }
      </div>

      <!-- Modal de Criação / Edição de Meta -->
      @if (isGoalModalOpen()) {
        <div class="modal-backdrop" (click)="closeGoalModal()">
          <div class="modal-dialog" (click)="$event.stopPropagation()">
            <div class="modal-header">
              <h3 class="modal-title">
                {{ editingGoal() ? 'Editar Meta Financeira' : 'Cadastrar Nova Meta' }}
              </h3>
              <button class="btn-icon-subtle" (click)="closeGoalModal()">
                <app-icon name="plus" [size]="16" class="rotate-45" />
              </button>
            </div>

            <div class="modal-body">
              <div class="form-group">
                <label class="form-label">Nome da Meta *</label>
                <input
                  type="text"
                  placeholder="Ex: Reserva de Emergência, Celular Novo..."
                  class="form-input"
                  [(ngModel)]="formName"
                />
              </div>

              <div class="form-group">
                <label class="form-label">Descrição (Opcional)</label>
                <input
                  type="text"
                  placeholder="Ex: 6 meses de contas essenciais guardados"
                  class="form-input"
                  [(ngModel)]="formDescription"
                />
              </div>

              <div class="form-row">
                <div class="form-group flex-1">
                  <label class="form-label">Valor Alvo (R$) *</label>
                  <input
                    type="number"
                    step="0.01"
                    min="0.01"
                    placeholder="Ex: 10000.00"
                    class="form-input"
                    [(ngModel)]="formTargetAmount"
                  />
                </div>

                @if (!editingGoal()) {
                  <div class="form-group flex-1">
                    <label class="form-label">Aporte Inicial (R$)</label>
                    <input
                      type="number"
                      step="0.01"
                      min="0.00"
                      placeholder="0.00"
                      class="form-input"
                      [(ngModel)]="formInitialAmount"
                    />
                  </div>
                }
              </div>

              <div class="form-group">
                <label class="form-label">Data Limite / Prazo (Opcional)</label>
                <input
                  type="date"
                  class="form-input"
                  [(ngModel)]="formDeadlineDate"
                />
              </div>

              <div class="form-group">
                <label class="form-label">Vincular a Conta de Cofrinho/Reserva (Opcional)</label>
                <select class="form-select" [(ngModel)]="formAccountId">
                  <option value="">Sem vínculo com conta</option>
                  @for (acc of savingsAccounts(); track acc.id) {
                    <option [value]="acc.id">{{ acc.name }} ({{ acc.balance | privacyCurrency }})</option>
                  }
                </select>
              </div>

              @if (formAccountId) {
                <label class="checkbox-label">
                  <input type="checkbox" [(ngModel)]="formAutoSync" />
                  <span>Sincronizar saldo automaticamente com a conta vinculada</span>
                </label>
              }

              <!-- Paleta de Cores e Ícones Rápidos -->
              <div class="form-group">
                <label class="form-label">Cor da Meta</label>
                <div class="color-options-row">
                  @for (c of presetColors; track c) {
                    <button
                      type="button"
                      class="color-dot"
                      [style.backgroundColor]="c"
                      [class.selected]="formColor === c"
                      (click)="formColor = c"
                    ></button>
                  }
                </div>
              </div>

              @if (formErrorMessage()) {
                <span class="form-error">{{ formErrorMessage() }}</span>
              }
            </div>

            <div class="modal-footer">
              <button class="btn btn-secondary" (click)="closeGoalModal()">Cancelar</button>
              <button class="btn btn-primary" (click)="submitGoalModal()">
                <span>{{ editingGoal() ? 'Salvar Alterações' : 'Criar Meta' }}</span>
              </button>
            </div>
          </div>
        </div>
      }

      <!-- Modal de Aporte / Resgate -->
      @if (isContributeModalOpen()) {
        <div class="modal-backdrop" (click)="closeContributeModal()">
          <div class="modal-dialog" (click)="$event.stopPropagation()">
            <div class="modal-header">
              <div>
                <h3 class="modal-title">Lançar Aporte na Meta</h3>
                <span class="modal-subtitle">{{ activeGoalForContribution()?.name }}</span>
              </div>
              <button class="btn-icon-subtle" (click)="closeContributeModal()">
                <app-icon name="plus" [size]="16" class="rotate-45" />
              </button>
            </div>

            <div class="modal-body">
              <div class="mode-toggle-pills">
                <button
                  type="button"
                  class="toggle-pill"
                  [class.active]="contributionType === 'DEPOSIT'"
                  (click)="contributionType = 'DEPOSIT'"
                >
                  <app-icon name="plus" [size]="13" />
                  <span>Aporte (Guardar)</span>
                </button>
                <button
                  type="button"
                  class="toggle-pill text-expense"
                  [class.active]="contributionType === 'WITHDRAW'"
                  (click)="contributionType = 'WITHDRAW'"
                >
                  <app-icon name="arrow-down-left" [size]="13" />
                  <span>Resgate (Retirar)</span>
                </button>
              </div>

              <div class="form-group">
                <label class="form-label">Valor (R$) *</label>
                <input
                  type="number"
                  step="0.01"
                  min="0.01"
                  placeholder="Ex: 250.00"
                  class="form-input"
                  [(ngModel)]="contributionAmount"
                />
              </div>

              <div class="form-group">
                <label class="form-label">Observação (Opcional)</label>
                <input
                  type="text"
                  placeholder="Ex: Economia do mês, Rendimento caixinha..."
                  class="form-input"
                  [(ngModel)]="contributionNotes"
                />
              </div>

              @if (contributeErrorMessage()) {
                <span class="form-error">{{ contributeErrorMessage() }}</span>
              }
            </div>

            <div class="modal-footer">
              <button class="btn btn-secondary" (click)="closeContributeModal()">Cancelar</button>
              <button class="btn btn-primary" (click)="submitContribution()">
                <span>Confirmar {{ contributionType === 'DEPOSIT' ? 'Aporte' : 'Resgate' }}</span>
              </button>
            </div>
          </div>
        </div>
      }
    </div>
  `,
  styles: [`
    .goals-widget-wrapper {
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

    .count-badge {
      font-size: 0.72rem;
      font-weight: 600;
      background: rgba(33, 208, 178, 0.12);
      color: #21D0B2;
      padding: 3px 10px;
      border-radius: 12px;
      border: 1px solid rgba(33, 208, 178, 0.25);
    }

    .widget-subtitle {
      font-size: 0.85rem;
      color: #a1a1aa;
      margin: 4px 0 0;
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

    .status-chip {
      font-size: 0.72rem;
      font-weight: 700;
      padding: 2px 8px;
      border-radius: 10px;
    }

    .chip-income {
      background: rgba(33, 208, 178, 0.12);
      color: #21D0B2;
      border: 1px solid rgba(33, 208, 178, 0.25);
    }

    .chip-completed {
      background: rgba(52, 245, 197, 0.15);
      color: #34F5C5;
      border: 1px solid rgba(52, 245, 197, 0.35);
    }

    .chip-in-progress {
      background: rgba(29, 205, 254, 0.12);
      color: #1DCDFE;
      border: 1px solid rgba(29, 205, 254, 0.25);
    }

    /* Barra Global */
    .global-progress-bar-bg {
      height: 6px;
      background: rgba(255, 255, 255, 0.08);
      border-radius: 4px;
      overflow: hidden;
    }

    .global-progress-fill {
      height: 100%;
      border-radius: 4px;
      background: linear-gradient(90deg, #1DCDFE 0%, #21D0B2 50%, #34F5C5 100%);
      transition: width 0.4s ease-out;
    }

    /* Grid de Metas */
    .goals-grid {
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(300px, 1fr));
      gap: 16px;
    }

    .goal-card {
      background: rgba(255, 255, 255, 0.02);
      border: 1px solid rgba(255, 255, 255, 0.06);
      border-radius: 14px;
      padding: 16px 18px;
      display: flex;
      flex-direction: column;
      gap: 14px;
      transition: all 0.2s ease;
    }

    .goal-card:hover {
      background: rgba(255, 255, 255, 0.04);
      border-color: rgba(255, 255, 255, 0.14);
    }

    .goal-card.goal-completed {
      border-color: rgba(33, 208, 178, 0.35);
      background: rgba(33, 208, 178, 0.02);
    }

    .card-header-row {
      display: flex;
      justify-content: space-between;
      align-items: flex-start;
      gap: 10px;
    }

    .goal-title-wrap {
      display: flex;
      align-items: center;
      gap: 12px;
    }

    .goal-icon-box {
      width: 40px;
      height: 40px;
      border-radius: 10px;
      display: flex;
      align-items: center;
      justify-content: center;
    }

    .goal-name {
      font-size: 0.95rem;
      font-weight: 700;
      color: #ffffff;
      display: block;
    }

    .goal-desc {
      font-size: 0.75rem;
      color: #a1a1aa;
      display: block;
      margin-top: 1px;
    }

    /* Valores */
    .card-values-row {
      display: flex;
      justify-content: space-between;
      align-items: baseline;
    }

    .amount-current {
      display: flex;
      align-items: baseline;
      gap: 6px;
    }

    .val-number {
      font-size: 1.15rem;
      font-weight: 700;
      color: #fafafa;
    }

    .val-target {
      font-size: 0.8rem;
      color: #71717a;
    }

    .amount-remaining {
      font-size: 0.75rem;
      color: #a1a1aa;
      font-weight: 500;
    }

    /* Barra de Progresso da Meta */
    .goal-progress-track {
      height: 8px;
      background: rgba(255, 255, 255, 0.08);
      border-radius: 4px;
      overflow: hidden;
    }

    .goal-progress-fill {
      height: 100%;
      border-radius: 4px;
      transition: width 0.35s ease;
    }

    /* Metadados */
    .goal-meta-row {
      display: flex;
      align-items: center;
      gap: 12px;
      flex-wrap: wrap;
      font-size: 0.75rem;
    }

    .meta-item {
      display: inline-flex;
      align-items: center;
      gap: 4px;
      font-weight: 500;
      color: #a1a1aa;
    }

    /* Ações */
    .card-footer-actions {
      display: flex;
      justify-content: space-between;
      align-items: center;
      padding-top: 6px;
      border-top: 1px solid rgba(255, 255, 255, 0.05);
    }

    .btn-sm {
      padding: 6px 12px;
      font-size: 0.78rem;
      border-radius: 6px;
    }

    .aux-actions {
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
    .empty-goals-state {
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

    .mt-12 {
      margin-top: 12px;
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
      max-width: 460px;
      padding: 24px;
      display: flex;
      flex-direction: column;
      gap: 18px;
      box-shadow: 0 20px 40px rgba(0, 0, 0, 0.5);
    }

    .modal-header {
      display: flex;
      justify-content: space-between;
      align-items: flex-start;
    }

    .modal-title {
      font-size: 1.05rem;
      font-weight: 700;
      margin: 0;
      color: #ffffff;
    }

    .modal-subtitle {
      font-size: 0.8rem;
      color: #21D0B2;
      display: block;
      margin-top: 2px;
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

    .form-row {
      display: flex;
      gap: 12px;
    }

    .flex-1 {
      flex: 1;
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

    .checkbox-label {
      display: flex;
      align-items: center;
      gap: 8px;
      font-size: 0.82rem;
      color: #d4d4d8;
      cursor: pointer;
    }

    .color-options-row {
      display: flex;
      gap: 10px;
    }

    .color-dot {
      width: 26px;
      height: 26px;
      border-radius: 50%;
      border: 2px solid transparent;
      cursor: pointer;
      transition: transform 0.15s, border-color 0.15s;
    }

    .color-dot.selected {
      border-color: #ffffff;
      transform: scale(1.15);
    }

    .mode-toggle-pills {
      display: flex;
      gap: 8px;
      background: rgba(255, 255, 255, 0.04);
      padding: 4px;
      border-radius: 10px;
    }

    .toggle-pill {
      flex: 1;
      display: inline-flex;
      align-items: center;
      justify-content: center;
      gap: 6px;
      padding: 8px 12px;
      background: transparent;
      border: none;
      color: #a1a1aa;
      font-size: 0.82rem;
      font-weight: 600;
      border-radius: 8px;
      cursor: pointer;
    }

    .toggle-pill.active {
      background: rgba(33, 208, 178, 0.15);
      color: #21D0B2;
    }

    .toggle-pill.active.text-expense {
      background: rgba(239, 68, 68, 0.15);
      color: #ef4444;
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

    /* Skeleton */
    .goal-skeleton-loader {
      display: flex;
      flex-direction: column;
      gap: 12px;
    }

    .skeleton-row {
      height: 90px;
      background: rgba(255, 255, 255, 0.04);
      border-radius: 14px;
      animation: pulse 1.5s infinite;
    }

    @keyframes pulse {
      0%, 100% { opacity: 0.6; }
      50% { opacity: 0.25; }
    }
  `],
})
export class FinancialGoalsWidgetComponent {
  summary = input<FinancialGoalSummaryResponse | null>(null);
  accounts = input<Account[]>([]);
  isLoading = input<boolean>(false);

  onCreateGoal = output<FinancialGoalCreate>();
  onUpdateGoal = output<{ id: string; data: FinancialGoalUpdate }>();
  onContribute = output<{ id: string; data: GoalContributionCreate }>();
  onDeleteGoal = output<string>();

  // Estados locais dos modais
  isGoalModalOpen = signal<boolean>(false);
  isContributeModalOpen = signal<boolean>(false);
  editingGoal = signal<FinancialGoal | null>(null);
  activeGoalForContribution = signal<FinancialGoal | null>(null);

  // Campos do formulário de criação/edição
  formName = '';
  formDescription = '';
  formTargetAmount: number | null = null;
  formInitialAmount: number | null = null;
  formDeadlineDate = '';
  formAccountId = '';
  formAutoSync = false;
  formColor = '#21D0B2';
  formIcon = 'target';
  formErrorMessage = signal<string>('');

  // Campos do formulário de aporte
  contributionType: 'DEPOSIT' | 'WITHDRAW' = 'DEPOSIT';
  contributionAmount: number | null = null;
  contributionNotes = '';
  contributeErrorMessage = signal<string>('');

  presetColors = ['#21D0B2', '#1DCDFE', '#34F5C5', '#fbbf24', '#f43f5e', '#a855f7'];

  // Contas filtradas do tipo SAVINGS ou INVESTMENT
  savingsAccounts = computed(() =>
    this.accounts().filter((a) => a.type === 'SAVINGS' || a.type === 'INVESTMENT')
  );

  calcProgressBarWidth(percentageStr: string): number {
    const pct = parseFloat(percentageStr || '0');
    return Math.min(100, Math.max(0, pct));
  }

  openCreateModal() {
    this.editingGoal.set(null);
    this.formName = '';
    this.formDescription = '';
    this.formTargetAmount = null;
    this.formInitialAmount = null;
    this.formDeadlineDate = '';
    this.formAccountId = '';
    this.formAutoSync = false;
    this.formColor = '#21D0B2';
    this.formIcon = 'target';
    this.formErrorMessage.set('');
    this.isGoalModalOpen.set(true);
  }

  openEditModal(goal: FinancialGoal) {
    this.editingGoal.set(goal);
    this.formName = goal.name;
    this.formDescription = goal.description || '';
    this.formTargetAmount = parseFloat(goal.target_amount);
    this.formDeadlineDate = goal.deadline_date || '';
    this.formAccountId = goal.account_id || '';
    this.formAutoSync = goal.auto_sync_account;
    this.formColor = goal.color || '#21D0B2';
    this.formIcon = goal.icon || 'target';
    this.formErrorMessage.set('');
    this.isGoalModalOpen.set(true);
  }

  closeGoalModal() {
    this.isGoalModalOpen.set(false);
    this.editingGoal.set(null);
  }

  submitGoalModal() {
    if (!this.formName.trim()) {
      this.formErrorMessage.set('Informe o nome da meta.');
      return;
    }
    if (!this.formTargetAmount || this.formTargetAmount <= 0) {
      this.formErrorMessage.set('Informe um valor alvo positivo.');
      return;
    }

    if (this.editingGoal()) {
      this.onUpdateGoal.emit({
        id: this.editingGoal()!.id,
        data: {
          name: this.formName.trim(),
          description: this.formDescription.trim() || null,
          target_amount: this.formTargetAmount.toFixed(2),
          deadline_date: this.formDeadlineDate || null,
          account_id: this.formAccountId || null,
          auto_sync_account: this.formAutoSync,
          color: this.formColor,
          icon: this.formIcon,
        },
      });
    } else {
      this.onCreateGoal.emit({
        name: this.formName.trim(),
        description: this.formDescription.trim() || null,
        target_amount: this.formTargetAmount.toFixed(2),
        initial_amount: (this.formInitialAmount && this.formInitialAmount > 0)
          ? this.formInitialAmount.toFixed(2)
          : '0.00',
        deadline_date: this.formDeadlineDate || null,
        account_id: this.formAccountId || null,
        auto_sync_account: this.formAutoSync,
        color: this.formColor,
        icon: this.formIcon,
      });
    }

    this.closeGoalModal();
  }

  openContributeModal(goal: FinancialGoal) {
    this.activeGoalForContribution.set(goal);
    this.contributionType = 'DEPOSIT';
    this.contributionAmount = null;
    this.contributionNotes = '';
    this.contributeErrorMessage.set('');
    this.isContributeModalOpen.set(true);
  }

  closeContributeModal() {
    this.isContributeModalOpen.set(false);
    this.activeGoalForContribution.set(null);
  }

  submitContribution() {
    const goal = this.activeGoalForContribution();
    if (!goal) return;

    if (!this.contributionAmount || this.contributionAmount <= 0) {
      this.contributeErrorMessage.set('Informe um valor positivo para o lançamento.');
      return;
    }

    const multiplier = this.contributionType === 'DEPOSIT' ? 1 : -1;
    const finalAmount = (this.contributionAmount * multiplier).toFixed(2);

    this.onContribute.emit({
      id: goal.id,
      data: {
        amount: finalAmount,
        notes: this.contributionNotes.trim() || (this.contributionType === 'DEPOSIT' ? 'Aporte manual' : 'Resgate manual'),
      },
    });

    this.closeContributeModal();
  }

  requestDelete(goalId: string) {
    if (confirm('Deseja realmente remover esta meta financeira e seu histórico de aportes?')) {
      this.onDeleteGoal.emit(goalId);
    }
  }
}

