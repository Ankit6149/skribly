/** Empty browser paragraphs and formatting scaffolding are not a saved thought. */
export function hasMeaningfulRichText(value: { html: string; plainText: string } | undefined,
  attachmentIds: Iterable<string> = []): boolean {
  if (!value) return false;
  if (value.plainText.replace(/\u200b/g, '').trim()) return true;
  if (/\bdata-checklist\s*=\s*["']true["']/i.test(value.html) && /<li(?:\s|>)/i.test(value.html)) return true;
  const available = new Set(attachmentIds);
  return [...value.html.matchAll(/\bdata-skrib-attachment\s*=\s*["']([^"']+)["']/gi)]
    .some((match) => available.has(match[1]!));
}
