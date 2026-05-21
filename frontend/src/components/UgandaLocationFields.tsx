import { useEffect, useState } from "react";
import { Stack } from "@mui/material";

import { api, type ApiLocationOption } from "../lib/api";
import LocationAutocomplete from "./LocationAutocomplete";

type UgandaLocationValue = {
  district_id?: number | null;
  constituency_id?: number | null;
  subcounty_id?: number | null;
  parish_id?: number | null;
};

type UgandaLocationFieldsProps = {
  value: UgandaLocationValue;
  onChange: (nextValue: UgandaLocationValue) => void;
  includeSubcounty?: boolean;
  includeParish?: boolean;
  size?: "small" | "medium";
};

const UgandaLocationFields = ({
  value,
  onChange,
  includeSubcounty = true,
  includeParish = true,
  size = "medium",
}: UgandaLocationFieldsProps) => {
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
    const districtId = value.district_id;
    if (!districtId) {
      setConstituencies([]);
      return;
    }

    const loadConstituencies = async () => {
      const response = await api.get<ApiLocationOption[]>("/constituencies", {
        params: { district_id: districtId },
      });
      setConstituencies(response.data);
    };

    void loadConstituencies();
  }, [value.district_id]);

  useEffect(() => {
    const constituencyId = value.constituency_id;
    if (!constituencyId) {
      setSubcounties([]);
      return;
    }

    const loadSubcounties = async () => {
      const response = await api.get<ApiLocationOption[]>("/subcounties", {
        params: { constituency_id: constituencyId },
      });
      setSubcounties(response.data);
    };

    void loadSubcounties();
  }, [value.constituency_id]);

  useEffect(() => {
    const subcountyId = value.subcounty_id;
    if (!subcountyId) {
      setParishes([]);
      return;
    }

    const loadParishes = async () => {
      const response = await api.get<ApiLocationOption[]>("/parishes", {
        params: { subcounty_id: subcountyId },
      });
      setParishes(response.data);
    };

    void loadParishes();
  }, [value.subcounty_id]);

  const handleDistrictChange = (districtId: number | null) => {
    onChange({
      district_id: districtId,
      constituency_id: null,
      subcounty_id: null,
      parish_id: null,
    });
  };

  const handleConstituencyChange = (constituencyId: number | null) => {
    onChange({
      ...value,
      constituency_id: constituencyId,
      subcounty_id: null,
      parish_id: null,
    });
  };

  const handleSubcountyChange = (subcountyId: number | null) => {
    onChange({
      ...value,
      subcounty_id: subcountyId,
      parish_id: null,
    });
  };

  const handleParishChange = (parishId: number | null) => {
    onChange({
      ...value,
      parish_id: parishId,
    });
  };

  return (
    <>
      <Stack direction={{ xs: "column", md: "row" }} spacing={2}>
        <LocationAutocomplete
          label="District"
          options={districts}
          valueId={value.district_id}
          onChange={handleDistrictChange}
          textFieldProps={{ size, fullWidth: true }}
        />
        <LocationAutocomplete
          label="Constituency"
          options={constituencies}
          valueId={value.constituency_id}
          onChange={handleConstituencyChange}
          disabled={!value.district_id}
          textFieldProps={{ size, fullWidth: true }}
        />
      </Stack>

      {includeSubcounty ? (
        <Stack direction={{ xs: "column", md: "row" }} spacing={2}>
          <LocationAutocomplete
            label="Subcounty"
            options={subcounties}
            valueId={value.subcounty_id}
            onChange={handleSubcountyChange}
            disabled={!value.constituency_id}
            textFieldProps={{ size, fullWidth: true }}
          />
          {includeParish ? (
            <LocationAutocomplete
              label="Parish"
              options={parishes}
              valueId={value.parish_id}
              onChange={handleParishChange}
              disabled={!value.subcounty_id}
              textFieldProps={{ size, fullWidth: true }}
            />
          ) : null}
        </Stack>
      ) : null}
    </>
  );
};

export default UgandaLocationFields;
