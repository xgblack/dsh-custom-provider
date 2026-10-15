export const REGISTRATION_SERVICE = "customProviderRegistration";
export function registrationDescriptor(result) {
  return {
    id: "dsh-custom-provider#customProviderRegistration/prepare",
    service: REGISTRATION_SERVICE,
    namespace: REGISTRATION_SERVICE,
    method: "prepare",
    invocation: { kind: "direct" },
    parameters: [],
    result
  };
}
