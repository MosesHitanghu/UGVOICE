export type CountryPhoneMeta = {
  iso2: string;
  dialCode: string;
};

const COUNTRY_PHONE_ENTRIES: Array<[string, CountryPhoneMeta]> = [
  ["uganda", { iso2: "UG", dialCode: "+256" }],
  ["kenya", { iso2: "KE", dialCode: "+254" }],
  ["tanzania", { iso2: "TZ", dialCode: "+255" }],
  ["rwanda", { iso2: "RW", dialCode: "+250" }],
  ["burundi", { iso2: "BI", dialCode: "+257" }],
  ["south sudan", { iso2: "SS", dialCode: "+211" }],
  ["sudan", { iso2: "SD", dialCode: "+249" }],
  ["ethiopia", { iso2: "ET", dialCode: "+251" }],
  ["eritrea", { iso2: "ER", dialCode: "+291" }],
  ["djibouti", { iso2: "DJ", dialCode: "+253" }],
  ["somalia", { iso2: "SO", dialCode: "+252" }],
  ["democratic republic of the congo", { iso2: "CD", dialCode: "+243" }],
  ["congo (kinshasa)", { iso2: "CD", dialCode: "+243" }],
  ["congo, the democratic republic of the", { iso2: "CD", dialCode: "+243" }],
  ["congo", { iso2: "CG", dialCode: "+242" }],
  ["congo (brazzaville)", { iso2: "CG", dialCode: "+242" }],
  ["central african republic", { iso2: "CF", dialCode: "+236" }],
  ["cameroon", { iso2: "CM", dialCode: "+237" }],
  ["gabon", { iso2: "GA", dialCode: "+241" }],
  ["equatorial guinea", { iso2: "GQ", dialCode: "+240" }],
  ["chad", { iso2: "TD", dialCode: "+235" }],
  ["nigeria", { iso2: "NG", dialCode: "+234" }],
  ["ghana", { iso2: "GH", dialCode: "+233" }],
  ["sierra leone", { iso2: "SL", dialCode: "+232" }],
  ["liberia", { iso2: "LR", dialCode: "+231" }],
  ["gambia", { iso2: "GM", dialCode: "+220" }],
  ["senegal", { iso2: "SN", dialCode: "+221" }],
  ["guinea", { iso2: "GN", dialCode: "+224" }],
  ["guinea-bissau", { iso2: "GW", dialCode: "+245" }],
  ["cape verde", { iso2: "CV", dialCode: "+238" }],
  ["cabo verde", { iso2: "CV", dialCode: "+238" }],
  ["mali", { iso2: "ML", dialCode: "+223" }],
  ["burkina faso", { iso2: "BF", dialCode: "+226" }],
  ["niger", { iso2: "NE", dialCode: "+227" }],
  ["benin", { iso2: "BJ", dialCode: "+229" }],
  ["togo", { iso2: "TG", dialCode: "+228" }],
  ["cote d'ivoire", { iso2: "CI", dialCode: "+225" }],
  ["côte d'ivoire", { iso2: "CI", dialCode: "+225" }],
  ["ivory coast", { iso2: "CI", dialCode: "+225" }],
  ["mauritania", { iso2: "MR", dialCode: "+222" }],
  ["western sahara", { iso2: "EH", dialCode: "+212" }],
  ["morocco", { iso2: "MA", dialCode: "+212" }],
  ["algeria", { iso2: "DZ", dialCode: "+213" }],
  ["tunisia", { iso2: "TN", dialCode: "+216" }],
  ["libya", { iso2: "LY", dialCode: "+218" }],
  ["egypt", { iso2: "EG", dialCode: "+20" }],
  ["south africa", { iso2: "ZA", dialCode: "+27" }],
  ["namibia", { iso2: "NA", dialCode: "+264" }],
  ["botswana", { iso2: "BW", dialCode: "+267" }],
  ["zimbabwe", { iso2: "ZW", dialCode: "+263" }],
  ["zambia", { iso2: "ZM", dialCode: "+260" }],
  ["malawi", { iso2: "MW", dialCode: "+265" }],
  ["mozambique", { iso2: "MZ", dialCode: "+258" }],
  ["angola", { iso2: "AO", dialCode: "+244" }],
  ["lesotho", { iso2: "LS", dialCode: "+266" }],
  ["eswatini", { iso2: "SZ", dialCode: "+268" }],
  ["swaziland", { iso2: "SZ", dialCode: "+268" }],
  ["madagascar", { iso2: "MG", dialCode: "+261" }],
  ["mauritius", { iso2: "MU", dialCode: "+230" }],
  ["seychelles", { iso2: "SC", dialCode: "+248" }],
  ["comoros", { iso2: "KM", dialCode: "+269" }],
  ["sao tome and principe", { iso2: "ST", dialCode: "+239" }],
  ["sao tomé and principe", { iso2: "ST", dialCode: "+239" }],
  ["united states", { iso2: "US", dialCode: "+1" }],
  ["united states of america", { iso2: "US", dialCode: "+1" }],
  ["canada", { iso2: "CA", dialCode: "+1" }],
  ["mexico", { iso2: "MX", dialCode: "+52" }],
  ["jamaica", { iso2: "JM", dialCode: "+1" }],
  ["united kingdom", { iso2: "GB", dialCode: "+44" }],
  ["britain (uk)", { iso2: "GB", dialCode: "+44" }],
  ["ireland", { iso2: "IE", dialCode: "+353" }],
  ["france", { iso2: "FR", dialCode: "+33" }],
  ["germany", { iso2: "DE", dialCode: "+49" }],
  ["italy", { iso2: "IT", dialCode: "+39" }],
  ["spain", { iso2: "ES", dialCode: "+34" }],
  ["portugal", { iso2: "PT", dialCode: "+351" }],
  ["netherlands", { iso2: "NL", dialCode: "+31" }],
  ["belgium", { iso2: "BE", dialCode: "+32" }],
  ["switzerland", { iso2: "CH", dialCode: "+41" }],
  ["austria", { iso2: "AT", dialCode: "+43" }],
  ["sweden", { iso2: "SE", dialCode: "+46" }],
  ["norway", { iso2: "NO", dialCode: "+47" }],
  ["denmark", { iso2: "DK", dialCode: "+45" }],
  ["finland", { iso2: "FI", dialCode: "+358" }],
  ["poland", { iso2: "PL", dialCode: "+48" }],
  ["czech republic", { iso2: "CZ", dialCode: "+420" }],
  ["czechia", { iso2: "CZ", dialCode: "+420" }],
  ["hungary", { iso2: "HU", dialCode: "+36" }],
  ["romania", { iso2: "RO", dialCode: "+40" }],
  ["bulgaria", { iso2: "BG", dialCode: "+359" }],
  ["greece", { iso2: "GR", dialCode: "+30" }],
  ["ukraine", { iso2: "UA", dialCode: "+380" }],
  ["russia", { iso2: "RU", dialCode: "+7" }],
  ["turkey", { iso2: "TR", dialCode: "+90" }],
  ["israel", { iso2: "IL", dialCode: "+972" }],
  ["palestine", { iso2: "PS", dialCode: "+970" }],
  ["saudi arabia", { iso2: "SA", dialCode: "+966" }],
  ["united arab emirates", { iso2: "AE", dialCode: "+971" }],
  ["qatar", { iso2: "QA", dialCode: "+974" }],
  ["kuwait", { iso2: "KW", dialCode: "+965" }],
  ["oman", { iso2: "OM", dialCode: "+968" }],
  ["bahrain", { iso2: "BH", dialCode: "+973" }],
  ["yemen", { iso2: "YE", dialCode: "+967" }],
  ["jordan", { iso2: "JO", dialCode: "+962" }],
  ["lebanon", { iso2: "LB", dialCode: "+961" }],
  ["iran", { iso2: "IR", dialCode: "+98" }],
  ["iraq", { iso2: "IQ", dialCode: "+964" }],
  ["india", { iso2: "IN", dialCode: "+91" }],
  ["pakistan", { iso2: "PK", dialCode: "+92" }],
  ["bangladesh", { iso2: "BD", dialCode: "+880" }],
  ["sri lanka", { iso2: "LK", dialCode: "+94" }],
  ["nepal", { iso2: "NP", dialCode: "+977" }],
  ["afghanistan", { iso2: "AF", dialCode: "+93" }],
  ["china", { iso2: "CN", dialCode: "+86" }],
  ["japan", { iso2: "JP", dialCode: "+81" }],
  ["south korea", { iso2: "KR", dialCode: "+82" }],
  ["north korea", { iso2: "KP", dialCode: "+850" }],
  ["taiwan", { iso2: "TW", dialCode: "+886" }],
  ["hong kong", { iso2: "HK", dialCode: "+852" }],
  ["macao", { iso2: "MO", dialCode: "+853" }],
  ["macau", { iso2: "MO", dialCode: "+853" }],
  ["singapore", { iso2: "SG", dialCode: "+65" }],
  ["malaysia", { iso2: "MY", dialCode: "+60" }],
  ["indonesia", { iso2: "ID", dialCode: "+62" }],
  ["philippines", { iso2: "PH", dialCode: "+63" }],
  ["thailand", { iso2: "TH", dialCode: "+66" }],
  ["vietnam", { iso2: "VN", dialCode: "+84" }],
  ["cambodia", { iso2: "KH", dialCode: "+855" }],
  ["laos", { iso2: "LA", dialCode: "+856" }],
  ["myanmar (burma)", { iso2: "MM", dialCode: "+95" }],
  ["myanmar", { iso2: "MM", dialCode: "+95" }],
  ["australia", { iso2: "AU", dialCode: "+61" }],
  ["new zealand", { iso2: "NZ", dialCode: "+64" }],
  ["fiji", { iso2: "FJ", dialCode: "+679" }],
  ["papua new guinea", { iso2: "PG", dialCode: "+675" }],
  ["brazil", { iso2: "BR", dialCode: "+55" }],
  ["argentina", { iso2: "AR", dialCode: "+54" }],
  ["chile", { iso2: "CL", dialCode: "+56" }],
  ["colombia", { iso2: "CO", dialCode: "+57" }],
  ["peru", { iso2: "PE", dialCode: "+51" }],
  ["ecuador", { iso2: "EC", dialCode: "+593" }],
  ["venezuela", { iso2: "VE", dialCode: "+58" }],
  ["bolivia", { iso2: "BO", dialCode: "+591" }],
  ["paraguay", { iso2: "PY", dialCode: "+595" }],
  ["uruguay", { iso2: "UY", dialCode: "+598" }],
  ["guyana", { iso2: "GY", dialCode: "+592" }],
  ["suriname", { iso2: "SR", dialCode: "+597" }],
  ["trinidad and tobago", { iso2: "TT", dialCode: "+1" }],
];

const normalizeCountryName = (countryName: string) =>
  countryName.trim().toLowerCase().replace(/\s+/g, " ");

const getFlagEmoji = (iso2: string) =>
  iso2
    .toUpperCase()
    .split("")
    .map((char) => String.fromCodePoint(127397 + char.charCodeAt(0)))
    .join("");

const metadataMap = new Map(COUNTRY_PHONE_ENTRIES);

export const getCountryPhoneMeta = (countryName?: string | null) => {
  if (!countryName?.trim()) {
    return null;
  }

  const meta = metadataMap.get(normalizeCountryName(countryName));
  if (!meta) {
    return null;
  }

  return {
    ...meta,
    flag: getFlagEmoji(meta.iso2),
  };
};

export const getPhoneInputValue = (
  storedValue: string | null | undefined,
  countryName?: string | null,
) => {
  const meta = getCountryPhoneMeta(countryName);
  const rawValue = storedValue?.trim() ?? "";

  if (!rawValue || !meta) {
    return rawValue.replace(/\D/g, "");
  }

  if (rawValue.startsWith(meta.dialCode)) {
    return rawValue.slice(meta.dialCode.length).replace(/\D/g, "");
  }

  return rawValue.replace(/\D/g, "");
};

export const buildPhoneNumber = (
  localValue: string,
  countryName?: string | null,
) => {
  const digitsOnly = localValue.replace(/\D/g, "");
  if (!digitsOnly) {
    return "";
  }

  const meta = getCountryPhoneMeta(countryName);
  if (!meta) {
    return digitsOnly;
  }

  return `${meta.dialCode}${digitsOnly}`;
};

export const rebasePhoneNumberToCountry = (
  storedValue: string | null | undefined,
  previousCountry?: string | null,
  nextCountry?: string | null,
) => buildPhoneNumber(getPhoneInputValue(storedValue, previousCountry), nextCountry);
