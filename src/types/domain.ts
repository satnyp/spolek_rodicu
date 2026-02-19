export type Role = 'viewer' | 'requester' | 'accountant' | 'admin';
export type RequestState = 'NEW' | 'PAID' | 'HAS_INVOICES' | 'HANDED_TO_ACCOUNTANT';

export interface AllowlistEntry {
  emailLower: string;
  role: Role;
  active: boolean;
  label?: string;
}

export interface MonthSummary {
  monthKey: string;
  label: string;
  counts: Record<string, number>;
}

export interface RequestItem {
  id: string;
  monthKey: string;
  description: string;
  amountCzk: number;
  state: RequestState;
  vs: string;
  editorData?: Record<string, string>;
}
