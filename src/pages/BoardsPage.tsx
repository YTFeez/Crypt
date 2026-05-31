import { useCallback, useEffect, useRef, useState } from "react";
import { useAuth } from "../auth/AuthProvider";
import { getBoards, createBoard, saveBoardStrokes } from "../lib/api";
import type { Board, Stroke } from "../lib/types";
import { subscribeBoard } from "../lib/subscriptions";

export function BoardsPage() {
  const { user } = useAuth();
  const [boards, setBoards] = useState<Board[]>([]);
  const [active, setActive] = useState<Board | null>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const drawing = useRef(false);
  const points = useRef<number[]>([]);
  const strokes = useRef<Stroke[]>([]);
  const [color, setColor] = useState("#0f172a");
  const [width, setWidth] = useState(4);
  const [mode, setMode] = useState<"draw" | "erase">("draw");
  const saveTimer = useRef<ReturnType<typeof setTimeout>>();

  const reload = useCallback(async () => {
    if (!user) return;
    const list = await getBoards(user.id);
    setBoards(list);
    if (!active && list[0]) setActive(list[0]);
  }, [user, active]);

  useEffect(() => {
    void reload();
  }, [reload]);

  useEffect(() => {
    if (!active || !user) return;
    strokes.current = Array.isArray(active.strokes) ? [...active.strokes] : [];
    redraw();
    return subscribeBoard(active.id, () => {
      void getBoards(user.id).then((list) => {
        const b = list.find((x) => x.id === active.id);
        if (b) {
          strokes.current = Array.isArray(b.strokes) ? [...b.strokes] : [];
          redraw();
        }
      });
    });
  }, [active?.id, user]);

  const drawStroke = useCallback((ctx: CanvasRenderingContext2D, s: Stroke) => {
    const pts = s.points;
    if (pts.length < 4) return;
    ctx.save();
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    ctx.lineWidth = s.width;
    if (s.mode === "erase") {
      ctx.globalCompositeOperation = "destination-out";
      ctx.strokeStyle = "rgba(0,0,0,1)";
    } else {
      ctx.globalCompositeOperation = "source-over";
      ctx.strokeStyle = s.color;
    }
    ctx.beginPath();
    ctx.moveTo(pts[0], pts[1]);
    for (let i = 2; i < pts.length; i += 2) ctx.lineTo(pts[i], pts[i + 1]);
    ctx.stroke();
    ctx.restore();
  }, []);

  function redraw() {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.fillStyle = "#fff";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    for (const s of strokes.current) drawStroke(ctx, s);
  }

  function scheduleSave() {
    if (!active) return;
    clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(() => {
      void saveBoardStrokes(active.id, strokes.current);
    }, 400);
  }

  function pointerPos(e: React.PointerEvent<HTMLCanvasElement>) {
    const rect = e.currentTarget.getBoundingClientRect();
    const scaleX = e.currentTarget.width / rect.width;
    const scaleY = e.currentTarget.height / rect.height;
    return [(e.clientX - rect.left) * scaleX, (e.clientY - rect.top) * scaleY];
  }

  function onPointerDown(e: React.PointerEvent<HTMLCanvasElement>) {
    e.currentTarget.setPointerCapture(e.pointerId);
    drawing.current = true;
    points.current = pointerPos(e);
  }

  function onPointerMove(e: React.PointerEvent<HTMLCanvasElement>) {
    if (!drawing.current) return;
    const [x, y] = pointerPos(e);
    points.current.push(x, y);
    const ctx = canvasRef.current?.getContext("2d");
    if (!ctx || points.current.length < 4) return;
    const partial: Stroke = { points: [...points.current], color, width, mode };
    redraw();
    drawStroke(ctx, partial);
  }

  function onPointerUp() {
    if (!drawing.current) return;
    drawing.current = false;
    if (points.current.length >= 4) {
      strokes.current.push({ points: [...points.current], color, width, mode });
      scheduleSave();
    }
    points.current = [];
    redraw();
  }

  async function newBoard() {
    if (!user) return;
    const { data } = await createBoard(user.id, `Tableau ${boards.length + 1}`);
    if (data) {
      setBoards((b) => [data as Board, ...b]);
      setActive(data as Board);
    }
  }

  function clearBoard() {
    strokes.current = [];
    redraw();
    scheduleSave();
  }

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const resize = () => {
      const parent = canvas.parentElement;
      if (!parent) return;
      canvas.width = parent.clientWidth;
      canvas.height = Math.max(400, window.innerHeight - 280);
      redraw();
    };
    resize();
    window.addEventListener("resize", resize);
    return () => window.removeEventListener("resize", resize);
  }, [active]);

  return (
    <>
      <header className="page-header row" style={{ justifyContent: "space-between" }}>
        <div>
          <h1>Tableaux collaboratifs</h1>
          <p>Dessinez en équipe — synchronisation temps réel via Supabase.</p>
        </div>
        <button type="button" className="btn btn-primary" onClick={() => void newBoard()}>
          + Nouveau tableau
        </button>
      </header>

      <div className="split">
        <div className="panel">
          <div className="panel-header"><strong>Tableaux</strong></div>
          <div className="panel-body" style={{ padding: "0.5rem" }}>
            {boards.map((b) => (
              <button
                key={b.id}
                type="button"
                className={`list-item${b.id === active?.id ? " active" : ""}`}
                onClick={() => setActive(b)}
              >
                ✏️ {b.name}
              </button>
            ))}
          </div>
        </div>

        <div className="panel">
          {active ? (
            <>
              <div className="toolbar">
                <input type="color" value={color} onChange={(e) => setColor(e.target.value)} title="Couleur" />
                <input type="range" min={1} max={24} value={width} onChange={(e) => setWidth(Number(e.target.value))} />
                <button type="button" className={`btn btn-sm ${mode === "draw" ? "btn-primary" : "btn-ghost"}`} onClick={() => setMode("draw")}>
                  Crayon
                </button>
                <button type="button" className={`btn btn-sm ${mode === "erase" ? "btn-primary" : "btn-ghost"}`} onClick={() => setMode("erase")}>
                  Gomme
                </button>
                <button type="button" className="btn btn-ghost btn-sm" onClick={clearBoard}>
                  Effacer
                </button>
                <span className="badge">{active.is_shared ? "Collaboratif" : "Personnel"}</span>
              </div>
              <div className="canvas-wrap">
                <canvas
                  ref={canvasRef}
                  onPointerDown={onPointerDown}
                  onPointerMove={onPointerMove}
                  onPointerUp={onPointerUp}
                  onPointerLeave={onPointerUp}
                />
              </div>
            </>
          ) : (
            <div className="empty-state">Créez un tableau pour commencer</div>
          )}
        </div>
      </div>
    </>
  );
}
