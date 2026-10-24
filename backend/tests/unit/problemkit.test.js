const fs = require('fs');
const path = require('path');
const { checkValue, checkGeneratedLine } = require('../../problemkit/types');
const codegen = require('../../problemkit/codegen');
const { loadPackage, packageDirs, PackageError, TOPICS, PROBLEMS_DIR } = require('../../problemkit/package');
const { writePackage, tempRoot } = require('../helpers/problemPackages');

describe('checkValue', () => {
  it('accepts values that fit the type', () => {
    expect(checkValue('int', -(2 ** 31))).toBeNull();
    expect(checkValue('long', 2 ** 53 - 1)).toBeNull();
    expect(checkValue('char[][]', ['10', '01'])).toBeNull();
    expect(checkValue('TreeNode', [1, null, 2])).toBeNull();
    expect(checkValue('List<List<int>>', [[1], []])).toBeNull();
  });

  it('rejects values that do not', () => {
    expect(checkValue('int', 2 ** 31)).toMatch('not a valid int');
    expect(checkValue('long', 2 ** 53)).toMatch('not a valid long');
    expect(checkValue('string', 'café')).toMatch('not a valid string');
    expect(checkValue('TreeNode', [null, 1])).toMatch('not a valid TreeNode');
    expect(checkValue('bool', 1)).toMatch('not a valid bool');
  });

  it('rejects trailing nulls in a tree, which a printed tree never has', () => {
    expect(checkValue('TreeNode', [1, 2, null])).toBe('has trailing nulls');
  });

  it('lets generated input hold 64-bit numbers', () => {
    expect(checkGeneratedLine('long[]', '[9223372036854775807,-1]')).toBeNull();
    expect(checkGeneratedLine('int[]', '[1,2')).toMatch('not JSON');
  });
});

describe('codegen', () => {
  const reverse = { name: 'reverseList', params: [{ name: 'head', type: 'ListNode' }], returns: 'ListNode' };
  const levels = { name: 'levelOrder', params: [{ name: 'root', type: 'TreeNode' }], returns: 'List<List<int>>' };
  const maxSub = { name: 'maxSubArray', params: [{ name: 'nums', type: 'int[]' }, { name: 'k', type: 'string' }], returns: 'long' };

  it('writes LeetCode-style C++ starters, taking vectors by reference', () => {
    expect(codegen.cppStarter(maxSub)).toContain('    long long maxSubArray(vector<int>& nums, string k) {');
    expect(codegen.cppStarter(maxSub)).toMatch(/^class Solution \{\npublic:/);
  });

  it('documents ListNode and TreeNode only when the signature uses them', () => {
    expect(codegen.cppStarter(reverse)).toContain('Definition for singly-linked list.');
    expect(codegen.cppStarter(reverse)).not.toContain('binary tree node');
    expect(codegen.javaStarter(levels)).toContain('Definition for a binary tree node.');
    expect(codegen.javaStarter(maxSub)).not.toContain('Definition for');
  });

  it('uses Java collections for the List types', () => {
    expect(codegen.javaStarter(levels)).toContain('    public List<List<Integer>> levelOrder(TreeNode root) {');
    expect(codegen.javaDriver(levels)).toContain('CodeleetIO.writeIntListList(out, new Solution().levelOrder(cl_arg0));');
  });

  it('builds a C++ driver that includes the solution after the runtime', () => {
    const driver = codegen.cppDriver(maxSub);
    expect(driver.indexOf('namespace cl_io')).toBeLessThan(driver.indexOf('#include "Solution.cpp"'));
    expect(driver).toContain('    auto cl_arg0 = in.readIntArray();');
    expect(driver).toContain('    auto cl_arg1 = in.readString();');
    expect(driver).toContain('    auto result = solution.maxSubArray(cl_arg0, cl_arg1);');
    expect(driver).toContain('    out.writeLong(result);');
    expect(driver).toContain('signed main() {');
  });

  it('builds a Java driver that runs the solution on a big-stack thread', () => {
    const driver = codegen.javaDriver(reverse);
    expect(driver).toContain('        final ListNode cl_arg0 = in.readList();');
    expect(driver).toContain('CodeleetIO.writeList(out, new Solution().reverseList(cl_arg0));');
    expect(driver).toContain('"solution", 256L << 20);');
    expect(driver).toMatch(/^\/\/ Generated[^\n]*\nimport /);
  });

  it('prefixes generators with the gen.hpp helpers', () => {
    const src = codegen.generatorSource('void generate(long long n, Rng& rng) {}');
    expect(src).toContain('struct Rng');
    expect(src).toMatch(/#line 1 "generator.cpp"\nvoid generate/);
  });
});

describe('loadPackage', () => {
  let root;
  beforeEach(() => { root = tempRoot(); });
  afterEach(() => fs.rmSync(root, { recursive: true, force: true }));

  const errorsOf = (dir) => {
    try {
      loadPackage(dir);
    } catch (err) {
      expect(err).toBeInstanceOf(PackageError);
      return err.problems;
    }
    throw new Error('expected loadPackage to fail');
  };

  it('puts the examples first as visible tests, then the rest hidden', () => {
    const pkg = loadPackage(writePackage(root, 'double-it'));

    expect(pkg.tests).toEqual([
      { input: '2', output: '4', hidden: false },
      { input: '-3', output: '-6', hidden: true },
      { gen: [10, 1], hidden: true },
    ]);
    expect(pkg.meta).toMatchObject({ slug: 'double-it', timeLimitMs: 1000 });
    expect(pkg.meta.examples).toEqual([{ input: 'x = 2', output: '4', explanation: '2 * 2 = 4.' }]);
    expect(pkg.templates.cpp.starter).toContain('int twice(int x)');
    expect(pkg.reference.java).toBeNull();
  });

  it('writes example inputs one argument per line, as name = value', () => {
    const pkg = loadPackage(writePackage(root, 'pair', {
      problem: {
        function: { name: 'f', params: [{ name: 'nums', type: 'int[]' }, { name: 's', type: 'string' }], returns: 'int' },
        examples: [{ args: [[1, 2], 'a b'], output: 3 }],
      },
      tests: { tests: [] },
    }));
    expect(pkg.meta.examples[0].input).toBe('nums = [1,2]\ns = "a b"');
    expect(pkg.tests[0].input).toBe('[1,2]\n"a b"');
  });

  it('uses hand-written drivers and starters when the package has them', () => {
    const pkg = loadPackage(writePackage(root, 'custom', { files: { 'cpp/driver.cpp': '// mine', 'java/Starter.java': '// start' } }));
    expect(pkg.templates.cpp.driver).toBe('// mine');
    expect(pkg.templates.java.starter).toBe('// start');
    expect(pkg.templates.java.driver).toContain('public class Main');
  });

  it('reports every problem in a package at once', () => {
    const problems = errorsOf(writePackage(root, 'Bad_Slug', {
      problem: {
        topics: ['Arrays'],
        timeLimitMs: 50,
        colour: 'red',
        examples: [{ args: [1, 2], output: 3 }],
      },
      tests: { tests: [{ args: [3], output: 'six' }, { gen: [10], args: [1] }, { args: [1], output: 2, hidden: 'yes' }] },
      files: { 'reference.cpp': null },
    }));

    expect(problems).toEqual(expect.arrayContaining([
      'folder name "Bad_Slug" is not a valid slug',
      'reference.cpp: missing',
      'problem.json: unknown key "colour"',
      'problem.json: topic "Arrays" is not in problemkit/topics.json',
      'problem.json: timeLimitMs must be a whole number of ms from 100 to 10000',
      'problem.json: examples[0].args must have 1 value(s), one per parameter',
      'tests.json: tests[0].output is not a valid int: "six"',
      'tests.json: tests[1].gen must be [n, seed] with whole numbers >= 0',
      'tests.json: tests[1] has gen, so it can\'t also have args or output',
      'tests.json: tests[2].hidden must be true or false',
    ]));
  });

  it('checks the signature before the cases that depend on it', () => {
    const problems = errorsOf(writePackage(root, 'bad-sig', {
      problem: { function: { name: '2x', params: [{ name: 'x', type: 'float' }, { name: 'x', type: 'int' }], returns: 'int' } },
    }));
    expect(problems).toEqual([
      'problem.json: function.name "2x" is not an identifier',
      'problem.json: function.params[0].type "float" is not a known type',
      'problem.json: function.params[1].name "x" is repeated',
    ]);
  });
});

// The packages aren't in git (they hold hidden tests), so CI has none;
// locally this checks every package in backend/problems
const localPackages = fs.existsSync(PROBLEMS_DIR) ? packageDirs() : [];

(localPackages.length ? describe : describe.skip)('the local problem packages', () => {
  it.each(localPackages.map((d) => [path.basename(d), d]))('%s is valid', (_slug, dir) => {
    const pkg = loadPackage(dir);
    expect(pkg.meta.topics.every((t) => TOPICS.includes(t))).toBe(true);
    expect(pkg.tests.some((t) => t.gen)).toBe(true);
  });
});
