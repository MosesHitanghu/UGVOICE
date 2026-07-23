import { useState } from "react";
import PaletteRoundedIcon from "@mui/icons-material/PaletteRounded";
import RestartAltRoundedIcon from "@mui/icons-material/RestartAltRounded";
import {
  Box,
  Button,
  Stack,
  TextField,
  Typography,
  Paper,
} from "@mui/material";
import { alpha } from "@mui/material/styles";

import {
  DEFAULT_CUSTOM_THEME_COLORS,
  DEFAULT_UGANDA_FLAG_COLORS,
  getContrastText,
  getStoredCustomThemeColors,
  getStoredUgandaFlagColors,
  storeCustomThemeColors,
  storeUgandaFlagColors,
  type CustomThemeColors,
  type UgandaFlagColors,
} from "../../lib/ugandaTheme";
import { api } from "../../lib/api";
import { getStoredUser, storeUser } from "../../lib/session";

type EditableColorKey = "colorOne" | "colorTwo" | "colorThree";
type EditableFlagColorKey = "black" | "yellow" | "red";

const colorFields: Array<{ key: EditableColorKey; label: string }> = [
  { key: "colorOne", label: "Theme color 1" },
  { key: "colorTwo", label: "Theme color 2" },
  { key: "colorThree", label: "Theme color 3" },
];

const flagColorFields: Array<{ key: EditableFlagColorKey; label: string }> = [
  { key: "black", label: "Flag black" },
  { key: "yellow", label: "Flag yellow" },
  { key: "red", label: "Flag red" },
];

const normalizeAccessValue = (value?: string | null) => value?.trim().toLowerCase() || "";

const SettingsPage = () => {
  const currentUser = getStoredUser();
  const currentUserId = currentUser?.id;
  const isAdmin = normalizeAccessValue(currentUser?.role) === "admin";
  const [themeColors, setThemeColors] = useState<CustomThemeColors>(
    getStoredCustomThemeColors(currentUserId, currentUser?.theme_colors),
  );
  const [flagColors, setFlagColors] = useState<UgandaFlagColors>(
    getStoredUgandaFlagColors(),
  );

  const persistThemeColors = async (nextColors: CustomThemeColors) => {
    if (!currentUserId) {
      return;
    }

    try {
      const response = await api.put(`/users/${currentUserId}`, {
        theme_colors: JSON.stringify(nextColors),
      });
      storeUser(response.data);
    } catch {
      // Keep the local profile-scoped preference even if the network save fails.
    }
  };

  const updateThemeColor = (key: EditableColorKey, value: string) => {
    const nextColors = { ...themeColors, [key]: value.toUpperCase(), white: "#FFFFFF" as const };
    setThemeColors(nextColors);
    storeCustomThemeColors(nextColors, currentUserId);
    void persistThemeColors(nextColors);
  };

  const resetThemeColors = () => {
    setThemeColors(DEFAULT_CUSTOM_THEME_COLORS);
    storeCustomThemeColors(DEFAULT_CUSTOM_THEME_COLORS, currentUserId);
    void persistThemeColors(DEFAULT_CUSTOM_THEME_COLORS);
  };

  const updateFlagColor = (key: EditableFlagColorKey, value: string) => {
    const nextColors = { ...flagColors, [key]: value.toUpperCase() };
    setFlagColors(nextColors);
    storeUgandaFlagColors(nextColors);
  };

  const resetFlagColors = () => {
    setFlagColors(DEFAULT_UGANDA_FLAG_COLORS);
    storeUgandaFlagColors(DEFAULT_UGANDA_FLAG_COLORS);
  };

  return (
    <Stack spacing={3}>
      <Paper elevation={3} sx={{ p: 3 }}>
        <Stack direction="row" spacing={1.5} alignItems="center">
          <PaletteRoundedIcon color="primary" />
          <Box>
            <Typography variant="h5" sx={{ fontWeight: 700 }}>
              Settings
            </Typography>
            <Typography color="text.secondary" sx={{ mt: 0.5 }}>
              Choose three system theme colors. White is always included.
            </Typography>
          </Box>
        </Stack>
      </Paper>

      <Paper elevation={3} sx={{ p: 3 }}>
        <Stack spacing={2.5}>
          <Stack
            direction={{ xs: "column", sm: "row" }}
            justifyContent="space-between"
            alignItems={{ xs: "stretch", sm: "center" }}
            spacing={1.5}
          >
            <Box>
              <Typography variant="h6" sx={{ fontWeight: 700 }}>
                Theme Colors
              </Typography>
              <Typography color="text.secondary" sx={{ mt: 0.5 }}>
                These colors are used across navigation, buttons, charts, highlights, and panels.
              </Typography>
            </Box>
            <Button
              variant="outlined"
              startIcon={<RestartAltRoundedIcon />}
              onClick={resetThemeColors}
              sx={{ alignSelf: { xs: "flex-start", sm: "center" } }}
            >
              Reset
            </Button>
          </Stack>

          <Box
            sx={{
              display: "grid",
              gridTemplateColumns: {
                xs: "1fr",
                md: "repeat(3, minmax(0, 1fr))",
              },
              gap: 2,
            }}
          >
            {colorFields.map((field) => (
              <Paper
                key={field.key}
                variant="outlined"
                sx={{
                  p: 2,
                  borderColor: alpha(themeColors[field.key], 0.42),
                }}
              >
                <Stack spacing={1.5}>
                  <TextField
                    type="color"
                    value={themeColors[field.key]}
                    onChange={(event) => updateThemeColor(field.key, event.target.value)}
                    fullWidth
                    inputProps={{
                      "aria-label": field.label,
                    }}
                    sx={{
                      "& input": {
                        position: "absolute",
                        inset: 0,
                        width: "100%",
                        height: "100%",
                        opacity: 0,
                        cursor: "pointer",
                      },
                      "& .MuiInputBase-root": {
                        position: "relative",
                        minHeight: 86,
                        bgcolor: themeColors[field.key],
                        color: getContrastText(themeColors[field.key]),
                        cursor: "pointer",
                        overflow: "hidden",
                        "&:hover": {
                          bgcolor: themeColors[field.key],
                        },
                        "& fieldset": {
                          borderColor: "transparent",
                        },
                        "&:hover fieldset": {
                          borderColor: alpha(getContrastText(themeColors[field.key]), 0.5),
                        },
                      },
                      "& .MuiInputBase-root::before": {
                        content: `"${field.label}"`,
                        position: "absolute",
                        inset: 0,
                        display: "grid",
                        placeItems: "center",
                        fontWeight: 700,
                        pointerEvents: "none",
                      },
                      "& .MuiInputBase-root::after": {
                        content: `"${themeColors[field.key]}"`,
                        position: "absolute",
                        left: 12,
                        bottom: 10,
                        fontSize: "0.75rem",
                        fontWeight: 700,
                        opacity: 0.82,
                        pointerEvents: "none",
                      },
                    }}
                  />
                </Stack>
              </Paper>
            ))}
          </Box>
        </Stack>
      </Paper>

      {isAdmin ? (
        <Paper elevation={3} sx={{ p: 3 }}>
          <Stack spacing={2.5}>
            <Stack
              direction={{ xs: "column", sm: "row" }}
              justifyContent="space-between"
              alignItems={{ xs: "stretch", sm: "center" }}
              spacing={1.5}
            >
              <Box>
                <Typography variant="h6" sx={{ fontWeight: 700 }}>
                  Uganda Flag Appbar Colors
                </Typography>
                <Typography color="text.secondary" sx={{ mt: 0.5 }}>
                  These colors control the black appbar and the yellow and red flag layers.
                </Typography>
              </Box>
              <Button
                variant="outlined"
                startIcon={<RestartAltRoundedIcon />}
                onClick={resetFlagColors}
                sx={{ alignSelf: { xs: "flex-start", sm: "center" } }}
              >
                Reset Flag
              </Button>
            </Stack>

            <Box
              sx={{
                display: "grid",
                gridTemplateColumns: {
                  xs: "1fr",
                  md: "repeat(3, minmax(0, 1fr))",
                },
                gap: 2,
              }}
            >
              {flagColorFields.map((field) => (
                <Paper
                  key={field.key}
                  variant="outlined"
                  sx={{
                    p: 2,
                    borderColor: alpha(flagColors[field.key], 0.42),
                  }}
                >
                  <TextField
                    type="color"
                    value={flagColors[field.key]}
                    onChange={(event) => updateFlagColor(field.key, event.target.value)}
                    fullWidth
                    inputProps={{
                      "aria-label": field.label,
                    }}
                    sx={{
                      "& input": {
                        position: "absolute",
                        inset: 0,
                        width: "100%",
                        height: "100%",
                        opacity: 0,
                        cursor: "pointer",
                      },
                      "& .MuiInputBase-root": {
                        position: "relative",
                        minHeight: 86,
                        bgcolor: flagColors[field.key],
                        color: getContrastText(flagColors[field.key]),
                        cursor: "pointer",
                        overflow: "hidden",
                        "&:hover": {
                          bgcolor: flagColors[field.key],
                        },
                        "& fieldset": {
                          borderColor: "transparent",
                        },
                        "&:hover fieldset": {
                          borderColor: alpha(getContrastText(flagColors[field.key]), 0.5),
                        },
                      },
                      "& .MuiInputBase-root::before": {
                        content: `"${field.label}"`,
                        position: "absolute",
                        inset: 0,
                        display: "grid",
                        placeItems: "center",
                        fontWeight: 700,
                        pointerEvents: "none",
                      },
                      "& .MuiInputBase-root::after": {
                        content: `"${flagColors[field.key]}"`,
                        position: "absolute",
                        left: 12,
                        bottom: 10,
                        fontSize: "0.75rem",
                        fontWeight: 700,
                        opacity: 0.82,
                        pointerEvents: "none",
                      },
                    }}
                  />
                </Paper>
              ))}
            </Box>
          </Stack>
        </Paper>
      ) : null}
    </Stack>
  );
};

export default SettingsPage;
