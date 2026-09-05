import { useRef, type PointerEvent, type MouseEvent } from 'react';
import { getCurrentWindow } from '@tauri-apps/api/window';
import { NativeDragGesture } from './nativeDragGesture';

/** A click opens; a deliberate drag moves the same target without also opening it. */
export function useNativeDrag(onClick: () => void, onError: (reason: unknown) => void) {
  const gesture = useRef(new NativeDragGesture());
  return {
    onMouseDown(event: MouseEvent<HTMLButtonElement>) {
      if (event.button !== 0 || event.detail < 2 || !gesture.current.pickUp()) return;
      event.preventDefault();
      event.stopPropagation();
      void getCurrentWindow().startDragging().catch(onError);
    },
    onPointerDown(event: PointerEvent<HTMLButtonElement>) {
      if (event.button !== 0) return;
      event.stopPropagation();
      gesture.current.begin(event.clientX, event.clientY);
    },
    onPointerMove(event: PointerEvent<HTMLButtonElement>) {
      if (!gesture.current.move(event.clientX, event.clientY)) return;
      void getCurrentWindow().startDragging().catch(onError);
    },
    onPointerUp() { gesture.current.end(); },
    onPointerCancel() { gesture.current.end(); },
    onClick(event: MouseEvent<HTMLButtonElement>) {
      if (gesture.current.allowsClick(event.detail === 0)) onClick();
    },
  };
}
