import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import {
  RouterProvider,
  createMemoryHistory,
  createRootRoute,
  createRouter,
} from '@tanstack/react-router';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { ErrorPage } from '@/components/errors/error-page';

afterEach(() => vi.unstubAllEnvs());

// ErrorPage contains a router <Link>, so it must render inside a router.
async function renderErrorPage(error: Error, reset = vi.fn()) {
  const rootRoute = createRootRoute({
    component: () => <ErrorPage error={error} reset={reset} />,
  });
  const router = createRouter({
    routeTree: rootRoute,
    history: createMemoryHistory({ initialEntries: ['/'] }),
  });
  render(<RouterProvider router={router} />);
  await screen.findByRole('alert');
  return { reset };
}

describe('ErrorPage', () => {
  it('announces the problem and offers a way out', async () => {
    await renderErrorPage(new Error('boom'));

    expect(screen.getByRole('alert')).toBeInTheDocument();
    expect(screen.getByRole('heading', { level: 1, name: 'Something went wrong' })).toBeVisible();
    expect(screen.getByRole('link', { name: 'Go to homepage' })).toHaveAttribute('href', '/');
  });

  it('retries when the user clicks "Try again"', async () => {
    const { reset } = await renderErrorPage(new Error('boom'));

    await userEvent.setup().click(screen.getByRole('button', { name: 'Try again' }));

    expect(reset).toHaveBeenCalledOnce();
  });

  it('shows the real error message in development', async () => {
    vi.stubEnv('DEV', true);
    await renderErrorPage(new Error('database exploded'));

    expect(screen.getByText('database exploded')).toBeInTheDocument();
  });

  it('hides the error message in production', async () => {
    vi.stubEnv('DEV', false);
    await renderErrorPage(new Error('database exploded'));

    expect(screen.queryByText('database exploded')).not.toBeInTheDocument();
    expect(screen.getByText('Please try again, or come back later.')).toBeInTheDocument();
  });
});
