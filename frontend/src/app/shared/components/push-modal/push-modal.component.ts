import { Component, inject, input, output, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { WebPushService } from '../../../core/services/web-push.service';
import { IconComponent } from '../icon/icon.component';

@Component({
  selector: 'app-push-modal',
  standalone: true,
  imports: [CommonModule, IconComponent],
  template: `
    @if (isOpen()) {
      <div class="modal-backdrop" (click)="close.emit()">
        <div class="modal-panel" (click)="$event.stopPropagation()">
          <!-- Modal Header -->
          <div class="modal-header">
            <div class="header-title-wrap">
              <div class="bell-icon-badge" [class.active-glow]="webPush.state().isSubscribed">
                <app-icon name="bell" [size]="20" />
              </div>
              <div>
                <h3 class="modal-title">Alertas Web Push de Vencimentos</h3>
                <span class="modal-subtitle">Notificações nativas PWA com alta prioridade</span>
              </div>
            </div>
            <button class="btn-close" (click)="close.emit()" title="Fechar">
              <app-icon name="x" [size]="16" />
            </button>
          </div>

          <!-- Modal Body -->
          <div class="modal-body">
            <!-- Status Card -->
            <div class="status-card" [class.subscribed]="webPush.state().isSubscribed">
              <div class="status-header">
                <span class="status-label">Status das Notificações</span>
                @if (webPush.state().isSubscribed) {
                  <span class="status-badge badge-active">
                    <span class="pulse-dot"></span>
                    Ativo & Monitorando
                  </span>
                } @else if (webPush.state().permission === 'denied') {
                  <span class="status-badge badge-denied">Bloqueado no Navegador</span>
                } @else if (!webPush.state().supported) {
                  <span class="status-badge badge-unsupported">Não Suportado</span>
                } @else {
                  <span class="status-badge badge-inactive">Desativado</span>
                }
              </div>

              <!-- Cron Info Grid -->
              <div class="cron-info-grid">
                <div class="cron-item">
                  <span class="cron-title">⏰ Janelas Diárias</span>
                  <span class="cron-desc">09:00 e 18:00 (Fuso de Brasília / UTC-3)</span>
                </div>
                <div class="cron-item">
                  <span class="cron-title">📅 Regra de Antecedência</span>
                  <span class="cron-desc">D-1 (Véspera) e D-0 (Dia do Vencimento)</span>
                </div>
                <div class="cron-item">
                  <span class="cron-title">⚡ Alta Prioridade</span>
                  <span class="cron-desc">Urgency: High, vibração nativa e tela bloqueada</span>
                </div>
              </div>
            </div>

            <!-- Feedback Message Banner -->
            @if (feedbackMessage()) {
              <div class="feedback-banner" [class.error]="isFeedbackError()">
                <app-icon [name]="isFeedbackError() ? 'x' : 'check'" [size]="16" />
                <span>{{ feedbackMessage() }}</span>
              </div>
            }

            @if (webPush.state().error) {
              <div class="feedback-banner error">
                <app-icon name="x" [size]="16" />
                <span>{{ webPush.state().error }}</span>
              </div>
            }

            <!-- Instructions when permission is blocked -->
            @if (webPush.state().permission === 'denied') {
              <div class="permission-notice">
                <app-icon name="lock" [size]="16" />
                <p>
                  As notificações estão bloqueadas neste dispositivo. Para receber alertas de faturas,
                  clique no ícone de configurações na barra de endereço do navegador e altere a permissão
                  para <strong>Permitir</strong>.
                </p>
              </div>
            }

            <!-- Action Controls -->
            <div class="actions-section">
              @if (!webPush.state().isSubscribed) {
                <button
                  class="btn btn-primary btn-block"
                  [disabled]="webPush.state().isLoading || !webPush.state().supported || webPush.state().permission === 'denied'"
                  (click)="handleSubscribe()"
                >
                  <app-icon name="bell" [size]="18" />
                  <span>{{ webPush.state().isLoading ? 'Ativando...' : 'Ativar Notificações Web Push' }}</span>
                </button>
              } @else {
                <div class="active-actions-row">
                  <button
                    class="btn btn-secondary flex-1"
                    [disabled]="isTesting()"
                    (click)="handleSendTest()"
                  >
                    <app-icon name="sparkles" [size]="16" />
                    <span>{{ isTesting() ? 'Disparando...' : 'Push de Teste' }}</span>
                  </button>

                  <button
                    class="btn btn-secondary flex-1"
                    [disabled]="isCheckingBills()"
                    (click)="handleTriggerBillsCheck()"
                  >
                    <app-icon name="play" [size]="16" />
                    <span>{{ isCheckingBills() ? 'Verificando...' : 'Checar Faturas' }}</span>
                  </button>
                </div>

                <button
                  class="btn btn-danger-subtle btn-block"
                  [disabled]="webPush.state().isLoading"
                  (click)="handleUnsubscribe()"
                >
                  <app-icon name="bell-off" [size]="16" />
                  <span>{{ webPush.state().isLoading ? 'Desativando...' : 'Desativar Notificações neste Dispositivo' }}</span>
                </button>
              }
            </div>
          </div>
        </div>
      </div>
    }
  `,
  styles: `
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
      max-width: 480px;
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
      align-items: flex-start;
    }

    .header-title-wrap {
      display: flex;
      align-items: center;
      gap: 12px;
    }

    .bell-icon-badge {
      width: 42px;
      height: 42px;
      border-radius: 12px;
      background: rgba(255, 255, 255, 0.06);
      display: flex;
      align-items: center;
      justify-content: center;
      color: #a1a1aa;
      transition: all 0.2s ease;
    }

    .bell-icon-badge.active-glow {
      background: rgba(33, 208, 178, 0.15);
      color: #21D0B2;
      box-shadow: 0 0 16px rgba(33, 208, 178, 0.25);
    }

    .modal-title {
      font-size: 1.05rem;
      font-weight: 700;
      color: #ffffff;
      margin: 0;
    }

    .modal-subtitle {
      font-size: 0.78rem;
      color: #71717a;
      display: block;
      margin-top: 2px;
    }

    .btn-close {
      background: transparent;
      border: none;
      color: #71717a;
      cursor: pointer;
      padding: 4px;
      border-radius: 6px;
      transition: color 0.15s ease;
    }

    .btn-close:hover {
      color: #ffffff;
    }

    .modal-body {
      display: flex;
      flex-direction: column;
      gap: 16px;
    }

    .status-card {
      background: rgba(255, 255, 255, 0.03);
      border: 1px solid rgba(255, 255, 255, 0.08);
      border-radius: 14px;
      padding: 16px;
      display: flex;
      flex-direction: column;
      gap: 12px;
    }

    .status-card.subscribed {
      border-color: rgba(33, 208, 178, 0.3);
      background: rgba(33, 208, 178, 0.03);
    }

    .status-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
    }

    .status-label {
      font-size: 0.82rem;
      font-weight: 600;
      color: #a1a1aa;
    }

    .status-badge {
      display: inline-flex;
      align-items: center;
      gap: 6px;
      font-size: 0.75rem;
      font-weight: 700;
      padding: 4px 10px;
      border-radius: 20px;
    }

    .badge-active {
      background: rgba(33, 208, 178, 0.15);
      color: #21D0B2;
      border: 1px solid rgba(33, 208, 178, 0.3);
    }

    .pulse-dot {
      width: 7px;
      height: 7px;
      border-radius: 50%;
      background-color: #21D0B2;
      box-shadow: 0 0 8px #21D0B2;
      animation: pulse 1.5s infinite ease-in-out;
    }

    .badge-inactive {
      background: rgba(255, 255, 255, 0.06);
      color: #a1a1aa;
      border: 1px solid rgba(255, 255, 255, 0.1);
    }

    .badge-denied {
      background: rgba(239, 68, 68, 0.15);
      color: #ef4444;
      border: 1px solid rgba(239, 68, 68, 0.3);
    }

    .badge-unsupported {
      background: rgba(251, 191, 36, 0.15);
      color: #fbbf24;
      border: 1px solid rgba(251, 191, 36, 0.3);
    }

    .cron-info-grid {
      display: flex;
      flex-direction: column;
      gap: 8px;
      border-top: 1px solid rgba(255, 255, 255, 0.06);
      padding-top: 10px;
    }

    .cron-item {
      display: flex;
      flex-direction: column;
      gap: 2px;
    }

    .cron-title {
      font-size: 0.75rem;
      font-weight: 700;
      color: #d4d4d8;
    }

    .cron-desc {
      font-size: 0.74rem;
      color: #71717a;
    }

    .feedback-banner {
      display: flex;
      align-items: center;
      gap: 8px;
      background: rgba(33, 208, 178, 0.12);
      color: #21D0B2;
      border: 1px solid rgba(33, 208, 178, 0.25);
      padding: 10px 14px;
      border-radius: 10px;
      font-size: 0.8rem;
    }

    .feedback-banner.error {
      background: rgba(239, 68, 68, 0.15);
      color: #ef4444;
      border-color: rgba(239, 68, 68, 0.3);
    }

    .permission-notice {
      display: flex;
      gap: 10px;
      background: rgba(251, 191, 36, 0.1);
      border: 1px solid rgba(251, 191, 36, 0.25);
      border-radius: 10px;
      padding: 12px;
      color: #fbbf24;
      font-size: 0.78rem;
      line-height: 1.4;

      p {
        margin: 0;
      }
    }

    .actions-section {
      display: flex;
      flex-direction: column;
      gap: 10px;
      margin-top: 4px;
    }

    .active-actions-row {
      display: flex;
      gap: 10px;
    }

    .flex-1 {
      flex: 1;
    }

    .btn-block {
      width: 100%;
      justify-content: center;
    }

    .btn-primary {
      background: #21D0B2;
      color: #09090b;
      font-weight: 700;
      border: none;
      border-radius: 10px;
      padding: 12px 16px;
      display: flex;
      align-items: center;
      gap: 8px;
      cursor: pointer;
      transition: background 0.15s ease;
    }

    .btn-primary:hover:not(:disabled) {
      background: #1eb89e;
    }

    .btn-secondary {
      background: rgba(255, 255, 255, 0.06);
      border: 1px solid rgba(255, 255, 255, 0.12);
      color: #ffffff;
      font-weight: 600;
      font-size: 0.82rem;
      border-radius: 10px;
      padding: 10px 14px;
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 6px;
      cursor: pointer;
      transition: all 0.15s ease;
    }

    .btn-secondary:hover:not(:disabled) {
      background: rgba(255, 255, 255, 0.1);
    }

    .btn-danger-subtle {
      background: rgba(239, 68, 68, 0.08);
      border: 1px solid rgba(239, 68, 68, 0.2);
      color: #f87171;
      font-weight: 600;
      font-size: 0.8rem;
      border-radius: 10px;
      padding: 8px 12px;
      display: flex;
      align-items: center;
      gap: 6px;
      cursor: pointer;
      transition: all 0.15s ease;
    }

    .btn-danger-subtle:hover:not(:disabled) {
      background: rgba(239, 68, 68, 0.15);
      color: #ef4444;
    }

    button:disabled {
      opacity: 0.5;
      cursor: not-allowed;
    }

    @keyframes pulse {
      0%, 100% { transform: scale(1); opacity: 1; }
      50% { transform: scale(1.3); opacity: 0.6; }
    }
  `,
})
export class PushModalComponent {
  isOpen = input<boolean>(false);
  close = output<void>();

  webPush = inject(WebPushService);

  feedbackMessage = signal<string>('');
  isFeedbackError = signal<boolean>(false);
  isTesting = signal<boolean>(false);
  isCheckingBills = signal<boolean>(false);

  async handleSubscribe(): Promise<void> {
    this.clearFeedback();
    const success = await this.webPush.subscribe();
    if (success) {
      this.showFeedback('Notificações Web Push ativadas com sucesso!');
    }
  }

  async handleUnsubscribe(): Promise<void> {
    this.clearFeedback();
    const success = await this.webPush.unsubscribe();
    if (success) {
      this.showFeedback('Notificações desativadas para este aparelho.');
    }
  }

  async handleSendTest(): Promise<void> {
    this.clearFeedback();
    this.isTesting.set(true);
    try {
      const res = await this.webPush.sendTestPush();
      if (res.success) {
        this.showFeedback('Notificação de teste enviada! Verifique a tela/notificações do aparelho.');
      } else {
        this.showFeedback('Nenhum dispositivo ativo conectado para receber o teste.', true);
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Falha ao enviar push de teste.';
      this.showFeedback(msg, true);
    } finally {
      this.isTesting.set(false);
    }
  }

  async handleTriggerBillsCheck(): Promise<void> {
    this.clearFeedback();
    this.isCheckingBills.set(true);
    try {
      const res = await this.webPush.triggerDueCheck();
      const count = res.alerts_dispatched_count ?? 0;
      if (count > 0) {
        this.showFeedback(`Verificação concluída: ${count} alerta(s) de vencimento D-0/D-1 emitido(s)!`);
      } else {
        this.showFeedback('Nenhuma fatura com vencimento em D-0 ou D-1 encontrada no momento.');
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Falha ao executar checagem de vencimentos.';
      this.showFeedback(msg, true);
    } finally {
      this.isCheckingBills.set(false);
    }
  }

  private showFeedback(message: string, isError = false): void {
    this.feedbackMessage.set(message);
    this.isFeedbackError.set(isError);
  }

  private clearFeedback(): void {
    this.feedbackMessage.set('');
    this.isFeedbackError.set(false);
  }
}
