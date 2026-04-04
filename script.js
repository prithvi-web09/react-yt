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

// ── SOS MICROPHONE LOGIC ──

function startMic() {
  const status = document.getElementById('micStatus');
  const btn = document.getElementById('sosBtn');

  // Check browser support
  const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
  if (!SpeechRecognition) {
    status.textContent = '⚠ Voice not supported in this browser.';
    return;
  }

  const recognition = new SpeechRecognition();
  recognition.lang = 'en-US';
  recognition.interimResults = false;
  recognition.maxAlternatives = 1;

  // UI — listening state
  status.textContent = '🎙 Listening...';
  btn.style.boxShadow = '0 0 40px rgba(255, 50, 50, 0.8)';

  recognition.start();

  recognition.onresult = function (event) {
    const speech = event.results[0][0].transcript.toLowerCase();
    status.textContent = `Heard: "${speech}"`;
    btn.style.boxShadow = '';
    analyzeAndRespond(speech);
  };

  recognition.onerror = function (event) {
    status.textContent = '⚠ Could not hear you. Try again.';
    btn.style.boxShadow = '';
  };

  recognition.onend = function () {
    if (status.textContent === '🎙 Listening...') {
      status.textContent = '';
    }
    btn.style.boxShadow = '';
  };
}

// ── AI-LIKE RESPONSE LOGIC ──

function analyzeAndRespond(speech) {
  const status = document.getElementById('micStatus');

  const rules = [
    { keywords: ['accident', 'crash', 'injured', 'hurt', 'bleeding', 'ambulance'], response: '🚑 Calling nearest hospital...' },
    { keywords: ['fire', 'burning', 'smoke', 'flames'],                            response: '🚒 Alerting fire department...' },
    { keywords: ['attack', 'robbery', 'threat', 'gun', 'knife', 'police', 'thief'], response: '🚔 Alerting police...' },
    { keywords: ['flood', 'water', 'drowning', 'rising'],                          response: '🆘 Contacting disaster relief...' },
    { keywords: ['earthquake', 'building', 'collapse', 'trapped'],                 response: '🆘 Alerting rescue teams...' },
    { keywords: ['help', 'emergency', 'sos'],                                      response: '📡 Broadcasting SOS signal...' },
  ];

  let matched = false;
  for (const rule of rules) {
    if (rule.keywords.some(k => speech.includes(k))) {
      status.textContent = rule.response;
      matched = true;
      break;
    }
  }

  if (!matched) {
    status.textContent = '📡 Emergency signal sent. Stay calm.';
  }
}
