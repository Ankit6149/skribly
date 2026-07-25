import { describe, expect, it } from 'vitest';
import {
  formatAttachmentSize,
  MAX_ATTACHMENT_BYTES,
  MAX_NOTE_ATTACHMENT_BYTES,
  validateAttachmentSizes,
} from './richContentStore';

describe('richContentStore helpers', () => {
  it('accepts files within individual and per-note limits', () => {
    const total = validateAttachmentSizes(1024, [
      { name: 'image.png', size: 2 * 1024 * 1024 },
      { name: 'brief.pdf', size: 3 * 1024 * 1024 },
    ]);
    expect(total).toBe(1024 + 5 * 1024 * 1024);
  });

  it('rejects a file above the individual limit', () => {
    expect(() =>
      validateAttachmentSizes(0, [{ name: 'large.mov', size: MAX_ATTACHMENT_BYTES + 1 }])
    ).toThrow('larger than the 8 MB');
  });

  it('rejects a note above the aggregate limit', () => {
    expect(() =>
      validateAttachmentSizes(MAX_NOTE_ATTACHMENT_BYTES - 512, [{ name: 'last.png', size: 1024 }])
    ).toThrow('24 MB');
  });

  it('formats byte sizes for the UI', () => {
    expect(formatAttachmentSize(512)).toBe('512 B');
    expect(formatAttachmentSize(2048)).toBe('2 KB');
    expect(formatAttachmentSize(1.5 * 1024 * 1024)).toBe('1.5 MB');
  });
});
