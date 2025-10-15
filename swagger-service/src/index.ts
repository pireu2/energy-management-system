import express from "express";
import swaggerUi from "swagger-ui-express";
import fs from "fs";
import path from "path";
import process from "process";

const app = express();
const port = Number(process.env.PORT) || 3004;

const specPath = path.join(__dirname, "..", "src", "swagger.json");

let swaggerSpec: any = {};
try {
  const raw = fs.readFileSync(specPath, "utf8");
  swaggerSpec = JSON.parse(raw);
  console.log("Loaded swagger spec from", specPath);
} catch (err: any) {
  console.error(
    "Failed to load swagger.json at",
    specPath,
    "Using minimal fallback spec. Error:",
    err.message || err
  );
  swaggerSpec = {
    openapi: "3.0.0",
    info: { title: "Swagger Service", version: "0.0.0" },
  };
}

app.use("/docs", swaggerUi.serve, swaggerUi.setup(swaggerSpec));

app.get("/health", (_req, res) => res.json({ status: "ok" }));

app.listen(port, () =>
  console.log(`Swagger UI available at http://0.0.0.0:${port}/docs`)
);
