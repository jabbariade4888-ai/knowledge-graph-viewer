import { useMemo, useState } from 'react'
import { IconSearchStroked } from '@consta/icons/IconSearchStroked'
import { Button } from '@consta/uikit/Button'
import { Checkbox } from '@consta/uikit/Checkbox'
import { Collapse } from '@consta/uikit/Collapse'
import { Text } from '@consta/uikit/Text'
import { TextField } from '@consta/uikit/TextField'
import { labelForKind, labelForLinkKind, searchNodes } from '../graph'
import { colorForLink, colorForNode, type GraphPalette } from '../palette'
import type { GraphFilters, KnowledgeGraph, KnowledgeNode } from '../types'

interface SidePanelProps {
  graph: KnowledgeGraph
  palette: GraphPalette
  filters: GraphFilters
  selectedId: string | null
  onFiltersChange: (next: GraphFilters) => void
  onSelect: (id: string) => void
  onReset: () => void
}

function toggleSetValue(values: Set<string>, value: string): Set<string> {
  const next = new Set(values)
  if (next.has(value)) next.delete(value)
  else next.add(value)
  return next
}

export default function SidePanel({ graph, palette, filters, selectedId, onFiltersChange, onSelect, onReset }: SidePanelProps) {
  const [query, setQuery] = useState('')
  const [activeIndex, setActiveIndex] = useState(-1)
  const counts = useMemo(() => {
    const result = new Map<string, number>()
    for (const node of graph.data.nodes) result.set(node.kind, (result.get(node.kind) ?? 0) + 1)
    return result
  }, [graph])
  const tasks = useMemo(() => graph.data.nodes.filter((node) => node.kind === 'task').sort(byLabel), [graph])
  const topics = useMemo(() => graph.data.nodes.filter((node) => node.kind === 'topic').sort(byLabel), [graph])
  const results = useMemo(() => searchNodes(graph.data.nodes, query), [graph, query])
  const isSearchOpen = query.trim().length > 0 && results.length > 0
  const filtersNarrowed = filters.kinds.size !== graph.allKinds.length || filters.linkKinds.size !== graph.allLinkKinds.length

  const updateFilter = (key: keyof GraphFilters, value: string) => {
    onFiltersChange({ ...filters, [key]: toggleSetValue(filters[key], value) })
  }

  const choose = (node: KnowledgeNode) => {
    onSelect(node.id)
    setQuery('')
    setActiveIndex(-1)
  }

  return (
    <aside className="nav-panel" aria-label="Категории базы знаний">
      <div className="panel-heading">
        <div>
          <Text as="h2" size="m" weight="semibold" view="primary">Категории</Text>
          <Text className="panel-caption" size="2xs" view="secondary">Типы узлов вашей базы</Text>
        </div>
        <Button view="clear" size="xs" label="К карте" onClick={onReset} />
      </div>

      <div className="search-box">
        <TextField
          id="nav-search"
          label="Поиск"
          size="s"
          value={query}
          placeholder="Концепция, инструмент, задача"
          leftSide={IconSearchStroked}
          withClearButton
          autoComplete="off"
          aria-expanded={isSearchOpen}
          aria-controls={isSearchOpen ? 'nav-search-results' : undefined}
          onChange={(value) => { setQuery(value ?? ''); setActiveIndex(-1) }}
          onKeyDown={(event) => {
            if (event.key === 'ArrowDown' && results.length) { event.preventDefault(); setActiveIndex((index) => Math.min(index + 1, results.length - 1)) }
            if (event.key === 'ArrowUp' && results.length) { event.preventDefault(); setActiveIndex((index) => Math.max(index - 1, 0)) }
            if (event.key === 'Enter' && results[activeIndex]) { event.preventDefault(); choose(results[activeIndex]) }
            if (event.key === 'Escape') { setQuery(''); setActiveIndex(-1) }
          }}
        />
        {isSearchOpen ? (
          <ul className="search-results stagger-enter" id="nav-search-results" role="listbox" aria-label="Результаты поиска">
            {results.map((item, index) => (
              <li aria-selected={activeIndex === index} key={item.id} role="option">
                <button type="button" onClick={() => choose(item)}>
                  <Text size="s" view="primary">{item.label}</Text>
                  <Text size="2xs" view="secondary">{labelForKind(item.kind)}</Text>
                </button>
              </li>
            ))}
          </ul>
        ) : null}
      </div>

      <fieldset className="filter-group">
        <Text as="legend" size="s" weight="semibold" view="primary">Тип узла</Text>
        <div className="filter-options">
          {graph.allKinds.map((kind) => (
            <label className="filter-option" key={kind}>
              <Checkbox checked={filters.kinds.has(kind)} size="s" onChange={() => updateFilter('kinds', kind)} />
              <span className="color-dot" style={{ backgroundColor: colorForNode(kind, palette) }} aria-hidden="true" />
              <Text size="s" view="primary">{labelForKind(kind)}</Text>
              <Text className="nav-item-count tabular-nums" size="2xs" view="secondary">{counts.get(kind) ?? 0}</Text>
            </label>
          ))}
        </div>
      </fieldset>

      <section className="anchor-section" aria-label="Задачи">
        <Text as="h3" size="s" weight="semibold" view="primary">Задачи</Text>
        <div className="filter-options">
          {tasks.map((task) => (
            <button
              key={task.id}
              type="button"
              className={`filter-option anchor-button${selectedId === task.id ? ' is-active' : ''}`}
              onClick={() => onSelect(task.id)}
            >
              <span className="color-dot" style={{ backgroundColor: colorForNode('task', palette) }} aria-hidden="true" />
              <Text size="s" view="primary">{task.label}</Text>
            </button>
          ))}
        </div>
      </section>

      <section className="anchor-section" aria-label="Темы">
        <Text as="h3" size="s" weight="semibold" view="primary">Темы</Text>
        <div className="filter-options">
          {topics.map((topic) => (
            <button
              key={topic.id}
              type="button"
              className={`filter-option anchor-button${selectedId === topic.id ? ' is-active' : ''}`}
              onClick={() => onSelect(topic.id)}
            >
              <span className="color-dot" style={{ backgroundColor: colorForNode('topic', palette) }} aria-hidden="true" />
              <Text size="s" view="primary">{topic.label}</Text>
            </button>
          ))}
        </div>
      </section>

      <Collapse
        className="expert-mode"
        size="s"
        view="clear"
        divider
        label={<Text size="s" weight="semibold" view="primary">Типы связей</Text>}
      >
        <div className="filter-options">
          {graph.allLinkKinds.map((kind) => (
            <label className="filter-option" key={kind}>
              <Checkbox checked={filters.linkKinds.has(kind)} size="s" onChange={() => updateFilter('linkKinds', kind)} />
              <span className="color-dot" style={{ backgroundColor: colorForLink(kind, palette) }} aria-hidden="true" />
              <Text size="s" view="primary">{labelForLinkKind(kind)}</Text>
            </label>
          ))}
        </div>
        {filtersNarrowed ? (
          <Button
            view="clear"
            size="xs"
            label="Показать все категории"
            onClick={() => onFiltersChange({
              kinds: new Set(graph.allKinds),
              linkKinds: new Set(graph.allLinkKinds)
            })}
          />
        ) : null}
      </Collapse>
    </aside>
  )
}

function byLabel(left: KnowledgeNode, right: KnowledgeNode): number {
  return left.label.localeCompare(right.label, 'ru')
}
