// // src/App.jsx
// import React, { useState, useRef, useEffect, useMemo } from "react";
// import { FiSettings } from "react-icons/fi";
// import "./index.css";
// import { flipLayers } from "./utils/flipLayers";


// const CANVAS_SIZE = 700;
// const TOTAL_SHAPES = 114;

// const BALL_RADIUS_UNITS = 50;
// const BALL_RADIUS_PX = CANVAS_SIZE / 2;
// const PX_PER_UNIT = BALL_RADIUS_PX / BALL_RADIUS_UNITS;

// const BONK_SCALE_FACTOR = 24.24; // from calibration
// const BONK_POS_FACTOR = 22.26; // from x=11.5 → 37.5 test


// const svgCache = new Map();

// async function loadAndNormalizeSvg(id) {
//   if (svgCache.has(id)) return svgCache.get(id);

//   const raw = await fetch(`/output_shapes/${id}.svg`).then((r) => r.text());
//   const doc = new DOMParser().parseFromString(raw, "image/svg+xml");
//   const root = doc.documentElement;

//   const walk = (el) => {
//     if (el.hasAttribute("fill")) {
//       const f = el.getAttribute("fill");
//       if (f && f.toLowerCase() !== "none")
//         el.setAttribute("fill", "currentColor");
//     }
//     if (el.hasAttribute("stroke")) {
//       const s = el.getAttribute("stroke");
//       if (s && s.toLowerCase() !== "none")
//         el.setAttribute("stroke", "currentColor");
//     }
//     if (el.hasAttribute("style")) {
//       let style = el.getAttribute("style");
//       style = style
//         .replace(/fill\s*:\s*(?!none)[^;]+/gi, "fill:currentColor")
//         .replace(/stroke\s*:\s*(?!none)[^;]+/gi, "stroke:currentColor");
//       el.setAttribute("style", style);
//     }
//     for (const child of el.children || []) walk(child);
//   };
//   walk(root);

//   let minX = 0,
//     minY = 0,
//     vbW = 0,
//     vbH = 0;
//   if (root.hasAttribute("viewBox")) {
//     const parts = root
//       .getAttribute("viewBox")
//       .trim()
//       .split(/[ ,]+/)
//       .map(parseFloat);
//     [minX, minY, vbW, vbH] = parts.length === 4 ? parts : [0, 0, 50, 50];
//   } else {
//     vbW = parseFloat(root.getAttribute("width")) || 50;
//     vbH = parseFloat(root.getAttribute("height")) || 50;
//   }

//   const cx = minX + vbW / 2;
//   const cy = minY + vbH / 2;
//   const inner = root.innerHTML;
//   const html = `<g transform="translate(${-cx},${-cy})">${inner}</g>`;
//   const meta = { html, w: vbW, h: vbH };
//   svgCache.set(id, meta);
//   return meta;
// }

// export default function SkinEditor() {
//   const [shapes, setShapes] = useState([]);
//   const [baseColor, setBaseColor] = useState("#ffffff");
//   const [selectedIndex, setSelectedIndex] = useState(null);
//   const [showShortcuts, setShowShortcuts] = useState(false);

//   // 🔍 Camera state
//   const [camera, setCamera] = useState({
//     x: 0, // pan X
//     y: 0, // pan Y
//     zoom: 1, // zoom scale
//   });

//   const dragRef = useRef(null);
//   const handleRef = useRef(null);
//   const canvasRef = useRef(null);

//   // ---------------- Shape logic ----------------
//   function addShape(id, opts = {}) {
//     const newShape = {
//       id,
//       x: CANVAS_SIZE / 2,
//       y: CANVAS_SIZE / 2,
//       angle: 0,
//       scale: 1,
//       flipX: false,
//       flipY: false,
//       color: "#000000",
//       ...opts,
//     };
//     setShapes((prev) => [...prev, newShape]);
//     setSelectedIndex(shapes.length);
//   }

//   function updateShape(i, patch) {
//     setShapes((prev) =>
//       prev.map((s, idx) => (idx === i ? { ...s, ...patch } : s))
//     );
//   }

//   function onMouseDownShape(e, i) {
//     e.stopPropagation();
//     setSelectedIndex(i);

//     const shape = shapes[i];
//     const startX = e.clientX;
//     const startY = e.clientY;

//     // Capture the camera zoom for consistent movement
//     const zoomAtDragStart = camera.zoom;

//     dragRef.current = { i, startX, startY, origX: shape.x, origY: shape.y, zoom: zoomAtDragStart };

//     function onMove(ev) {
//       const dx = (ev.clientX - dragRef.current.startX) / dragRef.current.zoom;
//       const dy = (ev.clientY - dragRef.current.startY) / dragRef.current.zoom;
//       updateShape(i, {
//         x: dragRef.current.origX + dx,
//         y: dragRef.current.origY + dy,
//       });
//     }

//     function onUp() {
//       window.removeEventListener("mousemove", onMove);
//       window.removeEventListener("mouseup", onUp);
//       dragRef.current = null;
//     }

//     window.addEventListener("mousemove", onMove);
//     window.addEventListener("mouseup", onUp);
//   }


//   function onMouseDownHandle(e, i) {
//     e.stopPropagation();
//     setSelectedIndex(i);

//     const shape = shapes[i];
//     const rect = e.currentTarget.closest("svg").getBoundingClientRect();

//     const zoom = camera.zoom;
//     const camX = camera.x;
//     const camY = camera.y;

//     // Converts screen → world coordinates relative to our canvas transform
//     const toWorld = (clientX, clientY) => {
//       const sx = clientX - rect.left;
//       const sy = clientY - rect.top;
//       // Invert the transform: translate⁻¹ then scale⁻¹
//       return {
//         x: sx / zoom - camX,
//         y: sy / zoom - camY,
//       };
//     };


//     // Account for the fact our world is centered at (CANVAS_SIZE / 2)
//     const canvasCenter = CANVAS_SIZE / 2;
//     const start = toWorld(e.clientX, e.clientY);
//     const cx = shape.x;
//     const cy = shape.y;

//     const startVec = { x: start.x - cx, y: start.y - cy };
//     const startAngle = shape.angle;
//     const startScale = shape.scale;

//     handleRef.current = {
//       i,
//       cx,
//       cy,
//       startVec,
//       startAngle,
//       startScale,
//       zoom,
//       camX,
//       camY,
//     };

//     function onMove(ev) {
//       const cur = toWorld(ev.clientX, ev.clientY);
//       const curVec = { x: cur.x - handleRef.current.cx, y: cur.y - handleRef.current.cy };

//       const d0 = Math.hypot(handleRef.current.startVec.x, handleRef.current.startVec.y);
//       const d1 = Math.hypot(curVec.x, curVec.y);
//       const scale = Math.max(0.05, handleRef.current.startScale * (d1 / d0));

//       const a0 = Math.atan2(handleRef.current.startVec.y, handleRef.current.startVec.x);
//       const a1 = Math.atan2(curVec.y, curVec.x);
//       const deltaDeg = ((a1 - a0) * 180) / Math.PI;

//       updateShape(i, { scale, angle: handleRef.current.startAngle + deltaDeg });
//     }

//     function onUp() {
//       window.removeEventListener("mousemove", onMove);
//       window.removeEventListener("mouseup", onUp);
//       handleRef.current = null;
//     }

//     window.addEventListener("mousemove", onMove);
//     window.addEventListener("mouseup", onUp);
//   }




//   // ---------------- Camera Pan & Zoom ----------------
//   useEffect(() => {
//     const svg = canvasRef.current;
//     if (!svg) return;

//     let isPanning = false;
//     let lastX = 0;
//     let lastY = 0;

//     const handleMouseDown = (e) => {
//       if (e.target === svg) {
//         isPanning = true;
//         lastX = e.clientX;
//         lastY = e.clientY;
//       }
//     };

//     const handleMouseMove = (e) => {
//       if (!isPanning) return;
//       const dx = e.clientX - lastX;
//       const dy = e.clientY - lastY;
//       lastX = e.clientX;
//       lastY = e.clientY;
//       setCamera((prev) => ({
//         ...prev,
//         x: prev.x + dx / prev.zoom,
//         y: prev.y + dy / prev.zoom,
//       }));
//     };

//     const handleMouseUp = () => {
//       isPanning = false;
//     };

//     const handleWheel = (e) => {
//       e.preventDefault();
//       const zoomAmount = e.deltaY * -0.001;
//       setCamera((prev) => {
//         const newZoom = Math.min(Math.max(prev.zoom + zoomAmount, 0.2), 5);
//         return { ...prev, zoom: newZoom };
//       });
//     };

//     svg.addEventListener("mousedown", handleMouseDown);
//     window.addEventListener("mousemove", handleMouseMove);
//     window.addEventListener("mouseup", handleMouseUp);
//     svg.addEventListener("wheel", handleWheel, { passive: false });

//     return () => {
//       svg.removeEventListener("mousedown", handleMouseDown);
//       window.removeEventListener("mousemove", handleMouseMove);
//       window.removeEventListener("mouseup", handleMouseUp);
//       svg.removeEventListener("wheel", handleWheel);
//     };
//   }, []);

//   function resetCamera() {
//     setCamera({ x: 0, y: 0, zoom: 1 });
//   }

//   // ---------------- Export / Import ----------------
//   function exportJSON() {
//     const out = {
//       bc: parseInt(baseColor.replace("#", ""), 16),
//       layers: shapes.map((s) => ({
//         id: s.id,
//         scale: +(s.scale / BONK_SCALE_FACTOR).toFixed(6),
//         angle: +s.angle.toFixed(6),
//         x: +(-((s.x - CANVAS_SIZE / 2) / BONK_POS_FACTOR)).toFixed(6),
//         y: +(((s.y - CANVAS_SIZE / 2) / BONK_POS_FACTOR)).toFixed(6),
//         flipX: !!s.flipX,
//         flipY: !!s.flipY,
//         color: parseInt(s.color.replace("#", ""), 16),
//       })),
//     };
//     const blob = new Blob([JSON.stringify(out, null, 2)], {
//       type: "application/json",
//     });
//     const url = URL.createObjectURL(blob);
//     const a = document.createElement("a");
//     a.href = url;
//     a.download = "bonk-skin.json";
//     a.click();
//     URL.revokeObjectURL(url);
//   }

//   function importJSON(e) {
//     const file = e.target.files[0];
//     if (!file) return;

//     const reader = new FileReader();
//     reader.onload = (evt) => {
//       let parsed = JSON.parse(evt.target.result);

//       // 🔄 Flip layers (so bottom ones are drawn on top)
//       parsed = flipLayers(parsed);

//       setBaseColor(`#${parsed.bc.toString(16).padStart(6, "0")}`);
//       setShapes(
//         parsed.layers.map((l) => ({
//           id: l.id,
//           scale: parseFloat(l.scale) * BONK_SCALE_FACTOR,
//           angle: parseFloat(l.angle),
//           x: parseFloat(l.x) * BONK_POS_FACTOR + CANVAS_SIZE / 2,
//           y: parseFloat(l.y) * BONK_POS_FACTOR + CANVAS_SIZE / 2,
//           flipX: !!l.flipX,
//           flipY: !!l.flipY,
//           color: `#${l.color.toString(16).padStart(6, "0")}`,
//         }))
//       );
//       setSelectedIndex(null);
//     };
//     reader.readAsText(file);
//   }


//   // ---------------- Shape Renderer ----------------
//   function Shape({ s, i }) {
//     const [meta, setMeta] = useState(null);
//     useEffect(() => {
//       let alive = true;
//       (async () => {
//         const m = await loadAndNormalizeSvg(s.id);
//         if (alive) setMeta(m);
//       })();
//       return () => {
//         alive = false;
//       };
//     }, [s.id]);

//     const tr = useMemo(() => {
//       const sx = s.flipX ? -s.scale : s.scale;
//       const sy = s.flipY ? -s.scale : s.scale;
//       return `translate(${s.x},${s.y}) rotate(${s.angle}) scale(${sx},${sy})`;
//     }, [s]);

//     const w = meta?.w ?? 50;
//     const h = meta?.h ?? 50;
//     const HANDLE = 12;

//     return (
//       <g
//         transform={tr}
//         onMouseDown={(e) => onMouseDownShape(e, i)}
//         style={{ color: s.color }}
//         pointerEvents="bounding-box"
//       >
//         <g
//           dangerouslySetInnerHTML={{ __html: meta?.html || "" }}
//           fill={s.color}
//           stroke={s.color}
//         />
//         {selectedIndex === i && (
//           <>
//             <rect
//               x={-w / 2}
//               y={-h / 2}
//               width={w}
//               height={h}
//               fill="none"
//               stroke="lime"
//               strokeWidth={2}
//               pointerEvents="none"
//             />
//             <rect
//               x={w / 2 - HANDLE / 2}
//               y={-h / 2 - HANDLE / 2}
//               width={HANDLE}
//               height={HANDLE}
//               fill="white"
//               stroke="black"
//               onMouseDown={(e) => onMouseDownHandle(e, i)}
//               style={{ cursor: "nwse-resize" }}
//             />
//           </>
//         )}
//       </g>
//     );
//   }

//   // ---------------- Keyboard Shortcuts ----------------
//   useEffect(() => {
//     const handleKeyDown = (e) => {
//       if (e.target.tagName === "INPUT") return;

//       const shape = shapes[selectedIndex];
//       if (!shape) return;

//       const moveStep = e.shiftKey ? 10 : 1;
//       switch (e.key) {
//         case "ArrowUp":
//           updateShape(selectedIndex, { y: shape.y - moveStep });
//           e.preventDefault();
//           break;
//         case "ArrowDown":
//           updateShape(selectedIndex, { y: shape.y + moveStep });
//           e.preventDefault();
//           break;
//         case "ArrowLeft":
//           updateShape(selectedIndex, { x: shape.x - moveStep });
//           e.preventDefault();
//           break;
//         case "ArrowRight":
//           updateShape(selectedIndex, { x: shape.x + moveStep });
//           e.preventDefault();
//           break;
//         case "r":
//           updateShape(selectedIndex, { angle: shape.angle + 5 });
//           break;
//         case "R":
//           updateShape(selectedIndex, { angle: shape.angle - 5 });
//           break;
//         case "x":
//           updateShape(selectedIndex, { flipX: !shape.flipX });
//           break;
//         case "y":
//           updateShape(selectedIndex, { flipY: !shape.flipY });
//           break;
//         case "+":
//         case "=":
//           updateShape(selectedIndex, { scale: shape.scale * 1.05 });
//           break;
//         case "-":
//           updateShape(selectedIndex, { scale: shape.scale * 0.95 });
//           break;
//         case "Delete":
//         case "Backspace":
//           setShapes((prev) => prev.filter((_, idx) => idx !== selectedIndex));
//           setSelectedIndex(null);
//           break;
//         case "Escape":
//           setSelectedIndex(null);
//           break;
//       }

//       // Ctrl-based commands
//       if (e.ctrlKey || e.metaKey) {
//         switch (e.key.toLowerCase()) {
//           case "s":
//             e.preventDefault();
//             exportJSON();
//             break;
//           case "d":
//             e.preventDefault();
//             setShapes((prev) => [
//               ...prev,
//               { ...shape, x: shape.x + 10, y: shape.y + 10 },
//             ]);
//             break;
//           case "c":
//             e.preventDefault();
//             navigator.clipboard.writeText(JSON.stringify(shape));
//             break;
//           case "v":
//             e.preventDefault();
//             navigator.clipboard.readText().then((text) => {
//               try {
//                 const pasted = JSON.parse(text);
//                 if (pasted.id) {
//                   setShapes((prev) => [
//                     ...prev,
//                     { ...pasted, x: pasted.x + 10, y: pasted.y + 10 },
//                   ]);
//                 }
//               } catch {}
//             });
//             break;
//         }
//       }
//     };

//     window.addEventListener("keydown", handleKeyDown);
//     return () => window.removeEventListener("keydown", handleKeyDown);
//   }, [selectedIndex, shapes]);

//   // Shift+? to open shortcuts modal
//   useEffect(() => {
//     const handleHelpShortcut = (e) => {
//       if (e.shiftKey && e.key === "?") {
//         e.preventDefault();
//         setShowShortcuts(true);
//       }
//     };
//     window.addEventListener("keydown", handleHelpShortcut);
//     return () => window.removeEventListener("keydown", handleHelpShortcut);
//   }, []);

//   // ---------------- Render ----------------
//   return (
//     <div className="editor-container">
//       <div className="editor-main">
//         <div className="editor-toolbar">
//           <label>
//             Base color:
//             <input
//               type="color"
//               value={baseColor}
//               onChange={(e) => setBaseColor(e.target.value)}
//             />
//           </label>
//           <button className="editor-btn" onClick={exportJSON}>
//             Export
//           </button>
//           <label className="file-label">
//             Import
//             <input
//               type="file"
//               accept=".json"
//               onChange={importJSON}
//               className="file-input"
//             />
//           </label>
//           <button
//             className="editor-btn"
//             onClick={() =>
//               selectedIndex != null &&
//               updateShape(selectedIndex, {
//                 flipX: !shapes[selectedIndex].flipX,
//               })
//             }
//           >
//             FlipX
//           </button>
//           <button
//             className="editor-btn"
//             onClick={() =>
//               selectedIndex != null &&
//               updateShape(selectedIndex, {
//                 flipY: !shapes[selectedIndex].flipY,
//               })
//             }
//           >
//             FlipY
//           </button>
//           <button className="editor-btn" onClick={resetCamera}>Reset View</button>
//           <button
//             className="editor-btn"
//             title="Keyboard Shortcuts"
//             onClick={() => setShowShortcuts(true)}
//           >
//             <FiSettings size={18} style={{ marginRight: "4px" }} />
//             Shortcuts
//           </button>
//           <input
//             type="color"
//             value={
//               selectedIndex != null ? shapes[selectedIndex].color : "#000000"
//             }
//             onChange={(e) =>
//               selectedIndex != null &&
//               updateShape(selectedIndex, { color: e.target.value })
//             }
//             title="Shape color"
//           />
//         </div>

//         {/* Canvas */}
//         <svg
//           ref={canvasRef}
//           width={CANVAS_SIZE}
//           height={CANVAS_SIZE}
//           className="editor-canvas"
//           onMouseDown={() => setSelectedIndex(null)}
//         >
//           <g transform={`scale(${camera.zoom}) translate(${camera.x},${camera.y})`}>
//             <defs>
//               <clipPath id="playerClip">
//                 <circle
//                   cx={CANVAS_SIZE / 2}
//                   cy={CANVAS_SIZE / 2}
//                   r={BALL_RADIUS_PX}
//                 />
//               </clipPath>
//             </defs>

//             {/* Shadow outline */}
//             <circle
//               cx={CANVAS_SIZE / 2}
//               cy={CANVAS_SIZE / 2}
//               r={BALL_RADIUS_PX + 2}
//               fill="none"
//               stroke="rgba(0,0,0,0.25)"
//               strokeWidth={4}
//             />

//             {/* Base fill */}
//             <circle
//               cx={CANVAS_SIZE / 2}
//               cy={CANVAS_SIZE / 2}
//               r={BALL_RADIUS_PX}
//               fill={baseColor}
//               stroke="#333"
//               strokeWidth={3}
//             />

//             {/* Shapes */}
//             {selectedIndex == null ? (
//               // 🟢 Normal mode — clip all shapes to the circle
//               <g clipPath="url(#playerClip)">
//                 {shapes.map((s, i) => (
//                   <Shape key={i} s={s} i={i} />
//                 ))}
//               </g>
//             ) : (
//               // 🧩 Edit mode — draw selected shape un-clipped on top
//               <>
//                 <g clipPath="url(#playerClip)">
//                   {shapes.map((s, i) =>
//                     i === selectedIndex ? null : <Shape key={i} s={s} i={i} />
//                   )}
//                 </g>
//                 <Shape s={shapes[selectedIndex]} i={selectedIndex} />
//               </>
//             )}
//           </g>
//         </svg>
//       </div>


//       {/* Side panels */}
//       <div className="side-panels">
//         <div className="shapes-panel">
//           <h3>Shapes</h3>
//           <div className="shape-grid">
//             {Array.from({ length: TOTAL_SHAPES }, (_, idx) => {
//               const id = idx + 1;
//               return (
//                 <div
//                   key={id}
//                   className="shape-item"
//                   onClick={() => addShape(id)}
//                 >
//                   <img
//                     src={`/output_shapes/${id}.svg`}
//                     alt={`Shape ${id}`}
//                     width={32}
//                     height={32}
//                   />
//                   <small>{id}</small>
//                 </div>
//               );
//             })}
//           </div>
//         </div>

//         <div className="layers-panel">
//           <h3>Layers</h3>
//           {shapes
//             .slice()
//             .reverse()
//             .map((s, i) => {
//               const realIndex = shapes.length - 1 - i;
//               const selected = realIndex === selectedIndex;
//               return (
//                 <button
//                   key={i}
//                   onClick={() => setSelectedIndex(realIndex)}
//                   className={`layer-btn ${selected ? "active" : ""}`}
//                 >
//                   {`Shape ${s.id}`}
//                 </button>
//               );
//             })}
//         </div>
//       </div>

//       {/* Shortcuts Modal */}
//       {showShortcuts && (
//         <div
//           className="modal-overlay"
//           onClick={() => setShowShortcuts(false)}
//         >
//           <div className="modal-content" onClick={(e) => e.stopPropagation()}>
//             <h2>🎹 Keyboard Shortcuts</h2>
//             <div className="shortcuts-grid">
//               <div>
//                 <h3>🧩 Shape Controls</h3>
//                 <ul>
//                   <li><b>Arrow Keys</b> — Move shape (Shift = 10px)</li>
//                   <li><b>R / Shift+R</b> — Rotate ±5°</li>
//                   <li><b>+</b> / <b>-</b> — Scale up/down</li>
//                   <li><b>X</b> / <b>Y</b> — Flip horizontally/vertically</li>
//                   <li><b>Delete</b> — Delete shape</li>
//                   <li><b>Ctrl+D</b> — Duplicate shape</li>
//                   <li><b>Ctrl+C / Ctrl+V</b> — Copy / Paste shape</li>
//                 </ul>
//               </div>
//               <div>
//                 <h3>🧭 Layer Management</h3>
//                 <ul>
//                   <li><b>Ctrl+[</b> — Move layer down</li>
//                   <li><b>Ctrl+]</b> — Move layer up</li>
//                   <li><b>Ctrl+Shift+[</b> — Send to back</li>
//                   <li><b>Ctrl+Shift+]</b> — Bring to front</li>
//                 </ul>
//               </div>
//               <div>
//                 <h3>💾 Editor</h3>
//                 <ul>
//                   <li><b>Ctrl+S</b> — Export JSON</li>
//                   <li><b>Ctrl+O</b> — Import JSON</li>
//                   <li><b>Esc</b> — Deselect shape</li>
//                   <li><b>Shift+?</b> — Show this help menu</li>
//                 </ul>
//               </div>
//             </div>
//             <button className="close-btn" onClick={() => setShowShortcuts(false)}>
//               Close
//             </button>
//           </div>
//         </div>
//       )}
//     </div>
//   );
// }

// src/App.jsx
import React, { useState, useRef, useEffect, useMemo } from "react";
import { FiSettings } from "react-icons/fi";
import "./index.css";
import { flipLayers } from "./utils/flipLayers";

const CANVAS_SIZE = 700;
const TOTAL_SHAPES = 114;

const BALL_RADIUS_UNITS = 50;
const BALL_RADIUS_PX = CANVAS_SIZE / 2;
const PX_PER_UNIT = BALL_RADIUS_PX / BALL_RADIUS_UNITS;

const BONK_SCALE_FACTOR = 24.24;
const BONK_POS_FACTOR = 22.26;

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

export default function SkinEditor() {
  const [shapes, setShapes] = useState([]);
  const [baseColor, setBaseColor] = useState("#ffffff");
  const [selectedIndices, setSelectedIndices] = useState([]);
  const [showShortcuts, setShowShortcuts] = useState(false);

  const [camera, setCamera] = useState({ x: 0, y: 0, zoom: 1 });

  const dragRef = useRef(null);
  const handleRef = useRef(null);
  const canvasRef = useRef(null);

  const isSelected = (i) => selectedIndices.includes(i);
  const clearSelection = () => setSelectedIndices([]);

  // ---------- Shape logic ----------
  function addShape(id, opts = {}) {
    const newShape = {
      id,
      x: CANVAS_SIZE / 2,
      y: CANVAS_SIZE / 2,
      angle: 0,
      scale: 1,
      flipX: false,
      flipY: false,
      color: "#000000",
      ...opts,
    };
    setShapes((prev) => [...prev, newShape]);
    setSelectedIndices([shapes.length]);
  }

  function updateShape(i, patch) {
    setShapes((prev) =>
      prev.map((s, idx) => (idx === i ? { ...s, ...patch } : s))
    );
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
      const ref = dragRef.current;
      if (!ref || !ref.originalPositions) return; // ✅ Guard

      const dx = (ev.clientX - ref.startX) / ref.zoom;
      const dy = (ev.clientY - ref.startY) / ref.zoom;

      setShapes((prev) =>
        prev.map((s, idx) => {
          const orig = ref.originalPositions.find((o) => o.idx === idx);
          return orig ? { ...s, x: orig.x + dx, y: orig.y + dy } : s;
        })
      );
    }

    function onUp() {
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

    function onMove(ev) {
      const cur = toWorld(ev.clientX, ev.clientY);
      const curVec = { x: cur.x - handleRef.current.cx, y: cur.y - handleRef.current.cy };
      const d0 = Math.hypot(handleRef.current.startVec.x, handleRef.current.startVec.y);
      const d1 = Math.hypot(curVec.x, curVec.y);
      const scale = Math.max(0.05, handleRef.current.startScale * (d1 / d0));
      const a0 = Math.atan2(handleRef.current.startVec.y, handleRef.current.startVec.x);
      const a1 = Math.atan2(curVec.y, curVec.x);
      const deltaDeg = ((a1 - a0) * 180) / Math.PI;
      updateShape(i, { scale, angle: handleRef.current.startAngle + deltaDeg });
    }

    function onUp() {
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
      const zoomAmount = e.deltaY * -0.001;
      setCamera((prev) => {
        const newZoom = Math.min(Math.max(prev.zoom + zoomAmount, 0.2), 5);
        return { ...prev, zoom: newZoom };
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
      layers: shapes.map((s) => ({
        id: s.id,
        scale: +(s.scale / BONK_SCALE_FACTOR).toFixed(6),
        angle: +s.angle.toFixed(6),
        x: +(-((s.x - CANVAS_SIZE / 2) / BONK_POS_FACTOR)).toFixed(6),
        y: +(((s.y - CANVAS_SIZE / 2) / BONK_POS_FACTOR)).toFixed(6),
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
      parsed = flipLayers(parsed);
      setBaseColor(`#${parsed.bc.toString(16).padStart(6, "0")}`);
      setShapes(
        parsed.layers.map((l) => ({
          id: l.id,
          scale: parseFloat(l.scale) * BONK_SCALE_FACTOR,
          angle: parseFloat(l.angle),
          x: parseFloat(l.x) * BONK_POS_FACTOR + CANVAS_SIZE / 2,
          y: parseFloat(l.y) * BONK_POS_FACTOR + CANVAS_SIZE / 2,
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
    useEffect(() => {
      let alive = true;
      (async () => {
        const m = await loadAndNormalizeSvg(s.id);
        if (alive) setMeta(m);
      })();
      return () => (alive = false);
    }, [s.id]);

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
        onMouseDown={(e) => onMouseDownShape(e, i)}
        style={{ color: s.color }}
        pointerEvents="bounding-box"
      >
        <g dangerouslySetInnerHTML={{ __html: meta?.html || "" }} fill={s.color} stroke={s.color} />
        {isSelected(i) && (
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
              onMouseDown={(e) => onMouseDownHandle(e, i)}
              style={{ cursor: "nwse-resize" }}
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
      setShapes((prev) => {
        const newShapes = [...prev];
        for (const idx of selectedIndices) {
          const s = newShapes[idx];
          switch (e.key) {
            case "ArrowUp":
              newShapes[idx] = { ...s, y: s.y - moveStep };
              e.preventDefault();
              break;
            case "ArrowDown":
              newShapes[idx] = { ...s, y: s.y + moveStep };
              e.preventDefault();
              break;
            case "ArrowLeft":
              newShapes[idx] = { ...s, x: s.x - moveStep };
              e.preventDefault();
              break;
            case "ArrowRight":
              newShapes[idx] = { ...s, x: s.x + moveStep };
              e.preventDefault();
              break;
            case "r":
              newShapes[idx] = { ...s, angle: s.angle + 5 };
              break;
            case "R":
              newShapes[idx] = { ...s, angle: s.angle - 5 };
              break;
            case "x":
              newShapes[idx] = { ...s, flipX: !s.flipX };
              break;
            case "y":
              newShapes[idx] = { ...s, flipY: !s.flipY };
              break;
            case "+":
            case "=":
              newShapes[idx] = { ...s, scale: s.scale * 1.05 };
              break;
            case "-":
              newShapes[idx] = { ...s, scale: s.scale * 0.95 };
              break;
          }
        }
        return newShapes;
      });

      if (e.key === "Escape") clearSelection();

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
            setShapes((prev) => [
              ...prev,
              ...selectedIndices.map((i) => ({
                ...prev[i],
                x: prev[i].x + 10,
                y: prev[i].y + 10,
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
                  setShapes((prev) => [
                    ...prev,
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
          case "Delete":
          case "Backspace":
            e.preventDefault();
            setShapes((prev) =>
              prev.filter((_, idx) => !selectedIndices.includes(idx))
            );
            clearSelection();
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

  // ---------- Render ----------
  return (
    <div className="editor-container">
      <div className="editor-main">
        <div className="editor-toolbar">
          <label>
            Base color:
            <input
              type="color"
              value={baseColor}
              onChange={(e) => setBaseColor(e.target.value)}
            />
          </label>
          <button
            className="editor-btn"
            onClick={async () => {
              const skinJSON = {
                bc: parseInt(baseColor.replace("#", ""), 16),
                layers: shapes.map((s) => ({
                  id: s.id,
                  scale: +(s.scale / BONK_SCALE_FACTOR).toFixed(6),
                  angle: +s.angle.toFixed(6),
                  x: +(((s.x - CANVAS_SIZE / 2) / BONK_POS_FACTOR)).toFixed(6),
                  y: +(((s.y - CANVAS_SIZE / 2) / BONK_POS_FACTOR)).toFixed(6),
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
                console.log("Skin code:", data.skinCode);
              } else {
                alert("❌ Failed to wear skin: " + (data.error || "unknown"));
              }
            }}
          >
            Wear Skin
          </button>
          <button className="editor-btn" onClick={exportJSON}>Export</button>
          <label className="file-label">
            Import
            <input type="file" accept=".json" onChange={importJSON} className="file-input" />
          </label>
          <button
            className="editor-btn"
            onClick={() =>
              selectedIndices.length > 0 &&
              setShapes((prev) =>
                prev.map((s, i) =>
                  selectedIndices.includes(i) ? { ...s, flipX: !s.flipX } : s
                )
              )
            }
          >
            FlipX
          </button>
          <button
            className="editor-btn"
            onClick={() =>
              selectedIndices.length > 0 &&
              setShapes((prev) =>
                prev.map((s, i) =>
                  selectedIndices.includes(i) ? { ...s, flipY: !s.flipY } : s
                )
              )
            }
          >
            FlipY
          </button>
          <button className="editor-btn" onClick={resetCamera}>
            Reset View
          </button>
          <button
            className="editor-btn"
            title="Keyboard Shortcuts"
            onClick={() => setShowShortcuts(true)}
          >
            <FiSettings size={18} style={{ marginRight: "4px" }} />
            Shortcuts
          </button>
          <input
            type="color"
            value={
              selectedIndices.length === 1
                ? shapes[selectedIndices[0]].color
                : "#000000"
            }
            onChange={(e) =>
              selectedIndices.length > 0 &&
              setShapes((prev) =>
                prev.map((s, i) =>
                  selectedIndices.includes(i)
                    ? { ...s, color: e.target.value }
                    : s
                )
              )
            }
            title="Shape color"
          />
        </div>

        {/* Canvas */}
        <svg
          ref={canvasRef}
          width={CANVAS_SIZE}
          height={CANVAS_SIZE}
          className="editor-canvas"
          onMouseDown={clearSelection}
        >
          <g transform={`scale(${camera.zoom}) translate(${camera.x},${camera.y})`}>
            <defs>
              <clipPath id="playerClip">
                <circle
                  cx={CANVAS_SIZE / 2}
                  cy={CANVAS_SIZE / 2}
                  r={BALL_RADIUS_PX}
                />
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

            {/* Base fill */}
            <circle
              cx={CANVAS_SIZE / 2}
              cy={CANVAS_SIZE / 2}
              r={BALL_RADIUS_PX}
              fill={baseColor}
              stroke="#333"
              strokeWidth={3}
            />

            {/* Shapes */}
            <g clipPath="url(#playerClip)">
              {shapes.map((s, i) => (
                <Shape key={i} s={s} i={i} />
              ))}
            </g>
          </g>
        </svg>
      </div>

      {/* Panels */}
      <div className="side-panels">
        <div className="shapes-panel">
          <h3>Shapes</h3>
          <div className="shape-grid">
            {Array.from({ length: TOTAL_SHAPES }, (_, idx) => {
              const id = idx + 1;
              return (
                <div key={id} className="shape-item" onClick={() => addShape(id)}>
                  <img src={`/output_shapes/${id}.svg`} alt={`Shape ${id}`} width={32} height={32} />
                  <small>{id}</small>
                </div>
              );
            })}
          </div>
        </div>

        <div className="layers-panel">
          <h3>Layers</h3>
          {shapes
            .slice()
            .reverse()
            .map((s, i) => {
              const realIndex = shapes.length - 1 - i;
              const selected = isSelected(realIndex);
              return (
                <button
                  key={i}
                  onClick={() => setSelectedIndices([realIndex])}
                  className={`layer-btn ${selected ? "active" : ""}`}
                >
                  {`Shape ${s.id}`}
                </button>
              );
            })}
        </div>
      </div>

      {/* Shape Properties Panel */}
      {selectedIndices.length === 1 && (
        <div className="shape-properties">
          <h3>Shape Properties</h3>
          {(() => {
            const i = selectedIndices[0];
            const s = shapes[i];
            return (
              <div className="shape-props-form">
                <label>
                  Color:
                  <input
                    type="color"
                    value={s.color}
                    onChange={(e) => updateShape(i, { color: e.target.value })}
                  />
                </label>

                <label>
                  Scale:
                  <input
                    type="number"
                    step="0.01"
                    value={s.scale.toFixed(3)}
                    onChange={(e) =>
                      updateShape(i, { scale: parseFloat(e.target.value) || 0 })
                    }
                  />
                </label>

                <label>
                  Angle:
                  <input
                    type="number"
                    step="1"
                    value={s.angle.toFixed(3)}
                    onChange={(e) =>
                      updateShape(i, { angle: parseFloat(e.target.value) || 0 })
                    }
                  />
                </label>

                <label>
                  X Pos:
                  <input
                    type="number"
                    step="1"
                    value={s.x.toFixed(1)}
                    onChange={(e) =>
                      updateShape(i, { x: parseFloat(e.target.value) || 0 })
                    }
                  />
                </label>

                <label>
                  Y Pos:
                  <input
                    type="number"
                    step="1"
                    value={s.y.toFixed(1)}
                    onChange={(e) =>
                      updateShape(i, { y: parseFloat(e.target.value) || 0 })
                    }
                  />
                </label>

                <div className="flip-row">
                  <label>
                    <input
                      type="checkbox"
                      checked={s.flipX}
                      onChange={(e) => updateShape(i, { flipX: e.target.checked })}
                    />{" "}
                    Flip X
                  </label>
                  <label>
                    <input
                      type="checkbox"
                      checked={s.flipY}
                      onChange={(e) => updateShape(i, { flipY: e.target.checked })}
                    />{" "}
                    Flip Y
                  </label>
                </div>

                <button
                  className="delete-btn"
                  onClick={() => {
                    setShapes((prev) => prev.filter((_, idx) => idx !== i));
                    setSelectedIndices([]);
                  }}
                >
                  Delete Shape
                </button>
              </div>
            );
          })()}
        </div>
      )}


      {/* Shortcuts Modal */}
      {showShortcuts && (
        <div className="modal-overlay" onClick={() => setShowShortcuts(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <h2>🎹 Keyboard Shortcuts</h2>
            <div className="shortcuts-grid">
              <div>
                <h3>🧩 Shape Controls</h3>
                <ul>
                  <li><b>Arrow Keys</b> — Move (Shift = 10px)</li>
                  <li><b>R / Shift+R</b> — Rotate ±5°</li>
                  <li><b>+</b> / <b>-</b> — Scale up/down</li>
                  <li><b>X / Y</b> — Flip horizontally/vertically</li>
                  <li><b>Delete</b> — Delete selected</li>
                  <li><b>Ctrl+D</b> — Duplicate selected</li>
                  <li><b>Ctrl+C / Ctrl+V</b> — Copy / Paste</li>
                  <li><b>Shift / Ctrl+Click</b> — Multi-select</li>
                </ul>
              </div>
            </div>
            <button className="close-btn" onClick={() => setShowShortcuts(false)}>Close</button>
          </div>
        </div>
      )}
    </div>
  );
}

