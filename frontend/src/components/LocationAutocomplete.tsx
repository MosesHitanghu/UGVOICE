import { Autocomplete, TextField, type TextFieldProps } from "@mui/material";

import type { ApiLocationOption } from "../lib/api";

type LocationAutocompleteProps = {
  label: string;
  options: ApiLocationOption[];
  valueId?: number | null;
  onChange: (valueId: number | null) => void;
  disabled?: boolean;
  loading?: boolean;
  textFieldProps?: TextFieldProps;
};

const LocationAutocomplete = ({
  label,
  options,
  valueId,
  onChange,
  disabled = false,
  loading = false,
  textFieldProps,
}: LocationAutocompleteProps) => {
  const selectedOption =
    options.find((option) => option.id === valueId) ?? null;

  return (
    <Autocomplete
      options={options}
      value={selectedOption}
      getOptionLabel={(option) => option.name}
      isOptionEqualToValue={(option, value) => option.id === value.id}
      onChange={(_, nextValue) => onChange(nextValue?.id ?? null)}
      disabled={disabled}
      loading={loading}
      fullWidth={Boolean(textFieldProps?.fullWidth)}
      renderInput={(params) => (
        <TextField
          {...params}
          {...textFieldProps}
          label={label}
        />
      )}
    />
  );
};

export default LocationAutocomplete;
