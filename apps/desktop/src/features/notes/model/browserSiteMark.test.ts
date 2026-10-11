import { expect, it } from 'vitest';
import { browserSiteMark } from './browserSiteMark';

it('uses supported sites identified by saved Chrome titles', () => {
  expect(browserSiteMark('chrome.exe', 'Skribli · GitHub - Google Chrome')).toBe('github');
  expect(browserSiteMark('CHROME.EXE', 'ChatGPT - Google Chrome')).toBe('openai');
  expect(browserSiteMark('chrome.exe', 'https://github.com/Ankit6149/skribly - Google Chrome')).toBe('github');
  expect(browserSiteMark('chrome.exe', 'Design notes · Figma - Google Chrome')).toBe('figma');
});
it('falls back for unknown sites, ambiguous mentions, lookalike hosts and other apps', () => {
  expect(browserSiteMark('chrome.exe', 'Build a GitHub clone - Google Chrome')).toBeUndefined();
  expect(browserSiteMark('chrome.exe', 'https://github.com.example.org - Google Chrome')).toBeUndefined();
  expect(browserSiteMark('chrome.exe', 'New conversation - Google Chrome')).toBeUndefined();
  expect(browserSiteMark('code.exe', 'GitHub')).toBeUndefined();
});
