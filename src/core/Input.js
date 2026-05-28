export class Input {
  constructor() {
    this.keys = new Set();
    this.pressed = new Set();
    window.addEventListener('keydown', e => {
      const key = e.key.toLowerCase();
      if (!this.keys.has(key)) this.pressed.add(key);
      this.keys.add(key);
    });
    window.addEventListener('keyup', e => this.keys.delete(e.key.toLowerCase()));
  }

  down(...keys) {
    return keys.some(key => this.keys.has(key));
  }

  justPressed(...keys) {
    return keys.some(key => this.pressed.has(key));
  }

  axis(negative, positive) {
    return (this.down(positive) ? 1 : 0) - (this.down(negative) ? 1 : 0);
  }

  endFrame() {
    this.pressed.clear();
  }
}
