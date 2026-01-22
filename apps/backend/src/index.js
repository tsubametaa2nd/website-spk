import "dotenv/config";
import express from "express";
import cors from "cors";
import multer from "multer";
import path from "path";
import { fileURLToPath } from "url";

import vikorRoutes from "./routes/vikor.routes.js";
import { errorHandler } from "./middleware/errorHandler.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 3001;

const allowedOrigins = [
  // "http://localhost:4321",
  "https://website-spk-web.vercel.app",
  process.env.CORS_ORIGIN,
].filter(Boolean);

const corsOptions = {
  origin: function (origin, callback) {
    // Allow requests with no origin (like mobile apps, curl, Postman)
    if (!origin) return callback(null, true);

    // Check if origin is in allowed list
    if (allowedOrigins.indexOf(origin) !== -1) {
      console.log(`✓ CORS allowed: ${origin}`);
      return callback(null, true);
    }

    // Allow all Vercel preview deployments (*.vercel.app)
    if (origin.endsWith(".vercel.app")) {
      console.log(`✓ CORS allowed (Vercel): ${origin}`);
      return callback(null, true);
    }

    // Block all other origins
    console.warn(`⚠️  CORS blocked: ${origin}`);
    callback(new Error("Not allowed by CORS"));
  },
  methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
  allowedHeaders: ["Content-Type", "Authorization"],
  credentials: true,
};

app.use(cors(corsOptions));
app.use(express.json({ limit: "10mb" }));
app.use(express.urlencoded({ extended: true, limit: "10mb" }));
app.use("/api", vikorRoutes);

app.get("/health", (req, res) => {
  res.json({
    status: "ok",
    message: "SPK VIKOR API is running",
    timestamp: new Date().toISOString(),
  });
});

app.get("/", (req, res) => {
  res.json({
    name: "SPK VIKOR API",
    version: "1.0.0",
    description:
      "Sistem Pendukung Keputusan untuk Pemilihan Tempat Magang menggunakan Metode VIKOR",
    endpoints: {
      health: "GET /health",
      processVikor: "POST /api/process-vikor",
      downloadCsv: "GET /api/download-csv",
      parseGoogleSheets: "POST /api/parse-google-sheets",
      uploadFile: "POST /api/upload-file",
    },
  });
});

app.use(errorHandler);

export default app;

if (process.env.NODE_ENV !== "production" || !process.env.VERCEL) {
  app.listen(PORT, () => {
    console.log(`
Yoo! SPK VIKOR API is running on port ${PORT}
    `);
  });
}
