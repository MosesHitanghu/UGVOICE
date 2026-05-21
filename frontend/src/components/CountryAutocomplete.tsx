import { useEffect, useState } from "react";
import { Autocomplete, CircularProgress, TextField, type TextFieldProps } from "@mui/material";

import { api, type ApiCountry } from "../lib/api";

let cachedCountries: ApiCountry[] | null = null;
let countriesRequest: Promise<ApiCountry[]> | null = null;

const loadCountries = async () => {
  if (cachedCountries) {
    return cachedCountries;
  }

  if (!countriesRequest) {
    countriesRequest = api
      .get<ApiCountry[]>("/countries")
      .then((response) => {
        cachedCountries = response.data;
        return response.data;
      })
      .finally(() => {
        countriesRequest = null;
      });
  }

  return countriesRequest;
};

type CountryAutocompleteProps = {
  label?: string;
  value: string;
  onChange: (value: string) => void;
  textFieldProps?: TextFieldProps;
};

const CountryAutocomplete = ({
  label = "Country",
  value,
  onChange,
  textFieldProps,
}: CountryAutocompleteProps) => {
  const [options, setOptions] = useState<ApiCountry[]>(cachedCountries ?? []);
  const [loading, setLoading] = useState(!cachedCountries);

  useEffect(() => {
    let active = true;

    const fetchCountries = async () => {
      try {
        setLoading(true);
        const countries = await loadCountries();
        if (active) {
          setOptions(countries);
        }
      } finally {
        if (active) {
          setLoading(false);
        }
      }
    };

    void fetchCountries();

    return () => {
      active = false;
    };
  }, []);

  return (
    <Autocomplete
      options={options.map((country) => country.name)}
      fullWidth={Boolean(textFieldProps?.fullWidth)}
      value={value || null}
      inputValue={value}
      onChange={(_, newValue) => onChange(newValue || "")}
      onInputChange={(_, newInputValue, reason) => {
        if (reason === "input" || reason === "clear") {
          onChange(newInputValue);
        }
      }}
      loading={loading}
      renderInput={(params) => (
        <TextField
          {...params}
          {...textFieldProps}
          label={label}
          InputProps={{
            ...params.InputProps,
            endAdornment: (
              <>
                {loading ? <CircularProgress color="inherit" size={18} /> : null}
                {params.InputProps.endAdornment}
              </>
            ),
          }}
        />
      )}
    />
  );
};

export default CountryAutocomplete;
