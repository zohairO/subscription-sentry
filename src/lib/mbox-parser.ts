import type { MboxMatch, RawMessage } from '../types';
import { DEFAULT_CURRENCY } from '../types';
import { KNOWN_SERVICES, extractAmount, extractCadence } from './subscription-matchers';

export function* parseMbox(text: string): Generator<RawMessage> {
  const lines = text.split(/\r?\n/);
  let current: string[] = [];
  for (const line of lines) {
    if (/^From /.test(line) && current.length > 0) {
      yield splitMessage(current.join('\n'));
      current = [];
    } else {
      current.push(line);
    }
  }
  if (current.length) yield splitMessage(current.join('\n'));
}

function splitMessage(block: string): RawMessage {
  const sep = block.indexOf('\n\n');
  if (sep === -1) return { headers: {}, body: block };
  const headers = parseHeaders(block.slice(0, sep));
  const body = decodeBody(block.slice(sep + 2), headers);
  return { headers, body };
}

function parseHeaders(text: string): Record<string, string> {
  const headers: Record<string, string> = {};
  let currentKey = '';
  for (const line of text.split('\n')) {
    if (/^[ \t]/.test(line) && currentKey) {
      headers[currentKey] = (headers[currentKey] ?? '') + ' ' + line.trim();
      continue;
    }
    const idx = line.indexOf(':');
    if (idx === -1) continue;
    currentKey = line.slice(0, idx).trim().toLowerCase();
    headers[currentKey] = line.slice(idx + 1).trim();
  }
  return headers;
}

function decodeBody(body: string, headers: Record<string, string>): string {
  const cte = (headers['content-transfer-encoding'] ?? '').toLowerCase();
  if (cte === 'quoted-printable') {
    return body
      .replace(/=\r?\n/g, '')
      .replace(/=([0-9A-Fa-f]{2})/g, (_, h) => String.fromCharCode(parseInt(h, 16)));
  }
  if (cte === 'base64') {
    try {
      return atob(body.replace(/\s/g, ''));
    } catch {
      return body;
    }
  }
  return body;
}

export function matchMessage(msg: RawMessage): MboxMatch | null {
  const from = msg.headers['from'] ?? '';
  const subject = msg.headers['subject'] ?? '';
  const date = msg.headers['date'];

  for (const pattern of KNOWN_SERVICES) {
    if (!pattern.senderRegex.test(from)) continue;
    if (pattern.subjectHints && !pattern.subjectHints.test(subject) && !pattern.subjectHints.test(msg.body)) continue;

    const haystack = `${subject}\n${msg.body}`;
    const amountInfo = extractAmount(haystack, pattern.defaultCurrency ?? DEFAULT_CURRENCY);
    const cadence = extractCadence(haystack);

    let confidence = 0.6;
    if (amountInfo) confidence += 0.25;
    if (pattern.subjectHints?.test(subject)) confidence += 0.1;
    if (cadence !== 'unknown') confidence += 0.05;

    return {
      service: pattern.service,
      amount: amountInfo?.amount,
      currency: amountInfo?.currency ?? pattern.defaultCurrency ?? DEFAULT_CURRENCY,
      cadence: cadence !== 'unknown' ? cadence : pattern.defaultCadence,
      date,
      confidence: Math.min(confidence, 0.99),
      raw: { from, subject },
    };
  }
  return null;
}

export function matchMessages(messages: Iterable<RawMessage>): MboxMatch[] {
  const matches: MboxMatch[] = [];
  for (const msg of messages) {
    const m = matchMessage(msg);
    if (m) matches.push(m);
  }
  return matches;
}

export function dedupeMatches(matches: MboxMatch[]): MboxMatch[] {
  const byService = new Map<string, MboxMatch>();
  for (const m of matches) {
    const existing = byService.get(m.service);
    if (!existing || m.confidence > existing.confidence) {
      byService.set(m.service, m);
    }
  }
  return Array.from(byService.values()).sort((a, b) => b.confidence - a.confidence);
}
