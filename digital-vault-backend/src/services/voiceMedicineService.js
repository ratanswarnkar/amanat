const DEFAULT_MORNING_TIME = '08:00';
const DEFAULT_AFTERNOON_TIME = '13:00';
const DEFAULT_EVENING_TIME = '18:00';
const DEFAULT_NIGHT_TIME = '21:00';

const normalizeTime = (input) => {
  if (!input) {
    return null;
  }

  const trimmed = input.trim().toLowerCase();
  const match = trimmed.match(/^(\d{1,2})(?::(\d{2}))?\s*(am|pm)?$/);
  if (!match) {
    return null;
  }

  let hours = Number(match[1]);
  const minutes = match[2] ? Number(match[2]) : 0;
  const meridiem = match[3];

  if (meridiem === 'pm' && hours < 12) {
    hours += 12;
  }

  if (meridiem === 'am' && hours === 12) {
    hours = 0;
  }

  if (hours > 23 || minutes > 59) {
    return null;
  }

  return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}`;
};

const inferTimeSlots = (voiceText) => {
  const timeSlots = [];
  const normalized = voiceText.toLowerCase();
  const explicitTimes = [...normalized.matchAll(/\bat\s+(\d{1,2}(?::\d{2})?\s*(?:am|pm)?)\b/g)];

  for (const match of explicitTimes) {
    const normalizedTime = normalizeTime(match[1]);
    if (normalizedTime && !timeSlots.includes(normalizedTime)) {
      timeSlots.push(normalizedTime);
    }
  }

  if (timeSlots.length > 0) {
    return timeSlots;
  }

  if (normalized.includes('morning')) {
    timeSlots.push(DEFAULT_MORNING_TIME);
  }

  if (normalized.includes('afternoon')) {
    timeSlots.push(DEFAULT_AFTERNOON_TIME);
  }

  if (normalized.includes('evening')) {
    timeSlots.push(DEFAULT_EVENING_TIME);
  }

  if (normalized.includes('night')) {
    timeSlots.push(DEFAULT_NIGHT_TIME);
  }

  return timeSlots.length > 0 ? timeSlots : [DEFAULT_MORNING_TIME];
};

const parseVoiceMedicine = (voiceText) => {
  const trimmed = voiceText.trim();
  const nameMatch =
    trimmed.match(/take\s+(.+?)\s+(?:every|at|once|twice|thrice|daily)/i) ||
    trimmed.match(/take\s+(.+)/i);

  const rawName = nameMatch ? nameMatch[1] : trimmed;
  const name = rawName.replace(/\s+(every|at)\b.*$/i, '').trim();
  const timeSlots = inferTimeSlots(trimmed);

  return {
    name,
    dosage: null,
    timesPerDay: timeSlots.length,
    timeSlots,
    notes: `Created from voice input: ${trimmed}`,
  };
};

module.exports = {
  parseVoiceMedicine,
};
