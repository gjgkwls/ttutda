export type AlertStatus = "ACTIVE" | "INACTIVE";
export type HttpMethod = "GET" | "POST";
export type LastCheckResult = "MATCH" | "NO_MATCH" | "ERROR";
export type LogLevel = "INFO" | "ERROR";

export interface Alert {
  id: string;
  userId: string;
  name: string;
  url: string;
  method: HttpMethod;
  headers: Record<string, string>;
  keywords: string[];
  intervalSeconds: number;
  isActive: boolean;
  lastCheckedAt: string | null;
  lastTriggeredAt: string | null;
  lastCheckResult: LastCheckResult | null;
  lastContentChanged: boolean | null;
  lastError: string | null;
  errorCount: number;
  previousContentHash: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface AlertLog {
  id: string;
  alertId: string;
  level: LogLevel;
  message: string;
  createdAt: string;
}

export interface CreateAlertInput {
  name: string;
  url: string;
  method: HttpMethod;
  headers?: Record<string, string>;
  keywords: string[];
  intervalSeconds: number;
}
