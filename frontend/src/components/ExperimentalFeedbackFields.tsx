import {
  Autocomplete,
  Box,
  MenuItem,
  Stack,
  TextField,
  Typography,
} from "@mui/material";

export type ExperimentalFeedbackFormDraft = {
  respondentRole: string;
  region: string;
  district: string;
  constituency: string;
  gender: string;
  ageGroup: string;
  channel: string;
  policyArea: string;
  sentiment: string;
};

export const INITIAL_EXPERIMENTAL_FEEDBACK_DRAFT: ExperimentalFeedbackFormDraft = {
  respondentRole: "",
  region: "",
  district: "",
  constituency: "",
  gender: "",
  ageGroup: "",
  channel: "Web portal",
  policyArea: "",
  sentiment: "",
};

const POLICY_AREAS = [
  "Healthcare",
  "Education",
  "Roads and Transport",
  "Water and Sanitation",
  "Corruption and Accountability",
  "Agriculture",
  "Electricity and Energy",
  "Security",
  "Youth Employment",
  "Taxation and Cost of Living",
  "Land",
  "Environment",
  "Digital Services",
];

type ExperimentalFeedbackFieldsProps = {
  value: ExperimentalFeedbackFormDraft;
  onChange: (value: ExperimentalFeedbackFormDraft) => void;
};

const sectionSx = {
  border: 1,
  borderColor: "divider",
  borderRadius: 2,
  p: 1.5,
};

const sectionTitleSx = {
  fontWeight: 800,
  mb: 1.25,
};

const profileGridSx = {
  display: "grid",
  gridTemplateColumns: { xs: "1fr", sm: "repeat(2, minmax(0, 1fr))", md: "repeat(3, minmax(0, 1fr))" },
  gap: 1.25,
};

const policySentimentGridSx = {
  display: "grid",
  gridTemplateColumns: { xs: "1fr", md: "minmax(0, 2fr) minmax(220px, 1fr)" },
  gap: 1.25,
};

const ExperimentalFeedbackFields = ({
  value,
  onChange,
}: ExperimentalFeedbackFieldsProps) => {
  const updateField = (field: keyof ExperimentalFeedbackFormDraft, nextValue: string) => {
    onChange({
      ...value,
      [field]: nextValue,
    });
  };

  return (
    // EXPERIMENTAL_FEEDBACK_MODAL_FIELDS_START: Remove this component usage to revert to the original feedback form.
    <Stack spacing={1.5}>
      <Box sx={sectionSx}>
        <Typography variant="subtitle2" sx={sectionTitleSx}>
          Section A: Respondent Profile
        </Typography>
        <Box sx={profileGridSx}>
          <TextField
            select
            label="Role"
            value={value.respondentRole}
            onChange={(event) => updateField("respondentRole", event.target.value)}
            size="small"
            fullWidth
          >
            <MenuItem value="Citizen">Citizen</MenuItem>
            <MenuItem value="Member of Parliament">Member of Parliament</MenuItem>
          </TextField>
          <TextField
            label="Channel used to submit feedback"
            value={value.channel}
            onChange={(event) => updateField("channel", event.target.value)}
            size="small"
            helperText="Mobile app planned for the next phase."
            fullWidth
          />
          <TextField
            label="Region"
            value={value.region}
            onChange={(event) => updateField("region", event.target.value)}
            size="small"
            fullWidth
          />
          <TextField
            label="District"
            value={value.district}
            onChange={(event) => updateField("district", event.target.value)}
            size="small"
            fullWidth
          />
          <TextField
            label="Constituency"
            value={value.constituency}
            onChange={(event) => updateField("constituency", event.target.value)}
            size="small"
            fullWidth
          />
          <TextField
            select
            label="Gender"
            value={value.gender}
            onChange={(event) => updateField("gender", event.target.value)}
            size="small"
            fullWidth
          >
            <MenuItem value="Male">Male</MenuItem>
            <MenuItem value="Female">Female</MenuItem>
          </TextField>
          <TextField
            select
            label="Age group"
            value={value.ageGroup}
            onChange={(event) => updateField("ageGroup", event.target.value)}
            size="small"
            fullWidth
          >
            <MenuItem value="18-24">18-24</MenuItem>
            <MenuItem value="25-34">25-34</MenuItem>
            <MenuItem value="35-44">35-44</MenuItem>
            <MenuItem value="45-54">45-54</MenuItem>
            <MenuItem value="55+">55+</MenuItem>
          </TextField>
        </Box>
      </Box>

      <Box sx={policySentimentGridSx}>
        <Box sx={sectionSx}>
          <Typography variant="subtitle2" sx={sectionTitleSx}>
            Section C: Policy Area
          </Typography>
          <Autocomplete
            options={POLICY_AREAS}
            value={value.policyArea || null}
            onChange={(_, nextValue) => updateField("policyArea", nextValue || "")}
            renderInput={(params) => (
              <TextField
                {...params}
                label="Which area does your feedback mainly relate to?"
                size="small"
                fullWidth
              />
            )}
          />
        </Box>

        <Box sx={sectionSx}>
          <Typography variant="subtitle2" sx={sectionTitleSx}>
            Section D: Overall Sentiment
          </Typography>
          <TextField
            select
            label="Overall view on this issue"
            value={value.sentiment}
            onChange={(event) => updateField("sentiment", event.target.value)}
            size="small"
            fullWidth
          >
            <MenuItem value="Positive">Positive</MenuItem>
            <MenuItem value="Neutral">Neutral</MenuItem>
            <MenuItem value="Negative">Negative</MenuItem>
          </TextField>
        </Box>
      </Box>
    </Stack>
    // EXPERIMENTAL_FEEDBACK_MODAL_FIELDS_END
  );
};

export default ExperimentalFeedbackFields;
