// server.js
import express from "express";
import path from "path";
import { fileURLToPath } from "url";
import fetch from "node-fetch"; // install with: npm install node-fetch
import { encodeSkin } from "./encodeSkin.js"; // import your encoder

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const BONK_AVATAR_UPDATE_URL = "https://bonk2.io/scripts/avatar_update.php";
const BONK_LOGIN_URL = "https://bonk2.io/scripts/login_legacy.php";

const app = express();

// Serve static files from dist
app.use(express.static(path.join(__dirname, "dist")));

app.use(express.json({ limit: "1mb" }));

app.post("/api/wear", async (req, res) => {
  try {
    const { username, password, skin } = req.body;
    if (!username || !password || !skin) {
      return res.status(400).json({ ok: false, error: "missing_params" });
    }

    // 1️⃣ Login to Bonk.io
    const loginRes = await fetch(BONK_LOGIN_URL, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        task: "legacy",
        username,
        password,
      }),
    });

    const loginData = await loginRes.json();
    if (loginData.r !== "success" || !loginData.token) {
      return res.status(401).json({ ok: false, error: loginData.error || "login_failed" });
    }

    const token = loginData.token;
    const activeSlot =
      loginData.activeAvatarNumber ||
      loginData.activeavatarnumber ||
      3; // fallback if missing

    // 2️⃣ Encode JSON into skinCode
    const skinCode = encodeSkin(skin);

    // 3️⃣ Apply skin to user’s active slot
    const updateRes = await fetch(BONK_AVATAR_UPDATE_URL, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        task: "updateavatar",
        token,
        newavatarslot: String(activeSlot),
        newavatar: skinCode,
      }),
    });

    const updateData = await updateRes.json();
    if (updateData.r !== "success") {
      return res.status(400).json({ ok: false, error: updateData.error || "update_failed" });
    }

    // ✅ Done
    res.json({ ok: true, skinCode, activeSlot });
  } catch (err) {
    console.error("Error in /api/wear:", err);
    res.status(500).json({ ok: false, error: "server_error" });
  }
});

// Example API route
app.get("/api/health", (req, res) => {
  res.json({ status: "ok", time: new Date().toISOString() });
});

// ✅ Fallback for SPA routes (Express 5-safe)
app.use((req, res) => {
  res.sendFile(path.join(__dirname, "dist", "index.html"));
});

// Railway will inject PORT automatically
const port = process.env.PORT || 3000;
app.listen(port, () => {
  console.log(`✅ Server running on port ${port}`);
});
