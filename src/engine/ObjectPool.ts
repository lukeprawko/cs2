/**
 * Fixed-capacity ring-buffer Object Pool to guarantee zero allocations
 * during per-frame particle, tracer, shell casing, and decal updates.
 */
export class ObjectPool<T extends { active: boolean }> {
  private items: T[] = [];
  private cursor = 0;

  constructor(capacity: number, factory: (index: number) => T) {
    for (let i = 0; i < capacity; i++) {
      this.items.push(factory(i));
    }
  }

  public acquire(): T {
    const len = this.items.length;
    for (let i = 0; i < len; i++) {
      const idx = (this.cursor + i) % len;
      if (!this.items[idx].active) {
        this.cursor = (idx + 1) % len;
        this.items[idx].active = true;
        return this.items[idx];
      }
    }
    // Overwrite oldest item in ring buffer
    const item = this.items[this.cursor];
    this.cursor = (this.cursor + 1) % len;
    item.active = true;
    return item;
  }

  public getAll(): readonly T[] {
    return this.items;
  }

  public clearAll(): void {
    for (let i = 0; i < this.items.length; i++) {
      this.items[i].active = false;
    }
  }
}
