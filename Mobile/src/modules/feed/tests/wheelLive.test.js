import React from 'react';
import { act, fireEvent, render } from '@testing-library/react-native';
import DecisionWheel from '../wheel/DecisionWheel';
import { EMPTY_FILTERS, filterWheelCandidates } from '../wheel/wheelCandidates';

const restaurant = (n, extra = {}) => ({
  _id: n.toString(16).padStart(24, '0'),
  name: `Place ${n}`,
  rating: 4.5,
  reviewCount: 3,
  address: `Address ${n}`,
  ...extra,
});

const dish = (n, parent, extra = {}) => ({
  dishId: n.toString(16).padStart(24, '0'),
  name: `Dish ${n}`,
  restaurantId: parent._id,
  averageRating: 4.2,
  reviewCount: 2,
  ...extra,
});

const a = restaurant(1);
const b = restaurant(2);
const c = restaurant(3);

const BUTTON_ALIASES = {
  'Use my location for distance': 'Use My Location',
  'Spinning…': 'Spinning...',
};

const press = (view, label) => {
  const actualLabel = BUTTON_ALIASES[label] ?? label;
  const escaped = actualLabel.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

  const button = view.getByRole('button', {
    name: new RegExp(`^${escaped}$`, 'i'),
  });

  fireEvent.press(button);
};

function animator() {
  const runs = [];

  const create = jest.fn((rotation, config) => {
    const run = {
      rotation,
      config,
      stop: jest.fn(),
    };

    runs.push(run);

    return {
      start: callback => {
        run.finish = callback;
      },
      stop: run.stop,
    };
  });

  return {
    create,
    runs,
    finish: (index, finished = true) =>
      act(() => runs[index].finish({ finished })),
  };
}

it('imports only selected saved records, deduplicates IDs and keeps canonical dish navigation', () => {
  const first = dish(11, a);
  const second = dish(12, b);
  const onDishPress = jest.fn();
  const animation = animator();

  const view = render(
    <DecisionWheel
      restaurants={[a, b]}
      dishes={[]}
      savedDishes={[first, first, second]}
      privateSessionKey="A"
      onDishPress={onDishPress}
      createSpinAnimation={animation.create}
      random={() => 0}
    />
  );

  press(view, 'Dishes');

  expect(
    view.getAllByRole('button', {
      name: 'Select saved Dish 11',
    })
  ).toHaveLength(1);

  press(view, 'Select saved Dish 11');
  press(view, 'Import Saved Dishes');

  expect(
    view.getByRole('button', { name: 'Remove Dish 11' })
  ).toBeTruthy();

  expect(
    view.queryByRole('button', { name: 'Remove Dish 12' })
  ).toBeNull();

  expect(
    view.getByRole('button', {
      name: 'Spin the Wheel',
    }).props.accessibilityState.disabled
  ).toBe(true);

  press(view, 'Select saved Dish 12');
  press(view, 'Import Saved Dishes');
  press(view, 'Spin the Wheel');

  animation.finish(0);

  expect(view.getByText('★ 4.2')).toBeTruthy();
  expect(view.getByText('Place 1')).toBeTruthy();

  press(view, 'Open Details');

  expect(onDishPress).toHaveBeenCalledWith(
    first.dishId,
    a._id
  );
});

it('rejects an over-capacity batch atomically and preserves selected saved records', () => {
  const catalog = Array.from(
    { length: 19 },
    (_, index) => restaurant(index + 1)
  );

  const view = render(
    <DecisionWheel
      restaurants={catalog}
      savedPlaces={[restaurant(20), restaurant(21)]}
      privateSessionKey="A"
    />
  );

  for (let i = 7; i <= 19; i += 1) {
    press(view, `Place ${i}`);
  }

  press(view, 'Select saved Place 20');
  press(view, 'Select saved Place 21');
  press(view, 'Import Saved Restaurants');

  expect(
    view.getByRole('header', {
      name: /Options\s*\(\s*19\s*\/\s*20\s*\)/,
    })
  ).toBeTruthy();

  expect(
    view.getByText(/2 selected; only 1 spaces remain/i)
  ).toBeTruthy();

  expect(
    view.getByRole('button', {
      name: 'Select saved Place 20',
    }).props.accessibilityState.selected
  ).toBe(true);

  expect(
    view.getByRole('button', {
      name: 'Select saved Place 21',
    }).props.accessibilityState.selected
  ).toBe(true);

  press(view, 'Select saved Place 21');
  press(view, 'Import Saved Restaurants');

  expect(
    view.getByRole('header', {
      name: /Options\s*\(\s*20\s*\/\s*20\s*\)/,
    })
  ).toBeTruthy();
});

it('clears imported choices, selections and a pending spin when the account changes', () => {
  const animation = animator();

  const props = {
    restaurants: [a, b],
    savedPlaces: [c],
    privateSessionKey: 'A',
    createSpinAnimation: animation.create,
    random: () => 0.99,
  };

  const view = render(<DecisionWheel {...props} />);

  press(view, 'Select saved Place 3');
  press(view, 'Import Saved Restaurants');
  press(view, 'Spin the Wheel');

  view.rerender(
    <DecisionWheel
      {...props}
      privateSessionKey="B"
      savedPlaces={[]}
    />
  );

  expect(
    view.queryByRole('button', {
      name: 'Remove Place 3',
    })
  ).toBeNull();

  expect(
    view.getByRole('button', {
      name: 'Remove Place 1',
    })
  ).toBeTruthy();

  expect(animation.runs[0].stop).toHaveBeenCalledTimes(1);

  animation.finish(0);

  expect(
    view.queryByText(/The wheel picked/i)
  ).toBeNull();

  press(view, 'Spin the Wheel');
  animation.finish(1);

  expect(
    view.getByText('The wheel picked Place 2')
  ).toBeTruthy();
});

it('clears an imported result on logout and leaves guest manual options available', () => {
  const animation = animator();

  const props = {
    restaurants: [a],
    savedPlaces: [b],
    privateSessionKey: 'A',
    createSpinAnimation: animation.create,
    random: () => 0.99,
  };

  const view = render(<DecisionWheel {...props} />);

  press(view, 'Select saved Place 2');
  press(view, 'Import Saved Restaurants');
  press(view, 'Spin the Wheel');

  animation.finish(0);

  expect(
    view.getByText('The wheel picked Place 2')
  ).toBeTruthy();

  view.rerender(
    <DecisionWheel
      {...props}
      privateSessionKey={null}
      savedPlaces={[]}
    />
  );

  expect(
    view.queryByText(/The wheel picked/i)
  ).toBeNull();

  expect(
    view.queryByRole('button', {
      name: 'Remove Place 2',
    })
  ).toBeNull();

  press(view, 'Custom');

  fireEvent.changeText(
    view.getByLabelText('Custom option'),
    'Cook at home'
  );

  press(view, 'Add');

  fireEvent.changeText(
    view.getByLabelText('Custom option'),
    'Picnic'
  );

  press(view, 'Add');
  press(view, 'Edit Picnic');

  fireEvent.changeText(
    view.getByLabelText('Custom option'),
    'Walk'
  );

  press(view, 'Save Edit');
  press(view, 'Spin the Wheel');

  animation.finish(1);

  expect(
    view.getByText('The wheel picked Walk')
  ).toBeTruthy();

  expect(
    view.queryByRole('button', {
      name: /Open Details/i,
    })
  ).toBeNull();
});

it('replaces a catalog choice through the picker without changing its canonical ID', () => {
  const animation = animator();
  const navigate = jest.fn();

  const view = render(
    <DecisionWheel
      restaurants={[a, b, c]}
      onRestaurantPress={navigate}
      createSpinAnimation={animation.create}
      random={() => 0}
    />
  );

  press(view, 'Remove Place 3');
  press(view, 'Replace Place 1');
  press(view, 'Place 3');

  expect(
    view.queryByRole('button', {
      name: 'Remove Place 1',
    })
  ).toBeNull();

  expect(
    view.getByRole('button', {
      name: 'Remove Place 3',
    })
  ).toBeTruthy();

  press(view, 'Spin the Wheel');

  animation.finish(0);

  press(view, 'Open Details');

  expect(navigate).toHaveBeenCalledWith(c._id);
});

it('guards reentry, aligns the pointer to the snapshot winner and allows another spin', () => {
  const animation = animator();

  const random = jest.fn()
    .mockReturnValueOnce(0.5)
    .mockReturnValueOnce(0);

  const props = {
    restaurants: [a, b, c],
    createSpinAnimation: animation.create,
    random,
  };

  const view = render(<DecisionWheel {...props} />);

  press(view, 'Spin the Wheel');
  press(view, 'Spinning...');

  expect(animation.create).toHaveBeenCalledTimes(1);

  expect(
    animation.runs[0].config.toValue % 360
  ).toBe(180);

  view.rerender(
    <DecisionWheel
      {...props}
      restaurants={[restaurant(99)]}
    />
  );

  animation.finish(0);

  expect(
    view.getByText('The wheel picked Place 2')
  ).toBeTruthy();

  expect(view.getByText('★ 4.5')).toBeTruthy();
  expect(view.getByText('Address 2')).toBeTruthy();

  expect(
    view.queryByRole('button', {
      name: /Open Details/i,
    })
  ).toBeNull();

  press(view, 'Spin the Wheel');
  animation.finish(1);

  expect(
    animation.runs[1].config.toValue % 360
  ).toBe(300);

  expect(
    view.getByText('The wheel picked Place 1')
  ).toBeTruthy();
});

it('recovers from a stopped animation and displays missing metadata honestly', () => {
  const animation = animator();

  const view = render(
    <DecisionWheel
      restaurants={[
        restaurant(1, {
          rating: null,
          address: '',
        }),
        b,
      ]}
      createSpinAnimation={animation.create}
      random={() => 0}
    />
  );

  press(view, 'Spin the Wheel');
  animation.finish(0, false);

  expect(
    view.queryByText(/The wheel picked/i)
  ).toBeNull();

  press(view, 'Spin the Wheel');
  animation.finish(1);

  expect(
    view.getByText('No ratings yet')
  ).toBeTruthy();

  expect(
    view.getByText('Address unavailable')
  ).toBeTruthy();

  expect(
    view.getByText('Photo unavailable')
  ).toBeTruthy();
});

it('uses the owning image resolver and falls back after an image error', () => {
  const animation = animator();

  const resolve = jest.fn(
    path => `https://food.example${path}`
  );

  const view = render(
    <DecisionWheel
      restaurants={[
        restaurant(1, {
          imageUrl: '/uploads/1.jpg',
        }),
        b,
      ]}
      resolveImageUrl={resolve}
      createSpinAnimation={animation.create}
      random={() => 0}
    />
  );

  press(view, 'Spin the Wheel');
  animation.finish(0);

  expect(resolve).toHaveBeenCalledWith(
    '/uploads/1.jpg'
  );

  expect(
    view.getByTestId('wheel-result-photo').props.source
  ).toEqual({
    uri: 'https://food.example/uploads/1.jpg',
  });

  fireEvent(
    view.getByTestId('wheel-result-photo'),
    'error'
  );

  expect(
    view.getByText('Photo unavailable')
  ).toBeTruthy();
});

it('previews filters without mutating options and adds only explicitly selected candidates', () => {
  const filterRestaurants = jest.fn(
    (items, query) =>
      items.filter(item => item.name.includes(query))
  );

  const view = render(
    <DecisionWheel
      restaurants={[a, b, c]}
      filterRestaurants={filterRestaurants}
    />
  );

  press(view, 'Clear All');

  fireEvent.changeText(
    view.getByLabelText('Filter search'),
    'Place 2'
  );

  expect(
    view.getByRole('header', {
      name: /Options\s*\(\s*0\s*\/\s*20\s*\)/,
    })
  ).toBeTruthy();

  press(view, 'Select candidate Place 2');
  press(view, 'Add Selected Candidates');

  expect(
    view.getByRole('header', {
      name: /Options\s*\(\s*1\s*\/\s*20\s*\)/,
    })
  ).toBeTruthy();

  fireEvent.changeText(
    view.getByLabelText('Filter search'),
    'No such place'
  );

  expect(
    view.getByText('No matching candidates.')
  ).toBeTruthy();

  expect(
    view.getByRole('button', {
      name: 'Remove Place 2',
    })
  ).toBeTruthy();

  fireEvent.changeText(
    view.getByLabelText('Filter search'),
    ''
  );

  press(view, 'Add All Candidates');

  expect(
    view.getByRole('header', {
      name: /Options\s*\(\s*3\s*\/\s*20\s*\)/,
    })
  ).toBeTruthy();
});

it('does not request or use location until distance is requested', () => {
  const filterRestaurants = jest.fn(items => items);
  const onRequestLocation = jest.fn();

  const location = {
    latitude: 33.97,
    longitude: -117.33,
  };

  const props = {
    restaurants: [a, b],
    filterRestaurants,
    onRequestLocation,
  };

  const view = render(
    <DecisionWheel
      {...props}
      userLocation={location}
    />
  );

  expect(
    filterRestaurants.mock.calls.at(-1)[3]
  ).toBeNull();

  expect(
    onRequestLocation
  ).not.toHaveBeenCalled();

  view.rerender(<DecisionWheel {...props} />);

  fireEvent.changeText(
    view.getByLabelText('Maximum distance (km)'),
    '5'
  );

  expect(
    view.getByText(
      'Location is needed for the distance filter.'
    )
  ).toBeTruthy();

  expect(
    onRequestLocation
  ).not.toHaveBeenCalled();

  press(view, 'Use My Location');

  expect(
    onRequestLocation
  ).toHaveBeenCalledTimes(1);

  view.rerender(
    <DecisionWheel
      {...props}
      userLocation={location}
    />
  );

  expect(
    filterRestaurants.mock.calls.at(-1)[3]
  ).toEqual(location);

  expect(
    filterRestaurants.mock.calls.at(-1)[2].customDistance
  ).toBe('5');
});

it('delegates cuisine, price and distance to the owner while filtering dishes by their own ratings', () => {
  const owner = jest.fn(() => [a]);

  const high = dish(11, a, {
    averageRating: 4.8,
  });

  const low = dish(12, a, {
    averageRating: 2,
  });

  const unknown = dish(13, a, {
    averageRating: null,
  });

  const otherParent = dish(14, b, {
    averageRating: 5,
  });

  const filters = {
    ...EMPTY_FILTERS,
    cuisine: 'chinese',
    minPrice: '8',
    maxPrice: '12',
    minRating: '4',
  };

  const result = filterWheelCandidates({
    mode: 'dish',
    restaurants: [a, b],
    dishes: [
      high,
      low,
      unknown,
      otherParent,
    ],
    searchQuery: 'Dish',
    filters,
    filterRestaurants: owner,
  });

  expect(
    result.choices.map(choice => choice.id)
  ).toEqual([high.dishId]);

  expect(owner).toHaveBeenCalledWith(
    [a, b],
    '',
    {
      ...filters,
      minRating: null,
    },
    null
  );
});

it('rejects malformed filter inputs without calling the owner', () => {
  const owner = jest.fn();

  for (const changes of [
    { minPrice: 'x' },
    { minPrice: '20', maxPrice: '10' },
    { minRating: '6' },
    { customDistance: '-1' },
  ]) {
    const result = filterWheelCandidates({
      mode: 'restaurant',
      restaurants: [a],
      dishes: [],
      filters: {
        ...EMPTY_FILTERS,
        ...changes,
      },
      filterRestaurants: owner,
    });

    expect(result.error).toBeTruthy();
  }

  expect(owner).not.toHaveBeenCalled();
});

it('stops an in-flight animation on unmount and ignores its late completion', () => {
  const animation = animator();

  const view = render(
    <DecisionWheel
      restaurants={[a, b]}
      createSpinAnimation={animation.create}
      random={() => 0}
    />
  );

  press(view, 'Spin the Wheel');

  view.unmount();

  expect(
    animation.runs[0].stop
  ).toHaveBeenCalledTimes(1);

  expect(
    () => animation.finish(0)
  ).not.toThrow();
});

it('makes exact navigation unavailable when no callable host action exists', () => {
  const animation = animator();

  const view = render(
    <DecisionWheel
      restaurants={[a, b]}
      onRestaurantPress="missing-route"
      createSpinAnimation={animation.create}
      random={() => 0}
    />
  );

  press(view, 'Spin the Wheel');
  animation.finish(0);

  expect(
    view.queryByRole('button', {
      name: /Open Details/i,
    })
  ).toBeNull();
});