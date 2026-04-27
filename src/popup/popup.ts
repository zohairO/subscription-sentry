import type { Cadence, Subscription } from '../types';
import { getSubscriptions, removeSubscription, upsertByService } from '../lib/storage';

const listEl = document.getElementById('list') as HTMLUListElement;
const totalEl = document.getElementById('total') as HTMLDivElement;
const addBtn = document.getElementById('add') as HTMLButtonElement;
const optionsBtn = document.getElementById('open-options') as HTMLButtonElement;

const form = document.getElementById('add-form') as HTMLElement;
const serviceInput = document.getElementById('f-service') as HTMLInputElement;
const amountInput = document.getElementById('f-amount') as HTMLInputElement;
const currencySelect = document.getElementById('f-currency') as HTMLSelectElement;
const cadenceSelect = document.getElementById('f-cadence') as HTMLSelectElement;
const saveBtn = document.getElementById('f-save') as HTMLButtonElement;
const cancelBtn = document.getElementById('f-cancel') as HTMLButtonElement;
const errorEl = document.getElementById('f-error') as HTMLDivElement;

async function render(): Promise<void> {
  const subs = await getSubscriptions();

  if (subs.length === 0) {
    totalEl.textContent = '—';
    listEl.innerHTML =
      '<li class="empty">No subscriptions yet. Import from settings or add one manually.</li>';
    return;
  }

  const byCurrency = new Map<string, number>();
  for (const s of subs) {
    const monthly = s.amount * cadenceFactor(s.cadence);
    byCurrency.set(s.currency, (byCurrency.get(s.currency) ?? 0) + monthly);
  }
  totalEl.textContent =
    Array.from(byCurrency.entries())
      .map(([cur, cents]) => formatMoney(cents, cur))
      .join(' + ') + '/mo';

  listEl.innerHTML = subs
    .map(
      s => `
        <li>
          <div class="meta">
            <span class="name">${escapeHtml(s.service)}</span>
            <span class="amt">${formatMoney(s.amount, s.currency)}<span class="cyc">/${cadenceShort(s.cadence)}</span></span>
          </div>
          <button class="del" data-id="${s.id}" aria-label="Remove ${escapeHtml(s.service)}">✕</button>
        </li>`,
    )
    .join('');

  listEl.querySelectorAll<HTMLButtonElement>('.del').forEach(btn => {
    btn.addEventListener('click', async () => {
      await removeSubscription(btn.dataset['id']!);
      render();
    });
  });
}

function openForm(): void {
  errorEl.hidden = true;
  form.hidden = false;
  addBtn.hidden = true;
  serviceInput.value = '';
  amountInput.value = '';
  currencySelect.value = 'AUD';
  cadenceSelect.value = 'monthly';
  serviceInput.focus();
}

function closeForm(): void {
  form.hidden = true;
  addBtn.hidden = false;
  errorEl.hidden = true;
}

async function saveForm(): Promise<void> {
  const service = serviceInput.value.trim();
  const amountFloat = parseFloat(amountInput.value);

  if (!service) {
    showError('Service name is required.');
    return;
  }
  if (!Number.isFinite(amountFloat) || amountFloat < 0) {
    showError('Amount must be a non-negative number.');
    return;
  }

  await upsertByService({
    service,
    amount: Math.round(amountFloat * 100),
    currency: currencySelect.value,
    cadence: cadenceSelect.value as Cadence,
    source: 'manual',
  });

  closeForm();
  render();
}

function showError(msg: string): void {
  errorEl.textContent = msg;
  errorEl.hidden = false;
}

addBtn.addEventListener('click', openForm);
cancelBtn.addEventListener('click', closeForm);
saveBtn.addEventListener('click', saveForm);
optionsBtn.addEventListener('click', () => chrome.runtime.openOptionsPage());

serviceInput.addEventListener('keydown', e => {
  if (e.key === 'Enter') amountInput.focus();
  if (e.key === 'Escape') closeForm();
});
amountInput.addEventListener('keydown', e => {
  if (e.key === 'Enter') saveForm();
  if (e.key === 'Escape') closeForm();
});

function cadenceFactor(cadence: Subscription['cadence']): number {
  if (cadence === 'yearly') return 1 / 12;
  if (cadence === 'weekly') return 4.345;
  return 1;
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

render();
