"use client";

import { FormEvent, useCallback, useEffect, useMemo, useState } from "react";

type IntervalUnit = "seconds" | "minutes";
type HttpMethod = "GET" | "POST";
type LastCheckResult = "MATCH" | "NO_MATCH" | "ERROR";

type AlertItem = {
  id: string;
  name: string;
  endpoint: string;
  method: HttpMethod;
  keywords: string[];
  interval: number;
  isActive: boolean;
  workerRegistered: boolean;
  lastCheckedAt: string | null;
  lastTriggeredAt: string | null;
  lastCheckResult: LastCheckResult | null;
  lastContentChanged: boolean | null;
  lastError: string | null;
};

type AlertsMeta = {
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
};

type AlertApiItem = {
  id: string;
  name: string;
  url: string;
  method: HttpMethod;
  keywords?: string[];
  intervalSeconds: number;
  isActive: boolean;
  lastCheckedAt?: string | null;
  lastTriggeredAt?: string | null;
  lastCheckResult?: LastCheckResult | null;
  lastContentChanged?: boolean | null;
  lastError?: string | null;
};

function toAlertItem(item: AlertApiItem): AlertItem {
  return {
    id: item.id,
    name: item.name,
    endpoint: item.url,
    method: item.method,
    keywords: item.keywords ?? [],
    interval: item.intervalSeconds,
    isActive: item.isActive,
    workerRegistered: true,
    lastCheckedAt: item.lastCheckedAt ?? null,
    lastTriggeredAt: item.lastTriggeredAt ?? null,
    lastCheckResult: item.lastCheckResult ?? null,
    lastContentChanged: item.lastContentChanged ?? null,
    lastError: item.lastError ?? null
  };
}

const API_BASE = process.env.NEXT_PUBLIC_SERVER_URL ?? "http://localhost:4000";
const PAGE_SIZE = 5;

const resultLabel: Record<LastCheckResult, string> = {
  MATCH: "키워드 감지",
  NO_MATCH: "미감지",
  ERROR: "오류"
};

const initialMeta: AlertsMeta = { total: 0, page: 1, pageSize: PAGE_SIZE, totalPages: 1 };

export default function Home() {
  const [editingId, setEditingId] = useState<string | null>(null);
  const [alertName, setAlertName] = useState("");
  const [endpoint, setEndpoint] = useState("");
  const [method, setMethod] = useState<HttpMethod>("GET");
  const [keywordText, setKeywordText] = useState("");
  const [interval, setInterval] = useState("5");
  const [unit, setUnit] = useState<IntervalUnit>("seconds");
  const [alerts, setAlerts] = useState<AlertItem[]>([]);
  const [meta, setMeta] = useState<AlertsMeta>(initialMeta);
  const [page, setPage] = useState(1);
  const [isLoading, setIsLoading] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [togglingIds, setTogglingIds] = useState<Set<string>>(new Set());
  const [error, setError] = useState("");

  const activeCount = useMemo(() => alerts.filter((alert) => alert.isActive).length, [alerts]);

  const resetForm = () => {
    setEditingId(null);
    setAlertName("");
    setEndpoint("");
    setMethod("GET");
    setKeywordText("");
    setInterval("5");
    setUnit("seconds");
  };

  const loadAlerts = useCallback(
    async (targetPage = page) => {
      setIsLoading(true);
      try {
        const response = await fetch(`${API_BASE}/alerts?page=${targetPage}&pageSize=${PAGE_SIZE}`, {
          cache: "no-store"
        });
        if (!response.ok) throw new Error("알림 목록을 불러오지 못했습니다.");

        const json = (await response.json()) as { data?: AlertApiItem[]; meta?: AlertsMeta };
        const data = Array.isArray(json.data) ? json.data : [];
        const nextMeta: AlertsMeta = json.meta ?? initialMeta;

        setAlerts(data.map((item) => toAlertItem(item)));
        setMeta(nextMeta);
        setError("");
      } catch (e) {
        setError(e instanceof Error ? e.message : "알림 목록 로드 중 오류가 발생했습니다.");
      } finally {
        setIsLoading(false);
      }
    },
    [page]
  );

  useEffect(() => {
    void loadAlerts(page);
  }, [loadAlerts, page]);

  const onSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const parsedInterval = Number(interval);
    const intervalSeconds = unit === "seconds" ? parsedInterval : parsedInterval * 60;
    const keywords = keywordText
      .split(",")
      .map((item) => item.trim())
      .filter(Boolean);

    if (!alertName.trim() || !endpoint.trim() || keywords.length === 0) {
      setError("알림 이름, URL/API endpoint, 감지 키워드를 모두 입력해주세요.");
      return;
    }

    if (!Number.isFinite(parsedInterval) || parsedInterval <= 0) {
      setError("주기는 0보다 큰 숫자로 입력해주세요.");
      return;
    }

    const payload = {
      name: alertName.trim(),
      url: endpoint.trim(),
      method,
      keywords,
      intervalSeconds
    };

    setIsSubmitting(true);
    try {
      if (editingId) {
        const response = await fetch(`${API_BASE}/alerts/${editingId}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload)
        });
        if (!response.ok) throw new Error("알림 수정에 실패했습니다.");
      } else {
        const response = await fetch(`${API_BASE}/alerts`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload)
        });
        if (!response.ok) throw new Error("알림 생성에 실패했습니다.");
      }

      resetForm();
      await loadAlerts(editingId ? page : 1);
      if (!editingId) setPage(1);
      setError("");
    } catch (e) {
      setError(e instanceof Error ? e.message : "알림 저장 중 오류가 발생했습니다.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const onToggle = async (id: string) => {
    const target = alerts.find((item) => item.id === id);
    if (!target) return;

    const nextActive = !target.isActive;
    setAlerts((prev) => prev.map((alert) => (alert.id === id ? { ...alert, isActive: nextActive } : alert)));
    setTogglingIds((prev) => {
      const next = new Set(prev);
      next.add(id);
      return next;
    });

    try {
      const response = await fetch(`${API_BASE}/alerts/${id}/toggle`, {
        method: "POST",
        cache: "no-store"
      });
      if (!response.ok) throw new Error("상태 토글에 실패했습니다.");
      const json = (await response.json()) as { data?: AlertApiItem };
      if (json.data) {
        const synced = toAlertItem(json.data);
        setAlerts((prev) => prev.map((alert) => (alert.id === id ? synced : alert)));
      }
    } catch (e) {
      setAlerts((prev) => prev.map((alert) => (alert.id === id ? { ...alert, isActive: target.isActive } : alert)));
      setError(e instanceof Error ? e.message : "토글 중 오류가 발생했습니다.");
    } finally {
      setTogglingIds((prev) => {
        const next = new Set(prev);
        next.delete(id);
        return next;
      });
    }
  };

  const onDelete = async (id: string) => {
    try {
      const response = await fetch(`${API_BASE}/alerts/${id}`, { method: "DELETE" });
      if (!response.ok) throw new Error("알림 삭제에 실패했습니다.");
      await loadAlerts(page);
    } catch (e) {
      setError(e instanceof Error ? e.message : "삭제 중 오류가 발생했습니다.");
    }
  };

  const onEdit = (alert: AlertItem) => {
    setEditingId(alert.id);
    setAlertName(alert.name);
    setEndpoint(alert.endpoint);
    setMethod(alert.method);
    setKeywordText(alert.keywords.join(", "));
    setUnit(alert.interval % 60 === 0 ? "minutes" : "seconds");
    setInterval(alert.interval % 60 === 0 ? String(alert.interval / 60) : String(alert.interval));
  };

  return (
    <main className="min-h-screen px-4 py-6 sm:px-6 lg:px-8">
      <div className="mx-auto grid w-full max-w-[1400px] gap-6 lg:grid-cols-2">
        <section className="rounded-3xl border border-slate-200 bg-slate-50 p-5 shadow-sm sm:p-8">
          <div className="flex items-center gap-3 text-slate-900">
            <IconWallet className="h-6 w-6 text-slate-700" />
            <h2 className="text-3xl font-extrabold tracking-tight">Alert Setup</h2>
          </div>

          <div className="mt-6 overflow-hidden rounded-3xl border border-slate-200 bg-white">
            <div className="border-b border-slate-200 px-6 py-5">
              <p className="text-sm text-slate-500">활성 알림</p>
              <p className="mt-1 text-5xl font-black text-slate-900">{activeCount}</p>
            </div>

            <form className="space-y-4 border-b border-slate-200 px-6 py-5" onSubmit={onSubmit}>
              <InputField label="알림 이름" value={alertName} onChange={setAlertName} placeholder="예: 재입고 알림" />
              <InputField
                label="관찰 대상 URL / API endpoint"
                value={endpoint}
                onChange={setEndpoint}
                placeholder="https://api.example.com/items"
              />

              <div className="grid gap-3 sm:grid-cols-2">
                <SelectField<HttpMethod> label="HTTP Method" value={method} onChange={setMethod} options={["GET", "POST"]} />
                <div className="grid grid-cols-[2fr_1fr] gap-2">
                  <label className="block text-sm font-medium text-slate-800">
                    관찰 주기
                    <input
                      type="number"
                      min={1}
                      className="mt-1 w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm outline-none transition focus:border-slate-500"
                      value={interval}
                      onChange={(event) => setInterval(event.target.value)}
                    />
                  </label>
                  <SelectField<IntervalUnit> label="단위" value={unit} onChange={setUnit} options={["seconds", "minutes"]} labels={{ seconds: "초", minutes: "분" }} />
                </div>
              </div>

              <InputField label="감지 키워드" value={keywordText} onChange={setKeywordText} placeholder="재입고, In Stock" />

              {error ? <p className="rounded-xl bg-rose-50 px-3 py-2 text-sm text-rose-700">{error}</p> : null}

              <div className="grid gap-2 sm:grid-cols-2">
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="rounded-xl bg-[#0d1117] px-4 py-3 text-sm font-semibold text-white transition hover:bg-[#1b2430] disabled:cursor-not-allowed disabled:bg-slate-400"
                >
                  {isSubmitting ? "저장 중..." : editingId ? "수정 저장" : "알림 저장"}
                </button>
                {editingId ? (
                  <button
                    type="button"
                    onClick={resetForm}
                    className="rounded-xl border border-slate-300 bg-white px-4 py-3 text-sm font-semibold text-slate-700 transition hover:bg-slate-100"
                  >
                    수정 취소
                  </button>
                ) : null}
              </div>
            </form>

          </div>
        </section>

        <section className="rounded-3xl border border-slate-200 bg-slate-50 p-5 shadow-sm sm:p-8">
          <div className="flex items-center gap-3 text-slate-900">
            <IconActivity className="h-6 w-6 text-slate-700" />
            <h2 className="text-3xl font-extrabold tracking-tight">Recent Alerts</h2>
          </div>

          <div className="mt-6 overflow-hidden rounded-3xl border border-slate-200 bg-white">
            <div className="flex items-center justify-between border-b border-slate-200 px-6 py-5">
              <p className="text-3xl font-bold text-slate-900">
                Recent Activity <span className="text-xl font-medium text-slate-500">({meta.total} alerts)</span>
              </p>
              <p className="text-lg font-medium text-slate-500">Page {meta.page}</p>
            </div>

            <div className="space-y-3 px-4 py-4 sm:px-6 sm:py-5">
              {isLoading ? <p className="text-sm text-slate-500">목록을 불러오는 중입니다...</p> : null}
              {!isLoading && alerts.length === 0 ? <p className="text-sm text-slate-500">등록된 알림이 없습니다.</p> : null}

              {alerts.map((alert) => (
                <article key={alert.id} className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-4">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-start gap-3">
                      <div className="mt-0.5 rounded-xl border border-slate-300 bg-white p-2">
                        <IconCard className="h-5 w-5 text-slate-700" />
                      </div>
                      <div>
                      <p className="text-xl font-bold text-slate-900">{alert.name}</p>
                      <p className="mt-1 break-all text-sm text-slate-600">{alert.endpoint}</p>
                      <p className="mt-2 text-sm text-slate-500">
                        {alert.method} • {alert.interval}초 • {alert.keywords.join(", ")}
                      </p>
                      </div>
                    </div>

                    <div className="text-right">
                      <p className={`text-xl font-bold ${alert.isActive ? "text-emerald-600" : "text-rose-500"}`}>
                        {alert.isActive ? "ON" : "OFF"}
                      </p>
                      <p className="text-xs text-slate-500">{alert.lastCheckResult ? resultLabel[alert.lastCheckResult] : "대기"}</p>
                    </div>
                  </div>

                  <div className="mt-3 flex flex-wrap gap-2 text-xs text-slate-600">
                    <span className="rounded-full border border-slate-300 bg-white px-2.5 py-1">최근 체크 {formatDate(alert.lastCheckedAt)}</span>
                    <span className="rounded-full border border-slate-300 bg-white px-2.5 py-1">최근 감지 {formatDate(alert.lastTriggeredAt)}</span>
                    <span className="rounded-full border border-slate-300 bg-white px-2.5 py-1">
                      변경 {alert.lastContentChanged === null ? "-" : alert.lastContentChanged ? "있음" : "없음"}
                    </span>
                    {alert.lastError ? <span className="rounded-full border border-rose-200 bg-rose-50 px-2.5 py-1 text-rose-700">에러 {alert.lastError}</span> : null}
                  </div>

                  <div className="mt-4 flex flex-wrap gap-2">
                    <button
                      type="button"
                      disabled={togglingIds.has(alert.id)}
                      onClick={() => onToggle(alert.id)}
                      className="rounded-lg bg-[#111827] px-3 py-2 text-xs font-semibold text-white transition hover:bg-black disabled:cursor-not-allowed disabled:bg-slate-500"
                    >
                      {togglingIds.has(alert.id) ? "반영 중..." : alert.isActive ? "OFF로 전환" : "ON으로 전환"}
                    </button>
                    <button
                      type="button"
                      onClick={() => onEdit(alert)}
                      className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs font-semibold text-slate-700 transition hover:bg-slate-100"
                    >
                      수정
                    </button>
                    <button
                      type="button"
                      onClick={() => onDelete(alert.id)}
                      className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-xs font-semibold text-rose-700 transition hover:bg-rose-100"
                    >
                      삭제
                    </button>
                  </div>
                </article>
              ))}
            </div>

            <div className="border-t border-slate-200 p-4 sm:p-5">
              <div className="mb-3 flex items-center justify-between text-xs text-slate-500">
                <button
                  type="button"
                  disabled={page <= 1}
                  onClick={() => setPage((prev) => Math.max(1, prev - 1))}
                  className="rounded-md border border-slate-300 bg-white px-3 py-1.5 disabled:cursor-not-allowed disabled:text-slate-300"
                >
                  이전
                </button>
                <span>
                  {meta.page} / {meta.totalPages}
                </span>
                <button
                  type="button"
                  disabled={page >= meta.totalPages}
                  onClick={() => setPage((prev) => Math.min(meta.totalPages, prev + 1))}
                  className="rounded-md border border-slate-300 bg-white px-3 py-1.5 disabled:cursor-not-allowed disabled:text-slate-300"
                >
                  다음
                </button>
              </div>
              <button className="w-full rounded-2xl bg-gradient-to-r from-[#0b0f17] via-[#131b2b] to-[#0b0f17] px-4 py-3 text-sm font-bold text-white">
                View All Alerts
              </button>
            </div>
          </div>
        </section>
      </div>
    </main>
  );
}

function InputField({ label, value, onChange, placeholder }: { label: string; value: string; onChange: (next: string) => void; placeholder: string }) {
  return (
    <label className="block text-sm font-medium text-slate-800">
      {label}
      <input
        className="mt-1 w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm outline-none transition focus:border-slate-500"
        value={value}
        placeholder={placeholder}
        onChange={(event) => onChange(event.target.value)}
      />
    </label>
  );
}

function SelectField<T extends string>({
  label,
  value,
  onChange,
  options,
  labels
}: {
  label: string;
  value: T;
  onChange: (next: T) => void;
  options: T[];
  labels?: Partial<Record<T, string>>;
}) {
  return (
    <label className="block text-sm font-medium text-slate-800">
      {label}
      <select
        className="mt-1 w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm outline-none transition focus:border-slate-500"
        value={value}
        onChange={(event) => onChange(event.target.value as T)}
      >
        {options.map((option) => (
          <option key={option} value={option}>
            {labels?.[option] ?? option}
          </option>
        ))}
      </select>
    </label>
  );
}

function formatDate(value: string | null): string {
  if (!value) return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "-";
  return date.toLocaleString("ko-KR", { hour12: false });
}

function IconWallet({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" className={className} aria-hidden="true">
      <rect x="3.5" y="6" width="17" height="12" rx="2.5" />
      <path d="M16.5 12h4" />
      <circle cx="16.2" cy="12" r="0.8" fill="currentColor" stroke="none" />
    </svg>
  );
}

function IconActivity({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" className={className} aria-hidden="true">
      <rect x="3.5" y="5.5" width="17" height="13" rx="2.5" />
      <path d="M8 12h8" />
    </svg>
  );
}

function IconCard({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className={className} aria-hidden="true">
      <rect x="3.5" y="6" width="17" height="12" rx="2.5" />
      <path d="M3.5 10h17" />
    </svg>
  );
}
