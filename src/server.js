import express from "express";
import cors from "cors";
import path from "path";
import { fileURLToPath } from "url";
import dotenv from "dotenv";

import authRoutes from "./routes/auth.js";
import factionRoutes from "./routes/factions.js";
import studentRoutes from "./routes/students.js";
import resultRoutes from "./routes/results.js";
import participationRoutes from "./routes/participation.js";
import settingsRoutes from "./routes/settings.js";
import scoreboardRoutes from "./routes/scoreboard.js";

dotenv.config();
const __dirname = path.dirname(fileURLToPath(import.meta.url));

const app = express();
app.use(cors());
app.use(express.json({ limit: "2mb" }));

app.get("/api/health", (req, res) => res.json({ ok: true }));
app.use("/api/auth", authRoutes);
app.use("/api/factions", factionRoutes);
app.use("/api/students", studentRoutes);
app.use("/api/results", resultRoutes);
app.use("/api/participation", participationRoutes);
app.use("/api/settings", settingsRoutes);
app.use("/api/scoreboard", scoreboardRoutes);

// Serve the built frontend from /public if present (single App Service for app + API).
const pub = path.join(__dirname, "..", "public");
app.use(express.static(pub));
app.get(/^\/(?!api).*/, (req, res) => {
  res.sendFile(path.join(pub, "index.html"), (err) => {
    if (err) res.status(404).json({ error: "Not found" });
  });
});

// Central error handler — turns thrown/rejected errors into clean JSON responses
// instead of crashing the server.
app.use((err, req, res, next) => {
  console.error(err.message || err);
  if (err.code === "22P02") return res.status(400).json({ error: "Invalid id format" });
  if (err.code === "23505") return res.status(409).json({ error: "That already exists" });
  res.status(500).json({ error: "Server error" });
});

const port = process.env.PORT || 8080;
app.listen(port, () => console.log(`Carnival API listening on :${port}`));
