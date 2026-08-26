import { includesAny, isAdvisoryRequest, normalizeText } from '../text-normalize.js';
import { emptyGuestProfile } from '../guest-context/profile.js';
import { buildTopicContext, SAFE_FALLBACK_TOPICS, TOPICS } from './sections.js';
import { ROOM_SECTIONS, selectRoomSections } from './rooms.js';

const ON_REQUEST_ONLY = new Set([TOPICS.BARBECUE]);

const ROOM_CATEGORY = ['комфорт', 'делюкс', 'семейн', 'комнат', 'номер'];

function hasGuestComposition(normalized, guestProfile = emptyGuestProfile()) {
  if (
    guestProfile.adults != null ||
    guestProfile.children != null ||
    guestProfile.partySize != null
  ) {
    return true;
  }
  return (
    includesAny(normalized, [
      'нас пятеро',
      'нас четверо',
      'нас трое',
      'нас двое',
      'вдвоем',
      'втроем',
      'семья из',
      'семьи из',
      'двое взрослых',
      'три взрослых',
      'трое взрослых',
      'четыре взрослых',
      'пять взрослых',
      'взрослых друз',
      'компани'
    ]) ||
    /\d+\s*(взросл|дет|гост|человек|чел)\b/.test(normalized) ||
    /\b(двое|трое|четверо|пятеро)\b/.test(normalized)
  );
}

function wantsRoomChoice(normalized) {
  return (
    isAdvisoryRequest(normalized) ||
    includesAny(normalized, [
      'выбрать',
      'что лучше',
      'какую комнат',
      'какой номер',
      'подбер',
      'посовет',
      'что взять',
      'какой вариант'
    ])
  );
}

function mentionsBabyCot(normalized, guestProfile = emptyGuestProfile()) {
  if (guestProfile.babyCot === true) return true;
  return includesAny(normalized, ['кроватк', 'манеж']);
}

function mentionsYoungChild(normalized, guestProfile = emptyGuestProfile()) {
  const ages = guestProfile.childrenAges || [];
  if (ages.some((age) => age <= 4)) return true;
  if (guestProfile.children != null && guestProfile.children > 0) {
    if (ages.length === 0 && guestProfile.babyCot === true) return true;
  }
  if (includesAny(normalized, ['малыш', 'груднич', 'младен'])) return true;
  const age = normalized.match(/ребенк[а-я]*\s+(\d+)\s*(год|года|лет|месяц)/);
  if (!age) return false;
  const years = Number(age[1]);
  const unit = age[2];
  if (unit.startsWith('месяц')) return true;
  return years <= 4;
}

function isFollowUp(normalized) {
  return (
    /^(а |и |ну )/.test(normalized) ||
    includesAny(normalized, ['туда', 'там', 'эту комнат', 'этот номер', 'в эту', 'в этот'])
  );
}

function mentionsBarbecue(normalized) {
  return includesAny(normalized, [
    'мангал',
    'шашлык',
    'шашлыч',
    'барбекю',
    'гриль',
    'открыт огн',
    'открытого огня',
    'пожарить'
  ]);
}

function detectCurrentTopics(normalized, guestProfile = emptyGuestProfile()) {
  const topics = new Set();

  const sea = includesAny(normalized, [
    'моря',
    'море',
    'пляж',
    'багратион',
    'взморье',
    'касабланка',
    'микроавтобус',
    'маршрутка',
    'трансфер',
    'до моря',
    'к морю',
    'пешком'
  ]);

  const pool = includesAny(normalized, [
    'бассейн',
    'купать',
    'подогрев',
    'глубин бассейн'
  ]);

  const terrace = includesAny(normalized, [
    'террас',
    'завтрак',
    'обед',
    'ужин',
    'питание',
    'кухн',
    'плит',
    'холодильник',
    'свч',
    'микроволн',
    'термопот',
    'посуд',
    'поесть',
    'позавтракать',
    'готовить',
    'приготов',
    'чай',
    'кофе',
    'мультивар'
  ]);

  const checkin =
    includesAny(normalized, [
      'заезд',
      'заселен',
      'заселить',
      'ранний заезд',
      'поздний выезд',
      'приехать раньше',
      'выехать позже'
    ]) || /(?:^|\s)выезд(?:\s|$)/.test(normalized);

  const houseRules = includesAny(normalized, [
    'тишин',
    'курить',
    'курение',
    'видеонаблюд',
    'камер',
    'животн',
    'питомц',
    'посетител',
    'посторонн',
    'вечеринк',
    'шум',
    'громк',
    'закрыт',
    'код доступ',
    'калитка',
    'правила'
  ]);

  const contact = includesAny(normalized, [
    'телефон',
    'сайт',
    'адрес',
    'оксан',
    'эвкалиптов',
    'позвонить',
    'контакт'
  ]);

  const territory = includesAny(normalized, [
    'территори',
    'про двор',
    'на территории',
    'что есть у вас',
    'какие удобства'
  ]);

  const roomsExplicit = includesAny(normalized, [
    'комнат',
    'номер',
    'комфорт',
    'делюкс',
    'семейн',
    'балкон',
    'этаж',
    'вместим',
    'спальн',
    'размещ',
    'кроват',
    'диван'
  ]);

  if (mentionsBarbecue(normalized)) {
    topics.add(TOPICS.BARBECUE);
    if (includesAny(normalized, ['вечер', 'ночь', 'тишин', 'шум', 'территори'])) {
      topics.add(TOPICS.HOUSE_RULES);
    }
  }

  if (pool) topics.add(TOPICS.POOL);
  if (terrace) topics.add(TOPICS.TERRACE_FOOD);
  if (sea) topics.add(TOPICS.SEA_LOCATION);
  if (checkin) topics.add(TOPICS.CHECKIN);
  if (houseRules) topics.add(TOPICS.HOUSE_RULES);
  if (contact && !sea) topics.add(TOPICS.CONTACT);

  if (territory) {
    topics.add(TOPICS.POOL);
    topics.add(TOPICS.TERRACE_FOOD);
    topics.add(TOPICS.HOUSE_RULES);
  }

  const exclusiveAmenity = sea || pool || terrace || checkin || contact;
  const roomIntent =
    roomsExplicit ||
    wantsRoomChoice(normalized) ||
    (hasGuestComposition(normalized, guestProfile) && !exclusiveAmenity);

  if (roomIntent && !territory) {
    topics.add(TOPICS.ROOMS);
  }

  if (
    mentionsBabyCot(normalized, guestProfile) ||
    (topics.has(TOPICS.ROOMS) && mentionsYoungChild(normalized, guestProfile))
  ) {
    topics.add(TOPICS.BABY_COT);
    topics.add(TOPICS.ROOMS);
  }

  if (topics.has(TOPICS.ROOMS)) {
    const specificCotOnly =
      mentionsBabyCot(normalized, guestProfile) &&
      !wantsRoomChoice(normalized) &&
      !includesAny(normalized, ['хотим', 'большой балкон', 'простор', 'выбрать']);
    if (!specificCotOnly) {
      if (
        wantsRoomChoice(normalized) ||
        includesAny(normalized, ['хотим', 'большой балкон', 'простор']) ||
        (hasGuestComposition(normalized, guestProfile) &&
          !mentionsBabyCot(normalized, guestProfile))
      ) {
        topics.add(TOPICS.SALES);
      }
    }
  }

  return topics;
}

function historyText(conversationContext = {}) {
  const messages = conversationContext.messages || [];
  const lastAssistantText = conversationContext.lastAssistantText || '';
  return normalizeText(
    [
      ...messages.map((message) => message.content || ''),
      lastAssistantText
    ].join(' ')
  );
}

function applyConversationContext(topics, normalized, conversationContext = {}) {
  const previousTopics = conversationContext.previousTopics || [];
  const historyNorm = historyText(conversationContext);
  const followUp = isFollowUp(normalized);

  if (topics.has(TOPICS.BABY_COT) && includesAny(historyNorm, ROOM_CATEGORY)) {
    topics.add(TOPICS.ROOMS);
  }

  if (!followUp && previousTopics.length === 0) {
    return topics;
  }

  const carry = followUp || (normalized.length < 48 && previousTopics.length > 0);

  if (carry) {
    for (const topic of previousTopics) {
      if (ON_REQUEST_ONLY.has(topic)) {
        if (mentionsBarbecue(normalized) || mentionsBarbecue(historyNorm)) {
          topics.add(topic);
        }
        continue;
      }
      topics.add(topic);
    }
  }

  if (mentionsBabyCot(normalized) && previousTopics.includes(TOPICS.ROOMS)) {
    topics.add(TOPICS.ROOMS);
    topics.add(TOPICS.BABY_COT);
  }

  return topics;
}

/**
 * Channel-independent knowledge retrieval.
 * Не знает про MAX, Telegram, VK, HTTP и polling.
 *
 * @param {{ text?: string, conversationContext?: {
 *   messages?: Array<{role: string, content: string}>,
 *   previousTopics?: string[],
 *   previousRoomSections?: string[],
 *   lastAssistantText?: string,
 *   guestProfile?: object
 * } }} input
 */
export function retrieveKnowledge({ text, conversationContext = {} } = {}) {
  const normalized = normalizeText(text);
  const guestProfile = conversationContext.guestProfile || emptyGuestProfile();
  const matched = detectCurrentTopics(normalized, guestProfile);
  applyConversationContext(matched, normalized, conversationContext);

  const confident = matched.size > 0;
  const selected = confident ? [...matched] : [...SAFE_FALLBACK_TOPICS];
  const topics = [...new Set(selected)].filter(
    (topic) => confident || topic !== TOPICS.BARBECUE
  );

  const ordered = [
    TOPICS.ROOMS,
    TOPICS.BABY_COT,
    TOPICS.POOL,
    TOPICS.TERRACE_FOOD,
    TOPICS.SEA_LOCATION,
    TOPICS.HOUSE_RULES,
    TOPICS.CHECKIN,
    TOPICS.SALES,
    TOPICS.BARBECUE,
    TOPICS.CONTACT
  ].filter((topic) => topics.includes(topic));

  const followUp = isFollowUp(normalized);
  const previousRoomSections = conversationContext.previousRoomSections || [];
  const roomQuery =
    followUp && previousRoomSections.length === 0
      ? `${normalized} ${historyText(conversationContext)}`.trim()
      : normalized;
  const roomSections = ordered.includes(TOPICS.ROOMS)
    ? selectRoomSections({
        normalized: roomQuery,
        guestProfile,
        previousRoomSections,
        followUp,
        lowConfidence: !confident
      })
    : [];

  const context = buildTopicContext(ordered, { roomSections });

  return {
    topics: ordered,
    roomSections,
    context,
    fallback: !confident,
    diagnostic: {
      confident,
      knowledgeChars: context.length,
      roomSections,
      onRequestOnly: ordered.filter((topic) => ON_REQUEST_ONLY.has(topic))
    }
  };
}

export { TOPICS, SAFE_FALLBACK_TOPICS, ROOM_SECTIONS };
