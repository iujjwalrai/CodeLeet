import React, { useState, useEffect, useMemo } from "react";
import { Play, Send, Clock, ChevronLeft, Check, X, Zap, RefreshCcw } from "lucide-react";
import Editor from "@monaco-editor/react";
import axios from "../api/axios";
import { useLocation, useNavigate } from "react-router-dom";
import LogoutButton from "../components/Logout";
import { useAuth } from "../context/AuthContext";
import toast from "react-hot-toast";
import "./ProblemSolvingPage.css";

const ProblemPage = ({ problemId = "1" }) => {
  const { setUser } = useAuth();
  const [language, setLanguage] = useState("java");
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

  const slugFromPath = () => {
    const parts = location.pathname.split('/').filter(Boolean);
    return parts.length ? parts[parts.length - 1] : problemId;
  };
  const navigate = useNavigate();

  useEffect(() => {
    const fetchProblem = async () => {
      const slug = slugFromPath();
      setLoading(true); setError(null);
      try {
        const res = await axios.get(`/api/problems/${slug}`);
        setProblem(res.data);
        console.log(res.data);
      } catch (err) {
        setError(err?.response?.data?.message || err.message || 'Failed to load problem');
      } finally { setLoading(false); }
    };
    fetchProblem();
  }, [location.pathname]);

  const storageKey = useMemo(() => {
    if (problem) return `codeleet-${problem._id}-${language}`;
    else return "null";
  }, [problem, language]);

  useEffect(() => {
    let interval;
    if (isTimerRunning) interval = setInterval(() => setTimer(prev => prev + 1), 1000);
    return () => clearInterval(interval);
  }, [isTimerRunning]);

  const handleLogout = async () => {
    try {
      const response = await axios.post("/api/auth/logout");
      if (response.data.success) { setUser(null); navigate("/login"); }
      else toast.error("Logout failed");
    } catch (err) { toast.error("Logout failed"); }
  };

  useEffect(() => {
    const savedCode = localStorage.getItem(storageKey);
    if (savedCode !== null) setCode(savedCode);
    else setCode(problem?.codeTemplates?.[language]?.starter || "");
  }, [storageKey, problem, language]);

  useEffect(() => {
    const t = setTimeout(() => {
      console.log("User has stopped typing");
      localStorage.setItem(storageKey, code);
    }, 2000);
    return () => clearTimeout(t);
  }, [code, problem]);

  const formatTime = (seconds) => {
    const hrs = Math.floor(seconds / 3600);
    const mins = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;
    return `${hrs.toString().padStart(2, '0')}:${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  const fetchMySubmissions = async () => {
    try {
      setSubmissionsLoading(true);
      const res = await axios.get("/api/submissions/me", { params: { problemId: problem._id, limit: 10 } });
      setSubmissions(res.data);
    } catch (err) { console.error("Failed to load submissions", err); }
    finally { setSubmissionsLoading(false); }
  };

  const handleRun = async () => {
    try {
      console.log({ problemId: problem._id, language, code, customInput });
      const response = await axios.post("/api/submissions/run", { problemId: problem._id, language, code, customInput });
      console.log(response.data);
      const ws = new WebSocket(import.meta.env.VITE_API_BASE_URL_WS);
      ws.onopen = () => { ws.send(JSON.stringify({ type: "RUN", jobId: response.data.jobId })); };
      console.log("subscribed");
      ws.onmessage = (event) => {
        const msg = JSON.parse(event.data);
        console.log("WebSocket message:", msg);
        const data = msg.data;
        setRunStatus(data.status); setRunData(data);
        if (data.status === "accepted") {
          setTestResults([{ type: "accepted", passedCount: data.passedCount ?? data.totalCount, totalCount: data.totalCount, time: `${data.time} ms` }]);
          ws.close(); return;
        }
        if (data.status === "wrong_answer") {
          setTestResults([{ type: "wrong_answer", passedCount: data.passedCount ?? 0, totalCount: data.totalCount ?? 0, failedIndex: (data.failedTestCaseIndex ?? 0) + 1, input: data.failedTestCase?.input || "—", expected: data.failedTestCase?.output || "—", output: data.output || "—", time: `${data.time} ms` }]);
          ws.close(); return;
        }
        if (data.status === "compilation_error") {
          setTestResults([{ type: "compilation_error", error: data.error, time: `${data.time} ms` }]);
          ws.close(); return;
        }
        if (data.status === "runtime_error") {
          setTestResults([{ type: "runtime_error", error: data.error, time: `${data.time} ms` }]);
          ws.close();
        }
      };
    } catch (error) { toast.error("Failed to run code. Please try again."); }
  };

  const handleSubmit = async () => {
    try {
      console.log({ problemId: problem._id, language, code });
      const response = await axios.post("/api/submissions/", { problemId: problem._id, language, code });
      console.log(response.data);
      const ws = new WebSocket(import.meta.env.VITE_API_BASE_URL_WS);
      ws.onopen = () => { ws.send(JSON.stringify({ type: "SUBMIT", jobId: response.data.jobId })); };
      console.log("subscribed for submission");
      ws.onmessage = (event) => {
        const msg = JSON.parse(event.data);
        setSubmitData(msg.data);
        const finalStatuses = ["accepted", "wrong_answer", "compilation_error", "runtime_error"];
        if (finalStatuses.includes(msg.data.status)) {
          if (msg.data.status === "accepted") toast.success("✅ Submission Accepted!");
          else toast.error("❌ " + msg.data.status.replace(/_/g, " ").replace(/\b\w/g, c => c.toUpperCase()));
          setActiveTab("result");
        }
      };
    } catch (error) { toast.error("Submission failed. Please try again."); }
  };

  const languageOptions = [
    { value: "java", label: "Java", monaco: "java" },
    { value: "cpp", label: "C++", monaco: "cpp" },
  ];
  const themeOptions = [
    { value: "vs-dark", label: "Dark" },
    { value: "vs-light", label: "Light" },
    { value: "hc-black", label: "High Contrast" },
  ];

  if (loading) return (
    <div className="ps-fullscreen-center">
      <div className="ps-spinner" />
      <span style={{ color: "#64748b", fontSize: 13 }}>Loading problem…</span>
    </div>
  );
  if (error) return (
    <div className="ps-fullscreen-center">
      <span style={{ color: "#ef4444", fontSize: 14 }}>{error}</span>
    </div>
  );
  if (!problem) return (
    <div className="ps-fullscreen-center">
      <span style={{ color: "#64748b" }}>Problem not found.</span>
    </div>
  );

  const diffCls = `ps-diff ps-diff-${problem.difficulty}`;

  return (
    <div className="ps-page">
      {/* ── HEADER ── */}
      <div className="ps-header">
        <div className="ps-header-left">
          <button className="ps-back" onClick={() => window.history.back()}><ChevronLeft size={18} /></button>
          <span className="ps-title">{problem.title}</span>
          <span className={diffCls}>{problem.difficulty}</span>
          <span className="ps-id">#{problem.id}</span>
        </div>
        <div className="ps-header-right">
          <div className="ps-timer">
            <Clock size={14} style={{ color: isTimerRunning ? "#3b82f6" : "#475569" }} />
            <span>{formatTime(timer)}</span>
            <button className={`ps-timer-btn ${isTimerRunning ? "ps-timer-btn-stop" : "ps-timer-btn-start"}`}
              onClick={() => { if (isTimerRunning) setIsTimerRunning(false); else { setTimer(0); setIsTimerRunning(true); } }}>
              {isTimerRunning ? "Stop" : "Start"}
            </button>
          </div>
          <button className="ps-btn ps-btn-run" onClick={handleRun} disabled={runStatus === "Running"}>
            <Play size={14} /> Run
          </button>
          <button className="ps-btn ps-btn-submit" onClick={handleSubmit} disabled={runStatus === "Running"}>
            <Send size={14} /> Submit
          </button>
          <LogoutButton onLogout={handleLogout} />
        </div>
      </div>

      {/* ── MAIN SPLIT ── */}
      <div className="ps-main">
        {/* ── LEFT PANEL ── */}
        <div className="ps-left">
          <div className="ps-tabs">
            {["description", "submissions", "result"].map(tab => (
              <button key={tab}
                className={`ps-tab ${activeTab === tab ? "ps-tab-active" : ""}`}
                onClick={() => { setActiveTab(tab); if (tab === "submissions") fetchMySubmissions(); }}>
                {tab}
              </button>
            ))}
          </div>
          <div className="ps-content">
            {/* DESCRIPTION TAB */}
            {activeTab === "description" && <>
              <h2 className="ps-section-title">Description</h2>
              <p className="ps-desc">{problem.description}</p>

              <h2 className="ps-section-title">Examples</h2>
              {problem.examples.map((ex, i) => (
                <div key={i} className="ps-example">
                  <div className="ps-example-label">Input</div>
                  <pre className="ps-example-val ps-example-val-input">{ex.input}</pre>
                  <div className="ps-example-label" style={{ marginTop: 10 }}>Output</div>
                  <pre className="ps-example-val ps-example-val-output">{ex.output}</pre>
                  <div className="ps-example-label" style={{ marginTop: 10 }}>Explanation</div>
                  <p className="ps-example-val ps-example-val-explain">{ex.explanation}</p>
                </div>
              ))}

              <h2 className="ps-section-title">Constraints</h2>
              <ul className="ps-constraints">
                {problem.constraints.map((c, i) => <li key={i} className="ps-constraint">{c}</li>)}
              </ul>
            </>}

            {/* SUBMISSIONS TAB */}
            {activeTab === "submissions" && <>
              {submissionsLoading && <div className="ps-empty">Loading submissions…</div>}
              {!submissionsLoading && submissions.length === 0 && <div className="ps-empty">No submissions yet</div>}
              {submissions.map(sub => (
                <div key={sub._id}
                  className={`ps-sub-item ${sub.status === "accepted" ? "ps-sub-item-accepted" : ""}`}
                  onClick={() => { setSubmitData(sub); setActiveTab("result"); }}>
                  <span style={{ fontSize: 13, fontWeight: 600, color: sub.status === "accepted" ? "#22c55e" : sub.status === "wrong_answer" ? "#ef4444" : "#f59e0b" }}>
                    {sub.status.replace("_", " ").toUpperCase()}
                  </span>
                  <span style={{ fontSize: 11, color: "#475569" }}>{new Date(sub.createdAt).toLocaleString()}</span>
                </div>
              ))}
            </>}

            {/* RESULT TAB */}
            {activeTab === "result" && <>
              {!submitData ? (
                <div className="ps-empty" style={{ padding: "48px 0" }}>No submission yet</div>
              ) : (
                <div className={`ps-verdict-box ${submitData.status === "accepted" ? "ps-card-accepted" :
                  submitData.status === "wrong_answer" ? "ps-card-wrong" : ""
                  }`} style={{
                    borderColor: submitData.status === "accepted" ? "rgba(34,197,94,0.2)" :
                      submitData.status === "wrong_answer" ? "rgba(239,68,68,0.2)" : "rgba(245,158,11,0.2)",
                    background: submitData.status === "accepted" ? "rgba(34,197,94,0.04)" :
                      submitData.status === "wrong_answer" ? "rgba(239,68,68,0.04)" : "rgba(245,158,11,0.04)"
                  }}>
                  <div className="ps-verdict-title" style={{
                    color: submitData.status === "accepted" ? "#22c55e" :
                      submitData.status === "wrong_answer" ? "#ef4444" : "#f59e0b"
                  }}>
                    {(submitData?.status || "processing").replace("_", " ").toUpperCase()}
                  </div>
                  <div className="ps-meta" style={{ justifyContent: "center", marginBottom: 14 }}>
                    {submitData.time != null && <span>⏱ {submitData.time} ms</span>}
                    {submitData.memory != null && <span>💾 {submitData.memory} KB</span>}
                  </div>

                  {submitData.status === "accepted" && submitData.passedCount != null && <>
                    <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12, marginBottom: 4 }}>
                      <span style={{ color: "#64748b" }}>Test Cases Passed</span>
                      <span style={{ color: "#22c55e", fontWeight: 700 }}>{submitData.passedCount} / {submitData.totalCount}</span>
                    </div>
                    <div className="ps-progress"><div className="ps-progress-fill ps-progress-green" style={{ width: "100%" }} /></div>
                    <p style={{ textAlign: "center", color: "#22c55e", fontSize: 13, marginTop: 8 }}>All test cases passed 🎉</p>
                  </>}

                  {submitData.status === "wrong_answer" && <>
                    {submitData.passedCount != null && <>
                      <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12, marginBottom: 4 }}>
                        <span style={{ color: "#64748b" }}>Test Cases Passed</span>
                        <span style={{ color: "#ef4444", fontWeight: 700 }}>{submitData.passedCount} / {submitData.totalCount}</span>
                      </div>
                      <div className="ps-progress"><div className="ps-progress-fill ps-progress-red" style={{ width: `${(submitData.passedCount / submitData.totalCount) * 100}%` }} /></div>
                    </>}
                    {submitData.failedTestCaseIndex != null && (
                      <div style={{ display: "inline-block", padding: "3px 8px", borderRadius: 4, background: "rgba(239,68,68,0.1)", color: "#f87171", fontSize: 12, margin: "8px 0" }}>
                        ❌ Failed on Test Case #{submitData.failedTestCaseIndex + 1}
                      </div>
                    )}
                    {submitData.failedTestCase && <>
                      <div className="ps-detail-row"><b>Input: </b><span>{submitData.failedTestCase.input}</span></div>
                      <div className="ps-detail-row"><b>Expected: </b><span>{submitData.failedTestCase.output}</span></div>
                      <div className="ps-detail-row"><b>Output: </b><span>{submitData.output}</span></div>
                    </>}
                  </>}

                  {(submitData.status === "compilation_error" || submitData.status === "runtime_error") && (
                    <div className="ps-error-block" style={{ borderColor: submitData.status === "compilation_error" ? "rgba(245,158,11,0.2)" : "rgba(239,68,68,0.2)" }}>
                      <div className={`ps-error-header ${submitData.status === "compilation_error" ? "ps-error-header-compile" : "ps-error-header-runtime"}`}>
                        <span className="ps-dot" style={{ background: submitData.status === "compilation_error" ? "#f59e0b" : "#ef4444" }} />
                        {submitData.status === "compilation_error" ? "Compilation Error" : "Runtime Error"}
                      </div>
                      <pre className="ps-error-pre">{submitData.error}</pre>
                    </div>
                  )}
                </div>
              )}
            </>}
          </div>
        </div>

        {/* ── RIGHT PANEL ── */}
        <div className="ps-right">
          <div className="ps-editor-bar">
            <div className="ps-editor-bar-left">
              <select className="ps-select" value={language} onChange={e => setLanguage(e.target.value)}>
                {languageOptions.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
              </select>
              <select className="ps-select" value={editorTheme} onChange={e => setEditorTheme(e.target.value)}>
                {themeOptions.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
              </select>
              <button className="ps-reset" title="Reset to starter code"
                onClick={() => setCode(problem?.codeTemplates?.[language]?.starter)}>
                <RefreshCcw size={14} />
              </button>
            </div>
            <span className="ps-editor-label">CodeLeet Editor</span>
          </div>

          <div className="ps-editor">
            <Editor height="100%" language={languageOptions.find(l => l.value === language)?.monaco || "javascript"}
              theme={editorTheme} value={code} onChange={value => setCode(value)}
              options={{ minimap: { enabled: false }, fontSize: 14, lineNumbers: "on", scrollBeyondLastLine: false, automaticLayout: true, tabSize: 2, wordWrap: "on", padding: { top: 16, bottom: 16 } }} />
          </div>

          <div className="ps-results">
            <div className="ps-results-bar">Test Results</div>
            <div className="ps-results-content">
              {runStatus === "Running" && (
                <div className="ps-card ps-card-running" style={{ display: "flex", alignItems: "center", gap: 10 }}>
                  <div className="ps-spinner" />
                  <span style={{ fontSize: 13, fontWeight: 600, color: "#60a5fa" }}>Running…</span>
                </div>
              )}

              {testResults.length === 0 && (
                <div className="ps-empty"><Zap size={28} style={{ opacity: 0.3 }} /><span>Run your code to see test results</span></div>
              )}

              {testResults.map((r, idx) => {
                if (r.type === "accepted") return (
                  <div key={idx} className="ps-card ps-card-accepted">
                    <div className="ps-card-header"><Check size={14} style={{ color: "#22c55e" }} /><span style={{ color: "#22c55e" }}>Accepted</span></div>
                    {r.totalCount != null && <>
                      <div style={{ display: "flex", justifyContent: "space-between", fontSize: 11 }}>
                        <span style={{ color: "#64748b" }}>Test Cases Passed</span>
                        <span style={{ color: "#22c55e", fontWeight: 700 }}>{r.passedCount} / {r.totalCount}</span>
                      </div>
                      <div className="ps-progress"><div className="ps-progress-fill ps-progress-green" style={{ width: `${(r.passedCount / r.totalCount) * 100}%` }} /></div>
                    </>}
                    <p style={{ color: "#22c55e", fontSize: 12, margin: "4px 0" }}>All test cases passed 🎉</p>
                    <div className="ps-meta">⏱ {r.time}</div>
                  </div>
                );
                if (r.type === "wrong_answer") return (
                  <div key={idx} className="ps-card ps-card-wrong">
                    <div className="ps-card-header"><X size={14} style={{ color: "#ef4444" }} /><span style={{ color: "#ef4444" }}>Wrong Answer</span></div>
                    {r.totalCount != null && <>
                      <div style={{ display: "flex", justifyContent: "space-between", fontSize: 11 }}>
                        <span style={{ color: "#64748b" }}>Test Cases Passed</span>
                        <span style={{ color: "#ef4444", fontWeight: 700 }}>{r.passedCount} / {r.totalCount}</span>
                      </div>
                      <div className="ps-progress"><div className="ps-progress-fill ps-progress-red" style={{ width: `${(r.passedCount / r.totalCount) * 100}%` }} /></div>
                    </>}
                    {r.failedIndex != null && (
                      <div style={{ display: "inline-block", padding: "2px 8px", borderRadius: 4, background: "rgba(239,68,68,0.1)", color: "#f87171", fontSize: 11, margin: "6px 0" }}>
                        ❌ Failed on Test Case #{r.failedIndex}
                      </div>
                    )}
                    <div className="ps-detail-row"><b>Input: </b><span>{r.input}</span></div>
                    <div className="ps-detail-row"><b>Expected: </b><span>{r.expected}</span></div>
                    <div className="ps-detail-row"><b>Output: </b><span>{r.output}</span></div>
                    <div className="ps-meta" style={{ marginTop: 6 }}>⏱ {r.time}</div>
                  </div>
                );
                if (r.type === "compilation_error") return (
                  <div key={idx} className="ps-error-block" style={{ borderColor: "rgba(245,158,11,0.2)" }}>
                    <div className="ps-error-header ps-error-header-compile">
                      <span className="ps-dot" style={{ background: "#f59e0b" }} />Compilation Error
                      <span style={{ marginLeft: "auto", color: "#64748b", fontSize: 11 }}>⏱ {r.time}</span>
                    </div>
                    <pre className="ps-error-pre">{r.error}</pre>
                  </div>
                );
                return (
                  <div key={idx} className="ps-error-block" style={{ borderColor: "rgba(239,68,68,0.2)" }}>
                    <div className="ps-error-header ps-error-header-runtime">
                      <span className="ps-dot" style={{ background: "#ef4444" }} />Runtime Error
                      <span style={{ marginLeft: "auto", color: "#64748b", fontSize: 11 }}>⏱ {r.time}</span>
                    </div>
                    <pre className="ps-error-pre">{r.error}</pre>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ProblemPage;