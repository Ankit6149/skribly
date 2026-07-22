import { describe, expect, it } from 'vitest';
import {
  calculateNoteClientLogicalPosition,
  calculateRelativeLogicalOffset,
  clampToWindowBounds,
  matchesContext,
  OverlayMetrics,
  WindowRect,
} from './geometry';

describe('Canonical Coordinate Protocol & End-to-End Multi-Monitor Tests', () => {
  // Native WndProc physical hit-test helper function mirroring Rust check_hit_test_rect_math
  function nativePhysicalHitTestRect(
    overlayMetrics: OverlayMetrics,
    clientLogicalRect: { x: number; y: number; width: number; height: number }
  ): WindowRect {
    const scale = overlayMetrics.scale_factor > 0 ? overlayMetrics.scale_factor : 1.0;
    const physX = overlayMetrics.overlay_physical_x + Math.round(clientLogicalRect.x * scale);
    const physY = overlayMetrics.overlay_physical_y + Math.round(clientLogicalRect.y * scale);
    const physW = Math.round(clientLogicalRect.width * scale);
    const physH = Math.round(clientLogicalRect.height * scale);
    return { x: physX, y: physY, width: physW, height: physH };
  }

  it('1. Primary monitor origin (0, 0), 100% scale', () => {
    const targetPhysicalBounds: WindowRect = { x: 200, y: 150, width: 800, height: 600 };
    const overlayMetrics: OverlayMetrics = {
      overlay_physical_x: 0,
      overlay_physical_y: 0,
      overlay_physical_width: 1920,
      overlay_physical_height: 1080,
      dpi: 96,
      scale_factor: 1.0,
    };
    const noteRelOffset = { rel_x: 40, rel_y: 50, width: 300, height: 200 };

    // Step A: Convert Physical Target -> React Client Logical Position
    const clientLogicalPos = calculateNoteClientLogicalPosition(
      targetPhysicalBounds,
      overlayMetrics,
      noteRelOffset.rel_x,
      noteRelOffset.rel_y
    );
    expect(clientLogicalPos).toEqual({ x: 240, y: 200 });

    // Step B: React Client Logical Rect -> Native Physical Hit-Test Rect
    const nativeHitTestRect = nativePhysicalHitTestRect(overlayMetrics, {
      ...clientLogicalPos,
      width: noteRelOffset.width,
      height: noteRelOffset.height,
    });
    expect(nativeHitTestRect).toEqual({ x: 240, y: 200, width: 300, height: 200 });
  });

  it('2. Left monitor origin (-1920, 0), 100% scale', () => {
    const targetPhysicalBounds: WindowRect = { x: -1800, y: 100, width: 800, height: 600 };
    const overlayMetrics: OverlayMetrics = {
      overlay_physical_x: -1920,
      overlay_physical_y: 0,
      overlay_physical_width: 3840,
      overlay_physical_height: 1080,
      dpi: 96,
      scale_factor: 1.0,
    };
    const noteRelOffset = { rel_x: 40, rel_y: 50, width: 300, height: 200 };

    const clientLogicalPos = calculateNoteClientLogicalPosition(
      targetPhysicalBounds,
      overlayMetrics,
      noteRelOffset.rel_x,
      noteRelOffset.rel_y
    );
    expect(clientLogicalPos).toEqual({ x: 160, y: 150 });

    const nativeHitTestRect = nativePhysicalHitTestRect(overlayMetrics, {
      ...clientLogicalPos,
      width: noteRelOffset.width,
      height: noteRelOffset.height,
    });
    expect(nativeHitTestRect).toEqual({ x: -1760, y: 150, width: 300, height: 200 });
  });

  it('3. Upper monitor origin (0, -1080), 100% scale', () => {
    const targetPhysicalBounds: WindowRect = { x: 100, y: -900, width: 800, height: 600 };
    const overlayMetrics: OverlayMetrics = {
      overlay_physical_x: 0,
      overlay_physical_y: -1080,
      overlay_physical_width: 1920,
      overlay_physical_height: 2160,
      dpi: 96,
      scale_factor: 1.0,
    };
    const noteRelOffset = { rel_x: 40, rel_y: 50, width: 300, height: 200 };

    const clientLogicalPos = calculateNoteClientLogicalPosition(
      targetPhysicalBounds,
      overlayMetrics,
      noteRelOffset.rel_x,
      noteRelOffset.rel_y
    );
    expect(clientLogicalPos).toEqual({ x: 140, y: 230 });

    const nativeHitTestRect = nativePhysicalHitTestRect(overlayMetrics, {
      ...clientLogicalPos,
      width: noteRelOffset.width,
      height: noteRelOffset.height,
    });
    expect(nativeHitTestRect).toEqual({ x: 140, y: -850, width: 300, height: 200 });
  });

  it('4. 125% DPI scaling (scale_factor = 1.25)', () => {
    const targetPhysicalBounds: WindowRect = { x: 250, y: 200, width: 1000, height: 750 };
    const overlayMetrics: OverlayMetrics = {
      overlay_physical_x: 0,
      overlay_physical_y: 0,
      overlay_physical_width: 2400,
      overlay_physical_height: 1350,
      dpi: 120,
      scale_factor: 1.25,
    };
    const noteRelOffset = { rel_x: 40, rel_y: 40, width: 320, height: 230 };

    // Target Logical Top-Left = (250 / 1.25, 200 / 1.25) = (200, 160)
    // Client Logical Position = (200 + 40, 160 + 40) = (240, 200)
    const clientLogicalPos = calculateNoteClientLogicalPosition(
      targetPhysicalBounds,
      overlayMetrics,
      noteRelOffset.rel_x,
      noteRelOffset.rel_y
    );
    expect(clientLogicalPos).toEqual({ x: 240, y: 200 });

    // Native Physical Hit-Test Rect = (240 * 1.25, 200 * 1.25, 320 * 1.25, 230 * 1.25) = (300, 250, 400, 288)
    const nativeHitTestRect = nativePhysicalHitTestRect(overlayMetrics, {
      ...clientLogicalPos,
      width: noteRelOffset.width,
      height: noteRelOffset.height,
    });
    expect(nativeHitTestRect).toEqual({ x: 300, y: 250, width: 400, height: 288 });
  });

  it('5. 150% DPI scaling (scale_factor = 1.50)', () => {
    const targetPhysicalBounds: WindowRect = { x: 300, y: 300, width: 1200, height: 900 };
    const overlayMetrics: OverlayMetrics = {
      overlay_physical_x: 0,
      overlay_physical_y: 0,
      overlay_physical_width: 2880,
      overlay_physical_height: 1620,
      dpi: 144,
      scale_factor: 1.5,
    };
    const noteRelOffset = { rel_x: 40, rel_y: 40, width: 320, height: 230 };

    // Target Logical = (300 / 1.5, 300 / 1.5) = (200, 200)
    // Client Logical = (200 + 40, 200 + 40) = (240, 240)
    const clientLogicalPos = calculateNoteClientLogicalPosition(
      targetPhysicalBounds,
      overlayMetrics,
      noteRelOffset.rel_x,
      noteRelOffset.rel_y
    );
    expect(clientLogicalPos).toEqual({ x: 240, y: 240 });

    const nativeHitTestRect = nativePhysicalHitTestRect(overlayMetrics, {
      ...clientLogicalPos,
      width: noteRelOffset.width,
      height: noteRelOffset.height,
    });
    expect(nativeHitTestRect).toEqual({ x: 360, y: 360, width: 480, height: 345 });
  });

  it('6. Target on primary monitor while overlay starts at negative virtual origin (-1920, 0)', () => {
    const targetPhysicalBounds: WindowRect = { x: 100, y: 100, width: 800, height: 600 };
    const overlayMetrics: OverlayMetrics = {
      overlay_physical_x: -1920,
      overlay_physical_y: 0,
      overlay_physical_width: 3840,
      overlay_physical_height: 1080,
      dpi: 96,
      scale_factor: 1.0,
    };
    const noteRelOffset = { rel_x: 40, rel_y: 40, width: 320, height: 230 };

    // Target Logical = 100 - (-1920) = 2020
    const clientLogicalPos = calculateNoteClientLogicalPosition(
      targetPhysicalBounds,
      overlayMetrics,
      noteRelOffset.rel_x,
      noteRelOffset.rel_y
    );
    expect(clientLogicalPos).toEqual({ x: 2060, y: 140 });

    const nativeHitTestRect = nativePhysicalHitTestRect(overlayMetrics, {
      ...clientLogicalPos,
      width: noteRelOffset.width,
      height: noteRelOffset.height,
    });
    expect(nativeHitTestRect).toEqual({ x: 140, y: 140, width: 320, height: 230 });
  });

  it('7. Target moving between monitors', () => {
    const overlayMetrics: OverlayMetrics = {
      overlay_physical_x: -1920,
      overlay_physical_y: 0,
      overlay_physical_width: 3840,
      overlay_physical_height: 1080,
      dpi: 96,
      scale_factor: 1.0,
    };
    const noteRelOffset = { rel_x: 50, rel_y: 50, width: 300, height: 200 };

    // Position on Monitor 1 (Left: -1920..0)
    const monitor1Target: WindowRect = { x: -1500, y: 200, width: 800, height: 600 };
    const posOnMon1 = calculateNoteClientLogicalPosition(
      monitor1Target,
      overlayMetrics,
      noteRelOffset.rel_x,
      noteRelOffset.rel_y
    );
    expect(posOnMon1).toEqual({ x: 470, y: 250 });

    // Move target to Monitor 2 (Primary: 0..1920)
    const monitor2Target: WindowRect = { x: 400, y: 200, width: 800, height: 600 };
    const posOnMon2 = calculateNoteClientLogicalPosition(
      monitor2Target,
      overlayMetrics,
      noteRelOffset.rel_x,
      noteRelOffset.rel_y
    );
    expect(posOnMon2).toEqual({ x: 2370, y: 250 });
  });
});

