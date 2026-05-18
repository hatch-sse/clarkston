export class Input {
  constructor() {
    this.keys = new Set();
    window.addEventListener('keydown', e => this.keys.add(e.key.toLowerCase()));
    window.addEventListener('keyup', e => this.keys.delete(e.key.toLowerCase()));
  }

  down(...keys) {
    return keys.some(key => this.keys.has(key));
  }

  axis(negative, positive) {
    return (this.down(positive) ? 1 : 0) - (this.down(negative) ? 1 : 0);
  }
}
