import { useEffect } from 'react';

let subscribers = 0;
const animations = new WeakMap<HTMLElement, Animation>();
function acknowledgePress(event: MouseEvent) {
  if (window.matchMedia?.('(prefers-reduced-motion: reduce)').matches || !(event.target instanceof Element)) return;
  const control = event.target.closest<HTMLElement>('button, a[href], [role="button"]');
  if (!control || control.matches(':disabled,[aria-disabled="true"]') || !control.animate) return;
  animations.get(control)?.cancel();
  animations.set(control, control.animate([{ scale: '.96' }, { scale: '1' }], {
    duration: 160, easing: 'cubic-bezier(.16,1,.3,1)',
  }));
}
export function usePressFeedback() {
  useEffect(() => {
    if (subscribers++ === 0) document.addEventListener('click', acknowledgePress, true);
    return () => { if (--subscribers === 0) document.removeEventListener('click', acknowledgePress, true); };
  }, []);
}
