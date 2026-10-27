import { Component, inject } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { HeaderComponent } from './layout/header/header.component';
import { BottomNavComponent } from './layout/bottom-nav/bottom-nav.component';
import { QuickAddComponent } from './features/quick-add/quick-add.component';
import { FinanceSyncService } from './core/services/finance-sync.service';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [RouterOutlet, HeaderComponent, BottomNavComponent, QuickAddComponent],
  templateUrl: './app.html',
  styleUrl: './app.scss',
})
export class App {
  syncService = inject(FinanceSyncService);
}
