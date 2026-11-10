// Tiny DOM helpers + toast notifications. No framework, no dependencies.

export function h<K extends keyof HTMLElementTagNameMap>(
  tag: K,
  attrs: Record<string, string> = {},
  ...children: Array<Node | string>
): HTMLElementTagNameMap[K] {
  const el = document.createElement(tag);
  for (const [key, value] of Object.entries(attrs)) {
    if (key === 'class') el.className = value;
    else el.setAttribute(key, value);
  }
  for (const child of children) {
    el.append(typeof child === 'string' ? document.createTextNode(child) : child);
  }
  return el;
}

export function clear(el: HTMLElement): void {
  while (el.firstChild) el.removeChild(el.firstChild);
}

let toastTimer: number | undefined;

export function toast(message: string, kind: 'info' | 'error' | 'success' = 'info'): void {
  let container = document.querySelector<HTMLElement>('.toast-stack');
  if (!container) {
    container = h('div', { class: 'toast-stack', role: 'status', 'aria-live': 'polite' });
    document.body.append(container);
  }
  const item = h('div', { class: `toast toast-${kind}` }, message);
  container.append(item);
  window.setTimeout(() => item.classList.add('toast-show'), 10);
  window.clearTimeout(toastTimer);
  toastTimer = window.setTimeout(() => {
    item.classList.remove('toast-show');
    window.setTimeout(() => item.remove(), 250);
  }, 3400);
}

/** Copy text to the clipboard; returns true on success. */
export async function copyText(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    // Fallback for WebViews without the async clipboard API permission.
    try {
      const textarea = h('textarea', { class: 'visually-hidden' });
      textarea.value = text;
      document.body.append(textarea);
      textarea.select();
      const ok = document.execCommand('copy');
      textarea.remove();
      return ok;
    } catch {
      return false;
    }
  }
}

/** Native share sheet when available; reports whether sharing happened. */
export async function shareNative(data: { title: string; text: string; url: string }): Promise<boolean> {
  if (typeof navigator.share === 'function') {
    try {
      await navigator.share(data);
      return true;
    } catch {
      return false; // user dismissed or share failed — caller falls back to copy
    }
  }
  return false;
}
