import fs from "node:fs";
import path from "node:path";
import { businessLabel, formatBeijingDateTime } from "./china-standard.js";
import { findById } from "./domain.js";
import {
  buildVendorDoorScreenRows,
  buildVendorOrPanelRows,
  buildVendorQueueCallRows,
  normalizeIntegrationDataScope
} from "./integrations.js";

const VIEW_DEFINITIONS = [
  {
    name: "vendor_patient_index",
    title: "厂商_患者索引",
    description: "脱敏患者主索引，供硬件厂商按患者和住院号联调读取。"
  },
  {
    name: "vendor_encounter_index",
    title: "厂商_住院就诊",
    description: "住院就诊、床位、诊断、主治医师和医保属性。"
  },
  {
    name: "vendor_surgery_schedule",
    title: "厂商_手术排班",
    description: "手术间、术式、麻醉、人员、手术状态和时间轴。"
  },
  {
    name: "vendor_report_index",
    title: "厂商_检查检验报告",
    description: "检验、心电、超声、影像报告索引，便于设备调阅和状态联调。"
  },
  {
    name: "vendor_medication_nursing",
    title: "厂商_用药护理执行",
    description: "配药、用药执行、护理记录和护理时间轴。"
  },
  {
    name: "vendor_billing_settlement",
    title: "厂商_收费医保结算",
    description: "住院预交、费用项目、医保结算和电子票据信息。"
  },
  {
    name: "vendor_or_door_screen",
    title: "厂商_手术室门口屏",
    description: "按手术间门口屏消费方式整理的当前手术、患者、人员、状态和终端信息。"
  },
  {
    name: "vendor_or_status_panel",
    title: "厂商_手术室运行面板",
    description: "按手术室信息显示与运行状态面板消费方式整理的当前/下一台、事件和终端健康信息。"
  },
  {
    name: "vendor_queue_call",
    title: "厂商_排队叫号",
    description: "面向排队叫号系统的队列号、叫号状态、患者、手术间和计划时间。"
  }
];

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
  return value ? `${value.slice(0, 4)}****${value.slice(-2)}` : "";
}

function scopedName(name, dataScope) {
  return normalizeIntegrationDataScope(dataScope) === "full" ? String(name || "") : maskName(name);
}

function scopedNo(value, dataScope) {
  return normalizeIntegrationDataScope(dataScope) === "full" ? String(value || "") : maskNo(value);
}

function displayTime(value) {
  return formatBeijingDateTime(value);
}

function displayStatus(value) {
  return businessLabel(value);
}

function toDisplayViewDefinition(definition) {
  return {
    视图名称: definition.name,
    中文名称: definition.title,
    说明: definition.description
  };
}

function getVendorDbPath() {
  return process.env.SMARTHIS_VENDOR_DB_PATH
    ?? path.join(process.cwd(), "data", "smarthis-vendor-readonly.sqlite");
}

function getVendorDataScope() {
  return normalizeIntegrationDataScope(process.env.SMARTHIS_VENDOR_DATA_SCOPE ?? "display");
}

async function openDatabase(filePath) {
  const sqlite = await import("node:sqlite");
  return new sqlite.DatabaseSync(filePath);
}

function createSchema(db) {
  db.exec(`
    DROP TABLE IF EXISTS vendor_patient_index;
    DROP TABLE IF EXISTS vendor_encounter_index;
    DROP TABLE IF EXISTS vendor_surgery_schedule;
    DROP TABLE IF EXISTS vendor_report_index;
    DROP TABLE IF EXISTS vendor_medication_nursing;
    DROP TABLE IF EXISTS vendor_billing_settlement;
    DROP TABLE IF EXISTS vendor_or_door_screen;
    DROP TABLE IF EXISTS vendor_or_status_panel;
    DROP TABLE IF EXISTS vendor_queue_call;

    CREATE TABLE vendor_patient_index (
      "患者ID" TEXT PRIMARY KEY,
      "院内主索引号" TEXT,
      "姓名" TEXT,
      "性别" TEXT,
      "年龄" TEXT,
      "医保类型" TEXT,
      "血型" TEXT,
      "过敏史" TEXT
    );

    CREATE TABLE vendor_encounter_index (
      "住院就诊ID" TEXT PRIMARY KEY,
      "患者ID" TEXT,
      "住院号" TEXT,
      "就诊流水号" TEXT,
      "科室" TEXT,
      "病区" TEXT,
      "床号" TEXT,
      "主诊断编码" TEXT,
      "主诊断名称" TEXT,
      "主治医师" TEXT,
      "入院时间" TEXT,
      "出院时间" TEXT,
      "就诊状态" TEXT
    );

    CREATE TABLE vendor_surgery_schedule (
      "手术排班ID" TEXT PRIMARY KEY,
      "手术通知单号" TEXT,
      "手术日期" TEXT,
      "手术间" TEXT,
      "台次" INTEGER,
      "患者ID" TEXT,
      "姓名" TEXT,
      "住院号" TEXT,
      "科室" TEXT,
      "手术名称" TEXT,
      "手术编码" TEXT,
      "手术级别" TEXT,
      "麻醉方式" TEXT,
      "主刀医师" TEXT,
      "麻醉医师" TEXT,
      "巡回护士" TEXT,
      "器械护士" TEXT,
      "计划开始时间" TEXT,
      "计划结束时间" TEXT,
      "实际开始时间" TEXT,
      "实际结束时间" TEXT,
      "手术状态" TEXT
    );

    CREATE TABLE vendor_report_index (
      "报告ID" TEXT PRIMARY KEY,
      "住院就诊ID" TEXT,
      "患者ID" TEXT,
      "报告类型" TEXT,
      "报告名称" TEXT,
      "检查号" TEXT,
      "检查项目" TEXT,
      "报告时间" TEXT,
      "报告状态" TEXT,
      "异常标记" TEXT,
      "结论" TEXT,
      "影像调阅地址" TEXT
    );

    CREATE TABLE vendor_medication_nursing (
      "记录ID" TEXT PRIMARY KEY,
      "住院就诊ID" TEXT,
      "患者ID" TEXT,
      "记录类型" TEXT,
      "项目名称" TEXT,
      "执行状态" TEXT,
      "执行时间" TEXT,
      "执行科室或阶段" TEXT,
      "备注" TEXT
    );

    CREATE TABLE vendor_billing_settlement (
      "记录ID" TEXT PRIMARY KEY,
      "住院就诊ID" TEXT,
      "患者ID" TEXT,
      "记录类型" TEXT,
      "项目名称" TEXT,
      "金额" REAL,
      "医保类别" TEXT,
      "自付金额" REAL,
      "发生时间" TEXT,
      "状态" TEXT,
      "票据或结算单号" TEXT
    );

    CREATE TABLE vendor_or_door_screen (
      "记录ID" TEXT PRIMARY KEY,
      "数据范围" TEXT,
      "手术排班ID" TEXT,
      "手术日期" TEXT,
      "手术间ID" TEXT,
      "手术间" TEXT,
      "台次" INTEGER,
      "当前类型" TEXT,
      "显示状态" TEXT,
      "患者ID" TEXT,
      "姓名" TEXT,
      "住院号" TEXT,
      "科室" TEXT,
      "床号" TEXT,
      "手术名称" TEXT,
      "麻醉方式" TEXT,
      "主刀医师" TEXT,
      "麻醉医师" TEXT,
      "计划开始时间" TEXT,
      "最近更新时间" TEXT,
      "终端状态" TEXT,
      "叫号文本" TEXT
    );

    CREATE TABLE vendor_or_status_panel (
      "记录ID" TEXT PRIMARY KEY,
      "数据范围" TEXT,
      "手术日期" TEXT,
      "手术间ID" TEXT,
      "手术间" TEXT,
      "房间状态" TEXT,
      "当前手术ID" TEXT,
      "当前患者姓名" TEXT,
      "当前手术名称" TEXT,
      "当前状态" TEXT,
      "下一台手术ID" TEXT,
      "下一台患者姓名" TEXT,
      "下一台手术名称" TEXT,
      "主刀医师" TEXT,
      "麻醉医师" TEXT,
      "巡回护士" TEXT,
      "器械护士" TEXT,
      "事件数" INTEGER,
      "最近事件" TEXT,
      "最近更新时间" TEXT,
      "终端在线数" INTEGER,
      "终端离线数" INTEGER
    );

    CREATE TABLE vendor_queue_call (
      "叫号ID" TEXT PRIMARY KEY,
      "数据范围" TEXT,
      "手术日期" TEXT,
      "队列号" TEXT,
      "手术排班ID" TEXT,
      "手术间ID" TEXT,
      "手术间" TEXT,
      "台次" INTEGER,
      "患者ID" TEXT,
      "姓名" TEXT,
      "住院号" TEXT,
      "科室" TEXT,
      "手术名称" TEXT,
      "显示状态" TEXT,
      "叫号状态" TEXT,
      "计划开始时间" TEXT,
      "最近更新时间" TEXT,
      "叫号文本" TEXT
    );
  `);
}

function insertRows(db, tableName, columns, rows) {
  if (!rows.length) {
    return;
  }
  const quotedColumns = columns.map((column) => `"${column}"`).join(", ");
  const placeholders = columns.map(() => "?").join(", ");
  const statement = db.prepare(`INSERT INTO ${tableName} (${quotedColumns}) VALUES (${placeholders})`);
  for (const row of rows) {
    statement.run(...columns.map((column) => row[column] ?? null));
  }
}

function departmentName(state, deptId) {
  return findById(state.departments, "deptId", deptId)?.deptName ?? "";
}

function practitionerName(state, practitionerId) {
  return findById(state.practitioners, "practitionerId", practitionerId)?.name ?? "";
}

function buildPatientRows(state, options = {}) {
  const dataScope = normalizeIntegrationDataScope(options.dataScope ?? getVendorDataScope());
  return state.patients.map((patient) => ({
    患者ID: patient.patientId,
    院内主索引号: patient.mpiNo,
    姓名: scopedName(patient.name, dataScope),
    性别: patient.gender,
    年龄: patient.ageText,
    医保类型: patient.insuranceType,
    血型: patient.bloodType,
    过敏史: patient.allergyText
  }));
}

function buildEncounterRows(state) {
  return state.encounters.map((encounter) => {
    const admission = state.admissions.find((item) => item.encounterId === encounter.encounterId);
    const bed = admission ? findById(state.beds, "bedId", admission.bedId) : null;
    const ward = admission ? findById(state.wards, "wardId", admission.wardId) : null;
    const diagnosis = state.diagnoses.find((item) => item.encounterId === encounter.encounterId && item.isPrimary)
      ?? state.diagnoses.find((item) => item.encounterId === encounter.encounterId);
    return {
      住院就诊ID: encounter.encounterId,
      患者ID: encounter.patientId,
      住院号: encounter.inpatientNo,
      就诊流水号: encounter.visitNo,
      科室: departmentName(state, encounter.deptId),
      病区: ward?.wardName ?? "",
      床号: bed?.bedNo ?? "",
      主诊断编码: diagnosis?.diagnosisCode ?? "",
      主诊断名称: diagnosis?.diagnosisName ?? admission?.admissionDiagnosis ?? "",
      主治医师: practitionerName(state, encounter.attendingDoctorId),
      入院时间: displayTime(admission?.admissionTime ?? encounter.startTime),
      出院时间: displayTime(admission?.dischargeTime ?? encounter.endTime),
      就诊状态: displayStatus(encounter.status)
    };
  });
}

function buildSurgeryRows(state, options = {}) {
  const dataScope = normalizeIntegrationDataScope(options.dataScope ?? getVendorDataScope());
  return state.surgerySchedules.map((schedule) => {
    const request = findById(state.surgeryRequests, "surgeryRequestId", schedule.surgeryRequestId);
    const encounter = request ? findById(state.encounters, "encounterId", request.encounterId) : null;
    const patient = encounter ? findById(state.patients, "patientId", encounter.patientId) : null;
    const room = findById(state.operatingRooms, "roomId", schedule.roomId);
    const staff = state.surgeryStaffAssignments.filter((item) => item.surgeryScheduleId === schedule.surgeryScheduleId);
    const nameByRole = (role) => practitionerName(state, staff.find((item) => item.role === role)?.practitionerId);
    return {
      手术排班ID: schedule.surgeryScheduleId,
      手术通知单号: request?.surgeryNo ?? "",
      手术日期: schedule.scheduleDate,
      手术间: room?.roomName ?? schedule.roomId,
      台次: schedule.tableNo,
      患者ID: patient?.patientId ?? "",
      姓名: scopedName(patient?.name, dataScope),
      住院号: scopedNo(encounter?.inpatientNo, dataScope),
      科室: departmentName(state, encounter?.deptId),
      手术名称: request?.plannedSurgeryName ?? "",
      手术编码: request?.plannedSurgeryCode ?? "",
      手术级别: request?.surgeryLevel ?? "",
      麻醉方式: request?.anesthesiaMethod ?? "",
      主刀医师: nameByRole("主刀"),
      麻醉医师: nameByRole("麻醉医生"),
      巡回护士: nameByRole("巡回护士"),
      器械护士: nameByRole("器械护士"),
      计划开始时间: displayTime(schedule.plannedStartTime),
      计划结束时间: displayTime(schedule.plannedEndTime),
      实际开始时间: displayTime(schedule.actualStartTime),
      实际结束时间: displayTime(schedule.actualEndTime),
      手术状态: displayStatus(schedule.status)
    };
  });
}

function buildReportRows(state) {
  const rows = [];
  for (const report of state.labReports ?? []) {
    rows.push({
      报告ID: report.labReportId,
      住院就诊ID: report.encounterId,
      患者ID: report.patientId,
      报告类型: "检验",
      报告名称: report.reportName,
      检查号: report.sampleNo,
      检查项目: report.specimenType,
      报告时间: displayTime(report.reportTime),
      报告状态: displayStatus(report.status),
      异常标记: displayStatus(report.abnormalFlag),
      结论: (report.items ?? []).map((item) => `${item.name}${item.value}${item.unit ?? ""}`).join("；"),
      影像调阅地址: ""
    });
  }
  for (const report of state.ecgReports ?? []) {
    rows.push({
      报告ID: report.ecgReportId,
      住院就诊ID: report.encounterId,
      患者ID: report.patientId,
      报告类型: "心电",
      报告名称: report.examName,
      检查号: report.examNo,
      检查项目: report.examName,
      报告时间: displayTime(report.reportTime),
      报告状态: displayStatus(report.status),
      异常标记: "",
      结论: report.conclusion,
      影像调阅地址: ""
    });
  }
  for (const report of state.ultrasoundReports ?? []) {
    rows.push({
      报告ID: report.ultrasoundReportId,
      住院就诊ID: report.encounterId,
      患者ID: report.patientId,
      报告类型: "超声",
      报告名称: report.examName,
      检查号: report.accessionNo,
      检查项目: report.bodyPart,
      报告时间: displayTime(report.reportTime),
      报告状态: displayStatus(report.status),
      异常标记: "",
      结论: report.conclusion,
      影像调阅地址: report.images?.[0]?.imageUrl ?? ""
    });
  }
  for (const report of state.examReports ?? []) {
    rows.push({
      报告ID: report.examReportId,
      住院就诊ID: report.encounterId,
      患者ID: report.patientId,
      报告类型: report.modality,
      报告名称: `${report.bodyPart}${report.modality}检查`,
      检查号: report.accessionNo,
      检查项目: report.bodyPart,
      报告时间: displayTime(report.reportTime),
      报告状态: displayStatus(report.status),
      异常标记: "",
      结论: report.conclusion,
      影像调阅地址: ""
    });
  }
  for (const study of state.imagingStudies ?? []) {
    rows.push({
      报告ID: study.imagingStudyId,
      住院就诊ID: study.encounterId,
      患者ID: study.patientId,
      报告类型: "影像索引",
      报告名称: study.studyDescription,
      检查号: study.accessionNo,
      检查项目: study.bodyPart,
      报告时间: displayTime(study.studyTime),
      报告状态: displayStatus(study.status),
      异常标记: "",
      结论: study.keyConclusion ?? study.studyDescription,
      影像调阅地址: study.viewerUrl ?? `/viewer/studies/${study.studyInstanceUid}`
    });
  }
  return rows;
}

function buildMedicationNursingRows(state) {
  const rows = [];
  for (const item of state.medicationDispenses ?? []) {
    rows.push({
      记录ID: item.dispenseId,
      住院就诊ID: item.encounterId,
      患者ID: item.patientId,
      记录类型: "药房配药",
      项目名称: `${item.medicationName}${item.dose ? ` ${item.dose}` : ""}`,
      执行状态: displayStatus(item.status),
      执行时间: displayTime(item.dispensedTime ?? item.administeredTime),
      执行科室或阶段: item.phase,
      备注: item.note
    });
  }
  for (const item of state.medicationAdministrations ?? []) {
    rows.push({
      记录ID: item.administrationId,
      住院就诊ID: item.encounterId,
      患者ID: item.patientId,
      记录类型: "用药执行",
      项目名称: `${item.medicationName}${item.dose ? ` ${item.dose}` : ""}`,
      执行状态: displayStatus(item.status),
      执行时间: displayTime(item.administeredTime ?? item.scheduledTime),
      执行科室或阶段: item.route,
      备注: item.checkResult
    });
  }
  for (const item of state.nursingRecords ?? []) {
    rows.push({
      记录ID: item.nursingRecordId,
      住院就诊ID: item.encounterId,
      患者ID: item.patientId,
      记录类型: item.recordType,
      项目名称: item.recordType,
      执行状态: "已记录",
      执行时间: displayTime(item.recordTime),
      执行科室或阶段: "护理",
      备注: item.content
    });
  }
  return rows;
}

function buildBillingRows(state) {
  const rows = [];
  for (const item of state.depositPayments ?? []) {
    rows.push({
      记录ID: item.depositId,
      住院就诊ID: item.encounterId,
      患者ID: item.patientId,
      记录类型: "住院预交",
      项目名称: item.paymentMethod,
      金额: item.amount,
      医保类别: "",
      自付金额: item.amount,
      发生时间: displayTime(item.paymentTime),
      状态: displayStatus(item.status),
      票据或结算单号: item.receiptNo
    });
  }
  for (const item of state.billingItems ?? []) {
    rows.push({
      记录ID: item.billingItemId,
      住院就诊ID: item.encounterId,
      患者ID: item.patientId,
      记录类型: item.category,
      项目名称: item.itemName,
      金额: item.amount,
      医保类别: item.insuranceClass,
      自付金额: Number(item.amount || 0) * Number(item.selfPayRatio ?? 0),
      发生时间: displayTime(item.postedTime),
      状态: displayStatus(item.status),
      票据或结算单号: item.itemCode
    });
  }
  for (const item of state.insuranceSettlements ?? []) {
    rows.push({
      记录ID: item.settlementId,
      住院就诊ID: item.encounterId,
      患者ID: item.patientId,
      记录类型: "医保结算",
      项目名称: item.policyName,
      金额: item.totalAmount,
      医保类别: item.insuranceType,
      自付金额: item.selfPayAmount,
      发生时间: displayTime(item.settlementTime),
      状态: displayStatus(item.status),
      票据或结算单号: item.settlementListNo
    });
  }
  for (const item of state.invoiceRecords ?? []) {
    rows.push({
      记录ID: item.invoiceId,
      住院就诊ID: item.encounterId,
      患者ID: item.patientId,
      记录类型: "电子票据",
      项目名称: item.invoiceType,
      金额: item.totalAmount,
      医保类别: "",
      自付金额: item.selfPayAmount,
      发生时间: displayTime(item.issuedTime),
      状态: displayStatus(item.status),
      票据或结算单号: item.invoiceNo
    });
  }
  return rows;
}

function populateDatabase(db, state) {
  const dataScope = getVendorDataScope();
  insertRows(db, "vendor_patient_index", ["患者ID", "院内主索引号", "姓名", "性别", "年龄", "医保类型", "血型", "过敏史"], buildPatientRows(state, { dataScope }));
  insertRows(db, "vendor_encounter_index", ["住院就诊ID", "患者ID", "住院号", "就诊流水号", "科室", "病区", "床号", "主诊断编码", "主诊断名称", "主治医师", "入院时间", "出院时间", "就诊状态"], buildEncounterRows(state));
  insertRows(db, "vendor_surgery_schedule", ["手术排班ID", "手术通知单号", "手术日期", "手术间", "台次", "患者ID", "姓名", "住院号", "科室", "手术名称", "手术编码", "手术级别", "麻醉方式", "主刀医师", "麻醉医师", "巡回护士", "器械护士", "计划开始时间", "计划结束时间", "实际开始时间", "实际结束时间", "手术状态"], buildSurgeryRows(state, { dataScope }));
  insertRows(db, "vendor_report_index", ["报告ID", "住院就诊ID", "患者ID", "报告类型", "报告名称", "检查号", "检查项目", "报告时间", "报告状态", "异常标记", "结论", "影像调阅地址"], buildReportRows(state));
  insertRows(db, "vendor_medication_nursing", ["记录ID", "住院就诊ID", "患者ID", "记录类型", "项目名称", "执行状态", "执行时间", "执行科室或阶段", "备注"], buildMedicationNursingRows(state));
  insertRows(db, "vendor_billing_settlement", ["记录ID", "住院就诊ID", "患者ID", "记录类型", "项目名称", "金额", "医保类别", "自付金额", "发生时间", "状态", "票据或结算单号"], buildBillingRows(state));
  insertRows(db, "vendor_or_door_screen", ["记录ID", "数据范围", "手术排班ID", "手术日期", "手术间ID", "手术间", "台次", "当前类型", "显示状态", "患者ID", "姓名", "住院号", "科室", "床号", "手术名称", "麻醉方式", "主刀医师", "麻醉医师", "计划开始时间", "最近更新时间", "终端状态", "叫号文本"], buildVendorDoorScreenRows(state, { dataScope }));
  insertRows(db, "vendor_or_status_panel", ["记录ID", "数据范围", "手术日期", "手术间ID", "手术间", "房间状态", "当前手术ID", "当前患者姓名", "当前手术名称", "当前状态", "下一台手术ID", "下一台患者姓名", "下一台手术名称", "主刀医师", "麻醉医师", "巡回护士", "器械护士", "事件数", "最近事件", "最近更新时间", "终端在线数", "终端离线数"], buildVendorOrPanelRows(state, { dataScope }));
  insertRows(db, "vendor_queue_call", ["叫号ID", "数据范围", "手术日期", "队列号", "手术排班ID", "手术间ID", "手术间", "台次", "患者ID", "姓名", "住院号", "科室", "手术名称", "显示状态", "叫号状态", "计划开始时间", "最近更新时间", "叫号文本"], buildVendorQueueCallRows(state, { dataScope }));
}

export function getVendorDbInfo(state) {
  const filePath = getVendorDbPath();
  const exists = fs.existsSync(filePath);
  const stat = exists ? fs.statSync(filePath) : null;
  return {
    数据库类型: "SQLite",
    访问模式: "厂商只读快照",
    数据库文件路径: filePath,
    是否已生成: exists,
    文件字节数: stat?.size ?? 0,
    最后更新时间: displayTime(stat?.mtime?.toISOString() ?? null),
    数据范围: getVendorDataScope(),
    视图数量: VIEW_DEFINITIONS.length,
    数据视图: VIEW_DEFINITIONS.map(toDisplayViewDefinition),
    各视图记录数: VIEW_DEFINITIONS.map((view) => ({
      视图名称: view.name,
      中文名称: view.title,
      记录数: countRowsForView(state, view.name)
    }))
  };
}

function countRowsForView(state, viewName) {
  const builders = {
    vendor_patient_index: buildPatientRows,
    vendor_encounter_index: buildEncounterRows,
    vendor_surgery_schedule: buildSurgeryRows,
    vendor_report_index: buildReportRows,
    vendor_medication_nursing: buildMedicationNursingRows,
    vendor_billing_settlement: buildBillingRows,
    vendor_or_door_screen: (currentState) => buildVendorDoorScreenRows(currentState, { dataScope: getVendorDataScope() }),
    vendor_or_status_panel: (currentState) => buildVendorOrPanelRows(currentState, { dataScope: getVendorDataScope() }),
    vendor_queue_call: (currentState) => buildVendorQueueCallRows(currentState, { dataScope: getVendorDataScope() })
  };
  return builders[viewName]?.(state).length ?? 0;
}

export function getVendorDbSchema() {
  return createSchema.toString()
    .match(/db\.exec\(`([\s\S]*?)`\);/)?.[1]
    .trim();
}

export async function syncVendorDatabase(state) {
  const filePath = getVendorDbPath();
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  const db = await openDatabase(filePath);
  try {
    db.exec("PRAGMA journal_mode = DELETE;");
    db.exec("BEGIN");
    createSchema(db);
    populateDatabase(db, state);
    db.exec("COMMIT");
  } catch (error) {
    db.exec("ROLLBACK");
    throw error;
  } finally {
    db.close();
  }
  return getVendorDbInfo(state);
}

function rowMatchesQuery(row, query) {
  if (query.patientId && row["患者ID"] !== query.patientId) {
    return false;
  }
  if (query.encounterId && row["住院就诊ID"] !== query.encounterId) {
    return false;
  }
  if (query.roomId && row["手术间ID"] !== query.roomId) {
    return false;
  }
  if (query.dataScope && row["数据范围"] && row["数据范围"] !== normalizeIntegrationDataScope(query.dataScope)) {
    return false;
  }
  if (query.status) {
    const status = displayStatus(query.status);
    const rowStatuses = [row["手术状态"], row["显示状态"], row["叫号状态"], row["当前状态"], row["状态"]]
      .filter(Boolean);
    if (rowStatuses.length && !rowStatuses.includes(status) && !rowStatuses.includes(query.status)) {
      return false;
    }
  }
  if (query.date) {
    const text = Object.values(row).join(" ");
    if (!text.includes(query.date)) {
      return false;
    }
  }
  if (query.keyword) {
    const text = Object.values(row).join(" ");
    if (!text.includes(query.keyword)) {
      return false;
    }
  }
  return true;
}

export async function queryVendorDatabase(state, viewName, query = {}) {
  const definition = VIEW_DEFINITIONS.find((item) => item.name === viewName);
  if (!definition) {
    const allowed = VIEW_DEFINITIONS.map((item) => item.name).join("、");
    throw new Error(`不支持的厂商数据库视图：${viewName}。可用视图：${allowed}`);
  }

  await syncVendorDatabase(state);
  const page = Math.max(Number.parseInt(query.page ?? "1", 10), 1);
  const pageSize = Math.min(Math.max(Number.parseInt(query.pageSize ?? "50", 10), 1), 200);
  const offset = (page - 1) * pageSize;
  const db = await openDatabase(getVendorDbPath());
  try {
    const allItems = db.prepare(`SELECT * FROM ${viewName}`).all();
    const matchedItems = allItems.filter((row) => rowMatchesQuery(row, query));
    const items = matchedItems.slice(offset, offset + pageSize);
    return {
      视图定义: toDisplayViewDefinition(definition),
      数据项: items,
      当前页: page,
      每页条数: pageSize,
      记录总数: matchedItems.length
    };
  } finally {
    db.close();
  }
}

export async function getVendorDbFile(state) {
  await syncVendorDatabase(state);
  return {
    filePath: getVendorDbPath(),
    bytes: fs.readFileSync(getVendorDbPath())
  };
}
