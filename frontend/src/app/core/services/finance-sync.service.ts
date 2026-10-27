import { Injectable, signal } from '@angular/core';
import { Subject } from 'rxjs';

@Injectable({
  providedIn: 'root',
})
export class FinanceSyncService {
  // Controle de visibilidade do drawer Quick Add
  isQuickAddOpen = signal<boolean>(false);

  // Notificador de atualização de dados para recarregar telas ativas
  private refreshSubject = new Subject<void>();
  readonly refresh$ = this.refreshSubject.asObservable();

  openQuickAdd(): void {
    this.isQuickAddOpen.set(true);
  }

  closeQuickAdd(): void {
    this.isQuickAddOpen.set(false);
  }

  notifyDataChanged(): void {
    this.refreshSubject.next();
  }
}
