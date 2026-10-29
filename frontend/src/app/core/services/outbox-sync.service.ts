import { inject, Injectable, signal } from '@angular/core';
import { OfflineDbService, OutboxItem } from './offline-db.service';
import { ApiService } from './api.service';
import { FinanceSyncService } from './finance-sync.service';
import { TransactionCreate } from '../models/transaction.model';
import { firstValueFrom } from 'rxjs';

@Injectable({
  providedIn: 'root',
})
export class OutboxSyncService {
  private db = inject(OfflineDbService);
  private api = inject(ApiService);
  private financeSync = inject(FinanceSyncService);

  isOnline = signal<boolean>(typeof navigator !== 'undefined' ? navigator.onLine : true);
  pendingCount = signal<number>(0);
  isSyncing = signal<boolean>(false);
  lastSyncSuccess = signal<Date | null>(null);

  constructor() {
    this.initNetworkListeners();
    this.refreshPendingCount();
  }

  private initNetworkListeners(): void {
    if (typeof window === 'undefined') return;

    window.addEventListener('online', () => {
      this.isOnline.set(true);
      // Ao recuperar a conexão com a internet, processa imediatamente a fila pendente
      this.syncPending();
    });

    window.addEventListener('offline', () => {
      this.isOnline.set(false);
    });
  }

  async refreshPendingCount(): Promise<number> {
    try {
      const items = await this.db.getPendingOutboxItems();
      this.pendingCount.set(items.length);
      return items.length;
    } catch {
      return 0;
    }
  }

  async enqueue(
    payload: TransactionCreate,
    accountName?: string,
    categoryName?: string
  ): Promise<OutboxItem> {
    const clientTxId = payload.client_tx_id || crypto.randomUUID();
    const finalPayload: TransactionCreate = {
      ...payload,
      client_tx_id: clientTxId,
    };

    const outboxItem: Omit<OutboxItem, 'id'> = {
      client_tx_id: clientTxId,
      payload: finalPayload,
      account_name: accountName,
      category_name: categoryName,
      created_at: new Date().toISOString(),
      retry_count: 0,
      status: 'PENDING',
    };

    const insertedId = await this.db.addOutboxItem(outboxItem);
    await this.refreshPendingCount();

    const createdRecord: OutboxItem = {
      ...outboxItem,
      id: insertedId,
    };

    // Se estiver online no momento do lançamento, tenta sincronizar em background
    if (this.isOnline()) {
      this.syncPending();
    }

    return createdRecord;
  }

  async syncPending(): Promise<{ synced: number; failed: number }> {
    if (this.isSyncing() || !this.isOnline()) {
      return { synced: 0, failed: 0 };
    }

    this.isSyncing.set(true);
    let synced = 0;
    let failed = 0;

    try {
      const pendingItems = await this.db.getPendingOutboxItems();

      for (const item of pendingItems) {
        if (!item.id) continue;

        try {
          await this.db.updateOutboxItem(item.id, { status: 'SYNCING' });

          // Envia para a API com a chave de idempotência client_tx_id
          await firstValueFrom(this.api.createTransaction(item.payload));

          // Transação confirmada com sucesso: remove da fila local do IndexedDB
          await this.db.deleteOutboxItem(item.id);
          synced++;
        } catch (err: unknown) {
          // Verifica se foi erro de conexão (offline intermitente) ou erro de validação
          const httpErr = err as { status?: number; error?: { detail?: string } };
          const isNetworkError = !httpErr.status || httpErr.status === 0;

          if (isNetworkError) {
            // Rede caiu no meio do processo: mantém como PENDING e interrompe o loop
            await this.db.updateOutboxItem(item.id, { status: 'PENDING' });
            this.isOnline.set(false);
            break;
          } else {
            // Erro contábil/validação (4xx): marca como FAILED para inspeção
            failed++;
            await this.db.updateOutboxItem(item.id, {
              status: 'FAILED',
              retry_count: (item.retry_count || 0) + 1,
              error_message: httpErr?.error?.detail || 'Erro na validação do lançamento',
            });
          }
        }
      }

      await this.refreshPendingCount();

      if (synced > 0) {
        this.lastSyncSuccess.set(new Date());
        this.financeSync.notifyDataChanged();
      }
    } finally {
      this.isSyncing.set(false);
    }

    return { synced, failed };
  }

  async getPendingItems(): Promise<OutboxItem[]> {
    return await this.db.getPendingOutboxItems();
  }

  async retryItem(id: number): Promise<void> {
    await this.db.updateOutboxItem(id, { status: 'PENDING' });
    await this.refreshPendingCount();
    if (this.isOnline()) {
      this.syncPending();
    }
  }

  async removeItem(id: number): Promise<void> {
    await this.db.deleteOutboxItem(id);
    await this.refreshPendingCount();
  }
}

