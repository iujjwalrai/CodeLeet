import React from "react";
import { LogOut } from "lucide-react";

const LogoutButton = ({ onLogout, loading = false }) => {
  return (
    <button
      onClick={onLogout}
      disabled={loading}
      className="
        group flex items-center gap-2
        rounded-xl px-5 py-2.5
        bg-gradient-to-r from-red-500 to-rose-600
        text-white font-medium
        shadow-md shadow-red-500/30
        transition-all duration-200
        hover:scale-[1.03] hover:shadow-lg hover:shadow-red-500/40
        active:scale-95
        disabled:opacity-60 disabled:cursor-not-allowed
      "
    >
      <LogOut
        size={18}
        className="transition-transform duration-200 group-hover:translate-x-0.5"
     i
      />
      {loading ? "Logging out..." : "Logout"}
    </button>
  );
};

export default LogoutButton;
