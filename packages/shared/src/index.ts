export type SkribKind =
  | "note"
  | "ink"
  | "highlight"
  | "arrow"
  | "pin"
  | "checklist"
  | "reminder";

export interface NormalizedPoint {
  x: number;
  y: number;
}

export interface AppIdentity {
  platform: "windows" | "macos";
  executablePath?: string;
  bundleId?: string;
  displayName: string;
}

export interface ContextAnchor {
  app: AppIdentity;
  windowTitlePattern?: string;
  documentPathHash?: string;
  normalizedPosition: NormalizedPoint;
  browser?: {
    urlPattern: string;
    selector?: string;
    nearbyTextHash?: string;
  };
}
