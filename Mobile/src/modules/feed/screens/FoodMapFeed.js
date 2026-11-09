import React, { useMemo } from 'react';
import { API_ORIGIN } from '../../../config/api';
import { getRestaurants } from '../../restaurants/services/restaurantApi';
import { filterRestaurants } from '../../restaurants/utils/restaurantFilters';
import { createDishRepository } from '../../reviews/services/dishRepository';
import { toFeedSession } from '../services/accountSession';
import FeedExperience from './FeedExperience';

/** Host supplies its existing Accounts state and navigation; no second session. */
export default function FoodMapFeed({ auth, preferenceRevision = 0, ...props }) {
  const getDishes = useMemo(() => {
    const repository = createDishRepository({ origin: API_ORIGIN });
    return repository.getDishes.bind(repository);
  }, []);
  const session = useMemo(() => {
    const current = toFeedSession(auth);
    return current ? { ...current, preferenceRevision } : null;
  }, [auth?.phase, auth?.user?.id, auth?.token, preferenceRevision]);

  return <FeedExperience {...props}
    session={session} origin={API_ORIGIN}
    getRestaurants={getRestaurants} getDishes={getDishes}
    filterRestaurants={filterRestaurants} />;
}
