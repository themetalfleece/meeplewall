// @vitest-environment jsdom
import { StrictMode, act } from 'react';
import { type Root, createRoot } from 'react-dom/client';
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { mountGameBox } from '../mountGameBox.js';
import type { GameBoxInput, GameBoxOptions } from '../types.js';
import { GameBox } from './GameBox.component.js';

vi.mock('../mountGameBox.js', () => ({ mountGameBox: vi.fn() }));

const mountMock = vi.mocked(mountGameBox);
const update = vi.fn<(game: GameBoxInput) => void>();
const unmount = vi.fn<() => void>();

const firstGame: GameBoxInput = {
  size: { width: 270, height: 310, depth: 90 },
  covers: { front: '/first/cover.webp' },
  sideColor: '#182828',
  edgeColor: '#0e1818',
};
const secondGame: GameBoxInput = { ...firstGame, covers: { front: '/second/cover.webp' } };

let container: HTMLDivElement;
let root: Root;

beforeAll(() => {
  Reflect.set(globalThis, 'IS_REACT_ACT_ENVIRONMENT', true);
});

beforeEach(() => {
  mountMock.mockReturnValue({ update, unmount });
  container = document.createElement('div');
  document.body.append(container);
  root = createRoot(container);
});

afterEach(() => {
  act(() => root.unmount());
  container.remove();
  vi.clearAllMocks();
});

function render({ game, options }: { game: GameBoxInput; options?: GameBoxOptions }) {
  act(() => {
    root.render(<GameBox game={game} options={options ?? {}} className="box" />);
  });
}

describe('useGameBox', () => {
  it('mounts once into the rendered container with the first game and options', () => {
    const options = { yaw: 0.3 };
    render({ game: firstGame, options });

    expect(mountMock).toHaveBeenCalledTimes(1);
    expect(mountMock).toHaveBeenCalledWith({
      element: container.querySelector('.box'),
      game: firstGame,
      options,
    });
  });

  it('pushes a new game through update without remounting', () => {
    render({ game: firstGame });
    render({ game: secondGame });

    expect(mountMock).toHaveBeenCalledTimes(1);
    expect(update).toHaveBeenLastCalledWith(secondGame);
    expect(unmount).not.toHaveBeenCalled();
  });

  it('reads options only on mount', () => {
    render({ game: firstGame, options: { yaw: 0.3 } });
    render({ game: firstGame, options: { yaw: 1.2 } });

    expect(mountMock).toHaveBeenCalledTimes(1);
  });

  it('unmounts the renderer when the component unmounts', () => {
    render({ game: firstGame });
    act(() => root.unmount());

    expect(unmount).toHaveBeenCalledTimes(1);
    root = createRoot(container);
  });

  it('leaves exactly one live renderer after a strict-mode remount', () => {
    act(() => {
      root.render(
        <StrictMode>
          <GameBox game={firstGame} />
        </StrictMode>,
      );
    });

    expect(mountMock.mock.calls.length - unmount.mock.calls.length).toBe(1);
  });
});
