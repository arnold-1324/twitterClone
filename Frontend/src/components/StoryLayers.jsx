import { layerStyle } from "../lib/storyFonts";

export default function StoryLayers({ composition }) {
  return composition?.layers?.map((layer, index) => <span key={index} className={`story-layer story-layer-${layer.kind}`}
    style={layerStyle(layer)}>{layer.text}</span>);
}
