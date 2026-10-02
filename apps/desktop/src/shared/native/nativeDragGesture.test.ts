import { describe, expect, it } from 'vitest';
import { NativeDragGesture } from './nativeDragGesture';

describe('native drag gesture', () => {
  it('allows a click with normal pointer jitter', () => {
    const gesture = new NativeDragGesture();
    gesture.begin(10, 10);
    expect(gesture.move(12, 12)).toBe(false);
    gesture.end();
    expect(gesture.allowsClick(false)).toBe(true);
  });
  it('starts one drag and suppresses the following pointer click', () => {
    const gesture = new NativeDragGesture();
    gesture.begin(10, 10);
    expect(gesture.move(16, 10)).toBe(true);
    expect(gesture.move(25, 10)).toBe(false);
    gesture.end();
    expect(gesture.allowsClick(false)).toBe(false);
    expect(gesture.allowsClick(true)).toBe(true);
    gesture.begin(10, 10);
    expect(gesture.allowsClick(false)).toBe(true);
  });
  it('does not drag without a press or after cancellation', () => {
    const gesture = new NativeDragGesture();
    expect(gesture.move(90, 90)).toBe(false);
    gesture.begin(10, 10);
    gesture.end();
    expect(gesture.move(90, 90)).toBe(false);
  });
  it('supports a double-click pickup and suppresses its click', () => {
    const gesture = new NativeDragGesture();
    gesture.begin(4, 4);
    expect(gesture.pickUp()).toBe(true);
    expect(gesture.pickUp()).toBe(false);
    expect(gesture.allowsClick(false)).toBe(false);
  });
});
