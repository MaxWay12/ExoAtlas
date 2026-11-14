import type { ProjectInfo } from '../api/types'

const items = [
  { id: 'home', label: 'Главная', path: 'M12 3a9 9 0 100 18 9 9 0 000-18zm0 6a3 3 0 100 6 3 3 0 000-6z' },
  { id: 'top', label: 'Топ-50', path: 'M4 19V9M10 19V5M16 19v-7M21 19H3' },
  { id: 'catalog', label: 'Все экзопланеты', path: 'M12 3l2.6 5.6 6.1.7-4.5 4.2 1.2 6L12 16.5l-5.4 3 1.2-6L3.3 9.3l6.1-.7z' },
]

export function Sidebar({ project, active }: { project: ProjectInfo | null; active: string }) {
  return (
    <aside className="sidebar">
      <h1 className="project-name">{project?.name ?? 'ExoAtlas'}</h1>
      <nav aria-label="Разделы">
        {items.map((item) => (
          <a key={item.id} href={`#${item.id}`} aria-current={active === item.id ? 'page' : undefined}>
            <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" aria-hidden="true">
              <path d={item.path} />
            </svg>
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
