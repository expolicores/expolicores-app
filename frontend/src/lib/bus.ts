// frontend/src/lib/bus.ts
// Event bus minimalista compatible con React Native/Expo (sin Node stdlib)

type Handler<T extends any[] = any[]> = (...args: T) => void;

class TinyBus {
  private map: Record<string, Set<Handler>> = Object.create(null);

  on<T extends any[]>(event: string, handler: Handler<T>) {
    if (!this.map[event]) this.map[event] = new Set();
    this.map[event].add(handler as Handler);
  }

  off<T extends any[]>(event: string, handler: Handler<T>) {
    const set = this.map[event];
    if (!set) return;
    set.delete(handler as Handler);
    if (set.size === 0) delete this.map[event];
  }

  once<T extends any[]>(event: string, handler: Handler<T>) {
    const wrap: Handler<T> = (...args: T) => {
      this.off(event, wrap);
      handler(...args);
    };
    this.on(event, wrap);
  }

  emit<T extends any[]>(event: string, ...args: T) {
    const set = this.map[event];
    if (!set || set.size === 0) return;
    // clonar para evitar problemas si se desuscriben durante el emit
    [...set].forEach((h) => {
      try {
        (h as Handler<T>)(...args);
      } catch (e) {
        // evitar romper a otros handlers
        console.warn('[bus] handler error', e);
      }
    });
  }

  removeAll(event?: string) {
    if (event) {
      delete this.map[event];
    } else {
      this.map = Object.create(null);
    }
  }
}

export const bus = new TinyBus();
export default bus;
