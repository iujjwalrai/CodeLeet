import React, { useState, useEffect } from "react";
import { 
  Play, Send, Clock, ChevronLeft, ChevronRight, 
  Sun, Moon, Check, X, Zap, Settings 
} from "lucide-react";
import Editor from "@monaco-editor/react";
import axios from "../api/axios";
import { useLocation } from "react-router-dom";
const ProblemPage = ({ problemId = "1" }) => {
  const [isDark, setIsDark] = useState(true);
  const [language, setLanguage] = useState("javascript");
  const [code, setCode] = useState("");
  const [editorTheme, setEditorTheme] = useState("vs-dark");
  const [activeTab, setActiveTab] = useState("description");
  const [testResults, setTestResults] = useState([]);
  const [runStatus, setRunStatus] = useState(null);
  const [runData, setRunData] = useState(null);
  const [submitData, setSubmitData] = useState(null);
  const [timer, setTimer] = useState(0);
  const [isTimerRunning, setIsTimerRunning] = useState(false);
  const [customInput, setCustomInput] = useState("");
  const [submissions, setSubmissions] = useState([]);
  const [submissionsLoading, setSubmissionsLoading] = useState(false);

  const location = useLocation();
  const [problem, setProblem] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  // derive slug/id from URL: /problem/:slug
  const slugFromPath = () => {
    const parts = location.pathname.split('/').filter(Boolean);
    return parts.length ? parts[parts.length - 1] : problemId;
  };

  useEffect(() => {
    const fetchProblem = async () => {
      const slug = slugFromPath();
      setLoading(true);
      setError(null);
      try {
        const res = await axios.get(`/api/problems/${slug}`);
        setProblem(res.data);
        console.log(res.data);
        if (res.data?.codeTemplates?.[language]?.starter) {
          setCode(res.data.codeTemplates[language].starter);
        }

      } catch (err) {
        setError(err?.response?.data?.message || err.message || 'Failed to load problem');
      } finally {
        setLoading(false);
      }
    };

    fetchProblem();
  }, [location.pathname]);

  // Timer effect
  useEffect(() => {
    let interval;
    if (isTimerRunning) {
      interval = setInterval(() => {
        setTimer(prev => prev + 1);
      }, 1000);
    }
    return () => clearInterval(interval);
  }, [isTimerRunning]);

  const formatTime = (seconds) => {
    const hrs = Math.floor(seconds / 3600);
    const mins = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;
    return `${hrs.toString().padStart(2, '0')}:${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  const fetchMySubmissions = async () => {
    try {
      setSubmissionsLoading(true);
      const res = await axios.get("/api/submissions/me", {
        params: { problemId: problem._id, limit: 10 },
      });
      setSubmissions(res.data);
    } catch (err) {
      console.error("Failed to load submissions", err);
    } finally {
      setSubmissionsLoading(false);
    }
  };

  const handleRun = async () => {
    try {
      console.log({
        problemId: problem._id,
        language,
        code,
        customInput,
      })
      const response = await axios.post("/api/submissions/run", {
        problemId: problem._id,
        language,
        code,
        customInput,
      });
      // handle response if needed
      console.log(response.data);
      const ws = new WebSocket(import.meta.env.VITE_API_BASE_URL_WS);
      ws.onopen = ()=>{
        ws.send(JSON.stringify({
          type: "RUN",
          jobId: response.data.jobId
        }))
      }
      console.log("subscribed");
      ws.onmessage = (event)=>{
        const msg = JSON.parse(event.data);
        console.log("WebSocket message:", msg);
        const data = msg.data;
        setRunStatus(data.status);
        setRunData(data);
        if (data.status === "accepted") {
          setTestResults([
            {
              type: "accepted",
              time: `${data.time} ms`,
            },
          ]);
          ws.close();
          return;
        }

        if (data.status === "wrong_answer") {
          setTestResults([
            {
              type: "wrong_answer",
              input: data.tc?.input || "—",
              expected: data.tc?.output || "—",
              output: data.output || "—",
              time: `${data.time} ms`,
            },
          ]);
          ws.close();
          return;
        }

        if (data.status === "compilation_error") {
          setTestResults([
            {
              type: "compilation_error",
              error: data.error,
              time: `${data.time} ms`,
            },
          ]);
          ws.close();
          return;
        }

        if (data.status === "runtime_error") {
          setTestResults([
            {
              type: "runtime_error",
              error: data.error,
              time: `${data.time} ms`,
            },
          ]);
          ws.close();
        }
      }

    } catch (error) {
      console.error("Run error:", error);
    }
  };


  const handleSubmit = async () => {
    try{
      console.log({
        problemId: problem._id,
        language,
        code
      });

      const response = await axios.post("/api/submissions/", {
        problemId: problem._id,
        language,
        code
      });

      console.log(response.data);

      const ws = new WebSocket(import.meta.env.VITE_API_BASE_URL_WS);
      ws.onopen = ()=>{
        ws.send(JSON.stringify({
          type: "SUBMIT",
          jobId: response.data.jobId
        }))
      }
      console.log("subscribed for submission");
      ws.onmessage = (event)=>{
        const msg = JSON.parse(event.data);
        console.log(msg);
        setSubmitData(msg.data);
        setActiveTab("result");
      }
    }
    catch(error){
      console.error("Submit Error ", error);
    }
  };

  const languageOptions = [
    { value: "javascript", label: "JavaScript", monaco: "javascript" },
    { value: "python", label: "Python", monaco: "python" },
    { value: "java", label: "Java", monaco: "java" },
    { value: "cpp", label: "C++", monaco: "cpp" },
    { value: "typescript", label: "TypeScript", monaco: "typescript" }
  ];

  const themeOptions = [
    { value: "vs-dark", label: "Dark" },
    { value: "vs-light", label: "Light" },
    { value: "hc-black", label: "High Contrast" }
  ];

  const difficultyColor = () => {
    if (!problem) return isDark ? "text-gray-400" : "text-gray-500";
    if (problem.difficulty === "Easy") return isDark ? "text-emerald-400" : "text-emerald-600";
    if (problem.difficulty === "Medium") return isDark ? "text-amber-400" : "text-amber-600";
    return isDark ? "text-rose-400" : "text-rose-600";
  };

  if (loading) {
    return (
      <div className={`min-h-screen flex items-center justify-center ${isDark ? 'bg-slate-900 text-white' : 'bg-white text-gray-900'}`}>
        <div className="text-center">
          <div className="animate-pulse mb-4">Loading problem…</div>
          <div className="text-sm text-gray-400">CodeLeet is making arrangements</div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className={`min-h-screen flex items-center justify-center ${isDark ? 'bg-slate-900 text-white' : 'bg-white text-gray-900'}`}>
        <div className="text-center">
          <div className="mb-4">Error loading problem</div>
          <div className="text-sm text-red-400">{error}</div>
        </div>
      </div>
    );
  }

  if (!problem) {
    return (
      <div className={`min-h-screen flex items-center justify-center ${isDark ? 'bg-slate-900 text-white' : 'bg-white text-gray-900'}`}>
        <div className="text-center">Problem not found.</div>
      </div>
    );
  }

  return (
    <div className={`min-h-screen transition-colors duration-300 ${isDark ? "bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950 text-white" : "bg-gradient-to-br from-gray-50 via-white to-gray-50 text-gray-900"}`}>
      {/* Background Effects */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none">
        <div className={`absolute top-20 left-20 w-96 h-96 ${isDark ? 'bg-purple-500/5' : 'bg-purple-200/20'} rounded-full blur-3xl`}></div>
        <div className={`absolute bottom-20 right-20 w-96 h-96 ${isDark ? 'bg-blue-500/5' : 'bg-blue-200/20'} rounded-full blur-3xl`}></div>
      </div>

      {/* Header */}
      <div className={`relative border-b ${isDark ? 'border-slate-800 bg-slate-900/50' : 'border-gray-200 bg-white/50'} backdrop-blur-sm sticky top-0 z-50`}>
        <div className="max-w-[1800px] mx-auto px-6 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <button 
                onClick={() => window.history.back()}
                className={`p-2 rounded-lg transition-all ${isDark ? 'hover:bg-slate-800' : 'hover:bg-gray-100'}`}
              >
                <ChevronLeft size={20} />
              </button>
              
              <div>
                <div className="flex items-center gap-3">
                  <h1 className="text-xl font-bold bg-gradient-to-r from-purple-400 to-blue-400 bg-clip-text text-transparent">
                    {problem.title}
                  </h1>
                  <span className={`px-3 py-1 rounded-full text-xs font-semibold ${
                    problem.difficulty === "Easy" 
                      ? isDark ? "bg-emerald-500/10 text-emerald-400" : "bg-emerald-50 text-emerald-600"
                      : problem.difficulty === "Medium"
                      ? isDark ? "bg-amber-500/10 text-amber-400" : "bg-amber-50 text-amber-600"
                      : isDark ? "bg-rose-500/10 text-rose-400" : "bg-rose-50 text-rose-600"
                  }`}>
                    {problem.difficulty}
                  </span>
                </div>
                <p className={`text-xs mt-1 ${isDark ? 'text-gray-500' : 'text-gray-500'}`}>Problem #{problem.id}</p>
              </div>
            </div>

            <div className="flex items-center gap-3">
              <div className={`flex items-center gap-3 px-4 py-2 rounded-xl ${isDark ? 'bg-slate-800 border border-slate-700' : 'bg-white border border-gray-200'}`}>
                <Clock size={18} className={isTimerRunning ? "text-blue-400" : isDark ? "text-gray-400" : "text-gray-500"} />
                <span className="font-mono text-sm">{formatTime(timer)}</span>
                <button
                  onClick={() => {
                    if (isTimerRunning) {
                      setIsTimerRunning(false);
                    } else {
                      setTimer(0);
                      setIsTimerRunning(true);
                    }
                  }}
                  className={`px-3 py-1 rounded-lg text-xs font-medium transition-all ${
                    isTimerRunning 
                      ? "bg-rose-500 hover:bg-rose-600 text-white" 
                      : "bg-gradient-to-r from-purple-500 to-blue-500 hover:from-purple-600 hover:to-blue-600 text-white"
                  }`}
                >
                  {isTimerRunning ? "Stop" : "Start"}
                </button>
              </div>

              <button
                onClick={handleRun}
                disabled={runStatus === "Running"}
                className={`flex items-center gap-2 px-4 py-2 rounded-xl font-medium transition-all ${
                  isDark 
                    ? "bg-slate-800 hover:bg-slate-700 border border-slate-700" 
                    : "bg-white hover:bg-gray-50 border border-gray-200"
                } disabled:opacity-50`}
              >
                <Play size={16} />
                Run
              </button>

              <button
                onClick={handleSubmit}
                disabled={runStatus === "Running"}
                className="flex items-center gap-2 px-4 py-2 rounded-xl font-medium bg-gradient-to-r from-purple-500 to-blue-500 hover:from-purple-600 hover:to-blue-600 text-white transition-all disabled:opacity-50"
              >
                <Send size={16} />
                Submit
              </button>

              <button
                onClick={() => setIsDark(!isDark)}
                className={`p-2 rounded-xl transition-all ${isDark ? 'bg-slate-800 hover:bg-slate-700 border border-slate-700' : 'bg-white hover:bg-gray-50 border border-gray-200'}`}
              >
                {isDark ? <Sun size={18} className="text-amber-400" /> : <Moon size={18} className="text-slate-700" />}
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="relative max-w-[1800px] mx-auto">
        <div className="grid grid-cols-2 gap-0 h-[calc(100vh-80px)]">
          {/* Left Panel - Problem Description */}
          <div className={`border-r overflow-y-auto ${isDark ? 'border-slate-800' : 'border-gray-200'}`}>
            <div className="p-6">
              {/* Tabs */}
              <div className={`flex gap-2 mb-6 border-b ${isDark ? 'border-slate-800' : 'border-gray-200'}`}>
                {["description", "submissions", "result"].map((tab) => (
                  <button
                    key={tab}
                    onClick={() => {setActiveTab(tab); if (tab==="submissions") fetchMySubmissions()}}
                    className={`px-4 py-2 text-sm font-medium transition-all capitalize ${
                      activeTab === tab
                        ? `border-b-2 ${isDark ? 'border-purple-400 text-purple-400' : 'border-purple-500 text-purple-600'}`
                        : isDark ? 'text-gray-400 hover:text-gray-300' : 'text-gray-600 hover:text-gray-900'
                    }`}
                  >
                    {tab}
                  </button>
                ))}
              </div>

              {activeTab === "description" && (
                <div className="space-y-6">
                  {/* Description */}
                  <div>
                    <h2 className="text-lg font-semibold mb-3">Description</h2>
                    <p className={`leading-relaxed ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>
                      {problem.description}
                    </p>
                  </div>

                  {/* Examples */}
                  <div>
                    <h2 className="text-lg font-semibold mb-3">Examples</h2>
                    <div className="space-y-4">
                      {problem.examples.map((example, idx) => (
                        <div key={idx} className={`p-4 rounded-xl ${isDark ? 'bg-slate-800/50 border border-slate-700/50' : 'bg-gray-50 border border-gray-200'}`}>
                          <div className="space-y-2">
                            <div>
                              <span className={`text-sm font-semibold ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>Input:</span>
                              <pre className={`mt-1 font-mono text-sm ${isDark ? 'text-blue-400' : 'text-blue-600'}`}>{example.input}</pre>
                            </div>
                            <div>
                              <span className={`text-sm font-semibold ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>Output:</span>
                              <pre className={`mt-1 font-mono text-sm ${isDark ? 'text-emerald-400' : 'text-emerald-600'}`}>{example.output}</pre>
                            </div>
                            <div>
                              <span className={`text-sm font-semibold ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>Explanation:</span>
                              <p className={`mt-1 text-sm ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>{example.explanation}</p>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Constraints */}
                  <div>
                    <h2 className="text-lg font-semibold mb-3">Constraints</h2>
                    <ul className={`space-y-2 ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>
                      {problem.constraints.map((constraint, idx) => (
                        <li key={idx} className="flex items-start gap-2">
                          <span className="text-purple-400 mt-1">•</span>
                          <span className="text-sm font-mono">{constraint}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                </div>
              )}
              {activeTab === "submissions" && (
                <div className="space-y-3">

                  {submissionsLoading && (
                    <div className={`text-center py-6 ${isDark ? "text-gray-500" : "text-gray-400"}`}>
                      Loading submissions…
                    </div>
                  )}

                  {!submissionsLoading && submissions.length === 0 && (
                    <div className={`text-center py-6 ${isDark ? "text-gray-500" : "text-gray-400"}`}>
                      No submissions yet
                    </div>
                  )}

                  {submissions.map((sub) => (
                    <button
                      key={sub._id}
                      onClick={() => {
                        setSubmitData(sub);
                        setActiveTab("result");
                      }}
                      className={`w-full text-left p-4 rounded-xl border transition-all ${
                        sub.status === "accepted"
                          ? isDark
                            ? "bg-emerald-500/5 border-emerald-500/20 hover:bg-emerald-500/10"
                            : "bg-emerald-50 border-emerald-200"
                          : isDark
                            ? "bg-slate-800/50 border-slate-700 hover:bg-slate-800"
                            : "bg-gray-50 border-gray-200"
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <span
                          className={`text-sm font-semibold ${
                            sub.status === "accepted"
                              ? "text-emerald-400"
                              : sub.status === "wrong_answer"
                                ? "text-rose-400"
                                : "text-yellow-400"
                          }`}
                        >
                          {sub.status.replace("_", " ").toUpperCase()}
                        </span>

                        <span className="text-xs text-gray-500">
                          {new Date(sub.createdAt).toLocaleString()}
                        </span>
                      </div>
                    </button>
                  ))}
                </div>
              )}


              {activeTab === "result" && (
                <div className="p-6">

                  {!submitData ? (
                    <div className={`text-center py-10 ${isDark ? "text-gray-500" : "text-gray-400"}`}>
                      <p>No latest submission yet</p>
                    </div>
                  ) : (
                    <div
                      className={`max-w-xl mx-auto p-5 rounded-xl border ${
                        submitData.status === "accepted"
                          ? isDark
                            ? "bg-emerald-500/5 border-emerald-500/20"
                            : "bg-emerald-50 border-emerald-200"
                          : submitData.status === "wrong_answer"
                            ? isDark
                              ? "bg-rose-500/5 border-rose-500/20"
                              : "bg-rose-50 border-rose-200"
                            : isDark
                              ? "bg-yellow-500/5 border-yellow-500/20"
                              : "bg-yellow-50 border-yellow-200"
                      }`}
                    >
                      {/* ===== VERDICT ===== */}
                      <div className="text-center mb-4">
                        <p
                          className={`text-lg font-semibold ${
                            submitData.status === "accepted"
                              ? "text-emerald-400"
                              : submitData.status === "wrong_answer"
                                ? "text-rose-400"
                                : "text-yellow-400"
                          }`}
                        >
                          {(submitData?.status || "processing")
                            .replace("_", " ")
                            .toUpperCase()}
                        </p>
                      </div>

                      {/* ===== META ===== */}
                      <div className="flex justify-center gap-6 text-xs mb-4">
                        {submitData.time != null && <span>⏱ {submitData.time} ms</span>}
                        {submitData.memory != null && <span>💾 {submitData.memory} KB</span>}
                      </div>

                      {/* ===== ACCEPTED ===== */}
                      {submitData.status === "accepted" && (
                        <p className="text-center text-sm text-emerald-400">
                          All test cases passed 🎉
                        </p>
                      )}

                      {/* ===== WRONG ANSWER ===== */}
                      {submitData.status === "wrong_answer" && submitData.failedTestCase && (
                        <div className="space-y-2 text-xs">
                          <div>
                            <b>Input:</b>{" "}
                            <span className="font-mono">{submitData.failedTestCase.input}</span>
                          </div>
                          <div>
                            <b>Expected:</b>{" "}
                            <span className="font-mono">{submitData.failedTestCase.output}</span>
                          </div>
                          <div>
                            <b>Output:</b>{" "}
                            <span className="font-mono">{submitData.output}</span>
                          </div>
                        </div>
                      )}

                      {/* ===== ERRORS ===== */}
                      {(submitData.status === "compilation_error" ||
                        submitData.status === "runtime_error") && (
                        <pre className="mt-3 text-xs whitespace-pre-wrap text-left">
                          {submitData.error}
                        </pre>
                      )}
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>

          {/* Right Panel - Code Editor & Results */}
          <div className="flex flex-col h-full">
            {/* Code Editor Section */}
            <div className="flex-1 flex flex-col min-h-0">
              {/* Editor Controls */}
              <div className={`flex items-center justify-between px-4 py-2 border-b ${isDark ? 'border-slate-800 bg-slate-900/30' : 'border-gray-200 bg-gray-50'}`}>
                <div className="flex items-center gap-3">
                  <select
                    value={language}
                    onChange={(e)=>{const newLang = e.target.value; setLanguage(newLang); setCode(problem.codeTemplates[newLang].starter || "");}}
                    className={`px-3 py-1.5 rounded-lg text-sm outline-none cursor-pointer transition-all ${
                      isDark 
                        ? "bg-slate-800 border border-slate-700 hover:border-slate-600" 
                        : "bg-white border border-gray-200 hover:border-gray-300"
                    }`}
                  >
                    {languageOptions.map(opt => (
                      <option key={opt.value} value={opt.value}>{opt.label}</option>
                    ))}
                  </select>

                  <select
                    value={editorTheme}
                    onChange={(e) => setEditorTheme(e.target.value)}
                    className={`px-3 py-1.5 rounded-lg text-sm outline-none cursor-pointer transition-all ${
                      isDark 
                        ? "bg-slate-800 border border-slate-700 hover:border-slate-600" 
                        : "bg-white border border-gray-200 hover:border-gray-300"
                    }`}
                  >
                    {themeOptions.map(opt => (
                      <option key={opt.value} value={opt.value}>{opt.label}</option>
                    ))}
                  </select>
                </div>

                <div className="flex items-center gap-2">
                  <span className={`text-xs ${isDark ? 'text-gray-500' : 'text-gray-600'}`}>CodeLeet Editor</span>
                </div>
              </div>

              {/* Monaco Editor */}
              <div className="flex-1 min-h-0">
                <Editor
                  height="100%"
                  language={languageOptions.find(l => l.value === language)?.monaco || "javascript"}
                  theme={editorTheme}
                  value={code}
                  onChange={(value) => setCode(value)}
                  options={{
                    minimap: { enabled: false },
                    fontSize: 14,
                    lineNumbers: "on",
                    scrollBeyondLastLine: false,
                    automaticLayout: true,
                    tabSize: 2,
                    wordWrap: "on",
                    padding: { top: 16, bottom: 16 }
                  }}
                />
              </div>
            </div>

            {/* Results Section */}
            <div className={`h-[280px] border-t flex flex-col ${isDark ? 'border-slate-800' : 'border-gray-200'}`}>
              {/* Results Tabs */}
              <div className={`flex items-center gap-1 px-4 py-2 border-b ${isDark ? 'border-slate-800 bg-slate-900/30' : 'border-gray-200 bg-gray-50'}`}>
                <button
                  className={`px-4 py-1.5 text-sm font-medium rounded-lg transition-all ${
                      isDark ? 'text-gray-400 hover:text-gray-300' : 'text-gray-600 hover:text-gray-900'
                  }`}
                >
                  Test Cases
                </button>
              </div>

              {/* Results Content */}
              <div className="flex-1 overflow-y-auto p-4">
                <div className="space-y-3">

                  {/* IDLE */}

                  {runStatus === "Running" && (
                    <div
                      className={`p-4 rounded-xl border flex items-center gap-3 ${
                        isDark
                          ? "bg-blue-500/5 border-blue-500/20"
                          : "bg-blue-50 border-blue-200"
                      }`}
                    >
                      <div className="w-5 h-5 border-2 border-blue-500/30 border-t-blue-500 rounded-full animate-spin" />
                      <span className="text-sm font-medium text-blue-400">
                        Running…
                      </span>
                    </div>
                  )}

                  {testResults.length === 0 && (
                    <div className={`text-center py-8 ${isDark ? "text-gray-500" : "text-gray-400"}`}>
                      <Zap size={32} className="mx-auto mb-2 opacity-50" />
                      <p className="text-sm">Run your code to see test results</p>
                    </div>
                  )}

                  {testResults.map((r, idx) => {

                    /* ================= ACCEPTED ================= */
                    if (r.type === "accepted") {
                      return (
                        <div
                          key={idx}
                          className={`p-4 rounded-xl border ${
                            isDark
                              ? "bg-emerald-500/5 border-emerald-500/20"
                              : "bg-emerald-50 border-emerald-200"
                          }`}
                        >
                          <div className="flex items-center gap-2 mb-2">
                            <Check size={16} className="text-emerald-400" />
                            <span className="text-sm font-semibold text-emerald-400">
                              Accepted
                            </span>
                          </div>

                          <p className="text-xs text-emerald-400 mb-2">
                            All test cases passed
                          </p>

                          <span className="text-xs">⏱ {r.time}</span>
                        </div>
                      );
                    }

                    /* ================= WRONG ANSWER ================= */
                    if (r.type === "wrong_answer") {
                      return (
                        <div
                          key={idx}
                          className={`p-4 rounded-xl border ${
                            isDark
                              ? "bg-rose-500/5 border-rose-500/20"
                              : "bg-rose-50 border-rose-200"
                          }`}
                        >
                          <div className="flex items-center gap-2 mb-2">
                            <X size={16} className="text-rose-400" />
                            <span className="text-sm font-semibold text-rose-400">
                              Wrong Answer
                            </span>
                          </div>

                          <div className="space-y-1 text-xs">
                            <div><b>Input:</b> <span className="font-mono">{r.input}</span></div>
                            <div><b>Expected:</b> <span className="font-mono">{r.expected}</span></div>
                            <div><b>Output:</b> <span className="font-mono">{r.output}</span></div>
                            <div className="mt-2">⏱ {r.time}</div>
                          </div>
                        </div>
                      );
                    }

                    /* ================= COMPILATION ERROR ================= */
                    if (r.type === "compilation_error") {
                      return (
                        <div
                          key={idx}
                          className="p-4 rounded-xl border bg-yellow-500/5 border-yellow-500/20"
                        >
                          <div className="text-yellow-400 font-semibold mb-2">
                            Compilation Error
                          </div>
                          <pre className="text-xs whitespace-pre-wrap">{r.error}</pre>
                          <div className="text-xs mt-2">⏱ {r.time}</div>
                        </div>
                      );
                    }

                    /* ================= RUNTIME ERROR ================= */
                    return (
                      <div
                        key={idx}
                        className="p-4 rounded-xl border bg-red-500/5 border-red-500/20"
                      >
                        <div className="text-red-400 font-semibold mb-2">
                          Runtime Error
                        </div>
                        <pre className="text-xs whitespace-pre-wrap">{r.error}</pre>
                        <div className="text-xs mt-2">⏱ {r.time}</div>
                      </div>
                    );
                  })}
                </div>
              </div>

            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ProblemPage;