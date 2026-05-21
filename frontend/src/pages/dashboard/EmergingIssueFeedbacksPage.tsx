import { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams, useSearchParams } from "react-router-dom";
import {
  Alert,
  Box,
  Button,
  Chip,
  CircularProgress,
  Paper,
  Stack,
  Typography,
} from "@mui/material";
import { DataGrid, type GridColDef, type GridRenderCellParams } from "@mui/x-data-grid";
import ArrowBackRoundedIcon from "@mui/icons-material/ArrowBackRounded";
import FeedbackRoundedIcon from "@mui/icons-material/FeedbackRounded";

import UserAvatar from "../../components/UserAvatar";
import { api } from "../../lib/api";
import { getStoredUser } from "../../lib/session";

type Person = {
  id?: number;
  username?: string | null;
  fname?: string | null;
  lname?: string | null;
  profile_picture?: string | null;
};

type IssueFeedback = {
  id: number;
  title?: string | null;
  description?: string | null;
  category?: string | null;
  sentiment?: string | null;
  status?: string | null;
  date_added?: string | null;
  time_added?: string | null;
  author?: Person | null;
  target?: Person | null;
};

const nameOf = (person?: Person | null) =>
  [person?.fname, person?.lname].filter(Boolean).join(" ") ||
  person?.username ||
  "Unknown";

const when = (date?: string | null, time?: string | null) =>
  [date, time].filter(Boolean).join(" ") || "Unknown";

const EmergingIssueFeedbacksPage = () => {
  const { issueId } = useParams();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const currentUser = getStoredUser();
  const [feedbacks, setFeedbacks] = useState<IssueFeedback[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const issueTitle = searchParams.get("title") || "Emerging Issue";
  const scope = searchParams.get("scope") || "user";
  const targetUserId = searchParams.get("targetUserId");

  useEffect(() => {
    const loadFeedbacks = async () => {
      if (!issueId || !currentUser?.id) {
        setLoading(false);
        return;
      }

      try {
        setError("");
        setLoading(true);
        const response = await api.get<IssueFeedback[]>(
          `/emerging-issues/${issueId}/feedbacks`,
          {
            params: {
              viewer_user_id: currentUser.id,
              scope,
              target_user_id: targetUserId || undefined,
            },
          },
        );
        setFeedbacks(response.data);
      } catch {
        setError("Unable to load feedbacks for this emerging issue.");
      } finally {
        setLoading(false);
      }
    };

    void loadFeedbacks();
  }, [issueId, currentUser?.id, scope, targetUserId]);

  const columns = useMemo<GridColDef<IssueFeedback>[]>(
    () => [
      {
        field: "rowNumber",
        headerName: "No.",
        width: 72,
        sortable: false,
        filterable: false,
        disableColumnMenu: true,
        align: "center",
        headerAlign: "center",
        renderCell: (params: GridRenderCellParams<IssueFeedback>) => params.api.getRowIndexRelativeToVisibleRows(params.id) + 1,
      },
      {
        field: "title",
        headerName: "Feedback",
        flex: 1.5,
        minWidth: 280,
        renderCell: (params: GridRenderCellParams<IssueFeedback>) => (
          <Box sx={{ py: 1 }}>
            <Typography sx={{ fontWeight: 700 }} noWrap>
              {params.row.title || "Untitled feedback"}
            </Typography>
            <Typography color="text.secondary" variant="body2" noWrap>
              {params.row.description || "No description provided."}
            </Typography>
          </Box>
        ),
      },
      {
        field: "author",
        headerName: "From",
        minWidth: 190,
        valueGetter: (_value, row) => nameOf(row.author),
        renderCell: (params: GridRenderCellParams<IssueFeedback>) => (
          <Stack direction="row" spacing={1} alignItems="center">
            <UserAvatar
              username={params.row.author?.username || "unknown"}
              fname={params.row.author?.fname}
              lname={params.row.author?.lname}
              profile_picture={params.row.author?.profile_picture}
              sx={{ width: 30, height: 30, fontSize: "0.8rem" }}
            />
            <Typography variant="body2" noWrap>
              {nameOf(params.row.author)}
            </Typography>
          </Stack>
        ),
      },
      { field: "category", headerName: "Category", minWidth: 150, valueGetter: (_value, row) => row.category || "Unspecified" },
      {
        field: "sentiment",
        headerName: "Sentiment",
        minWidth: 130,
        valueGetter: (_value, row) => row.sentiment || "Unknown",
        renderCell: (params) => <Chip label={String(params.value || "Unknown")} size="small" />,
      },
      {
        field: "status",
        headerName: "Status",
        minWidth: 130,
        valueGetter: (_value, row) => row.status || "Pending",
        renderCell: (params) => <Chip label={String(params.value || "Pending")} size="small" variant="outlined" />,
      },
      { field: "submitted", headerName: "Submitted", minWidth: 180, valueGetter: (_value, row) => when(row.date_added, row.time_added) },
    ],
    [],
  );

  return (
    <Stack spacing={3}>
      <Button
        startIcon={<ArrowBackRoundedIcon />}
        onClick={() => navigate("/dashboard/overview")}
        sx={{ alignSelf: "flex-start" }}
      >
        Back to analytics
      </Button>

      <Paper elevation={3} sx={{ p: 3 }}>
        <Stack direction="row" spacing={1.5} alignItems="center">
          <FeedbackRoundedIcon color="primary" />
          <Box>
            <Typography variant="h5" sx={{ fontWeight: 800 }}>
              {issueTitle} Feedbacks
            </Typography>
            <Typography color="text.secondary" sx={{ mt: 0.5 }}>
              {feedbacks.length} feedback record{feedbacks.length === 1 ? "" : "s"} linked to this emerging issue.
            </Typography>
          </Box>
        </Stack>
      </Paper>

      {error ? <Alert severity="error">{error}</Alert> : null}

      <Paper elevation={3} sx={{ p: 2 }}>
        {loading ? (
          <Box sx={{ minHeight: 300, display: "grid", placeItems: "center" }}>
            <CircularProgress />
          </Box>
        ) : (
          <Box sx={{ height: 560, width: "100%" }}>
            <DataGrid
              rows={feedbacks}
              columns={columns}
              getRowId={(row) => row.id}
              initialState={{ pagination: { paginationModel: { pageSize: 10, page: 0 } } }}
              pageSizeOptions={[5, 10, 20, 50]}
              disableRowSelectionOnClick
              getRowClassName={(params) => (params.indexRelativeToCurrentPage % 2 === 0 ? "grid-row-even" : "grid-row-odd")}
              sx={(theme) => ({
                border: 0,
                "& .MuiDataGrid-columnHeaders": {
                  backgroundColor: theme.palette.action.hover,
                },
                "& .grid-row-even": {
                  backgroundColor: theme.palette.action.hover,
                },
                "& .grid-row-odd": {
                  backgroundColor: theme.palette.background.paper,
                },
                "& .MuiDataGrid-row:hover": {
                  backgroundColor: theme.palette.action.selected,
                },
              })}
            />
          </Box>
        )}
      </Paper>
    </Stack>
  );
};

export default EmergingIssueFeedbacksPage;
