import { useState } from 'react';

/** Keeps the demo's saved items for the life of the app. */
export default function useSavedPlaces() {
  const [lists, setLists] = useState({ favorites: [], favoriteDishes: [] });

  function toggle(listName, item, idKey) {
    setLists(previous => {
      const list = previous[listName];
      const isSaved = list.some(saved => saved[idKey] === item[idKey]);
      const updatedList = isSaved
        ? list.filter(saved => saved[idKey] !== item[idKey])
        : [...list, item];

      return { ...previous, [listName]: updatedList };
    });
  }

  return {
    ...lists,
    toggleFavorite: restaurant => toggle('favorites', restaurant, '_id'),
    toggleFavoriteDish: dish => toggle('favoriteDishes', dish, 'dishId'),
  };
}
