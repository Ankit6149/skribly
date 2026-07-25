import React, { useEffect, useRef, useState } from 'react';

interface InkCanvasProps {
  onSave: (blob: Blob) => Promise<void> | void;
}

export const InkCanvas: React.FC<InkCanvasProps> = ({ onSave }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const drawingRef = useRef(false);
  const lastPointRef = useRef<{ x: number; y: number } | null>(null);
  const [hasInk, setHasInk] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.fillStyle = '#fffdf7';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.lineWidth = 3;
    ctx.strokeStyle = '#292b27';
  }, []);

  const pointFromEvent = (event: React.PointerEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return { x: 0, y: 0 };
    const rect = canvas.getBoundingClientRect();
    return {
      x: ((event.clientX - rect.left) / rect.width) * canvas.width,
      y: ((event.clientY - rect.top) / rect.height) * canvas.height,
    };
  };

  const handlePointerDown = (event: React.PointerEvent<HTMLCanvasElement>) => {
    event.currentTarget.setPointerCapture(event.pointerId);
    drawingRef.current = true;
    lastPointRef.current = pointFromEvent(event);
  };

  const handlePointerMove = (event: React.PointerEvent<HTMLCanvasElement>) => {
    if (!drawingRef.current) return;
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext('2d');
    const previous = lastPointRef.current;
    if (!canvas || !ctx || !previous) return;

    const next = pointFromEvent(event);
    ctx.beginPath();
    ctx.moveTo(previous.x, previous.y);
    ctx.lineTo(next.x, next.y);
    ctx.stroke();
    lastPointRef.current = next;
    setHasInk(true);
  };

  const finishStroke = (event: React.PointerEvent<HTMLCanvasElement>) => {
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
    drawingRef.current = false;
    lastPointRef.current = null;
  };

  const clearCanvas = () => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext('2d');
    if (!canvas || !ctx) return;
    ctx.fillStyle = '#fffdf7';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.strokeStyle = '#292b27';
    setHasInk(false);
  };

  const saveDrawing = async () => {
    const canvas = canvasRef.current;
    if (!canvas || !hasInk || isSaving) return;
    setIsSaving(true);
    try {
      const blob = await new Promise<Blob>((resolve, reject) => {
        canvas.toBlob((value) => {
          if (value) resolve(value);
          else reject(new Error('Unable to encode drawing.'));
        }, 'image/png');
      });
      await onSave(blob);
      setHasInk(false);
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <section className="ink-editor">
      <div className="ink-editor-heading">
        <div>
          <strong>Write or sketch</strong>
          <span>Use a mouse, touch screen, or stylus.</span>
        </div>
        <div className="ink-editor-actions">
          <button type="button" onClick={clearCanvas} disabled={!hasInk || isSaving}>
            Clear
          </button>
          <button type="button" className="primary" onClick={() => void saveDrawing()} disabled={!hasInk || isSaving}>
            {isSaving ? 'Saving…' : 'Save drawing'}
          </button>
        </div>
      </div>
      <canvas
        ref={canvasRef}
        width={1200}
        height={560}
        className="ink-canvas"
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={finishStroke}
        onPointerCancel={finishStroke}
      />
    </section>
  );
};
