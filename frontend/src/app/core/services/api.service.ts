import { inject, Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { catchError, from, map, Observable, of, tap } from 'rxjs';
import { environment } from '../../../environments/environment';
import { Account, AccountCreate } from '../models/account.model';
import { Category, CategoryCreate } from '../models/category.model';
import { Transaction, TransactionCreate } from '../models/transaction.model';
import { CreditCardBill } from '../models/bill.model';
import { DashboardSummary } from '../models/summary.model';
import { OfflineDbService } from './offline-db.service';

@Injectable({
  providedIn: 'root',
})
export class ApiService {
  private http = inject(HttpClient);
  private offlineDb = inject(OfflineDbService);
  private apiUrl = environment.apiUrl;

  getDashboardSummary(): Observable<DashboardSummary> {
    return this.http.get<DashboardSummary>(`${this.apiUrl}/dashboard/summary`).pipe(
      tap((summary) => this.offlineDb.cacheSummary(summary)),
      catchError(() => {
        // Fallback offline via IndexedDB
        return from(this.offlineDb.getCachedSummary()).pipe(
          map((cached) => cached || {
            total_checking_balance: '0.00',
            total_investments: '0.00',
            current_card_bill: '0.00',
            total_credit_card_debt: '0.00',
            net_worth: '0.00',
            monthly_income: '0.00',
            monthly_expenses: '0.00',
            monthly_result: '0.00',
          })
        );
      })
    );
  }

  getAccounts(): Observable<Account[]> {
    return this.http.get<Account[]>(`${this.apiUrl}/accounts`).pipe(
      tap((accounts) => this.offlineDb.cacheAccounts(accounts)),
      catchError(() => from(this.offlineDb.getCachedAccounts()))
    );
  }

  createAccount(data: AccountCreate): Observable<Account> {
    return this.http.post<Account>(`${this.apiUrl}/accounts`, data);
  }

  getCategories(): Observable<Category[]> {
    return this.http.get<Category[]>(`${this.apiUrl}/categories`);
  }

  createCategory(data: CategoryCreate): Observable<Category> {
    return this.http.post<Category>(`${this.apiUrl}/categories`, data);
  }

  getTransactions(accountId?: string, categoryId?: string, limit: number = 50): Observable<Transaction[]> {
    let params = new HttpParams().set('limit', limit.toString());
    if (accountId) params = params.set('account_id', accountId);
    if (categoryId) params = params.set('category_id', categoryId);

    return this.http.get<Transaction[]>(`${this.apiUrl}/transactions`, { params }).pipe(
      tap((txs) => this.offlineDb.cacheTransactions(txs)),
      catchError(() => from(this.offlineDb.getCachedTransactions(limit)))
    );
  }

  createTransaction(data: TransactionCreate): Observable<Transaction[]> {
    return this.http.post<Transaction[]>(`${this.apiUrl}/transactions`, data);
  }

  getBills(accountId: string): Observable<CreditCardBill[]> {
    return this.http.get<CreditCardBill[]>(`${this.apiUrl}/bills/account/${accountId}`);
  }

  payBill(billId: string, paymentAccountId: string): Observable<CreditCardBill> {
    return this.http.post<CreditCardBill>(
      `${this.apiUrl}/bills/${billId}/pay`,
      {},
      { params: { payment_account_id: paymentAccountId } }
    );
  }

  triggerSync(): Observable<any> {
    return this.http.post(`${this.apiUrl}/sync/pluggy`, {});
  }

  getConnectToken(): Observable<{ accessToken: string }> {
    return this.http.post<{ accessToken: string }>(`${this.apiUrl}/sync/connect-token`, {});
  }

  notifyItemConnected(itemId: string): Observable<{ success: boolean; accounts_created: number }> {
    return this.http.post<{ success: boolean; accounts_created: number }>(
      `${this.apiUrl}/sync/item-connected`,
      { itemId }
    );
  }
}
