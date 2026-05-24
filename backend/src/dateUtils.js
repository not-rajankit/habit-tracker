const IST_TIME_ZONE = 'Asia/Kolkata';

const istDateFormatter = new Intl.DateTimeFormat('en-CA', {
  timeZone: IST_TIME_ZONE,
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
});

function pad(value) {
  return String(value).padStart(2, '0');
}

export function toDateKey(value = new Date()) {
  if (typeof value === 'string') return value.slice(0, 10);
  const parts = istDateFormatter.formatToParts(value).reduce((result, part) => {
    result[part.type] = part.value;
    return result;
  }, {});
  return `${parts.year}-${parts.month}-${parts.day}`;
}

export function parseDateKey(dateKey) {
  const [year, month, day] = toDateKey(dateKey).split('-').map(Number);
  return { year, month, day };
}

export function addDays(dateKey, days) {
  const { year, month, day } = parseDateKey(dateKey);
  const date = new Date(Date.UTC(year, month - 1, day + days, 12));
  return `${date.getUTCFullYear()}-${pad(date.getUTCMonth() + 1)}-${pad(date.getUTCDate())}`;
}

export function startOfWeek(dateKey) {
  const { year, month, day } = parseDateKey(dateKey);
  const date = new Date(Date.UTC(year, month - 1, day));
  const weekday = date.getUTCDay();
  return addDays(dateKey, -(weekday === 0 ? 6 : weekday - 1));
}

export function daysInMonth(year, month) {
  return new Date(Date.UTC(year, month, 0)).getUTCDate();
}

export function monthDateKey(year, month, day) {
  return `${year}-${pad(month)}-${pad(day)}`;
}
