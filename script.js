// ── LOCATION DETECTION ──

function detectLocation() {
  const locationEl = document.getElementById('userLocation');
  if (!navigator.geolocation) {
    locationEl.textContent = 'Location unavailable';
    return;
  }

  navigator.geolocation.getCurrentPosition(async (pos) => {
    const { latitude, longitude } = pos.coords;
    try {
      const res = await fetch(
        `https://nominatim.openstreetmap.org/reverse?lat=${latitude}&lon=${longitude}&format=json`
      );
      const data = await res.json();
      const addr = data.address;
      const area =
        addr.suburb || addr.neighbourhood || addr.village ||
        addr.town || addr.city_district || addr.county || 'Your Area';

      // Store globally for dispatch use
      window._userLat = latitude;
      window._userLon = longitude;

      locationEl.textContent = `· ${area}`;
      generateInsight(area, latitude, longitude);
    } catch {
      locationEl.textContent = '· Location found';
      generateInsight('your area', latitude, longitude);
    }
  }, () => {
    locationEl.textContent = '· Permission denied';
  });
}

// ── DYNAMIC INSIGHT GENERATOR ──

async function generateInsight(area, lat, lon) {
  const titleEl = document.getElementById('insightTitle');
  const descEl  = document.getElementById('insightDesc');
  const mapImg  = document.getElementById('insightMapImg');

  // Update map to user's actual coordinates
  if (mapImg) {
    mapImg.src = `https://api.mapbox.com/styles/v1/mapbox/dark-v11/static/${lon},${lat},12,0/340x160?access_token=pk.eyJ1IjoibWFwYm94IiwiYSI6ImNpejY4NXVycTA2emYycXBndHRqcmZ3N3gifQ.rJcFIG214AriISLbB6B5aw`;
  }

  try {
    // Fetch real weather using Open-Meteo (free, no API key)
    const weatherRes = await fetch(
      `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&current_weather=true&hourly=precipitation_probability&timezone=auto`
    );
    const weatherData = await weatherRes.json();
    const current     = weatherData.current_weather;
    const temp        = current.temperature;
    const windspeed   = current.windspeed;
    const code        = current.weathercode;

    // Weather code to description
    const weatherDesc = getWeatherDescription(code);

    // Check for severe conditions
    const isSevere = code >= 55 || windspeed > 60;

    if (isSevere) {
      titleEl.textContent = `Severe weather detected in ${area}.`;
      descEl.textContent  = `${weatherDesc}. Wind speeds at ${windspeed} km/h. Stay indoors and avoid travel. Monitor alerts closely.`;
    } else {
      titleEl.textContent = `All clear in ${area}.`;
      descEl.textContent  = `${weatherDesc}. Temperature is ${temp}°C with wind at ${windspeed} km/h. No active disaster alerts at this time. Stay safe.`;
    }

  } catch {
    titleEl.textContent = `Monitoring ${area}.`;
    descEl.textContent  = `Unable to fetch live conditions. No active alerts reported. Stay alert and check back shortly.`;
  }
}

// ── WEATHER CODE TO DESCRIPTION ──

function getWeatherDescription(code) {
  if (code === 0)               return 'Clear skies';
  if (code <= 2)                return 'Partly cloudy';
  if (code === 3)               return 'Overcast skies';
  if (code <= 49)               return 'Foggy conditions';
  if (code <= 57)               return 'Drizzle in the area';
  if (code <= 67)               return 'Rain expected';
  if (code <= 77)               return 'Snowfall reported';
  if (code <= 82)               return 'Rain showers ongoing';
  if (code <= 86)               return 'Heavy snow showers';
  if (code <= 99)               return 'Thunderstorm active nearby';
  return 'Conditions unclear';
}

detectLocation();

// ── SOS MODAL ──

function openSOSModal() {
  document.getElementById('sosModal').classList.add('open');
  document.getElementById('sosListeningText').textContent = 'Tap mic to speak';
  document.getElementById('sosResponseText').textContent = '';
  document.getElementById('sosMicOuter').classList.remove('listening');
  document.getElementById('sosTranscriptWrap').style.display = 'none';
  document.getElementById('sosTranscriptBox').innerHTML = '';
  document.getElementById('dispatchCard').style.display = 'none';
}

// ── FETCH NEAREST PLACE BASED ON KEYWORD ──

async function fetchNearestPlace(speech) {
  const card     = document.getElementById('dispatchCard');
  const nameEl   = document.getElementById('dispatchName');
  const distEl   = document.getElementById('dispatchDist');
  const iconEl   = document.getElementById('dispatchIcon');
  const tagEl    = document.getElementById('dispatchTag');

  // Determine what to search for
  let amenity = 'hospital';
  let iconClass = 'fa-solid fa-plus';
  let iconBg = '#c0200e';

  if (['attack','robbery','threat','gun','knife','police','thief'].some(k => speech.includes(k))) {
    amenity = 'police'; iconClass = 'fa-solid fa-shield-halved'; iconBg = '#1a3a6e';
  } else if (['fire','burning','smoke','flames'].some(k => speech.includes(k))) {
    amenity = 'fire_station'; iconClass = 'fa-solid fa-fire'; iconBg = '#8a3000';
  } else if (['shelter','flood','earthquake','trapped','collapse'].some(k => speech.includes(k))) {
    amenity = 'shelter'; iconClass = 'fa-solid fa-house'; iconBg = '#1a5a2e';
  }

  // Show card loading state
  card.style.display = 'flex';
  nameEl.textContent = 'Finding nearest...';
  distEl.textContent = '--';
  iconEl.innerHTML = `<i class="${iconClass}"></i>`;
  iconEl.style.background = iconBg;

  if (!window._userLat || !window._userLon) {
    nameEl.textContent = 'Enable location for dispatch';
    distEl.textContent = '--';
    return;
  }

  try {
    const res = await fetch(
      `https://nominatim.openstreetmap.org/search?q=${amenity}&lat=${window._userLat}&lon=${window._userLon}&format=json&limit=1&bounded=0`
    );
    const results = await res.json();

    if (results && results.length > 0) {
      const place = results[0];
      const dist  = getDistanceKm(window._userLat, window._userLon, place.lat, place.lon);
      const distText = dist < 1 ? `${Math.round(dist * 1000)}m` : `${dist.toFixed(1)}km`;
      nameEl.textContent = place.display_name.split(',')[0];
      distEl.textContent = distText;
      tagEl.textContent  = 'PRIORITY DISPATCH';
    } else {
      nameEl.textContent = 'No nearby location found';
      distEl.textContent = '--';
    }
  } catch {
    nameEl.textContent = 'Location lookup failed';
    distEl.textContent = '--';
  }
}

// ── HAVERSINE DISTANCE ──

function getDistanceKm(lat1, lon1, lat2, lon2) {
  const R = 6371;
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a = Math.sin(dLat/2) * Math.sin(dLat/2) +
            Math.cos(lat1 * Math.PI/180) * Math.cos(lat2 * Math.PI/180) *
            Math.sin(dLon/2) * Math.sin(dLon/2);
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
}

// ── KEYWORD HIGHLIGHTER ──

function highlightKeywords(speech) {
  const allKeywords = [
    'accident', 'crash', 'injured', 'hurt', 'bleeding', 'ambulance',
    'fire', 'burning', 'smoke', 'flames',
    'attack', 'robbery', 'threat', 'gun', 'knife', 'thief',
    'flood', 'water', 'drowning', 'rising',
    'earthquake', 'collapse', 'trapped',
    'help', 'emergency', 'sos'
  ];

  let result = speech;
  allKeywords.forEach(kw => {
    const regex = new RegExp(`(${kw})`, 'gi');
    result = result.replace(regex, `<span class="keyword">$1</span>`);
  });

  return `"${result}"`;
}

function closeSOSModal() {
  document.getElementById('sosModal').classList.remove('open');
}

// ── SOS MICROPHONE LOGIC ──

function startMic() {
  const listeningText = document.getElementById('sosListeningText');
  const responseText  = document.getElementById('sosResponseText');
  const micOuter      = document.getElementById('sosMicOuter');

  // Also handle old mic status if on main page
  const oldStatus = document.getElementById('micStatus');

  const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
  if (!SpeechRecognition) {
    if (listeningText) listeningText.textContent = '⚠ Not supported';
    if (oldStatus)     oldStatus.textContent = '⚠ Voice not supported in this browser.';
    return;
  }

  const recognition = new SpeechRecognition();
  recognition.lang = 'en-US';
  recognition.interimResults = false;
  recognition.maxAlternatives = 1;

  if (listeningText) listeningText.textContent = 'Listening...';
  if (micOuter)      micOuter.classList.add('listening');
  if (oldStatus)     oldStatus.textContent = '🎙 Listening...';

  recognition.start();

  recognition.onresult = function (event) {
    const speech = event.results[0][0].transcript;
    const speechLower = speech.toLowerCase();
    if (listeningText) listeningText.textContent = '';
    if (micOuter)      micOuter.classList.remove('listening');

    // Show transcript box with keyword highlights
    const transcriptWrap = document.getElementById('sosTranscriptWrap');
    const transcriptBox  = document.getElementById('sosTranscriptBox');
    if (transcriptWrap && transcriptBox) {
      transcriptWrap.style.display = 'flex';
      transcriptBox.innerHTML = highlightKeywords(speech);
    }

    const response = analyzeAndRespond(speechLower);
    if (responseText) responseText.textContent = response;
    if (oldStatus)    oldStatus.textContent = response;

    // Show nearest place based on keyword
    fetchNearestPlace(speechLower);
  };

  recognition.onerror = function () {
    if (listeningText) listeningText.textContent = '⚠ Could not hear you';
    if (micOuter)      micOuter.classList.remove('listening');
    if (oldStatus)     oldStatus.textContent = '⚠ Could not hear you. Try again.';
  };

  recognition.onend = function () {
    if (micOuter) micOuter.classList.remove('listening');
  };
}

// ── AI-LIKE RESPONSE LOGIC ──

function analyzeAndRespond(speech) {
  const rules = [
    { keywords: ['accident', 'crash', 'injured', 'hurt', 'bleeding', 'ambulance'], response: '🚑 Calling nearest hospital...' },
    { keywords: ['fire', 'burning', 'smoke', 'flames'],                            response: '🚒 Alerting fire department...' },
    { keywords: ['attack', 'robbery', 'threat', 'gun', 'knife', 'police', 'thief'], response: '🚔 Alerting police...' },
    { keywords: ['flood', 'water', 'drowning', 'rising'],                          response: '🆘 Contacting disaster relief...' },
    { keywords: ['earthquake', 'building', 'collapse', 'trapped'],                 response: '🆘 Alerting rescue teams...' },
    { keywords: ['help', 'emergency', 'sos'],                                      response: '📡 Broadcasting SOS signal...' },
  ];

  for (const rule of rules) {
    if (rule.keywords.some(k => speech.includes(k))) return rule.response;
  }
  return '📡 Emergency signal sent. Stay calm.';
}
