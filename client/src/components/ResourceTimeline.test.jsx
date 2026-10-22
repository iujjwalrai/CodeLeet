import { fireEvent, render, screen, within } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import ResourceTimeline from './ResourceTimeline'

const resources = {
  testIndex: 1,
  peakKb: 40960,
  cpuMs: 18,
  wallMs: 20,
  timeline: [
    { t: 0, rssKb: 1024, cpuMs: 0 },
    { t: 5, rssKb: 20480, cpuMs: 5 },
    { t: 10, rssKb: 40960, cpuMs: 7.5 },
    { t: 20, rssKb: 40960, cpuMs: 18 },
  ],
  tests: [
    { wallMs: 2, peakKb: 2048 },
    { wallMs: 20, peakKb: 40960 },
  ],
}

describe('ResourceTimeline', () => {
  it('renders nothing without measurements', () => {
    const { container } = render(<ResourceTimeline resources={null} />)
    expect(container).toBeEmptyDOMElement()
  })

  it('shows the heaviest test, its totals and both charts', () => {
    render(<ResourceTimeline resources={resources} />)

    expect(screen.getByText('Test 2, the one that used the most CPU')).toBeInTheDocument()
    expect(screen.getByText('40.0 MB', { selector: 'dd' })).toBeInTheDocument()
    expect(screen.getByText('18 ms', { selector: 'dd' })).toBeInTheDocument()
    expect(screen.getByText('Memory', { selector: '.rt-track-title' })).toBeInTheDocument()
    expect(screen.getByText('CPU (% of one core)', { selector: '.rt-track-title' })).toBeInTheDocument()
    expect(screen.getByText('Test 2 (heaviest) · 20 ms · 40.0 MB')).toBeInTheDocument()
  })

  // CPU % comes from the change in CPU time between samples
  const readSample = (timeline, presses) => {
    render(<ResourceTimeline resources={{ ...resources, timeline }} />)
    const chart = screen.getByRole('img')
    for (let i = 0; i < presses; i++) fireEvent.keyDown(chart, { key: 'ArrowRight' })
    return within(document.querySelector('.rt-readout'))
  }

  it('shows CPU use between samples as % of one core', () => {
    expect(readSample(resources.timeline, 3).getByText('50%')).toBeInTheDocument()
  })

  it('measures CPU over at least 5 ms when samples are closer together', () => {
    const timeline = [
      { t: 0, rssKb: 100, cpuMs: 0 },
      { t: 5, rssKb: 100, cpuMs: 5 },
      { t: 6, rssKb: 100, cpuMs: 5 },
      { t: 10, rssKb: 100, cpuMs: 7.5 },
    ]
    // 6 ms is measured from 0 (5/6 ≈ 83%), not from 5 ms (0%)
    expect(readSample(timeline, 3).getByText('83%')).toBeInTheDocument()
  })

  it('measures the first sample from the start of the run', () => {
    const timeline = [{ t: 4, rssKb: 100, cpuMs: 2 }, ...resources.timeline.slice(1)]
    expect(readSample(timeline, 1).getByText('50%')).toBeInTheDocument()
  })

  it('reads samples with the arrow keys', () => {
    render(<ResourceTimeline resources={resources} />)
    const chart = screen.getByRole('img')

    fireEvent.keyDown(chart, { key: 'ArrowRight' })
    fireEvent.keyDown(chart, { key: 'ArrowRight' })

    expect(screen.getByText('5.0 ms')).toBeInTheDocument()
    expect(screen.getByText('20.0 MB')).toBeInTheDocument()
    expect(screen.getByText('100%', { selector: 'b' })).toBeInTheDocument()
  })

  it('lists every test in the table view', () => {
    render(<ResourceTimeline resources={resources} />)
    const rows = screen.getAllByRole('row', { hidden: true }).slice(1)
    expect(rows.map((r) => r.textContent)).toEqual(['12.0 ms2.0 MB', '220 ms40.0 MB'])
  })

  it('says so instead of charting a run with too few samples', () => {
    render(<ResourceTimeline resources={{ ...resources, wallMs: 0.4, timeline: resources.timeline.slice(0, 2) }} />)
    expect(screen.getByText('Finished in 0.4 ms, too short to chart.')).toBeInTheDocument()
    expect(screen.queryByRole('img')).not.toBeInTheDocument()
  })
})
