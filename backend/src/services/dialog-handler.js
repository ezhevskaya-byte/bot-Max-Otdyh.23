import { bookingFlow } from '../../../config/index.js';
import { loadMessages } from '../utils/template.js';
import { isValidDateRange } from '../utils/dates.js';
import {
  BookingState,
  getSession,
  updateSession,
  getNextMissingField,
  resetSession,
} from './booking-session.js';
import { suggestAvailableRooms } from '../../../integrations/bookinglite/adapter.js';
import { buildApplication } from './application.js';
import { admin } from '../../../config/index.js';
import { sendToAdmin } from '../../../integrations/max/client.js';
import { syncApplicationToBookingLite } from '../../../integrations/bookinglite/adapter.js';

const messages = loadMessages();
const buttons = bookingFlow.buttons;

export async function handleMessage({ userId, text, guestName, payload }) {
  const session = getSession(userId);
  const normalized = (text || '').trim().toLowerCase();

  if (payload?.action) {
    return handleButton(userId, payload.action, guestName);
  }

  if (normalized.includes('забронировать') || normalized === '/start') {
    resetSession(userId);
    updateSession(userId, { state: BookingState.COLLECTING_DATES });
    return reply(messages.askCheckIn, { buttons: [buttons.startBooking] });
  }

  switch (session.state) {
    case BookingState.IDLE:
      return reply(messages.welcome, {
        buttons: [buttons.startBooking],
      });

    case BookingState.COLLECTING_DATES:
    case BookingState.COLLECTING_GUESTS:
    case BookingState.COLLECTING_CHILDREN:
    case BookingState.COLLECTING_BED_PREFERENCES:
      return collectField(userId, text, guestName);

    case BookingState.SUGGESTING_ROOMS:
      return handleRoomSelection(userId, text);

    case BookingState.REVIEWING_APPLICATION:
      return reply('Нажмите «Связаться с администратором» для отправки заявки или «Изменить данные».', {
        buttons: [buttons.contactAdmin, buttons.editApplication],
      });

    default:
      return reply(messages.welcome, { buttons: [buttons.startBooking] });
  }
}

async function collectField(userId, text, guestName) {
  const session = getSession(userId);
  const { data } = session;
  const field = getNextMissingField(data);

  if (!field) {
    return suggestRooms(userId, guestName);
  }

  const value = parseField(field, text);
  if (value === null) {
    return reply(getInvalidMessage(field));
  }

  if (field === 'checkOut' && !isValidDateRange(data.checkIn, value)) {
    return reply('Дата выезда должна быть позже заезда. Укажите выезд ещё раз.');
  }

  data[field] = value;
  if (guestName) data.guestName = guestName;

  if (field === 'children' && value === 0) {
    data.childrenAges = [];
  }

  updateSession(userId, { data, state: nextState(field) });

  const next = getNextMissingField(getSession(userId).data);
  if (!next) return suggestRooms(userId, guestName);

  return reply(getAskMessage(next));
}

function parseField(field, text) {
  const t = text.trim();
  switch (field) {
    case 'checkIn':
    case 'checkOut':
    case 'bedPreferences':
      return t || null;
    case 'adults':
    case 'children': {
      const n = parseInt(t, 10);
      return Number.isNaN(n) || n < 0 ? null : n;
    }
    case 'childrenAges':
      return t.split(/[,;]\s*/).map((s) => parseInt(s.trim(), 10)).filter((n) => !Number.isNaN(n));
    default:
      return t;
  }
}

function nextState(field) {
  const map = {
    checkIn: BookingState.COLLECTING_DATES,
    checkOut: BookingState.COLLECTING_GUESTS,
    adults: BookingState.COLLECTING_GUESTS,
    children: BookingState.COLLECTING_CHILDREN,
    childrenAges: BookingState.COLLECTING_CHILDREN,
    bedPreferences: BookingState.COLLECTING_BED_PREFERENCES,
  };
  return map[field] ?? BookingState.COLLECTING_GUESTS;
}

function getAskMessage(field) {
  const map = {
    checkIn: messages.askCheckIn,
    checkOut: messages.askCheckOut,
    adults: messages.askAdults,
    children: messages.askChildren,
    childrenAges: messages.askChildrenAges,
    bedPreferences: messages.askBedPreferences,
  };
  return map[field] ?? messages.welcome;
}

function getInvalidMessage(field) {
  const hints = {
    checkIn: 'Укажите дату заезда в формате ДД.ММ.ГГГГ',
    checkOut: 'Укажите дату выезда в формате ДД.ММ.ГГГГ',
    adults: 'Введите число взрослых, например: 2',
    children: 'Введите число детей (0, если без детей)',
    childrenAges: 'Укажите возрасты через запятую, например: 5, 9',
  };
  return hints[field] ?? 'Не удалось распознать ответ. Попробуйте ещё раз.';
}

async function suggestRooms(userId, guestName) {
  const session = getSession(userId);
  const { data } = session;
  const matches = await suggestAvailableRooms(data);

  if (!matches.length) {
    updateSession(userId, { state: BookingState.IDLE });
    return reply(messages.noSuitableRoom, { buttons: [buttons.startBooking] });
  }

  updateSession(userId, {
    state: BookingState.SUGGESTING_ROOMS,
    suggestedRooms: matches,
    data: { ...data, guestName: guestName || data.guestName },
  });

  const lines = matches.map(
    (m, i) => `${i + 1}. **${m.roomName}** — ${m.layoutDescription}`,
  );

  return reply(
    `Подходящие варианты:\n\n${lines.join('\n')}\n\nНапишите номер варианта (1 или 2).`,
    { buttons: matches.map((_, i) => `Вариант ${i + 1}`) },
  );
}

async function handleRoomSelection(userId, text) {
  const session = getSession(userId);
  const idx = parseInt(text.trim(), 10) - 1;
  const room = session.suggestedRooms[idx];

  if (!room) {
    return reply('Выберите вариант: напишите 1 или 2.');
  }

  const data = { ...session.data, selectedRoom: room };
  const application = buildApplication({
    userId,
    guestName: data.guestName,
    data,
  });

  updateSession(userId, {
    state: BookingState.REVIEWING_APPLICATION,
    data,
    applicationId: application.id,
    pendingApplication: application,
  });

  return reply(application.guestText, {
    buttons: [buttons.contactAdmin, buttons.editApplication],
  });
}

async function handleButton(userId, action, guestName) {
  const session = getSession(userId);

  if (action === 'edit') {
    resetSession(userId);
    updateSession(userId, { state: BookingState.COLLECTING_DATES });
    return reply(messages.askCheckIn);
  }

  if (action === 'contact_admin') {
    const app = session.pendingApplication;
    if (!app) {
      return reply('Сначала оформите заявку — напишите «забронировать».');
    }

    await sendToAdmin(app);
    await syncApplicationToBookingLite(app);
    updateSession(userId, { state: BookingState.CONFIRMED });

    return reply(messages.applicationSent.replace('{{adminName}}', admin.name));
  }

  if (action === 'start_booking') {
    resetSession(userId);
    updateSession(userId, { state: BookingState.COLLECTING_DATES });
    return reply(messages.askCheckIn);
  }

  return reply(messages.welcome);
}

function reply(text, options = {}) {
  return {
    text,
    buttons: options.buttons ?? [],
  };
}
