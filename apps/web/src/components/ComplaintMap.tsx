import { CircleMarker, MapContainer, Popup, TileLayer, useMap, useMapEvents } from "react-leaflet";
import { Link } from "react-router-dom";
import { useEffect } from "react";

import type { ComplaintMapMarker } from "../api/types";
import { StatusBadge } from "./StatusBadge";

export interface Coordinates {
  latitude: number;
  longitude: number;
}

const defaultCentre: [number, number] = [8.49, 81.18];

const Recenter = ({ coordinates }: { coordinates?: Coordinates | undefined }) => {
  const map = useMap();
  useEffect(() => {
    if (coordinates) map.setView([coordinates.latitude, coordinates.longitude], Math.max(map.getZoom(), 15));
  }, [coordinates, map]);
  return null;
};

const ClickSelector = ({ onChange }: { onChange: (coordinates: Coordinates) => void }) => {
  useMapEvents({
    click: (event) => onChange({ latitude: event.latlng.lat, longitude: event.latlng.lng })
  });
  return null;
};

export const LocationPicker = ({ value, onChange }: { value?: Coordinates | undefined; onChange: (value: Coordinates) => void }) => (
  <div className="map-picker">
    <MapContainer center={value ? [value.latitude, value.longitude] : defaultCentre} zoom={value ? 15 : 13} scrollWheelZoom className="leaflet-map">
      <TileLayer attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors' url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
      <ClickSelector onChange={onChange} />
      <Recenter coordinates={value} />
      {value && <CircleMarker center={[value.latitude, value.longitude]} radius={9} pathOptions={{ color: "#0f6b57", fillColor: "#d6a73f", fillOpacity: 1 }} />}
    </MapContainer>
    <div className="coordinate-grid">
      <label>Latitude<input type="number" step="any" min={-90} max={90} value={value?.latitude ?? ""} onChange={(event) => onChange({ latitude: Number(event.target.value), longitude: value?.longitude ?? defaultCentre[1] })} placeholder="8.490000" /></label>
      <label>Longitude<input type="number" step="any" min={-180} max={180} value={value?.longitude ?? ""} onChange={(event) => onChange({ latitude: value?.latitude ?? defaultCentre[0], longitude: Number(event.target.value) })} placeholder="81.180000" /></label>
    </div>
    <small className="map-help">Click the map to place the marker. Confirm the position before saving.</small>
  </div>
);

export const ReadOnlyLocationMap = ({ coordinates }: { coordinates: Coordinates }) => (
  <MapContainer center={[coordinates.latitude, coordinates.longitude]} zoom={15} scrollWheelZoom={false} className="leaflet-map detail-map">
    <TileLayer attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors' url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
    <CircleMarker center={[coordinates.latitude, coordinates.longitude]} radius={9} pathOptions={{ color: "#0f6b57", fillColor: "#d6a73f", fillOpacity: 1 }} />
  </MapContainer>
);

export const MarkerMap = ({ markers }: { markers: ComplaintMapMarker[] }) => (
  <MapContainer center={markers[0] ? [markers[0].latitude, markers[0].longitude] : defaultCentre} zoom={13} scrollWheelZoom className="leaflet-map marker-map">
    <TileLayer attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors' url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
    {markers.map((marker) => (
      <CircleMarker key={marker.complaintId} center={[marker.latitude, marker.longitude]} radius={8} pathOptions={{ color: "#0b4d40", fillColor: "#d6a73f", fillOpacity: .92 }}>
        <Popup>
          <div className="map-popup"><small>{marker.referenceNumber}</small><strong>{marker.title}</strong><StatusBadge value={marker.status} /><Link to={`/complaints/${marker.complaintId}`}>Open complaint</Link></div>
        </Popup>
      </CircleMarker>
    ))}
  </MapContainer>
);
