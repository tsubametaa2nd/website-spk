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

const corsOptions = {
  origin: process.env.CORS_ORIGIN || "http://localhost:4321",
  methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
  allowedHeaders: ["Content-Type", "Authorization"],
  credentials: true,
};

app.use(cors(corsOptions));
app.use(express.json({ limit: "10mb" }));
app.use(express.urlencoded({ extended: true, limit: "10mb" }));

const uploadDir = path.join(__dirname, "../uploads");
import fs from "fs";
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

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

// Export app for Vercel serverless
export default app;

// Start server only if not in Vercel (serverless) environment
if (process.env.NODE_ENV !== "production" || !process.env.VERCEL) {
  app.listen(PORT, () => {
    console.log(`
Yoo! SPK VIKOR API is running on port ${PORT}
    `);
  });
}
