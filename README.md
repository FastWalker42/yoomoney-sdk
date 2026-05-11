# yoomoney-sdk

TypeScript SDK для [YooMoney Wallet API](https://yoomoney.ru/docs/wallet). Позволяет проверять платежи, просматривать историю операций и получать детали транзакций.

## Возможности

- **Информация об аккаунте** — баланс, статус, привязанные карты
- **История операций** — фильтрация по типу, лейблу, дате; пагинация
- **Детали операции** — подробная информация о конкретной транзакции
- **Проверка платежа по лейблу** — удобный метод для верификации входящих платежей
- **Последние операции** — быстрый доступ к N последним операциям

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
