const AUTH_KEY = "airguard_auth_v1";
const TOKEN_KEY = "airguard_token_v1";

const authView = document.getElementById("authView");
const appView = document.getElementById("appView");
const loginForm = document.getElementById("loginForm");
const emailInput = document.getElementById("emailInput");
const passwordInput = document.getElementById("passwordInput");
const loginError = document.getElementById("loginError");
const navbarLoginForm = document.getElementById("navbarLoginForm");
const navEmailInput = document.getElementById("navEmailInput");
const navPasswordInput = document.getElementById("navPasswordInput");
const navLoginStatus = document.getElementById("navLoginStatus");
const registerForm = document.getElementById("registerForm");
const regNameInput = document.getElementById("regNameInput");
const regEmailInput = document.getElementById("regEmailInput");
const regPasswordInput = document.getElementById("regPasswordInput");
const userEmailValue = document.getElementById("userEmailValue");
const userRoleValue = document.getElementById("userRoleValue");

const navButtons = Array.from(document.querySelectorAll("[data-nav]"));
const screens = Array.from(document.querySelectorAll("[data-screen]"));
const screenSubtitle = document.getElementById("screenSubtitle");
const openSettingsBtn = document.getElementById("openSettingsBtn");
const refreshBtn = document.getElementById("refreshBtn");
const locateMeBtn = document.getElementById("locateMeBtn");
const navLogoutBtn = document.getElementById("navLogoutBtn");
const autoRefreshBadge = document.getElementById("autoRefreshBadge");

const cityInput = document.getElementById("cityInput");
const areaInput = document.getElementById("areaInput");
const checkBtn = document.getElementById("checkBtn");
const chipButtons = Array.from(document.querySelectorAll("[data-city]"));
const recentSearches = document.getElementById("recentSearches");
const result = document.getElementById("result");

const aqiCategory = document.getElementById("aqiCategory");
const aqiValue = document.getElementById("aqiValue");
const locationLabel = document.getElementById("locationLabel");
const healthAdvice = document.getElementById("healthAdvice");
const meterFill = document.getElementById("meterFill");
const pm25 = document.getElementById("pm25");
const pm10 = document.getElementById("pm10");
const o3 = document.getElementById("o3");
const no2 = document.getElementById("no2");
const windValue = document.getElementById("windValue");
const humidityValue = document.getElementById("humidityValue");
const dominantValue = document.getElementById("dominantValue");
const freshnessValue = document.getElementById("freshnessValue");
const activeAlertsCount = document.getElementById("activeAlertsCount");
const forecastGrid = document.getElementById("forecastGrid");
const utilityStatus = document.getElementById("utilityStatus");
const simulateAlertBtn = document.getElementById("simulateAlertBtn");
const exportReportBtn = document.getElementById("exportReportBtn");
const clearAlertsBtn = document.getElementById("clearAlertsBtn");
const refreshMapBtn = document.getElementById("refreshMapBtn");
const issueAdvisoryBtn = document.getElementById("issueAdvisoryBtn");
const dispatchTeamBtn = document.getElementById("dispatchTeamBtn");
const flagIndustrialBtn = document.getElementById("flagIndustrialBtn");
const downloadMapBtn = document.getElementById("downloadMapBtn");
const mapActionStatus = document.getElementById("mapActionStatus");
const pauseFeedBtn = document.getElementById("pauseFeedBtn");
const resumeFeedBtn = document.getElementById("resumeFeedBtn");
const syncFeedBtn = document.getElementById("syncFeedBtn");
const archiveFeedBtn = document.getElementById("archiveFeedBtn");
const realtimeActionStatus = document.getElementById("realtimeActionStatus");
const uptimeValue = document.getElementById("uptimeValue");
const latencyValue = document.getElementById("latencyValue");
const queueValue = document.getElementById("queueValue");
const healthMatrix = document.getElementById("healthMatrix");
const incidentList = document.getElementById("incidentList");
const nationalAvgValue = document.getElementById("nationalAvgValue");
const severeZonesValue = document.getElementById("severeZonesValue");
const advisoryValue = document.getElementById("advisoryValue");
const lastIncidentValue = document.getElementById("lastIncidentValue");

const trendBars = document.getElementById("trendBars");
const trendTable = document.getElementById("trendTable");
const mapGrid = document.getElementById("mapGrid");
const realMap = document.getElementById("realMap");
const realtimeFeed = document.getElementById("realtimeFeed");
const liveStatus = document.getElementById("liveStatus");
const searchSummaryGrid = document.getElementById("searchSummaryGrid");
const stationMatches = document.getElementById("stationMatches");
const zoneSummaryGrid = document.getElementById("zoneSummaryGrid");
const hotspotFeed = document.getElementById("hotspotFeed");
const liveAlertStatus = document.getElementById("liveAlertStatus");
const activeIncidentFeed = document.getElementById("activeIncidentFeed");
const enableAlertsPopupBtn = document.getElementById("enableAlertsPopupBtn");

const alertToggle = document.getElementById("alertToggle");
const thresholdRange = document.getElementById("thresholdRange");
const thresholdValue = document.getElementById("thresholdValue");
const alertsList = document.getElementById("alertsList");

const appState = {
  isLoggedIn: false,
  token: "",
  userName: "Guest",
  currentScreen: "home",
  city: "Detecting Location...",
  area: "Waiting for permission",
  exactCoords: null,
  aqi: 0,
  recent: ["New Delhi - Central", "Mumbai - Andheri", "Pune - Shivaji Nagar"],
  alertsEnabled: true,
  threshold: 160,
  feedPaused: false,
  alerts: [],
  trend: [],
  forecast: [],
  mapSnapshot: [],
  lastAlertSignature: "",
  lastAlertPopupAt: 0
};

let mapInstance = null;
let mapLayerGroup = null;
let autoRefreshTimer = null;

function formatCategory(aqi) {
  if (aqi <= 50) return "Good";
  if (aqi <= 100) return "Moderate";
  if (aqi <= 150) return "Unhealthy for Sensitive Groups";
  if (aqi <= 200) return "Unhealthy";
  if (aqi <= 300) return "Very Unhealthy";
  return "Hazardous";
}


function ensureIdsForAllElements() {
  const tagCounters = {};
  const allElements = document.querySelectorAll("*");

  allElements.forEach((el) => {
    if (el.id) return;

    const tag = el.tagName.toLowerCase();
    tagCounters[tag] = (tagCounters[tag] || 0) + 1;
    el.id = `ag-auto-${tag}-${tagCounters[tag]}`;
  });
}

function categoryColor(category) {
  ensureIdsForAllElements();
  if (category === "Good") return "#16a34a";
  if (category === "Moderate") return "#d97706";
  if (category === "Unhealthy for Sensitive Groups") return "#ea580c";
  if (category === "Unhealthy") return "#dc2626";
  if (category === "Very Unhealthy") return "#7c3aed";
  return "#991b1b";
}

function categoryAdvice(category) {
  if (category === "Good") return "Air quality is healthy for routine outdoor activity and travel.";
  if (category === "Moderate") return "Air quality is acceptable. Sensitive groups should reduce prolonged outdoor exertion.";
  if (category === "Unhealthy for Sensitive Groups") return "Children, elderly and respiratory patients should wear masks outdoors.";
  if (category === "Unhealthy") return "Avoid outdoor physical activity and begin local mitigation response procedures.";
  if (category === "Very Unhealthy") return "Issue public warning. Limit outdoor operations and enforce industrial controls.";
  return "Emergency level pollution. Trigger high severity response protocols immediately.";
}

function severityFromAqi(aqi) {
  if (aqi >= 300) return "Critical";
  if (aqi >= 200) return "High";
  if (aqi >= 150) return "Elevated";
  if (aqi >= 100) return "Watch";
  return "Normal";
}

const DEFAULT_COORDS = { lat: 28.6139, lng: 77.2090 }; // Delhi default
const DEFAULT_CITY = "New Delhi";
const DEFAULT_AREA = "Central";

function isIndiaCountryCode(code) {
  return String(code || "").trim().toLowerCase() === "in";
}

function isLikelyInIndiaByCoords(lat, lng) {
  const latitude = Number(lat);
  const longitude = Number(lng);
  if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) return false;
  return latitude >= 6 && latitude <= 37.6 && longitude >= 68.1 && longitude <= 97.6;
}

function saveLocationCache(city, area, exactCoords, countryCode) {
  localStorage.setItem("airguard_loc_v1", JSON.stringify({
    city,
    area,
    exactCoords,
    countryCode: String(countryCode || "").toLowerCase(),
    timestamp: Date.now()
  }));
}

async function fetchGeocode(city) {
  try {
    const res = await fetch(`https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(city)}&count=1&language=en&format=json`);
    const data = await res.json();
    if (data.results && data.results.length > 0) {
      return { lat: data.results[0].latitude, lng: data.results[0].longitude, name: data.results[0].name };
    }
  } catch (err) {
    console.error("Geocoding failed", err);
  }
  return null;
}

async function fetchRealtimeAqi(lat, lng) {
  try {
    const res = await fetch(`https://air-quality-api.open-meteo.com/v1/air-quality?latitude=${lat}&longitude=${lng}&current=us_aqi,pm10,pm2_5,ozone,nitrogen_dioxide&hourly=us_aqi&timezone=auto`);
    const data = await res.json();
    if (data.current) {
       return data;
    }
  } catch (err) {
    console.error("Realtime AQI failed", err);
  }
  return null;
}

function extractPollutants(data) {
  if (!data || !data.current) return { pm25: '--', pm10: '--', o3: '--', no2: '--', dominant: 'N/A' };
  
  const p = {
    pm25: data.current.pm2_5 || 0,
    pm10: data.current.pm10 || 0,
    o3: data.current.ozone || 0,
    no2: data.current.nitrogen_dioxide || 0
  };
  
  let dominant = "PM2.5";
  let max = p.pm25;
  if (p.pm10 > max) { dominant = "PM10"; max = p.pm10; }
  if (p.o3 > max) { dominant = "O3"; max = p.o3; }
  if (p.no2 > max) { dominant = "NO2"; }

  return { ...p, dominant };
}

function weatherFromAqi(aqi) {
  return {
    wind: `${8 + (Math.round(aqi) % 18)} km/h`,
    humidity: `${45 + (Math.round(aqi) % 35)}%`
  };
}

function weatherFromAqi(aqi) {
  return {
    wind: `${8 + (aqi % 18)} km/h`,
    humidity: `${45 + (aqi % 35)}%`
  };
}

function agoTime(date) {
  const mins = Math.max(1, Math.round((Date.now() - date.getTime()) / 60000));
  if (mins < 60) return `${mins} min ago`;
  const hrs = Math.round(mins / 60);
  return `${hrs} hr ago`;
}

function toTitle(value) {
  return value.charAt(0).toUpperCase() + value.slice(1);
}

async function apiRequest(path, method = "GET", payload = null, withAuth = false) {
  const headers = { "Content-Type": "application/json" };
  if (withAuth && appState.token) {
    headers.Authorization = `Bearer ${appState.token}`;
  }

  const res = await fetch(path, {
    method,
    headers,
    body: payload ? JSON.stringify(payload) : null
  });

  const data = await res.json();
  if (!res.ok || !data.ok) {
    throw new Error(data.message || "Request failed");
  }

  return data;
}

function showAuth() {
  if (appView) {
    if (authView) authView.classList.remove("hidden");
    appView.classList.add("hidden");
    return;
  }

  if (authView) authView.classList.remove("hidden");
}

function showApp(email) {
  if (appView) {
    if (authView) authView.classList.add("hidden");
    appView.classList.remove("hidden");
  } else if (authView) {
    // Auth-only pages (login/register) should remain visible.
    authView.classList.remove("hidden");
  }

  if (userEmailValue) userEmailValue.textContent = email;
  if (userRoleValue) userRoleValue.textContent = appState.isLoggedIn ? "Role: Operations Admin" : "Role: Guest";
  if (navLoginStatus) {
    if (appState.isLoggedIn) {
      navLoginStatus.textContent = `Logged in as ${appState.userName} (${email})`;
    } else {
      navLoginStatus.textContent = "Not logged in. Only Home is available.";
    }
  }
}

function canOpenTab(target) {
  if (target === "home" || target === "login") return true;
  return appState.isLoggedIn;
}

function updateNavLockState() {
  navButtons.forEach((btn) => {
    const target = btn.dataset.nav;
    const locked = target && !canOpenTab(target);
    btn.classList.toggle("locked", Boolean(locked));
    btn.setAttribute("aria-disabled", locked ? "true" : "false");
  });
}

function switchScreen(target) {
  if (!canOpenTab(target)) {
    navLoginStatus.textContent = "Login required to access this tab.";
    target = "login";
  }

  appState.currentScreen = target;

  screens.forEach((screen) => {
    const active = screen.dataset.screen === target;
    screen.classList.toggle("hidden", !active);
  });

  navButtons.forEach((btn) => {
    btn.classList.toggle("active", btn.dataset.nav === target);
  });

  screenSubtitle.textContent = toTitle(target);

  if (target === "map") {
    setTimeout(() => {
      renderLeafletMap();
      if (mapInstance) mapInstance.invalidateSize();
    }, 10);
  }
}

function renderRecentSearches() {
  if (!recentSearches) return;
  recentSearches.innerHTML = "";
  appState.recent.slice(0, 6).forEach((entry) => {
    const li = document.createElement("li");
    li.textContent = entry;
    recentSearches.appendChild(li);
  });
}

function renderSearchInsights() {
  if (!searchSummaryGrid || !stationMatches) return;

  const category = formatCategory(appState.aqi);
  const severity = severityFromAqi(appState.aqi);
  const lastUpdate = new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });

  searchSummaryGrid.innerHTML = `
    <article class="settings-tile"><p>Current AQI</p><strong>${appState.aqi}</strong></article>
    <article class="settings-tile"><p>Category</p><strong style="color:${categoryColor(category)}">${category}</strong></article>
    <article class="settings-tile"><p>Severity</p><strong>${severity}</strong></article>
    <article class="settings-tile"><p>Last Update</p><strong>${lastUpdate}</strong></article>
  `;

  const matches = [
    { name: `${appState.city} - ${appState.area}`, aqi: appState.aqi },
    { name: `${appState.city} - Central`, aqi: Math.max(40, appState.aqi - 12) },
    { name: `${appState.city} - Industrial Zone`, aqi: Math.min(350, appState.aqi + 18) }
  ];

  stationMatches.innerHTML = matches
    .map((item) => {
      const itemCategory = formatCategory(item.aqi);
      return `
        <div class="alert-item">
          <strong>${item.name}</strong>
          <p style="margin:0;color:${categoryColor(itemCategory)};font-weight:700;">AQI ${item.aqi} - ${itemCategory}</p>
        </div>
      `;
    })
    .join("");
}

async function renderMapGrid() {
  if (!mapGrid) return;
  const citiesData = [
    { name: "Delhi", lat: 28.6139, lng: 77.209 },
    { name: "Mumbai", lat: 19.076, lng: 72.8777 },
    { name: "Pune", lat: 18.5204, lng: 73.8567 },
    { name: "Bengaluru", lat: 12.9716, lng: 77.5946 },
    { name: "Chennai", lat: 13.0827, lng: 80.2707 },
    { name: "Hyderabad", lat: 17.385, lng: 78.4867 },
    { name: "Kolkata", lat: 22.5726, lng: 88.3639 },
    { name: "Ahmedabad", lat: 23.0225, lng: 72.5714 }
  ];

  mapGrid.innerHTML = "Loading live data...";
  let html = "";
  const snapshot = [];
  for (const city of citiesData) {
    const data = await fetchRealtimeAqi(city.lat, city.lng);
    const aqi = data && data.current ? data.current.us_aqi : 0;
    const category = formatCategory(aqi);
    snapshot.push({ name: city.name, aqi, category, severity: severityFromAqi(aqi) });
    html += `
      <article class="city-card">
        <h4>${city.name}</h4>
        <p>${category}</p>
        <strong style="color:${categoryColor(category)}">${aqi}</strong>
      </article>
    `;
  }
  mapGrid.innerHTML = html;
  appState.mapSnapshot = snapshot;
  renderMapIntelligence();
}

function renderMapIntelligence() {
  if (!zoneSummaryGrid || !hotspotFeed) return;

  const snapshot = Array.isArray(appState.mapSnapshot) ? appState.mapSnapshot : [];
  const severeCount = snapshot.filter((item) => item.aqi >= 200).length;
  const elevatedCount = snapshot.filter((item) => item.aqi >= 150 && item.aqi < 200).length;
  const normalCount = snapshot.filter((item) => item.aqi < 150).length;
  const highest = snapshot.reduce((max, item) => (item.aqi > max.aqi ? item : max), { name: "--", aqi: 0, severity: "Normal" });

  zoneSummaryGrid.innerHTML = `
    <article class="settings-tile"><p>Severe Zones</p><strong>${severeCount}</strong></article>
    <article class="settings-tile"><p>Elevated Zones</p><strong>${elevatedCount}</strong></article>
    <article class="settings-tile"><p>Normal Zones</p><strong>${normalCount}</strong></article>
    <article class="settings-tile"><p>Top Hotspot</p><strong>${highest.name} (${highest.aqi})</strong></article>
  `;

  const topHotspots = snapshot
    .slice()
    .sort((a, b) => b.aqi - a.aqi)
    .slice(0, 4);

  if (topHotspots.length === 0) {
    hotspotFeed.innerHTML = "<div class='alert-item'><strong>No hotspot data</strong><p>Map data is loading.</p></div>";
    return;
  }

  hotspotFeed.innerHTML = topHotspots
    .map((item) => `
      <div class="alert-item">
        <strong>${item.name}</strong>
        <p style="margin:0;">${item.severity} priority - AQI ${item.aqi}</p>
      </div>
    `)
    .join("");
}

async function renderLeafletMap() {
  if (!window.L || !realMap) return;

  const cities = [
    { name: "Delhi", lat: 28.6139, lng: 77.209 },
    { name: "Mumbai", lat: 19.076, lng: 72.8777 },
    { name: "Pune", lat: 18.5204, lng: 73.8567 },
    { name: "Bengaluru", lat: 12.9716, lng: 77.5946 },
    { name: "Chennai", lat: 13.0827, lng: 80.2707 },
    { name: "Hyderabad", lat: 17.385, lng: 78.4867 }
  ];

  if (!mapInstance) {
    mapInstance = window.L.map(realMap).setView([22.5, 79], 5);
    window.L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
      attribution: "&copy; OpenStreetMap contributors"
    }).addTo(mapInstance);
    mapLayerGroup = window.L.layerGroup().addTo(mapInstance);
  }

  mapLayerGroup.clearLayers();

  for (const city of cities) {
    const data = await fetchRealtimeAqi(city.lat, city.lng);
    const aqi = data && data.current ? data.current.us_aqi : 0;
    const category = formatCategory(aqi);
    const color = categoryColor(category);

    const marker = window.L.circleMarker([city.lat, city.lng], {
      radius: 10,
      color,
      weight: 2,
      fillColor: color,
      fillOpacity: 0.55
    });

    marker.bindPopup(`<strong>${city.name}</strong><br/>AQI: ${aqi}<br/>${category}`);
    marker.addTo(mapLayerGroup);
  }
}

function renderTrend() {
  if (!trendBars || !trendTable) return;
  trendBars.innerHTML = "";
  trendTable.innerHTML = "";

  if (!appState.trend || appState.trend.length === 0) {
    trendBars.innerHTML = "<p class='soft' style='padding: 12px;'>Syncing historical trend...</p>";
    return;
  }

  appState.trend.forEach((value, index) => {
    const safeValue = value || 0;
    const showLabel = index % 2 === 0;
    const bar = document.createElement("div");
    bar.className = "trend-bar";
    bar.style.height = `${Math.max(18, Math.round((safeValue / 320) * 200))}px`;
    bar.innerHTML = showLabel ? `<span>${safeValue}</span>` : "";
    trendBars.appendChild(bar);

    const row = document.createElement("div");
    row.className = "log-row";
    const hoursAgo = appState.trend.length - index - 1;
    row.innerHTML = `
      <span>${hoursAgo === 0 ? "Now" : `-${hoursAgo} h`}</span>
      <strong>${safeValue}</strong>
    `;
    trendTable.appendChild(row);
  });
}

function buildTrendAndForecast(hourlyAqi, hourlyTimes, currentAqi) {
  const current = Number.isFinite(Number(currentAqi)) ? Math.round(Number(currentAqi)) : 0;
  const aqiSeries = Array.isArray(hourlyAqi) ? hourlyAqi : [];
  const timeSeries = Array.isArray(hourlyTimes) ? hourlyTimes : [];

  if (aqiSeries.length === 0 || timeSeries.length === 0) {
    return {
      trend: new Array(8).fill(current),
      forecast: new Array(8).fill(current)
    };
  }

  const nowMs = Date.now();
  let nearestIndex = 0;
  let nearestDelta = Number.POSITIVE_INFINITY;

  for (let i = 0; i < timeSeries.length; i += 1) {
    const parsed = new Date(timeSeries[i]).getTime();
    if (!Number.isFinite(parsed)) continue;
    const delta = Math.abs(parsed - nowMs);
    if (delta < nearestDelta) {
      nearestDelta = delta;
      nearestIndex = i;
    }
  }

  const trend = [];
  for (let i = 7; i >= 0; i -= 1) {
    const idx = Math.max(0, nearestIndex - i);
    const value = Number(aqiSeries[idx]);
    trend.push(Number.isFinite(value) ? Math.round(value) : current);
  }

  const forecast = [];
  for (let i = 0; i < 8; i += 1) {
    const idx = nearestIndex + (i * 3);
    const value = Number(aqiSeries[idx]);
    if (Number.isFinite(value)) {
      forecast.push(Math.round(value));
    } else {
      const seed = forecast.length > 0 ? forecast[forecast.length - 1] : current;
      forecast.push(seed);
    }
  }

  return { trend, forecast };
}

function renderForecast() {
  if (!forecastGrid) return;
  forecastGrid.innerHTML = "";

  if (!appState.forecast || appState.forecast.length === 0) {
    forecastGrid.innerHTML = "<p class='soft'>Waiting for forecast engine...</p>";
    return;
  }

  appState.forecast.forEach((value, index) => {
    const safeValue = value || 0;
    const slot = index === 0 ? "Now" : `+${index * 3}h`;
    const category = formatCategory(safeValue);

    const tile = document.createElement("article");
    tile.className = "forecast-tile";
    tile.innerHTML = `
      <p>${slot}</p>
      <strong style="color:${categoryColor(category)}">${safeValue}</strong>
      <span>${category}</span>
    `;
    forecastGrid.appendChild(tile);
  });
}

async function renderRealtimeFeed() {
  if (!realtimeFeed) return;
  const stations = [
    { name: "Delhi - RK Puram", lat: 28.56, lng: 77.17 },
    { name: "Mumbai - Bandra", lat: 19.05, lng: 72.84 },
    { name: "Pune - Shivaji Nagar", lat: 18.53, lng: 73.84 },
    { name: "Bengaluru - BTM", lat: 12.91, lng: 77.61 },
    { name: "Chennai - Alandur", lat: 13.00, lng: 80.20 }
  ];

  realtimeFeed.innerHTML = "Fetching real-time API feeds...";
  let html = "";
  for (const station of stations) {
    const data = await fetchRealtimeAqi(station.lat, station.lng);
    const value = data && data.current ? data.current.us_aqi : 0;
    const category = formatCategory(value);
    html += `
      <div class="log-row">
        <span>${station.name} - ${category}</span>
        <strong style="color:${categoryColor(category)}">${value}</strong>
      </div>
    `;
  }
  realtimeFeed.innerHTML = html;
  
  if (liveStatus) liveStatus.textContent = `Live feed synced from Open-Meteo ${new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" })}`;
}

function renderAlerts() {
  if (!alertsList) return;
  alertsList.innerHTML = "";

  if (appState.alerts.length === 0) {
    const empty = document.createElement("div");
    empty.className = "alert-item";
    empty.innerHTML = "<strong>No active alerts</strong><p>All monitored zones are within configured threshold.</p>";
    alertsList.appendChild(empty);
  } else {
    appState.alerts.slice(0, 6).forEach((entry) => {
      const sev = severityFromAqi(entry.aqi);
      const item = document.createElement("div");
      item.className = "alert-item";
      item.innerHTML = `
        <strong>${entry.city} AQI ${entry.aqi} (${sev})</strong>
        <p>${entry.message} (${agoTime(entry.timestamp)})</p>
      `;
      alertsList.appendChild(item);
    });
  }

  if (activeAlertsCount) activeAlertsCount.textContent = String(appState.alerts.length);
  renderLiveAlertCenter();
}

function renderLiveAlertCenter() {
  if (liveAlertStatus) {
    const notificationState = ("Notification" in window) ? Notification.permission : "unsupported";
    const statusText = notificationState === "granted"
      ? "Browser popups active."
      : notificationState === "denied"
        ? "Browser popup permission denied."
        : notificationState === "default"
          ? "Browser popup permission pending."
          : "Browser popup not supported on this browser.";
    liveAlertStatus.textContent = `${statusText} Active alerts: ${appState.alerts.length}.`;
  }

  if (!activeIncidentFeed) return;
  if (appState.alerts.length === 0) {
    activeIncidentFeed.innerHTML = "<div class='alert-item'><strong>No live incidents</strong><p>All zones are within configured threshold.</p></div>";
    return;
  }

  activeIncidentFeed.innerHTML = appState.alerts.slice(0, 4).map((entry) => {
    const sev = severityFromAqi(entry.aqi);
    return `
      <div class="alert-item">
        <strong>${entry.city} - ${sev}</strong>
        <p>AQI ${entry.aqi} at ${agoTime(entry.timestamp)}.</p>
      </div>
    `;
  }).join("");
}

async function requestAlertNotificationPermission() {
  if (!("Notification" in window)) return false;
  if (Notification.permission === "granted") return true;
  if (Notification.permission === "denied") return false;
  const permission = await Notification.requestPermission();
  return permission === "granted";
}

function showInAppAlertPopup(entry) {
  const popup = document.createElement("div");
  popup.className = "alert-popup";
  popup.innerHTML = `
    <strong>AirGuard Alert - ${entry.city}</strong>
    <p>${entry.message}</p>
    <span>AQI ${entry.aqi} • ${formatCategory(entry.aqi)}</span>
  `;
  document.body.appendChild(popup);
  window.setTimeout(() => popup.classList.add("show"), 20);
  window.setTimeout(() => {
    popup.classList.remove("show");
    window.setTimeout(() => popup.remove(), 220);
  }, 5200);
}

function maybeSendBrowserNotification(entry) {
  if (!("Notification" in window)) return;
  if (Notification.permission !== "granted") return;
  new Notification(`AirGuard Alert - ${entry.city}`, {
    body: `AQI ${entry.aqi}: ${entry.message}`,
    tag: `airguard-${entry.city}`
  });
}

function triggerAlertPopup(entry, source = "auto") {
  const signature = `${entry.city}|${entry.aqi}|${entry.message}`;
  const now = Date.now();
  if (source === "auto" && appState.lastAlertSignature === signature && now - appState.lastAlertPopupAt < 20000) {
    return;
  }
  appState.lastAlertSignature = signature;
  appState.lastAlertPopupAt = now;
  showInAppAlertPopup(entry);
  maybeSendBrowserNotification(entry);
}

function renderOperationsRail() {
  const uptime = (98.2 + ((appState.aqi % 12) / 10)).toFixed(1);
  const latency = 120 + (appState.aqi % 90);
  const queue = Math.max(5, appState.alerts.length * 4 + (appState.aqi % 9));

  uptimeValue.textContent = `${uptime}%`;
  latencyValue.textContent = `${latency} ms`;
  queueValue.textContent = String(queue);

  const healthItems = [
    { label: "Ingestion Pipeline", status: appState.aqi > 220 ? "Degraded" : "Healthy" },
    { label: "Notification Engine", status: appState.alerts.length > 5 ? "Backlog" : "Healthy" },
    { label: "Map Service", status: "Healthy" },
    { label: "Analytics Worker", status: appState.aqi > 280 ? "Degraded" : "Healthy" }
  ];

  healthMatrix.innerHTML = "";
  healthItems.forEach((item) => {
    const row = document.createElement("div");
    const isHealthy = item.status === "Healthy";
    row.className = `health-chip ${isHealthy ? "ok" : "warn"}`;
    row.innerHTML = `<p>${item.label}</p><span>${item.status}</span>`;
    healthMatrix.appendChild(row);
  });

  const incidents = [
    {
      title: `${appState.city} threshold watch`,
      detail: `AQI ${appState.aqi} at ${appState.area}`,
      severity: appState.aqi > 200 ? "high" : appState.aqi > 140 ? "medium" : "low"
    },
    ...appState.alerts.slice(0, 3).map((entry) => ({
      title: `${entry.city} escalation`,
      detail: `${entry.message}`,
      severity: entry.aqi > 200 ? "high" : "medium"
    }))
  ];

  incidentList.innerHTML = "";
  incidents.forEach((incident) => {
    const box = document.createElement("article");
    box.className = `incident-item ${incident.severity}`;
    box.innerHTML = `<strong>${incident.title}</strong><p>${incident.detail}</p><span>${incident.severity.toUpperCase()} PRIORITY</span>`;
    incidentList.appendChild(box);
  });
}

function renderKpiStrip() {
  const trendSafe = Array.isArray(appState.trend) && appState.trend.length > 0 ? appState.trend : [appState.aqi || 0];
  const trendAvg = trendSafe.reduce((a, b) => a + b, 0) / trendSafe.length;
  const nationalAvg = Math.max(45, Math.round((appState.aqi + trendAvg) / 2));
  const severeZones = Math.max(0, Math.round((appState.aqi - 150) / 35));
  const advisory = appState.aqi > 220 ? "RED" : appState.aqi > 150 ? "ORANGE" : appState.aqi > 100 ? "YELLOW" : "GREEN";
  const latestIncident = appState.alerts[0];

  nationalAvgValue.textContent = String(nationalAvg);
  severeZonesValue.textContent = String(severeZones);
  advisoryValue.textContent = advisory;
  lastIncidentValue.textContent = latestIncident ? agoTime(latestIncident.timestamp) : "No incidents";
}

function startAutoRefresh() {
  if (autoRefreshTimer) return;

  autoRefreshBadge.textContent = "Live auto-refresh: ON";
  autoRefreshTimer = setInterval(() => {
    if (appState.feedPaused) {
      autoRefreshBadge.textContent = "Live auto-refresh: PAUSED";
      return;
    }
    autoRefreshBadge.textContent = "Live auto-refresh: ON";
    maybeTriggerAlert();
    renderDashboard();
  }, 20000);
}

async function renderDashboard() {
  if (!document.getElementById("nationalAvgValue")) return;

  let lat = DEFAULT_COORDS.lat;
  let lng = DEFAULT_COORDS.lng;

  if (appState.exactCoords) {
    lat = appState.exactCoords.lat;
    lng = appState.exactCoords.lng;
  } else {
    const geoResult = !appState.exactCoords ? await fetchGeocode(appState.city === "Detecting Location..." ? "New Delhi" : appState.city) : null;
    if (geoResult && !appState.exactCoords) {
      lat = geoResult.lat;
      lng = geoResult.lng;
      appState.city = geoResult.name;
    }
  }

  const realtimeData = await fetchRealtimeAqi(lat, lng);
  const aqiVal = realtimeData && realtimeData.current ? realtimeData.current.us_aqi : appState.aqi;
  appState.aqi = aqiVal;

  const trendForecast = buildTrendAndForecast(
    realtimeData?.hourly?.us_aqi,
    realtimeData?.hourly?.time,
    appState.aqi
  );
  appState.trend = trendForecast.trend;
  appState.forecast = trendForecast.forecast;

  const category = formatCategory(appState.aqi);
  const pollutants = extractPollutants(realtimeData);
  const weather = weatherFromAqi(appState.aqi);

  aqiCategory.textContent = category;
  aqiCategory.style.backgroundColor = categoryColor(category);
  aqiValue.textContent = `AQI ${appState.aqi}`;
  locationLabel.textContent = `${appState.city}, ${appState.area}`;
  healthAdvice.textContent = categoryAdvice(category);

  if (meterFill) meterFill.style.width = `${Math.min(100, Math.round((appState.aqi / 320) * 100))}%`;

  if (pm25) pm25.textContent = String(pollutants.pm25);
  if (pm10) pm10.textContent = String(pollutants.pm10);
  if (o3) o3.textContent = String(pollutants.o3);
  if (no2) no2.textContent = String(pollutants.no2);

  if (windValue) windValue.textContent = weather.wind;
  if (humidityValue) humidityValue.textContent = weather.humidity;
  if (dominantValue) dominantValue.textContent = pollutants.dominant;
  if (freshnessValue) freshnessValue.textContent = `Live API sync ${new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}`;

  if (result) result.textContent = `${appState.city}: AQI ${appState.aqi} (${category})`;

  if (document.getElementById("recentSearches")) renderRecentSearches();
  
  renderTrend();
  renderForecast();
  renderAlerts();
  renderOperationsRail();
  renderKpiStrip();
  renderSearchInsights();
  renderMapIntelligence();
}

function exportReport() {
  const lines = [
    "AirGuard AQI Report",
    `Location: ${appState.city}, ${appState.area}`,
    `AQI: ${appState.aqi}`,
    `Category: ${formatCategory(appState.aqi)}`,
    `Threshold: ${appState.threshold}`,
    `Alerts Active: ${appState.alerts.length}`,
    `Generated: ${new Date().toISOString()}`
  ];

  const blob = new Blob([lines.join("\n")], { type: "text/plain;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `airguard-report-${Date.now()}.txt`;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

async function runSearch(cityValue, areaValue) {
  const city = cityValue.trim();
  const area = areaValue.trim() || "Central";

  if (!city) {
    if (result) result.textContent = "Please enter a city name first.";
    return;
  }

  if (result) result.textContent = "Locating city and syncing API...";

  appState.city = city;
  appState.area = area;
  appState.exactCoords = null; // Clear so it geocodes the new city name
  
  await renderDashboard();

  appState.recent.unshift(`${city} - ${area}`);
  appState.recent = appState.recent.filter((v, i, arr) => arr.indexOf(v) === i).slice(0, 10);

  maybeTriggerAlert();
  renderSearchInsights();
  
  if (appState.currentScreen === "search" && document.getElementById("nationalAvgValue") === null) {
      // In search page (not dashboard page)
      if (result) result.textContent = `${appState.city} Current AQI: ${appState.aqi} (${formatCategory(appState.aqi)})`;
      renderRecentSearches();
  } else if (appState.currentScreen === "search") {
      // if on monolithic setup, switch screen
      switchScreen("home");
  }
}

function maybeTriggerAlert() {
  if (!appState.alertsEnabled) return;
  if (appState.aqi < appState.threshold) return;

  const entry = {
    city: appState.city,
    aqi: appState.aqi,
    message: `Threshold breach detected in ${appState.area}. Public advisory recommended.`,
    timestamp: new Date()
  };

  appState.alerts.unshift(entry);

  appState.alerts = appState.alerts.slice(0, 10);
  triggerAlertPopup(entry, "auto");
}

function setAuthState(auth) {
  appState.isLoggedIn = Boolean(auth && auth.token);
  appState.token = auth?.token || "";
  appState.userName = auth?.user?.name || "Guest";

  if (appState.isLoggedIn) {
    localStorage.setItem(AUTH_KEY, auth.user.email);
    localStorage.setItem(TOKEN_KEY, auth.token);
    showApp(auth.user.email);
  } else {
    localStorage.removeItem(AUTH_KEY);
    localStorage.removeItem(TOKEN_KEY);
    showApp("guest@airguard.in");
  }

  updateNavLockState();
}

function bindEvents() {
  if (loginForm) {
    loginForm.addEventListener("submit", async (event) => {
      event.preventDefault();
      const email = emailInput.value.trim().toLowerCase();
      const password = passwordInput.value;

      try {
        const auth = await apiRequest("/api/login", "POST", { email, password });
        setAuthState(auth);
        loginError.classList.add("hidden");
        loginError.textContent = "";
        renderDashboard();
        switchScreen("home");
      } catch (err) {
        loginError.textContent = err.message;
        loginError.classList.remove("hidden");
      }
    });
  }

  if (navbarLoginForm) {
    navbarLoginForm.addEventListener("submit", async (event) => {
      event.preventDefault();
      const email = navEmailInput.value.trim().toLowerCase();
      const password = navPasswordInput.value;

      try {
        const auth = await apiRequest("/api/login", "POST", { email, password });
        setAuthState(auth);
        renderDashboard();
        navLoginStatus.textContent = `Login successful for ${auth.user.name}`;
      } catch (err) {
        navLoginStatus.textContent = err.message;
      }
    });
  }

  navButtons.forEach((btn) => {
    btn.addEventListener("click", () => {
      const target = btn.dataset.nav;
      if (!target) return;
      switchScreen(target);
    });
  });

  if (openSettingsBtn) {
    openSettingsBtn.addEventListener("click", () => switchScreen("login"));
  }

  if (refreshBtn) {
    refreshBtn.addEventListener("click", () => {
      const seed = Date.now() % 37;
      appState.aqi = ((appState.aqi + seed) % 320) + 1;
      appState.trend = appState.trend.slice(1).concat(appState.aqi);
      maybeTriggerAlert();
      renderDashboard();
    });
  }

  if (locateMeBtn) {
    locateMeBtn.addEventListener("click", async () => {
      await detectAndApplyCurrentLocation({ showAlerts: true, updateLocateButton: true });
    });
  }

  if (checkBtn && cityInput && areaInput) {
    checkBtn.addEventListener("click", () => {
      runSearch(cityInput.value, areaInput.value);
    });
  }

  if (cityInput && areaInput) {
    cityInput.addEventListener("keydown", (event) => {
      if (event.key === "Enter") {
        runSearch(cityInput.value, areaInput.value);
      }
    });
  }

  chipButtons.forEach((btn) => {
    btn.addEventListener("click", () => {
      const city = btn.dataset.city || "New Delhi";
      cityInput.value = city;
      runSearch(city, areaInput.value || "Central");
    });
  });

  if (alertToggle) {
    alertToggle.addEventListener("click", () => {
      appState.alertsEnabled = !appState.alertsEnabled;
      alertToggle.classList.toggle("off", !appState.alertsEnabled);
      alertToggle.setAttribute("aria-pressed", String(appState.alertsEnabled));
    });
  }

  if (thresholdRange && thresholdValue) {
    thresholdRange.addEventListener("input", () => {
      appState.threshold = Number(thresholdRange.value);
      thresholdValue.textContent = String(appState.threshold);
    });
  }

  if (simulateAlertBtn) {
    simulateAlertBtn.addEventListener("click", () => {
      const entry = {
        city: appState.city,
        aqi: appState.aqi,
        message: `Manual simulation triggered for ${appState.area}.`,
        timestamp: new Date()
      };
      appState.alerts.unshift(entry);
      appState.alerts = appState.alerts.slice(0, 10);
      triggerAlertPopup(entry, "manual");
      renderAlerts();
      if (utilityStatus) utilityStatus.textContent = "Simulated alert added.";
    });
  }

  if (clearAlertsBtn) {
    clearAlertsBtn.addEventListener("click", () => {
      appState.alerts = [];
      renderAlerts();
      if (utilityStatus) utilityStatus.textContent = "Alert timeline cleared.";
    });
  }

  if (exportReportBtn) {
    exportReportBtn.addEventListener("click", () => {
      exportReport();
      if (utilityStatus) utilityStatus.textContent = "Report exported successfully.";
    });
  }

  if (refreshMapBtn) {
    refreshMapBtn.addEventListener("click", () => {
      renderMapGrid();
      renderLeafletMap();
      if (utilityStatus) utilityStatus.textContent = "Map and city AQI data refreshed.";
    });
  }

  if (issueAdvisoryBtn) {
    issueAdvisoryBtn.addEventListener("click", () => {
      mapActionStatus.textContent = "Public advisory issued to selected high-risk zones.";
    });
  }

  if (dispatchTeamBtn) {
    dispatchTeamBtn.addEventListener("click", () => {
      mapActionStatus.textContent = "Response teams dispatched to hotspot clusters.";
    });
  }

  if (flagIndustrialBtn) {
    flagIndustrialBtn.addEventListener("click", () => {
      mapActionStatus.textContent = "Industrial compliance checks flagged for review.";
    });
  }

  if (downloadMapBtn) {
    downloadMapBtn.addEventListener("click", () => {
      exportReport();
      mapActionStatus.textContent = "Zone snapshot exported.";
    });
  }

  if (pauseFeedBtn) {
    pauseFeedBtn.addEventListener("click", () => {
      appState.feedPaused = true;
      realtimeActionStatus.textContent = "Realtime feed paused.";
      autoRefreshBadge.textContent = "Live auto-refresh: PAUSED";
    });
  }

  if (resumeFeedBtn) {
    resumeFeedBtn.addEventListener("click", () => {
      appState.feedPaused = false;
      realtimeActionStatus.textContent = "Realtime feed resumed.";
      autoRefreshBadge.textContent = "Live auto-refresh: ON";
    });
  }

  if (syncFeedBtn) {
    syncFeedBtn.addEventListener("click", () => {
      renderRealtimeFeed();
      realtimeActionStatus.textContent = "Station feed synchronized.";
    });
  }

  if (archiveFeedBtn) {
    archiveFeedBtn.addEventListener("click", () => {
      exportReport();
      realtimeActionStatus.textContent = "Realtime snapshot archived.";
    });
  }

  if (navLogoutBtn) {
    navLogoutBtn.addEventListener("click", async () => {
      try {
        await apiRequest("/api/logout", "POST", {}, true);
      } catch {
        // Ignore logout API failures and clear local auth state anyway.
      }
      setAuthState(null);
      if (navLoginStatus) navLoginStatus.textContent = "Logged out.";
      window.location.href = "/login.html"; // Hard redirect instead of switchScreen
    });
  }

  if (registerForm) {
    registerForm.addEventListener("submit", async (e) => {
      e.preventDefault();
      const name = regNameInput.value.trim();
      const email = regEmailInput.value.trim();
      const password = regPasswordInput.value;
      const btn = document.getElementById("registerBtn");

      if (!btn) return;

      try {
        btn.textContent = "Provisioning...";
        btn.disabled = true;
        await apiRequest("/api/register", "POST", { name, email, password }, true);
        alert(`Admin provisioned successfully for ${email}`);
        registerForm.reset();
      } catch (err) {
        alert("Provisioning failed: " + err.message);
      } finally {
        btn.textContent = "Create Account";
        btn.disabled = false;
      }
    });
  }
}

async function init() {
  bindEvents();
  if (thresholdValue) thresholdValue.textContent = String(appState.threshold);
  if (thresholdRange) thresholdRange.value = String(appState.threshold);
  if (alertToggle) alertToggle.classList.toggle("off", !appState.alertsEnabled);

  const currentPath = window.location.pathname;
  const isAuthPage = currentPath === "/login.html" || currentPath === "/register.html";
  const isPublicDashboard = currentPath === "/" || currentPath === "/dashboard.html";

  const savedToken = localStorage.getItem(TOKEN_KEY);
  if (savedToken) {
    appState.token = savedToken;
    try {
      // In a real multi-page environment this API me check might be synchronous before mounting, but acceptable async here
      const me = await apiRequest("/api/me", "GET", null, true);
      setAuthState({ token: savedToken, user: me.user });
    } catch {
      setAuthState(null);
      if (!isAuthPage && !isPublicDashboard) {
         window.location.href = "/register.html";
      }
    }
  } else {
    setAuthState(null);
    if (!isAuthPage && !isPublicDashboard) {
       window.location.href = "/register.html";
    }
  }

  // Determine current screen from pathname instead of defaulting to "home"
  const path = currentPath;
  if (path.includes("search")) appState.currentScreen = "search";
  else if (path.includes("map")) appState.currentScreen = "map";
  else if (path.includes("alerts")) appState.currentScreen = "alerts";
  else if (path.includes("realtime")) appState.currentScreen = "realtime";
  else if (path.includes("settings")) appState.currentScreen = "login";
  else appState.currentScreen = "home";

  if (document.getElementById("nationalAvgValue")) {
    requestInitialLocation();
  } else {
    startAutoRefresh();
  }
}

async function detectAndApplyCurrentLocation(options = {}) {
  const { showAlerts = false, updateLocateButton = false } = options;

  if (!navigator.geolocation) {
    if (showAlerts) {
      alert("Geolocation is not supported by your browser.");
    }
    return false;
  }

  if (locationLabel) locationLabel.textContent = "Detecting location...";
  if (updateLocateButton && locateMeBtn) locateMeBtn.textContent = "Locating...";

  return new Promise((resolve) => {
    navigator.geolocation.getCurrentPosition(async (position) => {
      const lat = position.coords.latitude;
      const lng = position.coords.longitude;

      if (!isLikelyInIndiaByCoords(lat, lng)) {
        appState.city = DEFAULT_CITY;
        appState.area = DEFAULT_AREA;
        appState.exactCoords = null;
        saveLocationCache(appState.city, appState.area, null, "in");
        if (result) result.textContent = "Detected coordinates are outside India. Switched to India default.";
        await renderDashboard();
        if (updateLocateButton && locateMeBtn) locateMeBtn.textContent = "Locate Me";
        resolve(true);
        return;
      }

      try {
        const res = await fetch(`https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}`);
        const data = await res.json();
        const countryCode = String(data?.address?.country_code || "").toLowerCase();
        const useIndiaLabel = isIndiaCountryCode(countryCode);

        const city = useIndiaLabel
          ? data.address.city || data.address.state_district || data.address.county || "Current Location"
          : "Current India Location";
        const area = useIndiaLabel
          ? data.address.suburb || data.address.neighbourhood || data.address.town || data.address.village || "Local"
          : "Detected by GPS";

        appState.city = city;
        appState.area = area;
        appState.exactCoords = { lat, lng };
        saveLocationCache(appState.city, appState.area, appState.exactCoords, useIndiaLabel ? countryCode : "in");

        if (result) result.textContent = `Location detected: ${city}`;
      } catch (e) {
        appState.city = "Current India Location";
        appState.area = "Detected by GPS";
        appState.exactCoords = { lat, lng };
        saveLocationCache(appState.city, appState.area, appState.exactCoords, "in");
      }

      await renderDashboard();
      if (updateLocateButton && locateMeBtn) locateMeBtn.textContent = "Locate Me";
      resolve(true);
    }, (err) => {
      if (showAlerts) {
        alert("Unable to retrieve location. Make sure permissions are enabled. Error: " + err.message);
      }
      if (updateLocateButton && locateMeBtn) locateMeBtn.textContent = "Locate Me";
      if (locationLabel) locationLabel.textContent = `${appState.city}, ${appState.area}`;
      resolve(false);
    }, { timeout: 8000, maximumAge: 60000 });
  });
}

async function requestInitialLocation() {
  const cachedLoc = localStorage.getItem("airguard_loc_v1");
  if (cachedLoc) {
    try {
      const parsed = JSON.parse(cachedLoc);
      const isRecent = typeof parsed.timestamp === "number" && Date.now() - parsed.timestamp < 12 * 60 * 60 * 1000;
      const isIndia = isIndiaCountryCode(parsed.countryCode);
      const hasIndiaCoords = parsed.exactCoords && isLikelyInIndiaByCoords(parsed.exactCoords.lat, parsed.exactCoords.lng);
      if (isRecent && (isIndia || hasIndiaCoords) && parsed.city && parsed.area) {
        appState.city = parsed.city;
        appState.area = parsed.area;
        appState.exactCoords = parsed.exactCoords || null;
        renderDashboard().then(() => startAutoRefresh());
        return;
      }
    } catch (e) {}
  }

  appState.city = DEFAULT_CITY;
  appState.area = DEFAULT_AREA;
  appState.exactCoords = null;
  saveLocationCache(appState.city, appState.area, null, "in");

  if (locationLabel) locationLabel.textContent = `${DEFAULT_CITY}, ${DEFAULT_AREA}`;
  if (result) result.textContent = "Using default city. You can still search any location.";

  await renderDashboard();
  startAutoRefresh();

  // Trigger the browser location permission prompt automatically on first load.
  await detectAndApplyCurrentLocation({ showAlerts: false, updateLocateButton: false });
}

init();
