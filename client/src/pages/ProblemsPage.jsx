import React, { useState, useEffect } from "react";
import { Search, Filter, ChevronLeft, ChevronRight, Sun, Moon, TrendingUp, Award, Clock, BarChart3, Play, BookOpen, CheckCircle2, XCircle } from "lucide-react";
import axios from "../api/axios";
import { useNavigate } from "react-router-dom";

const ProblemsPage = () => {
  const [isDark, setIsDark] = useState(true);
  const [search, setSearch] = useState("");
  const [difficulty, setDifficulty] = useState("");
  const [topic, setTopic] = useState("");
  const [status, setStatus] = useState("");
  const [page, setPage] = useState(1);
  const [sortBy, setSortBy] = useState("title");
  const [view, setView] = useState("table");

  const [problems, setProblems] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [meta, setMeta] = useState({ total: 0, page: 1, pages: 1 });

  const stats = {
    total: meta.total || problems.length,
    solved: problems.filter((p) => p.status === "Solved").length,
    attempted: problems.filter((p) => p.status === "Attempted").length,
    easy: problems.filter((p) => p.difficulty === "Easy").length,
    medium: problems.filter((p) => p.difficulty === "Medium").length,
    hard: problems.filter((p) => p.difficulty === "Hard").length,
  };

  const navigate = useNavigate();

  const problemsPerPage = 8;
  const totalPages = meta.pages || 1;
  const paginated = problems; // server returns already-paginated results

  useEffect(() => {
    const fetchProblems = async () => {
      setLoading(true);
      setError(null);
      try {
        const res = await axios.get('/api/problems', {
          params: {
            page,
            limit: problemsPerPage,
            difficulty: difficulty || undefined,
            topic: topic || undefined,
            search: search || undefined,
            sortBy: sortBy || undefined,
          },
        });
        setProblems(res.data.data || []);
        setMeta(res.data.meta || { total: 0, page: 1, pages: 1 });
      } catch (err) {
        setError(err?.response?.data?.message || err.message || 'Failed to load problems');
      } finally {
        setLoading(false);
      }
    };

    fetchProblems();
  }, [page, difficulty, topic, search, sortBy]);

  const difficultyColor = (d) => {
    if (d === "Easy") return isDark ? "text-emerald-400" : "text-emerald-600";
    if (d === "Medium") return isDark ? "text-amber-400" : "text-amber-600";
    return isDark ? "text-rose-400" : "text-rose-600";
  };

  const difficultyBg = (d) => {
    if (d === "Easy") return isDark ? "bg-emerald-500/10 border-emerald-500/20" : "bg-emerald-50 border-emerald-200";
    if (d === "Medium") return isDark ? "bg-amber-500/10 border-amber-500/20" : "bg-amber-50 border-amber-200";
    return isDark ? "bg-rose-500/10 border-rose-500/20" : "bg-rose-50 border-rose-200";
  };

  return (
    <div className={`min-h-screen transition-colors duration-300 ${isDark ? "bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950 text-white" : "bg-gradient-to-br from-gray-50 via-white to-gray-50 text-gray-900"}`}>
      <div className="fixed inset-0 overflow-hidden pointer-events-none">
        <div className={`absolute top-20 left-20 w-96 h-96 ${isDark ? 'bg-purple-500/5' : 'bg-purple-200/20'} rounded-full blur-3xl`}></div>
        <div className={`absolute bottom-20 right-20 w-96 h-96 ${isDark ? 'bg-blue-500/5' : 'bg-blue-200/20'} rounded-full blur-3xl`}></div>
      </div>

      <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-8">
          <div>
            <h1 className="text-5xl font-bold bg-gradient-to-r from-purple-400 via-pink-400 to-blue-400 bg-clip-text text-transparent mb-2">
              Problem Set
            </h1>
            <p className={`text-sm ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>
              Master algorithms with {problems.length} curated challenges
            </p>
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={() => setView(view === "table" ? "grid" : "table")}
              className={`px-4 py-2 rounded-xl font-medium transition-all ${isDark ? "bg-slate-800/50 hover:bg-slate-800 border border-slate-700" : "bg-white hover:bg-gray-50 border border-gray-200 shadow-sm"}`}
            >
              {view === "table" ? "Grid View" : "Table View"}
            </button>
            
            <button
              onClick={() => setIsDark(!isDark)}
              className={`p-3 rounded-xl transition-all transform hover:scale-110 ${isDark ? "bg-slate-800/50 hover:bg-slate-800 border border-slate-700" : "bg-white hover:bg-gray-50 border border-gray-200 shadow-sm"}`}
            >
              {isDark ? <Sun size={20} className="text-amber-400" /> : <Moon size={20} className="text-slate-700" />}
            </button>
          </div>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-8">
          <div className={`p-5 rounded-2xl border transition-all hover:scale-105 ${isDark ? "bg-slate-800/30 border-slate-700/50 backdrop-blur-sm" : "bg-white border-gray-200 shadow-sm"}`}>
            <div className="flex items-center justify-between mb-2">
              <CheckCircle2 size={20} className="text-emerald-400" />
              <span className="text-2xl font-bold">{stats.solved}</span>
            </div>
            <p className={`text-sm ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>Solved</p>
          </div>

          <div className={`p-5 rounded-2xl border transition-all hover:scale-105 ${isDark ? "bg-slate-800/30 border-slate-700/50 backdrop-blur-sm" : "bg-white border-gray-200 shadow-sm"}`}>
            <div className="flex items-center justify-between mb-2">
              <Clock size={20} className="text-amber-400" />
              <span className="text-2xl font-bold">{stats.attempted}</span>
            </div>
            <p className={`text-sm ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>Attempted</p>
          </div>

          <div className={`p-5 rounded-2xl border transition-all hover:scale-105 ${isDark ? "bg-slate-800/30 border-slate-700/50 backdrop-blur-sm" : "bg-white border-gray-200 shadow-sm"}`}>
            <div className="flex items-center justify-between mb-2">
              <TrendingUp size={20} className="text-purple-400" />
              <span className="text-2xl font-bold">{Math.round((stats.solved / stats.total) * 100)}%</span>
            </div>
            <p className={`text-sm ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>Progress</p>
          </div>

          <div className={`p-5 rounded-2xl border transition-all hover:scale-105 ${isDark ? "bg-slate-800/30 border-slate-700/50 backdrop-blur-sm" : "bg-white border-gray-200 shadow-sm"}`}>
            <div className="flex items-center justify-between mb-2">
              <Award size={20} className="text-blue-400" />
              <span className="text-2xl font-bold">{stats.total}</span>
            </div>
            <p className={`text-sm ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>Total</p>
          </div>
        </div>

        <div className={`rounded-2xl border p-6 mb-6 transition-all ${isDark ? "bg-slate-800/30 border-slate-700/50 backdrop-blur-sm" : "bg-white border-gray-200 shadow-sm"}`}>
          <div className="flex items-center gap-3 mb-5">
            <div className="p-2 rounded-lg bg-gradient-to-br from-purple-500 to-blue-500">
              <Filter size={18} className="text-white" />
            </div>
            <h2 className="text-lg font-semibold">Filters & Search</h2>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
            <div className="sm:col-span-2">
              <div className={`flex items-center gap-3 px-4 py-3 rounded-xl transition-all ${isDark ? "bg-slate-900/50 border border-slate-700 focus-within:border-purple-500" : "bg-gray-50 border border-gray-200 focus-within:border-purple-400"}`}>
                <Search size={18} className={isDark ? "text-gray-400" : "text-gray-500"} />
                <input
                  type="text"
                  placeholder="Search problems..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="bg-transparent w-full outline-none text-sm"
                />
              </div>
            </div>

            <select
              value={difficulty}
              onChange={(e) => setDifficulty(e.target.value)}
              className={`px-4 py-3 rounded-xl text-sm outline-none cursor-pointer transition-all ${isDark ? "bg-slate-900/50 border border-slate-700 hover:border-slate-600" : "bg-gray-50 border border-gray-200 hover:border-gray-300"}`}
            >
              <option value="">All Difficulties</option>
              <option value="Easy">Easy</option>
              <option value="Medium">Medium</option>
              <option value="Hard">Hard</option>
            </select>

            <select
              value={topic}
              onChange={(e) => setTopic(e.target.value)}
              className={`px-4 py-3 rounded-xl text-sm outline-none cursor-pointer transition-all ${isDark ? "bg-slate-900/50 border border-slate-700 hover:border-slate-600" : "bg-gray-50 border border-gray-200 hover:border-gray-300"}`}
            >
              <option value="">All Topics</option>
              <option value="Arrays">Arrays</option>
              <option value="Binary Search">Binary Search</option>
              <option value="DP">Dynamic Programming</option>
              <option value="Graphs">Graphs</option>
              <option value="Stack">Stack</option>
              <option value="BFS">BFS</option>
            </select>

            <select
              value={status}
              onChange={(e) => setStatus(e.target.value)}
              className={`px-4 py-3 rounded-xl text-sm outline-none cursor-pointer transition-all ${isDark ? "bg-slate-900/50 border border-slate-700 hover:border-slate-600" : "bg-gray-50 border border-gray-200 hover:border-gray-300"}`}
            >
              <option value="">All Status</option>
              <option value="Solved">Solved</option>
              <option value="Attempted">Attempted</option>
              <option value="Unsolved">Unsolved</option>
            </select>
          </div>

          <div className="flex items-center gap-4 mt-4 pt-4 border-t border-slate-700/50">
            <span className={`text-sm ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>Sort by:</span>
            <div className="flex gap-2">
              {["title", "difficulty", "acceptance"].map((sort) => (
                <button
                  key={sort}
                  onClick={() => setSortBy(sort)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${sortBy === sort ? "bg-gradient-to-r from-purple-500 to-blue-500 text-white" : isDark ? "bg-slate-700/50 hover:bg-slate-700" : "bg-gray-100 hover:bg-gray-200"}`}
                >
                  {sort.charAt(0).toUpperCase() + sort.slice(1)}
                </button>
              ))}
            </div>
          </div>
        </div>

        {view === "table" ? (
          <div className={`rounded-2xl border overflow-hidden transition-all ${isDark ? "bg-slate-800/30 border-slate-700/50 backdrop-blur-sm" : "bg-white border-gray-200 shadow-sm"}`}>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className={`${isDark ? 'bg-slate-900/50' : 'bg-gray-50'}`}>
                  <tr className={`text-sm ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>
                    <th className="text-left py-4 px-6 font-semibold">Problem</th>
                    <th className="text-left py-4 px-6 font-semibold">Difficulty</th>
                    <th className="text-left py-4 px-6 font-semibold">Topic</th>
                    <th className="text-left py-4 px-6 font-semibold">Acceptance</th>
                    <th className="text-left py-4 px-6 font-semibold">Status</th>
                    <th className="text-left py-4 px-6 font-semibold">Action</th>
                  </tr>
                </thead>

                <tbody>
                  {paginated.map((p, index) => (
                    <tr
                      key={p.id}
                      className={`group transition-all border-t ${isDark ? "border-slate-700/50 hover:bg-slate-700/20" : "border-gray-100 hover:bg-gray-50"}`}
                    >
                      <td className="py-4 px-6">
                        <div className="flex items-center gap-3">
                          <span className={`text-xs font-mono ${isDark ? 'text-gray-500' : 'text-gray-400'}`}>#{p.id}</span>
                          <span className="font-medium bg-gradient-to-r from-purple-400 to-blue-400 bg-clip-text text-transparent">{p.title}</span>
                        </div>
                      </td>

                      <td className="py-4 px-6">
                        <span className={`px-3 py-1 rounded-full text-xs font-semibold border ${difficultyBg(p.difficulty)} ${difficultyColor(p.difficulty)}`}>
                          {p.difficulty}
                        </span>
                      </td>

                      <td className="py-4 px-6">
                        <span className={`text-sm ${isDark ? 'text-blue-400' : 'text-blue-600'}`}>{p.topic}</span>
                      </td>

                      <td className="py-4 px-6">
                        <div className="flex items-center gap-2">
                          <BarChart3 size={14} className={isDark ? 'text-gray-500' : 'text-gray-400'} />
                          <span className="text-sm font-medium">{p.acceptance}%</span>
                        </div>
                      </td>

                      <td className="py-4 px-6">
                        <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium ${
                          p.status === "Solved"
                            ? isDark ? "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20" : "bg-emerald-50 text-emerald-700 border border-emerald-200"
                            : p.status === "Attempted"
                            ? isDark ? "bg-amber-500/10 text-amber-400 border border-amber-500/20" : "bg-amber-50 text-amber-700 border border-amber-200"
                            : isDark ? "bg-slate-700/50 text-gray-400 border border-slate-600" : "bg-gray-100 text-gray-600 border border-gray-200"
                        }`}>
                          {p.status === "Solved" ? <CheckCircle2 size={12} /> : p.status === "Attempted" ? <Clock size={12} /> : <XCircle size={12} />}
                          {p.status}
                        </span>
                      </td>

                      <td className="py-4 px-6">
                        <button 
                          onClick={() => navigate(`/problem/${p.slug || p.id}`)}
                          className="inline-flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all transform hover:scale-105 bg-gradient-to-r from-purple-500 to-blue-500 hover:from-purple-600 hover:to-blue-600 text-white"
                        >
                          <Play size={14} />
                          Solve
                        </button>
                      </td>
                    </tr>
                  ))}

                  {paginated.length === 0 && (
                    <tr>
                      <td colSpan="6" className="py-12 text-center">
                        <div className="flex flex-col items-center gap-3">
                          <BookOpen size={48} className={isDark ? 'text-gray-600' : 'text-gray-300'} />
                          <p className={isDark ? 'text-gray-400' : 'text-gray-500'}>No problems found matching your filters.</p>
                        </div>
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>

            {paginated.length > 0 && (
              <div className={`flex flex-col sm:flex-row justify-between items-center gap-4 p-6 border-t ${isDark ? 'border-slate-700/50 bg-slate-900/30' : 'border-gray-100 bg-gray-50'}`}>
                <div className={`text-sm ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>
                  Showing <span className="font-semibold">{(meta.page - 1) * problemsPerPage + 1}</span> to <span className="font-semibold">{Math.min(meta.page * problemsPerPage, meta.total)}</span> of <span className="font-semibold">{meta.total}</span> problems
                </div>

                <div className="flex items-center gap-2">
                  <button
                    disabled={page === 1}
                    onClick={() => setPage(page - 1)}
                    className={`p-2 rounded-lg transition-all ${page === 1 ? "opacity-30 cursor-not-allowed" : isDark ? "bg-slate-700 hover:bg-slate-600 border border-slate-600" : "bg-white hover:bg-gray-50 border border-gray-200"}`}
                  >
                    <ChevronLeft size={18} />
                  </button>

                  <div className="flex gap-1">
                    {[...Array(totalPages)].map((_, i) => (
                      <button
                        key={i}
                        onClick={() => setPage(i + 1)}
                        className={`w-10 h-10 rounded-lg font-medium text-sm transition-all ${page === i + 1 ? "bg-gradient-to-r from-purple-500 to-blue-500 text-white" : isDark ? "bg-slate-700 hover:bg-slate-600 border border-slate-600" : "bg-white hover:bg-gray-50 border border-gray-200"}`}
                      >
                        {i + 1}
                      </button>
                    ))}
                  </div>

                  <button
                    disabled={page === totalPages}
                    onClick={() => setPage(page + 1)}
                    className={`p-2 rounded-lg transition-all ${page === totalPages ? "opacity-30 cursor-not-allowed" : isDark ? "bg-slate-700 hover:bg-slate-600 border border-slate-600" : "bg-white hover:bg-gray-50 border border-gray-200"}`}
                  >
                    <ChevronRight size={18} />
                  </button>
                </div>
              </div>
            )}
          </div>
        ) : (
          <div>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {paginated.map((p, index) => (
                <div
                  key={p.id}
                  className={`p-6 rounded-2xl border transition-all hover:scale-105 cursor-pointer ${isDark ? "bg-slate-800/30 border-slate-700/50 backdrop-blur-sm hover:border-purple-500/50" : "bg-white border-gray-200 shadow-sm hover:border-purple-300 hover:shadow-md"}`}
                >
                  <div className="flex items-start justify-between mb-4">
                    <span className={`text-xs font-mono ${isDark ? 'text-gray-500' : 'text-gray-400'}`}>#{p.id}</span>
                    <span className={`px-3 py-1 rounded-full text-xs font-semibold border ${difficultyBg(p.difficulty)} ${difficultyColor(p.difficulty)}`}>
                      {p.difficulty}
                    </span>
                  </div>

                  <h3 className="text-lg font-semibold mb-3 bg-gradient-to-r from-purple-400 to-blue-400 bg-clip-text text-transparent">
                    {p.title}
                  </h3>

                  <div className="flex items-center gap-4 mb-4 text-sm">
                    <span className={`${isDark ? 'text-blue-400' : 'text-blue-600'}`}>{p.topic}</span>
                    <span className={isDark ? 'text-gray-500' : 'text-gray-400'}>•</span>
                    <div className="flex items-center gap-1">
                      <BarChart3 size={14} />
                      <span>{p.acceptance}%</span>
                    </div>
                  </div>

                  <div className="flex items-center justify-between">
                    <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium ${
                      p.status === "Solved"
                        ? isDark ? "bg-emerald-500/10 text-emerald-400" : "bg-emerald-50 text-emerald-700"
                        : p.status === "Attempted"
                        ? isDark ? "bg-amber-500/10 text-amber-400" : "bg-amber-50 text-amber-700"
                        : isDark ? "bg-slate-700/50 text-gray-400" : "bg-gray-100 text-gray-600"
                    }`}>
                      {p.status === "Solved" ? <CheckCircle2 size={12} /> : p.status === "Attempted" ? <Clock size={12} /> : <XCircle size={12} />}
                      {p.status}
                    </span>

                    <button className="inline-flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium bg-gradient-to-r from-purple-500 to-blue-500 hover:from-purple-600 hover:to-blue-600 text-white transition-all transform hover:scale-105">
                      <Play size={14} />
                      Solve
                    </button>
                  </div>
                </div>
              ))}
            </div>

            {paginated.length === 0 && (
              <div className={`p-12 rounded-2xl border text-center ${isDark ? "bg-slate-800/30 border-slate-700/50" : "bg-white border-gray-200"}`}>
                <BookOpen size={48} className={`mx-auto mb-4 ${isDark ? 'text-gray-600' : 'text-gray-300'}`} />
                <p className={isDark ? 'text-gray-400' : 'text-gray-500'}>No problems found matching your filters.</p>
              </div>
            )}

            {paginated.length > 0 && (
              <div className="flex justify-center items-center gap-4 mt-8">
                <button
                  disabled={page === 1}
                  onClick={() => setPage(page - 1)}
                  className={`p-3 rounded-xl transition-all ${page === 1 ? "opacity-30 cursor-not-allowed" : isDark ? "bg-slate-800 hover:bg-slate-700 border border-slate-700" : "bg-white hover:bg-gray-50 border border-gray-200 shadow-sm"}`}
                >
                  <ChevronLeft size={20} />
                </button>

                <span className={`text-sm ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>
                  Page <span className="font-semibold">{page}</span> of <span className="font-semibold">{totalPages}</span>
                </span>

                <button
                  disabled={page === totalPages}
                  onClick={() => setPage(page + 1)}
                  className={`p-3 rounded-xl transition-all ${page === totalPages ? "opacity-30 cursor-not-allowed" : isDark ? "bg-slate-800 hover:bg-slate-700 border border-slate-700" : "bg-white hover:bg-gray-50 border border-gray-200 shadow-sm"}`}
                >
                  <ChevronRight size={20} />
                </button>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default ProblemsPage;