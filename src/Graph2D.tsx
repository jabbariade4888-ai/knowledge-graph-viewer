import { forwardRef, useCallback, useEffect, useImperativeHandle, useMemo, useRef } from 'react'
import ForceGraph2D, { type ForceGraphMethods } from 'react-force-graph-2d'
import { ANCHOR_KINDS, endpointId, labelForKind } from './graph'
import { colorForLink, colorForNode, withAlpha, type GraphPalette } from './palette'
import { escapeHtml, shortText } from './text'
import type { GraphData, GraphViewportHandle, KnowledgeLink, KnowledgeNode } from './types'

interface Graph2DProps {
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
    return { width: 1.15, alpha: 0.72 }
  }
  return { width: 0.8, alpha: 0.55 }
}

function tuneForces(graph: ForceGraphMethods<KnowledgeNode, KnowledgeLink> | undefined) {
  const charge = graph?.d3Force('charge') as { strength?: (value: number) => void } | undefined
  const link = graph?.d3Force('link') as { distance?: (value: number) => void } | undefined
  charge?.strength?.(-280)
  link?.distance?.(78)
}

const Graph2D = forwardRef<GraphViewportHandle, Graph2DProps>(function Graph2D({
  data, width, height, palette, selectedId, highlightedNodeIds, highlightedLinks: _highlightedLinks, focusActive, focusLinkKinds, interactionNonce, onSelect, onClearSelection, onLayoutChange
}, ref) {
  const graphRef = useRef<ForceGraphMethods<KnowledgeNode, KnowledgeLink>>(undefined)
  const positionCache = useRef(new Map<string, Pick<KnowledgeNode, 'x' | 'y'>>())
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
    graphData.nodes.forEach((node) => positionCache.current.set(node.id, { x: node.x, y: node.y }))
  }, [graphData])

  useEffect(() => {
    tuneForces(graphRef.current)
  }, [graphData])

  const focusNode = useCallback((nodeId: string) => {
    const node = graphData.nodes.find((candidate) => candidate.id === nodeId)
    if (!node || !Number.isFinite(node.x) || !Number.isFinite(node.y)) {
      pendingFocusId.current = nodeId
      return
    }
    const nodeX = node.x ?? 0
    const nodeY = node.y ?? 0
    const currentZoom = graphRef.current?.zoom() ?? 1
    graphRef.current?.centerAt(nodeX + 120 / currentZoom, nodeY, 450)
    graphRef.current?.zoom(Math.max(currentZoom, 2.4), 450)
    pendingFocusId.current = null
  }, [graphData.nodes])

  useImperativeHandle(ref, () => ({
    fit: () => graphRef.current?.zoomToFit(350, 64),
    zoomBy: (factor) => graphRef.current?.zoom(Math.min(24, Math.max(0.05, (graphRef.current?.zoom() ?? 1) * factor)), 180),
    focusNode,
    reheat: () => {
      onLayoutChange(true)
      tuneForces(graphRef.current)
      graphRef.current?.d3ReheatSimulation()
    }
  }), [focusNode, onLayoutChange])

  const isNodeEmphasized = useCallback((nodeId: string) => {
    if (!focusActive) return true
    return highlightedNodeIds.has(nodeId)
  }, [focusActive, highlightedNodeIds])

  const nodeColor = useCallback((node: KnowledgeNode) => {
    if (isNodeEmphasized(node.id)) return colorForNode(node.kind, palette)
    return withAlpha(palette.grayMid, 0.16)
  }, [isNodeEmphasized, palette])

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
    if (!focusActive) return withAlpha(colorForLink(link.kind, palette), 0.38)
    return withAlpha(colorForLink(link.kind, palette), alpha)
  }, [focusActive, palette])

  const nodeRadius = useCallback((node: KnowledgeNode, emphasized: boolean) => {
    const boost = ANCHOR_KINDS.has(node.kind) ? 5.4 : 4.2
    if (!emphasized) return Math.max(2.2, Math.sqrt(node.value) * 1.6)
    return Math.max(5, Math.sqrt(node.value) * boost)
  }, [])

  const drawNode = useCallback((node: KnowledgeNode, context: CanvasRenderingContext2D, scale: number) => {
    const x = node.x ?? 0
    const y = node.y ?? 0
    const emphasized = isNodeEmphasized(node.id)
    const radius = nodeRadius(node, emphasized)
    const selected = node.id === selectedId

    context.beginPath()
    context.arc(x, y, radius, 0, 2 * Math.PI)
    context.fillStyle = nodeColor(node)
    context.fill()

    if (selected) {
      context.lineWidth = 2 / scale
      context.strokeStyle = palette.navy
      context.stroke()
    }

    const showLabel = selected || (emphasized && (ANCHOR_KINDS.has(node.kind) || scale > 1.8))
    if (showLabel) {
      context.font = `${Math.max(9, (selected ? 13 : 11) / scale)}px Inter, system-ui, sans-serif`
      context.textAlign = 'left'
      context.textBaseline = 'middle'
      context.fillStyle = palette.navy
      context.fillText(node.label, x + radius + 4 / scale, y)
    }
  }, [isNodeEmphasized, nodeColor, nodeRadius, palette.navy, selectedId])

  const drawPointerArea = useCallback((node: KnowledgeNode, color: string, context: CanvasRenderingContext2D, scale: number) => {
    context.beginPath()
    context.arc(node.x ?? 0, node.y ?? 0, Math.max(nodeRadius(node, isNodeEmphasized(node.id)), 12 / scale), 0, 2 * Math.PI)
    context.fillStyle = color
    context.fill()
  }, [isNodeEmphasized, nodeRadius])

  return (
    <ForceGraph2D<KnowledgeNode, KnowledgeLink>
      ref={graphRef}
      graphData={graphData}
      width={width}
      height={height}
      backgroundColor={palette.white}
      warmupTicks={80}
      cooldownTime={2200}
      d3AlphaDecay={0.04}
      d3VelocityDecay={0.42}
      nodeVal="value"
      nodeLabel={nodeTooltip}
      nodeCanvasObjectMode={() => 'replace'}
      nodeCanvasObject={drawNode}
      nodePointerAreaPaint={drawPointerArea}
      linkVisibility={linkIsActive}
      linkColor={linkColor}
      linkWidth={(link) => (focusActive ? linkWeight(link.kind).width : 0.7)}
      linkDirectionalArrowLength={(link) => (focusActive && linkIsActive(link) ? 5 : 0)}
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
      enablePanInteraction
      enableZoomInteraction
      minZoom={0.2}
      maxZoom={12}
    />
  )
})

export default Graph2D
