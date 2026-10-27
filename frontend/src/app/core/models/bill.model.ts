export type BillStatus = 'OPEN' | 'CLOSED' | 'PAID';

export interface CreditCardBill {
  id: string;
  account_id: string;
  month: number;
  year: number;
  closing_date: string;
  due_date: string;
  status: BillStatus;
  total_amount: string;
  created_at: string;
}
