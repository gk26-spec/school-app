import express from "express";
import cors from "cors";
import helmet from "helmet";
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
import { audit } from "./audit.js";

dotenv.config();
const __dirname = path.dirname(fileURLToPath(import.meta.url));

const app = express();
app.set("trust proxy", 1); // behind Azure's proxy — needed for correct client IPs

// Security headers. CSP is tuned to allow the bundled SPA (self scripts/styles + inline style attrs).
app.use(
  helmet({
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        scriptSrc: ["'self'"],
        styleSrc: ["'self'", "'unsafe-inline'"],
        imgSrc: ["'self'", "data:"],
        connectSrc: ["'self'"],
        objectSrc: ["'none'"],
        baseUri: ["'self'"],
      },
    },
  })
);

// Lock CORS to your own site(s). Same-origin requests (the deployed app) are unaffected.
const allowed = (process.env.ALLOWED_ORIGIN || "").split(",").map((s) => s.trim()).filter(Boolean);
app.use(cors({ origin: allowed.length ? allowed : false, credentials: true }));

app.use(express.json({ limit: "2mb" }));

// Audit trail: log every successful authenticated change (who / what / when).
app.use((req, res, next) => {
  if (!["POST", "PUT", "DELETE", "PATCH"].includes(req.method)) return next();
  res.on("finish", () => {
    if (req.user && res.statusCode < 400) {
      audit(req.user.school_id, req.user.id, `${req.method} ${req.path}`, null);
    }
  });
  next();
});

app.get("/api/health", (req, res) => res.json({ ok: true }));
app.use("/api/auth", authRoutes);
app.use("/api/factions", factionRoutes);
app.use("/api/students", studentRoutes);
app.use("/api/results", resultRoutes);
app.use("/api/participation", participationRoutes);
app.use("/api/settings", settingsRoutes);
app.use("/api/scoreboard", scoreboardRoutes);

const pub = path.join(__dirname, "..", "public");
app.use(express.static(pub));
app.get(/^\/(?!api).*/, (req, res) => {
  res.sendFile(path.join(pub, "index.html"), (err) => {
    if (err) res.status(404).json({ error: "Not found" });
  });
});

app.use((err, req, res, next) => {
  console.error(err.message || err);
  if (err.code === "22P02") return res.status(400).json({ error: "Invalid id format" });
  if (err.code === "23505") return res.status(409).json({ error: "That already exists" });
  res.status(500).json({ error: "Server error" });
});

const port = process.env.PORT || 8080;
app.listen(port, () => console.log(`Carnival API listening on :${port}`));
