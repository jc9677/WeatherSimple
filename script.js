const STORAGE_KEY = 'weather-simple-city-code';
const DEFAULT_CITY_CODE = 'on-52';

const cityForm = document.getElementById('cityForm');
const cityInput = document.getElementById('cityInput');
const statusMessage = document.getElementById('statusMessage');
const forecastContainer = document.getElementById('forecastContainer');
const forecastUpdatedText = document.getElementById('forecastUpdated');
const requestTimeText = document.getElementById('requestTime');

function formatLocalDateTime(value) {
  if (!value) return '—';

  if (value instanceof Date) {
    if (Number.isNaN(value.getTime())) return '—';
    value = value.toISOString();
  }

  let dateValue = value;
  if (typeof value === 'object' && value !== null) {
    dateValue = value.en || value.fr || Object.values(value)[0];
  }

  const date = typeof dateValue === 'string' || typeof dateValue === 'number'
    ? new Date(dateValue)
    : dateValue;

  if (!(date instanceof Date) || Number.isNaN(date.getTime())) return '—';

  return date.toLocaleString(undefined, {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  }).replace(',', '');
}

function setStatus(message, type = 'info') {
  statusMessage.textContent = message;
  statusMessage.style.color = type === 'error' ? '#b91c1c' : '#334155';
}

function clearForecast() {
  forecastContainer.innerHTML = '';
  forecastUpdatedText.textContent = '—';
  requestTimeText.textContent = '—';
}

function renderForecast(data, cityCode) {
  const properties = data.properties || {};
  const forecastGroup = properties.forecastGroup || {};
  const forecasts = Array.isArray(forecastGroup.forecasts) ? forecastGroup.forecasts : [];
  const locationName = properties.name?.en || cityCode;

  forecastUpdatedText.textContent = formatLocalDateTime(forecastGroup.timestamp || properties.lastUpdated);
  requestTimeText.textContent = formatLocalDateTime(new Date());

  if (!forecasts.length) {
    setStatus('No forecast entries were returned by the API.', 'error');
    return;
  }

  forecastContainer.innerHTML = '';

  const titleCard = document.createElement('div');
  titleCard.className = 'forecast-card';
  titleCard.innerHTML = `
    <h3>${locationName}</h3>
    <p><strong>${cityCode}</strong> — ${forecasts.length} forecast periods loaded.</p>
  `;
  forecastContainer.appendChild(titleCard);

  forecasts.forEach((entry) => {
    const periodName = entry.period?.textForecastName?.en || 'Forecast';
    const periodValue = entry.period?.value?.en || '';
    const periodLabel = periodValue && periodValue !== periodName
      ? `${periodName} (${periodValue})`
      : periodName;
    const summary = entry.textSummary?.en || entry.abbreviatedForecast?.textSummary?.en || 'No summary available.';
    const quick = entry.abbreviatedForecast?.textSummary?.en || '';
    const tempSummary = entry.temperatures?.textSummary?.en || '';
    const wind = entry.winds?.textSummary?.en || '';
    const iconUrl = entry.abbreviatedForecast?.icon?.url;

    const card = document.createElement('article');
    card.className = 'forecast-card';
    card.innerHTML = `
      <h3>${periodLabel}</h3>
      <div class="forecast-summary">
        ${iconUrl ? `<img src="${iconUrl}" alt="Weather icon for ${periodLabel}" width="40" height="34" />` : ''}
        <div><strong>Short summary</strong><span>${quick}</span></div>
        ${tempSummary ? `<div><strong>Temperature</strong><span>${tempSummary}</span></div>` : ''}
        ${wind ? `<div><strong>Wind</strong><span>${wind}</span></div>` : ''}
        <div><strong>Full forecast</strong><span>${summary}</span></div>
      </div>
    `;

    forecastContainer.appendChild(card);
  });
}

async function loadWeather(cityCode) {
  clearForecast();
  setStatus('Loading forecast…');

  try {
    const response = await fetch(`https://api.weather.gc.ca/collections/citypageweather-realtime/items/${encodeURIComponent(cityCode)}?f=json`);

    if (!response.ok) {
      throw new Error(`Weather API request failed with status ${response.status}.`);
    }

    const data = await response.json();
    if (!data.properties || !data.properties.forecastGroup) {
      throw new Error('The API response did not contain the expected forecast data.');
    }

    localStorage.setItem(STORAGE_KEY, cityCode);
    cityInput.value = cityCode;
    renderForecast(data, cityCode);
    setStatus('Forecast loaded successfully.', 'info');
  } catch (error) {
    clearForecast();
    setStatus(error.message || 'Unable to load the forecast.', 'error');
  }
}

function init() {
  const savedCity = localStorage.getItem(STORAGE_KEY) || DEFAULT_CITY_CODE;
  cityInput.value = savedCity;
  loadWeather(savedCity);
}

cityForm.addEventListener('submit', (event) => {
  event.preventDefault();
  const rawValue = cityInput.value.trim();
  if (!rawValue) {
    setStatus('Please enter a valid city code, such as on-52.', 'error');
    return;
  }
  loadWeather(rawValue.toLowerCase());
});

window.addEventListener('DOMContentLoaded', init);
