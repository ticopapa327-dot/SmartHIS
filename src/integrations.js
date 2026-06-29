import { businessLabel, formatBeijingDateTime } from "./china-standard.js";
import {
  buildDoorDisplaySnapshot,
  buildFamilyWaitingSnapshot,
  enrichSurgerySchedule,
  findById,
  getCurrentSurgeryByRoom
} from "./domain.js";

const CLOSED_SURGERY_STATUSES = new Set(["Completed", "Cancelled"]);
const ACTIVE_SURGERY_STATUSES = new Set(["Called", "InRoom", "AnesthesiaStarted", "SurgeryStarted", "SurgeryEnded", "OutRoom", "Cleaning"]);

export function normalizeIntegrationDataScope(value = "display") {
  return String(value).toLowerCase() === "full" ? "full" : "display";
}

function isFullScope(scope) {
  return normalizeIntegrationDataScope(scope) === "full";
}

function maskName(name = "") {
  const text = String(name || "");
  if (!text) {
    return "";
  }
  if (text.length === 1) {
    return "*";
  }
  if (text.length === 2) {
    return `${text.slice(0, 1)}*`;
  }
  return `${text.slice(0, 1)}${"*".repeat(text.length - 2)}${text.slice(-1)}`;
}

function maskNo(value = "") {
  const text = String(value || "");
  if (!text) {
    return "";
  }
  if (text.length <= 6) {
    return `${text.slice(0, 2)}****`;
  }
  return `${text.slice(0, 4)}****${text.slice(-2)}`;
}

function scopedName(name, scope) {
  return isFullScope(scope) ? String(name || "") : maskName(name);
}

function scopedNo(value, scope) {
  return isFullScope(scope) ? String(value || "") : maskNo(value);
}

function latestEvent(enriched) {
  return (enriched?.events ?? [])
    .slice()
    .sort((left, right) => String(right.eventTime).localeCompare(String(left.eventTime)))[0] ?? null;
}

function staffName(enriched, role) {
  return enriched?.staff?.find((assignment) => assignment.role === role)?.practitioner?.name ?? "";
}

function patientPayload(state, enriched, scope) {
  const encounter = enriched?.encounter ?? null;
  const admission = encounter
    ? state.admissions.find((item) => item.encounterId === encounter.encounterId) ?? null
    : null;
  const ward = admission ? findById(state.wards, "wardId", admission.wardId) : null;
  const bed = admission ? findById(state.beds, "bedId", admission.bedId) : null;
  const patient = enriched?.patient ?? null;

  if (!patient) {
    return null;
  }

  return {
    patientId: patient.patientId,
    mpiNo: isFullScope(scope) ? patient.mpiNo : "",
    name: scopedName(patient.name, scope),
    gender: patient.gender,
    ageText: patient.ageText,
    inpatientNo: scopedNo(encounter?.inpatientNo, scope),
    outpatientNo: scopedNo(encounter?.outpatientNo, scope),
    visitNo: scopedNo(encounter?.visitNo, scope),
    departmentName: encounter?.department?.deptName ?? "",
    wardName: ward?.wardName ?? "",
    bedNo: isFullScope(scope) ? (bed?.bedNo ?? "") : "",
    insuranceType: isFullScope(scope) ? patient.insuranceType : "",
    allergyText: isFullScope(scope) ? patient.allergyText : ""
  };
}

function surgeryPayload(state, enriched, scope) {
  if (!enriched) {
    return null;
  }
  const event = latestEvent(enriched);
  return {
    surgeryScheduleId: enriched.surgeryScheduleId,
    surgeryNo: enriched.surgeryNo,
    scheduleDate: enriched.scheduleDate,
    roomId: enriched.roomId,
    roomName: enriched.room?.roomName ?? enriched.roomId,
    tableNo: enriched.tableNo,
    patient: patientPayload(state, enriched, scope),
    plannedSurgeryCode: enriched.plannedSurgeryCode,
    plannedSurgeryName: enriched.plannedSurgeryName,
    surgeryLevel: enriched.surgeryLevel,
    anesthesiaMethod: enriched.anesthesiaMethod,
    status: businessLabel(enriched.status),
    plannedStartTime: enriched.plannedStartTime,
    plannedEndTime: enriched.plannedEndTime,
    actualStartTime: enriched.actualStartTime,
    actualEndTime: enriched.actualEndTime,
    staff: {
      primarySurgeon: staffName(enriched, "主刀"),
      anesthetist: staffName(enriched, "麻醉医生"),
      circulatingNurse: staffName(enriched, "巡回护士"),
      scrubNurse: staffName(enriched, "器械护士")
    },
    latestEvent: event ? {
      eventId: event.eventId,
      eventType: businessLabel(event.eventType),
      eventTime: event.eventTime,
      deviceId: event.deviceId ?? null,
      operatorId: event.operatorId ?? null
    } : null,
    eventCount: enriched.events?.length ?? 0
  };
}

function schedulesForRoom(state, roomId, date = null) {
  return state.surgerySchedules
    .filter((schedule) => schedule.roomId === roomId)
    .filter((schedule) => !date || schedule.scheduleDate === date)
    .slice()
    .sort((left, right) => String(left.scheduleDate || "").localeCompare(String(right.scheduleDate || ""))
      || String(left.plannedStartTime || "").localeCompare(String(right.plannedStartTime || ""))
      || Number(left.tableNo ?? 0) - Number(right.tableNo ?? 0));
}

function firstDisplayableSchedule(state, roomId, date = null) {
  const active = state.surgerySchedules.find((schedule) => schedule.roomId === roomId && ACTIVE_SURGERY_STATUSES.has(schedule.status));
  if (active) {
    return active;
  }
  return schedulesForRoom(state, roomId, date).find((schedule) => !CLOSED_SURGERY_STATUSES.has(schedule.status)) ?? null;
}

function terminalRowsForRoom(state, roomId) {
  return (state.deviceTerminals ?? [])
    .filter((terminal) => terminal.roomId === roomId)
    .map((terminal) => ({
      deviceId: terminal.deviceId,
      deviceName: terminal.deviceName,
      terminalType: terminal.terminalType ?? terminal.deviceType ?? "",
      status: businessLabel(terminal.status ?? "Online"),
      lastHeartbeatTime: terminal.lastHeartbeatTime ?? null,
      ipAddress: terminal.ipAddress ?? null
    }));
}

function terminalHealth(state, roomId) {
  const terminals = terminalRowsForRoom(state, roomId);
  return {
    total: terminals.length,
    online: terminals.filter((item) => item.status === "在线").length,
    offline: terminals.filter((item) => item.status === "离线").length,
    terminals
  };
}

function callStatus(status) {
  if (status === "Scheduled") return "待叫号";
  if (status === "Called") return "已叫号";
  if (["InRoom", "AnesthesiaStarted", "SurgeryStarted"].includes(status)) return "术中";
  if (["SurgeryEnded", "OutRoom"].includes(status)) return "术后转运";
  if (status === "Cleaning") return "房间清洁";
  if (status === "Completed") return "已完成";
  if (status === "Cancelled") return "已取消";
  return businessLabel(status);
}

export function buildIntegrationProfiles() {
  return {
    数据范围: [
      { code: "display", name: "角色显示字段", description: "默认模式，按终端角色输出最小必要字段。" },
      { code: "full", name: "授权真实字段", description: "用于授权第三方联调，输出真实姓名、住院号、床号等角色必要字段。" }
    ],
    样本依据: {
      sourceName: "连云港中医院 11-17 本地样本",
      observedFiles: "193 个 DICOM、1 个 X线检查报告 PDF、5 张截图、1 个压缩包；未发现可直接导入的业务数据库文件。",
      observedFields: [
        "DICOM: 检查号、检查日期、检查时间、检查类型、检查描述、SOP Instance UID",
        "PDF报告: 登记号、检查号、检查日期、姓名、性别、年龄、床号、科室、住院号、门诊号、检查项目、检查方法、报告医师、审核医师、报告日期"
      ],
      boundary: "样本可用于对接字段建模，不能证明医院 HIS/EMR/RIS/PACS 的关系数据库表结构。"
    },
    profiles: [
      {
        roleCode: "or-door-screen",
        roleName: "第三方手术室门口屏",
        endpoint: "/api/v1/integrations/or-door-screens/{roomId}/snapshot",
        sqliteView: "vendor_or_door_screen",
        primaryFilters: ["roomId", "date"],
        keyFields: ["手术间", "台次", "手术状态", "患者姓名", "住院号", "床号", "手术名称", "麻醉方式", "主刀医师", "麻醉医师"]
      },
      {
        roleCode: "or-status-panel",
        roleName: "第三方手术室信息显示与运行状态面板",
        endpoint: "/api/v1/integrations/or-panels/{roomId}/snapshot",
        sqliteView: "vendor_or_status_panel",
        primaryFilters: ["roomId", "date"],
        keyFields: ["当前手术", "下一台手术", "房间状态", "终端在线状态", "最近事件", "手术人员", "时间轴"]
      },
      {
        roleCode: "queue-calling",
        roleName: "第三方排队叫号系统",
        endpoint: "/api/v1/integrations/queue-calls/snapshot",
        sqliteView: "vendor_queue_call",
        primaryFilters: ["date", "roomId", "status"],
        keyFields: ["队列号", "叫号状态", "患者姓名", "住院号", "手术间", "台次", "计划开始时间", "叫号文本"]
      }
    ]
  };
}

export function buildOrDoorScreenIntegrationSnapshot(state, roomId, options = {}) {
  const dataScope = normalizeIntegrationDataScope(options.dataScope);
  const door = buildDoorDisplaySnapshot(state, roomId);
  const schedule = door.currentSurgeryId
    ? enrichSurgerySchedule(state, findById(state.surgerySchedules, "surgeryScheduleId", door.currentSurgeryId))
    : null;
  const surgery = surgeryPayload(state, schedule, dataScope);

  return {
    roleCode: "or-door-screen",
    roleName: "第三方手术室门口屏",
    dataScope,
    snapshotTime: door.snapshotTime,
    room: door.room,
    display: {
      ...door.display,
      currentSurgeryKind: door.currentSurgeryKind ?? null,
      surgeryScheduleId: surgery?.surgeryScheduleId ?? null,
      surgeryNo: surgery?.surgeryNo ?? door.display?.surgeryNo ?? "",
      patient: surgery?.patient ?? null,
      patientName: surgery?.patient?.name ?? door.display?.patientName ?? "",
      inpatientNo: surgery?.patient?.inpatientNo ?? "",
      departmentName: surgery?.patient?.departmentName ?? "",
      wardName: surgery?.patient?.wardName ?? "",
      bedNo: surgery?.patient?.bedNo ?? "",
      plannedSurgeryName: surgery?.plannedSurgeryName ?? door.display?.plannedSurgeryName ?? "",
      anesthesiaMethod: surgery?.anesthesiaMethod ?? "",
      primarySurgeon: surgery?.staff.primarySurgeon ?? door.display?.primarySurgeon ?? "",
      anesthetist: surgery?.staff.anesthetist ?? door.display?.anesthetist ?? "",
      tableNo: surgery?.tableNo ?? null,
      plannedStartTime: surgery?.plannedStartTime ?? door.display?.plannedStartTime ?? null,
      actualStartTime: surgery?.actualStartTime ?? null,
      callText: surgery
        ? `${surgery.roomName}${surgery.tableNo ? ` ${surgery.tableNo}台` : ""} ${surgery.patient?.name ?? ""} ${surgery.status}`
        : `${door.display?.roomName ?? ""} ${door.display?.displayStatus ?? ""}`.trim()
    },
    terminals: terminalRowsForRoom(state, roomId)
  };
}

export function buildOrPanelIntegrationSnapshot(state, roomId, options = {}) {
  const dataScope = normalizeIntegrationDataScope(options.dataScope);
  const date = options.date ?? null;
  const { room, currentSurgery } = getCurrentSurgeryByRoom(state, roomId);
  const roomSchedules = schedulesForRoom(state, roomId, date);
  const currentSource = currentSurgery ?? (
    firstDisplayableSchedule(state, roomId, date)
      ? enrichSurgerySchedule(state, firstDisplayableSchedule(state, roomId, date))
      : null
  );
  const currentIndex = currentSource
    ? roomSchedules.findIndex((item) => item.surgeryScheduleId === currentSource.surgeryScheduleId)
    : -1;
  const nextSource = roomSchedules
    .slice(Math.max(currentIndex + 1, 0))
    .find((schedule) => !CLOSED_SURGERY_STATUSES.has(schedule.status));
  const current = surgeryPayload(state, currentSource, dataScope);
  const next = nextSource ? surgeryPayload(state, enrichSurgerySchedule(state, nextSource), dataScope) : null;
  const latest = currentSource ? latestEvent(currentSource) : null;

  return {
    roleCode: "or-status-panel",
    roleName: "第三方手术室信息显示与运行状态面板",
    dataScope,
    snapshotTime: new Date().toISOString(),
    date,
    room: {
      roomId: room.roomId,
      roomCode: room.roomCode,
      roomName: room.roomName,
      roomType: room.roomType,
      floor: room.floor,
      status: businessLabel(room.status)
    },
    operation: {
      current,
      next,
      scheduleCount: roomSchedules.length,
      latestEvent: latest ? {
        eventId: latest.eventId,
        eventType: businessLabel(latest.eventType),
        eventTime: latest.eventTime,
        sourceSystem: latest.sourceSystem ?? null,
        deviceId: latest.deviceId ?? null,
        operatorId: latest.operatorId ?? null
      } : null
    },
    terminalHealth: terminalHealth(state, roomId),
    timeline: (currentSource?.events ?? []).slice(-8).map((event) => ({
      eventId: event.eventId,
      eventType: businessLabel(event.eventType),
      eventTime: event.eventTime,
      sourceSystem: event.sourceSystem ?? null,
      deviceId: event.deviceId ?? null,
      operatorId: event.operatorId ?? null
    }))
  };
}

export function buildQueueCallingIntegrationSnapshot(state, query = {}, options = {}) {
  const dataScope = normalizeIntegrationDataScope(options.dataScope);
  const family = buildFamilyWaitingSnapshot(state, query);
  const byScheduleId = new Map(family.items.map((item) => [item.surgeryScheduleId, item]));
  const date = family.date;
  const items = state.surgerySchedules
    .filter((schedule) => schedule.scheduleDate === date)
    .filter((schedule) => !query.roomId || schedule.roomId === query.roomId)
    .map((schedule) => {
      const display = byScheduleId.get(schedule.surgeryScheduleId);
      if (!display) {
        return null;
      }
      const enriched = enrichSurgerySchedule(state, schedule);
      const surgery = surgeryPayload(state, enriched, dataScope);
      return {
        queueId: `CALL-${schedule.surgeryScheduleId}`,
        queueNo: display.queueNo,
        dataScope,
        surgeryScheduleId: schedule.surgeryScheduleId,
        surgeryNo: surgery.surgeryNo,
        date,
        roomId: surgery.roomId,
        roomName: surgery.roomName,
        tableNo: surgery.tableNo,
        patient: surgery.patient,
        patientName: surgery.patient?.name ?? "",
        inpatientNo: surgery.patient?.inpatientNo ?? "",
        departmentName: surgery.patient?.departmentName ?? "",
        plannedSurgeryName: surgery.plannedSurgeryName,
        displayStatus: display.displayStatus,
        callStatus: callStatus(schedule.status),
        plannedStartTime: surgery.plannedStartTime,
        lastUpdatedTime: display.lastUpdatedTime,
        callText: `${display.queueNo}号 ${surgery.patient?.name ?? ""} ${surgery.roomName} ${callStatus(schedule.status)}`
      };
    })
    .filter(Boolean);

  const filtered = query.status
    ? items.filter((item) => item.displayStatus === query.status || item.callStatus === query.status)
    : items;

  return {
    roleCode: "queue-calling",
    roleName: "第三方排队叫号系统",
    dataScope,
    snapshotTime: family.snapshotTime,
    date,
    total: filtered.length,
    notice: family.notice,
    items: filtered
  };
}

export function buildVendorDoorScreenRows(state, options = {}) {
  const dataScope = normalizeIntegrationDataScope(options.dataScope);
  return state.operatingRooms.map((room) => {
    const snapshot = buildOrDoorScreenIntegrationSnapshot(state, room.roomId, { dataScope, date: options.date });
    const display = snapshot.display ?? {};
    return {
      记录ID: `DOOR-${room.roomId}`,
      数据范围: dataScope,
      手术排班ID: display.surgeryScheduleId,
      手术日期: display.plannedStartTime ? String(display.plannedStartTime).slice(0, 10) : "",
      手术间ID: room.roomId,
      手术间: room.roomName,
      台次: display.tableNo,
      当前类型: display.currentSurgeryKind,
      显示状态: display.displayStatus,
      患者ID: display.patient?.patientId ?? "",
      姓名: display.patientName,
      住院号: display.inpatientNo,
      科室: display.departmentName,
      床号: display.bedNo,
      手术名称: display.plannedSurgeryName,
      麻醉方式: display.anesthesiaMethod,
      主刀医师: display.primarySurgeon,
      麻醉医师: display.anesthetist,
      计划开始时间: formatBeijingDateTime(display.plannedStartTime),
      最近更新时间: formatBeijingDateTime(display.lastUpdatedTime),
      终端状态: snapshot.terminals.map((item) => `${item.deviceName}:${item.status}`).join("；"),
      叫号文本: display.callText
    };
  });
}

export function buildVendorOrPanelRows(state, options = {}) {
  const dataScope = normalizeIntegrationDataScope(options.dataScope);
  const dates = options.date
    ? [options.date]
    : [...new Set(state.surgerySchedules.map((schedule) => schedule.scheduleDate).filter(Boolean))];
  return state.operatingRooms.flatMap((room) => dates.map((date) => {
    const snapshot = buildOrPanelIntegrationSnapshot(state, room.roomId, { dataScope, date });
    const current = snapshot.operation.current;
    const next = snapshot.operation.next;
    return {
      记录ID: `PANEL-${room.roomId}-${date}`,
      数据范围: dataScope,
      手术日期: date,
      手术间ID: room.roomId,
      手术间: room.roomName,
      房间状态: snapshot.room.status,
      当前手术ID: current?.surgeryScheduleId ?? "",
      当前患者姓名: current?.patient?.name ?? "",
      当前手术名称: current?.plannedSurgeryName ?? "",
      当前状态: current?.status ?? "",
      下一台手术ID: next?.surgeryScheduleId ?? "",
      下一台患者姓名: next?.patient?.name ?? "",
      下一台手术名称: next?.plannedSurgeryName ?? "",
      主刀医师: current?.staff.primarySurgeon ?? "",
      麻醉医师: current?.staff.anesthetist ?? "",
      巡回护士: current?.staff.circulatingNurse ?? "",
      器械护士: current?.staff.scrubNurse ?? "",
      事件数: current?.eventCount ?? 0,
      最近事件: snapshot.operation.latestEvent?.eventType ?? "",
      最近更新时间: formatBeijingDateTime(snapshot.operation.latestEvent?.eventTime ?? current?.plannedStartTime ?? ""),
      终端在线数: snapshot.terminalHealth.online,
      终端离线数: snapshot.terminalHealth.offline
    };
  }));
}

export function buildVendorQueueCallRows(state, options = {}) {
  const dataScope = normalizeIntegrationDataScope(options.dataScope);
  const dates = options.date
    ? [options.date]
    : [...new Set(state.surgerySchedules.map((schedule) => schedule.scheduleDate).filter(Boolean))];
  return dates.flatMap((date) => buildQueueCallingIntegrationSnapshot(state, { date }, { dataScope }).items).map((item) => ({
    叫号ID: item.queueId,
    数据范围: dataScope,
    手术日期: item.date,
    队列号: item.queueNo,
    手术排班ID: item.surgeryScheduleId,
    手术间ID: item.roomId,
    手术间: item.roomName,
    台次: item.tableNo,
    患者ID: item.patient?.patientId ?? "",
    姓名: item.patientName,
    住院号: item.inpatientNo,
    科室: item.departmentName,
    手术名称: item.plannedSurgeryName,
    显示状态: item.displayStatus,
    叫号状态: item.callStatus,
    计划开始时间: formatBeijingDateTime(item.plannedStartTime),
    最近更新时间: formatBeijingDateTime(item.lastUpdatedTime),
    叫号文本: item.callText
  }));
}
