import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  countInkPoints,
  createInkStroke,
  MAX_INK_POINTS,
  MAX_INK_STROKE_POINTS,
  MAX_INK_STROKES,
  normalizeInkPoint,
  validateInkStrokes,
  type InkStroke,
  type InkTool,
} from './inkModel';
import {
  InkPersistenceCoordinator,
  type InkPersistenceState,
} from './inkPersistenceCoordinator';

export type { InkPersistenceState } from './inkPersistenceCoordinator';

export interface InkCanvasProps {
  initialStrokes?: InkStroke[];
  disabled?: boolean;
  onChange?: (strokes: InkStroke[]) => Promise<void> | void;
  onSavePreview?: (blob: Blob, strokes: InkStroke[]) => Promise<void> | void;
  onBusyChange?: (busy: boolean) => void;
  onPersistenceStateChange?: (state: InkPersistenceState) => void;
}

const INK_COLORS = [
  { value: '#262923', label: 'Ink' },
  { value: '#536a4f', label: 'Olive' },
  { value: '#315f78', label: 'Blue' },
  { value: '#854040', label: 'Berry' },
] as const;

const EMPTY_STROKES: InkStroke[] = [];

function createId(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return `stroke-${crypto.randomUUID()}`;
  }
  return `stroke-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function drawStroke(
  context: CanvasRenderingContext2D,
  canvas: HTMLCanvasElement,
  stroke: InkStroke
): void {
  if (stroke.points.length === 0) return;
  context.save();
  context.lineCap = 'round';
  context.lineJoin = 'round';
  context.globalCompositeOperation = stroke.tool === 'eraser' ? 'destination-out' : 'source-over';
  context.globalAlpha = stroke.tool === 'highlighter' ? 0.34 : 1;
  context.strokeStyle = stroke.color;
  context.fillStyle = stroke.color;
  context.lineWidth = stroke.width * (stroke.tool === 'highlighter' ? 2.4 : 1);

  const first = stroke.points[0]!;
  const firstX = first.x * canvas.width;
  const firstY = first.y * canvas.height;
  if (stroke.points.length === 1) {
    context.beginPath();
    context.arc(firstX, firstY, Math.max(1, context.lineWidth / 2), 0, Math.PI * 2);
    context.fill();
    context.restore();
    return;
  }

  context.beginPath();
  context.moveTo(firstX, firstY);
  for (const point of stroke.points.slice(1)) {
    context.lineTo(point.x * canvas.width, point.y * canvas.height);
  }
  context.stroke();
  context.restore();
}

export const InkCanvas: React.FC<InkCanvasProps> = ({
  initialStrokes = EMPTY_STROKES,
  disabled = false,
  onChange,
  onSavePreview,
  onBusyChange,
  onPersistenceStateChange,
}) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const activeStrokeRef = useRef<InkStroke | null>(null);
  const pendingOperationsRef = useRef(0);
  const [persistenceCoordinator] = useState(() => new InkPersistenceCoordinator(initialStrokes));
  const [strokes, setStrokes] = useState<InkStroke[]>(
    () => persistenceCoordinator.getSnapshot().strokes
  );
  const [tool, setTool] = useState<InkTool>('pen');
  const [color, setColor] = useState<string>(INK_COLORS[0].value);
  const [width, setWidth] = useState(4);
  const [clearPending, setClearPending] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const beginOperation = useCallback(() => {
    pendingOperationsRef.current += 1;
    if (pendingOperationsRef.current === 1) onBusyChange?.(true);
  }, [onBusyChange]);

  const endOperation = useCallback(() => {
    pendingOperationsRef.current = Math.max(0, pendingOperationsRef.current - 1);
    if (pendingOperationsRef.current === 0) onBusyChange?.(false);
  }, [onBusyChange]);

  useEffect(
    () => () => {
      pendingOperationsRef.current = 0;
      onBusyChange?.(false);
    },
    [onBusyChange]
  );

  useEffect(() => {
    persistenceCoordinator.setListener((snapshot) => {
      setStrokes(snapshot.strokes);
      if (snapshot.error) setError(snapshot.error);
      onPersistenceStateChange?.({
        status: snapshot.status,
        hasUnsavedChanges: snapshot.hasUnsavedChanges,
        error: snapshot.error,
      });
    });
    return () => persistenceCoordinator.setListener();
  }, [onPersistenceStateChange, persistenceCoordinator]);

  const renderStrokes = useCallback((nextStrokes: InkStroke[]) => {
    const canvas = canvasRef.current;
    const context = canvas?.getContext('2d');
    if (!canvas || !context) return;
    context.clearRect(0, 0, canvas.width, canvas.height);
    nextStrokes.forEach((stroke) => drawStroke(context, canvas, stroke));
  }, []);

  useEffect(() => {
    renderStrokes(strokes);
  }, [renderStrokes, strokes]);

  useEffect(() => {
    validateInkStrokes(initialStrokes);
    if (persistenceCoordinator.acceptInitialStrokes(initialStrokes)) {
      setClearPending(false);
      setError(null);
    }
  }, [initialStrokes, persistenceCoordinator]);

  const persist = useCallback(
    async (nextStrokes: InkStroke[]) => {
      beginOperation();
      try {
        validateInkStrokes(nextStrokes);
        setError(null);
        const saved = await persistenceCoordinator.submit(nextStrokes, async (strokesToSave) => {
          await onChange?.(strokesToSave);
        });
        if (!saved) {
          setError(
            persistenceCoordinator.getSnapshot().error ??
              'Skribli could not save the latest drawing.'
          );
        }
      } catch (reason) {
        setError(reason instanceof Error ? reason.message : String(reason));
      } finally {
        endOperation();
      }
    },
    [beginOperation, endOperation, onChange, persistenceCoordinator]
  );

  const handlePointerDown = (event: React.PointerEvent<HTMLCanvasElement>) => {
    if (disabled) return;
    const currentStrokes = persistenceCoordinator.getSnapshot().strokes;
    if (
      currentStrokes.length >= MAX_INK_STROKES ||
      countInkPoints(currentStrokes) >= MAX_INK_POINTS
    ) {
      setError('This drawing has reached its safe local size limit. Undo a stroke to continue.');
      return;
    }

    const point = normalizeInkPoint(
      event.clientX,
      event.clientY,
      event.currentTarget.getBoundingClientRect(),
      event.pressure
    );
    activeStrokeRef.current = createInkStroke(
      createId(),
      tool,
      color,
      tool === 'eraser' ? Math.max(14, width * 3) : width,
      point
    );
    event.currentTarget.setPointerCapture(event.pointerId);
    setClearPending(false);
    setError(null);
  };

  const handlePointerMove = (event: React.PointerEvent<HTMLCanvasElement>) => {
    const activeStroke = activeStrokeRef.current;
    if (!activeStroke || disabled) return;
    const currentStrokes = persistenceCoordinator.getSnapshot().strokes;
    if (
      activeStroke.points.length >= MAX_INK_STROKE_POINTS ||
      countInkPoints(currentStrokes) + activeStroke.points.length >= MAX_INK_POINTS
    ) {
      setError('This drawing has reached its safe local size limit.');
      return;
    }
    const point = normalizeInkPoint(
      event.clientX,
      event.clientY,
      event.currentTarget.getBoundingClientRect(),
      event.pressure
    );
    const previous = activeStroke.points.at(-1);
    if (previous && Math.hypot(point.x - previous.x, point.y - previous.y) < 0.001) return;
    activeStroke.points.push(point);
    renderStrokes([...currentStrokes, activeStroke]);
  };

  const finishStroke = (event: React.PointerEvent<HTMLCanvasElement>) => {
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
    const activeStroke = activeStrokeRef.current;
    activeStrokeRef.current = null;
    if (!activeStroke || disabled) return;
    void persist([...persistenceCoordinator.getSnapshot().strokes, activeStroke]);
  };

  const undo = () => {
    const currentStrokes = persistenceCoordinator.getSnapshot().strokes;
    if (currentStrokes.length === 0 || disabled) return;
    setClearPending(false);
    void persist(currentStrokes.slice(0, -1));
  };

  const clear = () => {
    if (disabled || persistenceCoordinator.getSnapshot().strokes.length === 0) return;
    if (!clearPending) {
      setClearPending(true);
      return;
    }
    setClearPending(false);
    void persist([]);
  };

  const savePreview = async () => {
    const canvas = canvasRef.current;
    const currentStrokes = persistenceCoordinator.getSnapshot().strokes;
    if (!canvas || currentStrokes.length === 0 || !onSavePreview || isSaving) return;
    setIsSaving(true);
    setError(null);
    beginOperation();
    try {
      const blob = await new Promise<Blob>((resolve, reject) => {
        canvas.toBlob((value) => {
          if (value) resolve(value);
          else reject(new Error('Skribli could not encode the drawing preview.'));
        }, 'image/png');
      });
      await onSavePreview(blob, currentStrokes);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : String(reason));
    } finally {
      endOperation();
      setIsSaving(false);
    }
  };

  const pointCount = useMemo(() => countInkPoints(strokes), [strokes]);

  return (
    <section className="ink-editor" aria-label="Skribli drawing editor">
      <div className="ink-editor-toolbar">
        <div className="ink-tool-group" role="group" aria-label="Drawing tool">
          {(['pen', 'highlighter', 'eraser'] as const).map((value) => (
            <button
              key={value}
              type="button"
              className={tool === value ? 'active' : ''}
              aria-pressed={tool === value}
              disabled={disabled}
              onClick={() => setTool(value)}
            >
              {value === 'pen' ? 'Pen' : value === 'highlighter' ? 'Highlight' : 'Eraser'}
            </button>
          ))}
        </div>
        <div className="ink-color-group" role="group" aria-label="Ink color">
          {INK_COLORS.map((option) => (
            <button
              key={option.value}
              type="button"
              className={color === option.value ? 'active' : ''}
              aria-label={option.label}
              aria-pressed={color === option.value}
              disabled={disabled || tool === 'eraser'}
              style={{ '--ink-swatch': option.value } as React.CSSProperties}
              onClick={() => setColor(option.value)}
            />
          ))}
        </div>
        <label className="ink-width-control">
          <span>Size</span>
          <input
            type="range"
            min="2"
            max="12"
            value={width}
            disabled={disabled}
            onChange={(event) => setWidth(Number(event.target.value))}
          />
        </label>
        <div className="ink-history-actions">
          <button type="button" onClick={undo} disabled={disabled || strokes.length === 0}>
            Undo
          </button>
          <button
            type="button"
            className={clearPending ? 'danger' : ''}
            onClick={clear}
            disabled={disabled || strokes.length === 0}
          >
            {clearPending ? 'Clear all?' : 'Clear'}
          </button>
          {onSavePreview && (
            <button
              type="button"
              className="primary"
              onClick={() => void savePreview()}
              disabled={disabled || strokes.length === 0 || isSaving}
            >
              {isSaving ? 'Saving…' : 'Save preview'}
            </button>
          )}
        </div>
      </div>
      <div className="ink-canvas-frame">
        <canvas
          ref={canvasRef}
          width={1200}
          height={720}
          className="ink-canvas"
          aria-label="Draw with a mouse, touchpad, touch screen, or pen"
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
          onPointerUp={finishStroke}
          onPointerCancel={finishStroke}
        />
      </div>
      <div className="ink-editor-status" role="status" aria-live="polite">
        <span>
          {strokes.length.toLocaleString()} strokes · {pointCount.toLocaleString()} points
        </span>
        <span>Mouse, touchpad, touch, and pen supported</span>
      </div>
      {error && (
        <div className="ink-editor-error" role="alert">
          {error}
        </div>
      )}
    </section>
  );
};
