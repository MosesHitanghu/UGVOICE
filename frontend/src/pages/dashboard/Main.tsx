import { useEffect, useMemo, useState } from "react";
import {
  Alert,
  Badge,
  Box,
  Button,
  Chip,
  CircularProgress,
  Divider,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  FormControlLabel,
  Grid,
  IconButton,
  InputAdornment,
  LinearProgress,
  Menu,
  MenuItem,
  Paper,
  Radio,
  RadioGroup,
  Skeleton,
  Stack,
  Tab,
  Tabs,
  TextField,
  Tooltip,
  Typography,
  useMediaQuery,
} from "@mui/material";
import { alpha, styled, useTheme } from "@mui/material/styles";
import { BarChart } from "@mui/x-charts/BarChart";
import { PieChart } from "@mui/x-charts/PieChart";
import { useNavigate } from "react-router-dom";
import {
  ColumnsPanelTrigger,
  DataGrid,
  ExportCsv,
  ExportPrint,
  FilterPanelTrigger,
  QuickFilter,
  QuickFilterClear,
  QuickFilterControl,
  QuickFilterTrigger,
  Toolbar,
  ToolbarButton,
  type GridColDef,
  type GridRenderCellParams,
  type GridToolbarProps,
} from "@mui/x-data-grid";
import AutoGraphRoundedIcon from "@mui/icons-material/AutoGraphRounded";
import FeedbackRoundedIcon from "@mui/icons-material/FeedbackRounded";
import FileDownloadIcon from "@mui/icons-material/FileDownload";
import FilterListIcon from "@mui/icons-material/FilterList";
import ForumRoundedIcon from "@mui/icons-material/ForumRounded";
import Groups2RoundedIcon from "@mui/icons-material/Groups2Rounded";
import InsightsRoundedIcon from "@mui/icons-material/InsightsRounded";
import MoreHorizRoundedIcon from "@mui/icons-material/MoreHorizRounded";
import PersonSearchRoundedIcon from "@mui/icons-material/PersonSearchRounded";
import RateReviewRoundedIcon from "@mui/icons-material/RateReviewRounded";
import RemoveRedEyeRoundedIcon from "@mui/icons-material/RemoveRedEyeRounded";
import ReportProblemRoundedIcon from "@mui/icons-material/ReportProblemRounded";
import RefreshRoundedIcon from "@mui/icons-material/RefreshRounded";
import SearchIcon from "@mui/icons-material/Search";
import ThumbUpAltRoundedIcon from "@mui/icons-material/ThumbUpAltRounded";
import ViewColumnIcon from "@mui/icons-material/ViewColumn";

import PostThumbnail from "../../components/PostThumbnail";
import UserAvatar from "../../components/UserAvatar";
import { api } from "../../lib/api";
import { getStoredUser } from "../../lib/session";

type ChartDatum = { label: string; value: number };
type Profile = {
  id: number;
  username: string;
  fname?: string | null;
  lname?: string | null;
  company_name?: string | null;
  visibility?: string | null;
  profile_picture?: string | null;
  district_name?: string | null;
  constituency_name?: string | null;
};
type Person = {
  id: number;
  username: string;
  fname?: string | null;
  lname?: string | null;
  company_name?: string | null;
  profile_picture?: string | null;
};
type PostRow = {
  id: number;
  title?: string | null;
  content: string;
  visibility: string;
  thumbnail?: string | null;
  date_added?: string | null;
  time_added?: string | null;
  author: Person;
};
type PostAnalyticsRow = {
  post: PostRow & {
    review_count: number;
    reaction_summary: { total: number; counts: Record<string, number> };
    view_count?: number | null;
  };
  performance: {
    total_reviews: number;
    total_reactions: number;
    total_views: number;
    unique_reviewers: number;
    engagement_score: number;
  };
  charts: {
    sentiments: ChartDatum[];
    distributions: {
      gender: ChartDatum[];
      age_groups: ChartDatum[];
      subcounty: ChartDatum[];
      parishes: ChartDatum[];
    };
  };
};
type FeedbackRow = {
  id: number;
  title: string;
  description: string;
  category?: string | null;
  sentiment?: string | null;
  status?: string | null;
  date_added?: string | null;
  time_added?: string | null;
  author: Person;
  target?: Person | null;
};
type NationalReviewRow = {
  id: number;
  content: string;
  sentiment?: string | null;
  date_added?: string | null;
  time_added?: string | null;
  author?: Person | null;
  post?: {
    id: number;
    title?: string | null;
    content?: string | null;
    view_count?: number | null;
    author?: Person | null;
  } | null;
};
type IssueRow = {
  id: number | string;
  title?: string | null;
  summary?: string | null;
  description?: string | null;
  keywords?: string[] | null;
  feedback_count?: number | null;
  negative_percentage?: number | null;
  priority?: string | null;
  trend?: string | null;
  representative_feedback?: string | null;
  generated_at?: string | null;
  priority_level?: string | null;
  status?: string | null;
  date_added?: string | null;
  time_added?: string | null;
  topic_id?: number | null;
  model_version?: string | null;
  size?: number | null;
  sentiment?: string | null;
  region?: string | null;
  district?: string | null;
  constituency?: string | null;
  division?: string | null;
  parish?: string | null;
  country_id?: number | null;
  region_id?: number | null;
  district_id?: number | null;
  constituency_id?: number | null;
  subcounty_id?: number | null;
  parish_id?: number | null;
};
type Payload = {
  profile: Profile;
  reviews: {
    summary: {
      posts_authored: number;
      reviewed_posts: number;
      total_reviews: number;
      total_reactions: number;
      total_views: number;
      average_reviews_per_post: number;
    };
    selected_post_id?: number | null;
    posts: PostAnalyticsRow[];
  };
  feedbacks: {
    summary: {
      total_feedbacks: number;
      pending_feedbacks: number;
      analysed_feedbacks: number;
      open_emerging_issues: number;
      resolved_emerging_issues: number;
    };
    charts: {
      sentiments: ChartDatum[];
      status: ChartDatum[];
      issue_priority: ChartDatum[];
    };
    feedbacks: FeedbackRow[];
    emerging_issues: IssueRow[];
  };
};
type NationalPayload = {
  reviews: {
    summary: {
      total_reviews: number;
      total_posts_reviewed: number;
      unique_reviewers: number;
      total_reactions: number;
      total_views: number;
    };
    charts: {
      sentiments: ChartDatum[];
      gender: ChartDatum[];
      age_groups: ChartDatum[];
      regions: ChartDatum[];
      districts: ChartDatum[];
      constituencies: ChartDatum[];
      divisions: ChartDatum[];
      parishes: ChartDatum[];
    };
    reviews: NationalReviewRow[];
  };
  feedbacks: {
    summary: {
      total_feedbacks: number;
      pending_feedbacks: number;
      analysed_feedbacks: number;
      unique_authors: number;
      unique_targets: number;
    };
    charts: {
      sentiments: ChartDatum[];
      status: ChartDatum[];
      categories: ChartDatum[];
      age_groups: ChartDatum[];
      regions: ChartDatum[];
      districts: ChartDatum[];
      constituencies: ChartDatum[];
      divisions: ChartDatum[];
      parishes: ChartDatum[];
    };
    feedbacks: FeedbackRow[];
    emerging_issues: IssueRow[];
  };
};

type DistributionKey = "age_groups" | "gender" | "parishes" | "subcounty";
type DemographyKey = "regions" | "districts" | "constituencies" | "divisions" | "parishes";
type EmergingIssueSentimentFilter = "All" | "Positive" | "Negative";
type PriorityLevel = "High" | "Medium" | "Low";
type NormalizedIssue = {
  id: number | string;
  title: string;
  summary: string;
  keywords: string[];
  feedbackCount: number;
  negativePercentage?: number;
  priority: PriorityLevel;
  trend: string;
  representativeFeedback: string;
  generatedAt?: string | null;
  generatedAtLabel: string;
  sentiment: string;
  raw: IssueRow;
};

const nameOf = (person?: Profile | Person | null) =>
  person?.company_name || [person?.fname, person?.lname].filter(Boolean).join(" ") || person?.username || "Profile";

const when = (d?: string | null, t?: string | null) => {
  if (!d) return "N/A";
  const parsed = new Date(`${d}T${t || "00:00:00"}`);
  return Number.isNaN(parsed.getTime())
    ? d
    : parsed.toLocaleString(undefined, { dateStyle: "medium", timeStyle: t ? "short" : undefined });
};

const formatDate = (value?: string | null, fallbackDate?: string | null, fallbackTime?: string | null) => {
  const source = value || (fallbackDate ? `${fallbackDate}T${fallbackTime || "00:00:00"}` : "");
  if (!source) return "Date unavailable";
  const parsed = new Date(source);
  return Number.isNaN(parsed.getTime())
    ? source
    : parsed.toLocaleString(undefined, { month: "long", day: "numeric", year: "numeric", hour: "numeric", minute: "2-digit" });
};

const titleCase = (value: string) =>
  value
    .replace(/[_-]+/g, " ")
    .split(" ")
    .filter(Boolean)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
    .join(" ");

const normalizeAccessValue = (value?: string | null) => value?.trim().toLowerCase() || "";

const parseKeywords = (issue: IssueRow) => {
  if (Array.isArray(issue.keywords) && issue.keywords.length) {
    return issue.keywords.map((keyword) => keyword.trim().toLowerCase()).filter(Boolean);
  }

  const candidates = [issue.description, issue.title]
    .filter(Boolean)
    .flatMap((value) => String(value).split(/[\/,]/g))
    .map((keyword) => keyword.trim().toLowerCase())
    .filter((keyword) => keyword && !keyword.includes("feedback") && keyword !== "modelled");

  return Array.from(new Set(candidates)).slice(0, 8);
};

const publicServiceCategories: Array<{ terms: string[]; title: string; subject: string }> = [
  { terms: ["health", "centre", "clinic", "hospital", "medical"], title: "Access Challenges to Health Centres", subject: "health centre access and related services" },
  { terms: ["market", "vendor", "trade", "business"], title: "Market Conditions Affecting Residents", subject: "market conditions and daily livelihoods" },
  { terms: ["children", "school", "student", "education", "teacher"], title: "Children and School Access Concerns", subject: "children, schools, and learning conditions" },
  { terms: ["taxi", "transport", "road", "traffic", "bus", "movement"], title: "Transport and Mobility Service Concerns", subject: "transport access and daily movement" },
  { terms: ["water", "borehole", "sanitation", "toilet", "drainage"], title: "Water and Sanitation Service Gaps", subject: "water, sanitation, and drainage services" },
  { terms: ["security", "crime", "police", "unsafe", "safety"], title: "Community Safety and Security Concerns", subject: "safety and security in the community" },
  { terms: ["waste", "garbage", "rubbish", "cleaning"], title: "Waste Collection and Cleanliness Concerns", subject: "waste collection and public cleanliness" },
];

const issueCategoryForKeywords = (keywords: string[]) =>
  publicServiceCategories.find((category) => category.terms.some((term) => keywords.some((keyword) => keyword.includes(term))));

const generateReadableTitle = (keywords: string[], fallbackTitle?: string | null) => {
  const category = issueCategoryForKeywords(keywords);
  if (category) {
    if (category.title === "Market Conditions Affecting Residents" && keywords.some((keyword) => keyword.includes("children") || keyword.includes("school"))) {
      return "Market Conditions Affecting Residents and Children";
    }
    return category.title;
  }

  const cleanFallback = (fallbackTitle || "").trim();
  if (cleanFallback && !cleanFallback.includes("/") && !/^[\w\s-]+-\d{6,}/.test(cleanFallback)) {
    return cleanFallback;
  }

  const [first, second, third] = keywords.slice(0, 3).map(titleCase);
  if (first && second && third) return `Public Service Concerns Around ${first}, ${second}, and ${third}`;
  if (first && second) return `Public Service Concerns Around ${first} and ${second}`;
  if (first) return `${first} Service Concern`;
  return "Emerging Public Service Concern";
};

const parseFeedbackCount = (issue: IssueRow) => {
  if (typeof issue.feedback_count === "number") return issue.feedback_count;
  if (typeof issue.size === "number") return issue.size;
  const match = `${issue.priority_level || ""} ${issue.description || ""}`.match(/(\d+)\s*feedback/i);
  return match ? Number(match[1]) : 0;
};

const normalizeNegativePercentage = (value?: number | null) => {
  if (typeof value !== "number" || Number.isNaN(value)) return undefined;
  return Math.round(value <= 1 ? value * 100 : value);
};

const calculatePriority = (feedbackCount: number, negativePercentage = 0): PriorityLevel => {
  if (feedbackCount >= 10 && negativePercentage >= 65) return "High";
  if (feedbackCount >= 5) return "Medium";
  return "Low";
};

const generateIssueSummary = (issue: IssueRow, title: string, keywords: string[], feedbackCount: number) => {
  if (issue.summary) return issue.summary;
  if (issue.description && !issue.description.includes(",") && !issue.description.includes("/")) return issue.description;

  const category = issueCategoryForKeywords(keywords);
  const subject = category?.subject || keywords.slice(0, 3).map(titleCase).join(", ").toLowerCase() || title.toLowerCase();
  const countText = feedbackCount > 0 ? ` The pattern appears in ${feedbackCount} feedback${feedbackCount === 1 ? "" : "s"} and may need follow-up.` : "";
  return `Residents are raising concerns about ${subject}.${countText}`;
};

const normalizeIssue = (issue: IssueRow): NormalizedIssue => {
  const keywords = parseKeywords(issue);
  const feedbackCount = parseFeedbackCount(issue);
  const negativePercentage = normalizeNegativePercentage(issue.negative_percentage);
  const title = generateReadableTitle(keywords, issue.title);
  const prioritySource = issue.priority || issue.priority_level;
  const priority = (prioritySource ? titleCase(prioritySource).replace(" Priority", "") : calculatePriority(feedbackCount, negativePercentage)) as PriorityLevel;
  const generatedAt = issue.generated_at || (issue.date_added ? `${issue.date_added}T${issue.time_added || "00:00:00"}` : null);

  return {
    id: issue.id,
    title,
    summary: generateIssueSummary(issue, title, keywords, feedbackCount),
    keywords,
    feedbackCount,
    negativePercentage,
    priority: ["High", "Medium", "Low"].includes(priority) ? priority : calculatePriority(feedbackCount, negativePercentage),
    trend: issue.trend || "Stable",
    representativeFeedback: issue.representative_feedback || "No representative feedback is available for this issue yet.",
    generatedAt,
    generatedAtLabel: formatDate(generatedAt, issue.date_added, issue.time_added),
    sentiment: titleCase(issue.sentiment || "Unknown"),
    raw: issue,
  };
};

const card = (tone: string) => ({
  width: 48,
  height: 48,
  borderRadius: "16px",
  display: "grid",
  placeItems: "center",
  bgcolor: alpha(tone, 0.12),
  color: tone,
  flexShrink: 0,
});

const Metric = ({
  title,
  value,
  tone,
  icon,
  helper,
}: {
  title: string;
  value: string | number;
  tone: string;
  icon: React.ReactNode;
  helper?: string;
}) => (
  <Paper elevation={3} sx={{ p: 2.5 }}>
    <Stack direction="row" justifyContent="space-between" spacing={2}>
      <Box>
        <Typography color="text.secondary" variant="body2">{title}</Typography>
        <Typography variant="h4" sx={{ mt: 1, fontWeight: 700 }}>{value}</Typography>
        {helper ? <Typography color="text.secondary" variant="body2" sx={{ mt: 0.75 }}>{helper}</Typography> : null}
      </Box>
      <Box sx={card(tone)}>{icon}</Box>
    </Stack>
  </Paper>
);

const Panel = ({ title, subtitle, children }: { title: string; subtitle?: string; children: React.ReactNode }) => (
  <Paper elevation={3} sx={{ p: 3, height: "100%" }}>
    <Typography variant="h6" sx={{ fontWeight: 700 }}>{title}</Typography>
    {subtitle ? <Typography color="text.secondary" variant="body2" sx={{ mt: 0.75, mb: 2 }}>{subtitle}</Typography> : <Box sx={{ mb: 2 }} />}
    {children}
  </Paper>
);

const Empty = ({ message }: { message: string }) => (
  <Box sx={(theme) => ({ minHeight: 280, display: "grid", placeItems: "center", borderRadius: 3, bgcolor: alpha(theme.palette.primary.main, 0.05), textAlign: "center", px: 3 })}>
    <Typography color="text.secondary">{message}</Typography>
  </Box>
);

const PriorityBadge = ({ priority }: { priority: PriorityLevel }) => {
  const color = priority === "High" ? "error" : priority === "Medium" ? "warning" : "success";
  return <Chip label={`${priority} Priority`} color={color} size="small" sx={{ fontWeight: 700 }} />;
};

const EmergingIssueCard = ({
  issue,
  onViewFeedbacks,
}: {
  issue: NormalizedIssue;
  onViewFeedbacks: () => void;
}) => (
  <Paper
    component="article"
    tabIndex={0}
    variant="outlined"
    sx={(theme) => ({
      p: 2,
      borderRadius: 2,
      borderColor: alpha(theme.palette.text.primary, 0.12),
      transition: theme.transitions.create(["border-color", "box-shadow", "transform"]),
      "&:focus-visible": {
        outline: `3px solid ${alpha(theme.palette.primary.main, 0.28)}`,
        outlineOffset: 2,
      },
      "&:hover": {
        borderColor: alpha(theme.palette.primary.main, 0.45),
        boxShadow: `0 10px 24px ${alpha(theme.palette.common.black, 0.08)}`,
        transform: "translateY(-1px)",
      },
    })}
  >
    <Stack spacing={1.5}>
      <Stack direction={{ xs: "column", sm: "row" }} justifyContent="space-between" alignItems={{ xs: "flex-start", sm: "flex-start" }} spacing={1.5}>
        <Box sx={{ minWidth: 0 }}>
          <Typography component="h3" variant="subtitle1" sx={{ fontWeight: 800, lineHeight: 1.25 }}>
            {issue.title}
          </Typography>
          <Typography color="text.secondary" variant="body2" sx={{ mt: 0.75 }}>
            {issue.summary}
          </Typography>
        </Box>
        <Stack direction="row" spacing={1} useFlexGap flexWrap="wrap" sx={{ justifyContent: { xs: "flex-start", sm: "flex-end" } }}>
          <Chip label={issue.sentiment} size="small" color={issue.sentiment === "Positive" ? "success" : issue.sentiment === "Negative" ? "error" : "default"} variant="outlined" />
          <PriorityBadge priority={issue.priority} />
        </Stack>
      </Stack>

      <Stack direction="row" spacing={0.75} useFlexGap flexWrap="wrap" alignItems="center" aria-label="Issue metrics">
        <Typography variant="body2" sx={{ fontWeight: 700 }}>{issue.feedbackCount} feedbacks</Typography>
        <Typography color="text.secondary" variant="body2">{"\u00b7"}</Typography>
        <Typography color="text.secondary" variant="body2">{issue.generatedAtLabel}</Typography>
      </Stack>

      <Box>
        <Typography variant="caption" color="text.secondary" sx={{ display: "block", mb: 0.75, fontWeight: 700 }}>
          Key terms:
        </Typography>
        <Stack direction="row" spacing={0.75} useFlexGap flexWrap="wrap">
          {(issue.keywords.length ? issue.keywords : ["public service"]).slice(0, 6).map((keyword) => (
            <Chip key={keyword} label={titleCase(keyword)} size="small" variant="outlined" />
          ))}
        </Stack>
      </Box>

      <Box sx={(theme) => ({ borderLeft: `3px solid ${alpha(theme.palette.primary.main, 0.35)}`, pl: 1.5 })}>
        <Typography variant="caption" color="text.secondary" sx={{ display: "block", fontWeight: 700 }}>
          Example feedback:
        </Typography>
        <Typography variant="body2" sx={{ mt: 0.25 }}>
          {issue.representativeFeedback}
        </Typography>
      </Box>

      <Stack direction="row" justifyContent="flex-end">
        <Chip label={issue.raw.status || "Open"} size="small" variant="outlined" />
      </Stack>

      <Divider />

      <Stack direction="row" spacing={1} useFlexGap flexWrap="wrap">
        <Button size="small" variant="contained" onClick={onViewFeedbacks} aria-label={`View feedbacks for ${issue.title}`}>
          View feedbacks
        </Button>
      </Stack>
    </Stack>
  </Paper>
);

const EmergingIssuesPage = ({
  issues,
  subtitle,
  loading,
  error,
  onRefresh,
  onViewFeedbacks,
}: {
  issues: IssueRow[];
  subtitle: string;
  loading?: boolean;
  error?: string;
  onRefresh: () => void;
  onViewFeedbacks: (issue: NormalizedIssue) => void;
}) => {
  const [sentimentFilter, setSentimentFilter] = useState<EmergingIssueSentimentFilter>("All");
  const normalizedIssues = issues
    .map(normalizeIssue)
    .sort((left, right) => right.feedbackCount - left.feedbackCount || left.title.localeCompare(right.title));
  const filteredIssues = normalizedIssues.filter((issue) => (
    sentimentFilter === "All" || issue.sentiment === sentimentFilter || issue.sentiment === "Unknown"
  )).slice(0, 10);

  return (
    <Paper elevation={3} sx={{ p: 3, height: "100%" }}>
      <Stack direction={{ xs: "column", sm: "row" }} alignItems={{ xs: "stretch", sm: "flex-start" }} justifyContent="space-between" spacing={2} sx={{ mb: 2 }}>
        <Box>
          <Typography variant="h6" sx={{ fontWeight: 700 }}>Emerging Issues</Typography>
          <Typography color="text.secondary" variant="body2" sx={{ mt: 0.75 }}>{subtitle}</Typography>
        </Box>
        <Stack direction="row" spacing={1} alignItems="center" justifyContent={{ xs: "space-between", sm: "flex-end" }}>
          <RadioGroup
            row
            value={sentimentFilter}
            onChange={(event) => setSentimentFilter(event.target.value as EmergingIssueSentimentFilter)}
            aria-label="Filter emerging issues by sentiment"
            sx={{
              flexWrap: "nowrap",
              "& .MuiFormControlLabel-root": { mr: 1 },
              "& .MuiFormControlLabel-label": { fontSize: "0.875rem" },
            }}
          >
            <FormControlLabel value="All" control={<Radio size="small" />} label="All" />
            <FormControlLabel value="Positive" control={<Radio size="small" />} label="Positive" />
            <FormControlLabel value="Negative" control={<Radio size="small" />} label="Negative" />
          </RadioGroup>
          <Tooltip title="Refresh emerging issues">
            <IconButton onClick={onRefresh} size="small" color="primary" aria-label="Refresh emerging issues">
              <RefreshRoundedIcon />
            </IconButton>
          </Tooltip>
        </Stack>
      </Stack>

      {loading ? (
        <Stack spacing={1.5} aria-label="Loading emerging issues">
          <Typography color="text.secondary" variant="body2">Loading emerging issues...</Typography>
          {[0, 1].map((item) => (
            <Paper key={item} variant="outlined" sx={{ p: 2, borderRadius: 2 }}>
              <Skeleton width="62%" height={28} />
              <Skeleton width="92%" />
              <Skeleton width="70%" />
              <Stack direction="row" spacing={1} sx={{ mt: 1 }}>
                <Skeleton width={96} height={30} />
                <Skeleton width={110} height={30} />
              </Stack>
            </Paper>
          ))}
        </Stack>
      ) : error ? (
        <Alert severity="error">Unable to load emerging issues. Please try again.</Alert>
      ) : filteredIssues.length ? (
        <Stack spacing={1.5} sx={{ maxHeight: 520, overflowY: "auto", pr: 0.5 }}>
          {filteredIssues.map((issue) => (
            <EmergingIssueCard
              key={issue.id}
              issue={issue}
              onViewFeedbacks={() => onViewFeedbacks(issue)}
            />
          ))}
        </Stack>
      ) : (
        <Empty message={`No ${sentimentFilter.toLowerCase()} emerging issues detected yet. Run topic modelling to generate insights from citizen feedback.`} />
      )}
    </Paper>
  );
};

const IssueActionsMenu = ({
  issue,
  onViewDetails,
  onViewFeedbacks,
  onChangeStatus,
}: {
  issue: NormalizedIssue;
  onViewDetails: (issue: NormalizedIssue) => void;
  onViewFeedbacks: (issue: NormalizedIssue) => void;
  onChangeStatus: (issue: NormalizedIssue, status: string) => void;
}) => {
  const [anchorEl, setAnchorEl] = useState<null | HTMLElement>(null);
  const open = Boolean(anchorEl);

  return (
    <>
      <Tooltip title="Issue actions">
        <IconButton size="small" onClick={(event) => setAnchorEl(event.currentTarget)} aria-label={`Actions for ${issue.title}`}>
          <MoreHorizRoundedIcon fontSize="small" />
        </IconButton>
      </Tooltip>
      <Menu anchorEl={anchorEl} open={open} onClose={() => setAnchorEl(null)}>
        <MenuItem onClick={() => { setAnchorEl(null); onViewDetails(issue); }}>View Details</MenuItem>
        <MenuItem onClick={() => { setAnchorEl(null); onViewFeedbacks(issue); }}>View Feedback</MenuItem>
        <Divider />
        <MenuItem onClick={() => { setAnchorEl(null); onChangeStatus(issue, "Pending"); }}>Mark Pending</MenuItem>
        <MenuItem onClick={() => { setAnchorEl(null); onChangeStatus(issue, "In Progress"); }}>Mark In Progress</MenuItem>
        <MenuItem onClick={() => { setAnchorEl(null); onChangeStatus(issue, "Resolved"); }}>Mark Resolved</MenuItem>
      </Menu>
    </>
  );
};

const StyledQuickFilter = styled(QuickFilter)({ display: "grid", alignItems: "center" });
const StyledToolbarButton = styled(ToolbarButton)<{ ownerState: { expanded: boolean } }>(({ theme, ownerState }) => ({
  gridArea: "1 / 1",
  width: "min-content",
  height: "min-content",
  zIndex: 1,
  opacity: ownerState.expanded ? 0 : 1,
  pointerEvents: ownerState.expanded ? "none" : "auto",
  transition: theme.transitions.create(["opacity"]),
}));
const StyledTextField = styled(TextField)<{ ownerState: { expanded: boolean } }>(({ theme, ownerState }) => ({
  gridArea: "1 / 1",
  overflowX: "clip",
  width: ownerState.expanded ? 260 : "var(--trigger-width)",
  opacity: ownerState.expanded ? 1 : 0,
  transition: theme.transitions.create(["width", "opacity"]),
}));

const EMERGING_ISSUE_TIMEFRAMES = [
  { value: "weekly", label: "Past 1 week" },
  { value: "monthly", label: "Past 1 month" },
  { value: "quarterly", label: "Past quarter" },
  { value: "yearly", label: "Past year" },
];

function GridToolbar(props: GridToolbarProps & { title: string; icon: React.ReactNode }) {
  const { title, icon, ...toolbarProps } = props;
  const [anchorEl, setAnchorEl] = useState<null | HTMLElement>(null);
  const open = Boolean(anchorEl);
  return (
    <Toolbar {...toolbarProps}>
      <Box sx={{ display: "flex", alignItems: "center", gap: 1, flex: 1 }}>
        <Box sx={(theme) => ({ width: 34, height: 34, borderRadius: "12px", display: "grid", placeItems: "center", bgcolor: alpha(theme.palette.primary.main, 0.1), color: "primary.main" })}>{icon}</Box>
        <Typography fontWeight={700}>{title}</Typography>
      </Box>
      <Tooltip title="Columns" placement="top" arrow><ColumnsPanelTrigger render={<ToolbarButton />}><ViewColumnIcon fontSize="small" /></ColumnsPanelTrigger></Tooltip>
      <Tooltip title="Filters" placement="top" arrow>
        <FilterPanelTrigger render={(filterProps, state) => (
          <ToolbarButton {...filterProps}><Badge badgeContent={state.filterCount} color="primary" variant={state.filterCount ? "standard" : "dot"}><FilterListIcon fontSize="small" /></Badge></ToolbarButton>
        )} />
      </Tooltip>
      <Tooltip title="Export" placement="top" arrow><ToolbarButton onClick={(event) => setAnchorEl(event.currentTarget)}><FileDownloadIcon fontSize="small" /></ToolbarButton></Tooltip>
      <Menu anchorEl={anchorEl} open={open} onClose={() => setAnchorEl(null)} anchorOrigin={{ vertical: "bottom", horizontal: "right" }} transformOrigin={{ vertical: "top", horizontal: "right" }}>
        <ExportPrint render={<MenuItem />} onClick={() => setAnchorEl(null)}>Print</ExportPrint>
        <ExportCsv render={<MenuItem />} onClick={() => setAnchorEl(null)}>Download as CSV</ExportCsv>
      </Menu>
      <StyledQuickFilter>
        <QuickFilterTrigger render={(triggerProps, state) => (
          <Tooltip title="Search" placement="top" arrow>
            <StyledToolbarButton {...triggerProps} ownerState={{ expanded: state.expanded }} aria-disabled={state.expanded}><SearchIcon fontSize="small" /></StyledToolbarButton>
          </Tooltip>
        )} />
        <QuickFilterControl render={({ ref, ...controlProps }, state) => (
          <StyledTextField
            {...controlProps}
            ownerState={{ expanded: state.expanded }}
            inputRef={ref}
            placeholder="Search..."
            size="small"
            slotProps={{
              input: {
                startAdornment: <InputAdornment position="start"><SearchIcon fontSize="small" /></InputAdornment>,
                endAdornment: state.value ? <InputAdornment position="end"><QuickFilterClear edge="end" size="small" aria-label="Clear search" material={{ sx: { marginRight: -0.75 } }}><SearchIcon fontSize="small" /></QuickFilterClear></InputAdornment> : null,
                ...controlProps.slotProps?.input,
              },
              ...controlProps.slotProps,
            }}
          />
        )} />
      </StyledQuickFilter>
    </Toolbar>
  );
}

export default function Main() {
  const theme = useTheme();
  const isBelowMd = useMediaQuery(theme.breakpoints.down("md"));
  const isBelowLg = useMediaQuery(theme.breakpoints.down("lg"));
  const isBelowXl = useMediaQuery(theme.breakpoints.down("xl"));
  const navigate = useNavigate();
  const currentUser = getStoredUser();
  const currentUserId = currentUser?.id;
  const canViewNationalAnalytics = ["admin", "parliament", "mp"].includes(normalizeAccessValue(currentUser?.role));
  const [data, setData] = useState<Payload | null>(null);
  const [nationalData, setNationalData] = useState<NationalPayload | null>(null);
  const [tab, setTab] = useState(0);
  const [distribution, setDistribution] = useState<DistributionKey>("age_groups");
  const [reviewDemography, setReviewDemography] = useState<DemographyKey>("districts");
  const [feedbackDemography, setFeedbackDemography] = useState<DemographyKey>("districts");
  const [selectedPostId, setSelectedPostId] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [issueRefreshOpen, setIssueRefreshOpen] = useState(false);
  const [issueRefreshTimeframe, setIssueRefreshTimeframe] = useState("monthly");
  const [issueRefreshLoading, setIssueRefreshLoading] = useState(false);
  const [issueRefreshProgress, setIssueRefreshProgress] = useState(0);
  const [issueRefreshMessage, setIssueRefreshMessage] = useState("");
  const [issueRefreshError, setIssueRefreshError] = useState("");
  const [issueRefreshScope, setIssueRefreshScope] = useState<"user" | "national">("user");
  const [selectedIssueDetails, setSelectedIssueDetails] = useState<NormalizedIssue | null>(null);

  const loadAnalytics = async () => {
    if (!currentUserId) {
      setError("No active session found.");
      setLoading(false);
      return;
    }

    const profileResponse = await api.get<Payload>(`/users/${currentUserId}/analytics-profile`, { params: { viewer_user_id: currentUserId } });
    const nationalResponse = canViewNationalAnalytics
      ? await api.get<NationalPayload>("/national-analytics", { params: { viewer_user_id: currentUserId } })
      : null;
    setData(profileResponse.data);
    setNationalData(nationalResponse?.data ?? null);
    setSelectedPostId(profileResponse.data.reviews.selected_post_id ?? profileResponse.data.reviews.posts[0]?.post.id ?? null);
  };

  useEffect(() => {
    const load = async () => {
      if (!currentUserId) {
        setError("No active session found.");
        setLoading(false);
        return;
      }
      try {
        await loadAnalytics();
      } catch (caughtError: unknown) {
        const message = typeof caughtError === "object" && caughtError !== null && "response" in caughtError
          ? ((caughtError as { response?: { data?: { detail?: string } } }).response?.data?.detail || "Unable to load analytics")
          : "Unable to load analytics";
        setError(message);
      } finally {
        setLoading(false);
      }
    };
    void load();
  }, [canViewNationalAnalytics, currentUserId]);

  useEffect(() => {
    if (!canViewNationalAnalytics && tab > 1) {
      setTab(0);
    }
  }, [canViewNationalAnalytics, tab]);

  useEffect(() => {
    if (!issueRefreshLoading) return undefined;

    setIssueRefreshProgress(8);
    const progressTimer = window.setInterval(() => {
      setIssueRefreshProgress((current) => {
        if (current < 55) return current + 7;
        if (current < 82) return current + 3;
        if (current < 94) return current + 1;
        return current;
      });
    }, 900);

    return () => window.clearInterval(progressTimer);
  }, [issueRefreshLoading]);

  const handleGenerateEmergingIssues = async () => {
    if (!currentUserId) return;

    setIssueRefreshLoading(true);
    setIssueRefreshProgress(8);
    setIssueRefreshError("");
    setIssueRefreshMessage("");
    try {
      const endpoint = issueRefreshScope === "national"
        ? "/national/run-bertopic"
        : `/users/${currentUserId}/run-bertopic`;
      const response = await api.post<{ message: string; total_feedbacks: number; issues_saved: number }>(
        endpoint,
        {},
        {
          params: {
            actor_user_id: currentUserId,
            timeframe: issueRefreshTimeframe,
          },
        },
      );
      setIssueRefreshProgress(100);
      setIssueRefreshMessage(`${response.data.message}. ${response.data.issues_saved} issues saved from ${response.data.total_feedbacks} feedbacks.`);
      await loadAnalytics();
    } catch (caughtError: unknown) {
      setIssueRefreshProgress(0);
      const message = typeof caughtError === "object" && caughtError !== null && "response" in caughtError
        ? ((caughtError as { response?: { data?: { detail?: string } } }).response?.data?.detail || "Unable to refresh emerging issues")
        : "Unable to refresh emerging issues";
      setIssueRefreshError(message);
    } finally {
      setIssueRefreshLoading(false);
    }
  };

  const handleViewIssueFeedbacks = (issue: NormalizedIssue, scope: "user" | "national") => {
    const params = new URLSearchParams({ scope, title: issue.title });
    if (scope === "user" && currentUserId) {
      params.set("targetUserId", String(currentUserId));
    }
    navigate(`/dashboard/emerging-issues/${issue.id}/feedbacks?${params.toString()}`);
  };

  const handleChangeIssueStatus = async (issue: NormalizedIssue, nextStatus: string) => {
    if (!currentUserId) return;
    await api.put(`/issues/${issue.id}/status`, { status: nextStatus }, { params: { viewer_user_id: currentUserId } });
    setNationalData((previous) => previous
      ? {
          ...previous,
          feedbacks: {
            ...previous.feedbacks,
            emerging_issues: previous.feedbacks.emerging_issues.map((item) => (
              String(item.id) === String(issue.id) ? { ...item, status: nextStatus } : item
            )),
          },
        }
      : previous);
  };

  const selectedPost = useMemo(
    () => data?.reviews.posts.find((item) => item.post.id === selectedPostId) || data?.reviews.posts[0] || null,
    [data, selectedPostId],
  );

  const postColumns = useMemo<GridColDef<PostAnalyticsRow>[]>(() => [
    {
      field: "rowNumber",
      headerName: "No.",
      width: 56,
      sortable: false,
      filterable: false,
      disableColumnMenu: true,
      align: "center",
      headerAlign: "center",
      renderCell: (params: GridRenderCellParams<PostAnalyticsRow>) => params.api.getRowIndexRelativeToVisibleRows(params.id) + 1,
    },
    {
      field: "post",
      headerName: "Post",
      flex: 1.7,
      minWidth: 280,
      sortable: false,
      renderCell: (params: GridRenderCellParams<PostAnalyticsRow>) => (
        <Stack direction="row" spacing={1.5} alignItems="center" sx={{ minWidth: 0, py: 1 }}>
          <PostThumbnail postId={params.row.post.id} thumbnail={params.row.post.thumbnail} postTitle={params.row.post.title} sx={{ width: 72, height: 48, borderRadius: 2, flexShrink: 0 }} />
          <Box sx={{ minWidth: 0 }}>
            <Typography sx={{ fontWeight: 700 }} noWrap>{params.row.post.title || `${nameOf(params.row.post.author)}'s post`}</Typography>
            <Typography color="text.secondary" variant="body2" noWrap>{params.row.post.content}</Typography>
          </Box>
        </Stack>
      ),
    },
    { field: "visibility", headerName: "Visibility", minWidth: 120, valueGetter: (_value, row) => row.post.visibility, renderCell: (params) => <Chip label={String(params.value)} size="small" /> },
    { field: "reviews", headerName: "Reviews", minWidth: 100, type: "number", valueGetter: (_value, row) => row.performance.total_reviews },
    { field: "reactions", headerName: "Reactions", minWidth: 110, type: "number", valueGetter: (_value, row) => row.performance.total_reactions },
    { field: "views", headerName: "Views", minWidth: 100, type: "number", valueGetter: (_value, row) => row.performance.total_views },
    { field: "engagement", headerName: "Engagement", minWidth: 120, type: "number", valueGetter: (_value, row) => row.performance.engagement_score },
    { field: "published", headerName: "Published", minWidth: 180, valueGetter: (_value, row) => when(row.post.date_added, row.post.time_added) },
  ], []);

  const feedbackColumns = useMemo<GridColDef<FeedbackRow>[]>(() => [
    {
      field: "rowNumber",
      headerName: "No.",
      width: 72,
      sortable: false,
      filterable: false,
      disableColumnMenu: true,
      align: "center",
      headerAlign: "center",
      renderCell: (params: GridRenderCellParams<FeedbackRow>) => params.api.getRowIndexRelativeToVisibleRows(params.id) + 1,
    },
    {
      field: "title",
      headerName: "Feedback",
      flex: 1.5,
      minWidth: 250,
      renderCell: (params: GridRenderCellParams<FeedbackRow>) => (
        <Box sx={{ py: 1 }}>
          <Typography sx={{ fontWeight: 700 }} noWrap>{params.row.title}</Typography>
          <Typography color="text.secondary" variant="body2" noWrap>{params.row.description}</Typography>
        </Box>
      ),
    },
    {
      field: "author",
      headerName: "From",
      minWidth: 180,
      sortable: false,
      valueGetter: (_value, row) => nameOf(row.author),
      renderCell: (params: GridRenderCellParams<FeedbackRow>) => (
        <Stack direction="row" spacing={1} alignItems="center">
          <UserAvatar username={params.row.author.username} fname={params.row.author.fname} lname={params.row.author.lname} profile_picture={params.row.author.profile_picture} sx={{ width: 30, height: 30, fontSize: "0.8rem" }} />
          <Typography variant="body2" noWrap>{nameOf(params.row.author)}</Typography>
        </Stack>
      ),
    },
    { field: "sentiment", headerName: "Sentiment", minWidth: 120, valueGetter: (value) => value || "Unknown", renderCell: (params) => <Chip label={String(params.value || "Unknown")} size="small" /> },
    { field: "status", headerName: "Status", minWidth: 120, valueGetter: (value) => value || "Pending", renderCell: (params) => <Chip label={String(params.value || "Pending")} size="small" variant="outlined" /> },
    { field: "submitted", headerName: "Submitted", minWidth: 180, valueGetter: (_value, row) => when(row.date_added, row.time_added) },
  ], []);

  const nationalReviewColumns = useMemo<GridColDef<NationalReviewRow>[]>(() => [
    {
      field: "rowNumber",
      headerName: "No.",
      width: 72,
      sortable: false,
      filterable: false,
      disableColumnMenu: true,
      align: "center",
      headerAlign: "center",
      renderCell: (params: GridRenderCellParams<NationalReviewRow>) => params.api.getRowIndexRelativeToVisibleRows(params.id) + 1,
    },
    {
      field: "author",
      headerName: "Reviewer",
      minWidth: 190,
      flex: 0.9,
      valueGetter: (_value, row) => nameOf(row.author),
      renderCell: (params: GridRenderCellParams<NationalReviewRow>) => (
        <Stack direction="row" spacing={1} alignItems="center">
          <UserAvatar
            username={params.row.author?.username || "unknown"}
            fname={params.row.author?.fname}
            lname={params.row.author?.lname}
            profile_picture={params.row.author?.profile_picture}
            sx={{ width: 30, height: 30, fontSize: "0.8rem" }}
          />
          <Typography variant="body2" noWrap>{nameOf(params.row.author)}</Typography>
        </Stack>
      ),
    },
    { field: "post", headerName: "Post", minWidth: 240, flex: 1.1, valueGetter: (_value, row) => row.post?.title || row.post?.content || "Untitled post" },
    { field: "content", headerName: "Review", minWidth: 280, flex: 1.3 },
    { field: "sentiment", headerName: "Sentiment", minWidth: 120, valueGetter: (value) => value || "Unknown", renderCell: (params) => <Chip label={String(params.value || "Unknown")} size="small" /> },
    { field: "submitted", headerName: "Submitted", minWidth: 180, valueGetter: (_value, row) => when(row.date_added, row.time_added) },
  ], []);

  const nationalIssueColumns = useMemo<GridColDef<NormalizedIssue>[]>(() => [
    {
      field: "rowNumber",
      headerName: "No.",
      width: 72,
      sortable: false,
      filterable: false,
      disableColumnMenu: true,
      align: "center",
      headerAlign: "center",
      renderCell: (params: GridRenderCellParams<NormalizedIssue>) => params.api.getRowIndexRelativeToVisibleRows(params.id) + 1,
    },
    {
      field: "title",
      headerName: "Emerging Issue",
      flex: 1.2,
      minWidth: 210,
      valueGetter: (_value, row) => row.title,
      renderCell: (params: GridRenderCellParams<NormalizedIssue>) => (
        <Box sx={{ py: 1 }}>
          <Typography sx={{ fontWeight: 700 }} noWrap>{params.row.title}</Typography>
          <Typography color="text.secondary" variant="body2" noWrap>{params.row.summary}</Typography>
        </Box>
      ),
    },
    { field: "feedbackCount", headerName: "Feedbacks", width: 96, type: "number", valueGetter: (_value, row) => row.feedbackCount },
    { field: "region", headerName: "Region", minWidth: 110, flex: 0.65, valueGetter: (_value, row) => row.raw.region || "Unspecified" },
    { field: "district", headerName: "District", minWidth: 120, flex: 0.75, valueGetter: (_value, row) => row.raw.district || "Unspecified" },
    { field: "constituency", headerName: "Constituency", minWidth: 130, flex: 0.85, valueGetter: (_value, row) => row.raw.constituency || "Unspecified" },
    { field: "division", headerName: "Division", minWidth: 110, flex: 0.7, valueGetter: (_value, row) => row.raw.division || "Unspecified" },
    { field: "parish", headerName: "Parish", minWidth: 110, flex: 0.7, valueGetter: (_value, row) => row.raw.parish || "Unspecified" },
    { field: "priority", headerName: "Priority", width: 108, valueGetter: (_value, row) => row.priority, renderCell: (params) => <PriorityBadge priority={params.row.priority} /> },
    { field: "status", headerName: "Status", minWidth: 112, flex: 0.55, valueGetter: (_value, row) => row.raw.status || "Pending", renderCell: (params) => <Chip label={String(params.value || "Pending")} size="small" variant="outlined" /> },
    { field: "sentiment", headerName: "Sentiment", width: 112, valueGetter: (_value, row) => row.sentiment, renderCell: (params) => <Chip label={String(params.value || "Unknown")} size="small" /> },
    { field: "generatedAt", headerName: "Generated", minWidth: 142, flex: 0.7, valueGetter: (_value, row) => row.generatedAtLabel },
    {
      field: "actions",
      headerName: "",
      width: 56,
      sortable: false,
      filterable: false,
      disableColumnMenu: true,
      align: "center",
      renderCell: (params: GridRenderCellParams<NormalizedIssue>) => (
        <IssueActionsMenu
          issue={params.row}
          onViewDetails={setSelectedIssueDetails}
          onViewFeedbacks={(issue) => handleViewIssueFeedbacks(issue, "national")}
          onChangeStatus={handleChangeIssueStatus}
        />
      ),
    },
  ], [handleChangeIssueStatus, handleViewIssueFeedbacks]);

  const nationalIssueColumnVisibility = {
    region: !isBelowMd,
    constituency: !isBelowLg,
    division: !isBelowXl,
    parish: !isBelowXl,
    generatedAt: !isBelowLg,
  };

  const gridSx = {
    border: 0,
    "& .MuiDataGrid-columnHeaders": { backgroundColor: alpha(theme.palette.primary.main, 0.05) },
    "& .grid-row-even": { backgroundColor: alpha(theme.palette.primary.main, 0.025) },
    "& .grid-row-odd": { backgroundColor: theme.palette.background.paper },
    "& .MuiDataGrid-row:hover": { backgroundColor: theme.palette.action.hover, cursor: "pointer" },
  };

  const renderBars = (items: ChartDatum[], color: string, empty: string, height = 310) =>
    items.length ? (
      <Box sx={{ width: "100%" }}>
        <BarChart
          height={height}
          xAxis={[{ scaleType: "band", data: items.map((item) => item.label) }]}
          series={[{ data: items.map((item) => item.value), color }]}
          borderRadius={8}
          grid={{ horizontal: true }}
          margin={{ left: 48, right: 16, top: 12, bottom: 52 }}
        />
      </Box>
    ) : (
      <Empty message={empty} />
    );

  const topChartItems = (items: ChartDatum[], limit = 10) =>
    [...items]
      .filter((item) => item.value > 0)
      .sort((left, right) => right.value - left.value || left.label.localeCompare(right.label))
      .slice(0, limit);

  const renderHorizontalTopBars = (items: ChartDatum[], color: string, empty: string) => {
    const topItems = topChartItems(items);
    if (!topItems.length) return <Empty message={empty} />;
    const maxValue = Math.max(...topItems.map((item) => item.value), 1);

    return (
      <Stack spacing={1.25} sx={{ width: "100%", minWidth: 0 }}>
        {topItems.map((item, index) => {
          const width = `${Math.max(8, Math.round((item.value / maxValue) * 100))}%`;

          return (
            <Box
              key={`${item.label}-${index}`}
              sx={{
                display: "grid",
                gridTemplateColumns: {
                  xs: "1fr",
                  sm: "minmax(210px, 38%) minmax(0, 1fr) auto",
                },
                gap: { xs: 0.75, sm: 1.5 },
                alignItems: "center",
                p: 1.25,
                borderRadius: 2,
                bgcolor: alpha(color, index % 2 === 0 ? 0.055 : 0.025),
                border: `1px solid ${alpha(color, 0.1)}`,
                minWidth: 0,
              }}
            >
              <Typography
                variant="body2"
                sx={{
                  fontWeight: 650,
                  lineHeight: 1.35,
                  overflowWrap: "anywhere",
                  color: "text.primary",
                }}
              >
                {item.label}
              </Typography>

              <Box
                sx={{
                  height: 14,
                  borderRadius: "999px",
                  bgcolor: alpha(color, 0.12),
                  overflow: "hidden",
                  minWidth: 0,
                }}
              >
                <Box
                  sx={{
                    width,
                    height: "100%",
                    borderRadius: "999px",
                    bgcolor: color,
                    transition: "width 220ms ease",
                  }}
                />
              </Box>

              <Typography
                variant="body2"
                sx={{
                  fontWeight: 800,
                  color,
                  textAlign: { xs: "left", sm: "right" },
                  minWidth: { sm: 42 },
                }}
              >
                {item.value}
              </Typography>
            </Box>
          );
        })}
      </Stack>
    );
  };

  const renderPie = (items: ChartDatum[], empty: string, height = 300) => {
    const filteredItems = items.filter((item) => item.value > 0);
    if (!filteredItems.length) return <Empty message={empty} />;
    const total = filteredItems.reduce((sum, item) => sum + item.value, 0);
    const colors: Record<string, string> = {
      Positive: theme.palette.success.main,
      Neutral: theme.palette.info.main,
      Negative: theme.palette.error.main,
      Unknown: theme.palette.warning.main,
    };

    return (
      <Stack spacing={1.5}>
        <PieChart
          height={height}
          series={[
            {
              data: filteredItems.map((item) => ({
                id: item.label,
                label: item.label,
                value: item.value,
                color: colors[item.label] || theme.palette.primary.main,
              })),
              innerRadius: 58,
              paddingAngle: 2,
              cornerRadius: 4,
              arcLabel: (item) => `${Math.round((item.value / total) * 100)}%`,
              arcLabelMinAngle: 18,
            },
          ]}
          margin={{ left: 8, right: 8, top: 8, bottom: 8 }}
        />
        <Stack direction="row" spacing={1} useFlexGap flexWrap="wrap" justifyContent="center">
          {items.map((item) => {
            const percentage = total > 0 ? Math.round((item.value / total) * 100) : 0;
            const tone = colors[item.label] || theme.palette.primary.main;
            return (
              <Chip
                key={item.label}
                label={`${item.label}: ${percentage}%`}
                size="small"
                variant="outlined"
                sx={{ borderColor: tone, color: tone }}
              />
            );
          })}
        </Stack>
      </Stack>
    );
  };

  if (loading) return <Box sx={{ minHeight: "60vh", display: "grid", placeItems: "center" }}><CircularProgress /></Box>;
  if (error || !data || (canViewNationalAnalytics && !nationalData)) return <Alert severity="error">{error || "Unable to load analytics"}</Alert>;

  const distributionMap = selectedPost?.charts.distributions || { gender: [], age_groups: [], subcounty: [], parishes: [] };
  const filteredDistributionMap = {
    ...distributionMap,
    gender: distributionMap.gender.filter((item) => ["Male", "Female"].includes(item.label)),
  };
  const nationalReviewGender = nationalData?.reviews.charts.gender.filter((item) =>
    ["Male", "Female"].includes(item.label),
  ) ?? [];
  const reviewDemographyMap: Record<DemographyKey, ChartDatum[]> = {
    regions: nationalData?.reviews.charts.regions ?? [],
    districts: nationalData?.reviews.charts.districts ?? [],
    constituencies: nationalData?.reviews.charts.constituencies ?? [],
    divisions: nationalData?.reviews.charts.divisions ?? [],
    parishes: nationalData?.reviews.charts.parishes ?? [],
  };
  const feedbackDemographyMap = {
    regions: nationalData?.feedbacks.charts.regions ?? [],
    districts: nationalData?.feedbacks.charts.districts ?? [],
    constituencies: nationalData?.feedbacks.charts.constituencies ?? [],
    divisions: nationalData?.feedbacks.charts.divisions ?? [],
    parishes: nationalData?.feedbacks.charts.parishes ?? [],
  };
  const demographyTitle: Record<DemographyKey, string> = {
    regions: "Region",
    districts: "District",
    constituencies: "Constituency",
    divisions: "Division",
    parishes: "Parish",
  };
  const nationalEmergingIssueSentiments = ["Positive", "Neutral", "Negative"].map((label) => ({
    label,
    value: nationalData?.feedbacks.charts.sentiments.find((item) => item.label === label)?.value || 0,
  }));
  const nationalIssueRows = (nationalData?.feedbacks.emerging_issues ?? [])
    .map(normalizeIssue)
    .sort((left, right) => right.feedbackCount - left.feedbackCount || left.title.localeCompare(right.title));
  const nationalIssueGridRows = nationalIssueRows;
  const stripedRowClassName = (index: number, extraClass = "") =>
    [index % 2 === 0 ? "grid-row-even" : "grid-row-odd", extraClass].filter(Boolean).join(" ");

  return (
    <Stack spacing={3} sx={{ width: "100%", maxWidth: "100%", overflowX: "hidden" }}>
      <Paper elevation={6} sx={{ p: { xs: 2.5, md: 3.5 }, background: "linear-gradient(135deg, #000000 0%, #111111 42%, #D90000 100%)", color: "#FFFFFF", position: "relative", overflow: "hidden" }}>
        <Box sx={{ position: "absolute", top: -70, right: -60, width: 240, height: 240, borderRadius: "50%", bgcolor: alpha("#FFFFFF", 0.08) }} />
        <Stack direction={{ xs: "column", lg: "row" }} spacing={3} justifyContent="space-between" alignItems={{ xs: "flex-start", lg: "center" }} sx={{ position: "relative" }}>
          <Stack direction="row" spacing={2} alignItems="center">
            <UserAvatar username={data.profile.username} fname={data.profile.fname} lname={data.profile.lname} profile_picture={data.profile.profile_picture} sx={{ width: 64, height: 64 }} />
            <Box>
              <Typography variant="h4" sx={{ fontWeight: 700 }}>{nameOf(data.profile)}</Typography>
              <Typography sx={{ mt: 0.5, color: alpha("#FFFFFF", 0.82) }}>Single profile analytics for reviews, feedbacks, and emerging issues.</Typography>
            </Box>
          </Stack>
          <Stack direction="row" spacing={1} useFlexGap flexWrap="wrap">
            {data.profile.constituency_name ? <Chip label={`Constituency: ${data.profile.constituency_name}`} sx={{ bgcolor: alpha("#FFFFFF", 0.12), color: "#FFFFFF" }} /> : null}
            {data.profile.district_name ? <Chip label={`District: ${data.profile.district_name}`} sx={{ bgcolor: alpha("#FFFFFF", 0.12), color: "#FFFFFF" }} /> : null}
            <Chip label={(data.profile.visibility || "public").toUpperCase()} sx={{ bgcolor: alpha("#FFFFFF", 0.12), color: "#FFFFFF" }} />
          </Stack>
        </Stack>
      </Paper>

      <Paper elevation={3} sx={{ px: 2, pt: 1 }}>
        <Tabs value={tab} onChange={(_event, next) => setTab(next)} variant="scrollable" scrollButtons="auto">
          <Tab label="Reviews" />
          <Tab label="Feedbacks" />
          {canViewNationalAnalytics ? <Tab label="National Reviews" /> : null}
          {canViewNationalAnalytics ? <Tab label="National Emerging Issues" /> : null}
        </Tabs>
      </Paper>

      {tab === 0 ? (
        <Stack spacing={3}>
          <Grid container spacing={2}>
            <Grid size={{ xs: 12, md: 6, xl: 3 }}>
              <Metric title="Total Reviews" value={selectedPost?.performance.total_reviews || 0} tone="#D90000" icon={<RateReviewRoundedIcon />} helper="Selected post performance" />
            </Grid>
            <Grid size={{ xs: 12, md: 6, xl: 3 }}>
              <Metric title="Total Views" value={selectedPost?.performance.total_views || 0} tone="#D90000" icon={<RemoveRedEyeRoundedIcon />} helper="Interaction views on the post" />
            </Grid>
            <Grid size={{ xs: 12, md: 6, xl: 3 }}>
              <Metric title="Total Reactions" value={selectedPost?.performance.total_reactions || 0} tone="#FCDC04" icon={<ThumbUpAltRoundedIcon />} helper="Combined reactions on the selected post" />
            </Grid>
            <Grid size={{ xs: 12, md: 6, xl: 3 }}>
              <Metric title="Engagement Score" value={selectedPost?.performance.engagement_score || 0} tone="#990000" icon={<AutoGraphRoundedIcon />} helper={`${data.reviews.summary.average_reviews_per_post} avg reviews per post overall`} />
            </Grid>
          </Grid>

          <Grid container spacing={2}>
            <Grid size={{ xs: 12, xl: 6 }}>
              <Panel title="Reviews Sentiments" subtitle={selectedPost ? `Currently showing: ${selectedPost.post.title || "Untitled post"}` : "Select a post to inspect its sentiment mix"}>
                {renderBars(selectedPost?.charts.sentiments || [], theme.palette.primary.main, "No sentiment data is available for this post yet.")}
              </Panel>
            </Grid>
            <Grid size={{ xs: 12, xl: 6 }}>
              <Panel title={distribution === "age_groups" ? "Reviews by age group" : distribution === "gender" ? "Reviews by gender" : distribution === "parishes" ? "Reviews by parish" : "Reviews by subcounty"} subtitle="Switch between demographic and location-based review distributions">
                <Stack spacing={2}>
                  <Stack direction="row" spacing={1} useFlexGap flexWrap="wrap">
                    {[
                      ["age_groups", "Age groups"],
                      ["gender", "Gender"],
                      ["parishes", "Parishes"],
                      ["subcounty", "Subcounty"],
                    ].map(([key, label]) => (
                      <Chip key={key} label={label} color={distribution === key ? "primary" : "default"} variant={distribution === key ? "filled" : "outlined"} onClick={() => setDistribution(key as DistributionKey)} sx={{ cursor: "pointer" }} />
                    ))}
                  </Stack>
                  {renderBars(filteredDistributionMap[distribution], "#D90000", "No distribution data is available for the current filter.")}
                </Stack>
              </Panel>
            </Grid>
          </Grid>

          <Paper elevation={3} sx={{ p: 2 }}>
            <Box sx={{ height: 520, width: "100%" }}>
              <DataGrid
                rows={data.reviews.posts}
                columns={postColumns}
                getRowId={(row) => row.post.id}
                onRowClick={(params) => setSelectedPostId(Number(params.id))}
                initialState={{ pagination: { paginationModel: { pageSize: 10, page: 0 } } }}
                pageSizeOptions={[5, 10, 20]}
                slots={{ toolbar: (toolbarProps) => <GridToolbar {...toolbarProps} title="Posts Analytics" icon={<ForumRoundedIcon fontSize="small" />} /> }}
                showToolbar
                sx={{
                  ...gridSx,
                  "& .analytics-selected-row": {
                    backgroundColor: alpha(theme.palette.primary.main, 0.08),
                  },
                }}
                getRowClassName={(params) => stripedRowClassName(
                  params.indexRelativeToCurrentPage,
                  params.id === selectedPost?.post.id ? "analytics-selected-row" : "",
                )}
              />
            </Box>
          </Paper>
        </Stack>
      ) : tab === 1 ? (
        <Stack spacing={3}>
          <Grid container spacing={2}>
            <Grid size={{ xs: 12, md: 6, xl: 3 }}>
              <Metric title="Total Feedbacks" value={data.feedbacks.summary.total_feedbacks} tone="#D90000" icon={<FeedbackRoundedIcon />} helper="Feedback records received by this profile" />
            </Grid>
            <Grid size={{ xs: 12, md: 6, xl: 3 }}>
              <Metric title="Pending Feedbacks" value={data.feedbacks.summary.pending_feedbacks} tone="#FCDC04" icon={<ReportProblemRoundedIcon />} helper="Still waiting for analysis or follow-up" />
            </Grid>
            <Grid size={{ xs: 12, md: 6, xl: 3 }}>
              <Metric title="Open Emerging Issues" value={data.feedbacks.summary.open_emerging_issues} tone="#D90000" icon={<InsightsRoundedIcon />} helper="Generated from analysed feedback" />
            </Grid>
            <Grid size={{ xs: 12, md: 6, xl: 3 }}>
              <Metric title="Resolved Issues" value={data.feedbacks.summary.resolved_emerging_issues} tone="#D90000" icon={<Groups2RoundedIcon />} helper="Issues marked as resolved" />
            </Grid>
          </Grid>

          <Grid container spacing={2}>
            <Grid size={{ xs: 12, xl: 6 }}>
              <Panel title="Feedback Sentiments" subtitle="Sentiment spread across received feedback">
                {renderBars(data.feedbacks.charts.sentiments, theme.palette.primary.main, "No feedback sentiment data is available yet.")}
              </Panel>
            </Grid>
            <Grid size={{ xs: 12, xl: 6 }}>
              <EmergingIssuesPage
                issues={data.feedbacks.emerging_issues}
                subtitle="Latest issues raised from analysed feedback"
                loading={loading}
                error={error}
                onRefresh={() => {
                  setIssueRefreshScope("user");
                  setIssueRefreshError("");
                  setIssueRefreshMessage("");
                  setIssueRefreshOpen(true);
                }}
                onViewFeedbacks={(issue) => handleViewIssueFeedbacks(issue, "user")}
              />
            </Grid>
          </Grid>

          <Paper id="profile-feedback-records" elevation={3} sx={{ p: 2, scrollMarginTop: 96 }}>
            <Box sx={{ height: 520, width: "100%" }}>
              <DataGrid
                rows={data.feedbacks.feedbacks}
                columns={feedbackColumns}
                initialState={{ pagination: { paginationModel: { pageSize: 10, page: 0 } } }}
                pageSizeOptions={[5, 10, 20]}
                slots={{ toolbar: (toolbarProps) => <GridToolbar {...toolbarProps} title="Feedback Records" icon={<FeedbackRoundedIcon fontSize="small" />} /> }}
                showToolbar
                disableRowSelectionOnClick
                sx={gridSx}
                getRowClassName={(params) => stripedRowClassName(params.indexRelativeToCurrentPage)}
              />
            </Box>
          </Paper>
        </Stack>
      ) : tab === 2 && canViewNationalAnalytics && nationalData ? (
        <Stack spacing={3}>
          <Grid container spacing={2}>
            <Grid size={{ xs: 12, md: 6, xl: 2.4 }}>
              <Metric title="National Reviews" value={nationalData.reviews.summary.total_reviews} tone="#D90000" icon={<RateReviewRoundedIcon />} helper="Across public post reviews" />
            </Grid>
            <Grid size={{ xs: 12, md: 6, xl: 2.4 }}>
              <Metric title="Posts Reviewed" value={nationalData.reviews.summary.total_posts_reviewed} tone="#D90000" icon={<ForumRoundedIcon />} helper="Posts with at least one review" />
            </Grid>
            <Grid size={{ xs: 12, md: 6, xl: 2.4 }}>
              <Metric title="Reviewers" value={nationalData.reviews.summary.unique_reviewers} tone="#D90000" icon={<Groups2RoundedIcon />} helper="Unique review authors" />
            </Grid>
            <Grid size={{ xs: 12, md: 6, xl: 2.4 }}>
              <Metric title="Reactions" value={nationalData.reviews.summary.total_reactions} tone="#FCDC04" icon={<ThumbUpAltRoundedIcon />} helper="On reviewed posts" />
            </Grid>
            <Grid size={{ xs: 12, md: 6, xl: 2.4 }}>
              <Metric title="Views" value={nationalData.reviews.summary.total_views} tone="#990000" icon={<RemoveRedEyeRoundedIcon />} helper="On reviewed posts" />
            </Grid>
          </Grid>

          <Grid container spacing={2} sx={{ minWidth: 0 }}>
            <Grid size={{ xs: 12, xl: 6 }}>
              <Panel title="National Review Sentiments" subtitle="Sentiment spread across submitted post reviews">
                {renderBars(nationalData.reviews.charts.sentiments, theme.palette.primary.main, "No national review sentiment data is available yet.")}
              </Panel>
            </Grid>
            <Grid size={{ xs: 12, xl: 6 }}>
              <Panel title="Reviews by Demography" subtitle={`Top 10 areas by ${demographyTitle[reviewDemography].toLowerCase()}`}>
                <Stack spacing={2}>
                  <Stack direction="row" spacing={1} useFlexGap flexWrap="wrap">
                    {[
                      ["regions", "Region"],
                      ["districts", "District"],
                      ["constituencies", "Constituency"],
                      ["divisions", "Division"],
                      ["parishes", "Parish"],
                    ].map(([key, label]) => (
                      <Chip
                        key={key}
                        label={label}
                        color={reviewDemography === key ? "primary" : "default"}
                        variant={reviewDemography === key ? "filled" : "outlined"}
                        onClick={() => setReviewDemography(key as DemographyKey)}
                        sx={{ cursor: "pointer" }}
                      />
                    ))}
                  </Stack>
                  {renderHorizontalTopBars(reviewDemographyMap[reviewDemography], "#D90000", "No national review demography data is available yet.")}
                </Stack>
              </Panel>
            </Grid>
            <Grid size={{ xs: 12, xl: 6 }}>
              <Panel title="Reviews by Gender" subtitle="Reviewer gender distribution nationally">
                {renderBars(nationalReviewGender, "#D90000", "No national gender review data is available yet.")}
              </Panel>
            </Grid>
            <Grid size={{ xs: 12, xl: 6 }}>
              <Panel title="Reviews by Age Group" subtitle="Reviewer age distribution nationally">
                {renderBars(nationalData.reviews.charts.age_groups, "#990000", "No national age group review data is available yet.")}
              </Panel>
            </Grid>
          </Grid>

          <Paper elevation={3} sx={{ p: 2 }}>
            <Box sx={{ height: 560, width: "100%" }}>
              <DataGrid
                rows={nationalData.reviews.reviews}
                columns={nationalReviewColumns}
                initialState={{ pagination: { paginationModel: { pageSize: 10, page: 0 } } }}
                pageSizeOptions={[5, 10, 20, 50]}
                slots={{ toolbar: (toolbarProps) => <GridToolbar {...toolbarProps} title="National Reviews" icon={<RateReviewRoundedIcon fontSize="small" />} /> }}
                showToolbar
                disableRowSelectionOnClick
                sx={gridSx}
                getRowClassName={(params) => stripedRowClassName(params.indexRelativeToCurrentPage)}
              />
            </Box>
          </Paper>
        </Stack>
      ) : tab === 3 && canViewNationalAnalytics && nationalData ? (
        <Stack spacing={3}>
          <Grid container spacing={2}>
            <Grid size={{ xs: 12, md: 6, xl: 2.4 }}>
              <Metric title="National Emerging Issues" value={nationalData.feedbacks.emerging_issues.length} tone="#D90000" icon={<FeedbackRoundedIcon />} helper="Modelled from citizen feedback records" />
            </Grid>
            <Grid size={{ xs: 12, md: 6, xl: 2.4 }}>
              <Metric title="Pending" value={nationalData.feedbacks.summary.pending_feedbacks} tone="#FCDC04" icon={<ReportProblemRoundedIcon />} helper="Waiting for action or analysis" />
            </Grid>
            <Grid size={{ xs: 12, md: 6, xl: 2.4 }}>
              <Metric title="Analysed" value={nationalData.feedbacks.summary.analysed_feedbacks} tone="#D90000" icon={<InsightsRoundedIcon />} helper="Feedbacks marked analysed" />
            </Grid>
            <Grid size={{ xs: 12, md: 6, xl: 2.4 }}>
              <Metric title="Authors" value={nationalData.feedbacks.summary.unique_authors} tone="#D90000" icon={<Groups2RoundedIcon />} helper="Unique feedback authors" />
            </Grid>
            <Grid size={{ xs: 12, md: 6, xl: 2.4 }}>
              <Metric title="Targets" value={nationalData.feedbacks.summary.unique_targets} tone="#990000" icon={<PersonSearchRoundedIcon />} helper="Unique feedback recipients" />
            </Grid>
          </Grid>

          <Grid container spacing={2}>
            <Grid size={{ xs: 12, xl: 6 }}>
              <EmergingIssuesPage
                issues={nationalData.feedbacks.emerging_issues}
                subtitle="Issues modelled from feedbacks in your country"
                loading={loading}
                error={error}
                onRefresh={() => {
                  setIssueRefreshScope("national");
                  setIssueRefreshError("");
                  setIssueRefreshMessage("");
                  setIssueRefreshOpen(true);
                }}
                onViewFeedbacks={(issue) => handleViewIssueFeedbacks(issue, "national")}
              />
            </Grid>
            <Grid size={{ xs: 12, xl: 6 }}>
              <Panel title="Emerging Issues by Demography" subtitle={`Top 10 issue locations by ${demographyTitle[feedbackDemography].toLowerCase()}`}>
                <Stack spacing={2}>
                  <Stack direction="row" spacing={1} useFlexGap flexWrap="wrap">
                    {[
                      ["regions", "Region"],
                      ["districts", "District"],
                      ["constituencies", "Constituency"],
                      ["divisions", "Division"],
                      ["parishes", "Parish"],
                    ].map(([key, label]) => (
                      <Chip
                        key={key}
                        label={label}
                        color={feedbackDemography === key ? "primary" : "default"}
                        variant={feedbackDemography === key ? "filled" : "outlined"}
                        onClick={() => setFeedbackDemography(key as DemographyKey)}
                        sx={{ cursor: "pointer" }}
                      />
                    ))}
                  </Stack>
                  {renderHorizontalTopBars(feedbackDemographyMap[feedbackDemography], "#990000", "No national emerging issue demography data is available yet.")}
                </Stack>
              </Panel>
            </Grid>
            <Grid size={{ xs: 12, xl: 6 }}>
              <Panel title="Feedbacks by Age Group" subtitle="Feedback authors by age group">
                {renderBars(nationalData.feedbacks.charts.age_groups, "#D90000", "No national feedback age data is available yet.", 380)}
              </Panel>
            </Grid>
            <Grid size={{ xs: 12, xl: 6 }}>
              <Panel title="Emerging Issues Sentiments" subtitle="All sentiment percentages from national feedbacks">
                {renderPie(nationalEmergingIssueSentiments, "No emerging issue sentiment data is available yet.")}
              </Panel>
            </Grid>
          </Grid>

          <Paper id="national-emerging-issues-records" elevation={3} sx={{ p: { xs: 1, md: 2 }, scrollMarginTop: 96, width: "100%", maxWidth: "100%", minWidth: 0, overflow: "hidden" }}>
            <Box sx={{ width: "100%", maxWidth: "100%", overflowX: "auto", overflowY: "hidden", pb: 1 }}>
              <Box sx={{ height: 560, minWidth: { xs: 1120, lg: 1280 }, width: "100%" }}>
                <DataGrid
                  rows={nationalIssueGridRows}
                  columns={nationalIssueColumns}
                  columnVisibilityModel={nationalIssueColumnVisibility}
                  getRowId={(row) => row.id}
                  initialState={{ pagination: { paginationModel: { pageSize: 10, page: 0 } } }}
                  pageSizeOptions={[5, 10, 20, 50]}
                  slots={{ toolbar: (toolbarProps) => <GridToolbar {...toolbarProps} title="National Emerging Issues" icon={<InsightsRoundedIcon fontSize="small" />} /> }}
                  showToolbar
                  disableRowSelectionOnClick
                  sx={{
                    ...gridSx,
                    width: "100%",
                    maxWidth: "100%",
                    minWidth: 0,
                    "& .MuiDataGrid-root": { maxWidth: "100%" },
                    "& .MuiDataGrid-main": { minWidth: 0 },
                  }}
                  getRowClassName={(params) => stripedRowClassName(params.indexRelativeToCurrentPage)}
                />
              </Box>
            </Box>
          </Paper>
        </Stack>
      ) : null}

      <Dialog
        open={issueRefreshOpen}
        onClose={() => {
          if (!issueRefreshLoading) setIssueRefreshOpen(false);
        }}
        fullWidth
        maxWidth="sm"
      >
        <DialogTitle>{issueRefreshScope === "national" ? "Refresh National Emerging Issues" : "Refresh Emerging Issues"}</DialogTitle>
        <DialogContent>
          <Stack spacing={2} sx={{ pt: 1 }}>
            <Typography color="text.secondary">
              {issueRefreshScope === "national"
                ? "Select the timeframe to model emerging issues from feedbacks in your country."
                : "Select the feedback timeframe to use for BERTopic modelling."}
            </Typography>
            {issueRefreshError ? <Alert severity="error">{issueRefreshError}</Alert> : null}
            {issueRefreshMessage ? <Alert severity="success">{issueRefreshMessage}</Alert> : null}
            <TextField
              select
              label="Timeframe"
              value={issueRefreshTimeframe}
              onChange={(event) => setIssueRefreshTimeframe(event.target.value)}
              fullWidth
              disabled={issueRefreshLoading}
            >
              {EMERGING_ISSUE_TIMEFRAMES.map((option) => (
                <MenuItem key={option.value} value={option.value}>
                  {option.label}
                </MenuItem>
              ))}
            </TextField>
            {issueRefreshLoading ? (
              <Box>
                <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 0.75 }}>
                  <Typography variant="body2" color="text.secondary">Generating emerging issues</Typography>
                  <Typography variant="body2" sx={{ fontWeight: 800 }}>{issueRefreshProgress}%</Typography>
                </Stack>
                <LinearProgress variant="determinate" value={issueRefreshProgress} sx={{ height: 8, borderRadius: 999 }} />
              </Box>
            ) : null}
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setIssueRefreshOpen(false)} disabled={issueRefreshLoading}>
            Close
          </Button>
          <Button
            variant="contained"
            onClick={handleGenerateEmergingIssues}
            disabled={issueRefreshLoading}
            startIcon={issueRefreshLoading ? <CircularProgress size={18} color="inherit" /> : <RefreshRoundedIcon />}
          >
            Generate
          </Button>
        </DialogActions>
      </Dialog>

      <Dialog open={Boolean(selectedIssueDetails)} onClose={() => setSelectedIssueDetails(null)} fullWidth maxWidth="sm">
        <DialogTitle>{selectedIssueDetails?.title || "Emerging Issue Details"}</DialogTitle>
        <DialogContent>
          {selectedIssueDetails ? (
            <Stack spacing={2} sx={{ pt: 1 }}>
              <Typography color="text.secondary">{selectedIssueDetails.summary}</Typography>
              <Stack direction="row" spacing={1} useFlexGap flexWrap="wrap">
                <Chip label={`${selectedIssueDetails.feedbackCount} feedbacks`} size="small" />
                <Chip label={selectedIssueDetails.priority} size="small" color={selectedIssueDetails.priority === "High" ? "error" : selectedIssueDetails.priority === "Medium" ? "warning" : "success"} />
                <Chip label={`Status: ${selectedIssueDetails.raw.status || "Pending"}`} size="small" variant="outlined" />
                <Chip label={`Generated: ${selectedIssueDetails.generatedAtLabel}`} size="small" variant="outlined" />
                <Chip label={selectedIssueDetails.sentiment} size="small" />
              </Stack>
              <Box>
                <Typography variant="subtitle2" sx={{ fontWeight: 800, mb: 1 }}>Location</Typography>
                <Typography variant="body2" color="text.secondary">
                  {[selectedIssueDetails.raw.region, selectedIssueDetails.raw.district, selectedIssueDetails.raw.constituency, selectedIssueDetails.raw.division, selectedIssueDetails.raw.parish]
                    .filter(Boolean)
                    .join(" / ") || "Unspecified"}
                </Typography>
              </Box>
              <Box>
                <Typography variant="subtitle2" sx={{ fontWeight: 800, mb: 1 }}>Key terms</Typography>
                <Stack direction="row" spacing={0.75} useFlexGap flexWrap="wrap">
                  {(selectedIssueDetails.keywords.length ? selectedIssueDetails.keywords : ["public service"]).map((keyword) => (
                    <Chip key={keyword} label={titleCase(keyword)} size="small" variant="outlined" />
                  ))}
                </Stack>
              </Box>
            </Stack>
          ) : null}
        </DialogContent>
        <DialogActions>
          {selectedIssueDetails ? (
            <Button onClick={() => handleViewIssueFeedbacks(selectedIssueDetails, "national")}>View Feedback</Button>
          ) : null}
          <Button variant="contained" onClick={() => setSelectedIssueDetails(null)}>Close</Button>
        </DialogActions>
      </Dialog>
    </Stack>
  );
}
