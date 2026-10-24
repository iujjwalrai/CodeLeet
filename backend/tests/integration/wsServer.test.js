const WebSocket = require('ws');
const server = require('../../app');
const { closeWebSocket } = require('../../wsServer');
const pubsub = require('../../config/redispubsub');
const cache = require('../../config/redis');
const Submission = require('../../models/Submission');
const { useTestDb } = require('../helpers/db');
const { createUser, createProblem, createSubmission } = require('../helpers/factories');

useTestDb();

let url;
beforeAll(async () => {
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  url = `ws://127.0.0.1:${server.address().port}`;
});
afterAll(async () => {
  await new Promise((resolve) => server.close(resolve));
});

const openClient = async () => {
  const ws = new WebSocket(url);
  const messages = [];
  ws.on('message', (raw) => messages.push(JSON.parse(raw.toString())));
  await new Promise((resolve, reject) => {
    ws.once('open', resolve);
    ws.once('error', reject);
  });
  return { ws, messages };
};

const close = (ws) =>
  new Promise((resolve) => {
    ws.once('close', resolve);
    ws.close();
  });

// Polls until fn() resolves truthy; the WebSocket and pub/sub hops are async.
const waitFor = async (fn, timeout = 2000) => {
  const start = Date.now();
  while (!(await fn())) {
    if (Date.now() - start > timeout) throw new Error('waitFor timed out');
    await new Promise((resolve) => setTimeout(resolve, 10));
  }
};

// What a worker would publish to Redis.
const publish = (channel, jobId, data) => pubsub.emit('message', channel, JSON.stringify({ jobId, data }));

describe('WebSocket job updates', () => {
  it('subscribes to the run channel and forwards updates for that job', async () => {
    const { ws, messages } = await openClient();

    ws.send(JSON.stringify({ type: 'RUN', jobId: '7' }));
    await waitFor(() => pubsub.subscribe.mock.calls.length === 1);
    expect(pubsub.subscribe).toHaveBeenCalledWith('job-updates:7');

    publish('job-updates:7', '7', { status: 'accepted', passedCount: 2 });
    await waitFor(() => messages.length === 1);

    expect(messages[0]).toEqual({ jobId: '7', data: { status: 'accepted', passedCount: 2 } });
    await close(ws);
  });

  it('subscribes to the submission channel for SUBMIT', async () => {
    const { ws } = await openClient();

    ws.send(JSON.stringify({ type: 'SUBMIT', jobId: '8' }));
    await waitFor(() => pubsub.subscribe.mock.calls.length === 1);

    expect(pubsub.subscribe).toHaveBeenCalledWith('job-updates-submission:8');
    await close(ws);
  });

  it('does not forward updates for other jobs', async () => {
    const { ws, messages } = await openClient();
    ws.send(JSON.stringify({ type: 'RUN', jobId: '1' }));
    await waitFor(() => pubsub.subscribe.mock.calls.length === 1);

    publish('job-updates:2', '2', { status: 'accepted' });
    publish('job-updates:1', '1', { status: 'Running' });
    await waitFor(() => messages.length === 1);

    expect(messages[0].jobId).toBe('1');
    await close(ws);
  });

  it('replays the cached status when the worker finished before the client subscribed', async () => {
    const cached = JSON.stringify({ jobId: '9', data: { status: 'accepted' } });
    cache.get.mockResolvedValueOnce(cached);
    const { ws, messages } = await openClient();

    ws.send(JSON.stringify({ type: 'RUN', jobId: '9' }));
    await waitFor(() => messages.length === 1);

    expect(cache.get).toHaveBeenCalledWith('job-cache:job-updates:9');
    expect(messages[0]).toEqual({ jobId: '9', data: { status: 'accepted' } });
    await close(ws);
  });

  it('replays a verdict and its separate ANALYSIS event in order', async () => {
    const verdict = { jobId: '19', data: { status: 'wrong_answer', analysisPending: true } };
    const analysis = { jobId: '19', data: { type: 'ANALYSIS', status: 'found', input: '[1]' } };
    cache.get.mockResolvedValueOnce(JSON.stringify(verdict)).mockResolvedValueOnce(JSON.stringify(analysis));
    const { ws, messages } = await openClient();
    ws.send(JSON.stringify({ type: 'RUN', jobId: '19' }));
    await waitFor(() => messages.length === 2);
    expect(messages).toEqual([verdict, analysis]);
    await close(ws);
  });

  it('keeps RUN and SUBMIT analysis separate even when queue IDs overlap', async () => {
    const a = await openClient(), b = await openClient();
    a.ws.send(JSON.stringify({ type: 'RUN', jobId: '20' }));
    b.ws.send(JSON.stringify({ type: 'SUBMIT', jobId: '20' }));
    await waitFor(() => pubsub.subscribe.mock.calls.length === 2);
    publish('job-updates:20', '20', { type: 'ANALYSIS', status: 'not_found' });
    publish('job-updates-submission:20', '20', { type: 'ANALYSIS', status: 'found' });
    await waitFor(() => a.messages.length === 1 && b.messages.length === 1);
    expect(a.messages[0].data.status).toBe('not_found');
    expect(b.messages[0].data.status).toBe('found');
    await close(a.ws);await close(b.ws);
  });

  it('ignores malformed and unknown messages', async () => {
    const { ws } = await openClient();

    ws.send('not json');
    ws.send(JSON.stringify({ type: 'DELETE_EVERYTHING', jobId: '1' }));
    ws.send(JSON.stringify({ type: 'RUN' }));
    ws.send(JSON.stringify({ type: 'RUN', jobId: '3' }));
    await waitFor(() => pubsub.subscribe.mock.calls.length === 1);

    expect(pubsub.subscribe).toHaveBeenCalledWith('job-updates:3');
    expect(ws.readyState).toBe(WebSocket.OPEN);
    await close(ws);
  });

  it('unsubscribes when the client disconnects', async () => {
    const { ws } = await openClient();
    ws.send(JSON.stringify({ type: 'RUN', jobId: '5' }));
    await waitFor(() => pubsub.subscribe.mock.calls.length === 1);

    await close(ws);
    await waitFor(() => pubsub.unsubscribe.mock.calls.length === 1);

    expect(pubsub.unsubscribe).toHaveBeenCalledWith('job-updates:5');
  });
});

describe('submission verdicts', () => {
  // The submission worker saves verdicts (see unit/submissionWorker.test.js).
  // If the WebSocket server also wrote them, every API replica holding a
  // subscriber would write the same verdict again.
  it('only forwards final verdicts and leaves the database to the worker', async () => {
    const user = await createUser();
    const problem = await createProblem();
    const submission = await createSubmission(user, problem);
    const { ws, messages } = await openClient();
    ws.send(JSON.stringify({ type: 'SUBMIT', jobId: '11' }));
    await waitFor(() => pubsub.subscribe.mock.calls.length === 1);

    publish('job-updates-submission:11', '11', {
      type: 'SUBMIT',
      submissionId: submission._id.toString(),
      status: 'wrong_answer',
      output: '11',
    });
    await waitFor(() => messages.length === 1);
    await new Promise((resolve) => setTimeout(resolve, 50));

    expect(messages[0].data.status).toBe('wrong_answer');
    expect((await Submission.findById(submission._id)).status).toBe('in_queue');
    await close(ws);
  });
});

// Keep last: closes the WebSocket server for the rest of this file.
describe('closeWebSocket', () => {
  it('tells connected clients the server is going away (1001)', async () => {
    const { ws } = await openClient();
    const closed = new Promise((resolve) => ws.once('close', (code) => resolve(code)));

    await closeWebSocket();

    await expect(closed).resolves.toBe(1001);
  });
});
