# Размещение каталога в Timeweb Cloud

Проект запускается на облачном сервере Timeweb Cloud. FastAPI отдаёт тестовую страницу и API с одного домена. Caddy принимает HTTP и HTTPS и передаёт запросы FastAPI. PostgreSQL доступен внутри сети Compose.

## 1. Подготовь сервер и домен

1. В панели Timeweb Cloud открой «Облачные серверы» и создай сервер с публичным IPv4. Можно выбрать образ Docker из маркетплейса. В руководстве ниже предполагается Linux с установленным Docker Compose. [Создание сервера](https://timeweb.cloud/docs/cloud-servers/manage-servers/create-server)
2. Создай DNS-запись типа **A** для домена или поддомена, например `planets.example.ru`, и укажи публичный IPv4 сервера. Если DNS управляется у другого провайдера, добавь запись там. Если у этого же имени уже есть запись AAAA, она должна указывать на IPv6 этого сервера. [Настройка DNS Timeweb Cloud](https://timeweb.cloud/docs/domains/dns-records-management)
3. Если для сервера настроен файрвол, разреши входящий TCP на портах 80 и 443. Сохрани доступ по SSH. Для базы и FastAPI публичные порты не нужны.

## 2. Скопируй проект

Распакуй `exoplanet-backend.zip` на компьютере. Из каталога, в котором появилась папка `exoplanet-backend`, выполни команды. Подставь IP своего сервера и SSH-пользователя из панели Timeweb Cloud.

```sh
scp -r exoplanet-backend root@203.0.113.10:~/
ssh root@203.0.113.10
cd ~/exoplanet-backend
docker compose version
```

На сервере проверь, что домен уже возвращает нужный IP, например через `getent ahostsv4 planets.example.ru`.

## 3. Запусти сайт

Для первого запуска на чистом сервере создай файл `.env`. В строке `SITE_HOST` укажи свой домен без `https://` и завершающего слеша. Вторая строка генерирует пароль базы в формате, пригодном для URL подключения.

```sh
umask 077
printf 'SITE_HOST=planets.example.ru\nPOSTGRES_PASSWORD=%s\n' "$(openssl rand -hex 24)" > .env
docker compose -f compose.yaml -f compose.timeweb.yaml up --build -d
```

При обновлении уже развёрнутого проекта сохрани пароль существующей базы. PostgreSQL задаёт пароль из переменной окружения только при инициализации пустого тома.

Первый запуск скачает образы и загрузит каталог NASA. FastAPI запустится после успешного импорта, а Caddy автоматически получит сертификат, когда домен указывает на сервер и доступны порты 80 и 443. [Автоматический HTTPS в Caddy](https://caddyserver.com/docs/automatic-https)

```sh
docker compose -f compose.yaml -f compose.timeweb.yaml ps -a
docker compose -f compose.yaml -f compose.timeweb.yaml logs --tail=80 importer api proxy
```

Для импортера ожидается статус `Exited (0)`. У `db`, `api` и `proxy` должен быть статус `Up`.

## 4. Проверь страницу

- Открой `https://planets.example.ru/`. На главной появится сцена с пятью лидерами рейтинга. В боковом меню открой «Топ-50» и «Все экзопланеты».
- На `/check` введи `TRAPPIST-1` в поиск и нажми «Применить». Сравни число результатов со статистикой.
- Нажми на имя планеты и на имя звезды. Должны открыться карточка с орбитальными параметрами и список планет системы.
- Открой `https://planets.example.ru/api/catalog` и проверь время импорта. Документация API доступна по `/docs`.

Если сайт отвечает `502`, проверь, запустился ли `api`, и посмотри лог импортера. Если HTTPS не поднимается, проверь DNS, порты 80 и 443 и лог `proxy`.

## Обновление

Для версии с рейтингом скопируй папку `catalog` и файлы `requirements.txt` и `compose.yaml` из нового архива в существующий каталог сервера. Сохрани текущий `.env` и том PostgreSQL. В каталоге проекта выполни:

```sh
docker compose -f compose.yaml -f compose.timeweb.yaml up --build -d
docker compose -f compose.yaml -f compose.timeweb.yaml logs --tail=60 importer scheduler
```

При проверке через SSH-туннель можно выполнить те же команды с одним `compose.yaml`. Сервис `scheduler` запрашивает NASA TAP в 00:00 и 12:00 по Москве. Проверить источник и время пересчёта можно на `/api/ranking?limit=5`.

Для ручного обновления данных выполни из каталога проекта:

```sh
docker compose -f compose.yaml -f compose.timeweb.yaml run --rm importer
```

При первом обновлении до версии с физическими фильтрами дождись успешного импорта новой версией. Он заполнит плотность и температуры для фильтрации существующего каталога и рейтинга.
