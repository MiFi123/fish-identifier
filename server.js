const express = require("express");
const crypto = require("crypto");
const path = require("path");
const multer = require("multer");
const config = require("./backend/config");
const { AppError } = require("./backend/errors");
const { createRateLimiter } = require("./backend/rate-limit");
const { createAnalysisProvider, createSecondOpinionProvider } = require("./backend/providers");
const { createPrimaryAnalysisService, runSecondOpinion } = require("./backend/analysis-service");
const { createSecondOpinionDiagnostics } = require("./backend/second-opinion-diagnostics");
const { BENCHMARK_MODELS, runGeminiBenchmark } = require("./backend/gemini-benchmark");
const { AnalysisStore } = require("./backend/analysis-store");
const { getSpeciesCatalog, findSpecies } = require("./backend/species-catalog");

const app = express();
app.disable("x-powered-by");
if (config.trustProxy !== false) app.set("trust proxy", config.trustProxy);
app.use((req, res, next) => {
  res.set({
    "X-Content-Type-Options": "nosniff",
    "Referrer-Policy": "strict-origin-when-cross-origin",
    "X-Frame-Options": "DENY",
    "Content-Security-Policy": "default-src 'self'; script-src 'self'; style-src 'self'; img-src 'self' blob: data:; connect-src 'self'; object-src 'none'; base-uri 'self'; frame-ancestors 'none'",
    "Permissions-Policy": "camera=(self), geolocation=(self), microphone=()",
  });
  next();
});
const allowedImageTypes = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/gif",
  "image/heic",
  "image/heif",
]);

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: config.maxUploadSizeBytes, files: 1 },
  fileFilter: (req, file, callback) => {
    if (!allowedImageTypes.has(file.mimetype)) {
      return callback(new AppError("Nicht unterstützter Bildtyp.", { status: 415, code: "UNSUPPORTED_IMAGE_TYPE" }));
    }
    return callback(null, true);
  },
});

const secondOpinionDiagnostics = createSecondOpinionDiagnostics();
const primaryAnalysisService = createPrimaryAnalysisService(createAnalysisProvider(config));
const secondOpinionProvider = createSecondOpinionProvider(config, { diagnostics: secondOpinionDiagnostics });
const analysisStore = new AnalysisStore();
app.locals.maxUploadSizeBytes = config.maxUploadSizeBytes;

app.use(express.static(path.join(__dirname, "public")));
app.get("/api/health", (req, res) => res.json({ status: "ok", version: "0.6.2" }));
app.get("/api/public-config", (req, res) => res.json({ feedbackEmail: config.publicFeedbackEmail }));
if (config.appEnv === "beta") app.get("/api/beta/network-check", (req, res) => res.json({ status: "ok", proxyTrusted: config.trustProxy !== false, clientIpHash: crypto.createHash("sha256").update(req.ip).digest("hex").slice(0, 16), forwardedForPresent: Boolean(req.get("x-forwarded-for")) }));

app.get("/api/species", (req, res) => res.json({ species: getSpeciesCatalog() }));
app.get("/api/species/:scientificName", (req, res) => {
  const species = findSpecies(req.params.scientificName);
  if (!species) return res.status(404).json({ error: { code: "SPECIES_NOT_FOUND", message: "Fischart nicht gefunden." } });
  return res.json({ species });
});

if (!config.isProductionLike) {
  app.get("/api/dev/stats", (req, res) => res.json({ ...secondOpinionDiagnostics.snapshot(), activeAnalyses: analysisStore.size() }));
  app.post("/api/dev/gemini-benchmark", upload.single("image"), async (req, res, next) => {
    try {
      if (!req.file) throw new AppError("Bitte wähle ein Bild für den Benchmark aus.", { status: 400, code: "IMAGE_REQUIRED" });
      if (!config.gemini.apiKey) throw new AppError("Gemini ist nicht konfiguriert.", { status: 503, code: "GEMINI_NOT_CONFIGURED" });
      const results = await runGeminiBenchmark({
        apiKey: config.gemini.apiKey,
        models: BENCHMARK_MODELS,
        image: { buffer: req.file.buffer, mimeType: req.file.mimetype },
        repetitions: req.body?.repetitions,
      });
      return res.json({ models: BENCHMARK_MODELS, results });
    } catch (error) { return next(error); }
  });
}

app.post(
  "/api/analyze",
  createRateLimiter(config.rateLimit),
  upload.single("image"),
  async (req, res, next) => {
    try {
      if (!req.file) {
        throw new AppError("Bitte wähle ein Bild für die Analyse aus.", {
          status: 400,
          code: "IMAGE_REQUIRED",
        });
      }

      const result = await primaryAnalysisService.analyzeImage({
        buffer: req.file.buffer,
        mimeType: req.file.mimetype,
      });
      if (result.secondOpinionRecommended && secondOpinionProvider) {
        const entry = analysisStore.create({ buffer: req.file.buffer, mimeType: req.file.mimetype, result });
        result.analysisId = entry.id;
        result.secondOpinionStatus = "pending";
      }
      return res.status(200).json(result);
    } catch (error) {
      return next(error);
    }
  },
);

app.post("/api/analyze/:analysisId/second-opinion", createRateLimiter(config.secondOpinionRateLimit), async (req, res, next) => {
  try {
    if (!secondOpinionProvider) throw new AppError("Die zweite KI-Analyse ist nicht konfiguriert.", { status: 503, code: "SECOND_OPINION_NOT_CONFIGURED" });
    const result = await analysisStore.startSecondOpinion(req.params.analysisId, (entry) => runSecondOpinion(
      entry.result,
      { buffer: entry.buffer, mimeType: entry.mimeType },
      secondOpinionProvider,
    ));
    if (!result) throw new AppError("Diese Analyse ist nicht mehr verfügbar.", { status: 404, code: "ANALYSIS_NOT_FOUND" });
    return res.status(200).json(result);
  } catch (error) { return next(error); }
});

app.use((error, req, res, next) => {
  if (error instanceof multer.MulterError && error.code === "LIMIT_FILE_SIZE") {
    return res.status(413).json({
      success: false,
      error: { code: "IMAGE_TOO_LARGE", message: "Das Bild ist zu groß. Bitte wähle ein Bild mit höchstens 10 MB aus." },
    });
  }

  if (error instanceof AppError) {
    return res.status(error.status).json({
      success: false,
      error: { code: error.code, message: error.message },
    });
  }

  console.error("Unerwarteter Fehler bei der Bildanalyse.");
  return res.status(500).json({
    success: false,
    error: { code: "INTERNAL_ERROR", message: "Die Analyse konnte nicht verarbeitet werden." },
  });
});

function startServer() {
  config.validateStartup();
  const server = app.listen(config.port, config.host, () => {
    console.log("Fish Identifier 0.6.2");
    console.log(`Environment: ${config.appEnv}`);
    console.log(`Port: ${config.port}`);
    console.log(`Second Opinion: ${config.secondOpinion.enabled ? "enabled" : "disabled"}`);
    console.log(`Dev routes: ${config.isProductionLike ? "disabled" : "enabled"}`);
  });
  const shutdown = (signal) => {
    console.log(`${signal}: Server wird beendet.`);
    server.close(() => process.exit(0));
    setTimeout(() => process.exit(1), 10_000).unref();
  };
  process.once("SIGTERM", () => shutdown("SIGTERM"));
  process.once("SIGINT", () => shutdown("SIGINT"));
  return server;
}
if (require.main === module) startServer();
module.exports = { app, startServer };
