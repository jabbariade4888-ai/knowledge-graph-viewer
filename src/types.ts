export type GraphMode = '2d' | '3d'

export interface GraphViewportHandle {
  fit: () => void
  zoomBy: (factor: number) => void
  focusNode: (nodeId: string) => void
  reheat: () => void
}

export interface SnapshotStats {
  nodes: number
  edges: number
}

export interface SnapshotNode {
  id: string
  layer: string
  kind: string
  label: string
  summary?: string
  tags?: string[]
  added?: string
  url?: string
  author?: string
  platform?: string
  rawClaim?: string
  verifiedFacts?: string
}

export interface SnapshotEdge {
  s: string
  t: string
  k: string
  note?: string
}

export interface GraphMeta {
  owner: string
  updated: string
  description: string
}

export interface GraphSnapshot {
  version: string
  generated_at: string
  meta: GraphMeta
  stats: SnapshotStats
  nodes: SnapshotNode[]
  edges: SnapshotEdge[]
}

export interface KnowledgeNode extends SnapshotNode {
  degree: number
  value: number
  x?: number
  y?: number
  z?: number
  fx?: number
  fy?: number
}

export interface KnowledgeLink {
  source: string
  target: string
  kind: string
  note?: string
}

export interface GraphData {
  nodes: KnowledgeNode[]
  links: KnowledgeLink[]
}

export interface GraphFilters {
  kinds: Set<string>
  linkKinds: Set<string>
}

export interface KnowledgeGraph {
  snapshot: GraphSnapshot
  data: GraphData
  nodeById: Map<string, KnowledgeNode>
  allKinds: string[]
  allLinkKinds: string[]
}
