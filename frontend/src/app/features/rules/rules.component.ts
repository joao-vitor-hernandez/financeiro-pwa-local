import { Component, computed, inject, OnInit, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ApiService } from '../../core/services/api.service';
import {
  CategorizationRule,
  CategorizationRuleCreate,
  CategorizationRuleUpdate,
  RuleSimulationResponse,
} from '../../core/models/rule.model';
import { Category } from '../../core/models/category.model';
import { IconComponent } from '../../shared/components/icon/icon.component';

@Component({
  selector: 'app-rules',
  standalone: true,
  imports: [CommonModule, FormsModule, IconComponent],
  template: `
    <div class="rules-page">
      <!-- Cabeçalho -->
      <section class="page-header">
        <div class="header-titles">
          <div class="title-row">
            <h1 class="page-title">Regras de Categorização</h1>
            <span class="count-badge">
              {{ rules().length }} {{ rules().length === 1 ? 'regra' : 'regras' }}
            </span>
          </div>
          <p class="page-subtitle">
            Mapeamento determinístico de extratos bancários com higienização automática
          </p>
        </div>

        <div class="header-actions">
          <button class="btn btn-primary" (click)="openCreateModal()">
            <app-icon name="plus" [size]="16" />
            <span>Nova Regra</span>
          </button>
        </div>
      </section>

      <!-- Simulador Interativo em Tempo Real (Playground) -->
      <section class="simulator-card">
        <div class="simulator-header">
          <div class="simulator-title-wrap">
            <div class="icon-wrap-emerald">
              <app-icon name="sparkles" [size]="18" />
            </div>
            <div>
              <h2 class="simulator-title">Simulador de Extratos & Regex</h2>
              <p class="simulator-desc">
                Digite um texto bruto de fatura bancária para testar o casamento das regras cadastradas
              </p>
            </div>
          </div>
        </div>

        <!-- Campo de Teste e Atalhos Rápidos -->
        <div class="simulator-input-wrap">
          <div class="input-with-icon">
            <app-icon name="search" [size]="16" class="input-icon" />
            <input
              type="text"
              class="form-control"
              placeholder="Ex: PAG*Uber*BR Trip 14/10, iFood*Refeicao Centro..."
              [(ngModel)]="simRawText"
              (keyup.enter)="runSimulation()"
            />
          </div>

          <button
            class="btn btn-secondary sim-btn"
            (click)="runSimulation()"
            [disabled]="isSimulating() || !simRawText.trim()"
          >
            <app-icon name="play" [size]="14" />
            <span>{{ isSimulating() ? 'Testando...' : 'Testar' }}</span>
          </button>
        </div>

        <!-- Presets de Teste Rápido -->
        <div class="presets-row">
          <span class="presets-label">Exemplos:</span>
          @for (preset of samplePresets; track preset) {
            <button class="preset-chip" (click)="applyPreset(preset)">
              {{ preset }}
            </button>
          }
        </div>

        <!-- Painel de Resultado do Simulador -->
        @if (simResult()) {
          <div class="sim-result-box" [class.matched]="simResult()?.is_match">
            <div class="result-status-row">
              <span
                class="status-pill"
                [class.pill-success]="simResult()?.is_match"
                [class.pill-neutral]="!simResult()?.is_match"
              >
                <app-icon [name]="simResult()?.is_match ? 'check' : 'x'" [size]="12" />
                <span>{{ simResult()?.is_match ? 'Match Encontrado' : 'Nenhuma Regra Casou' }}</span>
              </span>

              @if (simResult()?.is_match && simResult()?.matched_rule_name) {
                <span class="matched-rule-meta">
                  Regra: <strong>{{ simResult()?.matched_rule_name }}</strong> (Prioridade #{{ simResult()?.matched_rule_priority }})
                </span>
              }
            </div>

            <div class="result-details-grid">
              <div class="result-col">
                <span class="col-label">Texto Higienizado</span>
                <span class="col-val text-mono">{{ simResult()?.sanitized_text }}</span>
              </div>

              <div class="result-col">
                <span class="col-label">Categoria Destino</span>
                @if (simResult()?.category_name) {
                  <span
                    class="category-chip"
                    [style.borderColor]="simResult()?.category_color || '#21D0B2'"
                    [style.color]="simResult()?.category_color || '#21D0B2'"
                  >
                    <span
                      class="cat-dot"
                      [style.backgroundColor]="simResult()?.category_color || '#21D0B2'"
                    ></span>
                    {{ simResult()?.category_name }}
                  </span>
                } @else {
                  <span class="col-val text-muted">Não categorizado</span>
                }
              </div>

              <div class="result-col">
                <span class="col-label">Descrição Final Salva</span>
                <span class="col-val highlight-val">{{ simResult()?.final_description }}</span>
              </div>
            </div>
          </div>
        }
      </section>

      <!-- Lista de Regras Determinísticas -->
      <section class="rules-list-section">
        <div class="list-header-row">
          <h2 class="section-title">Ordem de Execução & Prioridade</h2>
          <span class="section-hint">Menor número de prioridade = executada primeiro</span>
        </div>

        @if (isLoading()) {
          <div class="rules-skeleton">
            <div class="skeleton-card"></div>
            <div class="skeleton-card"></div>
            <div class="skeleton-card"></div>
          </div>
        } @else if (rules().length === 0) {
          <div class="empty-rules-card">
            <div class="empty-icon-wrap">
              <app-icon name="sliders" [size]="28" />
            </div>
            <p class="empty-title">Nenhuma regra de categorização cadastrada</p>
            <p class="empty-desc">
              Crie regras com expressões regulares para que lançamentos do Open Finance ou manuais sejam classificados automaticamente com nomes amigáveis.
            </p>
            <button class="btn btn-primary mt-12" (click)="openCreateModal()">
              <app-icon name="plus" [size]="16" />
              <span>Criar Primeira Regra</span>
            </button>
          </div>
        } @else {
          <div class="rules-stack">
            @for (rule of rules(); track rule.id; let idx = $index; let first = $first; let last = $last) {
              <div class="rule-card" [class.rule-inactive]="!rule.is_active">
                <div class="rule-left-meta">
                  <div class="priority-badge" title="Prioridade de execução">
                    #{{ rule.priority }}
                  </div>

                  <div class="rule-info-col">
                    <div class="rule-title-line">
                      <span class="rule-name">{{ rule.name }}</span>
                      @if (!rule.is_active) {
                        <span class="status-tag tag-paused">Pausada</span>
                      }
                    </div>

                    <div class="rule-tags-row">
                      <code class="regex-code" title="Padrão Regex">/{{ rule.pattern }}/i</code>

                      @if (rule.category_name) {
                        <span
                          class="category-chip"
                          [style.borderColor]="rule.category_color || '#21D0B2'"
                          [style.color]="rule.category_color || '#21D0B2'"
                        >
                          <span
                            class="cat-dot"
                            [style.backgroundColor]="rule.category_color || '#21D0B2'"
                          ></span>
                          {{ rule.category_name }}
                        </span>
                      }

                      @if (rule.clean_description) {
                        <span class="clean-desc-chip" title="Substitui o texto por este nome limpo">
                          ➜ "{{ rule.clean_description }}"
                        </span>
                      }
                    </div>
                  </div>
                </div>

                <!-- Ações da Regra -->
                <div class="rule-actions-col">
                  <!-- Botões de Reordenação de Prioridade -->
                  <div class="reorder-btns-wrap">
                    <button
                      class="btn-icon-subtle"
                      [disabled]="first"
                      (click)="moveRule(idx, -1)"
                      title="Mover para cima (maior prioridade)"
                    >
                      <app-icon name="arrow-up" [size]="14" />
                    </button>
                    <button
                      class="btn-icon-subtle"
                      [disabled]="last"
                      (click)="moveRule(idx, 1)"
                      title="Mover para baixo (menor prioridade)"
                    >
                      <app-icon name="arrow-down" [size]="14" />
                    </button>
                  </div>

                  <!-- Toggle Ativo/Inativo -->
                  <button
                    class="btn-icon-subtle"
                    [class.active-toggle]="rule.is_active"
                    (click)="toggleRuleActive(rule)"
                    [title]="rule.is_active ? 'Pausar regra' : 'Ativar regra'"
                  >
                    <app-icon [name]="rule.is_active ? 'check' : 'repeat'" [size]="14" />
                  </button>

                  <!-- Editar -->
                  <button
                    class="btn-icon-subtle"
                    (click)="openEditModal(rule)"
                    title="Editar regra"
                  >
                    <app-icon name="edit" [size]="14" />
                  </button>

                  <!-- Excluir -->
                  <button
                    class="btn-icon-subtle text-danger"
                    (click)="requestDeleteRule(rule.id)"
                    title="Excluir regra"
                  >
                    <app-icon name="trash" [size]="14" />
                  </button>
                </div>
              </div>
            }
          </div>
        }
      </section>

      <!-- Modal de Criação / Edição de Regra -->
      @if (isModalOpen()) {
        <div class="modal-backdrop" (click)="closeModal()">
          <div class="modal-panel" (click)="$event.stopPropagation()">
            <div class="modal-header">
              <h3 class="modal-title">
                {{ editingRule() ? 'Editar Regra de Categorização' : 'Nova Regra de Categorização' }}
              </h3>
              <button class="btn-close" (click)="closeModal()">
                <app-icon name="x" [size]="16" />
              </button>
            </div>

            <div class="modal-body">
              <div class="form-group">
                <label class="form-label">Nome de Identificação da Regra *</label>
                <input
                  type="text"
                  class="form-control"
                  placeholder="Ex: Corridas Uber & 99, Assinatura Netflix..."
                  [(ngModel)]="formName"
                />
              </div>

              <div class="form-group">
                <div class="label-with-hint">
                  <label class="form-label">Expressão Regular (Regex Pattern) *</label>
                  <span class="label-hint">Case-insensitive</span>
                </div>
                <input
                  type="text"
                  class="form-control font-mono"
                  placeholder="Ex: uber|99app|99pop ou ifood"
                  [(ngModel)]="formPattern"
                  (input)="validateInModalRegex()"
                />
                @if (modalRegexError()) {
                  <span class="regex-error">{{ modalRegexError() }}</span>
                }
              </div>

              <div class="form-group">
                <label class="form-label">Categoria de Destino *</label>
                <select class="form-control" [(ngModel)]="formCategoryId">
                  <option value="" disabled>Selecione uma categoria...</option>
                  @for (cat of categories(); track cat.id) {
                    <option [value]="cat.id">
                      {{ cat.type === 'INCOME' ? '📈 Receita' : '📉 Despesa' }} - {{ cat.name }}
                    </option>
                  }
                </select>
              </div>

              <div class="form-group">
                <label class="form-label">Descrição Amigável Substituta (Opcional)</label>
                <input
                  type="text"
                  class="form-control"
                  placeholder="Ex: Uber Viagens (deixe em branco para usar o texto higienizado)"
                  [(ngModel)]="formCleanDescription"
                />
              </div>

              <div class="form-row">
                <div class="form-group col-half">
                  <label class="form-label">Prioridade (1 a 1000)</label>
                  <input
                    type="number"
                    class="form-control"
                    [(ngModel)]="formPriority"
                    min="1"
                    max="1000"
                  />
                </div>

                <div class="form-group col-half">
                  <label class="form-label">Status da Regra</label>
                  <div class="toggle-group">
                    <button
                      type="button"
                      class="toggle-btn"
                      [class.active]="formIsActive"
                      (click)="formIsActive = true"
                    >
                      Ativa
                    </button>
                    <button
                      type="button"
                      class="toggle-btn"
                      [class.active]="!formIsActive"
                      (click)="formIsActive = false"
                    >
                      Pausada
                    </button>
                  </div>
                </div>
              </div>

              <!-- Teste Rápido ao Vivo Dentro do Próprio Modal -->
              <div class="in-modal-tester">
                <div class="tester-label-row">
                  <span class="tester-label">Testar Padrão Agora:</span>
                  @if (modalTestResult() !== null) {
                    <span
                      class="status-pill mini"
                      [class.pill-success]="modalTestResult() === true"
                      [class.pill-neutral]="modalTestResult() === false"
                    >
                      {{ modalTestResult() ? '✓ Casa com a regex' : '✗ Não casou' }}
                    </span>
                  }
                </div>
                <input
                  type="text"
                  class="form-control test-control"
                  placeholder="Digite um texto de teste (ex: PAG*Uber*Trip)..."
                  [(ngModel)]="modalTestText"
                  (input)="runModalTest()"
                />
              </div>

              @if (formErrorMessage()) {
                <div class="form-error-banner">
                  {{ formErrorMessage() }}
                </div>
              }
            </div>

            <div class="modal-footer">
              <button class="btn btn-secondary" (click)="closeModal()">Cancelar</button>
              <button class="btn btn-primary" (click)="submitRuleModal()">
                {{ editingRule() ? 'Salvar Alterações' : 'Criar Regra' }}
              </button>
            </div>
          </div>
        </div>
      }
    </div>
  `,
  styles: `
    .rules-page {
      padding: 20px 16px 50px;
      max-width: 820px;
      margin: 0 auto;
    }

    /* Cabeçalho */
    .page-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 24px;
      gap: 16px;
      flex-wrap: wrap;
    }

    .title-row {
      display: flex;
      align-items: center;
      gap: 10px;
    }

    .page-title {
      font-size: 1.45rem;
      font-weight: 700;
      color: #fafafa;
      margin: 0;
      letter-spacing: -0.02em;
    }

    .count-badge {
      font-size: 0.75rem;
      font-weight: 700;
      background: rgba(33, 208, 178, 0.12);
      color: #21D0B2;
      border: 1px solid rgba(33, 208, 178, 0.25);
      padding: 2px 8px;
      border-radius: 12px;
    }

    .page-subtitle {
      font-size: 0.85rem;
      color: #a1a1aa;
      margin: 4px 0 0;
    }

    /* Simulador Card */
    .simulator-card {
      background: linear-gradient(180deg, rgba(33, 208, 178, 0.05) 0%, rgba(18, 18, 21, 0.95) 100%);
      border: 1px solid rgba(33, 208, 178, 0.2);
      border-radius: 16px;
      padding: 20px;
      margin-bottom: 28px;
      display: flex;
      flex-direction: column;
      gap: 16px;
    }

    .simulator-header {
      display: flex;
      justify-content: space-between;
      align-items: flex-start;
    }

    .simulator-title-wrap {
      display: flex;
      align-items: center;
      gap: 12px;
    }

    .icon-wrap-emerald {
      width: 36px;
      height: 36px;
      border-radius: 10px;
      background: rgba(33, 208, 178, 0.15);
      color: #21D0B2;
      display: flex;
      align-items: center;
      justify-content: center;
    }

    .simulator-title {
      font-size: 1.05rem;
      font-weight: 700;
      color: #ffffff;
      margin: 0;
    }

    .simulator-desc {
      font-size: 0.8rem;
      color: #a1a1aa;
      margin: 2px 0 0;
    }

    .simulator-input-wrap {
      display: flex;
      gap: 10px;
    }

    .input-with-icon {
      position: relative;
      flex: 1;
      display: flex;
      align-items: center;
    }

    .input-icon {
      position: absolute;
      left: 12px;
      color: #71717a;
      pointer-events: none;
    }

    .input-with-icon .form-control {
      padding-left: 38px;
    }

    .sim-btn {
      display: inline-flex;
      align-items: center;
      gap: 6px;
      padding: 0 16px;
      font-weight: 600;
    }

    /* Presets */
    .presets-row {
      display: flex;
      flex-wrap: wrap;
      align-items: center;
      gap: 8px;
    }

    .presets-label {
      font-size: 0.75rem;
      color: #71717a;
      font-weight: 600;
      text-transform: uppercase;
    }

    .preset-chip {
      background: rgba(255, 255, 255, 0.04);
      border: 1px solid rgba(255, 255, 255, 0.08);
      color: #d4d4d8;
      font-size: 0.75rem;
      padding: 3px 9px;
      border-radius: 12px;
      cursor: pointer;
      transition: all 0.15s ease;
    }

    .preset-chip:hover {
      background: rgba(33, 208, 178, 0.12);
      border-color: rgba(33, 208, 178, 0.3);
      color: #21D0B2;
    }

    /* Resultado do Simulador */
    .sim-result-box {
      background: rgba(0, 0, 0, 0.4);
      border: 1px solid rgba(255, 255, 255, 0.08);
      border-radius: 12px;
      padding: 14px 16px;
      display: flex;
      flex-direction: column;
      gap: 12px;
    }

    .sim-result-box.matched {
      border-color: rgba(33, 208, 178, 0.3);
    }

    .result-status-row {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 10px;
      flex-wrap: wrap;
    }

    .status-pill {
      display: inline-flex;
      align-items: center;
      gap: 5px;
      font-size: 0.75rem;
      font-weight: 700;
      padding: 3px 10px;
      border-radius: 12px;
    }

    .status-pill.mini {
      font-size: 0.7rem;
      padding: 2px 8px;
    }

    .pill-success {
      background: rgba(33, 208, 178, 0.15);
      color: #21D0B2;
      border: 1px solid rgba(33, 208, 178, 0.3);
    }

    .pill-neutral {
      background: rgba(255, 255, 255, 0.06);
      color: #a1a1aa;
      border: 1px solid rgba(255, 255, 255, 0.1);
    }

    .matched-rule-meta {
      font-size: 0.8rem;
      color: #d4d4d8;
    }

    .result-details-grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
      gap: 12px;
      padding-top: 8px;
      border-top: 1px solid rgba(255, 255, 255, 0.06);
    }

    .result-col {
      display: flex;
      flex-direction: column;
      gap: 4px;
    }

    .col-label {
      font-size: 0.7rem;
      font-weight: 600;
      color: #71717a;
      text-transform: uppercase;
      letter-spacing: 0.04em;
    }

    .col-val {
      font-size: 0.85rem;
      color: #fafafa;
    }

    .highlight-val {
      font-weight: 700;
      color: #21D0B2;
    }

    .text-mono {
      font-family: monospace;
    }

    /* Lista de Regras */
    .rules-list-section {
      display: flex;
      flex-direction: column;
      gap: 14px;
    }

    .list-header-row {
      display: flex;
      align-items: baseline;
      justify-content: space-between;
      flex-wrap: wrap;
      gap: 8px;
    }

    .section-title {
      font-size: 1.05rem;
      font-weight: 700;
      color: #fafafa;
      margin: 0;
    }

    .section-hint {
      font-size: 0.75rem;
      color: #71717a;
    }

    .rules-stack {
      display: flex;
      flex-direction: column;
      gap: 10px;
    }

    .rule-card {
      background: rgba(255, 255, 255, 0.02);
      border: 1px solid rgba(255, 255, 255, 0.06);
      border-radius: 14px;
      padding: 14px 16px;
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 14px;
      transition: all 0.2s ease;
    }

    .rule-card:hover {
      background: rgba(255, 255, 255, 0.04);
      border-color: rgba(255, 255, 255, 0.12);
    }

    .rule-card.rule-inactive {
      opacity: 0.6;
      border-style: dashed;
    }

    .rule-left-meta {
      display: flex;
      align-items: center;
      gap: 14px;
      flex: 1;
      min-width: 0;
    }

    .priority-badge {
      font-size: 0.75rem;
      font-weight: 700;
      background: rgba(255, 255, 255, 0.06);
      color: #d4d4d8;
      border: 1px solid rgba(255, 255, 255, 0.1);
      width: 34px;
      height: 34px;
      border-radius: 8px;
      display: flex;
      align-items: center;
      justify-content: center;
      flex-shrink: 0;
    }

    .rule-info-col {
      display: flex;
      flex-direction: column;
      gap: 6px;
      min-width: 0;
    }

    .rule-title-line {
      display: flex;
      align-items: center;
      gap: 8px;
    }

    .rule-name {
      font-size: 0.95rem;
      font-weight: 700;
      color: #ffffff;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }

    .status-tag {
      font-size: 0.68rem;
      padding: 1px 6px;
      border-radius: 6px;
      font-weight: 600;
    }

    .tag-paused {
      background: rgba(239, 68, 68, 0.15);
      color: #ef4444;
      border: 1px solid rgba(239, 68, 68, 0.3);
    }

    .rule-tags-row {
      display: flex;
      flex-wrap: wrap;
      align-items: center;
      gap: 8px;
    }

    .regex-code {
      font-family: monospace;
      font-size: 0.78rem;
      background: rgba(29, 205, 254, 0.08);
      color: #1DCDFE;
      border: 1px solid rgba(29, 205, 254, 0.2);
      padding: 2px 7px;
      border-radius: 6px;
    }

    .category-chip {
      display: inline-flex;
      align-items: center;
      gap: 6px;
      font-size: 0.75rem;
      font-weight: 600;
      background: rgba(255, 255, 255, 0.03);
      border: 1px solid;
      padding: 2px 8px;
      border-radius: 10px;
    }

    .cat-dot {
      width: 6px;
      height: 6px;
      border-radius: 50%;
    }

    .clean-desc-chip {
      font-size: 0.78rem;
      color: #a1a1aa;
    }

    /* Ações */
    .rule-actions-col {
      display: flex;
      align-items: center;
      gap: 6px;
      flex-shrink: 0;
    }

    .reorder-btns-wrap {
      display: flex;
      gap: 2px;
      background: rgba(255, 255, 255, 0.03);
      border-radius: 8px;
      padding: 2px;
    }

    .btn-icon-subtle {
      background: transparent;
      border: none;
      color: #71717a;
      width: 30px;
      height: 30px;
      border-radius: 6px;
      display: flex;
      align-items: center;
      justify-content: center;
      cursor: pointer;
      transition: all 0.15s ease;
    }

    .btn-icon-subtle:hover:not(:disabled) {
      background: rgba(255, 255, 255, 0.08);
      color: #ffffff;
    }

    .btn-icon-subtle:disabled {
      opacity: 0.25;
      cursor: not-allowed;
    }

    .btn-icon-subtle.active-toggle {
      color: #21D0B2;
    }

    .btn-icon-subtle.text-danger:hover {
      background: rgba(239, 68, 68, 0.15);
      color: #ef4444;
    }

    /* Modal */
    .modal-backdrop {
      position: fixed;
      inset: 0;
      background: rgba(0, 0, 0, 0.75);
      backdrop-filter: blur(8px);
      display: flex;
      align-items: center;
      justify-content: center;
      z-index: 1000;
      padding: 16px;
    }

    .modal-panel {
      background: #121215;
      border: 1px solid rgba(255, 255, 255, 0.12);
      border-radius: 18px;
      width: 100%;
      max-width: 520px;
      max-height: 90vh;
      overflow-y: auto;
      padding: 24px;
      display: flex;
      flex-direction: column;
      gap: 18px;
      box-shadow: 0 20px 40px rgba(0, 0, 0, 0.6);
    }

    .modal-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
    }

    .modal-title {
      font-size: 1.15rem;
      font-weight: 700;
      color: #ffffff;
      margin: 0;
    }

    .btn-close {
      background: transparent;
      border: none;
      color: #71717a;
      cursor: pointer;
      padding: 4px;
      border-radius: 6px;
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

    .label-with-hint {
      display: flex;
      justify-content: space-between;
      align-items: baseline;
    }

    .label-hint {
      font-size: 0.7rem;
      color: #71717a;
    }

    .form-label {
      font-size: 0.8rem;
      font-weight: 600;
      color: #d4d4d8;
    }

    .form-control {
      background: rgba(255, 255, 255, 0.04);
      border: 1px solid rgba(255, 255, 255, 0.1);
      border-radius: 10px;
      color: #ffffff;
      padding: 10px 14px;
      font-size: 0.88rem;
      outline: none;
      transition: border-color 0.15s ease;
      font-family: inherit;
    }

    .form-control:focus {
      border-color: #21D0B2;
    }

    .font-mono {
      font-family: monospace;
    }

    .regex-error {
      color: #ef4444;
      font-size: 0.75rem;
    }

    .form-row {
      display: flex;
      gap: 12px;
    }

    .col-half {
      flex: 1;
    }

    .toggle-group {
      display: flex;
      border: 1px solid rgba(255, 255, 255, 0.1);
      border-radius: 10px;
      overflow: hidden;
    }

    .toggle-btn {
      flex: 1;
      background: transparent;
      border: none;
      color: #71717a;
      font-size: 0.8rem;
      font-weight: 600;
      padding: 8px 12px;
      cursor: pointer;
      transition: all 0.15s ease;
    }

    .toggle-btn.active {
      background: rgba(33, 208, 178, 0.15);
      color: #21D0B2;
    }

    /* Tester dentro do modal */
    .in-modal-tester {
      background: rgba(0, 0, 0, 0.35);
      border: 1px dashed rgba(255, 255, 255, 0.12);
      border-radius: 10px;
      padding: 12px;
      display: flex;
      flex-direction: column;
      gap: 8px;
    }

    .tester-label-row {
      display: flex;
      justify-content: space-between;
      align-items: center;
    }

    .tester-label {
      font-size: 0.75rem;
      font-weight: 600;
      color: #a1a1aa;
    }

    .test-control {
      font-size: 0.8rem;
      padding: 8px 12px;
    }

    .form-error-banner {
      background: rgba(239, 68, 68, 0.15);
      color: #ef4444;
      border: 1px solid rgba(239, 68, 68, 0.3);
      padding: 10px 14px;
      border-radius: 10px;
      font-size: 0.82rem;
    }

    .modal-footer {
      display: flex;
      justify-content: flex-end;
      gap: 10px;
      padding-top: 10px;
      border-top: 1px solid rgba(255, 255, 255, 0.08);
    }

    /* Skeleton & Empty */
    .rules-skeleton {
      display: flex;
      flex-direction: column;
      gap: 10px;
    }

    .skeleton-card {
      height: 64px;
      background: rgba(255, 255, 255, 0.04);
      border-radius: 14px;
      animation: pulse 1.5s infinite ease-in-out;
    }

    .empty-rules-card {
      background: rgba(255, 255, 255, 0.02);
      border: 1px dashed rgba(255, 255, 255, 0.1);
      border-radius: 16px;
      padding: 40px 20px;
      text-align: center;
      display: flex;
      flex-direction: column;
      align-items: center;
    }

    .empty-icon-wrap {
      width: 52px;
      height: 52px;
      border-radius: 50%;
      background: rgba(255, 255, 255, 0.05);
      display: flex;
      align-items: center;
      justify-content: center;
      color: #71717a;
      margin-bottom: 14px;
    }

    .empty-title {
      font-size: 1rem;
      font-weight: 700;
      color: #ffffff;
      margin: 0 0 6px;
    }

    .empty-desc {
      font-size: 0.85rem;
      color: #a1a1aa;
      max-width: 440px;
      margin: 0;
      line-height: 1.4;
    }

    .mt-12 {
      margin-top: 16px;
    }

    @keyframes pulse {
      0%, 100% { opacity: 0.6; }
      50% { opacity: 0.3; }
    }
  `,
})
export class RulesComponent implements OnInit {
  private api = inject(ApiService);

  rules = signal<CategorizationRule[]>([]);
  categories = signal<Category[]>([]);
  isLoading = signal<boolean>(true);

  // Playground de simulação geral
  simRawText = 'PAG*Uber*BR Trip 14/10';
  isSimulating = signal<boolean>(false);
  simResult = signal<RuleSimulationResponse | null>(null);

  samplePresets = [
    'PAG*Uber*BR Trip',
    'iFood*Refeicao Centro',
    'NETFLIX.COM SAO PAULO',
    'COMPRA CARTAO - Drogaria SP',
    'PIX ENVIADO - Aluguel',
  ];

  // Modal de Criação / Edição
  isModalOpen = signal<boolean>(false);
  editingRule = signal<CategorizationRule | null>(null);

  formName = '';
  formPattern = '';
  formCategoryId = '';
  formCleanDescription = '';
  formPriority = 100;
  formIsActive = true;
  formErrorMessage = signal<string>('');

  // Simulador interno do modal
  modalRegexError = signal<string>('');
  modalTestText = '';
  modalTestResult = signal<boolean | null>(null);

  ngOnInit(): void {
    this.loadData();
    // Executa uma simulação inicial automática com o texto de exemplo
    this.runSimulation();
  }

  loadData(): void {
    this.isLoading.set(true);

    this.api.getCategories().subscribe({
      next: (cats) => this.categories.set(cats),
      error: (err: unknown) => console.error('Erro ao carregar categorias:', err),
    });

    this.api.getRules().subscribe({
      next: (data) => {
        this.rules.set(data);
        this.isLoading.set(false);
      },
      error: () => this.isLoading.set(false),
    });
  }

  runSimulation(): void {
    if (!this.simRawText.trim()) return;

    this.isSimulating.set(true);
    this.api.simulateRule({ raw_text: this.simRawText.trim() }).subscribe({
      next: (res) => {
        this.simResult.set(res);
        this.isSimulating.set(false);
      },
      error: (err: unknown) => {
        console.error('Erro ao simular regra:', err);
        this.isSimulating.set(false);
      },
    });
  }

  applyPreset(preset: string): void {
    this.simRawText = preset;
    this.runSimulation();
  }

  moveRule(index: number, delta: number): void {
    const targetIdx = index + delta;
    const currentRules = [...this.rules()];
    if (targetIdx < 0 || targetIdx >= currentRules.length) return;

    // Inverte os elementos na lista
    const temp = currentRules[index];
    currentRules[index] = currentRules[targetIdx];
    currentRules[targetIdx] = temp;

    this.rules.set(currentRules);

    // Envia a nova ordem de prioridade para a API
    const ruleIds = currentRules.map((r) => r.id);
    this.api.reorderRules({ rule_ids: ruleIds }).subscribe({
      next: (reordered) => {
        this.rules.set(reordered);
        this.runSimulation(); // Re-executa simulação com a nova precedência
      },
      error: (err: unknown) => console.error('Erro ao reordenar regras:', err),
    });
  }

  toggleRuleActive(rule: CategorizationRule): void {
    this.api.updateRule(rule.id, { is_active: !rule.is_active }).subscribe({
      next: (updated) => {
        this.rules.update((list) =>
          list.map((r) => (r.id === updated.id ? updated : r))
        );
        this.runSimulation();
      },
      error: (err: unknown) => console.error('Erro ao alternar status da regra:', err),
    });
  }

  openCreateModal(): void {
    this.editingRule.set(null);
    this.formName = '';
    this.formPattern = '';
    this.formCategoryId = this.categories().length > 0 ? this.categories()[0].id : '';
    this.formCleanDescription = '';
    // Define prioridade sugerida no fim da fila
    const highestPriority = this.rules().reduce((max, r) => Math.max(max, r.priority), 0);
    this.formPriority = highestPriority + 10;
    this.formIsActive = true;
    this.formErrorMessage.set('');
    this.modalRegexError.set('');
    this.modalTestText = '';
    this.modalTestResult.set(null);
    this.isModalOpen.set(true);
  }

  openEditModal(rule: CategorizationRule): void {
    this.editingRule.set(rule);
    this.formName = rule.name;
    this.formPattern = rule.pattern;
    this.formCategoryId = rule.category_id;
    this.formCleanDescription = rule.clean_description || '';
    this.formPriority = rule.priority;
    this.formIsActive = rule.is_active;
    this.formErrorMessage.set('');
    this.modalRegexError.set('');
    this.modalTestText = '';
    this.modalTestResult.set(null);
    this.isModalOpen.set(true);
  }

  closeModal(): void {
    this.isModalOpen.set(false);
    this.editingRule.set(null);
  }

  validateInModalRegex(): void {
    if (!this.formPattern.trim()) {
      this.modalRegexError.set('');
      this.modalTestResult.set(null);
      return;
    }
    try {
      new RegExp(this.formPattern.trim(), 'i');
      this.modalRegexError.set('');
      this.runModalTest();
    } catch (e: unknown) {
      this.modalRegexError.set('Sintaxe de Regex inválida');
      this.modalTestResult.set(null);
    }
  }

  runModalTest(): void {
    if (!this.formPattern.trim() || !this.modalTestText.trim()) {
      this.modalTestResult.set(null);
      return;
    }

    try {
      const regex = new RegExp(this.formPattern.trim(), 'i');
      this.modalTestResult.set(regex.test(this.modalTestText.trim()));
    } catch {
      this.modalTestResult.set(null);
    }
  }

  submitRuleModal(): void {
    if (!this.formName.trim()) {
      this.formErrorMessage.set('Informe o nome de identificação da regra.');
      return;
    }
    if (!this.formPattern.trim()) {
      this.formErrorMessage.set('Informe o padrão Regex.');
      return;
    }
    if (!this.formCategoryId) {
      this.formErrorMessage.set('Selecione a categoria correspondente.');
      return;
    }

    try {
      new RegExp(this.formPattern.trim(), 'i');
    } catch {
      this.formErrorMessage.set('A expressão regular informada possui erros de sintaxe.');
      return;
    }

    if (this.editingRule()) {
      this.api
        .updateRule(this.editingRule()!.id, {
          name: this.formName.trim(),
          pattern: this.formPattern.trim(),
          category_id: this.formCategoryId,
          clean_description: this.formCleanDescription.trim() || null,
          priority: this.formPriority,
          is_active: this.formIsActive,
        })
        .subscribe({
          next: () => {
            this.loadData();
            this.runSimulation();
            this.closeModal();
          },
          error: (err: unknown) => {
            console.error('Erro ao atualizar regra:', err);
            this.formErrorMessage.set('Erro ao atualizar regra. Verifique os dados.');
          },
        });
    } else {
      this.api
        .createRule({
          name: this.formName.trim(),
          pattern: this.formPattern.trim(),
          category_id: this.formCategoryId,
          clean_description: this.formCleanDescription.trim() || null,
          priority: this.formPriority,
          is_active: this.formIsActive,
        })
        .subscribe({
          next: () => {
            this.loadData();
            this.runSimulation();
            this.closeModal();
          },
          error: (err: unknown) => {
            console.error('Erro ao criar regra:', err);
            this.formErrorMessage.set('Erro ao criar regra. Verifique os dados.');
          },
        });
    }
  }

  requestDeleteRule(ruleId: string): void {
    if (confirm('Deseja realmente excluir esta regra de categorização?')) {
      this.api.deleteRule(ruleId).subscribe({
        next: () => {
          this.rules.update((list) => list.filter((r) => r.id !== ruleId));
          this.runSimulation();
        },
        error: (err: unknown) => console.error('Erro ao excluir regra:', err),
      });
    }
  }
}

