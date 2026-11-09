import React from 'react';
import {
  act,
  fireEvent,
  render,
  renderHook,
  screen,
  waitFor,
} from '@testing-library/react-native';

import {
  createFavoritesClient,
  favoriteKey,
  normalizeFavorite,
} from '../favorites/favoritesClient';

import useLiveSavedPlaces from '../favorites/useLiveSavedPlaces';
import SavedPlacesScreen from '../favorites/SavedPlacesScreen';
import SavedPlaceActions from '../favorites/SavedPlaceActions';

jest.mock(
  'react-native-safe-area-context',
  () => jest.requireActual(
    'react-native-safe-area-context/jest/mock'
  ).default
);

const origin = 'https://foodmap.test';

const r1 = 'a'.repeat(24);
const r2 = 'b'.repeat(24);
const d1 = 'c'.repeat(24);

const sessionA = {
  userId: 'account-a',
  token: 'token-a',
};

const sessionB = {
  userId: 'account-b',
  token: 'token-b',
};

const restaurant = {
  _id: r1,
  name: 'Noodles',
  imageUrl: '/uploads/noodles.jpg',
  rating: null,
  reviewCount: 0,
};

const dish = {
  dishId: d1,
  restaurantId: r1,
  name: 'Soup',
  averageRating: null,
  reviewCount: 0,
};

const savedRestaurant = {
  targetType: 'restaurant',
  targetId: r1,
  createdAt: '2026-11-01T12:00:00Z',
  target: restaurant,
};

const savedDish = {
  targetType: 'dish',
  targetId: d1,
  createdAt: '2026-11-02T12:00:00Z',
  target: dish,
};

const savedSecond = {
  ...savedRestaurant,
  targetId: r2,
  target: {
    ...restaurant,
    _id: r2,
    name: 'Other restaurant',
  },
};

const key = favoriteKey('restaurant', r1);

const response = (status, payload) => ({
  status,
  json: jest.fn(async () => payload),
});

const expired = () =>
  Object.assign(new Error('Expired'), {
    status: 401,
  });

function deferred() {
  let resolve;
  let reject;

  const promise = new Promise((res, rej) => {
    resolve = res;
    reject = rej;
  });

  return {
    promise,
    resolve,
    reject,
  };
}

function clientWith(items = []) {
  return {
    list: jest.fn().mockResolvedValue(items),
    save: jest.fn().mockResolvedValue(savedRestaurant),
    remove: jest.fn().mockResolvedValue(undefined),
  };
}

async function ready(result) {
  await waitFor(() => {
    expect(result.current.status).toBe('ready');
  });
}

it(
  'sends exact Bearer requests with real IDs and no ownership parameters; DELETE never parses JSON',
  async () => {
    const deleted = response(204);

    const fetchImpl = jest.fn()
      .mockResolvedValueOnce(
        response(200, {
          items: [savedRestaurant, savedDish],
        })
      )
      .mockResolvedValueOnce(
        response(200, savedRestaurant)
      )
      .mockResolvedValueOnce(deleted);

    const client = createFavoritesClient({
      origin,
      fetchImpl,
    });

    const listed = await client.list({
      token: sessionA.token,
    });

    expect(listed[0].target._id).toBe(r1);

    expect(listed[0].target.imageUrl).toBe(
      `${origin}/uploads/noodles.jpg`
    );

    expect(listed[0].target.rating).toBeNull();

    expect(listed[1].target.dishId).toBe(d1);
    expect(listed[1].target.restaurantId).toBe(r1);
    expect(listed[1].target.averageRating).toBeNull();
    expect(listed[1].target.imageUrl).toBeNull();

    await client.save({
      token: sessionA.token,
      targetType: 'restaurant',
      targetId: r1,
    });

    await client.remove({
      token: sessionA.token,
      targetType: 'dish',
      targetId: d1,
    });

    expect(
      fetchImpl.mock.calls.map(
        ([url, options]) => [url, options.method]
      )
    ).toEqual([
      [`${origin}/api/favorites`, 'GET'],
      [`${origin}/api/favorites/restaurant/${r1}`, 'PUT'],
      [`${origin}/api/favorites/dish/${d1}`, 'DELETE'],
    ]);

    fetchImpl.mock.calls.forEach(([, options]) => {
      expect(options.headers).toEqual({
        Authorization: 'Bearer token-a',
      });

      expect(options).not.toHaveProperty('body');
    });

    expect(deleted.json).not.toHaveBeenCalled();
  }
);

it(
  'validates envelopes, supported type and catalog identities instead of accepting malformed private data',
  async () => {
    const broken = [
      {},
      {
        ...savedRestaurant,
        targetType: 'user',
      },
      {
        ...savedRestaurant,
        targetId: 'fake-id',
      },
      {
        ...savedRestaurant,
        createdAt: 'not-a-date',
      },
      {
        ...savedRestaurant,
        target: undefined,
      },
      {
        ...savedRestaurant,
        target: {
          ...restaurant,
          _id: r2,
        },
      },
      {
        ...savedRestaurant,
        target: {
          ...restaurant,
          id: r2,
        },
      },
      {
        ...savedDish,
        target: {
          ...dish,
          restaurantId: null,
        },
      },
    ];

    broken.forEach(item => {
      expect(() =>
        normalizeFavorite(item, origin)
      ).toThrow();
    });

    expect(() =>
      normalizeFavorite(savedDish, origin, key)
    ).toThrow();

    const missing = normalizeFavorite(
      {
        ...savedRestaurant,
        target: null,
      },
      origin
    );

    expect(missing.target).toBeNull();
    expect(missing.targetId).toBe(r1);

    const fetchImpl = jest.fn()
      .mockResolvedValueOnce(response(200, []))
      .mockResolvedValueOnce(
        response(200, {
          items: [
            savedRestaurant,
            savedRestaurant,
          ],
        })
      );

    const client = createFavoritesClient({
      origin,
      fetchImpl,
    });

    await expect(
      client.list({ token: 'token' })
    ).rejects.toThrow();

    await expect(
      client.list({ token: 'token' })
    ).rejects.toThrow('Duplicate');

    await expect(
      client.save({
        token: 'token',
        targetType: 'restaurant',
        targetId: 'fake',
      })
    ).rejects.toThrow();

    expect(fetchImpl).toHaveBeenCalledTimes(2);
  }
);

it(
  'keeps unusable photos missing and supports usable remote photos',
  () => {
    for (const imageUrl of [
      null,
      '',
      'javascript:alert(1)',
      'file:///secret',
      'https://user:pass@host/image',
    ]) {
      expect(
        normalizeFavorite(
          {
            ...savedRestaurant,
            target: {
              ...restaurant,
              imageUrl,
            },
          },
          origin
        ).target.imageUrl
      ).toBeNull();
    }

    expect(
      normalizeFavorite(
        {
          ...savedRestaurant,
          target: {
            ...restaurant,
            imageUrl: 'https://images.test/a.jpg',
          },
        },
        origin
      ).target.imageUrl
    ).toBe('https://images.test/a.jpg');
  }
);

it(
  'rejects malformed hydrated display fields before they can crash saved cards',
  () => {
    for (const fields of [
      { name: undefined },
      { name: {} },
      { name: ' ' },
      { rating: '4.5', reviewCount: 2 },
      { rating: Infinity },
      { rating: 6 },
      { reviewCount: -1 },
      { reviewCount: '2' },
      { reviewCount: 1.5 },
      { address: {} },
      { cuisineType: [] },
      { priceRange: 20 },
    ]) {
      expect(() =>
        normalizeFavorite(
          {
            ...savedRestaurant,
            target: {
              ...restaurant,
              ...fields,
            },
          },
          origin
        )
      ).toThrow('display fields');
    }

    expect(() =>
      normalizeFavorite(
        {
          ...savedDish,
          target: {
            ...dish,
            averageRating: '4.5',
            reviewCount: 2,
          },
        },
        origin
      )
    ).toThrow('display fields');

    expect(
      normalizeFavorite(savedRestaurant, origin)
        .target.rating
    ).toBeNull();

    expect(
      normalizeFavorite(savedDish, origin)
        .target.averageRating
    ).toBeNull();
  }
);

it(
  'malformed list or save display fields fail safely and retain the confirmed list',
  async () => {
    const malformed = {
      ...savedSecond,
      target: {
        ...savedSecond.target,
        rating: '4.5',
        reviewCount: 2,
      },
    };

    const client = clientWith([savedRestaurant]);

    const { result } = renderHook(() =>
      useLiveSavedPlaces({
        origin,
        client,
        session: sessionA,
      })
    );

    await ready(result);

    client.list.mockResolvedValueOnce([malformed]);

    await act(async () => {
      await result.current.refresh();
    });

    expect(result.current.status).toBe('failed');

    expect(
      result.current.favorites.map(item => item._id)
    ).toEqual([r1]);

    client.save.mockResolvedValueOnce(malformed);

    await act(async () => {
      await result.current.toggleFavorite(
        savedSecond.target
      );
    });

    expect(
      result.current.favorites.map(item => item._id)
    ).toEqual([r1]);

    expect(
      result.current.mutationErrors[
        favoriteKey('restaurant', r2)
      ]
    ).toBeInstanceOf(Error);

    render(
      <SavedPlacesScreen savedPlaces={result.current} />
    );

    expect(screen.getByText('Noodles')).toBeTruthy();

    expect(
      screen.queryByText('Other restaurant')
    ).toBeNull();
  }
);

it(
  'guests make zero private calls and save actions delegate login',
  async () => {
    const client = clientWith();

    const onLoginRequired = jest.fn();

    const { result } = renderHook(() =>
      useLiveSavedPlaces({
        origin,
        client,
        onLoginRequired,
      })
    );

    expect(result.current.status).toBe('signed-out');

    await act(async () => {
      await result.current.toggleFavorite(restaurant);
      await result.current.refresh();
    });

    expect(onLoginRequired).toHaveBeenCalledTimes(1);
    expect(client.list).not.toHaveBeenCalled();
    expect(client.save).not.toHaveBeenCalled();

    render(
      <SavedPlaceActions
        restaurant={restaurant}
        savedPlaces={result.current}
      />
    );

    fireEvent.press(
      screen.getByRole('button', {
        name: 'Sign in to save Noodles',
      })
    );

    expect(onLoginRequired).toHaveBeenCalledTimes(2);
  }
);

it(
  'saves, reloads after remount, removes and reloads both types using persisted HTTP responses',
  async () => {
    const rows = new Map();

    const targets = {
      [`restaurant:${r1}`]: savedRestaurant,
      [`dish:${d1}`]: savedDish,
    };

    const fetchImpl = jest.fn(async (url, { method }) => {
      const path = url.slice(
        `${origin}/api/favorites`.length
      );

      const itemKey = path.slice(1).replace('/', ':');

      if (method === 'GET') {
        return response(200, {
          items: [...rows.values()],
        });
      }

      if (method === 'PUT') {
        if (!rows.has(itemKey)) {
          rows.set(itemKey, targets[itemKey]);
        }

        return response(200, rows.get(itemKey));
      }

      rows.delete(itemKey);

      return response(204);
    });

    const client = createFavoritesClient({
      origin,
      fetchImpl,
    });

    const first = renderHook(() =>
      useLiveSavedPlaces({
        origin,
        client,
        session: sessionA,
      })
    );

    await ready(first.result);

    await act(async () => {
      await first.result.current.toggleFavorite(restaurant);
      await first.result.current.toggleFavoriteDish(dish);
    });

    expect(first.result.current.items).toHaveLength(2);

    first.unmount();

    const second = renderHook(() =>
      useLiveSavedPlaces({
        origin,
        client,
        session: sessionA,
      })
    );

    await ready(second.result);

    expect(
      second.result.current.favorites[0]._id
    ).toBe(r1);

    expect(
      second.result.current.favoriteDishes[0].dishId
    ).toBe(d1);

    await act(async () => {
      await second.result.current.toggleFavorite(restaurant);
      await second.result.current.toggleFavoriteDish(dish);
    });

    expect(second.result.current.items).toEqual([]);

    second.unmount();

    const third = renderHook(() =>
      useLiveSavedPlaces({
        origin,
        client,
        session: sessionA,
      })
    );

    await ready(third.result);

    expect(third.result.current.items).toEqual([]);
  }
);

it(
  'keeps missing targets removable by their envelope, excluded from details and wheel imports',
  async () => {
    const client = clientWith([
      {
        ...savedRestaurant,
        target: null,
      },
      {
        ...savedDish,
        target: null,
      },
    ]);

    const { result } = renderHook(() =>
      useLiveSavedPlaces({
        origin,
        client,
        session: sessionA,
      })
    );

    await ready(result);

    expect(result.current.favorites).toEqual([]);
    expect(result.current.favoriteDishes).toEqual([]);

    render(
      <SavedPlacesScreen
        savedPlaces={result.current}
        onRestaurantPress={jest.fn()}
        onDishPress={jest.fn()}
      />
    );

    expect(
      screen.getByText('Saved restaurant unavailable')
    ).toBeTruthy();

    expect(
      screen.queryByRole('button', {
        name: /Open restaurant/,
      })
    ).toBeNull();

    // FIX: Match the actual accessibility label.
    await act(async () => {
      fireEvent.press(
        screen.getByRole('button', {
          name: 'Remove from Want to Try',
        })
      );
    });

    expect(client.remove).toHaveBeenCalledWith(
      expect.objectContaining({
        targetType: 'restaurant',
        targetId: r1,
      })
    );

    await act(async () => {
      await result.current.removeFavorite('dish', d1);
      await result.current.removeFavorite('dish', d1);
    });

    expect(result.current.items).toEqual([]);
  }
);

it.each(['forward', 'reverse'])(
  'uses confirmation, blocks same-target repeats and preserves different-target completions (%s order)',
  async order => {
    const a = deferred();
    const b = deferred();

    const client = clientWith();

    client.save.mockImplementation(
      ({ targetId }) =>
        targetId === r1 ? a.promise : b.promise
    );

    const { result } = renderHook(() =>
      useLiveSavedPlaces({
        origin,
        client,
        session: sessionA,
      })
    );

    await ready(result);

    act(() => {
      result.current.toggleFavorite(restaurant);
      result.current.toggleFavorite(restaurant);
      result.current.toggleFavorite(savedSecond.target);
    });

    expect(client.save).toHaveBeenCalledTimes(2);

    expect(result.current.items).toEqual([]);
    expect(result.current.pendingKeys).toHaveLength(2);

    await act(async () => {
      if (order === 'forward') {
        a.resolve(savedRestaurant);
      } else {
        b.resolve(savedSecond);
      }
    });

    expect(
      result.current.favorites.map(item => item._id)
    ).toEqual([
      order === 'forward' ? r1 : r2,
    ]);

    await act(async () => {
      if (order === 'forward') {
        b.resolve(savedSecond);
      } else {
        a.resolve(savedRestaurant);
      }
    });

    expect(
      new Set(
        result.current.favorites.map(item => item._id)
      )
    ).toEqual(new Set([r1, r2]));

    expect(result.current.pendingKeys).toEqual([]);
  }
);

it(
  'an older GET cannot resurrect a removed record or discard a new save',
  async () => {
    const reload = deferred();

    const client = clientWith([savedRestaurant]);

    client.list
      .mockResolvedValueOnce([savedRestaurant])
      .mockImplementationOnce(() => reload.promise);

    client.save.mockResolvedValue(savedDish);

    const { result } = renderHook(() =>
      useLiveSavedPlaces({
        origin,
        client,
        session: sessionA,
      })
    );

    await ready(result);

    act(() => {
      result.current.refresh();
    });

    await act(async () => {
      await result.current.removeFavorite(
        'restaurant',
        r1
      );

      await result.current.toggleFavoriteDish(dish);
    });

    await act(async () => {
      reload.resolve([savedRestaurant]);
    });

    expect(
      result.current.items.map(item => item.targetId)
    ).toEqual([d1]);
  }
);

it(
  'a GET started during a pending write preserves the write when the server responds in the opposite order',
  async () => {
    const put = deferred();
    const reload = deferred();

    const client = clientWith();

    client.list
      .mockResolvedValueOnce([])
      .mockImplementationOnce(() => reload.promise);

    client.save.mockImplementation(() => put.promise);

    const { result } = renderHook(() =>
      useLiveSavedPlaces({
        origin,
        client,
        session: sessionA,
      })
    );

    await ready(result);

    act(() => {
      result.current.toggleFavorite(restaurant);
      result.current.refresh();
    });

    await act(async () => {
      put.resolve(savedRestaurant);
    });

    await act(async () => {
      reload.resolve([]);
    });

    expect(
      result.current.favorites[0]._id
    ).toBe(r1);
  }
);

it(
  'failed writes leave confirmed data intact and expose only the affected target error',
  async () => {
    const client = clientWith([savedRestaurant]);

    client.remove.mockRejectedValue(
      new Error('Network failed')
    );

    const { result } = renderHook(() =>
      useLiveSavedPlaces({
        origin,
        client,
        session: sessionA,
      })
    );

    await ready(result);

    await act(async () => {
      await result.current.toggleFavorite(restaurant);
    });

    expect(
      result.current.favorites[0]._id
    ).toBe(r1);

    expect(
      result.current.mutationErrors[key]
    ).toBeInstanceOf(Error);

    expect(result.current.pendingKeys).toEqual([]);

    client.remove.mockResolvedValue(undefined);

    await act(async () => {
      await result.current.toggleFavorite(restaurant);
    });

    expect(result.current.items).toEqual([]);

    expect(
      result.current.mutationErrors[key]
    ).toBeUndefined();
  }
);

it(
  'failed list and empty list remain distinct and retry is available',
  async () => {
    const client = clientWith();

    client.list
      .mockRejectedValueOnce(new Error('Network'))
      .mockResolvedValueOnce([]);

    const { result } = renderHook(() =>
      useLiveSavedPlaces({
        origin,
        client,
        session: sessionA,
      })
    );

    await waitFor(() => {
      expect(result.current.status).toBe('failed');
    });

    const view = render(
      <SavedPlacesScreen savedPlaces={result.current} />
    );

    expect(
      screen.getByText(
        'Your saved list could not be loaded.'
      )
    ).toBeTruthy();

    expect(
      screen.queryByText(
        'Save a restaurant to find it here.'
      )
    ).toBeNull();

    // FIX: The current button is labeled "Try Again".
    await act(async () => {
      fireEvent.press(
        screen.getByRole('button', {
          name: 'Try Again',
        })
      );
    });

    view.rerender(
      <SavedPlacesScreen savedPlaces={result.current} />
    );

    expect(
      screen.getByText(
        'Save a restaurant to find it here.'
      )
    ).toBeTruthy();
  }
);

it(
  'web refresh updates an empty saved list and prevents another request while loading',
  async () => {
    const reload = deferred();

    const client = clientWith();

    client.list
      .mockResolvedValueOnce([])
      .mockImplementationOnce(() => reload.promise);

    function SavedView() {
      const savedPlaces = useLiveSavedPlaces({
        origin,
        client,
        session: sessionA,
      });

      return (
        <SavedPlacesScreen
          savedPlaces={savedPlaces}
          showRefreshButton
        />
      );
    }

    render(<SavedView />);

    await screen.findByText(
      'Save a restaurant to find it here.'
    );

    fireEvent.press(
      screen.getByRole('button', {
        name: 'Refresh saved list',
      })
    );

    expect(client.list).toHaveBeenCalledTimes(2);

    const refreshing = screen.getByRole('button', {
      name: 'Refresh saved list',
    });

    expect(
      refreshing.props.accessibilityState.disabled
    ).toBe(true);

    fireEvent.press(refreshing);

    expect(client.list).toHaveBeenCalledTimes(2);

    await act(async () => {
      reload.resolve([savedRestaurant]);
    });

    expect(screen.getByText('Noodles')).toBeTruthy();

    expect(
      screen.getByRole('button', {
        name: 'Refresh saved list',
      }).props.accessibilityState.disabled
    ).toBe(false);
  }
);

it.each([
  'signed-out',
  'expired',
  'preview',
  'native',
])(
  'hides web refresh for %s state',
  status => {
    const refresh = jest.fn();

    const savedPlaces = {
      favorites: [],
      favoriteDishes: [],
      status,
      ...(status === 'preview'
        ? {}
        : { refresh }),
    };

    render(
      <SavedPlacesScreen
        savedPlaces={savedPlaces}
        showRefreshButton={status !== 'native'}
      />
    );

    expect(
      screen.queryByRole('button', {
        name: 'Refresh saved list',
      })
    ).toBeNull();

    expect(refresh).not.toHaveBeenCalled();
  }
);

it(
  'current-session 401 clears private state, invalidates wheel identity and delegates expiration once',
  async () => {
    const client = clientWith([savedRestaurant]);

    const onSessionExpired = jest.fn();

    const { result } = renderHook(() =>
      useLiveSavedPlaces({
        origin,
        client,
        session: sessionA,
        onSessionExpired,
      })
    );

    await ready(result);

    const oldScope = result.current.sessionScope;

    client.remove.mockRejectedValue(expired());

    await act(async () => {
      await result.current.removeFavorite(
        'restaurant',
        r1
      );
    });

    expect(result.current.status).toBe('expired');
    expect(result.current.items).toEqual([]);

    expect(
      result.current.sessionScope
    ).not.toBe(oldScope);

    expect(onSessionExpired).toHaveBeenCalledTimes(1);

    await act(async () => {
      await result.current.refresh();
    });

    expect(onSessionExpired).toHaveBeenCalledTimes(1);
  }
);

it.each([
  'success',
  '401',
  'failure',
])(
  'switching A to B aborts and ignores pending A list %s without even one stale render',
  async outcome => {
    const a = deferred();
    const b = deferred();

    const observed = [];
    const onSessionExpired = jest.fn();

    const client = clientWith();

    client.list.mockImplementation(
      ({ token }) =>
        token === sessionA.token
          ? a.promise
          : b.promise
    );

    const { result, rerender } = renderHook(
      ({ session }) => {
        const saved = useLiveSavedPlaces({
          origin,
          client,
          session,
          onSessionExpired,
        });

        observed.push({
          userId: session?.userId,
          ids: saved.items.map(item => item.targetId),
          error: saved.error,
        });

        return saved;
      },
      {
        initialProps: {
          session: sessionA,
        },
      }
    );

    const oldSignal =
      client.list.mock.calls[0][0].signal;

    rerender({
      session: sessionB,
    });

    expect(oldSignal.aborted).toBe(true);

    await act(async () => {
      b.resolve([savedSecond]);
    });

    await act(async () => {
      if (outcome === 'success') {
        a.resolve([savedRestaurant]);
      } else {
        a.reject(
          outcome === '401'
            ? expired()
            : new Error('A failed')
        );
      }
    });

    expect(
      result.current.favorites.map(item => item._id)
    ).toEqual([r2]);

    expect(result.current.error).toBeNull();

    expect(
      onSessionExpired
    ).not.toHaveBeenCalled();

    expect(
      observed
        .filter(
          value =>
            value.userId === sessionB.userId
        )
        .every(
          value =>
            !value.ids.includes(r1) &&
            value.error === null
        )
    ).toBe(true);
  }
);

it.each(['success', '401'])(
  'account switch ignores pending A mutation %s and clears all previous confirmed data immediately',
  async outcome => {
    const write = deferred();
    const b = deferred();

    const client = clientWith();

    client.list
      .mockResolvedValueOnce([savedRestaurant])
      .mockImplementationOnce(() => b.promise);

    client.save.mockImplementation(
      () => write.promise
    );

    const onSessionExpired = jest.fn();

    const observed = [];

    const { result, rerender } = renderHook(
      ({ session }) => {
        const saved = useLiveSavedPlaces({
          origin,
          client,
          session,
          onSessionExpired,
        });

        observed.push({
          userId: session?.userId,
          ids: saved.items.map(item => item.targetId),
          pending: saved.pendingKeys,
        });

        return saved;
      },
      {
        initialProps: {
          session: sessionA,
        },
      }
    );

    await ready(result);

    act(() => {
      result.current.toggleFavoriteDish(dish);
    });

    observed.length = 0;

    rerender({
      session: sessionB,
    });

    expect(observed[0]).toEqual({
      userId: sessionB.userId,
      ids: [],
      pending: [],
    });

    expect(
      client.save.mock.calls[0][0].signal.aborted
    ).toBe(true);

    await act(async () => {
      b.resolve([savedSecond]);
    });

    await act(async () => {
      if (outcome === 'success') {
        write.resolve(savedDish);
      } else {
        write.reject(expired());
      }
    });

    expect(
      result.current.favorites.map(item => item._id)
    ).toEqual([r2]);

    expect(result.current.favoriteDishes).toEqual([]);

    expect(result.current.mutationErrors).toEqual({});

    expect(
      onSessionExpired
    ).not.toHaveBeenCalled();
  }
);

it(
  'logout clears data synchronously; origin and token changes each start a fresh private scope',
  async () => {
    const client = clientWith([savedRestaurant]);

    const observed = [];

    const { result, rerender } = renderHook(
      props => {
        const saved = useLiveSavedPlaces({
          client,
          ...props,
        });

        observed.push(saved.items.length);

        return saved;
      },
      {
        initialProps: {
          origin,
          session: sessionA,
        },
      }
    );

    await ready(result);

    observed.length = 0;

    rerender({
      origin,
      session: null,
    });

    expect(observed[0]).toBe(0);
    expect(result.current.status).toBe('signed-out');

    expect(client.list).toHaveBeenCalledTimes(1);

    rerender({
      origin,
      session: sessionA,
    });

    await ready(result);

    observed.length = 0;

    rerender({
      origin: 'https://other.test',
      session: sessionA,
    });

    expect(observed[0]).toBe(0);

    await ready(result);

    observed.length = 0;

    rerender({
      origin: 'https://other.test',
      session: {
        ...sessionA,
        token: 'renewed-token',
      },
    });

    expect(observed[0]).toBe(0);

    await ready(result);

    expect(client.list).toHaveBeenCalledTimes(4);
  }
);

it(
  'sends exact dish and restaurant IDs to host navigation and hides unprovided detail routes',
  async () => {
    const client = clientWith([
      savedRestaurant,
      savedDish,
    ]);

    const { result } = renderHook(() =>
      useLiveSavedPlaces({
        origin,
        client,
        session: sessionA,
      })
    );

    await ready(result);

    const onRestaurantPress = jest.fn();
    const onDishPress = jest.fn();

    const view = render(
      <SavedPlacesScreen
        savedPlaces={result.current}
        onRestaurantPress={onRestaurantPress}
        onDishPress={onDishPress}
      />
    );

    fireEvent.press(
      screen.getByRole('button', {
        name: 'Open restaurant Noodles',
      })
    );

    expect(onRestaurantPress).toHaveBeenCalledWith(r1);

    fireEvent.press(
      screen.getByRole('tab', {
        name: 'Saved Dishes',
      })
    );

    fireEvent.press(
      screen.getByRole('button', {
        name: 'View dish Soup',
      })
    );

    expect(onDishPress).toHaveBeenCalledWith(d1, r1);

    view.rerender(
      <SavedPlacesScreen savedPlaces={result.current} />
    );

    expect(
      screen.queryByRole('button', {
        name: 'View dish Soup',
      })
    ).toBeNull();
  }
);

it(
  'same catalog ID in different target types uses independent saved keys',
  async () => {
    const sameIdDish = {
      ...savedDish,
      targetId: r1,
      target: {
        ...dish,
        dishId: r1,
      },
    };

    const client = clientWith([
      savedRestaurant,
      sameIdDish,
    ]);

    const { result } = renderHook(() =>
      useLiveSavedPlaces({
        origin,
        client,
        session: sessionA,
      })
    );

    await ready(result);

    expect(
      result.current.isSaved('restaurant', r1)
    ).toBe(true);

    expect(
      result.current.isSaved('dish', r1)
    ).toBe(true);

    await act(async () => {
      await result.current.removeFavorite(
        'restaurant',
        r1
      );
    });

    expect(
      result.current.isSaved('restaurant', r1)
    ).toBe(false);

    expect(
      result.current.isSaved('dish', r1)
    ).toBe(true);
  }
);

it(
  'malformed PUT responses cannot overwrite confirmed state and invalid public IDs cannot crash actions',
  async () => {
    const client = clientWith();

    client.save.mockResolvedValue(savedSecond);

    const { result } = renderHook(() =>
      useLiveSavedPlaces({
        origin,
        client,
        session: sessionA,
      })
    );

    await ready(result);

    await act(async () => {
      await result.current.toggleFavorite(restaurant);
    });

    expect(result.current.items).toEqual([]);

    expect(
      result.current.mutationErrors[key]
    ).toBeInstanceOf(Error);

    render(
      <SavedPlaceActions
        restaurant={{
          _id: 'not-canonical',
          name: 'Bad item',
        }}
        savedPlaces={result.current}
      />
    );

    expect(
      screen.getByText('Saving unavailable')
    ).toBeTruthy();

    fireEvent.press(
      screen.getByRole('button', {
        name: 'Save Bad item to Want to Try',
      })
    );

    expect(client.save).toHaveBeenCalledTimes(1);
  }
);

it(
  'a current list 401 delegates expiry and an older same-session list cannot override a newer response',
  async () => {
    const old = deferred();

    const client = clientWith();

    client.list
      .mockImplementationOnce(() => old.promise)
      .mockResolvedValueOnce([savedRestaurant])
      .mockRejectedValueOnce(expired());

    const onSessionExpired = jest.fn();

    const { result } = renderHook(() =>
      useLiveSavedPlaces({
        origin,
        client,
        session: sessionA,
        onSessionExpired,
      })
    );

    await act(async () => {
      await result.current.refresh();
    });

    await act(async () => {
      old.reject(expired());
    });

    expect(
      result.current.favorites[0]._id
    ).toBe(r1);

    expect(
      onSessionExpired
    ).not.toHaveBeenCalled();

    await act(async () => {
      await result.current.refresh();
    });

    expect(result.current.status).toBe('expired');
    expect(result.current.sessionScope).toBeNull();
    expect(result.current.items).toEqual([]);

    expect(onSessionExpired).toHaveBeenCalledTimes(1);
  }
);