#!/bin/bash
set -e

DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" >/dev/null 2>&1 && pwd)"
cd "$DIR"

echo "=== Сборка проекта WebLab3 (WAR) ==="
mvn clean package
echo "=== Сборка успешно завершена: target/weblab3.war ==="
