import { useCallback, useEffect, useState } from "react";
import { possibleNewChapter, type ScheduleRule } from "@/lib/schedule";
import type { Schedule, Series } from "@/lib/data";

const PREF_KEY = "notif-enabled";
const LAST_SENT_KEY = "notif-last-sent";

export function useNotifPref(): [boolean, (v: boolean) => void] {
  const [enabled, setEnabled] = useState(() => localStorage.getItem(PREF_KEY) === "1");
  const set = useCallback((v: boolean) => {
    setEnabled(v);
    localStorage.setItem(PREF_KEY, v ? "1" : "0");
  }, []);
  return [enabled, set];
}

export async function requestNotificationPermission(): Promise<boolean> {
  if (!("Notification" in window)) return false;
  if (Notification.permission === "granted") return true;
  if (Notification.permission === "denied") return false;
  return (await Notification.requestPermission()) === "granted";
}

/** Fires one daily notification listing series with a possible new chapter. */
export function useNewChapterNotifications(
  series: Series[] | undefined,
  schedules: Schedule[] | undefined,
  enabled: boolean,
) {
  useEffect(() => {
    if (!enabled || !series || !schedules || !("Notification" in window)) return;
    if (Notification.permission !== "granted") return;
    const now = new Date();
    const lastSent = Number(localStorage.getItem(LAST_SENT_KEY) ?? "0");
    if (lastSent && new Date(lastSent).toDateString() === now.toDateString()) return;

    const schedMap = new Map(schedules.map((s) => [s.series_id, s]));
    const news = series.filter((s) =>
      possibleNewChapter(schedMap.get(s.id) as ScheduleRule | undefined, s.last_read_at, now),
    );
    if (!news.length) return;

    const titles = news.slice(0, 5).map((s) => s.titulo).join(", ");
    const body = news.length > 5 ? `${titles} y ${news.length - 5} más` : titles;
    try {
      new Notification("Nuevos capítulos disponibles", { body, tag: "new-chapters" });
      localStorage.setItem(LAST_SENT_KEY, String(now.getTime()));
    } catch {
      /* notification not supported */
    }
  }, [enabled, series, schedules]);
}
