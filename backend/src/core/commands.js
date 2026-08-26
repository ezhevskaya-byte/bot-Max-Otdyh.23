import { includesAny, isComplexRequest } from './text-normalize.js';

const ADMIN_PHONE = '+7 918 31 500 31';

export const CONTACT_ADMIN_TEXT = `Связаться с Оксаной можно по телефону: ${ADMIN_PHONE}.`;

export const BOOKING_TEXT = [
  'Для подтверждения свободных дат и стоимости я передам информацию администратору Оксане. Она уже сможет точно проверить наличие и условия бронирования.',
  CONTACT_ADMIN_TEXT
].join('\n');

export const HOUSE_RULES_TEXT = [
  'Формат гостевого дома — спокойный семейный отдых, без шумных вечеринок.',
  'Территория закрытая: доступ только для проживающих гостей по индивидуальному коду от калитки.',
  'После 23:00 действует режим тишины, при этом заходить и выходить можно в любое время суток.',
  'Пользоваться бассейном можно с 09:00 до 21:00; дети — только под постоянным присмотром взрослых.',
  'Комнаты не предназначены для приёма пищи, для этого есть терраса.',
  'Курение разрешено только в специально отведённом месте, в комнатах курить нельзя.',
  'Размещение с животными не предусмотрено.',
  'Видеонаблюдение ведётся только в местах общего пользования.'
].join('\n');

function isDetailedBookingRequest(normalized) {
  return (
    isComplexRequest(normalized) ||
    includesAny(normalized, ['комфорт', 'делюкс', 'семейн']) ||
    /\d+\s*(взросл|дет|гост|человек)/.test(normalized) ||
    /\d{1,2}\s+\d{1,2}/.test(normalized)
  );
}

export function matchCommand(normalized) {
  if (!normalized) return null;

  if (
    includesAny(normalized, [
      'связаться с администратор',
      'свяжитесь с администратор',
      'контакт администратор',
      'номер администратор',
      'телефон оксан',
      'связаться с оксан'
    ])
  ) {
    return {
      handled: true,
      type: 'command',
      text: CONTACT_ADMIN_TEXT,
      data: { intent: 'contact_admin' }
    };
  }

  if (
    !isComplexRequest(normalized) &&
    includesAny(normalized, [
      'правила проживан',
      'правила дома',
      'какие правила',
      'ваши правила'
    ])
  ) {
    return {
      handled: true,
      type: 'command',
      text: HOUSE_RULES_TEXT,
      data: { intent: 'house_rules' }
    };
  }

  if (
    !isDetailedBookingRequest(normalized) &&
    includesAny(normalized, [
      'забронировать',
      'забронир',
      'проверить даты',
      'проверить свобод',
      'есть свободные даты',
      'есть места',
      'свободные даты',
      'сколько стоит',
      'какая цена',
      'стоимость'
    ])
  ) {
    return {
      handled: true,
      type: 'command',
      text: BOOKING_TEXT,
      data: { intent: 'booking' }
    };
  }

  return null;
}
