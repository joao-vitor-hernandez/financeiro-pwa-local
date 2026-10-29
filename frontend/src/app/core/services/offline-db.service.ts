import { Injectable } from '@angular/core';
import Dexie, { Table } from 'dexie';
import { Account } from '../models/account.model';
import { Transaction, TransactionCreate } from '../models/transaction.model';
import { Category } from '../models/category.model';
import { DashboardSummary } from '../models/summary.model';

export interface CachedSummaryRecord {
  id: string; // sempre 'latest'
  data: DashboardSummary;
  updated_at: string;
}

export interface OutboxItem {
  id?: number;
  client_tx_id: string;
  payload: TransactionCreate;
  account_name?: string;
  category_name?: string;
  created_at: string;
  retry_count: number;
  status: 'PENDING' | 'SYNCING' | 'FAILED';
  error_message?: string;
}

@Injectable({
  providedIn: 'root',
})
export class OfflineDbService extends Dexie {
  accounts!: Table<Account, string>;
  transactions!: Table<Transaction, string>;
  categories!: Table<Category, string>;
  summaryCache!: Table<CachedSummaryRecord, string>;
  outbox!: Table<OutboxItem, number>;

  constructor() {
    super('FinancialPWAOfflineDB');

    this.version(1).stores({
      accounts: 'id, name, type, is_active',
      transactions: 'id, account_id, category_id, transaction_date, type',
      categories: 'id, name, type, parent_id',
      summaryCache: 'id',
    });

    // Versão 2: Adiciona tabela de fila Outbox para lançamentos offline resilientes (Fase 7.4)
    this.version(2).stores({
      accounts: 'id, name, type, is_active',
      transactions: 'id, account_id, category_id, transaction_date, type',
      categories: 'id, name, type, parent_id',
      summaryCache: 'id',
      outbox: '++id, client_tx_id, status, created_at',
    });
  }

  // --- Cache de Contas ---

  async cacheAccounts(accounts: Account[]): Promise<void> {
    await this.accounts.bulkPut(accounts);
  }

  async getCachedAccounts(): Promise<Account[]> {
    return await this.accounts.toArray();
  }

  // --- Cache de Categorias ---

  async cacheCategories(categories: Category[]): Promise<void> {
    await this.categories.bulkPut(categories);
  }

  async getCachedCategories(): Promise<Category[]> {
    return await this.categories.toArray();
  }

  // --- Cache de Transações ---

  async cacheTransactions(transactions: Transaction[]): Promise<void> {
    await this.transactions.bulkPut(transactions);
  }

  async getCachedTransactions(limit: number = 50): Promise<Transaction[]> {
    return await this.transactions
      .orderBy('transaction_date')
      .reverse()
      .limit(limit)
      .toArray();
  }

  // --- Cache de Resumo do Dashboard ---

  async cacheSummary(data: DashboardSummary): Promise<void> {
    await this.summaryCache.put({
      id: 'latest',
      data,
      updated_at: new Date().toISOString(),
    });
  }

  async getCachedSummary(): Promise<DashboardSummary | null> {
    const record = await this.summaryCache.get('latest');
    return record ? record.data : null;
  }

  // --- Fila Outbox de Lançamentos Offline (Fase 7.4) ---

  async addOutboxItem(item: Omit<OutboxItem, 'id'>): Promise<number> {
    return (await this.outbox.add(item as OutboxItem)) as number;
  }

  async getPendingOutboxItems(): Promise<OutboxItem[]> {
    return await this.outbox
      .where('status')
      .anyOf('PENDING', 'FAILED')
      .sortBy('id');
  }

  async getAllOutboxItems(): Promise<OutboxItem[]> {
    return await this.outbox.orderBy('id').toArray();
  }

  async updateOutboxItem(id: number, changes: Partial<OutboxItem>): Promise<number> {
    return await this.outbox.update(id, changes);
  }

  async deleteOutboxItem(id: number): Promise<void> {
    await this.outbox.delete(id);
  }

  async clearOutbox(): Promise<void> {
    await this.outbox.clear();
  }
}
