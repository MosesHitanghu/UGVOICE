import { InputAdornment, Stack, TextField, Typography, type TextFieldProps } from "@mui/material";

import { buildPhoneNumber, getCountryPhoneMeta, getPhoneInputValue } from "../lib/countryPhoneMeta";

type PhoneNumberFieldProps = Omit<TextFieldProps, "value" | "onChange"> & {
  country: string;
  value: string;
  onChange: (value: string) => void;
};

const PhoneNumberField = ({
  country,
  value,
  onChange,
  helperText,
  InputProps,
  inputProps,
  ...textFieldProps
}: PhoneNumberFieldProps) => {
  const meta = getCountryPhoneMeta(country);
  const displayValue = getPhoneInputValue(value, country);

  return (
    <TextField
      {...textFieldProps}
      value={displayValue}
      onChange={(event) => onChange(buildPhoneNumber(event.target.value, country))}
      disabled={textFieldProps.disabled || !country.trim()}
      helperText={
        helperText ||
        (country.trim()
          ? meta
            ? `Complete the number after ${meta.dialCode}.`
            : "Country code metadata is unavailable for this country yet."
          : "Select country first.")
      }
      InputProps={{
        ...InputProps,
        startAdornment: meta ? (
          <InputAdornment position="start">
            <Stack direction="row" spacing={0.75} alignItems="center">
              <Typography component="span" sx={{ fontSize: "1rem" }}>
                {meta.flag}
              </Typography>
              <Typography component="span" sx={{ fontWeight: 600, whiteSpace: "nowrap" }}>
                {meta.dialCode}
              </Typography>
            </Stack>
          </InputAdornment>
        ) : InputProps?.startAdornment,
      }}
      inputProps={{
        ...inputProps,
        inputMode: "tel",
      }}
    />
  );
};

export default PhoneNumberField;
