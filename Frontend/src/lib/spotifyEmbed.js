let apiRequest;

export function spotifyApi() {
  if (apiRequest) return apiRequest;
  apiRequest = new Promise((resolve, reject) => {
    const script = document.createElement("script");
    const ready = (api) => {
      clearTimeout(timeout);
      resolve(api);
    };
    function failed() {
      clearTimeout(timeout);
      script.remove();
      if (window.onSpotifyIframeApiReady === ready) delete window.onSpotifyIframeApiReady;
      reject(new Error("Spotify player could not initialize."));
    }
    const timeout = setTimeout(failed, 10000);
    window.onSpotifyIframeApiReady = ready;
    script.src = "https://open.spotify.com/embed/iframe-api/v1";
    script.async = true;
    script.onerror = failed;
    document.head.append(script);
  }).catch((error) => {
    apiRequest = undefined;
    throw error;
  });
  return apiRequest;
}
