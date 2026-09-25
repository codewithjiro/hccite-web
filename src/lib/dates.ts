const philippineDateTimeFormatter = new Intl.DateTimeFormat("en-PH", {
  timeZone: "Asia/Manila",
  year: "numeric",
  month: "numeric",
  day: "numeric",
  hour: "numeric",
  minute: "2-digit",
  second: "2-digit",
  hour12: true,
});

const philippineDateFormatter = new Intl.DateTimeFormat("en-PH", {
  timeZone: "Asia/Manila",
  year: "numeric",
  month: "numeric",
  day: "numeric",
});

export function formatPhilippineDateTime(value: Date | string | null | undefined): string {
  if (!value) return "Unavailable";
  const date = value instanceof Date ? value : new Date(value);
  return Number.isNaN(date.getTime()) ? "Unavailable" : philippineDateTimeFormatter.format(date);
}

export function formatPhilippineDate(value: Date | string | null | undefined): string {
  if (!value) return "Unavailable";
  const date = value instanceof Date ? value : new Date(value);
  return Number.isNaN(date.getTime()) ? "Unavailable" : philippineDateFormatter.format(date);
}
