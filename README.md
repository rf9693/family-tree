# 🌳 Древо рода

Семейное древо, которое семья ведёт вместе: карточки людей на холсте, связи «родитель–ребёнок», «супруги», «братья/сёстры», фото, заметки, поиск, импорт и экспорт JSON/GEDCOM, отмена/повтор и общий журнал изменений. Изменения видны всем участникам в реальном времени.

Стек: Vite + React 18 + TypeScript, Supabase (Auth, Postgres, Realtime), деплой на Vercel.

## Роли

- **Владелец** — может всё, включая удаление любых записей и импорт.
- **Участник** — добавляет и редактирует людей и связи, удаляет только то, что добавил сам.

Права проверяются в базе (RLS-политики в `supabase/migrations`), а не только в интерфейсе.

## Запуск

Нужен Node.js 20 (`nvm use`).

```sh
npm ci
cp .env.example .env.local   # укажите URL и anon key своего проекта Supabase
npm run dev
```

Без `.env.local` приложение подключается к проекту по умолчанию из `src/lib/supabase.ts`.

## Настройка Supabase

1. Откройте Supabase Dashboard → SQL Editor.
2. В файле `supabase/migrations/20261006000000_schema_rls.sql` укажите e-mail владельца (по умолчанию `rf9339945@gmail.com`, встречается дважды).
3. Выполните файл целиком. Скрипт идемпотентный: создаёт недостающие таблицы и колонки, включает RLS, заменяет политики, добавляет триггеры (создание профиля при регистрации, защита поля `role` и `created_by`) и подключает таблицы к Realtime.

## Команды

| Команда | Что делает |
| --- | --- |
| `npm run dev` | dev-сервер |
| `npm run build` | production-сборка в `dist/` |
| `npm run lint` | ESLint |
| `npm run typecheck` | проверка типов TypeScript |
| `npm test` | unit-тесты (Vitest) |

## Структура

- `src/store/commands.ts` — обратимые команды (основа отмены/повтора и сохранения в базу)
- `src/store/AppContext.tsx` — состояние дерева и `applyOps`
- `src/hooks/useSupabaseSync.ts` — загрузка, сохранение и realtime-подписка
- `src/hooks/useUndo.ts` — стек отмены/повтора
- `src/utils/gedcom.ts`, `src/utils/json.ts` — импорт и экспорт
- `supabase/migrations/` — схема базы и правила доступа
