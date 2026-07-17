import { useEffect, useRef, useState } from "react";
import { LocateFixed, MapPin, Search } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

type GooglePlaceResult = {
  name: string;
  address: string;
  placeId: string | null;
  latitude: number;
  longitude: number;
};

type GoogleMapsBrowserApi = {
  maps?: {
    places?: {
      Autocomplete: new (
        input: HTMLInputElement,
        options?: {
          componentRestrictions?: {
            country: string;
          };
          fields?: string[];
        },
      ) => {
        addListener: (
          eventName: "place_changed",
          callback: () => void,
        ) => {
          remove: () => void;
        };
        getPlace: () => {
          name?: string;
          formatted_address?: string;
          place_id?: string;
          geometry?: {
            location?: {
              lat: () => number;
              lng: () => number;
            };
          };
        };
      };
    };
  };
};

declare global {
  interface Window {
    google?: GoogleMapsBrowserApi;
    __bafafaGoogleMapsLoader?: Promise<void>;
  }
}

function loadGoogleMaps(apiKey: string) {
  if (typeof window === "undefined") return Promise.reject(new Error("Navegador indisponível."));
  if (window.google?.maps?.places) return Promise.resolve();
  if (window.__bafafaGoogleMapsLoader) return window.__bafafaGoogleMapsLoader;

  window.__bafafaGoogleMapsLoader = new Promise<void>((resolve, reject) => {
    const existing = document.querySelector<HTMLScriptElement>("script[data-bafafa-google-maps]");
    if (existing) {
      existing.addEventListener("load", () => resolve(), { once: true });
      existing.addEventListener(
        "error",
        () => reject(new Error("Falha ao carregar o Google Maps.")),
        {
          once: true,
        },
      );
      return;
    }

    const script = document.createElement("script");
    script.dataset.bafafaGoogleMaps = "true";
    script.async = true;
    script.defer = true;
    script.src = `https://maps.googleapis.com/maps/api/js?key=${encodeURIComponent(apiKey)}&libraries=places&v=weekly`;
    script.onload = () => resolve();
    script.onerror = () => reject(new Error("Falha ao carregar o Google Maps."));
    document.head.appendChild(script);
  });

  return window.__bafafaGoogleMapsLoader;
}

export function GoogleVenueSearch({
  onSelected,
}: {
  onSelected: (place: GooglePlaceResult) => void;
}) {
  const apiKey = String(import.meta.env.VITE_GOOGLE_MAPS_API_KEY ?? "").trim();
  const inputRef = useRef<HTMLInputElement>(null);
  const [ready, setReady] = useState(false);
  const [loadingLocation, setLoadingLocation] = useState(false);

  useEffect(() => {
    if (!apiKey || !inputRef.current) return;
    let listener: { remove: () => void } | undefined;
    let cancelled = false;

    void loadGoogleMaps(apiKey)
      .then(() => {
        if (cancelled || !inputRef.current || !window.google?.maps?.places) return;
        const autocomplete = new window.google.maps.places.Autocomplete(inputRef.current, {
          componentRestrictions: { country: "br" },
          fields: ["place_id", "formatted_address", "geometry", "name"],
        });
        listener = autocomplete.addListener("place_changed", () => {
          const place = autocomplete.getPlace();
          const location = place.geometry?.location;
          if (!location) {
            toast.error("Escolha uma opção sugerida pelo Google Maps.");
            return;
          }
          onSelected({
            name: String(place.name ?? place.formatted_address ?? "Local"),
            address: String(place.formatted_address ?? place.name ?? ""),
            placeId: place.place_id ? String(place.place_id) : null,
            latitude: Number(location.lat()),
            longitude: Number(location.lng()),
          });
        });
        setReady(true);
      })
      .catch(() => {
        if (!cancelled) toast.error("Não foi possível carregar a busca do Google Maps.");
      });

    return () => {
      cancelled = true;
      listener?.remove();
    };
  }, [apiKey, onSelected]);

  function useCurrentLocation() {
    if (!navigator.geolocation) {
      toast.error("Este aparelho não oferece localização pelo navegador.");
      return;
    }
    setLoadingLocation(true);
    navigator.geolocation.getCurrentPosition(
      (position) => {
        onSelected({
          name: "Local atual",
          address: "Local capturado pelo GPS do aparelho",
          placeId: null,
          latitude: position.coords.latitude,
          longitude: position.coords.longitude,
        });
        setLoadingLocation(false);
      },
      () => {
        toast.error("Não foi possível obter a localização atual.");
        setLoadingLocation(false);
      },
      { enableHighAccuracy: true, timeout: 12000, maximumAge: 0 },
    );
  }

  return (
    <div className="space-y-3 rounded-2xl border-2 border-primary/15 bg-primary/5 p-4">
      <div>
        <p className="flex items-center gap-2 font-bold">
          <MapPin className="h-4 w-4 text-primary" /> Encontrar local
        </p>
        <p className="mt-1 text-xs text-muted-foreground">
          Pesquise pelo nome do estabelecimento ou endereço. As coordenadas são preenchidas
          automaticamente.
        </p>
      </div>
      {apiKey ? (
        <div className="space-y-2">
          <Label htmlFor="google-place-search">Buscar no Google Maps</Label>
          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              ref={inputRef}
              id="google-place-search"
              className="pl-9"
              placeholder={ready ? "Ex.: Bafafá Bar, Natal" : "Carregando Google Maps…"}
              disabled={!ready}
              autoComplete="off"
            />
          </div>
        </div>
      ) : (
        <div className="rounded-xl bg-background/80 p-3 text-xs text-muted-foreground">
          A busca automática será ativada quando a variável
          <code className="mx-1 rounded bg-muted px-1 py-0.5">VITE_GOOGLE_MAPS_API_KEY</code>
          for configurada na Vercel e no arquivo local.
        </div>
      )}
      <Button
        type="button"
        variant="outline"
        onClick={useCurrentLocation}
        disabled={loadingLocation}
      >
        <LocateFixed className="h-4 w-4" />
        {loadingLocation ? "Localizando…" : "Usar localização atual"}
      </Button>
    </div>
  );
}
