import sourceUrl from '../kb.example.json?url'
import { snapshotFromKb } from './kb'
import type { GraphSnapshot } from './types'

export async function loadSnapshot(): Promise<GraphSnapshot> {
  const response = await fetch(sourceUrl)
  if (!response.ok) {
    throw new Error(`Не удалось загрузить демонстрационный граф: ${response.status}.`)
  }

  return snapshotFromKb(await response.json())
}
