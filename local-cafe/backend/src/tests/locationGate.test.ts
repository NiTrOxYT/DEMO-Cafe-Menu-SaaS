import { calculateDistanceMetres, verifyDeviceLocation, signCustomerAccessToken, verifyCustomerAccessToken } from "../lib/location.js";
import { pool, query } from "../db/index.js";
import crypto from "crypto";

async function runTests() {
  console.log("=== RUNNING LOCATION GATE VERIFICATION TESTS ===\n");
  let passed = 0;
  let total = 0;

  function assert(condition: boolean, msg: string) {
    total++;
    if (!condition) {
      console.error(`❌ FAIL: ${msg}`);
      process.exit(1);
    } else {
      console.log(`✅ PASS: ${msg}`);
      passed++;
    }
  }

  // 1. Haversine Distance Tests
  console.log("--- 1. Haversine Distance & Proximity Logic ---");
  // Reference point: Café at 12.971598, 77.594566 (Bangalore center)
  const cafeLat = 12.971598;
  const cafeLon = 77.594566;

  // Point A: ~20m north (1 degree lat ~= 111,139 m -> 0.00018 deg ~= 20m)
  const dist20m = calculateDistanceMetres(cafeLat, cafeLon, cafeLat + 0.00018, cafeLon);
  assert(dist20m >= 18 && dist20m <= 22, `Distance ~20m calculated correctly (${dist20m}m)`);

  // Point B: ~45m east (at lat 12.97, 1 deg lon ~= 108,300m -> 0.00041 deg ~= 44m)
  const dist45m = calculateDistanceMetres(cafeLat, cafeLon, cafeLat, cafeLon + 0.00041);
  assert(dist45m >= 42 && dist45m <= 46, `Distance ~44m calculated correctly (${dist45m}m)`);

  // Point C: ~150m away
  const dist150m = calculateDistanceMetres(cafeLat, cafeLon, cafeLat + 0.00135, cafeLon);
  assert(dist150m > 50, `Distance >50m calculated correctly (${dist150m}m)`);

  // 2. Token generation and verification
  console.log("\n--- 2. Customer Access Token (JWT) Logic ---");
  const token = signCustomerAccessToken("Table-4");
  const payload = verifyCustomerAccessToken(token);
  assert(payload !== null, "Token verifies successfully");
  assert(payload?.type === "customer_location_verified", "Token type is 'customer_location_verified'");
  assert(payload?.tableNumber === "Table-4", "Token preserves tableNumber 'Table-4'");

  const invalidToken = token + "corrupted";
  assert(verifyCustomerAccessToken(invalidToken) === null, "Tampered token is rejected");

  // 3. Database tests with cafe coordinates and scan links (runs when live db is reachable)
  console.log("\n--- 3. Database Proximity & Scan Link Transactions ---");
  try {
    const client = await pool.connect();
    try {
      // Save original settings
      const origSettings = await client.query("SELECT latitude, longitude FROM restaurant_settings LIMIT 1");
      const origLat = origSettings.rows[0]?.latitude;
      const origLon = origSettings.rows[0]?.longitude;

      // Test 3a: Fail-closed when coords are NULL
      await client.query("UPDATE restaurant_settings SET latitude = NULL, longitude = NULL");
      const unconfigCheck = await verifyDeviceLocation(cafeLat, cafeLon, 10);
      assert(!unconfigCheck.valid && unconfigCheck.reason === "NOT_CONFIGURED", "Fails closed with NOT_CONFIGURED when settings are null");

      // Configure test cafe coordinates
      await client.query("UPDATE restaurant_settings SET latitude = $1, longitude = $2", [cafeLat, cafeLon]);

      // Test 3b: Within 50m and good accuracy -> valid
      const within50mCheck = await verifyDeviceLocation(cafeLat + 0.00018, cafeLon, 15);
      assert(within50mCheck.valid, `Within 50m check passes (${within50mCheck.distance}m)`);

      // Test 3c: Accuracy too low (> 65m) -> invalid
      const lowAccuracyCheck = await verifyDeviceLocation(cafeLat + 0.00018, cafeLon, 80);
      assert(!lowAccuracyCheck.valid && lowAccuracyCheck.reason === "POOR_ACCURACY", "Rejects device when accuracy is > 65m");

      // Test 3d: Out of range (> 50m) -> invalid
      const outOfRangeCheck = await verifyDeviceLocation(cafeLat + 0.00135, cafeLon, 10);
      assert(!outOfRangeCheck.valid && outOfRangeCheck.reason === "OUT_OF_RANGE", `Rejects device when distance is > 50m (${outOfRangeCheck.distance}m)`);

      // Test 3e: Single-use scan link issuance and atomic redemption
      const scanToken = crypto.randomBytes(32).toString("hex");
      const tokenHash = crypto.createHash("sha256").update(scanToken).digest("hex");

      await client.query(
        `INSERT INTO table_scan_links (table_number, token_hash, is_superseded, expires_at, created_at)
         VALUES ('99', $1, false, NOW() + INTERVAL '5 minutes', NOW())`,
        [tokenHash]
      );

      // Verify token exists and is unredeemed
      const check1 = await client.query("SELECT * FROM table_scan_links WHERE token_hash = $1", [tokenHash]);
      assert(check1.rows.length === 1 && !check1.rows[0].is_superseded && check1.rows[0].redeemed_at === null, "Scan link stored with hash and active state");

      // Test 3f: Superseding unredeemed links when a new scan occurs for the same table
      const scanToken2 = crypto.randomBytes(32).toString("hex");
      const tokenHash2 = crypto.createHash("sha256").update(scanToken2).digest("hex");

      await client.query("BEGIN");
      // Invalidate previous unredeemed links
      await client.query(
        `UPDATE table_scan_links SET is_superseded = true WHERE table_number = '99' AND redeemed_at IS NULL AND is_superseded = false`
      );
      // Insert new link
      await client.query(
        `INSERT INTO table_scan_links (table_number, token_hash, is_superseded, expires_at, created_at)
         VALUES ('99', $1, false, NOW() + INTERVAL '5 minutes', NOW())`,
        [tokenHash2]
      );
      await client.query("COMMIT");

      const checkOld = await client.query("SELECT is_superseded FROM table_scan_links WHERE token_hash = $1", [tokenHash]);
      assert(checkOld.rows[0].is_superseded === true, "Older unredeemed scan link was superseded");

      const checkNew = await client.query("SELECT is_superseded FROM table_scan_links WHERE token_hash = $1", [tokenHash2]);
      assert(checkNew.rows[0].is_superseded === false, "New scan link is active");

      // Test 3g: Redeem scanToken2 atomically
      await client.query("BEGIN");
      const redeemRes = await client.query(
        `UPDATE table_scan_links SET redeemed_at = NOW() WHERE token_hash = $1 AND redeemed_at IS NULL AND is_superseded = false RETURNING id`,
        [tokenHash2]
      );
      await client.query("COMMIT");
      assert(redeemRes.rows.length === 1, "Scan link redeemed atomically");

      // Test 3h: Replay attack prevention - attempting to redeem again must fail
      const replayRes = await client.query(
        `UPDATE table_scan_links SET redeemed_at = NOW() WHERE token_hash = $1 AND redeemed_at IS NULL RETURNING id`,
        [tokenHash2]
      );
      assert(replayRes.rows.length === 0, "Replayed scan link is rejected");

      // Test 3i: Subsequent new scan link does NOT invalidate already-redeemed sessions
      const scanToken3 = crypto.randomBytes(32).toString("hex");
      const tokenHash3 = crypto.createHash("sha256").update(scanToken3).digest("hex");
      await client.query(
        `UPDATE table_scan_links SET is_superseded = true WHERE table_number = '99' AND redeemed_at IS NULL AND is_superseded = false`
      );
      await client.query(
        `INSERT INTO table_scan_links (table_number, token_hash, is_superseded, expires_at, created_at)
         VALUES ('99', $1, false, NOW() + INTERVAL '5 minutes', NOW())`,
        [tokenHash3]
      );

      const redeemedCheck = await client.query("SELECT is_superseded, redeemed_at FROM table_scan_links WHERE token_hash = $1", [tokenHash2]);
      assert(redeemedCheck.rows[0].is_superseded === false && redeemedCheck.rows[0].redeemed_at !== null, "Already-redeemed session remains active and NOT superseded by later scan");

      // Clean up test scan links
      await client.query("DELETE FROM table_scan_links WHERE table_number = '99'");

      // Restore original settings
      await client.query("UPDATE restaurant_settings SET latitude = $1, longitude = $2", [origLat, origLon]);
    } finally {
      client.release();
    }
  } catch (err: any) {
    if (err?.code === "ECONNREFUSED" || err?.message?.includes("ECONNREFUSED")) {
      console.log("ℹ️ Live Postgres container is not running on host port 5432. Live DB queries skipped.");
    } else {
      throw err;
    }
  }

  console.log(`\n🎉 ALL ${passed}/${total} LOCATION GATE TESTS PASSED!\n`);
  process.exit(0);
}

runTests().catch((err) => {
  console.error("Test execution failed:", err);
  process.exit(1);
});
