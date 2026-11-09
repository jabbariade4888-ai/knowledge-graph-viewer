import { forwardRef, useCallback, useEffect, useImperativeHandle, useMemo, useRef } from 'react'
import ForceGraph3D, { type ForceGraphMethods } from 'react-force-graph-3d'
import { endpointId, labelForKind } from './graph'
import { colorForLink, colorForNode, withAlpha, type GraphPalette } from './palette'
import { escapeHtml, shortText } from './text'
import type { GraphData, GraphViewportHandle, KnowledgeLink, KnowledgeNode } from './types'

interface Graph3DProps {
  data: GraphData
  width: number
  height: number
  palette: GraphPalette
  selectedId: string | null
  highlightedNodeIds: Set<string>
  highlightedLinks: Set<string>
  focusActive: boolean
  focusLinkKinds: Set<string> | null
  interactionNonce: number
  onSelect: (id: string) => void
  onClearSelection: () => void
  onLayoutChange: (running: boolean) => void
}

function nodeTooltip(node: KnowledgeNode): string {
  const blurb = node.summary ?? node.rawClaim
  const extra = blurb ? `<br/><small>${escapeHtml(shortText(blurb, 160))}</small>` : ''
  return `<strong>${escapeHtml(node.label)}</strong><br/><small>${escapeHtml(labelForKind(node.kind))} · ${node.degree} связей</small>${extra}`
}

function linkWeight(kind: string): { width: number; alpha: number } {
  if (kind === 'part_of' || kind === 'implements' || kind === 'applicable_to' || kind === 'relevant_to') {
    return { width: 1.3, alpha: 0.75 }
  }
  return { width: 0.85, alpha: 0.55 }
}

function tuneForces(graph: ForceGraphMethods<KnowledgeNode, KnowledgeLink> | undefined) {
  const charge = graph?.d3Force('charge') as { strength?: (value: number) => void } | undefined
  const link = graph?.d3Force('link') as { distance?: (value: number) => void } | undefined
  charge?.strength?.(-180)
  link?.distance?.(50)
}

const Graph3D = forwardRef<GraphViewportHandle, Graph3DProps>(function Graph3D({
  data, width, height, palette, selectedId, highlightedNodeIds, highlightedLinks: _highlightedLinks, focusActive, focusLinkKinds, interactionNonce, onSelect, onClearSelection, onLayoutChange
}, ref) {
  const graphRef = useRef<ForceGraphMethods<KnowledgeNode, KnowledgeLink>>(undefined)
  const positionCache = useRef(new Map<string, Pick<KnowledgeNode, 'x' | 'y' | 'z'>>())
  const pendingFocusId = useRef<string | null>(null)
  const initialFitted = useRef(false)
  const userInteracted = useRef(false)

  useEffect(() => {
    if (interactionNonce > 0) userInteracted.current = true
  }, [interactionNonce])

  const graphData = useMemo(() => ({
    nodes: data.nodes.map((node) => ({ ...node, ...positionCache.current.get(node.id) })),
    links: data.links.map((link) => ({ ...link }))
  }), [data])

  useEffect(() => () => {
    graphData.nodes.forEach((node) => positionCache.current.set(node.id, { x: node.x, y: node.y, z: node.z }))
  }, [graphData])

  useEffect(() => {
    tuneForces(graphRef.current)
  }, [graphData])

  const focusNode = useCallback((nodeId: string) => {
    const node = graphData.nodes.find((candidate) => candidate.id === nodeId)
    if (!node || !Number.isFinite(node.x) || !Number.isFinite(node.y) || !Number.isFinite(node.z)) {
      pendingFocusId.current = nodeId
      return
    }
    const distance = 90
    graphRef.current?.cameraPosition(
      { x: (node.x ?? 0) + distance, y: (node.y ?? 0) + distance * 0.4, z: (node.z ?? 0) + distance },
      { x: node.x ?? 0, y: node.y ?? 0, z: node.z ?? 0 },
      450
    )
    pendingFocusId.current = null
  }, [graphData.nodes])

  useImperativeHandle(ref, () => ({
    fit: () => graphRef.current?.zoomToFit(350, 64),
    zoomBy: () => undefined,
    focusNode,
    reheat: () => {
      onLayoutChange(true)
      tuneForces(graphRef.current)
      graphRef.current?.d3ReheatSimulation()
    }
  }), [focusNode, onLayoutChange])

  const nodeColor = useCallback((node: KnowledgeNode) => {
    if (!focusActive || highlightedNodeIds.has(node.id)) return colorForNode(node.kind, palette)
    return withAlpha(palette.grayMid, 0.16)
  }, [focusActive, highlightedNodeIds, palette])

  const linkIsActive = useCallback((link: KnowledgeLink) => {
    if (!focusActive) return true
    const source = endpointId(link.source)
    const target = endpointId(link.target)
    if (!highlightedNodeIds.has(source) || !highlightedNodeIds.has(target)) return false
    if (focusLinkKinds && !focusLinkKinds.has(link.kind)) return false
    return true
  }, [focusActive, focusLinkKinds, highlightedNodeIds])

  const linkColor = useCallback((link: KnowledgeLink) => {
    const { alpha } = linkWeight(link.kind)
    if (!focusActive) return withAlpha(colorForLink(link.kind, palette), 0.4)
    return withAlpha(colorForLink(link.kind, palette), alpha)
  }, [focusActive, palette])

  return (
    <ForceGraph3D<KnowledgeNode, KnowledgeLink>
      ref={graphRef}
      graphData={graphData}
      width={width}
      height={height}
      backgroundColor={palette.white}
      showNavInfo={false}
      warmupTicks={80}
      cooldownTime={2200}
      d3AlphaDecay={0.04}
      d3VelocityDecay={0.42}
      nodeVal="value"
      nodeRelSize={5}
      nodeLabel={nodeTooltip}
      nodeColor={nodeColor}
      nodeOpacity={0.94}
      linkVisibility={linkIsActive}
      linkColor={linkColor}
      linkWidth={(link) => (focusActive ? linkWeight(link.kind).width : 0.55)}
      linkDirectionalArrowLength={(link) => (focusActive && selectedId && linkIsActive(link) ? 4 : 0)}
      linkDirectionalArrowColor={linkColor}
      linkDirectionalArrowRelPos={0.86}
      onNodeClick={(node) => onSelect(node.id)}
      onBackgroundClick={onClearSelection}
      onEngineTick={() => { if (pendingFocusId.current) focusNode(pendingFocusId.current) }}
      onEngineStop={() => {
        onLayoutChange(false)
        if (!initialFitted.current) {
          initialFitted.current = true
          if (!userInteracted.current) graphRef.current?.zoomToFit(350, 72)
        }
      }}
      showPointerCursor
      enableNavigationControls
    />
  )
})

export default Graph3D
