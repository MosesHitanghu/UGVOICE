import { useState } from "react";
import {
  Alert,
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Stack,
  TextField,
  Typography,
} from "@mui/material";
import LockRoundedIcon from "@mui/icons-material/LockRounded";

import { api, type ApiUser } from "../lib/api";

type SharedPostLoginDialogProps = {
  open: boolean;
  onSuccess: (user: ApiUser) => void;
  onCancel: () => void;
};

const SharedPostLoginDialog = ({
  open,
  onSuccess,
  onCancel,
}: SharedPostLoginDialogProps) => {
  const [formData, setFormData] = useState({
    email_or_mobile_number: "",
    password: "",
  });
  const [submitted, setSubmitted] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const getIdentifierError = () =>
    formData.email_or_mobile_number.trim() ? "" : "Email or mobile number is required.";

  const getPasswordError = () =>
    formData.password.trim() ? "" : "Password is required.";

  const handleSubmit = async () => {
    setSubmitted(true);
    if (getIdentifierError() || getPasswordError()) {
      return;
    }

    try {
      setLoading(true);
      setError("");
      const response = await api.post<{ message: string; user: ApiUser }>(
        "/login",
        formData,
      );
      if (response.data.message === "Login successful") {
        onSuccess(response.data.user);
      }
    } catch (caughtError: unknown) {
      const message =
        typeof caughtError === "object" &&
        caughtError !== null &&
        "response" in caughtError
          ? (
              caughtError as {
                response?: { data?: { detail?: string } };
              }
            ).response?.data?.detail || "Login failed."
          : "Login failed.";
      setError(message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onClose={onCancel} maxWidth="sm" fullWidth>
      <DialogTitle>Login to continue</DialogTitle>
      <DialogContent>
        <Stack spacing={2.25} sx={{ pt: 1 }}>
          <Stack direction="row" spacing={1.25} alignItems="center">
            <LockRoundedIcon color="primary" />
            <Typography color="text.secondary">
              This shared article requires login before you can open it.
            </Typography>
          </Stack>
          {error ? <Alert severity="error">{error}</Alert> : null}
          <TextField
            label="Email or mobile number"
            value={formData.email_or_mobile_number}
            onChange={(event) =>
              setFormData((current) => ({
                ...current,
                email_or_mobile_number: event.target.value,
              }))
            }
            error={Boolean(submitted && getIdentifierError())}
            helperText={submitted ? getIdentifierError() : ""}
            fullWidth
          />
          <TextField
            label="Password"
            type="password"
            value={formData.password}
            onChange={(event) =>
              setFormData((current) => ({
                ...current,
                password: event.target.value,
              }))
            }
            error={Boolean(submitted && getPasswordError())}
            helperText={submitted ? getPasswordError() : ""}
            fullWidth
          />
        </Stack>
      </DialogContent>
      <DialogActions sx={{ px: 3, pb: 2.5 }}>
        <Button onClick={onCancel}>Back</Button>
        <Button variant="contained" onClick={() => void handleSubmit()} disabled={loading}>
          {loading ? "Signing in..." : "Login"}
        </Button>
      </DialogActions>
    </Dialog>
  );
};

export default SharedPostLoginDialog;
