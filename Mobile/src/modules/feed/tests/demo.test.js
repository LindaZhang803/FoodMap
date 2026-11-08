import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react-native';
import FeedPreviewScreen from '../dev/FeedPreviewScreen';

jest.mock('react-native-safe-area-context', () =>
  jest.requireActual('react-native-safe-area-context/jest/mock').default);

beforeEach(() => jest.useFakeTimers());
afterEach(() => jest.useRealTimers());

it('opens Discover with the demo profile already personalized', async () => {
  render(<FeedPreviewScreen />);

  await screen.findByText('100% taste similarity · Pepper Noodles');
  expect(screen.getAllByTestId(/^feed-item:/)[0].props.testID).toBe('feed-item:demo-restaurant-noodles');
});

it('saves and reopens both item types and imports the saved restaurant into the wheel', async () => {
  render(<FeedPreviewScreen />);
  await screen.findByText('100% taste similarity · Pepper Noodles');

  fireEvent.press(screen.getByRole('button', { name: 'Open restaurant Pepper Noodle House' }));
  expect(screen.getByRole('header', { name: 'Pepper Noodle House' })).toBeTruthy();
  fireEvent.press(screen.getByRole('button', { name: 'Save Pepper Noodle House to Want to Try' }));
  fireEvent.press(screen.getByRole('button', { name: 'Pepper Noodles ›' }));
  fireEvent.press(screen.getByRole('button', { name: 'Save Pepper Noodles to Want to Try' }));

  fireEvent.press(screen.getByRole('button', { name: 'Want to Try' }));
  expect(screen.getByRole('header', { name: 'Want to Try' })).toBeTruthy();
  expect(screen.getByRole('button', { name: 'Open restaurant Pepper Noodle House' })).toBeTruthy();

  fireEvent.press(screen.getByRole('tab', { name: 'Saved Dishes' }));
  fireEvent.press(screen.getByRole('button', { name: 'View dish Pepper Noodles' }));
  expect(screen.getByRole('header', { name: 'Pepper Noodles' })).toBeTruthy();

  fireEvent.press(screen.getByRole('button', { name: 'Wheel' }));
  fireEvent.press(screen.getByRole('button', { name: 'Clear all' }));
  fireEvent.press(screen.getByRole('button', { name: 'Select saved Pepper Noodle House' }));
  fireEvent.press(screen.getByRole('button', { name: 'Import saved restaurants' }));
  expect(screen.getByRole('button', { name: 'Remove Pepper Noodle House' })).toBeTruthy();
});
