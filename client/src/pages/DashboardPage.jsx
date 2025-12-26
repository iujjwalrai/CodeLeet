import React, { useState } from "react";
import { Sun, Moon, TrendingUp, Code, Brain, GitBranch, Clock, Edit2, School, MapPin, Calendar, ArrowRight, Trophy, X} from "lucide-react";
import { useNavigate } from "react-router-dom";
import axios from "../api/axios";
import { useEffect } from "react";
const DashboardPage = () => {
  const [isDark, setIsDark] = useState(true);
  const [isEditOpen, setIsEditOpen] = useState(false);
  const [editForm, setEditForm] = useState(null);
  const [userData, setUserData] = useState({});
  const [heatmapData, setHeatmapData] = useState([]);
  const [recentSubmissions, setRecentSubmissions] = useState([]);

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
    if (diff < 60) return `${diff}s ago`;
    if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
    if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
    return `${Math.floor(diff / 86400)}d ago`;
  };

  const getHeatmapColor = (count) => {
    if (count === 0) return isDark ? 'bg-gray-800' : 'bg-gray-200';
    if (count <= 2) return isDark ? 'bg-green-900' : 'bg-green-200';
    if (count <= 4) return isDark ? 'bg-green-700' : 'bg-green-400';
    if (count <= 6) return isDark ? 'bg-green-500' : 'bg-green-600';
    return isDark ? 'bg-green-400' : 'bg-green-700';
  };


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
      setForm(prev => ({ ...prev, [field]: value }));
    };

    const handlePrefChange = (field, value) => {
      setForm(prev => ({
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

    return (
      <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50">
        <div className="bg-gray-900 w-full max-w-lg rounded-2xl p-6 relative">

          {/* Close */}
          <button onClick={onClose} className="absolute top-4 right-4">
            <X />
          </button>

          <h2 className="text-xl font-bold mb-4">Edit Profile</h2>

          <div className="space-y-3">
            <input
              value={form.fullName}
              onChange={(e) => handleChange("fullName", e.target.value)}
              placeholder="Full Name"
              className="w-full p-2 rounded bg-gray-800"
            />

            <input
              value={form.username}
              onChange={(e) => handleChange("username", e.target.value)}
              placeholder="Username"
              className="w-full p-2 rounded bg-gray-800"
            />

            <textarea
              value={form.bio}
              onChange={(e) => handleChange("bio", e.target.value)}
              placeholder="Bio"
              className="w-full p-2 rounded bg-gray-800"
            />

            <input
              value={form.education}
              onChange={(e) => handleChange("education", e.target.value)}
              placeholder="Education"
              className="w-full p-2 rounded bg-gray-800"
            />

            <input
              value={form.location}
              onChange={(e) => handleChange("location", e.target.value)}
              placeholder="Location"
              className="w-full p-2 rounded bg-gray-800"
            />

            {/* Preferences */}
            <select
              value={form.preferences.theme}
              onChange={(e) => handlePrefChange("theme", e.target.value)}
              className="w-full p-2 rounded bg-gray-800"
            >
              <option value="dark">Dark</option>
              <option value="light">Light</option>
            </select>

            <select
              value={form.preferences.defaultLanguage}
              onChange={(e) => handlePrefChange("defaultLanguage", e.target.value)}
              className="w-full p-2 rounded bg-gray-800"
            >
              <option value="javascript">JavaScript</option>
              <option value="cpp">C++</option>
              <option value="python">Python</option>
            </select>

            <select
              value={form.preferences.editorTheme}
              onChange={(e) => handlePrefChange("editorTheme", e.target.value)}
              className="w-full p-2 rounded bg-gray-800"
            >
              <option value="vs-dark">VS Dark</option>
              <option value="monokai">Monokai</option>
            </select>

            <button
              onClick={handleSubmit}
              className="w-full bg-purple-600 hover:bg-purple-700 p-2 rounded font-semibold"
            >
              Save Changes
            </button>
          </div>
        </div>
      </div>
    );
  };


  const UserCard = () => {
    if (!userData) return null;

    const initials = userData.fullName
      ?.split(" ")
      .map(n => n[0])
      .join("")
      .toUpperCase();

    return (
      <>
        <div className={`${isDark ? 'bg-gradient-to-br from-purple-900/40 to-blue-900/40 border-purple-500/20' : 'bg-gradient-to-br from-purple-100 to-blue-100 border-purple-300'} border rounded-2xl p-6`}>
          
          <div className="flex items-start justify-between mb-4">
            <div className="flex items-center gap-4">
              <div className="w-16 h-16 rounded-full bg-gradient-to-br from-purple-500 to-blue-500 flex items-center justify-center text-2xl font-bold">
                {initials}
              </div>
              <div>
                <h3 className="text-xl font-bold">{userData.fullName}</h3>
                <p className="text-sm text-gray-400">@{userData.username}</p>
              </div>
            </div>

            {/* Edit Icon */}
            <button
              onClick={() => {
                setEditForm(userData);
                setIsEditOpen(true);
              }}
              className="p-2 rounded-lg hover:bg-gray-700"
            >
              <Edit2 size={18} />
            </button>
          </div>

          <div className="space-y-3 mt-4 pt-4 border-t border-gray-700">
            <p className="text-sm text-gray-300">
              {userData.bio || "No bio added yet"}
            </p>

            <div className="text-sm text-gray-400">
              <div>{userData.education}</div>
              <div>{userData.location}</div>
              <div>
                Joined {new Date(userData.createdAt).toLocaleDateString()}
              </div>
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


  const StatsCard = () => {
    if (!userData?.stats) return null;

    const {
      problemsSolved = 0,
      dailyStreak = 0,
      acceptanceRate = 0,
      contestsParticipated = 0,
    } = userData.stats;

    return (
      <div
        className={`${
          isDark
            ? "bg-gray-800/50 border-gray-700/50"
            : "bg-white border-gray-200"
        } border rounded-2xl p-6 backdrop-blur-sm`}
      >
        <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
          <TrendingUp
            size={20}
            className={isDark ? "text-green-400" : "text-green-600"}
          />
          Statistics
        </h3>

        <div className="space-y-4">
          {/* Problems Solved */}
          <div className="flex justify-between items-center">
            <span className={isDark ? "text-gray-400" : "text-gray-600"}>
              Problems Solved
            </span>
            <span
              className={`font-bold text-lg ${
                isDark ? "text-green-400" : "text-green-600"
              }`}
            >
              {problemsSolved}
            </span>
          </div>

          {/* Streak */}
          <div className="flex justify-between items-center">
            <span className={isDark ? "text-gray-400" : "text-gray-600"}>
              Streak
            </span>
            <span
              className={`font-bold text-lg ${
                isDark ? "text-orange-400" : "text-orange-600"
              }`}
            >
              {dailyStreak} days
            </span>
          </div>

          {/* Acceptance Rate */}
          <div className="flex justify-between items-center">
            <span className={isDark ? "text-gray-400" : "text-gray-600"}>
              Acceptance Rate
            </span>
            <span
              className={`font-bold text-lg ${
                isDark ? "text-blue-400" : "text-blue-600"
              }`}
            >
              {acceptanceRate.toFixed(1)}%
            </span>
          </div>
        </div>
      </div>
    );
  };


  const ProblemCategoryCard = ({ title, problems, icon: Icon, gradient }) => (
    <div className={`${isDark ? 'bg-gray-800/50 border-gray-700/50 hover:border-gray-600' : 'bg-white border-gray-200 hover:border-gray-300'} border rounded-2xl p-6 backdrop-blur-sm transition-all hover:scale-105 cursor-pointer group`}>
      <div className={`w-12 h-12 rounded-xl ${gradient} flex items-center justify-center mb-4 group-hover:scale-110 transition-transform`}>
        <Icon size={24} className="text-white" />
      </div>
      <h3 className="text-xl font-bold mb-1">{title}</h3>
      <p className={`text-sm ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>{problems} problems</p>
    </div>
  );

  const SubmissionHeatmap = () => {
    const [hoveredDay, setHoveredDay] = useState(null);

    if (heatmapData.length === 0) return null;

    // 12 columns × 7 rows
    const columns = [];
    for (let i = 0; i < 12; i++) {
      columns.push(heatmapData.slice(i * 7, (i + 1) * 7));
    }

    return (
      <div className={`${isDark ? 'bg-gray-800/50 border-gray-700/50' : 'bg-white border-gray-200'} border rounded-2xl p-6 backdrop-blur-sm`}>
        <h3 className="text-lg font-semibold mb-4">Submission Activity</h3>

        <div className="relative">
          <div className="flex gap-1">
            {columns.map((week, wi) => (
              <div key={wi} className="flex flex-col gap-1 items-center">
                {week.map((day, di) => (
                  <div
                    key={di}
                    className={`w-4 h-4 rounded ${getHeatmapColor(day.count)} cursor-pointer transition-all hover:scale-110`}
                    onMouseEnter={() => setHoveredDay(day)}
                    onMouseLeave={() => setHoveredDay(null)}
                  />
                ))}

                <span className={`text-[9px] mt-1 ${isDark ? 'text-gray-500' : 'text-gray-600'}`}>
                  {week[6] && new Date(week[6].date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                </span>
              </div>
            ))}
          </div>

          {hoveredDay && (
            <div className={`absolute top-0 left-1/2 transform -translate-x-1/2 -translate-y-6 
              ${isDark ? 'bg-gray-900 border-gray-700' : 'bg-white border-gray-300'}
              border rounded-lg px-3 py-1.5 text-xs shadow-lg`}>
              <p className="font-semibold">{hoveredDay.count} submissions</p>
              <p className={isDark ? 'text-gray-400' : 'text-gray-600'}>
                {new Date(hoveredDay.date).toLocaleDateString()}
              </p>
            </div>
          )}
        </div>

        {/* Legend unchanged */}
      </div>
    );
  };


  const RecentSubmissionCard = () => (
    <div
      className={`${
        isDark ? "bg-gray-800/50 border-gray-700/50" : "bg-white border-gray-200"
      } border rounded-2xl p-6 backdrop-blur-sm`}
    >
      <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
        <Clock size={20} />
        Recent Submissions
      </h3>

      <div className="space-y-4">
        {recentSubmissions.length === 0 && (
          <p className="text-sm text-gray-400">No submissions yet</p>
        )}

        {recentSubmissions.map((sub) => (
          <div
            key={sub._id}
            className={`${
              isDark ? "bg-gray-700/50" : "bg-gray-50"
            } rounded-xl p-4 hover:scale-105 transition-transform`}
          >
            <div className="flex justify-between items-start mb-2">
              <div>
                <h4 className="font-semibold">
                  {sub.problem?.title}
                </h4>

                <span
                  className={`text-xs ${
                    sub.problem?.difficulty === "Easy"
                      ? isDark
                        ? "text-green-400"
                        : "text-green-600"
                      : sub.problem?.difficulty === "Medium"
                      ? isDark
                        ? "text-yellow-400"
                        : "text-yellow-600"
                      : isDark
                      ? "text-red-400"
                      : "text-red-600"
                  }`}
                >
                  {sub.problem?.difficulty}
                </span>
              </div>

              <span
                className={`text-xs px-2 py-1 rounded-full ${
                  sub.status === "accepted"
                    ? isDark
                      ? "bg-green-500/20 text-green-400"
                      : "bg-green-100 text-green-700"
                    : isDark
                    ? "bg-red-500/20 text-red-400"
                    : "bg-red-100 text-red-700"
                }`}
              >
                {sub.status.replace("_", " ")}
              </span>
            </div>

            <p
              className={`text-xs ${
                isDark ? "text-gray-500" : "text-gray-600"
              }`}
            >
              {timeAgo(sub.createdAt)}
            </p>
          </div>
        ))}
      </div>
    </div>
  );


  const ProblemsLinkCard = () => (
    <div className={`${isDark ? 'bg-gradient-to-br from-purple-900/60 to-pink-900/60 border-purple-500/30' : 'bg-gradient-to-br from-purple-200 to-pink-200 border-purple-400'} border rounded-2xl p-6 backdrop-blur-sm cursor-pointer group hover:scale-105 transition-all`} onClick={()=>navigate("/problems")}>
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-xl font-bold mb-2">Solve Problems</h3>
          <p className={`text-sm ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>
            Practice and improve your skills
          </p>
        </div>
        <ArrowRight size={32} className="group-hover:translate-x-2 transition-transform" />
      </div>
    </div>
  );

  return (
    <div className={`min-h-screen ${isDark ? 'bg-[#0A0A0A] text-white' : 'bg-gray-50 text-gray-900'} px-6 py-10 transition-colors duration-300`}>
      <div className="max-w-7xl mx-auto">
        {/* Header with Theme Toggle */}
        <div className="flex justify-between items-center mb-8">
          <h1 className="text-4xl font-bold bg-gradient-to-r from-purple-400 to-blue-400 bg-clip-text text-transparent">
            Dashboard
          </h1>
          <button
            onClick={() => setIsDark(!isDark)}
            className={`p-3 rounded-xl ${isDark ? 'bg-gray-800 hover:bg-gray-700' : 'bg-white hover:bg-gray-100'} border ${isDark ? 'border-gray-700' : 'border-gray-200'} transition-all hover:scale-110`}
            aria-label="Toggle theme"
          >
            {isDark ? <Sun size={24} className="text-yellow-400" /> : <Moon size={24} className="text-purple-600" />}
          </button>
        </div>

        {/* Grid Layout */}
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
          {/* Left Column */}
          <div className="col-span-1 space-y-6">
            <UserCard />
            <StatsCard />
          </div>

          {/* Center Column */}
          <div className="col-span-1 lg:col-span-2 space-y-6">
            {/* Categories */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-5">
              <ProblemCategoryCard 
                title="Arrays" 
                problems={42} 
                icon={Code}
                gradient="bg-gradient-to-br from-purple-500 to-pink-500"
              />
              <ProblemCategoryCard 
                title="DP" 
                problems={35} 
                icon={Brain}
                gradient="bg-gradient-to-br from-blue-500 to-cyan-500"
              />
              <ProblemCategoryCard 
                title="Graphs" 
                problems={28} 
                icon={GitBranch}
                gradient="bg-gradient-to-br from-green-500 to-emerald-500"
              />
            </div>

            <ProblemsLinkCard />
            <SubmissionHeatmap />
          </div>

          {/* Right Column */}
          <div className="col-span-1">
            <RecentSubmissionCard />
          </div>
        </div>
      </div>
    </div>
  );
};

export default DashboardPage;