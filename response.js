// response.js
class Response {
    constructor(message) {
      this.message = message;
      this.stream = null;
    }
  
    getFullMessage() {
      return this.message;
    }
  
    setStream(stream) {
      this.stream = stream;
    }
  
    async *getStream() {
      if (this.stream) {
        yield* this.stream;
      } else {
        yield this.message;
      }
    }
  }
  
  module.exports = Response;