import { profileSearchText, guestPartySize } from './core/guest-context/profile.js';
import { needsGuestCompositionClarification } from './core/guest-context/composition-gate.js';
import { formatCategoryUrlsForHint } from './core/channel/room-urls.js';
import { normalizeText } from './core/text-normalize.js';

const CATEGORY_CAPACITY = {
  comfort: 3,
  deluxe: 4,
  family: 5
};

const CATEGORY_LABELS = {
  comfort: 'Комфорт',
  deluxe: 'Делюкс',
  family: 'Семейная'
};

function detectGuestChosenCategory(userText = '', guestProfile = null) {
  if (guestProfile?.selectedRoom) return guestProfile.selectedRoom;

  const t = normalizeText(userText);
  if (!t) return null;

  const asksCompare = /чем отлича|отличает|сравн|разниц|что лучше/.test(t);
  if (asksCompare) return null;

  const interest =
    /хотим|хочу|подробнее|расскаж|интерес|видели|нравится|берем|берём|рассмотр|эта комнат|этот номер|про семейн|про комфорт|про делюкс|о семейн|о комфорт|о делюкс/.test(
      t
    );
  if (!interest) return null;

  const hitComfort = t.includes('комфорт');
  const hitDeluxe = t.includes('делюкс');
  const hitFamily = t.includes('семейн') || t.includes('family');
  const hits = [hitComfort, hitDeluxe, hitFamily].filter(Boolean).length;
  if (hits !== 1) return null;

  if (hitComfort) return 'comfort';
  if (hitDeluxe) return 'deluxe';
  if (hitFamily) return 'family';
  return null;
}

function detectComparisonRequest(userText = '') {
  return /чем отлича|отличает|сравн|разниц/.test(normalizeText(userText));
}

export function buildRoomSelectionHint(userText, history = [], guestProfile = null) {
    const fullText = [
      ...history.map((m) => m.content || ''),
      userText || '',
      profileSearchText(guestProfile)
    ].join(' ').toLowerCase();
  
    const hasTwoAdults =
      fullText.includes('двое взрослых') ||
      fullText.includes('2 взрослых') ||
      fullText.includes('два взрослых');
  
    const hasOneChild =
      fullText.includes('ребёнок') ||
      fullText.includes('ребенок') ||
      fullText.includes('один ребёнок') ||
      fullText.includes('один ребенок');
  
    const childSix =
      fullText.includes('6 лет') ||
      fullText.includes('шесть лет');
  
    const asksCheaper =
      fullText.includes('дешевле') ||
      fullText.includes('поменьше') ||
      fullText.includes('компактнее') ||
      fullText.includes('комфорт') ||
      fullText.includes('почему не комфорт');
  
    const asksPhoto =
      fullText.includes('фото') ||
      fullText.includes('фотографии') ||
      fullText.includes('покажи') ||
      fullText.includes('показать') ||
      fullText.includes('посмотреть');

    const wantsCot =
      fullText.includes('кроватка') ||
      fullText.includes('детская кроватка');

    const deluxeMentioned =
      fullText.includes('делюкс');

    const fourGuests =
      fullText.includes('четверо') ||
      fullText.includes('4 гост') ||
      fullText.includes('четыре гост') ||
      fullText.includes('нас 4') ||
      fullText.includes('нас четверо') ||
      guestProfile?.partySize === 4;

    const fourAdults =
      fullText.includes('4 взрослых') ||
      fullText.includes('четыре взрослых') ||
      fullText.includes('четверо взрослых') ||
      fullText.includes('четыре взросл') ||
      (guestProfile?.adults === 4 &&
        (guestProfile?.children == null || guestProfile?.children === 0));

    const fiveGuests =
      fullText.includes('пятеро') ||
      fullText.includes('5 гост') ||
      fullText.includes('пять гост') ||
      fullText.includes('нас 5') ||
      fullText.includes('нас пятеро');

    const familyContext =
      fullText.includes('семь') ||
      fullText.includes('семьи') ||
      fullText.includes('семьёй') ||
      fullText.includes('семьей') ||
      fullText.includes('дети') ||
      fullText.includes('ребён') ||
      fullText.includes('ребен') ||
      guestProfile?.groupType === 'family';

    const adultFriends =
      fullText.includes('друз') ||
      fullText.includes('взрослых друз') ||
      fullText.includes('компани') ||
      guestProfile?.groupType === 'friends' ||
      (fullText.includes('взрослых') && !familyContext);

    const wantsTogether =
      fullText.includes('вместе') ||
      fullText.includes('в одном') ||
      fullText.includes('один номер') ||
      fullText.includes('одну комнат') ||
      fullText.includes('все в одной');

    const oneFamilyFourAdults =
      guestProfile?.groupType === 'family' ||
      fullText.includes('одна семья') ||
      fullText.includes('одной семь') ||
      fullText.includes('родител') ||
      fullText.includes('родствен') ||
      fullText.includes('взрослые дети') ||
      fullText.includes('взрослых дет') ||
      (familyContext && fourAdults && !adultFriends);

    const twoCouples =
      fullText.includes('две пары') ||
      fullText.includes('две пароч') ||
      fullText.includes('две семьи') ||
      fullText.includes('парами');

    const nonFamilyFourAdults =
      twoCouples ||
      guestProfile?.groupType === 'friends' ||
      fullText.includes('друз') ||
      fullText.includes('компани') ||
      (fourAdults && !oneFamilyFourAdults && !familyContext);

    const wantsPersonalSpace =
      fullText.includes('отдельн') ||
      fullText.includes('приват') ||
      fullText.includes('личное простран') ||
      fullText.includes('два номер') ||
      fullText.includes('две комнат');

    const largeBalcony =
      fullText.includes('балкон') &&
      (fullText.includes('больш') ||
        fullText.includes('простор') ||
        fullText.includes('посидеть') ||
        fullText.includes('мебел') ||
        fullText.includes('уличн'));

    let hint = '';

    if (needsGuestCompositionClarification(guestProfile, userText)) {
      hint += `
  ЖЁСТКАЯ ЛОГИКА СОСТАВА ГОСТЕЙ:

  Известно только общее число гостей, состав не уточнён.
  ЗАПРЕЩЕНО рекомендовать конкретную категорию комнаты.
  Сначала спроси: взрослые или с детьми, и если есть дети — их возраст.
  Не превращай ответ в анкету — один короткий уточняющий вопрос.
  `;
    }

    const chosenCategory = detectGuestChosenCategory(userText, guestProfile);
    const partySize = guestPartySize(guestProfile, normalizeText(userText));

    if (detectComparisonRequest(userText)) {
      hint += `
  ЖЁСТКАЯ ЛОГИКА СРАВНЕНИЯ КАТЕГОРИЙ:

  Гость сам спросил об отличиях. Сравнивай только подтверждённые факты.
  ЗАПРЕЩЕНО: «лучше», «хуже», «вам нужна/не нужна», «слишком большой/маленький».
  «Комфорт»: уютный вариант для пары или небольшой семьи (до 3 гостей).
  «Делюкс»: двуспальная кровать, удобный диван, дополнительное место, комфортная планировка (до 4 гостей).
  «Семейная»: просторная комната, две жилые зоны, размещение до 5 гостей.
  `;
    } else if (chosenCategory) {
      const label = CATEGORY_LABELS[chosenCategory];
      const maxGuests = CATEGORY_CAPACITY[chosenCategory];
      const fits =
        partySize == null || partySize <= 0 || partySize <= maxGuests;

      if (fits) {
        hint += `
  ЖЁСТКАЯ ЛОГИКА УВАЖЕНИЯ ВЫБОРА ГОСТЯ:

  Гость сам выбрал / спросил категорию «${label}».
  Она подходит по правилам размещения для известного состава.
  ОБЯЗАТЕЛЬНО: ответить именно про «${label}» — преимущества и планировку из контекста знаний.
  ЗАПРЕЩЕНО: переубеждать, переводить на другую категорию, говорить «вам лучше другая», «вам не нужна», «слишком большой/маленький номер».
  Не сравнивать с другими категориями, если гость об этом не просил.
  Можно мягко отметить комфорт для их состава, оставаясь в рамках «${label}».
  `;
      } else {
        hint += `
  ЖЁСТКАЯ ЛОГИКА КОРРЕКЦИИ ВЫБОРА ГОСТЯ:

  Гость хочет «${label}», но состав (${partySize} гост.) превышает вместимость этой категории (до ${maxGuests}).
  Мягко объяснить через комфорт, без «нельзя» / «вам не подойдёт».
  Пример тона: «Комната «${label}» рассчитана на размещение до ${maxGuests} гостей. Для вашей компании лучше рассмотреть другие варианты, чтобы всем было комфортно.»
  Затем при необходимости уточнить характер компании и предложить подходящую альтернативу.
  `;
      }
    }
  
    if (hasTwoAdults && hasOneChild && childSix) {
      hint += `
  ЖЁСТКАЯ ЛОГИКА ПОДБОРА КОМНАТЫ:
  
  Состав гостей: 2 взрослых + ребёнок 6 лет.
  
  Основной вариант, который нужно предложить первым: категория «Комфорт».
  
  Причина:
  — ребёнку 6 лет нужно отдельное спальное место;
  — категория «Комфорт» подходит для размещения до 3 гостей;
  — это наиболее логичный, сбалансированный и честный вариант для семьи из трёх человек.
  
  Нельзя предлагать «Семейную» как единственный или первый вариант только из-за слова «просторная».
  
  Правильная подача:
  — сначала предложить «Комфорт»;
  — если «Комфорт» недоступен или гость хочет альтернативу — предложить подходящий «Делюкс» через его собственные преимущества (пространство, диван);
  — «Семейную» — если нужны две зоны или ещё больший простор, не как автоматический следующий шаг.
  
  Если гость спрашивает про вариант дешевле, поменьше или почему не «Комфорт»:
  — обязательно подробно рассказать про «Комфорт»;
  — не настаивать на «Семейной»;
  — признать, что «Комфорт» действительно подходит для их состава.
  `;
    }
  
    if (asksCheaper) {
      hint += `
  ЖЁСТКАЯ ЛОГИКА ПРИ ЗАПРОСЕ БОЛЕЕ РАЦИОНАЛЬНОГО ВАРИАНТА:
  
  Гость интересуется более рациональным или недорогим вариантом.
  
  Нужно:
  — не настаивать на «Семейной»;
  — предложить «Комфорт», если состав гостей позволяет;
  — объяснить его преимущества спокойно и уверенно;
  — не создавать ощущение, что гостя уводят в более дорогую комнату.
  `;
    }
  
    if (wantsCot && deluxeMentioned && fourGuests) {
      hint += `
  ЖЁСТКАЯ ЛОГИКА ДЕТСКОЙ КРОВАТКИ:

  Не предлагать конфигурацию «Делюкс = 4 гостя + детская кроватка».
  В «Делюкс» при размещении 4 гостей кроватку не устанавливаем.
  Нужно рекомендовать «Семейную»: там кроватку установить можно.
  `;
    }

    if ((fourAdults || (fourGuests && (adultFriends || oneFamilyFourAdults || twoCouples) && !familyContext) || (fourAdults && oneFamilyFourAdults)) && !wantsCot) {
      hint += `
  ЖЁСТКАЯ ЛОГИКА ДЛЯ ЧЕТЫРЁХ ВЗРОСЛЫХ:

  Количество гостей само по себе не достаточный критерий. Учитывать характер компании.

  1) ОДНА СЕМЬЯ (родители + взрослые дети, родственники, привыкли отдыхать вместе):
  — можно рекомендовать «Семейную» как комфортный вариант: две отдельные жилые зоны, больше пространства, размещение всем вместе;
  — другие варианты — по пожеланиям гостя.

  2) НЕ ОДНА СЕМЬЯ (две пары, друзья, взрослые без семейной связи):
  — ЗАПРЕЩЕНО рекомендовать один «Делюкс» первым вариантом.
  Приоритет:
  1. Две отдельные комнаты — больше личного пространства; у каждой пары/гостей свой санузел; комфортнее при разном режиме отдыха.
  2. «Семейная», если хотят проживать вместе — две жилые зоны, можно разделить пространство.
  3. «Делюкс» только как компромисс: хотят именно один номер; нужен вариант без двух зон; другие варианты не подходят по бюджету или пожеланиям.

  Если характер компании ещё неясен — мягко уточни одной фразой: одна семья или, например, две пары / друзья. Не превращай в анкету.

  ЗАПРЕЩЕНО: «вам будет неудобно», «вам нельзя», «вам не подойдёт».
  Объяснять через заботу о комфорте: «обычно для такой компании удобнее…», «чтобы у каждого было своё пространство…», «для более комфортного отдыха…».
  `;

      if (oneFamilyFourAdults) {
        hint += `
  Уточнение: это одна семья → можно вести с «Семейной» (две зоны), другие варианты по пожеланиям.
  `;
      }

      if (nonFamilyFourAdults || wantsPersonalSpace) {
        hint += `
  Уточнение: не одна семья / важна приватность → первым вариантом две комнаты, не один «Делюкс».
  `;
      }

      if (wantsTogether && !wantsPersonalSpace) {
        hint += `
  Уточнение: хотят один общий номер → «Семейная» (две жилые зоны); «Делюкс» — только компромисс.
  `;
      }
    }

    if (fiveGuests && familyContext) {
      hint += `
  ЖЁСТКАЯ ЛОГИКА СЕМЕЙНОЙ ДО 5 ГОСТЕЙ:

  Фактическая вместимость «Семейной» — до 5 гостей.
  Если 4–5 гостей являются одной семьёй, включая семью со взрослыми детьми, «Семейная» может быть хорошим вариантом.
  `;
    }

    if (fiveGuests && adultFriends) {
      hint += `
  ЖЁСТКАЯ ЛОГИКА ДЛЯ КОМПАНИИ ВЗРОСЛЫХ:

  Не утверждать, что «Семейная» не вмещает пять гостей и не отказывать автоматически.
  Мягко предложить две комнаты как более комфортный вариант: больше личного пространства и удобнее для компании взрослых.
  `;
    }

    if (largeBalcony) {
      hint += `
  ЖЁСТКАЯ ЛОГИКА БАЛКОНА:

  Если гость явно просит большой балкон, просторный балкон, возможность посидеть на балконе или балкон с мебелью — предпочтение «Делюкс», 3 этаж.
  Сценарий по количеству гостей выбирать отдельно.
  Не придумывать других различий между «Делюкс» 2 и 3 этажа, кроме балкона.
  `;
    }

    if (asksPhoto) {
      hint += `
  ЖЁСТКАЯ ЛОГИКА ПРИ ЗАПРОСЕ ФОТОГРАФИЙ И ССЫЛОК:
  
  Если гость просит фото, фотографии, ссылку, показать комнату или посмотреть подробнее:
  
  ЗАПРЕЩЕНО писать:
  — «не могу отправить фотографии»;
  — «фотографии недоступны»;
  — «автоматическая отправка невозможна»;
  — «я не могу отправить напрямую»;
  — любые технические ограничения;
  — Markdown-ссылки вида [текст](url);
  — общую главную страницу, если в диалоге уже обсуждали конкретную категорию.
  
  Нужно отвечать так, будто фото доступны через понятный гостю способ.
  Давай только чистый URL конкретной категории/сценария.
  
  ${formatCategoryUrlsForHint()}
  
  Пример для «Комфорт»:
  «Конечно. Вот фотографии категории „Комфорт“:
  ЧИСТЫЙ_URL_КОНКРЕТНОЙ_КАТЕГОРИИ
  
  Если хотите, я также могу подсказать, насколько этот вариант подойдёт именно вашему составу гостей.»
  
  Важно:
  — не разрушать продажный тон;
  — не уходить в технические объяснения;
  — не писать извинения за невозможность отправки;
  — не спрашивать заново, какую комнату показать, если она уже была предложена.
  `;
    }
  
    return hint;
  }