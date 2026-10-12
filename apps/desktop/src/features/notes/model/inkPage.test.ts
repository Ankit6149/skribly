import { describe, expect, it } from 'vitest';
import { INK_PAGE_HEIGHT, inkPageExtent, strokeInViewport } from './inkPage';
import { validateInkDocument, type InkStroke } from '../persistence/richContentStore';

const stroke: InkStroke = { id:'page-stroke', tool:'pen', color:'#262923', width:4,
  coordinateSpace:{ width:400, height:INK_PAGE_HEIGHT }, points:[{ x:.25,y:1200/INK_PAGE_HEIGHT,pressure:.5 }] };
describe('scrolling ink coordinates', () => {
  it('keeps ink at the same document position through scroll and resize', () => {
    const first = strokeInViewport(stroke,{ width:400,height:300,top:1000 });
    const resized = strokeInViewport(stroke,{ width:500,height:600,top:1000 });
    expect(first.points[0]!.x * 400).toBe(100);
    expect(resized.points[0]!.x * 500).toBe(100);
    expect(first.points[0]!.y * 300).toBe(200);
    expect(resized.points[0]!.y * 600).toBe(200);
    expect(strokeInViewport(stroke,{ width:400,height:300,top:1100 }).points[0]!.y * 300).toBe(100);
  });
  it('retains document bounds after saving/reopening without changing legacy records', () => {
    const saved = validateInkDocument([stroke]);
    expect(saved.strokes[0]).toEqual(stroke);
    expect(inkPageExtent(saved.strokes)).toBe(1280);
    const legacy = { ...stroke }; delete legacy.coordinateSpace;
    expect(validateInkDocument([legacy]).strokes[0]).not.toHaveProperty('coordinateSpace');
    expect(() => validateInkDocument([{...stroke,coordinateSpace:{width:400,height:Infinity}}])).toThrow();
  });
});
