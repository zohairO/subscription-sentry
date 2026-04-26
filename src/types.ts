export type Cadence = 'monthly' | 'yearly' | 'weekly' | 'unknown';

export type Source = 'gmail' | 'manual' | 'checkout' | 'history' | 'mbox';

export interface SourceEvent {
  source: Source;
  at: string;
  snapshot?: Partial<Pick<Subscription, 'amount' | 'currency' | 'cadence' | 'nextRenewal'>>;
}

export interface Subscription {
  id: string;
  service: string;
  amount: number;
  currency: string;
  cadence: Cadence;
  nextRenewal?: string;
  sources: SourceEvent[];
  createdAt: string;
  updatedAt: string;
  lastSeenAt?: string;
  notes?: string;
  archived?: boolean;
}

export interface ServiceMatch {
  service: string;
  amount?: number;
  currency?: string;
  cadence?: Cadence;
  date?: string;
  confidence: number;
  raw: {
    from: string;
    subject: string;
  };
}

export interface CheckoutSignal {
  score: number;
  reasons: string[];
}

export const DEFAULT_CURRENCY = 'AUD';
