import assert from "node:assert/strict";
import { test } from "node:test";
import { createApp } from "../src/app.js";
import { getEncounterSummary } from "../src/domain.js";
import { simulatePatientJourneyCohort } from "../src/journey.js";
import { createSeedState } from "../src/seed.js";

async function withServer(t, appOptions = {}) {
  const server = createApp(appOptions);
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  t.after(() => new Promise((resolve) => server.close(resolve)));

  const { port } = server.address();
  return {
    server,
    baseUrl: `http://127.0.0.1:${port}`
  };
}

async function getJson(url, options = {}) {
  const response = await fetch(url, options);
  const body = await response.json();
  return { response, body };
}

function assertChinaHospitalDisplayText(value) {
  const text = JSON.stringify(value);
  const forbiddenBusinessWords = [
    "Standby",
    "Active",
    "Passed",
    "Prepared",
    "Issued",
    "NoInfection",
    "InProgress",
    "Stable",
    "Delivered",
    "Accepted",
    "Coded",
    "Matched",
    "TransferredOut",
    "Ready",
    "Paid",
    "Unpaid",
    "Draft",
    "Final"
  ];
  for (const word of forbiddenBusinessWords) {
    assert.equal(text.includes(word), false, `摘要不应出现英文业务状态 ${word}`);
  }
  assert.equal(/\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/.test(text), false, "摘要时间不应为 ISO 格式");
}

test("returns seeded surgery schedules", async (t) => {
  const { baseUrl } = await withServer(t);
  const { response, body } = await getJson(`${baseUrl}/api/v1/surgery-schedules?date=2026-05-16`);

  assert.equal(response.status, 200);
  assert.equal(body.total, 2);
  assert.equal(body.items[0].patient.name, "张某某");
});

test("serves the built-in console", async (t) => {
  const { baseUrl } = await withServer(t);
  const response = await fetch(`${baseUrl}/console`);
  const html = await response.text();

  assert.equal(response.status, 200);
  assert.match(html, /首视医院业务仿真平台/);
  assert.match(html, /id="clock"/);
  assert.match(html, /formatClock/);
  assert.match(html, /模拟100病人/);
  assert.match(html, /家属等待区大屏/);
  assert.match(response.headers.get("content-type"), /text\/html/);
});

test("serves the family waiting area display", async (t) => {
  const { baseUrl } = await withServer(t);
  const response = await fetch(`${baseUrl}/family-waiting-display`);
  const html = await response.text();

  assert.equal(response.status, 200);
  assert.match(html, /手术室家属等待区信息/);
  assert.match(html, /55 寸 4K/);
  assert.match(html, /自动翻页/);
  assert.match(html, /安心提示/);
  assert.match(html, /服务信息/);
  assert.match(html, /患者信息已脱敏/);
  assert.match(html, /case-grid/);
  assert.match(html, /脱敏/);
  assert.match(html, /id="clock"/);
  assert.match(html, /formatClock/);
  assert.match(html, /family-tv-simulator/);
  assert.match(html, /data-resolution="3840x2160"/);
  assert.match(html, /tv-screen/);
  assert.match(html, /screen-content/);
  assert.match(html, /width: 3840px/);
  assert.match(html, /height: 2160px/);
  assert.match(html, /fitTelevisionFrame/);
  assert.match(response.headers.get("content-type"), /text\/html/);
});

test("serves operating room and quality dashboards", async (t) => {
  const { baseUrl } = await withServer(t);
  const pages = [
    ["/or-door-display", /手术室门口屏看板/],
    ["/or-inner-control?roomId=OR01", /手术室内状态控制端/],
    ["/or-terminal-simulator", /手术室多终端联调模拟台/],
    ["/or-nurse-station-display", /手术部护士站看板/],
    ["/director-quality-display", /院长质控看板/]
  ];

  for (const [path, title] of pages) {
    const response = await fetch(`${baseUrl}${path}`);
    const html = await response.text();
    assert.equal(response.status, 200);
    assert.match(html, title);
    assert.match(html, /id="clock"/);
    assert.match(html, /formatClock/);
    assert.match(response.headers.get("content-type"), /text\/html/);
    if (path === "/or-door-display") {
      assert.match(html, /door-display-shell/);
      assert.match(html, /door-device-terminal/);
      assert.match(html, /data-device-size="13\.3寸竖屏"/);
      assert.match(html, /data-resolution="1080x1920"/);
      assert.match(html, /door-device-lightbar/);
      assert.match(html, /door-device-screen-wrap/);
      assert.match(html, /door-speaker/);
      assert.match(html, /护理 nursing/);
      assert.match(html, /呼叫 call/);
      assert.match(html, /door-calm-ribbon/);
      assert.match(html, /请保持安静/);
      assert.match(html, /当前手术/);
      assert.match(html, /下一台/);
      assert.match(html, /发起通话/);
      assert.match(html, /PM2\.5/);
    }
    if (path === "/or-inner-control?roomId=OR01") {
      assert.match(html, /or-control-shell/);
      assert.match(html, /室内终端只控制本手术间状态/);
      assert.match(html, /DEV000003|deviceId/);
    }
    if (path === "/or-terminal-simulator") {
      assert.match(html, /室内控制终端/);
      assert.match(html, /家属等待区/);
      assert.match(html, /院领导看板/);
      assert.match(html, /data-resolution="1080x1920"/);
      assert.match(html, /data-resolution="3840x2160"/);
      assert.match(html, /3840\*2160 横屏/);
      assert.doesNotMatch(html, /3820x2160|3820\*2160/);
      assert.match(html, /sim-device-portrait/);
      assert.match(html, /sim-device-landscape/);
      assert.match(html, /family-mini/);
      assert.match(html, /安心等候/);
      assert.match(html, /terminal-inner-theme/);
      assert.match(html, /terminal-door-theme/);
      assert.match(html, /terminal-nurse-theme/);
      assert.match(html, /terminal-director-theme/);
      assert.match(html, /door-mini-quiet/);
      assert.match(html, /nurse-mini-head/);
      assert.match(html, /director-mini-head/);
    }
    if (path === "/or-nurse-station-display") {
      assert.match(html, /nurse-station-shell/);
    }
    if (path === "/director-quality-display") {
      assert.match(html, /director-dashboard-shell/);
    }
  }
});

test("exports a de-identified vendor read-only database snapshot", async (t) => {
  const { baseUrl } = await withServer(t);

  const sync = await getJson(`${baseUrl}/api/v1/vendor-db/sync`, {
    method: "POST",
    headers: { "content-type": "application/json" }
  });
  assert.equal(sync.response.status, 201);
  assert.equal(sync.body.是否已生成, true);
  assert.equal(sync.body.访问模式, "厂商只读快照");
  assert.ok(sync.body.数据视图.some((item) => item.视图名称 === "vendor_surgery_schedule"));

  const schedules = await getJson(`${baseUrl}/api/v1/vendor-db/views/vendor_surgery_schedule?pageSize=5&date=2026-05-16`);
  assert.equal(schedules.response.status, 200);
  assert.ok(schedules.body.记录总数 >= 2);
  assert.equal(Object.hasOwn(schedules.body.数据项[0], "手术状态"), true);
  assert.match(schedules.body.数据项[0].手术状态, /已排班|已接台|已入室|麻醉开始|手术开始|手术结束|已出室|已完成/);
  assert.equal(/\d{4}-\d{2}-\d{2}T\d{2}:\d{2}/.test(JSON.stringify(schedules.body)), false);
  assertChinaHospitalDisplayText(schedules.body);

  const schema = await fetch(`${baseUrl}/api/v1/vendor-db/schema.sql`);
  const schemaText = await schema.text();
  assert.equal(schema.status, 200);
  assert.match(schema.headers.get("content-type"), /text\/plain/);
  assert.match(schemaText, /CREATE TABLE vendor_surgery_schedule/);
  assert.match(schemaText, /"手术状态" TEXT/);

  const download = await fetch(`${baseUrl}/api/v1/vendor-db/download`);
  const bytes = Buffer.from(await download.arrayBuffer());
  assert.equal(download.status, 200);
  assert.equal(download.headers.get("content-type"), "application/vnd.sqlite3");
  assert.equal(bytes.subarray(0, 16).toString("ascii"), "SQLite format 3\u0000");
});

test("runs a Beijing-time natural hospital operation engine", async (t) => {
  const { baseUrl } = await withServer(t, {
    enableNaturalOperation: true,
    naturalOperation: {
      patientCount: 20,
      roomCount: 4,
      dailyNewPatients: 0,
      tickIntervalMs: 0,
      operationDate: "2026-05-16",
      now: "2026-05-16T12:00:00+08:00",
      maxStepsPerTick: 30
    }
  });

  const status = await getJson(`${baseUrl}/api/v1/hospital-operation/status`);
  assert.equal(status.response.status, 200);
  assert.equal(status.body.运行状态, "已启用");
  assert.equal(status.body.当前业务日期, "2026-05-16");
  assert.equal(status.body.目标在院模拟人数, 20);
  assert.equal(status.body.开放手术间数量, 4);
  assert.equal(status.body.患者流转摘要.total, 20);
  assert.ok(status.body.手术负荷.今日手术台次 > 0);
  assertChinaHospitalDisplayText(status.body);

  const tick = await getJson(`${baseUrl}/api/v1/hospital-operation/tick`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      operationDate: "2026-05-16",
      now: "2026-05-16T23:00:00+08:00",
      maxStepsPerTick: 40
    })
  });
  assert.equal(tick.response.status, 200);
  assert.ok(tick.body.本次推进步骤数 > 0);
  assert.equal(tick.body.患者流转摘要.total, 20);
  assertChinaHospitalDisplayText(tick.body);

  const schedules = await getJson(`${baseUrl}/api/v1/surgery-schedules?date=2026-05-16&pageSize=50`);
  assert.ok(schedules.body.total > 0);
});

test("uses a moderate default natural operation scale for demos", async (t) => {
  const { baseUrl } = await withServer(t, {
    enableNaturalOperation: true,
    naturalOperation: {
      tickIntervalMs: 0,
      operationDate: "2026-05-16",
      now: "2026-05-16T12:00:00+08:00"
    }
  });

  const status = await getJson(`${baseUrl}/api/v1/hospital-operation/status`);
  assert.equal(status.response.status, 200);
  assert.equal(status.body.目标在院模拟人数, 50);
  assert.equal(status.body.开放手术间数量, 6);
  assert.equal(status.body.今日计划入院人数, 6);
  assert.equal(status.body.患者流转摘要.total, 50);
});

test("protects vendor database endpoints when an interface key is configured", async (t) => {
  const previousKeys = process.env.SMARTHIS_VENDOR_API_KEYS;
  process.env.SMARTHIS_VENDOR_API_KEYS = "vendor-secret";
  t.after(() => {
    if (previousKeys === undefined) {
      delete process.env.SMARTHIS_VENDOR_API_KEYS;
    } else {
      process.env.SMARTHIS_VENDOR_API_KEYS = previousKeys;
    }
  });

  const { baseUrl } = await withServer(t);
  const unauthenticated = await fetch(`${baseUrl}/api/v1/vendor-db`);
  assert.equal(unauthenticated.status, 401);

  const authenticated = await getJson(`${baseUrl}/api/v1/vendor-db`, {
    headers: { "x-api-key": "vendor-secret" }
  });
  assert.equal(authenticated.response.status, 200);
  assert.equal(authenticated.body.接口授权.授权模式, "接口密钥已校验");
});

test("updates surgery status and records an event", async (t) => {
  const { baseUrl } = await withServer(t);
  const { response, body } = await getJson(`${baseUrl}/api/v1/surgery-schedules/SCH000002/status`, {
    method: "PATCH",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      status: "已入室",
      sourceSystem: "首视手术部",
      operatorCode: "N001"
    })
  });

  assert.equal(response.status, 200);
  assert.equal(body.accepted, true);
  assert.equal(body.status, "已入室");
  assert.match(body.eventId, /^EVT/);

  const events = await getJson(`${baseUrl}/api/v1/surgery-schedules/SCH000002/events`);
  assert.equal(events.body.total, 1);
  assert.equal(events.body.items[0].eventType, "已入室");
});

test("manages operating room terminals and heartbeat status", async (t) => {
  const { baseUrl } = await withServer(t);
  const terminals = await getJson(`${baseUrl}/api/v1/or-terminals?roomId=OR01`);

  assert.equal(terminals.response.status, 200);
  assert.equal(terminals.body.total, 2);
  assert.equal(terminals.body.items.some((item) => item.terminalType === "室内控制终端"), true);
  assert.equal(terminals.body.items.some((item) => item.terminalType === "门口展示终端"), true);
  assert.equal(JSON.stringify(terminals.body).includes("Online"), false);

  const heartbeat = await getJson(`${baseUrl}/api/v1/or-terminals/DEV000002/heartbeat`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      status: "离线",
      heartbeatTime: "2026-05-16T09:30:00+08:00"
    })
  });

  assert.equal(heartbeat.response.status, 200);
  assert.equal(heartbeat.body.status, "离线");
  assert.equal(heartbeat.body.lastHeartbeatTime, "2026-05-16 09:30");
});

test("validates terminal permissions, room binding and idempotent surgery updates", async (t) => {
  const { baseUrl } = await withServer(t);

  const doorDenied = await getJson(`${baseUrl}/api/v1/surgery-schedules/SCH000002/status`, {
    method: "PATCH",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      status: "已接台",
      deviceId: "DEV000004",
      operatorId: "PRA004"
    })
  });
  assert.equal(doorDenied.response.status, 403);
  assert.match(doorDenied.body.message, /没有手术状态写权限/);

  const crossRoomDenied = await getJson(`${baseUrl}/api/v1/surgery-schedules/SCH000002/status`, {
    method: "PATCH",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      status: "已接台",
      deviceId: "DEV000001",
      operatorId: "PRA004"
    })
  });
  assert.equal(crossRoomDenied.response.status, 403);
  assert.match(crossRoomDenied.body.message, /不能控制 OR02/);

  const illegalJump = await getJson(`${baseUrl}/api/v1/surgery-schedules/SCH000002/status`, {
    method: "PATCH",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      status: "手术开始",
      deviceId: "DEV000003",
      operatorId: "PRA004"
    })
  });
  assert.equal(illegalJump.response.status, 409);
  assert.equal(illegalJump.body.details.当前状态, "已排班");
  assert.deepEqual(illegalJump.body.details.允许下一状态, ["已接台", "已取消"]);

  const first = await getJson(`${baseUrl}/api/v1/surgery-schedules/SCH000002/status`, {
    method: "PATCH",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      status: "已接台",
      deviceId: "DEV000003",
      operatorId: "PRA004",
      idempotencyKey: "DEV000003-SCH000002-CALLED"
    })
  });
  assert.equal(first.response.status, 200);
  assert.equal(first.body.accepted, true);
  assert.equal(first.body.idempotent, false);

  const second = await getJson(`${baseUrl}/api/v1/surgery-schedules/SCH000002/status`, {
    method: "PATCH",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      status: "已接台",
      deviceId: "DEV000003",
      operatorId: "PRA004",
      idempotencyKey: "DEV000003-SCH000002-CALLED"
    })
  });
  assert.equal(second.response.status, 200);
  assert.equal(second.body.idempotent, true);
  assert.equal(second.body.eventId, first.body.eventId);

  const events = await getJson(`${baseUrl}/api/v1/surgery-schedules/SCH000002/events`);
  assert.equal(events.body.total, 1);
  assert.equal(events.body.items[0].deviceId, "DEV000003");
});

test("serves role-specific operating room display snapshots without family privacy leakage", async (t) => {
  const { baseUrl } = await withServer(t);

  const door = await getJson(`${baseUrl}/api/v1/or-display/rooms/OR01/door-snapshot`);
  assert.equal(door.response.status, 200);
  assert.equal(door.body.display.roomName, "1 号手术间");
  assert.equal(door.body.display.displayStatus, "手术开始");
  assert.equal(door.body.display.patientName, "张**");
  assert.equal(JSON.stringify(door.body).includes("idCardNo"), false);

  const family = await getJson(`${baseUrl}/api/v1/or-display/family-waiting-snapshot?date=2026-05-16`);
  const familyText = JSON.stringify(family.body);
  assert.equal(family.response.status, 200);
  assert.equal(family.body.items.some((item) => item.displayStatus === "手术中"), true);
  assert.equal(familyText.includes("inpatientNo"), false);
  assert.equal(familyText.includes("idCardNo"), false);
  assert.equal(familyText.includes("138000"), false);
  assert.equal(familyText.includes("胆囊结石"), false);
  assert.equal(familyText.includes("腹腔镜胆囊切除术"), false);

  const nurse = await getJson(`${baseUrl}/api/v1/or-display/nurse-station-snapshot?date=2026-05-16`);
  assert.equal(nurse.response.status, 200);
  assert.equal(nurse.body.surgeries.some((item) => item.patientName === "张某某"), true);
  assert.equal(nurse.body.terminals.some((item) => item.terminalType === "门口展示终端"), true);

  const director = await getJson(`${baseUrl}/api/v1/or-display/director-dashboard-snapshot?date=2026-05-16`);
  assert.equal(director.response.status, 200);
  assert.equal(director.body.metrics.今日手术台次, 2);
  assert.equal(JSON.stringify(director.body).includes("patientName"), false);
});

test("synchronizes indoor terminal status changes across linked OR displays", async (t) => {
  const { baseUrl } = await withServer(t);

  const beforeDoor = await getJson(`${baseUrl}/api/v1/or-display/rooms/OR02/door-snapshot`);
  assert.equal(beforeDoor.response.status, 200);
  assert.equal(beforeDoor.body.currentSurgeryId, "SCH000002");
  assert.equal(beforeDoor.body.currentSurgeryKind, "下一台手术");
  assert.equal(beforeDoor.body.display.displayStatus, "已排班");

  const update = await getJson(`${baseUrl}/api/v1/surgery-schedules/SCH000002/status`, {
    method: "PATCH",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      status: "已接台",
      deviceId: "DEV000003",
      operatorId: "PRA004",
      sourceSystem: "终端联调模拟台",
      idempotencyKey: "simulator-SCH000002-called",
      eventTime: "2026-05-16T10:35:00+08:00"
    })
  });
  assert.equal(update.response.status, 200);
  assert.equal(update.body.accepted, true);
  assert.equal(update.body.status, "已接台");

  const afterDoor = await getJson(`${baseUrl}/api/v1/or-display/rooms/OR02/door-snapshot`);
  assert.equal(afterDoor.response.status, 200);
  assert.equal(afterDoor.body.currentSurgeryId, "SCH000002");
  assert.equal(afterDoor.body.display.displayStatus, "已接台");

  const family = await getJson(`${baseUrl}/api/v1/or-display/family-waiting-snapshot?date=2026-05-16`);
  const familyItem = family.body.items.find((item) => item.surgeryScheduleId === "SCH000002");
  assert.equal(family.response.status, 200);
  assert.equal(familyItem.displayStatus, "等待接入");
  assert.equal(JSON.stringify(familyItem).includes("人工股骨头置换术"), false);

  const nurse = await getJson(`${baseUrl}/api/v1/or-display/nurse-station-snapshot?date=2026-05-16`);
  const nurseItem = nurse.body.surgeries.find((item) => item.surgeryScheduleId === "SCH000002");
  assert.equal(nurse.response.status, 200);
  assert.equal(nurseItem.status, "已接台");
  assert.equal(nurseItem.eventCount, 1);

  const director = await getJson(`${baseUrl}/api/v1/or-display/director-dashboard-snapshot?date=2026-05-16`);
  assert.equal(director.response.status, 200);
  assert.equal(director.body.metrics.进行中台次, 2);
  assert.equal(JSON.stringify(director.body).includes("patientName"), false);

  const replay = await getJson(`${baseUrl}/api/v1/or-events/replay?roomId=OR02&deviceId=DEV000003&date=2026-05-16`);
  assert.equal(replay.response.status, 200);
  assert.equal(replay.body.total, 1);
  assert.equal(replay.body.items[0].eventType, "已接台");
  assert.equal(replay.body.items[0].previousStatus, "已排班");
  assert.equal(replay.body.items[0].newStatus, "已接台");
  assert.equal(replay.body.items[0].deviceName, "2 号手术间室内控制终端");
  assert.equal(replay.body.items[0].operatorName, "赵护士");
  assert.equal(JSON.stringify(replay.body).includes("Called"), false);
});

test("runs scenario steps against a surgery schedule", async (t) => {
  const { baseUrl } = await withServer(t);
  const run = await getJson(`${baseUrl}/api/v1/scenarios/SCN000001/runs`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ surgeryScheduleId: "SCH000002" })
  });

  assert.equal(run.response.status, 201);
  assert.equal(run.body.status, "执行中");

  const next = await getJson(`${baseUrl}/api/v1/scenario-runs/${run.body.runId}/next`, {
    method: "POST",
    headers: { "content-type": "application/json" }
  });

  assert.equal(next.response.status, 200);
  assert.equal(next.body.result, "已接台");

  const schedule = await getJson(`${baseUrl}/api/v1/surgery-schedules/SCH000002`);
  assert.equal(schedule.body.status, "已接台");
});

test("advances a patient journey and records timeline events", async (t) => {
  const { baseUrl } = await withServer(t);

  const templates = await getJson(`${baseUrl}/api/v1/journey-templates`);
  assert.equal(templates.response.status, 200);
  assert.equal(templates.body.total, 1);
  assert.equal(templates.body.items[0].templateId, "TPL_CHOLECYSTECTOMY_INPATIENT");

  const journeys = await getJson(`${baseUrl}/api/v1/patient-journeys`);
  assert.equal(journeys.response.status, 200);
  assert.equal(journeys.body.total, 1);
  assert.equal(journeys.body.items[0].progress.completed, 0);
  assert.equal(journeys.body.items[0].steps.length, templates.body.items[0].steps.length);
  assert.ok(journeys.body.items[0].steps.length > 18);
  assert.equal(journeys.body.items[0].steps[0].status, "当前");
  assert.equal(journeys.body.items[0].steps.some((step) => step.system === "药房"), true);
  assert.equal(journeys.body.items[0].steps.some((step) => step.system === "EMR"), true);

  const next = await getJson(`${baseUrl}/api/v1/patient-journeys/JNY000001/next`, {
    method: "POST",
    headers: { "content-type": "application/json" }
  });
  assert.equal(next.response.status, 200);
  assert.equal(next.body.result, "admission_registered");
  assert.equal(next.body.journey.progress.completed, 1);
  assert.equal(next.body.journey.steps[0].status, "已完成");
  assert.equal(next.body.journey.steps[1].status, "当前");

  const timeline = await getJson(`${baseUrl}/api/v1/patient-journeys/JNY000001/timeline`);
  assert.equal(timeline.response.status, 200);
  assert.equal(timeline.body.total, 1);
  assert.equal(timeline.body.items[0].interfaceEvent, "journey.admission_registered");
});

test("runs a patient journey through discharge", async (t) => {
  const { baseUrl } = await withServer(t);

  const run = await getJson(`${baseUrl}/api/v1/patient-journeys/JNY000001/run`, {
    method: "POST",
    headers: { "content-type": "application/json" }
  });
  assert.equal(run.response.status, 200);
  assert.equal(run.body.result, "已完成");
  assert.equal(run.body.journey.status, "已完成");
  assert.equal(run.body.journey.progress.completed, run.body.journey.progress.total);

  const encounter = await getJson(`${baseUrl}/api/v1/encounters/ENC000001`);
  assert.equal(encounter.body.status, "已出院");
  assert.equal(encounter.body.admission.bedId, "B001");
  assert.ok(encounter.body.admission.dischargeTime);

  const bed = await getJson(`${baseUrl}/api/v1/beds?status=Idle`);
  assert.ok(bed.body.items.some((item) => item.bedId === "B001"));

  const logs = await getJson(`${baseUrl}/api/v1/interface-messages?correlationId=JNY000001&pageSize=50`);
  assert.ok(logs.body.total >= run.body.journey.progress.total);
  assert.equal(run.body.journey.timeline.some((item) => item.interfaceEvent === "billing.eligibility_verified"), true);
  assert.equal(run.body.journey.timeline.some((item) => item.interfaceEvent === "billing.deposit_paid"), true);
  assert.equal(run.body.journey.timeline.some((item) => item.interfaceEvent === "pharmacy.preop_medication_dispensed"), true);
  assert.equal(run.body.journey.timeline.some((item) => item.interfaceEvent === "lis.specimen_collected"), true);
  assert.equal(run.body.journey.timeline.some((item) => item.interfaceEvent === "order.preop_reviewed"), true);
  assert.equal(run.body.journey.timeline.some((item) => item.interfaceEvent === "appointment.exam_booked"), true);
  assert.equal(run.body.journey.timeline.some((item) => item.interfaceEvent === "blood.preparation_completed"), true);
  assert.equal(run.body.journey.timeline.some((item) => item.interfaceEvent === "allergy.skin_test_completed"), true);
  assert.equal(run.body.journey.timeline.some((item) => item.interfaceEvent === "scan.preop_medication_verified"), true);
  assert.equal(run.body.journey.timeline.some((item) => item.interfaceEvent === "ris.exam_performed"), true);
  assert.equal(run.body.journey.timeline.some((item) => item.interfaceEvent === "billing.daily_statement_generated"), true);

  const completedSummary = await getJson(`${baseUrl}/api/v1/encounters/ENC000001/summary`);
  assert.equal(completedSummary.response.status, 200);
  assert.equal(completedSummary.body.quality.closedLoop, true);
  assert.ok(completedSummary.body.quality.score >= 90);
  assert.equal(completedSummary.body.quality.failedCount, 0);
  assert.ok(completedSummary.body.quality.checks.some((item) => item.category === "胆囊结石路径" && item.item === "术后病理"));
  assertChinaHospitalDisplayText(completedSummary.body);
  assert.equal(JSON.stringify(completedSummary.body).includes("阑尾"), false);

  const quality = await getJson(`${baseUrl}/api/v1/encounters/ENC000001/summary/quality`);
  assert.equal(quality.response.status, 200);
  assert.equal(quality.body.diagnosisCode, "K80.200");
  assert.ok(quality.body.checks.some((item) => item.category === "检验真实性" && item.item === "TBIL"));

  const reset = await getJson(`${baseUrl}/api/v1/patient-journeys/JNY000001/reset`, {
    method: "POST",
    headers: { "content-type": "application/json" }
  });
  assert.equal(reset.response.status, 200);
  assert.equal(reset.body.status, "待执行");
  assert.equal(reset.body.progress.completed, 0);
  assert.equal(reset.body.steps[0].status, "当前");

  const summaryAfterReset = await getJson(`${baseUrl}/api/v1/encounters/ENC000001/summary`);
  assert.equal(summaryAfterReset.response.status, 200);
  assert.equal(summaryAfterReset.body.documents.some((item) => item.documentType === "DischargeSummary"), false);
  assert.equal(summaryAfterReset.body.documents.some((item) => item.documentType === "PreoperativeSummary"), true);
});

test("simulates a 100-patient, 50-disease hospital operation cohort", async (t) => {
  const { baseUrl } = await withServer(t);

  const cohort = await getJson(`${baseUrl}/api/v1/patient-journeys/simulate-cohort`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ count: 100, reset: true, roomCount: 8 })
  });

  assert.equal(cohort.response.status, 201);
  assert.equal(cohort.body.createdCount, 100);
  assert.equal(cohort.body.roomCount, 8);
  assert.equal(cohort.body.summary.total, 100);
  assert.equal(cohort.body.diseaseCatalogTotal, 50);
  assert.equal(cohort.body.diseaseTypeCount, 50);
  assert.equal(cohort.body.breastCancerTypeCount, 20);
  assert.ok(cohort.body.chinaStandardBaseline.some((item) => item.code === "NHSA-SETTLEMENT"));
  assert.ok(cohort.body.summary.phaseCounts["术前"] > 0);
  assert.ok(cohort.body.summary.phaseCounts["术中"] > 0);
  assert.ok(cohort.body.summary.phaseCounts["术后"] > 0);
  assert.ok(cohort.body.summary.discharged > 0);

  const practitioners = await getJson(`${baseUrl}/api/v1/practitioners?pageSize=30`);
  assert.equal(practitioners.body.total, 20);
  assert.ok(practitioners.body.items.some((item) => item.deptId === "D011" && item.educationBackground?.length));

  const operatingRooms = await getJson(`${baseUrl}/api/v1/operating-rooms?pageSize=20`);
  assert.equal(operatingRooms.body.total, 8);
  assert.ok(operatingRooms.body.items.some((item) => item.roomName === "8 号手术间"));

  const patients = await getJson(`${baseUrl}/api/v1/patients?pageSize=100`);
  assert.equal(patients.body.total, 100);

  const summary = await getJson(`${baseUrl}/api/v1/patient-journeys/summary`);
  assert.equal(summary.body.total, 100);
  assert.ok(summary.body.averageProgress > 0);

  const ultrasound = await getJson(`${baseUrl}/api/v1/ultrasound-reports?pageSize=100`);
  assert.equal(ultrasound.body.total, 100);
  assert.ok(ultrasound.body.items.some((item) => item.finding.includes("胆总管内径约 0.5cm") && item.conclusion.includes("胆总管未见扩张")));

  const ecg = await getJson(`${baseUrl}/api/v1/ecg-reports?pageSize=100`);
  assert.equal(ecg.body.total, 100);

  const pacs = await getJson(`${baseUrl}/api/v1/pacs-studies?pageSize=100`);
  assert.ok(pacs.body.total >= 100);
  assert.ok(pacs.body.items[0].viewerUrl);
  assert.ok(pacs.body.items.some((item) => item.breastCancerStructuredData?.molecularSubtype));
  assert.ok(pacs.body.items.some((item) => item.dicomFileUrl && item.previewImageUrl));
  assert.ok(pacs.body.items.some((item) => item.modality === "US" && item.studyDescription.includes("腹部彩色多普勒超声")));

  const breastStudy = pacs.body.items.find((item) => item.breastCancerStructuredData);
  const preview = await fetch(`${baseUrl}${breastStudy.previewImageUrl}`);
  const previewBytes = Buffer.from(await preview.arrayBuffer());
  assert.equal(preview.status, 200);
  assert.equal(preview.headers.get("content-type"), "image/png");
  assert.equal(previewBytes.subarray(1, 4).toString("ascii"), "PNG");

  const dicom = await fetch(`${baseUrl}${breastStudy.dicomFileUrl}`);
  const dicomBytes = Buffer.from(await dicom.arrayBuffer());
  assert.equal(dicom.status, 200);
  assert.equal(dicom.headers.get("content-type"), "application/dicom");
  assert.equal(dicomBytes.subarray(128, 132).toString("ascii"), "DICM");

  const dispenses = await getJson(`${baseUrl}/api/v1/medication-dispenses?pageSize=100`);
  assert.ok(dispenses.body.total > 0);

  const nursingRecords = await getJson(`${baseUrl}/api/v1/nursing-records?pageSize=100`);
  assert.ok(nursingRecords.body.total > 0);

  const orderReviews = await getJson(`${baseUrl}/api/v1/order-review-records?pageSize=100`);
  assert.ok(orderReviews.body.total > 0);

  const examAppointments = await getJson(`${baseUrl}/api/v1/exam-appointments?pageSize=100`);
  assert.ok(examAppointments.body.total > 0);
  assert.ok(examAppointments.body.items.some((item) => ["CT", "MG"].includes(item.modality)));

  const bloodPreparation = await getJson(`${baseUrl}/api/v1/blood-preparation-records?pageSize=100`);
  assert.ok(bloodPreparation.body.total > 0);
  assert.ok(bloodPreparation.body.items.some((item) => item.crossmatchResult.includes("相合")));

  const medicationSafety = await getJson(`${baseUrl}/api/v1/medication-safety-checks?pageSize=100`);
  assert.ok(medicationSafety.body.total > 0);
  assert.ok(medicationSafety.body.items.some((item) => item.skinTestResult === "阴性" || item.status === "已备替代用药"));

  const identityVerifications = await getJson(`${baseUrl}/api/v1/identity-verifications?pageSize=100`);
  assert.ok(identityVerifications.body.total > 0);
  assert.ok(identityVerifications.body.items.some((item) => item.scene === "术前用药PDA扫码"));

  const consents = await getJson(`${baseUrl}/api/v1/consents?pageSize=100`);
  assert.ok(consents.body.total > 0);

  const risks = await getJson(`${baseUrl}/api/v1/risk-assessments?pageSize=100`);
  assert.ok(risks.body.total > 0);

  const transports = await getJson(`${baseUrl}/api/v1/transport-events?pageSize=100`);
  assert.ok(transports.body.total > 0);

  const billing = await getJson(`${baseUrl}/api/v1/billing-items?pageSize=100`);
  assert.ok(billing.body.total > 0);
  assert.ok(billing.body.items.some((item) => item.chinaInsuranceRule?.settlementMode.includes("基本医疗保险")));

  const eligibility = await getJson(`${baseUrl}/api/v1/insurance-eligibility-records?pageSize=100`);
  assert.ok(eligibility.body.total > 0);

  const deposits = await getJson(`${baseUrl}/api/v1/deposit-payments?pageSize=100`);
  assert.ok(deposits.body.total > 0);

  const dailyStatements = await getJson(`${baseUrl}/api/v1/daily-billing-statements?pageSize=100`);
  assert.ok(dailyStatements.body.total > 0);

  const dischargeMeds = await getJson(`${baseUrl}/api/v1/discharge-medications?pageSize=100`);
  assert.ok(dischargeMeds.body.total > 0);

  const followUps = await getJson(`${baseUrl}/api/v1/follow-ups?pageSize=100`);
  assert.ok(followUps.body.total > 0);

  const criticalValues = await getJson(`${baseUrl}/api/v1/lab-critical-values?pageSize=100`);
  assert.ok(criticalValues.body.total > 0);

  const specimens = await getJson(`${baseUrl}/api/v1/surgical-specimens?pageSize=100`);
  assert.ok(specimens.body.total > 0);

  const pathology = await getJson(`${baseUrl}/api/v1/pathology-reports?pageSize=100`);
  assert.ok(pathology.body.total > 0);

  const settlements = await getJson(`${baseUrl}/api/v1/insurance-settlements?pageSize=100`);
  assert.ok(settlements.body.total > 0);
  assert.ok(settlements.body.items.some((item) => item.settlementListNo && typeof item.catalogPaymentScopeAmount === "number"));

  const safety = await getJson(`${baseUrl}/api/v1/surgical-safety-checklists?pageSize=100`);
  assert.ok(safety.body.total > 0);

  const anesthesia = await getJson(`${baseUrl}/api/v1/anesthesia-records?pageSize=100`);
  assert.ok(anesthesia.body.total > 0);

  const counts = await getJson(`${baseUrl}/api/v1/instrument-counts?pageSize=100`);
  assert.ok(counts.body.total > 0);

  const pacu = await getJson(`${baseUrl}/api/v1/pacu-records?pageSize=100`);
  assert.ok(pacu.body.total > 0);

  const vitalSigns = await getJson(`${baseUrl}/api/v1/vital-sign-records?pageSize=100`);
  assert.ok(vitalSigns.body.total > 0);

  const administrations = await getJson(`${baseUrl}/api/v1/medication-administrations?pageSize=100`);
  assert.ok(administrations.body.total > 0);

  const preparations = await getJson(`${baseUrl}/api/v1/preop-preparations?pageSize=100`);
  assert.ok(preparations.body.total > 0);

  const wardRounds = await getJson(`${baseUrl}/api/v1/ward-rounds?pageSize=100`);
  assert.ok(wardRounds.body.total > 0);

  const dischargeAssessments = await getJson(`${baseUrl}/api/v1/discharge-assessments?pageSize=100`);
  assert.ok(dischargeAssessments.body.total > 0);

  const specimenTracks = await getJson(`${baseUrl}/api/v1/lab-specimen-tracks?pageSize=100`);
  assert.ok(specimenTracks.body.total > 0);

  const infusions = await getJson(`${baseUrl}/api/v1/infusion-records?pageSize=100`);
  assert.ok(infusions.body.total > 0);

  const pain = await getJson(`${baseUrl}/api/v1/pain-assessments?pageSize=100`);
  assert.ok(pain.body.total > 0);

  const wound = await getJson(`${baseUrl}/api/v1/wound-care-records?pageSize=100`);
  assert.ok(wound.body.total > 0);

  const homepages = await getJson(`${baseUrl}/api/v1/medical-record-homepages?pageSize=100`);
  assert.ok(homepages.body.total > 0);

  const qualityChecks = await getJson(`${baseUrl}/api/v1/record-quality-checks?pageSize=100`);
  assert.ok(qualityChecks.body.total > 0);

  const consultations = await getJson(`${baseUrl}/api/v1/consultations?pageSize=100`);
  assert.ok(consultations.body.total > 0);

  const teaching = await getJson(`${baseUrl}/api/v1/teaching-sessions?pageSize=100`);
  assert.ok(teaching.body.total > 0);

  const familyNotifications = await getJson(`${baseUrl}/api/v1/family-notifications?pageSize=100`);
  assert.ok(familyNotifications.body.total > 0);

  const antimicrobialReviews = await getJson(`${baseUrl}/api/v1/antimicrobial-reviews?pageSize=100`);
  assert.ok(antimicrobialReviews.body.total > 0);

  const consumables = await getJson(`${baseUrl}/api/v1/or-consumable-usages?pageSize=100`);
  assert.ok(consumables.body.total > 0);

  const mediaRecords = await getJson(`${baseUrl}/api/v1/surgery-media-records?pageSize=100`);
  assert.ok(mediaRecords.body.total > 0);

  const dietaryPlans = await getJson(`${baseUrl}/api/v1/dietary-plans?pageSize=100`);
  assert.ok(dietaryPlans.body.total > 0);

  const mobility = await getJson(`${baseUrl}/api/v1/mobility-rehab-records?pageSize=100`);
  assert.ok(mobility.body.total > 0);

  const vte = await getJson(`${baseUrl}/api/v1/vte-prophylaxis-records?pageSize=100`);
  assert.ok(vte.body.total > 0);

  const handovers = await getJson(`${baseUrl}/api/v1/nursing-handovers?pageSize=100`);
  assert.ok(handovers.body.total > 0);

  const observations = await getJson(`${baseUrl}/api/v1/postop-observation-records?pageSize=100`);
  assert.ok(observations.body.total > 0);

  const counseling = await getJson(`${baseUrl}/api/v1/medication-counseling-records?pageSize=100`);
  assert.ok(counseling.body.total > 0);

  const education = await getJson(`${baseUrl}/api/v1/discharge-education-records?pageSize=100`);
  assert.ok(education.body.total > 0);

  const invoices = await getJson(`${baseUrl}/api/v1/invoice-records?pageSize=100`);
  assert.ok(invoices.body.total > 0);

  const outcomes = await getJson(`${baseUrl}/api/v1/follow-up-outcomes?pageSize=100`);
  assert.ok(outcomes.body.total > 0);

  const infection = await getJson(`${baseUrl}/api/v1/infection-surveillance-records?pageSize=100`);
  assert.ok(infection.body.total > 0);

  const surveys = await getJson(`${baseUrl}/api/v1/satisfaction-surveys?pageSize=100`);
  assert.ok(surveys.body.total > 0);

  const journeys = await getJson(`${baseUrl}/api/v1/patient-journeys?pageSize=5`);
  assert.equal(journeys.body.total, 100);
  assert.equal(journeys.body.items[0].steps.some((step) => step.system === "药房"), true);
});

test("keeps coordination records aligned with the patient's disease profile", () => {
  const state = createSeedState();
  simulatePatientJourneyCohort(state, { count: 100, reset: true, roomCount: 8 });

  const gallbladderTerms = /胆囊|胆总管|腹腔镜胆囊|胆道/u;
  const offenders = [];
  for (const journey of state.patientJourneys) {
    const summary = getEncounterSummary(state, journey.encounterId);
    const diagnosis = summary.diagnoses.find((item) => item.isPrimary) ?? summary.diagnoses[0];
    if (diagnosis?.diagnosisName?.includes("胆囊")) {
      continue;
    }

    const coordinationText = JSON.stringify({
      consultations: summary.consultations,
      teachingSessions: summary.teachingSessions,
      familyNotifications: summary.familyNotifications,
      nursingHandovers: summary.nursingHandovers,
      surgeryMediaRecords: summary.surgeryMediaRecords,
      antimicrobialReviews: summary.antimicrobialReviews,
      orConsumableUsages: summary.orConsumableUsages,
      surgicalSafetyChecklists: summary.surgicalSafetyChecklists
    });
    if (gallbladderTerms.test(coordinationText)) {
      offenders.push(`${journey.journeyId}:${diagnosis?.diagnosisName}`);
    }
  }

  assert.deepEqual(offenders, []);

  const breastJourney = state.patientJourneys.find((journey) => {
    const summary = getEncounterSummary(state, journey.encounterId);
    return summary.diagnoses.some((item) => item.diagnosisName.includes("乳腺癌"))
      && summary.consultations.length > 0;
  });
  assert.ok(breastJourney);
  const breastSummary = getEncounterSummary(state, breastJourney.encounterId);
  const breastCoordinationText = JSON.stringify({
    consultations: breastSummary.consultations,
    teachingSessions: breastSummary.teachingSessions,
    familyNotifications: breastSummary.familyNotifications
  });
  assert.match(breastCoordinationText, /乳腺|MDT/u);
  assert.equal(gallbladderTerms.test(breastCoordinationText), false);
});

test("serves the HIS patient auto-fill interface shape", async (t) => {
  const { baseUrl } = await withServer(t);

  const his = await getJson(`${baseUrl}/getHISPatient?idCard=320300197003120011`);
  assert.equal(his.response.status, 200);
  assert.equal(his.body.status, 0);
  assert.equal(his.body.code, "SUCCESS");
  assert.equal(his.body.entity.brbh, "PAT000001");
  assert.equal(his.body.entity.sfzhHide, "320300********0011");
  assert.ok(his.body.entity.hzzs);
  assert.ok(his.body.entity.hzfzjc.includes("胆囊") || his.body.entity.hzfzjc.includes("CT"));

  const missing = await getJson(`${baseUrl}/getHISPatient?idCard=000000000000000000`);
  assert.equal(missing.response.status, 200);
  assert.equal(missing.body.status, 1);
  assert.equal(missing.body.entity, null);
});

test("exposes FHIR, DICOMweb, HL7 and interface logs", async (t) => {
  const { baseUrl } = await withServer(t);

  const fhir = await getJson(`${baseUrl}/fhir/Patient`);
  assert.equal(fhir.response.status, 200);
  assert.equal(fhir.body.resourceType, "Bundle");
  assert.equal(fhir.body.total, 3);

  const dicom = await getJson(`${baseUrl}/dicomweb/studies?AccessionNumber=ACC202605160001`);
  assert.equal(dicom.response.status, 200);
  assert.equal(dicom.body.length, 1);

  const hl7 = await getJson(`${baseUrl}/api/v1/hl7/messages?messageType=SIU_S12&surgeryScheduleId=SCH000001`);
  assert.equal(hl7.response.status, 200);
  assert.match(hl7.body.content, /SIU\^S12/);

  const logs = await getJson(`${baseUrl}/api/v1/interface-messages`);
  assert.equal(logs.response.status, 200);
  assert.ok(logs.body.total >= 3);
});

test("resets and generates simulation data", async (t) => {
  const { baseUrl } = await withServer(t);

  const generated = await getJson(`${baseUrl}/api/v1/data-factory/generate-surgeries`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ count: 2 })
  });
  assert.equal(generated.response.status, 201);
  assert.equal(generated.body.items.length, 2);

  const reset = await getJson(`${baseUrl}/api/v1/data-factory/reset`, {
    method: "POST",
    headers: { "content-type": "application/json" }
  });
  assert.equal(reset.response.status, 200);
  assert.equal(reset.body.surgerySchedules, 2);
});
