export function matchesContext(
  targetProcessName: string,
  targetTitle: string,
  noteProcessName: string,
  noteTitle: string
): boolean {
  const sameProcess =
    targetProcessName.toLowerCase() === noteProcessName.toLowerCase();
  if (!sameProcess) return false;

  if (!noteTitle || !targetTitle) return true;

  const t1 = targetTitle.toLowerCase().trim();
  const t2 = noteTitle.toLowerCase().trim();
  return t1.includes(t2) || t2.includes(t1);
}
