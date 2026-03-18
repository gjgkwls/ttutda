import { randomUUID } from "node:crypto";
import { Alert, AlertLog, CreateAlertInput, LogLevel } from "./types";

const alerts = new Map<string, Alert>();
const logs: AlertLog[] = [];

const LOG_LIMIT = 500;

function sortAlerts(items: Alert[]): Alert[] {
  return items.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

export function listAlerts(page = 1, pageSize = 10): {
  items: Alert[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
} {
  const sorted = sortAlerts(Array.from(alerts.values()));
  const normalizedPage = Math.max(1, page);
  const normalizedPageSize = Math.max(1, Math.min(100, pageSize));
  const total = sorted.length;
  const totalPages = Math.max(1, Math.ceil(total / normalizedPageSize));
  const offset = (normalizedPage - 1) * normalizedPageSize;

  return {
    items: sorted.slice(offset, offset + normalizedPageSize),
    total,
    page: normalizedPage,
    pageSize: normalizedPageSize,
    totalPages
  };
}

export function listAllAlerts(): Alert[] {
  return sortAlerts(Array.from(alerts.values()));
}

export function getAlert(id: string): Alert | undefined {
  return alerts.get(id);
}

export function createAlert(userId: string, input: CreateAlertInput): Alert {
  const now = new Date().toISOString();
  const alert: Alert = {
    id: randomUUID(),
    userId,
    name: input.name,
    url: input.url,
    method: input.method,
    headers: input.headers ?? {},
    keywords: input.keywords,
    intervalSeconds: input.intervalSeconds,
    isActive: true,
    lastCheckedAt: null,
    lastTriggeredAt: null,
    lastCheckResult: null,
    lastContentChanged: null,
    lastError: null,
    errorCount: 0,
    previousContentHash: null,
    createdAt: now,
    updatedAt: now
  };
  alerts.set(alert.id, alert);
  addAlertLog(alert.id, "INFO", `알림 생성됨: ${alert.name}`);
  return alert;
}

export function updateAlert(
  id: string,
  patch: Partial<Pick<Alert, "name" | "url" | "method" | "headers" | "keywords" | "intervalSeconds" | "isActive">>
): Alert | null {
  const current = alerts.get(id);
  if (!current) return null;

  const updated: Alert = { ...current, ...patch, updatedAt: new Date().toISOString() };
  alerts.set(id, updated);
  addAlertLog(id, "INFO", "알림 설정 업데이트됨");
  return updated;
}

export function deleteAlert(id: string): boolean {
  const deleted = alerts.delete(id);
  if (deleted) addAlertLog(id, "INFO", "알림 삭제됨");
  return deleted;
}

export function markChecked(id: string, result: { matched: boolean; contentHash: string }): void {
  const current = alerts.get(id);
  if (!current) return;

  const hasChanged = current.previousContentHash ? current.previousContentHash !== result.contentHash : null;
  current.lastCheckedAt = new Date().toISOString();
  current.lastCheckResult = result.matched ? "MATCH" : "NO_MATCH";
  current.lastContentChanged = hasChanged;
  current.previousContentHash = result.contentHash;
  current.lastError = null;
  alerts.set(id, current);
}

export function markTriggered(id: string): void {
  const current = alerts.get(id);
  if (!current) return;
  current.lastTriggeredAt = new Date().toISOString();
  alerts.set(id, current);
}

export function deactivateAlertAfterNotification(id: string): void {
  const current = alerts.get(id);
  if (!current || !current.isActive) return;
  current.isActive = false;
  current.updatedAt = new Date().toISOString();
  alerts.set(id, current);
  addAlertLog(id, "INFO", "Slack 전송 성공 후 자동 비활성화(OFF) 처리");
}

export function markErrored(id: string, message: string): void {
  const current = alerts.get(id);
  if (!current) return;

  current.lastCheckedAt = new Date().toISOString();
  current.lastCheckResult = "ERROR";
  current.lastContentChanged = null;
  current.lastError = message;
  current.errorCount += 1;
  alerts.set(id, current);
}

export function addAlertLog(alertId: string, level: LogLevel, message: string): void {
  logs.unshift({
    id: randomUUID(),
    alertId,
    level,
    message,
    createdAt: new Date().toISOString()
  });

  if (logs.length > LOG_LIMIT) {
    logs.length = LOG_LIMIT;
  }
}

export function listAlertLogs(alertId: string, limit = 20): AlertLog[] {
  return logs.filter((log) => log.alertId === alertId).slice(0, Math.max(1, Math.min(100, limit)));
}
