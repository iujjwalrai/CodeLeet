/*
 * Types a problem's function can take and return.
 *
 * Tests hold one JSON value per argument, one per line, and the expected
 * output is the return value as JSON. Drivers (see codegen.js) read and
 * write exactly this format, with no spaces, as JSON.stringify writes it.
 *
 *   char[][]   rows as strings: ["110","011"]
 *   ListNode   values in order: [1,2,3]
 *   TreeNode   level order, null for a missing child: [3,9,20,null,null,15,7]
 */

const INT_MIN = -(2 ** 31);
const INT_MAX = 2 ** 31 - 1;

const isInt = (v) => Number.isInteger(v) && v >= INT_MIN && v <= INT_MAX;
// Hand-written tests are parsed by JavaScript, so a long must fit in a
// double; generated tests can use the whole 64-bit range.
const isLong = (v) => Number.isSafeInteger(v);
const isBool = (v) => typeof v === "boolean";
// Printable ASCII keeps the C++ and Java drivers byte-for-byte identical
const isText = (v) => typeof v === "string" && /^[\x20-\x7e]*$/.test(v);
const arrayOf = (check) => (v) => Array.isArray(v) && v.every(check);
const isTree = (v) =>
  Array.isArray(v) && v.every((x) => x === null || isInt(x)) && (v.length === 0 || v[0] !== null);

/*
 * cpp / java   type as written in the user's code
 * io           runtime functions that read and write it: read<io> and
 *              write<io> in runtime/cl_io.hpp and runtime/CodeleetIO.java
 * javaIo       when Java's functions differ (the List types)
 *
 * The List types read and write the same JSON as the arrays. They exist so
 * Java can return List<List<Integer>> where the result is ragged, as on
 * LeetCode; in C++ they are the same vectors.
 */
const TYPES = {
  int:               { cpp: "int",                  java: "int",                 io: "Int",         check: isInt },
  long:              { cpp: "long long",            java: "long",                io: "Long",        check: isLong },
  bool:              { cpp: "bool",                 java: "boolean",             io: "Bool",        check: isBool },
  string:            { cpp: "string",               java: "String",              io: "String",      check: isText },
  "int[]":           { cpp: "vector<int>",          java: "int[]",               io: "IntArray",    check: arrayOf(isInt) },
  "long[]":          { cpp: "vector<long long>",    java: "long[]",              io: "LongArray",   check: arrayOf(isLong) },
  "string[]":        { cpp: "vector<string>",       java: "String[]",            io: "StringArray", check: arrayOf(isText) },
  "int[][]":         { cpp: "vector<vector<int>>",  java: "int[][]",             io: "IntGrid",     check: arrayOf(arrayOf(isInt)) },
  "char[][]":        { cpp: "vector<vector<char>>", java: "char[][]",            io: "CharGrid",    check: arrayOf(isText) },
  "List<int>":       { cpp: "vector<int>",          java: "List<Integer>",       io: "IntArray",    javaIo: "IntList",     check: arrayOf(isInt) },
  "List<string>":    { cpp: "vector<string>",       java: "List<String>",        io: "StringArray", javaIo: "StringList",  check: arrayOf(isText) },
  "List<List<int>>": { cpp: "vector<vector<int>>",  java: "List<List<Integer>>", io: "IntGrid",     javaIo: "IntListList", check: arrayOf(arrayOf(isInt)) },
  ListNode:          { cpp: "ListNode*",            java: "ListNode",            io: "List",        check: arrayOf(isInt) },
  TreeNode:          { cpp: "TreeNode*",            java: "TreeNode",            io: "Tree",        check: isTree },
};

const javaIo = (type) => TYPES[type].javaIo || TYPES[type].io;

const cppParam = (type, name) =>
  TYPES[type].cpp.startsWith("vector") ? `${TYPES[type].cpp}& ${name}` : `${TYPES[type].cpp} ${name}`;

/* JSON text for a value, as the drivers print it */
const encode = (value) => JSON.stringify(value);

/* Checks a value against a type. Returns an error message or null. */
function checkValue(type, value) {
  if (!TYPES[type].check(value)) return `is not a valid ${type}: ${truncate(encode(value))}`;
  // A tree printed back drops trailing nulls, so outputs must not have them
  if (type === "TreeNode" && value.length > 0 && value.at(-1) === null) return "has trailing nulls";
  return null;
}

/*
 * Loose check for generated input lines, which may hold 64-bit numbers that
 * JavaScript can't represent exactly: the structure must match the type.
 */
function checkGeneratedLine(type, line) {
  let value;
  try {
    value = JSON.parse(line);
  } catch {
    return `is not JSON: ${truncate(line)}`;
  }
  const loose = { ...TYPES, long: { check: Number.isInteger }, "long[]": { check: arrayOf(Number.isInteger) } };
  return loose[type].check(value) ? null : `is not a valid ${type}: ${truncate(line)}`;
}

const truncate = (text) => (text.length > 80 ? `${text.slice(0, 77)}...` : text);

module.exports = { TYPES, javaIo, cppParam, encode, checkValue, checkGeneratedLine };
