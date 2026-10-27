import { Routes } from '@angular/router';
import { DashboardComponent } from './features/dashboard/dashboard.component';
import { TransactionsComponent } from './features/transactions/transactions.component';
import { AccountsComponent } from './features/accounts/accounts.component';

export const routes: Routes = [
  {
    path: '',
    component: DashboardComponent,
    title: 'Visão Geral | Financeiro PWA',
  },
  {
    path: 'transactions',
    component: TransactionsComponent,
    title: 'Extrato | Financeiro PWA',
  },
  {
    path: 'accounts',
    component: AccountsComponent,
    title: 'Contas & Cartões | Financeiro PWA',
  },
  {
    path: '**',
    redirectTo: '',
  },
];
