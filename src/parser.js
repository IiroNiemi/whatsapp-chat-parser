const { daysBeforeMonths, normalizeDate } = require('./date.js');
const {
  regexSplitTime,
  convertTime12to24,
  normalizeAMPM,
  normalizeTime,
} = require('./time.js');

const regexParser = /^\[?(\d{1,2}[-/.] ?\d{1,2}[-/.] ?\d{2,4})[,.]? \D*?(\d{1,2}[.:]\d{1,2}(?:[.:]\d{1,2})?)(?: ([ap]\.? ?m\.?))?\]?(?: -|:)? (.+?): ([^]*)/i;
const regexParserSystem = /^\[?(\d{1,2}[-/.] ?\d{1,2}[-/.] ?\d{2,4})[,.]? \D*?(\d{1,2}[.:]\d{1,2}(?:[.:]\d{1,2})?)(?: ([ap]\.? ?m\.?))?\]?(?: -|:)? ([^]+)/i;
const regexStartsWithDateTime = /^\[?(\d{1,2}[-/.] ?\d{1,2}[-/.] ?\d{2,4})[,.]? \D*?(\d{1,2}[.:]\d{1,2}(?:[.:]\d{1,2})?)(?: ([ap]\.? ?m\.?))?\]?/i;
const regexSplitDate = /[-/.] ?/;

/**
 * Given an array of lines, detects the lines that are part of a previous
 * message (multiline messages) and merges them
 * It also labels the system messages
 * The result is an array of messages
 */
function makeArrayOfMessages(lines) {
  return lines.reduce((acc, line) => {
    /**
     * If the line doesn't conform to the regex it's probably part of the
     * previous message or a "whatsapp event"
     */
    if (!regexParser.test(line)) {
      /**
       * If it doesn't match the first regex but still starts with a datetime
       * it should be considered a "whatsapp event" so it gets labeled "system"
       */
      if (regexStartsWithDateTime.test(line)) {
        acc.push({ system: true, msg: line });
      }

      // Else it's part of the previous message and it should be concatenated
      else if (typeof acc[acc.length - 1] !== 'undefined') {
        const prevMessage = acc.pop();

        acc.push({
          system: prevMessage.system,
          msg: `${prevMessage.msg}\n${line}`,
        });
      }
    } else {
      acc.push({ system: false, msg: line });
    }

    return acc;
  }, []);
}

/**
 * Given an array of messages, parses them and returns an object with the fields
 * date, author, message
 */
function parseMessages(
  messages,
  options = { daysFirst: undefined, setRunningMessageId: false },
) {
  let { daysFirst, setRunningMessageId } = options;
  let runningMessageId = 0;

  // Parse messages with regex
  const parsed = messages.map(obj => {
    const { system, msg } = obj;

    // If it's a system message another regex should be used to parse it
    if (system) {
      const [, date, time, ampm, message] = regexParserSystem.exec(msg);

      return { date, time, ampm: ampm || null, author: 'System', message };
    }

    const [, date, time, ampm, author, message] = regexParser.exec(msg);

    return { date, time, ampm: ampm || null, author, message };
  });

  // Understand date format if not supplied (days come first?)
  if (typeof daysFirst !== 'boolean') {
    const numericDates = Array.from(
      new Set(parsed.map(({ date }) => date)),
      date => date.split(regexSplitDate).map(Number),
    );

    daysFirst = daysBeforeMonths(numericDates);
  }

  // Convert date/time in date object, return final object
  return parsed.map(({ date, time, ampm, author, message }) => {
    let day;
    let month;
    let year;
    runningMessageId += 1;

    if (daysFirst === false) {
      [month, day, year] = date.split(regexSplitDate);
    } else {
      [day, month, year] = date.split(regexSplitDate);
    }

    [year, month, day] = normalizeDate(year, month, day);

    const [hours, minutes, seconds] = normalizeTime(
      ampm ? convertTime12to24(time, normalizeAMPM(ampm)) : time,
    ).split(regexSplitTime);

    if (setRunningMessageId === true) {
      return {
        id: runningMessageId,
        date: new Date(year, month - 1, day, hours, minutes, seconds),
        author,
        message,
      };
    }

    return {
      date: new Date(year, month - 1, day, hours, minutes, seconds),
      author,
      message,
    };
  });
}

module.exports = {
  makeArrayOfMessages,
  parseMessages,
};
