export type AccountType = 'CHECKING' | 'CREDIT_CARD' | 'INVESTMENT' | 'CASH' | 'SAVINGS';

export interface Account {
  id: string;
  name: string;
  type: AccountType;
  balance: string; // Serializado como string decimal do backend para manter precisão
  currency: string;
  closing_day?: number | null;
  due_day?: number | null;
  credit_limit?: string | null;
  is_active: boolean;
  pluggy_account_id?: string | null;
  created_at: string;
  updated_at: string;
}

export interface AccountCreate {
  name: string;
  type: AccountType;
  initial_balance: string;
  currency?: string;
  closing_day?: number | null;
  due_day?: number | null;
  credit_limit?: string | null;
}
