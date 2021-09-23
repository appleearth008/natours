/* eslint-disable */ // eslint is for node.js not for javascript

// console.log(locations);

export const displayMap = (locations) => {
  mapboxgl.accessToken =
    'pk.eyJ1IjoiYXBwbGVzbGVlcCIsImEiOiJja3R0enJwNDgxdm96Mm5udXl2d2Vld3RsIn0.ez9HULscXPsO2c3aec-EqQ';
  var map = new mapboxgl.Map({
    container: 'map',
    style: 'mapbox://styles/applesleep/cktu034j50osh18oaix686tey',
    scrollZoom: false,
    //   center: [-118, 34],
    //   zoom: 6,
    //   interactive: false,
  });

  const bounds = new mapboxgl.LngLatBounds();

  locations.forEach((loc) => {
    // create marker:
    const el = document.createElement('div');
    el.className = 'marker';
    // add marker:
    new mapboxgl.Marker({
      element: el,
      anchor: 'bottom',
    })
      .setLngLat(loc.coordinates)
      .addTo(map);
    // add popup
    new mapboxgl.Popup({ offset: 30 })
      .setLngLat(loc.coordinates)
      .setHTML(`<p>Day ${loc.day}: ${loc.description} </p>`)
      .addTo(map);
    // extend map bounds to include current location
    bounds.extend(loc.coordinates);
  });

  //
  map.fitBounds(bounds, {
    padding: { top: 200, bottom: 150, left: 100, right: 100 },
  });
};
