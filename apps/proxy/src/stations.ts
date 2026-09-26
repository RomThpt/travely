export interface Station {
  uic: string;
  name: string;
  lat: number;
  lon: number;
  country: string;
}

/**
 * Fallback list for major French/European stations. Navitia responses already carry
 * `stop_point` coordinates and names, so this is only used when a station is looked up
 * directly (`GET /v1/stations/:uic`) outside of a vehicle_journey response.
 *
 * Amsterdam Centraal is deliberately omitted: its UIC code could not be verified here
 * and a guessed code would be worse than a 404.
 */
export const STATIONS: Station[] = [
  { uic: "87686006", name: "Paris Gare de Lyon", lat: 48.8443, lon: 2.3744, country: "FR" },
  { uic: "87391003", name: "Paris Montparnasse", lat: 48.8409, lon: 2.3201, country: "FR" },
  { uic: "87271007", name: "Paris Gare du Nord", lat: 48.8809, lon: 2.3553, country: "FR" },
  { uic: "87723197", name: "Lyon Part-Dieu", lat: 45.7602, lon: 4.859, country: "FR" },
  { uic: "87751008", name: "Marseille Saint-Charles", lat: 43.3028, lon: 5.3805, country: "FR" },
  { uic: "87581009", name: "Bordeaux Saint-Jean", lat: 44.8256, lon: -0.5564, country: "FR" },
  { uic: "87223263", name: "Lille Europe", lat: 50.6392, lon: 3.0755, country: "FR" },
  { uic: "87212027", name: "Strasbourg", lat: 48.5851, lon: 7.7347, country: "FR" },
  { uic: "87481002", name: "Nantes", lat: 47.2173, lon: -1.5419, country: "FR" },
  { uic: "87471003", name: "Rennes", lat: 48.1036, lon: -1.6725, country: "FR" },
  { uic: "87773002", name: "Montpellier Saint-Roch", lat: 43.6042, lon: 3.8807, country: "FR" },
  { uic: "87756056", name: "Nice Ville", lat: 43.7042, lon: 7.2617, country: "FR" },
  { uic: "70154005", name: "London St Pancras", lat: 51.5308, lon: -0.1259, country: "GB" },
  { uic: "88140010", name: "Bruxelles-Midi", lat: 50.8358, lon: 4.3363, country: "BE" },
];

export function findStation(uic: string): Station | undefined {
  return STATIONS.find((station) => station.uic === uic);
}
