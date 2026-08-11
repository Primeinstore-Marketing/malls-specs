import Image from 'next/image';
import type { CatalogueStats } from '@/lib/catalogue';
import { Button, LinkButton } from '@/components/ui/Button';
import { withBasePath } from '@/lib/basePath';

function StatTile({ label, value }: { label: string; value: number }) {
  return (
    <div className="flex flex-col gap-1 border border-border px-6 py-3.5 first:pl-0 sm:border-l sm:first:border-l-0">
      <span className="text-display-md text-fg">{value}</span>
      <span className="text-label-md uppercase text-fg-subtle">{label}</span>
    </div>
  );
}

export function Hero({ stats }: { stats: CatalogueStats }) {
  return (
    <section className="relative overflow-hidden sm:min-h-[580px] lg:min-h-[680px]">
      <div className="absolute inset-y-0 left-[30%] right-0 hidden sm:block lg:left-[40%]">
        <Image
          src={withBasePath('/hero/mall-atrium.jpg')}
          alt="A Primedia Malls in-mall media installation"
          fill
          priority
          sizes="(min-width: 1024px) 60vw, 80vw"
          className="object-cover object-center"
        />
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 bg-[linear-gradient(to_right,var(--color-bg)_0%,transparent_30%)]"
        />
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 bg-[linear-gradient(to_bottom,var(--color-bg)_0%,transparent_8%,transparent_85%,var(--color-bg)_100%)]"
        />
      </div>

      <div className="relative mx-auto flex max-w-page flex-col px-4 py-12 sm:px-6 lg:min-h-[680px] lg:justify-center lg:px-8 lg:py-20">
        <div className="flex max-w-xl flex-col gap-6">
          <span className="inline-flex w-fit items-center gap-2 rounded-full border border-accent-border bg-accent-subtle py-1 pl-1.5 pr-3 text-label-md uppercase text-accent-fg">
            <span className="h-[5px] w-[5px] animate-pulse rounded-full bg-accent" aria-hidden="true" />
            Primedia Malls
          </span>

          <h1 className="text-display-2xl text-fg">
            Media
            <br />
            <span className="[-webkit-text-stroke:2px_rgba(27,55,105,.15)] text-transparent">Specs</span>
          </h1>

          <p className="max-w-prose text-body-lg text-fg-muted">
            Technical specifications, design guidelines and artwork requirements for every media
            format across the Primedia Malls network.
          </p>

          <div className="flex flex-wrap gap-3">
            <LinkButton href="/browse" variant="primary">
              Browse specifications
            </LinkButton>
            <Button variant="secondary" disabled>
              Sign in to get started
            </Button>
          </div>

          <div className="mt-4 flex flex-wrap">
            <StatTile label="Formats" value={stats.specificationCount} />
            <StatTile label="Categories" value={stats.categoryCount} />
            <StatTile label="Published" value={stats.publishedCount} />
          </div>
        </div>
      </div>
    </section>
  );
}
