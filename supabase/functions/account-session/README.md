# Account session Edge Function

Deploy with JWT verification enabled. The function requires the project-provided Supabase URL,
anon key, and service-role key plus one custom secret:

- `SKRIBLY_ENTITLEMENT_PRIVATE_JWK`: a JSON-encoded Ed25519 private JWK.

The matching raw 32-byte public key must be embedded in the Windows build through
`SKRIBLY_LICENSE_PUBLIC_KEY` as unpadded base64url. Never commit the private JWK.
