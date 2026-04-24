import type { MboxMatch, Subscription } from '../types';
import {
  getSettings,
  getSubscriptions,
  removeSubscription,
  saveSettings,
  upsertByService,
} from '../lib/storage';
import { dedupeMatches, matchMessages, parseMbox } from '../lib/mbox-parser';

const fileInput = document.getElementById('mbox-file') as HTMLInputElement;
const statusEl = document.getElementById('mbox-status') as HTMLDivElement;
const matchesEl = document.getElementById('mbox-matches') as HTMLDivElement;
const actionsEl = document.getElementById('mbox-actions') as HTMLDivElement;
const importBtn = document.getElementById('import-matches') as HTMLButtonElement;
const cancelBtn = document.getElementById('import-cancel') as HTMLButtonElement;
const subsEl = document.getElementById('subs') as HTMLUListElement;
const overlayToggle = document.getElementById('overlay-enabled') as HTMLInputElement;

let pendingMatches: MboxMatch[] = [];

fileInput.addEventListener('change', async () => {
  const file = fileInput.files?.[0];
  if (!file) return;

  resetPreview();
  statusEl.textContent = `Reading ${file.name} (${formatSize(file.size)})…`;

  try {
    const text = await file.text();
    statusEl.textContent = `Parsing ${formatSize(text.length)}…`;
    const raw = Array.from(parseMbox(text));
    statusEl.textContent = `Parsed ${raw.length.toLocaleString()} messages. Matching…`;

    const matches = dedupeMatches(matchMessages(raw));
    pendingMatches = matches;

    if (matches.length === 0) {
      statusEl.textContent = `Scanned ${raw.length.toLocaleString()} messages. Found no known subscription services. Add manually from the popup.`;
      return;
    }

    statusEl.textContent = `Found ${matches.length} candidate ${matches.length === 1 ? 'subscription' : 'subscriptions'}:`;
    matchesEl.innerHTML = matches
      .map(
        (m, i) => `
          <label class="match">
            <input type="checkbox" data-idx="${i}" checked />
            <span class="svc">${escapeHtml(m.service)}</span>
            <span class="amt">${m.amount !== undefined ? formatMoney(m.amount, m.currency ?? 'AUD') : '—'}</span>
            <span class="cad">${escapeHtml(m.cadence ?? 'unknown')}</span>
            <span class="conf ${confidenceBucket(m.confidence)}">${Math.round(m.confidence * 100)}%</span>
            <span class="subj" title="${escapeHtml(m.raw.subject)}">${escapeHtml(m.raw.subject)}</span>
          </label>`,
      )
      .join('');
    actionsEl.hidden = false;
  } catch (err) {
    statusEl.textContent = `Error reading file: ${(err as Error).message}`;
  }
});

importBtn.addEventListener('click', async () => {
  const picked = Array.from(
    matchesEl.querySelectorAll<HTMLInputElement>('input[type="checkbox"]:checked'),
  ).map(i => pendingMatches[Number(i.dataset['idx'])])
    .filter((m): m is MboxMatch => m !== undefined);

  if (picked.length === 0) {
    statusEl.textContent = 'Nothing selected.';
    return;
  }

  for (const m of picked) {
    await upsertByService({
      service: m.service,
      amount: m.amount,
      currency: m.currency,
      cadence: m.cadence,
      source: 'mbox',
    });
  }

  statusEl.textContent = `Imported ${picked.length} ${picked.length === 1 ? 'subscription' : 'subscriptions'}.`;
  resetPreview();
  renderSubs();
});

cancelBtn.addEventListener('click', resetPreview);

overlayToggle.addEventListener('change', async () => {
  const s = await getSettings();
  await saveSettings({ ...s, overlayEnabled: overlayToggle.checked });
});

function resetPreview(): void {
  pendingMatches = [];
  matchesEl.innerHTML = '';
  actionsEl.hidden = true;
  fileInput.value = '';
}

async function renderSubs(): Promise<void> {
  const subs = await getSubscriptions();
  if (subs.length === 0) {
    subsEl.innerHTML = '<li class="empty">No subscriptions yet.</li>';
    return;
  }
  subsEl.innerHTML = subs
    .map(
      s => `
        <li>
          <span class="svc">${escapeHtml(s.service)}</span>
          <span class="amt">${formatMoney(s.amount, s.currency)}/${s.cadence === 'unknown' ? '?' : cadenceShort(s.cadence)}</span>
          <span class="src">${sourcesLabel(s)}</span>
          <button data-id="${s.id}" aria-label="Delete ${escapeHtml(s.service)}">Delete</button>
        </li>`,
    )
    .join('');
  subsEl.querySelectorAll<HTMLButtonElement>('button').forEach(btn => {
    btn.addEventListener('click', async () => {
      await removeSubscription(btn.dataset['id']!);
      renderSubs();
    });
  });
}

function sourcesLabel(s: Subscription): string {
  const distinct = Array.from(new Set(s.sources.map(e => e.source)));
  return distinct.join(' · ');
}

function confidenceBucket(conf: number): 'high' | 'medium' | 'low' {
  if (conf >= 0.8) return 'high';
  if (conf >= 0.6) return 'medium';
  return 'low';
}

function cadenceShort(cadence: Subscription['cadence']): string {
  if (cadence === 'yearly') return 'yr';
  if (cadence === 'weekly') return 'wk';
  return 'mo';
}

function formatMoney(cents: number, currency: string): string {
  try {
    return new Intl.NumberFormat('en', { style: 'currency', currency }).format(cents / 100);
  } catch {
    return `${currency} ${(cents / 100).toFixed(2)}`;
  }
}

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

function escapeHtml(s: string): string {
  const map: Record<string, string> = {
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;',
  };
  return s.replace(/[&<>"']/g, c => map[c] ?? c);
}

async function init(): Promise<void> {
  const settings = await getSettings();
  overlayToggle.checked = settings.overlayEnabled;
  renderSubs();
}

init();
