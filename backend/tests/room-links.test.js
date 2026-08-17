import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { findRoomLink, formatRoomLinkMessage, loadRoomLinks } from '../src/room-links.js';
import {
  detectRequestedRoom,
  getWebsiteRoomLink,
  getRoomPhotoLink,
  isPhotoRequest
} from '../src/photo-service.js';

const EXPECTED_LINKS = [
  {
    room_id: 'comfort',
    scenario_id: 'comfort-2',
    title: 'Отдых вдвоём',
    feature: 'Уютный вариант для отдыха вдвоём',
    url: 'https://otdyh23.ru/?room=comfort&scenario=comfort-2#rooms'
  },
  {
    room_id: 'comfort',
    scenario_id: 'comfort-3',
    title: 'Комфортное размещение для троих',
    feature: 'Комфортное размещение для троих гостей',
    url: 'https://otdyh23.ru/?room=comfort&scenario=comfort-3#rooms'
  },
  {
    room_id: 'comfort',
    scenario_id: 'comfort-cot',
    title: 'Для семьи с малышом',
    feature: 'Подходит для семьи с малышом, возможна установка детской кроватки',
    url: 'https://otdyh23.ru/?room=comfort&scenario=comfort-cot#rooms'
  },
  {
    room_id: 'deluxe-2',
    scenario_id: '2-3-guests',
    title: 'Отдых вдвоём или втроём',
    feature: 'Уютный номер с французским балконом',
    url: 'https://otdyh23.ru/?room=deluxe-2&scenario=2-3-guests#rooms'
  },
  {
    room_id: 'deluxe-2',
    scenario_id: '4-guests',
    title: 'Для семьи до четырёх гостей',
    feature: 'Размещение для семьи до четырёх гостей с французским балконом',
    url: 'https://otdyh23.ru/?room=deluxe-2&scenario=4-guests#rooms'
  },
  {
    room_id: 'deluxe-3',
    scenario_id: '2-3-guests',
    title: 'Отдых вдвоём или втроём',
    feature: 'Номер с большим балконом и уличной мебелью',
    url: 'https://otdyh23.ru/?room=deluxe-3&scenario=2-3-guests#rooms'
  },
  {
    room_id: 'deluxe-3',
    scenario_id: '4-guests',
    title: 'Для семьи до четырёх гостей',
    feature: 'Размещение для семьи до четырёх гостей с большим балконом и зоной отдыха',
    url: 'https://otdyh23.ru/?room=deluxe-3&scenario=4-guests#rooms'
  },
  {
    room_id: 'family',
    scenario_id: '2-guests',
    title: 'Просторный отдых вдвоём',
    feature: 'Просторный вариант для двоих с отдельными зонами отдыха',
    url: 'https://otdyh23.ru/?room=family&scenario=2-guests#rooms'
  },
  {
    room_id: 'family',
    scenario_id: '3-4-guests',
    title: 'Для семьи из трёх или четырёх человек',
    feature: 'Комфортное размещение для семьи из трёх или четырёх человек',
    url: 'https://otdyh23.ru/?room=family&scenario=3-4-guests#rooms'
  },
  {
    room_id: 'family',
    scenario_id: '5-guests',
    title: 'Размещение до пяти гостей',
    feature: 'Просторное размещение до пяти гостей',
    url: 'https://otdyh23.ru/?room=family&scenario=5-guests#rooms'
  }
];

const DIALOG_CASES = [
  {
    name: 'comfort-2',
    userText: 'покажите фото комфорт',
    lastAssistantText: 'Для двоих хорошо подойдёт комната Комфорт.',
    roomKey: 'comfort_2floor',
    room_id: 'comfort',
    scenario_id: 'comfort-2'
  },
  {
    name: 'comfort-3',
    userText: 'покажите фото комфорт для троих',
    lastAssistantText: 'Для 3 гостей можно рассмотреть Комфорт.',
    roomKey: 'comfort_2floor',
    room_id: 'comfort',
    scenario_id: 'comfort-3'
  },
  {
    name: 'comfort-cot',
    userText: 'покажите фото комфорт с детской кроваткой',
    lastAssistantText: 'Для семьи с малышом в Комфорт можно поставить кроватку.',
    roomKey: 'comfort_2floor',
    room_id: 'comfort',
    scenario_id: 'comfort-cot'
  },
  {
    name: 'deluxe-2 / 2-3-guests',
    userText: 'покажите фото делюкс 2 этаж',
    lastAssistantText: 'Для двоих подойдёт Делюкс 2 этаж.',
    roomKey: 'deluxe_2floor',
    room_id: 'deluxe-2',
    scenario_id: '2-3-guests'
  },
  {
    name: 'deluxe-2 / 4-guests',
    userText: 'покажите фото делюкс 2 этаж на 4 гостей',
    lastAssistantText: 'Для семьи до 4 гостей подойдёт Делюкс 2 этаж.',
    roomKey: 'deluxe_2floor',
    room_id: 'deluxe-2',
    scenario_id: '4-guests'
  },
  {
    name: 'deluxe-3 / 2-3-guests',
    userText: 'покажите фото делюкс 3 этаж',
    lastAssistantText: 'Для двоих подойдёт Делюкс 3 этаж.',
    roomKey: 'deluxe_3floor',
    room_id: 'deluxe-3',
    scenario_id: '2-3-guests'
  },
  {
    name: 'deluxe-3 / 4-guests',
    userText: 'покажите фото делюкс 3 этаж на четыре гостя',
    lastAssistantText: 'Для семьи до 4 гостей подойдёт Делюкс 3 этаж.',
    roomKey: 'deluxe_3floor',
    room_id: 'deluxe-3',
    scenario_id: '4-guests'
  },
  {
    name: 'family / 2-guests',
    userText: 'покажите фото семейный',
    lastAssistantText: 'Для двоих можно рассмотреть Семейную комнату.',
    roomKey: 'family_room',
    room_id: 'family',
    scenario_id: '2-guests'
  },
  {
    name: 'family / 3-4-guests',
    userText: 'покажите фото семейный на 3 гостей',
    lastAssistantText: 'Для семьи из трёх человек подойдёт Семейная комната.',
    roomKey: 'family_room',
    room_id: 'family',
    scenario_id: '3-4-guests'
  },
  {
    name: 'family / 5-guests',
    userText: 'покажите фото семейный на 5 гостей',
    lastAssistantText: 'Для семьи до 5 гостей подойдёт Семейная комната.',
    roomKey: 'family_room',
    room_id: 'family',
    scenario_id: '5-guests'
  }
];

describe('room-links.json', () => {
  it('загружает 10 сценариев сайта', () => {
    const links = loadRoomLinks();
    assert.equal(links.length, 10);
  });

  for (const expected of EXPECTED_LINKS) {
    it(`находит ${expected.room_id} / ${expected.scenario_id}`, () => {
      const link = findRoomLink(expected.room_id, expected.scenario_id);
      assert.ok(link);
      assert.equal(link.title, expected.title);
      assert.equal(link.feature, expected.feature);
      assert.equal(link.url, expected.url);
      assert.ok(link.main_image);
    });
  }

  it('возвращает null, если сценария нет', () => {
    assert.equal(findRoomLink('comfort', 'unknown'), null);
    assert.equal(findRoomLink(null, 'comfort-2'), null);
  });
});

describe('сообщение со ссылкой на сайт', () => {
  it('собирает живой формат с title, feature и url', () => {
    const link = findRoomLink('comfort', 'comfort-2');
    const message = formatRoomLinkMessage(link);

    assert.equal(
      message,
      [
        'Для вашего размещения подойдёт вариант:',
        'Отдых вдвоём',
        '',
        'Преимущество:',
        'Уютный вариант для отдыха вдвоём',
        '',
        'Посмотреть фотографии и подробное описание:',
        'https://otdyh23.ru/?room=comfort&scenario=comfort-2#rooms'
      ].join('\n')
    );
    assert.equal(message.includes('disk.yandex.ru'), false);
  });
});

describe('подбор ссылки сайта после определения сценария', () => {
  for (const dialog of DIALOG_CASES) {
    it(`отправляет ссылку для ${dialog.name}`, () => {
      assert.equal(
        detectRequestedRoom(dialog.userText, dialog.lastAssistantText),
        dialog.roomKey
      );

      const link = getWebsiteRoomLink(
        dialog.roomKey,
        dialog.userText,
        dialog.lastAssistantText
      );

      assert.ok(link);
      assert.equal(link.room_id, dialog.room_id);
      assert.equal(link.scenario_id, dialog.scenario_id);
      assert.equal(link.url.includes('otdyh23.ru'), true);
      assert.equal(link.url.includes('disk.yandex.ru'), false);
      assert.ok(isPhotoRequest(dialog.userText));
    });
  }

  it('сохраняет текущий ответ, если категория не определена', () => {
    assert.equal(detectRequestedRoom('покажите фото', ''), null);
    assert.equal(getWebsiteRoomLink(null, 'покажите фото', ''), null);
  });

  it('не удаляет старые функции фотографий', () => {
    const oldLink = getRoomPhotoLink('comfort_2floor', 'фото комфорт', '');
    assert.ok(oldLink);
    assert.ok(oldLink.url.includes('disk.yandex.ru'));
  });
});
