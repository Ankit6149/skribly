export class NativeDragGesture {
  private origin: { x: number; y: number } | null = null;
  private dragged = false;

  begin(x: number, y: number) { this.origin = { x, y }; this.dragged = false; }
  move(x: number, y: number): boolean {
    if (!this.origin || this.dragged || Math.hypot(x - this.origin.x, y - this.origin.y) < 5) return false;
    this.dragged = true;
    this.origin = null;
    return true;
  }
  end() { this.origin = null; }
  allowsClick(keyboard: boolean): boolean { return keyboard || !this.dragged; }
}
