let map = L.map('map').setView([47.0707, 15.4395], 9);
L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    attribution: '&copy; OpenStreetMap contributors'
}).addTo(map);

let routeLayer = null;
let startMarker = null;
let endMarker = null;

document.getElementById('distanceForm').addEventListener('submit', async function (event) {
    event.preventDefault();

    const startAddress = formatAddress('startCity', 'startZip', 'startStreet', 'startNumber');
    const endAddress = formatAddress('endCity', 'endZip', 'endStreet', 'endNumber');

    console.log("Start address:", startAddress);
    console.log("End address:", endAddress);

    try {
        const startCoords = await geocodeAddress(startAddress);
        const endCoords = await geocodeAddress(endAddress);

        console.log("Start coordinates:", startCoords);
        console.log("End coordinates:", endCoords);

        if (!startCoords || !endCoords) {
            document.getElementById('result').innerText = 'Nije moguće pronaći jednu od adresa.';
            return;
        }

        calculateDistance(startCoords, endCoords);
    } catch (error) {
        console.error('Error during geocoding:', error);
        document.getElementById('result').innerText = 'Greška kod traženja adrese.';
    }
});


function formatAddress(cityId, zipId, streetId, numberId) {
    const city = document.getElementById(cityId).value.trim();
    const zip = document.getElementById(zipId).value.trim();
    const street = document.getElementById(streetId).value.trim();
    const number = document.getElementById(numberId).value.trim();

    return `${street} ${number}, ${zip} ${city}, Steiermark, Austria`;
}


async function geocodeAddress(address) {
    const url = `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(address)}&limit=1&addressdetails=1&countrycodes=at`;

    const response = await fetch(url);
    const data = await response.json();

    if (data.length > 0) {
        return [parseFloat(data[0].lon), parseFloat(data[0].lat)];
    } else {
        return null;
    }
}

function decodePolyline(encoded) {
    let points = [];
    let index = 0, len = encoded.length;
    let lat = 0, lng = 0;

    while (index < len) {
        let b, shift = 0, result = 0;
        do {
            b = encoded.charCodeAt(index++) - 63;
            result |= (b & 0x1f) << shift;
            shift += 5;
        } while (b >= 0x20);
        const deltaLat = ((result & 1) ? ~(result >> 1) : (result >> 1));
        lat += deltaLat;

        shift = 0;
        result = 0;
        do {
            b = encoded.charCodeAt(index++) - 63;
            result |= (b & 0x1f) << shift;
            shift += 5;
        } while (b >= 0x20);
        const deltaLng = ((result & 1) ? ~(result >> 1) : (result >> 1));
        lng += deltaLng;

        points.push([lat / 1e5, lng / 1e5]);
    }

    return points;
}

function calculateDistance(start, end) {
    const apiKey = '5b3ce3597851110001cf6248542cca5061794a4ea119b4d03afec1dc';
    const url = `https://api.openrouteservice.org/v2/directions/driving-car`;

    const body = {
        coordinates: [start, end],
        instructions: false,
        geometry: true
    };

    console.log("Sending route request with coordinates:", body);

    fetch(url, {
        method: 'POST',
        headers: {
            'Authorization': apiKey,
            'Content-Type': 'application/json'
        },
        body: JSON.stringify(body)
    })
        .then(response => response.json())
        .then(data => {
            console.log("Route API response:", data);

            const route = data.routes?.[0];
            const encoded = route?.geometry;

            if (!route) {
                document.getElementById('result').innerText = 'Ruta nije pronađena.';
                return;
            }

            const distance = route.summary.distance / 1000;
            const duration = route.summary.duration / 60;

            document.getElementById('result').innerHTML = `
                <strong>Dužina:</strong> ${distance.toFixed(2)} km<br>
                <strong>Vrijeme:</strong> ${duration.toFixed(0)} minuta
            `;
            try {
                const coords = decodePolyline(encoded);
                if (coords && coords.length > 0) {
                    if (routeLayer) map.removeLayer(routeLayer);
                    if (startMarker) map.removeLayer(startMarker);
                    if (endMarker) map.removeLayer(endMarker);

                    routeLayer = L.polyline(coords, { color: 'blue' }).addTo(map);
                    startMarker = L.marker([start[1], start[0]]).addTo(map).bindPopup("Start").openPopup();
                    endMarker = L.marker([end[1], end[0]]).addTo(map).bindPopup("End");
                    map.fitBounds(routeLayer.getBounds());
                }
            } catch (err) {
                console.warn('Could not draw route:', err);
            }
        })
        .catch(error => {
            console.error('Error during route calculation:', error);
            document.getElementById('result').innerText = 'Greška u mapiranju rute.';
        });
}
