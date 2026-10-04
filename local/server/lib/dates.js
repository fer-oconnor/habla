// ---------------------------------------------------------------------------
// Fechas.
//
// Regla del proyecto: en la base de datos TODAS las marcas de tiempo estan en
// UTC (ISO-8601). El "dia de actividad" que usan el objetivo diario y la racha
// se calcula aparte, con la zona horaria del perfil del usuario, y se guarda
// como 'YYYY-MM-DD'.
//
// Ejemplo: un usuario en Madrid que termina una leccion a las 00:30 del dia 16
// tiene activity_day = '2026-09-16', aunque en UTC sean las 22:30 del dia 15.
// ---------------------------------------------------------------------------

const DAY_MS = 24 * 60 * 60 * 1000;

/** 'YYYY-MM-DD' del instante `date` visto desde `timeZone`. */
export function dayInTimeZone(date = new Date(), timeZone = 'UTC') {
  let parts;
  try {
    parts = new Intl.DateTimeFormat('en-CA', {
      timeZone,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    }).formatToParts(date);
  } catch {
    // Zona invalida: no rompemos el progreso del usuario, usamos UTC.
    parts = new Intl.DateTimeFormat('en-CA', {
      timeZone: 'UTC',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    }).formatToParts(date);
  }
  const get = (type) => parts.find((part) => part.type === type)?.value ?? '01';
  return `${get('year')}-${get('month')}-${get('day')}`;
}

/** Convierte 'YYYY-MM-DD' a un Date fijado al mediodia UTC (evita saltos). */
function dayToUtcNoon(day) {
  const [year, month, date] = day.split('-').map(Number);
  return new Date(Date.UTC(year, month - 1, date, 12, 0, 0));
}

/** Suma (o resta) dias a una cadena 'YYYY-MM-DD'. */
export function addDays(day, amount) {
  const shifted = new Date(dayToUtcNoon(day).getTime() + amount * DAY_MS);
  return shifted.toISOString().slice(0, 10);
}

/** Dias enteros entre dos cadenas 'YYYY-MM-DD' (b - a). */
export function daysBetween(a, b) {
  return Math.round((dayToUtcNoon(b) - dayToUtcNoon(a)) / DAY_MS);
}

export function isDayString(value) {
  return typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value);
}

/** Etiqueta corta en ingles para la interfaz: "Mon 15 Sep". */
export function shortLabel(day, timeZone = 'UTC') {
  try {
    return new Intl.DateTimeFormat('en-GB', {
      timeZone: 'UTC',
      weekday: 'short',
      day: 'numeric',
      month: 'short',
    }).format(dayToUtcNoon(day));
  } catch {
    return day;
  }
}

/** Los ultimos `count` dias (incluido `today`), del mas antiguo al mas nuevo. */
export function lastDays(today, count) {
  const days = [];
  for (let offset = count - 1; offset >= 0; offset -= 1) {
    days.push(addDays(today, -offset));
  }
  return days;
}
