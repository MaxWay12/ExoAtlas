# ExoAtlas

Интерактивный каталог экзопланет. На главной показана 3D-сцена с пятью лидерами рейтинга. Остальные разделы содержат топ-50 и полный каталог с поиском.

## Работа над проектом

| Папка | Что в ней |
| --- | --- |
| [frontend](frontend/) | React, TypeScript и Three.js. Интерфейс и 3D-сцена. |
| [backend](backend/) | FastAPI, PostgreSQL и Docker Compose. Импорт из NASA TAP и API. |
| [backend/catalog/team_scoring.py](backend/catalog/team_scoring.py) | Формула рейтинга команды. |
| [backend/catalog/ranking_seed.json](backend/catalog/ranking_seed.json) | Рейтинг по новой модели до первого успешного пересчёта. |

## Локальный запуск

В каталоге `backend` выполни `docker compose up --build -d`. После завершения импорта открой [приложение](http://127.0.0.1:8000/), [страницу проверки](http://127.0.0.1:8000/check) или [Swagger](http://127.0.0.1:8000/docs).

Для работы над интерфейсом запусти `npm ci` и `npm run dev` в каталоге `frontend`. Vite проксирует запросы к локальному FastAPI. Перед обновлением сайта собери фронтенд через `npm run build` и перенеси содержимое `frontend/dist` в `backend/catalog/frontend`. Эта папка содержит сборку, которую FastAPI отдаёт на VPS.

На сервере планировщик обновляет каталог и пересчитывает рейтинг в 00:00 и 12:00 по Москве. Развёртывание описано в [гайде Timeweb](backend/TIMEWEB.md).
