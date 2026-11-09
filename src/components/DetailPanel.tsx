import { Button } from '@consta/uikit/Button'
import { Collapse } from '@consta/uikit/Collapse'
import { Text } from '@consta/uikit/Text'
import { labelForKind, labelForLinkKind } from '../graph'
import { colorForLink, colorForNode, type GraphPalette } from '../palette'
import type { KnowledgeGraph, KnowledgeLink, KnowledgeNode } from '../types'

interface DetailPanelProps {
  graph: KnowledgeGraph
  node: KnowledgeNode | undefined
  links: KnowledgeLink[]
  palette: GraphPalette
  onSelect: (id: string) => void
}

export default function DetailPanel({ graph, node, links, palette, onSelect }: DetailPanelProps) {
  if (!node) return null

  const facts = [
    ['Добавлено', node.added],
    ['Автор', node.author],
    ['Площадка', node.platform],
    ['Теги', node.tags?.length ? node.tags.join(', ') : undefined]
  ].filter((entry): entry is [string, string] => Boolean(entry[1]))
  const byKind = new Map<string, KnowledgeLink[]>()
  for (const link of links) byKind.set(link.kind, [...(byKind.get(link.kind) ?? []), link])

  return (
    <aside className="detail-panel detail-panel--column" aria-label="Карточка выбранной сущности">
      <div className="detail-heading">
        <span className="color-dot large" style={{ backgroundColor: colorForNode(node.kind, palette) }} aria-hidden="true" />
        <div>
          <Text className="eyebrow" size="2xs" weight="bold" view="secondary" transform="uppercase" spacing="s">
            {labelForKind(node.kind)}
          </Text>
          <Text as="h2" size="l" weight="bold" view="primary">{node.label}</Text>
        </div>
      </div>
      <Text className="node-id" size="2xs" view="secondary" font="mono">{node.id}</Text>
      {node.summary ? <Text className="node-prose" size="s" view="primary">{node.summary}</Text> : null}
      {node.rawClaim ? (
        <section className="prose-block">
          <Text className="eyebrow" size="2xs" weight="bold" view="secondary" transform="uppercase">Утверждение поста</Text>
          <Text className="node-prose" size="s" view="primary">{node.rawClaim}</Text>
        </section>
      ) : null}
      {node.verifiedFacts ? (
        <section className="prose-block">
          <Text className="eyebrow" size="2xs" weight="bold" view="secondary" transform="uppercase">Проверенные факты</Text>
          <Text className="node-prose" size="s" view="primary">{node.verifiedFacts}</Text>
        </section>
      ) : null}
      {node.url ? (
        <a className="detail-link" href={node.url} target="_blank" rel="noreferrer">{node.url}</a>
      ) : null}
      {facts.length ? (
        <dl className="metadata">
          {facts.map(([label, value]) => (
            <div key={label}>
              <Text as="dt" size="2xs" view="secondary">{label}</Text>
              <Text as="dd" size="s" view="primary" align="right">{value}</Text>
            </div>
          ))}
        </dl>
      ) : null}
      <section className="neighbor-section">
        <Text as="h3" size="m" weight="semibold" view="primary">
          Соседи: <span className="tabular-nums">{links.length}</span>
        </Text>
        {links.length === 0 ? <Text size="s" view="secondary">Нет связей в текущем срезе.</Text> : null}
        {[...byKind.entries()].map(([kind, kindLinks]) => (
          <Collapse
            key={kind}
            size="s"
            view="clear"
            divider
            isOpen={kindLinks.length <= 8}
            label={(
              <span className="collapse-label">
                <span className="color-dot" style={{ backgroundColor: colorForLink(kind, palette) }} aria-hidden="true" />
                <Text size="s" view="primary">{labelForLinkKind(kind)} · <span className="tabular-nums">{kindLinks.length}</span></Text>
              </span>
            )}
          >
            <ul className="neighbor-list">
              {kindLinks.map((link, index) => {
                const neighborId = link.source === node.id ? link.target : link.source
                const neighbor = graph.nodeById.get(neighborId)
                return (
                  <li key={`${kind}-${link.source}-${link.target}-${index}`}>
                    <Button
                      view="clear"
                      size="xs"
                      label={neighbor?.label ?? neighborId}
                      onClick={() => onSelect(neighborId)}
                      className="neighbor-link"
                    />
                    <Text size="2xs" view="secondary">{link.source === node.id ? 'исходящая' : 'входящая'}</Text>
                    {link.note ? <Text className="edge-note" size="2xs" view="ghost">{link.note}</Text> : null}
                  </li>
                )
              })}
            </ul>
          </Collapse>
        ))}
      </section>
    </aside>
  )
}
