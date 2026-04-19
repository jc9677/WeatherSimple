# WeatherSimple

A simple GitHub Pages static site that fetches weather forecast data directly from api.weather.gc.ca in the browser.

The site:
- accepts a city code such as `on-52`
- saves the city code using `localStorage`
- displays forecast data and summary text
- shows a forecast data timestamp and the last successful API request time
- handles API errors gracefully with user-facing messages

## Files

- `index.html` — main page markup
- `styles.css` — styling and responsive layout
- `script.js` — fetch logic, localStorage support, error handling, and render logic
