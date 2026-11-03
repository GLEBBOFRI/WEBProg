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

# Параметры по умолчанию
HELIOS_USER="${1:-s465457}"
PORTBASE="${2:-25000}"
HELIOS_PORT="${3:-2222}"
HELIOS_HOST="helios.cs.ifmo.ru"

# Вычисление port-offset для WildFly:
# В WildFly дефолтные порты: HTTP = 8080, Management = 9990.
# Если передан порт (например, 25000):
# port-offset = PORTBASE - 8080 = 16920.
# Тогда HTTP порт = 8080 + 16920 = 25000.
# Management порт = 9990 + 16920 = 26910.
if [ "$PORTBASE" -ge 8080 ]; then
    PORT_OFFSET=$((PORTBASE - 8080))
    HTTP_PORT=$PORTBASE
    MGMT_PORT=$((PORTBASE + 9990 - 8080))
else
    PORT_OFFSET=$PORTBASE
    HTTP_PORT=$((8080 + PORT_OFFSET))
    MGMT_PORT=$((9990 + PORT_OFFSET))
fi

echo -e "${BLUE}======================================================${NC}"
echo -e "${BLUE}   Автоматическое развертывание WEBlab3 на WildFly   ${NC}"
echo -e "${BLUE}                 Сервер: Helios IFMO                 ${NC}"
echo -e "${BLUE}======================================================${NC}"
echo -e "Пользователь:      ${YELLOW}${HELIOS_USER}${NC}"
echo -e "Хост:              ${YELLOW}${HELIOS_HOST}:${HELIOS_PORT}${NC}"
echo -e "Portbase (HTTP):   ${GREEN}${HTTP_PORT}${NC}"
echo -e "Management порт:   ${GREEN}${MGMT_PORT}${NC}"
echo -e "WildFly Offset:    ${CYAN}${PORT_OFFSET}${NC}\n"

# 1. Проверка и сборка war-архива локально
echo -e "${YELLOW}[1/4] Проверка сборки weblab3.war...${NC}"
if [ ! -f "target/weblab3.war" ]; then
    echo -e "${CYAN}target/weblab3.war не найден. Запуск локальной сборки...${NC}"
    ./build.sh
else
    echo -e "${GREEN}✓ Файл target/weblab3.war готов к отправке.${NC}"
fi

# 2. Проверка и развертывание WildFly на сервере Helios
echo -e "${YELLOW}[2/4] Проверка окружения и WildFly на Helios...${NC}"
ssh -p "$HELIOS_PORT" "$HELIOS_USER@$HELIOS_HOST" "
    set -e
    chmod 711 ~

    if [ ! -d ~/wildfly/bin ]; then
        echo 'WildFly не обнаружен в ~/wildfly. Выполняется автоматическая установка...'
        mkdir -p ~/wildfly
        if [ -f /home/studs/s365809/wildfly-31.0.1.Final.tar.gz ]; then
            tar -xzf /home/studs/s365809/wildfly-31.0.1.Final.tar.gz -C ~/wildfly --strip-components=1
        elif [ -f /home/studs/s355273/wildfly-41.0.1.Final.zip ]; then
            unzip -q /home/studs/s355273/wildfly-41.0.1.Final.zip -d ~/wildfly-tmp
            mv ~/wildfly-tmp/wildfly-*/* ~/wildfly/
            rm -rf ~/wildfly-tmp
        else
            echo 'Загрузка WildFly 31.0.1.Final с официального репозитория...'
            curl -L -o /tmp/wildfly-31.0.1.Final.tar.gz https://github.com/wildfly/wildfly/releases/download/31.0.1.Final/wildfly-31.0.1.Final.tar.gz
            tar -xzf /tmp/wildfly-31.0.1.Final.tar.gz -C ~/wildfly --strip-components=1
            rm -f /tmp/wildfly-31.0.1.Final.tar.gz
        fi
        echo '✓ WildFly успешно установлен в ~/wildfly'
    else
        echo '✓ WildFly уже установлен в ~/wildfly'
    fi

    mkdir -p ~/wildfly/standalone/deployments
    mkdir -p ~/wildfly/standalone/log
"

# 3. Копирование war-файла в standalone/deployments
echo -e "${YELLOW}[3/4] Загрузка weblab3.war в deployments WildFly...${NC}"
scp -P "$HELIOS_PORT" target/weblab3.war "$HELIOS_USER@$HELIOS_HOST:~/wildfly/standalone/deployments/weblab3.war"

# 4. Создание скриптов запуска, остановки и мониторинга на Helios
echo -e "${YELLOW}[4/4] Генерация вспомогательных скриптов управления...${NC}"
ssh -p "$HELIOS_PORT" "$HELIOS_USER@$HELIOS_HOST" "
    # 4.1 Скрипт запуска WildFly в standalone-конфигурации с привязкой ко всем IP (0.0.0.0) и portbase
    cat << 'EOF' > ~/wildfly/start-wildfly.sh
#!/bin/sh
echo \"=== Запуск WildFly (standalone mode) ===\"

# Проверка, не запущен ли уже сервер
if pgrep -U \"\$USER\" -f \"jboss-modules.jar\" >/dev/null 2>&1; then
    echo \"[!] WildFly уже запущен (PID: \$(pgrep -U \"\$USER\" -f \"jboss-modules.jar\")).\"
    echo \"Для перезапуска используйте: ~/wildfly/restart-wildfly.sh\"
    exit 0
fi

# Настройка OpenJDK 17 для стабильной работы на FreeBSD
export JAVA_HOME=/usr/local/openjdk17
export _JAVA_OPTIONS=\"-Xms128m -Xmx512m\"

cd ~/wildfly/bin
nohup ./standalone.sh -b 0.0.0.0 -bmanagement 0.0.0.0 -Djboss.socket.binding.port-offset=$PORT_OFFSET > ~/wildfly/standalone/log/boot.log 2>&1 &

WILDFLY_PID=\$!
echo \"[+] WildFly запущен в фоне (PID: \$WILDFLY_PID)\"
echo \"[+] Ожидание инициализации HTTP listener на 0.0.0.0:$HTTP_PORT...\"

for i in \$(seq 1 15); do
    sleep 1
    if grep -q \"started in\" ~/wildfly/standalone/log/server.log 2>/dev/null; then
        echo \"[✓] WildFly успешно стартовал!\"
        break
    fi
done

echo \"[i] Порты: HTTP = $HTTP_PORT, Management = $MGMT_PORT\"
echo \"[i] URL приложения: http://0.0.0.0:$HTTP_PORT/weblab3/controller\"
EOF
    chmod +x ~/wildfly/start-wildfly.sh

    # 4.2 Скрипт остановки WildFly
    cat << 'EOF' > ~/wildfly/stop-wildfly.sh
#!/bin/sh
echo \"=== Остановка WildFly ===\"
if pgrep -U \"\$USER\" -f \"jboss-modules.jar\" >/dev/null 2>&1; then
    pkill -TERM -U \"\$USER\" -f \"jboss-modules.jar\"
    sleep 2
    if pgrep -U \"\$USER\" -f \"jboss-modules.jar\" >/dev/null 2>&1; then
        pkill -9 -U \"\$USER\" -f \"jboss-modules.jar\"
    fi
    echo \"[-] WildFly успешно остановлен.\"
else
    echo \"[-] Процесс WildFly не найден.\"
fi
EOF
    chmod +x ~/wildfly/stop-wildfly.sh

    # 4.3 Скрипт перезапуска WildFly
    cat << 'EOF' > ~/wildfly/restart-wildfly.sh
#!/bin/sh
~/wildfly/stop-wildfly.sh
sleep 1
~/wildfly/start-wildfly.sh
EOF
    chmod +x ~/wildfly/restart-wildfly.sh

    # 4.4 Скрипт проверки статуса
    cat << 'EOF' > ~/wildfly/status-wildfly.sh
#!/bin/sh
echo \"=== Статус WildFly ===\"
if pgrep -fl \"jboss-modules.jar\"; then
    echo \"\n[✓] WildFly запущен.\"
    echo \"Деплойменты:\"
    ls -l ~/wildfly/standalone/deployments/
else
    echo \"[-] WildFly не запущен.\"
fi
EOF
    chmod +x ~/wildfly/status-wildfly.sh

    # 4.5 Скрипт чтения логов
    cat << 'EOF' > ~/wildfly/logs-wildfly.sh
#!/bin/sh
tail -f ~/wildfly/standalone/log/server.log
EOF
    chmod +x ~/wildfly/logs-wildfly.sh

    # 4.6 Создание редиректа в public_html
    mkdir -p ~/public_html
    chmod 755 ~/public_html
    echo '<!DOCTYPE html><html><head><meta http-equiv=\"refresh\" content=\"0; url=http://helios.cs.ifmo.ru:$HTTP_PORT/weblab3/controller\"><title>Лабораторная работа №3</title></head><body><p>Перенаправление на WildFly: <a href=\"http://helios.cs.ifmo.ru:$HTTP_PORT/weblab3/controller\">http://helios.cs.ifmo.ru:$HTTP_PORT/weblab3/controller</a></p></body></html>' > ~/public_html/index.html
    chmod 644 ~/public_html/index.html
"

echo -e "\n${GREEN}======================================================${NC}"
echo -e "${GREEN}   ✓ Развертывание WEBlab3 на Helios завершено!       ${NC}"
echo -e "${GREEN}======================================================${NC}\n"

echo -e "${YELLOW}======================================================${NC}"
echo -e "${YELLOW}           КОМАНДЫ ДЛЯ ЗАПУСКА НА HELIOS              ${NC}"
echo -e "${YELLOW}======================================================${NC}\n"

echo -e "${GREEN}▶ 1. ЗАПУСК WILDFLY НА HELIOS:${NC}"
echo -e "${YELLOW}~/wildfly/start-wildfly.sh${NC}\n"

echo -e "${BLUE}------------------------------------------------------${NC}"
echo -e "${BLUE}Полезные команды управления на сервере Helios:${NC}"
echo -e " • Старт сервера:        ${YELLOW}~/wildfly/start-wildfly.sh${NC}"
echo -e " • Остановка сервера:    ${YELLOW}~/wildfly/stop-wildfly.sh${NC}"
echo -e " • Перезапуск сервера:   ${YELLOW}~/wildfly/restart-wildfly.sh${NC}"
echo -e " • Проверка статуса:     ${YELLOW}~/wildfly/status-wildfly.sh${NC}"
echo -e " • Просмотр логов:       ${YELLOW}~/wildfly/logs-wildfly.sh${NC}"
echo -e "${BLUE}------------------------------------------------------${NC}\n"

echo -e "${CYAN}▶ 2. ПРЯМОЙ ДОСТУП ИЛИ ЧЕРЕЗ SSH-ТУННЕЛЬ:${NC}"
echo -e "Так как WildFly запущен с параметром ${GREEN}-b 0.0.0.0${NC}, HTTP listener открыт для всех IP:"
echo -e "Ссылка на сервер: ${GREEN}http://${HELIOS_HOST}:${HTTP_PORT}/weblab3/controller${NC}"
echo -e "Админка WildFly:  ${GREEN}http://${HELIOS_HOST}:${MGMT_PORT}/${NC}\n"

echo -e "Если порты закрыты внешним фаерволом кампуса, пробросьте порт на локальный ПК:"
echo -e "${YELLOW}ssh -p $HELIOS_PORT -L ${HTTP_PORT}:localhost:${HTTP_PORT} $HELIOS_USER@$HELIOS_HOST -N${NC}"
echo -e "После проброса сайт доступен в браузере: ${GREEN}http://localhost:${HTTP_PORT}/weblab3/controller${NC}\n"
