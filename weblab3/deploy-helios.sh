#!/bin/bash
set -e

# Цвета для красивого вывода
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
CYAN='\033[0;36m'
RED='\033[0;31m'
NC='\033[0m'

DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" >/dev/null 2>&1 && pwd)"
cd "$DIR"

HELIOS_USER="${1:-s465457}"
HELIOS_PORT="${2:-2222}"
HELIOS_HOST="helios.cs.ifmo.ru"

echo -e "${BLUE}======================================================${NC}"
echo -e "${BLUE}   Развертывание WEBlab3 на Helios в public_html     ${NC}"
echo -e "${BLUE}======================================================${NC}"
echo -e "Пользователь: ${YELLOW}${HELIOS_USER}${NC}"
echo -e "Хост:         ${YELLOW}${HELIOS_HOST}:${HELIOS_PORT}${NC}\n"

# 1. Проверка директории public_html и установка прав на Helios
echo -e "${YELLOW}[1/3] Подготовка каталога public_html на Helios...${NC}"
ssh -p "$HELIOS_PORT" "$HELIOS_USER@$HELIOS_HOST" "
    set -e
    chmod 711 ~
    mkdir -p ~/public_html/css ~/public_html/js
    chmod 755 ~/public_html
    chmod 755 ~/public_html/css
    chmod 755 ~/public_html/js
"

# 2. Загрузка статических файлов лабораторной в public_html
echo -e "${YELLOW}[2/3] Копирование index.html, стилей и скриптов в public_html...${NC}"
scp -P "$HELIOS_PORT" client/index.html "$HELIOS_USER@$HELIOS_HOST:~/public_html/index.html"
scp -P "$HELIOS_PORT" client/css/styles.css "$HELIOS_USER@$HELIOS_HOST:~/public_html/css/styles.css"
scp -P "$HELIOS_PORT" client/js/main.js "$HELIOS_USER@$HELIOS_HOST:~/public_html/js/main.js"

# 3. Установка прав на чтение веб-сервером se.ifmo.ru
echo -e "${YELLOW}[3/3] Настройка прав доступа...${NC}"
ssh -p "$HELIOS_PORT" "$HELIOS_USER@$HELIOS_HOST" "
    chmod 644 ~/public_html/index.html
    chmod 644 ~/public_html/css/styles.css
    chmod 644 ~/public_html/js/main.js
"

echo -e "\n${GREEN}======================================================${NC}"
echo -e "${GREEN}   ✓ Лабораторная работа №3 успешно развернута!       ${NC}"
echo -e "${GREEN}======================================================${NC}\n"

echo -e "Сайт доступен прямо в браузере по официальной ссылке:"
echo -e "👉 ${GREEN}https://se.ifmo.ru/~${HELIOS_USER}/${NC}\n"
