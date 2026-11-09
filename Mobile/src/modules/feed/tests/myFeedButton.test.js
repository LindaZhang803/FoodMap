import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react-native';
import MyFeedButton from '../components/MyFeedButton';

const auth = { phase: 'signedIn', user: { id: 'account-a' }, token: 'test-token' };

test('My Feed delegates to login until signed in and opens feed with the current session', () => {
  const onOpenFeed = jest.fn();
  const onLoginRequired = jest.fn();
  const props = { onOpenFeed, onLoginRequired };
  const view = render(<MyFeedButton {...props} auth={{ phase: 'signedOut' }} />);
  fireEvent.press(screen.getByRole('button', { name: 'My Feed' }));
  expect(onLoginRequired).toHaveBeenCalledTimes(1);
  expect(onOpenFeed).not.toHaveBeenCalled();
  view.rerender(<MyFeedButton {...props} auth={auth} />);
  fireEvent.press(screen.getByRole('button', { name: 'My Feed' }));
  expect(onOpenFeed).toHaveBeenCalledTimes(1);
  expect(onLoginRequired).toHaveBeenCalledTimes(1);
  view.rerender(<MyFeedButton {...props} auth={{ ...auth, phase: 'signingOut' }} />);
  fireEvent.press(screen.getByRole('button', { name: 'My Feed' }));
  expect(onOpenFeed).toHaveBeenCalledTimes(1);
  expect(onLoginRequired).toHaveBeenCalledTimes(1);
  expect(screen.getByRole('button', { name: 'My Feed' })).toBeDisabled();
});

test.each([undefined, { phase: 'signedIn', user: auth.user }])(
  'incomplete or pending auth cannot open the feed: %j', invalidAuth => {
    const onOpenFeed = jest.fn();
    const onLoginRequired = jest.fn();
    render(<MyFeedButton auth={invalidAuth} onOpenFeed={onOpenFeed} onLoginRequired={onLoginRequired} />);
    fireEvent.press(screen.getByRole('button', { name: 'My Feed' }));
    expect(onOpenFeed).not.toHaveBeenCalled();
    expect(onLoginRequired).toHaveBeenCalledTimes(1);
  });

test.each([undefined, auth])('missing host navigation disables the button: %j', currentAuth => {
  render(<MyFeedButton auth={currentAuth} />);
  expect(screen.getByRole('button', { name: 'My Feed' })).toBeDisabled();
});

test.each(['restoring', 'signingIn', 'signingOut', 'clearing'])(
  'waits for Accounts to finish %s before allowing navigation', phase => {
    const onOpenFeed = jest.fn();
    const onLoginRequired = jest.fn();
    render(<MyFeedButton auth={{ ...auth, phase }} onOpenFeed={onOpenFeed} onLoginRequired={onLoginRequired} />);
    const button = screen.getByRole('button', { name: 'My Feed' });
    expect(button).toBeDisabled();
    fireEvent.press(button);
    expect(onOpenFeed).not.toHaveBeenCalled();
    expect(onLoginRequired).not.toHaveBeenCalled();
  });
