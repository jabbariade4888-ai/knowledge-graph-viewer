import type { AppThemeMode } from './theme'

export interface GraphPalette {
  navy: string
  white: string
  gray: string
  grayMid: string
  grayLight: string
  teal: string
  chart: string[]
  nodeColors: Record<string, string>
  linkColors: Record<string, string>
}

const CHART = [
  '#0078d2',
  '#22c38e',
  '#56b9f2',
  '#0071b2',
  '#f38b00',
  '#eb5757',
  '#09b37b',
  '#f2c94c'
] as const

export const NODE_COLORS: Record<string, string> = {
  source: '#0071b2',
  topic: '#0078d2',
  concept: '#22c38e',
  tool: '#56b9f2',
  person: '#f2c94c',
  org: '#f38b00',
  project: '#09b37b',
  task: '#eb5757',
  claim: '#6e5dc6'
}

export const LINK_COLORS: Record<string, string> = {
  is_example_of: '#0078d2',
  uses: '#56b9f2',
  built_with: '#33b4ff',
  implements: '#22c38e',
  derived_from: '#09b37b',
  contrasts_with: '#eb5757',
  addresses: '#f38b00',
  has_limitation: '#c58b00',
  scoped_to: '#0071b2',
  relevant_to: '#6f8faf',
  applicable_to: '#0aa5ff',
  part_of: '#004166',
  depends_on: '#eb6b6b',
  mentions: '#8b9aa8',
  authored_by: '#f2c94c'
}

export const CONSTA_GRAPH_PALETTE: GraphPalette = {
  navy: '#002033',
  white: '#ffffff',
  gray: 'rgba(0, 32, 51, 0.6)',
  grayMid: 'rgba(0, 66, 105, 0.28)',
  grayLight: '#ecf1f4',
  teal: '#56b9f2',
  chart: [...CHART],
  nodeColors: NODE_COLORS,
  linkColors: LINK_COLORS
}

export const CONSTA_GRAPH_PALETTE_DARK: GraphPalette = {
  navy: '#fafafa',
  white: '#22272b',
  gray: 'hsla(0, 0%, 100%, 0.55)',
  grayMid: 'hsla(0, 0%, 100%, 0.28)',
  grayLight: '#161a1d',
  teal: '#0aa5ff',
  chart: [...CHART],
  nodeColors: NODE_COLORS,
  linkColors: LINK_COLORS
}

export function useGraphPalette(mode: AppThemeMode = 'light'): GraphPalette {
  return mode === 'dark' ? CONSTA_GRAPH_PALETTE_DARK : CONSTA_GRAPH_PALETTE
}

export function colorForNode(kind: string, palette: GraphPalette): string {
  return palette.nodeColors[kind] ?? palette.grayMid
}

export function colorForLink(kind: string, palette: GraphPalette): string {
  return palette.linkColors[kind] ?? palette.grayMid
}

export function withAlpha(color: string, alpha: number): string {
  const hex = color.replace('#', '')
  if (hex.length !== 6) {
    const rgba = color.match(/rgba?\(([^)]+)\)/)
    if (rgba) {
      const [r, g, b] = rgba[1].split(',').map((part) => part.trim())
      return `rgba(${r}, ${g}, ${b}, ${alpha})`
    }
    return color
  }
  const red = Number.parseInt(hex.slice(0, 2), 16)
  const green = Number.parseInt(hex.slice(2, 4), 16)
  const blue = Number.parseInt(hex.slice(4, 6), 16)
  return `rgba(${red}, ${green}, ${blue}, ${alpha})`
}
