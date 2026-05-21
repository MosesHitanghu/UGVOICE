import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  Alert,
  Box,
  Button,
  Container,
  MenuItem,
  Paper,
  Stack,
  TextField,
  Typography,
} from "@mui/material";
import ArrowBackRoundedIcon from "@mui/icons-material/ArrowBackRounded";
import PersonAddAltRoundedIcon from "@mui/icons-material/PersonAddAltRounded";
import { alpha } from "@mui/material/styles";

import { api, type ApiUser } from "../../lib/api";
import CountryAutocomplete from "../../components/CountryAutocomplete";
import PhoneNumberField from "../../components/PhoneNumberField";
import { storeUser } from "../../lib/session";

type SignupForm = {
  username: string;
  email: string;
  password: string;
  fname: string;
  lname: string;
  company_country: string;
  mobile_number: string;
  gender: string;
  visibility: string;
};

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const MOBILE_PATTERN = /^[+\d][\d\s-]{6,}$/;
const UPPERCASE_PATTERN = /[A-Z]/;
const LOWERCASE_PATTERN = /[a-z]/;
const NUMBER_PATTERN = /\d/;
const SYMBOL_PATTERN = /[^A-Za-z0-9]/;

const initialForm: SignupForm = {
  username: "",
  email: "",
  password: "",
  fname: "",
  lname: "",
  company_country: "",
  mobile_number: "",
  gender: "",
  visibility: "public",
};

const SignupPage = () => {
  const [form, setForm] = useState<SignupForm>(initialForm);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [submitted, setSubmitted] = useState(false);
  const [usernameChecking, setUsernameChecking] = useState(false);
  const [usernameAvailable, setUsernameAvailable] = useState<boolean | null>(null);
  const [usernameCheckedValue, setUsernameCheckedValue] = useState("");
  const [emailChecking, setEmailChecking] = useState(false);
  const [emailAvailable, setEmailAvailable] = useState<boolean | null>(null);
  const [emailCheckedValue, setEmailCheckedValue] = useState("");
  const [mobileChecking, setMobileChecking] = useState(false);
  const [mobileAvailable, setMobileAvailable] = useState<boolean | null>(null);
  const [mobileCheckedValue, setMobileCheckedValue] = useState("");
  const navigate = useNavigate();

  const isPasswordStrong = (password: string) =>
    password.length >= 8 &&
    UPPERCASE_PATTERN.test(password) &&
    LOWERCASE_PATTERN.test(password) &&
    NUMBER_PATTERN.test(password) &&
    SYMBOL_PATTERN.test(password);

  const getUsernameError = () => {
    if (!form.username.trim()) {
      return "Username is required.";
    }
    if (form.username.trim().length < 3) {
      return "Username must be at least 3 characters.";
    }
    if (
      usernameCheckedValue === form.username.trim() &&
      usernameAvailable === false
    ) {
      return "Username is already taken.";
    }
    return "";
  };

  const getFirstNameError = () => {
    if (!form.fname.trim()) {
      return "First name is required.";
    }
    return "";
  };

  const getLastNameError = () => {
    if (!form.lname.trim()) {
      return "Last name is required.";
    }
    return "";
  };

  const getEmailError = () => {
    if (!form.email.trim()) {
      return "Email is required.";
    }
    if (!EMAIL_PATTERN.test(form.email.trim())) {
      return "Enter a valid email address.";
    }
    if (
      emailCheckedValue === form.email.trim() &&
      emailAvailable === false
    ) {
      return "An account is already associated with this email address.";
    }
    return "";
  };

  const getPasswordError = () => {
    if (!form.password.trim()) {
      return "Password is required.";
    }
    if (form.password.length < 8) {
      return "Password must be at least 8 characters.";
    }
    if (!UPPERCASE_PATTERN.test(form.password)) {
      return "Password must include at least one uppercase letter.";
    }
    if (!LOWERCASE_PATTERN.test(form.password)) {
      return "Password must include at least one lowercase letter.";
    }
    if (!NUMBER_PATTERN.test(form.password)) {
      return "Password must include at least one number.";
    }
    if (!SYMBOL_PATTERN.test(form.password)) {
      return "Password must include at least one symbol.";
    }
    return "";
  };

  const getMobileError = () => {
    if (!form.mobile_number.trim()) {
      return "";
    }
    if (!MOBILE_PATTERN.test(form.mobile_number.trim())) {
      return "Enter a valid mobile number.";
    }
    if (
      mobileCheckedValue === form.mobile_number.trim() &&
      mobileAvailable === false
    ) {
      return "An account is already associated with this mobile number.";
    }
    return "";
  };

  const canEnableSubmit = useMemo(() => {
    if (!form.username.trim() || form.username.trim().length < 3) {
      return false;
    }
    if (!form.fname.trim() || !form.lname.trim()) {
      return false;
    }
    if (!form.email.trim() || !EMAIL_PATTERN.test(form.email.trim())) {
      return false;
    }
    if (!isPasswordStrong(form.password)) {
      return false;
    }
    return true;
  }, [form]);

  useEffect(() => {
    const username = form.username.trim();
    if (username.length < 3) {
      setUsernameChecking(false);
      setUsernameAvailable(null);
      setUsernameCheckedValue("");
      return;
    }

    const timeoutId = window.setTimeout(async () => {
      setUsernameChecking(true);
      try {
        const response = await api.get<{ available: boolean; username: string }>(
          "/users/username-availability",
          {
            params: { username },
          },
        );
        setUsernameAvailable(response.data.available);
        setUsernameCheckedValue(response.data.username);
      } catch {
        setUsernameAvailable(null);
        setUsernameCheckedValue(username);
      } finally {
        setUsernameChecking(false);
      }
    }, 350);

    return () => {
      window.clearTimeout(timeoutId);
    };
  }, [form.username]);

  useEffect(() => {
    const email = form.email.trim();
    if (!email || !EMAIL_PATTERN.test(email)) {
      setEmailChecking(false);
      setEmailAvailable(null);
      setEmailCheckedValue("");
      return;
    }

    const timeoutId = window.setTimeout(async () => {
      setEmailChecking(true);
      try {
        const response = await api.get<{
          email?: { available: boolean; value: string; message: string };
        }>("/users/signup-availability", {
          params: { email },
        });
        setEmailAvailable(response.data.email?.available ?? null);
        setEmailCheckedValue(response.data.email?.value ?? email);
      } catch {
        setEmailAvailable(null);
        setEmailCheckedValue(email);
      } finally {
        setEmailChecking(false);
      }
    }, 350);

    return () => {
      window.clearTimeout(timeoutId);
    };
  }, [form.email]);

  useEffect(() => {
    const mobileNumber = form.mobile_number.trim();
    if (!mobileNumber || !MOBILE_PATTERN.test(mobileNumber)) {
      setMobileChecking(false);
      setMobileAvailable(null);
      setMobileCheckedValue("");
      return;
    }

    const timeoutId = window.setTimeout(async () => {
      setMobileChecking(true);
      try {
        const response = await api.get<{
          mobile_number?: { available: boolean; value: string; message: string };
        }>("/users/signup-availability", {
          params: { mobile_number: mobileNumber },
        });
        setMobileAvailable(response.data.mobile_number?.available ?? null);
        setMobileCheckedValue(response.data.mobile_number?.value ?? mobileNumber);
      } catch {
        setMobileAvailable(null);
        setMobileCheckedValue(mobileNumber);
      } finally {
        setMobileChecking(false);
      }
    }, 350);

    return () => {
      window.clearTimeout(timeoutId);
    };
  }, [form.mobile_number]);

  const handleChange = (
    event: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>,
  ) => {
    const { name, value } = event.target;
    setForm((current) => ({ ...current, [name]: value }));
  };

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setSubmitted(true);
    if (
      !canEnableSubmit ||
      getMobileError() ||
      usernameChecking ||
      emailChecking ||
      mobileChecking
    ) {
      return;
    }
    setLoading(true);
    setError("");

    try {
      const response = await api.post<{ message: string; user: ApiUser }>(
        "/signup",
        {
          ...form,
          username: form.username.trim(),
          email: form.email.trim(),
          company_country: form.company_country.trim() || null,
          mobile_number: form.mobile_number || null,
          gender: form.gender || null,
          fname: form.fname.trim(),
          lname: form.lname.trim(),
        },
      );
      storeUser(response.data.user);
      window.location.assign("/dashboard");
      return;
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
      setError(message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Box
      sx={{
        minHeight: "100vh",
        background:
          "radial-gradient(circle at top right, rgba(252,220,4,0.22), transparent 28%), linear-gradient(135deg, #000000 0%, #111111 54%, #1F1F1F 100%)",
        py: { xs: 6, md: 10 },
      }}
    >
      <Container maxWidth="sm">
        <Button
          startIcon={<ArrowBackRoundedIcon />}
          onClick={() => navigate("/")}
          sx={{ color: "#FFFFFF", mb: 3 }}
        >
          Back home
        </Button>

        <Paper
          elevation={6}
          sx={{
            p: { xs: 3, md: 4.5 },
            background:
              "linear-gradient(180deg, rgba(255,255,255,0.98), rgba(248,250,252,0.96))",
            boxShadow: "0 28px 80px rgba(15, 23, 42, 0.28)",
          }}
        >
          <Stack spacing={2.5}>
            <Stack direction="row" spacing={1.5} alignItems="center">
              <Box
                sx={{
                  width: 52,
                  height: 52,
                  borderRadius: "18px",
                  display: "grid",
                  placeItems: "center",
                  bgcolor: alpha("#FCDC04", 0.14),
                  color: "#D90000",
                }}
              >
                <PersonAddAltRoundedIcon />
              </Box>
              <Box>
                <Typography variant="h4" sx={{ fontWeight: 700 }}>
                  Create your account
                </Typography>
                <Typography sx={{ color: "text.secondary", mt: 0.5 }}>
                  Start with the essentials. The rest of the profile can be
                  completed after you sign in.
                </Typography>
              </Box>
            </Stack>

            {error ? <Alert severity="error">{error}</Alert> : null}

            <Box component="form" onSubmit={handleSubmit}>
              <Stack spacing={2}>
                <TextField
                  label="Username"
                  name="username"
                  value={form.username}
                  onChange={handleChange}
                  required
                  error={Boolean(submitted && getUsernameError())}
                  helperText={
                    submitted
                      ? getUsernameError()
                      : form.username.trim().length >= 3
                        ? usernameChecking
                          ? "Checking username availability..."
                          : usernameCheckedValue === form.username.trim() &&
                              usernameAvailable === true
                            ? "Username is available."
                            : usernameCheckedValue === form.username.trim() &&
                                usernameAvailable === false
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
                  value={form.email}
                  onChange={handleChange}
                  required
                  error={Boolean(submitted && getEmailError())}
                  helperText={
                    submitted
                      ? getEmailError()
                      : form.email.trim() && EMAIL_PATTERN.test(form.email.trim()) &&
                          emailCheckedValue === form.email.trim() &&
                          emailAvailable === false
                        ? "An account is already associated with this email address."
                        : ""
                  }
                  fullWidth
                />
                <TextField
                  label="Password"
                  name="password"
                  type="password"
                  value={form.password}
                  onChange={handleChange}
                  required
                  error={Boolean(submitted && getPasswordError())}
                  helperText={
                    submitted || form.password.length > 0
                      ? getPasswordError()
                      : ""
                  }
                  fullWidth
                />
                <Stack direction={{ xs: "column", sm: "row" }} spacing={2}>
                  <TextField
                    label="First name"
                    name="fname"
                    value={form.fname}
                    onChange={handleChange}
                    required
                    error={Boolean(submitted && getFirstNameError())}
                    helperText={submitted ? getFirstNameError() : ""}
                    fullWidth
                  />
                  <TextField
                    label="Last name"
                    name="lname"
                    value={form.lname}
                    onChange={handleChange}
                    required
                    error={Boolean(submitted && getLastNameError())}
                    helperText={submitted ? getLastNameError() : ""}
                    fullWidth
                  />
                </Stack>
                <CountryAutocomplete
                  label="Country"
                  value={form.company_country}
                  onChange={(value) =>
                    setForm((current) => ({
                      ...current,
                      company_country: value,
                      mobile_number: "",
                    }))
                  }
                  textFieldProps={{ fullWidth: true }}
                />
                <Stack direction={{ xs: "column", sm: "row" }} spacing={2}>
                  <PhoneNumberField
                    label="Mobile number"
                    name="mobile_number"
                    country={form.company_country}
                    value={form.mobile_number}
                    onChange={(value) =>
                      setForm((current) => ({
                        ...current,
                        mobile_number: value,
                      }))
                    }
                    error={Boolean(submitted && getMobileError())}
                    helperText={
                      submitted
                        ? getMobileError()
                        : form.mobile_number.trim() &&
                            MOBILE_PATTERN.test(form.mobile_number.trim()) &&
                            mobileCheckedValue === form.mobile_number.trim() &&
                            mobileAvailable === false
                          ? "An account is already associated with this mobile number."
                          : undefined
                    }
                    fullWidth
                  />
                </Stack>
                <Stack direction={{ xs: "column", sm: "row" }} spacing={2}>
                  <TextField
                    select
                    label="Gender"
                    name="gender"
                    value={form.gender}
                    onChange={handleChange}
                    fullWidth
                  >
                    <MenuItem value="">Prefer not to say</MenuItem>
                    <MenuItem value="female">Female</MenuItem>
                    <MenuItem value="male">Male</MenuItem>
                    <MenuItem value="non-binary">Non-binary</MenuItem>
                  </TextField>
                </Stack>

                <Stack
                  direction={{ xs: "column", sm: "row" }}
                  spacing={1.5}
                  sx={{ pt: 1 }}
                >
                  <Button
                    type="submit"
                    variant="contained"
                    disabled={!canEnableSubmit || loading}
                    sx={{ px: 3, py: 1.2, fontWeight: 600 }}
                  >
                    {loading ? "Creating account..." : "Create account"}
                  </Button>
                  <Button onClick={() => navigate("/")} sx={{ px: 3, py: 1.2 }}>
                    I already have an account
                  </Button>
                </Stack>
              </Stack>
            </Box>
          </Stack>
        </Paper>
      </Container>
    </Box>
  );
};

export default SignupPage;
