import type { CheckoutSignal } from '../types';

const URL_PATTERNS: Array<[RegExp, string, number]> = [
  [/\/checkout(?:\/|\?|$)/i, 'url: /checkout', 3],
  [/\/cart(?:\/|\?|$)/i, 'url: /cart', 2],
  [/\/subscribe(?:\/|\?|$)/i, 'url: /subscribe', 3],
  [/\/billing(?:\/|\?|$)/i, 'url: /billing', 2],
  [/\/payment(?:\/|\?|$)/i, 'url: /payment', 3],
  [/\/upgrade(?:\/|\?|$)/i, 'url: /upgrade', 2],
  [/\/plan[s]?\/(?:select|choose)/i, 'url: /plans/select', 2],
  [/\/order\/.*(?:pay|checkout)/i, 'url: /order/pay', 3],
];

const KEYWORD_PATTERNS: Array<[RegExp, string]> = [
  [/start (?:free )?trial/i, 'keyword: start trial'],
  [/subscribe now/i, 'keyword: subscribe now'],
  [/billed (?:monthly|annually|yearly)/i, 'keyword: billed monthly/annually'],
  [/per month|\/month\b|\/mo\b/i, 'keyword: per month'],
  [/per year|\/year\b|\/yr\b/i, 'keyword: per year'],
  [/order summary/i, 'keyword: order summary'],
  [/payment method/i, 'keyword: payment method'],
];

const CARD_INPUT_SELECTORS: Array<[string, string]> = [
  ['input[autocomplete*="cc-number" i]', 'field: autocomplete=cc-number'],
  ['input[name*="cardnumber" i]', 'field: name=cardnumber'],
  ['input[name*="card-number" i]', 'field: name=card-number'],
  ['input[id*="card-number" i]', 'field: id=card-number'],
  ['input[placeholder*="card number" i]', 'field: placeholder=card number'],
];

const IFRAME_PATTERNS: Array<[RegExp, string]> = [
  [/js\.stripe\.com/, 'iframe: stripe'],
  [/paypal\.com\/sdk/, 'iframe: paypal'],
  [/braintreegateway\.com/, 'iframe: braintree'],
  [/checkout\.square\.com/, 'iframe: square'],
  [/checkout\.adyen\.com/, 'iframe: adyen'],
];

const SCORE_THRESHOLD = 4;

export function detectCheckout(doc: Document = document, url: string = location.href): CheckoutSignal {
  const reasons: string[] = [];
  let score = 0;

  for (const [re, label, weight] of URL_PATTERNS) {
    if (re.test(url)) {
      reasons.push(label);
      score += weight;
      break;
    }
  }

  for (const [sel, label] of CARD_INPUT_SELECTORS) {
    if (doc.querySelector(sel)) {
      reasons.push(label);
      score += 4;
      break;
    }
  }

  const iframes = Array.from(doc.querySelectorAll('iframe'));
  for (const iframe of iframes) {
    const src = iframe.getAttribute('src') ?? '';
    for (const [re, label] of IFRAME_PATTERNS) {
      if (re.test(src)) {
        reasons.push(label);
        score += 4;
        break;
      }
    }
    if (score >= 8) break;
  }

  const bodyText = (doc.body?.innerText ?? '').slice(0, 8000);
  for (const [re, label] of KEYWORD_PATTERNS) {
    if (re.test(bodyText)) {
      reasons.push(label);
      score += 1;
    }
  }

  return { score, reasons };
}

export function isCheckout(signal: CheckoutSignal): boolean {
  return signal.score >= SCORE_THRESHOLD;
}
