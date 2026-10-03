import { describe, expect, it } from 'vitest';
import { hasMeaningfulRichText } from './richTextPresence';

describe('meaningful rich content', () => {
  it.each(['', '<div><br></div>', '<p><strong> </strong></p>', '<span>\u200b</span>'])(
    'ignores empty scaffolding %s', (html) => expect(hasMeaningfulRichText({ html, plainText: ' \n\u200b' })).toBe(false));
  it('retains actual text, an intentional checklist and only references to retained files', () => {
    expect(hasMeaningfulRichText({ html: '<p>Hi</p>', plainText: 'Hi' })).toBe(true);
    expect(hasMeaningfulRichText({ html: '<ul data-checklist="true"><li><input type="checkbox"></li></ul>', plainText: '' })).toBe(true);
    const file = { html: '<span data-skrib-attachment="a"></span>', plainText: '' };
    expect(hasMeaningfulRichText(file, ['a'])).toBe(true);
    expect(hasMeaningfulRichText(file, ['b'])).toBe(false);
  });
});
