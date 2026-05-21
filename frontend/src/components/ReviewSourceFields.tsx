import { useEffect, useState } from "react";
import { Stack } from "@mui/material";

import { api, type ApiLocationOption } from "../lib/api";
import LocationAutocomplete from "./LocationAutocomplete";

type ReviewSourceValue = {
  district_id?: number | null;
  constituency_id?: number | null;
  subcounty_id?: number | null;
  parish_id?: number | null;
};

type ReviewSourceFieldsProps = {
  value: ReviewSourceValue;
  onChange: (nextValue: ReviewSourceValue) => void;
  disabled?: boolean;
};

const ReviewSourceFields = ({ value, onChange, disabled = false }: ReviewSourceFieldsProps) => {
  const [districts, setDistricts] = useState<ApiLocationOption[]>([]);
  const [constituencies, setConstituencies] = useState<ApiLocationOption[]>([]);
  const [subcounties, setSubcounties] = useState<ApiLocationOption[]>([]);
  const [parishes, setParishes] = useState<ApiLocationOption[]>([]);

  useEffect(() => {
    const loadDistricts = async () => {
      const response = await api.get<ApiLocationOption[]>("/districts");
      setDistricts(response.data);
    };

    void loadDistricts();
  }, []);

  useEffect(() => {
    if (!value.district_id) {
      setConstituencies([]);
      return;
    }

    const loadConstituencies = async () => {
      const response = await api.get<ApiLocationOption[]>("/constituencies", {
        params: {
          district_id: value.district_id,
        },
      });
      setConstituencies(response.data);
    };

    void loadConstituencies();
  }, [value.district_id]);

  useEffect(() => {
    if (!value.constituency_id) {
      setSubcounties([]);
      return;
    }

    const loadSubcounties = async () => {
      const response = await api.get<ApiLocationOption[]>("/subcounties", {
        params: {
          constituency_id: value.constituency_id,
        },
      });
      setSubcounties(response.data);
    };

    void loadSubcounties();
  }, [value.constituency_id]);

  useEffect(() => {
    if (!value.subcounty_id) {
      setParishes([]);
      return;
    }

    const loadParishes = async () => {
      const response = await api.get<ApiLocationOption[]>("/parishes", {
        params: {
          subcounty_id: value.subcounty_id,
        },
      });
      setParishes(response.data);
    };

    void loadParishes();
  }, [value.subcounty_id]);

  return (
    <>
      <Stack direction={{ xs: "column", sm: "row" }} spacing={2}>
        <LocationAutocomplete
          label="District"
          options={districts}
          valueId={value.district_id}
          onChange={(district_id) =>
            onChange({
              district_id,
              constituency_id: null,
              subcounty_id: null,
              parish_id: null,
            })
          }
          disabled={disabled}
          textFieldProps={{ fullWidth: true }}
        />
        <LocationAutocomplete
          label="Constituency"
          options={constituencies}
          valueId={value.constituency_id}
          onChange={(constituency_id) =>
            onChange({
              ...value,
              constituency_id,
              subcounty_id: null,
              parish_id: null,
            })
          }
          disabled={disabled || !value.district_id}
          textFieldProps={{ fullWidth: true }}
        />
      </Stack>
      <Stack direction={{ xs: "column", sm: "row" }} spacing={2}>
        <LocationAutocomplete
          label="Subcounty / Division"
          options={subcounties}
          valueId={value.subcounty_id}
          onChange={(subcounty_id) =>
            onChange({
              ...value,
              subcounty_id,
              parish_id: null,
            })
          }
          disabled={disabled || !value.constituency_id}
          textFieldProps={{ fullWidth: true }}
        />
        <LocationAutocomplete
          label="Parish"
          options={parishes}
          valueId={value.parish_id}
          onChange={(parish_id) =>
            onChange({
              ...value,
              parish_id,
            })
          }
          disabled={disabled || !value.subcounty_id}
          textFieldProps={{ fullWidth: true }}
        />
      </Stack>
    </>
  );
};

export default ReviewSourceFields;
