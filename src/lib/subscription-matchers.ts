import type { Cadence } from '../types';

export interface ServicePattern {
  service: string;
  senderRegex: RegExp;
  subjectHints?: RegExp;
  defaultCurrency?: string;
  defaultCadence?: Cadence;
}

export const KNOWN_SERVICES: ServicePattern[] = [
  { service: 'Netflix', senderRegex: /@(mailer\.netflix\.com|netflix\.com)/i, subjectHints: /billing|payment|receipt|membership/i, defaultCadence: 'monthly' },
  { service: 'Spotify', senderRegex: /@(spotify\.com|email\.spotify\.com)/i, subjectHints: /receipt|invoice|premium|subscription/i, defaultCadence: 'monthly' },
  { service: 'Disney+', senderRegex: /@(mail\.disneyplus\.com|disneyplus\.com)/i, subjectHints: /receipt|subscription|billing/i },
  { service: 'Apple', senderRegex: /no_reply@email\.apple\.com/i, subjectHints: /(your )?receipt from apple|subscription/i },
  { service: 'YouTube Premium', senderRegex: /@(youtube\.com|google\.com)/i, subjectHints: /youtube (premium|music)/i, defaultCadence: 'monthly' },
  { service: 'Google One', senderRegex: /payments-noreply@google\.com/i, subjectHints: /google one|google storage|receipt/i, defaultCadence: 'monthly' },
  { service: 'Adobe Creative Cloud', senderRegex: /@(adobe\.com|mail\.adobe\.com)/i, subjectHints: /creative cloud|invoice|receipt/i },
  { service: 'Microsoft 365', senderRegex: /@(microsoft\.com|email\.microsoft\.com)/i, subjectHints: /microsoft 365|office 365|subscription/i },
  { service: 'Amazon Prime', senderRegex: /@(amazon\.com|amazon\.com\.au|amazon\.co\.uk)/i, subjectHints: /prime (membership|renewal)/i, defaultCadence: 'yearly' },
  { service: 'HBO Max', senderRegex: /@(mail\.hbomax\.com|max\.com)/i, subjectHints: /subscription|receipt/i },
  { service: 'Hulu', senderRegex: /@(hulumail\.com|hulu\.com)/i, subjectHints: /receipt|billing/i },
  { service: 'Dropbox', senderRegex: /no-reply@dropbox\.com/i, subjectHints: /dropbox (plus|family|professional)|receipt/i },
  { service: 'iCloud+', senderRegex: /no_reply@email\.apple\.com/i, subjectHints: /icloud/i, defaultCadence: 'monthly' },
  { service: 'ChatGPT Plus', senderRegex: /@(stripe|openai)\.com/i, subjectHints: /chatgpt|openai/i, defaultCadence: 'monthly' },
  { service: 'Claude Pro', senderRegex: /@(stripe|anthropic)\.com/i, subjectHints: /claude|anthropic/i, defaultCadence: 'monthly' },
  { service: 'GitHub', senderRegex: /@github\.com/i, subjectHints: /receipt for github|invoice/i },
  { service: 'Notion', senderRegex: /@(notion\.so|mail\.notion\.so)/i, subjectHints: /receipt|invoice|subscription/i },
  { service: 'Linear', senderRegex: /@linear\.app/i, subjectHints: /invoice|receipt/i },
  { service: 'Figma', senderRegex: /@figma\.com/i, subjectHints: /invoice|receipt/i },
  { service: 'Audible', senderRegex: /@audible\.com/i, subjectHints: /membership|receipt/i, defaultCadence: 'monthly' },
  { service: 'The New York Times', senderRegex: /@(nytimes\.com|email\.newyorktimes\.com)/i, subjectHints: /subscription|receipt/i },
  { service: 'Stan', senderRegex: /@(stan\.com\.au|mail\.stan\.com\.au)/i, subjectHints: /subscription|receipt/i, defaultCurrency: 'AUD', defaultCadence: 'monthly' },
  { service: 'Binge', senderRegex: /@binge\.com\.au/i, subjectHints: /subscription|receipt/i, defaultCurrency: 'AUD', defaultCadence: 'monthly' },
  { service: 'Kayo Sports', senderRegex: /@kayosports\.com\.au/i, subjectHints: /subscription|receipt/i, defaultCurrency: 'AUD', defaultCadence: 'monthly' },
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
