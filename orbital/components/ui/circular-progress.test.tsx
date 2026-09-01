import { render } from '@testing-library/react'
import { describe, test, expect } from 'vitest'
import { CircularProgress } from './circular-progress'

const size = 140
const strokeWidth = 10
const radius = (size - strokeWidth) / 2          // 65
const circumference = 2 * Math.PI * radius       // ~408.41

describe('CircularProgress', () => {
  test('renders children inside the ring', () => {
    const { getByText } = render(
      <CircularProgress percent={50} status="on_track"><span>Hello</span></CircularProgress>
    )
    expect(getByText('Hello')).toBeInTheDocument()
  })

  test('sets stroke-dashoffset correctly for 50%', () => {
    const { container } = render(
      <CircularProgress percent={50} status="on_track" size={140} strokeWidth={10}>
        <span />
      </CircularProgress>
    )
    const arcs = container.querySelectorAll('circle')
    const offset = parseFloat(arcs[1].getAttribute('stroke-dashoffset') ?? '0')
    expect(offset).toBeCloseTo(circumference * 0.5, 0)
  })

  test('sets stroke-dashoffset to 0 for 100%', () => {
    const { container } = render(
      <CircularProgress percent={100} status="on_track" size={140} strokeWidth={10}>
        <span />
      </CircularProgress>
    )
    const arcs = container.querySelectorAll('circle')
    const offset = parseFloat(arcs[1].getAttribute('stroke-dashoffset') ?? '1')
    expect(offset).toBeCloseTo(0, 0)
  })

  test('clamps percent above 100 to full circle', () => {
    const { container } = render(
      <CircularProgress percent={150} status="on_track" size={140} strokeWidth={10}>
        <span />
      </CircularProgress>
    )
    const arcs = container.querySelectorAll('circle')
    const offset = parseFloat(arcs[1].getAttribute('stroke-dashoffset') ?? '1')
    expect(offset).toBeCloseTo(0, 0)
  })

  test('uses gold stroke for on_track', () => {
    const { container } = render(
      <CircularProgress percent={75} status="on_track"><span /></CircularProgress>
    )
    expect(container.querySelectorAll('circle')[1]).toHaveAttribute('stroke', '#fad542')
  })

  test('uses amber stroke for at_risk', () => {
    const { container } = render(
      <CircularProgress percent={75} status="at_risk"><span /></CircularProgress>
    )
    expect(container.querySelectorAll('circle')[1]).toHaveAttribute('stroke', '#f59e0b')
  })

  test('uses red stroke for off_track', () => {
    const { container } = render(
      <CircularProgress percent={75} status="off_track"><span /></CircularProgress>
    )
    expect(container.querySelectorAll('circle')[1]).toHaveAttribute('stroke', '#ef4444')
  })

  test('track ring uses low-opacity white stroke', () => {
    const { container } = render(
      <CircularProgress percent={50} status="on_track"><span /></CircularProgress>
    )
    expect(container.querySelectorAll('circle')[0]).toHaveAttribute('stroke', 'rgba(255,255,255,0.08)')
  })
})
