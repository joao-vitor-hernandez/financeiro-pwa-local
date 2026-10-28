import { Component, inject, signal } from '@angular/core';
import { PrivacyService } from '../../core/services/privacy.service';
import { ApiService } from '../../core/services/api.service';
import { AuthService } from '../../core/services/auth.service';
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
      </div>

      <div class="header-actions">
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
    }

    .header-actions {
      display: flex;
      align-items: center;
      gap: 6px;
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
