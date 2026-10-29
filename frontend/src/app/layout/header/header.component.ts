import { Component, inject, signal } from '@angular/core';
import { PrivacyService } from '../../core/services/privacy.service';
import { ApiService } from '../../core/services/api.service';
import { AuthService } from '../../core/services/auth.service';
import { OutboxSyncService } from '../../core/services/outbox-sync.service';
import { IconComponent } from '../../shared/components/icon/icon.component';

@Component({
  selector: 'app-header',
  standalone: true,
  imports: [IconComponent],
  template: `
    <header class="app-header">
      <div class="header-brand">
        <img src="logo.png" alt="ClariFin Logo" class="brand-logo" width="28" height="28" />
        <span class="brand-name">ClariFin</span>
        <span class="badge badge-neutral env-badge">Homelab</span>
        @if (!outboxSync.isOnline()) {
          <span class="badge offline-badge">Offline</span>
        }
      </div>

      <div class="header-actions">
        <!-- Indicador & Botão de Sincronização da Fila Offline -->
        @if (outboxSync.pendingCount() > 0) {
          <button
            class="btn btn-ghost outbox-sync-btn"
            [class.rotating]="outboxSync.isSyncing()"
            (click)="outboxSync.syncPending()"
            [title]="outboxSync.pendingCount() + ' lançamento(s) na fila offline. Clique para sincronizar agora.'"
          >
            <app-icon name="repeat" [size]="16" />
            <span class="outbox-count-chip">{{ outboxSync.pendingCount() }}</span>
          </button>
        }

        <!-- Botão de Sincronização Open Finance -->
        <button
          class="btn btn-ghost btn-icon"
          [class.rotating]="isSyncing()"
          (click)="triggerSync()"
          title="Sincronizar Open Finance"
        >
          <app-icon name="refresh" [size]="18" />
        </button>

        <!-- Botão Modo Privacidade (R$ •••••) -->
        <button
          class="btn btn-ghost btn-icon privacy-btn"
          (click)="privacy.toggle()"
          [title]="privacy.isPrivate() ? 'Mostrar valores' : 'Ocultar valores'"
        >
          <app-icon [name]="privacy.isPrivate() ? 'eye-off' : 'eye'" [size]="20" />
        </button>

        <!-- Botão Bloquear Sessão (PIN Lock) -->
        <button
          class="btn btn-ghost btn-icon"
          (click)="auth.logout()"
          title="Bloquear aplicativo"
        >
          <app-icon name="lock" [size]="18" />
        </button>
      </div>
    </header>
  `,
  styles: `
    .app-header {
      height: 60px;
      padding: 0 20px;
      display: flex;
      align-items: center;
      justify-content: space-between;
      border-bottom: 1px solid var(--border-subtle);
      background-color: rgba(9, 9, 11, 0.85);
      backdrop-filter: blur(12px);
      position: sticky;
      top: 0;
      z-index: 40;
    }

    .header-brand {
      display: flex;
      align-items: center;
      gap: 10px;

      .brand-logo {
        width: 28px;
        height: 28px;
        object-fit: contain;
        filter: drop-shadow(0 2px 6px rgba(33, 208, 178, 0.3));
      }

      .brand-name {
        font-family: var(--font-sans);
        font-size: 18px;
        font-weight: 700;
        letter-spacing: -0.02em;
        color: var(--text-primary);
      }

      .env-badge {
        font-size: 11px;
        padding: 2px 6px;
      }

      .offline-badge {
        font-size: 10px;
        font-weight: 700;
        text-transform: uppercase;
        background: rgba(251, 191, 36, 0.15);
        color: #fbbf24;
        border: 1px solid rgba(251, 191, 36, 0.3);
        padding: 2px 6px;
        border-radius: 6px;
      }
    }

    .header-actions {
      display: flex;
      align-items: center;
      gap: 6px;
    }

    .outbox-sync-btn {
      display: inline-flex;
      align-items: center;
      gap: 5px;
      padding: 4px 8px;
      border-radius: 8px;
      background: rgba(29, 205, 254, 0.12);
      color: #1DCDFE;
      border: 1px solid rgba(29, 205, 254, 0.25);
      min-height: 32px;
      cursor: pointer;
    }

    .outbox-count-chip {
      font-size: 11px;
      font-weight: 700;
      background: #1DCDFE;
      color: #09090b;
      padding: 1px 5px;
      border-radius: 8px;
    }

    .rotating {
      animation: spin 1s linear infinite;
    }

    @keyframes spin {
      from { transform: rotate(0deg); }
      to { transform: rotate(360deg); }
    }
  `,
})
export class HeaderComponent {
  privacy = inject(PrivacyService);
  auth = inject(AuthService);
  outboxSync = inject(OutboxSyncService);
  private api = inject(ApiService);
  isSyncing = signal<boolean>(false);

  triggerSync(): void {
    if (this.isSyncing()) return;
    this.isSyncing.set(true);

    this.api.triggerSync().subscribe({
      next: () => {
        setTimeout(() => this.isSyncing.set(false), 800);
      },
      error: () => {
        this.isSyncing.set(false);
      },
    });
  }
}
