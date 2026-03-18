import { Queue, Worker } from "bullmq";
import axios from "axios";
import * as cheerio from "cheerio";
import { createHash } from "node:crypto";
import { addAlertLog, deactivateAlertAfterNotification, getAlert, markChecked, markErrored, markTriggered } from "./store";

const connection = { url: process.env.REDIS_URL ?? "redis://localhost:6379" };

export const checkQueue = new Queue<{ alertId: string }, void, "check">("alert-check", { connection });

export async function enqueueAlertCheck(alertId: string): Promise<void> {
  await checkQueue.add("check", { alertId }, { removeOnComplete: 1000, removeOnFail: 1000, attempts: 3, backoff: { type: "fixed", delay: 1000 } });
}

export function startWorker(): Worker<{ alertId: string }, void, "check"> {
  return new Worker(
    "alert-check",
    async (job) => {
      const alert = getAlert(job.data.alertId);
      if (!alert || !alert.isActive) return;

      try {
        const response = await axios.request({
          method: alert.method,
          url: alert.url,
          headers: alert.headers,
          timeout: 10000
        });
        const contentType = String(response.headers["content-type"] ?? "");
        let haystack = "";

        if (contentType.includes("application/json")) {
          haystack = JSON.stringify(response.data);
        } else {
          const html = typeof response.data === "string" ? response.data : String(response.data);
          const $ = cheerio.load(html);
          haystack = $.text();
        }

        const contentHash = createHash("sha256").update(haystack).digest("hex");
        const matchedKeywords = alert.keywords.filter((keyword) => haystack.includes(keyword));

        markChecked(alert.id, { matched: matchedKeywords.length > 0, contentHash });
        addAlertLog(alert.id, "INFO", `체크 완료 (${matchedKeywords.length > 0 ? "키워드 감지" : "미감지"})`);

        if (matchedKeywords.length > 0) {
          markTriggered(alert.id);
          const slackNotified = await notifySlack(alert.name, alert.url, matchedKeywords);
          if (slackNotified) {
            deactivateAlertAfterNotification(alert.id);
          } else {
            addAlertLog(alert.id, "ERROR", "Slack Webhook 미설정 또는 전송 실패 - 로그 fallback 처리");
          }
        }
      } catch (error) {
        const message = error instanceof Error ? error.message : "Unknown error";
        markErrored(alert.id, message);
        addAlertLog(alert.id, "ERROR", `체크 실패: ${message}`);
        throw error;
      }
    },
    { connection, concurrency: 5 }
  );
}

export function isSlackConfigured(): boolean {
  const webhook = process.env.SLACK_WEBHOOK_URL?.trim() ?? "";
  if (!webhook) return false;
  if (webhook.includes("REPLACE/THIS/WITH_REAL_WEBHOOK")) return false;
  return webhook.startsWith("https://hooks.slack.com/services/");
}

export async function getQueueHealth(): Promise<{ ok: boolean; detail?: string }> {
  try {
    const client = await checkQueue.client;
    const pong = await client.ping();
    return { ok: pong === "PONG", detail: pong };
  } catch (error) {
    const detail = error instanceof Error ? error.message : "unknown";
    return { ok: false, detail };
  }
}

async function notifySlack(name: string, url: string, matchedKeywords: string[]): Promise<boolean> {
  if (!isSlackConfigured()) return false;
  const webhook = process.env.SLACK_WEBHOOK_URL?.trim();
  if (!webhook) return false;

  try {
    const response = await axios.post(
      webhook,
      {
        text: `*[TTUTDA] ${name}*\n- 감지 키워드: ${matchedKeywords.join(", ")}\n- 링크: ${url}\n- 감지 시각: ${new Date().toISOString()}`
      },
      {
        validateStatus: () => true
      }
    );

    return response.status === 200 && String(response.data ?? "").trim().toLowerCase() === "ok";
  } catch {
    return false;
  }
}
