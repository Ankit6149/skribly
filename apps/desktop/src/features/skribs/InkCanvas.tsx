import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Eraser, Highlighter, MousePointer2, PenLine, Redo2, Trash2, Undo2, X } from 'lucide-react';
import {
  countInkPoints,
  createInkStroke,
  findTopInkStroke,
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
  variant?: 'panel' | 'overlay';
}

const PEN_COLORS = [
  { value: '#262923', label: 'Ink' },
  { value: '#536a4f', label: 'Olive' },
  { value: '#315f78', label: 'Blue' },
  { value: '#854040', label: 'Berry' },
] as const;
const HIGHLIGHTER_COLORS = [
  { value: '#f4d84e', label: 'Sunshine' },
  { value: '#ff9f80', label: 'Peach' },
  { value: '#82cf9b', label: 'Mint' },
  { value: '#86b9e8', label: 'Sky' },
  { value: '#bd9bea', label: 'Lavender' },
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
  context.globalAlpha = stroke.tool === 'highlighter' ? 0.26 : 1;
  context.strokeStyle = stroke.color;
  context.fillStyle = stroke.color;
  const displayScale = canvas.clientWidth > 0 ? canvas.width / canvas.clientWidth : 1;
  context.lineWidth = stroke.width * displayScale * (stroke.tool === 'highlighter' ? 3.2 : 1);

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
  variant = 'panel',
}) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const activeStrokeRef = useRef<InkStroke | null>(null);
  const selectionDragRef = useRef<{
    strokeId: string;
    startX: number;
    startY: number;
    originalPoints: InkStroke['points'];
    preview: InkStroke[];
  } | null>(null);
  const pendingOperationsRef = useRef(0);
  const undoHistoryRef = useRef<InkStroke[][]>([]);
  const redoHistoryRef = useRef<InkStroke[][]>([]);
  const [persistenceCoordinator] = useState(() => new InkPersistenceCoordinator(initialStrokes));
  const [strokes, setStrokes] = useState<InkStroke[]>(
    () => persistenceCoordinator.getSnapshot().strokes
  );
  const [tool, setTool] = useState<InkTool>('pen');
  const [interactionMode, setInteractionMode] = useState<'select' | 'draw'>('draw');
  const [selectedStrokeId, setSelectedStrokeId] = useState<string | null>(null);
  const [color, setColor] = useState<string>(PEN_COLORS[0].value);
  const [width, setWidth] = useState(4);
  const [clearPending, setClearPending] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [historyRevision, setHistoryRevision] = useState(0);

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
    const canvas = canvasRef.current;
    const frame = canvas?.parentElement;
    if (!canvas || !frame) return;
    const resize = () => {
      const bounds = frame.getBoundingClientRect();
      const pixelRatio = Math.min(2, window.devicePixelRatio || 1);
      const width = Math.max(1, Math.round(bounds.width * pixelRatio));
      const height = Math.max(1, Math.round(bounds.height * pixelRatio));
      if (canvas.width !== width || canvas.height !== height) {
        canvas.width = width;
        canvas.height = height;
      }
      renderStrokes(persistenceCoordinator.getSnapshot().strokes);
    };
    const observer = new ResizeObserver(resize);
    observer.observe(frame);
    resize();
    return () => observer.disconnect();
  }, [persistenceCoordinator, renderStrokes]);

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

  const commit = useCallback((nextStrokes: InkStroke[], recordHistory = true) => {
    const currentStrokes = persistenceCoordinator.getSnapshot().strokes;
    if (recordHistory) {
      undoHistoryRef.current.push(currentStrokes);
      if (undoHistoryRef.current.length > 80) undoHistoryRef.current.shift();
      redoHistoryRef.current = [];
      setHistoryRevision((value) => value + 1);
    }
    void persist(nextStrokes);
  }, [persist, persistenceCoordinator]);

  const handlePointerDown = (event: React.PointerEvent<HTMLCanvasElement>) => {
    if (disabled || (event.pointerType === 'mouse' && event.button !== 0)) return;
    event.preventDefault();
    event.currentTarget.focus({ preventScroll: true });
    const currentStrokes = persistenceCoordinator.getSnapshot().strokes;
    if (interactionMode === 'select') {
      const rect = event.currentTarget.getBoundingClientRect();
      const x = (event.clientX - rect.left) / rect.width;
      const y = (event.clientY - rect.top) / rect.height;
      const threshold = Math.max(0.012, 12 / Math.max(1, Math.min(rect.width, rect.height)));
      const selected = findTopInkStroke(currentStrokes, x, y, threshold);
      setSelectedStrokeId(selected?.id ?? null);
      if (selected) {
        selectionDragRef.current = {
          strokeId: selected.id,
          startX: x,
          startY: y,
          originalPoints: selected.points.map((point) => ({ ...point })),
          preview: currentStrokes,
        };
        event.currentTarget.setPointerCapture(event.pointerId);
      }
      return;
    }
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
    const selection = selectionDragRef.current;
    if (selection && interactionMode === 'select' && !disabled) {
      const rect = event.currentTarget.getBoundingClientRect();
      const x = (event.clientX - rect.left) / rect.width;
      const y = (event.clientY - rect.top) / rect.height;
      const deltaX = x - selection.startX;
      const deltaY = y - selection.startY;
      selection.preview = persistenceCoordinator.getSnapshot().strokes.map((stroke) =>
        stroke.id === selection.strokeId
          ? {
              ...stroke,
              points: selection.originalPoints.map((point) => ({
                ...point,
                x: Math.min(1, Math.max(0, point.x + deltaX)),
                y: Math.min(1, Math.max(0, point.y + deltaY)),
              })),
            }
          : stroke
      );
      renderStrokes(selection.preview);
      return;
    }
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
    const rect = event.currentTarget.getBoundingClientRect();
    const samples = event.nativeEvent.getCoalescedEvents?.() ?? [event.nativeEvent];
    for (const sample of samples) {
      if (activeStroke.points.length >= MAX_INK_STROKE_POINTS) break;
      const point = normalizeInkPoint(sample.clientX, sample.clientY, rect, sample.pressure);
      const previous = activeStroke.points.at(-1);
      if (!previous || Math.hypot(point.x - previous.x, point.y - previous.y) >= 0.001) {
        activeStroke.points.push(point);
      }
    }
    renderStrokes([...currentStrokes, activeStroke]);
  };

  const finishStroke = (event: React.PointerEvent<HTMLCanvasElement>) => {
    const selection = selectionDragRef.current;
    selectionDragRef.current = null;
    const activeStroke = activeStrokeRef.current;
    activeStrokeRef.current = null;
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
    if (selection && interactionMode === 'select' && !disabled) {
      commit(selection.preview);
      return;
    }
    if (!activeStroke || disabled) return;
    commit([...persistenceCoordinator.getSnapshot().strokes, activeStroke]);
  };

  const undo = () => {
    const currentStrokes = persistenceCoordinator.getSnapshot().strokes;
    if (currentStrokes.length === 0 || disabled) return;
    setClearPending(false);
    const previous = undoHistoryRef.current.pop() ?? currentStrokes.slice(0, -1);
    redoHistoryRef.current.push(currentStrokes);
    setSelectedStrokeId(null);
    setHistoryRevision((value) => value + 1);
    void persist(previous);
  };

  const redo = () => {
    if (disabled) return;
    const next = redoHistoryRef.current.pop();
    if (!next) return;
    undoHistoryRef.current.push(persistenceCoordinator.getSnapshot().strokes);
    setSelectedStrokeId(null);
    setHistoryRevision((value) => value + 1);
    void persist(next);
  };

  const deleteSelected = () => {
    if (disabled || !selectedStrokeId) return;
    const currentStrokes = persistenceCoordinator.getSnapshot().strokes;
    commit(currentStrokes.filter((stroke) => stroke.id !== selectedStrokeId));
    setSelectedStrokeId(null);
  };

  const clear = () => {
    if (disabled || persistenceCoordinator.getSnapshot().strokes.length === 0) return;
    if (!clearPending) {
      setClearPending(true);
      return;
    }
    setClearPending(false);
    commit([]);
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
  const activeColors = tool === 'highlighter' ? HIGHLIGHTER_COLORS : PEN_COLORS;

  return (
    <section className={`ink-editor ink-editor-${variant}`} aria-label="Skribli drawing editor">
      <div className="ink-editor-toolbar">
        <button
          type="button"
          className={`ink-icon-tool ${interactionMode === 'select' ? 'active' : ''}`}
          aria-pressed={interactionMode === 'select'}
          aria-label="Select and move a stroke"
          disabled={disabled}
          onClick={() => setInteractionMode('select')}
          title="Select and move a stroke"
        >
          <MousePointer2 size={14} aria-hidden="true" />
          <span className="ink-tool-label">Select</span>
        </button>
        <div className="ink-tool-group" role="group" aria-label="Drawing tool">
          {(['pen', 'highlighter', 'eraser'] as const).map((value) => (
            <button
              key={value}
              type="button"
              className={`ink-icon-tool ${tool === value ? 'active' : ''}`}
              aria-pressed={tool === value}
              aria-label={value === 'pen' ? 'Pen' : value === 'highlighter' ? 'Highlighter' : 'Eraser'}
              title={value === 'pen' ? 'Pen' : value === 'highlighter' ? 'Highlighter' : 'Eraser'}
              disabled={disabled}
              onClick={() => {
                setTool(value);
                if (value === 'highlighter') setColor(HIGHLIGHTER_COLORS[0].value);
                if (value === 'pen') setColor(PEN_COLORS[0].value);
                setInteractionMode('draw');
                setSelectedStrokeId(null);
              }}
            >
              {value === 'pen' ? <PenLine size={14} aria-hidden="true" /> : value === 'highlighter' ? <Highlighter size={14} aria-hidden="true" /> : <Eraser size={14} aria-hidden="true" />}
              <span className="ink-tool-label">
                {value === 'pen' ? 'Pen' : value === 'highlighter' ? 'Highlight' : 'Eraser'}
              </span>
            </button>
          ))}
        </div>
        <div className="ink-color-group" role="group" aria-label="Ink color">
          {activeColors.map((option) => (
            <button
              key={option.value}
              type="button"
              className={color === option.value ? 'active' : ''}
              aria-label={option.label}
              aria-pressed={color === option.value}
              disabled={disabled || tool === 'eraser'}
              style={{ '--ink-swatch': option.value } as React.CSSProperties}
              onClick={() => setColor(option.value)}
              title={`${option.label} ${tool === 'highlighter' ? 'highlight' : 'ink'}`}
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
          <button
            type="button"
            className="ink-icon-tool"
            aria-label="Undo last stroke"
            title="Undo"
            onClick={undo}
            disabled={disabled || strokes.length === 0}
          >
            <Undo2 size={14} aria-hidden="true" />
            <span className="ink-tool-label">Undo</span>
          </button>
          <button
            type="button"
            className="ink-icon-tool"
            aria-label="Redo stroke"
            title="Redo"
            onClick={redo}
            disabled={disabled || redoHistoryRef.current.length === 0}
            data-history-revision={historyRevision}
          >
            <Redo2 size={14} aria-hidden="true" />
            <span className="ink-tool-label">Redo</span>
          </button>
          {selectedStrokeId && (
            <button
              type="button"
              className="ink-icon-tool danger"
              aria-label="Delete selected stroke"
              title="Remove selected stroke"
              onClick={deleteSelected}
              disabled={disabled}
            >
              <X size={14} aria-hidden="true" />
              <span className="ink-tool-label">Remove</span>
            </button>
          )}
          <button
            type="button"
            className={`ink-icon-tool ${clearPending ? 'danger' : ''}`}
            aria-label={clearPending ? 'Confirm clearing every stroke' : 'Clear drawing'}
            title={clearPending ? 'Click again to clear every stroke' : 'Clear drawing'}
            onClick={clear}
            disabled={disabled || strokes.length === 0}
          >
            <Trash2 size={14} aria-hidden="true" />
            <span className="ink-tool-label">{clearPending ? 'Clear all?' : 'Clear'}</span>
          </button>
          {onSavePreview && variant === 'panel' && (
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
          className="ink-canvas"
          tabIndex={disabled ? -1 : 0}
          data-interaction={interactionMode}
          data-selected-stroke={selectedStrokeId ?? undefined}
          aria-label="Draw with a mouse, touchpad, touch screen, or pen"
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
          onPointerUp={finishStroke}
          onPointerCancel={finishStroke}
          onLostPointerCapture={(event) => {
            if (activeStrokeRef.current || selectionDragRef.current) finishStroke(event);
          }}
          onKeyDown={(event) => {
            if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'z') {
              event.preventDefault();
              if (event.shiftKey) redo();
              else undo();
            } else if ((event.key === 'Delete' || event.key === 'Backspace') && selectedStrokeId) {
              event.preventDefault();
              deleteSelected();
            }
          }}
        />
      </div>
      <div className="ink-editor-status" role="status" aria-live="polite">
        <span>
          {selectedStrokeId
            ? 'Stroke selected · drag to move · Delete to remove'
            : `${strokes.length.toLocaleString()} strokes · ${pointCount.toLocaleString()} points`}
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
