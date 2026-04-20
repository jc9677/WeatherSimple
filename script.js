const STORAGE_KEY = 'weather-simple-city-code';
const DEFAULT_CITY_CODE = 'on-52';

const cityInput = document.getElementById('cityInput');
const statusMessage = document.getElementById('statusMessage');
const forecastContainer = document.getElementById('forecastContainer');
const forecastTitle = document.getElementById('forecastTitle');
const forecastUpdatedText = document.getElementById('forecastUpdated');
const requestTimeText = document.getElementById('requestTime');
const searchCityButton = document.getElementById('searchCityButton');
const refreshButton = document.getElementById('refreshButton');
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
  if (type === 'error') {
    statusMessage.textContent = message;
    statusMessage.style.color = '#b91c1c';
    statusMessage.style.display = 'block';
  } else {
    statusMessage.style.display = 'none';
  }
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

  forecastTitle.textContent = locationName || 'Forecast details';
  forecastUpdatedText.textContent = formatLocalDateTime(forecastGroup.timestamp || properties.lastUpdated);
  requestTimeText.textContent = formatLocalDateTime(new Date());

  if (!forecasts.length) {
    setStatus('No forecast entries were returned by the API.', 'error');
    return;
  }

  forecastContainer.innerHTML = '';

  const getLocalizedValue = (value) => {
    if (value == null) return '';
    if (typeof value === 'object') {
      if ('en' in value || 'fr' in value) {
        return value.en || value.fr || '';
      }
      if ('value' in value) {
        return getLocalizedValue(value.value);
      }
      return String(value);
    }
    return String(value);
  };

  const currentConditions = properties.currentConditions || {};
  const currentSummary = getLocalizedValue(currentConditions.condition) || getLocalizedValue(currentConditions.textSummary);
  const currentTempValue = getLocalizedValue(currentConditions.temperature?.value);
  const currentTempUnit = getLocalizedValue(currentConditions.temperature?.units?.en || currentConditions.temperature?.units?.fr);
  const currentTemp = currentTempValue ? `${currentTempValue}${currentTempUnit ? ` ${currentTempUnit}` : ''}` : '';
  const currentWindSpeed = getLocalizedValue(currentConditions.wind?.speed?.value);
  const currentWindUnits = getLocalizedValue(currentConditions.wind?.speed?.units?.en || currentConditions.wind?.speed?.units?.fr);
  const currentWindDirection = getLocalizedValue(currentConditions.wind?.direction?.value);
  const currentWind = currentWindSpeed
    ? `${currentWindSpeed}${currentWindUnits ? ` ${currentWindUnits}` : ''}${currentWindDirection ? ` ${currentWindDirection}` : ''}`
    : '';
  const currentHumidity = getLocalizedValue(currentConditions.relativeHumidity?.value);
  const currentHumidityUnits = getLocalizedValue(currentConditions.relativeHumidity?.units?.en || currentConditions.relativeHumidity?.units?.fr);
  const currentIconUrl = currentConditions.iconCode?.url || currentConditions.icon?.url || '';
  const currentDetails = [];

  if (currentTemp) {
    currentDetails.push(`<div><strong class="forecast-label">Temperature</strong><span>${currentTemp}</span></div>`);
  }
  if (currentWind) {
    currentDetails.push(`<div><strong class="forecast-label">Wind</strong><span>${currentWind}</span></div>`);
  }
  if (currentHumidity) {
    currentDetails.push(`<div><strong class="forecast-label">Humidity</strong><span>${currentHumidity}${currentHumidityUnits ? ` ${currentHumidityUnits}` : ''}</span></div>`);
  }

  const currentConditionsHtml = currentSummary || currentDetails.length || currentIconUrl
    ? `<div class="current-conditions">
        <strong>Current conditions</strong>
        ${currentIconUrl ? `<div class="current-icon"><img src="${currentIconUrl}" alt="Current weather icon for ${locationName}" width="40" height="34" /></div>` : ''}
        ${currentSummary ? `<div>${currentSummary}</div>` : ''}
        ${currentDetails.join('')}
      </div>`
    : '';

  if (currentConditionsHtml) {
    const currentCard = document.createElement('div');
    currentCard.className = 'forecast-card';
    currentCard.innerHTML = currentConditionsHtml;
    forecastContainer.appendChild(currentCard);
  }

  forecasts.forEach((entry) => {
    const periodName = entry.period?.textForecastName?.en || 'Forecast';
    const periodValue = entry.period?.value?.en || '';
    const periodLabelText = periodValue && periodValue !== periodName
      ? `${periodName} (${periodValue})`
      : periodName;
    const periodLabel = periodValue && periodValue !== periodName
      ? `<span class="period-name">${periodName}</span> (${periodValue})`
      : `<span class="period-name">${periodName}</span>`;
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
        ${iconUrl ? `<img src="${iconUrl}" alt="Weather icon for ${periodLabelText}" width="40" height="34" />` : ''}
        <div><strong class="forecast-label">Short summary</strong><span>${quick}</span></div>
        ${tempSummary ? `<div><strong class="forecast-label">Temperature</strong><span>${tempSummary}</span></div>` : ''}
        ${wind ? `<div><strong class="forecast-label">Wind</strong><span>${wind}</span></div>` : ''}
        <div><strong class="forecast-label">Full forecast</strong><span>${summary}</span></div>
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

function refreshForecast() {
  const cityCode = cityInput.value || DEFAULT_CITY_CODE;
  setStatus('Refreshing forecast…');
  loadWeather(cityCode);
}

searchCityButton.addEventListener('click', openCityModal);
refreshButton.addEventListener('click', refreshForecast);
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
