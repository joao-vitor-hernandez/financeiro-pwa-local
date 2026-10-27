import { Component, inject, signal } from '@angular/core';
import { PrivacyService } from '../../core/services/privacy.service';
import { ApiService } from '../../core/services/api.service';
import { IconComponent } from '../../shared/components/icon/icon.component';

@Component({
  selector: 'app-header',
  standalone: true,
  imports: [IconComponent],
  template: `
    <header class="app-header">
      <div class="header-brand">
        <span class="brand-name">Financeiro</span>
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

      .brand-name {
        font-size: 17px;
        font-weight: 600;
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
