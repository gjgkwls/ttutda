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

const API_BASE = process.env.NEXT_PUBLIC_SERVER_URL ?? "http://localhost:4000";
const PAGE_SIZE = 5;

const unitLabel: Record<IntervalUnit | LastCheckResult, string> = {
  seconds: "초",
  minutes: "분",
  MATCH: "키워드 감지",
  NO_MATCH: "미감지",
  ERROR: "에러"
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
  const [error, setError] = useState("");

  const activeCount = useMemo(() => alerts.filter((alert) => alert.isActive).length, [alerts]);
  const registeredCount = useMemo(() => alerts.filter((alert) => alert.workerRegistered).length, [alerts]);

  const resetForm = () => {
    setEditingId(null);
    setAlertName("");
    setEndpoint("");
    setMethod("GET");
    setKeywordText("");
    setInterval("5");
    setUnit("seconds");
  };

  const loadAlerts = useCallback(async (targetPage = page) => {
    setIsLoading(true);
    try {
      const response = await fetch(`${API_BASE}/alerts?page=${targetPage}&pageSize=${PAGE_SIZE}`);
      if (!response.ok) throw new Error("알림 목록을 불러오지 못했습니다.");
      const json = await response.json();
      const data = Array.isArray(json.data) ? json.data : [];
      const nextMeta: AlertsMeta = json.meta ?? initialMeta;

      setAlerts(
        data.map((item: any) => ({
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
        }))
      );
      setMeta(nextMeta);
      setError("");
    } catch (e) {
      setError(e instanceof Error ? e.message : "알림 목록 로드 중 오류가 발생했습니다.");
    } finally {
      setIsLoading(false);
    }
  }, [page]);

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
    try {
      const response = await fetch(`${API_BASE}/alerts/${id}/toggle`, { method: "POST" });
      if (!response.ok) throw new Error("상태 토글에 실패했습니다.");
      await loadAlerts(page);
    } catch (e) {
      setError(e instanceof Error ? e.message : "토글 중 오류가 발생했습니다.");
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
    <main className="mx-auto min-h-screen max-w-6xl px-5 py-10 md:px-8 md:py-14">
      <section className="rounded-3xl border border-slate-100 bg-white/85 p-7 shadow-2xl shadow-cyan-100/50 backdrop-blur md:p-10">
        <p className="text-xs font-semibold uppercase tracking-[0.24em] text-ttutda-cyan">TTUTDA Dashboard</p>
        <h1 className="mt-3 text-3xl font-semibold tracking-tight text-ttutda-ink md:text-4xl">
          알림 설정 플로우를 바로 실행하는 대시보드
        </h1>
        <p className="mt-4 max-w-3xl text-sm leading-7 text-slate-700 md:text-base">
          새 알림 추가부터 입력, 저장, 워커 등록, 활성화/비활성화 제어와 수정/삭제까지 한 화면에서 처리할 수 있습니다.
        </p>

        <div className="mt-7 grid gap-4 md:grid-cols-3">
          <StatCard label="총 알림" value={`${alerts.length}개`} />
          <StatCard label="활성화" value={`${activeCount}개`} />
          <StatCard label="워커 등록" value={`${registeredCount}개`} />
        </div>
      </section>

      <section className="mt-8 grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.2fr)]">
        <article className="rounded-2xl border border-slate-200 bg-white p-6 shadow-md">
          <h2 className="text-lg font-semibold text-ttutda-ink">{editingId ? "알림 수정" : "새 알림 추가"}</h2>
          <p className="mt-2 text-sm text-slate-600">알림 이름, URL/API endpoint, 감지 키워드, 관찰 주기를 입력하고 저장하세요.</p>

          <form className="mt-6 space-y-4" onSubmit={onSubmit}>
            <label className="block">
              <span className="mb-1 block text-sm font-medium text-slate-800">알림 이름</span>
              <input
                className="w-full rounded-xl border border-slate-300 px-4 py-2.5 text-sm outline-none transition focus:border-cyan-500 focus:ring-2 focus:ring-cyan-200"
                placeholder="예: 재입고 체크"
                value={alertName}
                onChange={(event) => setAlertName(event.target.value)}
              />
            </label>

            <label className="block">
              <span className="mb-1 block text-sm font-medium text-slate-800">관찰 대상 URL / API endpoint</span>
              <input
                className="w-full rounded-xl border border-slate-300 px-4 py-2.5 text-sm outline-none transition focus:border-cyan-500 focus:ring-2 focus:ring-cyan-200"
                placeholder="https://api.example.com/items"
                value={endpoint}
                onChange={(event) => setEndpoint(event.target.value)}
              />
            </label>

            <label className="block">
              <span className="mb-1 block text-sm font-medium text-slate-800">HTTP Method</span>
              <select
                className="w-full rounded-xl border border-slate-300 px-4 py-2.5 text-sm outline-none transition focus:border-cyan-500 focus:ring-2 focus:ring-cyan-200"
                value={method}
                onChange={(event) => setMethod(event.target.value as HttpMethod)}
              >
                <option value="GET">GET</option>
                <option value="POST">POST</option>
              </select>
            </label>

            <label className="block">
              <span className="mb-1 block text-sm font-medium text-slate-800">감지 키워드</span>
              <input
                className="w-full rounded-xl border border-slate-300 px-4 py-2.5 text-sm outline-none transition focus:border-cyan-500 focus:ring-2 focus:ring-cyan-200"
                placeholder="재입고, In Stock (쉼표로 구분)"
                value={keywordText}
                onChange={(event) => setKeywordText(event.target.value)}
              />
            </label>

            <div className="grid grid-cols-[2fr_1fr] gap-3">
              <label className="block">
                <span className="mb-1 block text-sm font-medium text-slate-800">관찰 주기</span>
                <input
                  type="number"
                  min={1}
                  className="w-full rounded-xl border border-slate-300 px-4 py-2.5 text-sm outline-none transition focus:border-cyan-500 focus:ring-2 focus:ring-cyan-200"
                  value={interval}
                  onChange={(event) => setInterval(event.target.value)}
                />
              </label>

              <label className="block">
                <span className="mb-1 block text-sm font-medium text-slate-800">단위</span>
                <select
                  className="w-full rounded-xl border border-slate-300 px-4 py-2.5 text-sm outline-none transition focus:border-cyan-500 focus:ring-2 focus:ring-cyan-200"
                  value={unit}
                  onChange={(event) => setUnit(event.target.value as IntervalUnit)}
                >
                  <option value="seconds">초</option>
                  <option value="minutes">분</option>
                </select>
              </label>
            </div>

            {error ? <p className="rounded-lg bg-rose-50 px-3 py-2 text-sm text-rose-700">{error}</p> : null}

            <button
              type="submit"
              disabled={isSubmitting}
              className="w-full rounded-xl bg-ttutda-cyan px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-sky-600 disabled:cursor-not-allowed disabled:bg-slate-400"
            >
              {isSubmitting ? "저장 중..." : editingId ? "수정 저장" : "저장"}
            </button>

            {editingId ? (
              <button
                type="button"
                onClick={resetForm}
                className="w-full rounded-xl border border-slate-300 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
              >
                수정 취소
              </button>
            ) : null}
          </form>
        </article>

        <article className="rounded-2xl border border-slate-200 bg-white p-6 shadow-md">
          <h2 className="text-lg font-semibold text-ttutda-ink">알림 목록</h2>
          <p className="mt-2 text-sm text-slate-600">저장된 알림은 기본 활성화(ON) 상태로 등록되며 토글 버튼으로 상태를 제어할 수 있습니다.</p>

          <div className="mt-5 space-y-4">
            {isLoading ? <p className="text-sm text-slate-500">목록을 불러오는 중입니다...</p> : null}
            {alerts.map((alert) => (
              <div key={alert.id} className="rounded-xl border border-slate-200 bg-slate-50/70 p-4">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="rounded-full bg-emerald-100 px-2.5 py-1 text-xs font-semibold text-emerald-700">
                      {alert.isActive ? "활성화 ON" : "비활성화 OFF"}
                    </span>
                    <span className="rounded-full bg-sky-100 px-2.5 py-1 text-xs font-semibold text-sky-700">
                      {alert.workerRegistered ? "워커 등록됨" : "등록 대기"}
                    </span>
                  </div>

                  <button
                    type="button"
                    className={`rounded-lg px-3 py-1.5 text-xs font-semibold text-white transition ${
                      alert.isActive ? "bg-emerald-500 hover:bg-emerald-600" : "bg-slate-500 hover:bg-slate-600"
                    }`}
                    onClick={() => onToggle(alert.id)}
                    aria-label={`${alert.name} 상태 토글`}
                  >
                    {alert.isActive ? "활성화 ON" : "비활성화 OFF"}
                  </button>
                </div>

                <p className="mt-3 text-base font-semibold text-slate-900">{alert.name}</p>
                <p className="mt-1 break-all text-sm font-medium text-slate-800">{alert.endpoint}</p>

                <div className="mt-2 grid gap-1 text-sm text-slate-600">
                  <p>요청: {alert.method}</p>
                  <p>키워드: {alert.keywords.join(", ")}</p>
                  <p>주기: {alert.interval}초</p>
                  <p>최근 체크: {formatDate(alert.lastCheckedAt)}</p>
                  <p>최근 감지: {formatDate(alert.lastTriggeredAt)}</p>
                  <p>
                    내용 변경:{" "}
                    {alert.lastContentChanged === null ? "초기 수집/정보 없음" : alert.lastContentChanged ? "변경됨" : "변경 없음"}
                  </p>
                  <p>
                    최근 결과: {alert.lastCheckResult ? unitLabel[alert.lastCheckResult] : "대기 중"}
                  </p>
                  {alert.lastError ? <p className="text-rose-600">에러: {alert.lastError}</p> : null}
                </div>

                <div className="mt-3 flex gap-2">
                  <button
                    type="button"
                    onClick={() => onEdit(alert)}
                    className="rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 transition hover:bg-slate-100"
                  >
                    수정
                  </button>
                  <button
                    type="button"
                    onClick={() => onDelete(alert.id)}
                    className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-1.5 text-xs font-semibold text-rose-700 transition hover:bg-rose-100"
                  >
                    삭제
                  </button>
                </div>
              </div>
            ))}

            {!isLoading && alerts.length === 0 ? <p className="text-sm text-slate-500">등록된 알림이 없습니다.</p> : null}
          </div>

          <div className="mt-4 flex items-center justify-between">
            <button
              type="button"
              disabled={page <= 1}
              onClick={() => setPage((prev) => Math.max(1, prev - 1))}
              className="rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:text-slate-300"
            >
              이전
            </button>
            <p className="text-xs text-slate-500">
              {meta.page} / {meta.totalPages} 페이지 ({meta.total}개)
            </p>
            <button
              type="button"
              disabled={page >= meta.totalPages}
              onClick={() => setPage((prev) => Math.min(meta.totalPages, prev + 1))}
              className="rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:text-slate-300"
            >
              다음
            </button>
          </div>
        </article>
      </section>
    </main>
  );
}

function StatCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white/90 p-4">
      <p className="text-xs font-semibold uppercase tracking-widest text-slate-500">{label}</p>
      <p className="mt-1 text-2xl font-semibold text-ttutda-ink">{value}</p>
    </div>
  );
}

function formatDate(value: string | null): string {
  if (!value) return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "-";
  return date.toLocaleString("ko-KR");
}
