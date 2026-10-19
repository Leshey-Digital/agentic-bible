# Specification delta

## Added requirements

- Jev credentials are resolved only server-side from encrypted integration storage and only for the same signed administrator identity that owns the stored record.
- Protected evaluation must stop before credential resolution or transport for invalid admin/origin requests. Missing, disabled, corrupt, or owner-mismatched credential state fails closed and returns no secret details.
- The Worker may mount Jev dispatch only when explicit server configuration names a supported pinned model, provides its matching Typesafe price card and currency caps, and supplies conservative token upper bounds. Missing configuration must not imply defaults or spending authority.
- Controlled transport failures make at most one provider attempt per request; the endpoint and model are server-controlled and response projection remains allowlisted.

## Acceptance scenarios

- Given valid vault configuration and a saved Jev credential, the exact signed owner can resolve it inside the server closure; another signed owner receives no credential.
- Given absent/invalid vault key, runtime policy, price identity, model or token bounds, the default Worker reports no Jev port. Given complete synthetic configuration with dispatch disabled, it reports disabled and makes no D1, credential or network call.
- Given an invalid signed assertion, cross-site origin, decryption failure or transport error, the request makes zero provider calls as applicable, returns a generic failure, and does not automatically retry.
- Given a controlled provider response, the route returns only the typed advisory decision fields and never credential, request content, provider extras or raw error details.

## Unchanged requirements

Jev is a structured decision model, not an article prose generator or publication authority. No live provider call, credential setup, numeric spending cap, deployment, public submission activation, or release-gate change is authorized by this code change.
