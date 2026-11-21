export function opensAtShabbatLunch(now = new Date()) {
 const parts = new Intl.DateTimeFormat('en-GB', {
  timeZone: 'Asia/Jerusalem',
  weekday: 'short',
  hour: '2-digit',
  hourCycle: 'h23',
 }).formatToParts(now);
 const weekday = parts.find(part => part.type === 'weekday')?.value;
 const hour = Number(parts.find(part => part.type === 'hour')?.value);
 return (weekday === 'Fri' && hour >= 22) || (weekday === 'Sat' && hour < 16);
}
