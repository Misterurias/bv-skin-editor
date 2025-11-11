// src/ColorPicker.jsx
import React, { useRef, useEffect, useState } from "react";

const mode = { HSV: 0, HSL: 1, OKLCH: 2 };
const segmentNum = 100;
const okChromaScale = 0.27;

export default function ColorPicker({ id, color, setColor, pickerMode, setPickerMode, width = 200, height = 150}) {
  const outerRadius = Math.min(height, width) / 2 - 3;
  const innerRadius = outerRadius * 3 / 4;
  const shapeRadius = innerRadius - 8;

  let rgb = hexToRgb(color);
  let initPos = rgbToSliderPos(rgb.r, rgb.g, rgb.b, pickerMode);

  const canvasRef = useRef(null);
  const [hueSliderAngle, setHueSliderAngle] = useState(initPos.angle);
  const [innerSliderPos, setInnerSliderPos] = useState({x: initPos.x, y: initPos.y});
  const [hexInput, setHexInput] = useState(color);
  const [rgbInput, setRgbInput] = useState(`${rgb.r}, ${rgb.g}, ${rgb.b}`);
  const [innerDown, setInnerDown] = useState(false);
  const [outerDown, setOuterDown] = useState(false);
  const [lastId, setLastId] = useState(id);

  let upper = [];
  let cusp = {x: width / 2, y: width/2};
  let cusplc = {l: 0.5, c: 0};
  let lower = [];

  useEffect(() => {
    let rgb = hexToRgb(color);
    let newPos = rgbToSliderPos(rgb.r, rgb.g, rgb.b, pickerMode);
    setHueSliderAngle(newPos.angle);
    setInnerSliderPos({x: newPos.x, y: newPos.y});
  }, [pickerMode]);

  useEffect(() => {
    if(id !== lastId) {
      setLastId(id);
      let rgb = hexToRgb(color);
      let initPos = rgbToSliderPos(rgb.r, rgb.b, rgb.b, pickerMode);
      setHueSliderAngle(initPos.angle);
      setInnerSliderPos({x: initPos.x, y: initPos.y});
      setRgbInput(`${rgb.r}, ${rgb.g}, ${rgb.b}`);
      setHexInput(rgbToHex(rgb));
    }
    
    const canvas = canvasRef.current;
    if(!canvas) return;

    const ctx = canvas.getContext("2d");
    canvas.width = width;
    canvas.height = height;

    ctx.clearRect(0, 0, width, height);

    if(pickerMode === mode.OKLCH) {
      let a = Math.cos(hueSliderAngle + Math.PI / 2);
      let b = Math.sin(hueSliderAngle + Math.PI / 2);
      cusplc = okFindCusp(a, b);

      let cusplr = lToLr(cusplc.l);

      let side = shapeRadius * Math.sin(Math.PI / 4) * 2;
      cusp = {
        x: width / 2 - side / 2 + side * cusplc.c / okChromaScale,
        y: height / 2 + side / 2 - side * cusplr
      };

      upper.push({x: width / 2 - side / 2, y: height / 2 - side / 2});
      for(let angle = Math.PI / segmentNum; angle < Math.PI / 2; angle += Math.PI / segmentNum) {
        let c1 = (1 - cusplc.l) / Math.tan(Math.PI / 2 - angle);
        let t = okGamutIntersection(a, b, cusplc, 1, c1, cusplc.l);
        upper.push({
          x: width / 2 - side / 2 + side * c1 * t / okChromaScale,
          y: height / 2 + side / 2 - side * lToLr(cusplc.l + t * (1 - cusplc.l))
        });
      }
      upper.push({x: cusp.x, y: cusp.y});
      lower.push({x: cusp.x, y: cusp.y});
      for(
        let angle = Math.PI / 2 + Math.PI / segmentNum;
        angle < Math.PI;
        angle += Math.PI / segmentNum
      ) {
        let c1 = -cusplc.l / Math.tan(-Math.PI / 2 - angle);
        let t = okGamutIntersection(a, b, cusplc, 0, c1, cusplc.l);
        lower.push({
          x: width / 2 - side / 2 + side * c1 * t / okChromaScale,
          y: height / 2 + side / 2 - side * lToLr((1 - t) * cusplc.l)
        });
      }
      lower.push({x: width / 2 - side / 2, y: height / 2 + side / 2});
    }

    const imageData = ctx.createImageData(width, height);
    const data = imageData.data;
    for(let i = 0; i < data.length; i += 4) {
      const x = (i / 4) % width;
      const y = Math.floor(i / 4 / width);

      //Outer ring
      let mask = ringMask(x, y, width / 2, height / 2, innerRadius, outerRadius);
      if(mask > 0) {
        const hue = (Math.atan2(y - height / 2, x - width / 2) / Math.PI / 2 + 2 + 0.25) % 1 * 360;
        const color = pickerMode === mode.OKLCH ? oklrchToRgb(0.710, 0.125, hue) : hsvToRgb(hue, 1, 1);
        data[i] = color.r;
        data[i + 1] = color.g;
        data[i + 2] = color.b;
        data[i + 3] = mask;
        continue;
      }

      let hue = (hueSliderAngle / Math.PI / 2 + 1 + 0.25) % 1 * 360;
      if(pickerMode === mode.HSV) {
        mask = triangleMask(x, y, width / 2, height / 2, shapeRadius);
        if(mask > 0) {
          let rgb = triangleColor(x, y, width / 2, height / 2, shapeRadius, hue);
          data[i] = rgb.r;
          data[i + 1] = rgb.g;
          data[i + 2] = rgb.b;
          data[i + 3] = mask;
        }
      } else if(pickerMode === mode.HSL) {
        mask = hslMask(x, y, width / 2, height / 2, shapeRadius);
        if(mask > 0) {
          let rgb = hslColor(x, y, width / 2, height / 2, shapeRadius, hue);
          data[i] = rgb.r;
          data[i + 1] = rgb.g;
          data[i + 2] = rgb.b;
          data[i + 3] = mask;
        }
      } else if(pickerMode === mode.OKLCH && x <= cusp.x) {
        let side = shapeRadius * Math.sin(Math.PI / 4) * 2;
        let cuspAngle = Math.atan2(y - cusp.y, (x - width / 2 + side / 2) * okChromaScale);
        let mask;
        if(cuspAngle <= -Math.PI / 2) mask = 0;
        else if(cuspAngle < 0) {
          let i = Math.floor((Math.PI / 2 + cuspAngle) / Math.PI * segmentNum);
          let xOffset = 0.5 + x - upper[i].x;
          let yOffset = 0.5 + y - upper[i].y;
          mask = 255 * Math.min(1, Math.max(0, yOffset - (upper[i + 1].y - upper[i].y) / (upper[i + 1].x - upper[i].x) * xOffset));
        } else if(cuspAngle < Math.PI / 2) {
          let i = Math.floor(cuspAngle / Math.PI * segmentNum);
          let xOffset = 0.5 + x - lower[i].x;
          let yOffset = 0.5 + y - lower[i].y;
          mask = 255 * Math.min(1, Math.max(0, -yOffset + (lower[i + 1].y - lower[i].y) / (lower[i + 1].x - lower[i].x) * xOffset));
        } else {
          mask = 0;
        }

        let lr = -(y - height / 2 - side / 2) / side;
        let c = (x - width / 2 + side / 2) / side * okChromaScale;
        let rgb = oklrchToRgb(lr, c, hue);
        
        data[i] = rgb.r;
        data[i + 1] = rgb.g;
        data[i + 2] = rgb.b;
        data[i + 3] = mask;
      }
    }
    ctx.putImageData(imageData, 0, 0);

    let hueSliderX = width / 2 + Math.cos(hueSliderAngle) * (outerRadius + innerRadius) / 2;
    let hueSliderY = height / 2 + Math.sin(hueSliderAngle) * (outerRadius + innerRadius) / 2;
    ctx.beginPath()
    ctx.arc(hueSliderX, hueSliderY, 9, 0, Math.PI * 2, false);
    ctx.lineWidth = 5;
    ctx.strokeStyle = "#608188";
    ctx.stroke();
    ctx.beginPath()
    ctx.arc(hueSliderX, hueSliderY, 6, 0, Math.PI * 2, false);
    ctx.lineWidth = 5;
    ctx.strokeStyle = "#2f4f55";
    ctx.stroke();

    ctx.beginPath()
    ctx.arc(innerSliderPos.x, innerSliderPos.y, 9, 0, Math.PI * 2, false);
    ctx.lineWidth = 5;
    ctx.strokeStyle = "#608188";
    ctx.stroke();
    ctx.beginPath()
    ctx.arc(innerSliderPos.x, innerSliderPos.y, 6, 0, Math.PI * 2, false);
    ctx.lineWidth = 5;
    ctx.strokeStyle = "#2f4f55";
    ctx.stroke();

    let onMouseDown = (e) => {
      let rect = canvas.getBoundingClientRect();
      let x = e.clientX - rect.left;
      let y = e.clientY - rect.top;

      if(Math.sqrt(Math.pow(x - width / 2, 2) + Math.pow(y - height / 2, 2)) < innerRadius) {
        setInnerDown(true);
        mouseUpdate(x, y, true, false);
      }
      else {
        setOuterDown(true);
        mouseUpdate(x, y, false, true);
      }
    }

    let onMouseMove = (e) => {
      let rect = canvas.getBoundingClientRect();
      let x = e.clientX - rect.left;
      let y = e.clientY - rect.top;
      mouseUpdate(x, y, innerDown, outerDown);
    }

    let onMouseUp = (e) => {
      setInnerDown(false);
      setOuterDown(false);
    }

    canvas.addEventListener("mousedown", onMouseDown);
    document.addEventListener("mousemove", onMouseMove);
    document.addEventListener("mouseup", onMouseUp);

    return () => {
      canvas.removeEventListener("mousedown", onMouseDown);
      document.removeEventListener("mousemove", onMouseMove);
      document.removeEventListener("mouseup", onMouseUp);
    };
  }, [color, innerSliderPos, hueSliderAngle]);

  function mouseUpdate(x, y, inner, outer) {
    if(outer) {
      let angle = Math.atan2(y - height / 2, x - width / 2);
      let hue = (angle / Math.PI / 2 + 1 + 0.25) % 1 * 360;
      setHueSliderAngle(angle);
      let pos = innerSliderPos;

      if(pickerMode === mode.OKLCH){
        let side = shapeRadius * Math.sin(Math.PI / 4) * 2;
        cusplc = okFindCusp(Math.cos(hue / 180 * Math.PI), Math.sin(hue / 180 * Math.PI));
        let maxX= 
          okMaxChroma(1 - (pos.y - height / 2 + side / 2) / side, hue, cusplc)
          / okChromaScale * side + width / 2 - side / 2;
        if(pos.x > maxX) pos.x = maxX;
        setInnerSliderPos({x: pos.x, y: pos.y});
      }

      updateColor(innerSliderPos.x, innerSliderPos.y, angle);
    } else if(inner) {
      let bounded = pickerMode === mode.HSV ? triangleBounds(x, y, width / 2, height / 2, shapeRadius)
        : pickerMode === mode.HSL ? hslBounds(x, y, width / 2, height / 2, shapeRadius)
        : okBounds(x, y);
      setInnerSliderPos({x: bounded.x, y: bounded.y});
      updateColor(bounded.x, bounded.y, hueSliderAngle);
    }
  }

  function onHexChange(e) {
    let hex = e.target.value;
    setHexInput(hex);

    let match = hex.match(/^#([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i);
    if(match === null) return;
    setColor(match[0]);

    let r = parseInt(match[1], 16);
    let g = parseInt(match[2], 16);
    let b = parseInt(match[3], 16);

    let {angle, x, y} = rgbToSliderPos(r, g, b, pickerMode);
    setHueSliderAngle(angle);
    setInnerSliderPos({x, y});
  }

  function onRgbChange(e) {
    let rgbText = e.target.value;
    setRgbInput(rgbText);

    let match = rgbText.match(/^(\d{1,3})\s*,\s*(\d{1,3})\s*,\s*(\d{1,3})/)
    if(match === null) return;

    let r = parseInt(match[1]);
    let g = parseInt(match[2]);
    let b = parseInt(match[3]);

    setColor(rgbToHex({r, g, b}));

    let {angle, x, y} = rgbToSliderPos(r, g, b, pickerMode);
    setHueSliderAngle(angle);
    setInnerSliderPos({x, y});
  }

  function rgbToSliderPos(r, g, b, pickerMode) {
    if(pickerMode === mode.HSV) {
      let hsv = rgbToHsv(r, g, b);

      let angle = (hsv.h / 360 - 0.25) * Math.PI * 2;

      let min = -shapeRadius;
      let max = shapeRadius * Math.cos(Math.PI / 3)
      let proj = min + hsv.v * (max - min);
      let range = hsv.v * 2 * shapeRadius * Math.sin(Math.PI / 3)
      let perp = hsv.s * range - range / 2;

      let x = width / 2 + proj * Math.cos(Math.PI / 3) + perp * Math.cos(Math.PI / 6);
      let y = height / 2 - proj * Math.sin(Math.PI / 3) + perp * Math.sin(Math.PI / 6);

      return {angle, x, y};
    } else if(pickerMode === mode.HSL) {
      let hsl = rgbToHsl(r, g, b);
      
      let angle = (hsl.h / 360 - 0.25) * Math.PI * 2;
      let range = 2 * shapeRadius * (1 - Math.abs(2 * hsl.l - 1));
      let x = width / 2 - range / 2 + hsl.s * range;
      let y = height / 2 + shapeRadius - hsl.l * shapeRadius * 2;

      return {angle, x, y};
    } else if(pickerMode === mode.OKLCH) {
      let lch = rgbToOklrch(r, g, b);

      let angle = (lch.h / 360 - 0.25) * Math.PI * 2;

      let side = shapeRadius * Math.sin(Math.PI / 4) * 2;
      let x = width / 2 - side / 2 + lch.c * side / okChromaScale;
      let y = height / 2 + side / 2 - lch.l * side

      return {angle, x, y};
    }
  }

  function updateColor(x, y, angle) {
    let hue = (angle / Math.PI / 2 + 1 + 0.25) % 1 * 360;
    let rgb = pickerMode === mode.HSV ? triangleColor(x, y, width / 2, height / 2, shapeRadius, hue)
      : pickerMode === mode.HSL ? hslColor(x, y, width / 2, height / 2, shapeRadius, hue)
      : okColor(x, y, width / 2, height / 2, shapeRadius, hue, okChromaScale);
    let hex = rgbToHex(rgb);
    setColor(hex);
    setHexInput(hex);
    setRgbInput(`${Math.round(rgb.r)}, ${Math.round(rgb.g)}, ${Math.round(rgb.b)}`);
  }

  function okBounds(x, y) {
    let hue = (hueSliderAngle / Math.PI / 2 + 1 + 0.25) % 1 * 360;
    let side = shapeRadius * Math.sin(Math.PI / 4) * 2;
    let upperSlope = (cusp.y - height / 2 + side / 2) / (cusp.x - width / 2 + side / 2);
    let lowerSlope = (cusp.y - height / 2 - side / 2) / (cusp.x - width / 2 + side / 2);

    if(x - width / 2 < -side / 2) {
      x = width / 2 - side / 2;

      if(y - height / 2 < -side / 2)
        y = height / 2 - side / 2;
      else if(y - height / 2 > side / 2)
        y = height / 2 + side / 2;
    } else if(lowerSlope * (x - cusp.x) < y - cusp.y) {
      if(-(1 / lowerSlope) * (x - cusp.x) > y - cusp.y) {
        x = cusp.x;
        y = cusp.y;
      } else if(-(1 / lowerSlope) * (x - width / 2 + side / 2) < y - height / 2 - side / 2) {
        x = width / 2 - side / 2;
        y = height / 2 + side / 2;
      } else {
        //Basic line intersection
        let x1 = width / 2 - side / 2;
        let y1 = height / 2 + side / 2;
        let m1 = lowerSlope;
        let x2 = x;
        let y2 = y;
        let m2 = -(1 / lowerSlope);
        x = (m1 * x1 - y1 - m2 * x2 + y2) / (m1 - m2);
        y = m1 * (x - x1) + y1;

        //Refine position
        let cuspAngle = Math.atan2(y - cusp.y, (x - width / 2 + side / 2) * okChromaScale);
        let i = Math.floor(cuspAngle / Math.PI * segmentNum);

        x1 = lower[i].x;
        y1 = lower[i].y;
        m1 = (lower[i + 1].y - lower[i].y) / (lower[i + 1].x - lower[i].x);
        x2 = x;
        y2 = y;
        m2 = -(1 / lowerSlope);
        x = (m1 * x1 - y1 - m2 * x2 + y2) / (m1 - m2);
        y = m1 * (x - x1) + y1;

        //Max Chroma
        x = okMaxChroma(1 - (y - height / 2 + side / 2) / side, hue, cusplc) / okChromaScale * side + width / 2 - side / 2;
      }
    } else if(upperSlope * (x - cusp.x) > y - cusp.y) {
      if(-(1 / upperSlope) * (x - cusp.x) < y - cusp.y) {
        x = cusp.x;
        y = cusp.y;
      } else if(-(1 / upperSlope) * (x - width / 2 + side / 2) > y - height / 2 + side / 2) {
        x = width / 2 - side / 2;
        y = height / 2 - side / 2;
      }
      else {
        //Basic line intersection
        let x1 = width / 2 - side / 2;
        let y1 = height / 2 - side / 2;
        let m1 = upperSlope;
        let x2 = x;
        let y2 = y;
        let m2 = -(1 / upperSlope);
        x = (m1 * x1 - y1 - m2 * x2 + y2) / (m1 - m2);
        y = m1 * (x - x1) + y1;
        
        let cuspAngle = Math.atan2(y - cusp.y, (x - width / 2 + side / 2) * okChromaScale);
        let i = Math.floor((Math.PI / 2 + cuspAngle) / Math.PI * segmentNum);
        
        //Refine position
        x1 = upper[i].x;
        y1 = upper[i].y;
        m1 = (upper[i + 1].y - upper[i].y) / (upper[i + 1].x - upper[i].x);
        x2 = x;
        y2 = y;
        m2 = -(1 / upperSlope);
        x = (m1 * x1 - y1 - m2 * x2 + y2) / (m1 - m2);
        y = m1 * (x - x1) + y1;

        //Max Chroma
        x = okMaxChroma(1 - (y - height / 2 + side / 2) / side, hue, cusplc) / okChromaScale * side + width / 2 - side / 2;
      }
    }


    return {x, y};
  }

  return (
    <div style={{display: "flex", "flexDirection": "column", width: "100%", height: "100%"}}>
      <div style={{display: "flex"}}>
        <button
          className="color-picker-mode"
          onClick={() => setPickerMode(mode.HSV)}
          aria-pressed={pickerMode == mode.HSV ? "true" : "false"}
        >
          HSV
        </button>
        <button
          className="color-picker-mode"
          onClick={() => setPickerMode(mode.HSL)}
          aria-pressed={pickerMode == mode.HSL ? "true" : "false"}
        >
          HSL
        </button>
        <button
          className="color-picker-mode"
          onClick={() => setPickerMode(mode.OKLCH)}
          aria-pressed={pickerMode == mode.OKLCH ? "true" : "false"}
        >
          OkLrCH
        </button>
      </div>
      <canvas ref={canvasRef}></canvas>
      <div style={{display: "flex", gap: "4px"}}>
        <input
          className="neon-input"
          type="text"
          value={hexInput}
          onChange={onHexChange}
        />
        <input
          className="neon-input"
          type="text"
          value={rgbInput}
          onChange={onRgbChange}
        />
      </div>
    </div>
  );
}

function hexToRgb(hex) {
  let match = hex.match(/^#([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i);
  
  if(match === null) match = ["#000000", "00", "00", "00"];

  return {
    r: parseInt(match[1], 16),
    g: parseInt(match[2], 16),
    b: parseInt(match[3], 16),
  }
}

function ringMask(x, y, xPos, yPos, innerR, outerR) {
  let xOffset = x + 0.5 - xPos;
  let yOffset = y + 0.5 - yPos;
  
  return (255 *
    Math.min(1, Math.max(0,
      outerR - Math.sqrt(Math.pow(xOffset, 2) + Math.pow(yOffset, 2))
    )) * 
    Math.min(1, Math.max(0,
      -innerR + Math.sqrt(Math.pow(xOffset, 2) + Math.pow(yOffset, 2))
    ))
  );
}

function triangleMask(x, y, xPos, yPos, r) {
  let xOffset = x + 0.5 - xPos;
  let yOffset = y + 0.5 - yPos;
  let innerR = r * Math.cos(Math.PI / 3);
  
  return (255 *
    Math.min(1, Math.max(0,
      innerR - xOffset * Math.cos(Math.PI / 3) - yOffset * Math.sin(Math.PI / 3)
    )) *
    Math.min(1, Math.max(0,
      innerR - xOffset * Math.cos(Math.PI / 3) + yOffset * Math.sin(Math.PI / 3)
    )) *
    Math.min(1, Math.max(0,
      innerR + xOffset
    ))
  );
}

function hslMask(x, y, xPos, yPos, r) {
  let xOffset = x + 0.5 - xPos;
  let yOffset = y + 0.5 - yPos;
  let innerR = r * Math.cos(Math.PI / 4);

  return (255 *
    Math.min(1, Math.max(0,
      innerR - xOffset * Math.cos(Math.PI / 4) + yOffset * Math.cos(Math.PI / 4)
    )) *
    Math.min(1, Math.max(0,
      innerR - xOffset * Math.cos(Math.PI / 4) - yOffset * Math.cos(Math.PI / 4)
    )) *
    Math.min(1, Math.max(0,
      innerR + xOffset * Math.cos(Math.PI / 4) + yOffset * Math.cos(Math.PI / 4)
    )) *
    Math.min(1, Math.max(0,
      innerR + xOffset * Math.cos(Math.PI / 4) - yOffset * Math.cos(Math.PI / 4)
    ))
  );
}

function triangleColor(x, y, xPos, yPos, r, hue) {
  let min = -r;
  let max = r * Math.cos(Math.PI / 3)
  let proj = (x - xPos) * Math.cos(Math.PI / 3) - (y - yPos) * Math.sin(Math.PI / 3);
  let range = (proj - min) / (max - min) * 2 * r * Math.sin(Math.PI / 3)
  let perp = (x - xPos) * Math.cos(Math.PI / 6) + (y - yPos) * Math.sin(Math.PI / 6);
  return hsvToRgb(hue, (perp + range / 2) / range, (proj - min) / (max - min));
}

function hslColor(x, y, xPos, yPos, r, hue) {
  let range = 2 * (r - Math.abs(y - yPos));
  return hslToRgb(
    hue,
    range === 0 ? 0 : (x - xPos + range / 2) / range,
    1 - (y - yPos + r) / r / 2
  );
}

function okColor(x, y, xPos, yPos, r, hue, chromaScale) {
  let side = r * Math.sin(Math.PI / 4) * 2;
  return oklrchToRgb(1 - (y - yPos + side / 2) / side, chromaScale * (x - xPos + side / 2) / side, hue);
}

function triangleBounds(x, y, xPos, yPos, r) {
  let ri = r * Math.cos(Math.PI / 3);
  if(x - xPos < -ri) {
    x = xPos - ri;

    if(y - yPos < -r * Math.sin(Math.PI / 3))
      y = yPos - r * Math.sin(Math.PI / 3);
    else if(y - yPos > r * Math.sin(Math.PI / 3))
      y = yPos + r * Math.sin(Math.PI / 3);
  } else if((x - xPos) * Math.cos(Math.PI / 3) + (y - yPos) * Math.sin(Math.PI / 3) > ri) {
    if((x - xPos) * Math.cos(Math.PI / 6) - (y - yPos) * Math.sin(Math.PI / 6) > r * Math.sin(Math.PI / 3)) {
      x = xPos + r;
      y = yPos;
    } else if((x - xPos) * Math.cos(Math.PI / 6) - (y - yPos) * Math.sin(Math.PI / 6) < -r * Math.sin(Math.PI / 3)) {
      x = xPos - ri;
      y = yPos + r * Math.sin(Math.PI / 3);
    } else {
      let perp = (x - xPos) * Math.cos(Math.PI / 6) - (y - yPos) * Math.sin(Math.PI / 6);
      x = xPos + ri * Math.cos(Math.PI / 3) + perp * Math.cos(Math.PI / 6);
      y = yPos + ri * Math.sin(Math.PI / 3) - perp * Math.sin(Math.PI / 6);
    }
  } else if((x - xPos) * Math.cos(Math.PI / 3) - (y - yPos) * Math.sin(Math.PI / 3) > ri) {
    if((x - xPos) * Math.cos(Math.PI / 6) + (y - yPos) * Math.sin(Math.PI / 6) > r * Math.sin(Math.PI / 3)) {
      x = xPos + r;
      y = yPos;
    } else if((x - xPos) * Math.cos(Math.PI / 6) + (y - yPos) * Math.sin(Math.PI / 6) < -r * Math.sin(Math.PI / 3)) {
      x = xPos - ri;
      y = yPos - r * Math.sin(Math.PI / 3);
    }
    else {
      let perp = (x - xPos) * Math.cos(Math.PI / 6) + (y - yPos) * Math.sin(Math.PI / 6);
      x = xPos + ri * Math.cos(Math.PI / 3) + perp * Math.cos(Math.PI / 6);
      y = yPos - ri * Math.sin(Math.PI / 3) + perp * Math.sin(Math.PI / 6);
    }
  }

  return {x, y};
}

function hslBounds(x, y, xPos, yPos, r) {
  let cos4 = Math.cos(Math.PI / 4);

  //Rotating coordinates such that the square is axis aligned.
  let x2 = (x - xPos) * cos4 - (y - yPos) * cos4;
  let y2 = (x - xPos) * cos4 + (y - yPos) * cos4;

  let ri = r * cos4;
  if(x2 < -ri) x2 = -ri;
  else if(x2 > ri) x2 = ri;
  if(y2 < -ri) y2 = -ri;
  else if(y2 > ri) y2 = ri;

  return {x: xPos + x2 * cos4 + y2 * cos4, y: yPos - x2 * cos4 + y2 * cos4};
}

function rgbToHex(color) {
  let r = Math.max(0, Math.min(255, Math.round(color.r)));
  let g = Math.max(0, Math.min(255, Math.round(color.g)));
  let b = Math.max(0, Math.min(255, Math.round(color.b)));

  return "#" +
    r.toString(16).padStart(2, "0") +
    g.toString(16).padStart(2, "0") +
    b.toString(16).padStart(2, "0");
}

function rgbToHsv(r, g, b) {
  let v = Math.max(r, g, b);
  let min = Math.min(r, g, b);
  let c = v - min;
  let s = v === 0 ? 0 : c / v;
  
  let h;
  if(s === 0) h = 0;
  else if(v === r) h = (g - b) / c * 60 % 360;
  else if(v === g) h = (b - r) / c * 60 + 120;
  else if(v === b) h = (r - g) / c * 60 + 240;
  else h = 0;

  return {h: h, s: s, v: v / 255};
}

function rgbToHsl(r, g, b) {
  let max = Math.max(r, g, b);
  let min = Math.min(r, g, b);
  let delta = max - min;
  let l = (max + min) / 2;
  let s = delta === 0 ? 0 : delta / (255 - Math.abs(2 * l - 255));

  let h;
  if(s === 0) h = 0;
  else if(max === r) h = (g - b) / delta * 60 % 360;
  else if(max === g) h = (b - r) / delta * 60 + 120;
  else if(max === b) h = (r - g) / delta * 60 + 240;
  else h = 0;

  return {h: h, s: s, l: l / 255};
}

function rgbToOklrch(r, g, b) {
  r /= 255;
  g /= 255;
  b /= 255;
  
  r = r <= 0.04045 ? r / 12.92 : Math.pow(((r + 0.055) / 1.055), 2.4);
  g = g <= 0.04045 ? g / 12.92 : Math.pow(((g + 0.055) / 1.055), 2.4);
  b = b <= 0.04045 ? b / 12.92 : Math.pow(((b + 0.055) / 1.055), 2.4);

  let l = r * 0.4122214708 + g * 0.5363325363 + b * 0.0514459929;
  let m = r * 0.2119034982 + g * 0.6806995451 + b * 0.1073969566;
  let s = r * 0.0883024619 + g * 0.2817188376 + b * 0.6299787005;

  l = Math.cbrt(l);
  m = Math.cbrt(m);
  s = Math.cbrt(s);

  let lum = l * 0.2104542553 + m * 0.7936177850 - s * 0.0040720468;
  let a__ = l * 1.9779984951 - m * 2.4285922050 + s * 0.4505937099;
  let b__ = l * 0.0259040371 + m * 0.7827717662 - s * 0.8086757660;

  let c = Math.sqrt(Math.pow(a__, 2) + Math.pow(b__, 2));
  let h = (Math.atan2(b__, a__) / Math.PI / 2 + 1) % 1 * 360;

  return {l: lToLr(lum), c: c, h: h};
}

function lToLr(l) {
  let k1 = 0.206;
  let k2 = 0.03;
  let k3 = (1 + k1) / (1 + k2);

  return (k3 * l - k1 + Math.sqrt(Math.pow(k3 * l - k1, 2) + 4 * k2 * k3 * l)) / 2;
}

function hsvToRgb(h, s, v) {
  if(h < 0) return {r: 0, g: 0, b: 0};

  let c = v * s;
  let x = c * (1 - Math.abs(h / 60 % 2 - 1))
  let m = v - c;
  if(h < 60) return {
    r: (m + c) * 255,
    g: (m + x) * 255,
    b: m * 255
  };
  else if(h < 120) return  {
    r: (m + x) * 255,
    g: (m + c) * 255,
    b: m * 255
  };
  else if(h < 180) return {
    r: m * 255,
    g: (m + c) * 255,
    b: (m + x) * 255
  };
  else if(h < 240) return {
    r: m * 255,
    g: (m + x) * 255,
    b: (m + c) * 255
  };
  else if(h < 300) return {
    r: (m + x) * 255,
    g: m * 255,
    b: (m + c) * 255
  };
  else return {
    r: (m + c) * 255,
    g: m * 255,
    b: (m + x) * 255
  };
}

function hslToRgb(h, s, l) {
  if(h < 0) return {r: 0, g: 0, b: 0};

  let c = (1 - Math.abs(2 * l - 1)) * s;
  let x = c * (1 - Math.abs(h / 60 % 2 - 1));
  let m = l - c / 2;

  if(h < 60) return {
    r: (m + c) * 255,
    g: (m + x) * 255,
    b: m * 255
  };
  else if(h < 120) return  {
    r: (m + x) * 255,
    g: (m + c) * 255,
    b: m * 255
  };
  else if(h < 180) return {
    r: m * 255,
    g: (m + c) * 255,
    b: (m + x) * 255
  };
  else if(h < 240) return {
    r: m * 255,
    g: (m + x) * 255,
    b: (m + c) * 255
  };
  else if(h < 300) return {
    r: (m + x) * 255,
    g: m * 255,
    b: (m + c) * 255
  };
  else return {
    r: (m + c) * 255,
    g: m * 255,
    b: (m + x) * 255
  };
}

function oklrchToRgb(l, c, h) {
  l = lrToL(l)
  let a_ = c * Math.cos(h / 180 * Math.PI);
  let b_ = c * Math.sin(h / 180 * Math.PI);

  let {r, g, b} = oklabToLinRgb(l, a_, b_);

  r = r <= 0.0031308 ? 12.92 * r : 1.055 * Math.pow(r, 1 / 2.4) - 0.055;
  g = g <= 0.0031308 ? 12.92 * g : 1.055 * Math.pow(g, 1 / 2.4) - 0.055;
  b = b <= 0.0031308 ? 12.92 * b : 1.055 * Math.pow(b, 1 / 2.4) - 0.055;

  return {r: r * 255, g: g * 255, b: b * 255};
}

function oklabToLinRgb(l, a, b) {
  let l_ = l + a * 0.3963377774 + b * 0.2158037573;
  let m_ = l - a * 0.1055613458 - b * 0.0638541728;
  let s_ = l - a * 0.0894841775 - b * 1.2914855480;

  l_ = l_ * l_ * l_;
  m_ = m_ * m_ * m_;
  s_ = s_ * s_ * s_;

  return {
    r: l_ * 4.0767416621 - m_ * 3.3077115913 + s_ * 0.2309699292,
    g:-l_ * 1.2684380046 + m_ * 2.6097574011 - s_ * 0.3413193965,
    b:-l_ * 0.0041960863 - m_ * 0.7034186147 + s_ * 1.7076147010
  }
}

function lrToL(lr) {
  let k1 = 0.206;
  let k2 = 0.03;
  let k3 = (1 + k1) / (1 + k2);

  return lr * (lr + k1) / k3 / (lr + k2);
}

//From https://bottosson.github.io/posts/gamutclipping/
function okMaxSaturation(a, b) {
  let k0, k1, k2, k3, k4, wl, wm, ws;

  if(a * -1.88170328 - b * 0.80936493 > 1) {
    k0 = 1.19086277;
    k1 = 1.76576728;
    k2 = 0.59662641;
    k3 = 0.75515197;
    k4 = 0.56771245;
    wl = 4.0767416621;
    wm = -3.3077115913;
    ws = 0.2309699292;
  } else if (a * 1.81444104 - b * 1.19445276 > 1) {
    k0 = 0.73956515;
    k1 = -0.45954404;
    k2 = 0.08285427;
    k3 = 0.12541070;
    k4 = 0.14503204;
    wl = -1.2684380046;
    wm = 2.6097574011;
    ws = -0.3413193965;
  } else {
    k0 = 1.35733652;
    k1 = -0.00915799;
    k2 = -1.15130210;
    k3 = -0.50559606;
    k4 = 0.00692167;
    wl = -0.0041960863;
    wm = -0.7034186147;
    ws = 1.7076147010;
  }

  let sat = k0 + k1 * a + k2 * b + k3 * a * a + k4 * a * b;

  let k_l = a * 0.3963377774 + b * 0.2158037573;
  let k_m =-a * 0.1055613458 - b * 0.0638541728;
  let k_s =-a * 0.0894841775 - b * 1.2914855480;

  //One step of Halley's method
  {
    let l_ = 1 + sat * k_l;
    let m_ = 1 + sat * k_m;
    let s_ = 1 + sat * k_s;

    let l = l_ * l_ * l_;
    let m = m_ * m_ * m_;
    let s = s_ * s_ * s_;

    let l_ds = 3 * k_l * l_ * l_;
    let m_ds = 3 * k_m * m_ * m_;
    let s_ds = 3 * k_s * s_ * s_;

    let l_ds2 = 6 * k_l * k_l * l_;
    let m_ds2 = 6 * k_m * k_m * m_;
    let s_ds2 = 6 * k_s * k_s * s_;

    let f  = wl * l     + wm * m     + ws * s;
    let f1 = wl * l_ds  + wm * m_ds  + ws * s_ds;
    let f2 = wl * l_ds2 + wm * m_ds2 + ws * s_ds2;

    sat = sat - f * f1 / (f1 * f1 - 0.5 * f * f2);
  }

  return sat;
}

// The l value is L, not Lr.
function okFindCusp(a, b) {
  let s_cusp = okMaxSaturation(a, b);

  let rgb = oklabToLinRgb(1, s_cusp * a, s_cusp * b);
  let l_cusp = Math.cbrt(1 / Math.max(rgb.r, rgb.g, rgb.b));
  return {l: l_cusp, c: l_cusp * s_cusp};
}

// Finds intersection of the line defined by
// l = l0 * (1 - t) + t * l1
// c = t * c1
// a and b must be normalized so a^2 + b^2 = 1
function okGamutIntersection(a, b, cusp, l1, c1, l0) {
  if((l1 - l0) * cusp.c - (cusp.l - l0) * c1 <= 0) {
    return cusp.c * l0 / (c1 * cusp.l + cusp.c * (l0 - l1));
  } else {
    let t = cusp.c * (l0 - 1) / (c1 * (cusp.l - 1) + cusp.c * (l0 - l1));

    let dl = l1 - l0;
    let dc = c1;

    let k_l = a * 0.3963377774 + b * 0.2158037573;
    let k_m =-a * 0.1055613458 - b * 0.0638541728;
    let k_s =-a * 0.0894841775 - b * 1.2914855480;

    let l_dt = dl + dc * k_l;
    let m_dt = dl + dc * k_m;
    let s_dt = dl + dc * k_s;

    //One step of Halley's method.
    for(let i = 0; i < 1; i++)
    {
      let lum = l0 * (1 - t) + t * l1;
      let chr = t * c1;

      let l_ = lum + chr * k_l;
      let m_ = lum + chr * k_m;
      let s_ = lum + chr * k_s;

      let l = l_ * l_ * l_;
      let m = m_ * m_ * m_;
      let s = s_ * s_ * s_;

      let ldt = 3 * l_dt * l_ * l_;
      let mdt = 3 * m_dt * m_ * m_;
      let sdt = 3 * s_dt * s_ * s_;

      let ldt2 = 6 * l_dt * l_dt * l_;
      let mdt2 = 6 * m_dt * m_dt * m_;
      let sdt2 = 6 * s_dt * s_dt * s_;

      let r  = l    * 4.0767416621 - m    * 3.3077115913 + s    * 0.2309699292 - 1;
      let r1 = ldt  * 4.0767416621 - mdt  * 3.3077115913 + sdt  * 0.2309699292;
      let r2 = ldt2 * 4.0767416621 - mdt2 * 3.3077115913 + sdt2 * 0.2309699292;

      let u_r = r1 / (r1 * r1 - 0.5 * r * r2);
      let t_r = -r * u_r;

      let g  = -l    * 1.2684380046 + m    * 2.6097574011 - s    * 0.3413193965 - 1;
      let g1 = -ldt  * 1.2684380046 + mdt  * 2.6097574011 - sdt  * 0.3413193965;
      let g2 = -ldt2 * 1.2684380046 + mdt2 * 2.6097574011 - sdt2 * 0.3413193965;

      let u_g = g1 / (g1 * g1 - 0.5 * g * g2);
      let t_g = -g * u_g;

      let b  = -l    * 0.0041960863 - m    * 0.7034186147 + s    * 1.7076147010 - 1;
      let b1 = -ldt  * 0.0041960863 - mdt  * 0.7034186147 + sdt  * 1.7076147010;
      let b2 = -ldt2 * 0.0041960863 - mdt2 * 0.7034186147 + sdt2 * 1.7076147010;

      let u_b = b1 / (b1 * b1 - 0.5 * b * b2);
      let t_b = -b * u_b;

      t_r = u_r >= 0 ? t_r : Number.MAX_VALUE;
      t_g = u_g >= 0 ? t_g : Number.MAX_VALUE;
      t_b = u_b >= 0 ? t_b : Number.MAX_VALUE;

      t += Math.min(t_r, t_g, t_b);
    }

    return t;
  }
}

function okMaxChroma(lr, hue, cusp) {
  let l = lrToL(lr);
  let a = Math.cos(hue / 180 * Math.PI);
  let b = Math.sin(hue / 180 * Math.PI);

  return okGamutIntersection(a, b, cusp, l, 1, l);
}
