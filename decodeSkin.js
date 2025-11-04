// decodeSkin.js
// Converts a Bonk.io / Bonkleagues skin code into readable JSON.
import fs from "fs";

function readInt32BE(buffer, offset) {
  return (
    (buffer[offset] << 24) |
    (buffer[offset + 1] << 16) |
    (buffer[offset + 2] << 8) |
    buffer[offset + 3]
  ) >>> 0;
}

function readInt16BE(buffer, offset) {
  const val = (buffer[offset] << 8) | buffer[offset + 1];
  return val & 0x8000 ? val - 0x10000 : val;
}

function readFloatBE(buffer, offset) {
  const view = new DataView(buffer.buffer, offset, 4);
  return view.getFloat32(0, false);
}

export function decodeSkinCode(skinCode) {
  // Step 1: URL decode
  const decodedUrl = decodeURIComponent(skinCode);

  // Step 2: Base64 decode
  const binary = atob(decodedUrl);
  const buffer = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) buffer[i] = binary.charCodeAt(i);

  let index = 0;
  const readByte = () => buffer[index++];
  const readShort = () => {
    const v = readInt16BE(buffer, index);
    index += 2;
    return v;
  };
  const readInt = () => {
    const v = readInt32BE(buffer, index);
    index += 4;
    return v;
  };
  const readFloat = () => {
    const v = readFloatBE(buffer, index);
    index += 4;
    return v;
  };
  const readBoolean = () => readByte() !== 0;

  // Skip header bytes
  readByte(); // 0x0A
  readByte(); // 0x07
  readByte(); // 0x03
  readByte(); // 0x61
  readShort(); // 0x02
  readByte(); // 0x09
  const numLayersX2Plus1 = readByte();
  readByte(); // 0x01

  const numLayers = (numLayersX2Plus1 - 1) / 2;
  const layers = [];

  for (let i = 0; i < numLayers; i++) {
    readByte(); // 0x0A
    if (i === 0) {
      readByte(); // 0x07
      readByte(); // 0x05
      readByte(); // 0x61
      readByte(); // 0x6C
    } else {
      readByte(); // 0x05
    }

    readShort(); // 1
    const shapeId = readShort();
    const scale = readFloat();
    const angle = readFloat();
    const x = readFloat();
    const y = readFloat();
    const flipX = readBoolean();
    const flipY = readBoolean();
    const color = readInt();

    layers.push({ id: shapeId, scale, angle, x, y, flipX, flipY, color });
  }

  const bc = readInt();

  return { layers, bc };
}

// Example usage (run in browser console or Node with `--experimental-fetch`):
// import { decodeSkinCode } from "./decodeSkin.js";
// const skin = "CgcDYQACCR8BCgcFYWwAAQBLPedzmEKxnO1AiXzGQNse2wAAAAAAAAoFAAEATTyrODFCrUqiQMtd5L%2B3UQcAAAD%2Fc2YKBQABAE085ObGQq22j0DLXeS%2FyICgAAAAFwIACgUAAQANPMolVr%2BAKthA7E5zwCvb9wAAAAAAAAoFAAEADTzKJVa%2FgCrYQJk9vMAjRCsAAAAAAAAKBQABACY%2BqulIPI8FykB8D2pBEsvjAAAAAAAACgUAAQAiPeUXs0Lqn3xBJWoev%2FwPagAAAAAAAAoFAAEAIj3cpwtDWP%2ByQAxaCr23UQcAAAAAAAAKBQABABs9CuflQ2Yyo0BfasFA32rBAAAA%2F%2FzNCgUAAQAbPQ3urENnqX1AGqxeQPZU4gAAAAAAAAoFAAEAIj6rkcdCp8OyQG29Fj%2Br2%2FcAAAD%2F%2FM0KBQABABs9kdH9Q3D3Zj98D2pBC6K5AAAA9eoOCgUAAQBPPgwXTkMNLAxAJiFvP483TgAAAP%2F8zQoFAAEATz4cY1FDDURNQAl8xj%2BgZuYAAAAAAAAKBQABACI%2BuRbmQqxGekA0c8M%2Ft1EHAAAAAAAAAPXqDg%3D%3D";
const skin = "CgcDYQACCQcBCgcFYWwAAQAcPgLOiUCUF87AuuHfwJaEdQAAAAAAAAoFAAEAGz2482fATJvlwQFhS7%2FexAUAAAC5HR0KBQABAAE9wzSDwAlc%2F8D0YnFAdtk4AAAAvS4uAP%2F%2F%2Fw%3D%3D";

// Write the decoded skin to a json file
fs.writeFileSync("decodeddBLSkin.json", JSON.stringify(decodeSkinCode(skin), null, 2));

