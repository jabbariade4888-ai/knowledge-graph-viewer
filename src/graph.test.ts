import { describe, expect, it } from 'vitest'
import kb from '../kb.example.json' with { type: 'json' }
import { buildKnowledgeGraph } from './graph'
import { snapshotFromKb } from './kb'

describe('snapshotFromKb', () => {
  const snapshot = snapshotFromKb(kb)
  const graph = buildKnowledgeGraph(snapshot)

  it('превращает источники в узлы и сохраняет все связи', () => {
    expect(snapshot.nodes).toHaveLength(kb.sources.length + kb.nodes.length)
    expect(snapshot.edges).toHaveLength(kb.edges.length)
    expect(graph.data.links).toHaveLength(kb.edges.length)
  })

  it('использует категории базы, а не слои чужой онтологии', () => {
    expect(graph.allKinds).toEqual(['task', 'topic', 'concept', 'tool', 'source', 'claim', 'person', 'org', 'project'])
    expect(graph.allLinkKinds).toContain('applicable_to')
    expect(graph.allLinkKinds).toContain('authored_by')
    expect(graph.nodeById.get('task:publish-notes')?.label).toBe('Опубликовать заметку')
    expect(graph.nodeById.get('src:demo-article')?.kind).toBe('source')
  })

  it('не публикует владельца и личные пометки в демоданных', () => {
    expect(snapshot.meta.owner).toBe('')
    const blob = JSON.stringify(kb)
    expect(blob).not.toMatch(/t\.me\/|BEGIN |ssh-|password|api[_-]?key|@/)
  })
})
