import { EVENT } from '../config.js';

// A calendar file for the launch, with a reminder two hours before doors.
export function downloadIcs(extra = '') {
  const f = (iso) => new Date(iso).toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '');
  const ics = [
    'BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//Masters Union//MilkyWay Launch//EN', 'BEGIN:VEVENT',
    `UID:milkyway-launch-2026@mastersunion.org`, `DTSTAMP:${f(new Date().toISOString())}`,
    `DTSTART:${f(EVENT.start)}`, `DTEND:${f(EVENT.end)}`,
    `SUMMARY:${EVENT.title}`, `LOCATION:${EVENT.venue}`,
    `DESCRIPTION:Masters' Union's first-ever UG fest. Come shape it from day one. Bring your friends.${extra ? '\\n' + extra : ''}`,
    'BEGIN:VALARM', 'TRIGGER:-PT2H', 'ACTION:DISPLAY', 'DESCRIPTION:The MilkyWay Launch starts in 2 hours', 'END:VALARM',
    'END:VEVENT', 'END:VCALENDAR',
  ].join('\r\n');
  const a = document.createElement('a');
  a.href = URL.createObjectURL(new Blob([ics], { type: 'text/calendar' }));
  a.download = 'milkyway-launch.ics';
  document.body.appendChild(a); a.click(); a.remove();
}
