import type { Cadence } from '../types';

export interface ServicePattern {
  service: string;
  /**
   * Sender domains/addresses used to (a) build the Gmail `from:` query and
   * (b) match parsed metadata. Plain strings; the matcher does substring
   * checks so the canonical domain is enough.
   */
  senders: string[];
  /** Optional regex over subject to confirm a match (filters out noise from the same sender). */
  subjectHints?: RegExp;
  /**
   * If true, this service's receipt subject typically contains the amount,
   * so we should attempt to extract it from the subject directly.
   * Defaults to false; user enters amount manually for these.
   */
  amountInSubject?: boolean;
  defaultCurrency?: string;
  defaultCadence?: Cadence;
}

export const KNOWN_SERVICES: ServicePattern[] = [
  { service: 'Netflix', senders: ['mailer.netflix.com', 'netflix.com'], subjectHints: /billing|payment|receipt|membership/i, defaultCadence: 'monthly' },
  { service: 'Spotify', senders: ['email.spotify.com', 'spotify.com'], subjectHints: /receipt|invoice|premium|subscription/i, amountInSubject: true, defaultCadence: 'monthly' },
  { service: 'Disney+', senders: ['mail.disneyplus.com', 'disneyplus.com'], subjectHints: /receipt|subscription|billing/i },
  { service: 'Apple', senders: ['no_reply@email.apple.com', 'email.apple.com'], subjectHints: /(your )?(tax )?(invoice|receipt) from apple|apple subscription/i, amountInSubject: true },
  { service: 'YouTube Premium', senders: ['youtube.com'], subjectHints: /youtube (premium|music)/i, defaultCadence: 'monthly' },
  { service: 'Google One', senders: ['payments-noreply@google.com'], subjectHints: /google one|google storage|receipt/i, amountInSubject: true, defaultCadence: 'monthly' },
  { service: 'Adobe Creative Cloud', senders: ['mail.adobe.com', 'adobe.com'], subjectHints: /creative cloud|invoice|receipt/i },
  { service: 'Microsoft 365', senders: ['email.microsoft.com', 'microsoft.com'], subjectHints: /microsoft 365|office 365|subscription/i },
  { service: 'Amazon Prime', senders: ['amazon.com', 'amazon.com.au', 'amazon.co.uk'], subjectHints: /prime (membership|renewal)/i, defaultCadence: 'yearly' },
  { service: 'HBO Max', senders: ['mail.hbomax.com', 'max.com'], subjectHints: /subscription|receipt/i },
  { service: 'Hulu', senders: ['hulumail.com', 'hulu.com'], subjectHints: /receipt|billing/i },
  { service: 'Dropbox', senders: ['no-reply@dropbox.com', 'dropbox.com'], subjectHints: /dropbox (plus|family|professional)|receipt/i },
  { service: 'iCloud+', senders: ['no_reply@email.apple.com'], subjectHints: /icloud/i, defaultCadence: 'monthly' },
  { service: 'ChatGPT Plus', senders: ['stripe.com', 'openai.com'], subjectHints: /chatgpt|openai/i, amountInSubject: true, defaultCadence: 'monthly' },
  { service: 'Claude Pro', senders: ['stripe.com', 'anthropic.com'], subjectHints: /claude|anthropic/i, amountInSubject: true, defaultCadence: 'monthly' },
  { service: 'GitHub', senders: ['github.com'], subjectHints: /receipt for github|invoice/i, amountInSubject: true },
  { service: 'Notion', senders: ['notion.so', 'mail.notion.so'], subjectHints: /receipt|invoice|subscription/i, amountInSubject: true },
  { service: 'Linear', senders: ['linear.app'], subjectHints: /invoice|receipt/i, amountInSubject: true },
  { service: 'Figma', senders: ['figma.com'], subjectHints: /invoice|receipt/i, amountInSubject: true },
  { service: 'Audible', senders: ['audible.com'], subjectHints: /membership|receipt/i, defaultCadence: 'monthly' },
  { service: 'The New York Times', senders: ['nytimes.com', 'email.newyorktimes.com'], subjectHints: /subscription|receipt/i },
  { service: 'Stan', senders: ['stan.com.au', 'mail.stan.com.au'], subjectHints: /subscription|receipt/i, defaultCurrency: 'AUD', defaultCadence: 'monthly' },
  { service: 'Binge', senders: ['binge.com.au'], subjectHints: /subscription|receipt/i, defaultCurrency: 'AUD', defaultCadence: 'monthly' },
  { service: 'Kayo Sports', senders: ['kayosports.com.au'], subjectHints: /subscription|receipt/i, defaultCurrency: 'AUD', defaultCadence: 'monthly' },
];

const CURRENCY_PATTERNS: Array<[string, RegExp]> = [
  ['AUD', /(?:A\$|AUD\s?\$?)\s?(\d+(?:\.\d{2})?)/i],
  ['NZD', /(?:NZ\$|NZD\s?\$?)\s?(\d+(?:\.\d{2})?)/i],
  ['CAD', /(?:CA\$|CAD\s?\$?)\s?(\d+(?:\.\d{2})?)/i],
  ['GBP', /£\s?(\d+(?:\.\d{2})?)/],
  ['EUR', /€\s?(\d+(?:\.\d{2})?)/],
  ['USD', /(?:US\$|USD\s?\$?|\$)\s?(\d+(?:\.\d{2})?)/],
];

const CADENCE_PATTERNS: Array<[Cadence, RegExp]> = [
  ['yearly', /\b(?:annual(?:ly)?|yearly|per year|\/year|\/yr)\b/i],
  ['weekly', /\b(?:weekly|per week|\/week|\/wk)\b/i],
  ['monthly', /\b(?:monthly|per month|\/month|\/mo|billed monthly)\b/i],
];

export function extractAmount(text: string, preferred?: string): { amount: number; currency: string } | null {
  const ordered = preferred
    ? [...CURRENCY_PATTERNS].sort(([a], [b]) => (a === preferred ? -1 : b === preferred ? 1 : 0))
    : CURRENCY_PATTERNS;
  for (const [cur, re] of ordered) {
    const m = text.match(re);
    if (m && m[1]) {
      return { amount: Math.round(parseFloat(m[1]) * 100), currency: cur };
    }
  }
  return null;
}

export function extractCadence(text: string): Cadence {
  for (const [cadence, re] of CADENCE_PATTERNS) {
    if (re.test(text)) return cadence;
  }
  return 'unknown';
}

/** True if `from` (the email From header) matches any of the service's sender patterns. */
export function matchesSender(from: string, pattern: ServicePattern): boolean {
  const lc = from.toLowerCase();
  return pattern.senders.some(s => lc.includes(s.toLowerCase()));
}

/** Build the Gmail `from:` query fragment for a service. */
export function gmailFromQuery(pattern: ServicePattern): string {
  if (pattern.senders.length === 0) return '';
  if (pattern.senders.length === 1) return `from:(${pattern.senders[0]})`;
  return `from:(${pattern.senders.join(' OR ')})`;
}
