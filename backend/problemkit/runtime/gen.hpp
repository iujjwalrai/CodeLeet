// Placed before every problem's generator.cpp. A generator defines
//
//   void generate(long long n, Rng& rng)
//
// and prints one test input with the emit* helpers, one call per argument
// in the function's parameter order. The seed script runs it with "n seed"
// on stdin; the same n and seed must always print the same input, so all
// randomness comes from rng.
#include <bits/stdc++.h>
using namespace std;

// splitmix64: small, fast and the same on every platform
struct Rng {
    uint64_t state;
    explicit Rng(uint64_t seed) : state(seed) {}
    uint64_t next() {
        uint64_t z = (state += 0x9E3779B97F4A7C15ULL);
        z = (z ^ (z >> 30)) * 0xBF58476D1CE4E5B9ULL;
        z = (z ^ (z >> 27)) * 0x94D049BB133111EBULL;
        return z ^ (z >> 31);
    }
    // Uniform in [lo, hi], both inclusive
    long long range(long long lo, long long hi) { return lo + (long long)(next() % (uint64_t)(hi - lo + 1)); }
    bool chance(double p) { return (next() >> 11) * 0x1.0p-53 < p; }
    template <class T> void shuffle(vector<T> &v) {
        for (size_t i = v.size(); i > 1; i--) swap(v[i - 1], v[range(0, i - 1)]);
    }
    template <class T> const T &pick(const vector<T> &v) { return v[range(0, (long long)v.size() - 1)]; }
};

static string GEN_OUT;

inline void genString(const string &t) {
    GEN_OUT += '"';
    for (unsigned char c : t) {
        if (c == '"' || c == '\\') { GEN_OUT += '\\'; GEN_OUT += (char)c; }
        else if (c < 0x20) { char b[8]; snprintf(b, sizeof b, "\\u%04x", c); GEN_OUT += b; }
        else GEN_OUT += (char)c;
    }
    GEN_OUT += '"';
}

inline void emitInt(long long v) { GEN_OUT += to_string(v); GEN_OUT += '\n'; }
inline void emitBool(bool b) { GEN_OUT += b ? "true\n" : "false\n"; }
inline void emitString(const string &t) { genString(t); GEN_OUT += '\n'; }

// int[], long[], and a linked list's values
template <class T> void emitInts(const vector<T> &v) {
    GEN_OUT += '[';
    for (size_t i = 0; i < v.size(); i++) { if (i) GEN_OUT += ','; GEN_OUT += to_string(v[i]); }
    GEN_OUT += "]\n";
}

// string[], and char[][] as its rows
inline void emitStrings(const vector<string> &v) {
    GEN_OUT += '[';
    for (size_t i = 0; i < v.size(); i++) { if (i) GEN_OUT += ','; genString(v[i]); }
    GEN_OUT += "]\n";
}

template <class T> void emitIntGrid(const vector<vector<T>> &g) {
    GEN_OUT += '[';
    for (size_t i = 0; i < g.size(); i++) {
        if (i) GEN_OUT += ',';
        GEN_OUT += '[';
        for (size_t j = 0; j < g[i].size(); j++) { if (j) GEN_OUT += ','; GEN_OUT += to_string(g[i][j]); }
        GEN_OUT += ']';
    }
    GEN_OUT += "]\n";
}

// Level order, nullopt for a missing child; trailing nulls are dropped
inline void emitTree(vector<optional<int>> v) {
    while (!v.empty() && !v.back()) v.pop_back();
    GEN_OUT += '[';
    for (size_t i = 0; i < v.size(); i++) {
        if (i) GEN_OUT += ',';
        GEN_OUT += v[i] ? to_string(*v[i]) : "null";
    }
    GEN_OUT += "]\n";
}

// Level-order form of a tree given as parent links: children[i] = {left, right}, -1 for none
inline vector<optional<int>> levelOrder(const vector<int> &vals, const vector<pair<int, int>> &children, int root) {
    vector<optional<int>> out;
    if (root < 0) return out;
    vector<int> q{root};
    for (size_t k = 0; k < q.size(); k++) {
        int u = q[k];
        if (u < 0) { out.push_back(nullopt); continue; }
        out.push_back(vals[u]);
        q.push_back(children[u].first);
        q.push_back(children[u].second);
    }
    return out;
}

void generate(long long n, Rng &rng);

int main() {
    long long n;
    unsigned long long seed;
    if (!(cin >> n >> seed)) return 2;
    Rng rng(seed);
    generate(n, rng);
    fwrite(GEN_OUT.data(), 1, GEN_OUT.size(), stdout);
    return 0;
}

#line 1 "generator.cpp"
