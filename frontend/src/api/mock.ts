import type { ChartData, Planet } from './types'

export const mockPlanets: Planet[] = [
  { id: 'p1', name: 'Планета 1', color: '#6ec1ff', size: 0.3, angle: 90, description: 'Здесь будет описание планеты 1. Текст приходит с бэкенда.' },
  { id: 'p2', name: 'Планета 2', color: '#c08bff', size: 0.5, angle: 150, description: 'Здесь будет описание планеты 2. Текст приходит с бэкенда.' },
  { id: 'p3', name: 'Планета 3', color: '#ff8c69', size: 0.55, angle: 20, description: 'Здесь будет описание планеты 3. Текст приходит с бэкенда.' },
  { id: 'p4', name: 'Планета 4', color: '#5fd4a0', size: 0.42, angle: 320, description: 'Здесь будет описание планеты 4. Текст приходит с бэкенда.' },
  { id: 'p5', name: 'Планета 5', color: '#ff7eb6', size: 0.28, angle: 255, description: 'Здесь будет описание планеты 5. Текст приходит с бэкенда.' },
]

export const mockCharts: Record<1 | 2, ChartData> = {
  1: {
    title: 'График 1',
    kind: 'line',
    points: [
      { label: 'Пн', value: 12 }, { label: 'Вт', value: 30 }, { label: 'Ср', value: 22 },
      { label: 'Чт', value: 48 }, { label: 'Пт', value: 40 }, { label: 'Сб', value: 65 },
    ],
  },
  2: {
    title: 'График 2',
    kind: 'bar',
    points: [
      { label: 'A', value: 20 }, { label: 'B', value: 55 }, { label: 'C', value: 35 },
      { label: 'D', value: 70 }, { label: 'E', value: 45 },
    ],
  },
}
