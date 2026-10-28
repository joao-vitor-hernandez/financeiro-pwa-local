export interface CategoryExpenseSegment {
  label: string;
  value: number | string;
  percentage: number;
  color: string;
  count: number;
}

export interface CardExpensesResponse {
  total_value: number | string;
  period: string;
  segments: CategoryExpenseSegment[];
}
