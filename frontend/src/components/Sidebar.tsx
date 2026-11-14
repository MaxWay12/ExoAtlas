import type { ProjectInfo } from '../api/types'
import { NavIcon, type IconName } from './icons'

const items: { id: IconName; label: string }[] = [
  { id: 'home', label: 'Главная' },
  { id: 'galaxy', label: 'Вселенная' },
  { id: 'top', label: 'Топ-50' },
  { id: 'catalog', label: 'Все экзопланеты' },
]

export function Sidebar({ project, active }: { project: ProjectInfo | null; active: string }) {
  return (
    <aside className="sidebar">
      <h1 className="project-name">{project?.name ?? 'ExoAtlas'}</h1>
      <nav aria-label="Разделы">
        {items.map((item) => (
          <a key={item.id} href={`#${item.id}`} aria-current={active === item.id ? 'page' : undefined}>
            <NavIcon name={item.id} />
            {item.label}
          </a>
        ))}
      </nav>
      {project?.team.name && <section className="team" aria-labelledby="team-title">
        <p className="team-event">Сделано для TulaHack-2026</p>
        <h2 id="team-title">Команда {project.team.name}</h2>
        <ul>
          {project.team.members.map((member) => <li key={member}>{member}</li>)}
        </ul>
      </section>}
    </aside>
  )
}
