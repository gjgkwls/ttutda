export const INTERVAL_OPTIONS_SECONDS = [1, 5, 10, 60, 300] as const;

export type IntervalOption = (typeof INTERVAL_OPTIONS_SECONDS)[number];
