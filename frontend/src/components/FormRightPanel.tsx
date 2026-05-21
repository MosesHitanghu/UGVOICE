import React, { useState } from "react";
import {
  Drawer,
  Box,
  Typography,
  TextField,
  Button,
  IconButton,
  Divider,
  Stack,
} from "@mui/material";
import CloseIcon from "@mui/icons-material/Close";
import SaveIcon from "@mui/icons-material/Save";
import CancelIcon from "@mui/icons-material/Cancel";
import { alpha, useTheme } from "@mui/material/styles";

type UserFormValues = {
  id?: number;
  first_name: string;
  last_name: string;
  email: string;
  gender: string;
  ip_address: string;
};

type FormRightPanelProps = {
  open: boolean;
  title?: string;
  initialData?: UserFormValues | null;
  onClose: () => void;
  onSubmit: (values: UserFormValues) => void;
};

const defaultValues: UserFormValues = {
  first_name: "",
  last_name: "",
  email: "",
  gender: "",
  ip_address: "",
};

const FormRightPanel = ({
  open,
  title = "Add New User",
  initialData = null,
  onClose,
  onSubmit,
}: FormRightPanelProps) => {
  const theme = useTheme();
  const [values, setValues] = useState<UserFormValues>(
    () => initialData ?? defaultValues,
  );
  const [errors, setErrors] = useState<
    Partial<Record<keyof UserFormValues, string>>
  >({});

  const validateField = (name: keyof UserFormValues, value: string) => {
    if (!value.trim()) {
      return `${name.replace(/_/g, " ").replace(/\b\w/g, (char) => char.toUpperCase())} is required`;
    }

    if (name === "email") {
      const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailPattern.test(value)) {
        return "Enter a valid email address";
      }
    }

    if (name === "ip_address") {
      const ipPattern =
        /^(25[0-5]|2[0-4]\d|1\d{2}|[1-9]?\d)(\.(25[0-5]|2[0-4]\d|1\d{2}|[1-9]?\d)){3}$/;
      if (!ipPattern.test(value)) {
        return "Enter a valid IPv4 address";
      }
    }

    return "";
  };

  const validateForm = () => {
    const nextErrors: Partial<Record<keyof UserFormValues, string>> = {};

    (Object.keys(values) as Array<keyof UserFormValues>).forEach((key) => {
      const error = validateField(key, String(values[key] ?? ""));
      if (error) {
        nextErrors[key] = error;
      }
    });

    setErrors(nextErrors);
    return Object.keys(nextErrors).length === 0;
  };

  const handleChange = (
    event: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>,
  ) => {
    const { name, value } = event.target;
    setValues((prev) => ({ ...prev, [name]: value }));
    setErrors((prev) => ({ ...prev, [name as keyof UserFormValues]: "" }));
  };

  const handleBlur = (
    event: React.FocusEvent<HTMLInputElement | HTMLTextAreaElement>,
  ) => {
    const { name, value } = event.target;
    const error = validateField(name as keyof UserFormValues, value);
    setErrors((prev) => ({ ...prev, [name as keyof UserFormValues]: error }));
  };

  const handleSubmit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!validateForm()) {
      return;
    }
    onSubmit(values);
  };

  return (
    <Drawer
      anchor="right"
      open={open}
      onClose={onClose}
      ModalProps={{
        style: { zIndex: theme.zIndex.drawer + 2 },
      }}
      PaperProps={{
        sx: {
          width: { xs: "100%", sm: 450 },
          backgroundImage: "none",
          bgcolor: "background.paper",
          borderLeft: `1px solid ${theme.palette.divider}`,
        },
      }}
    >
      <Box
        component="form"
        onSubmit={handleSubmit}
        sx={{
          display: "flex",
          flexDirection: "column",
          height: "100%",
        }}
      >
        <Box
          sx={{
            p: 2,
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            bgcolor: alpha(theme.palette.secondary.main, 0.04),
          }}
        >
          <Typography variant="h6" fontWeight="600">
            {title}
          </Typography>
          <IconButton onClick={onClose} size="small">
            <CloseIcon />
          </IconButton>
        </Box>
        <Divider />

        <Box sx={{ p: 3, overflowY: "auto" }}>
          <Stack spacing={3}>
            <TextField
              name="first_name"
              id="first_name"
              label="First Name"
              variant="outlined"
              size="small"
              value={values.first_name}
              onChange={handleChange}
              onBlur={handleBlur}
              error={Boolean(errors.first_name)}
              helperText={errors.first_name}
              required
              fullWidth
            />
            <TextField
              name="last_name"
              id="last_name"
              label="Last Name"
              variant="outlined"
              size="small"
              value={values.last_name}
              onChange={handleChange}
              onBlur={handleBlur}
              error={Boolean(errors.last_name)}
              helperText={errors.last_name}
              required
              fullWidth
            />
            <TextField
              name="email"
              id="email"
              type="email"
              label="Email Address"
              variant="outlined"
              size="small"
              autoComplete="email"
              value={values.email}
              onChange={handleChange}
              onBlur={handleBlur}
              error={Boolean(errors.email)}
              helperText={errors.email}
              required
              fullWidth
            />
            <TextField
              name="gender"
              id="gender"
              label="Gender"
              variant="outlined"
              size="small"
              value={values.gender}
              onChange={handleChange}
              onBlur={handleBlur}
              error={Boolean(errors.gender)}
              helperText={errors.gender}
              required
              fullWidth
            />
            <TextField
              name="ip_address"
              id="ip_address"
              label="IP Address"
              variant="outlined"
              size="small"
              value={values.ip_address}
              onChange={handleChange}
              onBlur={handleBlur}
              error={Boolean(errors.ip_address)}
              helperText={errors.ip_address}
              required
              fullWidth
            />
          </Stack>

          <Divider sx={{ my: 3 }} />
          <Stack
            direction="row"
            spacing={1.5}
            justifyContent="flex-end"
            sx={{ width: "100%" }}
          >
            <Button
              type="submit"
              variant="contained"
              size="small"
              disableElevation
              startIcon={<SaveIcon />}
              sx={{ minWidth: 148 }}
            >
              Save Changes
            </Button>
            <Button
              variant="outlined"
              size="small"
              onClick={onClose}
              sx={{
                minWidth: 112,
                color: "text.primary",
                borderColor: theme.palette.divider,
              }}
              startIcon={<CancelIcon />}
            >
              Cancel
            </Button>
          </Stack>
        </Box>
      </Box>
    </Drawer>
  );
};

export default FormRightPanel;
