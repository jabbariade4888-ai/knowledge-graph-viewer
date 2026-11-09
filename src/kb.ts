import type { GraphSnapshot, SnapshotEdge, SnapshotNode } from './types'

export const KIND_ORDER = ['task', 'topic', 'concept', 'tool', 'source', 'claim', 'person', 'org', 'project'] as const

export const EDGE_ORDER = [
  'part_of',
  'implements',
  'is_example_of',
  'uses',
  'built_with',
  'depends_on',
  'derived_from',
  'addresses',
  'applicable_to',
  'relevant_to',
  'mentions',
  'contrasts_with',
  'has_limitation',
  'scoped_to',
  'authored_by'
] as const

interface KbSource {
  id: string
  title: string
  url?: string
  author?: string
  platform?: string
  added?: string
  raw_claim?: string
  verified_facts?: string
}

interface KbNode {
  id: string
  type: string
  title: string
  summary?: string
  tags?: string[]
  added?: string
}

interface KbEdge {
  from: string
  to: string
  type: string
  note?: string
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function readString(record: Record<string, unknown>, key: string): string | undefined {
  const value = record[key]
  return typeof value === 'string' && value.trim() ? value : undefined
}

function readTags(value: unknown): string[] {
  if (!Array.isArray(value)) return []
  return value.filter((item): item is string => typeof item === 'string')
}

export function orderBy(values: string[], order: readonly string[]): string[] {
  const rank = new Map(order.map((item, index) => [item, index]))
  return [...values].sort((left, right) => (rank.get(left) ?? 100) - (rank.get(right) ?? 100) || left.localeCompare(right, 'ru'))
}

export function snapshotFromKb(value: unknown): GraphSnapshot {
  if (!isRecord(value) || !Array.isArray(value.nodes) || !Array.isArray(value.edges) || !Array.isArray(value.sources)) {
    throw new Error('В базе нет массивов sources, nodes и edges.')
  }

  const meta = isRecord(value.meta) ? value.meta : {}
  const nodes: SnapshotNode[] = []
  const seen = new Set<string>()

  for (const item of value.sources) {
    if (!isRecord(item)) throw new Error('Источник в базе имеет неверный формат.')
    const id = readString(item, 'id')
    const title = readString(item, 'title')
    if (!id || !title) throw new Error('У источника нет id или названия.')
    if (seen.has(id)) throw new Error(`Повторяется ID: ${id}.`)
    seen.add(id)
    const source = item as unknown as KbSource
    nodes.push({
      id,
      layer: 'source',
      kind: 'source',
      label: title,
      added: source.added,
      url: source.url,
      author: source.author,
      platform: source.platform,
      rawClaim: source.raw_claim,
      verifiedFacts: source.verified_facts,
      tags: []
    })
  }

  for (const item of value.nodes) {
    if (!isRecord(item)) throw new Error('Узел в базе имеет неверный формат.')
    const id = readString(item, 'id')
    const title = readString(item, 'title')
    const kind = readString(item, 'type')
    if (!id || !title || !kind) throw new Error('У узла нет id, type или названия.')
    if (seen.has(id)) throw new Error(`Повторяется ID: ${id}.`)
    seen.add(id)
    const node = item as unknown as KbNode
    nodes.push({
      id,
      layer: kind,
      kind,
      label: title,
      summary: node.summary,
      tags: readTags(node.tags),
      added: node.added
    })
  }

  const edges: SnapshotEdge[] = value.edges.map((item) => {
    if (!isRecord(item)) throw new Error('Связь в базе имеет неверный формат.')
    const source = readString(item, 'from')
    const target = readString(item, 'to')
    const kind = readString(item, 'type')
    if (!source || !target || !kind) throw new Error('У связи нет from, to или type.')
    if (!seen.has(source) || !seen.has(target)) {
      throw new Error(`Связь ${source} → ${target} ссылается на отсутствующий узел.`)
    }
    const edge = item as unknown as KbEdge
    return { s: source, t: target, k: kind, note: edge.note }
  })

  return {
    version: '1',
    generated_at: readString(meta, 'updated') ?? '',
    meta: {
      owner: readString(meta, 'owner') ?? '',
      updated: readString(meta, 'updated') ?? '',
      description: readString(meta, 'description') ?? ''
    },
    stats: { nodes: nodes.length, edges: edges.length },
    nodes,
    edges
  }
}
