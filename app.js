// Koordinaten der Kaaba in Mekka
const KAABA_LAT = 21.422487;
const KAABA_LNG = 39.826206;

// Globale Variablen
let map;
let userMarker;
let qiblaLine;
let userLocation = null;
let qiblaDirection = 0;
let watchId = null;
let compassPermission = false;

// App initialisieren, wenn DOM geladen ist
document.addEventListener('DOMContentLoaded', function() {
    initTabs();
    initMap();
    initSettings();
    requestLocation();
});

// Tab-Funktionalität initialisieren
function initTabs() {
    const tabs = document.querySelectorAll('.tab');
    tabs.forEach(tab => {
        tab.addEventListener('click', () => {
            // Aktive Klasse von allen Tabs und Inhalten entfernen
            document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
            document.querySelectorAll('.tab-content').forEach(c => c.classList.remove('active'));
            
            // Aktive Klasse zum geklickten Tab und entsprechenden Inhalt hinzufügen
            tab.classList.add('active');
            const tabId = tab.getAttribute('data-tab');
            document.getElementById(tabId).classList.add('active');
            
            // Spezielle Behandlung für Live-Tab
            if (tabId === 'live') {
                startCompass();
            } else {
                stopCompass();
            }
        });
    });
}

// Karte initialisieren
function initMap() {
    map = L.map('map-container').setView([0, 0], 2);
    
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> Mitwirkende'
    }).addTo(map);
}

// Einstellungen initialisieren
function initSettings() {
    // Gespeicherte Einstellungen laden
    const savedTheme = localStorage.getItem('theme') || 'light';
    const savedMapStyle = localStorage.getItem('map-style') || 'streets';
    
    document.getElementById('theme').value = savedTheme;
    document.getElementById('map-style').value = savedMapStyle;
    applyTheme(savedTheme);
    
    // Einstellungen speichern Button
    document.getElementById('save-settings').addEventListener('click', () => {
        const theme = document.getElementById('theme').value;
        const mapStyle = document.getElementById('map-style').value;
        
        localStorage.setItem('theme', theme);
        localStorage.setItem('map-style', mapStyle);
        
        applyTheme(theme);
        alert('Einstellungen gespeichert!');
    });
}

// Design anwenden
function applyTheme(theme) {
    document.body.className = theme;
}

// Standort des Benutzers anfordern
function requestLocation() {
    if (navigator.geolocation) {
        navigator.geolocation.getCurrentPosition(
            position => updateLocation(position),
            error => handleLocationError(error),
            { enableHighAccuracy: true }
        );
        
        // Positionsänderungen überwachen
        watchId = navigator.geolocation.watchPosition(
            position => updateLocation(position),
            error => handleLocationError(error),
            { enableHighAccuracy: true, maximumAge: 10000, timeout: 5000 }
        );
    } else {
        document.getElementById('user-location').textContent = 'Geolokalisierung wird von diesem Browser nicht unterstützt.';
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
    
    // Kompass aktualisieren
    updateCompass(qiblaDirection);
}

// Standortfehler behandeln
function handleLocationError(error) {
    let message = '';
    switch(error.code) {
        case error.PERMISSION_DENIED:
            message = "Standortzugriff wurde verweigert.";
            break;
        case error.POSITION_UNAVAILABLE:
            message = "Standortinformationen sind nicht verfügbar.";
            break;
        case error.TIMEOUT:
            message = "Die Standortanfrage hat zu lange gedauert.";
            break;
        case error.UNKNOWN_ERROR:
            message = "Ein unbekannter Fehler ist aufgetreten.";
            break;
    }
    document.getElementById('user-location').textContent = message;
}

// Karte mit Benutzerstandort und Qibla-Richtung aktualisieren
function updateMap(lat, lng) {
    // Kartenansicht setzen
    map.setView([lat, lng], 13);
    
    // Vorhandene Marker und Linie entfernen, falls vorhanden
    if (userMarker) map.removeLayer(userMarker);
    if (qiblaLine) map.removeLayer(qiblaLine);
    
    // Benutzermarker hinzufügen
    userMarker = L.marker([lat, lng]).addTo(map)
        .bindPopup("Ihr Standort").openPopup();
    
    // Kaaba-Marker hinzufügen
    const kaabaMarker = L.marker([KAABA_LAT, KAABA_LNG]).addTo(map)
        .bindPopup("Kaaba, Mekka");
    
    // Linie zur Qibla zeichnen
    const endPoint = calculateDestinationPoint(lat, lng, qiblaDirection, 1000); // 1000 km in Qibla-Richtung
    qiblaLine = L.polyline([[lat, lng], endPoint], {color: 'red'}).addTo(map);
}

// Qibla-Richtung berechnen (in Grad von Norden)
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

// Entfernung zwischen zwei Punkten berechnen (in km)
function calculateDistance(lat1, lng1, lat2, lng2) {
    const R = 6371; // Erdradius in km
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLng = (lng2 - lng1) * Math.PI / 180;
    const a = 
        Math.sin(dLat/2) * Math.sin(dLat/2) +
        Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * 
        Math.sin(dLng/2) * Math.sin(dLng/2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
    return R * c;
}

// Zielpunkt berechnen basierend auf Startpunkt, Peilung und Entfernung
function calculateDestinationPoint(lat, lng, bearing, distance) {
    const R = 6371; // Erdradius in km
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

// Kompassanzeige aktualisieren
function updateCompass(direction) {
    const arrow = document.querySelector('.compass-arrow');
    const qiblaArrow = document.querySelector('.compass-qibla');
    
    arrow.style.transform = `translate(0, -50%) rotate(0deg)`;
    qiblaArrow.style.transform = `translate(0, -50%) rotate(${direction}deg)`;
    
    document.querySelector('.compass-direction').textContent = `Qibla-Richtung: ${direction.toFixed(1)}°`;
}

// Kompassfunktionalität für Live-Tab starten
function startCompass() {
    if (typeof DeviceOrientationEvent !== 'undefined' && typeof DeviceOrientationEvent.requestPermission === 'function') {
        // iOS 13+ Geräte
        DeviceOrientationEvent.requestPermission()
            .then(response => {
                if (response === 'granted') {
                    compassPermission = true;
                    window.addEventListener('deviceorientation', handleOrientation);
                } else {
                    alert('Kompasszugriff wurde verweigert. Live-Kompass funktioniert nicht.');
                }
            })
            .catch(console.error);
    } else if ('ondeviceorientation' in window) {
        // Andere Geräte
        window.addEventListener('deviceorientation', handleOrientation);
        compassPermission = true;
    } else {
        alert('Geräteausrichtung wird auf diesem Gerät nicht unterstützt.');
    }
}

// Kompassfunktionalität stoppen
function stopCompass() {
    if (compassPermission) {
        window.removeEventListener('deviceorientation', handleOrientation);
    }
}

// Geräteausrichtungsereignisse behandeln
function handleOrientation(event) {
    if (event.absolute && event.alpha !== null) {
        const alpha = event.alpha;  // Kompassrichtung (0-360)
        const beta = event.beta;    // Neigung vorne-hinten (-180 bis 180)
        const gamma = event.gamma;  // Neigung links-rechts (-90 bis 90)
        
        // Winkel zwischen Geräteausrichtung und Qibla-Richtung berechnen
        let angle = (360 - alpha + qiblaDirection) % 360;
        
        // Live-Kompassanzeige aktualisieren
        const liveArrow = document.querySelector('.live-arrow');
        liveArrow.style.transform = `translate(0, -50%) rotate(${angle}deg)`;
        
        document.getElementById('live-qibla').textContent = angle.toFixed(1);
    }
}