// src/App.jsx
import React, { useState, useRef, useEffect, useMemo } from "react";
import "./index.css";
import { flipLayers } from "./utils/flipLayers";

const CANVAS_SIZE = 700;
const TOTAL_SHAPES = 114;

const BALL_RADIUS_UNITS = 50;
const BALL_RADIUS_PX = CANVAS_SIZE / 2;
const PX_PER_UNIT = BALL_RADIUS_PX / BALL_RADIUS_UNITS;

// const BONK_SCALE_FACTOR = 24.24;
// const BONK_X_POS_FACTOR = 22.26;
// const BONK_Y_POS_FACTOR = 21.26;

const BONK_SCALE_FACTOR = 21.5;
const BONK_X_POS_FACTOR = 21.56;
const BONK_Y_POS_FACTOR = 21.56;

const svgCache = new Map();

async function loadAndNormalizeSvg(id) {
  if (svgCache.has(id)) return svgCache.get(id);
  const raw = await fetch(`/output_shapes/${id}.svg`).then((r) => r.text());
  const doc = new DOMParser().parseFromString(raw, "image/svg+xml");
  const root = doc.documentElement;

  const walk = (el) => {
    if (el.hasAttribute("fill")) {
      const f = el.getAttribute("fill");
      if (f && f.toLowerCase() !== "none")
        el.setAttribute("fill", "currentColor");
    }
    if (el.hasAttribute("stroke")) {
      const s = el.getAttribute("stroke");
      if (s && s.toLowerCase() !== "none")
        el.setAttribute("stroke", "currentColor");
    }
    if (el.hasAttribute("style")) {
      let style = el.getAttribute("style");
      style = style
        .replace(/fill\s*:\s*(?!none)[^;]+/gi, "fill:currentColor")
        .replace(/stroke\s*:\s*(?!none)[^;]+/gi, "stroke:currentColor");
      el.setAttribute("style", style);
    }
    for (const child of el.children || []) walk(child);
  };
  walk(root);

  let minX = 0,
    minY = 0,
    vbW = 0,
    vbH = 0;
  if (root.hasAttribute("viewBox")) {
    const parts = root
      .getAttribute("viewBox")
      .trim()
      .split(/[ ,]+/)
      .map(parseFloat);
    [minX, minY, vbW, vbH] = parts.length === 4 ? parts : [0, 0, 50, 50];
  } else {
    vbW = parseFloat(root.getAttribute("width")) || 50;
    vbH = parseFloat(root.getAttribute("height")) || 50;
  }

  const cx = minX + vbW / 2;
  const cy = minY + vbH / 2;
  const inner = root.innerHTML;
  const html = `<g transform="translate(${-cx},${-cy})">${inner}</g>`;
  const meta = { html, w: vbW, h: vbH };
  svgCache.set(id, meta);
  return meta;
}

function ShapeProperties({ shape, index, shapes, updateShape, moveShapeUp, moveShapeDown, setShapes, setSelectedIndices }) {
  const [localScale, setLocalScale] = React.useState(shape.scale);
  const [localAngle, setLocalAngle] = React.useState(shape.angle);
  const [localX, setLocalX] = React.useState(shape.x);
  const [localY, setLocalY] = React.useState(shape.y);

  React.useEffect(() => {
    setLocalScale(shape.scale);
    setLocalAngle(shape.angle);
    setLocalX(shape.x);
    setLocalY(shape.y);
  }, [index, shape]);

  return (
    <div className="shape-props-form">
      <label>
        Color:
        <input
          type="color"
          value={shape.color}
          onChange={(e) => updateShape(index, { color: e.target.value })}
        />
      </label>

      <label>
        Scale:
        <input
          type="text"
          className="neon-input"
          value={localScale}
          onChange={(e) => setLocalScale(e.target.value)}
          onBlur={() => {
            const val = parseFloat(localScale);
            if (!isNaN(val)) updateShape(index, { scale: val });
          }}
          onKeyDown={(e) => e.key === "Enter" && e.target.blur()}
        />
      </label>

      <label>
        Angle:
        <input
          type="text"
          className="neon-input"
          value={localAngle}
          onChange={(e) => setLocalAngle(e.target.value)}
          onBlur={() => {
            const val = parseFloat(localAngle);
            if (!isNaN(val)) updateShape(index, { angle: val });
          }}
          onKeyDown={(e) => e.key === "Enter" && e.target.blur()}
        />
      </label>

      <label>
        X Pos:
        <input
          type="text"
          className="neon-input"
          value={localX}
          onChange={(e) => setLocalX(e.target.value)}
          onBlur={() => {
            const val = parseFloat(localX);
            if (!isNaN(val)) updateShape(index, { x: val });
          }}
          onKeyDown={(e) => e.key === "Enter" && e.target.blur()}
        />
      </label>

      <label>
        Y Pos:
        <input
          type="text"
          className="neon-input"
          value={localY}
          onChange={(e) => setLocalY(e.target.value)}
          onBlur={() => {
            const val = parseFloat(localY);
            if (!isNaN(val)) updateShape(index, { y: val });
          }}
          onKeyDown={(e) => e.key === "Enter" && e.target.blur()}
        />
      </label>

      <div className="flip-row">
        <button
          className={`flip-btn ${shape.flipX ? "active" : ""}`}
          onClick={() => updateShape(index, { flipX: !shape.flipX })}
        >
          Flip X
        </button>
        <button
          className={`flip-btn ${shape.flipY ? "active" : ""}`}
          onClick={() => updateShape(index, { flipY: !shape.flipY })}
        >
          Flip Y
        </button>
      </div>

      <div className="move-row">
        <button
          className={`move-btn ${index === shapes.length - 1 ? "disabled" : ""}`}
          onClick={() => moveShapeUp(index)}
          disabled={index === shapes.length - 1}
        >
          Move Up
        </button>
        <button
          className={`move-btn ${index === 0 ? "disabled" : ""}`}
          onClick={() => moveShapeDown(index)}
          disabled={index === 0}
        >
          Move Down
        </button>
      </div>


      <button
        className="delete-btn"
        onClick={() => {
          setShapes((prev) => prev.filter((_, idx) => idx !== index));
          setSelectedIndices([]);
        }}
      >
        Delete Shape
      </button>
    </div>
  );
}


export default function SkinEditor() {
  const [shapes, setShapes] = useState([]);
  const [baseColor, setBaseColor] = useState("#ffffff");
  const [selectedIndices, setSelectedIndices] = useState([]);
  const [showShortcuts, setShowShortcuts] = useState(false);
  const [showWelcome, setShowWelcome] = useState(true);
  
  // UI state
  const [showShapes, setShowShapes] = useState(false);
  const [showLayers, setShowLayers] = useState(false);
  const [showToolbar, setShowToolbar] = useState(true);
  const [history, setHistory] = useState([]);
  const [future, setFuture] = useState([]);

  useEffect(() => {
    const seen = localStorage.getItem("seenWelcomePopup");
    if (!seen) {
      setShowWelcome(true);
      localStorage.setItem("seenWelcomePopup", "yes");
    }
  }, []);

  
  // Overlay state
  const [overlay, setOverlay] = useState({
    src: null,
    x: CANVAS_SIZE / 2,
    y: CANVAS_SIZE / 2,
    scale: 1,
    opacity: 0.5,
    visible: true,
  });
  const overlayDrag = useRef(null);


  const [camera, setCamera] = useState({ x: 0, y: 0, zoom: 1 });

  const dragRef = useRef(null);
  const handleRef = useRef(null);
  const canvasRef = useRef(null);

  const isSelected = (i) => selectedIndices.includes(i);
  const clearSelection = () => setSelectedIndices([]);

  function commitShapes(newShapes) {
    setHistory((h) => [...h.slice(-50), shapes]); // keep last 50 states
    setFuture([]);
    setShapes(newShapes);
  }

  function addShape(id, opts = {}) {
    const newShape = {
      id,
      x: CANVAS_SIZE / 2,
      y: CANVAS_SIZE / 2,
      angle: 0,
      scale: 1,
      flipX: false,
      flipY: false,
      locked: false,
      hidden: false,
      color: "#000000",
      ...opts,
    };

    const newShapes = [...shapes, newShape];
    commitShapes(newShapes);
    setSelectedIndices([newShapes.length - 1]);

    if (newShapes.length === 16) {
      alert("✨ You’ve reached Bonk’s limit of 16 shapes! Optimize your masterpiece! ✨");
    }
  }

  // Undo / Redo handlers
  function undo() {
    if (history.length === 0) return;
    const prev = history[history.length - 1];
    setHistory((h) => h.slice(0, -1));
    setFuture((f) => [shapes, ...f]);
    setShapes(prev);
    setSelectedIndices((sel) => sel.filter((i) => i < prev.length)); // ✅ keep valid selections only
  }

  function redo() {
    if (future.length === 0) return;
    const next = future[0];
    setFuture((f) => f.slice(1));
    setHistory((h) => [...h, shapes]);
    setShapes(next);
    setSelectedIndices((sel) => sel.filter((i) => i < next.length)); // ✅ guard here too
  }

  // Keyboard shortcuts for undo/redo
  useEffect(() => {
    const handleUndoRedo = (e) => {
      if (e.ctrlKey || e.metaKey) {
        if (e.key === "z" && !e.shiftKey) {
          e.preventDefault();
          undo();
        } else if ((e.key === "Z" && e.shiftKey) || (e.key === "y")) {
          e.preventDefault();
          redo();
        }
      }
    };
    window.addEventListener("keydown", handleUndoRedo);
    return () => window.removeEventListener("keydown", handleUndoRedo);
  }, [history, future, shapes]);


  function updateShape(i, patch) {
    if (!shapes[i]) return;
    commitShapes(
      shapes.map((s, idx) => (idx === i ? { ...s, ...patch } : s))
    );
  }

function moveShapeUp(i) {
  if (i >= shapes.length - 1) return;
  const newShapes = [...shapes];
  [newShapes[i], newShapes[i + 1]] = [newShapes[i + 1], newShapes[i]];
  commitShapes(newShapes);
  setSelectedIndices([i + 1]);
}

function moveShapeDown(i) {
  if (i <= 0) return;
  const newShapes = [...shapes];
  [newShapes[i], newShapes[i - 1]] = [newShapes[i - 1], newShapes[i]];
  commitShapes(newShapes);
  setSelectedIndices([i - 1]);
}

  // ---------- Multi-select drag ----------
  function onMouseDownShape(e, i) {
  e.stopPropagation();
  const multi = e.shiftKey || e.metaKey || e.ctrlKey;
  setSelectedIndices((prev) => {
    if (multi) {
      return prev.includes(i) ? prev.filter((x) => x !== i) : [...prev, i];
    } else {
      return [i];
    }
  });

  const dragging = selectedIndices.includes(i) ? selectedIndices : [i];
  const startX = e.clientX;
  const startY = e.clientY;
  const zoomAtDragStart = camera.zoom;
  const originalPositions = dragging.map((idx) => ({
    idx,
    x: shapes[idx].x,
    y: shapes[idx].y,
  }));

  dragRef.current = { dragging, startX, startY, zoom: zoomAtDragStart, originalPositions };

  function onMove(ev) {
    if (!dragRef.current) return;
    const ref = dragRef.current;
    if (!ref || !ref.originalPositions) return;

    const dx = (ev.clientX - ref.startX) / ref.zoom;
    const dy = (ev.clientY - ref.startY) / ref.zoom;

    // Smooth dragging update (no history commit yet)
    setShapes((prev) =>
      prev.map((s, idx) => {
        const orig = ref.originalPositions.find((o) => o.idx === idx);
        return orig ? { ...s, x: orig.x + dx, y: orig.y + dy } : s;
      })
    );
  }

  function onUp(ev) {
    if (!dragRef.current) return;

    const ref = dragRef.current;
    if (!ref || !ref.originalPositions) return;

    const dx = (ev.clientX - ref.startX) / ref.zoom;
    const dy = (ev.clientY - ref.startY) / ref.zoom;

    // Use the *latest* state from setShapes above:
    setShapes((prev) => {
      const finalShapes = prev.map((s, idx) => {
        const orig = ref.originalPositions.find((o) => o.idx === idx);
        return orig ? { ...s, x: orig.x + dx, y: orig.y + dy } : s;
      });
      commitShapes(finalShapes);
      return finalShapes;
    });

    window.removeEventListener("mousemove", onMove);
    window.removeEventListener("mouseup", onUp);
    dragRef.current = null;
  }

  window.addEventListener("mousemove", onMove);
  window.addEventListener("mouseup", onUp);
}

  function onMouseDownHandle(e, i) {
  e.stopPropagation();
  setSelectedIndices([i]);

  const shape = shapes[i];
  const rect = e.currentTarget.closest("svg").getBoundingClientRect();
  const zoom = camera.zoom;
  const camX = camera.x;
  const camY = camera.y;

  const toWorld = (clientX, clientY) => {
    const sx = clientX - rect.left;
    const sy = clientY - rect.top;
    return { x: sx / zoom - camX, y: sy / zoom - camY };
  };

  const start = toWorld(e.clientX, e.clientY);
  const cx = shape.x;
  const cy = shape.y;

  const startVec = { x: start.x - cx, y: start.y - cy };
  const startAngle = shape.angle;
  const startScale = shape.scale;

  handleRef.current = {
    i,
    cx,
    cy,
    startVec,
    startAngle,
    startScale,
    zoom,
    camX,
    camY,
  };

  // --- Live update for smooth preview (no commit yet) ---
  function onMove(ev) {
    const ref = handleRef.current;
    if (!ref) return; // ✅ Prevent null crash

    const cur = toWorld(ev.clientX, ev.clientY);
    const curVec = { x: cur.x - ref.cx, y: cur.y - ref.cy };
    const d0 = Math.hypot(ref.startVec.x, ref.startVec.y);
    const d1 = Math.hypot(curVec.x, curVec.y);
    const scale = Math.max(0.05, ref.startScale * (d1 / d0));

    const a0 = Math.atan2(ref.startVec.y, ref.startVec.x);
    const a1 = Math.atan2(curVec.y, curVec.x);
    const deltaDeg = ((a1 - a0) * 180) / Math.PI;

    setShapes((prev) =>
      prev.map((s, idx) =>
        idx === i ? { ...s, scale, angle: ref.startAngle + deltaDeg } : s
      )
    );
  }

  function onUp(ev) {
    const ref = handleRef.current;
    if (!ref) return; // ✅ Prevent null crash

    const cur = toWorld(ev.clientX, ev.clientY);
    const curVec = { x: cur.x - ref.cx, y: cur.y - ref.cy };
    const d0 = Math.hypot(ref.startVec.x, ref.startVec.y);
    const d1 = Math.hypot(curVec.x, curVec.y);
    const scale = Math.max(0.05, ref.startScale * (d1 / d0));

    const a0 = Math.atan2(ref.startVec.y, ref.startVec.x);
    const a1 = Math.atan2(curVec.y, curVec.x);
    const deltaDeg = ((a1 - a0) * 180) / Math.PI;

    setShapes((prev) => {
      const finalShapes = prev.map((s, idx) =>
        idx === i ? { ...s, scale, angle: ref.startAngle + deltaDeg } : s
      );
      commitShapes(finalShapes);
      return finalShapes;
    });

    window.removeEventListener("mousemove", onMove);
    window.removeEventListener("mouseup", onUp);
    handleRef.current = null;
  }

  window.addEventListener("mousemove", onMove);
  window.addEventListener("mouseup", onUp);
}


  // ---------- Camera ----------
  useEffect(() => {
    const svg = canvasRef.current;
    if (!svg) return;

    let isPanning = false;
    let lastX = 0;
    let lastY = 0;

    const handleMouseDown = (e) => {
      if (e.target === svg) {
        isPanning = true;
        lastX = e.clientX;
        lastY = e.clientY;
      }
    };

    const handleMouseMove = (e) => {
      if (!isPanning) return;
      const dx = e.clientX - lastX;
      const dy = e.clientY - lastY;
      lastX = e.clientX;
      lastY = e.clientY;
      setCamera((prev) => ({
        ...prev,
        x: prev.x + dx / prev.zoom,
        y: prev.y + dy / prev.zoom,
      }));
    };

    const handleMouseUp = () => (isPanning = false);
    const handleWheel = (e) => {
      e.preventDefault();

      const rect = svg.getBoundingClientRect();
      const mouseX = e.clientX - rect.left;
      const mouseY = e.clientY - rect.top;
      const zoomAmount = e.deltaY * -0.001;

      setCamera((prev) => {
        const newZoom = Math.min(Math.max(prev.zoom + zoomAmount, 0.2), 5);

        // Convert mouse screen coords → world coords before zoom
        const worldX = (mouseX / prev.zoom) - prev.x;
        const worldY = (mouseY / prev.zoom) - prev.y;

        // Adjust camera to keep zoom centered around cursor
        const newX = mouseX / newZoom - worldX;
        const newY = mouseY / newZoom - worldY;

        return { x: newX, y: newY, zoom: newZoom };
      });
    };


    svg.addEventListener("mousedown", handleMouseDown);
    window.addEventListener("mousemove", handleMouseMove);
    window.addEventListener("mouseup", handleMouseUp);
    svg.addEventListener("wheel", handleWheel, { passive: false });

    return () => {
      svg.removeEventListener("mousedown", handleMouseDown);
      window.removeEventListener("mousemove", handleMouseMove);
      window.removeEventListener("mouseup", handleMouseUp);
      svg.removeEventListener("wheel", handleWheel);
    };
  }, []);

  function resetCamera() {
    setCamera({ x: 0, y: 0, zoom: 1 });
  }

  // ---------- Export / Import ----------

  function exportJSON() {
    const out = {
      bc: parseInt(baseColor.replace("#", ""), 16),
      // layers: shapes.map((s) => ({
      layers: [...shapes].reverse().map((s) => ({
        id: s.id,
        scale: +(s.scale / BONK_SCALE_FACTOR).toFixed(6),
        angle: +s.angle.toFixed(6),
        x: +(((s.x - CANVAS_SIZE / 2) / BONK_X_POS_FACTOR)).toFixed(6),
        y: +(((s.y - CANVAS_SIZE / 2) / BONK_Y_POS_FACTOR)).toFixed(6),
        flipX: !!s.flipX,
        flipY: !!s.flipY,
        color: parseInt(s.color.replace("#", ""), 16),
      })),
    };
    const blob = new Blob([JSON.stringify(out, null, 2)], {
      type: "application/json",
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "bonk-skin.json";
    a.click();
    URL.revokeObjectURL(url);
  }

  function importJSON(e) {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (evt) => {
      let parsed = JSON.parse(evt.target.result);
      // parsed = flipLayers(parsed);
      setBaseColor(`#${parsed.bc.toString(16).padStart(6, "0")}`);
      commitShapes(
        parsed.layers.slice().reverse().map((l) => ({
          id: l.id,
          scale: parseFloat(l.scale) * BONK_SCALE_FACTOR,
          angle: parseFloat(l.angle),
          x: parseFloat(l.x) * BONK_X_POS_FACTOR + CANVAS_SIZE / 2,
          y: parseFloat(l.y) * BONK_Y_POS_FACTOR + CANVAS_SIZE / 2,
          flipX: !!l.flipX,
          flipY: !!l.flipY,
          color: `#${l.color.toString(16).padStart(6, "0")}`,
        }))
      );
      setSelectedIndices([]);
    };
    reader.readAsText(file);
  }

  // ---------- Shape Renderer ----------
  function Shape({ s, i }) {
  const [meta, setMeta] = useState(null);

  // Load SVG for the shape
  useEffect(() => {
    let alive = true;
    (async () => {
      const m = await loadAndNormalizeSvg(s.id);
      if (alive) setMeta(m);
    })();
    return () => (alive = false);
  }, [s.id]);

  // --- Hide support ---
  if (s.hidden) return null;

  const tr = useMemo(() => {
    const sx = s.flipX ? -s.scale : s.scale;
    const sy = s.flipY ? -s.scale : s.scale;
    return `translate(${s.x},${s.y}) rotate(${s.angle}) scale(${sx},${sy})`;
  }, [s]);

  const w = meta?.w ?? 50;
  const h = meta?.h ?? 50;
  const HANDLE = 12;

  return (
      <g
        transform={tr}
        // prevent selecting or moving locked shapes
        onMouseDown={(e) => {
          if (s.locked) return; // skip drag logic, but allow pointer hit
          onMouseDownShape(e, i);
        }}
        style={{
          color: s.color,
          opacity: s.locked ? 0.5 : 1,
          cursor: s.locked ? "not-allowed" : "pointer",
          pointerEvents: s.locked ? "none" : "bounding-box", // ✅ key change here
        }}
      >
        {/* SVG content */}
        <g
          dangerouslySetInnerHTML={{ __html: meta?.html || "" }}
          fill={s.color}
          stroke={s.color}
        />

        {/* Selection box + handle */}
        {isSelected(i) && !s.locked && (
          <>
            <rect
              x={-w / 2}
              y={-h / 2}
              width={w}
              height={h}
              fill="none"
              stroke="lime"
              strokeWidth={2}
              pointerEvents="none"
            />
            <rect
              x={w / 2 - HANDLE / 2}
              y={-h / 2 - HANDLE / 2}
              width={HANDLE}
              height={HANDLE}
              fill="white"
              stroke="black"
              style={{ cursor: "nwse-resize" }}
              onMouseDown={(e) => onMouseDownHandle(e, i)}
            />
          </>
        )}
      </g>
    );

}


  // ---------- Keyboard Shortcuts ----------
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.target.tagName === "INPUT") return;
      if (selectedIndices.length === 0) return;

      const moveStep = e.shiftKey ? 10 : 1;
      const newShapes = shapes.map((s, idx) => {
      if (!selectedIndices.includes(idx)) return s;
      const moveStep = e.shiftKey ? 10 : 1;
      switch (e.key) {
        case "ArrowUp": return { ...s, y: s.y - moveStep };
        case "ArrowDown": return { ...s, y: s.y + moveStep };
        case "ArrowLeft": return { ...s, x: s.x - moveStep };
        case "ArrowRight": return { ...s, x: s.x + moveStep };
        case "r": return { ...s, angle: s.angle + 5 };
        case "R": return { ...s, angle: s.angle - 5 };
        case "x": return { ...s, flipX: !s.flipX };
        case "y": return { ...s, flipY: !s.flipY };
        case "+": case "=": return { ...s, scale: s.scale * 1.05 };
        case "-": return { ...s, scale: s.scale * 0.95 };
        default: return s;
      }
    });
    commitShapes(newShapes);


      if (e.key === "Escape") clearSelection();

      // --- Delete selected shapes ---
      if (e.key === "Delete" || e.key === "Backspace") {
        e.preventDefault();
        // setShapes((prev) => prev.filter((_, idx) => !selectedIndices.includes(idx)));
        commitShapes(shapes.filter((_, idx) => !selectedIndices.includes(idx)));
        setSelectedIndices([]);
        return;
      }

      // Ctrl-based commands
      if (e.ctrlKey || e.metaKey) {
        const first = shapes[selectedIndices[0]];
        switch (e.key.toLowerCase()) {
          case "s":
            e.preventDefault();
            exportJSON();
            break;
          case "d":
            e.preventDefault();
            commitShapes([
              ...shapes,
              ...selectedIndices.map((i) => ({
                ...shapes[i],
                x: shapes[i].x + 10,
                y: shapes[i].y + 10,
              })),
            ]);
            break;
          case "c":
            e.preventDefault();
            navigator.clipboard.writeText(
              JSON.stringify(selectedIndices.map((i) => shapes[i]))
            );
            break;
          case "v":
            e.preventDefault();
            navigator.clipboard.readText().then((text) => {
              try {
                const pasted = JSON.parse(text);
                if (Array.isArray(pasted)) {
                  commitShapes([
                    ...shapes,
                    ...pasted.map((p) => ({
                      ...p,
                      x: p.x + 10,
                      y: p.y + 10,
                    })),
                  ]);
                }
              } catch {}
            });
            break;
        }
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [selectedIndices, shapes]);

  // ---------- Shift+? help ----------
  useEffect(() => {
    const handleHelpShortcut = (e) => {
      if (e.shiftKey && e.key === "?") {
        e.preventDefault();
        setShowShortcuts((v) => !v);
      }
    };
    window.addEventListener("keydown", handleHelpShortcut);
    return () => window.removeEventListener("keydown", handleHelpShortcut);
  }, []);

  function getShapeMarkup(id, color = "#000") {
    const meta = svgCache.get(id);
    if (!meta) return "";
    const { html, w, h } = meta;
    return `
      <svg xmlns="http://www.w3.org/2000/svg" viewBox="${-w / 2} ${-h / 2} ${w} ${h}" width="24" height="24" style="color: ${color};">
        ${html}
      </svg>
    `;
  }



// // ---------- Render ----------
// return (
//   <div className="editor-container">
//     <div
//       className="editor-main overlay-dropzone"
//       onDragOver={(e) => e.preventDefault()}
//       onDrop={(e) => {
//         e.preventDefault();
//         const file = e.dataTransfer.files[0];
//         if (file && file.type.startsWith("image/")) {
//           const reader = new FileReader();
//           reader.onload = (evt) => {
//             setOverlay((o) => ({
//               ...o,
//               src: evt.target.result,
//               visible: true,
//             }));
//           };
//           reader.readAsDataURL(file);
//         }
//       }}
//     >
//       {/* Toolbar */}
//       <div className="editor-toolbar">
//         <label>
//           Base color:
//           <input
//             type="color"
//             value={baseColor}
//             onChange={(e) => setBaseColor(e.target.value)}
//           />
//         </label>

//         <button
//           className="editor-btn"
//           onClick={async () => {
//             const skinJSON = {
//               bc: parseInt(baseColor.replace("#", ""), 16),
//               layers: [...shapes].reverse().map((s) => ({
//                 id: s.id,
//                 scale: +(s.scale / BONK_SCALE_FACTOR).toFixed(6),
//                 angle: +s.angle.toFixed(6),
//                 x: +(((s.x - CANVAS_SIZE / 2) / BONK_POS_FACTOR)).toFixed(6),
//                 y: +(((s.y - CANVAS_SIZE / 2) / BONK_POS_FACTOR)).toFixed(6),
//                 flipX: !!s.flipX,
//                 flipY: !!s.flipY,
//                 color: parseInt(s.color.replace("#", ""), 16),
//               })),
//             };

//             const username = prompt("Bonk.io Username:");
//             const password = prompt("Bonk.io Password:");
//             if (!username || !password) return alert("Missing credentials");

//             const res = await fetch("/api/wear", {
//               method: "POST",
//               headers: { "Content-Type": "application/json" },
//               body: JSON.stringify({ username, password, skin: skinJSON }),
//             });

//             const data = await res.json();
//             if (data.ok) {
//               alert(`✅ Skin applied successfully to slot ${data.activeSlot}!`);
//               console.log("Skin code:", data.skinCode);
//             } else {
//               alert("❌ Failed to wear skin: " + (data.error || "unknown"));
//             }
//           }}
//         >
//           Wear Skin
//         </button>

//         <button className="editor-btn" onClick={exportJSON}>Export</button>
//         <label className="file-label">
//           Import
//           <input
//             type="file"
//             accept=".json"
//             onChange={importJSON}
//             className="file-input"
//           />
//         </label>

//         <button
//           className="editor-btn"
//           onClick={() =>
//             selectedIndices.length > 0 &&
//             setShapes((prev) =>
//               prev.map((s, i) =>
//                 selectedIndices.includes(i) ? { ...s, flipX: !s.flipX } : s
//               )
//             )
//           }
//         >
//           FlipX
//         </button>
//         <button
//           className="editor-btn"
//           onClick={() =>
//             selectedIndices.length > 0 &&
//             setShapes((prev) =>
//               prev.map((s, i) =>
//                 selectedIndices.includes(i) ? { ...s, flipY: !s.flipY } : s
//               )
//             )
//           }
//         >
//           FlipY
//         </button>

//         <button className="editor-btn" onClick={resetCamera}>
//           Reset View
//         </button>

//         {/* Overlay Controls */}
//         {overlay.src && (
//           <div className="overlay-controls">
//             <label>
//               Opacity:
//               <input
//                 type="range"
//                 min="0"
//                 max="1"
//                 step="0.05"
//                 value={overlay.opacity}
//                 onChange={(e) =>
//                   setOverlay((o) => ({
//                     ...o,
//                     opacity: parseFloat(e.target.value),
//                   }))
//                 }
//               />
//             </label>
//             <button
//               className="editor-btn"
//               onClick={() =>
//                 setOverlay((o) => ({ ...o, visible: !o.visible }))
//               }
//             >
//               {overlay.visible ? "Hide Overlay" : "Show Overlay"}
//             </button>
//             <button
//               className="editor-btn"
//               onClick={() =>
//                 setOverlay({
//                   src: null,
//                   x: CANVAS_SIZE / 2,
//                   y: CANVAS_SIZE / 2,
//                   scale: 1,
//                   opacity: 0.5,
//                   visible: true,
//                 })
//               }
//             >
//               Remove
//             </button>
//           </div>
//         )}

//         <button
//           className="editor-btn"
//           title="Keyboard Shortcuts"
//           onClick={() => setShowShortcuts(true)}
//         >
//           <FiSettings size={18} style={{ marginRight: "4px" }} />
//           Shortcuts
//         </button>

//         <input
//           type="color"
//           value={
//             selectedIndices.length === 1
//               ? shapes[selectedIndices[0]].color
//               : "#000000"
//           }
//           onChange={(e) =>
//             selectedIndices.length > 0 &&
//             setShapes((prev) =>
//               prev.map((s, i) =>
//                 selectedIndices.includes(i)
//                   ? { ...s, color: e.target.value }
//                   : s
//               )
//             )
//           }
//           title="Shape color"
//         />
//       </div>

//       {/* Canvas */}
//       <svg
//         ref={canvasRef}
//         width={CANVAS_SIZE}
//         height={CANVAS_SIZE}
//         className="editor-canvas"
//         onMouseDown={clearSelection}
//       >
//         <g transform={`scale(${camera.zoom}) translate(${camera.x},${camera.y})`}>
//           <defs>
//             <clipPath id="playerClip">
//               <circle
//                 cx={CANVAS_SIZE / 2}
//                 cy={CANVAS_SIZE / 2}
//                 r={BALL_RADIUS_PX}
//               />
//             </clipPath>
//           </defs>

//           {/* Shadow outline */}
//           <circle
//             cx={CANVAS_SIZE / 2}
//             cy={CANVAS_SIZE / 2}
//             r={BALL_RADIUS_PX + 2}
//             fill="none"
//             stroke="rgba(0,0,0,0.25)"
//             strokeWidth={4}
//           />

//           {/* Base fill */}
//           <circle
//             cx={CANVAS_SIZE / 2}
//             cy={CANVAS_SIZE / 2}
//             r={BALL_RADIUS_PX}
//             fill={baseColor}
//             stroke="#333"
//             strokeWidth={3}
//           />

//           {/* Overlay image */}
//           {overlay.src && overlay.visible && (
//             <image
//               href={overlay.src}
//               x={overlay.x - CANVAS_SIZE / 2}
//               y={overlay.y - CANVAS_SIZE / 2}
//               width={CANVAS_SIZE * overlay.scale}
//               height={CANVAS_SIZE * overlay.scale}
//               opacity={overlay.opacity}
//               style={{ cursor: "move" }}
//               onMouseDown={(e) => {
//                 e.stopPropagation();
//                 overlayDrag.current = {
//                   startX: e.clientX,
//                   startY: e.clientY,
//                   startPos: { x: overlay.x, y: overlay.y },
//                 };
//                 const onMove = (ev) => {
//                   const dx = ev.clientX - overlayDrag.current.startX;
//                   const dy = ev.clientY - overlayDrag.current.startY;
//                   setOverlay((o) => ({
//                     ...o,
//                     x: overlayDrag.current.startPos.x + dx,
//                     y: overlayDrag.current.startPos.y + dy,
//                   }));
//                 };
//                 const onUp = () => {
//                   window.removeEventListener("mousemove", onMove);
//                   window.removeEventListener("mouseup", onUp);
//                   overlayDrag.current = null;
//                 };
//                 window.addEventListener("mousemove", onMove);
//                 window.addEventListener("mouseup", onUp);
//               }}
//             />
//           )}

//           {/* Shapes */}
//           <g clipPath="url(#playerClip)">
//             {shapes.map((s, i) => (
//               <Shape key={i} s={s} i={i} />
//             ))}
//           </g>
//         </g>
//       </svg>
//     </div>

//     {/* Panels (unchanged) */}
//     <div className="side-panels">
//       <div className="shapes-panel">
//         <h3>Shapes</h3>
//         <div className="shape-grid">
//           {Array.from({ length: TOTAL_SHAPES }, (_, idx) => {
//             const id = idx + 1;
//             return (
//               <div key={id} className="shape-item" onClick={() => addShape(id)}>
//                 <img
//                   src={`/output_shapes/${id}.svg`}
//                   alt={`Shape ${id}`}
//                   width={32}
//                   height={32}
//                 />
//                 <small>{id}</small>
//               </div>
//             );
//           })}
//         </div>
//       </div>

//       <div className="layers-panel">
//         <h3>Layers</h3>
//         {shapes
//           .slice()
//           .reverse()
//           .map((s, i) => {
//             const realIndex = shapes.length - 1 - i;
//             const selected = isSelected(realIndex);
//             return (
//               <button
//                 key={i}
//                 onClick={() => setSelectedIndices([realIndex])}
//                 className={`layer-btn ${selected ? "active" : ""}`}
//               >
//                 {`Shape ${s.id}`}
//               </button>
//             );
//           })}
//       </div>
//     </div>

//     {/* Shape Properties Panel */}
//       {selectedIndices.length === 1 && (
//         <div className="shape-properties">
//           <h3>Shape Properties</h3>
//           {(() => {
//             const i = selectedIndices[0];
//             const s = shapes[i];
//             return (
//               <div className="shape-props-form">
//                 <label>
//                   Color:
//                   <input
//                     type="color"
//                     value={s.color}
//                     onChange={(e) => updateShape(i, { color: e.target.value })}
//                   />
//                 </label>

//                 <label>
//                   Scale:
//                   <input
//                     type="number"
//                     step="0.01"
//                     value={s.scale.toFixed(3)}
//                     onChange={(e) =>
//                       updateShape(i, { scale: parseFloat(e.target.value) || 0 })
//                     }
//                   />
//                 </label>

//                 <label>
//                   Angle:
//                   <input
//                     type="number"
//                     step="1"
//                     value={s.angle.toFixed(3)}
//                     onChange={(e) =>
//                       updateShape(i, { angle: parseFloat(e.target.value) || 0 })
//                     }
//                   />
//                 </label>

//                 <label>
//                   X Pos:
//                   <input
//                     type="number"
//                     step="1"
//                     value={s.x.toFixed(1)}
//                     onChange={(e) =>
//                       updateShape(i, { x: parseFloat(e.target.value) || 0 })
//                     }
//                   />
//                 </label>

//                 <label>
//                   Y Pos:
//                   <input
//                     type="number"
//                     step="1"
//                     value={s.y.toFixed(1)}
//                     onChange={(e) =>
//                       updateShape(i, { y: parseFloat(e.target.value) || 0 })
//                     }
//                   />
//                 </label>

//                 <div className="flip-row">
//                   <label>
//                     <input
//                       type="checkbox"
//                       checked={s.flipX}
//                       onChange={(e) => updateShape(i, { flipX: e.target.checked })}
//                     />{" "}
//                     Flip X
//                   </label>
//                   <label>
//                     <input
//                       type="checkbox"
//                       checked={s.flipY}
//                       onChange={(e) => updateShape(i, { flipY: e.target.checked })}
//                     />{" "}
//                     Flip Y
//                   </label>
//                 </div>

//                 <div className="layer-move-row">
//                   <button
//                     className="move-btn"
//                     onClick={() => moveShapeUp(i)}
//                     disabled={i === shapes.length - 1}
//                   >
//                     Move Up
//                   </button>
//                   <button
//                     className="move-btn"
//                     onClick={() => moveShapeDown(i)}
//                     disabled={i === 0}
//                   >
//                     Move Down
//                   </button>
//                 </div>


//                 <button
//                   className="delete-btn"
//                   onClick={() => {
//                     setShapes((prev) => prev.filter((_, idx) => idx !== i));
//                     setSelectedIndices([]);
//                   }}
//                 >
//                   Delete Shape
//                 </button>
//               </div>
//             );
//           })()}
//         </div>
//       )}


//       {/* Shortcuts Modal */}
//       {showShortcuts && (
//         <div className="modal-overlay" onClick={() => setShowShortcuts(false)}>
//           <div className="modal-content" onClick={(e) => e.stopPropagation()}>
//             <h2>🎹 Keyboard Shortcuts</h2>
//             <div className="shortcuts-grid">
//               <div>
//                 <h3>🧩 Shape Controls</h3>
//                 <ul>
//                   <li><b>Arrow Keys</b> — Move (Shift = 10px)</li>
//                   <li><b>R / Shift+R</b> — Rotate ±5°</li>
//                   <li><b>+</b> / <b>-</b> — Scale up/down</li>
//                   <li><b>X / Y</b> — Flip horizontally/vertically</li>
//                   <li><b>Delete</b> — Delete selected</li>
//                   <li><b>Ctrl+D</b> — Duplicate selected</li>
//                   <li><b>Ctrl+C / Ctrl+V</b> — Copy / Paste</li>
//                   <li><b>Shift / Ctrl+Click</b> — Multi-select</li>
//                 </ul>
//               </div>
//             </div>
//             <button className="close-btn" onClick={() => setShowShortcuts(false)}>Close</button>
//           </div>
//         </div>
//       )}

//       {/* Welcome Popup */}
//       {showWelcome && (
//         <div className="modal-overlay" onClick={() => setShowWelcome(false)}>
//           <div className="modal-content" onClick={(e) => e.stopPropagation()}>
//             <h2>🎨 Welcome to the Bonkverse Skin Editor!</h2>
//             <p style={{ fontSize: "15px", lineHeight: "1.6", color: "#ccc" }}>
//               Here’s what you can do right now:
//             </p>
//             <ul style={{ fontSize: "14px", lineHeight: "1.6", color: "#ccc" }}>
//               <li>🧩 <b>Add & Edit Shapes:</b> Click any shape to add it, then drag, rotate, or scale using handles.</li>
//               <li>🎨 <b>Change Colors:</b> Use the color picker to recolor selected shapes or the base body.</li>
//               <li>↕️ <b>Layer Controls:</b> Move shapes forward/back or reorder layers using the “Move Up/Down” buttons.</li>
//               <li>🖱️ <b>Multi-select:</b> Hold <b>Shift</b> or <b>Ctrl</b> to select and move multiple shapes at once.</li>
//               <li>📷 <b>Image Overlay:</b> Drag and drop an image onto the canvas to trace over it (adjust opacity or hide it anytime).</li>
//               <li>💾 <b>Export / Import:</b> Save your skin as JSON or load one back in.</li>
//               <li>👕 <b>Wear Skin:</b> Apply your current design to your Bonk.io account directly.</li>
//               <li>⚡ <b>Keyboard Shortcuts:</b> Move, rotate, scale, flip, duplicate, or delete using keys (press <b>Shift + ?</b> to view all).</li>
//               <li>🧭 <b>Camera:</b> Zoom or pan with your mouse wheel and drag empty space to move around.</li>
//             </ul>
//             <button
//               className="close-btn"
//               style={{ marginTop: "20px" }}
//               onClick={() => setShowWelcome(false)}
//             >
//               Got it!
//             </button>
//           </div>
//         </div>
//       )}

//     </div>
// );

  // ---------- Render ----------
  return (
    <div
    className={`editor-container 
      ${showShapes ? "show-shapes" : ""} 
      ${showLayers ? "show-layers" : ""}`}
    >


      {/* === Fullscreen Canvas === */}
      <svg
        ref={canvasRef}
        className="editor-canvas"
        onMouseDown={clearSelection}
        onDragOver={(e) => e.preventDefault()}
        onDrop={(e) => {
          e.preventDefault();
          const file = e.dataTransfer.files[0];
          if (file && file.type.startsWith("image/")) {
            const reader = new FileReader();
            reader.onload = (evt) =>
              setOverlay((o) => ({ ...o, src: evt.target.result, visible: true }));
            reader.readAsDataURL(file);
          }
        }}
      >
        <g transform={`scale(${camera.zoom}) translate(${camera.x},${camera.y})`}>
          <defs>
            <clipPath id="playerClip">
              <circle cx={CANVAS_SIZE / 2} cy={CANVAS_SIZE / 2} r={BALL_RADIUS_PX} />
            </clipPath>
          </defs>

          {/* Shadow outline */}
          <circle
            cx={CANVAS_SIZE / 2}
            cy={CANVAS_SIZE / 2}
            r={BALL_RADIUS_PX + 2}
            fill="none"
            stroke="rgba(0,0,0,0.25)"
            strokeWidth={4}
          />

          {/* Base color */}
          <circle
            cx={CANVAS_SIZE / 2}
            cy={CANVAS_SIZE / 2}
            r={BALL_RADIUS_PX}
            fill={baseColor}
            stroke="#333"
            strokeWidth={3}
          />

          {/* Overlay image */}
          {overlay.src && overlay.visible && (
            <image
              href={overlay.src}
              x={overlay.x - CANVAS_SIZE / 2}
              y={overlay.y - CANVAS_SIZE / 2}
              width={CANVAS_SIZE * overlay.scale}
              height={CANVAS_SIZE * overlay.scale}
              opacity={overlay.opacity}
              style={{ cursor: "move" }}
              onMouseDown={(e) => {
                e.stopPropagation();

                overlayDrag.current = {
                  startX: e.clientX,
                  startY: e.clientY,
                  startPos: { x: overlay.x, y: overlay.y },
                };

                const onMove = (ev) => {
                  // ✅ Guard against null refs
                  if (!overlayDrag.current) return;

                  // ✅ Adjust movement by zoom (optional improvement)
                  const dx = (ev.clientX - overlayDrag.current.startX) / camera.zoom;
                  const dy = (ev.clientY - overlayDrag.current.startY) / camera.zoom;

                  setOverlay((o) => {
                    // double-guard inside React state updater
                    if (!overlayDrag.current) return o;
                    return {
                      ...o,
                      x: overlayDrag.current.startPos.x + dx,
                      y: overlayDrag.current.startPos.y + dy,
                    };
                  });
                };

                const onUp = () => {
                  window.removeEventListener("mousemove", onMove);
                  window.removeEventListener("mouseup", onUp);
                  overlayDrag.current = null;
                };

                window.addEventListener("mousemove", onMove);
                window.addEventListener("mouseup", onUp);
              }}
            />
          )}

          {/* Shapes */}
          <g clipPath="url(#playerClip)">
            {shapes.map((s, i) => (
              <Shape key={i} s={s} i={i} />
            ))}
          </g>
        </g>
      </svg>

      {/* === Floating Toggles === */}
      <button className="dock-btn left" onClick={() => setShowShapes((v) => !v)}>Shapes</button>
      <button className="dock-btn right" onClick={() => setShowLayers((v) => !v)}>Layers</button>

      {/* === Left Panel: Shapes === */}
      <div className={`panel panel-left ${showShapes ? "open" : ""}`}>
        <h3>Shapes</h3>
        <div className="shape-grid">
          {Array.from({ length: TOTAL_SHAPES }, (_, idx) => {
            const id = idx + 1;
            return (
              <div key={id} className="shape-item" onClick={() => addShape(id)}>
                <img src={`/output_shapes/${id}.svg`} alt={`Shape ${id}`} />
                <small>{id}</small>
              </div>
            );
          })}
        </div>
      </div>

      {/* === Right Panel: Layers === */}
      <div className={`panel panel-right ${showLayers ? "open" : ""}`}>
        <h3>
          Layers ({shapes.length}/16)
          {shapes.length >= 16 && (
            <div
              style={{
                color: "#00ffcc",
                fontSize: "0.8rem",
                marginTop: "4px",
                textAlign: "center",
                textShadow: "0 0 6px rgba(0,255,200,0.5)",
              }}
            >
              ✨ Bonk limit reached — optimize or keep creating! ✨
            </div>
          )}
        </h3>

        <div className="layers-list">
          {shapes
            .slice()
            .reverse()
            .map((s, i) => {
              const realIndex = shapes.length - 1 - i;
              const selected = isSelected(realIndex);
              return (
                <div
                  key={i}
                  className={`layer-row ${selected ? "active" : ""}`}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: "6px",
                    marginBottom: "6px",
                    background: selected
                      ? "rgba(0,255,200,0.15)"
                      : "rgba(255,255,255,0.05)",
                    borderRadius: "6px",
                    padding: "4px",
                    userSelect: "none",
                    cursor: "grab",
                  }}
                  draggable
                  onDragStart={(e) => {
                    e.dataTransfer.effectAllowed = "move";
                    e.dataTransfer.setData("text/plain", i.toString());
                  }}
                  onDragOver={(e) => e.preventDefault()}
                  onDrop={(e) => {
                    e.preventDefault();
                    const from = parseInt(e.dataTransfer.getData("text/plain"));
                    const to = i;
                    const reversed = [...shapes].reverse();
                    const [moved] = reversed.splice(from, 1);
                    reversed.splice(to, 0, moved);
                    const newShapes = reversed.reverse();
                    setShapes(newShapes);
                    commitShapes(newShapes);
                  }}
                >
                  {/* Thumbnail */}
                  <div
                    className="layer-thumb"
                    dangerouslySetInnerHTML={{ __html: getShapeMarkup(s.id, s.color) }}
                    style={{
                      width: 26,
                      height: 26,
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      overflow: "hidden",
                      borderRadius: "4px",
                      transform: `
                        scale(${s.flipX ? -0.8 : 0.8}, ${s.flipY ? -0.8 : 0.8})
                        rotate(${s.angle}deg)
                      `,
                      filter: s.hidden ? "grayscale(100%) brightness(0.4)" : "none",
                      pointerEvents: "none",
                    }}
                  />



                  {/* Name */}
                  <button
                    onClick={() => setSelectedIndices([realIndex])}
                    className={`layer-btn ${selected ? "active" : ""}`}
                    style={{
                      flex: 1,
                      textAlign: "left",
                      background: "none",
                      border: "none",
                      color: "inherit",
                      cursor: "pointer",
                    }}
                  >
                    Shape {s.id}
                  </button>

                  {/* Lock toggle */}
                  <button
                    className="tiny-btn"
                    title={s.locked ? "Unlock shape" : "Lock shape"}
                    onClick={() => updateShape(realIndex, { locked: !s.locked })}
                  >
                    {s.locked ? "🔒" : "🔓"}
                  </button>

                  {/* Hide toggle */}
                  <button
                    className="tiny-btn"
                    title={s.hidden ? "Show shape" : "Hide shape"}
                    onClick={() => updateShape(realIndex, { hidden: !s.hidden })}
                  >
                    {s.hidden ? "🙈" : "👁️"}
                  </button>
                </div>
              );
            })}
        </div>
      </div>



      {/* === Top Tools Bar === */}
      <div className="tools-bar">
        <label>
          Base color:
          <input
            type="color"
            value={baseColor}
            onChange={(e) => setBaseColor(e.target.value)}
          />
        </label>

        <button className="editor-btn" onClick={exportJSON}>Export</button>

        <label className="file-label">
          Import
          <input
            type="file"
            accept=".json"
            onChange={importJSON}
            className="file-input"
          />
        </label>

        <button className="editor-btn" onClick={resetCamera}>Reset View</button>
        <button className="editor-btn" onClick={() => setShowShortcuts(true)}>Shortcuts</button>

        <button
          className="editor-btn"
          onClick={async () => {
            const skinJSON = {
              bc: parseInt(baseColor.replace("#", ""), 16),
              layers: [...shapes].reverse().map((s) => ({
                id: s.id,
                scale: +(s.scale / BONK_SCALE_FACTOR).toFixed(6),
                angle: +s.angle.toFixed(6),
                x: +(((s.x - CANVAS_SIZE / 2) / BONK_X_POS_FACTOR)).toFixed(6),
                y: +(((s.y - CANVAS_SIZE / 2) / BONK_Y_POS_FACTOR)).toFixed(6),
                flipX: !!s.flipX,
                flipY: !!s.flipY,
                color: parseInt(s.color.replace("#", ""), 16),
              })),
            };

            const username = prompt("Bonk.io Username:");
            const password = prompt("Bonk.io Password:");
            if (!username || !password) return alert("Missing credentials");

            const res = await fetch("/api/wear", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ username, password, skin: skinJSON }),
            });

            const data = await res.json();
            if (data.ok) {
              alert(`✅ Skin applied successfully to slot ${data.activeSlot}!`);
            } else {
              alert("❌ Failed to wear skin: " + (data.error || "unknown"));
            }
          }}
        >
          Wear Skin
        </button>
      </div>

      {/* === Shape Properties (auto-slide) === */}
      {selectedIndices.length === 1 && (
        <div className="panel panel-right open shape-props-panel">
          <h3>Shape Properties</h3>
          <ShapeProperties
            shape={shapes[selectedIndices[0]]}
            index={selectedIndices[0]}
            shapes={shapes}
            updateShape={updateShape}
            moveShapeUp={moveShapeUp}
            moveShapeDown={moveShapeDown}
            setShapes={setShapes}
            setSelectedIndices={setSelectedIndices}
          />
        </div>
      )}




      {/* === Modals === */}
      {showShortcuts && (
        <div className="modal-overlay" onClick={() => setShowShortcuts(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <h2>🎹 Keyboard Shortcuts</h2>
            <ul>
              <li><b>Arrow Keys</b> — Move (Shift = 10px)</li>
              <li><b>R / Shift+R</b> — Rotate ±5°</li>
              <li><b>+</b> / <b>-</b> — Scale up/down</li>
              <li><b>X / Y</b> — Flip horizontally/vertically</li>
              <li><b>Ctrl+D</b> — Duplicate selected</li>
              <li><b>Ctrl+C / Ctrl+V</b> — Copy / Paste</li>
              <li><b>Shift / Ctrl+Click</b> — Multi-select</li>
            </ul>
            <button className="close-btn" onClick={() => setShowShortcuts(false)}>Close</button>
          </div>
        </div>
      )}
      {/* Welcome Popup */}
      {showWelcome && (
        <div className="modal-overlay" onClick={() => setShowWelcome(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <h2>🎨 Welcome to the Bonkverse Skin Editor!</h2>
            <p style={{ fontSize: "15px", lineHeight: "1.6", color: "#ccc" }}>
              Here’s what you can do right now:
            </p>
            <ul style={{ fontSize: "14px", lineHeight: "1.6", color: "#ccc" }}>
              <li>🧩 <b>Add & Edit Shapes:</b> Click any shape to add it, then drag, rotate, or scale using handles.</li>
              <li>🎨 <b>Change Colors:</b> Use the color picker to recolor selected shapes or the base body.</li>
              <li>↕️ <b>Layer Controls:</b> Move shapes forward/back or reorder layers using the “Move Up/Down” buttons.</li>
              <li>🖱️ <b>Multi-select:</b> Hold <b>Shift</b> or <b>Ctrl</b> to select and move multiple shapes at once.</li>
              <li>📷 <b>Image Overlay:</b> Drag and drop an image onto the canvas to trace over it (adjust opacity or hide it anytime).</li>
              <li>💾 <b>Export / Import:</b> Save your skin as JSON or load one back in.</li>
              <li>👕 <b>Wear Skin:</b> Apply your current design to your Bonk.io account directly.</li>
              <li>⚡ <b>Keyboard Shortcuts:</b> Move, rotate, scale, flip, duplicate, or delete using keys (press <b>Shift + ?</b> to view all).</li>
              <li>🧭 <b>Camera:</b> Zoom or pan with your mouse wheel and drag empty space to move around.</li>
            </ul>
            <button
              className="close-btn"
              style={{ marginTop: "20px" }}
              onClick={() => setShowWelcome(false)}
            >
              Got it!
            </button>
          </div>
        </div>
      )}
    </div>
  );

}
