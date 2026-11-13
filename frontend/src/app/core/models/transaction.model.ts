import { TransactionAttachment } from './attachment.model';

export type TransactionType = 'INCOME' | 'EXPENSE';

export interface Transaction {
  id: string;
  account_id: string;
  category_id?: string | null;
  bill_id?: string | null;
  description: string;
  original_description?: string | null;
  amount: string;
  transaction_date: string;
  type: TransactionType;
  is_transfer: boolean;
  transfer_target_account_id?: string | null;
  transfer_pair_id?: string | null;
  installment_number?: number | null;
  total_installments?: number | null;
  installment_identifier?: string | null;
  external_id?: string | null;
  fitid?: string | null;
  import_batch_id?: string | null;
  attachments?: TransactionAttachment[];
  created_at: string;
}

export interface TransactionCreate {
  account_id: string;
  category_id?: string | null;
  description: string;
  amount: string;
  transaction_date: string;
  type: TransactionType;
  installments?: number;
  is_transfer?: boolean;
  transfer_target_account_id?: string | null;
  client_tx_id?: string | null;
}

export interface OFXTransactionPreview {
  fitid: string;
  description: string;
  amount: string;
  transaction_date: string;
  type: TransactionType;
  is_duplicate: boolean;
}

export interface OFXPreviewResponse {
  total_found: number;
  new_count: number;
  duplicated_count: number;
  transactions: OFXTransactionPreview[];
}

export interface OFXImportResponse {
  import_batch_id: string;
  total_found: number;
  imported_count: number;
  duplicated_count: number;
  transactions: Transaction[];
}
