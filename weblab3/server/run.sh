#!/bin/bash
DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" >/dev/null 2>&1 && pwd)"
cd "$DIR"

PORT="${1:-24001}"

if [ ! -f "server.jar" ]; then
    echo "server.jar не найден. Запуск сборки..."
    ./build.sh
fi

echo "=== Запуск FastCGI сервера на порту $PORT ==="
java -Xmx256m -DFCGI_PORT="$PORT" -jar server.jar
