import { inject, Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { catchError, from, map, Observable, of, tap } from 'rxjs';
import { environment } from '../../../environments/environment';
import { Account, AccountCreate } from '../models/account.model';
import { Category, CategoryCreate } from '../models/category.model';
import { Transaction, TransactionCreate } from '../models/transaction.model';
import { CreditCardBill } from '../models/bill.model';
import { DashboardSummary } from '../models/summary.model';
import { CardExpensesResponse } from '../models/card-expenses.model';
import { SavingsEvolutionResponse } from '../models/savings-evolution.model';
import {
  Budget,
  BudgetCopyPreviousMonthRequest,
  BudgetCreate,
  BudgetSummaryResponse,
  BudgetUpdate,
} from '../models/budget.model';
import {
  FinancialGoal,
  FinancialGoalCreate,
  FinancialGoalSummaryResponse,
  FinancialGoalUpdate,
  GoalContributionCreate,
} from '../models/goal.model';
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

  getCardExpenses(refDate?: string): Observable<CardExpensesResponse> {
    let params = new HttpParams();
    if (refDate) params = params.set('ref_date', refDate);
    return this.http.get<CardExpensesResponse>(`${this.apiUrl}/dashboard/card-expenses`, { params });
  }

  getSavingsEvolution(months: number = 6, refDate?: string): Observable<SavingsEvolutionResponse> {
    let params = new HttpParams().set('months', months.toString());
    if (refDate) params = params.set('ref_date', refDate);
    return this.http.get<SavingsEvolutionResponse>(`${this.apiUrl}/dashboard/savings-evolution`, { params });
  }

  // --- Orçamentos Mensais (Budgeting - Fase 7.1) ---

  getBudgets(month?: number, year?: number): Observable<BudgetSummaryResponse> {
    let params = new HttpParams();
    if (month) params = params.set('month', month.toString());
    if (year) params = params.set('year', year.toString());
    return this.http.get<BudgetSummaryResponse>(`${this.apiUrl}/budgets`, { params });
  }

  createBudget(data: BudgetCreate): Observable<Budget> {
    return this.http.post<Budget>(`${this.apiUrl}/budgets`, data);
  }

  updateBudget(budgetId: string, data: BudgetUpdate): Observable<Budget> {
    return this.http.patch<Budget>(`${this.apiUrl}/budgets/${budgetId}`, data);
  }

  deleteBudget(budgetId: string): Observable<void> {
    return this.http.delete<void>(`${this.apiUrl}/budgets/${budgetId}`);
  }

  copyPreviousMonthBudgets(data: BudgetCopyPreviousMonthRequest): Observable<BudgetSummaryResponse> {
    return this.http.post<BudgetSummaryResponse>(`${this.apiUrl}/budgets/copy-previous-month`, data);
  }

  // --- Metas Financeiras & Objetivos (Fase 7.2) ---

  getGoals(): Observable<FinancialGoalSummaryResponse> {
    return this.http.get<FinancialGoalSummaryResponse>(`${this.apiUrl}/goals`);
  }

  createGoal(data: FinancialGoalCreate): Observable<FinancialGoal> {
    return this.http.post<FinancialGoal>(`${this.apiUrl}/goals`, data);
  }

  getGoal(id: string): Observable<FinancialGoal> {
    return this.http.get<FinancialGoal>(`${this.apiUrl}/goals/${id}`);
  }

  updateGoal(id: string, data: FinancialGoalUpdate): Observable<FinancialGoal> {
    return this.http.patch<FinancialGoal>(`${this.apiUrl}/goals/${id}`, data);
  }

  contributeToGoal(id: string, data: GoalContributionCreate): Observable<FinancialGoal> {
    return this.http.post<FinancialGoal>(`${this.apiUrl}/goals/${id}/contribute`, data);
  }

  addGoalContribution(id: string, data: GoalContributionCreate): Observable<FinancialGoal> {
    return this.contributeToGoal(id, data);
  }

  deleteGoal(id: string): Observable<void> {
    return this.http.delete<void>(`${this.apiUrl}/goals/${id}`);
  }
}
