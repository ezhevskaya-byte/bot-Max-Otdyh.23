/**
 * Первое сообщение AI в диалоге — с коротким приветствием.
 * Повторные ответы не начинают с «Здравствуйте».
 * Единая точка применения: attachFirstContactGreeting (MAX processUpdate + тесты).
 */

export function isFirstAssistantReply(history = []) {
  return !Array.isArray(history)
    ? true
    : !history.some((message) => message?.role === 'assistant');
}

function alreadyHasGreeting(text) {
  const trimmed = String(text || '').trim();
  return /^(здравствуйте|здравстуйте|добрый\s+день|доброе\s+утро|добрый\s+вечер|привет)(?![а-яё])/iu.test(
    trimmed
  );
}

/**
 * Добавляет «Здравствуйте!» только к первому ответу AI в истории диалога.
 */
export function withFirstContactGreeting(text, history = []) {
  const body = String(text || '').trim();
  if (!body) return body;
  if (!isFirstAssistantReply(history)) return body;
  if (alreadyHasGreeting(body)) return body;
  return `Здравствуйте! ${body}`;
}

/**
 * Единый wrapper для исходящего route-результата.
 * Не дублирует приветствие, если оно уже есть в тексте.
 */
export function attachFirstContactGreeting(result, history = []) {
  if (!result || result.text == null || result.text === '') return result;
  return {
    ...result,
    text: withFirstContactGreeting(result.text, history)
  };
}
