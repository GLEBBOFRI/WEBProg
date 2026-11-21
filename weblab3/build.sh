#!/bin/bash
set -e

# прыгаем в папку со скриптом
DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" >/dev/null 2>&1 && pwd)"
cd "$DIR"

# собираем мавеном war-архив с сервлетами и jsp
echo "=== Сборка проекта WebLab3 (WAR) ==="
mvn clean package
echo "=== Сборка успешно завершена: target/weblab3.war ==="
