import type { Locator, Page } from '@playwright/test';

export type Rect = { left: number; right: number; top: number; bottom: number; width: number; height: number };

export function horizontalOverflow(page: Page) {
  return page.evaluate(() => {
    const vw = window.innerWidth;
    const doc = document.documentElement;
    const offenders: string[] = [];
    if (doc.scrollWidth > vw) {
      for (const el of Array.from(document.querySelectorAll('body *'))) {
        const r = el.getBoundingClientRect();
        if (r.width === 0 || r.height === 0) continue;
        const cs = getComputedStyle(el);
        if (cs.visibility === 'hidden' || cs.position === 'fixed') continue;
        if (r.right > vw + 1) {
          offenders.push(`${el.tagName.toLowerCase()}#${el.id}.${String(el.className).split(' ').slice(0, 2).join('.')} right=${Math.round(r.right)}`);
          if (offenders.length >= 8) break;
        }
      }
    }
    return { scrollWidth: doc.scrollWidth, innerWidth: vw, offenders };
  });
}

export async function rectOf(locator: Locator): Promise<Rect> {
  return locator.evaluate((el) => {
    const r = el.getBoundingClientRect();
    return { left: r.left, right: r.right, top: r.top, bottom: r.bottom, width: r.width, height: r.height };
  });
}

export function within(inner: Rect, outer: Rect, tolerance = 1): boolean {
  return inner.left >= outer.left - tolerance && inner.right <= outer.right + tolerance;
}

/** Accessible-name audit for visible controls inside `rootSelector`. */
export function auditAccessibleNames(page: Page, rootSelector: string) {
  return page.evaluate((sel) => {
    const isVisible = (el: Element) => {
      const r = el.getBoundingClientRect();
      const cs = getComputedStyle(el);
      return r.width > 0 && r.height > 0 && cs.visibility !== 'hidden' && cs.display !== 'none';
    };
    const textOf = (ids: string) =>
      ids.split(/\s+/).map((id) => document.getElementById(id)?.textContent?.trim() || '').join(' ').trim();
    const name = (el: HTMLElement): string => {
      const labelledby = el.getAttribute('aria-labelledby');
      if (labelledby && textOf(labelledby)) return textOf(labelledby);
      const aria = el.getAttribute('aria-label')?.trim();
      if (aria) return aria;
      if (el instanceof HTMLInputElement || el instanceof HTMLSelectElement || el instanceof HTMLTextAreaElement) {
        const labels = Array.from(el.labels || []).map((l) => l.textContent?.trim()).filter(Boolean);
        if (labels.length) return labels.join(' ');
        return '';
      }
      return (el.innerText || el.textContent || '').trim() || el.getAttribute('title')?.trim() || '';
    };
    const roots = Array.from(document.querySelectorAll(sel));
    const unnamedButtons: string[] = [];
    const unlabeledInputs: string[] = [];
    const smallTargets: string[] = [];
    for (const root of roots) {
      for (const el of Array.from(root.querySelectorAll<HTMLElement>('button, [role="button"], a[href]'))) {
        if (!isVisible(el) || el.closest('[aria-hidden="true"]')) continue;
        const n = name(el);
        if (!n) unnamedButtons.push(el.outerHTML.slice(0, 160));
        const r = el.getBoundingClientRect();
        if (r.height < 32 || r.width < 32) smallTargets.push(`${n || el.id} ${Math.round(r.width)}x${Math.round(r.height)}`);
      }
      for (const el of Array.from(root.querySelectorAll<HTMLElement>('input, select, textarea'))) {
        const input = el as HTMLInputElement;
        if (input.type === 'hidden' || !isVisible(el) || el.getAttribute('aria-hidden') === 'true') continue;
        if (!name(el)) unlabeledInputs.push(el.outerHTML.slice(0, 160));
      }
    }
    return { unnamedButtons, unlabeledInputs, smallTargets };
  }, rootSelector);
}
