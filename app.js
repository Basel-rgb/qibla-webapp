// Koordinaten der Kaaba in Mekka
const KAABA_LAT = 21.422487;
const KAABA_LNG = 39.826206;
const DIRECTION_THRESHOLD = 5; // Grad-Toleranz für korrekte Ausrichtung

// Globale Variablen
let map;
let userMarker;
let qiblaLine;
let userLocation = null;
let qiblaDirection = 0;
let currentHeading = 0;
let compassPermission = false;
let isCalibrated = false;

// App initialisieren
document.addEventListener('DOMContentLoaded', function() {
    initMap();
    requestLocation();
    setupCompass();
});

// Karte initialisieren
function initMap() {
    map = L.map('map-container').setView([0, 0], 2);
    
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> Mitwirkende'
    }).addTo(map);
}

// Standort des Benutzers anfordern
function requestLocation() {
    if (navigator.geolocation) {
        navigator.geolocation.getCurrentPosition(
            position => updateLocation(position),
            error => handleLocationError(error),
            { enableHighAccuracy: true }
        );
    } else {
        document.getElementById('user-location').textContent = 'Geolokalisierung nicht unterstützt';
    }
}

// Standortinformationen aktualisieren
function updateLocation(position) {
    const lat = position.coords.latitude;
    const lng = position.coords.longitude;
    userLocation = { lat, lng };
    
    // Anzeige aktualisieren
    document.getElementById('user-location').textContent = `${lat.toFixed(6)}, ${lng.toFixed(6)}`;
    
    // Qibla-Richtung berechnen
    qiblaDirection = calculateQiblaDirection(lat, lng);
    document.getElementById('direction').textContent = qiblaDirection.toFixed(1);
    
    // Entfernung zur Kaaba berechnen
    const distance = calculateDistance(lat, lng, KAABA_LAT, KAABA_LNG);
    document.getElementById('distance').textContent = `${distance.toFixed(0)} km`;
    
    // Karte aktualisieren
    updateMap(lat, lng);
    
    // Qibla-Linie im Kompass aktualisieren
    updateQiblaLine();
}

// Karte aktualisieren
function updateMap(lat, lng) {
    map.setView([lat, lng], 13);
    
    if (userMarker) map.removeLayer(userMarker);
    userMarker = L.marker([lat, lng]).addTo(map).bindPopup("Ihr Standort");
    
    // Linie zur Qibla zeichnen
    const endPoint = calculateDestinationPoint(lat, lng, qiblaDirection, 1000);
    if (qiblaLine) map.removeLayer(qiblaLine);
    qiblaLine = L.polyline([[lat, lng], endPoint], {color: '#e74c3c', weight: 3}).addTo(map);
}

// Kompass einrichten
function setupCompass() {
    if (typeof DeviceOrientationEvent !== 'undefined' && typeof DeviceOrientationEvent.requestPermission === 'function') {
        // iOS 13+ Geräte
        document.getElementById('accuracy-text').textContent = "Tippen Sie zum Aktivieren des Kompasses";
        document.body.addEventListener('click', requestCompassPermission);
    } else if ('ondeviceorientationabsolute' in window) {
        // Geräte mit absolutem Kompass
        window.addEventListener('deviceorientationabsolute', handleOrientation);
        compassPermission = true;
    } else if ('ondeviceorientation' in window) {
        // Andere Geräte
        window.addEventListener('deviceorientation', handleOrientation);
        compassPermission = true;
    } else {
        document.getElementById('accuracy-text').textContent = "Kompass nicht verfügbar";
    }
}

// Kompass-Berechtigung anfordern (iOS)
function requestCompassPermission() {
    DeviceOrientationEvent.requestPermission()
        .then(response => {
            if (response === 'granted') {
                compassPermission = true;
                window.addEventListener('deviceorientation', handleOrientation);
                document.getElementById('accuracy-text').textContent = "Bewegen Sie Ihr Gerät im Kreis zur Kalibrierung";
                document.body.removeEventListener('click', requestCompassPermission);
            }
        })
        .catch(console.error);
}

// Geräteausrichtung behandeln
function handleOrientation(event) {
    if (!compassPermission) return;
    
    // Genauigkeitsinformationen anzeigen
    if (event.webkitCompassAccuracy !== undefined) {
        const accuracy = Math.max(0, 100 - event.webkitCompassAccuracy);
        document.getElementById('accuracy-level').style.width = `${accuracy}%`;
        isCalibrated = accuracy > 70;
        
        if (isCalibrated) {
            document.getElementById('accuracy-text').textContent = "Kompass kalibriert";
            document.getElementById('accuracy-level').style.backgroundColor = "#2ecc71";
        } else {
            document.getElementById('accuracy-text').textContent = "Bewegen Sie Ihr Gerät im Kreis zur Kalibrierung";
            document.getElementById('accuracy-level').style.backgroundColor = "#3498db";
        }
    }
    
    // Richtung aktualisieren
    if (event.alpha !== null) {
        currentHeading = event.alpha; // Grad von Norden (0-360)
        updateCompass();
        checkDirection();
    }
}

// Kompassanzeige aktualisieren
function updateCompass() {
    const arrow = document.getElementById('compass-arrow');
    arrow.style.transform = `translate(0, -50%) rotate(${currentHeading}deg)`;
}

// Qibla-Linie aktualisieren
function updateQiblaLine() {
    const qiblaLineElement = document.getElementById('qibla-line');
    qiblaLineElement.style.transform = `translate(0, -50%) rotate(${qiblaDirection}deg)`;
}

// Überprüfen, ob in Qibla-Richtung ausgerichtet
function checkDirection() {
    if (!isCalibrated || !qiblaDirection) return;
    
    const arrow = document.getElementById('compass-arrow');
    const directionDiff = Math.abs((currentHeading - qiblaDirection + 360) % 360);
    const isCorrect = Math.min(directionDiff, 360 - directionDiff) <= DIRECTION_THRESHOLD;
    
    if (isCorrect) {
        arrow.classList.add('correct-direction');
        arrow.classList.remove('wrong-direction');
        document.getElementById('direction-status').textContent = "✅ Korrekt ausgerichtet";
        document.getElementById('direction-status').style.color = "#2ecc71";
        
        // Kartenlinie grün färben wenn korrekt ausgerichtet
        if (qiblaLine) {
            qiblaLine.setStyle({color: '#2ecc71'});
        }
    } else {
        arrow.classList.add('wrong-direction');
        arrow.classList.remove('correct-direction');
        document.getElementById('direction-status').textContent = "❌ Nicht ausgerichtet";
        document.getElementById('direction-status').style.color = "#e74c3c";
        
        // Kartenlinie rot färben wenn falsch ausgerichtet
        if (qiblaLine) {
            qiblaLine.setStyle({color: '#e74c3c'});
        }
    }
    
    // Richtungstext aktualisieren
    updateDirectionText(directionDiff);
}

// Richtungstext aktualisieren
function updateDirectionText(diff) {
    const directionText = document.getElementById('direction-text');
    const normalizedDiff = Math.min(diff, 360 - diff);
    
    if (normalizedDiff <= DIRECTION_THRESHOLD) {
        directionText.textContent = "Perfekt ausgerichtet!";
        directionText.style.color = "#2ecc71";
    } else if (normalizedDiff <= 30) {
        directionText.textContent = "Fast richtig - etwas weiter drehen";
        directionText.style.color = "#f39c12";
    } else if (normalizedDiff <= 90) {
        directionText.textContent = "Drehen Sie sich in Qibla-Richtung";
        directionText.style.color = "#e74c3c";
    } else {
        const direction = ((qiblaDirection - currentHeading + 360) % 360) <= 180 ? "rechts" : "links";
        directionText.textContent = `Drehen Sie sich nach ${direction}`;
        directionText.style.color = "#e74c3c";
    }
}

// Qibla-Richtung berechnen
function calculateQiblaDirection(lat, lng) {
    const phiK = KAABA_LAT * Math.PI / 180.0;
    const lambdaK = KAABA_LNG * Math.PI / 180.0;
    const phi = lat * Math.PI / 180.0;
    const lambda = lng * Math.PI / 180.0;
    
    const psi = 180.0 / Math.PI * Math.atan2(
        Math.sin(lambdaK - lambda),
        Math.cos(phi) * Math.tan(phiK) - Math.sin(phi) * Math.cos(lambdaK - lambda)
    );
    
    return (psi + 360) % 360;
}

// Entfernung berechnen
function calculateDistance(lat1, lng1, lat2, lng2) {
    const R = 6371;
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLng = (lng2 - lng1) * Math.PI / 180;
    const a = 
        Math.sin(dLat/2) * Math.sin(dLat/2) +
        Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * 
        Math.sin(dLng/2) * Math.sin(dLng/2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
    return R * c;
}

// Zielpunkt berechnen
function calculateDestinationPoint(lat, lng, bearing, distance) {
    const R = 6371;
    const latRad = lat * Math.PI / 180;
    const lngRad = lng * Math.PI / 180;
    const bearingRad = bearing * Math.PI / 180;
    
    const destLat = Math.asin(
        Math.sin(latRad) * Math.cos(distance/R) + 
        Math.cos(latRad) * Math.sin(distance/R) * Math.cos(bearingRad)
    );
    
    const destLng = lngRad + Math.atan2(
        Math.sin(bearingRad) * Math.sin(distance/R) * Math.cos(latRad),
        Math.cos(distance/R) - Math.sin(latRad) * Math.sin(destLat)
    );
    
    return [destLat * 180 / Math.PI, destLng * 180 / Math.PI];
}

// Standortfehler behandeln
function handleLocationError(error) {
    let message = '';
    switch(error.code) {
        case error.PERMISSION_DENIED:
            message = "Standortzugriff wurde verweigert";
            break;
        case error.POSITION_UNAVAILABLE:
            message = "Standortinformation nicht verfügbar";
            break;
        case error.TIMEOUT:
            message = "Standortanfrage hat zu lange gedauert";
            break;
        case error.UNKNOWN_ERROR:
            message = "Unbekannter Fehler";
            break;
    }
    document.getElementById('user-location').textContent = message;
}