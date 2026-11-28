import { createStore } from "redux";
import { useSelector, useStore } from "react-redux";

export function defineState({ key, default: initial, persist }) {
  return { key, initial, persist };
}

const setters = new WeakMap();

export function useAppValue(field) {
  return useSelector((state) => Object.hasOwn(state, field.key) ? state[field.key] : field.initial);
}

export function useSetAppValue(field) {
  const store = useStore();
  let fields = setters.get(store);
  if (!fields) {
    fields = new Map();
    setters.set(store, fields);
  }
  if (!fields.has(field)) {
    fields.set(field, (change) => {
      const state = store.getState();
      const previous = Object.hasOwn(state, field.key) ? state[field.key] : field.initial;
      const value = typeof change === "function" ? change(previous) : change;
      if (Object.is(value, previous)) return;
      store.dispatch({ type: `app/${field.key}/set`, key: field.key, value });
      field.persist?.(value);
    });
  }
  return fields.get(field);
}

export function useAppState(field) {
  return [useAppValue(field), useSetAppValue(field)];
}

export function makeAppStore() {
  return createStore((state = {}, action) => action.type.startsWith("app/")
    ? { ...state, [action.key]: action.value } : state);
}
