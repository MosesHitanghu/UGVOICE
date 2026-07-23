import axios from "axios";

export const API_BASE_URL =
  (
    import.meta.env.VITE_API_BASE_URL ||
    (import.meta.env.PROD
      ? "https://ugvoicebackend.vercel.app"
      : "http://127.0.0.1:9000")
  ).replace(/\/$/, "");

export const api = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    "Content-Type": "application/json",
  },
});

export const resolveApiAssetUrl = (assetPath?: string | null) => {
  if (!assetPath) {
    return null;
  }

  if (
    assetPath.startsWith("http://") ||
    assetPath.startsWith("https://") ||
    assetPath.startsWith("data:") ||
    assetPath.startsWith("blob:")
  ) {
    return assetPath;
  }

  if (assetPath.startsWith("/uploads/")) {
    return `${API_BASE_URL}${assetPath}`;
  }

  return assetPath;
};

export type ApiUser = {
  id: number;
  parent_user_id?: number | null;
  username: string;
  email: string;
  fname?: string | null;
  lname?: string | null;
  role?: string | null;
  mobile_number?: string | null;
  verification_status?: string | null;
  status?: string | null;
  visibility?: string | null;
  gender?: string | null;
  dob?: string | null;
  district_id?: number | null;
  constituency_id?: number | null;
  subcounty_id?: number | null;
  parish_id?: number | null;
  type?: string | null;
  number_of_employees?: number | null;
  company_name?: string | null;
  company_country?: string | null;
  company_city?: string | null;
  type_of_business?: string | null;
  profile_picture?: string | null;
  description?: string | null;
  theme_colors?: string | null;
};

export type ApiCountry = {
  id: number;
  name: string;
};

export type ApiLocationOption = {
  id: number;
  name: string;
};
