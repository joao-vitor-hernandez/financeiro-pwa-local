export interface Budget {
  id: string;
  category_id: string;
  category_name: string;
  category_icon?: string | null;
  category_color?: string | null;
  month: number;
  year: number;
  limit_amount: string;
  spent_amount: string;
  remaining_amount: string;
  percentage: string;
  status: 'SAFE' | 'WARNING' | 'EXCEEDED';
  created_at: string;
  updated_at: string;
}

export interface BudgetCreate {
  category_id: string;
  month: number;
  year: number;
  limit_amount: string;
}

export interface BudgetUpdate {
  limit_amount: string;
}

export interface BudgetCopyPreviousMonthRequest {
  source_month: number;
  source_year: number;
  target_month: number;
  target_year: number;
}

export interface BudgetSummaryResponse {
  month: number;
  year: number;
  total_budgeted: string;
  total_spent: string;
  total_remaining: string;
  overall_percentage: string;
  budgets: Budget[];
  warning_count: number;
  exceeded_count: number;
}
