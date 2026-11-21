#!/bin/bash
set -e

# палитра цветов для красивого вывода логов в консоль
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
CYAN='\033[0;36m'
NC='\033[0m'

# прыгаем в папку скрипта чтоб относительные пути не сломались
DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" >/dev/null 2>&1 && pwd)"
cd "$DIR"

# дефолтные параметры студента для подключения к серверу факультета
HELIOS_USER="${1:-s465457}"
HELIOS_PORT="${2:-2222}"
HELIOS_HOST="helios.cs.ifmo.ru"
WILDFLY_PORT="25000"
PORT_OFFSET="16920" # сдвиг порта 8080 + 16920 = 25000

echo -e "${BLUE}================================================================${NC}"
echo -e "${BLUE}        автоматический деплой weblab3 на helios (wildfly)       ${NC}"
echo -e "${BLUE}================================================================${NC}"
echo -e "студент:      ${YELLOW}${HELIOS_USER}${NC}"
echo -e "сервер:       ${YELLOW}${HELIOS_HOST}:${HELIOS_PORT}${NC}"
echo -e "порт wildfly: ${YELLOW}${WILDFLY_PORT}${NC}\n"

# 1. билдим war-пакет проекта через maven
echo -e "${YELLOW}[1/4] собираем war-ник проекта через maven...${NC}"
if [ ! -f "target/weblab3.war" ]; then
    mvn clean package -DskipTests
else
    mvn package -DskipTests
fi

# 2. чекаем и создаем нужные каталоги на гелиосе
echo -e "${YELLOW}[2/4] настраиваем директории и права доступа на гелиосе...${NC}"
ssh -p "$HELIOS_PORT" "$HELIOS_USER@$HELIOS_HOST" "
    set -e
    # открываем домашнюю папку на чтение/выполнение для веб-сервера
    chmod 711 ~
    mkdir -p ~/public_html
    mkdir -p ~/wildfly/standalone/deployments
    mkdir -p ~/wildfly/standalone/log
    mkdir -p ~/httpd-root/static
    mkdir -p ~/httpd-root/fcgi-bin
    mkdir -p ~/httpd-root/mutex-dir
    chmod 755 ~/public_html
    chmod 755 ~/wildfly
    chmod 755 ~/wildfly/standalone
    chmod 755 ~/wildfly/standalone/deployments
"

# 3. заливаем war-ник в deployments wildfly
echo -e "${YELLOW}[3/4] заливаем weblab3.war в wildfly/standalone/deployments...${NC}"
scp -P "$HELIOS_PORT" target/weblab3.war "$HELIOS_USER@$HELIOS_HOST:~/wildfly/standalone/deployments/weblab3.war"

# 4. создаем все скрипты управления сервисами на гелиосе
echo -e "${YELLOW}[4/4] генерируем скрипты управления всеми сервисами на гелиосе...${NC}"
ssh -p "$HELIOS_PORT" "$HELIOS_USER@$HELIOS_HOST" "
    # редирект в public_html для открытия через браузер
    echo '<!DOCTYPE html><html><head><meta http-equiv=\"refresh\" content=\"0; url=http://localhost:25000/weblab3/controller\"><title>Лабораторная работа №3</title></head><body><p>Перенаправление на WildFly: <a href=\"http://localhost:25000/weblab3/controller\">http://localhost:25000/weblab3/controller</a></p><p><i>(Если сервер выключен или не поднят туннель, страница не загрузится)</i></p></body></html>' > ~/public_html/index.html
    chmod 644 ~/public_html/index.html

    # --- скрипты управления wildfly (3 лаба) ---
    cat << 'EOF' > ~/wildfly/start-wildfly.sh
#!/bin/sh
# запуск wildfly в standalone-режиме с открытым http-listener на 0.0.0.0
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

    cat << 'EOF' > ~/wildfly/stop-wildfly.sh
#!/bin/sh
# глушим процесс wildfly по jboss-modules.jar
echo \"=== Остановка WildFly ===\"
pkill -U \"\$USER\" -f \"jboss-modules.jar\" 2>/dev/null && echo \"[-] WildFly остановлен\" || echo \"[-] WildFly не был запущен\"
EOF
    chmod +x ~/wildfly/stop-wildfly.sh

    cat << 'EOF' > ~/wildfly/restart-wildfly.sh
#!/bin/sh
# быстрый рестарт wildfly
~/wildfly/stop-wildfly.sh
sleep 2
~/wildfly/start-wildfly.sh
EOF
    chmod +x ~/wildfly/restart-wildfly.sh

    cat << 'EOF' > ~/wildfly/status-wildfly.sh
#!/bin/sh
# проверка жив ли wildfly и слушает ли порт 25000
pgrep -fl \"jboss-modules.jar\" && echo \"[+] WildFly работает\" || echo \"[-] WildFly остановлен\"
sockstat -4 -l | grep 25000 || true
EOF
    chmod +x ~/wildfly/status-wildfly.sh

    cat << 'EOF' > ~/wildfly/logs-wildfly.sh
#!/bin/sh
# смотрим логи wildfly в реальном времени
tail -f ~/wildfly/standalone/log/server.log
EOF
    chmod +x ~/wildfly/logs-wildfly.sh

    # --- скрипты управления fastcgi и apache (2 лаба) ---
    cat << 'EOF' > ~/httpd-root/start-fastcgi.sh
#!/bin/sh
# запуск java fastcgi демона на сокете 24001
pkill -U \"\$USER\" -f server.jar 2>/dev/null || true
sleep 1
export _JAVA_OPTIONS=\"-Xmx256m\"
nohup java -DFCGI_PORT=24001 -DNO_HTTP=true -jar ~/httpd-root/fcgi-bin/server.jar > ~/httpd-root/server.log 2>&1 &
echo \"[+] FastCGI запущен на порту 24001\"
sleep 1
pgrep -fl server.jar
EOF
    chmod +x ~/httpd-root/start-fastcgi.sh

    cat << 'EOF' > ~/httpd-root/stop-fastcgi.sh
#!/bin/sh
# глушим процесс fastcgi демона
pkill -U \"\$USER\" -f server.jar 2>/dev/null && echo \"[-] FastCGI остановлен\" || echo \"[-] FastCGI не был запущен\"
EOF
    chmod +x ~/httpd-root/stop-fastcgi.sh

    cat << 'EOF' > ~/httpd-root/start-apache.sh
#!/bin/sh
# запуск apache httpd на порту 24000
httpd -f ~/httpd-root/httpd.conf -k start 2>/dev/null || httpd -f ~/httpd-root/httpd.conf -k restart
echo \"[+] Apache запущен на порту 24000\"
sleep 1
pgrep -fl httpd
EOF
    chmod +x ~/httpd-root/start-apache.sh

    cat << 'EOF' > ~/httpd-root/stop-apache.sh
#!/bin/sh
# остановка apache httpd
httpd -f ~/httpd-root/httpd.conf -k stop 2>/dev/null && echo \"[-] Apache остановлен\" || echo \"[-] Apache не был запущен\"
EOF
    chmod +x ~/httpd-root/stop-apache.sh

    cat << 'EOF' > ~/httpd-root/start-all.sh
#!/bin/sh
# запуск fastcgi + apache
echo \"=== Запуск сервисов WEBlab2 ===\"
~/httpd-root/start-fastcgi.sh
~/httpd-root/start-apache.sh
echo \"=== Серверы WEBlab2 работают ===\"
EOF
    chmod +x ~/httpd-root/start-all.sh

    cat << 'EOF' > ~/httpd-root/stop-all.sh
#!/bin/sh
# остановка fastcgi + apache
echo \"=== Остановка сервисов WEBlab2 ===\"
~/httpd-root/stop-fastcgi.sh
~/httpd-root/stop-apache.sh
echo \"=== Сервисы WEBlab2 остановлены ===\"
EOF
    chmod +x ~/httpd-root/stop-all.sh

    # --- глобальные скрипты запуска/остановки всего стаффа в ~ ---
    cat << 'EOF' > ~/start-all.sh
#!/bin/sh
# поднимаем вообще все: wildfly (лаба 3) + apache и fastcgi (лаба 2)
echo \"=== Запуск ВСЕХ компонентов на Helios ===\"
~/wildfly/start-wildfly.sh
if [ -f ~/httpd-root/fcgi-bin/server.jar ] && [ -f ~/httpd-root/httpd.conf ]; then
    ~/httpd-root/start-all.sh
fi
echo \"=== Все компоненты запущены! ===\"
EOF
    chmod +x ~/start-all.sh

    cat << 'EOF' > ~/stop-all.sh
#!/bin/sh
# тушим вообще все компоненты
echo \"=== Остановка ВСЕХ компонентов на Helios ===\"
~/wildfly/stop-wildfly.sh
~/httpd-root/stop-all.sh 2>/dev/null || true
pkill -U \"\$USER\" -f \"jboss-modules.jar\" 2>/dev/null || true
pkill -U \"\$USER\" -f \"server.jar\" 2>/dev/null || true
pkill -U \"\$USER\" -f \"httpd\" 2>/dev/null || true
echo \"=== Все компоненты остановлены! ===\"
EOF
    chmod +x ~/stop-all.sh

    cat << 'EOF' > ~/restart-all.sh
#!/bin/sh
# рестарт всех серверов
~/stop-all.sh
sleep 2
~/start-all.sh
EOF
    chmod +x ~/restart-all.sh
"

echo -e "\n${GREEN}================================================================${NC}"
echo -e "${GREEN}   ✓ WebLab3 успешно собран и задеплоен на сервер Helios!       ${NC}"
echo -e "${GREEN}================================================================${NC}\n"

# выводим в терминал подробный чит-шит по всем командам управления
echo -e "${CYAN}================================================================${NC}"
echo -e "${CYAN}             ПОЛНЫЙ СПИСОК КОМАНД ДЛЯ УПРАВЛЕНИЯ НА HELIOS      ${NC}"
echo -e "${CYAN}================================================================${NC}\n"

echo -e "${GREEN}▶ 1. УПРАВЛЕНИЕ WILDFLY (Лабораторная работа №3):${NC}"
echo -e " • Запуск WildFly:        ${YELLOW}~/wildfly/start-wildfly.sh${NC}"
echo -e "   или командой:          ${YELLOW}cd ~/wildfly/bin && nohup ./standalone.sh -b 0.0.0.0 -bmanagement 0.0.0.0 -Djboss.socket.binding.port-offset=16920 > ~/wildfly/standalone/log/boot.log 2>&1 &${NC}"
echo -e " • Остановка WildFly:     ${YELLOW}~/wildfly/stop-wildfly.sh${NC}"
echo -e "   или командой:          ${YELLOW}pkill -U $HELIOS_USER -f jboss-modules.jar${NC}"
echo -e " • Перезапуск WildFly:    ${YELLOW}~/wildfly/restart-wildfly.sh${NC}"
echo -e " • Проверить статус:      ${YELLOW}~/wildfly/status-wildfly.sh${NC}"
echo -e " • Смотреть логи:         ${YELLOW}~/wildfly/logs-wildfly.sh${NC}"
echo -e "   или командой:          ${YELLOW}tail -f ~/wildfly/standalone/log/server.log${NC}\n"

echo -e "${GREEN}▶ 2. УПРАВЛЕНИЕ FASTCGI (Лабораторная работа №2):${NC}"
echo -e " • Запуск FastCGI:        ${YELLOW}~/httpd-root/start-fastcgi.sh${NC}"
echo -e "   или командой:          ${YELLOW}nohup java -DFCGI_PORT=24001 -DNO_HTTP=true -jar ~/httpd-root/fcgi-bin/server.jar > ~/httpd-root/server.log 2>&1 &${NC}"
echo -e " • Остановка FastCGI:     ${YELLOW}~/httpd-root/stop-fastcgi.sh${NC}"
echo -e "   или командой:          ${YELLOW}pkill -U $HELIOS_USER -f server.jar${NC}"
echo -e " • Просмотр логов FCGI:   ${YELLOW}tail -f ~/httpd-root/server.log${NC}\n"

echo -e "${GREEN}▶ 3. УПРАВЛЕНИЕ APACHE HTTPD (Лабораторная работа №2):${NC}"
echo -e " • Запуск Apache:         ${YELLOW}~/httpd-root/start-apache.sh${NC}"
echo -e "   или командой:          ${YELLOW}httpd -f ~/httpd-root/httpd.conf -k start${NC}"
echo -e " • Остановка Apache:      ${YELLOW}~/httpd-root/stop-apache.sh${NC}"
echo -e "   или командой:          ${YELLOW}httpd -f ~/httpd-root/httpd.conf -k stop${NC}"
echo -e " • Перезапуск Apache:     ${YELLOW}httpd -f ~/httpd-root/httpd.conf -k restart${NC}"
echo -e " • Просмотр логов Apache: ${YELLOW}tail -f ~/httpd-root/error.log${NC}\n"

echo -e "${GREEN}▶ 4. УПРАВЛЕНИЕ ВСЕМ СРАЗУ (ГЛОБАЛЬНО):${NC}"
echo -e " • Запустить ВСЁ:         ${YELLOW}~/start-all.sh${NC}"
echo -e " • Остановить ВСЁ:        ${YELLOW}~/stop-all.sh${NC}"
echo -e " • Перезапустить ВСЁ:     ${YELLOW}~/restart-all.sh${NC}"
echo -e " • Проверить все процессы:${YELLOW}pgrep -fl \"jboss-modules.jar|server.jar|httpd\"${NC}"
echo -e " • Проверить все порты:   ${YELLOW}sockstat -4 -l | grep -E \"24000|24001|25000|26910\"${NC}\n"

echo -e "${BLUE}----------------------------------------------------------------${NC}"
echo -e "${BLUE}▶ 5. ПОДКЛЮЧЕНИЕ С ЛОКАЛЬНОГО ПК (SSH-ТУННЕЛИ):${NC}"
echo -e " • Туннель к WildFly (Лаба 3):"
echo -e "   ${YELLOW}ssh -p $HELIOS_PORT -L 25000:localhost:25000 $HELIOS_USER@$HELIOS_HOST -N${NC}"
echo -e " • Туннель к Apache (Лаба 2):"
echo -e "   ${YELLOW}ssh -p $HELIOS_PORT -L 24000:localhost:24000 $HELIOS_USER@$HELIOS_HOST -N${NC}\n"

echo -e "${BLUE}▶ 6. ССЫЛКИ ДЛЯ ПРОВЕРКИ В БРАУЗЕРЕ:${NC}"
echo -e " • Приложение 3 лабы (JSP & Servlets): ${GREEN}http://localhost:25000/weblab3/controller${NC}"
echo -e " • Альтернативный URL 3 лабы:          ${GREEN}http://localhost:25000/weblab3/${NC}"
echo -e " • Приложение 2 лабы (FastCGI):        ${GREEN}http://localhost:24000/${NC}"
echo -e " • Ссылка через сервер факультета:     ${GREEN}https://se.ifmo.ru/~${HELIOS_USER}/${NC}"
echo -e "${BLUE}----------------------------------------------------------------${NC}\n"
