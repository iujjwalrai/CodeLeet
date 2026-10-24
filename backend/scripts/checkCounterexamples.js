// Manual integration check against the LOCAL stack only. Normal submissions
// are created for the existing UI test account; no production URL is accepted.
// Run from the repo root: node backend/scripts/checkCounterexamples.js
const fs = require('fs');
const path = require('path');
const assert = require('node:assert/strict');
const WebSocket = require('ws');
const base = 'http://localhost:8080';
const root = path.join(__dirname, '..', 'problems');
const finalStatuses = new Set(['accepted', 'wrong_answer', 'runtime_error', 'memory_limit_exceeded', 'time_limit_exceeded', 'compilation_error', 'error']);
let token;

async function request(url, body) {
  const response = await fetch(base + url, {
    method: body ? 'POST' : 'GET',
    headers: { 'content-type': 'application/json', ...(token ? { authorization: `Bearer ${token}` } : {}) },
    ...(body ? { body: JSON.stringify(body) } : {}),
  });
  if (!response.ok) throw Error(`${response.status} ${url}`);
  return response.json();
}

function observe(type, jobId, requireAnalysisEvent = false) {
  return new Promise((resolve, reject) => {
    const ws = new WebSocket('ws://localhost:8080/ws');
    const messages = []; let verdict, analysis, settled = false;
    const done = (error) => {
      if (settled) return;
      settled = true;clearTimeout(timer);ws.close();
      if (error) reject(error);else resolve({ verdict, analysis, messages });
    };
    const timer = setTimeout(() => done(Error(`Timed out ${type} ${jobId}`)), 120000);
    ws.on('open', () => ws.send(JSON.stringify({ type, jobId })));
    ws.on('error', error => done(error));
    ws.on('message', raw => {
      try {
        const message = JSON.parse(raw.toString());
        if (String(message.jobId) !== String(jobId)) return;
        messages.push(message.data);
        if (message.data.type === 'ANALYSIS') analysis = message.data;
        else if (finalStatuses.has(message.data.status)) verdict = message.data;
        if (verdict && (!verdict.analysisPending || analysis)
            && (!requireAnalysisEvent || analysis)) {
          analysis ||= verdict.counterexample;
          done();
        }
      } catch (error) { done(error); }
    });
  });
}

async function check({ slug, type, language, code, expected, found = false, generated = false, replay = false }) {
  const problem = await request('/api/problems/' + slug);
  assert.equal(problem.analysisTools, undefined);
  assert.equal(problem.testCases, undefined);
  assert.equal(problem.codeTemplates.cpp.driver, undefined);
  const posted = await request(type === 'RUN' ? '/api/submissions/run' : '/api/submissions', { problemId: problem._id, language, code });
  const result = await observe(type, posted.jobId);
  assert.equal(result.verdict.status, expected);
  if (found) {
    assert.equal(result.analysis?.status, 'found', JSON.stringify(result.analysis));
    assert.equal(result.analysis.failureStatus, expected);
    assert.equal(result.analysis.repetitions, 2);
    if (generated) assert.ok(Number.isInteger(result.analysis.n), 'Expected an actual regenerated counterexample');
    assert.ok(result.messages.findIndex(m => m.status === expected) < result.messages.findIndex(m => m.type === 'ANALYSIS'));
    if (type === 'SUBMIT') {
      const saved = await request('/api/submissions/' + result.verdict.submissionId);
      assert.equal(saved.status, expected);
      assert.equal(saved.analysis.counterexample.status, 'found');
      assert.ok(saved.analysis.resources, 'Resource measurements must survive analysis writes');
    }
  } else {
    assert.equal(result.verdict.analysisPending, false);
    assert.equal(result.analysis, undefined);
  }
  if (replay) {
    const cached = await observe(type, posted.jobId, true);
    assert.equal(cached.verdict.status, expected);
    assert.equal(cached.analysis.status, 'found');
    assert.equal(cached.verdict.counterexample.status, 'found');
  }
  console.log(JSON.stringify({ slug, type, language, verdict: expected, analysis: result.analysis?.status || 'not_requested', n: result.analysis?.n, replay }));
}

(async () => {
  const login = await request('/api/auth/login', { email: 'uitest@example.com', password: 'uitest123' });token = login.token;
  const list = await request('/api/problems?limit=100');
  assert.equal(list.meta.total, 55);
  for (const p of list.data) assert.equal(p.analysisTools, undefined);
  for (const language of ['cpp', 'java']) {
    const bad = language === 'cpp'
      ? 'class Solution {public:int maxSubArray(vector<int>& nums){return 0;}};'
      : 'class Solution {public int maxSubArray(int[] nums){return 0;}}';
    const good = fs.readFileSync(path.join(root, 'maximum-subarray', `reference.${language}`), 'utf8');
    for (const type of ['RUN', 'SUBMIT']) {
      await check({ slug: 'maximum-subarray', type, language, code: bad, expected: 'wrong_answer', found: true, replay: type === 'SUBMIT' && language === 'cpp' });
      await check({ slug: 'maximum-subarray', type, language, code: good, expected: 'accepted' });
    }
    const conditional = language === 'cpp'
      ? 'class Solution {public:int lengthOfLIS(vector<int>& a){if(a.size()>100)return 0;vector<int>t;for(int x:a){auto p=lower_bound(t.begin(),t.end(),x);if(p==t.end())t.push_back(x);else *p=x;}return t.size();}};'
      : 'import java.util.*;class Solution {public int lengthOfLIS(int[] a){if(a.length>100)return 0;int[]t=new int[a.length];int n=0;for(int x:a){int p=Arrays.binarySearch(t,0,n,x);if(p<0)p=-p-1;t[p]=x;if(p==n)n++;}return n;}}';
    await check({ slug: 'longest-increasing-subsequence', type: 'SUBMIT', language, code: conditional, expected: 'wrong_answer', found: true, generated: true });
  }
  await check({ slug: 'sliding-window-maximum', type: 'RUN', language: 'cpp', code: 'class Solution {public:vector<int> maxSlidingWindow(vector<int>& a,int k){while(true){}}};', expected: 'time_limit_exceeded', found: true });
  await check({ slug: 'maximum-subarray', type: 'SUBMIT', language: 'cpp', code: 'class Solution {public:int maxSubArray(vector<int>& a){throw runtime_error("demo");}};', expected: 'runtime_error', found: true });
  await check({ slug: 'maximum-subarray', type: 'SUBMIT', language: 'java', code: 'class Solution {public int maxSubArray(int[] a){int[] huge=new int[Integer.MAX_VALUE];return huge.length;}}', expected: 'memory_limit_exceeded', found: true });
  await check({ slug: 'maximum-subarray', type: 'RUN', language: 'cpp', code: 'class Solution { public: int maxSubArray(vector<int>& a) { invalid syntax; } };', expected: 'compilation_error' });
  console.log('Phase 3 local smoke checks passed.');
})().catch(error => { console.error(error);process.exitCode = 1; });
