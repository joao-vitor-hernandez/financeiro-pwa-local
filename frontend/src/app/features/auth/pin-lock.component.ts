import { Component, HostListener, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { AuthService } from '../../core/services/auth.service';
import { IconComponent } from '../../shared/components/icon/icon.component';

@Component({
  selector: 'app-pin-lock',
  standalone: true,
  imports: [CommonModule, IconComponent],
  template: `
    <div class="pin-lock-container">
      <div class="pin-card">
        <!-- Ícone & Identificação do Usuário -->
        <div class="lock-header">
          <div class="lock-icon-badge">
            <app-icon name="lock" [size]="24" />
          </div>
          <h1 class="brand-title">Financeiro</h1>
          <span class="user-badge">{{ authService.userEmail() }}</span>
        </div>

        <!-- Instruções -->
        <div class="pin-prompt">
          @if (!authService.isServerReachable()) {
            <h2 class="prompt-title">Servidor Local Desconectado</h2>
            <p class="prompt-subtitle">
              O PWA está no ar, mas a API local precisa do Cloudflare Tunnel (Fase 4) para receber conexões externas.
            </p>
          } @else {
            <h2 class="prompt-title">
              {{ authService.isSetup() ? 'Digite seu PIN de 6 dígitos' : 'Cadastre seu PIN de 6 dígitos' }}
            </h2>
            <p class="prompt-subtitle">
              {{ authService.isSetup() ? 'Acesso restrito e criptografado' : 'Defina sua chave mestre de acesso' }}
            </p>
          }
        </div>

        @if (authService.connectionError()) {
          <div class="connection-notice">
            <span>{{ authService.connectionError() }}</span>
          </div>
        }

        <!-- Indicador Visual dos 6 Dígitos com Animação Shake em Erro -->
        <div class="pin-dots" [class.shake]="isShaking()">
          @for (idx of [0, 1, 2, 3, 4, 5]; track idx) {
            <div class="dot" [class.filled]="currentPin().length > idx"></div>
          }
        </div>

        <!-- Mensagem de Erro ou Bloqueio -->
        @if (errorMessage()) {
          <div class="error-msg">
            {{ errorMessage() }}
          </div>
        }

        <!-- Teclado Numérico Ergonômico Mobile-First (Alvos de Toque Grandes) -->
        <div class="numpad-grid">
          @for (num of [1, 2, 3, 4, 5, 6, 7, 8, 9]; track num) {
            <button
              type="button"
              class="numpad-btn"
              (click)="appendDigit(num)"
              [disabled]="isSubmitting()"
            >
              {{ num }}
            </button>
          }

          <div class="numpad-placeholder"></div>

          <button
            type="button"
            class="numpad-btn"
            (click)="appendDigit(0)"
            [disabled]="isSubmitting()"
          >
            0
          </button>

          <button
            type="button"
            class="numpad-btn backspace-btn"
            (click)="backspace()"
            [disabled]="isSubmitting() || currentPin().length === 0"
            title="Apagar"
          >
            <app-icon name="backspace" [size]="20" />
          </button>
        </div>

        @if (isSubmitting()) {
          <div class="submitting-indicator">
            <span>Verificando credenciais...</span>
          </div>
        }
      </div>
    </div>
  `,
  styles: `
    .pin-lock-container {
      position: fixed;
      inset: 0;
      background-color: var(--bg-app);
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      padding: 24px;
      z-index: 999;
    }

    .pin-card {
      width: 100%;
      max-width: 340px;
      display: flex;
      flex-direction: column;
      align-items: center;
      text-align: center;
    }

    .lock-header {
      display: flex;
      flex-direction: column;
      align-items: center;
      margin-bottom: 24px;

      .lock-icon-badge {
        width: 52px;
        height: 52px;
        border-radius: 50%;
        background-color: var(--bg-surface-elevated);
        border: 1px solid var(--border-subtle);
        color: var(--text-primary);
        display: flex;
        align-items: center;
        justify-content: center;
        margin-bottom: 12px;
      }

      .brand-title {
        font-size: 20px;
        font-weight: 700;
        letter-spacing: -0.02em;
        color: var(--text-primary);
      }

      .user-badge {
        margin-top: 6px;
        font-size: 12px;
        color: var(--text-muted);
        background-color: var(--bg-surface);
        padding: 4px 10px;
        border-radius: var(--radius-full);
        border: 1px solid var(--border-muted);
      }
    }

    .pin-prompt {
      margin-bottom: 24px;

      .prompt-title {
        font-size: 16px;
        font-weight: 600;
        color: var(--text-primary);
      }

      .prompt-subtitle {
        font-size: 13px;
        color: var(--text-secondary);
        margin-top: 4px;
      }
    }

    .pin-dots {
      display: flex;
      gap: 16px;
      margin-bottom: 24px;

      .dot {
        width: 14px;
        height: 14px;
        border-radius: 50%;
        border: 2px solid var(--border-subtle);
        background-color: transparent;
        transition: all 0.15s ease;

        &.filled {
          background-color: var(--text-primary);
          border-color: var(--text-primary);
          transform: scale(1.15);
        }
      }

      &.shake {
        animation: shake 0.4s ease-in-out;
      }
    }

    @keyframes shake {
      0%, 100% { transform: translateX(0); }
      20%, 60% { transform: translateX(-8px); }
      40%, 80% { transform: translateX(8px); }
    }

    .connection-notice {
      background-color: rgba(245, 158, 11, 0.1);
      color: #f59e0b;
      border: 1px solid rgba(245, 158, 11, 0.25);
      border-radius: var(--radius-md);
      padding: 10px 14px;
      font-size: 12px;
      margin-bottom: 20px;
      max-width: 320px;
      line-height: 1.4;
    }

    .error-msg {
      background-color: var(--color-expense-bg);
      color: var(--color-expense);
      border: 1px solid rgba(244, 63, 94, 0.25);
      border-radius: var(--radius-md);
      padding: 8px 14px;
      font-size: 13px;
      margin-bottom: 20px;
      max-width: 320px;
      line-height: 1.4;
    }

    .numpad-grid {
      display: grid;
      grid-template-columns: repeat(3, 1fr);
      gap: 16px 24px;
      width: 100%;
      max-width: 280px;
      justify-items: center;
    }

    .numpad-btn {
      width: 64px;
      height: 64px;
      border-radius: 50%;
      background-color: var(--bg-surface);
      border: 1px solid var(--border-subtle);
      color: var(--text-primary);
      font-size: 22px;
      font-weight: 500;
      display: flex;
      align-items: center;
      justify-content: center;
      cursor: pointer;
      user-select: none;
      transition: background-color 0.12s ease, transform 0.1s ease;

      &:active {
        transform: scale(0.92);
        background-color: var(--bg-hover);
      }

      &.backspace-btn {
        background-color: transparent;
        border-color: transparent;
        color: var(--text-muted);

        &:hover {
          color: var(--text-primary);
        }
      }
    }

    .numpad-placeholder {
      width: 64px;
      height: 64px;
    }

    .submitting-indicator {
      margin-top: 18px;
      font-size: 12px;
      color: var(--text-muted);
    }
  `,
})
export class PinLockComponent {
  authService = inject(AuthService);

  currentPin = signal<string>('');
  isShaking = signal<boolean>(false);
  isSubmitting = signal<boolean>(false);
  errorMessage = signal<string | null>(null);

  @HostListener('window:keydown', ['$event'])
  handleKeyDown(event: KeyboardEvent): void {
    if (this.isSubmitting()) return;

    if (event.key >= '0' && event.key <= '9') {
      this.appendDigit(parseInt(event.key, 10));
    } else if (event.key === 'Backspace') {
      this.backspace();
    }
  }

  appendDigit(num: number): void {
    if (this.currentPin().length >= 6 || this.isSubmitting()) return;

    const updated = this.currentPin() + num.toString();
    this.currentPin.set(updated);
    this.errorMessage.set(null);

    if (updated.length === 6) {
      this.submitPin(updated);
    }
  }

  backspace(): void {
    const cur = this.currentPin();
    if (cur.length > 0) {
      this.currentPin.set(cur.substring(0, cur.length - 1));
      this.errorMessage.set(null);
    }
  }

  private submitPin(pin: string): void {
    this.isSubmitting.set(true);

    const action$ = this.authService.isSetup()
      ? this.authService.loginWithPin(pin)
      : this.authService.setupPin(pin);

    action$.subscribe({
      next: () => {
        this.isSubmitting.set(false);
        this.currentPin.set('');
        this.errorMessage.set(null);
      },
      error: (err) => {
        this.isSubmitting.set(false);
        this.currentPin.set('');
        this.triggerShake();

        const detail = err?.error?.detail || 'Erro ao validar PIN. Tente novamente.';
        this.errorMessage.set(typeof detail === 'string' ? detail : JSON.stringify(detail));
      },
    });
  }

  private triggerShake(): void {
    this.isShaking.set(true);
    setTimeout(() => this.isShaking.set(false), 450);
  }
}
