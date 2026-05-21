import {
  alpha,
  styled,
  type CSSObject,
  type Theme,
  useTheme,
} from "@mui/material/styles";
import {
  Avatar,
  Box,
  Divider,
  IconButton,
  List,
  Tooltip,
  Typography,
} from "@mui/material";
import MuiDrawer from "@mui/material/Drawer";
import ListItem from "@mui/material/ListItem";
import ListItemButton from "@mui/material/ListItemButton";
import ListItemIcon from "@mui/material/ListItemIcon";
import ListItemText from "@mui/material/ListItemText";
import ChevronLeftIcon from "@mui/icons-material/ChevronLeft";
import HomeRoundedIcon from "@mui/icons-material/HomeRounded";
import InsightsRoundedIcon from "@mui/icons-material/InsightsRounded";
import LogoutIcon from "@mui/icons-material/Logout";
import PeopleAltRoundedIcon from "@mui/icons-material/PeopleAltRounded";
import SettingsRoundedIcon from "@mui/icons-material/SettingsRounded";
import { Outlet, useLocation, useNavigate } from "react-router-dom";

import { clearStoredUser, getStoredUser } from "../../lib/session";

const drawerWidth = 252;
const ANALYTICS_ROLES = new Set(["admin", "mp", "parliament", "constituency"]);

const openedMixin = (theme: Theme): CSSObject => ({
  width: drawerWidth,
  transition: theme.transitions.create("width", {
    easing: theme.transitions.easing.sharp,
    duration: theme.transitions.duration.enteringScreen,
  }),
  overflowX: "hidden",
});

const closedMixin = (theme: Theme): CSSObject => ({
  transition: theme.transitions.create("width", {
    easing: theme.transitions.easing.sharp,
    duration: theme.transitions.duration.leavingScreen,
  }),
  overflowX: "hidden",
  width: `calc(${theme.spacing(7)} + 1px)`,
  [theme.breakpoints.up("sm")]: {
    width: `calc(${theme.spacing(8)} + 1px)`,
  },
});

const DrawerHeader = styled("div")(({ theme }) => ({
  display: "flex",
  alignItems: "center",
  justifyContent: "flex-end",
  padding: theme.spacing(0, 1),
  ...theme.mixins.toolbar,
}));

type DrawerStyleProps = {
  open?: boolean;
};

const Drawer = styled(MuiDrawer, {
  shouldForwardProp: (prop) => prop !== "open",
})<DrawerStyleProps>(({ theme, open }) => ({
  width: drawerWidth,
  flexShrink: 0,
  whiteSpace: "nowrap",
  boxSizing: "border-box",
  ...(open && {
    ...openedMixin(theme),
    "& .MuiDrawer-paper": openedMixin(theme),
  }),
  ...(!open && {
    ...closedMixin(theme),
    "& .MuiDrawer-paper": closedMixin(theme),
  }),
}));

type Props = {
  open: boolean;
  setOpen: React.Dispatch<React.SetStateAction<boolean>>;
};

const SideList = ({
  open,
  setOpen,
}: Props) => {
  const theme = useTheme();
  const navigate = useNavigate();
  const location = useLocation();
  const isDark = theme.palette.mode === "dark";
  const currentUser = getStoredUser();
  const currentUserName =
    [currentUser?.fname, currentUser?.lname].filter(Boolean).join(" ") ||
    currentUser?.company_name ||
    currentUser?.username ||
    "UGVoice User";
  const currentUserRole = (currentUser?.role || "").trim().toLowerCase();
  const canUseAnalytics = ANALYTICS_ROLES.has(currentUserRole);
  const navItems = [
    { title: "Home", link: "/dashboard/feed", icon: <HomeRoundedIcon /> },
    ...(canUseAnalytics
      ? [{ title: "Analytics", link: "/dashboard/overview", icon: <InsightsRoundedIcon /> }]
      : []),
    { title: "People", link: "/dashboard/directory", icon: <PeopleAltRoundedIcon /> },
    { title: "Settings", link: "/dashboard/settings", icon: <SettingsRoundedIcon /> },
  ];

  return (
    <>
      <Drawer variant="permanent" open={open}>
        <DrawerHeader>
          <IconButton onClick={() => setOpen(false)} sx={{ color: "text.secondary" }}>
            <ChevronLeftIcon />
          </IconButton>
        </DrawerHeader>

        <Divider />

        <List>
          {navItems.map((item) => {
            const isActive = location.pathname === item.link;

            return (
              <Tooltip key={item.link} title={!open ? item.title : ""} placement="right" arrow>
                <ListItem disablePadding sx={{ display: "block" }}>
                  <ListItemButton
                    selected={isActive}
                    onClick={() => navigate(item.link)}
                    sx={{
                      minHeight: 52,
                      px: 2.5,
                      mx: 1,
                      my: 0.5,
                      borderRadius: 2.5,
                      justifyContent: open ? "initial" : "center",
                      color: isActive
                        ? theme.palette.text.primary
                        : theme.palette.text.secondary,
                      "&:hover": {
                        backgroundColor: theme.palette.action.hover,
                      },
                      "&.Mui-selected": {
                        backgroundColor: theme.palette.action.selected,
                        color: theme.palette.text.primary,
                        borderLeft: `4px solid ${theme.palette.primary.main}`,
                        boxShadow: `inset 0 0 0 1px ${alpha(theme.palette.primary.main, 0.14)}`,
                      },
                    }}
                  >
                    <ListItemIcon
                      sx={{
                        minWidth: 0,
                        justifyContent: "center",
                        mr: open ? 3 : "auto",
                        color: isActive
                          ? theme.palette.primary.main
                          : theme.palette.text.secondary,
                      }}
                    >
                      {item.icon}
                    </ListItemIcon>
                    <ListItemText primary={item.title} sx={{ opacity: open ? 1 : 0 }} />
                  </ListItemButton>
                </ListItem>
              </Tooltip>
            );
          })}
        </List>

        <Divider />

        <List sx={{ mt: "auto" }}>
          <Box sx={{ mx: "auto", p: 2, mt: 2 }}>
            <Tooltip title={currentUserName} placement="right" arrow>
              <Avatar
                sx={{
                  width: open ? 70 : 40,
                  height: open ? 70 : 40,
                  mx: "auto",
                  bgcolor: theme.palette.primary.main,
                  color: theme.palette.primary.contrastText,
                  boxShadow: `0 12px 24px ${alpha(theme.palette.primary.main, 0.22)}`,
                }}
              >
                {(currentUserName.charAt(0) || "U").toUpperCase()}
              </Avatar>
            </Tooltip>
          </Box>

          <Box sx={{ textAlign: "center", mb: 2 }}>
            {open && (
              <>
                <Typography variant="subtitle1">{currentUserName}</Typography>
                <Typography variant="body2" color="text.secondary">
                  {currentUser?.role || "standard"}
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  {currentUser?.email}
                </Typography>
              </>
            )}

            <Tooltip title="Logout" placement="right" arrow>
              <IconButton
                color="inherit"
                sx={{
                  mt: 1,
                  color: theme.palette.text.secondary,
                  "&:hover": {
                    color: theme.palette.primary.main,
                    backgroundColor: theme.palette.action.hover,
                  },
                }}
                onClick={() => {
                  clearStoredUser();
                  navigate("/");
                }}
                size="small"
              >
                <LogoutIcon />
              </IconButton>
            </Tooltip>
          </Box>
        </List>
      </Drawer>

      <Box
        component="main"
        sx={{
          flexGrow: 1,
          px: 3,
          pt: 3,
          pb: 2,
          display: "flex",
          flexDirection: "column",
          bgcolor: theme.palette.background.default,
          backgroundImage: isDark
            ? `linear-gradient(180deg, ${alpha(theme.palette.secondary.dark, 0.22)}, ${alpha(theme.palette.common.black, 0.98)})`
            : `linear-gradient(180deg, #FFFFFF 0%, ${alpha(theme.palette.warning.main, 0.11)} 52%, ${alpha(theme.palette.secondary.main, 0.08)} 100%)`,
          minHeight: "100vh",
        }}
      >
        <DrawerHeader />
        <Box sx={{ flex: 1 }}>
          <Outlet />
        </Box>
        <Box
          component="footer"
          sx={{
            mt: 4,
            p: 2,
            bgcolor: "#000000",
            borderTop: `4px solid ${theme.palette.primary.main}`,
            display: "flex",
            flexDirection: { xs: "column", sm: "row" },
            justifyContent: "space-between",
            gap: 1,
            color: "#FFFFFF",
          }}
        >
          <Typography variant="body2">UGVoice Analytics Workspace</Typography>
          <Typography variant="body2">
            (c) {new Date().getFullYear()} UGVoice. Built for feedback operations.
          </Typography>
        </Box>
      </Box>
    </>
  );
};

export default SideList;
