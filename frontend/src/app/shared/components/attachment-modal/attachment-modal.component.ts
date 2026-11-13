import {
  Component,
  computed,
  effect,
  inject,
  input,
  output,
  signal,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { ApiService } from '../../../core/services/api.service';
import { Transaction } from '../../../core/models/transaction.model';
import { TransactionAttachment } from '../../../core/models/attachment.model';
import { PrivacyCurrencyPipe } from '../../../core/pipes/privacy-currency.pipe';
import { IconComponent } from '../icon/icon.component';

@Component({
  selector: 'app-attachment-modal',
  standalone: true,
  imports: [CommonModule, PrivacyCurrencyPipe, IconComponent],
  template: `
    @if (isOpen() && transaction()) {
      <div class="modal-overlay" (click)="close()">
        <div class="modal-container" (click)="$event.stopPropagation()">
          <!-- Cabeçalho -->
          <div class="modal-header">
            <div class="header-info">
              <div class="header-tag">
                <app-icon name="paperclip" [size]="14" />
                <span>Comprovantes & Notas Fiscais</span>
              </div>
              <h2 class="modal-title">{{ transaction()?.description }}</h2>
              <span class="modal-subtitle">
                {{ transaction()?.transaction_date | date: 'dd/MM/yyyy' }} •
                <span class="tabular-nums">{{ transaction()?.amount | privacyCurrency }}</span>
              </span>
            </div>
            <button class="btn-close" (click)="close()" title="Fechar">
              <app-icon name="x" [size]="18" />
            </button>
          </div>

          <!-- Corpo do Modal -->
          <div class="modal-body">
            <!-- Lista de Comprovantes Já Anexados -->
            <div class="attachments-section">
              <span class="section-label">
                Arquivos Anexados ({{ attachments().length }})
              </span>

              @if (isLoading()) {
                <div class="loading-state">
                  <div class="skeleton-line"></div>
                </div>
              } @else if (attachments().length === 0) {
                <div class="empty-attachments">
                  <app-icon name="file-text" [size]="24" />
                  <p>Nenhum comprovante ou nota fiscal anexada a esta transação.</p>
                </div>
              } @else {
                <div class="attachments-list">
                  @for (att of attachments(); track att.id) {
                    <div class="attachment-item">
                      <div class="item-preview" (click)="openPreview(att)">
                        @if (isImage(att.mime_type)) {
                          <img [src]="att.view_url" [alt]="att.file_name" class="thumb-img" />
                        } @else {
                          <div class="pdf-icon-box">
                            <app-icon name="file-text" [size]="20" />
                          </div>
                        }
                      </div>

                      <div class="item-details" (click)="openPreview(att)">
                        <span class="item-name" [title]="att.file_name">{{ att.file_name }}</span>
                        <span class="item-meta">
                          {{ formatSize(att.file_size_bytes) }} •
                          {{ att.created_at | date: 'dd/MM/yyyy HH:mm' }}
                        </span>
                      </div>

                      <div class="item-actions">
                        <a
                          [href]="att.view_url"
                          target="_blank"
                          rel="noopener"
                          class="btn-icon"
                          title="Abrir em nova aba"
                        >
                          <app-icon name="arrow-up-right" [size]="16" />
                        </a>
                        <button
                          class="btn-icon btn-danger"
                          (click)="deleteAttachment(att)"
                          title="Excluir comprovante"
                        >
                          <app-icon name="trash" [size]="16" />
                        </button>
                      </div>
                    </div>
                  }
                </div>
              }
            </div>

            <!-- Área de Upload de Novos Comprovantes -->
            <div class="upload-section">
              <span class="section-label">Adicionar Novo Comprovante</span>

              <div
                class="drop-zone"
                [class.drag-over]="isDragging()"
                (dragover)="onDragOver($event)"
                (dragleave)="onDragLeave($event)"
                (drop)="onDrop($event)"
                (click)="fileInput.click()"
              >
                <input
                  #fileInput
                  type="file"
                  class="hidden-input"
                  accept="image/png,image/jpeg,image/webp,application/pdf"
                  (change)="onFileSelected($event)"
                />

                <input
                  #cameraInput
                  type="file"
                  class="hidden-input"
                  accept="image/*"
                  capture="environment"
                  (change)="onFileSelected($event)"
                />

                @if (isUploading()) {
                  <div class="uploading-state">
                    <span class="spinner"></span>
                    <span class="uploading-text">Enviando comprovante com segurança...</span>
                  </div>
                } @else {
                  <div class="drop-content">
                    <div class="drop-icon">
                      <app-icon name="upload" [size]="24" />
                    </div>
                    <span class="drop-title">Toque para selecionar ou arraste o comprovante</span>
                    <span class="drop-hint">Formatos: JPG, PNG, WebP ou PDF (até 10 MB)</span>
                  </div>
                }
              </div>

              <!-- Atalho Rápido para Câmera do Smartphone -->
              <div class="camera-actions">
                <button
                  type="button"
                  class="btn-camera"
                  (click)="cameraInput.click()"
                  [disabled]="isUploading()"
                >
                  <app-icon name="camera" [size]="16" />
                  <span>Fotografar Recibo (Câmera)</span>
                </button>
              </div>

              @if (errorMessage()) {
                <div class="error-banner">
                  <app-icon name="alert-triangle" [size]="14" />
                  <span>{{ errorMessage() }}</span>
                </div>
              }
            </div>
          </div>

          <!-- Preview em Tela Cheia / Modal Expansível -->
          @if (previewAttachment(); as preview) {
            <div class="preview-backdrop" (click)="closePreview()">
              <div class="preview-dialog" (click)="$event.stopPropagation()">
                <div class="preview-header">
                  <span class="preview-title">{{ preview.file_name }}</span>
                  <button class="btn-close" (click)="closePreview()">
                    <app-icon name="x" [size]="18" />
                  </button>
                </div>
                <div class="preview-body">
                  @if (isImage(preview.mime_type)) {
                    <img [src]="preview.view_url" [alt]="preview.file_name" class="full-img" />
                  } @else {
                    <div class="pdf-preview-box">
                      <app-icon name="file-text" [size]="48" />
                      <p>Documento PDF</p>
                      <a
                        [href]="preview.view_url"
                        target="_blank"
                        rel="noopener"
                        class="btn btn-primary"
                      >
                        Abrir Documento Completo
                      </a>
                    </div>
                  }
                </div>
              </div>
            </div>
          }
        </div>
      </div>
    }
  `,
  styles: `
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

    .modal-container {
      background: #18181b;
      border: 1px solid #27272a;
      border-radius: 14px;
      width: 100%;
      max-width: 520px;
      max-height: 90vh;
      overflow-y: auto;
      box-shadow: 0 20px 40px rgba(0, 0, 0, 0.6);
      display: flex;
      flex-direction: column;
    }

    .modal-header {
      padding: 18px 20px;
      border-bottom: 1px solid #27272a;
      display: flex;
      justify-content: space-between;
      align-items: flex-start;
    }

    .header-tag {
      display: inline-flex;
      align-items: center;
      gap: 5px;
      font-size: 11px;
      font-weight: 600;
      color: #38bdf8;
      text-transform: uppercase;
      letter-spacing: 0.04em;
      margin-bottom: 4px;
    }

    .modal-title {
      font-size: 16px;
      font-weight: 600;
      color: #fafafa;
      margin: 0;
    }

    .modal-subtitle {
      font-size: 12px;
      color: #a1a1aa;
      margin-top: 2px;
      display: block;
    }

    .btn-close {
      background: transparent;
      border: none;
      color: #a1a1aa;
      cursor: pointer;
      padding: 4px;
      border-radius: 6px;
    }
    .btn-close:hover {
      background: #27272a;
      color: #fafafa;
    }

    .modal-body {
      padding: 20px;
      display: flex;
      flex-direction: column;
      gap: 20px;
    }

    .section-label {
      font-size: 12px;
      font-weight: 600;
      color: #a1a1aa;
      text-transform: uppercase;
      letter-spacing: 0.04em;
      margin-bottom: 10px;
      display: block;
    }

    .empty-attachments {
      text-align: center;
      padding: 20px;
      background: #27272a;
      border-radius: 8px;
      color: #71717a;
      font-size: 12px;
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 6px;
    }

    .attachments-list {
      display: flex;
      flex-direction: column;
      gap: 8px;
    }

    .attachment-item {
      display: flex;
      align-items: center;
      gap: 12px;
      padding: 10px 12px;
      background: #27272a;
      border: 1px solid #3f3f46;
      border-radius: 8px;
    }

    .item-preview {
      width: 44px;
      height: 44px;
      border-radius: 6px;
      overflow: hidden;
      background: #18181b;
      display: flex;
      align-items: center;
      justify-content: center;
      flex-shrink: 0;
      cursor: pointer;
    }

    .thumb-img {
      width: 100%;
      height: 100%;
      object-fit: cover;
    }

    .pdf-icon-box {
      color: #f87171;
    }

    .item-details {
      flex: 1;
      min-width: 0;
      cursor: pointer;
    }

    .item-name {
      display: block;
      font-size: 13px;
      font-weight: 500;
      color: #fafafa;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }

    .item-meta {
      font-size: 11px;
      color: #71717a;
    }

    .item-actions {
      display: flex;
      align-items: center;
      gap: 4px;
    }

    .btn-icon {
      background: none;
      border: none;
      color: #a1a1aa;
      cursor: pointer;
      padding: 6px;
      border-radius: 6px;
      display: inline-flex;
      align-items: center;
      justify-content: center;
    }
    .btn-icon:hover {
      background: #3f3f46;
      color: #fafafa;
    }
    .btn-danger:hover {
      color: #ef4444;
    }

    /* Drop Zone */
    .drop-zone {
      border: 2px dashed #3f3f46;
      border-radius: 10px;
      padding: 24px 16px;
      text-align: center;
      cursor: pointer;
      background: rgba(39, 39, 42, 0.4);
      transition: all 0.2s ease;
    }
    .drop-zone:hover, .drop-zone.drag-over {
      border-color: #38bdf8;
      background: rgba(56, 189, 248, 0.05);
    }

    .hidden-input {
      display: none;
    }

    .drop-content {
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 6px;
    }

    .drop-icon {
      color: #38bdf8;
      margin-bottom: 4px;
    }

    .drop-title {
      font-size: 13px;
      font-weight: 500;
      color: #e4e4e7;
    }

    .drop-hint {
      font-size: 11px;
      color: #71717a;
    }

    .camera-actions {
      margin-top: 10px;
      display: flex;
      justify-content: center;
    }

    .btn-camera {
      display: inline-flex;
      align-items: center;
      gap: 6px;
      background: #27272a;
      border: 1px solid #3f3f46;
      color: #fafafa;
      padding: 8px 14px;
      border-radius: 8px;
      font-size: 12px;
      font-weight: 500;
      cursor: pointer;
    }
    .btn-camera:hover {
      background: #3f3f46;
    }

    .uploading-state {
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 10px;
    }

    .spinner {
      width: 16px;
      height: 16px;
      border: 2px solid #3f3f46;
      border-top-color: #38bdf8;
      border-radius: 50%;
      animation: spin 0.8s linear infinite;
    }

    .uploading-text {
      font-size: 12px;
      color: #a1a1aa;
    }

    .error-banner {
      margin-top: 10px;
      display: flex;
      align-items: center;
      gap: 6px;
      background: rgba(239, 68, 68, 0.1);
      border: 1px solid rgba(239, 68, 68, 0.3);
      border-radius: 6px;
      padding: 8px 12px;
      color: #f87171;
      font-size: 11px;
    }

    /* Preview Dialog */
    .preview-backdrop {
      position: fixed;
      inset: 0;
      background: rgba(0, 0, 0, 0.85);
      z-index: 1100;
      display: flex;
      align-items: center;
      justify-content: center;
      padding: 16px;
    }

    .preview-dialog {
      background: #18181b;
      border: 1px solid #3f3f46;
      border-radius: 12px;
      max-width: 600px;
      width: 100%;
      max-height: 85vh;
      display: flex;
      flex-direction: column;
      overflow: hidden;
    }

    .preview-header {
      padding: 12px 16px;
      border-bottom: 1px solid #27272a;
      display: flex;
      justify-content: space-between;
      align-items: center;
    }

    .preview-title {
      font-size: 13px;
      font-weight: 600;
      color: #fafafa;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }

    .preview-body {
      padding: 16px;
      display: flex;
      align-items: center;
      justify-content: center;
      overflow: auto;
    }

    .full-img {
      max-width: 100%;
      max-height: 70vh;
      border-radius: 8px;
      object-fit: contain;
    }

    .pdf-preview-box {
      text-align: center;
      padding: 30px;
      color: #a1a1aa;
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 12px;
    }

    .skeleton-line {
      height: 48px;
      background: #27272a;
      border-radius: 8px;
      animation: pulse 1.5s infinite ease-in-out;
    }

    @keyframes spin {
      to { transform: rotate(360deg); }
    }
    @keyframes pulse {
      0%, 100% { opacity: 0.6; }
      50% { opacity: 0.3; }
    }
  `,
})
export class AttachmentModalComponent {
  private api = inject(ApiService);

  isOpen = input<boolean>(false);
  transaction = input<Transaction | null>(null);

  onClose = output<void>();
  onAttachmentChanged = output<void>();

  attachments = signal<TransactionAttachment[]>([]);
  isLoading = signal<boolean>(false);
  isUploading = signal<boolean>(false);
  isDragging = signal<boolean>(false);
  errorMessage = signal<string | null>(null);
  previewAttachment = signal<TransactionAttachment | null>(null);

  constructor() {
    effect(() => {
      const open = this.isOpen();
      const tx = this.transaction();
      if (open && tx) {
        this.loadAttachments(tx.id);
      } else {
        this.attachments.set([]);
        this.errorMessage.set(null);
        this.previewAttachment.set(null);
      }
    });
  }

  loadAttachments(txId: string): void {
    this.isLoading.set(true);
    this.errorMessage.set(null);
    this.api.getTransactionAttachments(txId).subscribe({
      next: (resp) => {
        this.attachments.set(resp.attachments);
        this.isLoading.set(false);
      },
      error: () => {
        this.isLoading.set(false);
      },
    });
  }

  onFileSelected(event: Event): void {
    const target = event.target as HTMLInputElement;
    if (target.files && target.files.length > 0) {
      this.uploadFile(target.files[0]);
      target.value = '';
    }
  }

  onDragOver(event: DragEvent): void {
    event.preventDefault();
    this.isDragging.set(true);
  }

  onDragLeave(event: DragEvent): void {
    event.preventDefault();
    this.isDragging.set(false);
  }

  onDrop(event: DragEvent): void {
    event.preventDefault();
    this.isDragging.set(false);
    if (event.dataTransfer?.files && event.dataTransfer.files.length > 0) {
      this.uploadFile(event.dataTransfer.files[0]);
    }
  }

  uploadFile(file: File): void {
    const tx = this.transaction();
    if (!tx) return;

    // Validação de tamanho no cliente
    if (file.size > 10 * 1024 * 1024) {
      this.errorMessage.set('O arquivo é muito grande (máximo 10 MB).');
      return;
    }

    this.isUploading.set(true);
    this.errorMessage.set(null);

    this.api.uploadAttachment(tx.id, file).subscribe({
      next: (newAtt) => {
        this.attachments.update((list) => [newAtt, ...list]);
        this.isUploading.set(false);
        this.onAttachmentChanged.emit();
      },
      error: (err) => {
        this.isUploading.set(false);
        const detail = err.error?.detail || err.error?.title || 'Falha ao enviar comprovante.';
        this.errorMessage.set(detail);
      },
    });
  }

  deleteAttachment(att: TransactionAttachment): void {
    if (!confirm(`Deseja realmente excluir o comprovante "${att.file_name}"?`)) {
      return;
    }

    this.api.deleteAttachment(att.id).subscribe({
      next: () => {
        this.attachments.update((list) => list.filter((a) => a.id !== att.id));
        if (this.previewAttachment()?.id === att.id) {
          this.previewAttachment.set(null);
        }
        this.onAttachmentChanged.emit();
      },
      error: () => {
        this.errorMessage.set('Não foi possível excluir o comprovante.');
      },
    });
  }

  openPreview(att: TransactionAttachment): void {
    this.previewAttachment.set(att);
  }

  closePreview(): void {
    this.previewAttachment.set(null);
  }

  close(): void {
    this.onClose.emit();
  }

  isImage(mime: string): boolean {
    return mime.startsWith('image/');
  }

  formatSize(bytes: number): string {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  }
}
