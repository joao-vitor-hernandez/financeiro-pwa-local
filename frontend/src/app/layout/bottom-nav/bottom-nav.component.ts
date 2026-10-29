import { Component, output } from '@angular/core';
import { RouterLink, RouterLinkActive } from '@angular/router';
import { IconComponent } from '../../shared/components/icon/icon.component';

@Component({
  selector: 'app-bottom-nav',
  standalone: true,
  imports: [RouterLink, RouterLinkActive, IconComponent],
  template: `
    <nav class="bottom-nav">
      <a routerLink="/" routerLinkActive="active" [routerLinkActiveOptions]="{ exact: true }" class="nav-item">
        <app-icon name="chart" [size]="20" />
        <span>Resumo</span>
      </a>

      <a routerLink="/transactions" routerLinkActive="active" class="nav-item">
        <app-icon name="list" [size]="20" />
        <span>Extrato</span>
      </a>

      <!-- Botão Central Flutuante para Lançamento Rápido -->
      <button class="fab-quick-add" (click)="openQuickAdd.emit()" title="Novo Lançamento">
        <app-icon name="plus" [size]="24" />
      </button>

      <a routerLink="/accounts" routerLinkActive="active" class="nav-item">
        <app-icon name="wallet" [size]="20" />
        <span>Contas</span>
      </a>

      <a routerLink="/rules" routerLinkActive="active" class="nav-item">
        <app-icon name="sliders" [size]="20" />
        <span>Regras</span>
      </a>
    </nav>
  `,
  styles: `
    .bottom-nav {
      position: fixed;
      bottom: 0;
      left: 0;
      right: 0;
      height: calc(var(--bottom-nav-height) + var(--safe-area-bottom));
      padding-bottom: var(--safe-area-bottom);
      background-color: rgba(18, 18, 21, 0.95);
      backdrop-filter: blur(16px);
      border-top: 1px solid var(--border-subtle);
      display: flex;
      align-items: center;
      justify-content: space-around;
      z-index: 50;
    }

    .nav-item {
      flex: 1;
      height: 100%;
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      gap: 4px;
      color: var(--text-muted);
      text-decoration: none;
      font-size: 11px;
      font-weight: 500;
      transition: color 0.15s ease;

      &.active {
        color: var(--text-primary);
      }
    }

    .fab-quick-add {
      width: 52px;
      height: 52px;
      border-radius: 50%;
      background-color: var(--text-primary);
      color: var(--bg-app);
      border: none;
      display: flex;
      align-items: center;
      justify-content: center;
      cursor: pointer;
      box-shadow: 0 4px 14px rgba(0, 0, 0, 0.4);
      margin-top: -16px;
      transition: transform 0.15s ease;

      &:active {
        transform: scale(0.92);
      }
    }
  `,
})
export class BottomNavComponent {
  openQuickAdd = output<void>();
}
