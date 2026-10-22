// Reads a test's input (one JSON value per argument) and writes the result
// as JSON with no spaces, the same text JSON.stringify produces. Mirrors
// cl_io.hpp so both languages print identical output.

class ListNode {
    int val;
    ListNode next;
    ListNode() {}
    ListNode(int val) { this.val = val; }
    ListNode(int val, ListNode next) { this.val = val; this.next = next; }
}

class TreeNode {
    int val;
    TreeNode left;
    TreeNode right;
    TreeNode() {}
    TreeNode(int val) { this.val = val; }
    TreeNode(int val, TreeNode left, TreeNode right) { this.val = val; this.left = left; this.right = right; }
}

final class CodeleetIO {
    // More nodes than this in a returned list or tree means a cycle
    static final int NODE_LIMIT = 2_000_000;

    private final byte[] s;
    private int i = 0;

    CodeleetIO(byte[] input) { s = input; }

    static void fail(String what) {
        System.err.println("Judge error: test input is malformed (" + what + ")");
        System.exit(3);
    }

    static void tooLong(String what) {
        System.err.println("The returned " + what + " has a cycle or more than " + NODE_LIMIT + " nodes");
        System.exit(1);
    }

    private void skip() {
        while (i < s.length && (s[i] == ' ' || s[i] == '\n' || s[i] == '\r' || s[i] == '\t')) i++;
    }
    private boolean at(char c) { skip(); return i < s.length && s[i] == c; }
    private void expect(char c) { if (!at(c)) fail("unexpected character"); i++; }
    private boolean word(String w) {
        skip();
        if (i + w.length() > s.length) return false;
        for (int k = 0; k < w.length(); k++) if (s[i + k] != w.charAt(k)) return false;
        i += w.length();
        return true;
    }
    // Reads "[a,b,...]", calling item for each element; returns the count
    private int array(Runnable item) {
        expect('[');
        if (at(']')) { i++; return 0; }
        int n = 0;
        for (;;) {
            item.run();
            n++;
            if (at(',')) { i++; continue; }
            expect(']');
            return n;
        }
    }

    long readLong() {
        skip();
        boolean neg = i < s.length && s[i] == '-';
        if (neg) i++;
        if (i >= s.length || s[i] < '0' || s[i] > '9') fail("expected a number");
        long v = 0;
        while (i < s.length && s[i] >= '0' && s[i] <= '9') v = v * 10 + (s[i++] - '0');
        return neg ? -v : v;
    }
    int readInt() { return (int) readLong(); }
    boolean readBool() {
        if (word("true")) return true;
        if (word("false")) return false;
        fail("expected true or false");
        return false;
    }
    String readString() {
        expect('"');
        StringBuilder r = new StringBuilder();
        for (;;) {
            if (i >= s.length) fail("unterminated string");
            char c = (char) (s[i++] & 0xff);
            if (c == '"') return r.toString();
            if (c != '\\') { r.append(c); continue; }
            if (i >= s.length) fail("bad escape");
            switch (s[i++]) {
                case '"': r.append('"'); break;
                case '\\': r.append('\\'); break;
                case '/': r.append('/'); break;
                case 'b': r.append('\b'); break;
                case 'f': r.append('\f'); break;
                case 'n': r.append('\n'); break;
                case 'r': r.append('\r'); break;
                case 't': r.append('\t'); break;
                case 'u':
                    if (i + 4 > s.length) fail("bad escape");
                    r.append((char) Integer.parseInt(new String(s, i, 4, java.nio.charset.StandardCharsets.US_ASCII), 16));
                    i += 4;
                    break;
                default: fail("bad escape");
            }
        }
    }

    int[] readIntArray() {
        IntList v = new IntList();
        array(() -> v.add(readInt()));
        return java.util.Arrays.copyOf(v.a, v.n);
    }
    long[] readLongArray() {
        LongList v = new LongList();
        array(() -> v.add(readLong()));
        return java.util.Arrays.copyOf(v.a, v.n);
    }
    // Growable arrays, so big inputs aren't boxed one number at a time
    private static final class IntList {
        int[] a = new int[16];
        int n;
        void add(int x) { if (n == a.length) a = java.util.Arrays.copyOf(a, n * 2); a[n++] = x; }
    }
    private static final class LongList {
        long[] a = new long[16];
        int n;
        void add(long x) { if (n == a.length) a = java.util.Arrays.copyOf(a, n * 2); a[n++] = x; }
    }
    String[] readStringArray() {
        java.util.ArrayList<String> v = new java.util.ArrayList<>();
        array(() -> v.add(readString()));
        return v.toArray(new String[0]);
    }
    int[][] readIntGrid() {
        java.util.ArrayList<int[]> v = new java.util.ArrayList<>();
        array(() -> v.add(readIntArray()));
        return v.toArray(new int[0][]);
    }
    char[][] readCharGrid() {
        String[] rows = readStringArray();
        char[][] g = new char[rows.length][];
        for (int k = 0; k < rows.length; k++) g[k] = rows[k].toCharArray();
        return g;
    }
    java.util.List<Integer> readIntList() {
        java.util.ArrayList<Integer> v = new java.util.ArrayList<>();
        array(() -> v.add(readInt()));
        return v;
    }
    java.util.List<String> readStringList() {
        return new java.util.ArrayList<>(java.util.Arrays.asList(readStringArray()));
    }
    java.util.List<java.util.List<Integer>> readIntListList() {
        java.util.ArrayList<java.util.List<Integer>> v = new java.util.ArrayList<>();
        array(() -> v.add(readIntList()));
        return v;
    }
    ListNode readList() {
        int[] vals = readIntArray();
        ListNode head = null;
        for (int k = vals.length - 1; k >= 0; k--) head = new ListNode(vals[k], head);
        return head;
    }
    // Level order with null for missing children; each node in turn takes
    // the next two entries as its children
    TreeNode readTree() {
        java.util.ArrayList<TreeNode> nodes = new java.util.ArrayList<>();
        array(() -> nodes.add(word("null") ? null : new TreeNode(readInt())));
        if (nodes.isEmpty() || nodes.get(0) == null) return null;
        int next = 1;
        for (int k = 0; k < nodes.size() && next < nodes.size(); k++) {
            TreeNode t = nodes.get(k);
            if (t == null) continue;
            t.left = nodes.get(next++);
            if (next < nodes.size()) t.right = nodes.get(next++);
        }
        return nodes.get(0);
    }

    static void writeLong(StringBuilder o, long v) { o.append(v); }
    static void writeInt(StringBuilder o, long v) { o.append(v); }
    static void writeBool(StringBuilder o, boolean b) { o.append(b ? "true" : "false"); }
    static void writeString(StringBuilder o, String t) {
        o.append('"');
        for (int k = 0; k < t.length(); k++) {
            char c = t.charAt(k);
            switch (c) {
                case '"': o.append("\\\""); break;
                case '\\': o.append("\\\\"); break;
                case '\b': o.append("\\b"); break;
                case '\f': o.append("\\f"); break;
                case '\n': o.append("\\n"); break;
                case '\r': o.append("\\r"); break;
                case '\t': o.append("\\t"); break;
                default:
                    if (c < 0x20) o.append(String.format("\\u%04x", (int) c));
                    else o.append(c);
            }
        }
        o.append('"');
    }
    static void writeIntArray(StringBuilder o, int[] v) {
        o.append('[');
        for (int k = 0; k < v.length; k++) { if (k > 0) o.append(','); o.append(v[k]); }
        o.append(']');
    }
    static void writeLongArray(StringBuilder o, long[] v) {
        o.append('[');
        for (int k = 0; k < v.length; k++) { if (k > 0) o.append(','); o.append(v[k]); }
        o.append(']');
    }
    static void writeStringArray(StringBuilder o, String[] v) {
        o.append('[');
        for (int k = 0; k < v.length; k++) { if (k > 0) o.append(','); writeString(o, v[k]); }
        o.append(']');
    }
    static void writeIntGrid(StringBuilder o, int[][] v) {
        o.append('[');
        for (int k = 0; k < v.length; k++) { if (k > 0) o.append(','); writeIntArray(o, v[k]); }
        o.append(']');
    }
    static void writeCharGrid(StringBuilder o, char[][] v) {
        o.append('[');
        for (int k = 0; k < v.length; k++) { if (k > 0) o.append(','); writeString(o, new String(v[k])); }
        o.append(']');
    }
    static void writeIntList(StringBuilder o, java.util.List<Integer> v) {
        o.append('[');
        int k = 0;
        for (int x : v) { if (k++ > 0) o.append(','); o.append(x); }
        o.append(']');
    }
    static void writeStringList(StringBuilder o, java.util.List<String> v) {
        o.append('[');
        int k = 0;
        for (String x : v) { if (k++ > 0) o.append(','); writeString(o, x); }
        o.append(']');
    }
    static void writeIntListList(StringBuilder o, java.util.List<java.util.List<Integer>> v) {
        o.append('[');
        int k = 0;
        for (java.util.List<Integer> row : v) { if (k++ > 0) o.append(','); writeIntList(o, row); }
        o.append(']');
    }
    static void writeList(StringBuilder o, ListNode head) {
        o.append('[');
        int n = 0;
        for (ListNode p = head; p != null; p = p.next) {
            if (++n > NODE_LIMIT) tooLong("list");
            if (n > 1) o.append(',');
            o.append(p.val);
        }
        o.append(']');
    }
    static void writeTree(StringBuilder o, TreeNode root) {
        java.util.ArrayList<TreeNode> order = new java.util.ArrayList<>();
        if (root != null) order.add(root);
        for (int k = 0; k < order.size(); k++) {
            TreeNode t = order.get(k);
            if (t == null) continue;
            order.add(t.left);
            order.add(t.right);
            if (order.size() > 2 * NODE_LIMIT) tooLong("tree");
        }
        int end = order.size();
        while (end > 0 && order.get(end - 1) == null) end--;
        o.append('[');
        for (int k = 0; k < end; k++) {
            if (k > 0) o.append(',');
            TreeNode t = order.get(k);
            if (t != null) o.append(t.val);
            else o.append("null");
        }
        o.append(']');
    }
}
