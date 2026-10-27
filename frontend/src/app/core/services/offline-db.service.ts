import { Injectable } from '@angular/core';
import Dexie, { Table } from 'dexie';
import { Account } from '../models/account.model';
import { Transaction } from '../models/transaction.model';
import { Category } from '../models/category.model';
import { DashboardSummary } from '../models/summary.model';

export interface CachedSummaryRecord {
  id: string; // sempre 'latest'
  data: DashboardSummary;
  updated_at: string;
}

@Injectable({
  providedIn: 'root',
})
export class OfflineDbService extends Dexie {
  accounts!: Table<Account, string>;
  transactions!: Table<Transaction, string>;
  categories!: Table<Category, string>;
  summaryCache!: Table<CachedSummaryRecord, string>;

  constructor() {
    super('FinancialPWAOfflineDB');

    this.version(1).stores({
      accounts: 'id, name, type, is_active',
      transactions: 'id, account_id, category_id, transaction_date, type',
      categories: 'id, name, type, parent_id',
      summaryCache: 'id',
    });
  }

  async cacheAccounts(accounts: Account[]): Promise<void> {
    await this.accounts.bulkPut(accounts);
  }

  async getCachedAccounts(): Promise<Account[]> {
    return await this.accounts.toArray();
  }

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
}
