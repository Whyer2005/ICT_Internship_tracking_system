import { test } from "node:test";
import assert from "node:assert/strict";
import {
  isAllowedMapsHost,
  parseCoordinateText,
  parseGoogleMapsUrl,
  resolveGoogleMapsLink,
} from "../src/utils/googleMapsLink";

test("parseCoordinateText อ่านพิกัดที่คัดลอกจาก Google Maps", () => {
  assert.deepEqual(parseCoordinateText("13.7563, 100.5018"), { lat: 13.7563, lng: 100.5018 });
  assert.deepEqual(parseCoordinateText(" 19.0300,99.8970 "), { lat: 19.03, lng: 99.897 });
  assert.equal(parseCoordinateText("100.5, 200.1"), null);
  assert.equal(parseCoordinateText("บริษัท เอ"), null);
});

test("parseGoogleMapsUrl เลือกตำแหน่งหมุด (!3d!4d) ก่อนจุดกึ่งกลางจอ (@)", () => {
  const url =
    "https://www.google.com/maps/place/%E0%B8%AA%E0%B8%B3%E0%B8%99%E0%B8%B1%E0%B8%81%E0%B8%87%E0%B8%B2%E0%B8%99/@13.8800,100.5600,15z/data=!4m6!3m5!1s0x0:0x0!8m2!3d13.8853123!4d100.5651234";
  assert.deepEqual(parseGoogleMapsUrl(url), { lat: 13.8853123, lng: 100.5651234 });
});

test("parseGoogleMapsUrl รองรับ ?q= / query= / /place/lat,lng / @lat,lng", () => {
  assert.deepEqual(parseGoogleMapsUrl("https://maps.google.com/?q=13.75,100.50"), { lat: 13.75, lng: 100.5 });
  assert.deepEqual(
    parseGoogleMapsUrl("https://www.google.com/maps/search/?api=1&query=18.7883%2C98.9853"),
    { lat: 18.7883, lng: 98.9853 }
  );
  assert.deepEqual(parseGoogleMapsUrl("https://www.google.com/maps/place/19.03,99.89"), { lat: 19.03, lng: 99.89 });
  assert.deepEqual(parseGoogleMapsUrl("https://www.google.co.th/maps/@13.7,100.5,17z"), { lat: 13.7, lng: 100.5 });
  assert.equal(parseGoogleMapsUrl("https://www.google.com/maps/place/บริษัท"), null);
});

test("isAllowedMapsHost รับเฉพาะโดเมนของ Google", () => {
  assert.equal(isAllowedMapsHost("maps.app.goo.gl"), true);
  assert.equal(isAllowedMapsHost("www.google.co.th"), true);
  assert.equal(isAllowedMapsHost("maps.google.com"), true);
  assert.equal(isAllowedMapsHost("evilgoogle.com"), false);
  assert.equal(isAllowedMapsHost("example.com"), false);
  assert.equal(isAllowedMapsHost("127.0.0.1"), false);
});

function fakeFetch(map: Record<string, string>) {
  const calls: string[] = [];
  const impl = (async (url: string) => {
    calls.push(String(url));
    const location = map[String(url)];
    return new Response(null, { status: location ? 302 : 200, headers: location ? { location } : {} });
  }) as unknown as typeof fetch;
  return { impl, calls };
}

test("resolveGoogleMapsLink ตาม redirect ของลิงก์ย่อจนได้พิกัด", async () => {
  const { impl, calls } = fakeFetch({
    "https://maps.app.goo.gl/abc123": "https://www.google.com/maps/place/X/@13.1,100.1,15z/data=!3d13.2!4d100.2",
  });
  assert.deepEqual(await resolveGoogleMapsLink("https://maps.app.goo.gl/abc123", impl), { lat: 13.2, lng: 100.2 });
  assert.equal(calls.length, 1);
});

test("resolveGoogleMapsLink ไม่เรียกเว็บที่ไม่ใช่ Google และไม่ตาม redirect ออกนอก Google", async () => {
  const { impl, calls } = fakeFetch({ "https://maps.app.goo.gl/evil": "http://169.254.169.254/latest/meta-data" });
  assert.equal(await resolveGoogleMapsLink("https://example.com/@13.1,100.1", impl), null);
  assert.equal(await resolveGoogleMapsLink("https://maps.app.goo.gl/evil", impl), null);
  assert.deepEqual(calls, ["https://maps.app.goo.gl/evil"]);
});

test("resolveGoogleMapsLink อ่านพิกัดตรง ๆ และลิงก์เต็มโดยไม่ต้องเรียกเน็ต", async () => {
  const { impl, calls } = fakeFetch({});
  assert.deepEqual(await resolveGoogleMapsLink("13.5, 100.5", impl), { lat: 13.5, lng: 100.5 });
  assert.deepEqual(await resolveGoogleMapsLink("https://www.google.com/maps?q=13.6,100.6", impl), { lat: 13.6, lng: 100.6 });
  assert.equal(calls.length, 0);
});
