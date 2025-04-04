// index.js - Main application file

// Game Configuration
const gameConfig = {
  gameMode: 'medium', // 'easy', 'medium', 'hard'
  filters: {
    countries: [], // empty means all countries
    minPopulation: 100000,
    maxCities: 5
  },
  mapSettings: {
    countryBorders: true,
    stateBorders: false,
    terrainLayer: false
  },
  inputMode: 'autocomplete', // 'dropdown', 'autocomplete', 'freetext'
  currentRound: 0,
  totalRounds: 5,
  score: 0,
  username: '',
  currentCity: null,
  guessedCities: []
};

// Initialize map
let map;
let markers = [];

// Initialize app
document.addEventListener('DOMContentLoaded', () => {
  setupUI();
  initializeMap();
  setupEventListeners();
  showStartScreen();
});

// UI Setup
function setupUI() {
  const appContainer = document.getElementById('app');
  appContainer.innerHTML = `
    <div class="game-container">
      <div id="start-screen" class="screen">
        <h1>City Guessing Game</h1>
        <div class="form-group">
          <label for="username">Enter Username:</label>
          <input type="text" id="username" class="input-field">
        </div>
        <div class="form-group">
          <label for="game-mode">Select Difficulty:</label>
          <select id="game-mode" class="select-field">
            <option value="easy">Easy</option>
            <option value="medium" selected>Medium</option>
            <option value="hard">Hard</option>
          </select>
        </div>
        <button id="start-game" class="btn primary-btn">Start Game</button>
        <button id="settings-btn" class="btn secondary-btn">Advanced Settings</button>
      </div>

      <div id="settings-screen" class="screen hidden">
        <h2>Game Settings</h2>
        <div class="settings-group">
          <h3>Region Filters</h3>
          <div class="form-group">
            <label for="country-select">Countries:</label>
            <select id="country-select" class="select-field" multiple>
              <!-- Will be populated from database -->
            </select>
          </div>
          <div class="form-group">
            <label for="min-population">Minimum City Population:</label>
            <input type="range" id="min-population" min="0" max="10000000" step="50000" value="100000">
            <span id="min-population-value">100,000</span>
          </div>
        </div>
        
        <div class="settings-group">
          <h3>Map Display</h3>
          <div class="checkbox-group">
            <input type="checkbox" id="country-borders" checked>
            <label for="country-borders">Show Country Borders</label>
          </div>
          <div class="checkbox-group">
            <input type="checkbox" id="state-borders">
            <label for="state-borders">Show State/Provincial Borders</label>
          </div>
          <div class="checkbox-group">
            <input type="checkbox" id="terrain-layer">
            <label for="terrain-layer">Show Terrain</label>
          </div>
        </div>
        
        <div class="settings-group">
          <h3>Input Mode</h3>
          <div class="radio-group">
            <input type="radio" id="input-dropdown" name="input-mode" value="dropdown">
            <label for="input-dropdown">Multiple Choice Dropdown</label>
          </div>
          <div class="radio-group">
            <input type="radio" id="input-autocomplete" name="input-mode" value="autocomplete" checked>
            <label for="input-autocomplete">Typing with Autocomplete</label>
          </div>
          <div class="radio-group">
            <input type="radio" id="input-freetext" name="input-mode" value="freetext">
            <label for="input-freetext">Typing without Autocomplete</label>
          </div>
        </div>
        
        <button id="save-settings" class="btn primary-btn">Save Settings</button>
        <button id="cancel-settings" class="btn secondary-btn">Cancel</button>
      </div>

      <div id="game-screen" class="screen hidden">
        <div class="game-header">
          <div class="score-display">
            <span>Score: <span id="current-score">0</span></span>
          </div>
          <div class="round-display">
            <span>Round: <span id="current-round">1</span>/<span id="total-rounds">5</span></span>
          </div>
        </div>
        
        <div id="map-container"></div>
        
        <div class="guess-container">
          <div id="dropdown-input" class="input-container hidden">
            <label for="city-dropdown">Select the city:</label>
            <select id="city-dropdown" class="select-field">
              <!-- Will be populated with options -->
            </select>
          </div>
          
          <div id="text-input" class="input-container">
            <label for="city-input">Which city is this?</label>
            <input type="text" id="city-input" class="input-field" placeholder="Type city name...">
            <div id="autocomplete-suggestions" class="hidden"></div>
          </div>
          
          <button id="submit-guess" class="btn primary-btn">Submit Guess</button>
        </div>
      </div>

      <div id="result-screen" class="screen hidden">
        <h2>Round Result</h2>
        <div class="result-details">
          <p>The city was: <span id="actual-city">City Name</span></p>
          <p>Your guess: <span id="guessed-city">Your Guess</span></p>
          <p>Distance: <span id="distance">0</span> km</p>
          <p>Points earned: <span id="points-earned">0</span></p>
        </div>
        <button id="next-round" class="btn primary-btn">Next Round</button>
      </div>

      <div id="game-over-screen" class="screen hidden">
        <h2>Game Over</h2>
        <div class="final-score">
          <p>Final Score: <span id="final-score">0</span></p>
        </div>
        <div id="guesses-summary"></div>
        <button id="save-score" class="btn primary-btn">Save Score</button>
        <button id="play-again" class="btn secondary-btn">Play Again</button>
      </div>
    </div>
  `;
}

// Map Initialization
function initializeMap() {
  map = L.map('map-container', {
    center: [20, 0],
    zoom: 2,
    zoomControl: true,
    attributionControl: true
  });

  // Base tile layer
  L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
  }).addTo(map);

  // Add additional layers based on settings
  updateMapLayers();
}

// Update map layers based on current settings
function updateMapLayers() {
  if (gameConfig.mapSettings.terrainLayer) {
    // Add terrain layer
    L.tileLayer('https://stamen-tiles-{s}.a.ssl.fastly.net/terrain/{z}/{x}/{y}{r}.png', {
      attribution: 'Map tiles by <a href="http://stamen.com">Stamen Design</a>'
    }).addTo(map);
  }

  if (gameConfig.mapSettings.countryBorders) {
    // Add country borders layer
    fetch('/api/geojson/countries')
      .then(response => response.json())
      .then(data => {
        L.geoJSON(data, {
          style: {
            color: '#3388ff',
            weight: 2,
            opacity: 0.7,
            fillOpacity: 0
          }
        }).addTo(map);
      });
  }

  if (gameConfig.mapSettings.stateBorders) {
    // Add state/provincial borders layer
    fetch('/api/geojson/states')
      .then(response => response.json())
      .then(data => {
        L.geoJSON(data, {
          style: {
            color: '#9932CC',
            weight: 1,
            opacity: 0.5,
            fillOpacity: 0
          }
        }).addTo(map);
      });
  }
}

// Event listeners setup
function setupEventListeners() {
  // Start screen
  document.getElementById('start-game').addEventListener('click', startGame);
  document.getElementById('settings-btn').addEventListener('click', showSettingsScreen);
  document.getElementById('game-mode').addEventListener('change', handleGameModeChange);

  // Settings screen
  document.getElementById('save-settings').addEventListener('click', saveSettings);
  document.getElementById('cancel-settings').addEventListener('click', hideSettingsScreen);
  document.getElementById('min-population').addEventListener('input', updatePopulationDisplay);

  // Game screen
  document.getElementById('submit-guess').addEventListener('click', submitGuess);
  document.getElementById('city-input').addEventListener('input', handleCityInput);

  // Result screen
  document.getElementById('next-round').addEventListener('click', nextRound);

  // Game over screen
  document.getElementById('save-score').addEventListener('click', saveScore);
  document.getElementById('play-again').addEventListener('click', resetGame);
}

function showStartScreen() {
  hideAllScreens();
  document.getElementById('start-screen').classList.remove('hidden');
}

function showSettingsScreen() {
  hideAllScreens();
  document.getElementById('settings-screen').classList.remove('hidden');
  loadCountriesForMultiselect();
}

function hideSettingsScreen() {
  hideAllScreens();
  document.getElementById('start-screen').classList.remove('hidden');
}

function hideAllScreens() {
  const screens = document.querySelectorAll('.screen');
  screens.forEach(screen => screen.classList.add('hidden'));
}

function updatePopulationDisplay() {
  const value = document.getElementById('min-population').value;
  document.getElementById('min-population-value').textContent = parseInt(value).toLocaleString();
}

function handleGameModeChange(e) {
  const mode = e.target.value;
  switch (mode) {
    case 'easy':
      gameConfig.inputMode = 'dropdown';
      gameConfig.mapSettings.countryBorders = true;
      gameConfig.mapSettings.stateBorders = false;
      gameConfig.mapSettings.terrainLayer = true;
      break;
    case 'medium':
      gameConfig.inputMode = 'autocomplete';
      gameConfig.mapSettings.countryBorders = true;
      gameConfig.mapSettings.stateBorders = false;
      gameConfig.mapSettings.terrainLayer = false;
      break;
    case 'hard':
      gameConfig.inputMode = 'freetext';
      gameConfig.mapSettings.countryBorders = false;
      gameConfig.mapSettings.stateBorders = false;
      gameConfig.mapSettings.terrainLayer = false;
      break;
  }
  
  // Update UI to reflect the new settings
  updateSettingsUI();
}

function updateSettingsUI() {
  document.getElementById('country-borders').checked = gameConfig.mapSettings.countryBorders;
  document.getElementById('state-borders').checked = gameConfig.mapSettings.stateBorders;
  document.getElementById('terrain-layer').checked = gameConfig.mapSettings.terrainLayer;
  
  // Update input mode radio buttons
  document.getElementById(`input-${gameConfig.inputMode}`).checked = true;
}

function saveSettings() {
  // Update game config with settings values
  gameConfig.mapSettings.countryBorders = document.getElementById('country-borders').checked;
  gameConfig.mapSettings.stateBorders = document.getElementById('state-borders').checked;
  gameConfig.mapSettings.terrainLayer = document.getElementById('terrain-layer').checked;
  
  // Get selected input mode
  const inputModes = document.getElementsByName('input-mode');
  for (const mode of inputModes) {
    if (mode.checked) {
      gameConfig.inputMode = mode.value;
      break;
    }
  }
  
  // Get minimum population
  gameConfig.filters.minPopulation = parseInt(document.getElementById('min-population').value);
  
  // Get selected countries
  const countrySelect = document.getElementById('country-select');
  gameConfig.filters.countries = Array.from(countrySelect.selectedOptions).map(option => option.value);
  
  hideSettingsScreen();
}

function startGame() {
  const usernameInput = document.getElementById('username');
  const username = usernameInput.value.trim();
  
  if (!username) {
    alert('Please enter a username');
    return;
  }
  
  gameConfig.username = username;
  gameConfig.gameMode = document.getElementById('game-mode').value;
  gameConfig.currentRound = 1;
  gameConfig.score = 0;
  gameConfig.guessedCities = [];
  
  // Update UI
  document.getElementById('current-score').textContent = '0';
  document.getElementById('current-round').textContent = '1';
  document.getElementById('total-rounds').textContent = gameConfig.totalRounds;
  
  // Show game screen
  hideAllScreens();
  document.getElementById('game-screen').classList.remove('hidden');
  
  // Configure input based on selected mode
  setupInputMode();
  
  // Start first round
  startRound();
}

function setupInputMode() {
  const dropdownInput = document.getElementById('dropdown-input');
  const textInput = document.getElementById('text-input');
  const autocompleteSuggestions = document.getElementById('autocomplete-suggestions');
  
  switch (gameConfig.inputMode) {
    case 'dropdown':
      dropdownInput.classList.remove('hidden');
      textInput.classList.add('hidden');
      loadDropdownOptions();
      break;
    case 'autocomplete':
      dropdownInput.classList.add('hidden');
      textInput.classList.remove('hidden');
      autocompleteSuggestions.classList.remove('hidden');
      break;
    case 'freetext':
      dropdownInput.classList.add('hidden');
      textInput.classList.remove('hidden');
      autocompleteSuggestions.classList.add('hidden');
      break;
  }
}

function loadDropdownOptions() {
  const dropdown = document.getElementById('city-dropdown');
  dropdown.innerHTML = '';
  
  // Get current city
  const currentCity = gameConfig.currentCity;
  
  // Fetch 5 random cities including the current one
  fetch(`/api/cities/random?count=4&exclude=${currentCity.id}`)
    .then(response => response.json())
    .then(cities => {
      // Add current city to the mix
      cities.push(currentCity);
      
      // Shuffle the options
      cities.sort(() => Math.random() - 0.5);
      
      // Add to dropdown
      cities.forEach(city => {
        const option = document.createElement('option');
        option.value = city.id;
        option.textContent = city.name;
        dropdown.appendChild(option);
      });
    });
}

function startRound() {
  // Clear previous markers
  markers.forEach(marker => map.removeLayer(marker));
  markers = [];
  
  // Reset input fields
  document.getElementById('city-input').value = '';
  document.getElementById('autocomplete-suggestions').innerHTML = '';
  
  // Fetch a random city based on filters
  const filters = {
    countries: gameConfig.filters.countries,
    minPopulation: gameConfig.filters.minPopulation,
    exclude: gameConfig.guessedCities.map(g => g.cityId)
  };
  
  fetch('/api/cities/random', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(filters)
  })
    .then(response => response.json())
    .then(city => {
      gameConfig.currentCity = city;
      
      // Center map on city
      map.setView([city.latitude, city.longitude], 5);
      
      // Add marker
      const marker = L.marker([city.latitude, city.longitude]).addTo(map);
      markers.push(marker);
      
      // Update input mode if needed
      if (gameConfig.inputMode === 'dropdown') {
        loadDropdownOptions();
      }
    });
}

function handleCityInput(e) {
  if (gameConfig.inputMode !== 'autocomplete') {
    return;
  }
  
  const input = e.target.value;
  if (input.length < 3) {
    document.getElementById('autocomplete-suggestions').innerHTML = '';
    return;
  }
  
  // Fetch autocomplete suggestions
  fetch(`/api/cities/autocomplete?query=${input}`)
    .then(response => response.json())
    .then(suggestions => {
      const suggestionsContainer = document.getElementById('autocomplete-suggestions');
      suggestionsContainer.innerHTML = '';
      
      suggestions.forEach(city => {
        const suggestion = document.createElement('div');
        suggestion.classList.add('suggestion');
        suggestion.textContent = `${city.name}, ${city.country}`;
        suggestion.addEventListener('click', () => {
          document.getElementById('city-input').value = city.name;
          suggestionsContainer.innerHTML = '';
          // Store selected city ID for submission
          document.getElementById('city-input').dataset.cityId = city.id;
        });
        suggestionsContainer.appendChild(suggestion);
      });
    });
}

function submitGuess() {
  let guessedCityId;
  
  if (gameConfig.inputMode === 'dropdown') {
    guessedCityId = document.getElementById('city-dropdown').value;
  } else {
    // For autocomplete, we get the ID from the data attribute if available
    const cityInput = document.getElementById('city-input');
    if (gameConfig.inputMode === 'autocomplete' && cityInput.dataset.cityId) {
      guessedCityId = cityInput.dataset.cityId;
    } else {
      // For freetext, we need to search for the city by name
      const cityName = cityInput.value.trim();
      if (!cityName) {
        alert('Please enter a city name');
        return;
      }
      
      // Search for city by name
      fetch(`/api/cities/search?name=${encodeURIComponent(cityName)}`)
        .then(response => response.json())
        .then(city => {
          if (city) {
            processGuess(city.id);
          } else {
            alert('City not found. Please try another name.');
          }
        });
      return;
    }
  }
  
  processGuess(guessedCityId);
}

function processGuess(guessedCityId) {
  fetch(`/api/cities/${guessedCityId}`)
    .then(response => response.json())
    .then(guessedCity => {
      const actualCity = gameConfig.currentCity;
      
      // Calculate distance
      const distance = calculateDistance(
        actualCity.latitude, actualCity.longitude,
        guessedCity.latitude, guessedCity.longitude
      );
      
      // Calculate points (inverse logarithmic to distance)
      const points = calculatePoints(distance);
      
      // Update score
      gameConfig.score += points;
      
      // Store guess for history
      gameConfig.guessedCities.push({
        round: gameConfig.currentRound,
        cityId: actualCity.id,
        cityName: actualCity.name,
        guessedCityId: guessedCity.id,
        guessedCityName: guessedCity.name,
        distance,
        points
      });
      
      // Show result screen
      showResultScreen(actualCity, guessedCity, distance, points);
    });
}

function calculateDistance(lat1, lon1, lat2, lon2) {
  // Haversine formula to calculate distance between two points
  const R = 6371; // Radius of the Earth in km
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a = 
    Math.sin(dLat/2) * Math.sin(dLat/2) +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * 
    Math.sin(dLon/2) * Math.sin(dLon/2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
  const distance = R * c; // Distance in km
  
  return distance;
}

function calculatePoints(distance) {
  // Inverse logarithmic scoring based on distance
  // Perfect score is 1000 points (if distance is 0)
  if (distance < 1) return 1000; // If almost perfect (<1km), give max score
  
  // As distance increases, score decreases logarithmically
  const points = Math.max(0, Math.round(1000 / Math.log10(distance + 10)));
  return points;
}

function showResultScreen(actualCity, guessedCity, distance, points) {
  document.getElementById('actual-city').textContent = `${actualCity.name}, ${actualCity.country}`;
  document.getElementById('guessed-city').textContent = `${guessedCity.name}, ${guessedCity.country}`;
  document.getElementById('distance').textContent = `${Math.round(distance)} km`;
  document.getElementById('points-earned').textContent = points;
  
  // Show both cities on map
  map.setView([
    (actualCity.latitude + guessedCity.latitude) / 2,
    (actualCity.longitude + guessedCity.longitude) / 2
  ], getZoomLevelForDistance(distance));
  
  // Add markers and line
  markers.forEach(marker => map.removeLayer(marker));
  markers = [];
  
  const actualMarker = L.marker([actualCity.latitude, actualCity.longitude], {
    icon: L.divIcon({
      className: 'actual-city-marker',
      html: '<div class="marker-icon actual"></div>',
      iconSize: [20, 20]
    })
  }).addTo(map);
  markers.push(actualMarker);
  
  const guessMarker = L.marker([guessedCity.latitude, guessedCity.longitude], {
    icon: L.divIcon({
      className: 'guessed-city-marker',
      html: '<div class="marker-icon guess"></div>',
      iconSize: [20, 20]
    })
  }).addTo(map);
  markers.push(guessMarker);
  
  // Add line between them
  const line = L.polyline([
    [actualCity.latitude, actualCity.longitude],
    [guessedCity.latitude, guessedCity.longitude]
  ], {
    color: 'red',
    dashArray: '5, 5',
    weight: 2
  }).addTo(map);
  markers.push(line); // Add to markers array for easy cleanup
  
  // Update score display
  document.getElementById('current-score').textContent = gameConfig.score;
  
  // Show result screen
  hideAllScreens();
  document.getElementById('result-screen').classList.remove('hidden');
  
  // Keep map visible in result screen
  document.getElementById('map-container').style.display = 'block';
}

function getZoomLevelForDistance(distance) {
  if (distance < 50) return 8;
  if (distance < 200) return 6;
  if (distance < 500) return 5;
  if (distance < 2000) return 4;
  return 3;
}

function nextRound() {
  gameConfig.currentRound++;
  
  if (gameConfig.currentRound > gameConfig.totalRounds) {
    showGameOverScreen();
  } else {
    // Update round display
    document.getElementById('current-round').textContent = gameConfig.currentRound;
    
    // Show game screen
    hideAllScreens();
    document.getElementById('game-screen').classList.remove('hidden');
    
    // Start next round
    startRound();
  }
}

function showGameOverScreen() {
  document.getElementById('final-score').textContent = gameConfig.score;
  
  // Generate guesses summary
  const summaryContainer = document.getElementById('guesses-summary');
  summaryContainer.innerHTML = '<h3>Your Guesses</h3>';
  
  const summaryTable = document.createElement('table');
  summaryTable.classList.add('guesses-table');
  
  // Add header row
  const headerRow = document.createElement('tr');
  headerRow.innerHTML = `
    <th>Round</th>
    <th>Actual City</th>
    <th>Your Guess</th>
    <th>Distance</th>
    <th>Points</th>
  `;
  summaryTable.appendChild(headerRow);
  
  // Add data rows
  gameConfig.guessedCities.forEach(guess => {
    const row = document.createElement('tr');
    row.innerHTML = `
      <td>${guess.round}</td>
      <td>${guess.cityName}</td>
      <td>${guess.guessedCityName}</td>
      <td>${Math.round(guess.distance)} km</td>
      <td>${guess.points}</td>
    `;
    summaryTable.appendChild(row);
  });
  
  summaryContainer.appendChild(summaryTable);
  
  // Show game over screen
  hideAllScreens();
  document.getElementById('game-over-screen').classList.remove('hidden');
}

function saveScore() {
  const scoreData = {
    username: gameConfig.username,
    score: gameConfig.score,
    gameMode: gameConfig.gameMode,
    rounds: gameConfig.totalRounds,
    guesses: gameConfig.guessedCities
  };
  
  fetch('/api/scores', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(scoreData)
  })
    .then(response => response.json())
    .then(result => {
      alert('Score saved successfully!');
      document.getElementById('save-score').disabled = true;
    })
    .catch(error => {
      alert('Failed to save score. Please try again.');
    });
}

function resetGame() {
  showStartScreen();
}

function loadCountriesForMultiselect() {
  fetch('/api/countries')
    .then(response => response.json())
    .then(countries => {
      const countrySelect = document.getElementById('country-select');
      countrySelect.innerHTML = '';
      
      countries.forEach(country => {
        const option = document.createElement('option');
        option.value = country.code;
        option.textContent = country.name;
        countrySelect.appendChild(option);
      });
    });
}

// Helper function to make API requests
async function apiRequest(endpoint, method = 'GET', data = null) {
  const options = {
    method,
    headers: {
      'Content-Type': 'application/json'
    }
  };
  
  if (data) {
    options.body = JSON.stringify(data);
  }
  
  const response = await fetch(`/api/${endpoint}`, options);
  return await response.json();
}
