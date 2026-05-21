import { useEffect, useState } from "react";
import {
  Alert,
  AppBar,
  Box,
  Button,
  Chip,
  Container,
  Divider,
  Drawer,
  IconButton,
  InputAdornment,
  MenuItem,
  Paper,
  Stack,
  Tab,
  Tabs,
  TextField,
  Toolbar,
  Typography,
} from "@mui/material";
import { alpha, styled } from "@mui/material/styles";
import { useLocation, useNavigate } from "react-router-dom";
import InsightsRoundedIcon from "@mui/icons-material/InsightsRounded";
import ArrowForwardRoundedIcon from "@mui/icons-material/ArrowForwardRounded";
import CheckCircleRoundedIcon from "@mui/icons-material/CheckCircleRounded";
import CloseIcon from "@mui/icons-material/Close";
import FeedbackRoundedIcon from "@mui/icons-material/FeedbackRounded";
import GoogleIcon from "@mui/icons-material/Google";
import PersonIcon from "@mui/icons-material/Person";
import PlayCircleOutlineRoundedIcon from "@mui/icons-material/PlayCircleOutlineRounded";
import TrendingUpRoundedIcon from "@mui/icons-material/TrendingUpRounded";
import VisibilityIcon from "@mui/icons-material/Visibility";
import VisibilityOffIcon from "@mui/icons-material/VisibilityOff";
import VpnKeyIcon from "@mui/icons-material/VpnKey";
import RecordVoiceOverIcon from "@mui/icons-material/RecordVoiceOver";
import { api, type ApiUser } from "../lib/api";
import { storeUser } from "../lib/session";
import {
  UGANDA_FLAG_COLORS_EVENT,
  getStoredUgandaFlagColors,
  type UgandaFlagColors,
} from "../lib/ugandaTheme";
import CountryAutocomplete from "../components/CountryAutocomplete";
import PhoneNumberField from "../components/PhoneNumberField";
import UgandaLocationFields from "../components/UgandaLocationFields";
import { rebasePhoneNumberToCountry } from "../lib/countryPhoneMeta";
const HeroSection = styled(Box)(({ theme }) => ({
  position: "relative",
  overflow: "hidden",
  color: "#FFFFFF",
  background: `
    radial-gradient(circle at top left, rgba(252, 220, 4, 0.22), transparent 30%),
    radial-gradient(circle at 80% 20%, rgba(217, 0, 0, 0.20), transparent 24%),
    linear-gradient(135deg, #111111 0%, #111111 55%, #1F1F1F 100%)
  `,
  paddingTop: theme.spacing(16),
  paddingBottom: theme.spacing(12),
  [theme.breakpoints.down("md")]: {
    paddingTop: theme.spacing(14),
    paddingBottom: theme.spacing(9),
  },
  "&::before": {
    content: '""',
    position: "absolute",
    inset: "12% -10% auto auto",
    width: 360,
    height: 360,
    borderRadius: "50%",
    background: alpha("#FCDC04", 0.12),
    filter: "blur(18px)",
  },
  "&::after": {
    content: '""',
    position: "absolute",
    inset: "auto auto -18% -8%",
    width: 320,
    height: 320,
    borderRadius: "50%",
    background: alpha("#D90000", 0.16),
    filter: "blur(18px)",
  },
}));

const SectionShell = styled(Box)(({ theme }) => ({
  paddingTop: theme.spacing(11),
  paddingBottom: theme.spacing(11),
  [theme.breakpoints.down("md")]: {
    paddingTop: theme.spacing(8),
    paddingBottom: theme.spacing(8),
  },
}));

const GlassPanel = styled(Paper)(({ theme }) => ({
  position: "relative",
  borderRadius: 0,
  background:
    "linear-gradient(180deg, rgba(15, 23, 42, 0.82), rgba(15, 23, 42, 0.64))",
  backdropFilter: "blur(14px)",
  boxShadow: "0 30px 80px rgba(15, 23, 42, 0.4)",
  padding: theme.spacing(4),
  color: "#FFFFFF",
}));

const ElevationCard = styled(Paper)(({ theme }) => ({
  borderRadius: 0,
  padding: theme.spacing(3.5),
  boxShadow: "0 18px 45px rgba(15, 23, 42, 0.08)",
  height: "100%",
}));

const SectionEyebrow = styled(Typography)(({ theme }) => ({
  textTransform: "uppercase",
  letterSpacing: "0.16em",
  fontWeight: 700,
  fontSize: "0.76rem",
  color: theme.palette.primary.main,
  marginBottom: theme.spacing(1.5),
}));

const metrics = [
  { value: "3.4x", label: "faster citizen feedback review" },
  { value: "92%", label: "stronger public participation tracking" },
  { value: "24/7", label: "visibility into national sentiment" },
];

const features = [
  {
    icon: FeedbackRoundedIcon,
    title: "Gather public feedback on parliamentary matters",
    iconGradient:
      "linear-gradient(135deg, #FCDC04 0%, #D90000 55%, #990000 100%)",
    iconShadow: "rgba(217, 0, 0, 0.24)",
    description:
      "Collect structured and open citizen responses on bills, motions, committee work, service delivery, and constituency concerns.",
  },
  {
    icon: InsightsRoundedIcon,
    title: "Turn citizen voices into legislative signals",
    iconGradient:
      "linear-gradient(135deg, #FCDC04 0%, #D90000 55%, #111111 100%)",
    iconShadow: "rgba(252, 220, 4, 0.24)",
    description:
      "Surface themes, sentiment shifts, and recurring issues so Parliament, MPs, and committees can see what people are asking for.",
  },
  {
    icon: TrendingUpRoundedIcon,
    title: "Close the loop with public accountability",
    iconGradient:
      "linear-gradient(135deg, #FCDC04 0%, #D90000 52%, #D90000 100%)",
    iconShadow: "rgba(217, 0, 0, 0.24)",
    description:
      "Track responses, monitor concerns over time, and show citizens how their feedback informs debate, oversight, and follow-up.",
  },
];

const footerLinks = [
  { label: "Home", sectionId: "home" },
  { label: "Platform", sectionId: "platform" },
  { label: "Request Walkthrough", sectionId: "demo" },
];

const HOME_TITLE = "UGVoice | Parliamentary Citizen Feedback Platform";
const HOME_DESCRIPTION =
  "UGVoice helps Parliament, MPs, and public institutions collect citizen feedback, analyze sentiment, and turn public input into accountable action.";
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const MOBILE_PATTERN = /^[+\d][\d\s-]{6,}$/;
const UPPERCASE_PATTERN = /[A-Z]/;
const LOWERCASE_PATTERN = /[a-z]/;
const NUMBER_PATTERN = /\d/;
const SYMBOL_PATTERN = /[^A-Za-z0-9]/;
const LOGIN_ATTEMPTS_KEY = "ugvoice_login_failed_attempts";
const LOGIN_LOCKED_UNTIL_KEY = "ugvoice_login_locked_until";
const MAX_LOGIN_ATTEMPTS = 5;
const LOGIN_LOCKOUT_DURATION_MS = 15 * 60 * 1000;
const THEME_YELLOW = "#FCDC04";
const THEME_YELLOW_HOVER = "#FFE95C";
const THEME_RED = "#D90000";
const THEME_BLACK = "#111111";

const yellowButtonSx = {
  borderRadius: "999px",
  bgcolor: THEME_YELLOW,
  color: THEME_BLACK,
  fontWeight: 700,
  boxShadow: "0 14px 28px rgba(252, 220, 4, 0.2)",
  "&:hover": {
    bgcolor: THEME_YELLOW_HOVER,
    boxShadow: "0 16px 32px rgba(252, 220, 4, 0.26)",
  },
};

const darkOutlineButtonSx = {
  borderRadius: "999px",
  color: THEME_BLACK,
  borderColor: alpha(THEME_BLACK, 0.28),
  fontWeight: 700,
  "&:hover": {
    borderColor: THEME_RED,
    bgcolor: alpha(THEME_RED, 0.05),
  },
};

const redTextButtonSx = {
  color: THEME_RED,
  fontWeight: 700,
  "&:hover": {
    bgcolor: alpha(THEME_RED, 0.06),
  },
};

const blackButtonSx = {
  borderRadius: "999px",
  bgcolor: THEME_BLACK,
  color: "#FFFFFF",
  fontWeight: 700,
  boxShadow: "0 14px 28px rgba(17, 17, 17, 0.22)",
  "&:hover": {
    bgcolor: "#000000",
    boxShadow: "0 16px 32px rgba(17, 17, 17, 0.28)",
  },
};

type SignupForm = {
  username: string;
  email: string;
  password: string;
  fname: string;
  lname: string;
  mobile_number: string;
  gender: string;
  visibility: string;
  type: string;
  company_name: string;
  company_country: string;
  district_id: number | null;
  constituency_id: number | null;
  subcounty_id: number | null;
  parish_id: number | null;
};

const initialSignupForm: SignupForm = {
  username: "",
  email: "",
  password: "",
  fname: "",
  lname: "",
  mobile_number: "",
  gender: "",
  visibility: "public",
  type: "personal",
  company_name: "",
  company_country: "",
  district_id: null,
  constituency_id: null,
  subcounty_id: null,
  parish_id: null,
};

const readStoredTimestamp = (key: string) => {
  const raw = localStorage.getItem(key);
  if (!raw) {
    return null;
  }

  const value = Number(raw);
  return Number.isFinite(value) && value > 0 ? value : null;
};

const formatDuration = (milliseconds: number) => {
  const totalSeconds = Math.max(0, Math.ceil(milliseconds / 1000));
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  if (minutes <= 0) {
    return `${seconds}s`;
  }
  return `${minutes}m ${seconds}s`;
};

const MenuHome = () => {
  const [flagColors, setFlagColors] = useState<UgandaFlagColors>(
    getStoredUgandaFlagColors,
  );
  const [loginOpen, setLoginOpen] = useState(false);
  const [signupOpen, setSignupOpen] = useState(false);
  const [formData, setFormData] = useState({
    email_or_mobile_number: "",
    password: "",
  });
  const [loginNotice, setLoginNotice] = useState("");
  const [loginError, setLoginError] = useState("");
  const [loginLoading, setLoginLoading] = useState(false);
  const [loginSubmitted, setLoginSubmitted] = useState(false);
  const [loginFailedAttempts, setLoginFailedAttempts] = useState(0);
  const [loginLockedUntil, setLoginLockedUntil] = useState<number | null>(null);
  const [showPassword, setShowPassword] = useState(false);
  const [signupForm, setSignupForm] = useState<SignupForm>(initialSignupForm);
  const [signupAccountTab, setSignupAccountTab] = useState<
    "personal" | "organization"
  >("personal");
  const [signupShowPassword, setSignupShowPassword] = useState(false);
  const [signupError, setSignupError] = useState("");
  const [signupLoading, setSignupLoading] = useState(false);
  const [signupSubmitted, setSignupSubmitted] = useState(false);
  const [signupUsernameChecking, setSignupUsernameChecking] = useState(false);
  const [signupUsernameAvailable, setSignupUsernameAvailable] = useState<
    boolean | null
  >(null);
  const [signupUsernameCheckedValue, setSignupUsernameCheckedValue] =
    useState("");
  const [signupEmailChecking, setSignupEmailChecking] = useState(false);
  const [signupEmailAvailable, setSignupEmailAvailable] = useState<
    boolean | null
  >(null);
  const [signupEmailCheckedValue, setSignupEmailCheckedValue] = useState("");
  const [signupMobileChecking, setSignupMobileChecking] = useState(false);
  const [signupMobileAvailable, setSignupMobileAvailable] = useState<
    boolean | null
  >(null);
  const [signupMobileCheckedValue, setSignupMobileCheckedValue] = useState("");
  const [demoForm, setDemoForm] = useState({
    fullName: "",
    workEmail: "",
    company: "",
    teamSize: "",
    message: "",
  });
  const [demoSubmitted, setDemoSubmitted] = useState(false);
  const location = useLocation();
  const navigate = useNavigate();
  const now = Date.now();
  const isLoginLocked = loginLockedUntil !== null && loginLockedUntil > now;
  const loginAttemptsRemaining = Math.max(
    0,
    MAX_LOGIN_ATTEMPTS - loginFailedAttempts,
  );
  const loginLockMessage = isLoginLocked
    ? `Too many failed login attempts. Try again in ${formatDuration(
        loginLockedUntil - now,
      )}.`
    : "";
  const isOrganizationSignup = signupAccountTab === "organization";

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
    document.title = HOME_TITLE;

    const ensureMeta = (
      selector: string,
      attributeName: "name" | "property",
      attributeValue: string,
      content: string,
    ) => {
      let tag = document.head.querySelector<HTMLMetaElement>(selector);
      if (!tag) {
        tag = document.createElement("meta");
        tag.setAttribute(attributeName, attributeValue);
        document.head.appendChild(tag);
      }
      tag.setAttribute("content", content);
    };

    ensureMeta(
      'meta[name="description"]',
      "name",
      "description",
      HOME_DESCRIPTION,
    );
    ensureMeta('meta[property="og:title"]', "property", "og:title", HOME_TITLE);
    ensureMeta(
      'meta[property="og:description"]',
      "property",
      "og:description",
      HOME_DESCRIPTION,
    );
    ensureMeta(
      'meta[name="twitter:title"]',
      "name",
      "twitter:title",
      HOME_TITLE,
    );
    ensureMeta(
      'meta[name="twitter:description"]',
      "name",
      "twitter:description",
      HOME_DESCRIPTION,
    );

    const scriptId = "ugvoice-home-structured-data";
    let structuredData = document.getElementById(
      scriptId,
    ) as HTMLScriptElement | null;
    if (!structuredData) {
      structuredData = document.createElement("script");
      structuredData.id = scriptId;
      structuredData.type = "application/ld+json";
      document.head.appendChild(structuredData);
    }

    structuredData.text = JSON.stringify({
      "@context": "https://schema.org",
      "@type": "SoftwareApplication",
      name: "UGVoice",
      applicationCategory: "CivicTechnologyApplication",
      operatingSystem: "Web",
      description: HOME_DESCRIPTION,
    });
  }, []);

  useEffect(() => {
    if (location.pathname === "/signup") {
      setLoginOpen(false);
      setSignupOpen(true);
      return;
    }
    if (location.pathname === "/login") {
      setSignupOpen(false);
      setLoginOpen(true);
    }
  }, [location.pathname]);

  useEffect(() => {
    const failedAttempts = Number(
      localStorage.getItem(LOGIN_ATTEMPTS_KEY) || 0,
    );
    const lockedUntil = readStoredTimestamp(LOGIN_LOCKED_UNTIL_KEY);

    if (lockedUntil !== null && lockedUntil <= Date.now()) {
      localStorage.removeItem(LOGIN_ATTEMPTS_KEY);
      localStorage.removeItem(LOGIN_LOCKED_UNTIL_KEY);
      setLoginFailedAttempts(0);
      setLoginLockedUntil(null);
      return;
    }

    setLoginFailedAttempts(
      Number.isFinite(failedAttempts) ? Math.max(0, failedAttempts) : 0,
    );
    setLoginLockedUntil(lockedUntil);
  }, [loginOpen]);

  useEffect(() => {
    if (!isLoginLocked) {
      return;
    }

    const intervalId = window.setInterval(() => {
      const nextLockedUntil = readStoredTimestamp(LOGIN_LOCKED_UNTIL_KEY);
      if (nextLockedUntil === null || nextLockedUntil <= Date.now()) {
        localStorage.removeItem(LOGIN_ATTEMPTS_KEY);
        localStorage.removeItem(LOGIN_LOCKED_UNTIL_KEY);
        setLoginFailedAttempts(0);
        setLoginLockedUntil(null);
        setLoginError("");
        window.clearInterval(intervalId);
        return;
      }

      setLoginLockedUntil(nextLockedUntil);
    }, 1000);

    return () => {
      window.clearInterval(intervalId);
    };
  }, [isLoginLocked]);

  useEffect(() => {
    const username = signupForm.username.trim();
    if (!signupOpen) {
      return;
    }
    if (username.length < 3) {
      setSignupUsernameChecking(false);
      setSignupUsernameAvailable(null);
      setSignupUsernameCheckedValue("");
      return;
    }

    const timeoutId = window.setTimeout(async () => {
      setSignupUsernameChecking(true);
      try {
        const response = await api.get<{
          available: boolean;
          username: string;
        }>("/users/username-availability", {
          params: { username },
        });
        setSignupUsernameAvailable(response.data.available);
        setSignupUsernameCheckedValue(response.data.username);
      } catch {
        setSignupUsernameAvailable(null);
        setSignupUsernameCheckedValue(username);
      } finally {
        setSignupUsernameChecking(false);
      }
    }, 350);

    return () => {
      window.clearTimeout(timeoutId);
    };
  }, [signupForm.username, signupOpen]);

  useEffect(() => {
    const email = signupForm.email.trim();
    if (!signupOpen) {
      return;
    }
    if (!email || !EMAIL_PATTERN.test(email)) {
      setSignupEmailChecking(false);
      setSignupEmailAvailable(null);
      setSignupEmailCheckedValue("");
      return;
    }

    const timeoutId = window.setTimeout(async () => {
      setSignupEmailChecking(true);
      try {
        const response = await api.get<{
          email?: { available: boolean; value: string; message: string };
        }>("/users/signup-availability", {
          params: { email },
        });
        setSignupEmailAvailable(response.data.email?.available ?? null);
        setSignupEmailCheckedValue(response.data.email?.value ?? email);
      } catch {
        setSignupEmailAvailable(null);
        setSignupEmailCheckedValue(email);
      } finally {
        setSignupEmailChecking(false);
      }
    }, 350);

    return () => {
      window.clearTimeout(timeoutId);
    };
  }, [signupForm.email, signupOpen]);

  useEffect(() => {
    const mobileNumber = signupForm.mobile_number.trim();
    if (!signupOpen) {
      return;
    }
    if (!mobileNumber || !MOBILE_PATTERN.test(mobileNumber)) {
      setSignupMobileChecking(false);
      setSignupMobileAvailable(null);
      setSignupMobileCheckedValue("");
      return;
    }

    const timeoutId = window.setTimeout(async () => {
      setSignupMobileChecking(true);
      try {
        const response = await api.get<{
          mobile_number?: {
            available: boolean;
            value: string;
            message: string;
          };
        }>("/users/signup-availability", {
          params: { mobile_number: mobileNumber },
        });
        setSignupMobileAvailable(
          response.data.mobile_number?.available ?? null,
        );
        setSignupMobileCheckedValue(
          response.data.mobile_number?.value ?? mobileNumber,
        );
      } catch {
        setSignupMobileAvailable(null);
        setSignupMobileCheckedValue(mobileNumber);
      } finally {
        setSignupMobileChecking(false);
      }
    }, 350);

    return () => {
      window.clearTimeout(timeoutId);
    };
  }, [signupForm.mobile_number, signupOpen]);

  const resetLoginAttemptLock = () => {
    localStorage.removeItem(LOGIN_ATTEMPTS_KEY);
    localStorage.removeItem(LOGIN_LOCKED_UNTIL_KEY);
    setLoginFailedAttempts(0);
    setLoginLockedUntil(null);
  };

  const recordFailedLoginAttempt = () => {
    const nextFailedAttempts = Math.min(
      MAX_LOGIN_ATTEMPTS,
      Number(localStorage.getItem(LOGIN_ATTEMPTS_KEY) || 0) + 1,
    );

    localStorage.setItem(LOGIN_ATTEMPTS_KEY, String(nextFailedAttempts));
    setLoginFailedAttempts(nextFailedAttempts);

    if (nextFailedAttempts >= MAX_LOGIN_ATTEMPTS) {
      const lockedUntil = Date.now() + LOGIN_LOCKOUT_DURATION_MS;
      localStorage.setItem(LOGIN_LOCKED_UNTIL_KEY, String(lockedUntil));
      setLoginLockedUntil(lockedUntil);
      return;
    }

    setLoginLockedUntil(null);
  };

  const handleLoginOpen = (options?: {
    identifier?: string;
    notice?: string;
  }) => {
    if (location.pathname !== "/") {
      navigate("/", { replace: true });
    }
    setSignupOpen(false);
    setLoginOpen(true);
    setLoginError("");
    setLoginSubmitted(false);
    setShowPassword(false);
    setLoginNotice(options?.notice || "");
    const lockedUntil = readStoredTimestamp(LOGIN_LOCKED_UNTIL_KEY);
    if (lockedUntil !== null && lockedUntil <= Date.now()) {
      resetLoginAttemptLock();
    }
    if (options?.identifier !== undefined) {
      setFormData({
        email_or_mobile_number: options.identifier,
        password: "",
      });
      return;
    }
    setFormData((current) => ({
      ...current,
      password: "",
    }));
  };
  const handleLoginClose = () => {
    setLoginOpen(false);
    setLoginNotice("");
    setLoginError("");
    setLoginSubmitted(false);
    setShowPassword(false);
    if (location.pathname === "/login") {
      navigate("/", { replace: true });
    }
  };

  const handleSignupOpen = () => {
    if (location.pathname !== "/") {
      navigate("/", { replace: true });
    }
    setLoginOpen(false);
    setLoginNotice("");
    setLoginError("");
    setLoginSubmitted(false);
    setSignupOpen(true);
    setSignupAccountTab("personal");
    setSignupShowPassword(false);
    setSignupForm(initialSignupForm);
    setSignupError("");
    setSignupSubmitted(false);
    setSignupUsernameChecking(false);
    setSignupUsernameAvailable(null);
    setSignupUsernameCheckedValue("");
    setSignupEmailChecking(false);
    setSignupEmailAvailable(null);
    setSignupEmailCheckedValue("");
    setSignupMobileChecking(false);
    setSignupMobileAvailable(null);
    setSignupMobileCheckedValue("");
  };

  const handleSignupClose = () => {
    setSignupOpen(false);
    setSignupShowPassword(false);
    setSignupError("");
    setSignupSubmitted(false);
    setSignupUsernameChecking(false);
    setSignupUsernameAvailable(null);
    setSignupUsernameCheckedValue("");
    setSignupEmailChecking(false);
    setSignupEmailAvailable(null);
    setSignupEmailCheckedValue("");
    setSignupMobileChecking(false);
    setSignupMobileAvailable(null);
    setSignupMobileCheckedValue("");
    if (location.pathname === "/signup") {
      navigate("/", { replace: true });
    }
  };

  const handleSignupTabChange = (
    _: React.SyntheticEvent,
    nextTab: "personal" | "organization",
  ) => {
    setSignupAccountTab(nextTab);
    setSignupSubmitted(false);
    setSignupError("");
    setSignupForm((current) => ({
      ...current,
      type:
        nextTab === "organization"
          ? current.type === "personal"
            ? "business"
            : current.type
          : "personal",
    }));
  };

  const scrollToSection = (sectionId: string) => {
    document.getElementById(sectionId)?.scrollIntoView({
      behavior: "smooth",
      block: "start",
    });
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setFormData({
      ...formData,
      [e.target.name]: e.target.value,
    });
  };

  const handleDemoChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>,
  ) => {
    setDemoForm((current) => ({
      ...current,
      [e.target.name]: e.target.value,
    }));
  };

  const handleDemoSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setDemoSubmitted(true);
    if (
      getDemoFullNameError() ||
      getDemoWorkEmailError() ||
      getDemoCompanyError() ||
      getDemoTeamSizeError()
    ) {
      return;
    }
    alert("Walkthrough request received. Our team will reach out shortly.");
    setDemoForm({
      fullName: "",
      workEmail: "",
      company: "",
      teamSize: "",
      message: "",
    });
    setDemoSubmitted(false);
  };

  const handleSignupClick = () => {
    handleSignupOpen();
  };

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setLoginSubmitted(true);
    if (isLoginLocked) {
      setLoginError(loginLockMessage);
      return;
    }
    if (getLoginIdentifierError() || getLoginPasswordError()) {
      return;
    }
    setLoginLoading(true);
    setLoginNotice("");
    setLoginError("");

    try {
      const response = await api.post<{ message: string; user: ApiUser }>(
        "/login",
        formData,
      );

      if (response.data.message === "Login successful") {
        resetLoginAttemptLock();
        storeUser(response.data.user);
        navigate("/dashboard/feed", { replace: true });
        return;
      }
    } catch (error: unknown) {
      const statusCode =
        typeof error === "object" && error !== null && "response" in error
          ? (error as { response?: { status?: number } }).response?.status
          : undefined;
      const message =
        typeof error === "object" && error !== null && "response" in error
          ? (
              error as {
                response?: { data?: { detail?: string } };
              }
            ).response?.data?.detail || "Login failed"
          : "Login failed";
      if (statusCode === 401) {
        recordFailedLoginAttempt();
        const nextFailedAttempts = Math.min(
          MAX_LOGIN_ATTEMPTS,
          Number(localStorage.getItem(LOGIN_ATTEMPTS_KEY) || 0),
        );
        const attemptsRemaining = Math.max(
          0,
          MAX_LOGIN_ATTEMPTS - nextFailedAttempts,
        );
        const lockedUntil = readStoredTimestamp(LOGIN_LOCKED_UNTIL_KEY);
        setLoginError(
          lockedUntil && lockedUntil > Date.now()
            ? `Too many failed login attempts. Try again in ${formatDuration(
                lockedUntil - Date.now(),
              )}.`
            : attemptsRemaining > 0
              ? `${message}. ${attemptsRemaining} attempt${
                  attemptsRemaining === 1 ? "" : "s"
                } remaining.`
              : message,
        );
      } else {
        setLoginError(message);
      }
    } finally {
      setLoginLoading(false);
    }
  };

  const getLoginIdentifierError = () => {
    const value = formData.email_or_mobile_number.trim();
    if (!value) {
      return "Email or mobile number is required.";
    }
    if (value.includes("@") && !EMAIL_PATTERN.test(value)) {
      return "Enter a valid email address.";
    }
    if (!value.includes("@") && !MOBILE_PATTERN.test(value)) {
      return "Enter a valid mobile number.";
    }
    return "";
  };

  const handleSignupChange = (
    event: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>,
  ) => {
    const { name, value } = event.target;
    setSignupForm((current) => ({
      ...current,
      [name]: value,
    }));
  };

  const handleSignupCountryChange = (country: string) => {
    setSignupForm((current) => ({
      ...current,
      company_country: country,
      mobile_number: rebasePhoneNumberToCountry(
        current.mobile_number,
        current.company_country,
        country,
      ),
    }));
  };

  const handleSignupLocationChange = (nextValue: {
    district_id?: number | null;
    constituency_id?: number | null;
    subcounty_id?: number | null;
    parish_id?: number | null;
  }) => {
    setSignupForm((current) => ({
      ...current,
      district_id: nextValue.district_id ?? null,
      constituency_id: nextValue.constituency_id ?? null,
      subcounty_id: nextValue.subcounty_id ?? null,
      parish_id: nextValue.parish_id ?? null,
    }));
  };

  const getSignupUsernameError = () => {
    if (!signupForm.username.trim()) {
      return "Username is required.";
    }
    if (signupForm.username.trim().length < 3) {
      return "Username must be at least 3 characters.";
    }
    if (
      signupUsernameCheckedValue === signupForm.username.trim() &&
      signupUsernameAvailable === false
    ) {
      return "Username is already taken.";
    }
    return "";
  };

  const getSignupFirstNameError = () => {
    if (isOrganizationSignup) {
      return "";
    }
    if (!signupForm.fname.trim()) {
      return "First name is required.";
    }
    return "";
  };

  const getSignupLastNameError = () => {
    if (isOrganizationSignup) {
      return "";
    }
    if (!signupForm.lname.trim()) {
      return "Last name is required.";
    }
    return "";
  };

  const getSignupEmailError = () => {
    if (!signupForm.email.trim()) {
      return "Email is required.";
    }
    if (!EMAIL_PATTERN.test(signupForm.email.trim())) {
      return "Enter a valid email address.";
    }
    if (
      signupEmailCheckedValue === signupForm.email.trim() &&
      signupEmailAvailable === false
    ) {
      return "An account is already associated with this email address.";
    }
    return "";
  };

  const getSignupPasswordError = () => {
    if (!signupForm.password.trim()) {
      return "Password is required.";
    }
    if (signupForm.password.length < 8) {
      return "Password must be at least 8 characters.";
    }
    if (!UPPERCASE_PATTERN.test(signupForm.password)) {
      return "Password must include at least one uppercase letter.";
    }
    if (!LOWERCASE_PATTERN.test(signupForm.password)) {
      return "Password must include at least one lowercase letter.";
    }
    if (!NUMBER_PATTERN.test(signupForm.password)) {
      return "Password must include at least one number.";
    }
    if (!SYMBOL_PATTERN.test(signupForm.password)) {
      return "Password must include at least one symbol.";
    }
    return "";
  };

  const getSignupMobileError = () => {
    if (!signupForm.mobile_number.trim()) {
      return "";
    }
    if (!MOBILE_PATTERN.test(signupForm.mobile_number.trim())) {
      return "Enter a valid mobile number.";
    }
    if (
      signupMobileCheckedValue === signupForm.mobile_number.trim() &&
      signupMobileAvailable === false
    ) {
      return "An account is already associated with this mobile number.";
    }
    return "";
  };

  const getSignupCompanyNameError = () => {
    if (!isOrganizationSignup) {
      return "";
    }
    if (!signupForm.company_name.trim()) {
      return "Organization name is required.";
    }
    return "";
  };

  const getSignupOrganizationTypeError = () => {
    if (!isOrganizationSignup) {
      return "";
    }
    if (!signupForm.type.trim() || signupForm.type === "personal") {
      return "Organization type is required.";
    }
    return "";
  };

  const canEnableSignupSubmit = () => {
    if (!signupForm.username.trim()) {
      return false;
    }
    if (
      !isOrganizationSignup &&
      (!signupForm.fname.trim() || !signupForm.lname.trim())
    ) {
      return false;
    }
    if (!signupForm.email.trim()) {
      return false;
    }
    if (!signupForm.password.trim()) {
      return false;
    }
    if (isOrganizationSignup) {
      if (!signupForm.company_name.trim()) {
        return false;
      }
      if (!signupForm.type.trim() || signupForm.type === "personal") {
        return false;
      }
    }
    return true;
  };

  const handleSignupSubmit = async (
    event: React.FormEvent<HTMLFormElement>,
  ) => {
    event.preventDefault();
    setSignupSubmitted(true);
    if (
      getSignupUsernameError() ||
      getSignupFirstNameError() ||
      getSignupLastNameError() ||
      getSignupEmailError() ||
      getSignupPasswordError() ||
      getSignupMobileError() ||
      getSignupCompanyNameError() ||
      getSignupOrganizationTypeError() ||
      signupUsernameChecking ||
      signupEmailChecking ||
      signupMobileChecking
    ) {
      return;
    }

    setSignupLoading(true);
    setSignupError("");

    try {
      await api.post<{ message: string; user: ApiUser }>("/signup", {
        ...signupForm,
        username: signupForm.username.trim(),
        email: signupForm.email.trim(),
        mobile_number: signupForm.mobile_number || null,
        gender: signupForm.gender || null,
        fname: isOrganizationSignup ? null : signupForm.fname.trim(),
        lname: isOrganizationSignup ? null : signupForm.lname.trim(),
        type: isOrganizationSignup ? signupForm.type : "personal",
        company_name: signupForm.company_name.trim() || null,
        company_country: signupForm.company_country.trim() || null,
        district_id: signupForm.district_id,
        constituency_id: signupForm.constituency_id,
        subcounty_id: signupForm.subcounty_id,
        parish_id: signupForm.parish_id,
        type_of_business: null,
        number_of_employees: null,
      });
      const identifier = signupForm.email.trim();
      setSignupForm(initialSignupForm);
      setSignupOpen(false);
      setSignupSubmitted(false);
      handleLoginOpen({
        identifier,
        notice: "Account created successfully. Please log in.",
      });
    } catch (caughtError: unknown) {
      const message =
        typeof caughtError === "object" &&
        caughtError !== null &&
        "response" in caughtError
          ? (
              caughtError as {
                response?: { data?: { detail?: string } };
              }
            ).response?.data?.detail || "Signup failed"
          : "Signup failed";
      setSignupError(message);
    } finally {
      setSignupLoading(false);
    }
  };

  const getLoginPasswordError = () => {
    if (!formData.password.trim()) {
      return "Password is required.";
    }
    return "";
  };

  const getDemoFullNameError = () => {
    if (!demoForm.fullName.trim()) {
      return "Full name is required.";
    }
    return "";
  };

  const getDemoWorkEmailError = () => {
    if (!demoForm.workEmail.trim()) {
      return "Work email is required.";
    }
    if (!EMAIL_PATTERN.test(demoForm.workEmail.trim())) {
      return "Enter a valid work email address.";
    }
    return "";
  };

  const getDemoCompanyError = () => {
    if (!demoForm.company.trim()) {
      return "Organization is required.";
    }
    return "";
  };

  const getDemoTeamSizeError = () => {
    if (!demoForm.teamSize.trim()) {
      return "Engagement size is required.";
    }
    return "";
  };

  return (
    <Box sx={{ bgcolor: "#FFFFFF", color: "#111111", overflowX: "clip" }}>
      <AppBar
        position="fixed"
        elevation={0}
        sx={{
          bgcolor: alpha(flagColors.black, 0.76),
          backdropFilter: "blur(14px)",
          borderBottom: 0,
          "&::before": {
            content: '""',
            position: "absolute",
            left: 0,
            right: 0,
            bottom: 4,
            height: 4,
            bgcolor: flagColors.yellow,
          },
          "&::after": {
            content: '""',
            position: "absolute",
            left: 0,
            right: 0,
            bottom: 0,
            height: 4,
            bgcolor: flagColors.red,
          },
        }}
      >
        <Toolbar
          component="nav"
          aria-label="Primary"
          sx={{
            minHeight: 80,
            gap: 2,
            justifyContent: "space-between",
          }}
        >
          <Stack direction="row" spacing={1.5} alignItems="center">
            <IconButton sx={{ color: "white" }}>
              <RecordVoiceOverIcon />
            </IconButton>
            <Box>
              <Typography
                variant="h6"
                sx={{ fontWeight: 700, lineHeight: 1.1 }}
              >
                UGVoice
              </Typography>
              <Typography
                sx={{ fontSize: "0.78rem", color: alpha("#FFFFFF", 0.72) }}
              >
                Feedback intelligence platform
              </Typography>
            </Box>
          </Stack>

          <Stack
            direction="row"
            spacing={1}
            sx={{ display: { xs: "none", md: "flex" } }}
          >
            <Button color="inherit" onClick={() => scrollToSection("home")}>
              Home
            </Button>
            <Button color="inherit" onClick={() => scrollToSection("platform")}>
              Platform
            </Button>
          </Stack>

          <Stack direction="row" spacing={1.25} alignItems="center">
            <Button
              variant="contained"
              onClick={() => handleLoginOpen()}
              sx={{
                ...blackButtonSx,
                display: { xs: "none", sm: "inline-flex" },
                px: 2.4,
                py: 0.9,
              }}
            >
              Login
            </Button>
            <Button
              variant="contained"
              onClick={handleSignupClick}
              sx={{
                ...yellowButtonSx,
                display: { xs: "none", sm: "inline-flex" },
                px: 2.5,
                py: 1,
              }}
            >
              Sign Up
            </Button>
            <Button
              variant="contained"
              onClick={() => scrollToSection("demo")}
              sx={{
                ...yellowButtonSx,
                borderRadius: "999px",
                px: 2.5,
                py: 1,
                boxShadow: "none",
                "&:hover": {
                  bgcolor: THEME_YELLOW_HOVER,
                  boxShadow: "none",
                },
              }}
            >
              Request Walkthrough
            </Button>
          </Stack>
        </Toolbar>
      </AppBar>

      <Box component="main">
        <HeroSection id="home" as="section" aria-labelledby="home-heading">
          <Container
            disableGutters
            maxWidth={false}
            sx={{
              position: "relative",
              zIndex: 1,
              px: { xs: 2, sm: 3, md: 5, lg: 8 },
            }}
          >
            <Box
              sx={{
                display: "grid",
                gridTemplateColumns: { xs: "1fr", lg: "1.15fr 0.85fr" },
                gap: { xs: 5, lg: 7 },
                alignItems: "center",
              }}
            >
              <Box>
                <Chip
                  label="Built for Parliament and citizens"
                  sx={{
                    mb: 3,
                    px: 1,
                    height: 34,
                    borderRadius: "999px",
                    bgcolor: alpha("#FCDC04", 0.14),
                    color: "#FCDC04",
                    border: `1px solid ${alpha("#FCDC04", 0.24)}`,
                  }}
                />
                <Typography
                  id="home-heading"
                  component="h1"
                  variant="h2"
                  sx={{
                    fontSize: { xs: "2.7rem", md: "4.25rem" },
                    lineHeight: 1.05,
                    fontWeight: 700,
                    maxWidth: 720,
                  }}
                >
                  Make public feedback visible, useful, and accountable.
                </Typography>
                <Typography
                  variant="h5"
                  sx={{
                    mt: 3,
                    maxWidth: 640,
                    color: alpha("#FFFFFF", 0.9),
                    fontWeight: 400,
                    lineHeight: 1.6,
                    fontSize: { xs: "1.05rem", md: "1.25rem" },
                  }}
                >
                  UGVoice helps Parliament, MPs, and committees hear from
                  citizens, interpret public sentiment, and turn feedback into
                  clearer decisions and follow-up.
                </Typography>

                <Stack
                  direction={{ xs: "column", sm: "row" }}
                  spacing={2}
                  sx={{ mt: 4 }}
                >
                  <Button
                    variant="contained"
                    size="large"
                    endIcon={<ArrowForwardRoundedIcon />}
                    onClick={() => handleLoginOpen()}
                    sx={{
                      ...yellowButtonSx,
                      borderRadius: "999px",
                      px: 3.5,
                      py: 1.4,
                      boxShadow: "0 16px 32px rgba(252, 220, 4, 0.22)",
                      "&:hover": {
                        bgcolor: THEME_YELLOW_HOVER,
                        boxShadow: "0 18px 36px rgba(252, 220, 4, 0.28)",
                      },
                    }}
                  >
                    Get Started
                  </Button>
                  <Button
                    variant="text"
                    size="large"
                    onClick={handleSignupClick}
                    sx={{
                      borderRadius: "999px",
                      px: 2.4,
                      py: 1.4,
                      color: THEME_YELLOW,
                      border: `1px solid ${alpha(THEME_YELLOW, 0.42)}`,
                      fontWeight: 700,
                      justifyContent: "flex-start",
                      "&:hover": {
                        borderColor: THEME_YELLOW,
                        bgcolor: alpha(THEME_YELLOW, 0.08),
                      },
                    }}
                  >
                    Sign Up
                  </Button>
                  <Button
                    variant="outlined"
                    size="large"
                    startIcon={<PlayCircleOutlineRoundedIcon />}
                    onClick={() => scrollToSection("platform")}
                    sx={{
                      borderRadius: "999px",
                      px: 3.5,
                      py: 1.4,
                      color: "#FFFFFF",
                      borderColor: alpha("#FFFFFF", 0.26),
                      "&:hover": {
                        borderColor: alpha("#FFFFFF", 0.44),
                        bgcolor: alpha("#FFFFFF", 0.04),
                      },
                    }}
                  >
                    Explore Platform
                  </Button>
                </Stack>

                <Box
                  sx={{
                    mt: 6,
                    display: "grid",
                    gridTemplateColumns: { xs: "1fr", sm: "repeat(3, 1fr)" },
                    gap: 2,
                  }}
                >
                  {metrics.map((metric) => (
                    <GlassPanel key={metric.label} elevation={4}>
                      <Typography
                        sx={{
                          fontSize: { xs: "1.7rem", md: "2rem" },
                          fontWeight: 700,
                          color: "#FFFFFF",
                        }}
                      >
                        {metric.value}
                      </Typography>
                      <Typography
                        sx={{ mt: 0.75, color: alpha("#FFFFFF", 0.78) }}
                      >
                        {metric.label}
                      </Typography>
                    </GlassPanel>
                  ))}
                </Box>
              </Box>

              <GlassPanel elevation={4}>
                <Stack
                  direction="row"
                  justifyContent="space-between"
                  alignItems="center"
                >
                  <Box>
                    <Typography
                      sx={{ color: alpha("#FCDC04", 0.92), fontWeight: 400 }}
                    >
                      Insight Overview
                    </Typography>
                    <Typography
                      variant="h5"
                      sx={{ mt: 0.75, fontWeight: 700, color: "#FFFFFF" }}
                    >
                      Citizen sentiment pulse
                    </Typography>
                  </Box>
                  <Chip
                    label="Live snapshot"
                    sx={{
                      bgcolor: alpha("#FCDC04", 0.16),
                      color: "#FCDC04",
                      border: `1px solid ${alpha("#FCDC04", 0.22)}`,
                    }}
                  />
                </Stack>

                <Box
                  sx={{
                    mt: 4,
                    p: 3,
                    borderRadius: 5,
                    bgcolor: alpha("#000000", 0.45),
                    border: `1px solid ${alpha("#FFFFFF", 0.08)}`,
                  }}
                >
                  <Stack spacing={2.5}>
                    {[
                      {
                        label: "Supportive feedback",
                        value: "76%",
                        width: "76%",
                        tone: "#FCDC04",
                      },
                      {
                        label: "Needs parliamentary follow-up",
                        value: "18%",
                        width: "48%",
                        tone: "#FCDC04",
                      },
                      {
                        label: "Urgent public concerns",
                        value: "6%",
                        width: "24%",
                        tone: "#D90000",
                      },
                    ].map((item) => (
                      <Box key={item.label}>
                        <Stack
                          direction="row"
                          justifyContent="space-between"
                          sx={{ mb: 1 }}
                        >
                          <Typography sx={{ color: alpha("#FFFFFF", 0.84) }}>
                            {item.label}
                          </Typography>
                          <Typography
                            sx={{ color: "#FFFFFF", fontWeight: 600 }}
                          >
                            {item.value}
                          </Typography>
                        </Stack>
                        <Box
                          sx={{
                            height: 10,
                            borderRadius: "999px",
                            bgcolor: alpha("#FFFFFF", 0.08),
                            overflow: "hidden",
                          }}
                        >
                          <Box
                            sx={{
                              width: item.width,
                              height: "100%",
                              borderRadius: "999px",
                              bgcolor: item.tone,
                            }}
                          />
                        </Box>
                      </Box>
                    ))}
                  </Stack>
                </Box>

                <Stack spacing={2} sx={{ mt: 3.5 }}>
                  {[
                    "Track public sentiment across constituencies and topics.",
                    "Prioritize urgent issues before they become national patterns.",
                    "Share clear parliamentary summaries without manual reporting.",
                  ].map((point) => (
                    <Stack
                      key={point}
                      direction="row"
                      spacing={1.5}
                      alignItems="center"
                    >
                      <CheckCircleRoundedIcon sx={{ color: "#FCDC04" }} />
                      <Typography sx={{ color: alpha("#FFFFFF", 0.82) }}>
                        {point}
                      </Typography>
                    </Stack>
                  ))}
                </Stack>
              </GlassPanel>
            </Box>
          </Container>
        </HeroSection>

        <SectionShell
          id="platform"
          as="section"
          aria-labelledby="platform-heading"
        >
          <Container>
            <Box sx={{ textAlign: "center", maxWidth: 760, mx: "auto", mb: 6 }}>
              <SectionEyebrow>Platform</SectionEyebrow>
              <Typography
                id="platform-heading"
                component="h2"
                variant="h3"
                sx={{
                  fontWeight: 700,
                  fontSize: { xs: "2rem", md: "3rem" },
                  lineHeight: 1.15,
                }}
              >
                A clearer system for collecting, understanding, and acting on
                citizen feedback
              </Typography>
              <Typography
                sx={{
                  mt: 2,
                  color: alpha("#111111", 0.72),
                  fontSize: "1.05rem",
                  lineHeight: 1.8,
                }}
              >
                The platform helps Parliament and representatives replace
                scattered public comments with a dependable feedback loop from
                citizens to decision makers.
              </Typography>
            </Box>

            <Box
              sx={{
                display: "grid",
                gridTemplateColumns: { xs: "1fr", md: "repeat(3, 1fr)" },
                gap: 3,
              }}
            >
              {features.map((feature) => {
                const Icon = feature.icon;

                return (
                  <ElevationCard key={feature.title} elevation={3}>
                    <Box
                      sx={{
                        width: 60,
                        height: 60,
                        borderRadius: "18px",
                        display: "grid",
                        placeItems: "center",
                        background: feature.iconGradient,
                        color: "#FFFFFF",
                        mb: 2.5,
                        mx: "auto",
                        boxShadow: `0 14px 28px ${feature.iconShadow}`,
                      }}
                    >
                      <Icon
                        sx={{
                          fontSize: 30,
                          filter:
                            "drop-shadow(0 2px 6px rgba(15, 23, 42, 0.18))",
                        }}
                      />
                    </Box>
                    <Typography
                      component="h3"
                      variant="h5"
                      sx={{ fontWeight: 550, mb: 1.5 }}
                    >
                      {feature.title}
                    </Typography>
                    <Typography
                      sx={{ color: alpha("#111111", 0.72), lineHeight: 1.75 }}
                    >
                      {feature.description}
                    </Typography>
                  </ElevationCard>
                );
              })}
            </Box>
          </Container>
        </SectionShell>

        <Box sx={{ bgcolor: "#FFF8D1" }}>
          <SectionShell as="section" aria-labelledby="why-ugvoice-heading">
            <Container>
              <Box
                sx={{
                  display: "grid",
                  gridTemplateColumns: { xs: "1fr", lg: "0.95fr 1.05fr" },
                  gap: { xs: 4, lg: 6 },
                  alignItems: "center",
                }}
              >
                <Box>
                  <SectionEyebrow>Why UGVoice</SectionEyebrow>
                  <Typography
                    id="why-ugvoice-heading"
                    component="h2"
                    variant="h3"
                    sx={{
                      fontWeight: 700,
                      fontSize: { xs: "2rem", md: "2.8rem" },
                      lineHeight: 1.2,
                    }}
                  >
                    Public participation intelligence for Parliament, MPs, and
                    committees
                  </Typography>
                  <Typography
                    sx={{
                      mt: 2.5,
                      color: alpha("#111111", 0.72),
                      lineHeight: 1.85,
                      fontSize: "1.04rem",
                    }}
                  >
                    UGVoice gives public leaders a shared picture of citizen
                    priorities, helping them identify emerging concerns, align on
                    next steps, and show visible progress over time.
                  </Typography>
                </Box>

                <Box
                  sx={{
                    display: "grid",
                    gridTemplateColumns: { xs: "1fr", sm: "repeat(2, 1fr)" },
                    gap: 2.5,
                  }}
                >
                  {[
                    {
                      title: "Unified public intake",
                      text: "Bring citizen responses from posts, reviews, MPs, and constituencies into one consistent workflow.",
                    },
                    {
                      title: "Legislative insight",
                      text: "Summaries and themes help Parliament move from public input to informed debate and oversight faster.",
                    },
                    {
                      title: "Committee ready reporting",
                      text: "Present citizen concerns with concise dashboards, sentiment context, and constituency-level trends.",
                    },
                    {
                      title: "Built for national reach",
                      text: "From constituency engagement to national consultations, the structure stays coherent.",
                    },
                  ].map((item) => (
                    <ElevationCard
                      key={item.title}
                      elevation={3}
                      sx={{ bgcolor: alpha("#FFFFFF", 0.72) }}
                    >
                      <Typography
                        component="h3"
                        variant="h6"
                        sx={{ fontWeight: 650, mb: 1 }}
                      >
                        {item.title}
                      </Typography>
                      <Typography
                        sx={{ color: alpha("#111111", 0.72), lineHeight: 1.7 }}
                      >
                        {item.text}
                      </Typography>
                    </ElevationCard>
                  ))}
                </Box>
              </Box>
            </Container>
          </SectionShell>
        </Box>

        <Box
          id="demo"
          component="section"
          aria-labelledby="demo-heading"
          sx={{
            bgcolor: "#111111",
            color: "#FFFFFF",
            py: { xs: 9, md: 11 },
            position: "relative",
            overflow: "hidden",
          }}
        >
          <Box
            sx={{
              position: "absolute",
              inset: "auto auto -18% -6%",
              width: 260,
              height: 260,
              borderRadius: "50%",
              bgcolor: alpha("#FCDC04", 0.16),
              filter: "blur(12px)",
            }}
          />
          <Container sx={{ position: "relative", zIndex: 1 }}>
            <Box
              sx={{
                display: "grid",
                gridTemplateColumns: { xs: "1fr", lg: "0.95fr 1.05fr" },
                gap: { xs: 4, lg: 6 },
                alignItems: "start",
              }}
            >
              <Box>
                <SectionEyebrow sx={{ color: "#FCDC04" }}>
                  Request A Walkthrough
                </SectionEyebrow>
                <Typography
                  id="demo-heading"
                  component="h2"
                  variant="h3"
                  sx={{
                    fontWeight: 700,
                    fontSize: { xs: "2rem", md: "3rem" },
                    lineHeight: 1.15,
                    color: "#FFFFFF",
                  }}
                >
                  See how UGVoice can support parliamentary feedback
                </Typography>
                <Typography
                  sx={{
                    mt: 2.5,
                    maxWidth: 600,
                    color: alpha("#FFFFFF", 0.8),
                    lineHeight: 1.85,
                    fontSize: "1.02rem",
                  }}
                >
                  Share a few details about your institution and goals, and
                  we&apos;ll arrange a tailored walkthrough focused on citizen
                  intake, sentiment, reporting, and parliamentary follow-up.
                </Typography>
                <Stack spacing={1.5} sx={{ mt: 4 }}>
                  {[
                    "Personalized walkthrough for Parliament, MPs, or civic teams",
                    "Guidance on public intake, reporting, and analytics setup",
                    "Clear next steps for pilots, onboarding, and national rollout",
                  ].map((point) => (
                    <Stack
                      key={point}
                      direction="row"
                      spacing={1.25}
                      alignItems="center"
                    >
                      <CheckCircleRoundedIcon sx={{ color: "#FCDC04" }} />
                      <Typography sx={{ color: alpha("#FFFFFF", 0.82) }}>
                        {point}
                      </Typography>
                    </Stack>
                  ))}
                </Stack>
              </Box>

              <Paper
                elevation={6}
                sx={{
                  p: { xs: 2.5, md: 3.5 },
                  bgcolor: "#FFFFFF",
                  color: "#111111",
                  boxShadow: "0 24px 60px rgba(2, 6, 23, 0.3)",
                }}
              >
                <Typography
                  component="h3"
                  variant="h5"
                  sx={{ fontWeight: 700 }}
                >
                  Book your walkthrough
                </Typography>
                <Typography
                  sx={{ mt: 1, color: alpha("#111111", 0.64), mb: 3 }}
                >
                  We usually respond within one business day.
                </Typography>

                <Box component="form" onSubmit={handleDemoSubmit}>
                  <Box
                    sx={{
                      display: "grid",
                      gridTemplateColumns: { xs: "1fr", sm: "repeat(2, 1fr)" },
                      gap: 2,
                    }}
                  >
                    <TextField
                      label="Full name"
                      name="fullName"
                      value={demoForm.fullName}
                      onChange={handleDemoChange}
                      required
                      error={Boolean(demoSubmitted && getDemoFullNameError())}
                      helperText={demoSubmitted ? getDemoFullNameError() : ""}
                      fullWidth
                    />
                    <TextField
                      label="Work email"
                      name="workEmail"
                      type="email"
                      value={demoForm.workEmail}
                      onChange={handleDemoChange}
                      required
                      error={Boolean(demoSubmitted && getDemoWorkEmailError())}
                      helperText={demoSubmitted ? getDemoWorkEmailError() : ""}
                      fullWidth
                    />
                    <TextField
                      label="Organization"
                      name="company"
                      value={demoForm.company}
                      onChange={handleDemoChange}
                      required
                      error={Boolean(demoSubmitted && getDemoCompanyError())}
                      helperText={demoSubmitted ? getDemoCompanyError() : ""}
                      fullWidth
                    />
                    <TextField
                      label="Engagement size"
                      name="teamSize"
                      value={demoForm.teamSize}
                      onChange={handleDemoChange}
                      placeholder="e.g. 25 MPs, 50 staff, national pilot"
                      required
                      error={Boolean(demoSubmitted && getDemoTeamSizeError())}
                      helperText={demoSubmitted ? getDemoTeamSizeError() : ""}
                      fullWidth
                    />
                  </Box>

                  <TextField
                    label="What parliamentary feedback workflow would you like to see?"
                    name="message"
                    value={demoForm.message}
                    onChange={handleDemoChange}
                    multiline
                    minRows={4}
                    fullWidth
                    sx={{ mt: 2 }}
                  />

                  <Stack
                    direction={{ xs: "column", sm: "row" }}
                    spacing={1.5}
                    sx={{ mt: 3 }}
                  >
                    <Button
                      type="submit"
                      variant="contained"
                      endIcon={<ArrowForwardRoundedIcon />}
                      sx={{
                        ...yellowButtonSx,
                        borderRadius: "999px",
                        px: 3,
                        py: 1.3,
                        boxShadow: "none",
                        "&:hover": {
                          bgcolor: THEME_YELLOW_HOVER,
                          boxShadow: "none",
                        },
                      }}
                    >
                      Request Walkthrough
                    </Button>
                    <Button
                      variant="outlined"
                      onClick={handleSignupClick}
                      sx={{
                        ...darkOutlineButtonSx,
                        borderRadius: "999px",
                        px: 3,
                        py: 1.3,
                      }}
                    >
                      Sign Up
                    </Button>
                  </Stack>
                </Box>
              </Paper>
            </Box>
          </Container>
        </Box>

        <Box sx={{ bgcolor: "#000000", color: "#FFFFFF", py: 6 }}>
          <Container>
            <Box
              sx={{
                display: "grid",
                gridTemplateColumns: { xs: "1fr", md: "1.2fr 0.8fr 0.8fr" },
                gap: 4,
              }}
            >
              <Box>
                <Typography variant="h6" sx={{ fontWeight: 700 }}>
                  UGVoice
                </Typography>
                <Typography
                  sx={{
                    mt: 1.5,
                    color: alpha("#FFFFFF", 0.72),
                    lineHeight: 1.8,
                  }}
                >
                  A modern parliamentary feedback platform that helps public
                  leaders listen well, learn faster, and act with accountability.
                </Typography>
              </Box>

              <Box>
                <Typography sx={{ fontWeight: 700, mb: 1.5 }}>
                  Quick Links
                </Typography>
                <Stack spacing={0.75}>
                  {footerLinks.map((link) => (
                    <Button
                      key={link.label}
                      color="inherit"
                      onClick={() => scrollToSection(link.sectionId)}
                      sx={{
                        justifyContent: "flex-start",
                        px: 0,
                        minWidth: 0,
                        color: alpha("#FFFFFF", 0.72),
                      }}
                    >
                      {link.label}
                    </Button>
                  ))}
                </Stack>
              </Box>

              <Box>
                <Typography sx={{ fontWeight: 700, mb: 1.5 }}>
                  Contact
                </Typography>
                <Typography
                  sx={{ color: alpha("#FFFFFF", 0.72), lineHeight: 1.9 }}
                >
                  support@ugvoice.com
                  <br />+ (256) 708-390-445
                </Typography>
              </Box>
            </Box>

            <Divider sx={{ my: 3, borderColor: alpha("#FFFFFF", 0.08) }} />
            <Typography
              sx={{ color: alpha("#FFFFFF", 0.56), textAlign: "center" }}
            >
              (c) {new Date().getFullYear()} UGVoice. All rights reserved.
            </Typography>
          </Container>
        </Box>
      </Box>

      <Drawer
        anchor="right"
        open={loginOpen}
        onClose={handleLoginClose}
        PaperProps={{
          sx: {
            width: { xs: "100%", sm: 520 },
            p: { xs: 2.5, sm: 3 },
            background:
              "linear-gradient(180deg, rgba(255,255,255,0.98), rgba(248,250,252,0.98))",
            boxShadow: "0 28px 80px rgba(15, 23, 42, 0.22)",
          },
        }}
      >
        <Stack
          spacing={2.5}
          sx={{ height: "100%", overflowY: "auto", pr: 0.5 }}
        >
          <Box sx={{ position: "relative", pr: 5 }}>
            <Typography variant="h5" sx={{ fontWeight: 700 }}>
              Login to UGVoice
            </Typography>
            <IconButton
              aria-label="close"
              onClick={handleLoginClose}
              sx={{ position: "absolute", right: 0, top: -4 }}
            >
              <CloseIcon />
            </IconButton>
          </Box>

          <Divider />

          <Box component="form" onSubmit={handleSubmit}>
            <Typography
              variant="body2"
              sx={{ mb: 1.25, color: alpha("#111111", 0.62), fontWeight: 600 }}
            >
              Continue with?
            </Typography>
            <Stack spacing={1.25} sx={{ mb: 3 }}>
              <Button
                variant="outlined"
                size="small"
                fullWidth
                sx={{
                  color: "#111111",
                  borderColor: alpha("#111111", 0.36),
                  py: 1.15,
                }}
                startIcon={<GoogleIcon />}
                onClick={() => alert("Google login not implemented yet")}
              >
                Google
              </Button>
            </Stack>

            <Divider sx={{ mb: 3 }}>or use your credentials</Divider>

            <Box>
              {loginNotice ? (
                <Alert severity="success" sx={{ mb: 2 }}>
                  {loginNotice}
                </Alert>
              ) : null}
              {isLoginLocked ? (
                <Alert severity="warning" sx={{ mb: 2 }}>
                  {loginLockMessage}
                </Alert>
              ) : null}
              {loginError ? (
                <Alert severity="error" sx={{ mb: 2 }}>
                  {loginError}
                </Alert>
              ) : null}
              <TextField
                label="Email or mobile number"
                name="email_or_mobile_number"
                size="small"
                fullWidth
                margin="normal"
                value={formData.email_or_mobile_number}
                onChange={handleChange}
                required
                disabled={loginLoading || isLoginLocked}
                error={Boolean(loginSubmitted && getLoginIdentifierError())}
                helperText={loginSubmitted ? getLoginIdentifierError() : ""}
                InputProps={{
                  startAdornment: (
                    <InputAdornment position="start">
                      <PersonIcon sx={{ color: "action.active" }} />
                    </InputAdornment>
                  ),
                }}
              />
              <TextField
                label="Password"
                name="password"
                size="small"
                type={showPassword ? "text" : "password"}
                fullWidth
                margin="normal"
                value={formData.password}
                onChange={handleChange}
                required
                disabled={loginLoading || isLoginLocked}
                error={Boolean(loginSubmitted && getLoginPasswordError())}
                helperText={loginSubmitted ? getLoginPasswordError() : ""}
                InputProps={{
                  startAdornment: (
                    <InputAdornment position="start">
                      <VpnKeyIcon sx={{ color: "action.active" }} />
                    </InputAdornment>
                  ),
                  endAdornment: (
                    <InputAdornment position="end">
                      <IconButton
                        aria-label="toggle password visibility"
                        onClick={() => setShowPassword((current) => !current)}
                        edge="end"
                      >
                        {showPassword ? (
                          <VisibilityOffIcon />
                        ) : (
                          <VisibilityIcon />
                        )}
                      </IconButton>
                    </InputAdornment>
                  ),
                }}
              />

              <Button
                variant="text"
                size="small"
                sx={{ mt: 1, px: 0 }}
                disabled={isLoginLocked}
                onClick={() =>
                  alert("Forgot password functionality not implemented yet")
                }
              >
                Forgot password?
              </Button>

              <Button
                variant="text"
                size="small"
                sx={{ ...redTextButtonSx, mt: 1, px: 0, display: "flex" }}
                onClick={handleSignupOpen}
              >
                Need an account? Sign up
              </Button>

              <Divider sx={{ mt: 3, mb: 2 }} />

              <Stack
                direction={{ xs: "column", sm: "row" }}
                spacing={1.5}
                justifyContent="flex-end"
                sx={{ pt: 0.5 }}
              >
                <Button onClick={handleLoginClose} sx={redTextButtonSx}>
                  Cancel
                </Button>
                <Button
                  type="submit"
                  variant="contained"
                  sx={{ ...blackButtonSx, px: 3 }}
                  disabled={loginLoading || isLoginLocked}
                >
                  {loginLoading ? "Signing in..." : "Login"}
                </Button>
              </Stack>
              {!isLoginLocked && loginFailedAttempts > 0 ? (
                <Typography
                  sx={{
                    mt: 2,
                    color: "warning.main",
                    fontSize: "0.84rem",
                  }}
                >
                  {loginAttemptsRemaining} login attempt
                  {loginAttemptsRemaining === 1 ? "" : "s"} remaining before the
                  form is temporarily disabled.
                </Typography>
              ) : null}
            </Box>
          </Box>
        </Stack>
      </Drawer>
      <Drawer
        anchor="right"
        open={signupOpen}
        onClose={handleSignupClose}
        PaperProps={{
          sx: {
            width: { xs: "100%", sm: 520 },
            p: { xs: 2.5, sm: 3 },
            background:
              "linear-gradient(180deg, rgba(255,255,255,0.99), rgba(248,250,252,0.98))",
            boxShadow: "0 28px 80px rgba(15, 23, 42, 0.22)",
          },
        }}
      >
        <Stack
          spacing={2.5}
          sx={{ height: "100%", overflowY: "auto", pr: 0.5 }}
        >
          <Box sx={{ position: "relative", pr: 5 }}>
            <Typography variant="h5" sx={{ fontWeight: 700 }}>
              Create your account
            </Typography>
            <IconButton
              aria-label="close signup"
              onClick={handleSignupClose}
              sx={{ position: "absolute", right: 0, top: -4 }}
            >
              <CloseIcon />
            </IconButton>
          </Box>

          <Divider />

          <Tabs
            value={signupAccountTab}
            onChange={handleSignupTabChange}
            variant="fullWidth"
          >
            <Tab value="personal" label="Personal" />
            <Tab value="organization" label="Organization" />
          </Tabs>

          <Box component="form" onSubmit={handleSignupSubmit}>
            <Stack spacing={2}>
              {signupError ? (
                <Alert severity="error">{signupError}</Alert>
              ) : null}

              <Stack direction={{ xs: "column", sm: "row" }} spacing={2}>
                <TextField
                  label="Username"
                  name="username"
                  size="small"
                  value={signupForm.username}
                  onChange={handleSignupChange}
                  required
                  error={Boolean(signupSubmitted && getSignupUsernameError())}
                  helperText={
                    signupSubmitted
                      ? getSignupUsernameError()
                      : signupForm.username.trim().length >= 3
                        ? signupUsernameChecking
                          ? "Checking username availability..."
                          : signupUsernameCheckedValue ===
                                signupForm.username.trim() &&
                              signupUsernameAvailable === true
                            ? "Username is available."
                            : signupUsernameCheckedValue ===
                                  signupForm.username.trim() &&
                                signupUsernameAvailable === false
                              ? "Username is already taken."
                              : ""
                        : ""
                  }
                  fullWidth
                />
                <TextField
                  label="Email"
                  name="email"
                  type="email"
                  size="small"
                  value={signupForm.email}
                  onChange={handleSignupChange}
                  required
                  error={Boolean(signupSubmitted && getSignupEmailError())}
                  helperText={
                    signupSubmitted
                      ? getSignupEmailError()
                      : signupForm.email.trim() &&
                          EMAIL_PATTERN.test(signupForm.email.trim()) &&
                          signupEmailCheckedValue === signupForm.email.trim() &&
                          signupEmailAvailable === false
                        ? "An account is already associated with this email address."
                        : ""
                  }
                  fullWidth
                />
              </Stack>
              {!isOrganizationSignup ? (
                <TextField
                  label="Password"
                  name="password"
                  size="small"
                  type={signupShowPassword ? "text" : "password"}
                  value={signupForm.password}
                  onChange={handleSignupChange}
                  required
                  error={Boolean(signupSubmitted && getSignupPasswordError())}
                  helperText={
                    signupSubmitted || signupForm.password.length > 0
                      ? getSignupPasswordError()
                      : ""
                  }
                  fullWidth
                  InputProps={{
                    endAdornment: (
                      <InputAdornment position="end">
                        <IconButton
                          aria-label="toggle signup password visibility"
                          onClick={() =>
                            setSignupShowPassword((current) => !current)
                          }
                          edge="end"
                        >
                          {signupShowPassword ? (
                            <VisibilityOffIcon />
                          ) : (
                            <VisibilityIcon />
                          )}
                        </IconButton>
                      </InputAdornment>
                    ),
                  }}
                />
              ) : null}
              {!isOrganizationSignup ? (
                <Stack direction={{ xs: "column", sm: "row" }} spacing={2}>
                  <TextField
                    label="First name"
                    name="fname"
                    size="small"
                    value={signupForm.fname}
                    onChange={handleSignupChange}
                    required
                    error={Boolean(
                      signupSubmitted && getSignupFirstNameError(),
                    )}
                    helperText={
                      signupSubmitted ? getSignupFirstNameError() : ""
                    }
                    fullWidth
                  />
                  <TextField
                    label="Last name"
                    name="lname"
                    size="small"
                    value={signupForm.lname}
                    onChange={handleSignupChange}
                    required
                    error={Boolean(signupSubmitted && getSignupLastNameError())}
                    helperText={signupSubmitted ? getSignupLastNameError() : ""}
                    fullWidth
                  />
                </Stack>
              ) : (
                <>
                  <Stack direction={{ xs: "column", sm: "row" }} spacing={2}>
                    <TextField
                      label="Password"
                      name="password"
                      size="small"
                      type={signupShowPassword ? "text" : "password"}
                      value={signupForm.password}
                      onChange={handleSignupChange}
                      required
                      error={Boolean(
                        signupSubmitted && getSignupPasswordError(),
                      )}
                      helperText={
                        signupSubmitted || signupForm.password.length > 0
                          ? getSignupPasswordError()
                          : ""
                      }
                      fullWidth
                      InputProps={{
                        endAdornment: (
                          <InputAdornment position="end">
                            <IconButton
                              aria-label="toggle signup password visibility"
                              onClick={() =>
                                setSignupShowPassword((current) => !current)
                              }
                              edge="end"
                            >
                              {signupShowPassword ? (
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
                      size="small"
                      value={signupForm.type}
                      onChange={handleSignupChange}
                      required
                      error={Boolean(
                        signupSubmitted && getSignupOrganizationTypeError(),
                      )}
                      helperText={
                        signupSubmitted ? getSignupOrganizationTypeError() : ""
                      }
                      fullWidth
                    >
                      <MenuItem value="business">Business</MenuItem>
                      <MenuItem value="ngo">NGO</MenuItem>
                      <MenuItem value="government organization">
                        Government Organization
                      </MenuItem>
                    </TextField>
                  </Stack>
                  <Stack direction={{ xs: "column", sm: "row" }} spacing={2}>
                    <TextField
                      label="Organization name"
                      name="company_name"
                      size="small"
                      value={signupForm.company_name}
                      onChange={handleSignupChange}
                      required
                      error={Boolean(
                        signupSubmitted && getSignupCompanyNameError(),
                      )}
                      helperText={
                        signupSubmitted ? getSignupCompanyNameError() : ""
                      }
                      fullWidth
                    />
                  </Stack>
                  <Stack direction={{ xs: "column", sm: "row" }} spacing={2}>
                    <CountryAutocomplete
                      value={signupForm.company_country}
                      onChange={handleSignupCountryChange}
                      textFieldProps={{
                        name: "company_country",
                        size: "small",
                        fullWidth: true,
                      }}
                    />
                  </Stack>
                  <UgandaLocationFields
                    value={{
                      district_id: signupForm.district_id,
                      constituency_id: signupForm.constituency_id,
                      subcounty_id: signupForm.subcounty_id,
                      parish_id: signupForm.parish_id,
                    }}
                    onChange={handleSignupLocationChange}
                    size="small"
                  />
                </>
              )}
              {!isOrganizationSignup ? (
                <Stack direction={{ xs: "column", sm: "row" }} spacing={2}>
                  <CountryAutocomplete
                    label="Country"
                    value={signupForm.company_country}
                    onChange={handleSignupCountryChange}
                    textFieldProps={{
                      name: "company_country",
                      size: "small",
                      fullWidth: true,
                    }}
                  />
                </Stack>
              ) : null}
              <Stack direction={{ xs: "column", sm: "row" }} spacing={2}>
                <PhoneNumberField
                  label="Mobile number"
                  name="mobile_number"
                  size="small"
                  country={signupForm.company_country}
                  value={signupForm.mobile_number}
                  onChange={(value) =>
                    setSignupForm((current) => ({
                      ...current,
                      mobile_number: value,
                    }))
                  }
                  error={Boolean(signupSubmitted && getSignupMobileError())}
                  helperText={
                    signupSubmitted
                      ? getSignupMobileError()
                      : signupForm.mobile_number.trim() &&
                          MOBILE_PATTERN.test(
                            signupForm.mobile_number.trim(),
                          ) &&
                          signupMobileCheckedValue ===
                            signupForm.mobile_number.trim() &&
                          signupMobileAvailable === false
                        ? "An account is already associated with this mobile number."
                        : undefined
                  }
                  fullWidth
                />
              </Stack>
              {!isOrganizationSignup ? (
                <Stack direction={{ xs: "column", sm: "row" }} spacing={2}>
                  <TextField
                    select
                    label="Gender"
                    name="gender"
                    size="small"
                    value={signupForm.gender}
                    onChange={handleSignupChange}
                    fullWidth
                  >
                    <MenuItem value="">Prefer not to say</MenuItem>
                    <MenuItem value="female">Female</MenuItem>
                    <MenuItem value="male">Male</MenuItem>
                  </TextField>
                </Stack>
              ) : null}

              <Stack
                direction={{ xs: "column", sm: "row" }}
                spacing={1.5}
                sx={{ pt: 1 }}
              >
                <Button
                  type="submit"
                  variant="contained"
                  disabled={signupLoading || !canEnableSignupSubmit()}
                  sx={{ ...yellowButtonSx, px: 3, py: 1.2 }}
                >
                  {signupLoading ? "Creating account..." : "Create account"}
                </Button>
                <Button
                  type="button"
                  onClick={() =>
                    handleLoginOpen({
                      identifier:
                        signupForm.email.trim() ||
                        formData.email_or_mobile_number,
                    })
                  }
                  sx={{ ...darkOutlineButtonSx, px: 3, py: 1.2 }}
                >
                  I already have an account
                </Button>
              </Stack>
            </Stack>
          </Box>
        </Stack>
      </Drawer>
    </Box>
  );
};

export default MenuHome;
