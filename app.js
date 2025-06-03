// Koordinaten der Kaaba
const KAABA = { lat: 21.422487, lng: 39.826206 };
const DIRECTION_THRESHOLD = 3; // 3° Toleranz
let map, userMarker, qiblaLine;
let userLocation = null;
let qiblaDirection = 0;
let currentHeading = 0;
let lastVibrationTime = 0;

// App initialisieren
document.addEventListener('DOMContentLoaded', () => {
    initTime();
    initMap();
    requestLocation();
    setupCompass();
});

// Uhrzeit aktualisieren
function initTime() {
    const update = () => {
        const now = new Date();
        document.getElementById('current-time').textContent =
            now.getHours().toString().padStart(2, '0') + ':' +
            now.getMinutes().toString().padStart(2, '0');
    };
    update();
    setInterval(update, 1000);
}

// Karte initialisieren (HD-Satellit + Gelände)
function initMap() {
    map = L.map('map', {
        zoomControl: false,
        attributionControl: false
    }).setView([0, 0], 2);

    // Satellitenkarte
    L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}', {
        maxZoom: 19,
        attribution: 'Tiles &copy; Esri &mdash; Source: Esri, Maxar, Earthstar Geographics'
    }).addTo(map);

    // Geländeüberlagerung
    L.tileLayer('https://{s}.tile.opentopomap.org/{z}/{x}/{y}.png', {
        maxZoom: 17,
        opacity: 0.5,
        attribution: 'Map data: &copy; OpenTopoMap'
    }).addTo(map);
}

// Standort anfordern
function requestLocation() {
    if (!navigator.geolocation) {
        document.getElementById('user-location').textContent = 'Geolokalisierung nicht unterstützt';
        return;
    }

    navigator.geolocation.getCurrentPosition(
        updateLocation,
        handleLocationError,
        { enableHighAccuracy: true, timeout: 10000 }
    );
}

// Standort aktualisieren
function updateLocation(position) {
    const { latitude: lat, longitude: lng } = position.coords;
    userLocation = { lat, lng };

    document.getElementById('user-location').textContent = `${lat.toFixed(5)}, ${lng.toFixed(5)}`;
    qiblaDirection = calculateQiblaDirection(lat, lng);
    document.getElementById('direction').textContent = qiblaDirection.toFixed(1);

    const distance = calculateDistance(lat, lng, KAABA.lat, KAABA.lng);
    document.getElementById('distance').textContent = `${distance.toFixed(0)} km`;

    updateMap(lat, lng);
    updateQiblaLine();
}

// Karte mit Nutzerstandort & Linie zur Kaaba aktualisieren
function updateMap(lat, lng) {
    map.setView([lat, lng], 16);

    if (userMarker) map.removeLayer(userMarker);
    userMarker = L.marker([lat, lng], {
        icon: L.divIcon({
            className: 'user-marker',
            html: '<div class="pulse-marker"></div>',
            iconSize: [30, 30]
        })
    }).addTo(map).bindPopup("Dein Standort");

    if (qiblaLine) map.removeLayer(qiblaLine);
    qiblaLine = L.polyline([[lat, lng], KAABA], {
        color: '#ff3b30',
        weight: 3,
        dashArray: '5, 5'
    }).addTo(map);
}

// Kompass initialisieren
function setupCompass() {
    if (typeof DeviceOrientationEvent !== 'undefined') {
        if (typeof DeviceOrientationEvent.requestPermission === 'function') {
            // iOS 13+
            document.body.addEventListener('click', requestCompassPermission);
        } else {
            // Android / andere Geräte
            window.addEventListener('deviceorientationabsolute' in window ? 'deviceorientationabsolute' : 'deviceorientation', handleOrientation);
        }
    } else {
        document.getElementById('direction-text').textContent = 'Kompass nicht verfügbar';
    }
}

// iOS-Kompass-Berechtigung anfordern
function requestCompassPermission() {
    DeviceOrientationEvent.requestPermission()
        .then(response => {
            if (response === 'granted') {
                window.addEventListener('deviceorientation', handleOrientation);
                document.body.removeEventListener('click', requestCompassPermission);
            } else {
                document.getElementById('direction-text').textContent = 'Zugriff auf Kompass verweigert';
            }
        })
        .catch(err => {
            console.error(err);
            document.getElementById('direction-text').textContent = 'Kompassfehler';
        });
}

// Geräteausrichtung verarbeiten
function handleOrientation(event) {
    if (event.alpha === null) return;

    currentHeading = normalizeAngle(event.alpha);
    updateCompass();
    checkDirection();
}

// Pfeile drehen
function updateCompass() {
    document.getElementById('compass-arrow').style.transform = `translate(0, -50%) rotate(${currentHeading}deg)`;
}

// Qibla-Pfeil drehen
function updateQiblaLine() {
    const qiblaEl = document.getElementById('qibla-line');
    if (qiblaEl) {
        qiblaEl.style.transform = `translate(0, -50%) rotate(${qiblaDirection}deg)`;
    }
}

// Richtung prüfen
function checkDirection() {
    if (!qiblaDirection) return;

    const diff = Math.abs(normalizeAngle(currentHeading - qiblaDirection));
    const angleDiff = Math.min(diff, 360 - diff);
    const isCorrect = angleDiff <= DIRECTION_THRESHOLD;

    const arrow = document.getElementById('compass-arrow');
    const statusText = document.getElementById('direction-text');

    if (isCorrect) {
        arrow.classList.add('correct-direction');
        statusText.textContent = 'Du bist korrekt ausgerichtet';
        statusText.classList.add('correct-text');
        statusText.classList.remove('incorrect-text');

        if (qiblaLine) qiblaLine.setStyle({ color: '#2ecc71', dashArray: null });

        const now = Date.now();
        if (now - lastVibrationTime > 5000) {
            vibrateDevice();
            lastVibrationTime = now;
        }
    } else {
        arrow.classList.remove('correct-direction');
        statusText.textContent = `Drehe dich ${getTurnDirection(currentHeading, qiblaDirection)}`;
        statusText.classList.add('incorrect-text');
        statusText.classList.remove('correct-text');

        if (qiblaLine) qiblaLine.setStyle({ color: '#ff3b30', dashArray: '5, 5' });
    }
}

// Gerät vibrieren lassen
function vibrateDevice() {
    if ('vibrate' in navigator) {
        navigator.vibrate([100, 50, 100]);
    }
}

// Hilfsfunktionen
function normalizeAngle(angle) {
    return (angle + 360) % 360;
}

function getTurnDirection(current, target) {
    const diff = normalizeAngle(target - current);
    return diff > 180 ? 'nach links' : 'nach rechts';
}

function calculateQiblaDirection(lat, lng) {
    const φK = KAABA.lat * Math.PI / 180;
    const λK = KAABA.lng * Math.PI / 180;
    const φ = lat * Math.PI / 180;
    const λ = lng * Math.PI / 180;

    const y = Math.sin(λK - λ);
    const x = Math.cos(φ) * Math.tan(φK) - Math.sin(φ) * Math.cos(λK - λ);
    return normalizeAngle(Math.atan2(y, x) * 180 / Math.PI);
}

function calculateDistance(lat1, lon1, lat2, lon2) {
    const R = 6371; // Erd-Radius in km
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLon = (lon2 - lon1) * Math.PI / 180;
    const a =
        Math.sin(dLat/2) ** 2 +
        Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
        Math.sin(dLon/2) ** 2;
    return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function handleLocationError(error) {
    let message = 'Standort konnte nicht ermittelt werden';
    switch(error.code) {
        case error.PERMISSION_DENIED: message = 'Standortzugriff verweigert'; break;
        case error.POSITION_UNAVAILABLE: message = 'Standort nicht verfügbar'; break;
        case error.TIMEOUT: message = 'Standortabfrage dauerte zu lange'; break;
    }
    document.getElementById('user-location').textContent = message;
}
if (typeof DeviceOrientationEvent.requestPermission === 'function') {
    document.body.addEventListener('click', requestCompassPermission);
}