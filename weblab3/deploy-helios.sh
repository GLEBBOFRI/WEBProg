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
WILDFLY_PORT="25000"
PORT_OFFSET="16920" # 8080 + 16920 = 25000

echo -e "${BLUE}======================================================${NC}"
echo -e "${BLUE}   Автоматическое развертывание WEBlab3 на WildFly   ${NC}"
echo -e "${BLUE}======================================================${NC}"
echo -e "Пользователь: ${YELLOW}${HELIOS_USER}${NC}"
echo -e "Хост:         ${YELLOW}${HELIOS_HOST}:${HELIOS_PORT}${NC}"
echo -e "Порт WildFly: ${YELLOW}${WILDFLY_PORT}${NC}\n"

# 1. Сборка WAR-файла проекта
echo -e "${YELLOW}[1/4] Сборка WAR архива через Maven...${NC}"
if [ ! -f "target/weblab3.war" ]; then
    mvn clean package -DskipTests
else
    echo -e "${GREEN}Используется существующий target/weblab3.war (или пересоберите через mvn package)${NC}"
    mvn package -DskipTests
fi

# 2. Проверка и подготовка каталога WildFly на Helios
echo -e "${YELLOW}[2/4] Проверка директорий WildFly на Helios...${NC}"
ssh -p "$HELIOS_PORT" "$HELIOS_USER@$HELIOS_HOST" "
    set -e
    chmod 711 ~
    mkdir -p ~/public_html
    mkdir -p ~/wildfly/standalone/deployments
    mkdir -p ~/wildfly/standalone/log
    chmod 755 ~/public_html
"

# 3. Загрузка WAR-архива в директорию deployments WildFly
echo -e "${YELLOW}[3/4] Загрузка weblab3.war в WildFly deployments...${NC}"
scp -P "$HELIOS_PORT" target/weblab3.war "$HELIOS_USER@$HELIOS_HOST:~/wildfly/standalone/deployments/weblab3.war"

# 4. Создание вспомогательных скриптов управления WildFly на Helios
echo -e "${YELLOW}[4/4] Создание скриптов запуска, остановки и редиректа...${NC}"
ssh -p "$HELIOS_PORT" "$HELIOS_USER@$HELIOS_HOST" "
    # Настройка редиректа в public_html
    echo '<!DOCTYPE html><html><head><meta http-equiv=\"refresh\" content=\"0; url=http://localhost:25000/weblab3/controller\"><title>Лабораторная работа №3</title></head><body><p>Перенаправление на WildFly: <a href=\"http://localhost:25000/weblab3/controller\">http://localhost:25000/weblab3/controller</a></p><p><i>(Если сервер выключен или не поднят туннель, страница не загрузится)</i></p></body></html>' > ~/public_html/index.html
    chmod 644 ~/public_html/index.html

    # Скрипт запуска WildFly (standalone mode, port-offset 16920 -> порт 25000, 0.0.0.0)
    cat << 'EOF' > ~/wildfly/start-wildfly.sh
#!/bin/sh
echo \"=== Запуск WildFly (standalone mode) ===\"

if pgrep -U \"\$USER\" -f \"jboss-modules.jar\" >/dev/null 2>&1; then
    echo \"[!] WildFly уже запущен (PID: \$(pgrep -U \"\$USER\" -f \"jboss-modules.jar\")).\"
    exit 0
fi

export JAVA_HOME=/usr/local/openjdk17
export _JAVA_OPTIONS=\"-Xms128m -Xmx512m\"

cd ~/wildfly/bin
nohup ./standalone.sh -b 0.0.0.0 -bmanagement 0.0.0.0 -Djboss.socket.binding.port-offset=16920 > ~/wildfly/standalone/log/boot.log 2>&1 &

WILDFLY_PID=\$!
echo \"[+] WildFly запущен в фоне (PID: \$WILDFLY_PID)\"
echo \"[+] Ожидание инициализации HTTP listener на 0.0.0.0:25000...\"

for i in \$(seq 1 20); do
    sleep 1
    if grep -q \"started in\" ~/wildfly/standalone/log/server.log 2>/dev/null; then
        echo \"[✓] WildFly успешно стартовал!\"
        break
    fi
done

echo \"[i] Порты: HTTP = 25000, Management = 26910\"
echo \"[i] URL приложения: http://localhost:25000/weblab3/controller\"
EOF
    chmod +x ~/wildfly/start-wildfly.sh

    # Скрипт остановки WildFly
    cat << 'EOF' > ~/wildfly/stop-wildfly.sh
#!/bin/sh
echo \"=== Остановка WildFly ===\"
pkill -U \"\$USER\" -f \"jboss-modules.jar\" 2>/dev/null && echo \"[-] WildFly остановлен\" || echo \"[-] WildFly не был запущен\"
EOF
    chmod +x ~/wildfly/stop-wildfly.sh

    # Скрипт перезапуска WildFly
    cat << 'EOF' > ~/wildfly/restart-wildfly.sh
#!/bin/sh
~/wildfly/stop-wildfly.sh
sleep 2
~/wildfly/start-wildfly.sh
EOF
    chmod +x ~/wildfly/restart-wildfly.sh

    # Скрипт проверки статуса
    cat << 'EOF' > ~/wildfly/status-wildfly.sh
#!/bin/sh
pgrep -fl \"jboss-modules.jar\" && echo \"[+] WildFly работает\" || echo \"[-] WildFly остановлен\"
sockstat -4 -l | grep 25000 || true
EOF
    chmod +x ~/wildfly/status-wildfly.sh

    # Скрипт просмотра логов
    cat << 'EOF' > ~/wildfly/logs-wildfly.sh
#!/bin/sh
tail -f ~/wildfly/standalone/log/server.log
EOF
    chmod +x ~/wildfly/logs-wildfly.sh
"

echo -e "\n${GREEN}======================================================${NC}"
echo -e "${GREEN}   ✓ WebLab3 успешно развернут на сервере WildFly!    ${NC}"
echo -e "${GREEN}======================================================${NC}\n"

echo -e "${YELLOW}======================================================${NC}"
echo -e "${YELLOW}        КОМАНДЫ ДЛЯ УПРАВЛЕНИЯ WILDFLY НА HELIOS       ${NC}"
echo -e "${YELLOW}======================================================${NC}\n"

echo -e "${GREEN}▶ Запуск WildFly:${NC}"
echo -e "${YELLOW}~/wildfly/start-wildfly.sh${NC}\n"

echo -e "${GREEN}▶ Остановка WildFly:${NC}"
echo -e "${YELLOW}~/wildfly/stop-wildfly.sh${NC}\n"

echo -e "${GREEN}▶ Перезапуск WildFly:${NC}"
echo -e "${YELLOW}~/wildfly/restart-wildfly.sh${NC}\n"

echo -e "${GREEN}▶ Проверка статуса:${NC}"
echo -e "${YELLOW}~/wildfly/status-wildfly.sh${NC}\n"

echo -e "${GREEN}▶ Просмотр логов WildFly:${NC}"
echo -e "${YELLOW}~/wildfly/logs-wildfly.sh${NC}\n"

echo -e "${BLUE}------------------------------------------------------${NC}"
echo -e "${BLUE}▶ Подключение с локального ПК (SSH-туннель):${NC}"
echo -e "${YELLOW}ssh -p $HELIOS_PORT -L 25000:localhost:25000 $HELIOS_USER@$HELIOS_HOST -N${NC}\n"
echo -e "После поднятия туннеля сайт открывается в браузере:"
echo -e "${GREEN}http://localhost:25000/weblab3/controller${NC}"
echo -e "${GREEN}http://localhost:25000/weblab3/${NC}\n"
echo -e "Или через ссылку факультета:"
echo -e "${GREEN}https://se.ifmo.ru/~${HELIOS_USER}/${NC}\n"
