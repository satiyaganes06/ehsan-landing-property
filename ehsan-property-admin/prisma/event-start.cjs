// Published event snapshots store Malaysian local time, without an offset.
const months = 'Jan Feb Mar Apr May Jun Jul Aug Sep Oct Nov Dec'.split(' ');

function parseEventStart(value) {
  const match = /^(\w{3}) (\d{1,2}), (\d{4})\s*·\s*(\d{1,2}):(\d{2})\s+([AP]M)$/.exec(value);
  if (match) {
    const [, name, day, year, hour, minute, period] = match;
    const month = months.indexOf(name);
    const lastDay = new Date(Date.UTC(+year, month + 1, 0)).getUTCDate();
    if (month >= 0 && +day >= 1 && +day <= lastDay && +hour >= 1 && +hour <= 12 && +minute < 60) {
      const localHour = +hour % 12 + (period === 'PM' ? 12 : 0);
      return new Date(Date.UTC(+year, month, +day, localHour - 8, +minute));
    }
  }
  throw new Error('Invalid Malaysian event date and time in snapshot');
}

module.exports = { parseEventStart };
