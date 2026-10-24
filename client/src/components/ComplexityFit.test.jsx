import React from 'react';
import { describe, expect, it } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import ComplexityFit from './ComplexityFit';

const points = [1000, 2000, 4000, 8000].map((n) => ({ n, x: n, ms: n / 1000, totalMs: n / 1000 }));
const done = {
  status: 'done', class: 'n^2', label: 'O(n²)', expected: 'n', expectedLabel: 'O(n)', verdict: 'slower', variable: 'n', points,
  curves: { best: [[1000, 1], [8000, 64]], expected: [[1000, 1], [8000, 8]] },
};

describe('ComplexityFit', () => {
  it('says it is measuring while the analysis is pending', () => {
    render(<ComplexityFit pending />);
    expect(screen.getByRole('status')).toHaveTextContent('Measuring how your solution');
  });

  it('shows the fitted class next to the expected one, with both curves in the legend', () => {
    render(<ComplexityFit analysis={done} />);
    const card = screen.getByRole('region', { name: 'Time complexity' });
    expect(card).toHaveTextContent('Grows faster than the expected O(n).');
    expect(card).toHaveTextContent('Your solutionO(n²)');
    expect(card).toHaveTextContent('ExpectedO(n)');
    expect(screen.getByText(/Your times · fit O\(n²\)/)).toBeInTheDocument();
    expect(screen.getByText('O(n) shape')).toBeInTheDocument();
  });

  it('reads each size from the keyboard and lists them as a table', () => {
    render(<ComplexityFit analysis={done} />);
    const chart = screen.getByRole('img');
    fireEvent.keyDown(chart, { key: 'ArrowRight' });
    expect(chart).toHaveTextContent('n = 1,000');
    expect(chart).toHaveTextContent('Time 1.00 ms');
    expect(screen.getAllByRole('row')).toHaveLength(5);
  });

  it('explains an inconclusive or delayed result and hides skipped ones', () => {
    const { rerender, container } = render(<ComplexityFit analysis={{ status: 'inconclusive', reason: 'Too noisy.' }} />);
    expect(screen.getByRole('status')).toHaveTextContent('Too noisy.');
    rerender(<ComplexityFit analysis={{ status: 'later', reason: 'Still measuring.' }} />);
    expect(screen.getByRole('status')).toHaveTextContent('Still measuring.');
    rerender(<ComplexityFit analysis={{ status: 'skipped', reason: 'n/a' }} />);
    expect(container).toBeEmptyDOMElement();
  });
});
