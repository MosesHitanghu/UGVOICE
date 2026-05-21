import { useState } from "react";
import FormRightPanel from "../components/FormRightPanel";
import { Button } from "@mui/material";

const MenuAbout = () => {
  type UserFormValues = {
    id?: number;
    first_name: string;
    last_name: string;
    email: string;
    gender: string;
    ip_address: string;
  };

  // 1. Create the state to track if drawer is open
  const [drawerOpen, setDrawerOpen] = useState(false);

  // 2. Simple functions to toggle state
  const handleOpen = () => setDrawerOpen(true);
  const handleClose = () => setDrawerOpen(false);

  const handleSubmit = (values: UserFormValues) => {
    console.log("MenuAbout form submit:", values);
  };

  return (
    <>
      <div style={{ padding: "20px" }}>
        {/* 3. Trigger the drawer */}
        <Button variant="contained" onClick={handleOpen}>
          Open Form Panel
        </Button>

        {/* 4. Pass the state and close function to your component */}
        <FormRightPanel
          key={`about-panel-${drawerOpen ? "open" : "closed"}`}
          open={drawerOpen}
          onClose={handleClose}
          onSubmit={handleSubmit}
        />
      </div>
    </>
  );
};

export default MenuAbout;
