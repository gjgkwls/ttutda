import fs from "node:fs";
import path from "node:path";
import dotenv from "dotenv";
import express from "express";
import { z } from "zod";
import { addAlertLog, createAlert, deleteAlert, listAlertLogs, listAlerts, listAllAlerts, updateAlert } from "./store";
import { enqueueAlertCheck, getQueueHealth, isSlackConfigured, startWorker } from "./queue";

const envCandidates = [
  path.resolve(process.cwd(), ".env"),
  path.resolve(process.cwd(), "apps/server/.env"),
  path.resolve(__dirname, "../.env")
];
const envPath = envCandidates.find((candidate) => fs.existsSync(candidate));
if (envPath) {
  dotenv.config({ path: envPath });
}

const app = express();
app.use(express.json());
app.use((_, res, next) => {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET,POST,PATCH,DELETE,OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  next();
});
app.options("*", (_, res) => res.status(200).send());

const keywordSchema = z
  .union([z.string().min(1), z.array(z.string().min(1)).min(1)])
  .transform((value) =>
    (Array.isArray(value) ? value : value.split(","))
      .map((item) => item.trim())
      .filter((item) => item.length > 0)
  );

const createAlertSchema = z.object({
  name: z.string().min(1),
  url: z.string().url(),
  method: z.enum(["GET", "POST"]).default("GET"),
  headers: z.record(z.string()).optional(),
  keywords: keywordSchema,
  intervalSeconds: z.number().int().min(1).max(3600)
});

const patchAlertSchema = z.object({
  name: z.string().min(1).optional(),
  url: z.string().url().optional(),
  method: z.enum(["GET", "POST"]).optional(),
  headers: z.record(z.string()).optional(),
  keywords: keywordSchema.optional(),
  intervalSeconds: z.number().int().min(1).max(3600).optional(),
  isActive: z.boolean().optional()
});

app.get("/health", (_, res) => {
  res.json({ ok: true });
});

app.get("/runtime-status", async (_, res) => {
  const queueHealth = await getQueueHealth();
  const allAlerts = listAllAlerts();
  const activeAlerts = allAlerts.filter((item) => item.isActive).length;

  res.json({
    ok: queueHealth.ok,
    queue: queueHealth,
    slack: {
      configured: isSlackConfigured()
    },
    alerts: {
      total: allAlerts.length,
      active: activeAlerts
    }
  });
});

app.get("/alerts", (req, res) => {
  const page = Number(req.query.page ?? 1);
  const pageSize = Number(req.query.pageSize ?? 10);
  const result = listAlerts(page, pageSize);
  res.json({
    data: result.items,
    meta: {
      total: result.total,
      page: result.page,
      pageSize: result.pageSize,
      totalPages: result.totalPages
    }
  });
});

app.get("/alerts/:id/logs", (req, res) => {
  const limit = Number(req.query.limit ?? 20);
  res.json({ data: listAlertLogs(req.params.id, limit) });
});

app.post("/alerts", async (req, res) => {
  const parsed = createAlertSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ message: "Invalid payload", errors: parsed.error.flatten() });
  }

  const alert = createAlert("demo-user", parsed.data);
  addAlertLog(alert.id, "INFO", "백엔드 워커 등록 요청");
  await enqueueAlertCheck(alert.id);
  return res.status(201).json({ data: alert });
});

app.patch("/alerts/:id", async (req, res) => {
  const parsed = patchAlertSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ message: "Invalid payload", errors: parsed.error.flatten() });
  }

  const alert = updateAlert(req.params.id, parsed.data);
  if (!alert) return res.status(404).json({ message: "Alert not found" });

  if (parsed.data.isActive === true) {
    await enqueueAlertCheck(alert.id);
  }

  return res.json({ data: alert });
});

app.post("/alerts/:id/toggle", async (req, res) => {
  const current = listAllAlerts().find((item) => item.id === req.params.id);
  if (!current) return res.status(404).json({ message: "Alert not found" });

  const alert = updateAlert(current.id, { isActive: !current.isActive });
  if (!alert) return res.status(404).json({ message: "Alert not found" });

  if (alert.isActive) {
    await enqueueAlertCheck(alert.id);
  }

  return res.json({ data: alert });
});

app.post("/alerts/:id/check-now", async (req, res) => {
  const current = listAllAlerts().find((item) => item.id === req.params.id);
  if (!current) return res.status(404).json({ message: "Alert not found" });

  await enqueueAlertCheck(current.id);
  addAlertLog(current.id, "INFO", "수동 즉시 체크 요청");
  return res.json({ ok: true });
});

app.delete("/alerts/:id", (req, res) => {
  const deleted = deleteAlert(req.params.id);
  if (!deleted) return res.status(404).json({ message: "Alert not found" });
  return res.status(204).send();
});

const worker = startWorker();
worker.on("failed", (job, err) => {
  console.error(`Job failed (${job?.id})`, err);
});

setInterval(async () => {
  const alerts = listAllAlerts().filter((alert) => alert.isActive);
  const now = Date.now();

  await Promise.all(
    alerts.map(async (alert) => {
      const lastChecked = alert.lastCheckedAt ? new Date(alert.lastCheckedAt).getTime() : 0;
      if (now - lastChecked >= alert.intervalSeconds * 1000) {
        await enqueueAlertCheck(alert.id);
      }
    })
  );
}, 1000);

const port = Number(process.env.PORT ?? 4000);
app.listen(port, () => {
  console.log(`TTUTDA server running on http://localhost:${port}`);
});
