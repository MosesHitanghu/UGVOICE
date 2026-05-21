import { useEffect, useState } from "react";
import {
  Alert,
  Button,
  CircularProgress,
  MenuItem,
  Paper,
  Stack,
  TextField,
  Typography,
} from "@mui/material";
 

import CenteredLoader from "../../components/CenteredLoader";
import CountryAutocomplete from "../../components/CountryAutocomplete";
import PhoneNumberField from "../../components/PhoneNumberField";
import UgandaLocationFields from "../../components/UgandaLocationFields";
import { api, type ApiUser } from "../../lib/api";
import { rebasePhoneNumberToCountry } from "../../lib/countryPhoneMeta";
import { getStoredUser, storeUser } from "../../lib/session";

const MOBILE_PATTERN = /^[+\d][\d\s-]{6,}$/;

type ProfilePageProps = {
  embedded?: boolean;
};

const ProfilePage = ({ embedded = false }: ProfilePageProps) => {
  const currentUser = getStoredUser();
  const currentUserId = currentUser?.id;
  const [user, setUser] = useState<ApiUser | null>(null);
  const [error, setError] = useState("");
  const [successMessage, setSuccessMessage] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saveAttempted, setSaveAttempted] = useState(false);

  const loadProfile = async () => {
    if (!currentUserId) {
      return;
    }
    const response = await api.get<ApiUser>(`/users/${currentUserId}`, {
      params: {
        viewer_user_id: currentUserId,
      },
    });
    setUser(response.data);
  };

  useEffect(() => {
    const load = async () => {
      if (!currentUserId) {
        setLoading(false);
        return;
      }

      try {
        setError("");
        await loadProfile();
      } catch {
        setError("Unable to load your profile.");
      } finally {
        setLoading(false);
      }
    };
    void load();
  }, [currentUserId]);

  const handleProfileChange = (
    event: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>,
  ) => {
    if (!user) {
      return;
    }
    const { name, value } = event.target;
    setUser((current) =>
      current
        ? {
            ...current,
            [name]: value,
          }
        : current,
    );
  };

  const handleCountryChange = (country: string) => {
    setUser((current) =>
      current
        ? {
            ...current,
            company_country: country,
            mobile_number: rebasePhoneNumberToCountry(
              current.mobile_number,
              current.company_country,
              country,
            ),
          }
        : current,
    );
  };

  const handleLocationChange = (nextValue: {
    district_id?: number | null;
    constituency_id?: number | null;
    subcounty_id?: number | null;
    parish_id?: number | null;
  }) => {
    setUser((current) =>
      current
        ? {
            ...current,
            district_id: nextValue.district_id ?? null,
            constituency_id: nextValue.constituency_id ?? null,
            subcounty_id: nextValue.subcounty_id ?? null,
            parish_id: nextValue.parish_id ?? null,
          }
        : current,
    );
  };

  const handleSave = async () => {
    if (!user || !currentUserId || user.id !== currentUserId) {
      return;
    }
    setSaveAttempted(true);
    if (getMobileError()) {
      return;
    }

    try {
      setSaving(true);
      setError("");
      setSuccessMessage("");
      const response = await api.put(`/users/${currentUserId}`, {
        fname: user.fname,
        lname: user.lname,
        mobile_number: user.mobile_number,
        visibility: user.visibility,
        gender: user.gender,
        company_name: user.company_name,
        company_country: user.company_country,
        district_id: user.district_id,
        constituency_id: user.constituency_id,
        subcounty_id: user.subcounty_id,
        parish_id: user.parish_id,
        description: user.description,
      });
      storeUser(response.data);
      setUser(response.data);
      setSuccessMessage("Profile updated successfully.");
    } catch (caughtError: unknown) {
      const message =
        typeof caughtError === "object" &&
        caughtError !== null &&
        "response" in caughtError
          ? (
              caughtError as {
                response?: { data?: { detail?: string } };
              }
            ).response?.data?.detail || "Unable to save your profile."
          : "Unable to save your profile.";
      setError(message);
    } finally {
      setSaving(false);
    }
  };

  const getMobileError = () => {
    if (!user?.mobile_number?.trim()) {
      return "";
    }
    if (!MOBILE_PATTERN.test(user.mobile_number.trim())) {
      return "Enter a valid mobile number.";
    }
    return "";
  };

  if (loading) {
    return <CenteredLoader minHeight={320} />;
  }

  if (!user) {
    return <Alert severity="error">{error || "Unable to load your profile."}</Alert>;
  }

  return (
    <Stack spacing={3}>
      <Paper elevation={3} sx={{ p: 3 }}>
        {!embedded ? (
          <>
            <Typography variant="h5" sx={{ fontWeight: 700, mb: 2 }}>
              Complete your profile
            </Typography>
          </>
        ) : null}

        <Stack spacing={2}>
          {error ? <Alert severity="error">{error}</Alert> : null}
          {successMessage ? <Alert severity="success">{successMessage}</Alert> : null}

          <Stack direction={{ xs: "column", md: "row" }} spacing={2}>
            <TextField
              label="First name"
              name="fname"
              value={user.fname || ""}
              onChange={handleProfileChange}
              fullWidth
            />
            <TextField
              label="Last name"
              name="lname"
              value={user.lname || ""}
              onChange={handleProfileChange}
              fullWidth
            />
          </Stack>

          <CountryAutocomplete
            label="Country"
            value={user.company_country || ""}
            onChange={handleCountryChange}
            textFieldProps={{
              name: "company_country",
              fullWidth: true,
            }}
          />

          <Stack direction={{ xs: "column", md: "row" }} spacing={2}>
            <PhoneNumberField
              label="Mobile number"
              name="mobile_number"
              country={user.company_country || ""}
              value={user.mobile_number || ""}
              onChange={(value) =>
                setUser((current) =>
                  current
                    ? {
                        ...current,
                        mobile_number: value,
                      }
                    : current,
                )
              }
              error={Boolean(saveAttempted && getMobileError())}
              helperText={saveAttempted ? getMobileError() : undefined}
              fullWidth
            />
            <TextField
              select
              label="Visibility"
              name="visibility"
              value={user.visibility || "public"}
              onChange={handleProfileChange}
              fullWidth
            >
              <MenuItem value="public">Public</MenuItem>
              <MenuItem value="private">Private</MenuItem>
            </TextField>
          </Stack>

          <Stack direction={{ xs: "column", md: "row" }} spacing={2}>
            <TextField
              select
              label="Gender"
              name="gender"
              value={user.gender || ""}
              onChange={handleProfileChange}
              fullWidth
            >
              <MenuItem value="">Prefer not to say</MenuItem>
              <MenuItem value="female">Female</MenuItem>
              <MenuItem value="male">Male</MenuItem>
              <MenuItem value="non-binary">Non-binary</MenuItem>
            </TextField>
            <TextField
              label="Company"
              name="company_name"
              value={user.company_name || ""}
              onChange={handleProfileChange}
              fullWidth
            />
          </Stack>

          <UgandaLocationFields
            value={{
              district_id: user.district_id,
              constituency_id: user.constituency_id,
              subcounty_id: user.subcounty_id,
              parish_id: user.parish_id,
            }}
            onChange={handleLocationChange}
          />

          <TextField
            label="Bio"
            name="description"
            value={user.description || ""}
            onChange={handleProfileChange}
            multiline
            minRows={4}
          />

          <Button
            variant="contained"
            onClick={() => void handleSave()}
            sx={{ alignSelf: "flex-end", minWidth: 150 }}
            disabled={saving}
          >
            {saving ? <CircularProgress size={20} color="inherit" /> : "Save Changes"}
          </Button>
        </Stack>
      </Paper>
    </Stack>
  );
};

export default ProfilePage;
