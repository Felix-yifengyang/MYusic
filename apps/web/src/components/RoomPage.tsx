import type { CSSProperties } from "react";
import { useEffect, useState } from "react";

const weatherClear = new URL(
  "../assets/images/room/weather-clear.png",
  import.meta.url,
).href;
const weatherCloudy = new URL(
  "../assets/images/room/weather-cloudy.png",
  import.meta.url,
).href;
const weatherFog = new URL(
  "../assets/images/room/weather-fog.png",
  import.meta.url,
).href;
const weatherDrizzle = new URL(
  "../assets/images/room/weather-drizzle.png",
  import.meta.url,
).href;
const weatherRain = new URL(
  "../assets/images/room/weather-rain.png",
  import.meta.url,
).href;
const weatherSnow = new URL(
  "../assets/images/room/weather-snow.png",
  import.meta.url,
).href;
const weatherThunder = new URL(
  "../assets/images/room/weather-thunder.png",
  import.meta.url,
).href;
const roomTable = new URL(
  "../assets/images/room/turntable-table.png",
  import.meta.url,
).href;
const roomCabinet = new URL(
  "../assets/images/room/record-cabinet.png",
  import.meta.url,
).href;
const roomComputer = new URL(
  "../assets/images/room/computer.png",
  import.meta.url,
).href;

const weatherAssets = {
  clear: weatherClear,
  cloudy: weatherCloudy,
  fog: weatherFog,
  drizzle: weatherDrizzle,
  rain: weatherRain,
  snow: weatherSnow,
  thunder: weatherThunder,
} as const;

type WeatherKind = keyof typeof weatherAssets;

interface OpenMeteoCurrentWeather {
  weather_code?: number;
}

interface OpenMeteoForecast {
  current?: OpenMeteoCurrentWeather;
}

interface RoomWeatherStyle extends CSSProperties {
  "--room-weather-image": string;
}

interface RoomPageProps {
  active: boolean;
  onEnterTable: () => void;
  onEnterCabinet: () => void;
  onEnterComputer: () => void;
}

export function RoomPage({ active, onEnterTable, onEnterCabinet, onEnterComputer }: RoomPageProps) {
  const weatherKind = useRoomWeather();
  const roomStyle: RoomWeatherStyle = {
    "--room-weather-image": weatherKind ? `url("${weatherAssets[weatherKind]}")` : "none",
  };

  return (
    <main
      className={`room-page ${!active ? "is-inactive" : ""}`}
      style={roomStyle}
      aria-hidden={!active}
    >
      <button
        className="room-table-entry"
        type="button"
        aria-label="进入唱片机"
        onClick={onEnterTable}
      >
        <img
          src={roomTable}
          alt=""
          aria-hidden="true"
          draggable={false}
        />
      </button>
      <button
        className="room-cabinet-entry"
        type="button"
        aria-label="打开唱片柜"
        onClick={onEnterCabinet}
      >
        <img
          src={roomCabinet}
          alt=""
          aria-hidden="true"
          draggable={false}
        />
      </button>
      <button
        className="room-computer-entry"
        type="button"
        aria-label="打开音乐电脑"
        onClick={onEnterComputer}
      >
        <img
          src={roomComputer}
          alt=""
          aria-hidden="true"
          draggable={false}
        />
      </button>
    </main>
  );
}

function useRoomWeather() {
  const [weatherKind, setWeatherKind] = useState<WeatherKind>();

  useEffect(() => {
    const controller = new AbortController();
    let cancelled = false;

    getBrowserCoordinates()
      .then((coords) => fetchCurrentWeatherCode(coords, controller.signal))
      .then((code) => {
        if (!cancelled) setWeatherKind(mapWeatherCodeToKind(code));
      })
      .catch(() => {
        if (!cancelled) setWeatherKind("clear");
      });

    return () => {
      cancelled = true;
      controller.abort();
    };
  }, []);

  return weatherKind;
}

function getBrowserCoordinates() {
  return new Promise<GeolocationCoordinates>((resolve, reject) => {
    if (!navigator.geolocation) {
      reject(new Error("Geolocation is unavailable."));
      return;
    }

    navigator.geolocation.getCurrentPosition(
      (position) => resolve(position.coords),
      reject,
      {
        enableHighAccuracy: false,
        maximumAge: 30 * 60 * 1000,
        timeout: 8000,
      },
    );
  });
}

async function fetchCurrentWeatherCode(coords: GeolocationCoordinates, signal: AbortSignal) {
  const params = new URLSearchParams({
    latitude: coords.latitude.toFixed(4),
    longitude: coords.longitude.toFixed(4),
    current: "weather_code",
    timezone: "auto",
  });
  const response = await fetch(`https://api.open-meteo.com/v1/forecast?${params}`, { signal });

  if (!response.ok) {
    throw new Error(`Open-Meteo weather request failed: ${response.status}`);
  }

  const forecast = await response.json() as OpenMeteoForecast;
  if (typeof forecast.current?.weather_code !== "number") {
    throw new Error("Open-Meteo response did not include current.weather_code.");
  }

  return forecast.current.weather_code;
}

function mapWeatherCodeToKind(code: number): WeatherKind {
  if (code === 0) return "clear";
  if (code >= 1 && code <= 3) return "cloudy";
  if (code === 45 || code === 48) return "fog";
  if ((code >= 51 && code <= 57)) return "drizzle";
  if ((code >= 61 && code <= 67) || (code >= 80 && code <= 82)) return "rain";
  if ((code >= 71 && code <= 77) || code === 85 || code === 86) return "snow";
  if (code === 95 || code === 96 || code === 99) return "thunder";

  return "clear";
}
