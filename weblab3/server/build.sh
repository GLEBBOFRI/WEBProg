#!/bin/bash
set -e

DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" >/dev/null 2>&1 && pwd)"
cd "$DIR"

echo "=== Сборка FastCGI сервера ==="
rm -rf out server.jar
mkdir -p out

javac -J-Xmx256m -encoding UTF-8 -cp "lib/fastcgi-lib.jar" -d out src/main/java/ru/ifmo/se/Server.java

cd out
jar -xf ../lib/fastcgi-lib.jar
jar -cfe ../server.jar ru.ifmo.se.Server .
cd ..

echo "=== Сборка успешно завершена: server.jar ==="
