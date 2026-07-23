export const CUSTOM_THEME_COLORS_KEY = "ugvoice_custom_theme_colors";
export const CUSTOM_THEME_COLORS_EVENT = "ugvoice:custom-theme-colors";
export const UGANDA_FLAG_COLORS_KEY = "ugvoice_uganda_flag_colors";
export const UGANDA_FLAG_COLORS_EVENT = "ugvoice:uganda-flag-colors";

export type CustomThemeColors = {
  colorOne: string;
  colorTwo: string;
  colorThree: string;
  white: "#FFFFFF";
};

export type UgandaFlagColors = {
  black: string;
  yellow: string;
  red: string;
};

export const DEFAULT_CUSTOM_THEME_COLORS: CustomThemeColors = {
  colorOne: "#000000",
  colorTwo: "#FCDC04",
  colorThree: "#D90000",
  white: "#FFFFFF",
};

export const DEFAULT_UGANDA_FLAG_COLORS: UgandaFlagColors = {
  black: "#000000",
  yellow: "#FCDC04",
  red: "#D90000",
};

const HEX_COLOR_PATTERN = /^#[0-9A-Fa-f]{6}$/;

const normalizeColor = (value: unknown, fallback: string) =>
  typeof value === "string" && HEX_COLOR_PATTERN.test(value) ? value.toUpperCase() : fallback;

const customThemeStorageKey = (userId?: number | null) =>
  userId ? `${CUSTOM_THEME_COLORS_KEY}:${userId}` : CUSTOM_THEME_COLORS_KEY;

export const normalizeCustomThemeColors = (colors?: Partial<CustomThemeColors> | null): CustomThemeColors => ({
  colorOne: normalizeColor(colors?.colorOne, DEFAULT_CUSTOM_THEME_COLORS.colorOne),
  colorTwo: normalizeColor(colors?.colorTwo, DEFAULT_CUSTOM_THEME_COLORS.colorTwo),
  colorThree: normalizeColor(colors?.colorThree, DEFAULT_CUSTOM_THEME_COLORS.colorThree),
  white: "#FFFFFF",
});

export const parseCustomThemeColors = (value?: unknown): CustomThemeColors | null => {
  if (!value) {
    return null;
  }

  try {
    const parsed = typeof value === "string" ? JSON.parse(value) : value;
    return normalizeCustomThemeColors(parsed as Partial<CustomThemeColors>);
  } catch {
    return null;
  }
};

export const getContrastText = (hexColor: string) => {
  const normalized = normalizeColor(hexColor, "#000000").replace("#", "");
  const red = parseInt(normalized.slice(0, 2), 16);
  const green = parseInt(normalized.slice(2, 4), 16);
  const blue = parseInt(normalized.slice(4, 6), 16);
  const luminance = (0.299 * red + 0.587 * green + 0.114 * blue) / 255;

  return luminance > 0.62 ? "#111111" : "#FFFFFF";
};

export const getStoredCustomThemeColors = (
  userId?: number | null,
  profileThemeColors?: unknown,
): CustomThemeColors => {
  const profileColors = parseCustomThemeColors(profileThemeColors);

  if (typeof localStorage === "undefined") {
    return profileColors || DEFAULT_CUSTOM_THEME_COLORS;
  }

  try {
    const scopedColors = parseCustomThemeColors(
      localStorage.getItem(customThemeStorageKey(userId)),
    );
    if (scopedColors) {
      return scopedColors;
    }

    if (profileColors) {
      return profileColors;
    }

    return DEFAULT_CUSTOM_THEME_COLORS;
  } catch {
    return profileColors || DEFAULT_CUSTOM_THEME_COLORS;
  }
};

export const storeCustomThemeColors = (colors: CustomThemeColors, userId?: number | null) => {
  const normalizedColors = normalizeCustomThemeColors(colors);

  localStorage.setItem(customThemeStorageKey(userId), JSON.stringify(normalizedColors));
  window.dispatchEvent(
    new CustomEvent(CUSTOM_THEME_COLORS_EVENT, {
      detail: { colors: normalizedColors, userId },
    }),
  );
};

export const getStoredUgandaFlagColors = (): UgandaFlagColors => {
  if (typeof localStorage === "undefined") {
    return DEFAULT_UGANDA_FLAG_COLORS;
  }

  try {
    const stored = JSON.parse(
      localStorage.getItem(UGANDA_FLAG_COLORS_KEY) || "{}",
    ) as Partial<UgandaFlagColors>;

    return {
      black: normalizeColor(stored.black, DEFAULT_UGANDA_FLAG_COLORS.black),
      yellow: normalizeColor(stored.yellow, DEFAULT_UGANDA_FLAG_COLORS.yellow),
      red: normalizeColor(stored.red, DEFAULT_UGANDA_FLAG_COLORS.red),
    };
  } catch {
    return DEFAULT_UGANDA_FLAG_COLORS;
  }
};

export const storeUgandaFlagColors = (colors: UgandaFlagColors) => {
  const normalizedColors: UgandaFlagColors = {
    black: normalizeColor(colors.black, DEFAULT_UGANDA_FLAG_COLORS.black),
    yellow: normalizeColor(colors.yellow, DEFAULT_UGANDA_FLAG_COLORS.yellow),
    red: normalizeColor(colors.red, DEFAULT_UGANDA_FLAG_COLORS.red),
  };

  localStorage.setItem(UGANDA_FLAG_COLORS_KEY, JSON.stringify(normalizedColors));
  window.dispatchEvent(
    new CustomEvent(UGANDA_FLAG_COLORS_EVENT, {
      detail: { colors: normalizedColors },
    }),
  );
};
