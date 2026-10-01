import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import { adminAuth } from '@/lib/firebase/admin'
import { GoogleSignInButton } from '@/components/auth/google-sign-in-button'
import { LogoHealthStream } from '@/components/ui/logo'

const COOKIE = process.env.SESSION_COOKIE_NAME ?? '__session'

const SCHEMA = {
  '@context': 'https://schema.org',
  '@type': 'SoftwareApplication',
  name: 'Orbital',
  applicationCategory: 'BusinessApplication',
  description:
    'Orbital reads your meeting transcripts and files, then automatically drafts decisions, milestones, risks, and action items into your project.',
  operatingSystem: 'Web',
  offers: { '@type': 'Offer', price: '0' },
}

const HOW_IT_WORKS = [
  {
    step: '01',
    title: 'Drop it in',
    desc: 'Upload your meeting transcript, PDF, or slide deck to any project. Any format.',
  },
  {
    step: '02',
    title: 'Orbital reads it',
    desc: 'Claude Sonnet analyzes the document and extracts decisions, milestones, risks, and issues — in seconds.',
  },
  {
    step: '03',
    title: 'Your project updates',
    desc: 'Review the AI drafts and accept the ones that matter. One click moves them into the right place.',
  },
]

const EXTRACTS = [
  { label: 'Decisions', desc: 'What was agreed, who owns it, what the outcome was.' },
  { label: 'Milestones', desc: 'Dates, deliverables, and status from the conversation.' },
  { label: 'Risks', desc: 'What could go wrong, flagged before it becomes a problem.' },
  { label: 'Issues', desc: 'Blockers and open questions, ready to assign and resolve.' },
]

export default async function Home() {
  const cookieStore = await cookies()
  const sessionCookie = cookieStore.get(COOKIE)?.value
  if (sessionCookie) {
    try {
      await adminAuth.verifySessionCookie(sessionCookie, true)
      redirect('/dashboard')
    } catch {}
  }

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(SCHEMA) }}
      />
      <main className="min-h-screen flex flex-col bg-background text-foreground">
        {/* Hero */}
        <section className="flex flex-col items-center justify-center text-center px-4 pt-24 pb-16 gap-6">
          <LogoHealthStream className="h-8 w-auto mb-2" />
          <h1 className="text-4xl font-bold tracking-tight max-w-2xl leading-tight">
            The AI member of your team that never misses a meeting.
          </h1>
          <p className="text-lg text-muted-foreground max-w-xl">
            Drop in your transcripts and files. Orbital reads them, extracts decisions, flags risks,
            and drafts action items into your project — automatically.
          </p>
          <div className="w-full max-w-sm bg-card border rounded-lg p-6 mt-4">
            <p className="text-sm text-muted-foreground text-center mb-6">Sign in to get started</p>
            <GoogleSignInButton />
          </div>
        </section>

        {/* How it works */}
        <section className="px-4 py-16 max-w-4xl mx-auto w-full">
          <h2 className="text-2xl font-semibold text-center mb-10">How it works</h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            {HOW_IT_WORKS.map(({ step, title, desc }) => (
              <div key={step} className="flex flex-col gap-2">
                <span className="text-3xl font-bold text-muted-foreground/40">{step}</span>
                <h3 className="font-semibold">{title}</h3>
                <p className="text-sm text-muted-foreground">{desc}</p>
              </div>
            ))}
          </div>
        </section>

        {/* What Orbital extracts */}
        <section className="px-4 py-16 bg-muted/30">
          <div className="max-w-4xl mx-auto w-full">
            <h2 className="text-2xl font-semibold text-center mb-10">What Orbital extracts</h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
              {EXTRACTS.map(({ label, desc }) => (
                <div key={label} className="border rounded-md px-5 py-4 bg-background flex flex-col gap-1">
                  <p className="font-semibold">{label}</p>
                  <p className="text-sm text-muted-foreground">{desc}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* Ask Orbital */}
        <section className="px-4 py-16 max-w-4xl mx-auto w-full text-center flex flex-col items-center gap-4">
          <h2 className="text-2xl font-semibold">Ask Orbital anything</h2>
          <p className="text-muted-foreground max-w-lg">
            Once your files are processed, ask natural language questions about your project.
            Orbital searches across all your documents and answers with citations.
          </p>
          <div className="font-mono text-sm bg-muted rounded-md px-4 py-3 text-left max-w-md w-full">
            <span className="text-muted-foreground">You: </span>
            What did we decide about the API design last week?
          </div>
        </section>

        <footer className="text-center text-xs text-muted-foreground py-8 border-t">
          © {new Date().getFullYear()} Orbital
        </footer>
      </main>
    </>
  )
}
