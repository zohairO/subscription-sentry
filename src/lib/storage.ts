import type { Subscription } from '../types';

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

export async function getSubscriptions(): Promise<Subscription[]> {
  const r = await chrome.storage.local.get(SUBS_KEY);
  return (r[SUBS_KEY] as Subscription[] | undefined) ?? [];
}

export async function saveSubscriptions(subs: Subscription[]): Promise<void> {
  await chrome.storage.local.set({ [SUBS_KEY]: subs });
}

export async function addSubscription(sub: Subscription): Promise<void> {
  const existing = await getSubscriptions();
  await saveSubscriptions([...existing, sub]);
}

export async function updateSubscription(id: string, patch: Partial<Subscription>): Promise<void> {
  const existing = await getSubscriptions();
  const next = existing.map(s =>
    s.id === id ? { ...s, ...patch, updatedAt: new Date().toISOString() } : s,
  );
  await saveSubscriptions(next);
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
