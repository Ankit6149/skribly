const rgb = (hex: string) => [1, 3, 5].map((offset) => parseInt(hex.slice(offset, offset + 2), 16));

export function mixHexColors(a: string, b: string, amount: number): string {
  const other = rgb(b);
  return '#' + rgb(a).map((value, index) => Math.round(value * (1 - amount) + other[index]! * amount).toString(16).padStart(2, '0')).join('');
}

export function colorContrast(a: string, b: string): number {
  const luminance = (hex: string) => rgb(hex).reduce((sum, value, index) => {
    const channel = value / 255;
    return sum + (channel <= .04045 ? channel / 12.92 : ((channel + .055) / 1.055) ** 2.4) * [.2126, .7152, .0722][index]!;
  }, 0);
  const first = luminance(a), second = luminance(b);
  return (Math.max(first, second) + .05) / (Math.min(first, second) + .05);
}

/** Fade the hint only as far as this paper's contrast allows. */
export function readableMutedInk(paper: string, ink: string): string {
  for (let strength = 60; strength <= 100; strength += 2) {
    const candidate = mixHexColors(paper, ink, strength / 100);
    if (colorContrast(paper, candidate) >= 4.5) return candidate;
  }
  return ink;
}
