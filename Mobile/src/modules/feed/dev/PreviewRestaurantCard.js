import React from 'react';
import RestaurantCard from '../components/RestaurantCard';
import dishPhotos from './dishPhotos';

/** Supply illustrative local photos for the synthetic demo dishes. */
export default function PreviewRestaurantCard(props) {
  return (
    <RestaurantCard
      {...props}
      dishImageSource={dishPhotos[props.recommendedDish?.dishId]}
    />
  );
}
