/**
 * In-memory сессии диалога (для prod — Redis/БД)
 */
const sessions = new Map();

export const BookingState = {
  IDLE: 'idle',
  COLLECTING_DATES: 'collecting_dates',
  COLLECTING_GUESTS: 'collecting_guests',
  COLLECTING_CHILDREN: 'collecting_children',
  COLLECTING_BED_PREFERENCES: 'collecting_bed_preferences',
  SUGGESTING_ROOMS: 'suggesting_rooms',
  REVIEWING_APPLICATION: 'reviewing_application',
  CONFIRMED: 'confirmed',
};

export function getSession(userId) {
  if (!sessions.has(userId)) {
    sessions.set(userId, createEmptySession(userId));
  }
  return sessions.get(userId);
}

export function resetSession(userId) {
  sessions.set(userId, createEmptySession(userId));
  return sessions.get(userId);
}

function createEmptySession(userId) {
  return {
    userId,
    state: BookingState.IDLE,
    data: {
      checkIn: null,
      checkOut: null,
      adults: null,
      children: 0,
      childrenAges: [],
      bedPreferences: null,
      selectedRoom: null,
      guestName: null,
    },
    suggestedRooms: [],
    applicationId: null,
    updatedAt: new Date().toISOString(),
  };
}

export function updateSession(userId, patch) {
  const session = getSession(userId);
  Object.assign(session, patch, { updatedAt: new Date().toISOString() });
  if (patch.data) Object.assign(session.data, patch.data);
  return session;
}

export function getNextMissingField(data) {
  if (!data.checkIn) return 'checkIn';
  if (!data.checkOut) return 'checkOut';
  if (data.adults == null) return 'adults';
  if (data.children == null) return 'children';
  if (data.children > 0 && (!data.childrenAges?.length || data.childrenAges.length < data.children)) {
    return 'childrenAges';
  }
  if (!data.bedPreferences) return 'bedPreferences';
  if (!data.selectedRoom) return 'selectedRoom';
  return null;
}
