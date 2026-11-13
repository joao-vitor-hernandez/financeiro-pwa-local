export interface TransactionAttachment {
  id: string;
  transaction_id: string;
  file_name: string;
  file_size_bytes: number;
  mime_type: string;
  view_url: string;
  created_at: string;
}

export interface AttachmentListResponse {
  attachments: TransactionAttachment[];
  total_count: number;
}
