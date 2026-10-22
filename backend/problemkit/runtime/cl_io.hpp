// Reads a test's input (one JSON value per argument) and writes the result
// as JSON with no spaces, the same text JSON.stringify produces. It sits
// before the user's code, so a macro like `#define int long long` in
// Solution.cpp can't change it.
namespace cl_io {

// More nodes than this in a returned list or tree means a cycle
const size_t NODE_LIMIT = 2000000;

[[noreturn]] inline void fail(const char *what) {
    fprintf(stderr, "Judge error: test input is malformed (%s)\n", what);
    exit(3);
}

[[noreturn]] inline void tooLong(const char *what) {
    fprintf(stderr, "The returned %s has a cycle or more than %zu nodes\n", what, NODE_LIMIT);
    exit(1);
}

struct Reader {
    std::string s;
    size_t i = 0;

    Reader() {
        std::istreambuf_iterator<char> begin(std::cin), end;
        s.assign(begin, end);
    }

    void skip() { while (i < s.size() && isspace((unsigned char)s[i])) i++; }
    bool at(char c) { skip(); return i < s.size() && s[i] == c; }
    void expect(char c) { if (!at(c)) fail("unexpected character"); i++; }
    bool word(const char *w) {
        skip();
        size_t n = strlen(w);
        if (s.compare(i, n, w) != 0) return false;
        i += n;
        return true;
    }

    template <class F>
    auto array(F item) -> std::vector<decltype(item())> {
        std::vector<decltype(item())> v;
        expect('[');
        if (at(']')) { i++; return v; }
        for (;;) {
            v.push_back(item());
            if (at(',')) { i++; continue; }
            expect(']');
            return v;
        }
    }

    long long readLong() {
        skip();
        bool neg = i < s.size() && s[i] == '-';
        if (neg) i++;
        if (i >= s.size() || !isdigit((unsigned char)s[i])) fail("expected a number");
        unsigned long long v = 0;
        while (i < s.size() && isdigit((unsigned char)s[i])) v = v * 10 + (s[i++] - '0');
        return neg ? (long long)(0ULL - v) : (long long)v;
    }
    int readInt() { return (int)readLong(); }
    bool readBool() {
        if (word("true")) return true;
        if (word("false")) return false;
        fail("expected true or false");
    }
    std::string readString() {
        expect('"');
        std::string r;
        for (;;) {
            if (i >= s.size()) fail("unterminated string");
            char c = s[i++];
            if (c == '"') return r;
            if (c != '\\') { r += c; continue; }
            if (i >= s.size()) fail("bad escape");
            switch (s[i++]) {
                case '"': r += '"'; break;
                case '\\': r += '\\'; break;
                case '/': r += '/'; break;
                case 'b': r += '\b'; break;
                case 'f': r += '\f'; break;
                case 'n': r += '\n'; break;
                case 'r': r += '\r'; break;
                case 't': r += '\t'; break;
                case 'u':
                    if (i + 4 > s.size()) fail("bad escape");
                    r += (char)std::stoi(s.substr(i, 4), nullptr, 16);  // tests are ASCII
                    i += 4;
                    break;
                default: fail("bad escape");
            }
        }
    }

    std::vector<int> readIntArray() { return array([&] { return readInt(); }); }
    std::vector<long long> readLongArray() { return array([&] { return readLong(); }); }
    std::vector<std::string> readStringArray() { return array([&] { return readString(); }); }
    std::vector<std::vector<int>> readIntGrid() { return array([&] { return readIntArray(); }); }
    std::vector<std::vector<char>> readCharGrid() {
        return array([&] { std::string row = readString(); return std::vector<char>(row.begin(), row.end()); });
    }
    ListNode *readList() {
        std::vector<int> vals = readIntArray();
        ListNode *head = nullptr;
        for (size_t k = vals.size(); k-- > 0;) head = new ListNode(vals[k], head);
        return head;
    }
    // Level order with null for missing children; each node in turn takes
    // the next two entries as its children
    TreeNode *readTree() {
        std::vector<TreeNode *> nodes = array([&]() -> TreeNode * {
            if (word("null")) return nullptr;
            return new TreeNode(readInt());
        });
        if (nodes.empty() || !nodes[0]) return nullptr;
        size_t next = 1;
        for (size_t k = 0; k < nodes.size() && next < nodes.size(); k++) {
            if (!nodes[k]) continue;
            nodes[k]->left = nodes[next++];
            if (next < nodes.size()) nodes[k]->right = nodes[next++];
        }
        return nodes[0];
    }
};

struct Writer {
    std::string o;

    template <class T, class F>
    void array(const std::vector<T> &v, F item) {
        o += '[';
        for (size_t k = 0; k < v.size(); k++) {
            if (k) o += ',';
            item(v[k]);
        }
        o += ']';
    }

    void writeLong(long long v) { o += std::to_string(v); }
    void writeInt(long long v) { writeLong(v); }
    void writeBool(bool b) { o += b ? "true" : "false"; }
    void writeString(const std::string &t) {
        o += '"';
        for (unsigned char c : t) {
            switch (c) {
                case '"': o += "\\\""; break;
                case '\\': o += "\\\\"; break;
                case '\b': o += "\\b"; break;
                case '\f': o += "\\f"; break;
                case '\n': o += "\\n"; break;
                case '\r': o += "\\r"; break;
                case '\t': o += "\\t"; break;
                default:
                    if (c < 0x20) {
                        char buf[8];
                        snprintf(buf, sizeof buf, "\\u%04x", c);
                        o += buf;
                    } else {
                        o += (char)c;
                    }
            }
        }
        o += '"';
    }

    void writeIntArray(const std::vector<int> &v) { array(v, [&](int x) { writeLong(x); }); }
    void writeLongArray(const std::vector<long long> &v) { array(v, [&](long long x) { writeLong(x); }); }
    void writeStringArray(const std::vector<std::string> &v) { array(v, [&](const std::string &x) { writeString(x); }); }
    void writeIntGrid(const std::vector<std::vector<int>> &v) { array(v, [&](const std::vector<int> &r) { writeIntArray(r); }); }
    void writeCharGrid(const std::vector<std::vector<char>> &v) {
        array(v, [&](const std::vector<char> &r) { writeString(std::string(r.begin(), r.end())); });
    }
    void writeList(ListNode *head) {
        o += '[';
        size_t n = 0;
        for (ListNode *p = head; p; p = p->next) {
            if (++n > NODE_LIMIT) tooLong("list");
            if (n > 1) o += ',';
            writeLong(p->val);
        }
        o += ']';
    }
    void writeTree(TreeNode *root) {
        std::vector<TreeNode *> order;
        if (root) order.push_back(root);
        for (size_t k = 0; k < order.size(); k++) {
            if (!order[k]) continue;
            order.push_back(order[k]->left);
            order.push_back(order[k]->right);
            if (order.size() > 2 * NODE_LIMIT) tooLong("tree");
        }
        while (!order.empty() && !order.back()) order.pop_back();
        o += '[';
        for (size_t k = 0; k < order.size(); k++) {
            if (k) o += ',';
            if (order[k]) writeLong(order[k]->val);
            else o += "null";
        }
        o += ']';
    }

    void line() { o += '\n'; }
    void flush() {
        line();
        fwrite(o.data(), 1, o.size(), stdout);
        fflush(stdout);
    }
};

}  // namespace cl_io
