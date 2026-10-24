import React, { useState, useEffect, useMemo, useRef } from "react";
import {
  Play, Send, Clock, ChevronLeft, Check, X, RotateCcw, FileText, History, FlaskConical,
  Terminal, AlertTriangle,
} from "lucide-react";
import Editor from "@monaco-editor/react";
import { Panel, PanelGroup, PanelResizeHandle } from "react-resizable-panels";
import axios from "../api/axios";
import { subscribeToJudge } from "../api/judgeStream";
import { useLocation, useNavigate } from "react-router-dom";
import LogoutButton from "../components/Logout";
import { Logo, ThemeToggle } from "../components/Navbar";
import ResourceTimeline from "../components/ResourceTimeline";
import Counterexample from "../components/Counterexample";
import { useAuth } from "../context/AuthContext";
import { useTheme } from "../theme";
import toast from "react-hot-toast";
import "./ProblemSolvingPage.css";

/* Monaco themes matching the app's light and dark palettes */
const defineCodeleetThemes = (monaco) => {
  monaco.editor.defineTheme("codeleet-dark", {
    base: "vs-dark",
    inherit: true,
    rules: [
      { token: "comment", foreground: "71717a", fontStyle: "italic" },
      { token: "keyword", foreground: "e879f9" },
      { token: "string", foreground: "6ee7b7" },
      { token: "number", foreground: "fbbf24" },
      { token: "type", foreground: "67e8f9" },
      { token: "type.identifier", foreground: "67e8f9" },
      { token: "delimiter", foreground: "a1a1aa" },
    ],
    colors: {
      "editor.background": "#111113",
      "editor.foreground": "#fafafa",
      "editorLineNumber.foreground": "#3f3f46",
      "editorLineNumber.activeForeground": "#a1a1aa",
      "editor.lineHighlightBackground": "#18181b",
      "editor.lineHighlightBorder": "#00000000",
      "editor.selectionBackground": "#10b98133",
      "editor.inactiveSelectionBackground": "#10b9811a",
      "editorCursor.foreground": "#10b981",
      "editorIndentGuide.background1": "#27272a",
      "editorIndentGuide.activeBackground1": "#3f3f46",
      "editorBracketHighlight.foreground1": "#a1a1aa",
      "editorBracketHighlight.foreground2": "#67e8f9",
      "editorBracketHighlight.foreground3": "#e879f9",
      "editorWidget.background": "#18181b",
      "editorWidget.border": "#27272a",
      "scrollbarSlider.background": "#3f3f4666",
      "scrollbarSlider.hoverBackground": "#3f3f46aa",
    },
  });
  monaco.editor.defineTheme("codeleet-light", {
    base: "vs",
    inherit: true,
    rules: [
      { token: "comment", foreground: "a1a1aa", fontStyle: "italic" },
      { token: "keyword", foreground: "c026d3" },
      { token: "string", foreground: "059669" },
      { token: "number", foreground: "d97706" },
      { token: "type", foreground: "0891b2" },
      { token: "type.identifier", foreground: "0891b2" },
      { token: "delimiter", foreground: "52525b" },
    ],
    colors: {
      "editor.background": "#ffffff",
      "editor.foreground": "#09090b",
      "editorLineNumber.foreground": "#d4d4d8",
      "editorLineNumber.activeForeground": "#52525b",
      "editor.lineHighlightBackground": "#fafafa",
      "editor.lineHighlightBorder": "#00000000",
      "editor.selectionBackground": "#05966926",
      "editorCursor.foreground": "#059669",
      "editorIndentGuide.background1": "#f4f4f5",
      "editorIndentGuide.activeBackground1": "#e4e4e7",
      "editorBracketHighlight.foreground1": "#52525b",
      "editorBracketHighlight.foreground2": "#0891b2",
      "editorBracketHighlight.foreground3": "#c026d3",
    },
  });
};

const FINAL_STATUSES = ["accepted", "wrong_answer", "compilation_error", "runtime_error", "time_limit_exceeded", "memory_limit_exceeded", "error"];

const STATUS_LABEL = {
  accepted: "Accepted",
  wrong_answer: "Wrong Answer",
  compilation_error: "Compilation Error",
  runtime_error: "Runtime Error",
  time_limit_exceeded: "Time Limit Exceeded",
  memory_limit_exceeded: "Memory Limit Exceeded",
  error: "Internal Error",
};
const labelOf = (s) => STATUS_LABEL[s] || (s || "").replace(/_/g, " ").replace(/\b\w/g, c => c.toUpperCase());

/* Peak memory in KB → "41.2 MB"; older submissions stored 0 */
const formatMemory = (kb) => (!kb ? "—" : kb >= 1024 ? `${(kb / 1024).toFixed(1)} MB` : `${kb} KB`);

/* Verdict status → colour tone used by the CSS */
const toneOf = (status) =>
  status === "accepted" ? "ok" : status === "wrong_answer" ? "bad" : status === "runtime_error" || status === "error" ? "bad" : "warn";

const DIFF_BADGE = { Easy: "badge-easy", Medium: "badge-medium", Hard: "badge-hard" };

/* Stack the panes vertically on narrow screens */
const useNarrow = () => {
  const query = "(max-width: 900px)";
  const [narrow, setNarrow] = useState(() => typeof window !== "undefined" && window.matchMedia?.(query).matches);
  useEffect(() => {
    const mq = window.matchMedia?.(query);
    if (!mq) return;
    const on = (e) => setNarrow(e.matches);
    mq.addEventListener("change", on);
    return () => mq.removeEventListener("change", on);
  }, []);
  return narrow;
};

const Handle = ({ direction }) => (
  <PanelResizeHandle className={`ps-handle ${direction === "horizontal" ? "ps-handle-x" : "ps-handle-y"}`} />
);

const ProblemPage = ({ problemId = "1" }) => {
  const { setUser } = useAuth();
  const { theme } = useTheme();
  const narrow = useNarrow();
  const [language, setLanguage] = useState("java");
  const [code, setCode] = useState("");
  const [editorTheme, setEditorTheme] = useState("auto");
  const [activeTab, setActiveTab] = useState("description");
  const [testResults, setTestResults] = useState([]);
  const [runStatus, setRunStatus] = useState(null);
  const [submitData, setSubmitData] = useState(null);
  const [runAnalysis, setRunAnalysis] = useState(null);
  const [runAnalysisPending, setRunAnalysisPending] = useState(false);
  const runStream = useRef(null);
  const submitStream = useRef(null);
  const [timer, setTimer] = useState(0);
  const [isTimerRunning, setIsTimerRunning] = useState(false);
  const [customInput] = useState("");
  const [submissions, setSubmissions] = useState([]);
  const [submissionsLoading, setSubmissionsLoading] = useState(false);
  const location = useLocation();
  const [problem, setProblem] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const navigate = useNavigate();

  useEffect(() => () => {
    runStream.current?.();
    submitStream.current?.();
  }, [problem?._id]);

  useEffect(() => {
    const fetchProblem = async () => {
      const parts = location.pathname.split('/').filter(Boolean);
      const slug = parts.length ? parts[parts.length - 1] : problemId;
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
  }, [location.pathname, problemId]);

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
    } catch { toast.error("Logout failed"); }
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
  }, [code, storageKey]);

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

  // The list leaves out what the judge measured, so fetch the full submission
  const openSubmission = async (sub) => {
    setSubmitData(sub);
    setActiveTab("result");
    try {
      const res = await axios.get(`/api/submissions/${sub._id}`);
      setSubmitData((cur) => (cur?._id === sub._id ? res.data : cur));
    } catch (err) { console.error("Failed to load submission", err); }
  };

  const handleRun = async () => {
    runStream.current?.();
    setRunAnalysis(null);
    setRunAnalysisPending(false);
    // Show the running state straight away and clear the previous result
    setRunStatus("Running");
    setTestResults([]);
    try {
      console.log({ problemId: problem._id, language, code, customInput });
      const response = await axios.post("/api/submissions/run", { problemId: problem._id, language, code, customInput });
      console.log(response.data);
      runStream.current = subscribeToJudge({
        type: 'RUN', jobId: response.data.jobId,
        onError: () => { setRunStatus(null); toast.error('Lost connection to the judge.'); },
        onAnalysis: data => { setRunAnalysis(data); setRunAnalysisPending(false); },
        onVerdict: data => {
        setRunAnalysisPending(!!data.analysisPending);
        setRunStatus(data.status);
        if (data.status === "accepted") {
          setTestResults([{ type: "accepted", passedCount: data.passedCount ?? data.totalCount, totalCount: data.totalCount, time: `${data.time} ms`, resources: data.resources }]);
          return;
        }
        if (data.status === "wrong_answer") {
          setTestResults([{ type: "wrong_answer", passedCount: data.passedCount ?? 0, totalCount: data.totalCount ?? 0, failedIndex: (data.failedTestCaseIndex ?? 0) + 1, input: data.failedTestCase?.input || "—", expected: data.failedTestCase?.output || "—", output: data.output || "—", time: `${data.time} ms`, resources: data.resources }]);
          return;
        }
        if (data.status === "compilation_error") {
          setTestResults([{ type: "compilation_error", error: data.error, time: `${data.time} ms` }]);
          return;
        }
        if (["runtime_error", "time_limit_exceeded", "memory_limit_exceeded"].includes(data.status)) {
          setTestResults([{ type: data.status, error: data.error, time: `${data.time} ms`, resources: data.resources }]);
          return;
        }
        if (data.status === "error") {
          setTestResults([{ type: "error", error: data.error || "The judge failed to run this code.", time: `${data.time ?? 0} ms` }]);
        }
      }});
    } catch {
      setRunStatus(null);
      toast.error("Failed to run code. Please try again.");
    }
  };

  const handleSubmit = async () => {
    submitStream.current?.();
    // Switch to the Result tab immediately and show a pending verdict
    setSubmitData({ status: "pending" });
    setActiveTab("result");
    try {
      console.log({ problemId: problem._id, language, code });
      const response = await axios.post("/api/submissions/", { problemId: problem._id, language, code });
      console.log(response.data);
      let liveSubmissionId;
      submitStream.current = subscribeToJudge({
        type: 'SUBMIT', jobId: response.data.jobId,
        onError: () => { setSubmitData(null); toast.error('Lost connection to the judge.'); },
        onAnalysis: data => setSubmitData(current => current?.submissionId === liveSubmissionId
          ? { ...current, counterexample: data, analysisPending: false } : current),
        onVerdict: data => {
        liveSubmissionId = data.submissionId;
        setSubmitData(data);
        if (FINAL_STATUSES.includes(data.status)) {
          if (data.status === "accepted") toast.success("Submission accepted");
          else toast.error(labelOf(data.status));
          setActiveTab("result");
        }
      }});
    } catch {
      setSubmitData(null);
      toast.error("Submission failed. Please try again.");
    }
  };

  const languageOptions = [
    { value: "java", label: "Java", monaco: "java" },
    { value: "cpp", label: "C++", monaco: "cpp" },
  ];
  const themeOptions = [
    { value: "auto", label: "Match app" },
    { value: "codeleet-light", label: "Light" },
    { value: "codeleet-dark", label: "Dark" },
    { value: "hc-black", label: "High contrast" },
  ];
  const monacoTheme = editorTheme === "auto" ? (theme === "dark" ? "codeleet-dark" : "codeleet-light") : editorTheme;

  const isRunning = runStatus === "Running";
  const isJudging = !!submitData && !FINAL_STATUSES.includes(submitData.status);

  if (loading) return (
    <div className="ps-fullscreen-center">
      <span className="spinner text-accent" />
      <span>Loading problem…</span>
    </div>
  );
  if (error) return (
    <div className="ps-fullscreen-center">
      <AlertTriangle size={18} className="text-bad" />
      <span className="text-bad">{error}</span>
    </div>
  );
  if (!problem) return (
    <div className="ps-fullscreen-center">
      <span>Problem not found.</span>
    </div>
  );

  const tabs = [
    { id: "description", label: "Description", icon: FileText },
    { id: "submissions", label: "Submissions", icon: History },
    { id: "result", label: "Result", icon: FlaskConical },
  ];

  /* ── left pane: description / submissions / result ── */
  const leftPane = (
    <div className="ps-pane">
      <div className="ps-pane-tabs">
        {tabs.map(({ id, label, icon: Icon }) => (
          <button key={id}
            className={`ps-tab ${activeTab === id ? "ps-tab-active" : ""}`}
            onClick={() => { setActiveTab(id); if (id === "submissions") fetchMySubmissions(); }}>
            <Icon size={14} />
            {label}
            {id === "result" && isJudging && <span className="ps-tab-dot" />}
          </button>
        ))}
      </div>
      <div className="ps-content">
        {/* DESCRIPTION TAB */}
        {activeTab === "description" && <>
          <h1 className="ps-title">{problem.title}</h1>
          <div className="ps-tags">
            <span className={`badge ${DIFF_BADGE[problem.difficulty] || "badge-neutral"}`}>{problem.difficulty}</span>
            {(problem.topics || []).map(t => <span key={t} className="badge badge-neutral">{t}</span>)}
            {problem.stats?.acceptance != null && (
              <span className="ps-tag-meta">Acceptance {Number(problem.stats.acceptance).toFixed(0)}%</span>
            )}
          </div>

          <p className="ps-desc">{problem.description}</p>

          {problem.examples.map((ex, i) => (
            <div key={i} className="ps-example">
              <h3 className="ps-example-title">Example {i + 1}</h3>
              <div className="ps-example-body">
                <div><span className="ps-example-key">Input</span><pre>{ex.input}</pre></div>
                <div><span className="ps-example-key">Output</span><pre>{ex.output}</pre></div>
                {ex.explanation && <div><span className="ps-example-key">Explanation</span><p>{ex.explanation}</p></div>}
              </div>
            </div>
          ))}

          {problem.constraints?.length > 0 && <>
            <h3 className="ps-example-title">Constraints</h3>
            <ul className="ps-constraints">
              {problem.constraints.map((c, i) => <li key={i}><code>{c}</code></li>)}
            </ul>
          </>}
        </>}

        {/* SUBMISSIONS TAB */}
        {activeTab === "submissions" && <>
          {submissionsLoading && <div className="ps-empty"><span className="spinner" />Loading submissions…</div>}
          {!submissionsLoading && submissions.length === 0 && (
            <div className="ps-empty"><History size={20} />No submissions yet</div>
          )}
          {!submissionsLoading && submissions.length > 0 && (
            <div className="ps-sub-list">
              {submissions.map(sub => (
                <button key={sub._id}
                  className="ps-sub-item"
                  onClick={() => openSubmission(sub)}>
                  <span className={`ps-sub-status ps-tone-${toneOf(sub.status)}`}>
                    {sub.status === "accepted" ? <Check size={14} /> : <X size={14} />}
                    {labelOf(sub.status)}
                  </span>
                  {sub.language && <span className="badge badge-neutral">{sub.language === "cpp" ? "C++" : sub.language}</span>}
                  <span className="ps-sub-date">{new Date(sub.createdAt).toLocaleString()}</span>
                </button>
              ))}
            </div>
          )}
        </>}

        {/* RESULT TAB */}
        {activeTab === "result" && <>
          {!submitData ? (
            <div className="ps-empty"><Send size={20} />Submit your code to see the verdict here.</div>
          ) : isJudging ? (
            <div className="ps-judging">
              <span className="spinner ps-judging-spinner" />
              <div>
                <div className="ps-judging-title">Judging your submission</div>
                <div className="ps-judging-sub">
                  {submitData.status === "Running" ? "Running all test cases in the sandbox…" : "Queued, waiting for a worker…"}
                </div>
              </div>
            </div>
          ) : (
            <div className="ps-verdict">
              <div className={`ps-verdict-title ps-tone-${toneOf(submitData.status)}`}>
                {labelOf(submitData.status)}
              </div>
              {submitData.passedCount != null && submitData.totalCount != null && (
                <div className="ps-verdict-sub">{submitData.passedCount} / {submitData.totalCount} test cases passed</div>
              )}

              {!["compilation_error", "error"].includes(submitData.status) && (submitData.time != null || submitData.memory) && (
                <div className="ps-metrics">
                  <div className="ps-metric">
                    <span className="ps-metric-label">Runtime</span>
                    <span className="ps-metric-value">{submitData.time ?? "—"}<small> ms</small></span>
                  </div>
                  <div className="ps-metric">
                    <span className="ps-metric-label">Memory</span>
                    <span className="ps-metric-value">{formatMemory(submitData.memory)}</span>
                  </div>
                </div>
              )}

              {submitData.passedCount != null && submitData.totalCount > 0 && (
                <div className="ps-progress">
                  <div className={`ps-progress-fill ps-fill-${toneOf(submitData.status)}`}
                    style={{ width: `${(submitData.passedCount / submitData.totalCount) * 100}%` }} />
                </div>
              )}

              {submitData.status === "wrong_answer" && submitData.failedTestCase && (
                <div className="ps-case">
                  <div className="ps-case-title">
                    Failed on test case {submitData.failedTestCaseIndex != null ? `#${submitData.failedTestCaseIndex + 1}` : ""}
                  </div>
                  <div className="ps-case-row"><span>Input</span><pre>{submitData.failedTestCase.input}</pre></div>
                  <div className="ps-case-row"><span>Expected</span><pre>{submitData.failedTestCase.output}</pre></div>
                  <div className="ps-case-row"><span>Output</span><pre className="ps-tone-bad">{submitData.output}</pre></div>
                </div>
              )}

              {["compilation_error", "runtime_error", "time_limit_exceeded", "memory_limit_exceeded", "error"].includes(submitData.status) && submitData.error && (
                <pre className={`ps-error ps-error-${toneOf(submitData.status)}`}>{submitData.error}</pre>
              )}

              <ResourceTimeline resources={submitData.resources ?? submitData.analysis?.resources} />
              <Counterexample analysis={submitData.counterexample ?? submitData.analysis?.counterexample} pending={submitData.analysisPending} />
            </div>
          )}
        </>}
      </div>
    </div>
  );

  /* ── editor pane ── */
  const editorPane = (
    <div className="ps-pane">
      <div className="ps-pane-bar">
        <div className="ps-pane-bar-left">
          <select className="ps-select" value={language} onChange={e => setLanguage(e.target.value)} aria-label="Language">
            {languageOptions.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
          </select>
          <select className="ps-select" value={editorTheme} onChange={e => setEditorTheme(e.target.value)} aria-label="Editor theme">
            {themeOptions.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
          </select>
        </div>
        <div className="ps-pane-bar-left">
          <span className="ps-pane-hint">Autosaved</span>
          <button className="btn btn-ghost btn-sm btn-icon" title="Reset to starter code" aria-label="Reset to starter code"
            onClick={() => setCode(problem?.codeTemplates?.[language]?.starter)}>
            <RotateCcw size={14} />
          </button>
        </div>
      </div>
      <div className="ps-editor">
        <Editor height="100%" language={languageOptions.find(l => l.value === language)?.monaco || "javascript"}
          theme={monacoTheme} value={code} onChange={value => setCode(value)}
          beforeMount={defineCodeleetThemes}
          onMount={(_, monaco) => { document.fonts?.ready.then(() => monaco.editor.remeasureFonts()); }}
          options={{ minimap: { enabled: false }, fontSize: 14, fontFamily: "'Geist Mono', ui-monospace, Menlo, monospace", lineHeight: 22, lineNumbers: "on", scrollBeyondLastLine: false, automaticLayout: true, tabSize: 2, wordWrap: "on", padding: { top: 14, bottom: 14 }, renderLineHighlight: "line", scrollbar: { verticalScrollbarSize: 8, horizontalScrollbarSize: 8 } }} />
      </div>
    </div>
  );

  /* ── console pane ── */
  const consolePane = (
    <div className="ps-pane">
      <div className="ps-pane-bar">
        <span className="ps-pane-title"><Terminal size={14} /> Test Result</span>
        {isRunning && <span className="ps-pane-hint ps-tone-info">Running…</span>}
      </div>
      <div className="ps-results-content">
        {isRunning && (
          <div className="ps-running">
            <span className="spinner" />
            Running your code in the sandbox…
          </div>
        )}

        {!isRunning && testResults.length === 0 && (
          <div className="ps-empty ps-empty-sm"><Play size={18} />Run your code to see test results</div>
        )}

        {testResults.map((r, idx) => {
          if (r.type === "accepted") return (
            <div key={idx} className="ps-result">
              <div className="ps-result-head">
                <span className="ps-result-title ps-tone-ok"><Check size={16} strokeWidth={2.5} />Accepted</span>
                <span className="ps-result-time">{r.time}</span>
              </div>
              {r.totalCount != null && <>
                <div className="ps-result-sub">{r.passedCount} / {r.totalCount} test cases passed</div>
                <div className="ps-progress"><div className="ps-progress-fill ps-fill-ok" style={{ width: `${(r.passedCount / r.totalCount) * 100}%` }} /></div>
              </>}
              <ResourceTimeline resources={r.resources} />
            </div>
          );
          if (r.type === "wrong_answer") return (
            <div key={idx} className="ps-result">
              <div className="ps-result-head">
                <span className="ps-result-title ps-tone-bad"><X size={16} strokeWidth={2.5} />Wrong Answer</span>
                <span className="ps-result-time">{r.time}</span>
              </div>
              {r.totalCount != null && <>
                <div className="ps-result-sub">{r.passedCount} / {r.totalCount} test cases passed</div>
                <div className="ps-progress"><div className="ps-progress-fill ps-fill-bad" style={{ width: `${(r.passedCount / r.totalCount) * 100}%` }} /></div>
              </>}
              <div className="ps-case">
                {r.failedIndex != null && <div className="ps-case-title">Failed on test case #{r.failedIndex}</div>}
                <div className="ps-case-row"><span>Input</span><pre>{r.input}</pre></div>
                <div className="ps-case-row"><span>Expected</span><pre>{r.expected}</pre></div>
                <div className="ps-case-row"><span>Output</span><pre className="ps-tone-bad">{r.output}</pre></div>
              </div>
              <ResourceTimeline resources={r.resources} />
            </div>
          );
          return (
            <div key={idx} className="ps-result">
              <div className="ps-result-head">
                <span className={`ps-result-title ps-tone-${toneOf(r.type)}`}><AlertTriangle size={15} />{labelOf(r.type)}</span>
                <span className="ps-result-time">{r.time}</span>
              </div>
              <pre className={`ps-error ps-error-${toneOf(r.type)}`}>{r.error}</pre>
              <ResourceTimeline resources={r.resources} />
            </div>
          );
        })}
        <Counterexample analysis={runAnalysis} pending={runAnalysisPending} />
      </div>
    </div>
  );

  return (
    <div className="ps-page">
      {/* ── HEADER ── */}
      <header className="ps-header">
        <div className="ps-header-left">
          <button className="btn btn-ghost btn-sm btn-icon" onClick={() => navigate("/problems")} aria-label="Back to problems">
            <ChevronLeft size={18} />
          </button>
          <button onClick={() => navigate("/")} aria-label="CodeLeet home" className="ps-logo"><Logo small /></button>
          <span className="ps-header-sep" />
          <span className="ps-header-title">{problem.title}</span>
        </div>

        <div className="ps-header-center">
          <button className="btn btn-secondary btn-sm" onClick={handleRun} disabled={isRunning || isJudging}>
            {isRunning ? <span className="spinner" /> : <Play size={14} />} Run
          </button>
          <button className="btn btn-primary btn-sm" onClick={handleSubmit} disabled={isRunning || isJudging}>
            {isJudging ? <span className="spinner" /> : <Send size={14} />} Submit
          </button>
        </div>

        <div className="ps-header-right">
          <div className={`ps-timer ${isTimerRunning ? "ps-timer-on" : ""}`}>
            <Clock size={14} />
            <span>{formatTime(timer)}</span>
            <button className="ps-timer-btn"
              onClick={() => { if (isTimerRunning) setIsTimerRunning(false); else { setTimer(0); setIsTimerRunning(true); } }}>
              {isTimerRunning ? "Stop" : "Start"}
            </button>
          </div>
          <ThemeToggle className="btn-sm" />
          <LogoutButton onLogout={handleLogout} />
        </div>
      </header>

      {/* ── RESIZABLE WORKSPACE ── */}
      <PanelGroup direction={narrow ? "vertical" : "horizontal"} autoSaveId={narrow ? "codeleet-ps-v" : "codeleet-ps-h"} className="ps-main">
        <Panel defaultSize={42} minSize={22} order={1}>
          {leftPane}
        </Panel>
        <Handle direction={narrow ? "vertical" : "horizontal"} />
        <Panel defaultSize={58} minSize={30} order={2}>
          <PanelGroup direction="vertical" autoSaveId="codeleet-ps-editor">
            <Panel defaultSize={68} minSize={20}>
              {editorPane}
            </Panel>
            <Handle direction="vertical" />
            <Panel defaultSize={32} minSize={12}>
              {consolePane}
            </Panel>
          </PanelGroup>
        </Panel>
      </PanelGroup>
    </div>
  );
};

export default ProblemPage;
