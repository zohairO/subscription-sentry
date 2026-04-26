import type { ServiceMatch } from '../types';
import { DEFAULT_CURRENCY } from '../types';
import {
  KNOWN_SERVICES,
  extractAmount,
  extractCadence,
  gmailFromQuery,
  matchesSender,
  type ServicePattern,
} from './subscription-matchers';

const GMAIL_BASE = 'https://gmail.googleapis.com/gmail/v1';
export const GMAIL_METADATA_SCOPE = 'https://www.googleapis.com/auth/gmail.metadata';

/** A single Gmail message reduced to the headers we care about. */
interface GmailMetadata {
  id: string;
  internalDate: string;
  headers: Record<string, string>;
}

/** Public progress callback for scan UIs. */
export interface ScanProgress {
  index: number;
  total: number;
  service: string;
  found: boolean;
}

// ---------------------------------------------------------------------------
// Auth
// ---------------------------------------------------------------------------

/**
 * Get an OAuth access token for Gmail API. `interactive: true` shows the
 * Google consent / account-picker; `false` returns a cached token if any.
 */
export function getAuthToken(interactive: boolean): Promise<string> {
  return new Promise((resolve, reject) => {
    chrome.identity.getAuthToken({ interactive }, token => {
      const err = chrome.runtime.lastError;
      if (err || !token) {
        reject(new Error(err?.message ?? 'Failed to obtain Gmail access token.'));
        return;
      }
      resolve(token as unknown as string);
    });
  });
}

/**
 * Revoke the cached OAuth token both in Chrome's identity cache and at
 * Google's revoke endpoint, so a future `interactive: true` call shows
 * the consent screen again.
 */
export async function revokeAuthToken(): Promise<void> {
  let token: string | null = null;
  try {
    token = await getAuthToken(false);
  } catch {
    return;
  }

  await new Promise<void>(resolve => {
    chrome.identity.removeCachedAuthToken({ token: token! }, () => resolve());
  });

  try {
    await fetch(`https://oauth2.googleapis.com/revoke?token=${encodeURIComponent(token)}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    });
  } catch {
    // Best-effort. If the network call fails, the local cache is already cleared.
  }
}

export async function isConnected(): Promise<boolean> {
  try {
    await getAuthToken(false);
    return true;
  } catch {
    return false;
  }
}

// ---------------------------------------------------------------------------
// Gmail API calls
// ---------------------------------------------------------------------------

async function gmailFetch<T>(token: string, path: string): Promise<T> {
  const r = await fetch(`${GMAIL_BASE}${path}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (r.status === 401) {
    throw new GmailAuthError('Gmail token rejected (401). Reconnect required.');
  }
  if (!r.ok) {
    const text = await r.text().catch(() => '');
    throw new Error(`Gmail API ${r.status}: ${text.slice(0, 200)}`);
  }
  return (await r.json()) as T;
}

export class GmailAuthError extends Error {
  constructor(msg: string) {
    super(msg);
    this.name = 'GmailAuthError';
  }
}

interface ListMessagesResponse {
  messages?: Array<{ id: string; threadId: string }>;
  resultSizeEstimate?: number;
}

interface GetMessageResponse {
  id: string;
  internalDate: string;
  payload: {
    headers: Array<{ name: string; value: string }>;
  };
}

async function listMessages(token: string, query: string, maxResults: number): Promise<string[]> {
  const path = `/users/me/messages?q=${encodeURIComponent(query)}&maxResults=${maxResults}`;
  const data = await gmailFetch<ListMessagesResponse>(token, path);
  return (data.messages ?? []).map(m => m.id);
}

async function getMessageMetadata(token: string, id: string): Promise<GmailMetadata> {
  const headersWanted = ['From', 'Subject', 'Date'].map(h => `metadataHeaders=${h}`).join('&');
  const path = `/users/me/messages/${id}?format=metadata&${headersWanted}`;
  const data = await gmailFetch<GetMessageResponse>(token, path);

  const headers: Record<string, string> = {};
  for (const h of data.payload.headers ?? []) {
    headers[h.name.toLowerCase()] = h.value;
  }
  return { id: data.id, internalDate: data.internalDate, headers };
}

// ---------------------------------------------------------------------------
// Scan
// ---------------------------------------------------------------------------

/**
 * Scan the user's inbox for the most recent receipt from each known
 * subscription service. Returns one ServiceMatch per detected service.
 *
 * Strategy: per service, query `from:(...) newer_than:1y` with maxResults=1.
 * If a message exists, fetch its metadata, confirm via subjectHints, and
 * derive amount/cadence from the subject if possible.
 */
export async function scanInbox(
  token: string,
  onProgress?: (p: ScanProgress) => void,
): Promise<ServiceMatch[]> {
  const results: ServiceMatch[] = [];
  const services = KNOWN_SERVICES;

  for (let i = 0; i < services.length; i++) {
    const pattern = services[i]!;
    let found = false;
    try {
      const match = await scanService(token, pattern);
      if (match) {
        results.push(match);
        found = true;
      }
    } catch (err) {
      if (err instanceof GmailAuthError) throw err;
      // Per-service failure: log and continue.
      console.warn(`[gmail] scan ${pattern.service}:`, err);
    }
    onProgress?.({ index: i + 1, total: services.length, service: pattern.service, found });
  }

  return results;
}

async function scanService(token: string, pattern: ServicePattern): Promise<ServiceMatch | null> {
  const fromQ = gmailFromQuery(pattern);
  if (!fromQ) return null;
  const query = `${fromQ} newer_than:1y`;

  const ids = await listMessages(token, query, 1);
  if (ids.length === 0) return null;
  const messageId = ids[0]!;

  const meta = await getMessageMetadata(token, messageId);
  const from = meta.headers['from'] ?? '';
  const subject = meta.headers['subject'] ?? '';

  if (!matchesSender(from, pattern)) return null;
  if (pattern.subjectHints && !pattern.subjectHints.test(subject)) return null;

  let amount: number | undefined;
  let currency: string | undefined;
  if (pattern.amountInSubject) {
    const extracted = extractAmount(subject, pattern.defaultCurrency ?? DEFAULT_CURRENCY);
    if (extracted) {
      amount = extracted.amount;
      currency = extracted.currency;
    }
  }

  const cadence =
    extractCadence(subject) !== 'unknown' ? extractCadence(subject) : pattern.defaultCadence;

  let confidence = 0.7;
  if (matchesSender(from, pattern)) confidence += 0.05;
  if (pattern.subjectHints?.test(subject)) confidence += 0.1;
  if (amount !== undefined) confidence += 0.1;

  return {
    service: pattern.service,
    amount,
    currency: currency ?? pattern.defaultCurrency ?? DEFAULT_CURRENCY,
    cadence,
    date: new Date(parseInt(meta.internalDate, 10)).toISOString(),
    confidence: Math.min(confidence, 0.99),
    raw: { from, subject },
  };
}
