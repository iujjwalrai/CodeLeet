/*
 * cl-meter: runs one judging job inside the sandbox container.
 *
 *   cl-meter /app/job.conf
 *
 * Compiles the code once, then runs every test case one after another in
 * the same container. Each run is measured from outside the program: wall
 * and CPU time, peak memory and a memory/CPU timeline sampled from /proc.
 * The time and memory limits are enforced here per test case. The program's
 * output goes to files, and a single JSON report is printed on stdout at the
 * end. Output is compared on the host, so expected outputs never enter the
 * container.
 *
 * job.conf is key=value lines:
 *   compile      shell command, run in workdir (optional)
 *   run          single command (no && or pipes), run in workdir per test
 *   tests_dir    directory holding 0.in, 1.in, ...
 *   count        number of tests
 *   workdir      writable directory to compile and run in
 *   time_ms      wall-time limit per test          (default 3000)
 *   mem_kb       resident-memory limit per test    (default 262144)
 *   compile_ms   wall-time limit for compiling     (default 15000)
 *   stop_on_limit  1 = stop after a test hits a limit or is killed
 */
#define _GNU_SOURCE
#include <errno.h>
#include <fcntl.h>
#include <signal.h>
#include <stdio.h>
#include <stdlib.h>
#include <string.h>
#include <sys/prctl.h>
#include <sys/resource.h>
#include <sys/stat.h>
#include <sys/types.h>
#include <sys/wait.h>
#include <time.h>
#include <unistd.h>

#define SAMPLE_US 5000          /* poll interval */
#define MAX_SAMPLES 4096        /* kept before thinning */
#define TIMELINE_POINTS 100     /* points reported per test */
#define OUT_CAP (4L << 20)      /* program stdout kept per test */
#define LOG_CAP (64L << 10)     /* stderr / compiler log kept */
#define META_DIR "/tmp/.cl"

struct conf {
  char compile[4096];
  char run[4096];
  char tests_dir[512];
  char workdir[512];
  int count;
  long time_ms;
  long mem_kb;
  long compile_ms;
  int stop_on_limit;
};

struct sample { double t; long rss_kb; double cpu_ms; };

struct outcome {
  int exit_code;
  int signal;
  int tle;
  int mle;
  double wall_ms;
  double cpu_ms;
  long peak_kb;
  struct sample *samples;
  int n_samples;
};

static double now_ms(void) {
  struct timespec ts;
  clock_gettime(CLOCK_MONOTONIC, &ts);
  return ts.tv_sec * 1e3 + ts.tv_nsec / 1e6;
}

/* ---------------- config ---------------- */

static void copy_value(char *dst, size_t cap, const char *src) {
  snprintf(dst, cap, "%s", src);
}

static int read_conf(const char *path, struct conf *c) {
  FILE *f = fopen(path, "r");
  if (!f) return -1;
  memset(c, 0, sizeof *c);
  c->time_ms = 3000;
  c->mem_kb = 262144;
  c->compile_ms = 15000;
  copy_value(c->workdir, sizeof c->workdir, "/tmp/w");

  char line[8192];
  while (fgets(line, sizeof line, f)) {
    line[strcspn(line, "\r\n")] = 0;
    char *eq = strchr(line, '=');
    if (!eq) continue;
    *eq = 0;
    const char *k = line, *v = eq + 1;
    if (!strcmp(k, "compile")) copy_value(c->compile, sizeof c->compile, v);
    else if (!strcmp(k, "run")) copy_value(c->run, sizeof c->run, v);
    else if (!strcmp(k, "tests_dir")) copy_value(c->tests_dir, sizeof c->tests_dir, v);
    else if (!strcmp(k, "workdir")) copy_value(c->workdir, sizeof c->workdir, v);
    else if (!strcmp(k, "count")) c->count = atoi(v);
    else if (!strcmp(k, "time_ms")) c->time_ms = atol(v);
    else if (!strcmp(k, "mem_kb")) c->mem_kb = atol(v);
    else if (!strcmp(k, "compile_ms")) c->compile_ms = atol(v);
    else if (!strcmp(k, "stop_on_limit")) c->stop_on_limit = atoi(v);
  }
  fclose(f);
  return c->run[0] ? 0 : -1;
}

/* ---------------- /proc readers ---------------- */

static long read_rss_kb(pid_t pid) {
  char path[64];
  snprintf(path, sizeof path, "/proc/%d/statm", (int)pid);
  FILE *f = fopen(path, "r");
  if (!f) return -1;
  long size = 0, resident = 0;
  int ok = fscanf(f, "%ld %ld", &size, &resident) == 2;
  fclose(f);
  return ok ? resident * (sysconf(_SC_PAGESIZE) / 1024) : -1;
}

static double read_cpu_ms(pid_t pid) {
  char path[64], buf[1024];
  snprintf(path, sizeof path, "/proc/%d/stat", (int)pid);
  FILE *f = fopen(path, "r");
  if (!f) return -1;
  size_t n = fread(buf, 1, sizeof buf - 1, f);
  fclose(f);
  buf[n] = 0;
  /* Fields after the ")" that closes the command name: state is field 3,
     utime and stime are fields 14 and 15. */
  char *p = strrchr(buf, ')');
  if (!p) return -1;
  unsigned long utime = 0, stime = 0;
  if (sscanf(p + 2, "%*c %*d %*d %*d %*d %*d %*u %*u %*u %*u %*u %lu %lu", &utime, &stime) != 2) return -1;
  return (utime + stime) * 1000.0 / sysconf(_SC_CLK_TCK);
}

/* ---------------- running a child ---------------- */

/* use_exec: run `cmd` as `exec cmd` so the shell replaces itself and the
   measured pid is the program. Only for simple commands (the run step). */
static pid_t spawn(const char *cmd, const char *in_path, const char *out_path, const char *err_path, const char *workdir, int use_exec) {
  pid_t pid = fork();
  if (pid < 0) return -1;
  if (pid == 0) {
    setpgid(0, 0);
    int in = open(in_path ? in_path : "/dev/null", O_RDONLY);
    int out = open(out_path, O_WRONLY | O_CREAT | O_TRUNC, 0600);
    int err = err_path ? open(err_path, O_WRONLY | O_CREAT | O_TRUNC, 0600) : out;
    if (in < 0 || out < 0 || err < 0) _exit(126);
    dup2(in, 0);
    dup2(out, 1);
    dup2(err, 2);
    for (int fd = 3; fd < 64; fd++) close(fd);
    if (chdir(workdir) != 0) _exit(126);
    char wrapped[4200];
    snprintf(wrapped, sizeof wrapped, "%s%s", use_exec ? "exec " : "", cmd);
    execl("/bin/sh", "sh", "-c", wrapped, (char *)NULL);
    _exit(127);
  }
  setpgid(pid, pid);
  return pid;
}

static void add_sample(struct outcome *o, int *stride, int *tick, double t, long rss, double cpu) {
  if ((*tick)++ % *stride) return;
  if (o->n_samples == MAX_SAMPLES) {
    /* Full: keep every other sample and record half as often from now on */
    for (int i = 0; i < MAX_SAMPLES / 2; i++) o->samples[i] = o->samples[i * 2];
    o->n_samples = MAX_SAMPLES / 2;
    *stride *= 2;
  }
  o->samples[o->n_samples++] = (struct sample){ t, rss, cpu };
}

static void watch(pid_t pid, long limit_ms, long mem_kb, int track, struct outcome *o) {
  memset(o, 0, sizeof *o);
  if (track) o->samples = malloc(sizeof(struct sample) * MAX_SAMPLES);
  int stride = 1, tick = 0, killed = 0;
  double start = now_ms();

  for (;;) {
    int st;
    struct rusage ru;
    pid_t r = wait4(pid, &st, WNOHANG, &ru);
    double t = now_ms() - start;
    if (r == pid) {
      o->wall_ms = t;
      o->cpu_ms = ru.ru_utime.tv_sec * 1e3 + ru.ru_utime.tv_usec / 1e3 + ru.ru_stime.tv_sec * 1e3 + ru.ru_stime.tv_usec / 1e3;
      if (ru.ru_maxrss > o->peak_kb) o->peak_kb = ru.ru_maxrss;
      if (WIFEXITED(st)) o->exit_code = WEXITSTATUS(st);
      if (WIFSIGNALED(st)) o->signal = WTERMSIG(st);
      break;
    }
    if (r < 0 && errno != EINTR) break;

    if (track && !killed) {
      long rss = read_rss_kb(pid);
      double cpu = read_cpu_ms(pid);
      if (rss >= 0 && cpu >= 0) {
        if (rss > o->peak_kb) o->peak_kb = rss;
        add_sample(o, &stride, &tick, t, rss, cpu);
      }
      if (mem_kb > 0 && rss > mem_kb) { o->mle = 1; killed = 1; kill(-pid, SIGKILL); }
    }
    if (!killed && t > limit_ms) { o->tle = 1; killed = 1; kill(-pid, SIGKILL); }
    /* Poll faster at first so short runs still get a precise wall time */
    usleep(t < 50 ? 1000 : SAMPLE_US);
  }
  /* Take down anything the program left running in its process group */
  kill(-pid, SIGKILL);
}

/* ---------------- JSON output ---------------- */

static void json_str(const char *s, size_t n) {
  putchar('"');
  for (size_t i = 0; i < n; i++) {
    unsigned char ch = (unsigned char)s[i];
    switch (ch) {
      case '"': fputs("\\\"", stdout); break;
      case '\\': fputs("\\\\", stdout); break;
      case '\n': fputs("\\n", stdout); break;
      case '\r': fputs("\\r", stdout); break;
      case '\t': fputs("\\t", stdout); break;
      default:
        if (ch < 0x20 || ch == 0x7f) printf("\\u%04x", ch);
        else putchar(ch);
    }
  }
  putchar('"');
}

/* Prints a file's first `cap` bytes as a JSON string; returns 1 if cut off */
static int json_file(const char *path, long cap) {
  FILE *f = fopen(path, "rb");
  if (!f) { json_str("", 0); return 0; }
  char *buf = malloc(cap + 1);
  size_t n = fread(buf, 1, cap, f);
  int more = fgetc(f) != EOF;
  fclose(f);
  json_str(buf, n);
  free(buf);
  return more;
}

static void json_timeline(const struct outcome *o) {
  putchar('[');
  int step = o->n_samples > TIMELINE_POINTS ? (o->n_samples + TIMELINE_POINTS - 1) / TIMELINE_POINTS : 1;
  int first = 1;
  for (int i = 0; i < o->n_samples; i += step) {
    const struct sample *s = &o->samples[i];
    printf("%s[%.1f,%ld,%.1f]", first ? "" : ",", s->t, s->rss_kb, s->cpu_ms);
    first = 0;
  }
  putchar(']');
}

int main(int argc, char **argv) {
  /* Keep our /proc entries (open fds, memory) out of the program's reach */
  prctl(PR_SET_DUMPABLE, 0);

  struct conf c;
  if (argc < 2 || read_conf(argv[1], &c) != 0) {
    fprintf(stderr, "cl-meter: cannot read job config\n");
    return 2;
  }
  mkdir(c.workdir, 0755);
  mkdir(META_DIR, 0700);
  const char *log_path = META_DIR "/compile.log";
  const char *out_path = META_DIR "/out";
  const char *err_path = META_DIR "/err";

  printf("{\"version\":1,\"compile\":");
  int compiled = 1;
  if (c.compile[0]) {
    struct outcome o;
    pid_t pid = spawn(c.compile, NULL, log_path, NULL, c.workdir, 0);
    if (pid < 0) {
      printf("{\"ran\":true,\"ok\":false,\"exit\":-1,\"signal\":0,\"tle\":false,\"wallMs\":0,\"log\":\"could not start the compiler\"},\"tests\":[]}\n");
      return 0;
    }
    watch(pid, c.compile_ms, 0, 0, &o);
    compiled = !o.tle && !o.signal && o.exit_code == 0;
    printf("{\"ran\":true,\"ok\":%s,\"exit\":%d,\"signal\":%d,\"tle\":%s,\"wallMs\":%.1f,\"log\":",
           compiled ? "true" : "false", o.exit_code, o.signal, o.tle ? "true" : "false", o.wall_ms);
    json_file(log_path, LOG_CAP);
    putchar('}');
  } else {
    printf("{\"ran\":false,\"ok\":true}");
  }

  printf(",\"tests\":[");
  for (int i = 0; compiled && i < c.count; i++) {
    char in_path[600];
    snprintf(in_path, sizeof in_path, "%s/%d.in", c.tests_dir, i);
    struct outcome o;
    pid_t pid = spawn(c.run, in_path, out_path, err_path, c.workdir, 1);
    if (pid < 0) break;
    watch(pid, c.time_ms, c.mem_kb, 1, &o);

    printf("%s{\"exit\":%d,\"signal\":%d,\"tle\":%s,\"mle\":%s,\"wallMs\":%.1f,\"cpuMs\":%.1f,\"peakKb\":%ld,\"stdout\":",
           i ? "," : "", o.exit_code, o.signal, o.tle ? "true" : "false", o.mle ? "true" : "false",
           o.wall_ms, o.cpu_ms, o.peak_kb);
    int cut = json_file(out_path, OUT_CAP);
    printf(",\"stdoutTruncated\":%s,\"stderr\":", cut ? "true" : "false");
    json_file(err_path, LOG_CAP);
    printf(",\"timeline\":");
    json_timeline(&o);
    putchar('}');
    free(o.samples);
    fflush(stdout);

    if (c.stop_on_limit && (o.tle || o.mle || o.signal == SIGKILL)) break;
  }
  printf("]}\n");
  return 0;
}
