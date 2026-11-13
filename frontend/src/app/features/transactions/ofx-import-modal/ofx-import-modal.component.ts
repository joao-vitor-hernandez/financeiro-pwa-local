import {
  Component,
  computed,
  inject,
  input,
  output,
  signal,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { HttpErrorResponse } from '@angular/common/http';
import { ApiService } from '../../../core/services/api.service';
import { Account } from '../../../core/models/account.model';
import {
  OFXImportResponse,
  OFXPreviewResponse,
} from '../../../core/models/transaction.model';
import { PrivacyCurrencyPipe } from '../../../core/pipes/privacy-currency.pipe';
import { IconComponent } from '../../../shared/components/icon/icon.component';

@Component({
  selector: 'app-ofx-import-modal',
  standalone: true,
  imports: [CommonModule, FormsModule, PrivacyCurrencyPipe, IconComponent],
  template: `
    @if (isOpen()) {
      <div class="modal-overlay" (click)="onClose()">
        <div class="modal-card" (click)="$event.stopPropagation()">
          <!-- Header -->
          <header class="modal-header">
            <div class="header-info">
              <div class="icon-badge">
                <app-icon name="upload" [size]="18" />
              </div>
              <div>
                <h2 class="modal-title">Importar Extrato Bancário</h2>
                <p class="modal-subtitle">
                  Suporta arquivos .OFX e .CSV de qualquer banco brasileiro
                </p>
              </div>
            </div>
            <button class="close-btn" (click)="onClose()" aria-label="Fechar modal de importação OFX" title="Fechar">
              <app-icon name="x" [size]="18" />
            </button>
          </header>

          <!-- Corpo do Modal -->
          <div class="modal-body">
            @if (errorMessage()) {
              <div class="error-banner">
                <app-icon name="x" [size]="16" />
                <span>{{ errorMessage() }}</span>
              </div>
            }

            <!-- ETAPA 1: Seleção de Conta e Upload com Drag & Drop -->
            @if (step() === 'UPLOAD') {
              <div class="upload-step">
                <!-- Seletor de Conta de Destino -->
                <div class="form-group">
                  <label class="form-label" for="account-select">
                    Conta de Destino <span class="required">*</span>
                  </label>
                  <select
                    id="account-select"
                    class="form-select"
                    [ngModel]="selectedAccountId()"
                    (ngModelChange)="selectedAccountId.set($event)"
                  >
                    <option value="" disabled>Selecione a conta bancária...</option>
                    @for (acc of accounts(); track acc.id) {
                      <option [value]="acc.id">
                        {{ acc.name }} ({{ acc.type }}) - {{ acc.balance | privacyCurrency }}
                      </option>
                    }
                  </select>
                </div>

                <!-- Dropzone de Arquivo -->
                <div
                  class="dropzone"
                  [class.drag-over]="isDragging()"
                  [class.has-file]="!!selectedFile()"
                  (dragover)="onDragOver($event)"
                  (dragleave)="onDragLeave($event)"
                  (drop)="onDrop($event)"
                  (click)="fileInput.click()"
                >
                  <input
                    #fileInput
                    type="file"
                    accept=".ofx,.csv"
                    class="hidden-file-input"
                    (change)="onFileSelected($event)"
                  />

                  @if (selectedFile(); as file) {
                    <div class="file-info-box">
                      <app-icon name="file-text" [size]="32" class="file-icon" />
                      <div class="file-details">
                        <span class="file-name">{{ file.name }}</span>
                        <span class="file-meta">
                          {{ formatFileSize(file.size) }} • {{ getFileExtension(file.name) }}
                        </span>
                      </div>
                      <button
                        type="button"
                        class="remove-file-btn"
                        (click)="removeFile($event)"
                        title="Remover arquivo"
                      >
                        <app-icon name="x" [size]="14" />
                      </button>
                    </div>
                  } @else {
                    <div class="dropzone-content">
                      <div class="upload-icon-circle">
                        <app-icon name="upload" [size]="24" />
                      </div>
                      <p class="dropzone-title">Arraste e solte seu extrato aqui</p>
                      <p class="dropzone-subtitle">ou clique para escolher do seu dispositivo</p>
                      <span class="dropzone-formats">Formatos aceitos: .OFX ou .CSV</span>
                    </div>
                  }
                </div>

                <div class="modal-footer">
                  <button type="button" class="btn-cancel" (click)="onClose()">
                    Cancelar
                  </button>
                  <button
                    type="button"
                    class="btn-primary"
                    [disabled]="!canAnalyze() || isLoading()"
                    (click)="analyzeFile()"
                  >
                    @if (isLoading()) {
                      <app-icon name="refresh" [size]="16" class="spin" />
                      <span>Analisando...</span>
                    } @else {
                      <span>Analisar Extrato</span>
                    }
                  </button>
                </div>
              </div>
            }

            <!-- ETAPA 2: Prévia e Conciliação Prévia -->
            @if (step() === 'PREVIEW' && previewData(); as preview) {
              <div class="preview-step">
                <!-- Resumo dos Indicadores -->
                <div class="stats-row">
                  <div class="stat-pill total">
                    <span class="stat-label">Detectadas</span>
                    <span class="stat-value">{{ preview.total_found }}</span>
                  </div>
                  <div class="stat-pill new">
                    <span class="stat-label">Novas a Importar</span>
                    <span class="stat-value">{{ preview.new_count }}</span>
                  </div>
                  <div class="stat-pill duplicate">
                    <span class="stat-label">Duplicadas (Ignoradas)</span>
                    <span class="stat-value">{{ preview.duplicated_count }}</span>
                  </div>
                </div>

                <!-- Lista de Pré-visualização -->
                <div class="preview-list-container">
                  <div class="preview-list-header">
                    <span>Lançamento</span>
                    <span>Valor</span>
                  </div>
                  <div class="preview-list">
                    @for (item of preview.transactions; track item.fitid) {
                      <div class="preview-item" [class.is-dup]="item.is_duplicate">
                        <div class="item-left">
                          <span
                            class="status-indicator"
                            [class.income]="item.type === 'INCOME'"
                            [class.expense]="item.type === 'EXPENSE'"
                            [class.dup]="item.is_duplicate"
                          ></span>
                          <div class="item-text">
                            <span class="item-desc" [title]="item.description">
                              {{ item.description }}
                            </span>
                            <span class="item-date">
                              {{ item.transaction_date | date: 'dd/MM/yyyy' }}
                              @if (item.is_duplicate) {
                                <span class="badge-dup">Já cadastrada (Ignorada)</span>
                              }
                            </span>
                          </div>
                        </div>
                        <div class="item-right">
                          <span
                            class="item-amount"
                            [class.amount-income]="item.type === 'INCOME' && !item.is_duplicate"
                            [class.amount-expense]="item.type === 'EXPENSE' && !item.is_duplicate"
                            [class.amount-dup]="item.is_duplicate"
                          >
                            {{ item.type === 'INCOME' ? '+' : '-' }}
                            {{ item.amount | privacyCurrency }}
                          </span>
                        </div>
                      </div>
                    }
                  </div>
                </div>

                <div class="modal-footer">
                  <button type="button" class="btn-cancel" (click)="step.set('UPLOAD')">
                    Voltar
                  </button>
                  <button
                    type="button"
                    class="btn-primary"
                    [disabled]="preview.new_count === 0 || isLoading()"
                    (click)="confirmImport()"
                  >
                    @if (isLoading()) {
                      <app-icon name="refresh" [size]="16" class="spin" />
                      <span>Importando...</span>
                    } @else {
                      <span>
                        Confirmar Importação ({{ preview.new_count }})
                      </span>
                    }
                  </button>
                </div>
              </div>
            }

            <!-- ETAPA 3: Sucesso -->
            @if (step() === 'SUCCESS' && importResult(); as res) {
              <div class="success-step">
                <div class="success-icon-box">
                  <app-icon name="check" [size]="32" />
                </div>
                <h3 class="success-title">Extrato Importado com Sucesso!</h3>
                <p class="success-subtitle">
                  {{ res.imported_count }} transação(ões) adicionada(s) à conta.
                  @if (res.duplicated_count > 0) {
                    <span> {{ res.duplicated_count }} duplicata(s) ignorada(s).</span>
                  }
                </p>

                <div class="modal-footer full">
                  <button type="button" class="btn-primary" (click)="onClose(true)">
                    Concluir
                  </button>
                </div>
              </div>
            }
          </div>
        </div>
      </div>
    }
  `,
  styles: `
    .modal-overlay {
      position: fixed;
      inset: 0;
      background-color: rgba(9, 9, 11, 0.75);
      backdrop-filter: blur(4px);
      display: flex;
      align-items: center;
      justify-content: center;
      z-index: 1000;
      padding: 16px;
      animation: fadeIn 0.15s ease-out;
    }

    .modal-card {
      width: 100%;
      max-width: 540px;
      background-color: #18181b; /* zinc-900 */
      border: 1px solid #27272a; /* zinc-800 */
      border-radius: 16px;
      box-shadow: 0 20px 25px -5px rgba(0, 0, 0, 0.5), 0 8px 10px -6px rgba(0, 0, 0, 0.5);
      display: flex;
      flex-direction: column;
      overflow: hidden;
      animation: slideUp 0.2s cubic-bezier(0.16, 1, 0.3, 1);
    }

    .modal-header {
      padding: 18px 20px;
      border-bottom: 1px solid #27272a;
      display: flex;
      align-items: center;
      justify-content: space-between;

      .header-info {
        display: flex;
        align-items: center;
        gap: 12px;
      }

      .icon-badge {
        width: 36px;
        height: 36px;
        border-radius: 10px;
        background-color: #27272a;
        color: #e4e4e7;
        display: flex;
        align-items: center;
        justify-content: center;
      }

      .modal-title {
        font-size: 16px;
        font-weight: 600;
        color: #f4f4f5;
        margin: 0;
      }

      .modal-subtitle {
        font-size: 12px;
        color: #a1a1aa;
        margin: 2px 0 0;
      }

      .close-btn {
        background: transparent;
        border: none;
        color: #71717a;
        width: 32px;
        height: 32px;
        border-radius: 8px;
        display: flex;
        align-items: center;
        justify-content: center;
        cursor: pointer;
        transition: all 0.15s ease;

        &:hover {
          background-color: #27272a;
          color: #f4f4f5;
        }
      }
    }

    .modal-body {
      padding: 20px;
      display: flex;
      flex-direction: column;
      gap: 16px;
    }

    .error-banner {
      background-color: rgba(225, 29, 72, 0.1);
      border: 1px solid rgba(225, 29, 72, 0.3);
      color: #fb7185;
      padding: 10px 14px;
      border-radius: 8px;
      font-size: 13px;
      display: flex;
      align-items: center;
      gap: 8px;
    }

    .form-group {
      display: flex;
      flex-direction: column;
      gap: 6px;
      margin-bottom: 16px;

      .form-label {
        font-size: 13px;
        font-weight: 500;
        color: #d4d4d8;

        .required {
          color: #f43f5e;
        }
      }

      .form-select {
        height: 44px;
        background-color: #09090b; /* zinc-950 */
        border: 1px solid #3f3f46; /* zinc-700 */
        border-radius: 8px;
        color: #f4f4f5;
        padding: 0 12px;
        font-size: 14px;
        outline: none;
        transition: border-color 0.15s ease;

        &:focus {
          border-color: #a1a1aa;
        }
      }
    }

    .dropzone {
      border: 2px dashed #3f3f46;
      border-radius: 12px;
      padding: 32px 16px;
      background-color: #09090b;
      cursor: pointer;
      text-align: center;
      transition: all 0.2s ease;

      &:hover,
      &.drag-over {
        border-color: #e4e4e7;
        background-color: rgba(255, 255, 255, 0.02);
      }

      &.has-file {
        border-style: solid;
        border-color: #27272a;
        padding: 16px;
        cursor: default;
      }
    }

    .hidden-file-input {
      display: none;
    }

    .dropzone-content {
      display: flex;
      flex-direction: column;
      align-items: center;

      .upload-icon-circle {
        width: 48px;
        height: 48px;
        border-radius: 50%;
        background-color: #27272a;
        color: #a1a1aa;
        display: flex;
        align-items: center;
        justify-content: center;
        margin-bottom: 12px;
      }

      .dropzone-title {
        font-size: 14px;
        font-weight: 600;
        color: #f4f4f5;
        margin: 0;
      }

      .dropzone-subtitle {
        font-size: 12px;
        color: #a1a1aa;
        margin: 4px 0 0;
      }

      .dropzone-formats {
        display: inline-block;
        margin-top: 12px;
        font-size: 11px;
        font-weight: 500;
        color: #71717a;
        background-color: #18181b;
        padding: 4px 10px;
        border-radius: 6px;
        border: 1px solid #27272a;
      }
    }

    .file-info-box {
      display: flex;
      align-items: center;
      gap: 14px;
      text-align: left;

      .file-icon {
        color: #a1a1aa;
      }

      .file-details {
        flex: 1;
        min-width: 0;
        display: flex;
        flex-direction: column;

        .file-name {
          font-size: 14px;
          font-weight: 500;
          color: #f4f4f5;
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
        }

        .file-meta {
          font-size: 12px;
          color: #71717a;
        }
      }

      .remove-file-btn {
        background: transparent;
        border: none;
        color: #71717a;
        width: 28px;
        height: 28px;
        border-radius: 6px;
        display: flex;
        align-items: center;
        justify-content: center;
        cursor: pointer;

        &:hover {
          background-color: #27272a;
          color: #f43f5e;
        }
      }
    }

    /* ETAPA 2: Prévia */
    .stats-row {
      display: grid;
      grid-template-columns: repeat(3, 1fr);
      gap: 10px;

      .stat-pill {
        padding: 10px;
        border-radius: 10px;
        background-color: #09090b;
        border: 1px solid #27272a;
        display: flex;
        flex-direction: column;
        gap: 4px;

        .stat-label {
          font-size: 11px;
          font-weight: 500;
          color: #71717a;
          text-transform: uppercase;
        }

        .stat-value {
          font-size: 18px;
          font-weight: 700;
          color: #f4f4f5;
          font-variant-numeric: tabular-nums;
        }

        &.new .stat-value {
          color: #10b981; /* emerald-500 */
        }

        &.duplicate .stat-value {
          color: #a1a1aa;
        }
      }
    }

    .preview-list-container {
      border: 1px solid #27272a;
      border-radius: 10px;
      overflow: hidden;
      background-color: #09090b;
    }

    .preview-list-header {
      padding: 10px 14px;
      background-color: #18181b;
      border-bottom: 1px solid #27272a;
      display: flex;
      justify-content: space-between;
      font-size: 11px;
      font-weight: 600;
      color: #71717a;
      text-transform: uppercase;
    }

    .preview-list {
      max-height: 220px;
      overflow-y: auto;
      display: flex;
      flex-direction: column;
    }

    .preview-item {
      padding: 10px 14px;
      border-bottom: 1px solid #18181b;
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 12px;

      &:last-child {
        border-bottom: none;
      }

      &.is-dup {
        opacity: 0.55;
        background-color: rgba(24, 24, 27, 0.4);
      }

      .item-left {
        display: flex;
        align-items: center;
        gap: 10px;
        min-width: 0;
      }

      .status-indicator {
        width: 8px;
        height: 8px;
        border-radius: 50%;

        &.income {
          background-color: #10b981;
        }
        &.expense {
          background-color: #f43f5e;
        }
        &.dup {
          background-color: #71717a;
        }
      }

      .item-text {
        display: flex;
        flex-direction: column;
        min-width: 0;
      }

      .item-desc {
        font-size: 13px;
        font-weight: 500;
        color: #f4f4f5;
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
      }

      .item-date {
        font-size: 11px;
        color: #71717a;
        display: flex;
        align-items: center;
        gap: 6px;
      }

      .badge-dup {
        font-size: 10px;
        color: #a1a1aa;
        background-color: #27272a;
        padding: 1px 6px;
        border-radius: 4px;
      }

      .item-right {
        white-space: nowrap;
        font-size: 13px;
        font-weight: 600;
        font-variant-numeric: tabular-nums;
      }

      .amount-income {
        color: #10b981;
      }
      .amount-expense {
        color: #f43f5e;
      }
      .amount-dup {
        color: #71717a;
        text-decoration: line-through;
      }
    }

    /* ETAPA 3: Sucesso */
    .success-step {
      display: flex;
      flex-direction: column;
      align-items: center;
      text-align: center;
      padding: 16px 0;

      .success-icon-box {
        width: 56px;
        height: 56px;
        border-radius: 50%;
        background-color: rgba(16, 185, 129, 0.15);
        color: #10b981;
        display: flex;
        align-items: center;
        justify-content: center;
        margin-bottom: 16px;
      }

      .success-title {
        font-size: 18px;
        font-weight: 600;
        color: #f4f4f5;
        margin: 0;
      }

      .success-subtitle {
        font-size: 13px;
        color: #a1a1aa;
        margin: 6px 0 20px;
      }
    }

    .modal-footer {
      display: flex;
      align-items: center;
      justify-content: flex-end;
      gap: 10px;
      margin-top: 8px;

      &.full {
        width: 100%;
        .btn-primary {
          width: 100%;
        }
      }

      .btn-cancel {
        min-height: 44px;
        padding: 0 16px;
        border-radius: 8px;
        background-color: transparent;
        border: 1px solid #3f3f46;
        color: #d4d4d8;
        font-size: 13px;
        font-weight: 500;
        cursor: pointer;
        transition: all 0.15s ease;

        &:hover {
          background-color: #27272a;
          color: #f4f4f5;
        }
      }

      .btn-primary {
        min-height: 44px;
        padding: 0 20px;
        border-radius: 8px;
        background-color: #f4f4f5;
        border: none;
        color: #09090b;
        font-size: 13px;
        font-weight: 600;
        cursor: pointer;
        display: flex;
        align-items: center;
        justify-content: center;
        gap: 8px;
        transition: opacity 0.15s ease;

        &:hover:not(:disabled) {
          opacity: 0.9;
        }

        &:disabled {
          opacity: 0.4;
          cursor: not-allowed;
        }
      }
    }

    .spin {
      animation: spin 1s linear infinite;
    }

    @keyframes spin {
      from {
        transform: rotate(0deg);
      }
      to {
        transform: rotate(360deg);
      }
    }

    @keyframes fadeIn {
      from {
        opacity: 0;
      }
      to {
        opacity: 1;
      }
    }

    @keyframes slideUp {
      from {
        opacity: 0;
        transform: translateY(16px);
      }
      to {
        opacity: 1;
        transform: translateY(0);
      }
    }
  `,
})
export class OfxImportModalComponent {
  private api = inject(ApiService);

  isOpen = input<boolean>(false);
  accounts = input<Account[]>([]);

  closed = output<void>();
  imported = output<OFXImportResponse>();

  step = signal<'UPLOAD' | 'PREVIEW' | 'SUCCESS'>('UPLOAD');
  selectedAccountId = signal<string>('');
  selectedFile = signal<File | null>(null);
  isDragging = signal<boolean>(false);
  isLoading = signal<boolean>(false);
  errorMessage = signal<string | null>(null);

  previewData = signal<OFXPreviewResponse | null>(null);
  importResult = signal<OFXImportResponse | null>(null);

  canAnalyze = computed(() => {
    return !!this.selectedAccountId() && !!this.selectedFile();
  });

  onClose(hasImported: boolean = false): void {
    this.resetState();
    this.closed.emit();
  }

  resetState(): void {
    this.step.set('UPLOAD');
    this.selectedFile.set(null);
    this.errorMessage.set(null);
    this.previewData.set(null);
    this.importResult.set(null);
    this.isLoading.set(false);
  }

  onDragOver(event: DragEvent): void {
    event.preventDefault();
    event.stopPropagation();
    this.isDragging.set(true);
  }

  onDragLeave(event: DragEvent): void {
    event.preventDefault();
    event.stopPropagation();
    this.isDragging.set(false);
  }

  onDrop(event: DragEvent): void {
    event.preventDefault();
    event.stopPropagation();
    this.isDragging.set(false);

    const files = event.dataTransfer?.files;
    if (files && files.length > 0) {
      this.handleFile(files[0]);
    }
  }

  onFileSelected(event: Event): void {
    const inputEl = event.target as HTMLInputElement;
    if (inputEl.files && inputEl.files.length > 0) {
      this.handleFile(inputEl.files[0]);
    }
  }

  handleFile(file: File): void {
    const name = file.name.toLowerCase();
    if (!name.endsWith('.ofx') && !name.endsWith('.csv')) {
      this.errorMessage.set('Selecione um arquivo de extrato válido (.ofx ou .csv).');
      return;
    }
    this.errorMessage.set(null);
    this.selectedFile.set(file);
  }

  removeFile(event: Event): void {
    event.stopPropagation();
    this.selectedFile.set(null);
  }

  formatFileSize(bytes: number): string {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  }

  getFileExtension(name: string): string {
    const ext = name.split('.').pop();
    return ext ? ext.toUpperCase() : 'EXTRATO';
  }

  analyzeFile(): void {
    const file = this.selectedFile();
    const accountId = this.selectedAccountId();
    if (!file || !accountId) return;

    this.isLoading.set(true);
    this.errorMessage.set(null);

    this.api.previewOFXImport(file, accountId).subscribe({
      next: (preview: OFXPreviewResponse) => {
        this.isLoading.set(false);
        this.previewData.set(preview);
        this.step.set('PREVIEW');
      },
      error: (err: HttpErrorResponse) => {
        this.isLoading.set(false);
        const detail = err?.error?.detail || 'Erro ao processar o arquivo OFX/CSV.';
        this.errorMessage.set(detail);
      },
    });
  }

  confirmImport(): void {
    const file = this.selectedFile();
    const accountId = this.selectedAccountId();
    if (!file || !accountId) return;

    this.isLoading.set(true);
    this.errorMessage.set(null);

    this.api.importOFX(file, accountId).subscribe({
      next: (res: OFXImportResponse) => {
        this.isLoading.set(false);
        this.importResult.set(res);
        this.step.set('SUCCESS');
        this.imported.emit(res);
      },
      error: (err: HttpErrorResponse) => {
        this.isLoading.set(false);
        const detail = err?.error?.detail || 'Erro ao gravar as transações no banco.';
        this.errorMessage.set(detail);
      },
    });
  }
}
