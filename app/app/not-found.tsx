import { LinkButton } from '@/components/ui/Button';

export default function NotFound() {
  return (
    <div className="mx-auto flex max-w-page flex-col items-center gap-4 px-4 py-24 text-center sm:px-6 lg:px-8">
      <span className="text-label-lg text-fg-subtle">404</span>
      <h1 className="text-display-xl text-fg">Page not found</h1>
      <p className="max-w-prose text-body-md text-fg-muted">
        The page you're looking for doesn't exist, or may have been moved.
      </p>
      <LinkButton href="/" variant="primary" className="mt-2">
        Back to home
      </LinkButton>
    </div>
  );
}
