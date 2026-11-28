import "@fontsource/inter/latin-400.css";
import "@fontsource/work-sans/latin-400.css";
import "@fontsource/barlow-condensed/latin-400.css";
import "@fontsource/oswald/latin-400.css";
import "@fontsource/archivo-black/latin-400.css";
import "@fontsource/space-mono/latin-400.css";
import "@fontsource/playfair-display/latin-400.css";
import "@fontsource/cormorant-garamond/latin-400.css";
import "@fontsource/bebas-neue/latin-400.css";
import "@fontsource/comfortaa/latin-400.css";
import "@fontsource/raleway/latin-400.css";
import "@fontsource/quicksand/latin-400.css";
import "@fontsource/cinzel/latin-400.css";
import "@fontsource/permanent-marker/latin-400.css";

export const storyFonts = {
  "dm-sans": "DM Sans", nunito: "Nunito", fraunces: "Fraunces", "source-serif": "Source Serif 4",
  caveat: "Caveat", "ibm-plex": "IBM Plex Mono", inter: "Inter", "work-sans": "Work Sans",
  "barlow-condensed": "Barlow Condensed", oswald: "Oswald", "archivo-black": "Archivo Black",
  "space-mono": "Space Mono", "playfair-display": "Playfair Display", "cormorant-garamond": "Cormorant Garamond",
  "bebas-neue": "Bebas Neue", comfortaa: "Comfortaa", raleway: "Raleway", quicksand: "Quicksand",
  cinzel: "Cinzel", "permanent-marker": "Permanent Marker",
};

export function layerStyle(layer) {
  return {
    left: `${layer.x}%`, top: `${layer.y}%`, fontSize: `${layer.size}cqw`,
    color: layer.color, background: layer.fill ?? undefined, fontFamily: layer.font && `"${storyFonts[layer.font]}", sans-serif`,
  };
}

