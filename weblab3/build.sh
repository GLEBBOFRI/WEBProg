#!/bin/bash
set -e

DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" >/dev/null 2>&1 && pwd)"
cd "$DIR"

echo "=== Сборка проекта WebLab3 ==="

# 1. Попытка сборки через стандартный Maven WAR
if mvn clean package -DskipTests 2>/dev/null; then
    echo "=== Maven успешно собрал target/weblab3.war ==="
    exit 0
fi

echo "Maven war-plugin недоступен онлайн. Используем автономную сборку через Maven compile + jar..."

# 2. Компиляция классов через Maven
mvn compile -DskipTests

# 3. Подготовка структуры WAR
BUILD_DIR="target/war_staging"
rm -rf "$BUILD_DIR" target/weblab3.war
mkdir -p "$BUILD_DIR/WEB-INF/classes"
mkdir -p "$BUILD_DIR/WEB-INF/lib"

# Копируем веб-ресурсы (JSP, CSS, JS, web.xml)
cp -r src/main/webapp/* "$BUILD_DIR/"

# Копируем скомпилированные классы
cp -r target/classes/* "$BUILD_DIR/WEB-INF/classes/"

# Копируем runtime зависимости (Gson)
GSON_JAR=$(find ~/.m2/repository/com/google/code/gson/gson -name "gson-*.jar" | head -n 1)
if [ -n "$GSON_JAR" ]; then
    cp "$GSON_JAR" "$BUILD_DIR/WEB-INF/lib/"
fi

# 4. Упаковка WAR-архива
cd "$BUILD_DIR"
jar -cvf ../weblab3.war . >/dev/null
cd "$DIR"

echo "=== Успешно собран target/weblab3.war ==="
ls -lh target/weblab3.war
