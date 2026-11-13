export interface DashboardSummary {
  total_checking_balance: string;
  total_investments: string;
  current_card_bill: string;
  total_credit_card_debt: string;
  net_worth: string;
  monthly_income: string;
  monthly_expenses: string;
  monthly_result: string;
  safe_to_spend_daily?: string;
  safe_to_spend_status?: 'HEALTHY' | 'CAUTION' | 'CRITICAL';
  safe_to_spend_days_remaining?: number;
}
