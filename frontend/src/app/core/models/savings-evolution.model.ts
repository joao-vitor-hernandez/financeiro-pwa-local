export interface SavingsPoint {
  date: string; // ex: "2026-05"
  label: string; // ex: "Mai"
  checking: number | string; // Dinheiro na conta parado
  savings: number | string; // Cofrinhos (Mercado Pago, caixinhas)
  investment: number | string; // Investido
  total: number | string; // Total acumulado
}

export interface SavingsEvolutionResponse {
  current_total: number | string;
  current_checking: number | string;
  current_savings: number | string;
  current_investment: number | string;
  period_growth_amount: number | string;
  period_growth_percentage: number;
  period: string;
  points: SavingsPoint[];
}
