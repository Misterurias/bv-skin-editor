import React, { useState, useEffect } from "react";
import { HexColorPicker } from "react-colorful";
import "./ColorPicker.css";

export default function ColorPicker({ color, onChange }) {
  const [hex, setHex] = useState(color);
  const [rgb, setRgb] = useState(hexToRgb(color));
  const [activeTab, setActiveTab] = useState("picker");


  useEffect(() => {
    setHex(color);
    setRgb(hexToRgb(color));
  }, [color]);

  function hexToRgb(hex) {
    const bigint = parseInt(hex.replace("#", ""), 16);
    const r = (bigint >> 16) & 255;
    const g = (bigint >> 8) & 255;
    const b = bigint & 255;
    return { r, g, b };
  }

  function rgbToHex(r, g, b) {
    return (
      "#" +
      [r, g, b]
        .map((x) => {
          const hex = Math.max(0, Math.min(255, x)).toString(16);
          return hex.length === 1 ? "0" + hex : hex;
        })
        .join("")
    );
  }

  function handleRgbChange(component, value) {
    const newRgb = { ...rgb, [component]: parseInt(value) || 0 };
    setRgb(newRgb);
    const newHex = rgbToHex(newRgb.r, newRgb.g, newRgb.b);
    setHex(newHex);
    onChange(newHex);
  }

  function handleHexChange(value) {
    let formatted = value.startsWith("#") ? value : "#" + value;
    if (formatted.length === 7) {
      setHex(formatted);
      onChange(formatted);
    } else {
      setHex(formatted); // still update local field for typing
    }
  }


  return (
    <div className="color-picker-wrapper">
      <div className="tabs">
        <span
          className={`tab ${activeTab === "picker" ? "active" : ""}`}
          onClick={() => setActiveTab("picker")}
        >
          Colour Picker
        </span>
        <span
          className={`tab ${activeTab === "bonk" ? "active" : ""}`}
          onClick={() => setActiveTab("bonk")}
        >
          Bonk 1 Colours
        </span>
      </div>

      {activeTab === "picker" ? (
        <>
          <HexColorPicker
            color={hex}
            onChange={(val) => {
              setHex(val);
              setRgb(hexToRgb(val));
              onChange(val);
            }}
          />

          <div className="color-inputs">
            {/* HEX ROW */}
            <div className="color-row">
              <div>
                <label>Hex</label>
                <input
                  type="text"
                  value={hex.replace("#", "").toUpperCase()}
                  onChange={(e) => handleHexChange(e.target.value)}
                  maxLength={6}
                />
              </div>
              
            {/* RGB ROW */}
              <div>
                <label>R</label>
                <input
                  type="number"
                  value={rgb.r}
                  onChange={(e) => handleRgbChange("r", e.target.value)}
                  min={0}
                  max={255}
                />
              </div>
              <div>
                <label>G</label>
                <input
                  type="number"
                  value={rgb.g}
                  onChange={(e) => handleRgbChange("g", e.target.value)}
                  min={0}
                  max={255}
                />
              </div>
              <div>
                <label>B</label>
                <input
                  type="number"
                  value={rgb.b}
                  onChange={(e) => handleRgbChange("b", e.target.value)}
                  min={0}
                  max={255}
                />
              </div>
            </div>
          </div>
        </>
      ) : (
        <div className="bonk-color-grid">
          {[
            "#000000", "#333333", "#666666", "#999999", "#FFFFFF",
            "#FF0000", "#00FF00", "#0000FF", "#FFFF00", "#00FFFF",
            "#FF00FF", "#FF8800", "#8800FF", "#0088FF", "#00FF88",
          ].map((c) => (
            <div
              key={c}
              className="bonk-color"
              style={{ background: c }}
              onClick={() => {
                setHex(c);
                setRgb(hexToRgb(c));
                onChange(c);
              }}
            />
          ))}
        </div>
      )}
    </div>
  );

}
