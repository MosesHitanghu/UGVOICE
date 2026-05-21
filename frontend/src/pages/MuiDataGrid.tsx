import * as React from "react";
import { styled, alpha } from "@mui/material/styles";
import {
  DataGrid,
  type GridColDef,
  type GridRenderCellParams,
  type GridToolbarProps,
  Toolbar,
  ToolbarButton,
  ColumnsPanelTrigger,
  FilterPanelTrigger,
  ExportCsv,
  ExportPrint,
  QuickFilter,
  QuickFilterControl,
  QuickFilterClear,
  QuickFilterTrigger,
} from "@mui/x-data-grid";

import Tooltip from "@mui/material/Tooltip";
import Menu from "@mui/material/Menu";
import Badge from "@mui/material/Badge";
import ViewColumnIcon from "@mui/icons-material/ViewColumn";
import FilterListIcon from "@mui/icons-material/FilterList";
import FileDownloadIcon from "@mui/icons-material/FileDownload";
import MenuItem from "@mui/material/MenuItem";
import Divider from "@mui/material/Divider";
import TextField from "@mui/material/TextField";
import InputAdornment from "@mui/material/InputAdornment";
import CancelIcon from "@mui/icons-material/Cancel";
import SearchIcon from "@mui/icons-material/Search";
import Typography from "@mui/material/Typography";
import { Box, IconButton } from "@mui/material";
import PeopleIcon from "@mui/icons-material/People";
import GroupAddIcon from "@mui/icons-material/GroupAdd";
import MoreHorizIcon from "@mui/icons-material/MoreHoriz";
import EditIcon from "@mui/icons-material/Edit";
import DeleteIcon from "@mui/icons-material/Delete";
import FormRightPanel from "../components/FormRightPanel";

type UserRow = {
  id: number;
  first_name: string;
  last_name: string;
  email: string;
  gender: string;
  ip_address: string;
};

type UserFormValues = Omit<UserRow, "id"> & {
  id?: number;
};

type ToolbarProps = React.ComponentProps<typeof Toolbar> & {
  onAddUser?: () => void;
};

function ActionsMenu({
  row,
  onEdit,
  onDelete,
}: {
  row: UserRow;
  onEdit: (row: UserRow) => void;
  onDelete: (row: UserRow) => void;
}) {
  const [anchorEl, setAnchorEl] = React.useState<null | HTMLElement>(null);
  const open = Boolean(anchorEl);

  const handleOpen = (event: React.MouseEvent<HTMLButtonElement>) => {
    setAnchorEl(event.currentTarget);
  };

  const handleClose = () => {
    setAnchorEl(null);
  };

  return (
    <>
      <IconButton
        size="small"
        color="primary"
        onClick={handleOpen}
        aria-label="row actions"
      >
        <MoreHorizIcon fontSize="small" />
      </IconButton>
      <Menu
        anchorEl={anchorEl}
        open={open}
        onClose={handleClose}
        anchorOrigin={{ vertical: "bottom", horizontal: "right" }}
        transformOrigin={{ vertical: "top", horizontal: "right" }}
      >
        <MenuItem
          onClick={() => {
            onEdit(row);
            handleClose();
          }}
        >
          <EditIcon fontSize="small" sx={{ mr: 1 }} />
          Edit
        </MenuItem>
        <MenuItem
          onClick={() => {
            onDelete(row);
            handleClose();
          }}
        >
          <DeleteIcon fontSize="small" sx={{ mr: 1 }} />
          Delete
        </MenuItem>
      </Menu>
    </>
  );
}

const columns: GridColDef<UserRow>[] = [
  { field: "id", headerName: "ID", width: 70 },
  { field: "first_name", headerName: "First Name", flex: 1 },
  { field: "last_name", headerName: "Last Name", flex: 1 },
  { field: "email", headerName: "Email", flex: 1.5 },
  { field: "gender", headerName: "Gender", flex: 1 },
  { field: "ip_address", headerName: "IP Address", flex: 1 },
  {
    field: "actions",
    headerName: "Actions",
    sortable: false,
    width: 80,
    renderCell: (params: GridRenderCellParams<UserRow>) => (
      <ActionsMenu
        row={params.row}
        onEdit={() => {}}
        onDelete={() => {}}
      />
    ),
    disableColumnMenu: true,
    disableExport: true,
  },
];
type OwnerState = {
  expanded: boolean;
};

const StyledQuickFilter = styled(QuickFilter)({
  display: "grid",
  alignItems: "center",
});

const StyledToolbarButton = styled(ToolbarButton)<{ ownerState: OwnerState }>(
  ({ theme, ownerState }) => ({
    gridArea: "1 / 1",
    width: "min-content",
    height: "min-content",
    zIndex: 1,
    opacity: ownerState.expanded ? 0 : 1,
    pointerEvents: ownerState.expanded ? "none" : "auto",
    transition: theme.transitions.create(["opacity"]),
  }),
);

const StyledTextField = styled(TextField)<{
  ownerState: OwnerState;
}>(({ theme, ownerState }) => ({
  gridArea: "1 / 1",
  overflowX: "clip",
  width: ownerState.expanded ? 260 : "var(--trigger-width)",
  opacity: ownerState.expanded ? 1 : 0,
  transition: theme.transitions.create(["width", "opacity"]),
}));

function CustomToolbar(props: ToolbarProps) {
  const { onAddUser, ...toolbarProps } = props;
  const [exportAnchorEl, setExportAnchorEl] =
    React.useState<null | HTMLElement>(null);
  const exportMenuOpen = Boolean(exportAnchorEl);

  return (
    <Toolbar {...toolbarProps}>
      <IconButton>
        <PeopleIcon />
      </IconButton>
      <Typography
        fontWeight="medium"
        sx={{ flex: 1, mx: 0.5, textAlign: "left" }}
      >
        Users
      </Typography>
      <Tooltip
        title="Add user"
        arrow
        placement="top"
        slotProps={{
          tooltip: {
            sx: {
              fontSize: "0.75rem",
            },
          },
        }}
      >
        <IconButton id="add-user-button" color="primary" onClick={onAddUser}>
          <GroupAddIcon fontSize="small" />
        </IconButton>
      </Tooltip>

      <Tooltip title="Columns" placement="top" arrow>
        <ColumnsPanelTrigger render={<ToolbarButton />}>
          <ViewColumnIcon fontSize="small" />
        </ColumnsPanelTrigger>
      </Tooltip>

      <Tooltip title="Filters" placement="top" arrow>
        <FilterPanelTrigger
          render={(props, state) => (
            <ToolbarButton {...props} color="default">
              <Badge
                badgeContent={state.filterCount}
                color="primary"
                variant="dot"
              >
                <FilterListIcon fontSize="small" />
              </Badge>
            </ToolbarButton>
          )}
        />
      </Tooltip>

      <Divider
        orientation="vertical"
        variant="middle"
        flexItem
        sx={{ mx: 0.5 }}
      />

      <Tooltip title="Export" placement="top" arrow>
        <ToolbarButton
          id="export-menu-trigger"
          aria-controls="export-menu"
          aria-haspopup="true"
          aria-expanded={exportMenuOpen ? "true" : undefined}
          onClick={(event) => setExportAnchorEl(event.currentTarget)}
        >
          <FileDownloadIcon fontSize="small" />
        </ToolbarButton>
      </Tooltip>

        <Menu
        id="export-menu"
        anchorEl={exportAnchorEl}
        open={exportMenuOpen}
        onClose={() => setExportAnchorEl(null)}
        anchorOrigin={{ vertical: "bottom", horizontal: "right" }}
        transformOrigin={{ vertical: "top", horizontal: "right" }}
        slotProps={{
          list: {
            "aria-labelledby": "export-menu-trigger",
          },
        }}
      >
        <ExportPrint
          render={<MenuItem />}
          onClick={() => setExportAnchorEl(null)}
        >
          Print
        </ExportPrint>
        <ExportCsv
          render={<MenuItem />}
          onClick={() => setExportAnchorEl(null)}
        >
          Download as CSV
        </ExportCsv>
      </Menu>

      <StyledQuickFilter>
        <QuickFilterTrigger
          render={(triggerProps, state) => (
            <Tooltip title="Search" enterDelay={0} placement="top" arrow>
              <StyledToolbarButton
                {...triggerProps}
                ownerState={{ expanded: state.expanded }}
                color="default"
                aria-disabled={state.expanded}
              >
                <SearchIcon fontSize="small" />
              </StyledToolbarButton>
            </Tooltip>
          )}
        />
        <QuickFilterControl
          render={({ ref, ...controlProps }, state) => (
            <StyledTextField
              {...controlProps}
              ownerState={{ expanded: state.expanded }}
              inputRef={ref}
              aria-label="Search"
              placeholder="Search..."
              size="small"
              slotProps={{
                input: {
                  startAdornment: (
                    <InputAdornment position="start">
                      <SearchIcon fontSize="small" />
                    </InputAdornment>
                  ),
                  endAdornment: state.value ? (
                    <InputAdornment position="end">
                      <QuickFilterClear
                        edge="end"
                        size="small"
                        aria-label="Clear search"
                        material={{ sx: { marginRight: -0.75 } }}
                      >
                        <CancelIcon fontSize="small" />
                      </QuickFilterClear>
                    </InputAdornment>
                  ) : null,
                  ...controlProps.slotProps?.input,
                },
                ...controlProps.slotProps,
              }}
            />
          )}
        />
      </StyledQuickFilter>
    </Toolbar>
  );
}

export default function MuiDataGrid() {
  const [drawerOpen, setDrawerOpen] = React.useState(false);
  const [drawerMode, setDrawerMode] = React.useState<"add" | "edit">("add");
  const [selectedUser, setSelectedUser] = React.useState<UserRow | null>(null);
  const [rows, setRows] = React.useState(tableData);

  const handleOpenAdd = () => {
    setDrawerMode("add");
    setSelectedUser(null);
    setDrawerOpen(true);
  };

  const handleOpenEdit = (row: UserRow) => {
    setDrawerMode("edit");
    setSelectedUser(row);
    setDrawerOpen(true);
  };

  const handleDelete = (row: UserRow) => {
    setRows((prev) => prev.filter((item) => item.id !== row.id));
  };

  const handleClose = () => setDrawerOpen(false);

  const handleSubmit = (values: UserFormValues) => {
    if (drawerMode === "edit" && values.id != null) {
      setRows((prev) =>
        prev.map((row) => (row.id === values.id ? { ...row, ...values } : row)),
      );
    } else {
      const nextId = rows.length
        ? Math.max(...rows.map((row) => row.id)) + 1
        : 1;
      setRows((prev) => [...prev, { ...values, id: nextId }]);
    }
  };

  const rowNumberColumn: GridColDef<UserRow> = {
    field: "rowNumber",
    headerName: "No.",
    width: 72,
    sortable: false,
    filterable: false,
    disableColumnMenu: true,
    align: "center",
    headerAlign: "center",
    renderCell: (params: GridRenderCellParams<UserRow>) => params.api.getRowIndexRelativeToVisibleRows(params.id) + 1,
  };

  const enhancedColumns = [rowNumberColumn, ...columns.map((column) => {
    if (column.field !== "actions") {
      return column;
    }

    return {
      ...column,
      renderCell: (params: GridRenderCellParams<UserRow>) => (
        <ActionsMenu
          row={params.row}
          onEdit={handleOpenEdit}
          onDelete={handleDelete}
        />
      ),
    };
  })];

  const ToolbarWithAddUser = (toolbarProps: GridToolbarProps) => (
    <CustomToolbar {...toolbarProps} onAddUser={handleOpenAdd} />
  );

  return (
    <Box sx={{ height: 500, width: "100%" }}>
      <DataGrid
        rows={rows}
        columns={enhancedColumns}
        // ✅ Pagination
        initialState={{
          pagination: {
            paginationModel: { pageSize: 10, page: 0 },
          },
        }}
        pageSizeOptions={[5, 10, 20, 50]}
        // ✅ Sorting
        sortingOrder={["asc", "desc"]}
        // ✅ Search + tools
        slots={{ toolbar: ToolbarWithAddUser }}
        // ✅ Compact rows
        density="compact"
        // ✅ UX polish
        disableRowSelectionOnClick={false}
        checkboxSelection={false}
        showToolbar
        sx={(theme) => ({
          boxShadow: 2,
          border: 2,
          borderColor:
            theme.palette.mode === "dark"
              ? theme.palette.divider
              : alpha(theme.palette.primary.main, 0.32),
          backgroundColor: theme.palette.background.default,
          color: theme.palette.text.primary,
          "& .MuiDataGrid-virtualScroller": {
            backgroundColor: theme.palette.background.default,
          },
          "& .MuiDataGrid-columnHeaders": {
            backgroundColor:
              theme.palette.mode === "dark"
                ? theme.palette.background.paper
                : alpha(theme.palette.primary.main, 0.06),
            color: theme.palette.text.primary,
            borderBottom: `1px solid ${theme.palette.divider}`,
          },
          "& .MuiDataGrid-columnHeader": {
            color: theme.palette.text.primary,
          },
          "& .MuiDataGrid-cell": {
            color: theme.palette.text.primary,
            borderBottom: `1px solid ${theme.palette.divider}`,
          },
          "& .MuiDataGrid-cell:hover": {
            color: theme.palette.primary.main,
          },
          "& .MuiDataGrid-row": {
            backgroundColor:
              theme.palette.mode === "dark"
                ? theme.palette.background.paper
                : theme.palette.background.default,
          },
          "& .even": {
            backgroundColor:
              theme.palette.mode === "dark"
                ? alpha(theme.palette.background.paper, 0.95)
                : alpha(theme.palette.primary.main, 0.025),
          },
          "& .odd": {
            backgroundColor:
              theme.palette.mode === "dark"
                ? theme.palette.background.default
                : theme.palette.background.paper,
          },
          "& .MuiDataGrid-row:hover": {
            backgroundColor: theme.palette.action.hover,
          },
          "& .MuiDataGrid-footerContainer, & .MuiDataGrid-toolbarContainer": {
            backgroundColor: theme.palette.background.paper,
            color: theme.palette.text.primary,
            borderTop: `1px solid ${theme.palette.divider}`,
          },
          "& .MuiDataGrid-toolbarContainer .MuiButton-root, & .MuiDataGrid-toolbarContainer .MuiIconButton-root":
            {
              color: theme.palette.text.primary,
            },
        })}
        // ✅ Add row class
        getRowClassName={(params) =>
          params.indexRelativeToCurrentPage % 2 === 0 ? "even" : "odd"
        }
      />
      <FormRightPanel
        key={`users-panel-${drawerMode}-${selectedUser?.id ?? "new"}-${drawerOpen ? "open" : "closed"}`}
        open={drawerOpen}
        onClose={handleClose}
        title={drawerMode === "edit" ? "Edit User" : "Add New User"}
        initialData={selectedUser}
        onSubmit={handleSubmit}
      />
    </Box>
  );
}
const tableData: UserRow[] = [
  {
    id: 1,
    first_name: "Evaleen",
    last_name: "Hanhard",
    email: "ehanhard0@webeden.co.uk",
    gender: "Agender",
    ip_address: "72.171.8.178",
  },
  {
    id: 2,
    first_name: "Ripley",
    last_name: "Sustin",
    email: "rsustin1@exblog.jp",
    gender: "Male",
    ip_address: "137.239.208.84",
  },
  {
    id: 3,
    first_name: "Jay",
    last_name: "Gaiger",
    email: "jgaiger2@java.com",
    gender: "Male",
    ip_address: "221.177.249.253",
  },
  {
    id: 4,
    first_name: "Rebeca",
    last_name: "Anlay",
    email: "ranlay3@e-recht24.de",
    gender: "Female",
    ip_address: "115.178.50.199",
  },
  {
    id: 5,
    first_name: "Eddy",
    last_name: "Henfre",
    email: "ehenfre4@canalblog.com",
    gender: "Male",
    ip_address: "203.127.89.6",
  },
  {
    id: 6,
    first_name: "Elysha",
    last_name: "Willford",
    email: "ewillford5@artisteer.com",
    gender: "Female",
    ip_address: "80.206.97.230",
  },
  {
    id: 7,
    first_name: "Torr",
    last_name: "Bartholomew",
    email: "tbartholomew6@arizona.edu",
    gender: "Male",
    ip_address: "201.180.99.144",
  },
  {
    id: 8,
    first_name: "De",
    last_name: "Hawkyens",
    email: "dhawkyens7@gnu.org",
    gender: "Female",
    ip_address: "252.31.134.126",
  },
  {
    id: 9,
    first_name: "Keeley",
    last_name: "Branchflower",
    email: "kbranchflower8@behance.net",
    gender: "Female",
    ip_address: "53.66.220.78",
  },
  {
    id: 10,
    first_name: "Jasun",
    last_name: "Dowdam",
    email: "jdowdam9@loc.gov",
    gender: "Male",
    ip_address: "9.234.239.160",
  },
  {
    id: 11,
    first_name: "Gusty",
    last_name: "Tellenbrok",
    email: "gtellenbroka@typepad.com",
    gender: "Bigender",
    ip_address: "30.198.151.232",
  },
  {
    id: 12,
    first_name: "Hartley",
    last_name: "Janaud",
    email: "hjanaudb@businesswire.com",
    gender: "Male",
    ip_address: "134.150.37.49",
  },
  {
    id: 13,
    first_name: "Jo",
    last_name: "Figge",
    email: "jfiggec@bizjournals.com",
    gender: "Female",
    ip_address: "106.160.95.28",
  },
  {
    id: 14,
    first_name: "Cesare",
    last_name: "Littlefield",
    email: "clittlefieldd@artisteer.com",
    gender: "Male",
    ip_address: "158.119.254.2",
  },
  {
    id: 15,
    first_name: "Kean",
    last_name: "Durand",
    email: "kdurande@goodreads.com",
    gender: "Male",
    ip_address: "253.77.75.81",
  },
  {
    id: 16,
    first_name: "Lucio",
    last_name: "Durtnall",
    email: "ldurtnallf@fastcompany.com",
    gender: "Agender",
    ip_address: "138.35.5.100",
  },
  {
    id: 17,
    first_name: "Gerty",
    last_name: "Hubbocks",
    email: "ghubbocksg@sohu.com",
    gender: "Female",
    ip_address: "141.26.123.237",
  },
  {
    id: 18,
    first_name: "Adele",
    last_name: "Dart",
    email: "adarth@ftc.gov",
    gender: "Non-binary",
    ip_address: "140.191.121.96",
  },
  {
    id: 19,
    first_name: "Myrilla",
    last_name: "Casassa",
    email: "mcasassai@latimes.com",
    gender: "Genderqueer",
    ip_address: "105.142.98.177",
  },
  {
    id: 20,
    first_name: "Ronda",
    last_name: "Neem",
    email: "rneemj@businesswire.com",
    gender: "Female",
    ip_address: "205.202.158.184",
  },
  {
    id: 21,
    first_name: "Owen",
    last_name: "Eales",
    email: "oealesk@irs.gov",
    gender: "Male",
    ip_address: "125.195.175.124",
  },
  {
    id: 22,
    first_name: "Margret",
    last_name: "Lotwich",
    email: "mlotwichl@nature.com",
    gender: "Female",
    ip_address: "18.123.248.194",
  },
  {
    id: 23,
    first_name: "Mattie",
    last_name: "Hembling",
    email: "mhemblingm@privacy.gov.au",
    gender: "Female",
    ip_address: "245.31.57.10",
  },
  {
    id: 24,
    first_name: "Katerine",
    last_name: "Deguara",
    email: "kdeguaran@xing.com",
    gender: "Female",
    ip_address: "185.106.202.4",
  },
  {
    id: 25,
    first_name: "Camille",
    last_name: "Tonks",
    email: "ctonkso@flavors.me",
    gender: "Female",
    ip_address: "119.176.197.113",
  },
  {
    id: 26,
    first_name: "Henka",
    last_name: "Jovis",
    email: "hjovisp@hc360.com",
    gender: "Female",
    ip_address: "31.73.191.145",
  },
  {
    id: 27,
    first_name: "Ardith",
    last_name: "Thake",
    email: "athakeq@yolasite.com",
    gender: "Female",
    ip_address: "126.39.216.88",
  },
  {
    id: 28,
    first_name: "Alain",
    last_name: "Tiddeman",
    email: "atiddemanr@blogger.com",
    gender: "Male",
    ip_address: "89.66.228.147",
  },
  {
    id: 29,
    first_name: "Sabra",
    last_name: "Whitley",
    email: "swhitleys@opensource.org",
    gender: "Female",
    ip_address: "158.163.8.101",
  },
  {
    id: 30,
    first_name: "Bartie",
    last_name: "Lomasna",
    email: "blomasnat@miitbeian.gov.cn",
    gender: "Male",
    ip_address: "211.30.11.129",
  },
  {
    id: 31,
    first_name: "Nevsa",
    last_name: "Craiker",
    email: "ncraikeru@skyrock.com",
    gender: "Female",
    ip_address: "122.86.121.218",
  },
  {
    id: 32,
    first_name: "Benyamin",
    last_name: "Mussared",
    email: "bmussaredv@etsy.com",
    gender: "Male",
    ip_address: "251.80.217.101",
  },
  {
    id: 33,
    first_name: "Reilly",
    last_name: "Dargan",
    email: "rdarganw@bing.com",
    gender: "Polygender",
    ip_address: "255.184.136.247",
  },
  {
    id: 34,
    first_name: "Sela",
    last_name: "de'-Ancy Willis",
    email: "sdeancywillisx@freewebs.com",
    gender: "Female",
    ip_address: "145.142.131.38",
  },
  {
    id: 35,
    first_name: "Aimee",
    last_name: "Milington",
    email: "amilingtony@mit.edu",
    gender: "Female",
    ip_address: "112.189.145.246",
  },
  {
    id: 36,
    first_name: "Hendrik",
    last_name: "Goodyer",
    email: "hgoodyerz@ask.com",
    gender: "Male",
    ip_address: "57.243.116.254",
  },
  {
    id: 37,
    first_name: "Tabbie",
    last_name: "Regglar",
    email: "tregglar10@washington.edu",
    gender: "Female",
    ip_address: "248.117.197.5",
  },
  {
    id: 38,
    first_name: "Elmore",
    last_name: "Tomasino",
    email: "etomasino11@nsw.gov.au",
    gender: "Male",
    ip_address: "78.26.75.221",
  },
  {
    id: 39,
    first_name: "Gilbert",
    last_name: "Craigheid",
    email: "gcraigheid12@hud.gov",
    gender: "Male",
    ip_address: "157.85.104.71",
  },
  {
    id: 40,
    first_name: "Brewer",
    last_name: "Gaiter",
    email: "bgaiter13@hao123.com",
    gender: "Male",
    ip_address: "201.65.122.149",
  },
  {
    id: 41,
    first_name: "Farleigh",
    last_name: "Golborne",
    email: "fgolborne14@google.es",
    gender: "Male",
    ip_address: "113.221.35.230",
  },
  {
    id: 42,
    first_name: "Rosaleen",
    last_name: "Ballingal",
    email: "rballingal15@prnewswire.com",
    gender: "Female",
    ip_address: "28.214.37.37",
  },
  {
    id: 43,
    first_name: "Cornelius",
    last_name: "Masi",
    email: "cmasi16@arstechnica.com",
    gender: "Male",
    ip_address: "97.74.78.227",
  },
  {
    id: 44,
    first_name: "Tootsie",
    last_name: "Tarplee",
    email: "ttarplee17@princeton.edu",
    gender: "Female",
    ip_address: "34.101.124.242",
  },
  {
    id: 45,
    first_name: "Mannie",
    last_name: "Benedyktowicz",
    email: "mbenedyktowicz18@parallels.com",
    gender: "Male",
    ip_address: "7.218.192.202",
  },
  {
    id: 46,
    first_name: "Seumas",
    last_name: "Sharrem",
    email: "ssharrem19@goo.ne.jp",
    gender: "Male",
    ip_address: "1.87.122.171",
  },
  {
    id: 47,
    first_name: "Charisse",
    last_name: "Mercey",
    email: "cmercey1a@psu.edu",
    gender: "Female",
    ip_address: "146.227.142.89",
  },
  {
    id: 48,
    first_name: "Prentice",
    last_name: "Aldridge",
    email: "paldridge1b@biglobe.ne.jp",
    gender: "Male",
    ip_address: "200.198.77.22",
  },
  {
    id: 49,
    first_name: "Frederick",
    last_name: "Baynham",
    email: "fbaynham1c@jugem.jp",
    gender: "Male",
    ip_address: "183.209.29.87",
  },
  {
    id: 50,
    first_name: "Annice",
    last_name: "Edge",
    email: "aedge1d@virginia.edu",
    gender: "Female",
    ip_address: "156.157.109.175",
  },
  {
    id: 51,
    first_name: "Rubi",
    last_name: "Zollner",
    email: "rzollner1e@vinaora.com",
    gender: "Female",
    ip_address: "184.177.224.241",
  },
  {
    id: 52,
    first_name: "Felice",
    last_name: "Bousquet",
    email: "fbousquet1f@amazon.de",
    gender: "Male",
    ip_address: "28.164.205.127",
  },
  {
    id: 53,
    first_name: "Saba",
    last_name: "Pottage",
    email: "spottage1g@joomla.org",
    gender: "Female",
    ip_address: "145.24.242.144",
  },
  {
    id: 54,
    first_name: "Anastassia",
    last_name: "Danovich",
    email: "adanovich1h@indiatimes.com",
    gender: "Female",
    ip_address: "200.9.154.61",
  },
  {
    id: 55,
    first_name: "Fleurette",
    last_name: "Cancelier",
    email: "fcancelier1i@merriam-webster.com",
    gender: "Female",
    ip_address: "27.246.70.160",
  },
  {
    id: 56,
    first_name: "Wandis",
    last_name: "Jenteau",
    email: "wjenteau1j@mysql.com",
    gender: "Female",
    ip_address: "218.57.81.215",
  },
  {
    id: 57,
    first_name: "Pearla",
    last_name: "Lawrie",
    email: "plawrie1k@freewebs.com",
    gender: "Female",
    ip_address: "73.141.145.192",
  },
  {
    id: 58,
    first_name: "Adham",
    last_name: "Hantusch",
    email: "ahantusch1l@nationalgeographic.com",
    gender: "Male",
    ip_address: "224.139.149.65",
  },
  {
    id: 59,
    first_name: "Cobby",
    last_name: "Plummer",
    email: "cplummer1m@a8.net",
    gender: "Male",
    ip_address: "174.142.34.246",
  },
  {
    id: 60,
    first_name: "Egon",
    last_name: "Halgarth",
    email: "ehalgarth1n@whitehouse.gov",
    gender: "Male",
    ip_address: "96.231.126.224",
  },
  {
    id: 61,
    first_name: "Jillane",
    last_name: "Bogie",
    email: "jbogie1o@vinaora.com",
    gender: "Female",
    ip_address: "74.201.79.35",
  },
  {
    id: 62,
    first_name: "Northrop",
    last_name: "Simmans",
    email: "nsimmans1p@squidoo.com",
    gender: "Male",
    ip_address: "36.23.243.17",
  },
  {
    id: 63,
    first_name: "Karmen",
    last_name: "Starsmeare",
    email: "kstarsmeare1q@ftc.gov",
    gender: "Female",
    ip_address: "214.214.71.185",
  },
  {
    id: 64,
    first_name: "Felice",
    last_name: "Purser",
    email: "fpurser1r@about.com",
    gender: "Male",
    ip_address: "115.198.53.236",
  },
  {
    id: 65,
    first_name: "Chicky",
    last_name: "Tock",
    email: "ctock1s@hostgator.com",
    gender: "Male",
    ip_address: "110.191.61.192",
  },
  {
    id: 66,
    first_name: "Neron",
    last_name: "Shekle",
    email: "nshekle1t@biblegateway.com",
    gender: "Male",
    ip_address: "12.219.82.252",
  },
  {
    id: 67,
    first_name: "Freeland",
    last_name: "Durdy",
    email: "fdurdy1u@prnewswire.com",
    gender: "Male",
    ip_address: "158.67.75.55",
  },
  {
    id: 68,
    first_name: "Kenn",
    last_name: "Osmond",
    email: "kosmond1v@histats.com",
    gender: "Male",
    ip_address: "85.49.104.91",
  },
  {
    id: 69,
    first_name: "Marge",
    last_name: "Easton",
    email: "measton1w@list-manage.com",
    gender: "Female",
    ip_address: "216.250.21.83",
  },
  {
    id: 70,
    first_name: "Dawna",
    last_name: "Dillistone",
    email: "ddillistone1x@alibaba.com",
    gender: "Female",
    ip_address: "52.79.72.216",
  },
  {
    id: 71,
    first_name: "Early",
    last_name: "Kalker",
    email: "ekalker1y@cyberchimps.com",
    gender: "Male",
    ip_address: "167.158.102.11",
  },
  {
    id: 72,
    first_name: "Chance",
    last_name: "Demelt",
    email: "cdemelt1z@harvard.edu",
    gender: "Male",
    ip_address: "47.234.243.103",
  },
  {
    id: 73,
    first_name: "Idette",
    last_name: "Siss",
    email: "isiss20@seesaa.net",
    gender: "Female",
    ip_address: "145.133.159.189",
  },
  {
    id: 74,
    first_name: "Codi",
    last_name: "Domenget",
    email: "cdomenget21@bloglovin.com",
    gender: "Male",
    ip_address: "158.112.110.112",
  },
  {
    id: 75,
    first_name: "Shalne",
    last_name: "Jindra",
    email: "sjindra22@arstechnica.com",
    gender: "Female",
    ip_address: "63.29.63.152",
  },
  {
    id: 76,
    first_name: "Humfried",
    last_name: "Donwell",
    email: "hdonwell23@goodreads.com",
    gender: "Male",
    ip_address: "233.30.2.87",
  },
  {
    id: 77,
    first_name: "Melany",
    last_name: "Chastelain",
    email: "mchastelain24@nationalgeographic.com",
    gender: "Female",
    ip_address: "141.87.187.231",
  },
  {
    id: 78,
    first_name: "Ariella",
    last_name: "Episcopi",
    email: "aepiscopi25@ask.com",
    gender: "Female",
    ip_address: "108.27.189.238",
  },
  {
    id: 79,
    first_name: "Roger",
    last_name: "Peverell",
    email: "rpeverell26@bluehost.com",
    gender: "Male",
    ip_address: "36.218.31.112",
  },
  {
    id: 80,
    first_name: "Barth",
    last_name: "Minichillo",
    email: "bminichillo27@ow.ly",
    gender: "Male",
    ip_address: "33.96.184.189",
  },
  {
    id: 81,
    first_name: "Stirling",
    last_name: "Gravet",
    email: "sgravet28@uol.com.br",
    gender: "Male",
    ip_address: "100.234.219.225",
  },
  {
    id: 82,
    first_name: "Tessie",
    last_name: "Ismail",
    email: "tismail29@etsy.com",
    gender: "Female",
    ip_address: "244.26.131.27",
  },
  {
    id: 83,
    first_name: "Cesaro",
    last_name: "Le Provest",
    email: "cleprovest2a@yandex.ru",
    gender: "Polygender",
    ip_address: "122.21.134.147",
  },
  {
    id: 84,
    first_name: "Jorey",
    last_name: "Cantillon",
    email: "jcantillon2b@comcast.net",
    gender: "Female",
    ip_address: "19.86.38.145",
  },
  {
    id: 85,
    first_name: "Cissiee",
    last_name: "Overland",
    email: "coverland2c@alexa.com",
    gender: "Female",
    ip_address: "154.138.103.245",
  },
  {
    id: 86,
    first_name: "Wayne",
    last_name: "Alexsandrov",
    email: "walexsandrov2d@skype.com",
    gender: "Agender",
    ip_address: "98.245.192.136",
  },
  {
    id: 87,
    first_name: "Paquito",
    last_name: "Waple",
    email: "pwaple2e@ning.com",
    gender: "Male",
    ip_address: "103.69.79.208",
  },
  {
    id: 88,
    first_name: "Lenora",
    last_name: "Blindmann",
    email: "lblindmann2f@apple.com",
    gender: "Female",
    ip_address: "71.192.2.116",
  },
  {
    id: 89,
    first_name: "Sondra",
    last_name: "Exall",
    email: "sexall2g@ustream.tv",
    gender: "Female",
    ip_address: "93.163.183.13",
  },
  {
    id: 90,
    first_name: "Mara",
    last_name: "Stanyland",
    email: "mstanyland2h@multiply.com",
    gender: "Female",
    ip_address: "244.138.113.237",
  },
  {
    id: 91,
    first_name: "Tonnie",
    last_name: "Agglio",
    email: "tagglio2i@huffingtonpost.com",
    gender: "Male",
    ip_address: "101.43.241.142",
  },
  {
    id: 92,
    first_name: "Roselin",
    last_name: "Kirsz",
    email: "rkirsz2j@multiply.com",
    gender: "Female",
    ip_address: "39.33.26.154",
  },
  {
    id: 93,
    first_name: "Desiri",
    last_name: "Butcher",
    email: "dbutcher2k@nih.gov",
    gender: "Female",
    ip_address: "185.59.204.35",
  },
  {
    id: 94,
    first_name: "Oliver",
    last_name: "Kobpa",
    email: "okobpa2l@nbcnews.com",
    gender: "Male",
    ip_address: "126.246.166.90",
  },
  {
    id: 95,
    first_name: "Sammy",
    last_name: "Cochrane",
    email: "scochrane2m@apple.com",
    gender: "Female",
    ip_address: "33.165.99.166",
  },
  {
    id: 96,
    first_name: "Milo",
    last_name: "Kunc",
    email: "mkunc2n@nsw.gov.au",
    gender: "Male",
    ip_address: "25.144.255.215",
  },
  {
    id: 97,
    first_name: "Benoit",
    last_name: "Watling",
    email: "bwatling2o@deviantart.com",
    gender: "Male",
    ip_address: "52.56.233.231",
  },
  {
    id: 98,
    first_name: "Claiborne",
    last_name: "Loker",
    email: "cloker2p@reference.com",
    gender: "Male",
    ip_address: "104.254.143.91",
  },
  {
    id: 99,
    first_name: "Aili",
    last_name: "Taggerty",
    email: "ataggerty2q@ted.com",
    gender: "Female",
    ip_address: "113.234.143.138",
  },
  {
    id: 100,
    first_name: "Addi",
    last_name: "Marrion",
    email: "amarrion2r@pen.io",
    gender: "Female",
    ip_address: "79.140.100.40",
  },
];
