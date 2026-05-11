# yoomoney-sdk

Runtime-agnostic TypeScript SDK для [YooMoney Wallet API](https://yoomoney.ru/docs/wallet).

Работает с **Node.js 18+**, **Bun**, **Deno** — использует только Web API (`fetch`, `crypto.subtle`, `URLSearchParams`), без привязки к конкретному рантайму.

## Возможности

- **Информация об аккаунте** — баланс, статус, привязанные карты
- **История операций** — фильтрация по типу, лейблу, дате; автопагинация
- **Детали операции** — подробная информация о транзакции
- **Проверка платежа по лейблу** — верификация входящих платежей
- **Ожидание платежа** — поллинг до появления платежа с заданным лейблом
- **Генерация ссылок на оплату** — URL и HTML-форма для quickpay
- **Верификация вебхуков** — HMAC-SHA256 проверка подписи уведомлений

## Получение токена

Для работы с API нужен OAuth-токен YooMoney. Вот как его получить:

### Шаг 1. Регистрация приложения

Перейдите на страницу регистрации: https://yoomoney.ru/myservices/new

Заполните форму:

| Поле | Что указать |
|---|---|
| **Название** | Любое, например `My App` |
| **Redirect URI** | **Рабочий домен**, который вы контролируете (например `https://example.com`). Не используйте `localhost` или несуществующие домены — редирект не сработает и вы не получите code. |
| **Почта для связи** | Ваш email |

> **Важно:** Redirect URI должен быть реальным доменом, на который браузер сможет перейти. После авторизации YooMoney перенаправит вас на этот адрес с параметром `code` в URL — вам нужно будет скопировать его из адресной строки.

Нажмите **Подтвердить**. Вы получите `client_id` и `client_secret` — сохраните их.

### Шаг 2. Авторизация (получение code)

Откройте в браузере ссылку, подставив ваш `client_id` и `redirect_uri`:

```
https://yoomoney.ru/oauth/authorize?client_id=ВАШ_CLIENT_ID&response_type=code&redirect_uri=https://ваш-домен.com&scope=account-info%20operation-history%20operation-details
```

- Залогиньтесь в YooMoney и разрешите доступ приложению.
- Браузер перенаправит вас на `https://ваш-домен.com?code=XXXXXXXXX`.
- Скопируйте значение `code` из адресной строки.

### Шаг 3. Обмен code на токен

```bash
curl -X POST https://yoomoney.ru/oauth/token \
  -d "code=ВАШ_CODE&client_id=ВАШ_CLIENT_ID&grant_type=authorization_code&redirect_uri=https://ваш-домен.com&client_secret=ВАШ_CLIENT_SECRET"
```

В ответе получите `access_token`:

```json
{"access_token":"4100XXXX.XXXXXXXX..."}
```

Токен **бессрочный** — действует пока не отзовёте доступ или не запросите авторизацию повторно.

---

## Быстрый старт

### Node.js

```bash
git clone https://github.com/FastWalker42/yoomoney-sdk.git
cd yoomoney-sdk
npm install
npm run build
```

### Bun

```bash
git clone https://github.com/FastWalker42/yoomoney-sdk.git
cd yoomoney-sdk
bun install
```

Bun нативно исполняет TypeScript, сборка не нужна.

---

## Использование

```typescript
import { YooMoneyClient } from "yoomoney-sdk";

const client = new YooMoneyClient({
  token: "your_oauth_token",
});

// Последние 10 операций
const operations = await client.getRecentOperations(10);

// Проверить платёж по лейблу
const result = await client.checkPaymentByLabel("order-42");
if (result.found) {
  console.log("Платёж найден!", result.operations);
}

// Информация об аккаунте
const info = await client.getAccountInfo();
console.log(`Баланс: ${info.balance}`);

// Детали операции
const details = await client.getOperationDetails({
  operation_id: "1234567",
});

// Итерация по всей истории (автопагинация)
for await (const op of client.getOperationHistoryAll({ type: "deposition" })) {
  console.log(op.title, op.amount);
}

// Ожидание платежа (поллинг, таймаут 5 минут)
const ops = await client.waitForPayment("order-42", {
  timeoutMs: 300_000,
  intervalMs: 5_000,
});
```

---

## Генерация ссылок на оплату

Создавайте ссылки на оплату через YooMoney quickpay. Указывайте `label` чтобы потом идентифицировать платёж.

```typescript
import { generatePaymentLink, generatePaymentForm } from "yoomoney-sdk";

// Ссылка — открывается в браузере, пользователь сразу видит форму оплаты
const link = generatePaymentLink({
  receiver: "4100118425529732",  // ваш кошелёк
  sum: 500,                      // сумма списания с отправителя
  label: "order-123",            // уникальный ID для идентификации
  paymentType: "AC",             // AC = карта, PC = кошелёк
  successURL: "https://example.com/thanks",
});
console.log(link);

// HTML-форма для встраивания на сайт
const html = generatePaymentForm({
  receiver: "4100118425529732",
  sum: 500,
  label: "order-123",
});
```

---

## Проверка платежей — как это работает

YooMoney не передаёт «memo» или произвольный комментарий от отправителя при проверке. Вместо этого используется механизм **label** — уникальная метка, которую вы задаёте при создании ссылки на оплату.

### Схема работы

```
1. Генерируете ссылку на оплату с уникальным label (например, order-123)
2. Отправитель переходит по ссылке и оплачивает
3. Проверяете платёж одним из двух способов:
   а) Поллинг — периодически запрашиваете историю с фильтром по label
   б) Вебхук — YooMoney отправляет POST на ваш сервер при поступлении перевода
```

### Способ 1: Поллинг (простой)

```typescript
import { YooMoneyClient, generatePaymentLink } from "yoomoney-sdk";

const client = new YooMoneyClient({ token: "..." });
const label = `order-${Date.now()}`;

// Генерируем ссылку
const link = generatePaymentLink({
  receiver: "4100118425529732",
  sum: 100,
  label,
});
console.log("Отправьте пользователю:", link);

// Ждём оплату (поллинг каждые 5 секунд, таймаут 5 минут)
try {
  const ops = await client.waitForPayment(label, {
    timeoutMs: 300_000,
    intervalMs: 5_000,
  });
  console.log("Оплата получена!", ops[0].amount);
} catch {
  console.log("Таймаут — оплата не поступила");
}
```

### Способ 2: Вебхук (мгновенный)

YooMoney отправляет HTTP POST на ваш сервер при каждом входящем переводе.

1. Настройте Notification URL в [настройках приложения](https://yoomoney.ru/transfer/myservices/http-notification)
2. Обрабатывайте уведомления:

```typescript
import {
  parseNotification,
  verifyNotificationSignature,
} from "yoomoney-sdk";

// В вашем HTTP-сервере (Express, Hono, Bun.serve и т.д.)
async function handleWebhook(requestBody: string) {
  const notification = parseNotification(requestBody);

  // Проверяем подпись (HMAC-SHA256)
  const isValid = await verifyNotificationSignature(
    notification,
    "ваш_секрет_из_настроек_уведомлений",
  );

  if (!isValid) {
    return { status: 403, body: "Invalid signature" };
  }

  // Идентифицируем платёж по label
  console.log(`Получен платёж: ${notification.amount} руб.`);
  console.log(`Label: ${notification.label}`);
  console.log(`От: ${notification.sender}`);

  return { status: 200, body: "OK" };
}
```

### Как идентифицировать кто заплатил без memo

YooMoney не поддерживает произвольное «memo» от отправителя. Вместо этого:

1. **Label** — ваш главный инструмент. При генерации ссылки задаёте уникальный label (например `user-42-topup` или `order-abc`). Этот label привязан к ссылке и возвращается при проверке платежа.

2. **Sender** — номер кошелька отправителя (приходит в notification и в operation-details). Если отправитель платит с карты — поле пустое.

3. **Amount** — если каждому пользователю выставлять уникальную сумму (например, +0.01 * userId), можно идентифицировать по сумме. Ненадёжный метод, только как запасной.

**Рекомендуемый паттерн:** каждому пользователю генерируете уникальную ссылку со своим `label`. Проверяете по `label` — это 100% надёжно.

---

## Примеры

### Node.js (tsx)

```bash
YOOMONEY_TOKEN=<token> npx tsx examples/get-account-info.ts
YOOMONEY_TOKEN=<token> npx tsx examples/get-history.ts
YOOMONEY_TOKEN=<token> npx tsx examples/get-details.ts <operation_id>
YOOMONEY_TOKEN=<token> npx tsx examples/check-payment.ts <label>
npx tsx examples/generate-link.ts
```

### Bun

```bash
YOOMONEY_TOKEN=<token> bun examples/get-account-info.ts
YOOMONEY_TOKEN=<token> bun examples/get-history.ts
YOOMONEY_TOKEN=<token> bun examples/get-details.ts <operation_id>
YOOMONEY_TOKEN=<token> bun examples/check-payment.ts <label>
bun examples/generate-link.ts
```

## Тесты

```bash
# Node.js
npm test

# Bun
bun test
```

---

## API

### `new YooMoneyClient(options)`

| Параметр | Тип | Описание |
|---|---|---|
| `token` | `string` | OAuth-токен |
| `baseUrl` | `string` | Базовый URL (по умолчанию `https://yoomoney.ru`) |
| `timeout` | `number` | Таймаут запроса в мс (по умолчанию `10000`) |

### Методы клиента

| Метод | Описание |
|---|---|
| `getAccountInfo()` | Информация об аккаунте |
| `getOperationHistory(params?)` | Страница истории операций |
| `getOperationHistoryAll(params?)` | AsyncGenerator по всей истории |
| `getOperationDetails({ operation_id })` | Детали операции |
| `checkPaymentByLabel(label)` | Проверка входящего платежа по лейблу |
| `getRecentOperations(count?)` | Последние N операций |
| `waitForPayment(label, opts?)` | Поллинг до появления платежа с лейблом |

### Утилиты

| Функция | Описание |
|---|---|
| `generatePaymentLink(params)` | URL для оплаты через quickpay |
| `generatePaymentForm(params, buttonText?)` | HTML-форма для встраивания |
| `parseNotification(body)` | Парсинг тела вебхука |
| `verifyNotificationSignature(notification, secret)` | Проверка HMAC-SHA256 подписи |

## Лицензия

MIT
