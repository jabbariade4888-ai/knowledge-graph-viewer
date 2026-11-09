import { EDGE_ORDER, KIND_ORDER, orderBy } from './kb'
import type { GraphData, GraphFilters, GraphSnapshot, KnowledgeGraph, KnowledgeLink, KnowledgeNode } from './types'

export const KIND_LABELS: Record<string, string> = {
  source: 'Источник',
  topic: 'Тема',
  concept: 'Концепция',
  tool: 'Инструмент',
  person: 'Человек',
  org: 'Организация',
  project: 'Проект',
  task: 'Задача',
  claim: 'Утверждение'
}

export const LINK_KIND_LABELS: Record<string, string> = {
  is_example_of: 'Пример',
  uses: 'Использует',
  built_with: 'Собрано на',
  implements: 'Реализует',
  derived_from: 'Выведено из',
  contrasts_with: 'Контрастирует',
  addresses: 'Закрывает проблему',
  has_limitation: 'Ограничение',
  scoped_to: 'Уточнение',
  relevant_to: 'Релевантно',
  applicable_to: 'Применимо к',
  part_of: 'Часть',
  depends_on: 'Зависит от',
  mentions: 'Упоминает',
  authored_by: 'Автор'
}

export const ANCHOR_KINDS = new Set(['task', 'topic'])

export function labelForKind(kind: string): string {
  return KIND_LABELS[kind] ?? kind
}

export function labelForLinkKind(kind: string): string {
  return LINK_KIND_LABELS[kind] ?? kind
}

export function formatUpdated(iso: string): string {
  const [year, month, day] = iso.split('-').map((part) => Number.parseInt(part, 10))
  const months = ['января', 'февраля', 'марта', 'апреля', 'мая', 'июня', 'июля', 'августа', 'сентября', 'октября', 'ноября', 'декабря']
  if (!year || !month || !day || !months[month - 1]) return iso
  return `${day} ${months[month - 1]} ${year}`
}

export function buildKnowledgeGraph(snapshot: GraphSnapshot): KnowledgeGraph {
  const degree = new Map(snapshot.nodes.map((node) => [node.id, 0]))
  for (const edge of snapshot.edges) {
    degree.set(edge.s, (degree.get(edge.s) ?? 0) + 1)
    degree.set(edge.t, (degree.get(edge.t) ?? 0) + 1)
  }

  const nodes = snapshot.nodes.map((node) => {
    const nodeDegree = degree.get(node.id) ?? 0
    return {
      ...node,
      degree: nodeDegree,
      value: Math.min(8, 1 + Math.log2(nodeDegree + 1))
    }
  })
  const links = snapshot.edges.map<KnowledgeLink>((edge) => ({
    source: edge.s,
    target: edge.t,
    kind: edge.k,
    note: edge.note
  }))

  return {
    snapshot,
    data: { nodes, links },
    nodeById: new Map(nodes.map((node) => [node.id, node])),
    allKinds: orderBy([...new Set(nodes.map((node) => node.kind))], KIND_ORDER),
    allLinkKinds: orderBy([...new Set(links.map((link) => link.kind))], EDGE_ORDER)
  }
}

export function createAllFilters(graph: KnowledgeGraph): GraphFilters {
  return {
    kinds: new Set(graph.allKinds),
    linkKinds: new Set(graph.allLinkKinds)
  }
}

export function filterGraph(graph: KnowledgeGraph, filters: GraphFilters): GraphData {
  const nodes = graph.data.nodes.filter((node) => filters.kinds.has(node.kind))
  const visibleIds = new Set(nodes.map((node) => node.id))
  const links = graph.data.links.filter((link) => (
    filters.linkKinds.has(link.kind)
    && visibleIds.has(link.source)
    && visibleIds.has(link.target)
  ))

  return { nodes, links }
}

export function neighborIds(id: string | null, data: GraphData): Set<string> {
  if (!id) return new Set()
  const neighbors = new Set<string>([id])
  for (const link of data.links) {
    const source = endpointId(link.source)
    const target = endpointId(link.target)
    if (source === id) neighbors.add(target)
    if (target === id) neighbors.add(source)
  }
  return neighbors
}

export function endpointId(endpoint: string | { id: string } | number | undefined): string {
  if (typeof endpoint === 'object' && endpoint !== null && 'id' in endpoint) return endpoint.id
  return String(endpoint ?? '')
}

export function linksForNode(id: string, data: GraphData): KnowledgeLink[] {
  return data.links.filter((link) => endpointId(link.source) === id || endpointId(link.target) === id)
}

export function searchNodes(nodes: KnowledgeNode[], query: string, limit = 12): KnowledgeNode[] {
  const term = query.trim().toLocaleLowerCase('ru')
  if (!term) return []

  return nodes
    .filter((node) => searchableText(node).includes(term))
    .sort((left, right) => {
      const leftLabel = left.label.toLocaleLowerCase('ru')
      const rightLabel = right.label.toLocaleLowerCase('ru')
      const leftScore = leftLabel.startsWith(term) ? 0 : leftLabel.includes(term) ? 1 : 2
      const rightScore = rightLabel.startsWith(term) ? 0 : rightLabel.includes(term) ? 1 : 2
      return leftScore - rightScore || right.degree - left.degree || left.label.localeCompare(right.label, 'ru')
    })
    .slice(0, limit)
}

function searchableText(node: KnowledgeNode): string {
  return [node.label, node.id, node.summary, node.rawClaim, node.verifiedFacts, node.author, ...(node.tags ?? [])]
    .filter(Boolean)
    .join(' ')
    .toLocaleLowerCase('ru')
}
