/**
 * In-memory guest context.
 * Ключ — { channel, guestId }. Core не знает про MAX API, Telegram, VK, HTTP.
 */

import {
  emptyGuestProfile,
  extractGuestFacts,
  isGuestProfileEmpty,
  mergeGuestProfile
} from './profile.js';

const store = new Map();

export function guestContextKey(channel, guestId) {
  const ch = String(channel || '').trim();
  const id = String(guestId || '').trim();
  if (!ch || !id) return null;
  return `${ch}:${id}`;
}

function blankRecord() {
  return {
    profile: emptyGuestProfile(),
    previousTopics: [],
    previousRoomSections: []
  };
}

export function getGuestRecord(channel, guestId) {
  const key = guestContextKey(channel, guestId);
  if (!key) return blankRecord();
  return store.get(key) || blankRecord();
}

export function getGuestProfile(channel, guestId) {
  return getGuestRecord(channel, guestId).profile;
}

export function saveGuestRecord(channel, guestId, patch = {}) {
  const key = guestContextKey(channel, guestId);
  if (!key) return blankRecord();
  const current = getGuestRecord(channel, guestId);
  const next = {
    profile: patch.profile ? mergeGuestProfile(current.profile, patch.profile) : current.profile,
    previousTopics:
      patch.previousTopics != null ? [...patch.previousTopics] : current.previousTopics,
    previousRoomSections:
      patch.previousRoomSections != null
        ? [...patch.previousRoomSections]
        : current.previousRoomSections
  };
  store.set(key, next);
  return next;
}

export function rememberGuestMessage({ channel, guestId, text } = {}) {
  const facts = extractGuestFacts(text);
  if (!guestContextKey(channel, guestId)) {
    return mergeGuestProfile(emptyGuestProfile(), facts);
  }
  return saveGuestRecord(channel, guestId, { profile: facts }).profile;
}

export function resolveGuestProfile({
  channel,
  guestId,
  text = '',
  history = []
} = {}) {
  let profile = getGuestProfile(channel, guestId);

  if (isGuestProfileEmpty(profile) && Array.isArray(history)) {
    for (const message of history) {
      if (message?.role === 'user') {
        profile = mergeGuestProfile(profile, extractGuestFacts(message.content));
      }
    }
  }

  profile = mergeGuestProfile(profile, extractGuestFacts(text));

  if (guestContextKey(channel, guestId)) {
    saveGuestRecord(channel, guestId, { profile });
  }

  return profile;
}

export function rememberRetrieval({
  channel,
  guestId,
  topics = [],
  roomSections = []
} = {}) {
  if (!guestContextKey(channel, guestId)) return;
  saveGuestRecord(channel, guestId, {
    previousTopics: topics,
    previousRoomSections: roomSections
  });
}

export function clearGuestContexts() {
  store.clear();
}

export { emptyGuestProfile, isGuestProfileEmpty };
