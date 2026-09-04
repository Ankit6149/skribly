import { useRef, type PointerEvent, type MouseEvent } from 'react';
import { getCurrentWindow } from '@tauri-apps/api/window';
import { NativeDragGesture } from './nativeDragGesture';

/** A click opens; a deliberate drag moves the same target without also opening it. */
export function useNativeDrag(onClick: () => void, onError: (reason: unknown) => void) {
  const gesture = useRef(new NativeDragGesture());
  return {
    onPointerDown(event: PointerEvent<HTMLButtonElement>) {
      if (event.button !== 0) return;
      event.stopPropagation();
      gesture.current.begin(event.clientX, event.clientY);
      event.currentTarget.setPointerCapture(event.pointerId);
    },
    onPointerMove(event: PointerEvent<HTMLButtonElement>) {
      if (!gesture.current.move(event.clientX, event.clientY)) return;
      if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId);
      void getCurrentWindow().startDragging().catch(onError);
    },
    onPointerUp() { gesture.current.end(); },
    onPointerCancel() { gesture.current.end(); },
    onClick(event: MouseEvent<HTMLButtonElement>) {
      if (gesture.current.allowsClick(event.detail === 0)) onClick();
    },
  };
}
