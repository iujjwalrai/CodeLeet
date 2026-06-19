import React, { useState, useEffect } from "react";
import {
  TrendingUp,
  Code,
  Brain,
  GitBranch,
  Clock,
  Edit2,
  ArrowRight,
  X,
  Terminal,
  Check,
  XCircle,
} from "lucide-react";
import { useNavigate } from "react-router-dom";
import axios from "../api/axios";
import LogoutButton from "../components/Logout";
import { useAuth } from "../context/AuthContext";

/* ────────────────────────────────────────────────────────────
   Design notes (dark-only, terminal/editor inspired):
   - bg      #0D1117  app background
   - surface #12161C  panel fill
   - line    #21262D  hairline borders
   - text    #E6EDF3  primary text
   - muted   #6E7681  secondary text
   - accent  #58A6FF  links / focal accents (used sparingly)
   - ok      #3FB950  accepted / positive
   - bad     #F85149  failed / negative
   - warn    #D29922  medium difficulty
   Monospace (font-mono) is used for anything that is data: stats,
   status, difficulty, dates, usernames — the way a code editor
   gutter or a terminal would render it. Inter (default sans)
   carries prose: names, bios, headings.
   ──────────────────────────────────────────────────────────── */

const DashboardPage = () => {
  const [isEditOpen, setIsEditOpen] = useState(false);
  const [editForm, setEditForm] = useState(null);
  const [userData, setUserData] = useState({});
  const [heatmapData, setHeatmapData] = useState([]);
  const [recentSubmissions, setRecentSubmissions] = useState([]);
  const { setUser } = useAuth();
  const navigate = useNavigate();

  const getUserData = async () => {
    try {
      const response = await axios.get("/api/auth/me");
      setUserData(response.data.user);
    } catch (error) {
      console.error("Failed to load user");
    }
  };

  useEffect(() => {
    getUserData();
  }, []);

  const handleLogout = async () => {
    const response = await axios.post("/api/auth/logout");
    if (response.data.success) {
      setUser(null);
      navigate("/login");
    } else {
      console.log(response.data.message);
    }
  };

  useEffect(() => {
    const fetchRecentSubmissions = async () => {
      try {
        const res = await axios.get("/api/auth/me/recent");
        setRecentSubmissions(res.data.submissions);
      } catch (err) {
        console.error("Failed to fetch recent submissions");
      }
    };

    fetchRecentSubmissions();
  }, []);

  useEffect(() => {
    const fetchHeatmap = async () => {
      try {
        const res = await axios.get("/api/auth/me/heatmap");
        setHeatmapData(res.data.heatmap);
      } catch (err) {
        console.error("Failed to load heatmap");
      }
    };

    fetchHeatmap();
  }, []);

  const timeAgo = (date) => {
    const diff = Math.floor((Date.now() - new Date(date)) / 1000);
    if (diff < 60) return `${diff}s`;
    if (diff < 3600) return `${Math.floor(diff / 60)}m`;
    if (diff < 86400) return `${Math.floor(diff / 3600)}h`;
    return `${Math.floor(diff / 86400)}d`;
  };

  const getHeatmapColor = (count) => {
    if (count === 0) return "bg-[#161B22] border border-[#21262D]";
    if (count <= 2) return "bg-[#0E4429]";
    if (count <= 4) return "bg-[#006D32]";
    if (count <= 6) return "bg-[#26A641]";
    return "bg-[#39D353]";
  };

  /* ---------------------------- Edit modal ---------------------------- */

  const EditProfileModal = ({ data, onClose, onSave }) => {
    const [form, setForm] = useState({
      fullName: data.fullName || "",
      username: data.username || "",
      bio: data.bio || "",
      education: data.education || "",
      location: data.location || "",
      preferences: {
        theme: data.preferences?.theme || "dark",
        defaultLanguage: data.preferences?.defaultLanguage || "javascript",
        editorTheme: data.preferences?.editorTheme || "vs-dark",
      },
    });

    const handleChange = (field, value) => {
      setForm((prev) => ({ ...prev, [field]: value }));
    };

    const handlePrefChange = (field, value) => {
      setForm((prev) => ({
        ...prev,
        preferences: { ...prev.preferences, [field]: value },
      }));
    };

    const handleSubmit = async () => {
      try {
        const res = await axios.patch("/api/users/me", form);
        onSave(res.data.user);
      } catch (err) {
        console.error("Profile update failed");
      }
    };

    const fieldClass =
      "w-full bg-[#0D1117] border border-[#21262D] rounded-md px-3 py-2 text-sm text-[#E6EDF3] placeholder-[#6E7681] focus:outline-none focus:border-[#58A6FF] transition-colors";

    return (
      <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 px-4">
        <div className="bg-[#161B22] border border-[#21262D] w-full max-w-lg rounded-lg overflow-hidden">
          {/* title bar, echoes an editor tab */}
          <div className="flex items-center justify-between px-4 py-3 border-b border-[#21262D] bg-[#0D1117]">
            <div className="flex items-center gap-2 font-mono text-xs text-[#6E7681]">
              <span className="w-2.5 h-2.5 rounded-full bg-[#F85149]/70" />
              <span className="w-2.5 h-2.5 rounded-full bg-[#D29922]/70" />
              <span className="w-2.5 h-2.5 rounded-full bg-[#3FB950]/70" />
              <span className="ml-2">edit_profile.json</span>
            </div>
            <button
              onClick={onClose}
              className="text-[#6E7681] hover:text-[#E6EDF3] transition-colors"
              aria-label="Close"
            >
              <X size={16} />
            </button>
          </div>

          <div className="p-5 space-y-3">
            <label className="block">
              <span className="block font-mono text-[11px] uppercase tracking-wide text-[#6E7681] mb-1">
                full_name
              </span>
              <input
                value={form.fullName}
                onChange={(e) => handleChange("fullName", e.target.value)}
                placeholder="Full name"
                className={fieldClass}
              />
            </label>

            <label className="block">
              <span className="block font-mono text-[11px] uppercase tracking-wide text-[#6E7681] mb-1">
                username
              </span>
              <input
                value={form.username}
                onChange={(e) => handleChange("username", e.target.value)}
                placeholder="Username"
                className={fieldClass}
              />
            </label>

            <label className="block">
              <span className="block font-mono text-[11px] uppercase tracking-wide text-[#6E7681] mb-1">
                bio
              </span>
              <textarea
                value={form.bio}
                onChange={(e) => handleChange("bio", e.target.value)}
                placeholder="A short bio"
                rows={3}
                className={fieldClass}
              />
            </label>

            <div className="grid grid-cols-2 gap-3">
              <label className="block">
                <span className="block font-mono text-[11px] uppercase tracking-wide text-[#6E7681] mb-1">
                  education
                </span>
                <input
                  value={form.education}
                  onChange={(e) => handleChange("education", e.target.value)}
                  placeholder="School"
                  className={fieldClass}
                />
              </label>

              <label className="block">
                <span className="block font-mono text-[11px] uppercase tracking-wide text-[#6E7681] mb-1">
                  location
                </span>
                <input
                  value={form.location}
                  onChange={(e) => handleChange("location", e.target.value)}
                  placeholder="Location"
                  className={fieldClass}
                />
              </label>
            </div>

            <div className="grid grid-cols-3 gap-3 pt-1">
              <label className="block">
                <span className="block font-mono text-[11px] uppercase tracking-wide text-[#6E7681] mb-1">
                  theme
                </span>
                <select
                  value={form.preferences.theme}
                  onChange={(e) => handlePrefChange("theme", e.target.value)}
                  className={fieldClass}
                >
                  <option value="dark">Dark</option>
                  <option value="light">Light</option>
                </select>
              </label>

              <label className="block">
                <span className="block font-mono text-[11px] uppercase tracking-wide text-[#6E7681] mb-1">
                  language
                </span>
                <select
                  value={form.preferences.defaultLanguage}
                  onChange={(e) => handlePrefChange("defaultLanguage", e.target.value)}
                  className={fieldClass}
                >
                  <option value="javascript">JavaScript</option>
                  <option value="cpp">C++</option>
                  <option value="python">Python</option>
                </select>
              </label>

              <label className="block">
                <span className="block font-mono text-[11px] uppercase tracking-wide text-[#6E7681] mb-1">
                  editor
                </span>
                <select
                  value={form.preferences.editorTheme}
                  onChange={(e) => handlePrefChange("editorTheme", e.target.value)}
                  className={fieldClass}
                >
                  <option value="vs-dark">VS Dark</option>
                  <option value="monokai">Monokai</option>
                </select>
              </label>
            </div>

            <button
              onClick={handleSubmit}
              className="w-full bg-[#238636] hover:bg-[#2EA043] text-white text-sm font-medium py-2.5 rounded-md transition-colors mt-2"
            >
              Save changes
            </button>
          </div>
        </div>
      </div>
    );
  };

  /* ---------------------------- User card ---------------------------- */

  const UserCard = () => {
    if (!userData) return null;

    const initials = userData.fullName
      ?.split(" ")
      .map((n) => n[0])
      .join("")
      .toUpperCase();

    return (
      <>
        <div className="bg-[#12161C] border border-[#21262D] rounded-lg overflow-hidden">
          <div className="flex items-center justify-between px-4 py-2.5 border-b border-[#21262D]">
            <span className="font-mono text-[11px] uppercase tracking-wide text-[#6E7681]">
              profile
            </span>
            <button
              onClick={() => {
                setEditForm(userData);
                setIsEditOpen(true);
              }}
              className="text-[#6E7681] hover:text-[#E6EDF3] transition-colors"
              aria-label="Edit profile"
            >
              <Edit2 size={14} />
            </button>
          </div>

          <div className="p-5">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-12 h-12 rounded-md bg-[#0D1117] border border-[#21262D] flex items-center justify-center font-mono text-sm font-semibold text-[#58A6FF]">
                {initials}
              </div>
              <div>
                <h3 className="text-base font-semibold text-[#E6EDF3] leading-tight">
                  {userData.fullName}
                </h3>
                <p className="font-mono text-xs text-[#6E7681]">@{userData.username}</p>
              </div>
            </div>

            <p className="text-sm text-[#8B949E] leading-relaxed mb-4">
              {userData.bio || "No bio added yet."}
            </p>

            <div className="space-y-1.5 pt-3 border-t border-[#21262D] font-mono text-xs text-[#6E7681]">
              {userData.education && <div>school  · {userData.education}</div>}
              {userData.location && <div>based   · {userData.location}</div>}
              {userData.createdAt && (
                <div>joined  · {new Date(userData.createdAt).toLocaleDateString()}</div>
              )}
            </div>
          </div>
        </div>

        {isEditOpen && (
          <EditProfileModal
            data={editForm}
            onClose={() => setIsEditOpen(false)}
            onSave={(updatedUser) => {
              setUserData(updatedUser);
              setIsEditOpen(false);
            }}
          />
        )}
      </>
    );
  };

  /* ---------------------------- Stats card ---------------------------- */

  const StatsCard = () => {
    if (!userData?.stats) return null;

    const {
      problemsSolved = 0,
      dailyStreak = 0,
      acceptanceRate = 0,
      contestsParticipated = 0,
    } = userData.stats;

    const rows = [
      { label: "solved", value: problemsSolved, color: "text-[#3FB950]" },
      { label: "streak", value: `${dailyStreak}d`, color: "text-[#D29922]" },
      { label: "accept_rate", value: `${acceptanceRate.toFixed(1)}%`, color: "text-[#58A6FF]" },
      { label: "contests", value: contestsParticipated, color: "text-[#E6EDF3]" },
    ];

    return (
      <div className="bg-[#12161C] border border-[#21262D] rounded-lg overflow-hidden">
        <div className="flex items-center gap-2 px-4 py-2.5 border-b border-[#21262D]">
          <TrendingUp size={13} className="text-[#6E7681]" />
          <span className="font-mono text-[11px] uppercase tracking-wide text-[#6E7681]">
            stats
          </span>
        </div>

        <div className="p-5 space-y-3">
          {rows.map((row) => (
            <div key={row.label} className="flex justify-between items-baseline font-mono text-sm">
              <span className="text-[#6E7681]">{row.label}</span>
              <span className={`font-semibold text-lg ${row.color}`}>{row.value}</span>
            </div>
          ))}
        </div>
      </div>
    );
  };

  /* ------------------------ Problem category card ------------------------ */

  const ProblemCategoryCard = ({ title, problems, icon: Icon, accent }) => (
    <button
      className="text-left bg-[#12161C] border border-[#21262D] rounded-lg p-4 hover:border-[#30363D] hover:bg-[#161B22] transition-colors group"
    >
      <div className="flex items-center justify-between mb-3">
        <Icon size={18} style={{ color: accent }} />
        <span className="font-mono text-xs text-[#6E7681]">{String(problems).padStart(2, "0")}</span>
      </div>
      <h3 className="text-sm font-medium text-[#E6EDF3]">{title}</h3>
    </button>
  );

  /* ---------------------------- Heatmap ---------------------------- */

  const SubmissionHeatmap = () => {
    const [hoveredDay, setHoveredDay] = useState(null);

    if (heatmapData.length === 0) return null;

    const columns = [];
    for (let i = 0; i < 12; i++) {
      columns.push(heatmapData.slice(i * 7, (i + 1) * 7));
    }

    return (
      <div className="bg-[#12161C] border border-[#21262D] rounded-lg overflow-hidden">
        <div className="flex items-center gap-2 px-4 py-2.5 border-b border-[#21262D]">
          <span className="font-mono text-[11px] uppercase tracking-wide text-[#6E7681]">
            activity
          </span>
        </div>

        <div className="p-5">
          <div className="relative">
            <div className="flex gap-[3px]">
              {columns.map((week, wi) => (
                <div key={wi} className="flex flex-col gap-[3px] items-center">
                  {week.map((day, di) => (
                    <div
                      key={di}
                      className={`w-[10px] h-[10px] rounded-[2px] ${getHeatmapColor(
                        day.count
                      )} cursor-pointer transition-transform hover:scale-125`}
                      onMouseEnter={() => setHoveredDay(day)}
                      onMouseLeave={() => setHoveredDay(null)}
                    />
                  ))}
                  <span className="font-mono text-[8px] mt-1 text-[#6E7681]">
                    {week[6] &&
                      new Date(week[6].date).toLocaleDateString("en-US", {
                        month: "short",
                      })}
                  </span>
                </div>
              ))}
            </div>

            {hoveredDay && (
              <div className="absolute top-0 left-1/2 -translate-x-1/2 -translate-y-9 bg-[#1C2128] border border-[#30363D] rounded-md px-3 py-1.5 font-mono text-[11px] shadow-lg whitespace-nowrap z-10">
                <p className="font-semibold text-[#E6EDF3]">{hoveredDay.count} submissions</p>
                <p className="text-[#6E7681]">{new Date(hoveredDay.date).toLocaleDateString()}</p>
              </div>
            )}
          </div>

          <div className="flex items-center gap-1.5 mt-4 font-mono text-[10px] text-[#6E7681]">
            <span>less</span>
            {["bg-[#161B22] border border-[#21262D]", "bg-[#0E4429]", "bg-[#006D32]", "bg-[#26A641]", "bg-[#39D353]"].map(
              (c, i) => (
                <span key={i} className={`w-[10px] h-[10px] rounded-[2px] ${c}`} />
              )
            )}
            <span>more</span>
          </div>
        </div>
      </div>
    );
  };

  /* ------------------------ Recent submissions ------------------------ */

  const RecentSubmissionCard = () => (
    <div className="bg-[#12161C] border border-[#21262D] rounded-lg overflow-hidden">
      <div className="flex items-center gap-2 px-4 py-2.5 border-b border-[#21262D]">
        <Clock size={13} className="text-[#6E7681]" />
        <span className="font-mono text-[11px] uppercase tracking-wide text-[#6E7681]">
          recent_submissions
        </span>
      </div>

      <div className="divide-y divide-[#21262D]">
        {recentSubmissions.length === 0 && (
          <p className="text-sm text-[#6E7681] px-4 py-4">No submissions yet.</p>
        )}

        {recentSubmissions.map((sub) => {
          const accepted = sub.status === "accepted";
          const difficultyColor =
            sub.problem?.difficulty === "Easy"
              ? "text-[#3FB950]"
              : sub.problem?.difficulty === "Medium"
              ? "text-[#D29922]"
              : "text-[#F85149]";

          return (
            <div
              key={sub._id}
              className="flex items-start gap-3 px-4 py-3 hover:bg-[#161B22] transition-colors"
            >
              {accepted ? (
                <Check size={14} className="text-[#3FB950] mt-0.5 shrink-0" />
              ) : (
                <XCircle size={14} className="text-[#F85149] mt-0.5 shrink-0" />
              )}

              <div className="flex-1 min-w-0">
                <div className="flex items-baseline justify-between gap-2">
                  <h4 className="text-sm text-[#E6EDF3] truncate">{sub.problem?.title}</h4>
                  <span className="font-mono text-[10px] text-[#6E7681] shrink-0">
                    {timeAgo(sub.createdAt)}
                  </span>
                </div>
                <div className="flex items-center gap-2 mt-0.5">
                  <span className={`font-mono text-[10px] ${difficultyColor}`}>
                    {sub.problem?.difficulty}
                  </span>
                  <span className="font-mono text-[10px] text-[#6E7681]">
                    {sub.status.replace("_", " ")}
                  </span>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );

  /* ---------------------------- CTA card ---------------------------- */

  const ProblemsLinkCard = () => (
    <button
      onClick={() => navigate("/problems")}
      className="w-full text-left bg-[#12161C] border border-[#21262D] hover:border-[#3FB950]/40 rounded-lg px-5 py-4 flex items-center justify-between transition-colors group"
    >
      <div className="flex items-center gap-3">
        <Terminal size={18} className="text-[#3FB950]" />
        <div>
          <h3 className="text-sm font-semibold text-[#E6EDF3]">Solve problems</h3>
          <p className="text-xs text-[#6E7681]">Jump back into practice</p>
        </div>
      </div>
      <ArrowRight
        size={16}
        className="text-[#6E7681] group-hover:text-[#3FB950] group-hover:translate-x-1 transition-all"
      />
    </button>
  );

  /* ---------------------------- Page ---------------------------- */

  return (
    <div className="min-h-screen bg-[#0D1117] text-[#E6EDF3] font-sans">
      <div className="max-w-7xl mx-auto px-6 py-8">
        {/* Header */}
        <div className="flex justify-between items-center mb-8 pb-5 border-b border-[#21262D]">
          <div className="flex items-center gap-2.5">
            <span className="w-2 h-2 rounded-full bg-[#3FB950]" />
            <h1 className="text-lg font-semibold tracking-tight">Dashboard</h1>
          </div>
          <LogoutButton onLogout={handleLogout} />
        </div>

        {/* Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-5">
          {/* Left column */}
          <div className="col-span-1 space-y-5">
            <UserCard />
            <StatsCard />
          </div>

          {/* Center column */}
          <div className="col-span-1 lg:col-span-2 space-y-5">
            <div className="grid grid-cols-3 gap-3">
              <ProblemCategoryCard title="Arrays" problems={42} icon={Code} accent="#F778BA" />
              <ProblemCategoryCard title="DP" problems={35} icon={Brain} accent="#58A6FF" />
              <ProblemCategoryCard title="Graphs" problems={28} icon={GitBranch} accent="#3FB950" />
            </div>

            <ProblemsLinkCard />
            <SubmissionHeatmap />
          </div>

          {/* Right column */}
          <div className="col-span-1">
            <RecentSubmissionCard />
          </div>
        </div>
      </div>
    </div>
  );
};

export default DashboardPage;