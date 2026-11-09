import { lazy, Suspense, useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { IconAdd } from '@consta/icons/IconAdd'
import { IconFitToDefault } from '@consta/icons/IconFitToDefault'
import { IconMoon } from '@consta/icons/IconMoon'
import { IconRemove } from '@consta/icons/IconRemove'
import { IconRestart } from '@consta/icons/IconRestart'
import { IconSun } from '@consta/icons/IconSun'
import { Badge } from '@consta/uikit/Badge'
import { Button } from '@consta/uikit/Button'
import { ChoiceGroup } from '@consta/uikit/ChoiceGroup'
import { Informer } from '@consta/uikit/Informer'
import { Text } from '@consta/uikit/Text'
import DetailPanel from './components/DetailPanel'
import SidePanel from './components/SidePanel'
import Graph2D from './Graph2D'
import GraphErrorBoundary from './GraphErrorBoundary'
import { loadSnapshot } from './data'
import { snapshotFromKb } from './kb'
import {
  buildKnowledgeGraph,
  createAllFilters,
  filterGraph,
  formatUpdated,
  labelForKind,
  linksForNode,
  neighborIds
} from './graph'
import { colorForNode, useGraphPalette } from './palette'
import type { AppThemeMode } from './theme'
import type { GraphFilters, GraphMode, GraphViewportHandle, KnowledgeGraph } from './types'

interface AppProps {
  themeMode: AppThemeMode
  onToggleTheme: () => void
}

const Graph3D = lazy(() => import('./Graph3D'))

const MODE_ITEMS: Array<{ label: string; value: GraphMode }> = [
  { label: '2D', value: '2d' },
  { label: '3D', value: '3d' }
]

function supportsWebGL(): boolean {
  try {
    const canvas = document.createElement('canvas')
    return Boolean(canvas.getContext('webgl') || canvas.getContext('experimental-webgl'))
  } catch {
    return false
  }
}

function useGraphViewportSize<T extends HTMLElement>() {
  const [element, setElement] = useState<T | null>(null)
  const [size, setSize] = useState({ width: 0, height: 0 })
  const ref = useCallback((node: T | null) => setElement(node), [])

  useLayoutEffect(() => {
    if (!element) return undefined
    const updateSize = () => {
      const next = { width: Math.floor(element.clientWidth), height: Math.floor(element.clientHeight) }
      setSize((current) => current.width === next.width && current.height === next.height ? current : next)
    }
    updateSize()
    const observer = new ResizeObserver(updateSize)
    observer.observe(element)
    return () => observer.disconnect()
  }, [element])

  return { ref, size }
}

export default function App({ themeMode, onToggleTheme }: AppProps) {
  const [graph, setGraph] = useState<KnowledgeGraph | null>(null)
  const [filters, setFilters] = useState<GraphFilters | null>(null)
  const [mode, setMode] = useState<GraphMode>('2d')
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)
  const [dataLabel, setDataLabel] = useState('демонстрационные данные')
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [layoutRunning, setLayoutRunning] = useState(true)
  const [interactionNonce, setInteractionNonce] = useState(0)
  const palette = useGraphPalette(themeMode)
  const graphViewportRef = useRef<GraphViewportHandle | null>(null)
  const { ref: graphSurfaceRef, size } = useGraphViewportSize<HTMLDivElement>()
  const isDark = themeMode === 'dark'

  useEffect(() => {
    let cancelled = false
    loadSnapshot().then((snapshot) => {
      if (cancelled) return
      const knowledgeGraph = buildKnowledgeGraph(snapshot)
      setGraph(knowledgeGraph)
      setFilters(createAllFilters(knowledgeGraph))
    }).catch((loadError: unknown) => {
      if (!cancelled) setError(loadError instanceof Error ? loadError.message : 'Неизвестная ошибка загрузки данных.')
    })
    return () => { cancelled = true }
  }, [])

  const view = useMemo(() => (graph && filters ? filterGraph(graph, filters) : null), [filters, graph])
  const visibleNodesById = useMemo(() => new Map(view?.nodes.map((node) => [node.id, node])), [view])
  const highlightedNodeIds = useMemo(() => (view && selectedId ? neighborIds(selectedId, view) : new Set<string>()), [selectedId, view])
  const selectedNode = selectedId ? visibleNodesById.get(selectedId) : undefined
  const selectedLinks = useMemo(() => (view && selectedId ? linksForNode(selectedId, view) : []), [selectedId, view])
  const focusActive = Boolean(selectedId && selectedNode)
  const modeValue = MODE_ITEMS.find((item) => item.value === mode) ?? MODE_ITEMS[0]

  useEffect(() => {
    if (selectedId && view && !visibleNodesById.has(selectedId)) setSelectedId(null)
  }, [selectedId, view, visibleNodesById])

  const markInteraction = useCallback(() => setInteractionNonce((current) => current || 1), [])

  const openKnowledgeFile = useCallback(async (file: File | undefined) => {
    if (!file) return
    try {
      const snapshot = snapshotFromKb(JSON.parse(await file.text()))
      const knowledgeGraph = buildKnowledgeGraph(snapshot)
      setGraph(knowledgeGraph)
      setFilters(createAllFilters(knowledgeGraph))
      setSelectedId(null)
      setDataLabel(file.name)
      setNotice(null)
    } catch (loadError: unknown) {
      setNotice(loadError instanceof Error ? loadError.message : 'Не удалось прочитать файл.')
    }
  }, [])

  const selectNode = useCallback((id: string) => {
    setSelectedId(id)
    window.requestAnimationFrame(() => graphViewportRef.current?.focusNode(id))
  }, [])

  const resetView = useCallback(() => {
    if (!graph) return
    setFilters(createAllFilters(graph))
    setSelectedId(null)
    window.requestAnimationFrame(() => graphViewportRef.current?.fit())
  }, [graph])

  const changeMode = (nextMode: GraphMode) => {
    if (nextMode === '3d' && !supportsWebGL()) {
      setNotice('Этот браузер не поддерживает WebGL, поэтому доступен только 2D-режим.')
      return
    }
    setNotice(null)
    setMode(nextMode)
  }

  const handle3DError = useCallback(() => {
    setNotice('3D-режим недоступен. Включён стабильный 2D-режим.')
    setMode('2d')
  }, [])

  const handleLayoutChange = useCallback((running: boolean) => setLayoutRunning(running), [])

  if (error) {
    return (
      <main className="status-page">
        <Text as="h1" size="2xl" weight="bold" view="primary">Граф не удалось открыть</Text>
        <Text size="m" view="secondary">{error}</Text>
      </main>
    )
  }

  if (!graph || !filters || !view) {
    return (
      <main className="status-page stagger-enter">
        <Text as="h1" size="2xl" weight="bold" view="primary">Загрузка базы знаний</Text>
        <Text size="m" view="secondary">Собираем категории и связи.</Text>
      </main>
    )
  }

  const updated = formatUpdated(graph.snapshot.meta.updated)
  const graphProps = {
    data: view,
    width: size.width,
    height: size.height,
    palette,
    selectedId,
    highlightedNodeIds,
    highlightedLinks: new Set<string>(),
    focusActive,
    focusLinkKinds: null,
    interactionNonce,
    onSelect: selectNode,
    onClearSelection: () => setSelectedId(null),
    onLayoutChange: handleLayoutChange
  }

  return (
    <main className="app-shell">
      <header className="app-header">
        <div className="product-brand">
          <div className="header-copy">
            <Text as="h1" size="l" weight="semibold" view="primary">База знаний</Text>
            <Text size="2xs" view="secondary">
              {dataLabel}
              {graph.snapshot.meta.owner ? ` · ${graph.snapshot.meta.owner}` : ''}
              {updated ? ` · обновлено ${updated}` : ''}
            </Text>
          </div>
        </div>
        <div className="header-stats" aria-label="Статистика графа">
          <div>
            <Text className="stat-value tabular-nums" size="m" weight="semibold" view="primary">
              {view.nodes.length.toLocaleString('ru-RU')}
            </Text>
            <Text size="2xs" view="secondary">из {graph.data.nodes.length.toLocaleString('ru-RU')} узлов</Text>
          </div>
          <div>
            <Text className="stat-value tabular-nums" size="m" weight="semibold" view="primary">
              {view.links.length.toLocaleString('ru-RU')}
            </Text>
            <Text size="2xs" view="secondary">из {graph.data.links.length.toLocaleString('ru-RU')} связей</Text>
          </div>
        </div>
        <div className="header-controls">
          <input
            ref={fileInputRef}
            type="file"
            accept="application/json,.json"
            hidden
            onChange={(event) => {
              void openKnowledgeFile(event.currentTarget.files?.[0])
              event.currentTarget.value = ''
            }}
          />
          <Button
            view="ghost"
            size="s"
            label="Открыть JSON"
            title="Файл читается только в браузере и не сохраняется в проект"
            onClick={() => fileInputRef.current?.click()}
          />
          <ChoiceGroup
            name="graph-mode"
            size="s"
            view="ghost"
            value={modeValue}
            items={MODE_ITEMS}
            getItemLabel={(item) => item.label}
            onChange={(value) => changeMode(value.value)}
            aria-label="Режим визуализации"
          />
          <Button
            view="ghost"
            size="s"
            onlyIcon
            iconLeft={isDark ? IconSun : IconMoon}
            aria-label={isDark ? 'Включить светлую тему' : 'Включить тёмную тему'}
            title={isDark ? 'Светлая тема' : 'Тёмная тема'}
            onClick={onToggleTheme}
          />
        </div>
      </header>

      {notice ? <Informer className="notice" status="warning" view="bordered" size="s" label={notice} /> : null}

      <nav className="breadcrumbs" aria-label="Хлебные крошки">
        <span className="breadcrumb-item">
          <button type="button" onClick={() => setSelectedId(null)}>Вся база</button>
        </span>
        {selectedNode ? (
          <span className="breadcrumb-item">
            <span className="breadcrumb-sep" aria-hidden="true">/</span>
            <button type="button" onClick={() => setFilters({ ...filters, kinds: new Set([selectedNode.kind]) })}>
              {labelForKind(selectedNode.kind)}
            </button>
            <span className="breadcrumb-sep" aria-hidden="true">/</span>
            <button type="button">{selectedNode.label}</button>
          </span>
        ) : null}
      </nav>

      <section className={`workspace${selectedNode ? ' workspace--with-catalog' : ''}`} aria-label="Рабочая область">
        <SidePanel
          graph={graph}
          palette={palette}
          filters={filters}
          selectedId={selectedId}
          onFiltersChange={setFilters}
          onSelect={selectNode}
          onReset={resetView}
        />

        <section className="graph-column">
          <div className="graph-toolbar">
            <div>
              <Text className="eyebrow" size="2xs" weight="semibold" view="brand" transform="uppercase">
                {focusActive ? 'Соседи выбранного узла' : 'Полный граф базы знаний'}
              </Text>
              <Text as="h2" size="xl" weight="semibold" view="primary">{selectedNode?.label ?? 'Вся база'}</Text>
              <Text id="graph-instructions" size="2xs" view="secondary">
                Цвет узла — категория. Клик показывает карточку и соседние связи.
              </Text>
            </div>
            <div className="graph-actions">
              <Badge
                size="s"
                view="stroked"
                status={layoutRunning ? 'normal' : 'success'}
                label={layoutRunning ? 'Расчёт раскладки' : 'Раскладка готова'}
              />
              <span className="action-divider" aria-hidden="true" />
              <Button view="clear" size="s" onlyIcon iconLeft={IconFitToDefault} aria-label="Вписать граф в экран" title="Вписать в экран" onClick={() => graphViewportRef.current?.fit()} />
              <Button view="clear" size="s" onlyIcon iconLeft={IconRestart} aria-label="Перестроить граф" title="Перестроить" onClick={() => graphViewportRef.current?.reheat()} />
              {mode === '2d' ? (
                <>
                  <Button view="clear" size="s" onlyIcon iconLeft={IconRemove} aria-label="Отдалить граф" title="Отдалить" onClick={() => graphViewportRef.current?.zoomBy(0.8)} />
                  <Button view="clear" size="s" onlyIcon iconLeft={IconAdd} aria-label="Приблизить граф" title="Приблизить" onClick={() => graphViewportRef.current?.zoomBy(1.25)} />
                </>
              ) : null}
            </div>
          </div>
          <div
            className="graph-surface"
            ref={graphSurfaceRef}
            onPointerDownCapture={markInteraction}
            onWheelCapture={markInteraction}
            aria-describedby="graph-instructions"
          >
            {size.width > 0 && size.height > 0 && view.nodes.length > 0 ? (
              mode === '2d'
                ? <Graph2D ref={graphViewportRef} {...graphProps} />
                : (
                  <GraphErrorBoundary onError={handle3DError}>
                    <Suspense fallback={<div className="graph-fallback" role="status"><Text size="s" view="secondary">Загрузка 3D-визуализации</Text></div>}>
                      <Graph3D ref={graphViewportRef} {...graphProps} />
                    </Suspense>
                  </GraphErrorBoundary>
                )
            ) : (
              <div className="graph-fallback" role="status">
                <Text size="s" view="secondary">
                  {view.nodes.length ? 'Подготовка области графа' : 'Нет узлов для отображения. Включите хотя бы одну категорию.'}
                </Text>
              </div>
            )}
          </div>
          <div className="legend" aria-label="Легенда категорий">
            {graph.allKinds.map((kind) => (
              <span key={kind}>
                <i className="legend-swatch" style={{ background: colorForNode(kind, palette) }} aria-hidden="true" />
                <Text size="2xs" view="secondary">{labelForKind(kind)}</Text>
              </span>
            ))}
          </div>
        </section>

        {selectedNode ? (
          <DetailPanel
            graph={graph}
            node={selectedNode}
            links={selectedLinks}
            palette={palette}
            onSelect={selectNode}
          />
        ) : null}
      </section>
    </main>
  )
}
