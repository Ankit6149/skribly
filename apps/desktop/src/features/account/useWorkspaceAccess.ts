import { useAccountStore } from './state/accountStore';
import { useLicenseStore } from '../licensing/state/licenseStore';

/** Local workspace readiness is separate from verified commercial account identity. */
export function useWorkspaceAccess() {
  const account = useAccountStore();
  const status = useLicenseStore((state) => state.status);
  const nativeReady = useLicenseStore((state) => state.hasNativeStatus);
  const isCommunity = nativeReady && status.mode === 'community';
  return {
    ...account,
    isCommunity,
    nativeReady,
    workspaceReady: isCommunity || account.phase === 'ready',
    email: isCommunity ? null : account.email,
    accountRole: isCommunity ? null : account.accountRole,
    entitlement: isCommunity ? status : account.entitlement,
    announcements: isCommunity ? [] : account.announcements,
  };
}
