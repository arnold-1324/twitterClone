import { useEffect, useRef, useState } from "react";

function stride(rail) {
  return rail.firstElementChild?.getBoundingClientRect().width + parseFloat(getComputedStyle(rail).columnGap);
}

export default function useShelfNavigation(length) {
  const track = useRef(null);
  const [position, setPosition] = useState({ first: 0, visible: 1, previous: false, next: false });
  const [measure] = useState(() => () => {
    const rail = track.current;
    if (!rail) return;
    const step = stride(rail);
    if (!(step > 0)) return;
    const { clientWidth, scrollLeft, scrollWidth } = rail;
    const first = Math.round(scrollLeft / step);
    const visible = Math.max(1, Math.round((clientWidth + parseFloat(getComputedStyle(rail).columnGap)) / step));
    const previous = scrollLeft > 1;
    const next = scrollLeft < scrollWidth - clientWidth - 1;
    setPosition((old) => old.first === first && old.visible === visible && old.previous === previous && old.next === next
      ? old : { first, visible, previous, next });
  });
  useEffect(() => {
    const rail = track.current;
    if (!rail) return;
    const observer = typeof ResizeObserver === "function" ? new ResizeObserver(measure) : null;
    observer?.observe(rail);
    if (!observer) window.addEventListener("resize", measure);
    measure();
    return () => {
      observer?.disconnect();
      if (!observer) window.removeEventListener("resize", measure);
    };
  }, [length, measure]);

  function move(direction) {
    const rail = track.current;
    if (!rail) return;
    const step = stride(rail);
    if (!(step > 0)) return;
    rail.scrollLeft = (Math.round(rail.scrollLeft / step) + direction) * step;
    measure();
  }

  return { track, position, measure, move };
}
