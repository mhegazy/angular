export class TestIterable {
  list: any[];
  constructor() {
    this.list = [];
  }

  [Symbol.iterator]() {
    return this.list[Symbol.iterator]();
  }
}
