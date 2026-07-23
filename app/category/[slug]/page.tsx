import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import Link from 'next/link'
import { getReposByCategory } from '@/lib/queries'
import RepoCard from '@/components/RepoCard'
import NewsletterSignup from '@/components/NewsletterSignup'
import Reveal from '@/components/Reveal'

export const revalidate = 3600

interface Category {
  name: string
  slug: string
  description: string
}

const CATEGORIES: Category[] = [
  {
    name: 'AI / Machine Learning',
    slug: 'ai-ml',
    description: 'Artificial intelligence, machine learning, LLMs, and neural networks — the projects shaping how software thinks.',
  },
  {
    name: 'Developer Tools',
    slug: 'developer-tools',
    description: 'Tools, utilities, and frameworks that make developers faster. The picks here often become the new industry standard.',
  },
  {
    name: 'Security',
    slug: 'security',
    description: 'Cybersecurity, cryptography, and privacy tools. Rising projects here often signal new attack vectors or defensive capabilities.',
  },
  {
    name: 'Data & Analytics',
    slug: 'data-analytics',
    description: 'Data science, analytics, databases, and visualization. The infrastructure layer that every data-driven product is built on.',
  },
  {
    name: 'Web Frameworks',
    slug: 'web-frameworks',
    description: 'Frontend and backend web development frameworks. Adoption patterns here predict what your engineering team will be using in 2 years.',
  },
  {
    name: 'Infrastructure & DevOps',
    slug: 'infrastructure-devops',
    description: 'Cloud infrastructure, containers, orchestration, and DevOps tools. The invisible foundation every product runs on.',
  },
  {
    name: 'Mobile',
    slug: 'mobile',
    description: 'iOS, Android, and cross-platform mobile development. Where the next wave of consumer products is being built.',
  },
  {
    name: 'Open Source Utilities',
    slug: 'open-source-utilities',
    description: 'General-purpose utilities, automation tools, and productivity projects. The quiet projects that end up powering everything else.',
  },
]

interface Props {
  params: Promise<{ slug: string }>
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params
  const category = CATEGORIES.find((c) => c.slug === slug)
  if (!category) return {}

  const url = `https://gitfind.ai/category/${slug}`
  const year = new Date().getFullYear()

  return {
    title: `Top Rising ${category.name} Projects on GitHub (${year})`,
    description: `Discover the fastest-growing ${category.name} open source projects on GitHub, ranked and explained in plain English. ${category.description}`,
    alternates: { canonical: url },
    openGraph: {
      title: `Top Rising ${category.name} Projects on GitHub — GitFind`,
      description: `Find the next big ${category.name} project before it goes mainstream. Ranked and explained in plain English.`,
      url,
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
      {/* Spec header */}
      <section className="halftone border-b-2 border-[var(--line)]">
        <div className="mx-auto max-w-5xl px-4 pb-10 pt-10 sm:px-6 sm:pb-12 sm:pt-12">
          <nav className="font-mono text-[11px] text-[var(--muted)]" aria-label="Breadcrumb">
            <Link href="/" className="invert-hover px-1">index</Link>
            <span className="mx-1">/</span>
            <span className="text-[var(--ink)]">{category.name.toLowerCase()}</span>
          </nav>

          <h1 className="font-display mt-5 text-2xl font-bold text-[var(--ink)] sm:text-4xl">
            {category.name.toUpperCase()}
          </h1>
          <p className="mt-4 max-w-2xl font-mono text-[14px] leading-[1.8] text-[var(--body)]">
            {category.description}
          </p>

          <div className="mt-5 flex flex-wrap items-center gap-3 font-mono text-[11.5px]">
            <span className="border-2 border-[var(--line)] bg-[var(--paper)] px-2 py-0.5 text-[var(--body)]">
              {projects.length} {projects.length === 1 ? 'entry' : 'entries'}
            </span>
            <span className="border-2 border-[var(--line)] bg-[var(--paper)] px-2 py-0.5 text-[var(--body)]">
              ranked by early signal score
            </span>
          </div>
        </div>
      </section>

      {/* Catalog grid */}
      <section className="mx-auto max-w-5xl px-4 py-10 sm:px-6 sm:py-12">
        <p className="font-mono text-[12px] font-bold tracking-[0.2em] text-[var(--ink)]">
          § 1 — catalog entries
        </p>
        {projects.length > 0 ? (
          <Reveal className="mt-5">
            <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
              {projects.map((project, i) => (
                <RepoCard key={project.id} project={project} index={i} digest />
              ))}
            </div>
          </Reveal>
        ) : (
          <div className="mt-5 border-2 border-dashed border-[var(--line-soft)] py-16 text-center">
            <p className="font-mono text-sm text-[var(--muted)]">
              no {category.name.toLowerCase()} projects yet.
            </p>
            <p className="mt-2 font-mono text-xs text-[var(--muted)]">
              the pipeline runs nightly and will populate this category automatically.
            </p>
          </div>
        )}
      </section>

      {/* Other categories */}
      <section className="mx-auto max-w-5xl px-4 pb-12 sm:px-6 sm:pb-16">
        <p className="font-mono text-[12px] font-bold tracking-[0.2em] text-[var(--ink)]">
          § 2 — other categories
        </p>
        <Reveal className="mt-5">
          <div className="flex flex-wrap gap-2">
            {CATEGORIES.filter((c) => c.slug !== slug).map((cat) => (
              <Link
                key={cat.slug}
                href={`/category/${cat.slug}`}
                className="invert-hover border-2 border-[var(--line)] bg-[var(--paper)] px-3 py-1.5 font-mono text-[11.5px] text-[var(--body)]"
              >
                {cat.name.toLowerCase()}
              </Link>
            ))}
          </div>
        </Reveal>
      </section>

      <NewsletterSignup />
    </div>
  )
}
