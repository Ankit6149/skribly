// @vitest-environment jsdom
import React, { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import type { MobileNote } from '@skribly/shared';
import { App } from './App';

const native = vi.hoisted(() => ({ listNotes:vi.fn(), saveNote:vi.fn() }));
vi.mock('./persistence', () => native);
let host:HTMLDivElement;
let root:Root;
const dialogMethods = { showModal:Object.getOwnPropertyDescriptor(HTMLDialogElement.prototype,'showModal'), close:Object.getOwnPropertyDescriptor(HTMLDialogElement.prototype,'close') };
beforeEach(() => {
  Object.assign(globalThis,{IS_REACT_ACT_ENVIRONMENT:true});
  host=document.createElement('div'); document.body.append(host); root=createRoot(host);
  const note:MobileNote={schemaVersion:2,documentType:'skrib',id:'search-note',text:'Morning project',colour:'yellow',context:null,reminder:null,createdAt:1,updatedAt:2,revision:1,archivedAt:null,trashedAt:null};
  native.listNotes.mockResolvedValue([note]);
  Object.defineProperty(HTMLDialogElement.prototype,'showModal',{configurable:true,value:function(this:HTMLDialogElement){this.setAttribute('open','');}});
  Object.defineProperty(HTMLDialogElement.prototype,'close',{configurable:true,value:function(this:HTMLDialogElement){this.removeAttribute('open');}});
});
afterEach(async()=>{
  await act(async()=>root.unmount());host.remove();vi.restoreAllMocks();
  for (const [name,descriptor] of Object.entries(dialogMethods)) {
    if (descriptor) Object.defineProperty(HTMLDialogElement.prototype,name,descriptor);
    else Reflect.deleteProperty(HTMLDialogElement.prototype,name);
  }
});
function input(value:string) {
  const field=host.querySelector<HTMLInputElement>('[aria-label="Search Skribs"]')!;
  Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value')!.set!.call(field,value);
  field.dispatchEvent(new Event('input',{bubbles:true}));
  return field;
}
it('normalizes pasted search whitespace and recovers empty results without leaving the current view',async()=>{
  await act(async()=>root.render(<App/>));
  await act(async()=>{input('  morning  ');});
  expect(host.querySelectorAll('.note-open')).toHaveLength(1);
  await act(async()=>{input('unmatched');});
  expect(host.querySelectorAll('.note-open')).toHaveLength(0);
  expect(host.textContent).toContain('No matching thoughts');
  const clear=host.querySelector<HTMLButtonElement>('[aria-label="Clear search"]')!;
  await act(async()=>clear.click());
  expect(host.querySelectorAll('.note-open')).toHaveLength(1);
  expect(document.activeElement).toBe(host.querySelector('input'));
  expect(host.querySelector('[role="status"]')?.textContent).toContain('1 Skrib shown');
});
it('gives the unsaved-changes dialog an accessible name and description',async()=>{
  await act(async()=>root.render(<App/>));
  await act(async()=>host.querySelector<HTMLButtonElement>('[aria-label="New Skrib"]')!.click());
  await act(async()=>host.querySelector<HTMLButtonElement>('[aria-label="Back to My Skribs"]')!.click());
  const dialog=host.querySelector('dialog')!;
  expect(dialog.hasAttribute('open')).toBe(true);
  expect(document.getElementById(dialog.getAttribute('aria-labelledby')!)?.textContent).toBe('Keep this thought?');
  expect(document.getElementById(dialog.getAttribute('aria-describedby')!)?.textContent).toContain("haven't been saved");
});
