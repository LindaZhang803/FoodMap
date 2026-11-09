import React, { useState } from 'react';
import RestaurantDetailScreen from '../../restaurants/screens/RestaurantDetailScreen';
import DishBrowserScreen from '../../reviews/screens/DishBrowserScreen';
import { getMyProfile } from '../../accounts/services/authApi';
import { API_ORIGIN } from '../../../config/api';
import FoodMapFeed from './FoodMapFeed';

const readSelfProfile = ({ token }) => getMyProfile(token);

/** Navigation reached by My Feed; authentication stays with the shared app. */
export default function FeedRouteScreen({ auth, onLoginRequired, onSessionExpired }) {
  const [restaurantId, setRestaurantId] = useState(null);
  const [showDishes, setShowDishes] = useState(false);

  return <FoodMapFeed auth={auth} readSelfProfile={readSelfProfile}
    onLoginRequired={onLoginRequired} onSessionExpired={onSessionExpired}
    onRestaurantPress={setRestaurantId}
    renderDetail={() => restaurantId && (showDishes
      ? <DishBrowserScreen restaurantId={restaurantId} token={auth?.token}
          apiOrigin={API_ORIGIN} onBack={() => setShowDishes(false)} />
      : <RestaurantDetailScreen restaurantId={restaurantId}
          onBack={() => setRestaurantId(null)} onViewDishes={() => setShowDishes(true)} />)} />;
}
