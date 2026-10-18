// @vitest-environment jsdom
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';

const { push } = vi.hoisted(() => ({ push: vi.fn() }));

vi.mock('next/navigation', () => ({ useRouter: () => ({ push }) }));

const { useUsernameForm } = await import('./UsernameForm.hooks');

type FormState = ReturnType<typeof useUsernameForm>;

let container: HTMLDivElement;
let root: Root;
let latest: FormState | undefined;

function Probe() {
  latest = useUsernameForm();
  return null;
}

function current(): FormState {
  if (latest === undefined) {
    throw new Error('The hook has not rendered');
  }
  return latest;
}

function type(value: string) {
  act(() => {
    current().handleChange({ target: { value } });
  });
}

beforeAll(() => {
  Reflect.set(globalThis, 'IS_REACT_ACT_ENVIRONMENT', true);
});

beforeEach(() => {
  container = document.createElement('div');
  root = createRoot(container);
  act(() => root.render(<Probe />));
});

afterEach(() => {
  act(() => root.unmount());
  latest = undefined;
  vi.clearAllMocks();
});

describe('useUsernameForm', () => {
  it('opens the collection of a valid username', () => {
    type('first last');
    const preventDefault = vi.fn();

    act(() => {
      current().handleSubmit({ preventDefault });
    });

    expect(preventDefault).toHaveBeenCalled();
    expect(push).toHaveBeenCalledWith('/u/first%20last');
    expect(current().error).toBeNull();
  });

  it('shows an error for a blank name and goes nowhere', () => {
    type('   ');

    act(() => {
      current().handleSubmit({ preventDefault: vi.fn() });
    });

    expect(push).not.toHaveBeenCalled();
    expect(current().error).toBe('Enter a BoardGameGeek username.');
  });

  it('clears the error as soon as the user types again', () => {
    act(() => {
      current().handleSubmit({ preventDefault: vi.fn() });
    });

    type('a');

    expect(current().error).toBeNull();
    expect(current().value).toBe('a');
  });
});
