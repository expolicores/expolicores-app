// Sencillo bus compatible con RN (sin 'events' de Node)
import { NativeEventEmitter, NativeModules } from 'react-native';

const emitter = new NativeEventEmitter(NativeModules.RNEventEmitter || {});
type Handler = (payload?: any) => void;

const listeners: Record<string, Set<Handler>> = {};

export const bus = {
  on(event: string, handler: Handler) {
    if (!listeners[event]) listeners[event] = new Set();
    listeners[event].add(handler);
    return () => bus.off(event, handler);
  },
  off(event: string, handler: Handler) {
    listeners[event]?.delete(handler);
  },
  emit(event: string, payload?: any) {
    listeners[event]?.forEach((fn) => {
      try { fn(payload); } catch {}
    });
    // opcional: emite también por NativeEventEmitter (no imprescindible)
    try { (emitter as any).emit?.(event, payload); } catch {}
  },
};
