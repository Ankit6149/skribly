// @vitest-environment jsdom
import React, { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { HomeHost } from './HomeHost';
import { useAccountStore } from './state/accountStore';
import { useLicenseStore, type LicenseStatus } from '../licensing/state/licenseStore';
import { completeOnboarding } from '../onboarding/onboardingState';

vi.mock('@tauri-apps/api/event', () => ({ listen:vi.fn(async()=>()=>undefined), emit:vi.fn(async()=>undefined) }));
vi.mock('@tauri-apps/api/window', () => ({ getCurrentWindow:()=>({hide:vi.fn(async()=>undefined)}) }));
vi.mock('@tauri-apps/api/core', () => ({ invoke:vi.fn(async(command:string)=>command==='get_all_skribs'?[]:{writable:true}) }));
vi.mock('../reminders/notifications/ReminderNotificationMonitor', () => ({ReminderNotificationMonitor:()=>null}));
const originalAccount = useAccountStore.getState();
const originalLicense = useLicenseStore.getState();
let host:HTMLDivElement, root:Root;
let initialize=vi.fn(async()=>undefined);
const status:LicenseStatus={mode:'community',enforcementEnabled:false,canWrite:true,trialDaysTotal:0,trialDaysRemaining:0,trialExpiresAt:null,deviceId:'',licensedEmail:null,updatesUntil:null,message:'Community · local notes without an account.'};
beforeEach(()=>{
  Object.assign(globalThis,{IS_REACT_ACT_ENVIRONMENT:true});
  localStorage.clear();completeOnboarding(localStorage);
  host=document.createElement('div');document.body.append(host);root=createRoot(host);
  initialize=vi.fn(async()=>undefined);
  useAccountStore.setState({...originalAccount,phase:'signedOut',email:'stale@example.test',entitlement:null,init:initialize});
  useLicenseStore.setState({...originalLicense,status,isReady:true,hasNativeStatus:true});
});
afterEach(async()=>{
  await act(async()=>root.unmount());host.remove();localStorage.clear();
  useAccountStore.setState(originalAccount);useLicenseStore.setState(originalLicense);
});
it('opens Community without initializing an account and hides stale account identity',async()=>{
  await act(async()=>root.render(<HomeHost/>));
  expect(initialize).not.toHaveBeenCalled();
  expect(useAccountStore.getState().phase).toBe('signedOut');
  expect(host.textContent).toContain('Community');
  expect(host.textContent).not.toContain('stale@example.test');
  expect(host.textContent).not.toContain('Manage account');
  const ready=Array.from(host.querySelectorAll('button')).find(x=>x.textContent==='Hide Skribli and return to work')!;
  expect(ready.disabled).toBe(false);
  await act(async()=>host.querySelector<HTMLButtonElement>('[aria-label="Settings"]')!.click());
  await act(async()=>Array.from(host.querySelectorAll('button')).find(x=>x.textContent==='Edition')!.click());
  expect(host.textContent).toContain('without an account or a trial');
  expect(host.textContent).not.toContain('Sign out');
});
it('still initializes the account-enabled edition after native identity is known',async()=>{
  useLicenseStore.setState({status:{...status,mode:'account_required',enforcementEnabled:true,canWrite:false}});
  await act(async()=>root.render(<HomeHost/>));
  expect(initialize).toHaveBeenCalledOnce();
  expect(host.textContent).toContain('Manage account');
  expect(host.textContent).toContain('Writing is unavailable');
});
it('does not guess an edition or contact account services when native status fails',async()=>{
  useLicenseStore.setState({hasNativeStatus:false,errorMessage:'Native status unavailable'});
  await act(async()=>root.render(<HomeHost/>));
  expect(initialize).not.toHaveBeenCalled();
  expect(host.textContent).toContain('Retry desktop check');
  expect(host.textContent).not.toContain('without an account or a trial');
});
