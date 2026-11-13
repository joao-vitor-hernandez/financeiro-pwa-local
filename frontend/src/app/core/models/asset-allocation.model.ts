export type AssetClassType = 'CHECKING' | 'SAVINGS' | 'INVESTMENT';
export type RebalanceStatus = 'BALANCED' | 'UNDERWEIGHT' | 'OVERWEIGHT';

export interface AssetAllocationTargetUpdate {
  checking_target_pct: number;
  savings_target_pct: number;
  investment_target_pct: number;
  cdi_annual_rate: number;
}

export interface AssetAllocationTarget {
  checking_target_pct: number;
  savings_target_pct: number;
  investment_target_pct: number;
  cdi_annual_rate: number;
  updated_at?: string | null;
}

export interface AssetClassBreakdown {
  asset_class: AssetClassType;
  label: string;
  current_amount: number;
  current_pct: number;
  target_pct: number;
  target_amount: number;
  rebalance_diff: number;
  status: RebalanceStatus;
}

export interface CDIBenchmarkSummary {
  annual_rate_pct: number;
  monthly_rate_pct: number;
  daily_rate_pct: number;
  savings_balance: number;
  daily_estimated_yield: number;
  monthly_estimated_yield: number;
  annual_estimated_yield: number;
  poupanca_annual_yield: number;
  extra_vs_poupanca_annual: number;
  inflation_ipca_projected: number;
  real_annual_yield_pct: number;
}

export interface AssetAllocationSummary {
  total_patrimony: number;
  classes: AssetClassBreakdown[];
  targets: AssetAllocationTarget;
  cdi_benchmark: CDIBenchmarkSummary;
}
