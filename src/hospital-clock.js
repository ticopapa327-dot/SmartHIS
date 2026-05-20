const BEIJING_TIME_ZONE = "Asia/Shanghai";

function partsFor(date, options) {
  const formatter = new Intl.DateTimeFormat("zh-CN", {
    timeZone: BEIJING_TIME_ZONE,
    hour12: false,
    ...options
  });
  return formatter.formatToParts(date);
}

function getPart(parts, type) {
  return parts.find((item) => item.type === type)?.value ?? "";
}

export function beijingDateString(date = new Date()) {
  const parts = partsFor(date, {
    year: "numeric",
    month: "2-digit",
    day: "2-digit"
  });
  return `${getPart(parts, "year")}-${getPart(parts, "month")}-${getPart(parts, "day")}`;
}

export function beijingDateStamp(date = new Date()) {
  return beijingDateString(date).replaceAll("-", "");
}

export function addDaysToDateString(dateString, days) {
  const [year, month, day] = dateString.split("-").map(Number);
  const date = new Date(Date.UTC(year, month - 1, day + days, 0, 0, 0));
  return [
    date.getUTCFullYear(),
    String(date.getUTCMonth() + 1).padStart(2, "0"),
    String(date.getUTCDate()).padStart(2, "0")
  ].join("-");
}

export function dayDifference(leftDateString, rightDateString) {
  const [leftYear, leftMonth, leftDay] = leftDateString.split("-").map(Number);
  const [rightYear, rightMonth, rightDay] = rightDateString.split("-").map(Number);
  const left = Date.UTC(leftYear, leftMonth - 1, leftDay, 0, 0, 0);
  const right = Date.UTC(rightYear, rightMonth - 1, rightDay, 0, 0, 0);
  return Math.round((left - right) / 86_400_000);
}

export function beijingIsoAt(dateString, hour = 0, minute = 0, second = 0) {
  return `${dateString}T${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}:${String(second).padStart(2, "0")}+08:00`;
}

export function shiftIsoByDays(value, days) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return value;
  }
  return new Date(date.getTime() + days * 86_400_000).toISOString();
}
