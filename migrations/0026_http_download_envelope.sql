-- Additive single-statement migration. Historical byte values and table dependencies remain unchanged.
ALTER TABLE http_request_reservations ADD COLUMN actual_download_bytes INTEGER CHECK(actual_download_bytes BETWEEN 0 AND 1048576);
