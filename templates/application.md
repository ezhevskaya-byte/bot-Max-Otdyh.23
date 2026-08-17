# Заявка на бронирование — «Отдых23»

**Гость:** {{guestName}}
**Контакт MAX:** {{guestMaxId}}

---

## Даты
- **Заезд:** {{checkIn}}
- **Выезд:** {{checkOut}}
- **Ночей:** {{nights}}

## Гости
- **Взрослых:** {{adults}}
- **Детей:** {{children}}
{{#if childrenAges}}
- **Возраст детей:** {{childrenAges}}
{{/if}}

## Пожелания по кроватям
{{bedPreferences}}

## Выбранный вариант
**{{roomName}}** ({{roomTypeId}})
{{roomLayoutDescription}}

---

{{priceNotice}}

_Заявка создана: {{createdAt}}_
