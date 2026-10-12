import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import type { InkStroke, SkribTextSize } from '../persistence/richContentStore';
import { inkPageExtent } from '../model/inkPage';

export function NotePage({ drawing, textSize, strokes, children, renderInk }: {
  drawing: boolean; textSize: SkribTextSize; strokes: InkStroke[]; children: ReactNode;
  renderInk: (offset: number, scroll: (delta: number) => void, extend: () => void) => ReactNode;
}) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);
  const [offset, setOffset] = useState(0);
  const [textHeight, setTextHeight] = useState(0);
  const [extraSpace, setExtraSpace] = useState(180);
  const inkHeight = useMemo(() => inkPageExtent(strokes), [strokes]);
  useEffect(() => {
    const text = contentRef.current?.querySelector<HTMLElement>('.composer-textarea');
    if (!text) return;
    const measure = () => setTextHeight(Math.ceil(text.getBoundingClientRect().height));
    measure();
    if (typeof ResizeObserver === 'undefined') {
      const mutations = new MutationObserver(measure);
      mutations.observe(text, { subtree:true, childList:true, characterData:true });
      window.addEventListener('resize',measure);
      return () => { mutations.disconnect(); window.removeEventListener('resize',measure); };
    }
    const observer = new ResizeObserver(measure);
    observer.observe(text);
    return () => observer.disconnect();
  }, []);
  const scroll = (delta: number) => {
    const view = scrollRef.current;
    if (!view) return;
    view.scrollTop += delta;
    setOffset(view.scrollTop);
  };
  const extend = () => setExtraSpace((space) => space + Math.max(240, scrollRef.current?.clientHeight ?? 240));
  return <div className={`composer-unified-canvas composer-page ${drawing ? 'drawing' : 'typing'}`} data-text-size={textSize}>
    <div ref={scrollRef} className="composer-page-scroll" onScroll={(event) => setOffset(event.currentTarget.scrollTop)}>
      <div ref={contentRef} className="composer-page-content" style={{ minHeight: Math.max(textHeight + extraSpace, inkHeight) }}>
        {children}
      </div>
    </div>
    {renderInk(offset, scroll, extend)}
  </div>;
}
