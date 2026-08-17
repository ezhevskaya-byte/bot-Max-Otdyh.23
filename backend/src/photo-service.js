import { findRoomLink } from './room-links.js';

const ROOM_KEY_TO_WEBSITE_ID = {
  comfort_2floor: 'comfort',
  deluxe_2floor: 'deluxe-2',
  deluxe_3floor: 'deluxe-3',
  family_room: 'family'
};

const ROOM_PHOTO_LINKS = {
  comfort_2floor: {
    title: 'Комфорт',
    url: 'https://disk.yandex.ru/d/hBAdKQL8HKIPJw'
  },
  deluxe_2floor: {
    title: 'Делюкс 2 этаж',
    url: 'https://disk.yandex.ru/d/jcgomb8T7TPMDw'
  },
  deluxe_3floor: {
    title: 'Делюкс 3 этаж',
    url: 'https://disk.yandex.ru/d/COqWoePAFCjN8w'
  },
  family_room: {
    title: 'Семейный',
    url: 'https://disk.yandex.ru/d/CCme1Mhcy8eZzw'
  }
};

const COMFORT_SCENARIO_LINKS = {
  double_bed: {
    title: 'Комфорт — двуспальная кровать',
    url: 'https://disk.yandex.ru/d/bxVuxMoYQo-8tQ'
  },
  double_bed_baby: {
    title: 'Комфорт — двуспальная + детская кроватка',
    url: 'https://disk.yandex.ru/d/JxddVgoztH2uZg'
  },
  twin_beds: {
    title: 'Комфорт — две раздельные кровати',
    url: 'https://disk.yandex.ru/d/yRvGsMkyWjPQUQ'
  },
  twin_beds_baby: {
    title: 'Комфорт — два отдельных спальных места + детская кроватка',
    url: 'https://disk.yandex.ru/d/q-Hm0Q91N4InIA'
  },
  triple_beds: {
    title: 'Комфорт — три отдельных спальных места',
    url: 'https://disk.yandex.ru/d/b9hzpbAL47D6bg'
  }
};

export function detectRequestedRoom(text = '', lastAssistantText = '') {
  const fullText = `${text} ${lastAssistantText}`.toLowerCase();

  if (fullText.includes('комфорт')) return 'comfort_2floor';
  if (fullText.includes('делюкс') && fullText.includes('3')) return 'deluxe_3floor';
  if (fullText.includes('делюкс') && fullText.includes('2')) return 'deluxe_2floor';
  if (fullText.includes('делюкс')) return 'deluxe_2floor';
  if (fullText.includes('семейн')) return 'family_room';

  return null;
}

function detectComfortScenario(text = '') {
  const value = text.toLowerCase();

  const hasBaby =
    value.includes('детская кроватка') ||
    value.includes('кроватка') ||
    value.includes('ребёнок') ||
    value.includes('ребенок') ||
    value.includes('реб') ||
    value.includes('малыш') ||
    value.includes('дет');

  const wantsSeparateBeds =
    value.includes('раздель') ||
    value.includes('отдельн') ||
    value.includes('две кровати') ||
    value.includes('2 кровати') ||
    value.includes('два отдельных');

  const hasThreeAdults =
    value.includes('3 взрослых') ||
    value.includes('три взрослых') ||
    value.includes('трое взрослых');

  const wantsThreeBeds =
    value.includes('три отдельных') ||
    value.includes('3 отдельных') ||
    value.includes('три спальных') ||
    value.includes('3 спальных');

  if (hasBaby && (wantsSeparateBeds || wantsThreeBeds || hasThreeAdults)) {
    return COMFORT_SCENARIO_LINKS.twin_beds_baby;
  }

  if (wantsThreeBeds || hasThreeAdults) {
    return COMFORT_SCENARIO_LINKS.triple_beds;
  }

  if (hasBaby) {
    return COMFORT_SCENARIO_LINKS.double_bed_baby;
  }

  if (wantsSeparateBeds) {
    return COMFORT_SCENARIO_LINKS.twin_beds;
  }

  return COMFORT_SCENARIO_LINKS.double_bed;
}

export function getRoomPhotoLink(roomKey, text = '', lastAssistantText = '') {
  if (!roomKey) return null;

  if (roomKey === 'comfort_2floor') {
    return detectComfortScenario(`${text} ${lastAssistantText}`);
  }

  return ROOM_PHOTO_LINKS[roomKey] || null;
}

export function getAllRoomPhotoLinks() {
  return ROOM_PHOTO_LINKS;
}

export function isPhotoRequest(text = '') {
  const value = text.toLowerCase();

  return (
    value.includes('фото') ||
    value.includes('фотографии') ||
    value.includes('покажи') ||
    value.includes('показать') ||
    value.includes('посмотреть')
  );
}

function hasBabyCotRequest(value) {
  return (
    value.includes('детская кроватка') ||
    value.includes('кроватка') ||
    value.includes('малыш')
  );
}

function hasThreeGuests(value) {
  return (
    value.includes('3 взрослых') ||
    value.includes('три взрослых') ||
    value.includes('трое взрослых') ||
    value.includes('три отдельных') ||
    value.includes('3 отдельных') ||
    value.includes('три спальных') ||
    value.includes('3 спальных') ||
    value.includes('троих') ||
    value.includes('трёхмест') ||
    value.includes('трехмест') ||
    value.includes('3 гост') ||
    value.includes('три гост') ||
    value.includes('трое гост') ||
    value.includes('трёх человек') ||
    value.includes('трех человек')
  );
}

function hasFourGuests(value) {
  return (
    value.includes('4 гост') ||
    value.includes('четыре гост') ||
    value.includes('четверо') ||
    value.includes('четырёх гост') ||
    value.includes('четырех гост') ||
    value.includes('4 человек') ||
    value.includes('четыре человек') ||
    value.includes('4 взросл') ||
    value.includes('четыре взросл') ||
    value.includes('до четырёх гост') ||
    value.includes('до четырех гост') ||
    value.includes('до 4 гост')
  );
}

function hasFiveGuests(value) {
  return (
    value.includes('5 гост') ||
    value.includes('пять гост') ||
    value.includes('пятеро') ||
    value.includes('5 человек') ||
    value.includes('пять человек') ||
    value.includes('до пяти гост') ||
    value.includes('до 5 гост')
  );
}

function detectComfortWebsiteScenario(value) {
  if (hasBabyCotRequest(value)) return 'comfort-cot';
  if (hasThreeGuests(value)) return 'comfort-3';
  return 'comfort-2';
}

function detectDeluxeWebsiteScenario(value) {
  if (hasFourGuests(value)) return '4-guests';
  return '2-3-guests';
}

function detectFamilyWebsiteScenario(value) {
  if (hasFiveGuests(value)) return '5-guests';
  if (hasFourGuests(value) || hasThreeGuests(value)) return '3-4-guests';
  return '2-guests';
}

export function resolveWebsiteScenario(roomKey, text = '', lastAssistantText = '') {
  const roomId = ROOM_KEY_TO_WEBSITE_ID[roomKey];
  if (!roomId) return null;

  const value = `${text} ${lastAssistantText}`.toLowerCase();

  if (roomKey === 'comfort_2floor') {
    return { roomId, scenarioId: detectComfortWebsiteScenario(value) };
  }

  if (roomKey === 'deluxe_2floor' || roomKey === 'deluxe_3floor') {
    return { roomId, scenarioId: detectDeluxeWebsiteScenario(value) };
  }

  if (roomKey === 'family_room') {
    return { roomId, scenarioId: detectFamilyWebsiteScenario(value) };
  }

  return null;
}

export function getWebsiteRoomLink(roomKey, text = '', lastAssistantText = '') {
  const resolved = resolveWebsiteScenario(roomKey, text, lastAssistantText);
  if (!resolved) return null;

  return findRoomLink(resolved.roomId, resolved.scenarioId);
}