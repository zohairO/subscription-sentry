import type { Cadence, ServiceMatch, Subscription } from '../types';
import {
  getSettings,
  getSubscriptions,
  removeSubscription,
  saveSettings,
  upsertByService,
} from '../lib/storage';
import {
  GmailAuthError,
  getAuthToken,
  isConnected,
  revokeAuthToken,
  scanInbox,
  type ScanProgress,
} from '../lib/gmail-api';

const authStatusEl = document.getElementById('auth-status') as HTMLDivElement;
const connectBtn = document.getElementById('connect-btn') as HTMLButtonElement;
const scanBtn = document.getElementById('scan-btn') as HTMLButtonElement;
const disconnectBtn = document.getElementById('disconnect-btn') as HTMLButtonElement;
const progressEl = document.getElementById('scan-progress') as HTMLDivElement;
const errorEl = document.getElementById('scan-error') as HTMLDivElement;
const matchesEl = document.getElementById('matches') as HTMLDivElement;
const matchesListEl = document.getElementById('matches-list') as HTMLDivElement;
const importBtn = document.getElementById('import-btn') as HTMLButtonElement;
const cancelBtn = document.getElementById('cancel-btn') as HTMLButtonElement;
const subsEl = document.getElementById('subs') as HTMLUListElement;
const overlayToggle = document.getElementById('overlay-enabled') as HTMLInputElement;

interface PendingMatch extends ServiceMatch {
  selected: boolean;
  /** Amount in cents the user has entered or accepted; may differ from match.amount. */
  enteredAmount: number | undefined;
  enteredCurrency: string;
  enteredCadence: Cadence;
}

let pending: PendingMatch[] = [];

// ---------------------------------------------------------------------------
// Auth UI state
// ---------------------------------------------------------------------------

async function refreshAuthState(): Promise<void> {
  const connected = await isConnected();
  if (connected) {
    authStatusEl.textContent = 'Gmail connected.';
    connectBtn.hidden = true;
    scanBtn.hidden = false;
    disconnectBtn.hidden = false;
  } else {
    authStatusEl.textContent = 'Not connected.';
    connectBtn.hidden = false;
    scanBtn.hidden = true;
    disconnectBtn.hidden = true;
  }
}

connectBtn.addEventListener('click', async () => {
  setError('');
  try {
    await getAuthToken(true);
    await refreshAuthState();
  } catch (err) {
    setError(`Connect failed: ${(err as Error).message}`);
  }
});

disconnectBtn.addEventListener('click', async () => {
  setError('');
  await revokeAuthToken();
  await refreshAuthState();
  matchesEl.hidden = true;
  matchesListEl.innerHTML = '';
});

// ---------------------------------------------------------------------------
// Scan
// ---------------------------------------------------------------------------

scanBtn.addEventListener('click', async () => {
  setError('');
  matchesEl.hidden = true;
  matchesListEl.innerHTML = '';
  progressEl.hidden = false;
  progressEl.textContent = 'Starting…';
  scanBtn.disabled = true;

  try {
    const token = await getAuthToken(false);
    const matches = await scanInbox(token, onProgress);

    progressEl.hidden = true;
    if (matches.length === 0) {
      setError('No known subscription services detected in the last year of mail.');
      return;
    }

    pending = matches.map(m => ({
      ...m,
      selected: true,
      enteredAmount: m.amount,
      enteredCurrency: m.currency ?? 'AUD',
      enteredCadence: m.cadence ?? 'monthly',
    }));
    renderMatches();
    matchesEl.hidden = false;
  } catch (err) {
    progressEl.hidden = true;
    if (err instanceof GmailAuthError) {
      setError('Gmail auth expired. Disconnect and reconnect.');
      await refreshAuthState();
    } else {
      setError(`Scan failed: ${(err as Error).message}`);
    }
  } finally {
    scanBtn.disabled = false;
  }
});

function onProgress(p: ScanProgress): void {
  progressEl.textContent = `Scanning ${p.index} / ${p.total} — ${p.service}${p.found ? ' ✓' : ''}`;
}

function renderMatches(): void {
  matchesListEl.innerHTML = pending
    .map((m, i) => {
      const amountDollars = m.enteredAmount !== undefined ? (m.enteredAmount / 100).toFixed(2) : '';
      const placeholder = m.amount === undefined ? 'enter amount' : '';
      return `
        <label class="match" data-idx="${i}">
          <input type="checkbox" data-action="toggle" ${m.selected ? 'checked' : ''} />
          <span class="svc">${escapeHtml(m.service)}</span>
          <input
            type="number"
            step="0.01"
            min="0"
            class="amt-input ${m.amount === undefined ? 'needed' : ''}"
            data-action="amount"
            value="${amountDollars}"
            placeholder="${placeholder}"
          />
          <select data-action="currency">
            ${['AUD', 'USD', 'EUR', 'GBP', 'NZD', 'CAD']
              .map(c => `<option ${c === m.enteredCurrency ? 'selected' : ''}>${c}</option>`)
              .join('')}
          </select>
          <select data-action="cadence">
            ${(['monthly', 'yearly', 'weekly'] as Cadence[])
              .map(c => `<option value="${c}" ${c === m.enteredCadence ? 'selected' : ''}>${c}</option>`)
              .join('')}
          </select>
          <span class="conf ${confidenceBucket(m.confidence)}" title="${escapeHtml(m.raw.subject)}">
            ${Math.round(m.confidence * 100)}%
          </span>
        </label>
      `;
    })
    .join('');

  matchesListEl.querySelectorAll<HTMLLabelElement>('.match').forEach(row => {
    const idx = Number(row.dataset['idx']);
    const item = pending[idx];
    if (!item) return;

    row.querySelector<HTMLInputElement>('input[data-action="toggle"]')?.addEventListener('change', e => {
      item.selected = (e.target as HTMLInputElement).checked;
    });
    row.querySelector<HTMLInputElement>('input[data-action="amount"]')?.addEventListener('input', e => {
      const v = parseFloat((e.target as HTMLInputElement).value);
      item.enteredAmount = Number.isFinite(v) && v >= 0 ? Math.round(v * 100) : undefined;
    });
    row.querySelector<HTMLSelectElement>('select[data-action="currency"]')?.addEventListener('change', e => {
      item.enteredCurrency = (e.target as HTMLSelectElement).value;
    });
    row.querySelector<HTMLSelectElement>('select[data-action="cadence"]')?.addEventListener('change', e => {
      item.enteredCadence = (e.target as HTMLSelectElement).value as Cadence;
    });
  });
}

importBtn.addEventListener('click', async () => {
  const picks = pending.filter(p => p.selected && p.enteredAmount !== undefined && p.enteredAmount >= 0);
  const skipped = pending.filter(p => p.selected && (p.enteredAmount === undefined || p.enteredAmount < 0));

  for (const p of picks) {
    await upsertByService({
      service: p.service,
      amount: p.enteredAmount!,
      currency: p.enteredCurrency,
      cadence: p.enteredCadence,
      source: 'gmail',
    });
  }

  matchesEl.hidden = true;
  matchesListEl.innerHTML = '';
  pending = [];
  await renderSubs();

  const parts: string[] = [];
  parts.push(`Imported ${picks.length}.`);
  if (skipped.length) parts.push(`Skipped ${skipped.length} (no amount entered).`);
  authStatusEl.textContent = parts.join(' ');
});

cancelBtn.addEventListener('click', () => {
  matchesEl.hidden = true;
  matchesListEl.innerHTML = '';
  pending = [];
});

// ---------------------------------------------------------------------------
// Subs list + settings
// ---------------------------------------------------------------------------

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
          <span class="amt">${formatMoney(s.amount, s.currency)}/${cadenceShort(s.cadence)}</span>
          <span class="src">${sourcesLabel(s)}</span>
          <button data-id="${s.id}" aria-label="Delete ${escapeHtml(s.service)}">Delete</button>
        </li>`,
    )
    .join('');
  subsEl.querySelectorAll<HTMLButtonElement>('button[data-id]').forEach(btn => {
    btn.addEventListener('click', async () => {
      await removeSubscription(btn.dataset['id']!);
      renderSubs();
    });
  });
}

overlayToggle.addEventListener('change', async () => {
  const s = await getSettings();
  await saveSettings({ ...s, overlayEnabled: overlayToggle.checked });
});

function sourcesLabel(s: Subscription): string {
  const distinct = Array.from(new Set(s.sources.map(e => e.source)));
  return distinct.join(' · ');
}

function confidenceBucket(conf: number): 'high' | 'medium' | 'low' {
  if (conf >= 0.85) return 'high';
  if (conf >= 0.7) return 'medium';
  return 'low';
}

function cadenceShort(cadence: Subscription['cadence']): string {
  if (cadence === 'yearly') return 'yr';
  if (cadence === 'weekly') return 'wk';
  if (cadence === 'unknown') return '?';
  return 'mo';
}

function formatMoney(cents: number, currency: string): string {
  try {
    return new Intl.NumberFormat('en', { style: 'currency', currency }).format(cents / 100);
  } catch {
    return `${currency} ${(cents / 100).toFixed(2)}`;
  }
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

function setError(msg: string): void {
  if (!msg) {
    errorEl.hidden = true;
    errorEl.textContent = '';
  } else {
    errorEl.hidden = false;
    errorEl.textContent = msg;
  }
}

async function init(): Promise<void> {
  await refreshAuthState();
  const settings = await getSettings();
  overlayToggle.checked = settings.overlayEnabled;
  await renderSubs();
}

init();
