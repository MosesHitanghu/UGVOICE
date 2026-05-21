import { alpha, styled } from "@mui/material/styles";
import Box from "@mui/material/Box";
import MuiAppBar, {
  type AppBarProps as MuiAppBarProps,
} from "@mui/material/AppBar";
import Toolbar from "@mui/material/Toolbar";
import CssBaseline from "@mui/material/CssBaseline";
import Typography from "@mui/material/Typography";

import IconButton from "@mui/material/IconButton";
import Badge from "@mui/material/Badge";
import Alert from "@mui/material/Alert";
import Button from "@mui/material/Button";
import CircularProgress from "@mui/material/CircularProgress";
import Divider from "@mui/material/Divider";
import Drawer from "@mui/material/Drawer";
import InputAdornment from "@mui/material/InputAdornment";
import Menu from "@mui/material/Menu";
import MenuItem from "@mui/material/MenuItem";
import TextField from "@mui/material/TextField";
import MenuIcon from "@mui/icons-material/Menu";
import SideList from "./SideList";
import { Box as MuiBox, Stack, Tooltip } from "@mui/material";
import InfoIcon from "@mui/icons-material/Info";
import GroupIcon from "@mui/icons-material/Group";
import HomeRoundedIcon from "@mui/icons-material/HomeRounded";
import AccountCircleRoundedIcon from "@mui/icons-material/AccountCircleRounded";
import AddBusinessRoundedIcon from "@mui/icons-material/AddBusinessRounded";
import CloseRoundedIcon from "@mui/icons-material/CloseRounded";
import InsightsRoundedIcon from "@mui/icons-material/InsightsRounded";
import KeyboardArrowDownRoundedIcon from "@mui/icons-material/KeyboardArrowDownRounded";
import LogoutRoundedIcon from "@mui/icons-material/LogoutRounded";
import SettingsRoundedIcon from "@mui/icons-material/SettingsRounded";
import SyncAltRoundedIcon from "@mui/icons-material/SyncAltRounded";
import { useLocation, useNavigate } from "react-router-dom";
import { createTheme, ThemeProvider } from "@mui/material/styles";
import { useMemo, useState, useEffect } from "react";
import { DarkMode, LightMode } from "@mui/icons-material";
import NotificationsRoundedIcon from "@mui/icons-material/NotificationsRounded";
import VisibilityIcon from "@mui/icons-material/Visibility";
import VisibilityOffIcon from "@mui/icons-material/VisibilityOff";
import { api, type ApiUser } from "../../lib/api";
import {
  clearStoredUser,
  getSessionTimeRemainingMs,
  getStoredUser,
  storeUser,
  touchSessionActivity,
} from "../../lib/session";
import ProfilePage from "./ProfilePage";
import CountryAutocomplete from "../../components/CountryAutocomplete";
import PhoneNumberField from "../../components/PhoneNumberField";
import UgandaLocationFields from "../../components/UgandaLocationFields";
import { rebasePhoneNumberToCountry } from "../../lib/countryPhoneMeta";
import {
  CUSTOM_THEME_COLORS_EVENT,
  UGANDA_FLAG_COLORS_EVENT,
  getContrastText,
  getStoredCustomThemeColors,
  getStoredUgandaFlagColors,
  type CustomThemeColors,
  type UgandaFlagColors,
} from "../../lib/ugandaTheme";
const drawerWidth = 240;
const LAST_SEEN_PUBLIC_POST_KEY = "ugvoice_last_seen_public_post_id";
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const MOBILE_PATTERN = /^[+\d][\d\s-]{6,}$/;
const UPPERCASE_PATTERN = /[A-Z]/;
const LOWERCASE_PATTERN = /[a-z]/;
const NUMBER_PATTERN = /\d/;
const SYMBOL_PATTERN = /[^A-Za-z0-9]/;

type OrganizationAccountForm = {
  username: string;
  email: string;
  password: string;
  mobile_number: string;
  visibility: string;
  type: string;
  company_name: string;
  company_country: string;
  district_id: number | null;
  constituency_id: number | null;
  subcounty_id: number | null;
  parish_id: number | null;
  type_of_business: string;
  number_of_employees: string;
};

type ChildAccount = {
  id: number;
  username: string;
  company_name?: string | null;
  email?: string | null;
  mobile_number?: string | null;
  fname?: string | null;
  lname?: string | null;
};

type ParentSwitchForm = {
  email_or_mobile_number: string;
  password: string;
};

const initialOrganizationAccountForm: OrganizationAccountForm = {
  username: "",
  email: "",
  password: "",
  mobile_number: "",
  visibility: "public",
  type: "business",
  company_name: "",
  company_country: "",
  district_id: null,
  constituency_id: null,
  subcounty_id: null,
  parish_id: null,
  type_of_business: "",
  number_of_employees: "",
};

interface AppBarProps extends MuiAppBarProps {
  open?: boolean;
}

const AppBar = styled(MuiAppBar, {
  shouldForwardProp: (prop) => prop !== "open",
})<AppBarProps>(({ theme }) => ({
  zIndex: theme.zIndex.drawer + 1,
  transition: theme.transitions.create(["width", "margin"], {
    easing: theme.transitions.easing.sharp,
    duration: theme.transitions.duration.leavingScreen,
  }),
  variants: [
    {
      props: ({ open }) => open,
      style: {
        marginLeft: drawerWidth,
        width: `calc(100% - ${drawerWidth}px)`,
        transition: theme.transitions.create(["width", "margin"], {
          easing: theme.transitions.easing.sharp,
          duration: theme.transitions.duration.enteringScreen,
        }),
      },
    },
  ],
}));

export default function DashboardLayout() {
  const [open, setOpen] = useState(false);
  const [mode, setMode] = useState(() => localStorage.getItem("themeMode") || "light");
  const [themeColors, setThemeColors] = useState<CustomThemeColors>(
    getStoredCustomThemeColors,
  );
  const [flagColors, setFlagColors] = useState<UgandaFlagColors>(
    getStoredUgandaFlagColors,
  );
  const [notificationCount, setNotificationCount] = useState(0);
  const [latestPublicPostId, setLatestPublicPostId] = useState(0);
  const [profileDrawerOpen, setProfileDrawerOpen] = useState(false);
  const [accountMenuAnchorEl, setAccountMenuAnchorEl] = useState<null | HTMLElement>(null);
  const [childAccounts, setChildAccounts] = useState<ChildAccount[]>([]);
  const [parentAccount, setParentAccount] = useState<ChildAccount | null>(null);
  const [switchAccountLoading, setSwitchAccountLoading] = useState(false);
  const [parentSwitchDrawerOpen, setParentSwitchDrawerOpen] = useState(false);
  const [parentSwitchTarget, setParentSwitchTarget] = useState<ChildAccount | null>(null);
  const [parentSwitchForm, setParentSwitchForm] = useState<ParentSwitchForm>({
    email_or_mobile_number: "",
    password: "",
  });
  const [parentSwitchShowPassword, setParentSwitchShowPassword] = useState(false);
  const [parentSwitchSubmitted, setParentSwitchSubmitted] = useState(false);
  const [parentSwitchError, setParentSwitchError] = useState("");
  const [addAccountDrawerOpen, setAddAccountDrawerOpen] = useState(false);
  const [addAccountForm, setAddAccountForm] = useState<OrganizationAccountForm>(
    initialOrganizationAccountForm,
  );
  const [addAccountShowPassword, setAddAccountShowPassword] = useState(false);
  const [addAccountSubmitted, setAddAccountSubmitted] = useState(false);
  const [addAccountLoading, setAddAccountLoading] = useState(false);
  const [addAccountError, setAddAccountError] = useState("");
  const [addAccountUsernameChecking, setAddAccountUsernameChecking] = useState(false);
  const [addAccountUsernameAvailable, setAddAccountUsernameAvailable] = useState<boolean | null>(null);
  const [addAccountUsernameCheckedValue, setAddAccountUsernameCheckedValue] = useState("");
  const [addAccountEmailChecking, setAddAccountEmailChecking] = useState(false);
  const [addAccountEmailAvailable, setAddAccountEmailAvailable] = useState<boolean | null>(null);
  const [addAccountEmailCheckedValue, setAddAccountEmailCheckedValue] = useState("");
  const [addAccountMobileChecking, setAddAccountMobileChecking] = useState(false);
  const [addAccountMobileAvailable, setAddAccountMobileAvailable] = useState<boolean | null>(null);
  const [addAccountMobileCheckedValue, setAddAccountMobileCheckedValue] = useState("");
  const location = useLocation();
  const navigate = useNavigate();
  const currentUser = getStoredUser();
  const currentUserId = currentUser?.id;
  const accountMenuOpen = Boolean(accountMenuAnchorEl);

  // Save preference
  useEffect(() => {
    localStorage.setItem("themeMode", mode);
  }, [mode]);

  useEffect(() => {
    const handleAccentChange = (event: Event) => {
      const customEvent = event as CustomEvent<{ colors?: CustomThemeColors }>;
      setThemeColors(customEvent.detail?.colors || getStoredCustomThemeColors());
    };

    window.addEventListener(CUSTOM_THEME_COLORS_EVENT, handleAccentChange);
    window.addEventListener("storage", handleAccentChange);

    return () => {
      window.removeEventListener(CUSTOM_THEME_COLORS_EVENT, handleAccentChange);
      window.removeEventListener("storage", handleAccentChange);
    };
  }, []);

  useEffect(() => {
    const handleFlagColorChange = (event: Event) => {
      const customEvent = event as CustomEvent<{ colors?: UgandaFlagColors }>;
      setFlagColors(customEvent.detail?.colors || getStoredUgandaFlagColors());
    };

    window.addEventListener(UGANDA_FLAG_COLORS_EVENT, handleFlagColorChange);
    window.addEventListener("storage", handleFlagColorChange);

    return () => {
      window.removeEventListener(UGANDA_FLAG_COLORS_EVENT, handleFlagColorChange);
      window.removeEventListener("storage", handleFlagColorChange);
    };
  }, []);

  useEffect(() => {
    if (!currentUserId) {
      return;
    }

    let lastActivityUpdate = Date.now();

    const recordActivity = () => {
      const now = Date.now();
      if (now - lastActivityUpdate < 15000) {
        return;
      }
      lastActivityUpdate = now;
      touchSessionActivity();
    };

    const handleSessionExpiry = () => {
      clearStoredUser();
      setProfileDrawerOpen(false);
      navigate("/", { replace: true });
    };

    touchSessionActivity();

    const activityEvents: Array<keyof WindowEventMap> = [
      "click",
      "keydown",
      "mousemove",
      "scroll",
      "touchstart",
    ];

    activityEvents.forEach((eventName) => {
      window.addEventListener(eventName, recordActivity, { passive: true });
    });

    const intervalId = window.setInterval(() => {
      if (getSessionTimeRemainingMs() <= 0) {
        handleSessionExpiry();
      }
    }, 30000);

    return () => {
      activityEvents.forEach((eventName) => {
        window.removeEventListener(eventName, recordActivity);
      });
      window.clearInterval(intervalId);
    };
  }, [currentUserId, navigate]);

  useEffect(() => {
    if (!currentUserId) {
      setNotificationCount(0);
      return;
    }

    let cancelled = false;

    const syncNotifications = async () => {
      try {
        const response = await api.get<Array<{ id: number }>>("/posts", {
          params: {
            viewer_user_id: currentUserId,
            scope: "public",
            limit: 20,
            offset: 0,
          },
        });

        if (cancelled) {
          return;
        }

        const posts = response.data;
        const nextLatestPostId = posts.reduce(
          (highest, post) => Math.max(highest, post.id),
          0,
        );
        setLatestPublicPostId(nextLatestPostId);

        const storedLastSeen = Number(
          localStorage.getItem(LAST_SEEN_PUBLIC_POST_KEY) || 0,
        );

        if (!storedLastSeen) {
          localStorage.setItem(
            LAST_SEEN_PUBLIC_POST_KEY,
            String(nextLatestPostId),
          );
          setNotificationCount(0);
          return;
        }

        if (location.pathname.startsWith("/dashboard/feed")) {
          localStorage.setItem(
            LAST_SEEN_PUBLIC_POST_KEY,
            String(nextLatestPostId),
          );
          setNotificationCount(0);
          return;
        }

        setNotificationCount(
          posts.filter((post) => post.id > storedLastSeen).length,
        );
      } catch {
        if (!cancelled) {
          setNotificationCount(0);
        }
      }
    };

    void syncNotifications();
    const intervalId = window.setInterval(() => {
      void syncNotifications();
    }, 45000);

    return () => {
      cancelled = true;
      window.clearInterval(intervalId);
    };
  }, [currentUserId, location.pathname]);

  useEffect(() => {
    const loadChildAccounts = async () => {
      if (!currentUserId) {
        setChildAccounts([]);
        setParentAccount(null);
        return;
      }

      try {
        if (currentUser?.parent_user_id) {
          const response = await api.get<ChildAccount>(
            `/users/${currentUser.parent_user_id}`,
            {
              params: {
                viewer_user_id: currentUserId,
              },
            },
          );
          setParentAccount(response.data);
          setChildAccounts([]);
          return;
        }

        const response = await api.get<ChildAccount[]>(
          `/users/${currentUserId}/child-accounts`,
          {
            params: {
              viewer_user_id: currentUserId,
            },
          },
        );
        setChildAccounts(response.data);
        setParentAccount(null);
      } catch {
        setChildAccounts([]);
        setParentAccount(null);
      }
    };

    void loadChildAccounts();
  }, [currentUserId, currentUser?.parent_user_id]);

  useEffect(() => {
    if (!addAccountDrawerOpen) {
      return;
    }

    const username = addAccountForm.username.trim();
    if (username.length < 3) {
      setAddAccountUsernameChecking(false);
      setAddAccountUsernameAvailable(null);
      setAddAccountUsernameCheckedValue("");
      return;
    }

    const timeoutId = window.setTimeout(async () => {
      setAddAccountUsernameChecking(true);
      try {
        const response = await api.get<{ available: boolean; username: string }>(
          "/users/username-availability",
          {
            params: { username },
          },
        );
        setAddAccountUsernameAvailable(response.data.available);
        setAddAccountUsernameCheckedValue(response.data.username);
      } catch {
        setAddAccountUsernameAvailable(null);
        setAddAccountUsernameCheckedValue(username);
      } finally {
        setAddAccountUsernameChecking(false);
      }
    }, 350);

    return () => {
      window.clearTimeout(timeoutId);
    };
  }, [addAccountDrawerOpen, addAccountForm.username]);

  useEffect(() => {
    if (!addAccountDrawerOpen) {
      return;
    }

    const email = addAccountForm.email.trim();
    if (!email || !EMAIL_PATTERN.test(email)) {
      setAddAccountEmailChecking(false);
      setAddAccountEmailAvailable(null);
      setAddAccountEmailCheckedValue("");
      return;
    }

    const timeoutId = window.setTimeout(async () => {
      setAddAccountEmailChecking(true);
      try {
        const response = await api.get<{
          email?: { available: boolean; value: string };
        }>("/users/signup-availability", {
          params: { email },
        });
        setAddAccountEmailAvailable(response.data.email?.available ?? null);
        setAddAccountEmailCheckedValue(response.data.email?.value ?? email);
      } catch {
        setAddAccountEmailAvailable(null);
        setAddAccountEmailCheckedValue(email);
      } finally {
        setAddAccountEmailChecking(false);
      }
    }, 350);

    return () => {
      window.clearTimeout(timeoutId);
    };
  }, [addAccountDrawerOpen, addAccountForm.email]);

  useEffect(() => {
    if (!addAccountDrawerOpen) {
      return;
    }

    const mobileNumber = addAccountForm.mobile_number.trim();
    if (!mobileNumber || !MOBILE_PATTERN.test(mobileNumber)) {
      setAddAccountMobileChecking(false);
      setAddAccountMobileAvailable(null);
      setAddAccountMobileCheckedValue("");
      return;
    }

    const timeoutId = window.setTimeout(async () => {
      setAddAccountMobileChecking(true);
      try {
        const response = await api.get<{
          mobile_number?: { available: boolean; value: string };
        }>("/users/signup-availability", {
          params: { mobile_number: mobileNumber },
        });
        setAddAccountMobileAvailable(
          response.data.mobile_number?.available ?? null,
        );
        setAddAccountMobileCheckedValue(
          response.data.mobile_number?.value ?? mobileNumber,
        );
      } catch {
        setAddAccountMobileAvailable(null);
        setAddAccountMobileCheckedValue(mobileNumber);
      } finally {
        setAddAccountMobileChecking(false);
      }
    }, 350);

    return () => {
      window.clearTimeout(timeoutId);
    };
  }, [addAccountDrawerOpen, addAccountForm.mobile_number]);

  const resetAddAccountState = () => {
    setAddAccountForm(initialOrganizationAccountForm);
    setAddAccountShowPassword(false);
    setAddAccountSubmitted(false);
    setAddAccountLoading(false);
    setAddAccountError("");
    setAddAccountUsernameChecking(false);
    setAddAccountUsernameAvailable(null);
    setAddAccountUsernameCheckedValue("");
    setAddAccountEmailChecking(false);
    setAddAccountEmailAvailable(null);
    setAddAccountEmailCheckedValue("");
    setAddAccountMobileChecking(false);
    setAddAccountMobileAvailable(null);
    setAddAccountMobileCheckedValue("");
  };

  const getAddAccountUsernameError = () => {
    if (!addAccountForm.username.trim()) {
      return "Username is required.";
    }
    if (addAccountForm.username.trim().length < 3) {
      return "Username must be at least 3 characters.";
    }
    if (
      addAccountUsernameCheckedValue === addAccountForm.username.trim() &&
      addAccountUsernameAvailable === false
    ) {
      return "Username is already taken.";
    }
    return "";
  };

  const getAddAccountEmailError = () => {
    if (!addAccountForm.email.trim()) {
      return "Email is required.";
    }
    if (!EMAIL_PATTERN.test(addAccountForm.email.trim())) {
      return "Enter a valid email address.";
    }
    if (
      addAccountEmailCheckedValue === addAccountForm.email.trim() &&
      addAccountEmailAvailable === false
    ) {
      return "An account is already associated with this email address.";
    }
    return "";
  };

  const getAddAccountPasswordError = () => {
    if (!addAccountForm.password.trim()) {
      return "Password is required.";
    }
    if (addAccountForm.password.length < 8) {
      return "Password must be at least 8 characters.";
    }
    if (!UPPERCASE_PATTERN.test(addAccountForm.password)) {
      return "Password must include at least one uppercase letter.";
    }
    if (!LOWERCASE_PATTERN.test(addAccountForm.password)) {
      return "Password must include at least one lowercase letter.";
    }
    if (!NUMBER_PATTERN.test(addAccountForm.password)) {
      return "Password must include at least one number.";
    }
    if (!SYMBOL_PATTERN.test(addAccountForm.password)) {
      return "Password must include at least one symbol.";
    }
    return "";
  };

  const getAddAccountCompanyNameError = () => {
    if (!addAccountForm.company_name.trim()) {
      return "Organization name is required.";
    }
    return "";
  };

  const getAddAccountMobileError = () => {
    if (!addAccountForm.mobile_number.trim()) {
      return "";
    }
    if (!MOBILE_PATTERN.test(addAccountForm.mobile_number.trim())) {
      return "Enter a valid mobile number.";
    }
    if (
      addAccountMobileCheckedValue === addAccountForm.mobile_number.trim() &&
      addAccountMobileAvailable === false
    ) {
      return "An account is already associated with this mobile number.";
    }
    return "";
  };

  const canSubmitAddAccount = () => {
    if (!addAccountForm.username.trim() || addAccountForm.username.trim().length < 3) {
      return false;
    }
    if (!addAccountForm.email.trim() || !EMAIL_PATTERN.test(addAccountForm.email.trim())) {
      return false;
    }
    if (!addAccountForm.company_name.trim()) {
      return false;
    }
    if (!addAccountForm.password.trim()) {
      return false;
    }
    if (getAddAccountPasswordError()) {
      return false;
    }
    return true;
  };

  const handleOpenProfileDrawer = () => {
    setAccountMenuAnchorEl(null);
    setProfileDrawerOpen(true);
  };

  const handleOpenAddAccountDrawer = () => {
    setAccountMenuAnchorEl(null);
    resetAddAccountState();
    setAddAccountDrawerOpen(true);
  };

  const handleLogout = () => {
    clearStoredUser();
    setAccountMenuAnchorEl(null);
    setProfileDrawerOpen(false);
    navigate("/", { replace: true });
  };

  const handleAddAccountChange = (
    event: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>,
  ) => {
    const { name, value } = event.target;
    setAddAccountForm((current) => ({
      ...current,
      [name]: value,
    }));
  };

  const handleAddAccountCountryChange = (country: string) => {
    setAddAccountForm((current) => ({
      ...current,
      company_country: country,
      mobile_number: rebasePhoneNumberToCountry(
        current.mobile_number,
        current.company_country,
        country,
      ),
    }));
  };

  const handleAddAccountLocationChange = (nextValue: {
    district_id?: number | null;
    constituency_id?: number | null;
    subcounty_id?: number | null;
    parish_id?: number | null;
  }) => {
    setAddAccountForm((current) => ({
      ...current,
      district_id: nextValue.district_id ?? null,
      constituency_id: nextValue.constituency_id ?? null,
      subcounty_id: nextValue.subcounty_id ?? null,
      parish_id: nextValue.parish_id ?? null,
    }));
  };

  const handleAddAccountSubmit = async (
    event: React.FormEvent<HTMLFormElement>,
  ) => {
    event.preventDefault();
    setAddAccountSubmitted(true);
    if (
      !currentUserId ||
      !canSubmitAddAccount() ||
      getAddAccountUsernameError() ||
      getAddAccountEmailError() ||
      getAddAccountPasswordError() ||
      getAddAccountCompanyNameError() ||
      getAddAccountMobileError() ||
      addAccountUsernameChecking ||
      addAccountEmailChecking ||
      addAccountMobileChecking
    ) {
      return;
    }

    setAddAccountLoading(true);
    setAddAccountError("");

    try {
      await api.post("/signup", {
        ...addAccountForm,
        username: addAccountForm.username.trim(),
        email: addAccountForm.email.trim(),
        password: addAccountForm.password,
        mobile_number: addAccountForm.mobile_number.trim() || null,
        type: addAccountForm.type,
        company_name: addAccountForm.company_name.trim(),
        company_country: addAccountForm.company_country.trim() || null,
        district_id: addAccountForm.district_id,
        constituency_id: addAccountForm.constituency_id,
        subcounty_id: addAccountForm.subcounty_id,
        parish_id: addAccountForm.parish_id,
        type_of_business: addAccountForm.type_of_business.trim() || null,
        number_of_employees: addAccountForm.number_of_employees
          ? Number(addAccountForm.number_of_employees)
          : null,
        parent_user_id: currentUserId,
        visibility: addAccountForm.visibility,
      });
      resetAddAccountState();
      setAddAccountDrawerOpen(false);
    } catch (caughtError: unknown) {
      const message =
        typeof caughtError === "object" &&
        caughtError !== null &&
        "response" in caughtError
          ? (
              caughtError as {
                response?: { data?: { detail?: string } };
              }
            ).response?.data?.detail || "Unable to create organization account."
          : "Unable to create organization account.";
      setAddAccountError(message);
    } finally {
      setAddAccountLoading(false);
    }
  };

  const theme = useMemo(
    () => {
      const primary = themeColors.colorOne;
      const secondary = themeColors.colorTwo;
      const tertiary = themeColors.colorThree;
      const primaryContrast = getContrastText(primary);
      const secondaryContrast = getContrastText(secondary);
      const tertiaryContrast = getContrastText(tertiary);

      return createTheme({
        palette: {
          mode: mode === "dark" ? "dark" : "light",
          primary: {
            main: primary,
            light: primary,
            dark: primary,
            contrastText: primaryContrast,
          },
          secondary: {
            main: secondary,
            light: secondary,
            dark: secondary,
            contrastText: secondaryContrast,
          },
          background:
            mode === "dark"
              ? {
                  default: "#000000",
                  paper: "#111111",
                }
              : {
                  default: "#FFFFFF",
                  paper: "#FFFFFF",
                },
          text:
            mode === "dark"
              ? {
                  primary: "#FFFFFF",
                  secondary: "#D1D5DB",
                }
              : {
                  primary: "#111111",
                  secondary: "#4B5563",
                },
          divider:
            mode === "dark"
              ? alpha("#FFFFFF", 0.14)
              : alpha("#111111", 0.12),
          action: {
            hover:
              mode === "dark"
                ? alpha(secondary, 0.16)
                : alpha(primary, 0.1),
            selected:
              mode === "dark"
                ? alpha(secondary, 0.22)
                : alpha(tertiary, 0.13),
          },
          warning: {
            main: tertiary,
            light: tertiary,
            dark: tertiary,
            contrastText: tertiaryContrast,
          },
          info: {
            main: secondary,
            light: secondary,
            dark: secondary,
            contrastText: secondaryContrast,
          },
          error: {
            main: tertiary,
            light: tertiary,
            dark: tertiary,
            contrastText: tertiaryContrast,
          },
        },
        shape: {
          borderRadius: 0,
        },
        components: {
          MuiCssBaseline: {
            styleOverrides: {
              body: {
                backgroundColor:
                  mode === "dark" ? "#000000" : "#FFFFFF",
                color: mode === "dark" ? "#FFFFFF" : "#111111",
              },
            },
          },
          MuiAppBar: {
            styleOverrides: {
              root: {
                backgroundColor: alpha(flagColors.black, 0.92),
                color: "#FFFFFF",
                backdropFilter: "blur(14px)",
                borderBottom: 0,
                boxShadow: "none",
                backgroundImage: "none",
                "&::before": {
                  content: '""',
                  position: "absolute",
                  left: 0,
                  right: 0,
                  bottom: 4,
                  height: 4,
                  backgroundColor: flagColors.yellow,
                },
                "&::after": {
                  content: '""',
                  position: "absolute",
                  left: 0,
                  right: 0,
                  bottom: 0,
                  height: 4,
                  backgroundColor: flagColors.red,
                },
              },
            },
          },
          MuiDrawer: {
            styleOverrides: {
              paper: {
                backgroundColor: mode === "dark" ? "#111111" : "#FFFFFF",
                color: mode === "dark" ? "#FFFFFF" : "#111111",
                borderRight: `1px solid ${
                  mode === "dark"
                    ? alpha("#FFFFFF", 0.1)
                    : alpha("#111111", 0.1)
                }`,
                backgroundImage: "none",
              },
            },
          },
          MuiPaper: {
            styleOverrides: {
              root: {
                backgroundImage: "none",
                borderRadius: 0,
              },
            },
          },
          MuiButton: {
            styleOverrides: {
              containedPrimary: {
                backgroundColor: primary,
                color: primaryContrast,
                boxShadow: "none",
                "&:hover": {
                  backgroundColor: secondary,
                  color: secondaryContrast,
                  boxShadow: "none",
                },
              },
              containedSecondary: {
                backgroundColor: secondary,
                color: secondaryContrast,
                boxShadow: "none",
                "&:hover": {
                  backgroundColor: tertiary,
                  color: tertiaryContrast,
                  boxShadow: "none",
                },
              },
              textPrimary: {
                color: primary,
                "&:hover": {
                  backgroundColor: alpha(primary, 0.08),
                },
              },
              outlined: {
                borderColor:
                  mode === "dark"
                    ? alpha("#FFFFFF", 0.22)
                    : alpha("#111111", 0.18),
              },
            },
          },
          MuiTooltip: {
            styleOverrides: {
              tooltip: {
                backgroundColor: "#000000",
                color: "#FFFFFF",
                border: `1px solid ${alpha("#FFFFFF", 0.08)}`,
              },
              arrow: {
                color: "#000000",
              },
            },
          },
        },
      });
    },
    [mode, themeColors, flagColors],
  );

  const toggleTheme = () => {
    setMode((prev) => (prev === "light" ? "dark" : "light"));
  };
  const handleDrawerOpen = () => {
    setOpen(true);
  };
  const handleNotificationsClick = () => {
    if (latestPublicPostId) {
      localStorage.setItem(
        LAST_SEEN_PUBLIC_POST_KEY,
        String(latestPublicPostId),
      );
    }
    setNotificationCount(0);
    window.location.assign("/dashboard/feed");
  };

  const handleOpenOwnPublicProfile = () => {
    setAccountMenuAnchorEl(null);
    if (!currentUserId) {
      return;
    }
    window.location.assign(`/dashboard/users/${currentUserId}`);
  };

  const handleSwitchAccount = async (targetUserId: number) => {
    if (!currentUserId) {
      return;
    }

    try {
      setSwitchAccountLoading(true);
      const response = await api.post<{
        message: string;
        user: ApiUser;
      }>(`/users/${targetUserId}/switch-account`, null, {
        params: {
          actor_user_id: currentUserId,
        },
      });
      storeUser(response.data.user);
      setAccountMenuAnchorEl(null);
      navigate(`/dashboard/users/${targetUserId}`, { replace: true });
    } catch {
      setAccountMenuAnchorEl(null);
    } finally {
      setSwitchAccountLoading(false);
    }
  };

  const openParentSwitchDrawer = (account: ChildAccount) => {
    setAccountMenuAnchorEl(null);
    setParentSwitchTarget(account);
    setParentSwitchForm({
      email_or_mobile_number: account.email || "",
      password: "",
    });
    setParentSwitchShowPassword(false);
    setParentSwitchSubmitted(false);
    setParentSwitchError("");
    setParentSwitchDrawerOpen(true);
  };

  const getParentSwitchIdentifierError = () => {
    const value = parentSwitchForm.email_or_mobile_number.trim();
    if (!value) {
      return "Parent email or mobile number is required.";
    }
    if (value.includes("@") && !EMAIL_PATTERN.test(value)) {
      return "Enter a valid email address.";
    }
    if (!value.includes("@") && !MOBILE_PATTERN.test(value)) {
      return "Enter a valid mobile number.";
    }
    return "";
  };

  const getParentSwitchPasswordError = () => {
    if (!parentSwitchForm.password.trim()) {
      return "Password is required.";
    }
    return "";
  };

  const handleParentSwitchSubmit = async (
    event: React.FormEvent<HTMLFormElement>,
  ) => {
    event.preventDefault();
    setParentSwitchSubmitted(true);
    if (
      !currentUserId ||
      !parentSwitchTarget ||
      getParentSwitchIdentifierError() ||
      getParentSwitchPasswordError()
    ) {
      return;
    }

    try {
      setSwitchAccountLoading(true);
      setParentSwitchError("");
      const response = await api.post<{
        message: string;
        user: ApiUser;
      }>(
        `/users/${parentSwitchTarget.id}/switch-account-with-login`,
        parentSwitchForm,
        {
          params: {
            actor_user_id: currentUserId,
          },
        },
      );
      storeUser(response.data.user);
      setParentSwitchDrawerOpen(false);
      navigate(`/dashboard/users/${parentSwitchTarget.id}`, { replace: true });
    } catch (caughtError: unknown) {
      const message =
        typeof caughtError === "object" &&
        caughtError !== null &&
        "response" in caughtError
          ? (
              caughtError as {
                response?: { data?: { detail?: string } };
              }
            ).response?.data?.detail || "Unable to switch to the parent account."
          : "Unable to switch to the parent account.";
      setParentSwitchError(message);
    } finally {
      setSwitchAccountLoading(false);
    }
  };

  const currentMenu = useMemo(() => {
    if (location.pathname.startsWith("/dashboard/directory")) {
      return {
        title: "People",
        subtitle: "Search users and explore their visible posts",
        icon: GroupIcon,
      };
    }

    if (location.pathname.startsWith("/dashboard/feed")) {
      return {
        title: "Home",
        subtitle: "Browse posts, review, react, and share private posts by link",
        icon: HomeRoundedIcon,
      };
    }

    if (location.pathname.startsWith("/dashboard/profile")) {
      return {
        title: "Profile",
        subtitle: "Complete your account profile and review emerging issues",
        icon: AccountCircleRoundedIcon,
      };
    }

    if (location.pathname.startsWith("/dashboard/settings")) {
      return {
        title: "Settings",
        subtitle: "Choose the system color palette",
        icon: SettingsRoundedIcon,
      };
    }

    if (location.pathname.startsWith("/dashboard/users/")) {
      return {
        title: "Public Profile",
        subtitle: "Review public profile details and recent posts",
        icon: AccountCircleRoundedIcon,
      };
    }

    if (location.pathname.startsWith("/dashboard/about")) {
      return {
        title: "About",
        subtitle: "Review platform details and supporting workflows",
        icon: InfoIcon,
      };
    }

      return {
        title: "Analytics",
        subtitle: "Monitor analytics, trends, and operational health",
        icon: InsightsRoundedIcon,
      };
  }, [location.pathname]);

  const CurrentMenuIcon = currentMenu.icon;

  return (
    <ThemeProvider theme={theme}>
      <Box sx={{ display: "flex" }}>
        <CssBaseline />
        <AppBar position="fixed" open={open} color="transparent" elevation={0}>
          <Toolbar>
            <IconButton
              color="inherit"
              aria-label="open drawer"
              onClick={handleDrawerOpen}
              edge="start"
              sx={[
                {
                  marginRight: 5,
                },
                open && { display: "none" },
              ]}
            >
              <MenuIcon />
            </IconButton>
            <MuiBox
              sx={{
                display: "flex",
                alignItems: "center",
                gap: 1.5,
                flex: 1,
                minWidth: 0,
              }}
            >
              <MuiBox
                sx={{
                  width: 42,
                  height: 42,
                  borderRadius: "14px",
                  display: "grid",
                  placeItems: "center",
                  bgcolor: alpha(theme.palette.secondary.main, 0.16),
                  color: theme.palette.warning.main,
                  border: `1px solid ${alpha(theme.palette.secondary.main, 0.26)}`,
                  flexShrink: 0,
                }}
              >
                <CurrentMenuIcon fontSize="small" />
              </MuiBox>
              <MuiBox sx={{ minWidth: 0 }}>
                <Typography variant="h6" noWrap component="div" sx={{ fontWeight: 700 }}>
                  {currentMenu.title}
                </Typography>
                <Typography
                  noWrap
                  sx={{
                    color: alpha("#FFFFFF", 0.72),
                    fontSize: "0.82rem",
                  }}
                >
                  {currentMenu.subtitle}
                </Typography>
              </MuiBox>
            </MuiBox>
            <Tooltip title="View new posts">
              <IconButton onClick={handleNotificationsClick} color="inherit">
                <Badge
                  badgeContent={notificationCount}
                  color="error"
                  max={9}
                >
                  <NotificationsRoundedIcon />
                </Badge>
              </IconButton>
            </Tooltip>
            <Tooltip title="Open account options">
              <IconButton
                onClick={(event) => setAccountMenuAnchorEl(event.currentTarget)}
                color="inherit"
              >
                <AccountCircleRoundedIcon />
                <KeyboardArrowDownRoundedIcon sx={{ fontSize: 18, ml: 0.25 }} />
              </IconButton>
            </Tooltip>
            <Tooltip title={"Toggle light/dark mode"}>
              <IconButton onClick={toggleTheme} color="inherit">
                {mode === "dark" ? <LightMode /> : <DarkMode />}
              </IconButton>
            </Tooltip>
          </Toolbar>
        </AppBar>
        <Menu
          anchorEl={accountMenuAnchorEl}
          open={accountMenuOpen}
          onClose={() => setAccountMenuAnchorEl(null)}
        >
          {childAccounts.length || parentAccount ? (
            <MenuItem disabled sx={{ opacity: 1, fontWeight: 700 }}>
              <SyncAltRoundedIcon sx={{ mr: 1.25, fontSize: 20 }} />
              Switch account
            </MenuItem>
          ) : null}
          {parentAccount ? (
            <MenuItem
              onClick={() => openParentSwitchDrawer(parentAccount)}
              disabled={switchAccountLoading}
              sx={{ pl: 5 }}
            >
              {parentAccount.company_name ||
                [parentAccount.fname, parentAccount.lname].filter(Boolean).join(" ") ||
                parentAccount.username}
            </MenuItem>
          ) : null}
          {childAccounts.map((account) => (
            <MenuItem
              key={account.id}
              onClick={() => void handleSwitchAccount(account.id)}
              disabled={switchAccountLoading}
              sx={{ pl: 5 }}
            >
              {account.company_name || account.username}
            </MenuItem>
          ))}
          {childAccounts.length || parentAccount ? <Divider /> : null}
          <MenuItem onClick={handleOpenOwnPublicProfile}>
            <AccountCircleRoundedIcon sx={{ mr: 1.25, fontSize: 20 }} />
            Your profile
          </MenuItem>
          <MenuItem onClick={handleOpenProfileDrawer}>
            <AccountCircleRoundedIcon sx={{ mr: 1.25, fontSize: 20 }} />
            Complete your profile
          </MenuItem>
          <MenuItem onClick={handleOpenAddAccountDrawer}>
            <AddBusinessRoundedIcon sx={{ mr: 1.25, fontSize: 20 }} />
            Add child account
          </MenuItem>
          <Divider />
          <MenuItem onClick={handleLogout}>
            <LogoutRoundedIcon sx={{ mr: 1.25, fontSize: 20 }} />
            Logout
          </MenuItem>
        </Menu>
        <SideList open={open} setOpen={setOpen} />
        <Drawer
          anchor="right"
          open={profileDrawerOpen}
          onClose={() => setProfileDrawerOpen(false)}
          sx={{
            zIndex: theme.zIndex.drawer + 10,
          }}
          ModalProps={{
            keepMounted: true,
            sx: {
              zIndex: theme.zIndex.drawer + 10,
            },
          }}
          PaperProps={{
            sx: {
              width: { xs: "100%", sm: 560, lg: 620 },
              p: 3,
              zIndex: theme.zIndex.drawer + 10,
              bgcolor: theme.palette.background.paper,
            },
          }}
        >
          <Stack spacing={2.5} sx={{ minHeight: "100%" }}>
            <Stack
              direction="row"
              alignItems="center"
              justifyContent="space-between"
              spacing={2}
            >
              <Typography variant="h5" sx={{ fontWeight: 700 }}>
                Complete your profile
              </Typography>
              <IconButton
                onClick={() => setProfileDrawerOpen(false)}
                sx={{ color: "text.secondary" }}
              >
                <CloseRoundedIcon />
              </IconButton>
            </Stack>
            <Divider />
            <MuiBox
              sx={{
                flex: 1,
                overflowY: "auto",
                pr: 0.5,
              }}
            >
              <ProfilePage embedded />
            </MuiBox>
          </Stack>
        </Drawer>
        <Drawer
          anchor="right"
          open={parentSwitchDrawerOpen}
          onClose={() => setParentSwitchDrawerOpen(false)}
          sx={{ zIndex: theme.zIndex.drawer + 10 }}
          ModalProps={{
            keepMounted: true,
            sx: { zIndex: theme.zIndex.drawer + 10 },
          }}
          PaperProps={{
            sx: {
              width: { xs: "100%", sm: 480 },
              p: 3,
              zIndex: theme.zIndex.drawer + 10,
              bgcolor: theme.palette.background.paper,
            },
          }}
        >
          <Stack spacing={2.5} sx={{ height: "100%", overflowY: "auto", pr: 0.5 }}>
            <Stack
              direction="row"
              alignItems="center"
              justifyContent="space-between"
              spacing={2}
            >
              <Typography variant="h5" sx={{ fontWeight: 700 }}>
                Switch Account
              </Typography>
              <IconButton
                onClick={() => setParentSwitchDrawerOpen(false)}
                sx={{ color: "text.secondary" }}
              >
                <CloseRoundedIcon />
              </IconButton>
            </Stack>
            <Typography color="text.secondary">
              Enter the parent account credentials to switch back to that account.
            </Typography>
            <Divider />
            <Box component="form" onSubmit={handleParentSwitchSubmit}>
              <Stack spacing={2}>
                {parentSwitchError ? (
                  <Alert severity="error">{parentSwitchError}</Alert>
                ) : null}
                <TextField
                  label="Parent email or mobile number"
                  size="small"
                  value={parentSwitchForm.email_or_mobile_number}
                  onChange={(event) =>
                    setParentSwitchForm((current) => ({
                      ...current,
                      email_or_mobile_number: event.target.value,
                    }))
                  }
                  error={Boolean(parentSwitchSubmitted && getParentSwitchIdentifierError())}
                  helperText={
                    parentSwitchSubmitted ? getParentSwitchIdentifierError() : ""
                  }
                  fullWidth
                />
                <TextField
                  label="Password"
                  size="small"
                  type={parentSwitchShowPassword ? "text" : "password"}
                  value={parentSwitchForm.password}
                  onChange={(event) =>
                    setParentSwitchForm((current) => ({
                      ...current,
                      password: event.target.value,
                    }))
                  }
                  error={Boolean(parentSwitchSubmitted && getParentSwitchPasswordError())}
                  helperText={
                    parentSwitchSubmitted ? getParentSwitchPasswordError() : ""
                  }
                  fullWidth
                  InputProps={{
                    endAdornment: (
                      <InputAdornment position="end">
                        <IconButton
                          onClick={() =>
                            setParentSwitchShowPassword((current) => !current)
                          }
                          edge="end"
                        >
                          {parentSwitchShowPassword ? (
                            <VisibilityOffIcon />
                          ) : (
                            <VisibilityIcon />
                          )}
                        </IconButton>
                      </InputAdornment>
                    ),
                  }}
                />
                <Divider sx={{ mt: 1, mb: 0.5 }} />
                <Stack direction="row" spacing={1.5} justifyContent="flex-end">
                  <Button onClick={() => setParentSwitchDrawerOpen(false)}>
                    Cancel
                  </Button>
                  <Button
                    type="submit"
                    variant="contained"
                    disabled={switchAccountLoading}
                  >
                    {switchAccountLoading ? (
                      <CircularProgress size={20} color="inherit" />
                    ) : (
                      "Switch account"
                    )}
                  </Button>
                </Stack>
              </Stack>
            </Box>
          </Stack>
        </Drawer>
        <Drawer
          anchor="right"
          open={addAccountDrawerOpen}
          onClose={() => setAddAccountDrawerOpen(false)}
          sx={{ zIndex: theme.zIndex.drawer + 10 }}
          ModalProps={{
            keepMounted: true,
            sx: { zIndex: theme.zIndex.drawer + 10 },
          }}
          PaperProps={{
            sx: {
              width: { xs: "100%", sm: 560 },
              p: 3,
              zIndex: theme.zIndex.drawer + 10,
              bgcolor: theme.palette.background.paper,
            },
          }}
        >
          <Stack spacing={2.5} sx={{ height: "100%", overflowY: "auto", pr: 0.5 }}>
            <Stack
              direction="row"
              alignItems="center"
              justifyContent="space-between"
              spacing={2}
            >
              <Typography variant="h5" sx={{ fontWeight: 700 }}>
                Add child account
              </Typography>
              <IconButton
                onClick={() => setAddAccountDrawerOpen(false)}
                sx={{ color: "text.secondary" }}
              >
                <CloseRoundedIcon />
              </IconButton>
            </Stack>
            <Typography color="text.secondary">
              Create an organization child account under your current personal profile.
            </Typography>
            <Divider />
            <Box component="form" onSubmit={handleAddAccountSubmit}>
              <Stack spacing={2}>
                {addAccountError ? (
                  <Alert severity="error">{addAccountError}</Alert>
                ) : null}
                <TextField
                  label="Username"
                  name="username"
                  value={addAccountForm.username}
                  onChange={handleAddAccountChange}
                  required
                  error={Boolean(addAccountSubmitted && getAddAccountUsernameError())}
                  helperText={
                    addAccountSubmitted
                      ? getAddAccountUsernameError()
                      : addAccountForm.username.trim().length >= 3
                        ? addAccountUsernameChecking
                          ? "Checking username availability..."
                          : addAccountUsernameCheckedValue ===
                                addAccountForm.username.trim() &&
                              addAccountUsernameAvailable === false
                            ? "Username is already taken."
                            : ""
                        : ""
                  }
                  fullWidth
                />
                <TextField
                  label="Organization email"
                  name="email"
                  type="email"
                  value={addAccountForm.email}
                  onChange={handleAddAccountChange}
                  required
                  error={Boolean(addAccountSubmitted && getAddAccountEmailError())}
                  helperText={
                    addAccountSubmitted
                      ? getAddAccountEmailError()
                      : addAccountForm.email.trim() &&
                          EMAIL_PATTERN.test(addAccountForm.email.trim()) &&
                          addAccountEmailCheckedValue ===
                            addAccountForm.email.trim() &&
                          addAccountEmailAvailable === false
                        ? "An account is already associated with this email address."
                        : ""
                  }
                  fullWidth
                />
                <TextField
                  label="Password"
                  name="password"
                  type={addAccountShowPassword ? "text" : "password"}
                  value={addAccountForm.password}
                  onChange={handleAddAccountChange}
                  required
                  error={Boolean(addAccountSubmitted && getAddAccountPasswordError())}
                  helperText={
                    addAccountSubmitted || addAccountForm.password.length > 0
                      ? getAddAccountPasswordError()
                      : ""
                  }
                  fullWidth
                  InputProps={{
                    endAdornment: (
                      <InputAdornment position="end">
                        <IconButton
                          onClick={() =>
                            setAddAccountShowPassword((current) => !current)
                          }
                          edge="end"
                        >
                          {addAccountShowPassword ? (
                            <VisibilityOffIcon />
                          ) : (
                            <VisibilityIcon />
                          )}
                        </IconButton>
                      </InputAdornment>
                    ),
                  }}
                />
                <TextField
                  select
                  label="Organization type"
                  name="type"
                  value={addAccountForm.type}
                  onChange={handleAddAccountChange}
                  fullWidth
                >
                  <MenuItem value="business">Business</MenuItem>
                  <MenuItem value="ngo">NGO</MenuItem>
                  <MenuItem value="government organization">
                    Government Organization
                  </MenuItem>
                </TextField>
                <TextField
                  label="Organization name"
                  name="company_name"
                  value={addAccountForm.company_name}
                  onChange={handleAddAccountChange}
                  required
                  error={Boolean(addAccountSubmitted && getAddAccountCompanyNameError())}
                  helperText={
                    addAccountSubmitted ? getAddAccountCompanyNameError() : ""
                  }
                  fullWidth
                />
                <Stack direction={{ xs: "column", sm: "row" }} spacing={2}>
                  <CountryAutocomplete
                    value={addAccountForm.company_country}
                    onChange={handleAddAccountCountryChange}
                    textFieldProps={{
                      name: "company_country",
                      fullWidth: true,
                    }}
                  />
                </Stack>
                <UgandaLocationFields
                  value={{
                    district_id: addAccountForm.district_id,
                    constituency_id: addAccountForm.constituency_id,
                    subcounty_id: addAccountForm.subcounty_id,
                    parish_id: addAccountForm.parish_id,
                  }}
                  onChange={handleAddAccountLocationChange}
                />
                <Stack direction={{ xs: "column", sm: "row" }} spacing={2}>
                  <TextField
                    label="Business category"
                    name="type_of_business"
                    value={addAccountForm.type_of_business}
                    onChange={handleAddAccountChange}
                    fullWidth
                  />
                  <TextField
                    label="Number of employees"
                    name="number_of_employees"
                    type="number"
                    value={addAccountForm.number_of_employees}
                    onChange={handleAddAccountChange}
                    fullWidth
                  />
                </Stack>
                <Stack direction={{ xs: "column", sm: "row" }} spacing={2}>
                  <PhoneNumberField
                    label="Mobile number"
                    name="mobile_number"
                    country={addAccountForm.company_country}
                    value={addAccountForm.mobile_number}
                    onChange={(value) =>
                      setAddAccountForm((current) => ({
                        ...current,
                        mobile_number: value,
                      }))
                    }
                    error={Boolean(addAccountSubmitted && getAddAccountMobileError())}
                    helperText={
                      addAccountSubmitted
                        ? getAddAccountMobileError()
                        : addAccountForm.mobile_number.trim() &&
                            MOBILE_PATTERN.test(
                              addAccountForm.mobile_number.trim(),
                            ) &&
                            addAccountMobileCheckedValue ===
                              addAccountForm.mobile_number.trim() &&
                            addAccountMobileAvailable === false
                          ? "An account is already associated with this mobile number."
                          : undefined
                    }
                    fullWidth
                  />
                  <TextField
                    select
                    label="Profile visibility"
                    name="visibility"
                    value={addAccountForm.visibility}
                    onChange={handleAddAccountChange}
                    fullWidth
                  >
                    <MenuItem value="public">Public</MenuItem>
                    <MenuItem value="private">Private</MenuItem>
                  </TextField>
                </Stack>
                <TextField
                  label="Owner email"
                  value={currentUser?.email || ""}
                  fullWidth
                  disabled
                  helperText="This signed-in personal account will own the organization account."
                />
                <Stack direction={{ xs: "column", sm: "row" }} spacing={1.5} sx={{ pt: 1 }}>
                  <Button onClick={() => setAddAccountDrawerOpen(false)}>
                    Cancel
                  </Button>
                  <Button
                    type="submit"
                    variant="contained"
                    disabled={addAccountLoading || !canSubmitAddAccount()}
                  >
                    {addAccountLoading ? (
                      <CircularProgress size={20} color="inherit" />
                    ) : (
                      "Create organization account"
                    )}
                  </Button>
                </Stack>
              </Stack>
            </Box>
          </Stack>
        </Drawer>
      </Box>
    </ThemeProvider>
  );
}
