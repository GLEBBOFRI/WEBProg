package ru.ifmo.se.config;

import java.io.InputStream;
import java.util.Arrays;
import java.util.Collections;
import java.util.Properties;
import java.util.Set;
import java.util.stream.Collectors;

/*
 * конфиг приложения: читает свойства из config.properties или system properties, убирая хардкод
 */
public final class AppConfig {
    private static final Properties PROPS = new Properties();

    public static final Set<Double> VALID_X;
    public static final double MIN_Y;
    public static final double MAX_Y;
    public static final Set<Double> VALID_R;
    public static final double CANVAS_MIN_X;
    public static final double CANVAS_MAX_X;
    public static final double EPSILON;

    static {
        // грузим проперти из файла ресурсов в classpath
        try (InputStream in = AppConfig.class.getClassLoader().getResourceAsStream("config.properties")) {
            if (in != null) {
                PROPS.load(in);
            }
        } catch (Exception e) {
            System.err.println("не удалось подсосать config.properties: " + e.getMessage());
        }

        VALID_X = Collections.unmodifiableSet(parseSet(getProperty("coords.x.valid", "-4.0,-3.0,-2.0,-1.0,0.0,1.0,2.0,3.0,4.0")));
        MIN_Y = Double.parseDouble(getProperty("coords.y.min", "-5.0"));
        MAX_Y = Double.parseDouble(getProperty("coords.y.max", "3.0"));
        VALID_R = Collections.unmodifiableSet(parseSet(getProperty("coords.r.valid", "1.0,2.0,3.0,4.0,5.0")));
        CANVAS_MIN_X = Double.parseDouble(getProperty("coords.canvas.x.min", "-4.0"));
        CANVAS_MAX_X = Double.parseDouble(getProperty("coords.canvas.x.max", "4.0"));
        EPSILON = Double.parseDouble(getProperty("coords.epsilon", "0.0000001"));
    }

    private AppConfig() {
    }

    // вытягиваем значение из системных параметров или пропертей файла
    private static String getProperty(String key, String defVal) {
        String sysVal = System.getProperty(key);
        if (sysVal != null && !sysVal.trim().isEmpty()) {
            return sysVal.trim();
        }
        return PROPS.getProperty(key, defVal).trim();
    }

    // парсим строку чисел с запятыми в иммутабельный сет
    private static Set<Double> parseSet(String raw) {
        return Arrays.stream(raw.split(","))
                .map(String::trim)
                .filter(s -> !s.isEmpty())
                .map(Double::parseDouble)
                .collect(Collectors.toSet());
    }
}
