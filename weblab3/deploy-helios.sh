#!/bin/bash
set -e

# Цвета для красивого вывода
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m'

DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" >/dev/null 2>&1 && pwd)"
cd "$DIR"

HELIOS_USER="${1:-s465457}"
HELIOS_PORT="${2:-2222}"
HELIOS_HOST="helios.cs.ifmo.ru"

echo -e "${BLUE}======================================================${NC}"
echo -e "${BLUE}   Автоматическое развертывание WEBlab3 на Helios    ${NC}"
echo -e "${BLUE}======================================================${NC}"
echo -e "Пользователь: ${YELLOW}${HELIOS_USER}${NC}"
echo -e "Хост:         ${YELLOW}${HELIOS_HOST}:${HELIOS_PORT}${NC}\n"

# 1. Проверка и сборка серверного JAR
if [ ! -f "server/server.jar" ]; then
    echo -e "${YELLOW}[1/4] server.jar не найден. Запуск сборки...${NC}"
    (cd server && ./build.sh)
else
    echo -e "${GREEN}[1/4] Исполняемый server.jar готов к отправке.${NC}"
fi

# 2. Создание нужных директорий и настройка прав на Helios
echo -e "${YELLOW}[2/4] Создание каталогов и установка прав доступа на Helios...${NC}"
ssh -p "$HELIOS_PORT" "$HELIOS_USER@$HELIOS_HOST" "
    set -e
    chmod 711 ~
    mkdir -p ~/public_html
    mkdir -p ~/public_html/css
    mkdir -p ~/public_html/js
    mkdir -p ~/httpd-root/static
    mkdir -p ~/httpd-root/fcgi-bin
    mkdir -p ~/httpd-root/mutex-dir
    chmod 755 ~/public_html
    chmod 755 ~/public_html/css
    chmod 755 ~/public_html/js
    chmod 755 ~/httpd-root
    chmod 755 ~/httpd-root/static
"

# 3. Копирование файлов в public_html (для https://se.ifmo.ru/~s465457/)
# и в ~/httpd-root/static (для Apache)
echo -e "${YELLOW}[3/4] Загрузка файлов в public_html и на веб-сервер Apache...${NC}"
scp -P "$HELIOS_PORT" -r client/* "$HELIOS_USER@$HELIOS_HOST:~/public_html/"
scp -P "$HELIOS_PORT" -r client/* "$HELIOS_USER@$HELIOS_HOST:~/httpd-root/static/"

ssh -p "$HELIOS_PORT" "$HELIOS_USER@$HELIOS_HOST" "
    chmod -R 755 ~/public_html/*
    chmod -R 755 ~/httpd-root/static/*
"

# 4. Копирование server.jar и httpd.conf
echo -e "${YELLOW}[4/4] Загрузка server.jar и httpd.conf...${NC}"
scp -P "$HELIOS_PORT" server/server.jar "$HELIOS_USER@$HELIOS_HOST:~/httpd-root/fcgi-bin/server.jar"
scp -P "$HELIOS_PORT" httpd.conf "$HELIOS_USER@$HELIOS_HOST:~/httpd-root/httpd.conf"

# 5. Создание вспомогательных скриптов запуска и остановки на Helios
ssh -p "$HELIOS_PORT" "$HELIOS_USER@$HELIOS_HOST" "
    cat << 'EOF' > ~/httpd-root/start-fastcgi.sh
#!/bin/sh
pkill -U \"\$USER\" -f server.jar 2>/dev/null || true
sleep 1
export _JAVA_OPTIONS=\"-Xmx256m\"
nohup java -DFCGI_PORT=25001 -DNO_HTTP=true -jar ~/httpd-root/fcgi-bin/server.jar > ~/httpd-root/server.log 2>&1 &
echo \"[+] FastCGI запущен на порту 25001\"
sleep 1
pgrep -fl server.jar
EOF
    chmod +x ~/httpd-root/start-fastcgi.sh

    cat << 'EOF' > ~/httpd-root/stop-fastcgi.sh
#!/bin/sh
pkill -U \"\$USER\" -f server.jar 2>/dev/null && echo \"[-] FastCGI остановлен\" || echo \"[-] FastCGI не был запущен\"
EOF
    chmod +x ~/httpd-root/stop-fastcgi.sh

    cat << 'EOF' > ~/httpd-root/start-apache.sh
#!/bin/sh
httpd -f ~/httpd-root/httpd.conf -k start 2>/dev/null || httpd -f ~/httpd-root/httpd.conf -k restart
echo \"[+] Apache запущен на порту 25000\"
sleep 1
pgrep -fl httpd
EOF
    chmod +x ~/httpd-root/start-apache.sh

    cat << 'EOF' > ~/httpd-root/stop-apache.sh
#!/bin/sh
httpd -f ~/httpd-root/httpd.conf -k stop 2>/dev/null && echo \"[-] Apache остановлен\" || echo \"[-] Apache не был запущен\"
EOF
    chmod +x ~/httpd-root/stop-apache.sh

    cat << 'EOF' > ~/httpd-root/start-all.sh
#!/bin/sh
echo \"=== Запуск сервисов WEBlab3 ===\"
~/httpd-root/start-fastcgi.sh
~/httpd-root/start-apache.sh
echo \"=== Готово! Серверы работают ===\"
EOF
    chmod +x ~/httpd-root/start-all.sh

    cat << 'EOF' > ~/httpd-root/stop-all.sh
#!/bin/sh
echo \"=== Остановка сервисов WEBlab3 ===\"
~/httpd-root/stop-fastcgi.sh
~/httpd-root/stop-apache.sh
echo \"=== Все сервисы остановлены ===\"
EOF
    chmod +x ~/httpd-root/stop-all.sh
"

echo -e "\n${GREEN}======================================================${NC}"
echo -e "${GREEN}   ✓ Все файлы и скрипты успешно загружены на Helios! ${NC}"
echo -e "${GREEN}======================================================${NC}\n"

echo -e "Сайт доступен прямо в браузере по ссылке:"
echo -e "👉 ${GREEN}https://se.ifmo.ru/~${HELIOS_USER}/${NC}\n"

echo -e "${YELLOW}======================================================${NC}"
echo -e "${YELLOW}           КОМАНДЫ ДЛЯ ЗАПУСКА НА HELIOS              ${NC}"
echo -e "${YELLOW}======================================================${NC}\n"

echo -e "${GREEN}▶ 1. СТАРТ ВСЕГО ОДНОЙ КОМАНДОЙ НА HELIOS:${NC}"
echo -e "${YELLOW}~/httpd-root/start-all.sh${NC}\n"

echo -e "${BLUE}------------------------------------------------------${NC}"
echo -e "${BLUE}Полезные команды управления на Helios:${NC}"
echo -e " • Старт всего скриптом: ${YELLOW}~/httpd-root/start-all.sh${NC}"
echo -e " • Остановить всё:       ${YELLOW}~/httpd-root/stop-all.sh${NC}"
echo -e " • Старт FastCGI:        ${YELLOW}~/httpd-root/start-fastcgi.sh${NC}"
echo -e " • Старт Apache:         ${YELLOW}~/httpd-root/start-apache.sh${NC}"
echo -e " • Перезапуск Apache:    ${YELLOW}httpd -f ~/httpd-root/httpd.conf -k restart${NC}"
echo -e " • Проверить процессы:   ${YELLOW}pgrep -fl \"server.jar|httpd\"${NC}"
echo -e " • Просмотр логов Apache:${YELLOW}tail -f ~/httpd-root/error.log${NC}"
echo -e " • Просмотр логов FastCGI:${YELLOW}tail -f ~/httpd-root/server.log${NC}"
echo -e "${BLUE}------------------------------------------------------${NC}\n"

echo -e "${BLUE}▶ 2. НА ЛОКАЛЬНОМ ПК (туннель к веб-серверу Apache):${NC}"
echo -e "${YELLOW}ssh -p $HELIOS_PORT -L 25000:localhost:25000 $HELIOS_USER@$HELIOS_HOST -N${NC}\n"
