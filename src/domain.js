import { SURGERY_STATUS_LABELS, toInternalSurgeryStatus } from "./china-standard.js";
import { buildId, equalsIfPresent, HttpError, includesText, nowIso, paginate, requireFound } from "./utils.js";

export const SURGERY_STATUS = [
  "Scheduled",
  "Called",
  "InRoom",
  "AnesthesiaStarted",
  "SurgeryStarted",
  "SurgeryEnded",
  "OutRoom",
  "Cleaning",
  "Completed",
  "Cancelled"
];

const surgeryEventNames = {
  Called: "Called",
  InRoom: "InRoom",
  AnesthesiaStarted: "AnesthesiaStarted",
  SurgeryStarted: "SurgeryStarted",
  SurgeryEnded: "SurgeryEnded",
  OutRoom: "OutRoom",
  Cleaning: "CleaningStarted",
  Completed: "CleaningCompleted",
  Cancelled: "Cancelled"
};

const surgeryStatusTransitions = {
  Scheduled: ["Called", "Cancelled"],
  Called: ["InRoom", "Cancelled"],
  InRoom: ["AnesthesiaStarted", "Cancelled"],
  AnesthesiaStarted: ["SurgeryStarted", "Cancelled"],
  SurgeryStarted: ["SurgeryEnded"],
  SurgeryEnded: ["OutRoom"],
  OutRoom: ["Cleaning", "Completed"],
  Cleaning: ["Completed"],
  Completed: [],
  Cancelled: []
};

const writeTerminalTypes = new Set(["室内控制终端", "护士站看板", "管理端", "术间工作站"]);
const crossRoomWriteTerminalTypes = new Set(["护士站看板", "管理端"]);

const terminalTypeAliases = {
  "术间工作站": "室内控制终端",
  "手术室内终端": "室内控制终端",
  "室内终端": "室内控制终端",
  "门口屏": "门口展示终端",
  "手术室门口屏": "门口展示终端",
  "中央监控屏": "护士站看板",
  "护士站": "护士站看板",
  "家属区屏": "家属等待区屏",
  "家属等待区大屏": "家属等待区屏",
  "院长看板": "院领导看板",
  "院长质控看板": "院领导看板"
};

const disabledTerminalStatuses = new Set(["停用", "维修", "Disabled", "Maintenance"]);

const familyStatusLabels = {
  Scheduled: "等待中",
  Called: "等待接入",
  InRoom: "已进入手术区",
  AnesthesiaStarted: "手术准备中",
  SurgeryStarted: "手术中",
  SurgeryEnded: "手术已结束",
  OutRoom: "复苏观察中",
  Cleaning: null,
  Completed: null,
  Cancelled: "请咨询护士站"
};

export function findById(items, key, id) {
  return items.find((item) => String(item[key]) === String(id));
}

function terminalTypeOf(terminal = {}) {
  const value = terminal.terminalType ?? terminal.deviceType ?? "";
  return terminalTypeAliases[value] ?? value;
}

function terminalStatusOf(terminal = {}) {
  return terminal.status ?? "在线";
}

function isTerminalEnabled(terminal = {}) {
  return terminal.enabled !== false && !disabledTerminalStatuses.has(terminalStatusOf(terminal));
}

function requireOperator(input = {}) {
  const operatorId = input.operatorId ?? input.operatorCode;
  if (!operatorId) {
    throw new HttpError(400, "室内控制终端更新手术状态时必须提供操作人员。");
  }
  return operatorId;
}

function validateTerminalStatusChange(state, schedule, input = {}) {
  if (!input.deviceId) {
    return { terminal: null, terminalType: null, operatorId: input.operatorId ?? input.operatorCode ?? null };
  }

  const terminal = requireFound(
    findById(state.deviceTerminals ?? [], "deviceId", input.deviceId),
    `终端设备 ${input.deviceId} 未注册。`
  );
  const terminalType = terminalTypeOf(terminal);
  if (!isTerminalEnabled(terminal)) {
    throw new HttpError(403, `终端设备 ${terminal.deviceName ?? terminal.deviceId} 当前不可用。`);
  }

  if (!writeTerminalTypes.has(terminalType)) {
    throw new HttpError(403, `${terminalType || "当前终端"} 没有手术状态写权限。`);
  }

  if (
    terminal.roomId
    && terminal.roomId !== schedule.roomId
    && !crossRoomWriteTerminalTypes.has(terminalType)
  ) {
    throw new HttpError(403, `终端设备 ${terminal.deviceName ?? terminal.deviceId} 不能控制 ${schedule.roomId} 手术间。`);
  }

  return { terminal, terminalType, operatorId: requireOperator(input) };
}

function validateSurgeryStatusTransition(schedule, nextStatus, input = {}) {
  if (!input.deviceId || schedule.status === nextStatus || input.overrideReason) {
    return;
  }

  const allowed = surgeryStatusTransitions[schedule.status] ?? [];
  if (!allowed.includes(nextStatus)) {
    throw new HttpError(409, `不能从 ${SURGERY_STATUS_LABELS[schedule.status] ?? schedule.status} 直接变更为 ${SURGERY_STATUS_LABELS[nextStatus] ?? nextStatus}。`, {
      当前状态: SURGERY_STATUS_LABELS[schedule.status] ?? schedule.status,
      允许下一状态: allowed.map((status) => SURGERY_STATUS_LABELS[status] ?? status)
    });
  }
}

function idempotentEvent(state, scheduleId, idempotencyKey) {
  if (!idempotencyKey) {
    return null;
  }
  return (state.surgeryEvents ?? []).find((event) => (
    event.surgeryScheduleId === scheduleId
    && (event.idempotencyKey === idempotencyKey || event.payload?.idempotencyKey === idempotencyKey)
  )) ?? null;
}

function nextEventVersion(state, scheduleId) {
  return (state.surgeryEvents ?? []).filter((event) => event.surgeryScheduleId === scheduleId).length + 1;
}

function maskChineseName(name = "") {
  const text = String(name || "");
  if (!text) {
    return "";
  }
  return `${text.slice(0, 1)}${"*".repeat(Math.max(text.length - 1, 1))}`;
}

function latestSurgeryEvent(state, scheduleId) {
  return (state.surgeryEvents ?? [])
    .filter((event) => event.surgeryScheduleId === scheduleId)
    .sort((left, right) => String(right.eventTime).localeCompare(String(left.eventTime)))[0] ?? null;
}

function minutesBetween(start, end) {
  if (!start || !end) {
    return null;
  }
  const startDate = new Date(start);
  const endDate = new Date(end);
  if (Number.isNaN(startDate.getTime()) || Number.isNaN(endDate.getTime())) {
    return null;
  }
  return Math.max(Math.round((endDate.getTime() - startDate.getTime()) / 60000), 0);
}

export function listPatients(state, query) {
  const items = state.patients.filter((patient) => {
    const patientEncounters = state.encounters.filter((encounter) => encounter.patientId === patient.patientId);
    const hasInpatientNo = !query.inpatientNo || patientEncounters.some((encounter) => equalsIfPresent(encounter.inpatientNo, query.inpatientNo));
    const hasOutpatientNo = !query.outpatientNo || patientEncounters.some((encounter) => equalsIfPresent(encounter.outpatientNo, query.outpatientNo));

    return includesText(patient.name, query.name)
      && equalsIfPresent(patient.patientId, query.patientId)
      && hasInpatientNo
      && hasOutpatientNo;
  });

  return paginate(items, query);
}

export function listEncounters(state, query) {
  const items = state.encounters.filter((encounter) => (
    equalsIfPresent(encounter.patientId, query.patientId)
    && equalsIfPresent(encounter.encounterType, query.type)
    && equalsIfPresent(encounter.status, query.status)
    && equalsIfPresent(encounter.deptId, query.deptId)
  )).map((encounter) => enrichEncounter(state, encounter));

  return paginate(items, query);
}

export function enrichEncounter(state, encounter) {
  const patient = findById(state.patients, "patientId", encounter.patientId);
  const department = findById(state.departments, "deptId", encounter.deptId);
  const admission = state.admissions.find((item) => item.encounterId === encounter.encounterId) ?? null;
  const doctor = findById(state.practitioners, "practitionerId", encounter.attendingDoctorId) ?? null;

  return {
    ...encounter,
    patient,
    department,
    admission,
    attendingDoctor: doctor
  };
}

export function getCurrentInpatients(state, query) {
  const items = state.admissions
    .filter((admission) => !admission.dischargeTime)
    .filter((admission) => equalsIfPresent(admission.wardId, query.wardId))
    .map((admission) => {
      const encounter = requireFound(
        findById(state.encounters, "encounterId", admission.encounterId),
        `Encounter ${admission.encounterId} was not found.`
      );
      const patient = findById(state.patients, "patientId", encounter.patientId);
      const ward = findById(state.wards, "wardId", admission.wardId);
      const bed = findById(state.beds, "bedId", admission.bedId);
      return { ...admission, encounter, patient, ward, bed };
    });

  return paginate(items, query);
}

export function getEncounterSummary(state, encounterId) {
  const encounter = requireFound(findById(state.encounters, "encounterId", encounterId), `Encounter ${encounterId} was not found.`);
  const patient = requireFound(findById(state.patients, "patientId", encounter.patientId), `Patient ${encounter.patientId} was not found.`);
  const diagnoses = state.diagnoses.filter((diagnosis) => diagnosis.encounterId === encounterId);
  const documents = state.documents.filter((document) => document.encounterId === encounterId);
  const labReports = state.labReports.filter((report) => report.encounterId === encounterId);
  const examReports = state.examReports.filter((report) => report.encounterId === encounterId);
  const imagingStudies = state.imagingStudies.filter((study) => study.encounterId === encounterId);
  const ultrasoundReports = (state.ultrasoundReports ?? []).filter((report) => report.encounterId === encounterId);
  const ecgReports = (state.ecgReports ?? []).filter((report) => report.encounterId === encounterId);
  const medicationDispenses = (state.medicationDispenses ?? []).filter((dispense) => dispense.encounterId === encounterId);
  const nursingRecords = (state.nursingRecords ?? []).filter((record) => record.encounterId === encounterId);
  const consents = (state.consents ?? []).filter((item) => item.encounterId === encounterId);
  const riskAssessments = (state.riskAssessments ?? []).filter((item) => item.encounterId === encounterId);
  const transportEvents = (state.transportEvents ?? []).filter((item) => item.encounterId === encounterId);
  const billingItems = (state.billingItems ?? []).filter((item) => item.encounterId === encounterId);
  const dischargeMedications = (state.dischargeMedications ?? []).filter((item) => item.encounterId === encounterId);
  const followUps = (state.followUps ?? []).filter((item) => item.encounterId === encounterId);
  const labCriticalValues = (state.labCriticalValues ?? []).filter((item) => item.encounterId === encounterId);
  const surgicalSpecimens = (state.surgicalSpecimens ?? []).filter((item) => item.encounterId === encounterId);
  const pathologyReports = (state.pathologyReports ?? []).filter((item) => item.encounterId === encounterId);
  const insuranceSettlements = (state.insuranceSettlements ?? []).filter((item) => item.encounterId === encounterId);
  const surgicalSafetyChecklists = (state.surgicalSafetyChecklists ?? []).filter((item) => item.encounterId === encounterId);
  const anesthesiaRecords = (state.anesthesiaRecords ?? []).filter((item) => item.encounterId === encounterId);
  const instrumentCounts = (state.instrumentCounts ?? []).filter((item) => item.encounterId === encounterId);
  const pacuRecords = (state.pacuRecords ?? []).filter((item) => item.encounterId === encounterId);
  const vitalSignRecords = (state.vitalSignRecords ?? []).filter((item) => item.encounterId === encounterId);
  const medicationAdministrations = (state.medicationAdministrations ?? []).filter((item) => item.encounterId === encounterId);
  const preopPreparations = (state.preopPreparations ?? []).filter((item) => item.encounterId === encounterId);
  const wardRounds = (state.wardRounds ?? []).filter((item) => item.encounterId === encounterId);
  const dischargeAssessments = (state.dischargeAssessments ?? []).filter((item) => item.encounterId === encounterId);
  const labSpecimenTracks = (state.labSpecimenTracks ?? []).filter((item) => item.encounterId === encounterId);
  const infusionRecords = (state.infusionRecords ?? []).filter((item) => item.encounterId === encounterId);
  const painAssessments = (state.painAssessments ?? []).filter((item) => item.encounterId === encounterId);
  const woundCareRecords = (state.woundCareRecords ?? []).filter((item) => item.encounterId === encounterId);
  const medicalRecordHomePages = (state.medicalRecordHomePages ?? []).filter((item) => item.encounterId === encounterId);
  const recordQualityChecks = (state.recordQualityChecks ?? []).filter((item) => item.encounterId === encounterId);
  const consultations = (state.consultations ?? []).filter((item) => item.encounterId === encounterId);
  const teachingSessions = (state.teachingSessions ?? []).filter((item) => (
    item.encounterId === encounterId || (item.surgeryScheduleId && (state.surgerySchedules ?? []).some((schedule) => (
      schedule.surgeryScheduleId === item.surgeryScheduleId
      && (state.surgeryRequests ?? []).some((request) => request.surgeryRequestId === schedule.surgeryRequestId && request.encounterId === encounterId)
    )))
  ));
  const familyNotifications = (state.familyNotifications ?? []).filter((item) => item.encounterId === encounterId);
  const antimicrobialReviews = (state.antimicrobialReviews ?? []).filter((item) => item.encounterId === encounterId);
  const orConsumableUsages = (state.orConsumableUsages ?? []).filter((item) => item.encounterId === encounterId);
  const surgeryMediaRecords = (state.surgeryMediaRecords ?? []).filter((item) => item.encounterId === encounterId);
  const dietaryPlans = (state.dietaryPlans ?? []).filter((item) => item.encounterId === encounterId);
  const mobilityRehabRecords = (state.mobilityRehabRecords ?? []).filter((item) => item.encounterId === encounterId);
  const vteProphylaxisRecords = (state.vteProphylaxisRecords ?? []).filter((item) => item.encounterId === encounterId);
  const nursingHandovers = (state.nursingHandovers ?? []).filter((item) => item.encounterId === encounterId);
  const postopObservationRecords = (state.postopObservationRecords ?? []).filter((item) => item.encounterId === encounterId);
  const medicationCounselingRecords = (state.medicationCounselingRecords ?? []).filter((item) => item.encounterId === encounterId);
  const dischargeEducationRecords = (state.dischargeEducationRecords ?? []).filter((item) => item.encounterId === encounterId);
  const invoiceRecords = (state.invoiceRecords ?? []).filter((item) => item.encounterId === encounterId);
  const followUpOutcomeRecords = (state.followUpOutcomeRecords ?? []).filter((item) => item.encounterId === encounterId);
  const infectionSurveillanceRecords = (state.infectionSurveillanceRecords ?? []).filter((item) => item.encounterId === encounterId);
  const satisfactionSurveys = (state.satisfactionSurveys ?? []).filter((item) => item.encounterId === encounterId);
  const orderReviewRecords = (state.orderReviewRecords ?? []).filter((item) => item.encounterId === encounterId);
  const examAppointments = (state.examAppointments ?? []).filter((item) => item.encounterId === encounterId);
  const bloodPreparationRecords = (state.bloodPreparationRecords ?? []).filter((item) => item.encounterId === encounterId);
  const medicationSafetyChecks = (state.medicationSafetyChecks ?? []).filter((item) => item.encounterId === encounterId);
  const identityVerificationRecords = (state.identityVerificationRecords ?? []).filter((item) => item.encounterId === encounterId);
  const insuranceEligibilityRecords = (state.insuranceEligibilityRecords ?? []).filter((item) => item.encounterId === encounterId);
  const depositPayments = (state.depositPayments ?? []).filter((item) => item.encounterId === encounterId);
  const dailyBillingStatements = (state.dailyBillingStatements ?? []).filter((item) => item.encounterId === encounterId);
  const journeyIds = (state.patientJourneys ?? [])
    .filter((journey) => journey.encounterId === encounterId)
    .map((journey) => journey.journeyId);
  const clinicalTasks = (state.clinicalTasks ?? []).filter((task) => (
    journeyIds.includes(task.journeyId) || task.linkedObjectId === encounterId
  ));

  const summary = {
    encounterId,
    patient,
    encounter,
    diagnoses,
    documents,
    reports: [
      ...labReports.map((report) => ({ type: "Lab", ...report })),
      ...examReports.map((report) => ({ type: "Exam", ...report })),
      ...ultrasoundReports.map((report) => ({ type: "Ultrasound", ...report })),
      ...ecgReports.map((report) => ({ type: "ECG", ...report }))
    ],
    imagingStudies,
    ultrasoundReports,
    ecgReports,
    medicationDispenses,
    nursingRecords,
    consents,
    riskAssessments,
    transportEvents,
    billingItems,
    dischargeMedications,
    followUps,
    labCriticalValues,
    surgicalSpecimens,
    pathologyReports,
    insuranceSettlements,
    surgicalSafetyChecklists,
    anesthesiaRecords,
    instrumentCounts,
    pacuRecords,
    vitalSignRecords,
    medicationAdministrations,
    preopPreparations,
    wardRounds,
    dischargeAssessments,
    labSpecimenTracks,
    infusionRecords,
    painAssessments,
    woundCareRecords,
    medicalRecordHomePages,
    recordQualityChecks,
    consultations,
    teachingSessions,
    familyNotifications,
    antimicrobialReviews,
    orConsumableUsages,
    surgeryMediaRecords,
    dietaryPlans,
    mobilityRehabRecords,
    vteProphylaxisRecords,
    nursingHandovers,
    postopObservationRecords,
    medicationCounselingRecords,
    dischargeEducationRecords,
    invoiceRecords,
    followUpOutcomeRecords,
    infectionSurveillanceRecords,
    satisfactionSurveys,
    orderReviewRecords,
    examAppointments,
    bloodPreparationRecords,
    medicationSafetyChecks,
    identityVerificationRecords,
    insuranceEligibilityRecords,
    depositPayments,
    dailyBillingStatements,
    clinicalTasks
  };
  return {
    ...summary,
    quality: buildEncounterQuality(summary)
  };
}

function hasAny(items, predicate = Boolean) {
  return Array.isArray(items) && items.some(predicate);
}

function textIncludes(value, ...patterns) {
  const text = String(value ?? "");
  return patterns.every((pattern) => text.includes(pattern));
}

function reportItems(summary) {
  return (summary.reports ?? []).flatMap((report) => report.items ?? []);
}

function addQualityCheck(checks, input) {
  checks.push({
    category: input.category,
    item: input.item,
    status: input.status,
    severity: input.severity ?? (input.status === "failed" ? "error" : input.status === "warning" ? "warning" : "info"),
    message: input.message,
    evidence: input.evidence ?? null
  });
}

function requireQuality(checks, category, item, passed, message, evidence = null) {
  addQualityCheck(checks, {
    category,
    item,
    status: passed ? "passed" : "failed",
    message,
    evidence
  });
}

function optionalQuality(checks, category, item, passed, message, evidence = null) {
  addQualityCheck(checks, {
    category,
    item,
    status: passed ? "passed" : "warning",
    message,
    evidence
  });
}

function buildEncounterQuality(summary) {
  const checks = [];
  const diagnosis = summary.diagnoses?.find((item) => item.isPrimary) ?? summary.diagnoses?.[0] ?? null;
  const isChole = diagnosis?.diagnosisCode === "K80.200" || diagnosis?.diagnosisName?.includes("胆囊结石");
  const isDischarged = summary.encounter?.status === "Discharged";
  const hasCompletedClosedLoop = isDischarged || hasAny(summary.dischargeAssessments) || hasAny(summary.insuranceSettlements, (item) => item.status === "Settled");

  requireQuality(checks, "患者身份", "脱敏姓名", summary.patient?.name?.includes("某"), "患者姓名应使用脱敏演示姓名。", summary.patient?.name);
  requireQuality(checks, "患者身份", "住院号", Boolean(summary.encounter?.inpatientNo), "住院就诊应有住院号。", summary.encounter?.inpatientNo);
  requireQuality(checks, "患者身份", "主诊断", Boolean(diagnosis?.diagnosisCode && diagnosis?.diagnosisName), "应有主诊断编码和名称。", diagnosis);
  requireQuality(checks, "电子病历", "入院记录", hasAny(summary.documents, (item) => item.documentType === "AdmissionRecord"), "应生成入院记录。");
  requireQuality(checks, "电子病历", "术前小结", hasAny(summary.documents, (item) => item.documentType === "PreoperativeSummary"), "应生成术前小结。");

  const itemCodes = new Set(reportItems(summary).map((item) => item.code));
  const requiredLabCodes = isChole ? ["WBC", "HGB", "PLT", "ALT", "AST", "TBIL", "DBIL", "GGT", "AMY", "K", "PT", "INR", "APTT"] : ["WBC", "HGB"];
  for (const code of requiredLabCodes) {
    requireQuality(checks, "检验真实性", code, itemCodes.has(code), `检验报告应包含 ${code}。`);
  }

  const ultrasound = summary.ultrasoundReports?.[0] ?? null;
  requireQuality(checks, "检查真实性", "腹部超声", Boolean(ultrasound), "应有腹部超声报告。");
  if (isChole && ultrasound) {
    requireQuality(checks, "检查真实性", "胆囊尺寸", /胆囊大小约\s*\d/.test(ultrasound.finding ?? ""), "胆囊结石超声应记录胆囊大小。", ultrasound.finding);
    requireQuality(checks, "检查真实性", "胆总管", textIncludes(ultrasound.finding, "胆总管内径") && textIncludes(ultrasound.conclusion, "胆总管未见扩张"), "胆囊结石超声应记录胆总管内径及是否扩张。", ultrasound.conclusion);
    requireQuality(checks, "检查真实性", "结石声影", textIncludes(ultrasound.finding, "强回声", "声影"), "胆囊结石超声应描述强回声及声影。", ultrasound.finding);
  }

  optionalQuality(checks, "检查真实性", "十二导联心电图", hasAny(summary.ecgReports), "术前应有心电图报告。");
  const hasCtStudy = hasAny(summary.imagingStudies, (item) => item.modality === "CT" && item.dicomFileUrl && item.previewImageUrl);
  const hasUsStudy = hasAny(summary.imagingStudies, (item) => item.modality === "US" && item.dicomFileUrl && item.previewImageUrl);
  requireQuality(checks, "PACS/DICOM", "CT影像资产", hasCtStudy, "PACS 应提供 CT DICOM 和预览图。");
  requireQuality(checks, "PACS/DICOM", "B超影像资产", isChole ? hasUsStudy : true, "胆囊结石病例应提供 B 超 DICOM 和预览图。");

  if (hasCompletedClosedLoop) {
    requireQuality(checks, "围术期闭环", "知情同意", hasAny(summary.consents), "完整流程应有手术/麻醉/输血知情同意。");
    requireQuality(checks, "围术期闭环", "术前风险评估", hasAny(summary.riskAssessments), "完整流程应有 ASA/VTE/护理风险评估。");
    requireQuality(checks, "围术期闭环", "手术安全核查", hasAny(summary.surgicalSafetyChecklists), "完整流程应有手术安全核查。");
    requireQuality(checks, "围术期闭环", "麻醉记录", hasAny(summary.anesthesiaRecords), "完整流程应有麻醉记录。");
    requireQuality(checks, "围术期闭环", "术中标本", hasAny(summary.surgicalSpecimens), "完整流程应有术中标本送检。");
    requireQuality(checks, "围术期闭环", "病理报告", hasAny(summary.pathologyReports), "完整流程应有术后病理报告。");
    requireQuality(checks, "出院闭环", "出院评估", hasAny(summary.dischargeAssessments), "完整流程应有出院准备评估。");
    requireQuality(checks, "出院闭环", "出院带药", hasAny(summary.dischargeMedications), "完整流程应有出院带药或明确无带药记录。");
    requireQuality(checks, "出院闭环", "医保结算", hasAny(summary.insuranceSettlements, (item) => item.settlementListNo && typeof item.selfPayAmount === "number"), "完整流程应有中国医保结算清单口径字段。");
    requireQuality(checks, "出院闭环", "随访", hasAny(summary.followUps), "完整流程应有出院随访预约。");
  } else {
    optionalQuality(checks, "流程进度", "完整闭环", false, "当前患者尚未跑完住院流程；点“一键跑完”后可验证术后、出院和医保闭环。", summary.encounter?.status);
  }

  if (isChole) {
    const dischargeMedNames = (summary.dischargeMedications ?? []).map((item) => item.medicationName).join("、");
    const hasWrongDischargeMed = /熊去氧胆酸|头孢呋辛/.test(dischargeMedNames);
    requireQuality(checks, "胆囊结石路径", "出院带药", !hasWrongDischargeMed, "腹腔镜胆囊切除术后无感染证据时不应默认熊去氧胆酸或口服头孢。", dischargeMedNames);

    const typeScreen = summary.bloodPreparationRecords?.find((item) => item.productType === "血型复核/抗体筛查");
    if (hasCompletedClosedLoop || hasAny(summary.bloodPreparationRecords)) {
      requireQuality(checks, "胆囊结石路径", "输血科处理", Boolean(typeScreen && typeScreen.reservedVolume === "0U"), "低出血风险择期腹腔镜胆囊切除应以血型复核/抗体筛查为主，不常规 2U 交叉配血。", typeScreen);
    }

    const cefazolin2g = summary.medicationDispenses?.find((item) => item.medicationCode === "CEFAZOLIN" && item.dose === "2.0g");
    const alternative = summary.medicationSafetyChecks?.find((item) => item.status === "AlternativePrepared");
    if (hasCompletedClosedLoop || hasAny(summary.medicationDispenses)) {
      requireQuality(checks, "胆囊结石路径", "预防用抗菌药", Boolean(cefazolin2g || alternative), "应模拟切皮前头孢唑林 2.0g，过敏患者应有替代方案核查。", cefazolin2g ?? alternative);
    }

    const surgeryRecord = summary.documents?.find((item) => item.documentType === "SurgeryRecord");
    if (hasCompletedClosedLoop || surgeryRecord) {
      requireQuality(checks, "胆囊结石路径", "手术记录", textIncludes(surgeryRecord?.contentText, "Calot", "关键安全视野"), "手术记录应体现 Calot 三角和关键安全视野。", surgeryRecord?.contentText);
    }

    const pathologyText = summary.pathologyReports?.map((item) => item.diagnosis).join("；") ?? "";
    if (hasCompletedClosedLoop || pathologyText) {
      requireQuality(checks, "胆囊结石路径", "术后病理", textIncludes(pathologyText, "慢性胆囊炎", "结石"), "术后病理应与胆囊结石伴慢性胆囊炎一致。", pathologyText);
    }
  }

  const failed = checks.filter((item) => item.status === "failed");
  const warnings = checks.filter((item) => item.status === "warning");
  const passed = checks.filter((item) => item.status === "passed");
  const score = Math.max(0, Math.round((passed.length / Math.max(checks.length, 1)) * 100) - failed.length * 3);
  const status = failed.length ? "failed" : warnings.length ? "warning" : "passed";
  return {
    status,
    score,
    passedCount: passed.length,
    warningCount: warnings.length,
    failedCount: failed.length,
    totalCount: checks.length,
    diagnosisCode: diagnosis?.diagnosisCode ?? null,
    diagnosisName: diagnosis?.diagnosisName ?? null,
    closedLoop: hasCompletedClosedLoop,
    summary: status === "passed"
      ? "摘要结构完整，关键临床链路和接口资产通过校验。"
      : status === "warning"
        ? "摘要基础数据可用，但流程尚未跑完或存在非阻断提醒。"
        : "摘要存在关键缺项或路径矛盾，请先修正后再交付客户验证。",
    checks
  };
}

export function listSurgeryRequests(state, query) {
  const items = state.surgeryRequests.filter((request) => {
    const encounter = findById(state.encounters, "encounterId", request.encounterId);
    return equalsIfPresent(request.status, query.status)
      && equalsIfPresent(request.encounterId, query.encounterId)
      && equalsIfPresent(encounter?.patientId, query.patientId);
  }).map((request) => enrichSurgeryRequest(state, request));

  return paginate(items, query);
}

export function enrichSurgeryRequest(state, request) {
  const encounter = findById(state.encounters, "encounterId", request.encounterId);
  const patient = encounter ? findById(state.patients, "patientId", encounter.patientId) : null;
  const order = findById(state.orders, "orderId", request.orderId) ?? null;
  const department = encounter ? findById(state.departments, "deptId", encounter.deptId) : null;

  return {
    ...request,
    encounter,
    patient,
    order,
    department
  };
}

export function listSurgerySchedules(state, query) {
  const items = state.surgerySchedules.filter((schedule) => {
    const request = findById(state.surgeryRequests, "surgeryRequestId", schedule.surgeryRequestId);
    const encounter = request ? findById(state.encounters, "encounterId", request.encounterId) : null;
    return equalsIfPresent(schedule.scheduleDate, query.date)
      && equalsIfPresent(schedule.roomId, query.roomId)
      && equalsIfPresent(schedule.status, query.status)
      && equalsIfPresent(encounter?.deptId, query.deptId);
  }).map((schedule) => enrichSurgerySchedule(state, schedule));

  return paginate(items, query);
}

export function enrichSurgerySchedule(state, schedule) {
  const request = requireFound(
    findById(state.surgeryRequests, "surgeryRequestId", schedule.surgeryRequestId),
    `Surgery request ${schedule.surgeryRequestId} was not found.`
  );
  const encounter = requireFound(
    findById(state.encounters, "encounterId", request.encounterId),
    `Encounter ${request.encounterId} was not found.`
  );
  const patient = requireFound(findById(state.patients, "patientId", encounter.patientId), `Patient ${encounter.patientId} was not found.`);
  const department = findById(state.departments, "deptId", encounter.deptId) ?? null;
  const room = findById(state.operatingRooms, "roomId", schedule.roomId) ?? null;
  const staff = state.surgeryStaffAssignments
    .filter((assignment) => assignment.surgeryScheduleId === schedule.surgeryScheduleId)
    .map((assignment) => ({
      ...assignment,
      practitioner: findById(state.practitioners, "practitionerId", assignment.practitionerId) ?? null
    }));
  const events = state.surgeryEvents
    .filter((event) => event.surgeryScheduleId === schedule.surgeryScheduleId)
    .sort((left, right) => left.eventTime.localeCompare(right.eventTime));

  return {
    ...schedule,
    surgeryNo: request.surgeryNo,
    plannedSurgeryCode: request.plannedSurgeryCode,
    plannedSurgeryName: request.plannedSurgeryName,
    anesthesiaMethod: request.anesthesiaMethod,
    surgeryLevel: request.surgeryLevel,
    request,
    encounter: { ...encounter, department },
    patient,
    room,
    staff,
    events
  };
}

export function getCurrentSurgeryByRoom(state, roomId) {
  const activeStatuses = new Set(["Called", "InRoom", "AnesthesiaStarted", "SurgeryStarted", "SurgeryEnded", "OutRoom", "Cleaning"]);
  const schedule = state.surgerySchedules.find((item) => item.roomId === roomId && activeStatuses.has(item.status));
  if (!schedule) {
    return { room: requireFound(findById(state.operatingRooms, "roomId", roomId), `Operating room ${roomId} was not found.`), currentSurgery: null };
  }

  return {
    room: findById(state.operatingRooms, "roomId", roomId),
    currentSurgery: enrichSurgerySchedule(state, schedule)
  };
}

export function createPatient(state, input = {}) {
  const id = buildId("PAT", state.counters);
  const patient = {
    patientId: id,
    mpiNo: input.mpiNo ?? `MPI${id.slice(3)}`,
    name: input.name ?? "模拟患者",
    gender: input.gender ?? "未知",
    birthDate: input.birthDate ?? "1980-01-01",
    ageText: input.ageText ?? "46岁",
    idCardNo: input.idCardNo ?? "320300198001010000",
    phone: input.phone ?? "13800000000",
    address: input.address ?? "模拟地址",
    insuranceType: input.insuranceType ?? "自费",
    bloodType: input.bloodType ?? "未知",
    allergyText: input.allergyText ?? "无"
  };
  state.patients.push(patient);
  return patient;
}

export function createSurgeryRequest(state, input = {}) {
  if (!input.encounterId) {
    throw new HttpError(400, "encounterId is required.");
  }
  requireFound(findById(state.encounters, "encounterId", input.encounterId), `Encounter ${input.encounterId} was not found.`);

  const requestId = buildId("SR", state.counters);
  const orderId = buildId("ORD", state.counters);
  const order = {
    orderId,
    orderNo: input.orderNo ?? `ORD20260516${orderId.slice(3)}`,
    encounterId: input.encounterId,
    orderType: "手术",
    itemCode: input.plannedSurgeryCode ?? "99.9900",
    itemName: input.plannedSurgeryName ?? "模拟手术",
    status: "已确认",
    requesterDeptId: input.requesterDeptId ?? null,
    requesterId: input.requesterId ?? null,
    requestedTime: input.requestedTime ?? nowIso(),
    scheduledTime: input.scheduledTime ?? null
  };
  const request = {
    surgeryRequestId: requestId,
    surgeryNo: input.surgeryNo ?? `OP20260516${requestId.slice(2)}`,
    encounterId: input.encounterId,
    orderId,
    plannedSurgeryCode: input.plannedSurgeryCode ?? "99.9900",
    plannedSurgeryName: input.plannedSurgeryName ?? "模拟手术",
    surgeryLevel: input.surgeryLevel ?? "二级",
    incisionType: input.incisionType ?? "I",
    anesthesiaMethod: input.anesthesiaMethod ?? "全麻",
    position: input.position ?? "仰卧位",
    isolationFlag: Boolean(input.isolationFlag),
    requestedTime: input.requestedTime ?? nowIso(),
    status: "已审核"
  };

  state.orders.push(order);
  state.surgeryRequests.push(request);
  return enrichSurgeryRequest(state, request);
}

export function createSurgerySchedule(state, input = {}) {
  if (!input.surgeryRequestId) {
    throw new HttpError(400, "surgeryRequestId is required.");
  }
  requireFound(findById(state.surgeryRequests, "surgeryRequestId", input.surgeryRequestId), `Surgery request ${input.surgeryRequestId} was not found.`);
  requireFound(findById(state.operatingRooms, "roomId", input.roomId), `Operating room ${input.roomId} was not found.`);

  const scheduleId = buildId("SCH", state.counters);
  const schedule = {
    surgeryScheduleId: scheduleId,
    surgeryRequestId: input.surgeryRequestId,
    scheduleDate: input.scheduleDate ?? nowIso().slice(0, 10),
    roomId: input.roomId,
    tableNo: input.tableNo ?? 1,
    plannedStartTime: input.plannedStartTime ?? null,
    plannedEndTime: input.plannedEndTime ?? null,
    actualStartTime: null,
    actualEndTime: null,
    status: "Scheduled"
  };

  state.surgerySchedules.push(schedule);
  const request = findById(state.surgeryRequests, "surgeryRequestId", input.surgeryRequestId);
  request.status = "已排班";
  return enrichSurgerySchedule(state, schedule);
}

export function addSurgeryEvent(state, scheduleId, input = {}) {
  const schedule = requireFound(findById(state.surgerySchedules, "surgeryScheduleId", scheduleId), `Surgery schedule ${scheduleId} was not found.`);
  const eventType = input.eventType ?? surgeryEventNames[input.status] ?? input.status;
  if (!eventType) {
    throw new HttpError(400, "eventType or status is required.");
  }

  const event = {
    eventId: buildId("EVT", state.counters),
    surgeryScheduleId: schedule.surgeryScheduleId,
    roomId: input.roomId ?? schedule.roomId,
    eventType,
    eventTime: input.eventTime ?? nowIso(),
    previousStatus: input.previousStatus ?? null,
    newStatus: input.newStatus ?? toInternalSurgeryStatus(input.status) ?? null,
    operatorId: input.operatorId ?? input.operatorCode ?? null,
    deviceId: input.deviceId ?? null,
    sourceSystem: input.sourceSystem ?? "SmartHIS",
    eventVersion: input.eventVersion ?? nextEventVersion(state, scheduleId),
    idempotencyKey: input.idempotencyKey ?? null,
    overrideReason: input.overrideReason ?? null,
    payload: {
      ...(input.payload ?? {}),
      ...(input.idempotencyKey ? { idempotencyKey: input.idempotencyKey } : {}),
      ...(input.lastEventId ? { lastEventId: input.lastEventId } : {})
    }
  };

  state.surgeryEvents.push(event);
  return event;
}

export function updateSurgeryStatus(state, scheduleId, input = {}) {
  const status = toInternalSurgeryStatus(input.status);
  if (!SURGERY_STATUS.includes(status)) {
    throw new HttpError(400, `不支持的手术状态：${input.status}。`, { allowed: SURGERY_STATUS });
  }

  const schedule = requireFound(findById(state.surgerySchedules, "surgeryScheduleId", scheduleId), `Surgery schedule ${scheduleId} was not found.`);
  const repeatedEvent = idempotentEvent(state, scheduleId, input.idempotencyKey);
  if (repeatedEvent) {
    return {
      schedule: enrichSurgerySchedule(state, schedule),
      event: repeatedEvent,
      idempotent: true
    };
  }

  const previousStatus = schedule.status;
  validateTerminalStatusChange(state, schedule, input);
  validateSurgeryStatusTransition(schedule, status, input);
  schedule.status = status;

  if (["InRoom", "AnesthesiaStarted", "SurgeryStarted"].includes(status) && !schedule.actualStartTime) {
    schedule.actualStartTime = input.eventTime ?? nowIso();
  }

  if (["SurgeryEnded", "OutRoom", "Completed"].includes(status)) {
    schedule.actualEndTime = input.eventTime ?? nowIso();
  }

  const room = findById(state.operatingRooms, "roomId", schedule.roomId);
  if (room) {
    if (status === "Cleaning") {
      room.status = "Cleaning";
    } else if (status === "Completed" || status === "Cancelled") {
      room.status = "Idle";
    } else if (status !== "Scheduled") {
      room.status = "Occupied";
    }
  }

  const event = addSurgeryEvent(state, scheduleId, {
    ...input,
    previousStatus,
    newStatus: status,
    roomId: schedule.roomId,
    eventVersion: nextEventVersion(state, scheduleId),
    eventType: surgeryEventNames[status] ?? status
  });

  return {
    schedule: enrichSurgerySchedule(state, schedule),
    event,
    idempotent: false
  };
}

function eventForReplay(state, event) {
  const schedule = findById(state.surgerySchedules, "surgeryScheduleId", event.surgeryScheduleId);
  const room = schedule ? findById(state.operatingRooms, "roomId", schedule.roomId) : null;
  const terminal = event.deviceId ? findById(state.deviceTerminals ?? [], "deviceId", event.deviceId) : null;
  const operator = event.operatorId ? findById(state.practitioners ?? [], "practitionerId", event.operatorId) : null;

  return {
    eventId: event.eventId,
    surgeryScheduleId: event.surgeryScheduleId,
    roomId: event.roomId ?? schedule?.roomId ?? null,
    roomName: room?.roomName ?? event.roomId ?? schedule?.roomId ?? null,
    eventType: event.newStatus
      ? SURGERY_STATUS_LABELS[event.newStatus] ?? event.newStatus
      : SURGERY_STATUS_LABELS[event.eventType] ?? event.eventType,
    previousStatus: event.previousStatus
      ? SURGERY_STATUS_LABELS[event.previousStatus] ?? event.previousStatus
      : null,
    newStatus: event.newStatus
      ? SURGERY_STATUS_LABELS[event.newStatus] ?? event.newStatus
      : null,
    eventTime: event.eventTime,
    eventVersion: event.eventVersion ?? null,
    deviceId: event.deviceId ?? null,
    deviceName: terminal?.deviceName ?? null,
    terminalType: terminal ? terminalTypeOf(terminal) : null,
    operatorId: event.operatorId ?? null,
    operatorName: operator?.name ?? null,
    sourceSystem: event.sourceSystem ?? null,
    idempotencyKey: event.idempotencyKey ?? event.payload?.idempotencyKey ?? null,
    overrideReason: event.overrideReason ?? null
  };
}

export function listOrEventReplay(state, query = {}) {
  const scheduleId = query.surgeryScheduleId ?? query.scheduleId;
  const items = (state.surgeryEvents ?? [])
    .filter((event) => (
      equalsIfPresent(event.surgeryScheduleId, scheduleId)
      && equalsIfPresent(event.roomId, query.roomId)
      && equalsIfPresent(event.deviceId, query.deviceId)
      && equalsIfPresent(event.operatorId, query.operatorId)
      && equalsIfPresent(event.sourceSystem, query.sourceSystem)
      && (!query.date || String(event.eventTime ?? "").slice(0, 10) === query.date)
      && (!query.afterVersion || Number(event.eventVersion ?? 0) > Number(query.afterVersion))
    ))
    .sort((left, right) => {
      const direction = query.order === "desc" ? -1 : 1;
      return direction * (String(left.eventTime ?? "").localeCompare(String(right.eventTime ?? ""))
        || String(left.eventId ?? "").localeCompare(String(right.eventId ?? "")));
    })
    .map((event) => eventForReplay(state, event));

  return paginate(items, query);
}

export function listOrTerminals(state, query = {}) {
  const items = (state.deviceTerminals ?? []).filter((terminal) => (
    equalsIfPresent(terminal.roomId, query.roomId)
    && equalsIfPresent(terminalTypeOf(terminal), query.terminalType ?? query.deviceType)
    && equalsIfPresent(terminalStatusOf(terminal), query.status)
  )).map((terminal) => ({
    ...terminal,
    terminalType: terminalTypeOf(terminal),
    status: terminalStatusOf(terminal)
  }));

  return paginate(items, query);
}

export function getOrTerminal(state, deviceId) {
  const terminal = requireFound(
    findById(state.deviceTerminals ?? [], "deviceId", deviceId),
    `终端设备 ${deviceId} 未注册。`
  );
  return {
    ...terminal,
    terminalType: terminalTypeOf(terminal),
    status: terminalStatusOf(terminal)
  };
}

export function registerOrTerminal(state, input = {}) {
  const existing = input.deviceId ? findById(state.deviceTerminals ?? [], "deviceId", input.deviceId) : null;
  const now = input.registeredTime ?? nowIso();
  if (existing) {
    Object.assign(existing, {
      deviceCode: input.deviceCode ?? existing.deviceCode,
      deviceName: input.deviceName ?? existing.deviceName,
      deviceType: terminalTypeAliases[input.terminalType ?? input.deviceType] ?? input.terminalType ?? input.deviceType ?? existing.deviceType,
      terminalType: terminalTypeAliases[input.terminalType ?? input.deviceType] ?? input.terminalType ?? input.deviceType ?? existing.terminalType ?? existing.deviceType,
      roomId: input.roomId ?? existing.roomId,
      ipAddress: input.ipAddress ?? existing.ipAddress,
      locationName: input.locationName ?? existing.locationName,
      permissionProfile: input.permissionProfile ?? existing.permissionProfile,
      status: input.status ?? existing.status ?? "在线",
      enabled: input.enabled ?? existing.enabled ?? true,
      lastHeartbeatTime: input.lastHeartbeatTime ?? existing.lastHeartbeatTime ?? now
    });
    return getOrTerminal(state, existing.deviceId);
  }

  const terminalType = terminalTypeAliases[input.terminalType ?? input.deviceType] ?? input.terminalType ?? input.deviceType ?? "门口展示终端";
  if (input.roomId) {
    requireFound(findById(state.operatingRooms, "roomId", input.roomId), `Operating room ${input.roomId} was not found.`);
  }

  const deviceId = input.deviceId ?? buildId("DEV", state.counters);
  const terminal = {
    deviceId,
    deviceCode: input.deviceCode ?? deviceId,
    deviceName: input.deviceName ?? `${terminalType}${deviceId.slice(-2)}`,
    deviceType: terminalType,
    terminalType,
    roomId: input.roomId ?? null,
    ipAddress: input.ipAddress ?? null,
    locationName: input.locationName ?? null,
    permissionProfile: input.permissionProfile ?? terminalType,
    status: input.status ?? "在线",
    registeredTime: now,
    lastHeartbeatTime: input.lastHeartbeatTime ?? now,
    enabled: input.enabled ?? true
  };

  state.deviceTerminals.push(terminal);
  return getOrTerminal(state, terminal.deviceId);
}

export function updateOrTerminalBinding(state, deviceId, input = {}) {
  const terminal = requireFound(
    findById(state.deviceTerminals ?? [], "deviceId", deviceId),
    `终端设备 ${deviceId} 未注册。`
  );
  if (input.roomId) {
    requireFound(findById(state.operatingRooms, "roomId", input.roomId), `Operating room ${input.roomId} was not found.`);
  }
  terminal.roomId = input.roomId ?? null;
  terminal.locationName = input.locationName ?? terminal.locationName ?? null;
  terminal.permissionProfile = input.permissionProfile ?? terminal.permissionProfile ?? terminalTypeOf(terminal);
  return getOrTerminal(state, deviceId);
}

export function updateOrTerminalStatus(state, deviceId, input = {}) {
  const terminal = requireFound(
    findById(state.deviceTerminals ?? [], "deviceId", deviceId),
    `终端设备 ${deviceId} 未注册。`
  );
  terminal.status = input.status ?? terminal.status ?? "在线";
  terminal.enabled = input.enabled ?? terminal.enabled ?? true;
  return getOrTerminal(state, deviceId);
}

export function recordOrTerminalHeartbeat(state, deviceId, input = {}) {
  const terminal = requireFound(
    findById(state.deviceTerminals ?? [], "deviceId", deviceId),
    `终端设备 ${deviceId} 未注册。`
  );
  terminal.status = input.status ?? "在线";
  terminal.lastHeartbeatTime = input.heartbeatTime ?? nowIso();
  terminal.ipAddress = input.ipAddress ?? terminal.ipAddress ?? null;
  return getOrTerminal(state, deviceId);
}

function scheduleForDisplay(state, schedule) {
  const enriched = enrichSurgerySchedule(state, schedule);
  const latestEvent = latestSurgeryEvent(state, schedule.surgeryScheduleId);
  return { enriched, latestEvent };
}

function firstActionableSurgeryByRoom(state, roomId) {
  const closed = new Set(["Completed", "Cancelled"]);
  return state.surgerySchedules
    .filter((schedule) => schedule.roomId === roomId && !closed.has(schedule.status))
    .sort((left, right) => String(left.scheduleDate || "").localeCompare(String(right.scheduleDate || ""))
      || String(left.plannedStartTime || "").localeCompare(String(right.plannedStartTime || "")))[0] ?? null;
}

export function buildDoorDisplaySnapshot(state, roomId) {
  const { room, currentSurgery } = getCurrentSurgeryByRoom(state, roomId);
  const terminals = (state.deviceTerminals ?? [])
    .filter((terminal) => terminal.roomId === roomId)
    .map((terminal) => ({
      deviceId: terminal.deviceId,
      deviceName: terminal.deviceName,
      terminalType: terminalTypeOf(terminal),
      status: terminalStatusOf(terminal),
      lastHeartbeatTime: terminal.lastHeartbeatTime ?? null
    }));
  const fallbackSurgery = currentSurgery ? null : firstActionableSurgeryByRoom(state, roomId);
  const displaySurgery = currentSurgery ?? (fallbackSurgery ? enrichSurgerySchedule(state, fallbackSurgery) : null);

  if (!displaySurgery) {
    return {
      snapshotType: "门口屏快照",
      snapshotTime: nowIso(),
      room,
      currentSurgery: null,
      display: {
        roomName: room.roomName,
        displayStatus: room.status === "Cleaning" ? "清洁中" : "空闲",
        lastUpdatedTime: nowIso()
      },
      terminals
    };
  }

  const latestEvent = latestSurgeryEvent(state, displaySurgery.surgeryScheduleId);
  const primarySurgeon = displaySurgery.staff.find((assignment) => assignment.role === "主刀")?.practitioner?.name ?? null;
  const anesthetist = displaySurgery.staff.find((assignment) => assignment.role === "麻醉医生")?.practitioner?.name ?? null;
  return {
    snapshotType: "门口屏快照",
    snapshotTime: nowIso(),
    room,
    currentSurgeryId: displaySurgery.surgeryScheduleId,
    currentSurgeryKind: currentSurgery ? "当前手术" : "下一台手术",
    display: {
      roomName: room.roomName,
      surgeryNo: displaySurgery.surgeryNo,
      displayStatus: SURGERY_STATUS_LABELS[displaySurgery.status] ?? displaySurgery.status,
      patientName: maskChineseName(displaySurgery.patient.name),
      gender: displaySurgery.patient.gender,
      ageText: displaySurgery.patient.ageText,
      plannedSurgeryName: displaySurgery.plannedSurgeryName,
      plannedStartTime: displaySurgery.plannedStartTime,
      primarySurgeon,
      anesthetist,
      lastUpdatedTime: latestEvent?.eventTime ?? displaySurgery.plannedStartTime
    },
    terminals
  };
}

export function buildFamilyWaitingSnapshot(state, query = {}) {
  const date = query.date ?? nowIso().slice(0, 10);
  const schedules = state.surgerySchedules
    .filter((schedule) => schedule.scheduleDate === date)
    .map((schedule) => scheduleForDisplay(state, schedule))
    .map(({ enriched, latestEvent }, index) => ({
      queueNo: String(index + 1).padStart(2, "0"),
      surgeryScheduleId: enriched.surgeryScheduleId,
      surgeryNo: enriched.surgeryNo,
      roomName: enriched.room?.roomName ?? enriched.roomId,
      patientName: maskChineseName(enriched.patient.name),
      displayStatus: familyStatusLabels[enriched.status],
      lastUpdatedTime: latestEvent?.eventTime ?? enriched.plannedStartTime,
      sortStatus: enriched.status
    }))
    .filter((item) => item.displayStatus);

  return {
    snapshotType: "家属等待区快照",
    snapshotTime: nowIso(),
    date,
    total: schedules.length,
    items: schedules,
    notice: "患者信息已脱敏，请以护士站正式通知为准。"
  };
}

export function buildNurseStationSnapshot(state, query = {}) {
  const date = query.date ?? nowIso().slice(0, 10);
  const schedules = state.surgerySchedules
    .filter((schedule) => schedule.scheduleDate === date)
    .map((schedule) => {
      const { enriched, latestEvent } = scheduleForDisplay(state, schedule);
      return {
        surgeryScheduleId: enriched.surgeryScheduleId,
        roomId: enriched.roomId,
        roomName: enriched.room?.roomName ?? enriched.roomId,
        status: enriched.status,
        patientName: enriched.patient.name,
        inpatientNo: enriched.encounter.inpatientNo,
        plannedSurgeryName: enriched.plannedSurgeryName,
        departmentName: enriched.encounter.department?.deptName ?? null,
        primarySurgeon: enriched.staff.find((assignment) => assignment.role === "主刀")?.practitioner?.name ?? null,
        plannedStartTime: enriched.plannedStartTime,
        actualStartTime: enriched.actualStartTime,
        actualEndTime: enriched.actualEndTime,
        lastUpdatedTime: latestEvent?.eventTime ?? enriched.plannedStartTime,
        eventCount: enriched.events.length
      };
    });

  return {
    snapshotType: "护士站快照",
    snapshotTime: nowIso(),
    date,
    rooms: state.operatingRooms,
    surgeries: schedules,
    terminals: (state.deviceTerminals ?? []).map((terminal) => ({
      deviceId: terminal.deviceId,
      deviceName: terminal.deviceName,
      terminalType: terminalTypeOf(terminal),
      roomId: terminal.roomId,
      status: terminalStatusOf(terminal),
      lastHeartbeatTime: terminal.lastHeartbeatTime ?? null
    }))
  };
}

export function buildDirectorDashboardSnapshot(state, query = {}) {
  const date = query.date ?? nowIso().slice(0, 10);
  const schedules = state.surgerySchedules.filter((schedule) => schedule.scheduleDate === date);
  const activeStatuses = new Set(["Called", "InRoom", "AnesthesiaStarted", "SurgeryStarted"]);
  const finishedStatuses = new Set(["SurgeryEnded", "OutRoom", "Cleaning", "Completed"]);
  const delayedCount = schedules.filter((schedule) => {
    if (!schedule.actualStartTime || !schedule.plannedStartTime) {
      return false;
    }
    const delay = minutesBetween(schedule.plannedStartTime, schedule.actualStartTime);
    return delay !== null && delay > 15;
  }).length;
  const offlineTerminalCount = (state.deviceTerminals ?? [])
    .filter((terminal) => ["离线", "Offline"].includes(terminalStatusOf(terminal))).length;
  const occupiedRoomCount = state.operatingRooms.filter((room) => ["Occupied", "Cleaning", "占用", "清洁中"].includes(room.status)).length;

  return {
    snapshotType: "院领导看板快照",
    snapshotTime: nowIso(),
    date,
    metrics: {
      今日手术台次: schedules.length,
      进行中台次: schedules.filter((schedule) => activeStatuses.has(schedule.status)).length,
      已完成台次: schedules.filter((schedule) => finishedStatuses.has(schedule.status)).length,
      延误台次: delayedCount,
      终端离线数量: offlineTerminalCount,
      房间利用率: state.operatingRooms.length ? `${Math.round((occupiedRoomCount / state.operatingRooms.length) * 100)}%` : "0%"
    },
    statusCounts: schedules.reduce((counts, schedule) => {
      counts[schedule.status] = (counts[schedule.status] ?? 0) + 1;
      return counts;
    }, {})
  };
}

export function listDocuments(state, query) {
  const items = state.documents.filter((document) => (
    equalsIfPresent(document.encounterId, query.encounterId)
    && equalsIfPresent(document.documentType, query.type)
  ));
  return paginate(items, query);
}

export function createDocument(state, input = {}) {
  if (!input.encounterId) {
    throw new HttpError(400, "encounterId is required.");
  }
  requireFound(findById(state.encounters, "encounterId", input.encounterId), `Encounter ${input.encounterId} was not found.`);

  const document = {
    documentId: buildId("DOC", state.counters),
    encounterId: input.encounterId,
    documentType: input.documentType ?? "ProgressNote",
    title: input.title ?? "模拟文书",
    authorId: input.authorId ?? null,
    deptId: input.deptId ?? null,
    status: input.status ?? "Draft",
    createdTime: input.createdTime ?? nowIso(),
    signedTime: input.signedTime ?? null,
    contentText: input.contentText ?? "",
    content: input.content ?? {}
  };
  state.documents.push(document);
  return document;
}

export function listReports(collection, query) {
  const items = collection.filter((report) => (
    equalsIfPresent(report.patientId, query.patientId)
    && equalsIfPresent(report.encounterId, query.encounterId)
    && equalsIfPresent(report.status, query.status)
  ));
  return paginate(items, query);
}

export function listConsultations(state, query) {
  return paginate(state.consultations.filter((item) => (
    equalsIfPresent(item.encounterId, query.encounterId)
    && equalsIfPresent(item.surgeryScheduleId, query.surgeryScheduleId)
    && equalsIfPresent(item.status, query.status)
  )), query);
}

export function createConsultation(state, input = {}) {
  if (!input.encounterId) {
    throw new HttpError(400, "encounterId is required.");
  }
  requireFound(findById(state.encounters, "encounterId", input.encounterId), `Encounter ${input.encounterId} was not found.`);

  const consultation = {
    consultationId: buildId("CON", state.counters),
    encounterId: input.encounterId,
    surgeryScheduleId: input.surgeryScheduleId ?? null,
    consultationType: input.consultationType ?? "远程",
    requesterDeptId: input.requesterDeptId ?? null,
    invitedDeptId: input.invitedDeptId ?? null,
    reason: input.reason ?? "模拟会诊",
    status: "已申请",
    scheduledTime: input.scheduledTime ?? null,
    conclusion: ""
  };
  state.consultations.push(consultation);
  return consultation;
}

export function updateConsultationStatus(state, consultationId, input = {}) {
  const consultation = requireFound(findById(state.consultations, "consultationId", consultationId), `Consultation ${consultationId} was not found.`);
  consultation.status = input.status ?? consultation.status;
  consultation.conclusion = input.conclusion ?? consultation.conclusion;
  return consultation;
}

export function listTeachingSessions(state, query) {
  return paginate(state.teachingSessions.filter((item) => (
    equalsIfPresent(item.surgeryScheduleId, query.surgeryScheduleId)
    && equalsIfPresent(item.status, query.status)
  )), query);
}

export function createTeachingSession(state, input = {}) {
  if (!input.surgeryScheduleId) {
    throw new HttpError(400, "surgeryScheduleId is required.");
  }
  requireFound(findById(state.surgerySchedules, "surgeryScheduleId", input.surgeryScheduleId), `Surgery schedule ${input.surgeryScheduleId} was not found.`);

  const session = {
    teachingSessionId: buildId("TEA", state.counters),
    surgeryScheduleId: input.surgeryScheduleId,
    title: input.title ?? "模拟手术示教",
    teacherId: input.teacherId ?? null,
    status: "已预约",
    startTime: input.startTime ?? null,
    endTime: input.endTime ?? null,
    streamCode: input.streamCode ?? null,
    recordingUrl: null
  };
  state.teachingSessions.push(session);
  return session;
}

export function updateTeachingSessionStatus(state, sessionId, input = {}) {
  const session = requireFound(findById(state.teachingSessions, "teachingSessionId", sessionId), `Teaching session ${sessionId} was not found.`);
  session.status = input.status ?? session.status;
  if (input.status === "直播中" && !session.startTime) {
    session.startTime = nowIso();
  }
  if (input.status === "已结束") {
    session.endTime = input.endTime ?? nowIso();
    session.recordingUrl = input.recordingUrl ?? session.recordingUrl ?? `/recordings/${session.teachingSessionId}.mp4`;
  }
  return session;
}

export function startScenarioRun(state, scenarioId, input = {}) {
  const scenario = requireFound(findById(state.scenarios, "scenarioId", scenarioId), `Scenario ${scenarioId} was not found.`);
  const run = {
    runId: buildId("RUN", state.counters),
    scenarioId,
    status: "running",
    currentStep: -1,
    startedTime: nowIso(),
    finishedTime: null,
    output: {
      surgeryScheduleId: input.surgeryScheduleId ?? state.surgerySchedules[0]?.surgeryScheduleId ?? null
    }
  };
  state.scenarioRuns.push(run);
  return { ...run, scenario };
}

export function advanceScenarioRun(state, runId) {
  const run = requireFound(findById(state.scenarioRuns, "runId", runId), `Scenario run ${runId} was not found.`);
  const scenario = requireFound(findById(state.scenarios, "scenarioId", run.scenarioId), `Scenario ${run.scenarioId} was not found.`);

  if (run.status === "completed") {
    return { ...run, scenario, result: "already completed" };
  }

  const nextStepIndex = run.currentStep + 1;
  const nextStep = scenario.steps[nextStepIndex];
  if (!nextStep) {
    run.status = "completed";
    run.finishedTime = nowIso();
    return { ...run, scenario, result: "completed" };
  }

  run.currentStep = nextStepIndex;

  if (scenario.scenarioCode === "NORMAL_INPATIENT_SURGERY" && run.output.surgeryScheduleId) {
    updateSurgeryStatus(state, run.output.surgeryScheduleId, {
      status: nextStep,
      sourceSystem: "Scenario",
      payload: { scenarioRunId: run.runId }
    });
  }

  if (nextStepIndex === scenario.steps.length - 1) {
    run.status = "completed";
    run.finishedTime = nowIso();
  }

  return { ...run, scenario, result: nextStep };
}

export function generatePatients(state, count = 1) {
  const created = [];
  const names = ["赵某某", "钱某某", "孙某某", "李某某", "周某某"];
  for (let index = 0; index < count; index += 1) {
    created.push(createPatient(state, {
      name: names[index % names.length],
      gender: index % 2 === 0 ? "男" : "女",
      ageText: `${35 + index}岁`,
      mpiNo: `MPI${Date.now()}${index}`
    }));
  }
  return created;
}

export function generateSurgeries(state, count = 1) {
  const created = [];
  const templates = [
    { code: "51.2301", name: "腹腔镜胆囊切除术", diagnosisCode: "K80.200", diagnosisName: "胆囊结石伴慢性胆囊炎", deptId: "D004", roomId: "OR02" },
    { code: "68.2901", name: "宫腔镜检查术", deptId: "D006", roomId: "OR03" },
    { code: "81.5101", name: "髋关节置换术", deptId: "D005", roomId: "OR02" }
  ];

  for (let index = 0; index < count; index += 1) {
    const template = templates[index % templates.length];
    const patient = createPatient(state, {
      name: ["顾某某", "马某某", "何某某"][index % 3],
      gender: index % 2 === 0 ? "男" : "女",
      ageText: `${48 + index}岁`
    });
    const encounterId = buildId("ENC", state.counters);
    const admissionId = buildId("ADM", state.counters);
    const diagnosisId = buildId("DIA", state.counters);
    const ward = state.wards.find((item) => item.deptId === template.deptId) ?? state.wards[0];
    const idleBed = state.beds.find((item) => item.wardId === ward.wardId && item.status === "Idle");

    const encounter = {
      encounterId,
      patientId: patient.patientId,
      encounterType: "住院",
      outpatientNo: null,
      inpatientNo: `ZY20260516${encounterId.slice(3)}`,
      visitNo: `VIS20260516${encounterId.slice(3)}`,
      deptId: template.deptId,
      attendingDoctorId: "PRA001",
      status: "Admitted",
      startTime: nowIso(),
      endTime: null
    };
    const admission = {
      admissionId,
      encounterId,
      wardId: ward.wardId,
      bedId: idleBed?.bedId ?? null,
      admissionTime: nowIso(),
      dischargeTime: null,
      admissionDiagnosis: template.diagnosisName ?? "模拟手术诊断",
      dischargeDiagnosis: null,
      nursingLevel: "二级护理",
      conditionLevel: "一般"
    };
    const diagnosis = {
      diagnosisId,
      encounterId,
      diagnosisCode: template.diagnosisCode ?? "Z00.001",
      diagnosisName: template.diagnosisName ?? "模拟手术诊断",
      diagnosisType: "术前",
      isPrimary: true,
      recordedTime: nowIso()
    };

    if (idleBed) {
      idleBed.status = "Occupied";
      idleBed.currentEncounterId = encounterId;
    }

    state.encounters.push(encounter);
    state.admissions.push(admission);
    state.diagnoses.push(diagnosis);

    const request = createSurgeryRequest(state, {
      encounterId,
      requesterDeptId: template.deptId,
      requesterId: "PRA001",
      plannedSurgeryCode: template.code,
      plannedSurgeryName: template.name,
      surgeryLevel: index % 2 === 0 ? "三级" : "二级"
    });
    const schedule = createSurgerySchedule(state, {
      surgeryRequestId: request.surgeryRequestId,
      scheduleDate: nowIso().slice(0, 10),
      roomId: template.roomId,
      tableNo: index + 1,
      plannedStartTime: nowIso(),
      plannedEndTime: nowIso()
    });
    created.push(schedule);
  }

  return created;
}

export function logInterfaceMessage(state, input) {
  const message = {
    messageId: buildId("MSG", state.counters),
    channelId: input.channelId ?? "CH000001",
    correlationId: input.correlationId ?? input.messageId ?? buildId("COR", state.counters),
    messageType: input.messageType ?? "REST_API",
    direction: input.direction ?? "request",
    status: input.status ?? "success",
    requestBody: input.requestBody ?? null,
    responseBody: input.responseBody ?? null,
    errorMessage: input.errorMessage ?? null,
    createdTime: nowIso()
  };
  state.interfaceMessages.unshift(message);
  return message;
}

export function listInterfaceMessages(state, query) {
  const items = state.interfaceMessages.filter((message) => (
    equalsIfPresent(message.status, query.status)
    && equalsIfPresent(message.messageType, query.messageType)
    && equalsIfPresent(message.correlationId, query.correlationId)
  ));
  return paginate(items, query);
}
