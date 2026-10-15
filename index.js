import { TypertRemoteService } from "@deepseek-ai/dsh-typert-protocol";
import { z } from "zod";
import { prepareRegistration } from "./lib/registration-guard.js";
import { REGISTRATION_SERVICE, registrationDescriptor } from "./lib/registration-wire.js";

export const name = "dsh-custom-provider";
export const inject = ["typert", "loader", "profileContext"];
const resultSchema = z.strictObject({ repaired: z.boolean(), blocked: z.string().optional() });
const resultCodec = { mode: "strict", typeSymbol: "dsh-custom-provider#RegistrationStatus", create: () => resultSchema };

class ProviderRegistration extends TypertRemoteService {
  constructor(ctx) { super(ctx, REGISTRATION_SERVICE); }
  prepare() { return prepareRegistration(this.ctx); }
}

export function apply(ctx) {
  new ProviderRegistration(ctx);
  ctx.effect(() => ctx.typert.register({
    package: name, face: "host", schemas: [], invocations: [registrationDescriptor(resultCodec)]
  }), "dsh-custom-provider: registration guard");
}
