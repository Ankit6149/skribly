import type React from 'react';

type DockSide = 'left' | 'right';

type LauncherDragProps = Pick<
  React.ButtonHTMLAttributes<HTMLButtonElement>,
  'onMouseDown' | 'onPointerDown' | 'onPointerMove' | 'onPointerUp' | 'onPointerCancel' | 'onClick'
>;

export function GlobalWidgetLauncher({
  buttonRef,
  dockSide,
  pillCount,
  message,
  dragProps,
}: {
  buttonRef: React.Ref<HTMLButtonElement>;
  dockSide: DockSide;
  pillCount: number;
  message: string | null;
  dragProps: LauncherDragProps;
}) {
  return (
    <main className={`context-rail collapsed global-widget dock-${dockSide}`}>
      <button
        ref={buttonRef}
        type="button"
        className="context-rail-global-widget"
        {...dragProps}
        aria-label={`Open My Skribs, ${pillCount} saved ${pillCount === 1 ? 'Skrib' : 'Skribs'}`}
        title={message || 'Your Skribs are right here. Click to open; double-click and drag to move.'}
      >
        <span className="global-widget-strip strip-yellow" aria-hidden="true" />
        <span className="global-widget-strip strip-peach" aria-hidden="true" />
        <span className="global-widget-strip strip-lavender" aria-hidden="true" />
      </button>
    </main>
  );
}

export function ContextWidgetLauncher({
  buttonRef,
  dockSide,
  pillCount,
  revealed,
  message,
  dragProps,
  onEscape,
  onPresencePointer,
  onPresenceFocus,
  onPresenceHold,
}: {
  buttonRef: React.Ref<HTMLButtonElement>;
  dockSide: DockSide;
  pillCount: number;
  revealed: boolean;
  message: string | null;
  dragProps: LauncherDragProps;
  onEscape: React.KeyboardEventHandler<HTMLElement>;
  onPresencePointer: (active: boolean) => void;
  onPresenceFocus: (active: boolean) => void;
  onPresenceHold: (active: boolean) => void;
}) {
  return (
    <main
      className={`context-rail collapsed context-widget dock-${dockSide} ${revealed ? 'is-revealed' : ''}`}
      onKeyDown={onEscape}
    >
      <button
        ref={buttonRef}
        type="button"
        className="context-presence"
        {...dragProps}
        onPointerEnter={() => onPresencePointer(true)}
        onPointerLeave={() => onPresencePointer(false)}
        onPointerDown={(event) => {
          onPresenceHold(true);
          dragProps.onPointerDown?.(event);
        }}
        onPointerUp={(event) => {
          dragProps.onPointerUp?.(event);
          onPresenceHold(false);
        }}
        onPointerCancel={(event) => {
          dragProps.onPointerCancel?.(event);
          onPresenceHold(false);
        }}
        onFocus={() => onPresenceFocus(true)}
        onBlur={() => {
          onPresenceFocus(false);
          onPresenceHold(false);
        }}
        aria-expanded={false}
        aria-label={`Open ${pillCount} ${pillCount === 1 ? 'Skrib' : 'Skribs'} here`}
        title={message || 'A thought lives here. Click to unfold it; double-click and drag to move.'}
      >
        <span className="context-presence-label" aria-hidden="true">
          {pillCount} {pillCount === 1 ? 'Skrib' : 'Skribs'} here
        </span>
        <span className="context-presence-dot" aria-hidden="true" />
      </button>
    </main>
  );
}
