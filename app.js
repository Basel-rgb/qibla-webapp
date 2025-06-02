// Koordinaten der Kaaba
const kaaba = {
  lat: 21.4225,
  lng: 39.8262
};

const map = L.map('map').setView([0, 0], 13);

// Kartenstil
L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
  attribution: '© OpenStreetMap'
}).addTo(map);

// Standort abfragen
navigator.geolocation.getCurrentPosition(position => {
  const userLat = position.coords.latitude;
  const userLng = position.coords.longitude;

  const userLocation = [userLat, userLng];

  map.setView(userLocation, 15);

  // Marker für User
  L.marker(userLocation).addTo(map).bindPopup("Du bist hier").openPopup();

  // Linie zur Kaaba
  L.polyline([userLocation, [kaaba.lat, kaaba.lng]], {
    color: 'green',
    weight: 4
  }).addTo(map);

  // Marker für Kaaba
  L.marker([kaaba.lat, kaaba.lng]).addTo(map).bindPopup("Kaaba");

  // Info anzeigen
  document.getElementById('info').innerText = '✅ Qibla-Richtung ist gefunden!';

}, error => {
  document.getElementById('info').innerText = '⚠️ Standort nicht verfügbar';
});