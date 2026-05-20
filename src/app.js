import http from "node:http";
import zlib from "node:zlib";
import { normalizeBusinessTextForChina } from "./china-standard.js";
import { renderConsoleHtml } from "./console.js";
import {
  renderDirectorQualityDisplayHtml,
  renderOrInnerControlHtml,
  renderOrDoorDisplayHtml,
  renderOrNurseStationDisplayHtml,
  renderOrTerminalSimulatorHtml
} from "./or-displays.js";
import { renderWaitingDisplayHtml } from "./waiting-display.js";
import {
  addSurgeryEvent,
  advanceScenarioRun,
  buildDirectorDashboardSnapshot,
  buildDoorDisplaySnapshot,
  buildFamilyWaitingSnapshot,
  buildNurseStationSnapshot,
  createConsultation,
  createDocument,
  createPatient,
  createSurgeryRequest,
  createSurgerySchedule,
  createTeachingSession,
  enrichEncounter,
  enrichSurgeryRequest,
  enrichSurgerySchedule,
  findById,
  generatePatients,
  generateSurgeries,
  getCurrentInpatients,
  getCurrentSurgeryByRoom,
  getEncounterSummary,
  getOrTerminal,
  listConsultations,
  listDocuments,
  listEncounters,
  listInterfaceMessages,
  listOrEventReplay,
  listOrTerminals,
  listPatients,
  listReports,
  listSurgeryRequests,
  listSurgerySchedules,
  listTeachingSessions,
  logInterfaceMessage,
  recordOrTerminalHeartbeat,
  registerOrTerminal,
  startScenarioRun,
  updateConsultationStatus,
  updateOrTerminalBinding,
  updateOrTerminalStatus,
  updateSurgeryStatus,
  updateTeachingSessionStatus
} from "./domain.js";
import { fhirSearch } from "./fhir.js";
import { buildHisPatientResponse } from "./his.js";
import { buildHl7Message } from "./hl7.js";
import {
  getNaturalHospitalOperationStatus,
  initializeNaturalHospitalOperation,
  startNaturalHospitalOperation,
  tickNaturalHospitalOperation
} from "./hospital-operation-engine.js";
import {
  getVendorDbFile,
  getVendorDbInfo,
  getVendorDbSchema,
  queryVendorDatabase,
  syncVendorDatabase
} from "./vendor-db.js";
import {
  advancePatientJourney,
  createPatientJourney,
  getJourneyTemplate,
  getPatientJourney,
  getPatientJourneyTimeline,
  listJourneyTemplates,
  listPatientJourneys,
  resetPatientJourney,
  runPatientJourney,
  simulatePatientJourneyCohort,
  summarizePatientJourneys
} from "./journey.js";
import { createSeedState, resetState } from "./seed.js";
import {
  HttpError,
  paginate,
  pickQuery,
  readBody,
  redact,
  requireFound,
  routeParams,
  sendJson,
  sendText
} from "./utils.js";

function responseSummary(body) {
  if (!body || typeof body !== "object") {
    return body;
  }

  if (Buffer.isBuffer(body)) {
    return { binary: true, bytes: body.length };
  }

  if (Array.isArray(body.items)) {
    return { total: body.total, page: body.page, pageSize: body.pageSize };
  }

  if (body.resourceType === "Bundle") {
    return { resourceType: "Bundle", total: body.total };
  }

  return redact(body);
}

function collection(items, query) {
  return paginate(items, query);
}

function withStatus(body, status = 200, headers = {}) {
  return { status, body, headers };
}

function sendBuffer(res, status, body, headers = {}) {
  res.writeHead(status, {
    "content-type": "application/octet-stream",
    "access-control-allow-origin": "*",
    "access-control-allow-methods": "GET,POST,PATCH,DELETE,OPTIONS",
    "access-control-allow-headers": "content-type,authorization,x-api-key,x-correlation-id",
    ...headers
  });
  res.end(body);
}

function firstHeaderValue(value) {
  return Array.isArray(value) ? value[0] : value;
}

function requireVendorDatabaseAccess(headers = {}) {
  const configuredKeys = String(process.env.SMARTHIS_VENDOR_API_KEYS ?? "")
    .split(/[;,]/)
    .map((item) => item.trim())
    .filter(Boolean);

  if (!configuredKeys.length) {
    return { 授权模式: "演示模式未启用密钥" };
  }

  const authorization = firstHeaderValue(headers.authorization) ?? "";
  const bearerKey = authorization.toLowerCase().startsWith("bearer ")
    ? authorization.slice(7).trim()
    : "";
  const apiKey = firstHeaderValue(headers["x-api-key"]) ?? bearerKey;
  if (!apiKey || !configuredKeys.includes(apiKey)) {
    throw new HttpError(401, "厂商数据库接口未授权，请提供有效接口密钥。");
  }

  return { 授权模式: "接口密钥已校验" };
}

function crc32(buffer) {
  let crc = 0xffffffff;
  for (const byte of buffer) {
    crc ^= byte;
    for (let bit = 0; bit < 8; bit += 1) {
      crc = (crc >>> 1) ^ (0xedb88320 & -(crc & 1));
    }
  }
  return (crc ^ 0xffffffff) >>> 0;
}

function pngChunk(type, data = Buffer.alloc(0)) {
  const typeBuffer = Buffer.from(type, "ascii");
  const length = Buffer.alloc(4);
  length.writeUInt32BE(data.length, 0);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(Buffer.concat([typeBuffer, data])), 0);
  return Buffer.concat([length, typeBuffer, data, crc]);
}

function deterministicSeed(text) {
  let seed = 2166136261;
  for (const char of String(text)) {
    seed ^= char.charCodeAt(0);
    seed = Math.imul(seed, 16777619);
  }
  return seed >>> 0;
}

function pseudoRandom(seed, index) {
  let value = (seed + Math.imul(index + 1, 1103515245)) >>> 0;
  value ^= value << 13;
  value ^= value >>> 17;
  value ^= value << 5;
  return (value >>> 0) / 0xffffffff;
}

function drawSyntheticPixels(study, width = 512, height = 512) {
  const pixels = Buffer.alloc(width * height);
  const seed = deterministicSeed(study.studyInstanceUid);
  const modality = study.modality ?? "CT";
  const breastLike = /乳腺|breast/i.test(`${study.studyDescription} ${study.bodyPart ?? ""}`);

  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const i = y * width + x;
      const noise = Math.floor(pseudoRandom(seed, i) * 28);
      let value = 18 + noise;
      const nx = (x - width / 2) / (width / 2);
      const ny = (y - height / 2) / (height / 2);

      if (modality === "MG" || breastLike) {
        const breast = ((x - width * 0.55) ** 2) / (width * width * 0.22) + ((y - height * 0.52) ** 2) / (height * height * 0.34);
        if (breast < 1) value = 92 + Math.floor(noise * 2.2);
        if (breast < 0.55) value += 22;
        const lesion = ((x - width * 0.58) ** 2) / 420 + ((y - height * 0.45) ** 2) / 300;
        if (lesion < 1) value = 205 - Math.floor(lesion * 45);
        for (let dot = 0; dot < 18; dot += 1) {
          const dx = width * (0.48 + pseudoRandom(seed, dot) * 0.18);
          const dy = height * (0.36 + pseudoRandom(seed + 31, dot) * 0.18);
          if ((x - dx) ** 2 + (y - dy) ** 2 < 5) value = 245;
        }
      } else if (modality === "US") {
        const fan = Math.abs(nx) < 0.22 + y / height * 0.7 && y > 36 && y < height - 24;
        if (fan) value = 35 + noise * 3 + Math.floor((Math.sin(x * 0.11) + Math.cos(y * 0.09)) * 12);
        const mass = ((x - width * 0.58) ** 2) / 1300 + ((y - height * 0.56) ** 2) / 620;
        if (fan && mass < 1) value = 34 + Math.floor(noise * 0.5);
        if (fan && mass >= 1 && mass < 1.35) value = 145;
      } else if (modality === "DX" || modality === "CR") {
        value = 42 + noise;
        const leftLung = ((x - width * 0.38) ** 2) / 6200 + ((y - height * 0.49) ** 2) / 14200;
        const rightLung = ((x - width * 0.62) ** 2) / 6200 + ((y - height * 0.49) ** 2) / 14200;
        if (leftLung < 1 || rightLung < 1) value = 72 + noise;
        const heart = ((x - width * 0.52) ** 2) / 3200 + ((y - height * 0.64) ** 2) / 5200;
        if (heart < 1) value = 125 + noise;
        if (Math.abs(x - width / 2) < 9 && y > height * 0.18 && y < height * 0.82) value = 160;
      } else {
        const body = nx * nx + ny * ny;
        if (body < 0.78) value = 78 + noise * 2;
        if (body < 0.28) value += 35;
        const lesion = ((x - width * 0.57) ** 2) / 900 + ((y - height * 0.46) ** 2) / 700;
        if (lesion < 1) value = 190 - Math.floor(lesion * 55);
      }

      pixels[i] = Math.max(0, Math.min(255, value));
    }
  }
  return { pixels, width, height };
}

function buildPngImage(study) {
  const { pixels, width, height } = drawSyntheticPixels(study);
  const raw = Buffer.alloc((width + 1) * height);
  for (let y = 0; y < height; y += 1) {
    raw[y * (width + 1)] = 0;
    pixels.copy(raw, y * (width + 1) + 1, y * width, (y + 1) * width);
  }
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8;
  ihdr[9] = 0;
  ihdr[10] = 0;
  ihdr[11] = 0;
  ihdr[12] = 0;
  return Buffer.concat([
    Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
    pngChunk("IHDR", ihdr),
    pngChunk("IDAT", zlib.deflateSync(raw)),
    pngChunk("IEND")
  ]);
}

function padEven(buffer, padByte = 0x20) {
  return buffer.length % 2 === 0 ? buffer : Buffer.concat([buffer, Buffer.from([padByte])]);
}

function dicomElement(group, element, vr, value) {
  let payload;
  if (vr === "US") {
    payload = Buffer.alloc(2);
    payload.writeUInt16LE(Number(value), 0);
  } else if (vr === "UL") {
    payload = Buffer.alloc(4);
    payload.writeUInt32LE(Number(value), 0);
  } else if (vr === "OB") {
    payload = Buffer.isBuffer(value) ? value : Buffer.from(value);
  } else {
    const text = Array.isArray(value) ? value.join("\\") : String(value ?? "");
    payload = Buffer.from(text, "ascii");
  }
  payload = padEven(payload, vr === "UI" ? 0x00 : 0x20);
  const header = Buffer.alloc(["OB", "OW", "SQ", "UN", "UT"].includes(vr) ? 12 : 8);
  header.writeUInt16LE(group, 0);
  header.writeUInt16LE(element, 2);
  header.write(vr, 4, 2, "ascii");
  if (header.length === 12) {
    header.writeUInt32LE(payload.length, 8);
  } else {
    header.writeUInt16LE(payload.length, 6);
  }
  return Buffer.concat([header, payload]);
}

function buildDicomFile(study, patient = null) {
  const { pixels, width, height } = drawSyntheticPixels(study);
  const sopClassUid = "1.2.840.10008.5.1.4.1.1.7";
  const sopInstanceUid = `${study.studyInstanceUid}.1.1`;
  const transferSyntaxUid = "1.2.840.10008.1.2.1";
  const metaWithoutLength = Buffer.concat([
    dicomElement(0x0002, 0x0001, "OB", Buffer.from([0x00, 0x01])),
    dicomElement(0x0002, 0x0002, "UI", sopClassUid),
    dicomElement(0x0002, 0x0003, "UI", sopInstanceUid),
    dicomElement(0x0002, 0x0010, "UI", transferSyntaxUid),
    dicomElement(0x0002, 0x0012, "UI", "1.2.826.0.1.3680043.10.543.1")
  ]);
  const date = (study.studyTime ?? new Date().toISOString()).slice(0, 10).replaceAll("-", "");
  const time = (study.studyTime ?? new Date().toISOString()).slice(11, 19).replaceAll(":", "");
  const dataset = Buffer.concat([
    dicomElement(0x0008, 0x0016, "UI", sopClassUid),
    dicomElement(0x0008, 0x0018, "UI", sopInstanceUid),
    dicomElement(0x0008, 0x0020, "DA", date),
    dicomElement(0x0008, 0x0030, "TM", time),
    dicomElement(0x0008, 0x0050, "SH", study.accessionNo),
    dicomElement(0x0008, 0x0060, "CS", study.modality ?? "OT"),
    dicomElement(0x0008, 0x1030, "LO", study.studyDescription ?? "SmartHIS Synthetic Study"),
    dicomElement(0x0010, 0x0010, "PN", patient?.name ? `${patient.name}=ANON` : "ANON^PATIENT"),
    dicomElement(0x0010, 0x0020, "LO", study.patientId),
    dicomElement(0x0020, 0x000d, "UI", study.studyInstanceUid),
    dicomElement(0x0020, 0x000e, "UI", `${study.studyInstanceUid}.1`),
    dicomElement(0x0020, 0x0011, "IS", "1"),
    dicomElement(0x0020, 0x0013, "IS", "1"),
    dicomElement(0x0028, 0x0002, "US", 1),
    dicomElement(0x0028, 0x0004, "CS", "MONOCHROME2"),
    dicomElement(0x0028, 0x0010, "US", height),
    dicomElement(0x0028, 0x0011, "US", width),
    dicomElement(0x0028, 0x0100, "US", 8),
    dicomElement(0x0028, 0x0101, "US", 8),
    dicomElement(0x0028, 0x0102, "US", 7),
    dicomElement(0x0028, 0x0103, "US", 0),
    dicomElement(0x7fe0, 0x0010, "OB", pixels)
  ]);
  return Buffer.concat([
    Buffer.alloc(128),
    Buffer.from("DICM", "ascii"),
    dicomElement(0x0002, 0x0000, "UL", metaWithoutLength.length),
    metaWithoutLength,
    dataset
  ]);
}

function notImplemented(name) {
  return withStatus({
    name,
    status: "planned",
    message: "This capability is reserved for the next implementation phase."
  }, 501);
}

const routes = [
  {
    method: "GET",
    pattern: "/getHISPatient",
    messageType: "HIS_PATIENT_AUTO_FILL",
    handler: ({ state, query }) => withStatus(buildHisPatientResponse(state, {
      idCard: query.idCard,
      patientId: query.patientId,
      mpiNo: query.mpiNo
    }))
  },
  {
    method: "GET",
    pattern: "/api/v1/his/patients/:patientId",
    messageType: "REST_HIS_PATIENT_GET",
    handler: ({ state, params }) => withStatus(buildHisPatientResponse(state, { patientId: params.patientId }))
  },
  {
    method: "GET",
    pattern: "/api/v1/vendor-db",
    messageType: "REST_VENDOR_DB_INFO",
    handler: ({ state, headers }) => withStatus({
      ...getVendorDbInfo(state),
      接口授权: requireVendorDatabaseAccess(headers)
    })
  },
  {
    method: "POST",
    pattern: "/api/v1/vendor-db/sync",
    messageType: "REST_VENDOR_DB_SYNC",
    handler: async ({ state, headers }) => {
      const authorization = requireVendorDatabaseAccess(headers);
      const result = await syncVendorDatabase(state);
      return withStatus({
        ...result,
        接口授权: authorization,
        同步结果: "已完成"
      }, 201);
    }
  },
  {
    method: "GET",
    pattern: "/api/v1/vendor-db/schema.sql",
    messageType: "REST_VENDOR_DB_SCHEMA",
    handler: ({ headers }) => {
      requireVendorDatabaseAccess(headers);
      return withStatus(getVendorDbSchema(), 200, { "content-type": "text/plain; charset=utf-8" });
    }
  },
  {
    method: "GET",
    pattern: "/api/v1/vendor-db/views/:viewName",
    messageType: "REST_VENDOR_DB_VIEW_QUERY",
    handler: async ({ state, params, query, headers }) => {
      requireVendorDatabaseAccess(headers);
      return withStatus(await queryVendorDatabase(state, params.viewName, query));
    }
  },
  {
    method: "GET",
    pattern: "/api/v1/vendor-db/download",
    messageType: "REST_VENDOR_DB_DOWNLOAD",
    handler: async ({ state, headers }) => {
      requireVendorDatabaseAccess(headers);
      const file = await getVendorDbFile(state);
      return {
        status: 200,
        body: file.bytes,
        headers: {
          "content-type": "application/vnd.sqlite3",
          "content-disposition": "attachment; filename=\"smarthis-vendor-readonly.sqlite\"",
          "cache-control": "no-store"
        }
      };
    }
  },
  {
    method: "GET",
    pattern: "/api/v1/orgs",
    messageType: "REST_ORG_LIST",
    handler: ({ state, query }) => withStatus(collection(state.orgs, query))
  },
  {
    method: "GET",
    pattern: "/api/v1/departments",
    messageType: "REST_DEPARTMENT_LIST",
    handler: ({ state, query }) => withStatus(collection(
      state.departments.filter((item) => !query.type || item.deptType === query.type),
      query
    ))
  },
  {
    method: "GET",
    pattern: "/api/v1/wards",
    messageType: "REST_WARD_LIST",
    handler: ({ state, query }) => withStatus(collection(
      state.wards.filter((item) => !query.deptId || item.deptId === query.deptId),
      query
    ))
  },
  {
    method: "GET",
    pattern: "/api/v1/beds",
    messageType: "REST_BED_LIST",
    handler: ({ state, query }) => withStatus(collection(
      state.beds.filter((item) => (!query.wardId || item.wardId === query.wardId) && (!query.status || item.status === query.status)),
      query
    ))
  },
  {
    method: "GET",
    pattern: "/api/v1/operating-rooms",
    messageType: "REST_OPERATING_ROOM_LIST",
    handler: ({ state, query }) => withStatus(collection(
      state.operatingRooms.filter((item) => !query.status || item.status === query.status),
      query
    ))
  },
  {
    method: "GET",
    pattern: "/api/v1/practitioners",
    messageType: "REST_PRACTITIONER_LIST",
    handler: ({ state, query }) => withStatus(collection(
      state.practitioners.filter((item) => (!query.deptId || item.deptId === query.deptId) && (!query.role || item.role === query.role)),
      query
    ))
  },
  {
    method: "GET",
    pattern: "/api/v1/dictionaries/:dictCode",
    messageType: "REST_DICTIONARY_GET",
    handler: ({ params }) => withStatus(getDictionary(params.dictCode))
  },
  {
    method: "GET",
    pattern: "/api/v1/patients",
    messageType: "REST_PATIENT_QUERY",
    handler: ({ state, query }) => withStatus(listPatients(state, query))
  },
  {
    method: "GET",
    pattern: "/api/v1/patients/:patientId",
    messageType: "REST_PATIENT_GET",
    handler: ({ state, params }) => withStatus(requireFound(findById(state.patients, "patientId", params.patientId), `Patient ${params.patientId} was not found.`))
  },
  {
    method: "POST",
    pattern: "/api/v1/patients",
    messageType: "REST_PATIENT_CREATE",
    handler: ({ state, body }) => withStatus(createPatient(state, body ?? {}), 201)
  },
  {
    method: "GET",
    pattern: "/api/v1/encounters",
    messageType: "REST_ENCOUNTER_QUERY",
    handler: ({ state, query }) => withStatus(listEncounters(state, query))
  },
  {
    method: "GET",
    pattern: "/api/v1/encounters/:encounterId",
    messageType: "REST_ENCOUNTER_GET",
    handler: ({ state, params }) => withStatus(enrichEncounter(state, requireFound(findById(state.encounters, "encounterId", params.encounterId), `Encounter ${params.encounterId} was not found.`)))
  },
  {
    method: "GET",
    pattern: "/api/v1/encounters/:encounterId/diagnoses",
    messageType: "REST_DIAGNOSIS_QUERY",
    handler: ({ state, params, query }) => withStatus(collection(state.diagnoses.filter((item) => item.encounterId === params.encounterId), query))
  },
  {
    method: "GET",
    pattern: "/api/v1/encounters/:encounterId/summary",
    messageType: "REST_ENCOUNTER_SUMMARY",
    handler: ({ state, params }) => withStatus(getEncounterSummary(state, params.encounterId))
  },
  {
    method: "GET",
    pattern: "/api/v1/encounters/:encounterId/summary/quality",
    messageType: "REST_ENCOUNTER_SUMMARY_QUALITY",
    handler: ({ state, params }) => withStatus(getEncounterSummary(state, params.encounterId).quality)
  },
  {
    method: "GET",
    pattern: "/api/v1/inpatients",
    messageType: "REST_INPATIENT_QUERY",
    handler: ({ state, query }) => withStatus(getCurrentInpatients(state, query))
  },
  {
    method: "GET",
    pattern: "/api/v1/inpatients/by-ward/:wardId",
    messageType: "REST_INPATIENT_BY_WARD",
    handler: ({ state, params, query }) => withStatus(getCurrentInpatients(state, { ...query, wardId: params.wardId }))
  },
  {
    method: "GET",
    pattern: "/api/v1/orders",
    messageType: "REST_ORDER_QUERY",
    handler: ({ state, query }) => withStatus(collection(
      state.orders.filter((item) => (!query.encounterId || item.encounterId === query.encounterId) && (!query.orderType || item.orderType === query.orderType)),
      query
    ))
  },
  {
    method: "GET",
    pattern: "/api/v1/surgery-requests",
    messageType: "REST_SURGERY_REQUEST_QUERY",
    handler: ({ state, query }) => withStatus(listSurgeryRequests(state, query))
  },
  {
    method: "GET",
    pattern: "/api/v1/surgery-requests/:requestId",
    messageType: "REST_SURGERY_REQUEST_GET",
    handler: ({ state, params }) => withStatus(enrichSurgeryRequest(state, requireFound(findById(state.surgeryRequests, "surgeryRequestId", params.requestId), `Surgery request ${params.requestId} was not found.`)))
  },
  {
    method: "POST",
    pattern: "/api/v1/surgery-requests",
    messageType: "REST_SURGERY_REQUEST_CREATE",
    handler: ({ state, body }) => withStatus(createSurgeryRequest(state, body ?? {}), 201)
  },
  {
    method: "GET",
    pattern: "/api/v1/surgery-schedules",
    messageType: "REST_SURGERY_SCHEDULE_QUERY",
    handler: ({ state, query }) => withStatus(listSurgerySchedules(state, query))
  },
  {
    method: "GET",
    pattern: "/api/v1/surgery-schedules/:scheduleId",
    messageType: "REST_SURGERY_SCHEDULE_GET",
    handler: ({ state, params }) => withStatus(enrichSurgerySchedule(state, requireFound(findById(state.surgerySchedules, "surgeryScheduleId", params.scheduleId), `Surgery schedule ${params.scheduleId} was not found.`)))
  },
  {
    method: "POST",
    pattern: "/api/v1/surgery-schedules",
    messageType: "REST_SURGERY_SCHEDULE_CREATE",
    handler: ({ state, body }) => withStatus(createSurgerySchedule(state, body ?? {}), 201)
  },
  {
    method: "PATCH",
    pattern: "/api/v1/surgery-schedules/:scheduleId/status",
    messageType: "REST_SURGERY_STATUS_UPDATE",
    handler: ({ state, params, body }) => {
      const result = updateSurgeryStatus(state, params.scheduleId, body ?? {});
      return withStatus({
        scheduleId: params.scheduleId,
        status: result.schedule.status,
        accepted: true,
        idempotent: result.idempotent,
        eventId: result.event.eventId,
        schedule: result.schedule
      });
    }
  },
  {
    method: "POST",
    pattern: "/api/v1/surgery-schedules/:scheduleId/events",
    messageType: "REST_SURGERY_EVENT_CREATE",
    handler: ({ state, params, body }) => withStatus(addSurgeryEvent(state, params.scheduleId, body ?? {}), 201)
  },
  {
    method: "GET",
    pattern: "/api/v1/surgery-schedules/:scheduleId/events",
    messageType: "REST_SURGERY_EVENT_QUERY",
    handler: ({ state, params, query }) => withStatus(collection(
      state.surgeryEvents.filter((item) => item.surgeryScheduleId === params.scheduleId),
      query
    ))
  },
  {
    method: "GET",
    pattern: "/api/v1/operating-rooms/:roomId/current-surgery",
    messageType: "REST_CURRENT_SURGERY_GET",
    handler: ({ state, params }) => withStatus(getCurrentSurgeryByRoom(state, params.roomId))
  },
  {
    method: "GET",
    pattern: "/api/v1/or-display/rooms/:roomId/door-snapshot",
    messageType: "REST_OR_DOOR_DISPLAY_SNAPSHOT",
    handler: ({ state, params }) => withStatus(buildDoorDisplaySnapshot(state, params.roomId))
  },
  {
    method: "GET",
    pattern: "/api/v1/or-display/family-waiting-snapshot",
    messageType: "REST_OR_FAMILY_DISPLAY_SNAPSHOT",
    handler: ({ state, query }) => withStatus(buildFamilyWaitingSnapshot(state, query))
  },
  {
    method: "GET",
    pattern: "/api/v1/or-display/nurse-station-snapshot",
    messageType: "REST_OR_NURSE_STATION_SNAPSHOT",
    handler: ({ state, query }) => withStatus(buildNurseStationSnapshot(state, query))
  },
  {
    method: "GET",
    pattern: "/api/v1/or-display/director-dashboard-snapshot",
    messageType: "REST_OR_DIRECTOR_DASHBOARD_SNAPSHOT",
    handler: ({ state, query }) => withStatus(buildDirectorDashboardSnapshot(state, query))
  },
  {
    method: "GET",
    pattern: "/api/v1/or-events",
    messageType: "REST_OR_EVENT_REPLAY",
    handler: ({ state, query }) => withStatus(listOrEventReplay(state, query))
  },
  {
    method: "GET",
    pattern: "/api/v1/or-events/replay",
    messageType: "REST_OR_EVENT_REPLAY",
    handler: ({ state, query }) => withStatus(listOrEventReplay(state, query))
  },
  {
    method: "GET",
    pattern: "/api/v1/documents",
    messageType: "REST_DOCUMENT_QUERY",
    handler: ({ state, query }) => withStatus(listDocuments(state, query))
  },
  {
    method: "GET",
    pattern: "/api/v1/documents/:documentId",
    messageType: "REST_DOCUMENT_GET",
    handler: ({ state, params }) => withStatus(requireFound(findById(state.documents, "documentId", params.documentId), `Document ${params.documentId} was not found.`))
  },
  {
    method: "POST",
    pattern: "/api/v1/documents",
    messageType: "REST_DOCUMENT_CREATE",
    handler: ({ state, body }) => withStatus(createDocument(state, body ?? {}), 201)
  },
  {
    method: "GET",
    pattern: "/api/v1/lab-reports",
    messageType: "REST_LAB_REPORT_QUERY",
    handler: ({ state, query }) => withStatus(listReports(state.labReports, query))
  },
  {
    method: "GET",
    pattern: "/api/v1/lab-reports/:reportId",
    messageType: "REST_LAB_REPORT_GET",
    handler: ({ state, params }) => withStatus(requireFound(findById(state.labReports, "labReportId", params.reportId), `Lab report ${params.reportId} was not found.`))
  },
  {
    method: "GET",
    pattern: "/api/v1/exam-reports",
    messageType: "REST_EXAM_REPORT_QUERY",
    handler: ({ state, query }) => withStatus(listReports(state.examReports, query))
  },
  {
    method: "GET",
    pattern: "/api/v1/exam-reports/:reportId",
    messageType: "REST_EXAM_REPORT_GET",
    handler: ({ state, params }) => withStatus(requireFound(findById(state.examReports, "examReportId", params.reportId), `Exam report ${params.reportId} was not found.`))
  },
  {
    method: "GET",
    pattern: "/api/v1/ultrasound-reports",
    messageType: "REST_ULTRASOUND_REPORT_QUERY",
    handler: ({ state, query }) => withStatus(listReports(state.ultrasoundReports ?? [], query))
  },
  {
    method: "GET",
    pattern: "/api/v1/ultrasound-reports/:reportId",
    messageType: "REST_ULTRASOUND_REPORT_GET",
    handler: ({ state, params }) => withStatus(requireFound(findById(state.ultrasoundReports ?? [], "ultrasoundReportId", params.reportId), `Ultrasound report ${params.reportId} was not found.`))
  },
  {
    method: "GET",
    pattern: "/api/v1/ecg-reports",
    messageType: "REST_ECG_REPORT_QUERY",
    handler: ({ state, query }) => withStatus(listReports(state.ecgReports ?? [], query))
  },
  {
    method: "GET",
    pattern: "/api/v1/ecg-reports/:reportId",
    messageType: "REST_ECG_REPORT_GET",
    handler: ({ state, params }) => withStatus(requireFound(findById(state.ecgReports ?? [], "ecgReportId", params.reportId), `ECG report ${params.reportId} was not found.`))
  },
  {
    method: "GET",
    pattern: "/api/v1/imaging-studies",
    messageType: "REST_IMAGING_STUDY_QUERY",
    handler: ({ state, query }) => withStatus(collection(
      state.imagingStudies.filter((item) => (!query.patientId || item.patientId === query.patientId) && (!query.encounterId || item.encounterId === query.encounterId) && (!query.accessionNo || item.accessionNo === query.accessionNo)),
      query
    ))
  },
  {
    method: "GET",
    pattern: "/api/v1/imaging-studies/:studyId",
    messageType: "REST_IMAGING_STUDY_GET",
    handler: ({ state, params }) => withStatus(requireFound(findById(state.imagingStudies, "imagingStudyId", params.studyId), `Imaging study ${params.studyId} was not found.`))
  },
  {
    method: "GET",
    pattern: "/api/v1/pacs-studies",
    messageType: "REST_PACS_STUDY_QUERY",
    handler: ({ state, query }) => withStatus(collection(
      state.imagingStudies.filter((item) => (!query.patientId || item.patientId === query.patientId) && (!query.encounterId || item.encounterId === query.encounterId) && (!query.accessionNo || item.accessionNo === query.accessionNo)),
      query
    ))
  },
  {
    method: "GET",
    pattern: "/api/v1/pacs-studies/:studyId",
    messageType: "REST_PACS_STUDY_GET",
    handler: ({ state, params }) => withStatus(requireFound(findById(state.imagingStudies, "imagingStudyId", params.studyId), `PACS study ${params.studyId} was not found.`))
  },
  {
    method: "GET",
    pattern: "/api/v1/medication-dispenses",
    messageType: "REST_MEDICATION_DISPENSE_QUERY",
    handler: ({ state, query }) => withStatus(collection(
      (state.medicationDispenses ?? []).filter((item) => (!query.patientId || item.patientId === query.patientId) && (!query.encounterId || item.encounterId === query.encounterId) && (!query.status || item.status === query.status)),
      query
    ))
  },
  {
    method: "GET",
    pattern: "/api/v1/nursing-records",
    messageType: "REST_NURSING_RECORD_QUERY",
    handler: ({ state, query }) => withStatus(collection(
      (state.nursingRecords ?? []).filter((item) => (!query.patientId || item.patientId === query.patientId) && (!query.encounterId || item.encounterId === query.encounterId) && (!query.recordType || item.recordType === query.recordType)),
      query
    ))
  },
  {
    method: "GET",
    pattern: "/api/v1/clinical-tasks",
    messageType: "REST_CLINICAL_TASK_QUERY",
    handler: ({ state, query }) => withStatus(collection(
      (state.clinicalTasks ?? []).filter((item) => (!query.journeyId || item.journeyId === query.journeyId) && (!query.status || item.status === query.status) && (!query.taskType || item.taskType === query.taskType)),
      query
    ))
  },
  {
    method: "GET",
    pattern: "/api/v1/order-review-records",
    messageType: "REST_ORDER_REVIEW_RECORD_QUERY",
    handler: ({ state, query }) => withStatus(collection(
      (state.orderReviewRecords ?? []).filter((item) => (!query.patientId || item.patientId === query.patientId) && (!query.encounterId || item.encounterId === query.encounterId) && (!query.status || item.status === query.status)),
      query
    ))
  },
  {
    method: "GET",
    pattern: "/api/v1/exam-appointments",
    messageType: "REST_EXAM_APPOINTMENT_QUERY",
    handler: ({ state, query }) => withStatus(collection(
      (state.examAppointments ?? []).filter((item) => (!query.patientId || item.patientId === query.patientId) && (!query.encounterId || item.encounterId === query.encounterId) && (!query.status || item.status === query.status) && (!query.modality || item.modality === query.modality)),
      query
    ))
  },
  {
    method: "GET",
    pattern: "/api/v1/blood-preparation-records",
    messageType: "REST_BLOOD_PREPARATION_RECORD_QUERY",
    handler: ({ state, query }) => withStatus(collection(
      (state.bloodPreparationRecords ?? []).filter((item) => (!query.patientId || item.patientId === query.patientId) && (!query.encounterId || item.encounterId === query.encounterId) && (!query.status || item.status === query.status) && (!query.bloodType || item.bloodType === query.bloodType)),
      query
    ))
  },
  {
    method: "GET",
    pattern: "/api/v1/medication-safety-checks",
    messageType: "REST_MEDICATION_SAFETY_CHECK_QUERY",
    handler: ({ state, query }) => withStatus(collection(
      (state.medicationSafetyChecks ?? []).filter((item) => (!query.patientId || item.patientId === query.patientId) && (!query.encounterId || item.encounterId === query.encounterId) && (!query.status || item.status === query.status) && (!query.medicationCode || item.medicationCode === query.medicationCode)),
      query
    ))
  },
  {
    method: "GET",
    pattern: "/api/v1/identity-verifications",
    messageType: "REST_IDENTITY_VERIFICATION_QUERY",
    handler: ({ state, query }) => withStatus(collection(
      (state.identityVerificationRecords ?? []).filter((item) => (!query.patientId || item.patientId === query.patientId) && (!query.encounterId || item.encounterId === query.encounterId) && (!query.status || item.status === query.status) && (!query.scene || item.scene === query.scene)),
      query
    ))
  },
  {
    method: "GET",
    pattern: "/api/v1/consents",
    messageType: "REST_CONSENT_QUERY",
    handler: ({ state, query }) => withStatus(collection(
      (state.consents ?? []).filter((item) => (!query.patientId || item.patientId === query.patientId) && (!query.encounterId || item.encounterId === query.encounterId) && (!query.status || item.status === query.status)),
      query
    ))
  },
  {
    method: "GET",
    pattern: "/api/v1/risk-assessments",
    messageType: "REST_RISK_ASSESSMENT_QUERY",
    handler: ({ state, query }) => withStatus(collection(
      (state.riskAssessments ?? []).filter((item) => (!query.patientId || item.patientId === query.patientId) && (!query.encounterId || item.encounterId === query.encounterId) && (!query.riskLevel || item.riskLevel === query.riskLevel)),
      query
    ))
  },
  {
    method: "GET",
    pattern: "/api/v1/transport-events",
    messageType: "REST_TRANSPORT_EVENT_QUERY",
    handler: ({ state, query }) => withStatus(collection(
      (state.transportEvents ?? []).filter((item) => (!query.patientId || item.patientId === query.patientId) && (!query.encounterId || item.encounterId === query.encounterId) && (!query.surgeryScheduleId || item.surgeryScheduleId === query.surgeryScheduleId)),
      query
    ))
  },
  {
    method: "GET",
    pattern: "/api/v1/billing-items",
    messageType: "REST_BILLING_ITEM_QUERY",
    handler: ({ state, query }) => withStatus(collection(
      (state.billingItems ?? []).filter((item) => (!query.patientId || item.patientId === query.patientId) && (!query.encounterId || item.encounterId === query.encounterId) && (!query.category || item.category === query.category)),
      query
    ))
  },
  {
    method: "GET",
    pattern: "/api/v1/discharge-medications",
    messageType: "REST_DISCHARGE_MEDICATION_QUERY",
    handler: ({ state, query }) => withStatus(collection(
      (state.dischargeMedications ?? []).filter((item) => (!query.patientId || item.patientId === query.patientId) && (!query.encounterId || item.encounterId === query.encounterId) && (!query.status || item.status === query.status)),
      query
    ))
  },
  {
    method: "GET",
    pattern: "/api/v1/follow-ups",
    messageType: "REST_FOLLOW_UP_QUERY",
    handler: ({ state, query }) => withStatus(collection(
      (state.followUps ?? []).filter((item) => (!query.patientId || item.patientId === query.patientId) && (!query.encounterId || item.encounterId === query.encounterId) && (!query.status || item.status === query.status)),
      query
    ))
  },
  {
    method: "GET",
    pattern: "/api/v1/lab-critical-values",
    messageType: "REST_LAB_CRITICAL_VALUE_QUERY",
    handler: ({ state, query }) => withStatus(collection(
      (state.labCriticalValues ?? []).filter((item) => (!query.patientId || item.patientId === query.patientId) && (!query.encounterId || item.encounterId === query.encounterId) && (!query.status || item.status === query.status)),
      query
    ))
  },
  {
    method: "GET",
    pattern: "/api/v1/surgical-specimens",
    messageType: "REST_SURGICAL_SPECIMEN_QUERY",
    handler: ({ state, query }) => withStatus(collection(
      (state.surgicalSpecimens ?? []).filter((item) => (!query.patientId || item.patientId === query.patientId) && (!query.encounterId || item.encounterId === query.encounterId) && (!query.status || item.status === query.status)),
      query
    ))
  },
  {
    method: "GET",
    pattern: "/api/v1/pathology-reports",
    messageType: "REST_PATHOLOGY_REPORT_QUERY",
    handler: ({ state, query }) => withStatus(collection(
      (state.pathologyReports ?? []).filter((item) => (!query.patientId || item.patientId === query.patientId) && (!query.encounterId || item.encounterId === query.encounterId) && (!query.status || item.status === query.status)),
      query
    ))
  },
  {
    method: "GET",
    pattern: "/api/v1/insurance-settlements",
    messageType: "REST_INSURANCE_SETTLEMENT_QUERY",
    handler: ({ state, query }) => withStatus(collection(
      (state.insuranceSettlements ?? []).filter((item) => (!query.patientId || item.patientId === query.patientId) && (!query.encounterId || item.encounterId === query.encounterId) && (!query.status || item.status === query.status)),
      query
    ))
  },
  {
    method: "GET",
    pattern: "/api/v1/insurance-eligibility-records",
    messageType: "REST_INSURANCE_ELIGIBILITY_RECORD_QUERY",
    handler: ({ state, query }) => withStatus(collection(
      (state.insuranceEligibilityRecords ?? []).filter((item) => (!query.patientId || item.patientId === query.patientId) && (!query.encounterId || item.encounterId === query.encounterId) && (!query.eligibilityStatus || item.eligibilityStatus === query.eligibilityStatus)),
      query
    ))
  },
  {
    method: "GET",
    pattern: "/api/v1/deposit-payments",
    messageType: "REST_DEPOSIT_PAYMENT_QUERY",
    handler: ({ state, query }) => withStatus(collection(
      (state.depositPayments ?? []).filter((item) => (!query.patientId || item.patientId === query.patientId) && (!query.encounterId || item.encounterId === query.encounterId) && (!query.status || item.status === query.status)),
      query
    ))
  },
  {
    method: "GET",
    pattern: "/api/v1/daily-billing-statements",
    messageType: "REST_DAILY_BILLING_STATEMENT_QUERY",
    handler: ({ state, query }) => withStatus(collection(
      (state.dailyBillingStatements ?? []).filter((item) => (!query.patientId || item.patientId === query.patientId) && (!query.encounterId || item.encounterId === query.encounterId) && (!query.status || item.status === query.status) && (!query.statementDate || item.statementDate === query.statementDate)),
      query
    ))
  },
  {
    method: "GET",
    pattern: "/api/v1/surgical-safety-checklists",
    messageType: "REST_SURGICAL_SAFETY_CHECKLIST_QUERY",
    handler: ({ state, query }) => withStatus(collection(
      (state.surgicalSafetyChecklists ?? []).filter((item) => (!query.patientId || item.patientId === query.patientId) && (!query.encounterId || item.encounterId === query.encounterId) && (!query.status || item.status === query.status)),
      query
    ))
  },
  {
    method: "GET",
    pattern: "/api/v1/anesthesia-records",
    messageType: "REST_ANESTHESIA_RECORD_QUERY",
    handler: ({ state, query }) => withStatus(collection(
      (state.anesthesiaRecords ?? []).filter((item) => (!query.patientId || item.patientId === query.patientId) && (!query.encounterId || item.encounterId === query.encounterId) && (!query.status || item.status === query.status)),
      query
    ))
  },
  {
    method: "GET",
    pattern: "/api/v1/instrument-counts",
    messageType: "REST_INSTRUMENT_COUNT_QUERY",
    handler: ({ state, query }) => withStatus(collection(
      (state.instrumentCounts ?? []).filter((item) => (!query.patientId || item.patientId === query.patientId) && (!query.encounterId || item.encounterId === query.encounterId) && (!query.status || item.status === query.status)),
      query
    ))
  },
  {
    method: "GET",
    pattern: "/api/v1/pacu-records",
    messageType: "REST_PACU_RECORD_QUERY",
    handler: ({ state, query }) => withStatus(collection(
      (state.pacuRecords ?? []).filter((item) => (!query.patientId || item.patientId === query.patientId) && (!query.encounterId || item.encounterId === query.encounterId) && (!query.status || item.status === query.status)),
      query
    ))
  },
  {
    method: "GET",
    pattern: "/api/v1/vital-sign-records",
    messageType: "REST_VITAL_SIGN_RECORD_QUERY",
    handler: ({ state, query }) => withStatus(collection(
      (state.vitalSignRecords ?? []).filter((item) => (!query.patientId || item.patientId === query.patientId) && (!query.encounterId || item.encounterId === query.encounterId) && (!query.recordType || item.recordType === query.recordType)),
      query
    ))
  },
  {
    method: "GET",
    pattern: "/api/v1/medication-administrations",
    messageType: "REST_MEDICATION_ADMINISTRATION_QUERY",
    handler: ({ state, query }) => withStatus(collection(
      (state.medicationAdministrations ?? []).filter((item) => (!query.patientId || item.patientId === query.patientId) && (!query.encounterId || item.encounterId === query.encounterId) && (!query.status || item.status === query.status)),
      query
    ))
  },
  {
    method: "GET",
    pattern: "/api/v1/preop-preparations",
    messageType: "REST_PREOP_PREPARATION_QUERY",
    handler: ({ state, query }) => withStatus(collection(
      (state.preopPreparations ?? []).filter((item) => (!query.patientId || item.patientId === query.patientId) && (!query.encounterId || item.encounterId === query.encounterId) && (!query.status || item.status === query.status)),
      query
    ))
  },
  {
    method: "GET",
    pattern: "/api/v1/ward-rounds",
    messageType: "REST_WARD_ROUND_QUERY",
    handler: ({ state, query }) => withStatus(collection(
      (state.wardRounds ?? []).filter((item) => (!query.patientId || item.patientId === query.patientId) && (!query.encounterId || item.encounterId === query.encounterId) && (!query.roundType || item.roundType === query.roundType)),
      query
    ))
  },
  {
    method: "GET",
    pattern: "/api/v1/discharge-assessments",
    messageType: "REST_DISCHARGE_ASSESSMENT_QUERY",
    handler: ({ state, query }) => withStatus(collection(
      (state.dischargeAssessments ?? []).filter((item) => (!query.patientId || item.patientId === query.patientId) && (!query.encounterId || item.encounterId === query.encounterId) && (!query.status || item.status === query.status)),
      query
    ))
  },
  {
    method: "GET",
    pattern: "/api/v1/lab-specimen-tracks",
    messageType: "REST_LAB_SPECIMEN_TRACK_QUERY",
    handler: ({ state, query }) => withStatus(collection(
      (state.labSpecimenTracks ?? []).filter((item) => (!query.patientId || item.patientId === query.patientId) && (!query.encounterId || item.encounterId === query.encounterId) && (!query.status || item.status === query.status)),
      query
    ))
  },
  {
    method: "GET",
    pattern: "/api/v1/infusion-records",
    messageType: "REST_INFUSION_RECORD_QUERY",
    handler: ({ state, query }) => withStatus(collection(
      (state.infusionRecords ?? []).filter((item) => (!query.patientId || item.patientId === query.patientId) && (!query.encounterId || item.encounterId === query.encounterId) && (!query.status || item.status === query.status)),
      query
    ))
  },
  {
    method: "GET",
    pattern: "/api/v1/pain-assessments",
    messageType: "REST_PAIN_ASSESSMENT_QUERY",
    handler: ({ state, query }) => withStatus(collection(
      (state.painAssessments ?? []).filter((item) => (!query.patientId || item.patientId === query.patientId) && (!query.encounterId || item.encounterId === query.encounterId) && (!query.phase || item.phase === query.phase)),
      query
    ))
  },
  {
    method: "GET",
    pattern: "/api/v1/wound-care-records",
    messageType: "REST_WOUND_CARE_RECORD_QUERY",
    handler: ({ state, query }) => withStatus(collection(
      (state.woundCareRecords ?? []).filter((item) => (!query.patientId || item.patientId === query.patientId) && (!query.encounterId || item.encounterId === query.encounterId) && (!query.woundSite || item.woundSite.includes(query.woundSite))),
      query
    ))
  },
  {
    method: "GET",
    pattern: "/api/v1/medical-record-homepages",
    messageType: "REST_MEDICAL_RECORD_HOMEPAGE_QUERY",
    handler: ({ state, query }) => withStatus(collection(
      (state.medicalRecordHomePages ?? []).filter((item) => (!query.patientId || item.patientId === query.patientId) && (!query.encounterId || item.encounterId === query.encounterId) && (!query.status || item.status === query.status)),
      query
    ))
  },
  {
    method: "GET",
    pattern: "/api/v1/record-quality-checks",
    messageType: "REST_RECORD_QUALITY_CHECK_QUERY",
    handler: ({ state, query }) => withStatus(collection(
      (state.recordQualityChecks ?? []).filter((item) => (!query.patientId || item.patientId === query.patientId) && (!query.encounterId || item.encounterId === query.encounterId) && (!query.status || item.status === query.status)),
      query
    ))
  },
  {
    method: "GET",
    pattern: "/api/v1/family-notifications",
    messageType: "REST_FAMILY_NOTIFICATION_QUERY",
    handler: ({ state, query }) => withStatus(collection(
      (state.familyNotifications ?? []).filter((item) => (!query.patientId || item.patientId === query.patientId) && (!query.encounterId || item.encounterId === query.encounterId) && (!query.phase || item.phase === query.phase)),
      query
    ))
  },
  {
    method: "GET",
    pattern: "/api/v1/antimicrobial-reviews",
    messageType: "REST_ANTIMICROBIAL_REVIEW_QUERY",
    handler: ({ state, query }) => withStatus(collection(
      (state.antimicrobialReviews ?? []).filter((item) => (!query.patientId || item.patientId === query.patientId) && (!query.encounterId || item.encounterId === query.encounterId) && (!query.status || item.status === query.status)),
      query
    ))
  },
  {
    method: "GET",
    pattern: "/api/v1/or-consumable-usages",
    messageType: "REST_OR_CONSUMABLE_USAGE_QUERY",
    handler: ({ state, query }) => withStatus(collection(
      (state.orConsumableUsages ?? []).filter((item) => (!query.patientId || item.patientId === query.patientId) && (!query.encounterId || item.encounterId === query.encounterId) && (!query.status || item.status === query.status)),
      query
    ))
  },
  {
    method: "GET",
    pattern: "/api/v1/surgery-media-records",
    messageType: "REST_SURGERY_MEDIA_RECORD_QUERY",
    handler: ({ state, query }) => withStatus(collection(
      (state.surgeryMediaRecords ?? []).filter((item) => (!query.patientId || item.patientId === query.patientId) && (!query.encounterId || item.encounterId === query.encounterId) && (!query.status || item.status === query.status)),
      query
    ))
  },
  {
    method: "GET",
    pattern: "/api/v1/dietary-plans",
    messageType: "REST_DIETARY_PLAN_QUERY",
    handler: ({ state, query }) => withStatus(collection(
      (state.dietaryPlans ?? []).filter((item) => (!query.patientId || item.patientId === query.patientId) && (!query.encounterId || item.encounterId === query.encounterId) && (!query.phase || item.phase === query.phase)),
      query
    ))
  },
  {
    method: "GET",
    pattern: "/api/v1/mobility-rehab-records",
    messageType: "REST_MOBILITY_REHAB_RECORD_QUERY",
    handler: ({ state, query }) => withStatus(collection(
      (state.mobilityRehabRecords ?? []).filter((item) => (!query.patientId || item.patientId === query.patientId) && (!query.encounterId || item.encounterId === query.encounterId)),
      query
    ))
  },
  {
    method: "GET",
    pattern: "/api/v1/vte-prophylaxis-records",
    messageType: "REST_VTE_PROPHYLAXIS_RECORD_QUERY",
    handler: ({ state, query }) => withStatus(collection(
      (state.vteProphylaxisRecords ?? []).filter((item) => (!query.patientId || item.patientId === query.patientId) && (!query.encounterId || item.encounterId === query.encounterId) && (!query.riskLevel || item.riskLevel === query.riskLevel)),
      query
    ))
  },
  {
    method: "GET",
    pattern: "/api/v1/nursing-handovers",
    messageType: "REST_NURSING_HANDOVER_QUERY",
    handler: ({ state, query }) => withStatus(collection(
      (state.nursingHandovers ?? []).filter((item) => (!query.patientId || item.patientId === query.patientId) && (!query.encounterId || item.encounterId === query.encounterId) && (!query.handoverType || item.handoverType === query.handoverType)),
      query
    ))
  },
  {
    method: "GET",
    pattern: "/api/v1/postop-observation-records",
    messageType: "REST_POSTOP_OBSERVATION_RECORD_QUERY",
    handler: ({ state, query }) => withStatus(collection(
      (state.postopObservationRecords ?? []).filter((item) => (!query.patientId || item.patientId === query.patientId) && (!query.encounterId || item.encounterId === query.encounterId) && (!query.status || item.status === query.status)),
      query
    ))
  },
  {
    method: "GET",
    pattern: "/api/v1/medication-counseling-records",
    messageType: "REST_MEDICATION_COUNSELING_RECORD_QUERY",
    handler: ({ state, query }) => withStatus(collection(
      (state.medicationCounselingRecords ?? []).filter((item) => (!query.patientId || item.patientId === query.patientId) && (!query.encounterId || item.encounterId === query.encounterId) && (!query.status || item.status === query.status)),
      query
    ))
  },
  {
    method: "GET",
    pattern: "/api/v1/discharge-education-records",
    messageType: "REST_DISCHARGE_EDUCATION_RECORD_QUERY",
    handler: ({ state, query }) => withStatus(collection(
      (state.dischargeEducationRecords ?? []).filter((item) => (!query.patientId || item.patientId === query.patientId) && (!query.encounterId || item.encounterId === query.encounterId) && (!query.status || item.status === query.status)),
      query
    ))
  },
  {
    method: "GET",
    pattern: "/api/v1/invoice-records",
    messageType: "REST_INVOICE_RECORD_QUERY",
    handler: ({ state, query }) => withStatus(collection(
      (state.invoiceRecords ?? []).filter((item) => (!query.patientId || item.patientId === query.patientId) && (!query.encounterId || item.encounterId === query.encounterId) && (!query.status || item.status === query.status)),
      query
    ))
  },
  {
    method: "GET",
    pattern: "/api/v1/follow-up-outcomes",
    messageType: "REST_FOLLOW_UP_OUTCOME_QUERY",
    handler: ({ state, query }) => withStatus(collection(
      (state.followUpOutcomeRecords ?? []).filter((item) => (!query.patientId || item.patientId === query.patientId) && (!query.encounterId || item.encounterId === query.encounterId) && (!query.status || item.status === query.status)),
      query
    ))
  },
  {
    method: "GET",
    pattern: "/api/v1/infection-surveillance-records",
    messageType: "REST_INFECTION_SURVEILLANCE_RECORD_QUERY",
    handler: ({ state, query }) => withStatus(collection(
      (state.infectionSurveillanceRecords ?? []).filter((item) => (!query.patientId || item.patientId === query.patientId) && (!query.encounterId || item.encounterId === query.encounterId) && (!query.status || item.status === query.status)),
      query
    ))
  },
  {
    method: "GET",
    pattern: "/api/v1/satisfaction-surveys",
    messageType: "REST_SATISFACTION_SURVEY_QUERY",
    handler: ({ state, query }) => withStatus(collection(
      (state.satisfactionSurveys ?? []).filter((item) => (!query.patientId || item.patientId === query.patientId) && (!query.encounterId || item.encounterId === query.encounterId) && (!query.status || item.status === query.status)),
      query
    ))
  },
  {
    method: "GET",
    pattern: "/api/v1/consultations",
    messageType: "REST_CONSULTATION_QUERY",
    handler: ({ state, query }) => withStatus(listConsultations(state, query))
  },
  {
    method: "POST",
    pattern: "/api/v1/consultations",
    messageType: "REST_CONSULTATION_CREATE",
    handler: ({ state, body }) => withStatus(createConsultation(state, body ?? {}), 201)
  },
  {
    method: "PATCH",
    pattern: "/api/v1/consultations/:consultationId/status",
    messageType: "REST_CONSULTATION_STATUS_UPDATE",
    handler: ({ state, params, body }) => withStatus(updateConsultationStatus(state, params.consultationId, body ?? {}))
  },
  {
    method: "GET",
    pattern: "/api/v1/teaching-sessions",
    messageType: "REST_TEACHING_SESSION_QUERY",
    handler: ({ state, query }) => withStatus(listTeachingSessions(state, query))
  },
  {
    method: "POST",
    pattern: "/api/v1/teaching-sessions",
    messageType: "REST_TEACHING_SESSION_CREATE",
    handler: ({ state, body }) => withStatus(createTeachingSession(state, body ?? {}), 201)
  },
  {
    method: "PATCH",
    pattern: "/api/v1/teaching-sessions/:sessionId/status",
    messageType: "REST_TEACHING_SESSION_STATUS_UPDATE",
    handler: ({ state, params, body }) => withStatus(updateTeachingSessionStatus(state, params.sessionId, body ?? {}))
  },
  {
    method: "GET",
    pattern: "/api/v1/device-terminals",
    messageType: "REST_DEVICE_TERMINAL_QUERY",
    handler: ({ state, query }) => withStatus(collection(
      state.deviceTerminals.filter((item) => (!query.roomId || item.roomId === query.roomId) && (!query.deviceType || item.deviceType === query.deviceType || item.terminalType === query.deviceType)),
      query
    ))
  },
  {
    method: "GET",
    pattern: "/api/v1/or-terminals",
    messageType: "REST_OR_TERMINAL_QUERY",
    handler: ({ state, query }) => withStatus(listOrTerminals(state, query))
  },
  {
    method: "GET",
    pattern: "/api/v1/or-terminals/:deviceId",
    messageType: "REST_OR_TERMINAL_GET",
    handler: ({ state, params }) => withStatus(getOrTerminal(state, params.deviceId))
  },
  {
    method: "POST",
    pattern: "/api/v1/or-terminals/register",
    messageType: "REST_OR_TERMINAL_REGISTER",
    handler: ({ state, body }) => withStatus(registerOrTerminal(state, body ?? {}), 201)
  },
  {
    method: "PATCH",
    pattern: "/api/v1/or-terminals/:deviceId/binding",
    messageType: "REST_OR_TERMINAL_BINDING_UPDATE",
    handler: ({ state, params, body }) => withStatus(updateOrTerminalBinding(state, params.deviceId, body ?? {}))
  },
  {
    method: "PATCH",
    pattern: "/api/v1/or-terminals/:deviceId/status",
    messageType: "REST_OR_TERMINAL_STATUS_UPDATE",
    handler: ({ state, params, body }) => withStatus(updateOrTerminalStatus(state, params.deviceId, body ?? {}))
  },
  {
    method: "POST",
    pattern: "/api/v1/or-terminals/:deviceId/heartbeat",
    messageType: "REST_OR_TERMINAL_HEARTBEAT",
    handler: ({ state, params, body }) => withStatus(recordOrTerminalHeartbeat(state, params.deviceId, body ?? {}))
  },
  {
    method: "GET",
    pattern: "/api/v1/media-sources",
    messageType: "REST_MEDIA_SOURCE_QUERY",
    handler: ({ state, query }) => withStatus(collection(
      state.mediaSources.filter((item) => (!query.roomId || item.roomId === query.roomId) && (!query.enabled || String(item.enabled) === query.enabled)),
      query
    ))
  },
  {
    method: "GET",
    pattern: "/api/v1/journey-templates",
    messageType: "REST_JOURNEY_TEMPLATE_QUERY",
    handler: ({ state, query }) => withStatus(listJourneyTemplates(state, query))
  },
  {
    method: "GET",
    pattern: "/api/v1/journey-templates/:templateId",
    messageType: "REST_JOURNEY_TEMPLATE_GET",
    handler: ({ state, params }) => withStatus(getJourneyTemplate(state, params.templateId))
  },
  {
    method: "GET",
    pattern: "/api/v1/patient-journeys",
    messageType: "REST_PATIENT_JOURNEY_QUERY",
    handler: ({ state, query }) => withStatus(listPatientJourneys(state, query))
  },
  {
    method: "GET",
    pattern: "/api/v1/patient-journeys/summary",
    messageType: "REST_PATIENT_JOURNEY_SUMMARY",
    handler: ({ state }) => withStatus(summarizePatientJourneys(state))
  },
  {
    method: "GET",
    pattern: "/api/v1/hospital-operation/status",
    messageType: "REST_HOSPITAL_OPERATION_STATUS",
    handler: ({ state }) => withStatus(getNaturalHospitalOperationStatus(state))
  },
  {
    method: "POST",
    pattern: "/api/v1/hospital-operation/tick",
    messageType: "REST_HOSPITAL_OPERATION_TICK",
    handler: ({ state, body }) => withStatus(tickNaturalHospitalOperation(state, body ?? {}))
  },
  {
    method: "POST",
    pattern: "/api/v1/hospital-operation/rebuild",
    messageType: "REST_HOSPITAL_OPERATION_REBUILD",
    handler: ({ state, body }) => withStatus(initializeNaturalHospitalOperation(state, { ...(body ?? {}), rebuild: true }), 201)
  },
  {
    method: "GET",
    pattern: "/api/v1/patient-journeys/:journeyId",
    messageType: "REST_PATIENT_JOURNEY_GET",
    handler: ({ state, params }) => withStatus(getPatientJourney(state, params.journeyId))
  },
  {
    method: "POST",
    pattern: "/api/v1/patient-journeys",
    messageType: "REST_PATIENT_JOURNEY_CREATE",
    handler: ({ state, body }) => withStatus(createPatientJourney(state, body ?? {}), 201)
  },
  {
    method: "POST",
    pattern: "/api/v1/patient-journeys/:journeyId/next",
    messageType: "REST_PATIENT_JOURNEY_NEXT",
    handler: ({ state, params }) => withStatus(advancePatientJourney(state, params.journeyId))
  },
  {
    method: "POST",
    pattern: "/api/v1/patient-journeys/:journeyId/run",
    messageType: "REST_PATIENT_JOURNEY_RUN",
    handler: ({ state, params }) => withStatus(runPatientJourney(state, params.journeyId))
  },
  {
    method: "POST",
    pattern: "/api/v1/patient-journeys/:journeyId/reset",
    messageType: "REST_PATIENT_JOURNEY_RESET",
    handler: ({ state, params }) => withStatus(resetPatientJourney(state, params.journeyId))
  },
  {
    method: "GET",
    pattern: "/api/v1/patient-journeys/:journeyId/timeline",
    messageType: "REST_PATIENT_JOURNEY_TIMELINE",
    handler: ({ state, params, query }) => withStatus(getPatientJourneyTimeline(state, params.journeyId, query))
  },
  {
    method: "POST",
    pattern: "/api/v1/patient-journeys/simulate-cohort",
    messageType: "REST_PATIENT_JOURNEY_SIMULATE_COHORT",
    handler: ({ state, body }) => withStatus(simulatePatientJourneyCohort(state, body ?? { count: 100 }), 201)
  },
  {
    method: "GET",
    pattern: "/api/v1/scenarios",
    messageType: "REST_SCENARIO_QUERY",
    handler: ({ state, query }) => withStatus(collection(state.scenarios.filter((item) => !query.enabled || String(item.enabled) === query.enabled), query))
  },
  {
    method: "POST",
    pattern: "/api/v1/scenarios/:scenarioId/runs",
    messageType: "REST_SCENARIO_RUN_START",
    handler: ({ state, params, body }) => withStatus(startScenarioRun(state, params.scenarioId, body ?? {}), 201)
  },
  {
    method: "GET",
    pattern: "/api/v1/scenario-runs/:runId",
    messageType: "REST_SCENARIO_RUN_GET",
    handler: ({ state, params }) => {
      const run = requireFound(findById(state.scenarioRuns, "runId", params.runId), `Scenario run ${params.runId} was not found.`);
      return withStatus({ ...run, scenario: findById(state.scenarios, "scenarioId", run.scenarioId) });
    }
  },
  {
    method: "POST",
    pattern: "/api/v1/scenario-runs/:runId/next",
    messageType: "REST_SCENARIO_RUN_NEXT",
    handler: ({ state, params }) => withStatus(advanceScenarioRun(state, params.runId))
  },
  {
    method: "POST",
    pattern: "/api/v1/data-factory/reset",
    messageType: "REST_DATA_RESET",
    handler: ({ state }) => {
      resetState(state);
      return withStatus({ reset: true, patients: state.patients.length, surgerySchedules: state.surgerySchedules.length });
    }
  },
  {
    method: "POST",
    pattern: "/api/v1/data-factory/generate-patients",
    messageType: "REST_DATA_GENERATE_PATIENTS",
    handler: ({ state, body }) => withStatus({ items: generatePatients(state, Number(body?.count ?? 1)) }, 201)
  },
  {
    method: "POST",
    pattern: "/api/v1/data-factory/generate-surgeries",
    messageType: "REST_DATA_GENERATE_SURGERIES",
    handler: ({ state, body }) => withStatus({ items: generateSurgeries(state, Number(body?.count ?? 1)) }, 201)
  },
  {
    method: "GET",
    pattern: "/api/v1/interface-messages",
    messageType: "REST_INTERFACE_MESSAGE_QUERY",
    skipLog: true,
    handler: ({ state, query }) => withStatus(listInterfaceMessages(state, query))
  },
  {
    method: "GET",
    pattern: "/api/v1/interface-messages/:messageId",
    messageType: "REST_INTERFACE_MESSAGE_GET",
    skipLog: true,
    handler: ({ state, params }) => withStatus(requireFound(findById(state.interfaceMessages, "messageId", params.messageId), `Interface message ${params.messageId} was not found.`))
  },
  {
    method: "POST",
    pattern: "/api/v1/interface-messages/:messageId/replay",
    messageType: "REST_INTERFACE_MESSAGE_REPLAY",
    handler: ({ state, params }) => {
      const source = requireFound(findById(state.interfaceMessages, "messageId", params.messageId), `Interface message ${params.messageId} was not found.`);
      return withStatus(logInterfaceMessage(state, {
        ...source,
        status: "replayed",
        errorMessage: null,
        requestBody: source.requestBody,
        responseBody: { replayedFrom: source.messageId }
      }), 201);
    }
  },
  {
    method: "PATCH",
    pattern: "/api/v1/interface-channels/:channelId/enabled",
    messageType: "REST_INTERFACE_CHANNEL_ENABLE",
    handler: ({ state, params, body }) => {
      const channel = requireFound(findById(state.interfaceChannels, "channelId", params.channelId), `Interface channel ${params.channelId} was not found.`);
      channel.enabled = Boolean(body?.enabled);
      return withStatus(channel);
    }
  },
  {
    method: "GET",
    pattern: "/api/v1/hl7/messages",
    messageType: "REST_HL7_MESSAGE_BUILD",
    handler: ({ state, query }) => withStatus({
      messageType: query.messageType ?? "ADT_A01",
      content: buildHl7Message(state, query.messageType ?? "ADT_A01", query)
    })
  }
];

function getDictionary(dictCode) {
  const dictionaries = {
    gender: ["男", "女", "未知"],
    encounter_type: ["门诊", "急诊", "住院", "体检"],
    insurance_type: ["城镇职工", "城乡居民", "自费", "商业保险"],
    surgery_status: ["已排班", "已接台", "已入室", "麻醉开始", "手术开始", "手术结束", "已出室", "清洁中", "已完成", "已取消"],
    anesthesia_method: ["全麻", "椎管内麻醉", "局麻", "神经阻滞", "复合麻醉"],
    modality: ["CT", "MR", "DX", "US", "ES", "XA", "OT"]
  };

  return {
    dictCode,
    items: requireFound(dictionaries[dictCode], `Dictionary ${dictCode} was not found.`)
  };
}

function rootResponse() {
  return {
    name: "SmartHIS",
    version: "0.1.0",
    status: "运行中",
    links: {
      health: "/health",
      api: "/api/v1",
      surgerySchedules: "/api/v1/surgery-schedules?date=2026-05-16",
      patientJourneys: "/api/v1/patient-journeys",
      hospitalOperation: "/api/v1/hospital-operation/status",
      defaultJourneyTimeline: "/api/v1/patient-journeys/JNY000001/timeline",
      encounterSummary: "/api/v1/encounters/ENC000001/summary",
      fhirPatients: "/fhir/Patient",
      dicomStudies: "/dicomweb/studies",
      interfaceMessages: "/api/v1/interface-messages"
    }
  };
}

function handleFhir(state, method, pathname) {
  if (method !== "GET") {
    throw new HttpError(405, "FHIR endpoint only supports GET in this MVP.");
  }

  if (pathname === "/fhir/metadata") {
    return withStatus({
      resourceType: "CapabilityStatement",
      status: "active",
      date: new Date().toISOString(),
      kind: "instance",
      software: { name: "SmartHIS", version: "0.1.0" },
      fhirVersion: "4.0.1",
      format: ["json"]
    });
  }

  const resourceMatch = routeParams("/fhir/:resourceType", pathname);
  if (resourceMatch) {
    const bundle = fhirSearch(state, resourceMatch.resourceType);
    if (!bundle) {
      throw new HttpError(404, `FHIR resource ${resourceMatch.resourceType} is not supported.`);
    }
    return withStatus(bundle);
  }

  const instanceMatch = routeParams("/fhir/:resourceType/:id", pathname);
  if (instanceMatch) {
    const bundle = fhirSearch(state, instanceMatch.resourceType);
    if (!bundle) {
      throw new HttpError(404, `FHIR resource ${instanceMatch.resourceType} is not supported.`);
    }
    const entry = bundle.entry.find((item) => item.resource.id === instanceMatch.id);
    return withStatus(requireFound(entry?.resource, `${instanceMatch.resourceType}/${instanceMatch.id} was not found.`));
  }

  throw new HttpError(404, `FHIR path ${pathname} was not found.`);
}

function handleDicomweb(state, method, pathname, query) {
  if (method !== "GET") {
    throw new HttpError(405, "DICOMweb endpoint only supports GET in this MVP.");
  }

  if (pathname === "/dicomweb/studies") {
    const studies = state.imagingStudies.filter((study) => (
      (!query.PatientID || study.patientId === query.PatientID)
      && (!query.AccessionNumber || study.accessionNo === query.AccessionNumber)
    ));
    return withStatus(studies.map((study) => ({
      "0020000D": { vr: "UI", Value: [study.studyInstanceUid] },
      "00080050": { vr: "SH", Value: [study.accessionNo] },
      "00100020": { vr: "LO", Value: [study.patientId] },
      "00080060": { vr: "CS", Value: [study.modality] },
      "00080020": { vr: "DA", Value: [study.studyTime.slice(0, 10).replaceAll("-", "")] }
    })));
  }

  const renderedMatch = routeParams("/dicomweb/studies/:studyUid/series/:seriesNo/instances/:instanceNo/rendered", pathname);
  if (renderedMatch) {
    const study = requireFound(
      state.imagingStudies.find((item) => item.studyInstanceUid === renderedMatch.studyUid),
      `DICOM study ${renderedMatch.studyUid} was not found.`
    );
    return {
      status: 200,
      body: buildPngImage(study),
      headers: {
        "content-type": "image/png",
        "cache-control": "no-store"
      }
    };
  }

  const fileMatch = routeParams("/dicomweb/studies/:studyUid/series/:seriesNo/instances/:instanceNo/file", pathname);
  if (fileMatch) {
    const study = requireFound(
      state.imagingStudies.find((item) => item.studyInstanceUid === fileMatch.studyUid),
      `DICOM study ${fileMatch.studyUid} was not found.`
    );
    const patient = findById(state.patients, "patientId", study.patientId);
    return {
      status: 200,
      body: buildDicomFile(study, patient),
      headers: {
        "content-type": "application/dicom",
        "content-disposition": `inline; filename="${study.accessionNo}.dcm"`,
        "cache-control": "no-store"
      }
    };
  }

  const metadataMatch = routeParams("/dicomweb/studies/:studyUid/metadata", pathname);
  if (metadataMatch) {
    const study = requireFound(
      state.imagingStudies.find((item) => item.studyInstanceUid === metadataMatch.studyUid),
      `DICOM study ${metadataMatch.studyUid} was not found.`
    );
    return withStatus([
      {
        "0020000D": { vr: "UI", Value: [study.studyInstanceUid] },
        "00080018": { vr: "UI", Value: [`${study.studyInstanceUid}.1.1`] },
        "00080016": { vr: "UI", Value: ["1.2.840.10008.5.1.4.1.1.7"] },
        "00080050": { vr: "SH", Value: [study.accessionNo] },
        "00080060": { vr: "CS", Value: [study.modality] },
        "00081190": { vr: "UR", Value: [`/dicomweb/studies/${study.studyInstanceUid}/series/1/instances/1/file`] },
        "7FE00010": { vr: "OW", BulkDataURI: `/dicomweb/studies/${study.studyInstanceUid}/series/1/instances/1/file` }
      }
    ]);
  }

  const studyMatch = routeParams("/dicomweb/studies/:studyUid", pathname);
  if (studyMatch) {
    const study = requireFound(
      state.imagingStudies.find((item) => item.studyInstanceUid === studyMatch.studyUid),
      `DICOM study ${studyMatch.studyUid} was not found.`
    );
    return withStatus(study);
  }

  throw new HttpError(404, `DICOMweb path ${pathname} was not found.`);
}

function handleAssets(state, pathname) {
  const previewMatch = routeParams("/assets/imaging/:studyUid/preview.png", pathname);
  if (!previewMatch) {
    throw new HttpError(404, `Asset path ${pathname} was not found.`);
  }
  const study = requireFound(
    state.imagingStudies.find((item) => item.studyInstanceUid === previewMatch.studyUid),
    `Imaging study ${previewMatch.studyUid} was not found.`
  );
  return {
    status: 200,
    body: buildPngImage(study),
    headers: {
      "content-type": "image/png",
      "cache-control": "no-store"
    }
  };
}

function handleViewer(state, pathname) {
  const match = routeParams("/viewer/studies/:studyUid", pathname);
  if (!match) {
    throw new HttpError(404, `Viewer path ${pathname} was not found.`);
  }

  const study = requireFound(
    state.imagingStudies.find((item) => item.studyInstanceUid === match.studyUid),
    `DICOM study ${match.studyUid} was not found.`
  );

  return {
    status: 200,
    body: `<!doctype html>
<html lang="zh-CN">
<head><meta charset="utf-8"><title>影像调阅模拟</title></head>
<body>
<h1>影像调阅模拟</h1>
<p>检查号：${study.accessionNo}</p>
<p>StudyInstanceUID：${study.studyInstanceUid}</p>
<p>检查类型：${study.modality}</p>
<img alt="影像预览" src="/assets/imaging/${study.studyInstanceUid}/preview.png" style="max-width: 640px; width: 100%; background: #111;">
<p><a href="/dicomweb/studies/${study.studyInstanceUid}/series/1/instances/1/file">下载 DICOM Part 10 测试文件</a></p>
<p>影像为脱敏合成测试片，包含可调阅 PNG 预览、DICOMweb 元数据和 Part 10 DICOM 文件，用于硬件厂商联调，不用于真实诊断。</p>
</body>
</html>`,
    headers: { "content-type": "text/html; charset=utf-8" }
  };
}

async function dispatch(ctx) {
  const { method, pathname, state, query } = ctx;

  if (method === "OPTIONS") {
    return withStatus({ ok: true }, 204);
  }

  if (method === "GET" && pathname === "/") {
    return withStatus(rootResponse());
  }

  if (method === "GET" && pathname === "/favicon.ico") {
    return { status: 204, body: null };
  }

  if (method === "GET" && pathname === "/console") {
    return {
      status: 200,
      body: renderConsoleHtml(),
      headers: { "content-type": "text/html; charset=utf-8" }
    };
  }

  if (method === "GET" && pathname === "/family-waiting-display") {
    return {
      status: 200,
      body: renderWaitingDisplayHtml(),
      headers: { "content-type": "text/html; charset=utf-8" }
    };
  }

  if (method === "GET" && pathname === "/or-door-display") {
    return {
      status: 200,
      body: renderOrDoorDisplayHtml(),
      headers: { "content-type": "text/html; charset=utf-8" }
    };
  }

  if (method === "GET" && pathname === "/or-inner-control") {
    return {
      status: 200,
      body: renderOrInnerControlHtml(),
      headers: { "content-type": "text/html; charset=utf-8" }
    };
  }

  if (method === "GET" && pathname === "/or-terminal-simulator") {
    return {
      status: 200,
      body: renderOrTerminalSimulatorHtml(),
      headers: { "content-type": "text/html; charset=utf-8" }
    };
  }

  if (method === "GET" && pathname === "/or-nurse-station-display") {
    return {
      status: 200,
      body: renderOrNurseStationDisplayHtml(),
      headers: { "content-type": "text/html; charset=utf-8" }
    };
  }

  if (method === "GET" && pathname === "/director-quality-display") {
    return {
      status: 200,
      body: renderDirectorQualityDisplayHtml(),
      headers: { "content-type": "text/html; charset=utf-8" }
    };
  }

  if (method === "GET" && pathname === "/health") {
    return withStatus({ status: "ok", service: "SmartHIS", time: new Date().toISOString() });
  }

  if (pathname.startsWith("/fhir")) {
    return { ...handleFhir(state, method, pathname, query), route: { messageType: "FHIR_API" } };
  }

  if (pathname.startsWith("/dicomweb")) {
    return { ...handleDicomweb(state, method, pathname, query), route: { messageType: "DICOMWEB_API" } };
  }

  if (method === "GET" && pathname.startsWith("/assets/imaging")) {
    return { ...handleAssets(state, pathname), route: { messageType: "IMAGING_ASSET" } };
  }

  if (pathname.startsWith("/viewer")) {
    return handleViewer(state, pathname);
  }

  for (const route of routes) {
    if (route.method !== method) {
      continue;
    }

    const params = routeParams(route.pattern, pathname);
    if (!params) {
      continue;
    }

    const result = await route.handler({ ...ctx, params });
    return { ...result, route };
  }

  throw new HttpError(404, `Route ${method} ${pathname} was not found.`);
}

export function createApp(options = {}) {
  const state = options.state ?? createSeedState();
  const naturalOperationEnabled = options.enableNaturalOperation
    ?? process.env.SMARTHIS_NATURAL_OPERATION === "1";

  const server = http.createServer(async (req, res) => {
    const url = new URL(req.url ?? "/", `http://${req.headers.host ?? "localhost"}`);
    const query = pickQuery(url.searchParams);
    const method = req.method ?? "GET";
    const pathname = url.pathname;
    const correlationId = req.headers["x-correlation-id"] ?? undefined;
    let body = null;

    try {
      if (["POST", "PATCH", "PUT"].includes(method)) {
        body = await readBody(req);
      }

      const result = await dispatch({ state, req, method, pathname, query, body, headers: req.headers });
      const route = result.route;

      if (route && !route.skipLog) {
        logInterfaceMessage(state, {
          correlationId,
          channelId: pathname.startsWith("/fhir") ? "CH000002" : pathname.startsWith("/dicomweb") ? "CH000003" : "CH000001",
          messageType: route.messageType,
          direction: "request",
          status: result.status >= 400 ? "failed" : "success",
          requestBody: redact({ method, pathname, query, body }),
          responseBody: responseSummary(result.body)
        });
      }

      if (Buffer.isBuffer(result.body)) {
        sendBuffer(res, result.status, result.body, result.headers);
      } else if (result.headers?.["content-type"]?.startsWith("text/")) {
        sendText(res, result.status, result.body, result.headers["content-type"]);
      } else {
        const body = pathname.startsWith("/fhir") || pathname.startsWith("/dicomweb")
          ? result.body
          : normalizeBusinessTextForChina(result.body);
        sendJson(res, result.status, body, result.headers);
      }
    } catch (error) {
      const status = error instanceof HttpError ? error.status : 500;
      logInterfaceMessage(state, {
        correlationId,
        channelId: "CH000001",
        messageType: "ERROR",
        direction: "request",
        status: "failed",
        requestBody: redact({ method, pathname, query, body }),
        errorMessage: error.message
      });
      sendJson(res, status, normalizeBusinessTextForChina({
        error: error.name ?? "Error",
        message: error.message,
        details: error.details
      }));
    }
  });

  server.state = state;
  server.naturalOperation = naturalOperationEnabled
    ? startNaturalHospitalOperation(state, options.naturalOperation ?? {})
    : null;
  server.on("close", () => {
    server.naturalOperation?.stop();
  });
  return server;
}
