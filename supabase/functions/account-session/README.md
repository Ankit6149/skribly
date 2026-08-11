# Account session Edge Function

Deploy with JWT verification enabled. The function requires the project-provided Supabase URL,
anon key, and service-role key. Entitlement signing material is loaded from either:

- `SKRIBLY_ENTITLEMENT_PRIVATE_JWK`: a JSON-encoded Ed25519 private JWK; or
- the service-role-only `skribly_get_entitlement_signing_jwk()` RPC created by the private signing
  key migration.

Provision the private JWK out of band. Never put its value in a migration, Edge Function, client
bundle, issue, log, or commit. Owner authorization is read only from trusted Auth `app_metadata`;
client-provided metadata is never accepted as an authorization signal.

The matching raw 32-byte public key must be embedded in the Windows build through
`SKRIBLY_LICENSE_PUBLIC_KEY` as unpadded base64url. Never commit the private JWK.
