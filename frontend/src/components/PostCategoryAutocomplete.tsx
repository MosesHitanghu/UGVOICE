import { useEffect, useMemo, useState } from "react";
import {
  Autocomplete,
  Button,
  CircularProgress,
  InputAdornment,
  TextField,
  type TextFieldProps,
} from "@mui/material";

import { api } from "../lib/api";
import { getStoredUser } from "../lib/session";
import { POST_CATEGORIES } from "../lib/postCategories";

type CategoryRecord = {
  id: number;
  name: string;
};

type PostCategoryAutocompleteProps = {
  value: string;
  onChange: (value: string) => void;
  label?: string;
  size?: TextFieldProps["size"];
};

const normalizeCategory = (value: string) => value.trim().toLowerCase();

const PostCategoryAutocomplete = ({
  value,
  onChange,
  label = "Post category",
  size,
}: PostCategoryAutocompleteProps) => {
  const currentUser = getStoredUser();
  const [categories, setCategories] = useState<string[]>(POST_CATEGORIES);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    const loadCategories = async () => {
      setLoading(true);
      try {
        const response = await api.get<CategoryRecord[]>("/post-categories");
        const loadedCategories = response.data.map((category) => category.name);
        setCategories(loadedCategories.length ? loadedCategories : POST_CATEGORIES);
      } catch {
        setCategories(POST_CATEGORIES);
      } finally {
        setLoading(false);
      }
    };

    void loadCategories();
  }, []);

  const sortedCategories = useMemo(
    () =>
      [...categories].sort((left, right) =>
        left.localeCompare(right, undefined, { sensitivity: "base" }),
      ),
    [categories],
  );

  const trimmedValue = value.trim();
  const categoryExists = sortedCategories.some(
    (category) => normalizeCategory(category) === normalizeCategory(trimmedValue),
  );
  const canAddCategory = Boolean(trimmedValue && !categoryExists && currentUser?.id);

  const addCategory = async () => {
    if (!canAddCategory || !currentUser?.id) {
      return;
    }

    setSaving(true);
    try {
      const response = await api.post<CategoryRecord>(
        "/post-categories",
        { name: trimmedValue },
        {
          params: {
            actor_user_id: currentUser.id,
          },
        },
      );
      const nextName = response.data.name || trimmedValue;
      setCategories((current) => {
        if (current.some((category) => normalizeCategory(category) === normalizeCategory(nextName))) {
          return current;
        }
        return [...current, nextName];
      });
      onChange(nextName);
    } finally {
      setSaving(false);
    }
  };

  return (
    <Autocomplete
      freeSolo
      options={sortedCategories}
      loading={loading}
      value={value || null}
      inputValue={value}
      onChange={(_, nextValue) => onChange(nextValue || "")}
      onInputChange={(_, nextValue) => onChange(nextValue)}
      renderInput={(params) => (
        <TextField
          {...params}
          label={label}
          size={size}
          fullWidth
          InputProps={{
            ...params.InputProps,
            endAdornment: (
              <>
                {canAddCategory ? (
                  <InputAdornment position="end">
                    <Button
                      size="small"
                      onClick={addCategory}
                      disabled={saving}
                      sx={{ whiteSpace: "nowrap" }}
                    >
                      {saving ? <CircularProgress size={16} /> : "Add category"}
                    </Button>
                  </InputAdornment>
                ) : null}
                {params.InputProps.endAdornment}
              </>
            ),
          }}
        />
      )}
    />
  );
};

export default PostCategoryAutocomplete;
