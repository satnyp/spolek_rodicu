export type Role = 'viewer' | 'requester' | 'accountant' | 'admin';
export type RequestState = 'NEW' | 'PAID' | 'HAS_INVOICES' | 'HANDED_TO_ACCOUNTANT';
export type QueueStatus = 'QUEUED' | 'APPROVED' | 'REJECTED';

export interface AllowlistEntry {
  emailLower: string;
  role: Role;
  active: boolean;
  label?: string;
}

export interface MonthSummary {
  monthKey: string;
  label: string;
  counts: Record<RequestState | 'total', number>;
}

export interface Attachment {
  storagePath: string;
  filename: string;
  mime: string;
  sizeBytes: number;
  uploadedByEmail: string;
  kind: 'invoice' | 'other';
}

export interface RequestRecord {
  id: string;
  monthKey: string;
  description: string;
  amountCzk: number;
  vs: string;
  state: RequestState;
  editorData?: Record<string, string>;
  attachments?: Attachment[];
}
