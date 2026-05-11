# yoomoney-sdk

TypeScript SDK для [YooMoney Wallet API](https://yoomoney.ru/docs/wallet). Позволяет проверять платежи, просматривать историю операций и получать детали транзакций.

## Возможности

- **Информация об аккаунте** — баланс, статус, привязанные карты
- **История операций** — фильтрация по типу, лейблу, дате; пагинация
- **Детали операции** — подробная информация о конкретной транзакции
- **Проверка платежа по лейблу** — удобный метод для верификации входящих платежей
- **Последние операции** — быстрый доступ к N последним операциям

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

Выполните в терминале (подставьте свои значения):

```bash
curl -X POST https://yoomoney.ru/oauth/token \
  -d "code=ВАШ_CODE&client_id=ВАШ_CLIENT_ID&grant_type=authorization_code&redirect_uri=https://ваш-домен.com&client_secret=ВАШ_CLIENT_SECRET"
```

В ответе получите `access_token` — это и есть ваш токен:

```json
{"access_token":"4100XXXX.XXXXXXXX..."}
```

Сохраните его. Токен **бессрочный** — он не истекает, пока вы не отзовёте доступ или не запросите авторизацию повторно.

### Шаг 4. Проверка

```bash
YOOMONEY_TOKEN="ваш_access_token" npm run example:account
```

Если всё правильно — увидите информацию о вашем кошельке.

---

## Быстрый старт

```bash
git clone https://github.com/FastWalker42/yoomoney-sdk.git
cd yoomoney-sdk
npm install
npm run build
```

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
```

## Примеры

Для запуска примеров установите переменную окружения `YOOMONEY_TOKEN`:

```bash
# Информация об аккаунте
YOOMONEY_TOKEN=<token> npm run example:account

# Последние операции
YOOMONEY_TOKEN=<token> npm run example:history

# Детали операции
YOOMONEY_TOKEN=<token> npm run example:details <operation_id>

# Проверка платежа по лейблу
YOOMONEY_TOKEN=<token> npm run example:check <label>
```

## Тесты

```bash
npm test
```

## API

### `new YooMoneyClient(options)`

| Параметр | Тип | Описание |
|---|---|---|
| `token` | `string` | OAuth-токен с нужными правами |
| `baseUrl` | `string` | Базовый URL (по умолчанию `https://yoomoney.ru`) |
| `timeout` | `number` | Таймаут запроса в мс (по умолчанию `10000`) |

### Методы

| Метод | Описание |
|---|---|
| `getAccountInfo()` | Информация об аккаунте |
| `getOperationHistory(params?)` | Страница истории операций |
| `getOperationHistoryAll(params?)` | AsyncGenerator по всей истории |
| `getOperationDetails({ operation_id })` | Детали операции |
| `checkPaymentByLabel(label)` | Проверка входящего платежа по лейблу |
| `getRecentOperations(count?)` | Последние N операций |

## Лицензия

MIT
