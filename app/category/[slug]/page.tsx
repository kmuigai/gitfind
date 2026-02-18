import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { getReposByCategory } from '@/lib/queries'
import ProjectCard from '@/components/ProjectCard'
import NewsletterSignup from '@/components/NewsletterSignup'
import Link from 'next/link'

export const revalidate = 3600

interface Category {
  name: string
  slug: string
  description: string
  emoji: string
}

const CATEGORIES: Category[] = [
  {
    name: 'AI / Machine Learning',
    slug: 'ai-ml',
    description: 'Artificial intelligence, machine learning, LLMs, and neural networks — the projects shaping how software thinks.',
    emoji: '🤖',
  },
  {
    name: 'Developer Tools',
    slug: 'developer-tools',
    description: 'Tools, utilities, and frameworks that make developers faster. The picks here often become the new industry standard.',
    emoji: '🛠️',
  },
  {
    name: 'Security',
    slug: 'security',
    description: 'Cybersecurity, cryptography, and privacy tools. Rising projects here often signal new attack vectors or defensive capabilities.',
    emoji: '🔐',
  },
  {
    name: 'Data & Analytics',
    slug: 'data-analytics',
    description: 'Data science, analytics, databases, and visualization. The infrastructure layer that every data-driven product is built on.',
    emoji: '📊',
  },
  {
    name: 'Web Frameworks',
    slug: 'web-frameworks',
    description: 'Frontend and backend web development frameworks. Adoption patterns here predict what your engineering team will be using in 2 years.',
    emoji: '🌐',
  },
  {
    name: 'Infrastructure & DevOps',
    slug: 'infrastructure-devops',
    description: 'Cloud infrastructure, containers, orchestration, and DevOps tools. The invisible foundation every product runs on.',
    emoji: '⚙️',
  },
  {
    name: 'Mobile',
    slug: 'mobile',
    description: 'iOS, Android, and cross-platform mobile development. Where the next wave of consumer products is being built.',
    emoji: '📱',
  },
  {
    name: 'Open Source Utilities',
    slug: 'open-source-utilities',
    description: 'General-purpose utilities, automation tools, and productivity projects. The quiet projects that end up powering everything else.',
    emoji: '🔧',
  },
]

interface Props {
  params: Promise<{ slug: string }>
}

export async function generateStaticParams() {
  return CATEGORIES.map((cat) => ({ slug: cat.slug }))
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params
  const category = CATEGORIES.find((c) => c.slug === slug)
  if (!category) return {}

  return {
    title: `Top Rising ${category.name} Projects`,
    description: `Discover the fastest-growing ${category.name} projects on GitHub, ranked by Early Signal Score. ${category.description}`,
    openGraph: {
      title: `Top Rising ${category.name} Projects — GitFind`,
      description: `Find the next big ${category.name} project before it goes mainstream.`,
    },
  }
}

export default async function CategoryPage({ params }: Props) {
  const { slug } = await params
  const category = CATEGORIES.find((c) => c.slug === slug)

  if (!category) {
    notFound()
  }

  const projects = await getReposByCategory(category.name)

  return (
    <div>
      {/* Header */}
      <section className="border-b border-[var(--border)] px-4 py-12 sm:px-6">
        <div className="mx-auto max-w-7xl">
          {/* Breadcrumb */}
          <nav className="mb-6 flex items-center gap-2 text-xs text-[var(--foreground-subtle)]">
            <Link href="/" className="transition-colors hover:text-[var(--foreground)]">
              GitFind
            </Link>
            <span>/</span>
            <span className="text-[var(--foreground-muted)]">{category.name}</span>
          </nav>

          <div className="flex items-start gap-4">
            <span className="text-4xl">{category.emoji}</span>
            <div>
              <h1 className="text-2xl font-bold text-[var(--foreground)] sm:text-3xl">
                {category.name}
              </h1>
              <p className="mt-2 max-w-2xl text-sm leading-relaxed text-[var(--foreground-muted)]">
                {category.description}
              </p>
              <p className="mt-3 text-xs text-[var(--foreground-subtle)]">
                Ranked by Early Signal Score — projects most likely to break out before mainstream coverage.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Projects grid */}
      <section className="px-4 py-10 sm:px-6">
        <div className="mx-auto max-w-7xl">
          {projects.length > 0 ? (
            <>
              <div className="mb-4 text-xs text-[var(--foreground-subtle)]">
                {projects.length} project{projects.length !== 1 ? 's' : ''} in this category
              </div>
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {projects.map((project) => (
                  <ProjectCard key={project.id} project={project} />
                ))}
              </div>
            </>
          ) : (
            <div className="rounded-xl border border-dashed border-[var(--border)] py-16 text-center">
              <span className="text-4xl">{category.emoji}</span>
              <p className="mt-4 text-sm text-[var(--foreground-muted)]">
                No {category.name} projects yet.
              </p>
              <p className="mt-1 text-xs text-[var(--foreground-subtle)]">
                The pipeline runs nightly and will populate this category automatically.
              </p>
            </div>
          )}
        </div>
      </section>

      {/* Other categories */}
      <section className="border-t border-[var(--border)] px-4 py-10 sm:px-6">
        <div className="mx-auto max-w-7xl">
          <h2 className="mb-4 text-sm font-medium text-[var(--foreground-muted)]">
            Other categories
          </h2>
          <div className="flex flex-wrap gap-2">
            {CATEGORIES.filter((c) => c.slug !== slug).map((cat) => (
              <Link
                key={cat.slug}
                href={`/category/${cat.slug}`}
                className="rounded-md border border-[var(--border)] px-3 py-1.5 text-xs text-[var(--foreground-muted)] transition-colors hover:border-[var(--accent)]/40 hover:bg-[var(--background-elevated)] hover:text-[var(--foreground)]"
              >
                {cat.emoji} {cat.name}
              </Link>
            ))}
          </div>
        </div>
      </section>

      <NewsletterSignup />
    </div>
  )
}
