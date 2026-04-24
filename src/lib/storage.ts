import type { Cadence, Source, SourceEvent, Subscription } from '../types';
import { DEFAULT_CURRENCY } from '../types';

const SUBS_KEY = 'subscriptions';
const SETTINGS_KEY = 'settings';

export interface Settings {
  overlayEnabled: boolean;
  overlayDismissedHosts: string[];
}

const DEFAULT_SETTINGS: Settings = {
  overlayEnabled: true,
  overlayDismissedHosts: [],
};

export interface UpsertInput {
  service: string;
  amount?: number;
  currency?: string;
  cadence?: Cadence;
  nextRenewal?: string;
  source: Source;
}

export async function getSubscriptions(): Promise<Subscription[]> {
  const r = await chrome.storage.local.get(SUBS_KEY);
  return (r[SUBS_KEY] as Subscription[] | undefined) ?? [];
}

export async function saveSubscriptions(subs: Subscription[]): Promise<void> {
  await chrome.storage.local.set({ [SUBS_KEY]: subs });
}

export async function upsertByService(input: UpsertInput): Promise<Subscription> {
  const subs = await getSubscriptions();
  const now = new Date().toISOString();
  const event: SourceEvent = {
    source: input.source,
    at: now,
    snapshot: snapshotOf(input),
  };

  const key = input.service.trim().toLowerCase();
  const existing = subs.find(s => s.service.trim().toLowerCase() === key);

  if (existing) {
    const updated: Subscription = {
      ...existing,
      amount: input.amount ?? existing.amount,
      currency: input.currency ?? existing.currency,
      cadence: input.cadence ?? existing.cadence,
      nextRenewal: input.nextRenewal ?? existing.nextRenewal,
      sources: [...existing.sources, event],
      updatedAt: now,
      lastSeenAt: now,
    };
    await saveSubscriptions(subs.map(s => (s.id === existing.id ? updated : s)));
    return updated;
  }

  const created: Subscription = {
    id: crypto.randomUUID(),
    service: input.service.trim(),
    amount: input.amount ?? 0,
    currency: input.currency ?? DEFAULT_CURRENCY,
    cadence: input.cadence ?? 'unknown',
    nextRenewal: input.nextRenewal,
    sources: [event],
    createdAt: now,
    updatedAt: now,
    lastSeenAt: now,
  };
  await saveSubscriptions([...subs, created]);
  return created;
}

export async function removeSubscription(id: string): Promise<void> {
  const existing = await getSubscriptions();
  await saveSubscriptions(existing.filter(s => s.id !== id));
}

export async function getSettings(): Promise<Settings> {
  const r = await chrome.storage.local.get(SETTINGS_KEY);
  return { ...DEFAULT_SETTINGS, ...((r[SETTINGS_KEY] as Partial<Settings> | undefined) ?? {}) };
}

export async function saveSettings(settings: Settings): Promise<void> {
  await chrome.storage.local.set({ [SETTINGS_KEY]: settings });
}

function snapshotOf(input: UpsertInput): SourceEvent['snapshot'] {
  const snap: NonNullable<SourceEvent['snapshot']> = {};
  if (input.amount !== undefined) snap.amount = input.amount;
  if (input.currency !== undefined) snap.currency = input.currency;
  if (input.cadence !== undefined) snap.cadence = input.cadence;
  if (input.nextRenewal !== undefined) snap.nextRenewal = input.nextRenewal;
  return Object.keys(snap).length ? snap : undefined;
}
