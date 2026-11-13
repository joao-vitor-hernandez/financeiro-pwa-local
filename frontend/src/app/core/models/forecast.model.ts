export type SafeToSpendStatus = 'HEALTHY' | 'CAUTION' | 'CRITICAL';

export interface SafeToSpendInfo {
  daily_amount: string;
  days_remaining: number;
  disposable_month_amount: string;
  upcoming_bills_amount: string;
  current_checking_balance: string;
  status: SafeToSpendStatus;
  message: string;
}

export interface ForecastDailyPoint {
  date: string;
  label: string;
  day_number: number;
  projected_balance: string;
  inflow: string;
  outflow: string;
  is_negative: boolean;
}

export interface CashFlowForecastResponse {
  start_date: string;
  end_date: string;
  initial_balance: string;
  thirty_days_balance: string;
  end_of_month_balance: string;
  lowest_projected_balance: string;
  has_deficit_risk: boolean;
  deficit_date: string | null;
  points: ForecastDailyPoint[];
  safe_to_spend: SafeToSpendInfo;
}
