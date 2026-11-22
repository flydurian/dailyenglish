// 로컬 시간 기준 날짜 키를 만든다. toISOString()은 UTC 기준이라 사용하지 않는다.
export function toLocalDateKey(date: Date | string | number = new Date()): string {
  const target = date instanceof Date ? date : new Date(date);
  const d = Number.isNaN(target.getTime()) ? new Date() : target;

  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');

  return `${year}-${month}-${day}`;
}
