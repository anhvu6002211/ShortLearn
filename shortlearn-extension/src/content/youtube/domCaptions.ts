const CAPTION_SELECTOR = '.ytp-caption-segment';

export function cleanCaptionText(value: string): string {
  return value
    .replace(/♪|\[[^\]]*\]/g, '')
    .replace(/^\s*(?:>>\s*)+/, '')
    .replace(/\s+/g, ' ')
    .trim();
}

export function readVisibleCaption(root: ParentNode = document): string {
  const parts = Array.from(root.querySelectorAll<HTMLElement>(CAPTION_SELECTOR))
    .filter(node => node.getClientRects().length > 0)
    .map(node => cleanCaptionText(node.textContent ?? ''))
    .filter(Boolean);
  return cleanCaptionText(parts.join(' '));
}

export function observesCaptionMutation(record: MutationRecord): boolean {
  const element = record.target.nodeType === Node.ELEMENT_NODE
    ? record.target as Element
    : record.target.parentElement;
  if (element?.closest(CAPTION_SELECTOR)) return true;
  return Array.from(record.addedNodes).some(node =>
    node.nodeType === Node.ELEMENT_NODE &&
    ((node as Element).matches(CAPTION_SELECTOR) || Boolean((node as Element).querySelector(CAPTION_SELECTOR))),
  );
}