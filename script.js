const STORAGE_KEY = 'weather-simple-city-code';
const DEFAULT_CITY_CODE = 'on-52';

const cityInput = document.getElementById('cityInput');
const selectedCityName = document.getElementById('selectedCityName');
const selectedCityCode = document.getElementById('selectedCityCode');
const statusMessage = document.getElementById('statusMessage');
const forecastContainer = document.getElementById('forecastContainer');
const forecastUpdatedText = document.getElementById('forecastUpdated');
const requestTimeText = document.getElementById('requestTime');
const searchCityButton = document.getElementById('searchCityButton');
const cityModal = document.getElementById('cityModal');
const closeModal = document.getElementById('closeModal');
const citySearchInput = document.getElementById('citySearchInput');
const citySearchStatus = document.getElementById('citySearchStatus');
const searchResults = document.getElementById('searchResults');

let cityListPromise = null;
let searchCityList = [];
let searchDebounce = null;

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

function fetchCityList() {
  if (cityListPromise) {
    return cityListPromise;
  }

  cityListPromise = fetch('https://api.weather.gc.ca/collections/citypageweather-realtime/items?properties=identifier,name.en&limit=1000&f=json')
    .then((response) => {
      if (!response.ok) {
        throw new Error(`City list request failed with status ${response.status}.`);
      }
      return response.json();
    })
    .then((data) => {
      const features = Array.isArray(data.features) ? data.features : [];
      searchCityList = features.map((feature) => {
        const properties = feature.properties || {};
        return {
          properties: {
            identifier: properties.identifier || '',
            name: {
              en: properties.name?.en || properties.name?.fr || properties.identifier || '',
            },
          },
        };
      });
      return searchCityList;
    })
    .catch((error) => {
      cityListPromise = null;
      throw error;
    });

  return cityListPromise;
}

function openCityModal() {
  cityModal.classList.remove('hidden');
  citySearchInput.value = '';
  displaySearchStatus('Loading city list…');
  clearSearchResults();
  setTimeout(() => citySearchInput.focus(), 0);

  fetchCityList()
    .then(() => {
      displaySearchStatus('Type the first letter to search.');
    })
    .catch(() => {
      displaySearchStatus('Unable to load cities. Please try again later.');
    });
}

function closeCityModal() {
  cityModal.classList.add('hidden');
  citySearchStatus.textContent = '';
  clearSearchResults();
}

function displaySearchStatus(message) {
  citySearchStatus.textContent = message;
}

function clearSearchResults() {
  searchResults.innerHTML = '';
}

function renderSearchResults(features, query) {
  searchResults.innerHTML = '';

  if (!features || !features.length) {
    displaySearchStatus(query ? 'No matches found. Try a different spelling or more letters.' : 'Type a city name to start searching.');
    return;
  }

  displaySearchStatus(`${features.length} result${features.length === 1 ? '' : 's'}.`);

  features.forEach((feature) => {
    const properties = feature.properties || {};
    const identifier = properties.identifier || '';
    const name = properties.name?.en || properties.name?.fr || identifier;

    const item = document.createElement('button');
    item.type = 'button';
    item.className = 'search-item';
    item.setAttribute('role', 'option');
    item.innerHTML = `
      <span class="search-name">${name}</span>
      <span class="search-id">${identifier}</span>
    `;
    item.addEventListener('click', () => selectCity(identifier, name));

    searchResults.appendChild(item);
  });
}

async function searchCities(query) {
  const trimmedQuery = String(query || '').trim();

  if (!trimmedQuery) {
    renderSearchResults([], trimmedQuery);
    return;
  }

  displaySearchStatus('Searching…');

  try {
    await fetchCityList();
    const lowerQuery = trimmedQuery.toLowerCase();
    const matches = searchCityList.filter((feature) => {
      const properties = feature.properties || {};
      const identifier = String(properties.identifier || '').toLowerCase();
      const name = String(properties.name?.en || properties.name?.fr || '').toLowerCase();
      return name.includes(lowerQuery) || identifier.includes(lowerQuery);
    }).slice(0, 30);

    renderSearchResults(matches, trimmedQuery);
  } catch (error) {
    displaySearchStatus('Search failed. Please try again.');
    searchResults.innerHTML = '';
  }
}

function queueSearch(query) {
  if (searchDebounce) {
    clearTimeout(searchDebounce);
  }

  searchDebounce = setTimeout(() => {
    searchCities(query);
  }, 180);
}

function selectCity(identifier, displayName) {
  if (!identifier) return;
  selectedCityName.textContent = displayName;
  selectedCityCode.textContent = identifier;
  cityInput.value = identifier;
  closeCityModal();
  setStatus(`Selected ${displayName} (${identifier}). Loading forecast…`, 'info');
  loadWeather(identifier);
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
    selectedCityName.textContent = data.properties?.name?.en || data.properties?.name?.fr || cityCode;
    selectedCityCode.textContent = cityCode;
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
  selectedCityName.textContent = savedCity;
  selectedCityCode.textContent = savedCity;
  loadWeather(savedCity);
}

searchCityButton.addEventListener('click', openCityModal);
closeModal.addEventListener('click', closeCityModal);
cityModal.addEventListener('click', (event) => {
  if (event.target === cityModal) {
    closeCityModal();
  }
});

citySearchInput.addEventListener('input', (event) => {
  queueSearch(event.target.value);
});

citySearchInput.addEventListener('focus', () => {
  if (citySearchInput.value.trim()) {
    queueSearch(citySearchInput.value.trim());
  } else {
    displaySearchStatus('Type the first letter to search.');
  }
});

document.addEventListener('keydown', (event) => {
  if (event.key === 'Escape' && !cityModal.classList.contains('hidden')) {
    closeCityModal();
  }
});

window.addEventListener('DOMContentLoaded', init);
