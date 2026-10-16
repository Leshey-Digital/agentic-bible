# Stricter topic type requirement

- Article topic is exactly a primitive string in Foundations, Capabilities or Protocols. Reject arrays (including nested singleton arrays), objects, null, booleans, numbers and other strings with invalid_topic, without coercion.
- Rejection occurs before event claim, snapshot/revision output or activation. Existing pointer bytes, complete file inventory/hashes, manifest state, receipt list and operation sequence remain unchanged. A technically corrected retry may use the rejected event ID.
- Existing valid string topics continue publishing automatically with post-publication flags. Local collection, replay, atomic activation, rollback and production limitations remain unchanged.
