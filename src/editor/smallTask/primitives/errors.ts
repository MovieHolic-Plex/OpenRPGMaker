import { SmallTaskError } from "../target";

export class PrimitiveError extends SmallTaskError {
  constructor(message: string) {
    super(message);
    this.name = "PrimitiveError";
  }
}
