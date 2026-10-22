import React from "react";
import { LogOut } from "lucide-react";

const LogoutButton = ({ onLogout, loading = false }) => {
  return (
    <button
      onClick={onLogout}
      disabled={loading}
      className="btn btn-ghost btn-sm hover:text-bad"
    >
      <LogOut size={15} />
      {loading ? "Logging out..." : "Logout"}
    </button>
  );
};

export default LogoutButton;
