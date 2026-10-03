// @vitest-environment jsdom
import React, { act, createRef } from 'react';
import { createRoot } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { InkCanvas, type InkCanvasHandle } from './InkCanvas';
import type { InkStroke } from '../model/inkModel';

function pointer(canvas: HTMLCanvasElement, type: string, x: number) {
  const event = new Event(type, { bubbles: true, cancelable: true });
  Object.assign(event, { pointerId: 1, pointerType: 'pen', button: 0, clientX: x, clientY: 40, pressure: 0.5 });
  canvas.dispatchEvent(event);
}

beforeEach(() => {
  Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
  vi.stubGlobal('ResizeObserver', class { observe() {} disconnect() {} });
  const context = { clearRect() {}, save() {}, restore() {}, beginPath() {}, arc() {}, fill() {}, moveTo() {}, lineTo() {}, stroke() {} };
  vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockImplementation(() => context as unknown as CanvasRenderingContext2D);
  vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockReturnValue({ x: 0, y: 0, left: 0, top: 0, right: 100, bottom: 100, width: 100, height: 100, toJSON() {} });
  Object.assign(HTMLCanvasElement.prototype, { setPointerCapture() {}, releasePointerCapture() {}, hasPointerCapture: () => false });
});
afterEach(() => { vi.restoreAllMocks(); vi.unstubAllGlobals(); });

describe('drawing native transition preparation', () => {
  it('commits an active pointer stroke and blocks more input synchronously until release', async () => {
    const host = document.createElement('div'); document.body.append(host);
    const root = createRoot(host); const ref = createRef<InkCanvasHandle>();
    let resolveWrite!: () => void;
    const saved: InkStroke[][] = [];
    const onChange = vi.fn(async (strokes: InkStroke[]) => { saved.push(strokes); await new Promise<void>((resolve) => { resolveWrite = resolve; }); });
    try {
      await act(async () => root.render(<InkCanvas ref={ref} onChange={onChange} />));
      const canvas = host.querySelector('canvas')!;
      let prepare!: Promise<boolean>;
      await act(async () => {
        pointer(canvas, 'pointerdown', 20); pointer(canvas, 'pointermove', 50);
        prepare = ref.current!.prepareTransition();
        // No React disabled prop/render has happened: the imperative seal guards input.
        pointer(canvas, 'pointerdown', 80); pointer(canvas, 'pointerup', 80);
      });
      expect(onChange).toHaveBeenCalledTimes(1);
      expect(saved[0]).toHaveLength(1);
      expect(saved[0]![0]!.points.map((point) => point.x)).toEqual([0.2, 0.5]);
      await act(async () => { resolveWrite(); expect(await prepare).toBe(true); });
      await act(async () => { pointer(canvas, 'pointerdown', 80); pointer(canvas, 'pointerup', 80); });
      expect(onChange).toHaveBeenCalledTimes(1);
      await act(async () => { ref.current!.releaseTransition(); pointer(canvas, 'pointerdown', 80); pointer(canvas, 'pointerup', 80); });
      expect(onChange).toHaveBeenCalledTimes(2);
      expect(saved[1]).toHaveLength(2);
      await act(async () => resolveWrite());
    } finally { await act(async () => root.unmount()); host.remove(); }
  });

  it('retains a failed active stroke and retries the exact latest drawing', async () => {
    const host = document.createElement('div'); const root = createRoot(host); const ref = createRef<InkCanvasHandle>();
    const onChange = vi.fn(async (_strokes: InkStroke[]): Promise<void> => { throw new Error('quota exhausted'); });
    try {
      await act(async () => root.render(<InkCanvas ref={ref} onChange={onChange} />));
      await act(async () => {
        pointer(host.querySelector('canvas')!, 'pointerdown', 20);
        expect(await ref.current!.prepareTransition()).toBe(false);
      });
      expect(host.textContent).toContain('quota exhausted');
      expect(host.textContent).toContain('1 strokes');
      const latest = onChange.mock.calls.at(-1)![0];
      onChange.mockImplementation(async () => undefined);
      await act(async () => {
        ref.current!.releaseTransition();
        expect(await ref.current!.prepareTransition()).toBe(true);
      });
      expect(onChange.mock.calls.at(-1)![0]).toEqual(latest);
    } finally { await act(async () => root.unmount()); host.remove(); }
  });
});
