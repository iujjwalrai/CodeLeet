import React from 'react';
import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import Counterexample from './Counterexample';

describe('Counterexample', () => {
  it('displays analysis independently of the verdict', () => {
    render(<Counterexample pending />);
    expect(screen.getByRole('status')).toHaveTextContent('Looking for a smaller failing input');
  });
  it('shows the comparison without claiming global minimality', () => {
    render(<Counterexample analysis={{ status: 'found', failureStatus: 'wrong_answer', input: '[1]', expected: '1', output: '0' }} />);
    expect(screen.getByRole('region', { name: 'Smaller failing input' })).toBeInTheDocument();
    expect(screen.getByText('[1]')).toBeInTheDocument();
    expect(screen.getByText('1')).toBeInTheDocument();
    expect(screen.getByText('0')).toBeInTheDocument();
    expect(screen.getByText(/not guaranteed/)).toBeInTheDocument();
  });
  it('makes an unsuccessful bounded search explicit', () => {
    render(<Counterexample analysis={{ status: 'not_found' }} />);
    expect(screen.getByRole('status')).toHaveTextContent('No smaller failure was found');
  });
});

