import type { Subscription } from '../types';
import { detectCheckout, isCheckout } from '../lib/checkout-detectors';
import { getSettings, getSubscriptions } from '../lib/storage';

const OVERLAY_ID = '__subscription_sentry_overlay__';
const DISMISS_KEY = '__subscription_sentry_dismissed__';

async function main(): Promise<void> {
  if (window.self !== window.top) {
    console.debug('[sentry] skip: iframe');
    return;
  }
  if (location.protocol === 'chrome:' || location.protocol === 'chrome-extension:') {
    console.debug('[sentry] skip: chrome protocol');
    return;
  }
  if (sessionStorage.getItem(DISMISS_KEY)) {
    console.debug('[sentry] skip: dismissed this session');
    return;
  }

  const settings = await getSettings();
  if (!settings.overlayEnabled) {
    console.debug('[sentry] skip: overlay disabled in settings');
    return;
  }

  // SPAs and checkout flows often populate after initial idle. Give it a beat.
  await wait(1200);

  const signal = detectCheckout();
  console.debug('[sentry] checkout signal', signal);
  if (!isCheckout(signal)) {
    console.debug(`[sentry] skip: score ${signal.score} below threshold`);
    return;
  }

  const subs = (await getSubscriptions()).filter(s => !s.archived);
  if (subs.length === 0) {
    console.debug('[sentry] skip: no subs saved yet');
    return;
  }

  console.debug('[sentry] rendering overlay', { subs: subs.length });
  renderOverlay(subs);
}

function renderOverlay(subs: Subscription[]): void {
  if (document.getElementById(OVERLAY_ID)) return;

  const host = document.createElement('div');
  host.id = OVERLAY_ID;
  host.style.cssText =
    'all: initial; position: fixed; top: 20px; right: 20px; z-index: 2147483647;';
  document.documentElement.appendChild(host);

  const shadow = host.attachShadow({ mode: 'closed' });

  const monthlyByCurrency = new Map<string, number>();
  for (const s of subs) {
    const monthlyCents = s.amount * cadenceFactor(s.cadence);
    monthlyByCurrency.set(
      s.currency,
      (monthlyByCurrency.get(s.currency) ?? 0) + monthlyCents,
    );
  }
  const totalStr = Array.from(monthlyByCurrency.entries())
    .map(([cur, cents]) => formatMoney(cents, cur))
    .join(' + ');

  const rowsHtml = subs
    .slice(0, 8)
    .map(
      s => `<li>
        <span class="n">${escapeHtml(s.service)}</span>
        <span class="a">${formatMoney(s.amount, s.currency)}<span class="c">/${cadenceShort(s.cadence)}</span></span>
      </li>`,
    )
    .join('');

  shadow.innerHTML = `
    <style>
      :host { all: initial; }
      .card {
        font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', system-ui, sans-serif;
        width: 320px; background: #fff; color: #0f172a;
        border: 1px solid #e5e7eb; border-radius: 12px;
        box-shadow: 0 10px 32px rgba(0,0,0,.18);
        padding: 16px;
      }
      .hdr { display: flex; align-items: center; justify-content: space-between; margin-bottom: 4px; }
      .lbl { font-size: 12px; font-weight: 600; color: #64748b; text-transform: uppercase; letter-spacing: .04em; }
      .close { cursor: pointer; border: 0; background: transparent; color: #94a3b8; font-size: 18px; line-height: 1; padding: 2px 6px; border-radius: 4px; }
      .close:hover { background: #f1f5f9; color: #0f172a; }
      .total { font-size: 22px; font-weight: 700; margin: 6px 0 12px; }
      ul { list-style: none; padding: 0; margin: 0 0 10px; max-height: 200px; overflow: auto; }
      li { display: flex; justify-content: space-between; align-items: baseline; gap: 12px; padding: 6px 0; font-size: 13px; border-bottom: 1px solid #f1f5f9; }
      li:last-child { border-bottom: 0; }
      .n { font-weight: 500; }
      .a { color: #334155; white-space: nowrap; }
      .c { color: #94a3b8; font-size: 11px; }
      .more { font-size: 12px; color: #64748b; margin-bottom: 10px; }
      .note { font-size: 11px; color: #94a3b8; line-height: 1.5; margin-top: 8px; }
      .brand { font-size: 10px; color: #cbd5e1; letter-spacing: .05em; text-transform: uppercase; margin-top: 8px; text-align: right; }
    </style>
    <div class="card" role="dialog" aria-label="Subscription reminder">
      <div class="hdr">
        <span class="lbl">You already spend</span>
        <button class="close" aria-label="Dismiss">×</button>
      </div>
      <div class="total">${escapeHtml(totalStr)}/mo</div>
      <ul>${rowsHtml}</ul>
      ${subs.length > 8 ? `<div class="more">+ ${subs.length - 8} more</div>` : ''}
      <div class="note">Do you really need another one?</div>
      <div class="brand">Subscription Sentry</div>
    </div>
  `;

  shadow.querySelector<HTMLButtonElement>('.close')?.addEventListener('click', () => {
    sessionStorage.setItem(DISMISS_KEY, '1');
    host.remove();
  });
}

function cadenceFactor(cadence: Subscription['cadence']): number {
  if (cadence === 'yearly') return 1 / 12;
  if (cadence === 'weekly') return 4.345;
  return 1; // monthly, unknown → treat as monthly for the total estimate
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

function wait(ms: number): Promise<void> {
  return new Promise(r => setTimeout(r, ms));
}

main().catch(() => {
  // Fail silent — the overlay is nice-to-have; never break the host page.
});
