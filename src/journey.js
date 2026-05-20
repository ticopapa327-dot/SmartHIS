import {
  createPatient,
  createDocument,
  createSurgeryRequest,
  createSurgerySchedule,
  findById,
  logInterfaceMessage,
  updateSurgeryStatus
} from "./domain.js";
import {
  buildId,
  equalsIfPresent,
  HttpError,
  nowIso,
  paginate,
  requireFound
} from "./utils.js";
import { addDaysToDateString } from "./hospital-clock.js";

function addMinutes(isoTime, minutes) {
  const base = isoTime ? new Date(isoTime) : new Date();
  return new Date(base.getTime() + minutes * 60_000).toISOString();
}

function getTemplate(state, templateId) {
  return requireFound(
    findById(state.journeyTemplates, "templateId", templateId),
    `Journey template ${templateId} was not found.`
  );
}

function getJourney(state, journeyId) {
  return requireFound(
    findById(state.patientJourneys, "journeyId", journeyId),
    `Patient journey ${journeyId} was not found.`
  );
}

function nextStepFor(state, journey) {
  const template = getTemplate(state, journey.templateId);
  return template.steps[journey.currentStepIndex + 1] ?? null;
}

function completedStepsFor(state, journey) {
  const template = getTemplate(state, journey.templateId);
  return template.steps.slice(0, Math.max(journey.currentStepIndex + 1, 0));
}

function stepStatesFor(state, journey) {
  const template = getTemplate(state, journey.templateId);
  const eventsByStep = new Map(
    state.journeyEvents
      .filter((event) => event.journeyId === journey.journeyId)
      .map((event) => [event.stepCode, event])
  );

  return template.steps.map((step, index) => {
    let status = "pending";
    if (index <= journey.currentStepIndex) {
      status = "completed";
    } else if (index === journey.currentStepIndex + 1 && journey.status !== "completed") {
      status = "current";
    }

    return {
      ...step,
      index,
      status,
      system: systemForStep(step),
      event: eventsByStep.get(step.stepCode) ?? null
    };
  });
}

function systemForStep(step) {
  if (step.interfaceEvent?.startsWith("lis.")) {
    return "LIS";
  }
  if (step.interfaceEvent?.startsWith("ris.")) {
    return "RIS/PACS";
  }
  if (step.interfaceEvent?.startsWith("pharmacy.")) {
    return "药房";
  }
  if (step.interfaceEvent?.startsWith("billing.")) {
    return "HIS/医保";
  }
  if (step.interfaceEvent?.startsWith("order.")) {
    return "HIS/医嘱";
  }
  if (step.interfaceEvent?.startsWith("appointment.")) {
    return "RIS/检查预约";
  }
  if (step.interfaceEvent?.startsWith("blood.")) {
    return "输血科/血库";
  }
  if (step.interfaceEvent?.startsWith("allergy.")) {
    return "护理/药学";
  }
  if (step.interfaceEvent?.startsWith("scan.")) {
    return "护理PDA";
  }
  if (step.interfaceEvent?.startsWith("consent.") || step.interfaceEvent?.startsWith("risk.")) {
    return "EMR";
  }
  if (step.interfaceEvent?.startsWith("transport.")) {
    return "护理/手术部";
  }
  if (step.interfaceEvent?.startsWith("consult.")) {
    return "远程会诊";
  }
  if (step.interfaceEvent?.startsWith("family.")) {
    return "HIS/家属通知";
  }
  if (step.interfaceEvent?.startsWith("antibiotic.")) {
    return "药学部";
  }
  if (step.interfaceEvent?.startsWith("consumable.")) {
    return "手术部/耗材";
  }
  if (step.interfaceEvent?.startsWith("media.")) {
    return "数字化手术室";
  }
  if (step.interfaceEvent?.startsWith("teaching.")) {
    return "手术示教";
  }
  if (step.interfaceEvent?.startsWith("nutrition.")) {
    return "临床营养";
  }
  if (step.interfaceEvent?.startsWith("rehab.")) {
    return "护理/康复";
  }
  if (step.interfaceEvent?.startsWith("vte.")) {
    return "护理/VTE";
  }
  if (step.interfaceEvent?.startsWith("handover.")) {
    return "护理交接";
  }
  if (step.interfaceEvent?.startsWith("observation.")) {
    return "护理";
  }
  if (step.interfaceEvent?.startsWith("followup.")) {
    return "HIS";
  }
  if (step.interfaceEvent?.startsWith("mar.")) {
    return "护理/药房";
  }
  if (step.interfaceEvent?.startsWith("infusion.") || step.interfaceEvent?.startsWith("pain.") || step.interfaceEvent?.startsWith("wound.")) {
    return "护理";
  }
  if (step.interfaceEvent?.startsWith("vitals.") || step.interfaceEvent?.startsWith("preop.")) {
    return "护理";
  }
  if (step.interfaceEvent?.startsWith("mr.") || step.interfaceEvent?.startsWith("quality.")) {
    return "EMR/病案";
  }
  if (step.interfaceEvent?.startsWith("round.")) {
    return "EMR";
  }
  if (step.interfaceEvent?.startsWith("discharge.")) {
    return "HIS/护理";
  }
  if (step.interfaceEvent?.startsWith("education.")) {
    return "护理/宣教";
  }
  if (step.interfaceEvent?.startsWith("invoice.")) {
    return "HIS/财务";
  }
  if (step.interfaceEvent?.startsWith("ssi.")) {
    return "院感";
  }
  if (step.interfaceEvent?.startsWith("survey.")) {
    return "患者服务";
  }
  if (step.interfaceEvent?.startsWith("anesthesia.") || step.interfaceEvent?.startsWith("pacu.")) {
    return "麻醉/PACU";
  }
  if (step.interfaceEvent?.startsWith("safety.") || step.interfaceEvent?.startsWith("instrument.")) {
    return "手术护理";
  }
  if (step.interfaceEvent?.startsWith("nursing.")) {
    return "护理";
  }
  if (step.interfaceEvent?.startsWith("surgery.") || step.interfaceEvent?.startsWith("or.")) {
    return "手术部";
  }
  if (["signPreopSummary", "createAnesthesiaVisit", "createPostopProgress", "createDischargeSummary"].includes(step.linkedAction)) {
    return "EMR";
  }
  return "HIS";
}

export function enrichPatientJourney(state, journey) {
  const template = getTemplate(state, journey.templateId);
  const patient = requireFound(findById(state.patients, "patientId", journey.patientId), `Patient ${journey.patientId} was not found.`);
  const encounter = requireFound(findById(state.encounters, "encounterId", journey.encounterId), `Encounter ${journey.encounterId} was not found.`);
  const admission = state.admissions.find((item) => item.encounterId === journey.encounterId) ?? null;
  const surgerySchedule = journey.surgeryScheduleId
    ? findById(state.surgerySchedules, "surgeryScheduleId", journey.surgeryScheduleId) ?? null
    : null;
  const events = state.journeyEvents
    .filter((event) => event.journeyId === journey.journeyId)
    .sort((left, right) => left.eventTime.localeCompare(right.eventTime));
  const nextStep = nextStepFor(state, journey);

  return {
    ...journey,
    template,
    patient,
    encounter,
    admission,
    surgerySchedule,
    completedSteps: completedStepsFor(state, journey),
    nextStep,
    progress: {
      completed: Math.max(journey.currentStepIndex + 1, 0),
      total: template.steps.length,
      percent: Math.round((Math.max(journey.currentStepIndex + 1, 0) / template.steps.length) * 100)
    },
    steps: stepStatesFor(state, journey),
    timeline: events
  };
}

export function listJourneyTemplates(state, query) {
  const items = state.journeyTemplates.filter((template) => (
    equalsIfPresent(String(template.enabled), query.enabled)
    && (!query.departmentId || template.departmentId === query.departmentId)
  ));
  return paginate(items, query);
}

export function getJourneyTemplate(state, templateId) {
  return getTemplate(state, templateId);
}

export function listPatientJourneys(state, query) {
  const items = state.patientJourneys
    .filter((journey) => (
      equalsIfPresent(journey.templateId, query.templateId)
      && equalsIfPresent(journey.patientId, query.patientId)
      && equalsIfPresent(journey.encounterId, query.encounterId)
      && equalsIfPresent(journey.status, query.status)
    ))
    .map((journey) => enrichPatientJourney(state, journey));

  return paginate(items, query);
}

export function getPatientJourney(state, journeyId) {
  return enrichPatientJourney(state, getJourney(state, journeyId));
}

export function createPatientJourney(state, input = {}) {
  const templateId = input.templateId ?? "TPL_CHOLECYSTECTOMY_INPATIENT";
  const template = getTemplate(state, templateId);
  const patientId = input.patientId;
  const encounterId = input.encounterId;

  if (!patientId || !encounterId) {
    throw new HttpError(400, "patientId and encounterId are required.");
  }

  requireFound(findById(state.patients, "patientId", patientId), `Patient ${patientId} was not found.`);
  const encounter = requireFound(findById(state.encounters, "encounterId", encounterId), `Encounter ${encounterId} was not found.`);

  const journey = {
    journeyId: buildId("JNY", state.counters),
    templateId: template.templateId,
    patientId,
    encounterId,
    surgeryScheduleId: input.surgeryScheduleId ?? null,
    status: "ready",
    currentStepIndex: -1,
    startedTime: null,
    updatedTime: null,
    finishedTime: null,
    simulatedTime: input.simulatedTime ?? encounter.startTime ?? nowIso(),
    summary: input.summary ?? `${template.templateName}：${patientId}`
  };

  state.patientJourneys.push(journey);
  return enrichPatientJourney(state, journey);
}

function findJourneyDocument(state, journey, documentType) {
  return state.documents.find((document) => document.encounterId === journey.encounterId && document.documentType === documentType);
}

function ensureDocument(state, journey, input) {
  const existing = findJourneyDocument(state, journey, input.documentType);
  if (existing) {
    existing.status = input.status ?? existing.status;
    existing.signedTime = input.signedTime ?? existing.signedTime;
    existing.contentText = input.contentText ?? existing.contentText;
    return existing;
  }

  return createDocument(state, {
    encounterId: journey.encounterId,
    documentType: input.documentType,
    title: input.title,
    authorId: input.authorId ?? "PRA001",
    deptId: input.deptId ?? "D004",
    status: input.status ?? "Final",
    signedTime: input.signedTime ?? nowIso(),
    contentText: input.contentText,
    content: input.content ?? {}
  });
}

function ensureClinicalTask(state, journey, input) {
  const existing = state.clinicalTasks.find((task) => (
    task.journeyId === journey.journeyId
    && task.taskType === input.taskType
    && task.taskName === input.taskName
  ));

  if (existing) {
    existing.status = input.status ?? existing.status;
    existing.completedTime = input.completedTime ?? existing.completedTime;
    existing.linkedObjectId = input.linkedObjectId ?? existing.linkedObjectId;
    return existing;
  }

  const task = {
    taskId: buildId("TASK", state.counters),
    journeyId: journey.journeyId,
    taskType: input.taskType,
    taskName: input.taskName,
    status: input.status ?? "pending",
    ownerDeptId: input.ownerDeptId ?? "D004",
    dueTime: input.dueTime ?? null,
    completedTime: input.completedTime ?? null,
    linkedObjectType: input.linkedObjectType ?? null,
    linkedObjectId: input.linkedObjectId ?? null
  };
  state.clinicalTasks.push(task);
  return task;
}

function ensureMedicationDispense(state, journey, input) {
  state.medicationDispenses ??= [];
  const existing = state.medicationDispenses.find((item) => (
    item.journeyId === journey.journeyId
    && item.medicationCode === input.medicationCode
    && item.phase === input.phase
  ));

  if (existing) {
    existing.status = input.status ?? existing.status;
    existing.dispensedTime = input.dispensedTime ?? existing.dispensedTime;
    existing.administeredTime = input.administeredTime ?? existing.administeredTime;
    return existing;
  }

  const dispense = {
    dispenseId: buildId("MED", state.counters),
    journeyId: journey.journeyId,
    patientId: journey.patientId,
    encounterId: journey.encounterId,
    phase: input.phase,
    medicationCode: input.medicationCode,
    medicationName: input.medicationName,
    dose: input.dose,
    route: input.route,
    frequency: input.frequency,
    status: input.status ?? "Dispensed",
    pharmacyDeptId: "D010",
    dispensedTime: input.dispensedTime ?? null,
    administeredTime: input.administeredTime ?? null,
    note: input.note ?? ""
  };
  state.medicationDispenses.push(dispense);
  return dispense;
}

function createNursingRecord(state, journey, input) {
  state.nursingRecords ??= [];
  const record = {
    nursingRecordId: buildId("NUR", state.counters),
    journeyId: journey.journeyId,
    patientId: journey.patientId,
    encounterId: journey.encounterId,
    recordType: input.recordType,
    recordTime: input.recordTime ?? nowIso(),
    nurseId: input.nurseId ?? "PRA004",
    content: input.content,
    vitalSigns: input.vitalSigns ?? null,
    painScore: input.painScore ?? null
  };
  state.nursingRecords.push(record);
  return record;
}

function createOrUpdateUltrasoundReport(state, journey, input = {}) {
  state.ultrasoundReports ??= [];
  const existing = state.ultrasoundReports.find((report) => report.encounterId === journey.encounterId);
  if (existing) {
    existing.status = input.status ?? existing.status;
    existing.performedTime = input.performedTime ?? existing.performedTime;
    existing.reportTime = input.reportTime ?? existing.reportTime;
    return existing;
  }

  const reportId = buildId("US", state.counters);
  const report = {
    ultrasoundReportId: reportId,
    orderId: input.orderId ?? null,
    encounterId: journey.encounterId,
    patientId: journey.patientId,
    accessionNo: input.accessionNo ?? `US${reportId.slice(2).padStart(8, "0")}`,
    examName: "腹部彩色多普勒超声",
    bodyPart: "肝胆胰脾",
    finding: input.finding ?? "胆囊壁稍厚，胆囊腔内见强回声团，后方伴声影，胆总管未见明显扩张。",
    conclusion: input.conclusion ?? "胆囊结石，慢性胆囊炎声像图改变。",
    status: input.status ?? "Registered",
    performedTime: input.performedTime ?? null,
    reportTime: input.reportTime ?? null,
    images: input.images ?? [
      { imageNo: `${reportId}-1`, view: "胆囊长轴", description: "胆囊腔内强回声伴声影" },
      { imageNo: `${reportId}-2`, view: "胆囊颈部", description: "胆囊颈部可见结石回声" }
    ]
  };
  state.ultrasoundReports.push(report);
  return report;
}

function createOrUpdateEcgReport(state, journey, input = {}) {
  state.ecgReports ??= [];
  const existing = state.ecgReports.find((report) => report.encounterId === journey.encounterId);
  if (existing) {
    existing.status = input.status ?? existing.status;
    existing.performedTime = input.performedTime ?? existing.performedTime;
    existing.reportTime = input.reportTime ?? existing.reportTime;
    return existing;
  }

  const reportId = buildId("ECG", state.counters);
  const report = {
    ecgReportId: reportId,
    orderId: input.orderId ?? null,
    encounterId: journey.encounterId,
    patientId: journey.patientId,
    examNo: input.examNo ?? `ECG${reportId.slice(3).padStart(8, "0")}`,
    heartRate: input.heartRate ?? 74,
    rhythm: input.rhythm ?? "窦性心律",
    prInterval: input.prInterval ?? 154,
    qrsDuration: input.qrsDuration ?? 86,
    qtInterval: input.qtInterval ?? 390,
    finding: input.finding ?? "各导联 P-QRS-T 顺序规律，QRS 波群时限正常，ST-T 未见明显异常。",
    conclusion: input.conclusion ?? "窦性心律，正常范围心电图。",
    status: input.status ?? "Registered",
    performedTime: input.performedTime ?? null,
    reportTime: input.reportTime ?? null,
    waveform: input.waveform ?? [
      { lead: "I", note: "基线平稳" },
      { lead: "II", note: "节律规则" },
      { lead: "V5", note: "ST 段无明显压低" }
    ]
  };
  state.ecgReports.push(report);
  return report;
}

function ensureMedicationOrder(state, journey, input) {
  const existing = state.orders.find((order) => (
    order.encounterId === journey.encounterId
    && order.itemCode === input.itemCode
    && order.orderType === "用药"
  ));

  if (existing) {
    existing.status = input.status ?? existing.status;
    return existing;
  }

  const orderId = buildId("ORD", state.counters);
  const order = {
    orderId,
    orderNo: `MED${orderId.slice(3).padStart(8, "0")}`,
    encounterId: journey.encounterId,
    orderType: "用药",
    itemCode: input.itemCode,
    itemName: input.itemName,
    status: input.status ?? "已开立",
    requesterDeptId: "D004",
    requesterId: "PRA001",
    requestedTime: input.requestedTime ?? nowIso(),
    scheduledTime: input.scheduledTime ?? null
  };
  state.orders.push(order);
  return order;
}

function upsertByJourney(collection, keyName, buildItem, matcher) {
  const existing = collection.find(matcher);
  if (existing) {
    Object.assign(existing, buildItem(existing[keyName]));
    return existing;
  }
  const created = buildItem(null);
  collection.push(created);
  return created;
}

function ensureConsent(state, journey, input) {
  state.consents ??= [];
  return upsertByJourney(
    state.consents,
    "consentId",
    (existingId) => ({
      consentId: existingId ?? buildId("CNS", state.counters),
      journeyId: journey.journeyId,
      patientId: journey.patientId,
      encounterId: journey.encounterId,
      consentType: input.consentType,
      title: input.title,
      status: input.status ?? "Signed",
      signedTime: input.signedTime ?? null,
      signer: input.signer ?? "患者本人",
      witnessId: input.witnessId ?? "PRA001",
      keyRisks: input.keyRisks ?? []
    }),
    (item) => item.journeyId === journey.journeyId && item.consentType === input.consentType
  );
}

function ensureRiskAssessment(state, journey, input) {
  state.riskAssessments ??= [];
  return upsertByJourney(
    state.riskAssessments,
    "riskAssessmentId",
    (existingId) => ({
      riskAssessmentId: existingId ?? buildId("RSK", state.counters),
      journeyId: journey.journeyId,
      patientId: journey.patientId,
      encounterId: journey.encounterId,
      assessmentType: input.assessmentType,
      score: input.score,
      riskLevel: input.riskLevel,
      status: input.status ?? "Completed",
      assessedTime: input.assessedTime ?? null,
      assessorId: input.assessorId ?? "PRA001",
      items: input.items ?? []
    }),
    (item) => item.journeyId === journey.journeyId && item.assessmentType === input.assessmentType
  );
}

function ensureTransportEvent(state, journey, input) {
  state.transportEvents ??= [];
  return upsertByJourney(
    state.transportEvents,
    "transportEventId",
    (existingId) => ({
      transportEventId: existingId ?? buildId("TRN", state.counters),
      journeyId: journey.journeyId,
      patientId: journey.patientId,
      encounterId: journey.encounterId,
      surgeryScheduleId: journey.surgeryScheduleId,
      direction: input.direction,
      fromLocation: input.fromLocation,
      toLocation: input.toLocation,
      status: input.status ?? "Completed",
      requestedTime: input.requestedTime ?? null,
      departedTime: input.departedTime ?? null,
      arrivedTime: input.arrivedTime ?? null,
      escortNurseId: input.escortNurseId ?? "PRA004",
      handoverItems: input.handoverItems ?? []
    }),
    (item) => item.journeyId === journey.journeyId && item.direction === input.direction
  );
}

function addBillingItem(state, journey, input) {
  state.billingItems ??= [];
  const existing = state.billingItems.find((item) => (
    item.journeyId === journey.journeyId && item.itemCode === input.itemCode
  ));
  const amount = roundMoney(input.amount ?? input.unitPrice);
  const insuranceClass = input.insuranceClass ?? "甲类";
  const selfPayRatio = input.selfPayRatio ?? (insuranceClass === "乙类" ? 0.1 : insuranceClass === "自费" ? 1 : 0);
  const insuranceParts = billingInsuranceParts({ amount, insuranceClass, selfPayRatio });
  if (existing) {
    existing.status = input.status ?? existing.status;
    existing.quantity = input.quantity ?? existing.quantity;
    existing.amount = amount ?? existing.amount;
    existing.insuranceClass = insuranceClass;
    existing.selfPayRatio = selfPayRatio;
    existing.catalogPaymentScopeAmount = insuranceParts.catalogPaymentScopeAmount;
    existing.fullSelfPayAmount = insuranceParts.fullSelfPayAmount;
    existing.priorSelfPayAmount = insuranceParts.priorSelfPayAmount;
    existing.medicalInsuranceCatalogCode = input.medicalInsuranceCatalogCode ?? existing.medicalInsuranceCatalogCode;
    existing.medicalInsuranceFeeCategory = input.medicalInsuranceFeeCategory ?? existing.medicalInsuranceFeeCategory;
    existing.postedTime = input.postedTime ?? existing.postedTime;
    return existing;
  }

  const billing = {
    billingItemId: buildId("BIL", state.counters),
    journeyId: journey.journeyId,
    patientId: journey.patientId,
    encounterId: journey.encounterId,
    itemCode: input.itemCode,
    itemName: input.itemName,
    category: input.category,
    quantity: input.quantity ?? 1,
    unitPrice: input.unitPrice,
    amount,
    insuranceClass,
    selfPayRatio,
    medicalInsuranceCatalogCode: input.medicalInsuranceCatalogCode ?? input.itemCode,
    medicalInsuranceCatalogName: input.medicalInsuranceCatalogName ?? input.itemName,
    medicalInsuranceFeeCategory: input.medicalInsuranceFeeCategory ?? input.category,
    catalogPaymentScopeAmount: insuranceParts.catalogPaymentScopeAmount,
    fullSelfPayAmount: insuranceParts.fullSelfPayAmount,
    priorSelfPayAmount: insuranceParts.priorSelfPayAmount,
    fundPayEligibleAmount: insuranceParts.catalogPaymentScopeAmount,
    status: input.status ?? "Posted",
    postedTime: input.postedTime ?? null,
    chinaInsuranceRule: {
      country: "中国",
      settlementMode: "基本医疗保险住院直接结算模拟",
      catalogClass: insuranceClass,
      selfPayRatio,
      scope: insuranceClass === "自费" ? "医保目录外全自费" : "医保目录内",
      standard: "国家医保信息业务编码及医保基金结算清单模拟口径"
    }
  };
  state.billingItems.push(billing);
  return billing;
}

function ensureDischargeMedication(state, journey, input) {
  state.dischargeMedications ??= [];
  return upsertByJourney(
    state.dischargeMedications,
    "dischargeMedicationId",
    (existingId) => ({
      dischargeMedicationId: existingId ?? buildId("DMED", state.counters),
      journeyId: journey.journeyId,
      patientId: journey.patientId,
      encounterId: journey.encounterId,
      medicationCode: input.medicationCode,
      medicationName: input.medicationName,
      dose: input.dose,
      route: input.route,
      frequency: input.frequency,
      days: input.days,
      quantity: input.quantity,
      status: input.status ?? "Prepared",
      preparedTime: input.preparedTime ?? null,
      instruction: input.instruction ?? ""
    }),
    (item) => item.journeyId === journey.journeyId && item.medicationCode === input.medicationCode
  );
}

function ensureFollowUp(state, journey, input) {
  state.followUps ??= [];
  return upsertByJourney(
    state.followUps,
    "followUpId",
    (existingId) => ({
      followUpId: existingId ?? buildId("FUP", state.counters),
      journeyId: journey.journeyId,
      patientId: journey.patientId,
      encounterId: journey.encounterId,
      followUpType: input.followUpType ?? "门诊复诊",
      scheduledTime: input.scheduledTime,
      departmentId: input.departmentId ?? "D004",
      doctorId: input.doctorId ?? "PRA001",
      status: input.status ?? "Scheduled",
      reminders: input.reminders ?? ["短信", "电话"],
      note: input.note ?? ""
    }),
    (item) => item.journeyId === journey.journeyId && item.followUpType === (input.followUpType ?? "门诊复诊")
  );
}

function ensureSurgicalSpecimen(state, journey, input) {
  state.surgicalSpecimens ??= [];
  return upsertByJourney(
    state.surgicalSpecimens,
    "specimenId",
    (existingId) => ({
      specimenId: existingId ?? buildId("SPM", state.counters),
      journeyId: journey.journeyId,
      patientId: journey.patientId,
      encounterId: journey.encounterId,
      surgeryScheduleId: journey.surgeryScheduleId,
      specimenNo: input.specimenNo ?? `SPM${journey.journeyId.slice(3).padStart(6, "0")}`,
      specimenName: input.specimenName ?? "胆囊",
      bodySite: input.bodySite ?? "胆囊",
      container: input.container ?? "10%中性福尔马林固定液标本瓶",
      status: input.status ?? "Received",
      collectedTime: input.collectedTime ?? null,
      sentTime: input.sentTime ?? null,
      receivedTime: input.receivedTime ?? null,
      senderId: input.senderId ?? "PRA004",
      receiverId: input.receiverId ?? "PRA006",
      grossDescription: input.grossDescription ?? "胆囊组织一件，大小约 7.0cm x 3.0cm，浆膜面光滑，壁稍厚。"
    }),
    (item) => item.journeyId === journey.journeyId && item.specimenName === (input.specimenName ?? "胆囊")
  );
}

function ensurePathologyReport(state, journey, input) {
  state.pathologyReports ??= [];
  return upsertByJourney(
    state.pathologyReports,
    "pathologyReportId",
    (existingId) => ({
      pathologyReportId: existingId ?? buildId("PATH", state.counters),
      journeyId: journey.journeyId,
      patientId: journey.patientId,
      encounterId: journey.encounterId,
      specimenId: input.specimenId,
      reportNo: input.reportNo ?? `PATH${journey.journeyId.slice(3).padStart(6, "0")}`,
      reportName: input.reportName ?? "胆囊术后病理",
      status: input.status ?? "Final",
      receivedTime: input.receivedTime ?? null,
      reportTime: input.reportTime ?? null,
      grossDescription: input.grossDescription ?? "胆囊壁增厚，腔内可见多枚黄绿色结石。",
      microscopicDescription: input.microscopicDescription ?? "胆囊黏膜慢性炎细胞浸润，局灶胆固醇沉积，未见恶性肿瘤证据。",
      diagnosis: input.diagnosis ?? "慢性胆囊炎伴胆囊结石。",
      pathologistId: input.pathologistId ?? "PRA006"
    }),
    (item) => item.journeyId === journey.journeyId && item.reportName === (input.reportName ?? "胆囊术后病理")
  );
}

function ensureInsuranceSettlement(state, journey, input) {
  state.insuranceSettlements ??= [];
  const settlement = calculateChinaInsuranceSettlement(state, journey, input);
  const profile = diseaseProfileForJourney(state, journey);
  return upsertByJourney(
    state.insuranceSettlements,
    "settlementId",
    (existingId) => ({
      settlementId: existingId ?? buildId("SET", state.counters),
      journeyId: journey.journeyId,
      patientId: journey.patientId,
      encounterId: journey.encounterId,
      settlementNo: input.settlementNo ?? `SET${journey.journeyId.slice(3).padStart(6, "0")}`,
      settlementListNo: input.settlementListNo ?? `YB320300${journey.journeyId.slice(3).padStart(10, "0")}`,
      fixedPointMedicalInstitutionCode: input.fixedPointMedicalInstitutionCode ?? "H320300A001",
      medicalInsuranceAreaCode: input.medicalInsuranceAreaCode ?? "320300",
      medicalCategory: input.medicalCategory ?? "普通住院",
      insuranceType: input.insuranceType ?? settlement.policy.insuranceType,
      insuredPersonTypeCode: input.insuredPersonTypeCode ?? settlement.policy.insuredPersonTypeCode,
      insuredPersonTypeName: input.insuredPersonTypeName ?? settlement.policy.insuredPersonTypeName,
      status: input.status ?? "PreSettled",
      diagnosisCode: input.diagnosisCode ?? profile.diagnosisCode,
      diagnosisName: input.diagnosisName ?? profile.diagnosisName,
      procedureCode: input.procedureCode ?? profile.procedureCode,
      procedureName: input.procedureName ?? profile.procedureName,
      totalAmount: settlement.totalAmount,
      coveredAmount: settlement.coveredAmount,
      selfPayAmount: settlement.selfPayAmount,
      catalogPaymentScopeAmount: settlement.catalogPaymentScopeAmount,
      fullSelfPayAmount: settlement.fullSelfPayAmount,
      priorSelfPayAmount: settlement.priorSelfPayAmount,
      deductibleAmount: settlement.deductibleAmount,
      fundPayBaseAmount: settlement.fundPayBaseAmount,
      overallFundPaymentAmount: settlement.overallFundPaymentAmount,
      seriousIllnessFundPaymentAmount: settlement.seriousIllnessFundPaymentAmount,
      otherFundPaymentAmount: settlement.otherFundPaymentAmount,
      fundPaymentAmount: settlement.fundPaymentAmount,
      personalAccountPaymentAmount: settlement.personalAccountPaymentAmount,
      cashPaymentAmount: settlement.cashPaymentAmount,
      policyName: settlement.policy.policyName,
      directSettlementFlag: input.directSettlementFlag ?? settlement.policy.insuranceType !== "自费",
      checklist: input.checklist ?? [
        "医保电子凭证/身份证核验",
        "费用明细医保目录属性校验",
        "出院诊断与病案首页一致性校验",
        "医保基金结算清单金额平衡校验"
      ],
      preSettlementTime: input.preSettlementTime ?? null,
      settlementTime: input.settlementTime ?? null,
      note: input.note ?? "按中国基本医保住院直接结算模拟口径生成：目录内费用、全自费、乙类先行自付、起付线、统筹基金、个人账户和现金支付已拆分。"
    }),
    (item) => item.journeyId === journey.journeyId
  );
}

function ensureInsuranceEligibilityRecord(state, journey, input) {
  state.insuranceEligibilityRecords ??= [];
  return upsertByJourney(
    state.insuranceEligibilityRecords,
    "eligibilityId",
    (existingId) => ({
      eligibilityId: existingId ?? buildId("ELG", state.counters),
      journeyId: journey.journeyId,
      patientId: journey.patientId,
      encounterId: journey.encounterId,
      verifiedTime: input.verifiedTime ?? null,
      insuranceType: input.insuranceType ?? "城镇职工",
      payerCode: input.payerCode ?? "320300-YB",
      payerName: input.payerName ?? "徐州市医疗保障局",
      eligibilityStatus: input.eligibilityStatus ?? "Active",
      benefitPlan: input.benefitPlan ?? "住院统筹",
      outpatientSpecialDiseaseFlag: Boolean(input.outpatientSpecialDiseaseFlag),
      estimatedCoverageRatio: input.estimatedCoverageRatio ?? 0.82,
      operatorId: input.operatorId ?? "HIS-CASHIER",
      note: input.note ?? "医保电子凭证/身份证读取成功，参保状态有效。"
    }),
    (item) => item.journeyId === journey.journeyId
  );
}

function ensureDepositPaymentRecord(state, journey, input) {
  state.depositPayments ??= [];
  return upsertByJourney(
    state.depositPayments,
    "depositId",
    (existingId) => ({
      depositId: existingId ?? buildId("DEP", state.counters),
      journeyId: journey.journeyId,
      patientId: journey.patientId,
      encounterId: journey.encounterId,
      paymentNo: input.paymentNo ?? `DEP${journey.journeyId.slice(3).padStart(8, "0")}`,
      paymentTime: input.paymentTime ?? null,
      amount: input.amount ?? 3000,
      paymentMethod: input.paymentMethod ?? "医保电子凭证+微信支付",
      payerName: input.payerName ?? "患者本人",
      status: input.status ?? "Paid",
      receiptNo: input.receiptNo ?? `RCPT${journey.journeyId.slice(3).padStart(8, "0")}`,
      balanceAfter: input.balanceAfter ?? input.amount ?? 3000,
      operatorId: input.operatorId ?? "HIS-CASHIER",
      note: input.note ?? "住院预交金已到账，可用于费用日清单冲抵。"
    }),
    (item) => item.journeyId === journey.journeyId
  );
}

function ensureDailyBillingStatement(state, journey, input) {
  state.dailyBillingStatements ??= [];
  const billingItems = (state.billingItems ?? []).filter((item) => item.journeyId === journey.journeyId);
  const totalAmount = input.totalAmount ?? billingItems.reduce((sum, item) => sum + Number(item.amount || 0), 0);
  const deposits = (state.depositPayments ?? []).filter((item) => item.journeyId === journey.journeyId && item.status === "Paid");
  const depositAmount = input.depositAmount ?? deposits.reduce((sum, item) => sum + Number(item.amount || 0), 0);
  const insuranceEstimate = calculateChinaInsuranceSettlement(state, journey, { totalAmount });
  const selfPayEstimate = input.selfPayEstimate ?? insuranceEstimate.selfPayAmount;
  const categories = billingItems.reduce((result, item) => {
    const category = item.category ?? "其他";
    result[category] = Math.round(((result[category] ?? 0) + Number(item.amount || 0)) * 100) / 100;
    return result;
  }, {});
  return upsertByJourney(
    state.dailyBillingStatements,
    "statementId",
    (existingId) => ({
      statementId: existingId ?? buildId("DBS", state.counters),
      journeyId: journey.journeyId,
      patientId: journey.patientId,
      encounterId: journey.encounterId,
      statementDate: input.statementDate ?? (input.generatedTime ?? nowIso()).slice(0, 10),
      generatedTime: input.generatedTime ?? null,
      status: input.status ?? "Confirmed",
      totalAmount,
      insuranceEstimate: input.insuranceEstimate ?? insuranceEstimate.fundPaymentAmount,
      selfPayEstimate,
      depositAmount,
      depositBalance: input.depositBalance ?? Math.round((depositAmount - selfPayEstimate) * 100) / 100,
      categories: input.categories ?? categories,
      chinaInsuranceEstimate: {
        catalogPaymentScopeAmount: insuranceEstimate.catalogPaymentScopeAmount,
        fullSelfPayAmount: insuranceEstimate.fullSelfPayAmount,
        priorSelfPayAmount: insuranceEstimate.priorSelfPayAmount,
        deductibleAmount: insuranceEstimate.deductibleAmount,
        fundPaymentAmount: insuranceEstimate.fundPaymentAmount,
        personalAccountPaymentAmount: insuranceEstimate.personalAccountPaymentAmount,
        cashPaymentAmount: insuranceEstimate.cashPaymentAmount,
        policyName: insuranceEstimate.policy.policyName
      },
      confirmedBy: input.confirmedBy ?? "患者本人",
      confirmTime: input.confirmTime ?? input.generatedTime ?? null,
      note: input.note ?? "费用日清单已推送患者端并完成确认。"
    }),
    (item) => item.journeyId === journey.journeyId && item.statementDate === (input.statementDate ?? (input.generatedTime ?? nowIso()).slice(0, 10))
  );
}

function ensureOrderReviewRecord(state, journey, input) {
  state.orderReviewRecords ??= [];
  return upsertByJourney(
    state.orderReviewRecords,
    "reviewId",
    (existingId) => ({
      reviewId: existingId ?? buildId("ORV", state.counters),
      journeyId: journey.journeyId,
      patientId: journey.patientId,
      encounterId: journey.encounterId,
      reviewType: input.reviewType ?? "术前医嘱审核",
      reviewTime: input.reviewTime ?? null,
      reviewerId: input.reviewerId ?? "PRA004",
      status: input.status ?? "Passed",
      orderIds: input.orderIds ?? [],
      allergyCheck: input.allergyCheck ?? "已核对药物过敏史",
      fastingInstruction: input.fastingInstruction ?? "术前禁食禁饮医嘱已确认",
      medicationCheck: input.medicationCheck ?? "围术期预防用药时机符合路径",
      insuranceCheck: input.insuranceCheck ?? "检验检查和治疗项目医保属性已同步",
      issues: input.issues ?? []
    }),
    (item) => item.journeyId === journey.journeyId && item.reviewType === (input.reviewType ?? "术前医嘱审核")
  );
}

function ensureExamAppointmentRecord(state, journey, input) {
  state.examAppointments ??= [];
  return upsertByJourney(
    state.examAppointments,
    "appointmentId",
    (existingId) => ({
      appointmentId: existingId ?? buildId("APP", state.counters),
      journeyId: journey.journeyId,
      patientId: journey.patientId,
      encounterId: journey.encounterId,
      orderId: input.orderId,
      examType: input.examType,
      examName: input.examName,
      modality: input.modality,
      departmentId: input.departmentId,
      scheduledTime: input.scheduledTime ?? null,
      queueNo: input.queueNo,
      status: input.status ?? "Booked",
      checkInTime: input.checkInTime ?? null,
      completedTime: input.completedTime ?? null,
      transportRequired: input.transportRequired ?? false,
      preparation: input.preparation ?? "携带腕带和检查申请单，按预约时间到达检查科室。"
    }),
    (item) => item.journeyId === journey.journeyId && item.orderId === input.orderId
  );
}

function ensureBloodPreparationRecord(state, journey, input) {
  state.bloodPreparationRecords ??= [];
  return upsertByJourney(
    state.bloodPreparationRecords,
    "bloodPreparationId",
    (existingId) => ({
      bloodPreparationId: existingId ?? buildId("BLD", state.counters),
      journeyId: journey.journeyId,
      patientId: journey.patientId,
      encounterId: journey.encounterId,
      orderId: input.orderId,
      requestNo: input.requestNo ?? `BLOOD${journey.journeyId.slice(3).padStart(6, "0")}`,
      requestTime: input.requestTime ?? null,
      sampleNo: input.sampleNo ?? `BB${journey.journeyId.slice(3).padStart(6, "0")}`,
      sampleCollectedTime: input.sampleCollectedTime ?? null,
      verifiedTime: input.verifiedTime ?? null,
      bloodType: input.bloodType ?? "待复核",
      antibodyScreen: input.antibodyScreen ?? "阴性",
      crossmatchResult: input.crossmatchResult ?? "主侧/次侧配血相合",
      productType: input.productType ?? "去白悬浮红细胞",
      reservedVolume: input.reservedVolume ?? "2U",
      status: input.status ?? "Prepared",
      validUntil: input.validUntil ?? null,
      bloodBankId: input.bloodBankId ?? "BBK001",
      emergencyFlag: Boolean(input.emergencyFlag),
      note: input.note ?? "择期手术备血，术中未启用则到期自动释放。"
    }),
    (item) => item.journeyId === journey.journeyId
  );
}

function ensureMedicationSafetyCheck(state, journey, input) {
  state.medicationSafetyChecks ??= [];
  return upsertByJourney(
    state.medicationSafetyChecks,
    "safetyCheckId",
    (existingId) => ({
      safetyCheckId: existingId ?? buildId("MSC", state.counters),
      journeyId: journey.journeyId,
      patientId: journey.patientId,
      encounterId: journey.encounterId,
      checkTime: input.checkTime ?? null,
      medicationCode: input.medicationCode,
      medicationName: input.medicationName,
      allergyHistory: input.allergyHistory ?? "无",
      skinTestRequired: Boolean(input.skinTestRequired),
      skinTestTime: input.skinTestTime ?? null,
      skinTestResult: input.skinTestResult ?? "未做",
      status: input.status ?? "Passed",
      action: input.action ?? "按原医嘱执行",
      operatorId: input.operatorId ?? "PRA004",
      pharmacistId: input.pharmacistId ?? "PHA001",
      barcode: input.barcode ?? `DRUGSAFE${journey.journeyId.slice(3).padStart(6, "0")}`
    }),
    (item) => item.journeyId === journey.journeyId && item.medicationCode === input.medicationCode
  );
}

function ensureIdentityVerificationRecord(state, journey, input) {
  state.identityVerificationRecords ??= [];
  return upsertByJourney(
    state.identityVerificationRecords,
    "verificationId",
    (existingId) => ({
      verificationId: existingId ?? buildId("IDV", state.counters),
      journeyId: journey.journeyId,
      patientId: journey.patientId,
      encounterId: journey.encounterId,
      surgeryScheduleId: journey.surgeryScheduleId,
      scene: input.scene,
      verificationTime: input.verificationTime ?? null,
      wristbandBarcode: input.wristbandBarcode ?? `WB${journey.patientId.slice(3).padStart(8, "0")}`,
      medicationBarcodes: input.medicationBarcodes ?? [],
      patientMatch: input.patientMatch ?? true,
      orderMatch: input.orderMatch ?? true,
      allergyMatch: input.allergyMatch ?? true,
      status: input.status ?? "Passed",
      deviceId: input.deviceId ?? "PDA-NS-PWK01",
      operatorId: input.operatorId ?? "PRA004",
      note: input.note ?? "腕带、医嘱、药品和过敏史核对一致。"
    }),
    (item) => item.journeyId === journey.journeyId && item.scene === input.scene
  );
}

function ensureMedicationCounselingRecord(state, journey, input) {
  state.medicationCounselingRecords ??= [];
  return upsertByJourney(
    state.medicationCounselingRecords,
    "counselingId",
    (existingId) => ({
      counselingId: existingId ?? buildId("COUN", state.counters),
      journeyId: journey.journeyId,
      patientId: journey.patientId,
      encounterId: journey.encounterId,
      counselingTime: input.counselingTime ?? null,
      pharmacistId: input.pharmacistId ?? "PHA001",
      status: input.status ?? "Completed",
      medications: input.medications ?? (state.dischargeMedications ?? [])
        .filter((item) => item.journeyId === journey.journeyId)
        .map((item) => ({
          medicationCode: item.medicationCode,
          medicationName: item.medicationName,
          dose: item.dose,
          frequency: item.frequency,
          days: item.days,
          instruction: item.instruction
        })),
      keyPoints: input.keyPoints ?? [
        "按医嘱完成抗菌药物疗程",
        "熊去氧胆酸餐后服用",
        "出现发热、腹痛加重、黄疸或切口渗液及时就诊",
        "避免饮酒和高脂饮食"
      ],
      teachBackResult: input.teachBackResult ?? "患者及家属能复述用药频次、疗程和异常情况处理。"
    }),
    (item) => item.journeyId === journey.journeyId
  );
}

function ensureDischargeEducationRecord(state, journey, input) {
  state.dischargeEducationRecords ??= [];
  return upsertByJourney(
    state.dischargeEducationRecords,
    "educationId",
    (existingId) => ({
      educationId: existingId ?? buildId("DED", state.counters),
      journeyId: journey.journeyId,
      patientId: journey.patientId,
      encounterId: journey.encounterId,
      educationTime: input.educationTime ?? null,
      educatorId: input.educatorId ?? "PRA004",
      recipient: input.recipient ?? "患者及家属",
      status: input.status ?? "Signed",
      signMethod: input.signMethod ?? "电子签名",
      topics: input.topics ?? [
        { topic: "切口护理", result: "保持干燥，渗血渗液及时就诊" },
        { topic: "饮食活动", result: "低脂清淡，逐步恢复活动" },
        { topic: "用药", result: "按药师指导服用出院带药" },
        { topic: "复诊", result: "按预约时间普通外科门诊复诊" },
        { topic: "警示症状", result: "发热、黄疸、明显腹痛、呕吐需及时就诊" }
      ],
      patientUnderstanding: input.patientUnderstanding ?? "理解",
      note: input.note ?? "出院宣教已完成并签收。"
    }),
    (item) => item.journeyId === journey.journeyId
  );
}

function ensureInvoiceRecord(state, journey, input) {
  state.invoiceRecords ??= [];
  const settlement = (state.insuranceSettlements ?? []).find((item) => item.journeyId === journey.journeyId);
  const totalAmount = input.totalAmount ?? settlement?.totalAmount ?? (state.billingItems ?? [])
    .filter((item) => item.journeyId === journey.journeyId)
    .reduce((sum, item) => sum + Number(item.amount || 0), 0);
  return upsertByJourney(
    state.invoiceRecords,
    "invoiceId",
    (existingId) => ({
      invoiceId: existingId ?? buildId("INV", state.counters),
      journeyId: journey.journeyId,
      patientId: journey.patientId,
      encounterId: journey.encounterId,
      settlementId: input.settlementId ?? settlement?.settlementId ?? null,
      invoiceNo: input.invoiceNo ?? `INV${journey.journeyId.slice(3).padStart(8, "0")}`,
      status: input.status ?? "Issued",
      issuedTime: input.issuedTime ?? null,
      invoiceType: input.invoiceType ?? "医疗电子票据",
      totalAmount,
      payerAmount: input.payerAmount ?? settlement?.selfPayAmount ?? Math.round(totalAmount * 0.18 * 100) / 100,
      downloadUrl: input.downloadUrl ?? `/invoices/${journey.journeyId}.pdf`,
      note: input.note ?? "电子票据已生成，可供患者端下载。"
    }),
    (item) => item.journeyId === journey.journeyId
  );
}

function ensureFollowUpOutcomeRecord(state, journey, input) {
  state.followUpOutcomeRecords ??= [];
  return upsertByJourney(
    state.followUpOutcomeRecords,
    "outcomeId",
    (existingId) => ({
      outcomeId: existingId ?? buildId("FOUT", state.counters),
      journeyId: journey.journeyId,
      patientId: journey.patientId,
      encounterId: journey.encounterId,
      followUpId: input.followUpId ?? null,
      contactTime: input.contactTime ?? null,
      contactMethod: input.contactMethod ?? "电话随访",
      status: input.status ?? "Completed",
      woundHealing: input.woundHealing ?? "切口干燥，无红肿渗液",
      dietRecovery: input.dietRecovery ?? "低脂饮食可，无明显腹胀腹痛",
      medicationCompliance: input.medicationCompliance ?? "按指导服药",
      warningSigns: input.warningSigns ?? "无发热、黄疸、明显腹痛",
      advice: input.advice ?? "继续低脂饮食，按预约门诊复查，异常及时就诊。",
      operatorId: input.operatorId ?? "PRA004"
    }),
    (item) => item.journeyId === journey.journeyId
  );
}

function ensureInfectionSurveillanceRecord(state, journey, input) {
  state.infectionSurveillanceRecords ??= [];
  return upsertByJourney(
    state.infectionSurveillanceRecords,
    "surveillanceId",
    (existingId) => ({
      surveillanceId: existingId ?? buildId("SSI", state.counters),
      journeyId: journey.journeyId,
      patientId: journey.patientId,
      encounterId: journey.encounterId,
      surgeryScheduleId: journey.surgeryScheduleId,
      surveillanceTime: input.surveillanceTime ?? null,
      status: input.status ?? "NoInfection",
      woundClass: input.woundClass ?? "II类切口",
      asaClass: input.asaClass ?? "II级",
      operationDurationMinutes: input.operationDurationMinutes ?? 75,
      antibioticTiming: input.antibioticTiming ?? "切皮前30分钟内",
      signs: input.signs ?? [
        { itemName: "发热", result: "无" },
        { itemName: "切口红肿", result: "无" },
        { itemName: "切口渗液", result: "无" },
        { itemName: "腹痛加重", result: "无" }
      ],
      infectionControlNurseId: input.infectionControlNurseId ?? "ICN001",
      note: input.note ?? "术后随访未发现手术部位感染证据。"
    }),
    (item) => item.journeyId === journey.journeyId
  );
}

function ensureSatisfactionSurvey(state, journey, input) {
  state.satisfactionSurveys ??= [];
  return upsertByJourney(
    state.satisfactionSurveys,
    "surveyId",
    (existingId) => ({
      surveyId: existingId ?? buildId("SAT", state.counters),
      journeyId: journey.journeyId,
      patientId: journey.patientId,
      encounterId: journey.encounterId,
      submittedTime: input.submittedTime ?? null,
      channel: input.channel ?? "患者端小程序",
      status: input.status ?? "Submitted",
      overallScore: input.overallScore ?? 96,
      dimensions: input.dimensions ?? [
        { name: "入院办理", score: 95 },
        { name: "护理服务", score: 98 },
        { name: "手术沟通", score: 96 },
        { name: "出院指导", score: 97 },
        { name: "信息化体验", score: 95 }
      ],
      comments: input.comments ?? "流程清楚，出院用药和复诊提醒明确。"
    }),
    (item) => item.journeyId === journey.journeyId
  );
}

function getAssignedPractitionerId(state, journey, roleText, fallbackId) {
  const assignment = (state.surgeryStaffAssignments ?? []).find((item) => (
    item.surgeryScheduleId === journey.surgeryScheduleId && item.role.includes(roleText)
  ));
  return assignment?.practitionerId ?? fallbackId;
}

function ensureSurgicalSafetyChecklist(state, journey, input) {
  const profile = diseaseProfileForJourney(state, journey);
  state.surgicalSafetyChecklists ??= [];
  return upsertByJourney(
    state.surgicalSafetyChecklists,
    "checklistId",
    (existingId) => ({
      checklistId: existingId ?? buildId("SAFE", state.counters),
      journeyId: journey.journeyId,
      patientId: journey.patientId,
      encounterId: journey.encounterId,
      surgeryScheduleId: journey.surgeryScheduleId,
      status: input.status ?? "Completed",
      signInTime: input.signInTime ?? null,
      timeOutTime: input.timeOutTime ?? null,
      signOutTime: input.signOutTime ?? null,
      surgeonId: getAssignedPractitionerId(state, journey, "主刀", "PRA001"),
      anesthesiologistId: getAssignedPractitionerId(state, journey, "麻醉", "PRA003"),
      circulatingNurseId: getAssignedPractitionerId(state, journey, "巡回", "PRA004"),
      items: input.items ?? surgicalSafetyItemsForProfile(profile)
    }),
    (item) => item.journeyId === journey.journeyId
  );
}

function ensureAnesthesiaRecord(state, journey, input) {
  const profile = diseaseProfileForJourney(state, journey);
  state.anesthesiaRecords ??= [];
  return upsertByJourney(
    state.anesthesiaRecords,
    "anesthesiaRecordId",
    (existingId) => ({
      anesthesiaRecordId: existingId ?? buildId("ANR", state.counters),
      journeyId: journey.journeyId,
      patientId: journey.patientId,
      encounterId: journey.encounterId,
      surgeryScheduleId: journey.surgeryScheduleId,
      status: input.status ?? "InProgress",
      anesthesiaMethod: input.anesthesiaMethod ?? profile.anesthesiaMethod ?? "全身麻醉气管插管",
      asaClass: input.asaClass ?? "II级",
      airway: input.airway ?? "气管插管，7.0# 导管，固定 21cm",
      startTime: input.startTime ?? null,
      endTime: input.endTime ?? null,
      anesthesiologistId: getAssignedPractitionerId(state, journey, "麻醉", "PRA003"),
      medications: input.medications ?? [
        { medicationName: "丙泊酚", dose: "120mg", route: "静脉诱导" },
        { medicationName: "舒芬太尼", dose: "15ug", route: "静脉镇痛" },
        { medicationName: "罗库溴铵", dose: "40mg", route: "静脉肌松" },
        { medicationName: "七氟烷", dose: "1.5-2.0%", route: "吸入维持" }
      ],
      vitalSigns: input.vitalSigns ?? [
        { time: input.startTime ?? null, bloodPressure: "128/76", heartRate: 82, spo2: 99, etco2: 36 },
        { time: input.middleTime ?? null, bloodPressure: "116/70", heartRate: 76, spo2: 100, etco2: 35 },
        { time: input.endTime ?? null, bloodPressure: "122/74", heartRate: 80, spo2: 99, etco2: 37 }
      ],
      fluidBalance: input.fluidBalance ?? {
        infusion: "乳酸钠林格液 800ml",
        urineOutput: "120ml",
        bloodLoss: "20ml"
      },
      adverseEvents: input.adverseEvents ?? []
    }),
    (item) => item.journeyId === journey.journeyId
  );
}

function ensureInstrumentCount(state, journey, input) {
  state.instrumentCounts ??= [];
  return upsertByJourney(
    state.instrumentCounts,
    "instrumentCountId",
    (existingId) => ({
      instrumentCountId: existingId ?? buildId("CNT", state.counters),
      journeyId: journey.journeyId,
      patientId: journey.patientId,
      encounterId: journey.encounterId,
      surgeryScheduleId: journey.surgeryScheduleId,
      phase: input.phase ?? "关腹前/关闭前",
      status: input.status ?? "Matched",
      countTime: input.countTime ?? null,
      circulatingNurseId: getAssignedPractitionerId(state, journey, "巡回", "PRA004"),
      scrubNurseId: getAssignedPractitionerId(state, journey, "器械", "PRA005"),
      items: input.items ?? [
        { itemName: "纱布", beforeCount: 10, closeCount: 10, finalCount: 10 },
        { itemName: "缝针", beforeCount: 4, closeCount: 4, finalCount: 4 },
        { itemName: "器械包", beforeCount: 1, closeCount: 1, finalCount: 1 },
        { itemName: "钛夹", beforeCount: 12, closeCount: 8, finalCount: 8, usedCount: 4 }
      ],
      discrepancy: input.discrepancy ?? "无"
    }),
    (item) => item.journeyId === journey.journeyId
  );
}

function ensurePacuRecord(state, journey, input) {
  state.pacuRecords ??= [];
  return upsertByJourney(
    state.pacuRecords,
    "pacuRecordId",
    (existingId) => ({
      pacuRecordId: existingId ?? buildId("PACU", state.counters),
      journeyId: journey.journeyId,
      patientId: journey.patientId,
      encounterId: journey.encounterId,
      surgeryScheduleId: journey.surgeryScheduleId,
      status: input.status ?? "TransferredOut",
      inTime: input.inTime ?? null,
      outTime: input.outTime ?? null,
      pacuNurseId: input.pacuNurseId ?? "PRA004",
      aldreteScoreIn: input.aldreteScoreIn ?? 8,
      aldreteScoreOut: input.aldreteScoreOut ?? 10,
      painScore: input.painScore ?? 2,
      vitalSigns: input.vitalSigns ?? [
        { time: input.inTime ?? null, bloodPressure: "124/76", heartRate: 84, respiration: 18, spo2: 99 },
        { time: input.outTime ?? null, bloodPressure: "118/72", heartRate: 78, respiration: 17, spo2: 99 }
      ],
      airwayStatus: input.airwayStatus ?? "拔管后自主呼吸平稳",
      destination: input.destination ?? "普通外科病区",
      note: input.note ?? "达到离室标准，交接返回病区继续观察。"
    }),
    (item) => item.journeyId === journey.journeyId
  );
}

function ensureVitalSignRecord(state, journey, input) {
  state.vitalSignRecords ??= [];
  return upsertByJourney(
    state.vitalSignRecords,
    "vitalSignId",
    (existingId) => ({
      vitalSignId: existingId ?? buildId("VSR", state.counters),
      journeyId: journey.journeyId,
      patientId: journey.patientId,
      encounterId: journey.encounterId,
      recordType: input.recordType,
      recordTime: input.recordTime ?? null,
      source: input.source ?? "NursingStation",
      temperature: input.temperature ?? "36.6",
      pulse: input.pulse ?? 78,
      respiration: input.respiration ?? 18,
      bloodPressure: input.bloodPressure ?? "126/78",
      spo2: input.spo2 ?? 98,
      painScore: input.painScore ?? 0,
      consciousness: input.consciousness ?? "清楚",
      note: input.note ?? ""
    }),
    (item) => item.journeyId === journey.journeyId && item.recordType === input.recordType
  );
}

function ensureMedicationAdministration(state, journey, input) {
  state.medicationAdministrations ??= [];
  return upsertByJourney(
    state.medicationAdministrations,
    "administrationId",
    (existingId) => ({
      administrationId: existingId ?? buildId("MAR", state.counters),
      journeyId: journey.journeyId,
      patientId: journey.patientId,
      encounterId: journey.encounterId,
      dispenseId: input.dispenseId ?? null,
      medicationCode: input.medicationCode,
      medicationName: input.medicationName,
      dose: input.dose,
      route: input.route,
      scheduledTime: input.scheduledTime ?? null,
      administeredTime: input.administeredTime ?? null,
      status: input.status ?? "Administered",
      nurseId: input.nurseId ?? "PRA004",
      checkResult: input.checkResult ?? "身份、药品、剂量、途径、时间核对一致",
      adverseReaction: input.adverseReaction ?? "未见"
    }),
    (item) => item.journeyId === journey.journeyId && item.medicationCode === input.medicationCode && item.scheduledTime === (input.scheduledTime ?? null)
  );
}

function ensurePreopPreparation(state, journey, input) {
  state.preopPreparations ??= [];
  return upsertByJourney(
    state.preopPreparations,
    "preparationId",
    (existingId) => ({
      preparationId: existingId ?? buildId("PREP", state.counters),
      journeyId: journey.journeyId,
      patientId: journey.patientId,
      encounterId: journey.encounterId,
      surgeryScheduleId: journey.surgeryScheduleId,
      status: input.status ?? "Completed",
      preparationTime: input.preparationTime ?? null,
      siteMarkingTime: input.siteMarkingTime ?? null,
      fastingConfirmed: input.fastingConfirmed ?? true,
      skinCondition: input.skinCondition ?? "手术区域皮肤完整，无破损、红肿",
      oralProsthesisRemoved: input.oralProsthesisRemoved ?? true,
      jewelryRemoved: input.jewelryRemoved ?? true,
      checkItems: input.checkItems ?? [
        { itemName: "禁食禁饮", result: "已确认" },
        { itemName: "手术部位标识", result: "已完成" },
        { itemName: "皮肤准备", result: "已完成" },
        { itemName: "腕带与过敏史", result: "已核对" },
        { itemName: "随身物品", result: "义齿、首饰、贵重物品已交家属" }
      ]
    }),
    (item) => item.journeyId === journey.journeyId
  );
}

function ensureWardRound(state, journey, input) {
  state.wardRounds ??= [];
  return upsertByJourney(
    state.wardRounds,
    "wardRoundId",
    (existingId) => ({
      wardRoundId: existingId ?? buildId("WRD", state.counters),
      journeyId: journey.journeyId,
      patientId: journey.patientId,
      encounterId: journey.encounterId,
      roundType: input.roundType,
      roundTime: input.roundTime ?? null,
      physicianId: input.physicianId ?? "PRA001",
      status: input.status ?? "Completed",
      subjective: input.subjective ?? "",
      objective: input.objective ?? "",
      assessment: input.assessment ?? "",
      plan: input.plan ?? ""
    }),
    (item) => item.journeyId === journey.journeyId && item.roundType === input.roundType
  );
}

function ensureDischargeAssessment(state, journey, input) {
  state.dischargeAssessments ??= [];
  return upsertByJourney(
    state.dischargeAssessments,
    "dischargeAssessmentId",
    (existingId) => ({
      dischargeAssessmentId: existingId ?? buildId("DRA", state.counters),
      journeyId: journey.journeyId,
      patientId: journey.patientId,
      encounterId: journey.encounterId,
      assessedTime: input.assessedTime ?? null,
      status: input.status ?? "Ready",
      readinessScore: input.readinessScore ?? 95,
      assessorId: input.assessorId ?? "PRA004",
      criteria: input.criteria ?? [
        { itemName: "体温", result: "无发热" },
        { itemName: "疼痛", result: "疼痛评分 0-2 分，可耐受" },
        { itemName: "饮食", result: "可进半流质/软食，无明显恶心呕吐" },
        { itemName: "活动", result: "可下床活动" },
        { itemName: "切口", result: "敷料干燥，无渗血渗液" },
        { itemName: "宣教", result: "患者及家属理解用药、复诊和异常情况处理" }
      ],
      note: input.note ?? "符合出院评估标准，可办理出院。"
    }),
    (item) => item.journeyId === journey.journeyId
  );
}

function ensureLabSpecimenTrack(state, journey, labReport, input = {}) {
  state.labSpecimenTracks ??= [];
  return upsertByJourney(
    state.labSpecimenTracks,
    "trackId",
    (existingId) => ({
      trackId: existingId ?? buildId("LST", state.counters),
      journeyId: journey.journeyId,
      patientId: journey.patientId,
      encounterId: journey.encounterId,
      labReportId: labReport.labReportId,
      orderId: labReport.orderId,
      barcode: input.barcode ?? labReport.sampleNo ?? `LABBC${labReport.labReportId.slice(4).padStart(8, "0")}`,
      specimenType: labReport.specimenType ?? "血液",
      status: input.status ?? "Accepted",
      collectedTime: input.collectedTime ?? labReport.sampleTime ?? null,
      deliveredTime: input.deliveredTime ?? null,
      receivedTime: input.receivedTime ?? null,
      acceptedTime: input.acceptedTime ?? null,
      collectorId: input.collectorId ?? "PRA004",
      receiverId: input.receiverId ?? "PRA006",
      nodes: input.nodes ?? [
        { nodeName: "护士站采集", time: input.collectedTime ?? labReport.sampleTime ?? null, operatorId: "PRA004", result: "已采集" },
        { nodeName: "物流交接", time: input.deliveredTime ?? null, operatorId: "SYS-LIS", result: "冷链转运" },
        { nodeName: "检验科接收", time: input.receivedTime ?? null, operatorId: "PRA006", result: "标本合格" },
        { nodeName: "上机检测", time: input.acceptedTime ?? null, operatorId: "PRA006", result: "已上机" }
      ],
      rejectionReason: input.rejectionReason ?? null
    }),
    (item) => item.journeyId === journey.journeyId && item.labReportId === labReport.labReportId
  );
}

function ensureInfusionRecord(state, journey, input) {
  state.infusionRecords ??= [];
  return upsertByJourney(
    state.infusionRecords,
    "infusionId",
    (existingId) => ({
      infusionId: existingId ?? buildId("INF", state.counters),
      journeyId: journey.journeyId,
      patientId: journey.patientId,
      encounterId: journey.encounterId,
      orderId: input.orderId ?? null,
      infusionName: input.infusionName,
      medicationCode: input.medicationCode ?? null,
      volume: input.volume ?? "500ml",
      route: input.route ?? "静脉滴注",
      rate: input.rate ?? "60滴/分",
      startTime: input.startTime ?? null,
      endTime: input.endTime ?? null,
      status: input.status ?? "Completed",
      nurseId: input.nurseId ?? "PRA004",
      punctureSite: input.punctureSite ?? "左前臂静脉留置针",
      fluidBalance: input.fluidBalance ?? null,
      adverseReaction: input.adverseReaction ?? "未见"
    }),
    (item) => item.journeyId === journey.journeyId && item.infusionName === input.infusionName
  );
}

function ensurePainAssessment(state, journey, input) {
  state.painAssessments ??= [];
  return upsertByJourney(
    state.painAssessments,
    "painAssessmentId",
    (existingId) => ({
      painAssessmentId: existingId ?? buildId("PAIN", state.counters),
      journeyId: journey.journeyId,
      patientId: journey.patientId,
      encounterId: journey.encounterId,
      phase: input.phase,
      assessmentTime: input.assessmentTime ?? null,
      score: input.score ?? 2,
      painSite: input.painSite ?? "腹部切口",
      painNature: input.painNature ?? "轻度牵拉痛",
      intervention: input.intervention ?? "体位调整、解释安慰，必要时按医嘱镇痛",
      reassessmentTime: input.reassessmentTime ?? null,
      reassessmentScore: input.reassessmentScore ?? input.score ?? 2,
      nurseId: input.nurseId ?? "PRA004",
      status: input.status ?? "Closed"
    }),
    (item) => item.journeyId === journey.journeyId && item.phase === input.phase
  );
}

function ensureWoundCareRecord(state, journey, input) {
  state.woundCareRecords ??= [];
  return upsertByJourney(
    state.woundCareRecords,
    "woundCareId",
    (existingId) => ({
      woundCareId: existingId ?? buildId("WND", state.counters),
      journeyId: journey.journeyId,
      patientId: journey.patientId,
      encounterId: journey.encounterId,
      careTime: input.careTime ?? null,
      woundSite: input.woundSite ?? "脐部、剑突下及右上腹穿刺孔",
      dressingStatus: input.dressingStatus ?? "敷料干燥",
      woundCondition: input.woundCondition ?? "切口对合良好，无红肿渗液",
      careMethod: input.careMethod ?? "碘伏消毒后更换无菌敷料",
      infectionSigns: input.infectionSigns ?? "无",
      nurseId: input.nurseId ?? "PRA004",
      painScore: input.painScore ?? 1,
      nextCarePlan: input.nextCarePlan ?? "保持切口干燥，出院后按宣教观察"
    }),
    (item) => item.journeyId === journey.journeyId
  );
}

function ensureMedicalRecordHomePage(state, journey, input) {
  state.medicalRecordHomePages ??= [];
  const admission = state.admissions.find((item) => item.encounterId === journey.encounterId);
  const billingItems = (state.billingItems ?? []).filter((item) => item.journeyId === journey.journeyId);
  const totalAmount = input.totalAmount ?? billingItems.reduce((sum, item) => sum + Number(item.amount || 0), 0);
  const lengthOfStayDays = input.lengthOfStayDays ?? (
    admission?.admissionTime
      ? Math.max(1, Math.ceil((new Date(input.dischargeTime ?? nowIso()).getTime() - new Date(admission.admissionTime).getTime()) / 86_400_000))
      : 3
  );
  return upsertByJourney(
    state.medicalRecordHomePages,
    "homePageId",
    (existingId) => ({
      homePageId: existingId ?? buildId("MHP", state.counters),
      journeyId: journey.journeyId,
      patientId: journey.patientId,
      encounterId: journey.encounterId,
      status: input.status ?? "Coded",
      completedTime: input.completedTime ?? null,
      coderId: input.coderId ?? "CODER001",
      mainDiagnosisCode: input.mainDiagnosisCode ?? "K80.200",
      mainDiagnosisName: input.mainDiagnosisName ?? "胆囊结石伴慢性胆囊炎",
      mainProcedureCode: input.mainProcedureCode ?? "51.2301",
      mainProcedureName: input.mainProcedureName ?? "腹腔镜胆囊切除术",
      lengthOfStayDays,
      dischargeDisposition: input.dischargeDisposition ?? "医嘱离院",
      drgCode: input.drgCode ?? "HB15",
      drgName: input.drgName ?? "胆囊切除不伴严重并发症",
      totalAmount,
      coderNote: input.coderNote ?? "主要诊断、主要手术与出院诊断一致，病案首页编码完成。"
    }),
    (item) => item.journeyId === journey.journeyId
  );
}

function ensureRecordQualityCheck(state, journey, input) {
  state.recordQualityChecks ??= [];
  return upsertByJourney(
    state.recordQualityChecks,
    "qualityCheckId",
    (existingId) => ({
      qualityCheckId: existingId ?? buildId("QCK", state.counters),
      journeyId: journey.journeyId,
      patientId: journey.patientId,
      encounterId: journey.encounterId,
      checkTime: input.checkTime ?? null,
      checkerId: input.checkerId ?? "MRQ001",
      status: input.status ?? "Passed",
      score: input.score ?? 96,
      level: input.level ?? "甲级病案",
      defects: input.defects ?? [
        { itemName: "入院记录", result: "完整" },
        { itemName: "手术记录", result: "已签署" },
        { itemName: "麻醉记录", result: "完整" },
        { itemName: "病理报告", result: "已回报" },
        { itemName: "出院小结", result: "完整" }
      ],
      note: input.note ?? "病案首页、手术记录、麻醉记录、病理摘要、出院小结均已归档。"
    }),
    (item) => item.journeyId === journey.journeyId
  );
}

function profileImagingSummary(profile) {
  if (isCholecystectomyProfile(profile)) {
    return "腹部超声、上腹部 CT 及检验结果";
  }
  if (profile.breastCancerCase) {
    return "乳腺超声、钼靶/MRI、病理及免疫组化资料";
  }
  return `${profile.ultrasoundName ?? profile.examName ?? profile.bodyPart + "影像检查"}、PACS 影像及检验结果`;
}

function remoteConsultationDefaultsForProfile(profile) {
  if (isCholecystectomyProfile(profile)) {
    return {
      requesterDeptId: "D004",
      invitedDeptId: "D008",
      reason: "胆囊结石术前影像和围手术期风险远程讨论",
      conclusion: "结合腹部超声、CT 及检验结果，胆囊结石伴慢性胆囊炎诊断明确，无明显胆总管扩张，建议按期行腹腔镜胆囊切除术。",
      participants: [
        { practitionerId: profile.attendingDoctorId ?? "PRA001", role: "申请医师" },
        { practitionerId: "PRA006", role: "影像/医技会诊" },
        { practitionerId: "PRA003", role: "麻醉评估" }
      ],
      sharedData: ["患者摘要", "检验报告", "腹部超声", "PACS影像", "术前风险评估"]
    };
  }

  if (profile.breastCancerCase) {
    const staging = [profile.tnmStage, profile.molecularSubtype].filter(Boolean).join("；");
    return {
      requesterDeptId: profile.deptId ?? "D012",
      invitedDeptId: "D011",
      reason: `${profile.diagnosisName}分期、病理及综合治疗远程讨论`,
      conclusion: `结合${profileImagingSummary(profile)}，考虑${profile.diagnosisName}，${staging ? `${staging}；` : ""}建议按${profile.procedureName}及乳腺 MDT 意见完善围诊疗期管理。`,
      participants: [
        { practitionerId: profile.attendingDoctorId ?? "PRA007", role: "申请医师" },
        { practitionerId: "PRA008", role: "肿瘤内科会诊" },
        { practitionerId: "PRA012", role: "病理复核" }
      ],
      sharedData: ["患者摘要", "乳腺影像资料", "病理及免疫组化", "TNM分期", "MDT讨论资料"]
    };
  }

  return {
    requesterDeptId: profile.deptId ?? "D004",
    invitedDeptId: "D008",
    reason: `${profile.diagnosisName}诊疗方案与围诊疗期风险远程讨论`,
    conclusion: `结合${profileImagingSummary(profile)}，${profile.diagnosisName}诊疗依据充分，病变部位为${profile.bodyPart}，建议按${profile.procedureName}路径完善治疗和风险评估。`,
    participants: [
      { practitionerId: profile.attendingDoctorId ?? "PRA001", role: "申请医师" },
      { practitionerId: "PRA006", role: "影像/医技会诊" },
      { practitionerId: "PRA003", role: "麻醉或专科风险评估" }
    ],
    sharedData: ["患者摘要", "检验报告", `${profile.bodyPart}影像资料`, "PACS影像", "风险评估"]
  };
}

function familyNotificationContentForProfile(profile, phase) {
  if (phase === "接台通知") {
    return `患者拟行${profile.procedureName}，已进入手术接台流程，请家属在手术等候区关注进度提示。`;
  }
  if (phase === "手术开始") {
    return `患者${profile.procedureName}已开始，手术部将持续同步关键进度。`;
  }
  if (phase === "手术结束") {
    return `患者${profile.procedureName}已结束，生命体征平稳，正在进行术后复苏观察。`;
  }
  return `患者${profile.diagnosisName}相关诊疗流程已更新，请家属关注等候区提示。`;
}

function surgeryMediaPlanForProfile(profile, journey) {
  const slug = (profile.procedureCode ?? profile.diagnosisCode ?? "procedure").replace(/[^A-Za-z0-9]/g, "").toLowerCase();
  if (isCholecystectomyProfile(profile)) {
    return {
      recordingUrl: `/recordings/${journey.journeyId}/lap-chole-${journey.journeyId}.mp4`,
      liveClips: [
        { clipName: "入路建立", startOffsetSeconds: 0, privacy: "脱敏" },
        { clipName: "胆囊三角解剖", startOffsetSeconds: 900, privacy: "脱敏" }
      ],
      archivedClips: [
        { clipName: "入路建立", startOffsetSeconds: 0, durationSeconds: 420, privacy: "脱敏" },
        { clipName: "胆囊三角解剖", startOffsetSeconds: 900, durationSeconds: 780, privacy: "脱敏" },
        { clipName: "胆囊床处理", startOffsetSeconds: 1740, durationSeconds: 600, privacy: "脱敏" }
      ]
    };
  }
  if (profile.breastCancerCase) {
    return {
      recordingUrl: `/recordings/${journey.journeyId}/breast-${slug}-${journey.journeyId}.mp4`,
      liveClips: [
        { clipName: "乳腺影像定位核对", startOffsetSeconds: 0, privacy: "脱敏" },
        { clipName: "病灶切除与切缘标记", startOffsetSeconds: 900, privacy: "脱敏" }
      ],
      archivedClips: [
        { clipName: "乳腺影像定位核对", startOffsetSeconds: 0, durationSeconds: 420, privacy: "脱敏" },
        { clipName: "病灶切除与切缘标记", startOffsetSeconds: 900, durationSeconds: 900, privacy: "脱敏" },
        { clipName: "标本方向交接", startOffsetSeconds: 1860, durationSeconds: 480, privacy: "脱敏" }
      ]
    };
  }
  return {
    recordingUrl: `/recordings/${journey.journeyId}/${slug}-${journey.journeyId}.mp4`,
    liveClips: [
      { clipName: `${profile.bodyPart}术前核对`, startOffsetSeconds: 0, privacy: "脱敏" },
      { clipName: `${profile.procedureName}关键步骤`, startOffsetSeconds: 900, privacy: "脱敏" }
    ],
    archivedClips: [
      { clipName: `${profile.bodyPart}术前核对`, startOffsetSeconds: 0, durationSeconds: 420, privacy: "脱敏" },
      { clipName: `${profile.procedureName}关键步骤`, startOffsetSeconds: 900, durationSeconds: 900, privacy: "脱敏" },
      { clipName: "标本或资料交接", startOffsetSeconds: 1860, durationSeconds: 420, privacy: "脱敏" }
    ]
  };
}

function postoperativeHandoverItemsForProfile(profile) {
  if (isCholecystectomyProfile(profile)) {
    return [
      { itemName: "身份腕带", result: "一致" },
      { itemName: "手术及麻醉", result: "腹腔镜胆囊切除术后，全麻复苏平稳" },
      { itemName: "腹部穿刺孔", result: "敷料干燥固定，无明显渗血渗液" },
      { itemName: "用药与镇痛", result: "短程护胃、按需镇痛/止吐备用，无常规术后抗菌药疗程" },
      { itemName: "风险提示", result: "观察腹痛、发热、黄疸、胆漏、跌倒和 VTE 风险" }
    ];
  }
  if (profile.breastCancerCase) {
    return [
      { itemName: "身份腕带", result: "一致" },
      { itemName: "手术及麻醉", result: `${profile.procedureName}后，${profile.anesthesiaMethod}复苏平稳` },
      { itemName: "乳腺/腋窝切口", result: "敷料干燥固定，引流管或切缘标记交接清楚" },
      { itemName: "病理与治疗衔接", result: "标本方向、淋巴结标本和免疫组化项目已交接" },
      { itemName: "风险提示", result: "观察出血、皮下积液、上肢水肿、疼痛和 VTE 风险" }
    ];
  }
  return [
    { itemName: "身份腕带", result: "一致" },
    { itemName: "诊疗及麻醉", result: `${profile.procedureName}后，${profile.anesthesiaMethod}复苏平稳` },
    { itemName: "病变部位", result: `${profile.bodyPart}相关切口、穿刺点或操作部位已完成交接` },
    { itemName: "用药与镇痛", result: "术后用药、镇痛方案和禁忌事项已交接" },
    { itemName: "风险提示", result: "观察出血、感染、疼痛、跌倒和 VTE 风险" }
  ];
}

function surgicalSafetyItemsForProfile(profile) {
  if (isCholecystectomyProfile(profile)) {
    return [
      { itemName: "患者身份", result: "已核对腕带、姓名、住院号" },
      { itemName: "手术部位与术式", result: "腹腔镜胆囊切除术，右上腹/胆囊部位确认" },
      { itemName: "过敏史与禁食", result: "过敏史已核对，禁食水符合全麻要求" },
      { itemName: "影像与知情同意", result: "腹部超声、上腹部 CT、手术/麻醉同意书齐全" },
      { itemName: "胆道关键风险", result: "关注胆总管走行、胆囊管/胆囊动脉辨认和中转开腹可能" },
      { itemName: "抗菌药物", result: "头孢唑林已在切皮前 30-60 分钟执行" }
    ];
  }
  return [
    { itemName: "患者身份", result: "已核对腕带、姓名、住院号" },
    { itemName: "手术部位与术式", result: `${profile.procedureName}，${profile.bodyPart}部位确认` },
    { itemName: "过敏史与禁食", result: "过敏史已核对，禁食水符合麻醉及操作要求" },
    { itemName: "影像与知情同意", result: `${profileImagingSummary(profile)}、知情同意书齐全` },
    { itemName: "专科风险", result: `${profile.diagnosisName}相关风险已完成术前讨论` },
    { itemName: "用药核查", result: "围诊疗期用药已完成审核" }
  ];
}

function consumableItemsForProfile(profile, journey) {
  if (isCholecystectomyProfile(profile)) {
    return [
      { itemCode: "LC-TROCAR-10", itemName: "一次性 10mm Trocar", quantity: 2, lotNo: "LOT260516A", barcode: `TRC${journey.journeyId.slice(3).padStart(6, "0")}01`, chargeAmount: 680 },
      { itemCode: "LC-TROCAR-5", itemName: "一次性 5mm Trocar", quantity: 2, lotNo: "LOT260516B", barcode: `TRC${journey.journeyId.slice(3).padStart(6, "0")}02`, chargeAmount: 520 },
      { itemCode: "TICLIP-M", itemName: "可吸收/钛夹", quantity: 4, lotNo: "CLP260516", barcode: `CLP${journey.journeyId.slice(3).padStart(6, "0")}`, chargeAmount: 360 },
      { itemCode: "BAG-001", itemName: "一次性标本取物袋", quantity: 1, lotNo: "BAG260516", barcode: `BAG${journey.journeyId.slice(3).padStart(6, "0")}`, chargeAmount: 180 }
    ];
  }
  if (profile.breastCancerCase) {
    return [
      { itemCode: "BREAST-MARK", itemName: "乳腺病灶定位标记耗材", quantity: 1, lotNo: "LOT260516C", barcode: `BRS${journey.journeyId.slice(3).padStart(6, "0")}01`, chargeAmount: 860 },
      { itemCode: "DRAIN-NP", itemName: "一次性负压引流装置", quantity: 1, lotNo: "LOT260516D", barcode: `DRN${journey.journeyId.slice(3).padStart(6, "0")}01`, chargeAmount: 420 },
      { itemCode: "SUTURE-ABS", itemName: "可吸收缝合线", quantity: 2, lotNo: "SUT260516", barcode: `SUT${journey.journeyId.slice(3).padStart(6, "0")}`, chargeAmount: 260 }
    ];
  }
  return [
    { itemCode: "OR-PACK", itemName: "一次性手术包", quantity: 1, lotNo: "LOT260516E", barcode: `OPK${journey.journeyId.slice(3).padStart(6, "0")}01`, chargeAmount: 380 },
    { itemCode: "DRESSING", itemName: "无菌敷料包", quantity: 1, lotNo: "LOT260516F", barcode: `DRS${journey.journeyId.slice(3).padStart(6, "0")}01`, chargeAmount: 120 },
    { itemCode: "SUTURE-GEN", itemName: "通用缝合线", quantity: 2, lotNo: "SUG260516", barcode: `SUG${journey.journeyId.slice(3).padStart(6, "0")}`, chargeAmount: 180 }
  ];
}

function ensureRemoteConsultation(state, journey, input = {}) {
  const profile = diseaseProfileForJourney(state, journey);
  const defaults = remoteConsultationDefaultsForProfile(profile);
  state.consultations ??= [];
  return upsertByJourney(
    state.consultations,
    "consultationId",
    (existingId) => ({
      consultationId: existingId ?? buildId("CON", state.counters),
      journeyId: journey.journeyId,
      patientId: journey.patientId,
      encounterId: journey.encounterId,
      surgeryScheduleId: journey.surgeryScheduleId,
      consultationType: input.consultationType ?? "远程",
      requesterDeptId: input.requesterDeptId ?? defaults.requesterDeptId,
      invitedDeptId: input.invitedDeptId ?? defaults.invitedDeptId,
      reason: input.reason ?? defaults.reason,
      status: input.status ?? "已完成",
      scheduledTime: input.scheduledTime ?? null,
      startedTime: input.startedTime ?? null,
      completedTime: input.completedTime ?? null,
      conclusion: input.conclusion ?? defaults.conclusion,
      participants: input.participants ?? defaults.participants,
      sharedData: input.sharedData ?? defaults.sharedData
    }),
    (item) => item.journeyId === journey.journeyId && item.consultationType === (input.consultationType ?? "远程")
  );
}

function ensureFamilyNotification(state, journey, input) {
  const profile = diseaseProfileForJourney(state, journey);
  state.familyNotifications ??= [];
  return upsertByJourney(
    state.familyNotifications,
    "notificationId",
    (existingId) => ({
      notificationId: existingId ?? buildId("FAM", state.counters),
      journeyId: journey.journeyId,
      patientId: journey.patientId,
      encounterId: journey.encounterId,
      surgeryScheduleId: journey.surgeryScheduleId,
      phase: input.phase,
      notifyTime: input.notifyTime ?? null,
      recipientName: input.recipientName ?? "患者家属",
      recipientPhone: input.recipientPhone ?? "138****0000",
      channel: input.channel ?? "等候区大屏/短信",
      status: input.status ?? "Delivered",
      templateCode: input.templateCode ?? "SURGERY_STATUS",
      content: input.content ?? familyNotificationContentForProfile(profile, input.phase),
      operatorId: input.operatorId ?? "SYS-FAMILY"
    }),
    (item) => item.journeyId === journey.journeyId && item.phase === input.phase
  );
}

function ensureAntimicrobialReview(state, journey, input) {
  const profile = diseaseProfileForJourney(state, journey);
  state.antimicrobialReviews ??= [];
  return upsertByJourney(
    state.antimicrobialReviews,
    "reviewId",
    (existingId) => ({
      reviewId: existingId ?? buildId("ABX", state.counters),
      journeyId: journey.journeyId,
      patientId: journey.patientId,
      encounterId: journey.encounterId,
      medicationCode: input.medicationCode ?? "CEFAZOLIN",
      medicationName: input.medicationName ?? "头孢唑林钠",
      indication: input.indication ?? (isCholecystectomyProfile(profile) ? "腹腔镜胆囊切除术围术期预防用药" : `${profile.procedureName}围诊疗期用药审核`),
      reviewTime: input.reviewTime ?? null,
      reviewerId: input.reviewerId ?? "PHA001",
      status: input.status ?? "Approved",
      prophylaxisWindow: input.prophylaxisWindow ?? "切皮前 30 分钟内给药",
      durationRecommendation: input.durationRecommendation ?? "术后无感染证据时 24 小时内停用",
      allergyCheck: input.allergyCheck ?? "已核对过敏史",
      recommendation: input.recommendation ?? "用药适宜，注意术后及时停药并观察过敏反应。"
    }),
    (item) => item.journeyId === journey.journeyId && item.medicationCode === (input.medicationCode ?? "CEFAZOLIN")
  );
}

function ensureOrConsumableUsage(state, journey, input) {
  const profile = diseaseProfileForJourney(state, journey);
  state.orConsumableUsages ??= [];
  return upsertByJourney(
    state.orConsumableUsages,
    "usageId",
    (existingId) => ({
      usageId: existingId ?? buildId("OCU", state.counters),
      journeyId: journey.journeyId,
      patientId: journey.patientId,
      encounterId: journey.encounterId,
      surgeryScheduleId: journey.surgeryScheduleId,
      status: input.status ?? "Verified",
      usageTime: input.usageTime ?? null,
      verifiedBy: input.verifiedBy ?? "PRA004",
      charged: input.charged ?? true,
      items: input.items ?? consumableItemsForProfile(profile, journey),
      traceNote: input.traceNote ?? "耗材条码已与患者、手术排班、器械清点记录关联。"
    }),
    (item) => item.journeyId === journey.journeyId
  );
}

function ensureSurgeryMediaRecord(state, journey, input) {
  const profile = diseaseProfileForJourney(state, journey);
  const mediaPlan = surgeryMediaPlanForProfile(profile, journey);
  state.surgeryMediaRecords ??= [];
  const schedule = journey.surgeryScheduleId ? findById(state.surgerySchedules, "surgeryScheduleId", journey.surgeryScheduleId) : null;
  const room = schedule ? findById(state.operatingRooms, "roomId", schedule.roomId) : null;
  return upsertByJourney(
    state.surgeryMediaRecords,
    "mediaRecordId",
    (existingId) => ({
      mediaRecordId: existingId ?? buildId("SMR", state.counters),
      journeyId: journey.journeyId,
      patientId: journey.patientId,
      encounterId: journey.encounterId,
      surgeryScheduleId: journey.surgeryScheduleId,
      roomId: room?.roomId ?? null,
      sourceCode: input.sourceCode ?? room?.videoSourceCode ?? "CAM-OR01",
      status: input.status ?? "Recording",
      startTime: input.startTime ?? null,
      endTime: input.endTime ?? null,
      recordingUrl: input.recordingUrl ?? null,
      clips: input.clips ?? mediaPlan.liveClips,
      accessLevel: input.accessLevel ?? "院内示教脱敏",
      archiveStatus: input.archiveStatus ?? "Pending",
      note: input.note ?? `与${profile.procedureName}示教、数字化手术室视频源联动。`
    }),
    (item) => item.journeyId === journey.journeyId
  );
}

function ensureTeachingSessionForJourney(state, journey, input) {
  const profile = diseaseProfileForJourney(state, journey);
  state.teachingSessions ??= [];
  const schedule = journey.surgeryScheduleId ? findById(state.surgerySchedules, "surgeryScheduleId", journey.surgeryScheduleId) : null;
  const room = schedule ? findById(state.operatingRooms, "roomId", schedule.roomId) : null;
  return upsertByJourney(
    state.teachingSessions,
    "teachingSessionId",
    (existingId) => ({
      teachingSessionId: existingId ?? buildId("TEA", state.counters),
      journeyId: journey.journeyId,
      patientId: journey.patientId,
      encounterId: journey.encounterId,
      surgeryScheduleId: journey.surgeryScheduleId,
      title: input.title ?? `${profile.procedureName}示教`,
      teacherId: input.teacherId ?? profile.attendingDoctorId ?? "PRA001",
      status: input.status ?? "直播中",
      startTime: input.startTime ?? null,
      endTime: input.endTime ?? null,
      streamCode: input.streamCode ?? room?.videoSourceCode ?? "CAM-OR01",
      recordingUrl: input.recordingUrl ?? null,
      audience: input.audience ?? ["手术示教室", "远程会诊端", "住培学员"],
      privacyMode: input.privacyMode ?? "患者身份脱敏"
    }),
    (item) => item.journeyId === journey.journeyId
  );
}

function ensureDietaryPlan(state, journey, input) {
  state.dietaryPlans ??= [];
  return upsertByJourney(
    state.dietaryPlans,
    "dietaryPlanId",
    (existingId) => ({
      dietaryPlanId: existingId ?? buildId("DIET", state.counters),
      journeyId: journey.journeyId,
      patientId: journey.patientId,
      encounterId: journey.encounterId,
      phase: input.phase,
      status: input.status ?? "Active",
      assessmentTime: input.assessmentTime ?? null,
      dietOrder: input.dietOrder,
      nutritionRiskScore: input.nutritionRiskScore ?? 1,
      swallowRisk: input.swallowRisk ?? "无",
      intakeTarget: input.intakeTarget ?? "少量多餐，低脂清淡",
      restrictions: input.restrictions ?? ["避免油腻", "避免暴饮暴食"],
      education: input.education ?? "已向患者及家属完成低脂饮食和术后逐步进食宣教。",
      dietitianId: input.dietitianId ?? "NUT001",
      note: input.note ?? ""
    }),
    (item) => item.journeyId === journey.journeyId && item.phase === input.phase
  );
}

function ensureMobilityRehabRecord(state, journey, input) {
  state.mobilityRehabRecords ??= [];
  return upsertByJourney(
    state.mobilityRehabRecords,
    "mobilityRecordId",
    (existingId) => ({
      mobilityRecordId: existingId ?? buildId("MOB", state.counters),
      journeyId: journey.journeyId,
      patientId: journey.patientId,
      encounterId: journey.encounterId,
      recordTime: input.recordTime ?? null,
      activityLevel: input.activityLevel ?? "床旁站立并病区步行",
      distanceMeters: input.distanceMeters ?? 80,
      assistanceLevel: input.assistanceLevel ?? "一人陪同",
      tolerance: input.tolerance ?? "可耐受，无头晕心慌",
      fallRiskScore: input.fallRiskScore ?? 2,
      nurseId: input.nurseId ?? "PRA004",
      plan: input.plan ?? "继续鼓励早期下床活动，每日 3 次，循序增加步行距离。"
    }),
    (item) => item.journeyId === journey.journeyId
  );
}

function ensureVteProphylaxisRecord(state, journey, input) {
  state.vteProphylaxisRecords ??= [];
  return upsertByJourney(
    state.vteProphylaxisRecords,
    "vteRecordId",
    (existingId) => ({
      vteRecordId: existingId ?? buildId("VTE", state.counters),
      journeyId: journey.journeyId,
      patientId: journey.patientId,
      encounterId: journey.encounterId,
      assessmentTime: input.assessmentTime ?? null,
      capriniScore: input.capriniScore ?? 3,
      riskLevel: input.riskLevel ?? "中危",
      prophylaxisType: input.prophylaxisType ?? "早期下床活动+踝泵运动+必要时弹力袜",
      mechanicalDevice: input.mechanicalDevice ?? "间歇充气压力泵备用",
      anticoagulant: input.anticoagulant ?? "未常规使用，按出血风险动态评估",
      status: input.status ?? "InProgress",
      nurseId: input.nurseId ?? "PRA004",
      physicianId: input.physicianId ?? "PRA001",
      note: input.note ?? "已宣教下肢活动和血栓风险，观察下肢肿胀疼痛。"
    }),
    (item) => item.journeyId === journey.journeyId
  );
}

function ensureNursingHandover(state, journey, input) {
  const profile = diseaseProfileForJourney(state, journey);
  state.nursingHandovers ??= [];
  return upsertByJourney(
    state.nursingHandovers,
    "handoverId",
    (existingId) => ({
      handoverId: existingId ?? buildId("HOV", state.counters),
      journeyId: journey.journeyId,
      patientId: journey.patientId,
      encounterId: journey.encounterId,
      surgeryScheduleId: journey.surgeryScheduleId,
      handoverType: input.handoverType,
      handoverTime: input.handoverTime ?? null,
      fromDeptId: input.fromDeptId ?? "D002",
      toDeptId: input.toDeptId ?? "D004",
      fromNurseId: input.fromNurseId ?? "PRA004",
      toNurseId: input.toNurseId ?? "PRA005",
      status: input.status ?? "Completed",
      items: input.items ?? postoperativeHandoverItemsForProfile(profile),
      note: input.note ?? ""
    }),
    (item) => item.journeyId === journey.journeyId && item.handoverType === input.handoverType
  );
}

function ensurePostopObservationRecord(state, journey, input) {
  state.postopObservationRecords ??= [];
  return upsertByJourney(
    state.postopObservationRecords,
    "observationId",
    (existingId) => ({
      observationId: existingId ?? buildId("OBS", state.counters),
      journeyId: journey.journeyId,
      patientId: journey.patientId,
      encounterId: journey.encounterId,
      observationTime: input.observationTime ?? null,
      status: input.status ?? "Stable",
      nauseaVomiting: input.nauseaVomiting ?? "无明显恶心呕吐",
      fever: input.fever ?? "无发热",
      bleeding: input.bleeding ?? "切口敷料干燥，无渗血",
      jaundice: input.jaundice ?? "巩膜皮肤未见黄染",
      abdominalSigns: input.abdominalSigns ?? "腹软，轻度切口痛，无反跳痛",
      action: input.action ?? "继续观察生命体征、腹痛、发热和黄疸情况。",
      nurseId: input.nurseId ?? "PRA004"
    }),
    (item) => item.journeyId === journey.journeyId
  );
}

function createCriticalValueIfNeeded(state, journey, labReport, eventTime) {
  state.labCriticalValues ??= [];
  const potassium = labReport.items?.find((item) => item.code === "K");
  if (!potassium || Number(potassium.value) >= 3) {
    return null;
  }
  const existing = state.labCriticalValues.find((item) => item.labReportId === labReport.labReportId && item.itemCode === "K");
  if (existing) {
    existing.status = "Acknowledged";
    existing.acknowledgedTime = eventTime;
    return existing;
  }
  const critical = {
    criticalValueId: buildId("CRIT", state.counters),
    journeyId: journey.journeyId,
    patientId: journey.patientId,
    encounterId: journey.encounterId,
    labReportId: labReport.labReportId,
    itemCode: "K",
    itemName: "血钾",
    value: potassium.value,
    unit: potassium.unit,
    threshold: "<3.0 mmol/L",
    severity: "High",
    status: "Acknowledged",
    reportedTime: eventTime,
    acknowledgedTime: eventTime,
    handlerId: "PRA001",
    action: "已电话通知主管医师，复查电解质并给予补钾处理，择期手术前复评。"
  };
  state.labCriticalValues.push(critical);
  return critical;
}

function applyClinicalAction(state, journey, step, eventTime) {
  const context = {
    patientId: journey.patientId,
    encounterId: journey.encounterId,
    surgeryScheduleId: journey.surgeryScheduleId
  };

  if (step.linkedAction === "confirmAdmission") {
    const encounter = findById(state.encounters, "encounterId", journey.encounterId);
    const admission = state.admissions.find((item) => item.encounterId === journey.encounterId);
    const bed = admission ? findById(state.beds, "bedId", admission.bedId) : null;
    if (encounter) {
      encounter.status = "Admitted";
      encounter.endTime = null;
    }
    if (admission) {
      admission.dischargeTime = null;
    }
    if (bed) {
      bed.status = "Occupied";
      bed.currentEncounterId = journey.encounterId;
    }
    return { ...context, admissionId: admission?.admissionId, bedId: bed?.bedId };
  }

  if (step.linkedAction === "verifyInsuranceEligibility") {
    const patient = findById(state.patients, "patientId", journey.patientId);
    const isSelfPay = patient?.insuranceType === "自费";
    const eligibility = ensureInsuranceEligibilityRecord(state, journey, {
      verifiedTime: eventTime,
      insuranceType: patient?.insuranceType ?? "自费",
      payerCode: isSelfPay ? "SELF-PAY" : "320300-YB",
      payerName: isSelfPay ? "自费患者" : "徐州市医疗保障局",
      eligibilityStatus: isSelfPay ? "SelfPayConfirmed" : "Active",
      estimatedCoverageRatio: isSelfPay ? 0 : 0.82,
      note: isSelfPay ? "患者本次住院按自费结算，已完成身份核验。" : "医保电子凭证/身份证读取成功，参保状态有效。"
    });
    const task = ensureClinicalTask(state, journey, {
      taskType: "医保",
      taskName: "入院医保身份核验",
      status: "completed",
      ownerDeptId: "HIS",
      completedTime: eventTime,
      linkedObjectType: "InsuranceEligibility",
      linkedObjectId: eligibility.eligibilityId
    });
    return { ...context, eligibilityId: eligibility.eligibilityId, taskId: task.taskId };
  }

  if (step.linkedAction === "confirmDiagnosis") {
    const diagnosis = state.diagnoses.find((item) => item.encounterId === journey.encounterId && item.isPrimary);
    if (diagnosis) {
      diagnosis.recordedTime = eventTime;
    }
    return { ...context, diagnosisId: diagnosis?.diagnosisId };
  }

  if (step.linkedAction === "createAdmissionOrders") {
    const fluidOrder = ensureMedicationOrder(state, journey, {
      itemCode: "NS500",
      itemName: "0.9%氯化钠注射液 500ml",
      status: "已开立",
      requestedTime: eventTime
    });
    const nursingTask = ensureClinicalTask(state, journey, {
      taskType: "护理",
      taskName: "入院评估与术前禁食水宣教",
      status: "completed",
      ownerDeptId: "D004",
      completedTime: eventTime,
      linkedObjectType: "Admission",
      linkedObjectId: journey.encounterId
    });
    const record = createNursingRecord(state, journey, {
      recordType: "入院护理评估",
      recordTime: eventTime,
      content: "完成入院评估，宣教术前禁食水，测量生命体征。",
      vitalSigns: { temperature: "36.6", pulse: 78, respiration: 18, bloodPressure: "126/78" }
    });
    const registrationFee = addBillingItem(state, journey, {
      itemCode: "ZYDJ",
      itemName: "住院登记及床位预交金",
      category: "住院",
      unitPrice: 800,
      amount: 800,
      insuranceClass: "自费",
      selfPayRatio: 1,
      postedTime: eventTime
    });
    return { ...context, orderId: fluidOrder.orderId, taskId: nursingTask.taskId, nursingRecordId: record.nursingRecordId, billingItemId: registrationFee.billingItemId };
  }

  if (step.linkedAction === "collectAdmissionDeposit") {
    const patient = findById(state.patients, "patientId", journey.patientId);
    const amount = patient?.insuranceType === "自费" ? 5000 : 3000;
    const deposit = ensureDepositPaymentRecord(state, journey, {
      paymentTime: eventTime,
      amount,
      balanceAfter: amount,
      paymentMethod: patient?.insuranceType === "自费" ? "微信支付" : "医保电子凭证+微信支付",
      note: patient?.insuranceType === "自费" ? "自费住院预交金已到账。" : "医保身份核验后完成住院预交金支付。"
    });
    const task = ensureClinicalTask(state, journey, {
      taskType: "收费",
      taskName: "住院预交金收取",
      status: "completed",
      ownerDeptId: "HIS",
      completedTime: eventTime,
      linkedObjectType: "DepositPayment",
      linkedObjectId: deposit.depositId
    });
    return { ...context, depositId: deposit.depositId, taskId: task.taskId, amount: deposit.amount };
  }

  if (step.linkedAction === "completeAdmissionAssessment") {
    const vital = ensureVitalSignRecord(state, journey, {
      recordType: "入院首次生命体征",
      recordTime: eventTime,
      temperature: "36.6",
      pulse: 78,
      respiration: 18,
      bloodPressure: "126/78",
      spo2: 98,
      painScore: 3,
      note: "右上腹间断胀痛，生命体征平稳。"
    });
    const task = ensureClinicalTask(state, journey, {
      taskType: "护理",
      taskName: "完成入院生活能力、疼痛、营养和安全评估",
      status: "completed",
      ownerDeptId: "D004",
      completedTime: eventTime,
      linkedObjectType: "VitalSignRecord",
      linkedObjectId: vital.vitalSignId
    });
    const round = ensureWardRound(state, journey, {
      roundType: "入院首次查房",
      roundTime: addMinutes(eventTime, 20),
      subjective: "患者诉右上腹胀痛不适，进食油腻后加重，无寒战高热。",
      objective: "腹平软，右上腹轻压痛，Murphy 征可疑阳性。生命体征平稳。",
      assessment: "胆囊结石伴慢性胆囊炎，拟完善术前检查后择期手术。",
      plan: "完善血常规、凝血、肝肾功能、胆红素、血淀粉酶、心电图和腹部超声；必要时行上腹部 CT/PACS 补充评估，给予低脂饮食宣教和术前准备。"
    });
    const record = createNursingRecord(state, journey, {
      recordType: "入院综合评估",
      recordTime: eventTime,
      content: "完成疼痛、营养、跌倒、压疮和自理能力评估，已建立生命体征观察单。",
      vitalSigns: { temperature: "36.6", pulse: 78, respiration: 18, bloodPressure: "126/78", spo2: 98 },
      painScore: 3
    });
    return { ...context, vitalSignId: vital.vitalSignId, taskId: task.taskId, wardRoundId: round.wardRoundId, nursingRecordId: record.nursingRecordId };
  }

  if (step.linkedAction === "completeNutritionScreening") {
    const plan = ensureDietaryPlan(state, journey, {
      phase: "入院/术前",
      assessmentTime: eventTime,
      status: "Active",
      dietOrder: "低脂半流质/清淡饮食，术前按医嘱禁食禁饮",
      nutritionRiskScore: 1,
      note: "NRS2002 评分低风险，重点进行低脂饮食和术前禁食水宣教。"
    });
    const task = ensureClinicalTask(state, journey, {
      taskType: "营养",
      taskName: "胆囊结石低脂饮食宣教",
      status: "completed",
      ownerDeptId: "D004",
      completedTime: eventTime,
      linkedObjectType: "DietaryPlan",
      linkedObjectId: plan.dietaryPlanId
    });
    return { ...context, dietaryPlanId: plan.dietaryPlanId, taskId: task.taskId };
  }

  if (step.linkedAction === "executeAdmissionInfusion") {
    const order = ensureMedicationOrder(state, journey, {
      itemCode: "NS500",
      itemName: "0.9%氯化钠注射液 500ml",
      status: "已执行",
      requestedTime: eventTime
    });
    const infusion = ensureInfusionRecord(state, journey, {
      orderId: order.orderId,
      infusionName: "0.9%氯化钠注射液 500ml",
      medicationCode: "NS500",
      volume: "500ml",
      rate: "60滴/分",
      startTime: eventTime,
      endTime: addMinutes(eventTime, 120),
      status: "Completed",
      fluidBalance: { intake: "500ml", output: "未记录" }
    });
    const administration = ensureMedicationAdministration(state, journey, {
      dispenseId: null,
      medicationCode: "NS500",
      medicationName: "0.9%氯化钠注射液",
      dose: "500ml",
      route: "静脉滴注",
      scheduledTime: eventTime,
      administeredTime: eventTime,
      status: "Administered",
      checkResult: "补液医嘱、患者身份、液体名称和滴速核对一致"
    });
    const record = createNursingRecord(state, journey, {
      recordType: "入院补液执行",
      recordTime: eventTime,
      content: "遵医嘱建立静脉通路并执行 0.9%氯化钠补液，穿刺点固定良好，无输液反应。"
    });
    return { ...context, orderId: order.orderId, infusionId: infusion.infusionId, administrationId: administration.administrationId, nursingRecordId: record.nursingRecordId };
  }

  if (step.linkedAction === "confirmPreopOrders") {
    const orders = state.orders.filter((item) => item.encounterId === journey.encounterId);
    for (const order of orders) {
      if (["手术", "检查", "检验"].includes(order.orderType) || ["ORD000001", "ORD000002", "ORD000003"].includes(order.orderId)) {
        order.status = "已确认";
      }
    }
    ensureClinicalTask(state, journey, {
      taskType: "检验",
      taskName: "采集血常规、凝血、肝肾功能标本",
      status: "pending",
      ownerDeptId: "D009",
      dueTime: eventTime
    });
    ensureClinicalTask(state, journey, {
      taskType: "检查",
      taskName: "完成必要上腹部 CT/PACS 检查",
      status: "pending",
      ownerDeptId: "D008",
      dueTime: eventTime
    });
    ensureClinicalTask(state, journey, {
      taskType: "检查",
      taskName: "完成腹部彩超检查",
      status: "pending",
      ownerDeptId: "D015",
      dueTime: eventTime
    });
    ensureClinicalTask(state, journey, {
      taskType: "检查",
      taskName: "完成术前十二导联心电图",
      status: "pending",
      ownerDeptId: "D003",
      dueTime: eventTime
    });
    return { ...context, orderIds: orders.map((item) => item.orderId) };
  }

  if (step.linkedAction === "completeOrderReview") {
    const orders = state.orders.filter((item) => item.encounterId === journey.encounterId);
    const reviewedOrders = orders.filter((order) => ["手术", "检查", "检验", "用药"].includes(order.orderType));
    for (const order of reviewedOrders) {
      if (order.status === "已开立" || order.status === "已确认") {
        order.status = "已审核";
      }
    }
    const review = ensureOrderReviewRecord(state, journey, {
      reviewTime: eventTime,
      orderIds: reviewedOrders.map((item) => item.orderId),
      issues: []
    });
    const task = ensureClinicalTask(state, journey, {
      taskType: "医嘱",
      taskName: "术前医嘱护士站审核",
      status: "completed",
      ownerDeptId: "D004",
      completedTime: eventTime,
      linkedObjectType: "OrderReview",
      linkedObjectId: review.reviewId
    });
    const record = createNursingRecord(state, journey, {
      recordType: "术前医嘱审核",
      recordTime: eventTime,
      content: "完成术前检验、检查、手术、用药、禁食水和过敏史医嘱审核，未发现阻断性问题。"
    });
    return { ...context, reviewId: review.reviewId, taskId: task.taskId, nursingRecordId: record.nursingRecordId, orderIds: reviewedOrders.map((item) => item.orderId) };
  }

  if (step.linkedAction === "bookPreopExamAppointments") {
    const examOrders = state.orders.filter((item) => item.encounterId === journey.encounterId && item.orderType === "检查");
    const appointments = examOrders.map((order, index) => {
      const modality = order.itemCode.startsWith("CT")
        ? "CT"
        : order.itemCode.startsWith("US")
          ? "US"
          : order.itemCode.startsWith("MG")
            ? "MG"
            : order.itemCode.startsWith("MR")
              ? "MR"
              : order.itemCode.startsWith("DX")
                ? "DX"
                : "ECG";
      const scheduledTime = addMinutes(eventTime, 30 + index * 25);
      order.status = "已预约";
      order.scheduledTime = scheduledTime;
      return ensureExamAppointmentRecord(state, journey, {
        orderId: order.orderId,
        examType: order.itemCode,
        examName: order.itemName,
        modality,
        departmentId: modality === "US" ? "D015" : modality === "ECG" ? "D003" : "D008",
        scheduledTime,
        queueNo: `${modality}-${String(index + 1).padStart(3, "0")}`,
        status: "Booked",
        transportRequired: ["CT", "MR", "MG"].includes(modality),
        preparation: ["CT", "MR", "MG"].includes(modality)
          ? "检查前核对造影禁忌和肾功能，携带腕带、申请单和既往影像资料。"
          : "按预约时间到达检查科室，携带腕带和检查申请单。"
      });
    });
    const task = ensureClinicalTask(state, journey, {
      taskType: "检查预约",
      taskName: "术前超声、必要 CT 和心电预约登记",
      status: "completed",
      ownerDeptId: "D008",
      completedTime: eventTime,
      linkedObjectType: "ExamAppointment",
      linkedObjectId: appointments[0]?.appointmentId ?? null
    });
    return { ...context, appointmentIds: appointments.map((item) => item.appointmentId), taskId: task.taskId };
  }

  if (step.linkedAction === "collectSpecimens") {
    const reports = state.labReports.filter((item) => item.encounterId === journey.encounterId);
    for (const report of reports) {
      report.status = "SpecimenCollected";
      report.sampleTime = eventTime;
    }
    const task = ensureClinicalTask(state, journey, {
      taskType: "检验",
      taskName: "采集血常规、凝血、肝肾功能标本",
      status: "completed",
      ownerDeptId: "D009",
      completedTime: eventTime,
      linkedObjectType: "LabReport",
      linkedObjectId: reports[0]?.labReportId ?? null
    });
    const record = createNursingRecord(state, journey, {
      recordType: "检验采样",
      recordTime: eventTime,
      content: "核对患者身份后完成静脉采血，样本已送检。"
    });
    return { ...context, taskId: task.taskId, nursingRecordId: record.nursingRecordId, labReportIds: reports.map((item) => item.labReportId) };
  }

  if (step.linkedAction === "completeLabSpecimenTracking") {
    const reports = state.labReports.filter((item) => item.encounterId === journey.encounterId);
    const tracks = reports.map((report) => {
      report.status = report.status === "Final" ? report.status : "Accepted";
      return ensureLabSpecimenTrack(state, journey, report, {
        status: "Accepted",
        collectedTime: report.sampleTime ?? addMinutes(eventTime, -25),
        deliveredTime: addMinutes(eventTime, -12),
        receivedTime: eventTime,
        acceptedTime: addMinutes(eventTime, 10)
      });
    });
    const task = ensureClinicalTask(state, journey, {
      taskType: "检验",
      taskName: "检验科接收并上机术前标本",
      status: "completed",
      ownerDeptId: "D009",
      completedTime: eventTime,
      linkedObjectType: "LabSpecimenTrack",
      linkedObjectId: tracks[0]?.trackId ?? null
    });
    return { ...context, trackIds: tracks.map((item) => item.trackId), taskId: task.taskId };
  }

  if (step.linkedAction === "performImaging") {
    const reports = state.examReports.filter((item) => item.encounterId === journey.encounterId);
    for (const report of reports) {
      report.status = "Performed";
      report.performedTime = eventTime;
    }
    for (const study of state.imagingStudies.filter((item) => item.encounterId === journey.encounterId)) {
      study.studyTime = eventTime;
    }
    const ultrasound = createOrUpdateUltrasoundReport(state, journey, {
      status: "Performed",
      performedTime: eventTime
    });
    const ecg = createOrUpdateEcgReport(state, journey, {
      status: "Performed",
      performedTime: eventTime
    });
    for (const appointment of (state.examAppointments ?? []).filter((item) => item.journeyId === journey.journeyId)) {
      appointment.status = "Completed";
      appointment.checkInTime = appointment.checkInTime ?? addMinutes(eventTime, -10);
      appointment.completedTime = eventTime;
    }
    ensureClinicalTask(state, journey, {
      taskType: "检查",
      taskName: "完成腹部彩超检查",
      status: "completed",
      ownerDeptId: "D015",
      completedTime: eventTime,
      linkedObjectType: "UltrasoundReport",
      linkedObjectId: ultrasound.ultrasoundReportId
    });
    ensureClinicalTask(state, journey, {
      taskType: "检查",
      taskName: "完成术前十二导联心电图",
      status: "completed",
      ownerDeptId: "D003",
      completedTime: eventTime,
      linkedObjectType: "EcgReport",
      linkedObjectId: ecg.ecgReportId
    });
    const task = ensureClinicalTask(state, journey, {
      taskType: "检查",
      taskName: "完成必要上腹部 CT/PACS 检查",
      status: "completed",
      ownerDeptId: "D008",
      completedTime: eventTime,
      linkedObjectType: "ExamReport",
      linkedObjectId: reports[0]?.examReportId ?? null
    });
    return {
      ...context,
      taskId: task.taskId,
      examReportIds: reports.map((item) => item.examReportId),
      ultrasoundReportId: ultrasound.ultrasoundReportId,
      ecgReportId: ecg.ecgReportId
    };
  }

  if (step.linkedAction === "finalizeReports") {
    for (const report of state.labReports.filter((item) => item.encounterId === journey.encounterId)) {
      report.status = "Final";
      report.reportTime = report.reportTime ?? eventTime;
      createCriticalValueIfNeeded(state, journey, report, eventTime);
    }
    for (const report of state.examReports.filter((item) => item.encounterId === journey.encounterId)) {
      report.status = "Final";
      report.reportTime = report.reportTime ?? eventTime;
    }
    for (const report of (state.ultrasoundReports ?? []).filter((item) => item.encounterId === journey.encounterId)) {
      report.status = "Final";
      report.reportTime = report.reportTime ?? eventTime;
    }
    for (const report of (state.ecgReports ?? []).filter((item) => item.encounterId === journey.encounterId)) {
      report.status = "Final";
      report.reportTime = report.reportTime ?? eventTime;
    }
    return {
      ...context,
      labReportIds: state.labReports.filter((item) => item.encounterId === journey.encounterId).map((item) => item.labReportId),
      examReportIds: state.examReports.filter((item) => item.encounterId === journey.encounterId).map((item) => item.examReportId),
      ultrasoundReportIds: (state.ultrasoundReports ?? []).filter((item) => item.encounterId === journey.encounterId).map((item) => item.ultrasoundReportId),
      ecgReportIds: (state.ecgReports ?? []).filter((item) => item.encounterId === journey.encounterId).map((item) => item.ecgReportId)
    };
  }

  if (step.linkedAction === "completeRemoteConsultation") {
    const consultation = ensureRemoteConsultation(state, journey, {
      scheduledTime: addMinutes(eventTime, -30),
      startedTime: addMinutes(eventTime, -20),
      completedTime: eventTime,
      status: "已完成"
    });
    const document = ensureDocument(state, journey, {
      documentType: "RemoteConsultationNote",
      title: "术前远程会诊意见",
      status: "Final",
      signedTime: eventTime,
      contentText: `远程会诊结论：${consultation.conclusion}`
    });
    return { ...context, consultationId: consultation.consultationId, documentId: document.documentId };
  }

  if (step.linkedAction === "completePreopRiskAssessment") {
    const asa = ensureRiskAssessment(state, journey, {
      assessmentType: "ASA麻醉风险评估",
      score: 2,
      riskLevel: "II级",
      assessedTime: eventTime,
      items: [
        { name: "基础疾病", value: "无严重系统性疾病" },
        { name: "气道评估", value: "Mallampati II级" },
        { name: "术前禁食", value: "已宣教并确认" }
      ]
    });
    const vte = ensureRiskAssessment(state, journey, {
      assessmentType: "Caprini VTE风险评估",
      score: 3,
      riskLevel: "中危",
      assessedTime: eventTime,
      items: [
        { name: "年龄", value: "41-60岁" },
        { name: "腹腔镜手术", value: "计划实施" },
        { name: "预防措施", value: "早期下床活动，必要时弹力袜" }
      ]
    });
    const nursing = ensureRiskAssessment(state, journey, {
      assessmentType: "跌倒/压疮护理风险评估",
      score: 2,
      riskLevel: "低危",
      assessedTime: eventTime,
      assessorId: "PRA004",
      items: [
        { name: "意识", value: "清楚" },
        { name: "活动", value: "可自行活动" }
      ]
    });
    const fee = addBillingItem(state, journey, {
      itemCode: "PREOP-ASSESS",
      itemName: "术前风险评估",
      category: "诊疗",
      unitPrice: 120,
      amount: 120,
      insuranceClass: "乙类",
      selfPayRatio: 0.1,
      postedTime: eventTime
    });
    return { ...context, riskAssessmentIds: [asa.riskAssessmentId, vte.riskAssessmentId, nursing.riskAssessmentId], billingItemId: fee.billingItemId };
  }

  if (step.linkedAction === "signConsents") {
    const profile = diseaseProfileForJourney(state, journey);
    const consents = [
      ensureConsent(state, journey, {
        consentType: "Surgery",
        title: `${profile.procedureName}知情同意书`,
        signedTime: eventTime,
        keyRisks: profile.breastCancerCase ? ["出血", "切口感染", "淋巴水肿", "病理结果改变治疗方案", "需辅助治疗"] : ["出血", "胆管损伤", "中转开腹", "术后感染"]
      }),
      ensureConsent(state, journey, {
        consentType: "Anesthesia",
        title: `${profile.anesthesiaMethod}知情同意书`,
        signedTime: eventTime,
        witnessId: "PRA003",
        keyRisks: ["误吸", "循环波动", "苏醒延迟", "药物过敏"]
      }),
      ensureConsent(state, journey, {
        consentType: "BloodTransfusion",
        title: "输血治疗知情同意书",
        signedTime: eventTime,
        keyRisks: ["输血反应", "感染风险", "必要时启用"]
      })
    ];
    const document = ensureDocument(state, journey, {
      documentType: "ConsentBundle",
      title: "术前知情同意归档",
      status: "Final",
      signedTime: eventTime,
      contentText: profile.breastCancerCase
        ? `患者及家属已完成${profile.procedureName}、麻醉、输血及乳腺癌综合治疗相关知情同意签署，已告知病理分型、分期、辅助治疗和随访要求。`
        : "患者及家属已完成手术、麻醉、输血相关知情同意签署，关键风险已告知。"
    });
    return { ...context, consentIds: consents.map((item) => item.consentId), documentId: document.documentId };
  }

  if (step.linkedAction === "completeBloodPreparation") {
    const patient = findById(state.patients, "patientId", journey.patientId);
    const isChole = isCholecystectomyJourney(state, journey);
    const bloodOrderCode = isChole ? "BLOOD_TYPE_SCREEN" : "BLOOD_TYPE_XMATCH";
    let order = state.orders.find((item) => item.encounterId === journey.encounterId && item.orderType === "输血" && item.itemCode === bloodOrderCode);
    if (!order) {
      const orderId = buildId("ORD", state.counters);
      order = {
        orderId,
        orderNo: `BLOOD${orderId.slice(3).padStart(8, "0")}`,
        encounterId: journey.encounterId,
        orderType: "输血",
        itemCode: bloodOrderCode,
        itemName: isChole ? "ABO/Rh血型复核+不规则抗体筛查" : "ABO/Rh血型复核+抗体筛查+交叉配血",
        status: "已完成",
        requesterDeptId: "D004",
        requesterId: "PRA001",
        requestedTime: eventTime,
        scheduledTime: eventTime
      };
      state.orders.push(order);
    } else {
      order.status = "已完成";
      order.scheduledTime = order.scheduledTime ?? eventTime;
    }

    const preparation = ensureBloodPreparationRecord(state, journey, {
      orderId: order.orderId,
      requestTime: eventTime,
      sampleCollectedTime: addMinutes(eventTime, 8),
      verifiedTime: addMinutes(eventTime, 45),
      bloodType: patient?.bloodType ?? "待复核",
      validUntil: addMinutes(eventTime, 72 * 60),
      antibodyScreen: "阴性",
      crossmatchResult: isChole ? "抗体筛查阴性，低出血风险择期腹腔镜胆囊切除术未申请交叉配血" : undefined,
      productType: isChole ? "血型复核/抗体筛查" : undefined,
      reservedVolume: isChole ? "0U" : undefined,
      status: isChole ? "TypeScreened" : "Prepared",
      note: isChole
        ? "择期腹腔镜胆囊切除术低出血风险，仅完成血型复核和不规则抗体筛查；如术中出血风险变化，再启动交叉配血。"
        : undefined
    });
    const task = ensureClinicalTask(state, journey, {
      taskType: "输血",
      taskName: isChole ? "术前血型复核与抗体筛查" : "术前备血与血型复核",
      status: "completed",
      ownerDeptId: "D009",
      completedTime: preparation.verifiedTime,
      linkedObjectType: "BloodPreparation",
      linkedObjectId: preparation.bloodPreparationId
    });
    const record = createNursingRecord(state, journey, {
      recordType: isChole ? "血型复核标本采集" : "输血备血标本采集",
      recordTime: preparation.sampleCollectedTime,
      content: isChole
        ? `核对腕带、住院号和术前资料后采集血型复核标本，输血科完成 ABO/Rh 复核和不规则抗体筛查，血型 ${preparation.bloodType}，未常规备血。`
        : `核对腕带、住院号和输血同意书后采集备血标本，送输血科完成血型复核和交叉配血准备，血型 ${preparation.bloodType}。`
    });
    const fee = addBillingItem(state, journey, {
      itemCode: isChole ? "BLOOD-TYPE-SCREEN" : "BLOOD-XMATCH",
      itemName: isChole ? "血型复核与不规则抗体筛查" : "血型复核与交叉配血",
      category: "检验",
      unitPrice: isChole ? 52 : 96,
      amount: isChole ? 52 : 96,
      insuranceClass: "甲类",
      selfPayRatio: 0,
      postedTime: eventTime
    });
    return { ...context, orderId: order.orderId, bloodPreparationId: preparation.bloodPreparationId, taskId: task.taskId, nursingRecordId: record.nursingRecordId, billingItemId: fee.billingItemId };
  }

  if (step.linkedAction === "dispensePreopMedication") {
    const isChole = isCholecystectomyJourney(state, journey);
    const antibioticOrder = ensureMedicationOrder(state, journey, {
      itemCode: "CEFAZOLIN",
      itemName: isChole ? "头孢唑林钠 2.0g" : "头孢唑林钠 1.0g",
      status: "已配药",
      requestedTime: eventTime
    });
    const analgesicOrder = ensureMedicationOrder(state, journey, {
      itemCode: "FLURBIPROFEN",
      itemName: "氟比洛芬酯注射液 50mg",
      status: "已配药",
      requestedTime: eventTime
    });
    const antibiotic = ensureMedicationDispense(state, journey, {
      phase: "术前",
      medicationCode: "CEFAZOLIN",
      medicationName: "头孢唑林钠",
      dose: isChole ? "2.0g" : "1.0g",
      route: "静脉滴注",
      frequency: isChole ? "切皮前 30-60 分钟" : "术前 30 分钟",
      status: "Dispensed",
      dispensedTime: eventTime,
      note: isChole ? "清洁-污染类胆道手术围术期预防用药，术后无感染证据不延长疗程。" : "预防性抗菌药物"
    });
    const analgesic = ensureMedicationDispense(state, journey, {
      phase: "术前",
      medicationCode: "FLURBIPROFEN",
      medicationName: "氟比洛芬酯注射液",
      dose: "50mg",
      route: "静脉注射",
      frequency: "术前",
      status: "Dispensed",
      dispensedTime: eventTime,
      note: "术前镇痛备用"
    });
    return { ...context, orderIds: [antibioticOrder.orderId, analgesicOrder.orderId], dispenseIds: [antibiotic.dispenseId, analgesic.dispenseId] };
  }

  if (step.linkedAction === "completeAntimicrobialReview") {
    const patient = findById(state.patients, "patientId", journey.patientId);
    const hasPenicillinAllergy = (patient?.allergyText ?? "").includes("青霉素");
    const profile = diseaseProfileForJourney(state, journey);
    const isChole = isCholecystectomyProfile(profile);
    const review = ensureAntimicrobialReview(state, journey, {
      reviewTime: eventTime,
      status: hasPenicillinAllergy ? "ApprovedWithAlternative" : "Approved",
      recommendation: hasPenicillinAllergy
        ? `青霉素过敏史阳性，建议停用头孢唑林，改用替代方案并由药师结合${profile.diagnosisName}及${profile.procedureName}风险评估覆盖范围。`
        : isChole
          ? "腹腔镜胆囊切除术围术期预防用药适宜，切皮前 30-60 分钟给药；无感染证据时术后不常规延长抗菌药疗程。"
          : `${profile.procedureName}围诊疗期用药审核通过，注意疗程、过敏反应及术后/操作后感染证据动态评估。`
    });
    const task = ensureClinicalTask(state, journey, {
      taskType: "药学",
      taskName: "围术期预防性抗菌药物审核",
      status: "completed",
      ownerDeptId: "D010",
      completedTime: eventTime,
      linkedObjectType: "AntimicrobialReview",
      linkedObjectId: review.reviewId
    });
    return { ...context, reviewId: review.reviewId, taskId: task.taskId };
  }

  if (step.linkedAction === "completeMedicationSafetyCheck") {
    const patient = findById(state.patients, "patientId", journey.patientId);
    const allergyText = patient?.allergyText ?? "无";
    const hasPenicillinAllergy = allergyText.includes("青霉素");
    const antibioticDispense = state.medicationDispenses.find((item) => item.journeyId === journey.journeyId && item.phase === "术前" && item.medicationCode === "CEFAZOLIN");
    const antibioticOrder = state.orders.find((item) => item.encounterId === journey.encounterId && item.orderType === "用药" && item.itemCode === "CEFAZOLIN");
    if (hasPenicillinAllergy) {
      if (antibioticDispense) {
        antibioticDispense.medicationCode = "CLINDAMYCIN";
        antibioticDispense.medicationName = "克林霉素磷酸酯";
        antibioticDispense.dose = "0.6g";
        antibioticDispense.note = "青霉素过敏史阳性，药师审核后替代预防性抗菌药物。";
      }
      if (antibioticOrder) {
        antibioticOrder.itemCode = "CLINDAMYCIN";
        antibioticOrder.itemName = "克林霉素磷酸酯 0.6g";
        antibioticOrder.status = "已替换";
      }
    }
    const medicationCode = hasPenicillinAllergy ? "CLINDAMYCIN" : "CEFAZOLIN";
    const medicationName = hasPenicillinAllergy ? "克林霉素磷酸酯" : "头孢唑林钠";
    const check = ensureMedicationSafetyCheck(state, journey, {
      checkTime: eventTime,
      medicationCode,
      medicationName,
      allergyHistory: allergyText,
      skinTestRequired: !hasPenicillinAllergy,
      skinTestTime: addMinutes(eventTime, -20),
      skinTestResult: hasPenicillinAllergy ? "过敏史阳性，禁用头孢唑林" : "阴性",
      status: hasPenicillinAllergy ? "AlternativePrepared" : "Passed",
      action: hasPenicillinAllergy ? "改用克林霉素，执行前再次核对过敏腕带。" : "皮试阴性，可按医嘱执行头孢唑林。"
    });
    const task = ensureClinicalTask(state, journey, {
      taskType: "用药安全",
      taskName: "术前抗菌药皮试/过敏核查",
      status: "completed",
      ownerDeptId: "D004",
      completedTime: eventTime,
      linkedObjectType: "MedicationSafetyCheck",
      linkedObjectId: check.safetyCheckId
    });
    const record = createNursingRecord(state, journey, {
      recordType: "术前用药安全核查",
      recordTime: eventTime,
      content: hasPenicillinAllergy
        ? "患者青霉素过敏史阳性，已佩戴过敏标识，术前预防性抗菌药改用克林霉素。"
        : "完成术前抗菌药皮试/过敏史核查，结果阴性，患者无不适。"
    });
    return { ...context, safetyCheckId: check.safetyCheckId, taskId: task.taskId, nursingRecordId: record.nursingRecordId, medicationCode };
  }

  if (step.linkedAction === "verifyPreopMedicationScan") {
    const dispenses = state.medicationDispenses.filter((item) => item.journeyId === journey.journeyId && item.phase === "术前");
    const verification = ensureIdentityVerificationRecord(state, journey, {
      scene: "术前用药PDA扫码",
      verificationTime: eventTime,
      medicationBarcodes: dispenses.map((item) => `${item.medicationCode}-${item.dispenseId}`),
      status: "Passed",
      note: "PDA扫码核对腕带、姓名、住院号、术前用药、剂量、途径、过敏史和执行时间均一致。"
    });
    const task = ensureClinicalTask(state, journey, {
      taskType: "扫码核对",
      taskName: "术前用药三查七对PDA核对",
      status: "completed",
      ownerDeptId: "D004",
      completedTime: eventTime,
      linkedObjectType: "IdentityVerification",
      linkedObjectId: verification.verificationId
    });
    return { ...context, verificationId: verification.verificationId, taskId: task.taskId, medicationBarcodes: verification.medicationBarcodes };
  }

  if (step.linkedAction === "administerPreopMedication") {
    const dispenses = state.medicationDispenses.filter((item) => item.journeyId === journey.journeyId && item.phase === "术前");
    const administrations = [];
    for (const dispense of dispenses) {
      dispense.status = "Administered";
      dispense.administeredTime = eventTime;
      administrations.push(ensureMedicationAdministration(state, journey, {
        dispenseId: dispense.dispenseId,
        medicationCode: dispense.medicationCode,
        medicationName: dispense.medicationName,
        dose: dispense.dose,
        route: dispense.route,
        scheduledTime: eventTime,
        administeredTime: eventTime,
        status: "Administered"
      }));
    }
    const record = createNursingRecord(state, journey, {
      recordType: "术前用药",
      recordTime: eventTime,
      content: "执行术前抗菌药物及镇痛用药，完成三查七对。",
      vitalSigns: { temperature: "36.7", pulse: 80, respiration: 18, bloodPressure: "124/76" }
    });
    return {
      ...context,
      nursingRecordId: record.nursingRecordId,
      dispenseIds: dispenses.map((item) => item.dispenseId),
      administrationIds: administrations.map((item) => item.administrationId)
    };
  }

  if (step.linkedAction === "completePreopPreparation") {
    const prep = ensurePreopPreparation(state, journey, {
      status: "Completed",
      preparationTime: eventTime,
      siteMarkingTime: addMinutes(eventTime, -10)
    });
    const vital = ensureVitalSignRecord(state, journey, {
      recordType: "术前转运前生命体征",
      recordTime: eventTime,
      temperature: "36.7",
      pulse: 82,
      respiration: 18,
      bloodPressure: "122/76",
      spo2: 99,
      painScore: 2,
      note: "术前准备完成，禁食水符合要求。"
    });
    const record = createNursingRecord(state, journey, {
      recordType: "术前准备",
      recordTime: eventTime,
      content: "完成手术部位标识、皮肤准备、禁食水确认、过敏史核对、随身物品交接和术前生命体征复测。",
      vitalSigns: { temperature: "36.7", pulse: 82, respiration: 18, bloodPressure: "122/76", spo2: 99 },
      painScore: 2
    });
    return { ...context, preparationId: prep.preparationId, vitalSignId: vital.vitalSignId, nursingRecordId: record.nursingRecordId };
  }

  if (step.linkedAction === "signPreopSummary") {
    const document = ensureDocument(state, journey, {
      documentType: "PreoperativeSummary",
      title: "术前小结",
      status: "Final",
      signedTime: eventTime,
      contentText: "患者因胆囊结石伴慢性胆囊炎入院，术前检查完善，拟行腹腔镜胆囊切除术。"
    });
    return { ...context, documentId: document.documentId };
  }

  if (step.linkedAction === "createAnesthesiaVisit") {
    const document = ensureDocument(state, journey, {
      documentType: "AnesthesiaVisit",
      title: "麻醉访视记录",
      status: "Final",
      signedTime: eventTime,
      contentText: "患者拟行全身麻醉，术前禁食水，已完成麻醉风险告知。"
    });
    return { ...context, documentId: document.documentId };
  }

  if (step.linkedAction === "confirmSurgeryRequest") {
    const schedule = journey.surgeryScheduleId ? findById(state.surgerySchedules, "surgeryScheduleId", journey.surgeryScheduleId) : null;
    const request = schedule ? findById(state.surgeryRequests, "surgeryRequestId", schedule.surgeryRequestId) : null;
    if (request) {
      request.status = "已审核";
    }
    return { ...context, surgeryRequestId: request?.surgeryRequestId };
  }

  if (step.linkedAction === "confirmSurgerySchedule") {
    const schedule = journey.surgeryScheduleId ? findById(state.surgerySchedules, "surgeryScheduleId", journey.surgeryScheduleId) : null;
    if (schedule) {
      schedule.status = "Scheduled";
      schedule.actualStartTime = null;
      schedule.actualEndTime = null;
    }
    const request = schedule ? findById(state.surgeryRequests, "surgeryRequestId", schedule.surgeryRequestId) : null;
    if (request) {
      request.status = "已排班";
    }
    return { ...context, surgeryScheduleId: schedule?.surgeryScheduleId };
  }

  if (step.linkedAction === "notifyFamilyWaiting") {
    const notification = ensureFamilyNotification(state, journey, {
      phase: "接台通知",
      notifyTime: eventTime
    });
    return { ...context, notificationId: notification.notificationId };
  }

  if (step.linkedAction?.startsWith("surgeryStatus:")) {
    const status = step.linkedAction.split(":")[1];
    if (!journey.surgeryScheduleId) {
      throw new HttpError(409, "This journey is not linked to a surgery schedule.");
    }
    const result = updateSurgeryStatus(state, journey.surgeryScheduleId, {
      status,
      eventTime,
      sourceSystem: "PatientJourney",
      payload: { journeyId: journey.journeyId, stepCode: step.stepCode }
    });
    return { ...context, surgeryEventId: result.event.eventId, surgeryStatus: status };
  }

  if (step.linkedAction === "completeSurgicalSafetyChecklist") {
    const profile = diseaseProfileForJourney(state, journey);
    const checklist = ensureSurgicalSafetyChecklist(state, journey, {
      status: "Completed",
      signInTime: addMinutes(eventTime, -3),
      timeOutTime: eventTime,
      items: surgicalSafetyItemsForProfile(profile)
    });
    const record = createNursingRecord(state, journey, {
      recordType: "手术安全核查",
      recordTime: eventTime,
      content: `手术医师、麻醉医师、巡回护士共同完成入室核查和术前暂停，确认患者身份、${profile.procedureName}、${profile.bodyPart}部位、过敏史、影像资料和知情同意。`
    });
    return { ...context, checklistId: checklist.checklistId, nursingRecordId: record.nursingRecordId };
  }

  if (step.linkedAction === "startAnesthesiaRecord") {
    const anesthesia = ensureAnesthesiaRecord(state, journey, {
      status: "InProgress",
      startTime: eventTime,
      middleTime: addMinutes(eventTime, 35),
      endTime: addMinutes(eventTime, 85)
    });
    const record = createNursingRecord(state, journey, {
      recordType: "麻醉诱导配合",
      recordTime: eventTime,
      content: "协助麻醉医师完成全麻诱导、气管插管和监护连接，生命体征平稳。",
      vitalSigns: { temperature: "36.5", pulse: 82, respiration: 16, bloodPressure: "128/76", spo2: 99 }
    });
    return { ...context, anesthesiaRecordId: anesthesia.anesthesiaRecordId, nursingRecordId: record.nursingRecordId };
  }

  if (step.linkedAction === "completeInstrumentCount") {
    const count = ensureInstrumentCount(state, journey, {
      phase: "关腹前/关闭前",
      status: "Matched",
      countTime: eventTime
    });
    const record = createNursingRecord(state, journey, {
      recordType: "器械敷料清点",
      recordTime: eventTime,
      content: "巡回护士与器械护士完成器械、敷料、缝针和钛夹清点，术前、关腹前、术毕数量一致。"
    });
    return { ...context, instrumentCountId: count.instrumentCountId, nursingRecordId: record.nursingRecordId };
  }

  if (step.linkedAction === "startSurgeryMediaTeaching") {
    const profile = diseaseProfileForJourney(state, journey);
    const mediaPlan = surgeryMediaPlanForProfile(profile, journey);
    const media = ensureSurgeryMediaRecord(state, journey, {
      status: "Recording",
      startTime: eventTime,
      clips: mediaPlan.liveClips
    });
    const teaching = ensureTeachingSessionForJourney(state, journey, {
      status: "直播中",
      startTime: eventTime
    });
    const notification = ensureFamilyNotification(state, journey, {
      phase: "手术开始",
      notifyTime: eventTime
    });
    return { ...context, mediaRecordId: media.mediaRecordId, teachingSessionId: teaching.teachingSessionId, notificationId: notification.notificationId };
  }

  if (step.linkedAction === "traceOrConsumables") {
    const profile = diseaseProfileForJourney(state, journey);
    const usage = ensureOrConsumableUsage(state, journey, {
      usageTime: eventTime,
      status: "Verified",
      charged: true
    });
    const amount = usage.items.reduce((sum, item) => sum + Number(item.chargeAmount || 0), 0);
    const fee = addBillingItem(state, journey, {
      itemCode: "OR-CONSUMABLES",
      itemName: isCholecystectomyProfile(profile) ? "腹腔镜手术一次性耗材" : `${profile.procedureName}相关一次性耗材`,
      category: "耗材",
      unitPrice: amount,
      amount,
      insuranceClass: "乙类",
      selfPayRatio: 0.2,
      postedTime: eventTime
    });
    return { ...context, usageId: usage.usageId, billingItemId: fee.billingItemId };
  }

  if (step.linkedAction === "signOperationRecord") {
    const profile = diseaseProfileForJourney(state, journey);
    const anesthesia = ensureAnesthesiaRecord(state, journey, {
      status: "Completed",
      startTime: addMinutes(eventTime, -95),
      middleTime: addMinutes(eventTime, -45),
      endTime: addMinutes(eventTime, -8)
    });
    const checklist = ensureSurgicalSafetyChecklist(state, journey, {
      status: "Completed",
      signInTime: addMinutes(eventTime, -105),
      timeOutTime: addMinutes(eventTime, -90),
      signOutTime: eventTime
    });
    const document = ensureDocument(state, journey, {
      documentType: "SurgeryRecord",
      title: "手术记录",
      status: "Final",
      signedTime: eventTime,
      contentText: profile.breastCancerCase
        ? `在${profile.anesthesiaMethod}下行${profile.procedureName}。术中按乳腺癌规范流程核对病灶部位、影像定位、前哨/腋窝处理方式和标本方向标记，标本送冰冻/常规病理及免疫组化复核。`
        : isCholecystectomyProfile(profile)
          ? `在${profile.anesthesiaMethod}下行${profile.procedureName}。术中建立气腹，显露 Calot 三角并确认关键安全视野，夹闭切断胆囊管和胆囊动脉，剥离胆囊床，标本袋取出胆囊，冲洗确认无活动性出血及胆漏，标本送病理。`
          : `在${profile.anesthesiaMethod}下行${profile.procedureName}。术中见病变部位与术前评估一致，操作顺利，标本送病理。`,
      content: {
        surgeryName: profile.procedureName,
        anesthesiaMethod: profile.anesthesiaMethod,
        position: profile.position,
        incision: profile.breastCancerCase ? "乳腺病灶表面弧形切口/腋窝小切口" : isCholecystectomyProfile(profile) ? "脐部、剑突下及右上腹四孔法腹腔镜入路" : "按相应术式常规入路",
        intraoperativeFinding: profile.breastCancerCase ? `${profile.diagnosisName}，术前分期 ${profile.tnmStage}，${profile.keyFinding}。` : profile.operationFinding ?? profile.keyFinding,
        procedure: profile.breastCancerCase
          ? "根据术前影像定位切除乳腺病灶，标记上、下、内、外及深切缘；按前哨淋巴结或腋窝处理路径送检，完成止血、冲洗和分层缝合。"
          : profile.operationProcedure ?? "按术式规范完成病灶处理、止血、冲洗和标本送检。",
        bloodLoss: profile.breastCancerCase ? "30ml" : "20ml",
        drainage: profile.breastCancerCase ? "视腋窝处理情况置负压引流" : "未置引流",
        complication: "无"
      }
    });
    return { ...context, documentId: document.documentId, anesthesiaRecordId: anesthesia.anesthesiaRecordId, checklistId: checklist.checklistId };
  }

  if (step.linkedAction === "archiveSurgeryMediaTeaching") {
    const profile = diseaseProfileForJourney(state, journey);
    const mediaPlan = surgeryMediaPlanForProfile(profile, journey);
    const media = ensureSurgeryMediaRecord(state, journey, {
      status: "Archived",
      endTime: eventTime,
      recordingUrl: mediaPlan.recordingUrl,
      archiveStatus: "Archived",
      clips: mediaPlan.archivedClips
    });
    const teaching = ensureTeachingSessionForJourney(state, journey, {
      status: "已结束",
      endTime: eventTime,
      recordingUrl: media.recordingUrl
    });
    const notification = ensureFamilyNotification(state, journey, {
      phase: "手术结束",
      notifyTime: eventTime
    });
    return { ...context, mediaRecordId: media.mediaRecordId, teachingSessionId: teaching.teachingSessionId, notificationId: notification.notificationId };
  }

  if (step.linkedAction === "recordPacuRecovery") {
    const pacu = ensurePacuRecord(state, journey, {
      status: "TransferredOut",
      inTime: eventTime,
      outTime: addMinutes(eventTime, 45),
      aldreteScoreIn: 8,
      aldreteScoreOut: 10,
      painScore: 2
    });
    const transfer = ensureTransportEvent(state, journey, {
      direction: "PACU到病区",
      fromLocation: "麻醉恢复室",
      toLocation: "普通外科病区",
      requestedTime: addMinutes(eventTime, 40),
      departedTime: addMinutes(eventTime, 45),
      arrivedTime: addMinutes(eventTime, 55),
      handoverItems: ["术式", "麻醉复苏情况", "镇痛泵/用药", "切口敷料", "生命体征"]
    });
    const record = createNursingRecord(state, journey, {
      recordType: "PACU复苏交接",
      recordTime: addMinutes(eventTime, 45),
      content: "患者苏醒良好，自主呼吸平稳，Aldrete 评分 10 分，切口敷料干燥，转回普通外科病区。",
      vitalSigns: { temperature: "36.5", pulse: 78, respiration: 17, bloodPressure: "118/72", spo2: 99 },
      painScore: 2
    });
    return { ...context, pacuRecordId: pacu.pacuRecordId, transportEventId: transfer.transportEventId, nursingRecordId: record.nursingRecordId };
  }

  if (step.linkedAction === "completeWardHandover") {
    const isChole = isCholecystectomyJourney(state, journey);
    const handover = ensureNursingHandover(state, journey, {
      handoverType: "PACU回病区交接",
      handoverTime: eventTime,
      items: isChole ? [
        { itemName: "身份腕带", result: "一致" },
        { itemName: "手术及麻醉", result: "腹腔镜胆囊切除术后，全麻复苏平稳" },
        { itemName: "腹部穿刺孔", result: "敷料干燥固定，无明显渗血渗液" },
        { itemName: "用药与镇痛", result: "短程护胃、按需镇痛/止吐备用，无常规术后抗菌药疗程" },
        { itemName: "风险提示", result: "观察腹痛、发热、黄疸、胆漏、跌倒和 VTE 风险" }
      ] : undefined,
      note: "PACU护士与病区责任护士完成床旁交接，患者意识清楚，生命体征平稳。"
    });
    const record = createNursingRecord(state, journey, {
      recordType: "术后床旁交接",
      recordTime: eventTime,
      content: "核对患者身份、术式、麻醉复苏、切口敷料、用药、疼痛评分、VTE和跌倒风险，完成回病区交接。"
    });
    return { ...context, handoverId: handover.handoverId, nursingRecordId: record.nursingRecordId };
  }

  if (step.linkedAction === "assessPostopPain") {
    const pain = ensurePainAssessment(state, journey, {
      phase: "术后返回病区",
      assessmentTime: eventTime,
      score: 2,
      painSite: "腹部穿刺孔",
      painNature: "轻度牵拉痛",
      intervention: "指导半卧位休息，解释疼痛原因，镇痛备用药暂不使用。",
      reassessmentTime: addMinutes(eventTime, 30),
      reassessmentScore: 1
    });
    const record = createNursingRecord(state, journey, {
      recordType: "术后疼痛评估",
      recordTime: eventTime,
      content: "术后返回病区疼痛评分 2 分，予体位调整和心理安慰，30 分钟后复评 1 分。",
      painScore: 2
    });
    return { ...context, painAssessmentId: pain.painAssessmentId, nursingRecordId: record.nursingRecordId };
  }

  if (step.linkedAction === "sendSurgicalSpecimen") {
    const profile = diseaseProfileForJourney(state, journey);
    const specimen = ensureSurgicalSpecimen(state, journey, {
      specimenName: profile.specimenName,
      bodySite: profile.bodyPart,
      status: "Received",
      collectedTime: eventTime,
      sentTime: addMinutes(eventTime, 5),
      receivedTime: addMinutes(eventTime, 35),
      grossDescription: profile.breastCancerCase
        ? `乳腺肿瘤标本一件，已按上、下、内、外、深面标记切缘；另送前哨/腋窝淋巴结标本，病理科接收后行常规 HE、ER、PR、HER2、Ki-67 及必要时 FISH 检测。`
        : undefined
    });
    const fee = addBillingItem(state, journey, {
      itemCode: profile.breastCancerCase ? "PATH-BREAST-IHC" : "PATH-GENERAL",
      itemName: profile.breastCancerCase ? "乳腺癌术后病理+免疫组化" : `${profile.specimenName}术后病理检查`,
      category: "病理",
      unitPrice: profile.breastCancerCase ? 980 : 260,
      amount: profile.breastCancerCase ? 980 : 260,
      insuranceClass: profile.breastCancerCase ? "乙类" : "甲类",
      selfPayRatio: profile.breastCancerCase ? 0.1 : 0,
      postedTime: eventTime
    });
    const record = createNursingRecord(state, journey, {
      recordType: "术中标本交接",
      recordTime: eventTime,
      content: profile.breastCancerCase
        ? "巡回护士核对乳腺肿瘤标本方向标记、淋巴结标本、固定液、病理申请单和免疫组化项目，送病理科并完成接收登记。"
        : `巡回护士核对${profile.specimenName}标本标签、固定液和申请单，送病理科并完成接收登记。`
    });
    return { ...context, specimenId: specimen.specimenId, billingItemId: fee.billingItemId, nursingRecordId: record.nursingRecordId };
  }

  if (step.linkedAction === "transferToOR") {
    const transfer = ensureTransportEvent(state, journey, {
      direction: "病区到手术室",
      fromLocation: "普通外科病区",
      toLocation: "手术部等候区",
      requestedTime: eventTime,
      departedTime: eventTime,
      arrivedTime: addMinutes(eventTime, 8),
      handoverItems: ["腕带核对", "病历资料", "术前用药", "影像资料", "知情同意书"]
    });
    const record = createNursingRecord(state, journey, {
      recordType: "术前转运交接",
      recordTime: eventTime,
      content: "病区护士与手术部护士完成患者身份、术式、禁食、过敏史、影像资料和知情同意书交接。",
      vitalSigns: { temperature: "36.6", pulse: 82, respiration: 18, bloodPressure: "122/76" }
    });
    return { ...context, transportEventId: transfer.transportEventId, nursingRecordId: record.nursingRecordId };
  }

  if (step.linkedAction === "completeCleaning") {
    if (!journey.surgeryScheduleId) {
      throw new HttpError(409, "This journey is not linked to a surgery schedule.");
    }
    updateSurgeryStatus(state, journey.surgeryScheduleId, {
      status: "Cleaning",
      eventTime,
      sourceSystem: "PatientJourney",
      payload: { journeyId: journey.journeyId, stepCode: step.stepCode }
    });
    const result = updateSurgeryStatus(state, journey.surgeryScheduleId, {
      status: "Completed",
      eventTime: addMinutes(eventTime, 1),
      sourceSystem: "PatientJourney",
      payload: { journeyId: journey.journeyId, stepCode: step.stepCode }
    });
    return { ...context, surgeryEventId: result.event.eventId, surgeryStatus: "Completed" };
  }

  if (step.linkedAction === "createPostopOrders") {
    const orders = [
      ensureMedicationOrder(state, journey, {
        itemCode: "POSTOP-DIET",
        itemName: "术后 6 小时禁食水，肠功能恢复后流质饮食",
        status: "已开立",
        requestedTime: eventTime
      }),
      ensureMedicationOrder(state, journey, {
        itemCode: "POSTOP-VITAL",
        itemName: "术后生命体征监测 q2h",
        status: "已开立",
        requestedTime: eventTime
      })
    ];
    const surgeryFee = addBillingItem(state, journey, {
      itemCode: "LC-CHOL",
      itemName: "腹腔镜胆囊切除术",
      category: "手术",
      unitPrice: 3800,
      amount: 3800,
      insuranceClass: "乙类",
      selfPayRatio: 0.15,
      medicalInsuranceCatalogCode: "NHSA-SIM-51.2301",
      medicalInsuranceCatalogName: "腹腔镜胆囊切除术",
      medicalInsuranceFeeCategory: "手术治疗费",
      postedTime: eventTime
    });
    const anesthesiaFee = addBillingItem(state, journey, {
      itemCode: "GA-001",
      itemName: "全身麻醉",
      category: "麻醉",
      unitPrice: 1200,
      amount: 1200,
      insuranceClass: "乙类",
      selfPayRatio: 0.1,
      medicalInsuranceCatalogCode: "NHSA-SIM-GA-001",
      medicalInsuranceCatalogName: "全身麻醉",
      medicalInsuranceFeeCategory: "麻醉费",
      postedTime: eventTime
    });
    return { ...context, orderIds: orders.map((item) => item.orderId), billingItemIds: [surgeryFee.billingItemId, anesthesiaFee.billingItemId] };
  }

  if (step.linkedAction === "advancePostopDiet") {
    const plan = ensureDietaryPlan(state, journey, {
      phase: "术后恢复",
      assessmentTime: eventTime,
      status: "Active",
      dietOrder: "术后 6 小时清醒无恶心呕吐后少量温水，肠功能恢复后流质-半流质低脂饮食",
      nutritionRiskScore: 1,
      intakeTarget: "先少量饮水，逐步过渡到低脂流质/半流质",
      restrictions: ["避免油腻", "避免辛辣", "避免一次进食过多"],
      note: "无恶心呕吐，腹部体征平稳，可按术后路径逐步恢复饮食。"
    });
    const record = createNursingRecord(state, journey, {
      recordType: "术后饮食指导",
      recordTime: eventTime,
      content: "评估患者清醒、无明显恶心呕吐，完成术后饮水和低脂饮食过渡宣教。"
    });
    return { ...context, dietaryPlanId: plan.dietaryPlanId, nursingRecordId: record.nursingRecordId };
  }

  if (step.linkedAction === "dispensePostopMedication") {
    const isChole = isCholecystectomyJourney(state, journey);
    const postopOrders = isChole ? [
      ensureMedicationOrder(state, journey, {
        itemCode: "PANTOPRAZOLE",
        itemName: "泮托拉唑钠 40mg",
        status: "已配药",
        requestedTime: eventTime
      }),
      ensureMedicationOrder(state, journey, {
        itemCode: "FLURBIPROFEN",
        itemName: "氟比洛芬酯注射液 50mg",
        status: "已配药",
        requestedTime: eventTime
      }),
      ensureMedicationOrder(state, journey, {
        itemCode: "ONDANSETRON",
        itemName: "昂丹司琼注射液 4mg",
        status: "已配药",
        requestedTime: eventTime
      })
    ] : [
      ensureMedicationOrder(state, journey, {
        itemCode: "CEFUROXIME",
        itemName: "头孢呋辛钠 1.5g",
        status: "已配药",
        requestedTime: eventTime
      }),
      ensureMedicationOrder(state, journey, {
        itemCode: "PANTOPRAZOLE",
        itemName: "泮托拉唑钠 40mg",
        status: "已配药",
        requestedTime: eventTime
      }),
      ensureMedicationOrder(state, journey, {
        itemCode: "TRAMADOL",
        itemName: "曲马多注射液 100mg",
        status: "已配药",
        requestedTime: eventTime
      })
    ];
    const dispenses = isChole ? [
      ensureMedicationDispense(state, journey, {
        phase: "术后",
        medicationCode: "PANTOPRAZOLE",
        medicationName: "泮托拉唑钠",
        dose: "40mg",
        route: "静脉滴注",
        frequency: "qd",
        status: "Dispensed",
        dispensedTime: eventTime,
        note: "NSAID 镇痛期间胃黏膜保护，短程使用"
      }),
      ensureMedicationDispense(state, journey, {
        phase: "术后",
        medicationCode: "FLURBIPROFEN",
        medicationName: "氟比洛芬酯注射液",
        dose: "50mg",
        route: "静脉注射",
        frequency: "必要时",
        status: "Dispensed",
        dispensedTime: eventTime,
        note: "术后轻中度切口痛镇痛备用"
      }),
      ensureMedicationDispense(state, journey, {
        phase: "术后",
        medicationCode: "ONDANSETRON",
        medicationName: "昂丹司琼注射液",
        dose: "4mg",
        route: "静脉注射",
        frequency: "必要时",
        status: "Dispensed",
        dispensedTime: eventTime,
        note: "恶心呕吐时备用"
      })
    ] : [
      ensureMedicationDispense(state, journey, {
        phase: "术后",
        medicationCode: "CEFUROXIME",
        medicationName: "头孢呋辛钠",
        dose: "1.5g",
        route: "静脉滴注",
        frequency: "bid",
        status: "Dispensed",
        dispensedTime: eventTime,
        note: "术后抗感染"
      }),
      ensureMedicationDispense(state, journey, {
        phase: "术后",
        medicationCode: "PANTOPRAZOLE",
        medicationName: "泮托拉唑钠",
        dose: "40mg",
        route: "静脉滴注",
        frequency: "qd",
        status: "Dispensed",
        dispensedTime: eventTime,
        note: "护胃"
      }),
      ensureMedicationDispense(state, journey, {
        phase: "术后",
        medicationCode: "TRAMADOL",
        medicationName: "曲马多注射液",
        dose: "100mg",
        route: "肌肉注射",
        frequency: "必要时",
        status: "Dispensed",
        dispensedTime: eventTime,
        note: "镇痛备用"
      })
    ];
    return { ...context, orderIds: postopOrders.map((item) => item.orderId), dispenseIds: dispenses.map((item) => item.dispenseId) };
  }

  if (step.linkedAction === "administerPostopMedication") {
    const isChole = isCholecystectomyJourney(state, journey);
    const dispenses = state.medicationDispenses.filter((item) => item.journeyId === journey.journeyId && item.phase === "术后");
    const administrations = [];
    for (const dispense of dispenses) {
      const isPrnAnalgesic = ["TRAMADOL", "FLURBIPROFEN", "ONDANSETRON"].includes(dispense.medicationCode);
      dispense.status = isPrnAnalgesic ? "Standby" : "Administered";
      dispense.administeredTime = isPrnAnalgesic ? null : eventTime;
      administrations.push(ensureMedicationAdministration(state, journey, {
        dispenseId: dispense.dispenseId,
        medicationCode: dispense.medicationCode,
        medicationName: dispense.medicationName,
        dose: dispense.dose,
        route: dispense.route,
        scheduledTime: eventTime,
        administeredTime: isPrnAnalgesic ? null : eventTime,
        status: isPrnAnalgesic ? "PRN备用" : "Administered",
        checkResult: isPrnAnalgesic ? "镇痛备用药已核对，疼痛评分未达使用条件" : "术后用药三查七对一致"
      }));
    }
    const vital = ensureVitalSignRecord(state, journey, {
      recordType: "术后首次生命体征",
      recordTime: eventTime,
      temperature: "36.8",
      pulse: 86,
      respiration: 19,
      bloodPressure: "118/72",
      spo2: 99,
      painScore: 2,
      note: "术后返回病区后首次生命体征，切口敷料干燥。"
    });
    const record = createNursingRecord(state, journey, {
      recordType: "术后用药执行",
      recordTime: eventTime,
      content: isChole ? "执行术后短程护胃用药，镇痛和止吐备用药已核对；无发热、胆漏或感染证据，未延长抗菌药疗程。" : "执行术后抗感染及护胃药物，镇痛备用药已核对备用，记录首次术后生命体征。",
      vitalSigns: { temperature: "36.8", pulse: 86, respiration: 19, bloodPressure: "118/72", spo2: 99 },
      painScore: 2
    });
    return {
      ...context,
      vitalSignId: vital.vitalSignId,
      nursingRecordId: record.nursingRecordId,
      dispenseIds: dispenses.map((item) => item.dispenseId),
      administrationIds: administrations.map((item) => item.administrationId)
    };
  }

  if (step.linkedAction === "observePostopAdverseEvents") {
    const observation = ensurePostopObservationRecord(state, journey, {
      observationTime: eventTime,
      status: "Stable"
    });
    const record = createNursingRecord(state, journey, {
      recordType: "术后不良反应观察",
      recordTime: eventTime,
      content: "观察恶心呕吐、发热、出血、黄疸、腹膜刺激征等情况，暂未见明显异常。"
    });
    return { ...context, observationId: observation.observationId, nursingRecordId: record.nursingRecordId };
  }

  if (step.linkedAction === "performPostopCare") {
    const isChole = isCholecystectomyJourney(state, journey);
    const dispenses = state.medicationDispenses.filter((item) => item.journeyId === journey.journeyId && item.phase === "术后");
    for (const dispense of dispenses) {
      if (["CEFUROXIME", "PANTOPRAZOLE"].includes(dispense.medicationCode)) {
        dispense.status = dispense.status === "Administered" ? dispense.status : "Administered";
        dispense.administeredTime = dispense.administeredTime ?? eventTime;
      }
    }
    const vital = ensureVitalSignRecord(state, journey, {
      recordType: "术后护理观察生命体征",
      recordTime: eventTime,
      temperature: "36.8",
      pulse: 82,
      respiration: 18,
      bloodPressure: "116/70",
      spo2: 99,
      painScore: 2,
      note: "术后观察期生命体征平稳，腹部无明显胀痛。"
    });
    const record = createNursingRecord(state, journey, {
      recordType: "术后护理",
      recordTime: eventTime,
      content: isChole ? "完成生命体征观察、疼痛评分、腹部穿刺孔敷料检查，指导早期翻身和咳嗽排痰，未见发热、黄疸、腹膜刺激征。" : "完成生命体征观察、疼痛评分、切口敷料检查和术后用药执行。",
      vitalSigns: { temperature: "36.8", pulse: 82, respiration: 18, bloodPressure: "116/70", spo2: 99 },
      painScore: 2
    });
    return { ...context, vitalSignId: vital.vitalSignId, nursingRecordId: record.nursingRecordId, dispenseIds: dispenses.map((item) => item.dispenseId) };
  }

  if (step.linkedAction === "completePostopWardRound") {
    const isChole = isCholecystectomyJourney(state, journey);
    const round = ensureWardRound(state, journey, {
      roundType: "术后首次查房",
      roundTime: eventTime,
      subjective: "患者诉切口轻微疼痛，无恶心呕吐，无胸闷气促。",
      objective: "生命体征平稳，腹软，切口敷料干燥，无明显渗血渗液。",
      assessment: "腹腔镜胆囊切除术后恢复平稳。",
      plan: isChole ? "继续生命体征、腹痛、发热和黄疸观察；按需镇痛，不常规延长抗菌药；鼓励早期下床活动，逐步恢复低脂饮食。" : "继续抗感染、护胃和疼痛评估，鼓励早期下床活动，逐步恢复饮食。"
    });
    const document = ensureDocument(state, journey, {
      documentType: "PostopWardRound",
      title: "术后首次查房记录",
      status: "Final",
      signedTime: eventTime,
      contentText: isChole ? "患者腹腔镜胆囊切除术后生命体征平稳，腹软，穿刺孔敷料干燥，疼痛可耐受；无发热、黄疸或胆漏表现，按需镇痛并早期活动。" : "患者术后生命体征平稳，切口敷料干燥，疼痛可耐受，继续抗感染、护胃及早期活动。"
    });
    return { ...context, wardRoundId: round.wardRoundId, documentId: document.documentId };
  }

  if (step.linkedAction === "completeVteProphylaxis") {
    const vte = ensureVteProphylaxisRecord(state, journey, {
      assessmentTime: eventTime,
      status: "InProgress"
    });
    const record = createNursingRecord(state, journey, {
      recordType: "VTE预防宣教",
      recordTime: eventTime,
      content: "根据 Caprini 评分中危，指导踝泵运动和早期活动，观察下肢肿胀疼痛，必要时使用弹力袜/气压泵。"
    });
    return { ...context, vteRecordId: vte.vteRecordId, nursingRecordId: record.nursingRecordId };
  }

  if (step.linkedAction === "completeEarlyAmbulation") {
    const mobility = ensureMobilityRehabRecord(state, journey, {
      recordTime: eventTime,
      activityLevel: "床旁站立后病区步行",
      distanceMeters: 80,
      tolerance: "步行后无头晕、胸闷、明显腹痛"
    });
    const record = createNursingRecord(state, journey, {
      recordType: "早期下床活动",
      recordTime: eventTime,
      content: "协助患者床旁站立并病区步行约 80 米，活动耐受可，继续鼓励分次下床。"
    });
    return { ...context, mobilityRecordId: mobility.mobilityRecordId, nursingRecordId: record.nursingRecordId };
  }

  if (step.linkedAction === "completeWoundCare") {
    const wound = ensureWoundCareRecord(state, journey, {
      careTime: eventTime,
      painScore: 1
    });
    const fee = addBillingItem(state, journey, {
      itemCode: "WOUND-DRESSING",
      itemName: "术后切口换药",
      category: "护理",
      unitPrice: 35,
      amount: 35,
      insuranceClass: "甲类",
      selfPayRatio: 0,
      postedTime: eventTime
    });
    const record = createNursingRecord(state, journey, {
      recordType: "切口换药",
      recordTime: eventTime,
      content: "腹部穿刺孔敷料干燥，切口对合良好，无红肿渗液，予碘伏消毒后更换无菌敷料。",
      painScore: 1
    });
    return { ...context, woundCareId: wound.woundCareId, billingItemId: fee.billingItemId, nursingRecordId: record.nursingRecordId };
  }

  if (step.linkedAction === "createPostopProgress") {
    const document = ensureDocument(state, journey, {
      documentType: "PostoperativeProgress",
      title: "术后病程记录",
      status: "Final",
      signedTime: eventTime,
      contentText: "患者术后生命体征平稳，腹部切口敷料干燥，继续观察。"
    });
    return { ...context, documentId: document.documentId };
  }

  if (step.linkedAction === "finalizePathologyReport") {
    const profile = diseaseProfileForJourney(state, journey);
    const specimen = ensureSurgicalSpecimen(state, journey, {
      specimenName: profile.specimenName,
      bodySite: profile.bodyPart,
      status: "Reported",
      receivedTime: addMinutes(eventTime, -120),
      grossDescription: profile.breastCancerCase
        ? `乳腺肿瘤标本及淋巴结标本已完成取材，切缘墨染标记清楚。`
        : isCholecystectomyProfile(profile)
          ? "胆囊一件，约 7.5cm x 3.0cm x 2.2cm，浆膜面轻度充血，壁厚约 0.3cm，黏膜粗糙，腔内见黄绿色结石数枚，大者约 1.2cm。"
          : undefined
    });
    const report = ensurePathologyReport(state, journey, {
      specimenId: specimen.specimenId,
      reportName: profile.breastCancerCase ? "乳腺癌术后病理及免疫组化" : `${profile.specimenName}术后病理`,
      receivedTime: specimen.receivedTime,
      reportTime: eventTime,
      grossDescription: profile.breastCancerCase ? `乳腺肿瘤标本见灰白质硬区，结合术前定位范围取材；淋巴结按站位分别包埋。` : isCholecystectomyProfile(profile) ? "胆囊壁稍厚，黏膜粗糙，腔内多枚黄绿色结石，最大径约 1.2cm。" : undefined,
      microscopicDescription: profile.breastCancerCase ? `镜下见${profile.pathology}。免疫组化：${profile.molecularSubtype}。` : isCholecystectomyProfile(profile) ? "镜下胆囊黏膜萎缩并见慢性炎细胞浸润，局灶胆固醇沉积，未见异型增生及恶性肿瘤证据。" : undefined,
      diagnosis: profile.breastCancerCase ? `${profile.pathology}；分子分型/免疫组化：${profile.molecularSubtype}；临床分期：${profile.tnmStage}。` : isCholecystectomyProfile(profile) ? profile.pathology : undefined,
      pathologistId: profile.breastCancerCase ? "PRA012" : undefined
    });
    const document = ensureDocument(state, journey, {
      documentType: "PathologySummary",
      title: "术后病理摘要",
      status: "Final",
      signedTime: eventTime,
      contentText: profile.breastCancerCase
        ? `病理诊断：${report.diagnosis} 已提交乳腺 MDT，肿瘤内科将结合分期、ER/PR/HER2/Ki-67、切缘及淋巴结状态评估辅助治疗。`
        : `病理诊断：${report.diagnosis} 已向患者说明病理结果，继续按术后常规恢复。`
    });
    return { ...context, specimenId: specimen.specimenId, pathologyReportId: report.pathologyReportId, documentId: document.documentId };
  }

  if (step.linkedAction === "completeFollowupCheck") {
    const labOrderId = buildId("ORD", state.counters);
    const reportId = buildId("LABR", state.counters);
    state.orders.push({
      orderId: labOrderId,
      orderNo: `LABFOLLOW${labOrderId.slice(3).padStart(6, "0")}`,
      encounterId: journey.encounterId,
      orderType: "检验",
      itemCode: "POSTOP_LIVER",
      itemName: "术后血常规+肝功能复查",
      status: "已完成",
      requesterDeptId: "D004",
      requesterId: "PRA001",
      requestedTime: eventTime,
      scheduledTime: eventTime
    });
    state.labReports.push({
      labReportId: reportId,
      orderId: labOrderId,
      encounterId: journey.encounterId,
      patientId: journey.patientId,
      sampleNo: `FOLLOW${reportId.slice(4).padStart(6, "0")}`,
      specimenType: "血液",
      reportName: "术后血常规+肝功能复查",
      status: "Final",
      reportTime: eventTime,
      abnormalFlag: "Normal",
      items: [
        { code: "WBC", name: "白细胞", value: "7.1", unit: "10^9/L", referenceRange: "3.5-9.5", flag: "N" },
        { code: "ALT", name: "谷丙转氨酶", value: "28", unit: "U/L", referenceRange: "9-50", flag: "N" },
        { code: "AST", name: "谷草转氨酶", value: "24", unit: "U/L", referenceRange: "15-40", flag: "N" },
        { code: "TBIL", name: "总胆红素", value: "14.2", unit: "umol/L", referenceRange: "5.1-23.0", flag: "N" },
        { code: "AMY", name: "血淀粉酶", value: "49", unit: "U/L", referenceRange: "30-110", flag: "N" }
      ]
    });
    return { ...context, orderId: labOrderId, labReportId: reportId };
  }

  if (step.linkedAction === "generateDailyBillingStatement") {
    const statement = ensureDailyBillingStatement(state, journey, {
      generatedTime: eventTime,
      confirmTime: addMinutes(eventTime, 10),
      status: "Confirmed"
    });
    return { ...context, statementId: statement.statementId, totalAmount: statement.totalAmount, depositBalance: statement.depositBalance };
  }

  if (step.linkedAction === "createInsurancePreSettlement") {
    const settlement = ensureInsuranceSettlement(state, journey, {
      status: "PreSettled",
      preSettlementTime: eventTime,
      note: "出院前医保预结算，待出院归档后完成正式结算。"
    });
    return { ...context, settlementId: settlement.settlementId, totalAmount: settlement.totalAmount, selfPayAmount: settlement.selfPayAmount };
  }

  if (step.linkedAction === "prepareDischargeMedications") {
    const profile = diseaseProfileForJourney(state, journey);
    const isChole = isCholecystectomyProfile(profile);
    const medicationPlan = profile.breastCancerCase ? [
      {
        medicationCode: "LETROZOLE",
        medicationName: "来曲唑片",
        dose: "2.5mg",
        route: "口服",
        frequency: "qd",
        days: 14,
        quantity: "14片",
        instruction: "按乳腺癌内分泌治疗评估后执行，若出现潮热、关节痛等不适及时复诊。"
      },
      {
        medicationCode: "CELECOXIB",
        medicationName: "塞来昔布胶囊",
        dose: "0.2g",
        route: "口服",
        frequency: "bid",
        days: 5,
        quantity: "10粒",
        instruction: "术后疼痛明显时按医嘱服用，注意胃肠道反应。"
      }
    ] : isChole ? [
      {
        medicationCode: "CELECOXIB",
        medicationName: "塞来昔布胶囊",
        dose: "0.2g",
        route: "口服",
        frequency: "bid，必要时",
        days: 3,
        quantity: "6粒",
        instruction: "仅在切口疼痛明显时短期服用，胃痛、黑便或过敏不适及时停药就诊。"
      },
      {
        medicationCode: "OMEPRAZOLE",
        medicationName: "奥美拉唑肠溶胶囊",
        dose: "20mg",
        route: "口服",
        frequency: "qd",
        days: 3,
        quantity: "3粒",
        instruction: "镇痛药使用期间晨起服用；无明显胃部不适可按医嘱停用。"
      }
    ] : [
      {
        medicationCode: "URSODEOXYCHOLIC",
        medicationName: "熊去氧胆酸胶囊",
        dose: "250mg",
        route: "口服",
        frequency: "bid",
        days: 7,
        quantity: "14粒",
        instruction: "餐后口服，如出现明显腹痛、发热或黄疸及时就诊。"
      },
      {
        medicationCode: "CEFUROXIME-PO",
        medicationName: "头孢呋辛酯片",
        dose: "0.25g",
        route: "口服",
        frequency: "bid",
        days: 3,
        quantity: "6片",
        instruction: "按医嘱完成疗程，过敏者禁用。"
      }
    ];
    const medications = medicationPlan.map((item) => ensureDischargeMedication(state, journey, {
      ...item,
      preparedTime: eventTime
    }));
    const feeAmount = profile.breastCancerCase ? 328 : isChole ? 58 : 168;
    const fee = addBillingItem(state, journey, {
      itemCode: "DISCHARGE-MED",
      itemName: "出院带药",
      category: "药品",
      unitPrice: feeAmount,
      amount: feeAmount,
      insuranceClass: "乙类",
      selfPayRatio: 0.2,
      postedTime: eventTime
    });
    return { ...context, dischargeMedicationIds: medications.map((item) => item.dischargeMedicationId), billingItemId: fee.billingItemId };
  }

  if (step.linkedAction === "completeDischargeMedicationCounseling") {
    const profile = diseaseProfileForJourney(state, journey);
    const isChole = isCholecystectomyProfile(profile);
    const medications = (state.dischargeMedications ?? []).filter((item) => item.journeyId === journey.journeyId);
    for (const medication of medications) {
      medication.status = "Dispensed";
      medication.dispensedTime = eventTime;
    }
    const counseling = ensureMedicationCounselingRecord(state, journey, {
      counselingTime: eventTime,
      status: "Completed",
      keyPoints: isChole ? [
        "出院不常规口服抗菌药，若发热、寒战、黄疸或腹痛加重应及时就诊",
        "塞来昔布仅疼痛明显时短期服用，避免与其他 NSAID 重复使用",
        "保持穿刺孔敷料清洁干燥，按复诊安排换药或拆线",
        "低脂清淡饮食逐步过渡，避免一次大量油腻饮食"
      ] : undefined,
      teachBackResult: isChole ? "患者及家属能复述镇痛药短期按需使用、无需常规抗菌药、切口观察和发热黄疸腹痛警示症状。" : undefined
    });
    const record = createNursingRecord(state, journey, {
      recordType: "出院带药交付",
      recordTime: eventTime,
      content: "核对出院带药品种、数量、用法用量和注意事项，患者及家属完成用药复述。"
    });
    return { ...context, counselingId: counseling.counselingId, nursingRecordId: record.nursingRecordId, dischargeMedicationIds: medications.map((item) => item.dischargeMedicationId) };
  }

  if (step.linkedAction === "assessDischargeReadiness") {
    const isChole = isCholecystectomyJourney(state, journey);
    const vital = ensureVitalSignRecord(state, journey, {
      recordType: "出院前生命体征",
      recordTime: eventTime,
      temperature: "36.5",
      pulse: 76,
      respiration: 17,
      bloodPressure: "118/72",
      spo2: 99,
      painScore: 1,
      note: "出院前复测生命体征平稳。"
    });
    const assessment = ensureDischargeAssessment(state, journey, {
      assessedTime: eventTime,
      status: "Ready",
      readinessScore: 95
    });
    const round = ensureWardRound(state, journey, {
      roundType: "出院前查房",
      roundTime: eventTime,
      subjective: "患者无发热，无明显腹痛，进食及活动可。",
      objective: "生命体征平稳，腹部切口敷料干燥，复查血常规及肝功能无明显异常。",
      assessment: "胆囊结石术后恢复良好，达到出院条件。",
      plan: isChole ? "办理出院，短期按需镇痛，不常规口服抗菌药；低脂饮食，门诊复诊并观察发热、黄疸、腹痛等异常情况。" : "办理出院，带药口服，门诊复诊并观察发热、黄疸、腹痛等异常情况。"
    });
    const record = createNursingRecord(state, journey, {
      recordType: "出院评估",
      recordTime: eventTime,
      content: "完成出院准备度评估、生命体征复测、带药核对和复诊注意事项确认。",
      vitalSigns: { temperature: "36.5", pulse: 76, respiration: 17, bloodPressure: "118/72", spo2: 99 },
      painScore: 1
    });
    return { ...context, vitalSignId: vital.vitalSignId, dischargeAssessmentId: assessment.dischargeAssessmentId, wardRoundId: round.wardRoundId, nursingRecordId: record.nursingRecordId };
  }

  if (step.linkedAction === "signDischargeEducation") {
    const education = ensureDischargeEducationRecord(state, journey, {
      educationTime: eventTime,
      status: "Signed"
    });
    const document = ensureDocument(state, journey, {
      documentType: "DischargeEducation",
      title: "出院宣教签收单",
      status: "Final",
      signedTime: eventTime,
      contentText: "患者及家属已完成切口护理、饮食活动、出院用药、复诊安排和异常症状处理宣教并签收。"
    });
    return { ...context, educationId: education.educationId, documentId: document.documentId };
  }

  if (step.linkedAction === "createDischargeSummary") {
    const profile = diseaseProfileForJourney(state, journey);
    const document = ensureDocument(state, journey, {
      documentType: "DischargeSummary",
      title: "出院小结",
      status: "Final",
      signedTime: eventTime,
      contentText: isCholecystectomyProfile(profile)
        ? "患者因胆囊结石伴慢性胆囊炎入院，腹部超声提示胆囊多发结石、胆总管未见扩张，术前血常规、肝功能、胆红素、凝血及心电图未见手术禁忌。已行腹腔镜胆囊切除术，术后病理符合慢性胆囊炎伴胆囊结石，恢复平稳，低脂饮食，门诊复诊。"
        : "患者行腹腔镜胆囊切除术后恢复良好，准予出院，门诊随访。"
    });
    return { ...context, documentId: document.documentId };
  }

  if (step.linkedAction === "createMedicalRecordHomePage") {
    const profile = diseaseProfileForJourney(state, journey);
    const homePage = ensureMedicalRecordHomePage(state, journey, {
      status: "Coded",
      completedTime: eventTime,
      dischargeTime: eventTime,
      mainDiagnosisCode: profile.diagnosisCode,
      mainDiagnosisName: profile.diagnosisName,
      mainProcedureCode: profile.procedureCode,
      mainProcedureName: profile.procedureName,
      drgCode: profile.drgCode,
      drgName: profile.drgName,
      coderNote: profile.breastCancerCase
        ? "乳腺癌主要诊断、TNM 分期、分子分型、主要手术/操作、病理免疫组化和医保结算清单字段已核对。"
        : undefined
    });
    const quality = ensureRecordQualityCheck(state, journey, {
      checkTime: addMinutes(eventTime, 20),
      status: "Passed",
      score: 96,
      level: "甲级病案"
    });
    return { ...context, homePageId: homePage.homePageId, qualityCheckId: quality.qualityCheckId };
  }

  if (step.linkedAction === "dischargePatient") {
    const profile = diseaseProfileForJourney(state, journey);
    const encounter = findById(state.encounters, "encounterId", journey.encounterId);
    const admission = state.admissions.find((item) => item.encounterId === journey.encounterId);
    const bed = admission ? findById(state.beds, "bedId", admission.bedId) : null;
    if (encounter) {
      encounter.status = "Discharged";
      encounter.endTime = eventTime;
    }
    if (admission) {
      admission.dischargeTime = eventTime;
      admission.dischargeDiagnosis = admission.dischargeDiagnosis ?? `${profile.diagnosisName}，${profile.procedureName}后`;
    }
    if (bed) {
      bed.status = "Idle";
      bed.currentEncounterId = null;
    }
    return { ...context, admissionId: admission?.admissionId, bedId: bed?.bedId };
  }

  if (step.linkedAction === "completeInsuranceSettlement") {
    const settlement = ensureInsuranceSettlement(state, journey, {
      status: "Settled",
      settlementTime: eventTime,
      note: "已完成出院医保结算和费用清单确认。"
    });
    return { ...context, settlementId: settlement.settlementId, totalAmount: settlement.totalAmount, coveredAmount: settlement.coveredAmount, selfPayAmount: settlement.selfPayAmount };
  }

  if (step.linkedAction === "issueDischargeInvoice") {
    const settlement = ensureInsuranceSettlement(state, journey, {
      status: "Settled",
      settlementTime: eventTime,
      note: "已完成出院医保结算和费用清单确认。"
    });
    const invoice = ensureInvoiceRecord(state, journey, {
      settlementId: settlement.settlementId,
      issuedTime: eventTime,
      status: "Issued",
      totalAmount: settlement.totalAmount,
      payerAmount: settlement.selfPayAmount
    });
    return { ...context, invoiceId: invoice.invoiceId, settlementId: settlement.settlementId };
  }

  if (step.linkedAction === "scheduleFollowUp") {
    const followUp = ensureFollowUp(state, journey, {
      scheduledTime: addMinutes(eventTime, 7 * 24 * 60),
      note: "出院后 7 天普通外科门诊复诊，查看切口愈合、病理结果和饮食恢复情况。"
    });
    const record = createNursingRecord(state, journey, {
      recordType: "出院宣教",
      recordTime: eventTime,
      content: "完成出院带药、切口护理、饮食活动、复诊时间和异常症状处理宣教。"
    });
    return { ...context, followUpId: followUp.followUpId, nursingRecordId: record.nursingRecordId };
  }

  if (step.linkedAction === "recordFollowUpOutcome") {
    const followUp = ensureFollowUp(state, journey, {
      scheduledTime: addMinutes(eventTime, -10),
      status: "Completed",
      note: "已完成出院后电话随访。"
    });
    const outcome = ensureFollowUpOutcomeRecord(state, journey, {
      followUpId: followUp.followUpId,
      contactTime: eventTime,
      status: "Completed"
    });
    return { ...context, followUpId: followUp.followUpId, outcomeId: outcome.outcomeId };
  }

  if (step.linkedAction === "completeInfectionSurveillance") {
    const surveillance = ensureInfectionSurveillanceRecord(state, journey, {
      surveillanceTime: eventTime,
      status: "NoInfection"
    });
    return { ...context, surveillanceId: surveillance.surveillanceId };
  }

  if (step.linkedAction === "collectSatisfactionSurvey") {
    const survey = ensureSatisfactionSurvey(state, journey, {
      submittedTime: eventTime,
      status: "Submitted"
    });
    return { ...context, surveyId: survey.surveyId, overallScore: survey.overallScore };
  }

  return context;
}

function recordJourneyEvent(state, journey, step, eventTime, payload) {
  const event = {
    eventId: buildId("JEV", state.counters),
    journeyId: journey.journeyId,
    stepCode: step.stepCode,
    stepName: step.stepName,
    phase: step.phase,
    eventTime,
    actor: "SmartHIS",
    sourceSystem: systemForStep(step),
    interfaceEvent: step.interfaceEvent,
    description: step.description,
    payload
  };
  state.journeyEvents.push(event);

  logInterfaceMessage(state, {
    channelId: "CH000001",
    correlationId: journey.journeyId,
    messageType: step.interfaceEvent,
    direction: "event",
    status: "success",
    requestBody: null,
    responseBody: {
      journeyId: journey.journeyId,
      eventId: event.eventId,
      stepCode: step.stepCode,
      patientId: journey.patientId,
      encounterId: journey.encounterId,
      surgeryScheduleId: journey.surgeryScheduleId
    }
  });

  return event;
}

export function advancePatientJourney(state, journeyId) {
  const journey = getJourney(state, journeyId);
  const template = getTemplate(state, journey.templateId);

  if (journey.status === "completed") {
    return { journey: enrichPatientJourney(state, journey), result: "already completed" };
  }

  const stepIndex = journey.currentStepIndex + 1;
  const step = template.steps[stepIndex];
  if (!step) {
    journey.status = "completed";
    journey.finishedTime = journey.finishedTime ?? nowIso();
    journey.updatedTime = journey.finishedTime;
    return { journey: enrichPatientJourney(state, journey), result: "completed" };
  }

  if (journey.status === "ready") {
    journey.status = "running";
    journey.startedTime = journey.startedTime ?? nowIso();
  }

  const eventTime = addMinutes(journey.simulatedTime, step.defaultOffsetMinutes ?? 0);
  const payload = applyClinicalAction(state, journey, step, eventTime);
  const event = recordJourneyEvent(state, journey, step, eventTime, payload);

  journey.currentStepIndex = stepIndex;
  journey.simulatedTime = eventTime;
  journey.updatedTime = nowIso();

  if (stepIndex >= template.steps.length - 1) {
    journey.status = "completed";
    journey.finishedTime = journey.updatedTime;
  }

  return {
    journey: enrichPatientJourney(state, journey),
    event,
    result: step.stepCode
  };
}

export function runPatientJourney(state, journeyId) {
  const events = [];
  let result;

  do {
    result = advancePatientJourney(state, journeyId);
    if (result.event) {
      events.push(result.event);
    }
  } while (result.journey.status !== "completed");

  return {
    journey: result.journey,
    events,
    result: "completed"
  };
}

export function resetPatientJourney(state, journeyId) {
  const journey = getJourney(state, journeyId);
  const template = getTemplate(state, journey.templateId);
  const encounter = findById(state.encounters, "encounterId", journey.encounterId);
  const admission = state.admissions.find((item) => item.encounterId === journey.encounterId);
  const bed = admission ? findById(state.beds, "bedId", admission.bedId) : null;
  const schedule = journey.surgeryScheduleId
    ? findById(state.surgerySchedules, "surgeryScheduleId", journey.surgeryScheduleId)
    : null;
  const request = schedule ? findById(state.surgeryRequests, "surgeryRequestId", schedule.surgeryRequestId) : null;
  const room = schedule ? findById(state.operatingRooms, "roomId", schedule.roomId) : null;

  journey.status = "ready";
  journey.currentStepIndex = -1;
  journey.startedTime = null;
  journey.updatedTime = nowIso();
  journey.finishedTime = null;
  journey.simulatedTime = encounter?.startTime ?? "2026-05-15T08:20:00+08:00";

  state.journeyEvents = state.journeyEvents.filter((event) => event.journeyId !== journeyId);
  state.clinicalTasks = state.clinicalTasks.filter((task) => task.journeyId !== journeyId);
  state.medicationDispenses = (state.medicationDispenses ?? []).filter((dispense) => dispense.journeyId !== journeyId);
  state.nursingRecords = (state.nursingRecords ?? []).filter((record) => record.journeyId !== journeyId);
  state.consents = (state.consents ?? []).filter((item) => item.journeyId !== journeyId);
  state.riskAssessments = (state.riskAssessments ?? []).filter((item) => item.journeyId !== journeyId);
  state.transportEvents = (state.transportEvents ?? []).filter((item) => item.journeyId !== journeyId);
  state.billingItems = (state.billingItems ?? []).filter((item) => item.journeyId !== journeyId);
  state.dischargeMedications = (state.dischargeMedications ?? []).filter((item) => item.journeyId !== journeyId);
  state.followUps = (state.followUps ?? []).filter((item) => item.journeyId !== journeyId);
  state.labCriticalValues = (state.labCriticalValues ?? []).filter((item) => item.journeyId !== journeyId);
  state.surgicalSpecimens = (state.surgicalSpecimens ?? []).filter((item) => item.journeyId !== journeyId);
  state.pathologyReports = (state.pathologyReports ?? []).filter((item) => item.journeyId !== journeyId);
  state.insuranceSettlements = (state.insuranceSettlements ?? []).filter((item) => item.journeyId !== journeyId);
  state.surgicalSafetyChecklists = (state.surgicalSafetyChecklists ?? []).filter((item) => item.journeyId !== journeyId);
  state.anesthesiaRecords = (state.anesthesiaRecords ?? []).filter((item) => item.journeyId !== journeyId);
  state.instrumentCounts = (state.instrumentCounts ?? []).filter((item) => item.journeyId !== journeyId);
  state.pacuRecords = (state.pacuRecords ?? []).filter((item) => item.journeyId !== journeyId);
  state.vitalSignRecords = (state.vitalSignRecords ?? []).filter((item) => item.journeyId !== journeyId);
  state.medicationAdministrations = (state.medicationAdministrations ?? []).filter((item) => item.journeyId !== journeyId);
  state.preopPreparations = (state.preopPreparations ?? []).filter((item) => item.journeyId !== journeyId);
  state.wardRounds = (state.wardRounds ?? []).filter((item) => item.journeyId !== journeyId);
  state.dischargeAssessments = (state.dischargeAssessments ?? []).filter((item) => item.journeyId !== journeyId);
  state.labSpecimenTracks = (state.labSpecimenTracks ?? []).filter((item) => item.journeyId !== journeyId);
  state.infusionRecords = (state.infusionRecords ?? []).filter((item) => item.journeyId !== journeyId);
  state.painAssessments = (state.painAssessments ?? []).filter((item) => item.journeyId !== journeyId);
  state.woundCareRecords = (state.woundCareRecords ?? []).filter((item) => item.journeyId !== journeyId);
  state.medicalRecordHomePages = (state.medicalRecordHomePages ?? []).filter((item) => item.journeyId !== journeyId);
  state.recordQualityChecks = (state.recordQualityChecks ?? []).filter((item) => item.journeyId !== journeyId);
  state.consultations = (state.consultations ?? []).filter((item) => item.journeyId !== journeyId);
  state.teachingSessions = (state.teachingSessions ?? []).filter((item) => item.journeyId !== journeyId);
  state.familyNotifications = (state.familyNotifications ?? []).filter((item) => item.journeyId !== journeyId);
  state.antimicrobialReviews = (state.antimicrobialReviews ?? []).filter((item) => item.journeyId !== journeyId);
  state.orConsumableUsages = (state.orConsumableUsages ?? []).filter((item) => item.journeyId !== journeyId);
  state.surgeryMediaRecords = (state.surgeryMediaRecords ?? []).filter((item) => item.journeyId !== journeyId);
  state.dietaryPlans = (state.dietaryPlans ?? []).filter((item) => item.journeyId !== journeyId);
  state.mobilityRehabRecords = (state.mobilityRehabRecords ?? []).filter((item) => item.journeyId !== journeyId);
  state.vteProphylaxisRecords = (state.vteProphylaxisRecords ?? []).filter((item) => item.journeyId !== journeyId);
  state.nursingHandovers = (state.nursingHandovers ?? []).filter((item) => item.journeyId !== journeyId);
  state.postopObservationRecords = (state.postopObservationRecords ?? []).filter((item) => item.journeyId !== journeyId);
  state.medicationCounselingRecords = (state.medicationCounselingRecords ?? []).filter((item) => item.journeyId !== journeyId);
  state.dischargeEducationRecords = (state.dischargeEducationRecords ?? []).filter((item) => item.journeyId !== journeyId);
  state.invoiceRecords = (state.invoiceRecords ?? []).filter((item) => item.journeyId !== journeyId);
  state.followUpOutcomeRecords = (state.followUpOutcomeRecords ?? []).filter((item) => item.journeyId !== journeyId);
  state.infectionSurveillanceRecords = (state.infectionSurveillanceRecords ?? []).filter((item) => item.journeyId !== journeyId);
  state.satisfactionSurveys = (state.satisfactionSurveys ?? []).filter((item) => item.journeyId !== journeyId);
  state.orderReviewRecords = (state.orderReviewRecords ?? []).filter((item) => item.journeyId !== journeyId);
  state.examAppointments = (state.examAppointments ?? []).filter((item) => item.journeyId !== journeyId);
  state.bloodPreparationRecords = (state.bloodPreparationRecords ?? []).filter((item) => item.journeyId !== journeyId);
  state.medicationSafetyChecks = (state.medicationSafetyChecks ?? []).filter((item) => item.journeyId !== journeyId);
  state.identityVerificationRecords = (state.identityVerificationRecords ?? []).filter((item) => item.journeyId !== journeyId);
  state.insuranceEligibilityRecords = (state.insuranceEligibilityRecords ?? []).filter((item) => item.journeyId !== journeyId);
  state.depositPayments = (state.depositPayments ?? []).filter((item) => item.journeyId !== journeyId);
  state.dailyBillingStatements = (state.dailyBillingStatements ?? []).filter((item) => item.journeyId !== journeyId);

  if (encounter) {
    encounter.status = "Admitted";
    encounter.endTime = null;
  }

  if (admission) {
    admission.dischargeTime = null;
    admission.dischargeDiagnosis = null;
  }

  if (bed) {
    bed.status = "Occupied";
    bed.currentEncounterId = journey.encounterId;
  }

  if (schedule) {
    schedule.status = "Scheduled";
    schedule.actualStartTime = null;
    schedule.actualEndTime = null;
  }

  if (request) {
    request.status = "已排班";
  }

  if (room) {
    room.status = "Idle";
  }

  state.documents = state.documents.filter((document) => (
    document.encounterId !== journey.encounterId
    || !["AnesthesiaVisit", "PostoperativeProgress", "DischargeSummary", "PathologySummary", "PostopWardRound"].includes(document.documentType)
  ));
  const surgeryRecord = state.documents.find((document) => document.encounterId === journey.encounterId && document.documentType === "SurgeryRecord");
  if (surgeryRecord) {
    surgeryRecord.status = "Draft";
    surgeryRecord.signedTime = null;
    surgeryRecord.contentText = "手术进行中，记录待完善。";
    surgeryRecord.content = {};
  }

  logInterfaceMessage(state, {
    channelId: "CH000001",
    correlationId: journey.journeyId,
    messageType: "journey.reset",
    direction: "event",
    status: "success",
    responseBody: {
      journeyId: journey.journeyId,
      templateId: template.templateId,
      patientId: journey.patientId,
      encounterId: journey.encounterId
    }
  });

  return enrichPatientJourney(state, journey);
}

export function getPatientJourneyTimeline(state, journeyId, query = {}) {
  getJourney(state, journeyId);
  const items = state.journeyEvents
    .filter((event) => event.journeyId === journeyId)
    .sort((left, right) => left.eventTime.localeCompare(right.eventTime));
  return paginate(items, query);
}

function resetClinicalCollectionsForCohort(state) {
  state.patients = [];
  state.encounters = [];
  state.admissions = [];
  state.diagnoses = [];
  state.orders = [];
  state.surgeryRequests = [];
  state.surgerySchedules = [];
  state.surgeryStaffAssignments = [];
  state.surgeryEvents = [];
  state.documents = [];
  state.labReports = [];
  state.examReports = [];
  state.ultrasoundReports = [];
  state.ecgReports = [];
  state.imagingStudies = [];
  state.consultations = [];
  state.teachingSessions = [];
  state.patientJourneys = [];
  state.journeyEvents = [];
  state.clinicalTasks = [];
  state.medicationDispenses = [];
  state.nursingRecords = [];
  state.consents = [];
  state.riskAssessments = [];
  state.transportEvents = [];
  state.billingItems = [];
  state.dischargeMedications = [];
  state.followUps = [];
  state.labCriticalValues = [];
  state.surgicalSpecimens = [];
  state.pathologyReports = [];
  state.insuranceSettlements = [];
  state.surgicalSafetyChecklists = [];
  state.anesthesiaRecords = [];
  state.instrumentCounts = [];
  state.pacuRecords = [];
  state.vitalSignRecords = [];
  state.medicationAdministrations = [];
  state.preopPreparations = [];
  state.wardRounds = [];
  state.dischargeAssessments = [];
  state.labSpecimenTracks = [];
  state.infusionRecords = [];
  state.painAssessments = [];
  state.woundCareRecords = [];
  state.medicalRecordHomePages = [];
  state.recordQualityChecks = [];
  state.familyNotifications = [];
  state.antimicrobialReviews = [];
  state.orConsumableUsages = [];
  state.surgeryMediaRecords = [];
  state.dietaryPlans = [];
  state.mobilityRehabRecords = [];
  state.vteProphylaxisRecords = [];
  state.nursingHandovers = [];
  state.postopObservationRecords = [];
  state.medicationCounselingRecords = [];
  state.dischargeEducationRecords = [];
  state.invoiceRecords = [];
  state.followUpOutcomeRecords = [];
  state.infectionSurveillanceRecords = [];
  state.satisfactionSurveys = [];
  state.orderReviewRecords = [];
  state.examAppointments = [];
  state.bloodPreparationRecords = [];
  state.medicationSafetyChecks = [];
  state.identityVerificationRecords = [];
  state.insuranceEligibilityRecords = [];
  state.depositPayments = [];
  state.dailyBillingStatements = [];
  state.interfaceMessages = [];

  for (const room of state.operatingRooms) {
    room.status = "Idle";
  }

  Object.assign(state.counters, {
    PAT: 0,
    ENC: 0,
    ADM: 0,
    DIA: 0,
    ORD: 0,
    SR: 0,
    SCH: 0,
    SSA: 0,
    EVT: 0,
    DOC: 0,
    CON: 0,
    TEA: 0,
    LABR: 0,
    EXR: 0,
    US: 0,
    ECG: 0,
    IMG: 0,
    JNY: 0,
    JEV: 0,
    TASK: 0,
    MED: 0,
    NUR: 0,
    CNS: 0,
    RSK: 0,
    TRN: 0,
    BIL: 0,
    DMED: 0,
    FUP: 0,
    CRIT: 0,
    SPM: 0,
    PATH: 0,
    SET: 0,
    SAFE: 0,
    ANR: 0,
    CNT: 0,
    PACU: 0,
    VSR: 0,
    MAR: 0,
    PREP: 0,
    WRD: 0,
    DRA: 0,
    LST: 0,
    INF: 0,
    PAIN: 0,
    WND: 0,
    MHP: 0,
    QCK: 0,
    FAM: 0,
    ABX: 0,
    OCU: 0,
    SMR: 0,
    DIET: 0,
    MOB: 0,
    VTE: 0,
    HOV: 0,
    OBS: 0,
    COUN: 0,
    DED: 0,
    INV: 0,
    FOUT: 0,
    SSI: 0,
    SAT: 0,
    ORV: 0,
    APP: 0,
    BLD: 0,
    MSC: 0,
    IDV: 0,
    ELG: 0,
    DEP: 0,
    DBS: 0,
    BED: 0,
    MSG: 0
  });
}

function formatSerial(index) {
  return String(index + 1).padStart(4, "0");
}

function createCohortCalendar(operationDate = "2026-05-16") {
  const normalizedDate = /^\d{4}-\d{2}-\d{2}$/.test(operationDate)
    ? operationDate
    : "2026-05-16";
  return {
    operationDate: normalizedDate,
    operationDateStamp: normalizedDate.replaceAll("-", ""),
    admissionDateFor(index) {
      return addDaysToDateString(normalizedDate, (index % 3) - 1);
    },
    surgeryDateFor(index) {
      return addDaysToDateString(normalizedDate, Math.floor(index / 18));
    }
  };
}

const CHOLECYSTECTOMY_DIAGNOSIS_CODE = "K80.200";

function isCholecystectomyProfile(profile = {}) {
  return profile.diagnosisCode === CHOLECYSTECTOMY_DIAGNOSIS_CODE;
}

function isCholecystectomyJourney(state, journey) {
  return isCholecystectomyProfile(diseaseProfileForJourney(state, journey));
}

function cholecystectomyLabItems({ potassium = "4.1" } = {}) {
  const potassiumFlag = Number(kaliumOrNumber(potassium)) < 3.0 ? "LL" : "N";
  return [
    { code: "WBC", name: "白细胞", value: "6.8", unit: "10^9/L", referenceRange: "3.5-9.5", flag: "N" },
    { code: "NEUTP", name: "中性粒细胞百分比", value: "64.2", unit: "%", referenceRange: "40-75", flag: "N" },
    { code: "HGB", name: "血红蛋白", value: "136", unit: "g/L", referenceRange: "115-150", flag: "N" },
    { code: "PLT", name: "血小板", value: "228", unit: "10^9/L", referenceRange: "125-350", flag: "N" },
    { code: "ALT", name: "谷丙转氨酶", value: "32", unit: "U/L", referenceRange: "9-50", flag: "N" },
    { code: "AST", name: "谷草转氨酶", value: "26", unit: "U/L", referenceRange: "15-40", flag: "N" },
    { code: "TBIL", name: "总胆红素", value: "16.8", unit: "umol/L", referenceRange: "5.1-23.0", flag: "N" },
    { code: "DBIL", name: "直接胆红素", value: "4.6", unit: "umol/L", referenceRange: "0.0-6.8", flag: "N" },
    { code: "ALP", name: "碱性磷酸酶", value: "78", unit: "U/L", referenceRange: "45-125", flag: "N" },
    { code: "GGT", name: "谷氨酰转肽酶", value: "36", unit: "U/L", referenceRange: "10-60", flag: "N" },
    { code: "AMY", name: "血淀粉酶", value: "54", unit: "U/L", referenceRange: "30-110", flag: "N" },
    { code: "CREA", name: "肌酐", value: "68", unit: "umol/L", referenceRange: "41-73", flag: "N" },
    { code: "K", name: "血钾", value: potassium, unit: "mmol/L", referenceRange: "3.5-5.3", flag: potassiumFlag },
    { code: "PT", name: "凝血酶原时间", value: "11.8", unit: "s", referenceRange: "9.8-13.5", flag: "N" },
    { code: "INR", name: "国际标准化比值", value: "1.03", unit: "", referenceRange: "0.85-1.15", flag: "N" },
    { code: "APTT", name: "活化部分凝血活酶时间", value: "29.6", unit: "s", referenceRange: "22-38", flag: "N" }
  ];
}

function kaliumOrNumber(value) {
  return Number(String(value).replace(/[^\d.]/g, ""));
}

const CHINA_STANDARD_BASELINE = [
  { code: "WS 445", name: "电子病历基本数据集", scope: "入院记录、病程、医嘱、检查检验、出院小结结构化数据" },
  { code: "WS/T 500", name: "电子病历共享文档规范", scope: "EMR 文书交换和归档字段" },
  { code: "WS/T 447", name: "基于电子病历的医院信息平台技术规范", scope: "HIS、EMR、LIS、RIS/PACS、药房、护理互联互通事件" },
  { code: "NHSA-15", name: "国家医保信息业务编码", scope: "医保区划、定点机构、人员类别、诊疗/药品/耗材目录模拟编码" },
  { code: "NHSA-SETTLEMENT", name: "医保基金结算清单口径", scope: "总费用、目录内费用、全自费、先行自付、起付线、基金支付、个人账户和现金支付" }
];

const COHORT_DISEASE_CATALOG = [
  {
    diagnosisCode: "K80.200",
    diagnosisName: "胆囊结石伴慢性胆囊炎",
    deptId: "D004",
    attendingDoctorId: "PRA001",
    procedureCode: "51.2301",
    procedureName: "腹腔镜胆囊切除术",
    surgeryLevel: "三级",
    anesthesiaMethod: "全身麻醉气管插管",
    position: "仰卧位，头高脚低左倾位",
    bodyPart: "肝胆胰脾",
    symptom: "反复右上腹胀痛 1 月余，油腻饮食后加重",
    sign: "腹平软，右上腹轻压痛，Murphy 征阴性或可疑阳性，未触及包块，皮肤巩膜无黄染",
    keyFinding: "胆囊大小约 7.3cm x 3.2cm，壁厚约 0.32cm，腔内多发可移动强回声团伴声影，大者约 1.1cm，胆总管内径约 0.5cm",
    keyConclusion: "胆囊多发结石，慢性胆囊炎声像图改变，胆总管未见扩张",
    examCode: "CT-ABD-UPPER",
    examName: "上腹部 CT 平扫",
    modality: "CT",
    examFinding: "肝脏形态大小未见明显异常；胆囊腔内见多发点状及结节状高密度影，胆囊壁轻度增厚，胆囊周围脂肪间隙清晰；肝内外胆管未见扩张，胰腺形态密度未见急性炎症征象。",
    examConclusion: "胆囊多发结石伴慢性胆囊炎改变；未见胆总管扩张及急性胰腺炎征象。",
    ultrasoundName: "腹部彩色多普勒超声（肝胆胰脾）",
    ultrasoundFinding: "肝脏大小形态正常，实质回声均匀；胆囊大小约 7.3cm x 3.2cm，囊壁稍厚约 0.32cm，腔内见数枚强回声团伴后方声影，大者约 1.1cm，可随体位改变移动；胆总管内径约 0.5cm，肝内外胆管未见扩张；胰腺、脾脏未见明显异常。",
    ultrasoundConclusion: "胆囊多发结石；慢性胆囊炎声像图改变；胆总管未见扩张。",
    chiefComplaint: "反复右上腹胀痛 1 月余，油腻饮食后加重 1 天。",
    presentIllness: "患者 1 月余前无明显诱因出现右上腹阵发性胀痛，进食油腻后明显，偶有恶心，无寒战高热，无皮肤巩膜黄染，无陶土样便。门诊腹部超声提示胆囊多发结石伴慢性胆囊炎，收入普通外科择期手术治疗。",
    specialtyExam: "腹平软，未见胃肠型及蠕动波，右上腹轻压痛，无反跳痛及肌紧张，Murphy 征阴性或可疑阳性，肝脾肋下未及。",
    preopSummary: "患者因反复右上腹痛入院，腹部超声为主要诊断依据，提示胆囊多发可移动强回声伴声影，胆总管未见扩张；血常规、肝肾功能、胆红素、血淀粉酶及凝血功能未见手术禁忌，心电图窦性心律，ASA II级，拟择期行腹腔镜胆囊切除术。",
    specimenName: "胆囊",
    pathology: "慢性胆囊炎伴胆囊多发胆固醇性结石，胆囊黏膜慢性炎细胞浸润，未见恶性肿瘤。",
    operationFinding: "胆囊轻度肿大，浆膜面轻度充血，与网膜少许疏松粘连；Calot 三角解剖清楚，胆囊管及胆囊动脉辨认明确，胆总管未见扩张。",
    operationProcedure: "四孔法建立气腹，压力维持 12-14mmHg。分离胆囊周围少许粘连，显露 Calot 三角，达到胆囊管、胆囊动脉及胆囊床下缘三要素的关键安全视野后，分别夹闭并切断胆囊管和胆囊动脉；顺行电凝剥离胆囊床，标本袋取出胆囊，冲洗胆囊床并确认无活动性出血及胆漏，未置腹腔引流。",
    drgCode: "HB15",
    drgName: "胆囊切除不伴严重并发症"
  },
  { diagnosisCode: "K80.000", diagnosisName: "胆囊结石伴急性胆囊炎", deptId: "D004", procedureCode: "51.2301", procedureName: "腹腔镜胆囊切除术", bodyPart: "右上腹/胆囊", symptom: "右上腹持续疼痛伴恶心", sign: "右上腹压痛，Murphy 征阳性", keyFinding: "胆囊增大，囊壁增厚，腔内多发强回声伴声影，胆囊周围少量渗出", keyConclusion: "胆囊结石伴急性胆囊炎影像表现" },
  { diagnosisCode: "K40.900", diagnosisName: "单侧腹股沟疝", deptId: "D004", procedureCode: "53.0401", procedureName: "腹股沟疝无张力修补术", bodyPart: "腹股沟区", symptom: "腹股沟区可复性包块", sign: "站立及咳嗽时包块突出，平卧可还纳", keyFinding: "腹股沟管区见疝囊样低回声，咳嗽冲击试验阳性", keyConclusion: "腹股沟疝" },
  { diagnosisCode: "K63.500", diagnosisName: "结肠息肉", deptId: "D004", procedureCode: "45.4201", procedureName: "结肠镜下息肉切除术", bodyPart: "结肠", symptom: "体检发现结肠息肉", sign: "腹软，无明显压痛", keyFinding: "乙状结肠见带蒂息肉，表面光滑", keyConclusion: "结肠息肉，建议内镜下切除" },
  { diagnosisCode: "K31.700", diagnosisName: "胃息肉", deptId: "D004", procedureCode: "43.4101", procedureName: "胃镜下息肉切除术", bodyPart: "胃窦", symptom: "上腹隐痛伴反酸", sign: "上腹部轻压痛", keyFinding: "胃窦黏膜隆起样改变，表面光滑", keyConclusion: "胃息肉" },
  { diagnosisCode: "E04.101", diagnosisName: "甲状腺结节", deptId: "D004", procedureCode: "06.3901", procedureName: "甲状腺结节切除术", bodyPart: "甲状腺", symptom: "体检发现颈部结节", sign: "甲状腺右叶可触及小结节，随吞咽上下移动", keyFinding: "甲状腺右叶低回声结节，边界清楚", keyConclusion: "甲状腺结节 TI-RADS 3 类" },
  { diagnosisCode: "D24.x00", diagnosisName: "乳腺良性肿物", deptId: "D012", procedureCode: "85.2101", procedureName: "乳腺肿物切除术", bodyPart: "乳腺", symptom: "乳腺包块", sign: "外上象限触及活动度良好肿物", keyFinding: "乳腺低回声结节，边界清，CDFI 未见丰富血流", keyConclusion: "乳腺良性肿物可能" },
  { diagnosisCode: "I83.900", diagnosisName: "下肢静脉曲张", deptId: "D004", procedureCode: "38.5901", procedureName: "大隐静脉高位结扎剥脱术", bodyPart: "下肢静脉", symptom: "下肢酸胀伴浅静脉迂曲", sign: "小腿浅静脉曲张，皮温正常", keyFinding: "大隐静脉瓣功能不全，反流时间延长", keyConclusion: "下肢静脉曲张" },
  { diagnosisCode: "K60.300", diagnosisName: "肛瘘", deptId: "D004", procedureCode: "49.1201", procedureName: "肛瘘切开挂线术", bodyPart: "肛周", symptom: "肛周反复流脓", sign: "肛周外口可见少量分泌物", keyFinding: "肛周见条索状瘘管回声，内口靠近齿状线", keyConclusion: "肛瘘" },
  { diagnosisCode: "K64.800", diagnosisName: "混合痔", deptId: "D004", procedureCode: "49.4601", procedureName: "混合痔外剥内扎术", bodyPart: "肛管直肠", symptom: "便血伴肛门肿物脱出", sign: "截石位可见混合痔团脱出", keyFinding: "肛管静脉丛扩张，未见明显占位", keyConclusion: "混合痔" },
  { diagnosisCode: "K25.900", diagnosisName: "胃溃疡", deptId: "D004", procedureCode: "44.4301", procedureName: "胃镜下止血及活检术", bodyPart: "胃体胃角", symptom: "餐后上腹痛", sign: "上腹部压痛，无反跳痛", keyFinding: "胃角见溃疡面，底覆白苔，周边充血水肿", keyConclusion: "胃溃疡，建议病理活检" },
  { diagnosisCode: "K29.500", diagnosisName: "慢性胃炎伴糜烂", deptId: "D004", procedureCode: "45.1601", procedureName: "电子胃镜检查及活检术", bodyPart: "胃黏膜", symptom: "反复上腹胀痛", sign: "上腹部轻压痛", keyFinding: "胃窦黏膜充血糜烂，皱襞规则", keyConclusion: "慢性胃炎伴糜烂" },
  { diagnosisCode: "K92.200", diagnosisName: "消化道出血", deptId: "D004", procedureCode: "44.4302", procedureName: "内镜下止血术", bodyPart: "消化道", symptom: "黑便伴乏力", sign: "睑结膜稍苍白，腹软", keyFinding: "胃窦溃疡可见血痂，未见活动性喷血", keyConclusion: "上消化道出血，内镜下处理后稳定" },
  { diagnosisCode: "K85.900", diagnosisName: "急性胰腺炎", deptId: "D004", procedureCode: "52.9301", procedureName: "胰腺炎综合治疗评估", bodyPart: "胰腺", symptom: "上腹痛向腰背部放射", sign: "上腹压痛，肠鸣音减弱", keyFinding: "胰腺体尾部稍肿胀，周围渗出少量", keyConclusion: "急性胰腺炎轻症可能" },
  { diagnosisCode: "K76.800", diagnosisName: "肝囊肿", deptId: "D004", procedureCode: "50.2901", procedureName: "腹腔镜肝囊肿开窗术", bodyPart: "肝脏", symptom: "体检发现肝囊肿", sign: "腹软，无明显压痛", keyFinding: "肝右叶无回声区，壁薄，后方回声增强", keyConclusion: "肝囊肿" },
  { diagnosisCode: "R91.x00", diagnosisName: "肺结节", deptId: "D004", procedureCode: "32.2901", procedureName: "胸腔镜肺楔形切除术", bodyPart: "肺部", symptom: "体检发现肺结节", sign: "双肺呼吸音清", keyFinding: "右肺上叶磨玻璃结节，边界尚清", keyConclusion: "肺结节，建议随访或胸外科评估" },
  { diagnosisCode: "J18.900", diagnosisName: "肺炎", deptId: "D004", procedureCode: "33.2401", procedureName: "支气管镜检查及肺泡灌洗术", bodyPart: "胸部", symptom: "咳嗽咳痰伴发热", sign: "右下肺可闻及湿啰音", keyFinding: "右下肺斑片状渗出影", keyConclusion: "肺部感染性病变" },
  { diagnosisCode: "J44.900", diagnosisName: "慢性阻塞性肺疾病急性加重", deptId: "D004", procedureCode: "93.9001", procedureName: "无创通气治疗评估", bodyPart: "肺部", symptom: "气促加重伴咳痰", sign: "桶状胸，双肺哮鸣音", keyFinding: "双肺纹理增多，肺气肿改变", keyConclusion: "慢阻肺急性加重" },
  { diagnosisCode: "J45.900", diagnosisName: "支气管哮喘急性发作", deptId: "D004", procedureCode: "93.9401", procedureName: "雾化吸入及肺功能评估", bodyPart: "肺部", symptom: "喘息胸闷", sign: "双肺散在哮鸣音", keyFinding: "肺透亮度稍增高，未见实变", keyConclusion: "哮喘急性发作" },
  { diagnosisCode: "J90.x00", diagnosisName: "胸腔积液", deptId: "D004", procedureCode: "34.9101", procedureName: "胸腔穿刺置管引流术", bodyPart: "胸腔", symptom: "胸闷气短", sign: "患侧呼吸音减低", keyFinding: "胸腔内液性暗区，最大深度约 4.0cm", keyConclusion: "胸腔积液" },
  { diagnosisCode: "I25.100", diagnosisName: "冠状动脉粥样硬化性心脏病", deptId: "D004", procedureCode: "88.5701", procedureName: "冠状动脉造影术", bodyPart: "心脏冠脉", symptom: "活动后胸闷胸痛", sign: "心率齐，心音低钝", keyFinding: "冠脉钙化积分增高，前降支狭窄可疑", keyConclusion: "冠心病待冠脉造影明确" },
  { diagnosisCode: "I48.x00", diagnosisName: "心房颤动", deptId: "D004", procedureCode: "37.3401", procedureName: "心房颤动射频消融术", bodyPart: "心脏", symptom: "心悸阵发发作", sign: "心律绝对不齐", keyFinding: "心电图提示房颤，心房稍大", keyConclusion: "心房颤动" },
  { diagnosisCode: "I10.x00", diagnosisName: "高血压病3级", deptId: "D004", procedureCode: "89.5201", procedureName: "动态血压监测及降压治疗", bodyPart: "心血管", symptom: "头晕伴血压升高", sign: "血压 168/96 mmHg", keyFinding: "左心室壁稍厚，未见急性脑血管事件征象", keyConclusion: "高血压病3级，需调整降压方案" },
  { diagnosisCode: "I50.900", diagnosisName: "心力衰竭", deptId: "D004", procedureCode: "89.6401", procedureName: "心功能评估及容量管理", bodyPart: "心脏", symptom: "活动后气促，下肢水肿", sign: "双下肢轻度凹陷性水肿", keyFinding: "心脏增大，少量胸腔积液", keyConclusion: "心力衰竭失代偿期" },
  { diagnosisCode: "I63.900", diagnosisName: "脑梗死", deptId: "D004", procedureCode: "88.4101", procedureName: "脑血管造影评估", bodyPart: "头颅", symptom: "一侧肢体乏力", sign: "左侧肢体肌力 4 级", keyFinding: "右侧基底节区小片低密度影", keyConclusion: "脑梗死亚急性期" },
  { diagnosisCode: "G45.900", diagnosisName: "短暂性脑缺血发作", deptId: "D004", procedureCode: "88.4102", procedureName: "颈脑血管评估", bodyPart: "颈脑血管", symptom: "短暂言语不清", sign: "查体暂未见定位体征", keyFinding: "颈动脉斑块形成，管腔轻度狭窄", keyConclusion: "TIA，需完善卒中风险评估" },
  { diagnosisCode: "E11.900", diagnosisName: "2型糖尿病", deptId: "D004", procedureCode: "99.1701", procedureName: "胰岛素强化治疗", bodyPart: "内分泌", symptom: "口干多饮伴血糖控制不佳", sign: "末梢血糖偏高，无酮症表现", keyFinding: "脂肪肝声像图改变，胰腺回声稍增强", keyConclusion: "2型糖尿病，住院调糖" },
  { diagnosisCode: "E87.600", diagnosisName: "低钾血症", deptId: "D004", procedureCode: "99.1801", procedureName: "静脉补钾治疗", bodyPart: "电解质", symptom: "乏力伴心悸", sign: "四肢肌力稍低", keyFinding: "血钾降低，心电图可见 T 波低平", keyConclusion: "低钾血症，需监测补钾" },
  { diagnosisCode: "E05.900", diagnosisName: "甲状腺功能亢进症", deptId: "D004", procedureCode: "06.1301", procedureName: "甲状腺功能评估及药物治疗", bodyPart: "甲状腺", symptom: "心悸多汗体重下降", sign: "甲状腺轻度肿大，手颤", keyFinding: "甲状腺血流信号增多，甲功提示甲亢", keyConclusion: "甲状腺功能亢进症" },
  { diagnosisCode: "N18.900", diagnosisName: "慢性肾脏病", deptId: "D004", procedureCode: "39.9501", procedureName: "血液透析通路评估", bodyPart: "肾脏", symptom: "乏力伴肌酐升高", sign: "双下肢轻度水肿", keyFinding: "双肾实质回声增强，皮髓质分界欠清", keyConclusion: "慢性肾脏病改变" },
  { diagnosisCode: "D05.100", diagnosisName: "乳腺导管原位癌", deptId: "D004", procedureCode: "85.2301", procedureName: "乳腺病灶扩大切除+前哨淋巴结活检术", bodyPart: "乳腺/腋窝", symptom: "体检发现乳腺钙化灶", sign: "乳腺未触及明显肿块，腋窝淋巴结未触及", keyFinding: "钼靶示簇状细小多形性钙化，超声见导管内低回声，BI-RADS 4C", keyConclusion: "乳腺导管原位癌待病理确认", breastCancerCase: true, molecularSubtype: "ER(+)，PR(+)，HER2(0)，Ki-67 8%", tnmStage: "cTisN0M0 0期", pathology: "导管原位癌，核级 II 级，切缘待术后评估" },
  { diagnosisCode: "C50.901", diagnosisName: "乳腺浸润性导管癌 Luminal A型", deptId: "D004", procedureCode: "85.4301", procedureName: "乳腺癌保乳术+前哨淋巴结活检术", bodyPart: "乳腺/腋窝", symptom: "发现左乳外上象限肿块", sign: "左乳外上象限可触及约 1.8cm 质硬肿块，活动度尚可", keyFinding: "乳腺不规则低回声结节，边缘毛刺，BI-RADS 5，腋窝未见可疑淋巴结", keyConclusion: "左乳浸润性癌可能，Luminal A 型倾向", breastCancerCase: true, molecularSubtype: "ER 90%(+)，PR 80%(+)，HER2(1+)，Ki-67 10%", tnmStage: "cT1cN0M0 IA期", pathology: "浸润性导管癌，组织学 II 级" },
  { diagnosisCode: "C50.902", diagnosisName: "乳腺浸润性导管癌 Luminal B HER2阴性", deptId: "D004", procedureCode: "85.4101", procedureName: "乳腺癌改良根治术", bodyPart: "乳腺/腋窝", symptom: "右乳肿块逐渐增大", sign: "右乳外上象限 2.6cm 质硬肿块，腋窝触及小淋巴结", keyFinding: "肿块形态不规则、纵横比大于1，右腋窝淋巴结皮质增厚，BI-RADS 5", keyConclusion: "右乳癌并腋窝淋巴结转移可疑", breastCancerCase: true, molecularSubtype: "ER 70%(+)，PR 20%(+)，HER2(1+)，Ki-67 35%", tnmStage: "cT2N1M0 IIB期", pathology: "浸润性导管癌，腋窝淋巴结转移待术后确认" },
  { diagnosisCode: "C50.903", diagnosisName: "乳腺浸润性导管癌 Luminal B HER2阳性", deptId: "D004", procedureCode: "86.0701", procedureName: "输液港植入+新辅助治疗评估", bodyPart: "乳腺/腋窝", symptom: "乳腺肿块伴腋窝结节", sign: "乳腺肿块约 3.0cm，腋窝淋巴结肿大", keyFinding: "乳腺占位边界不清，腋窝多发异常淋巴结，BI-RADS 5", keyConclusion: "乳腺癌伴腋窝淋巴结转移，建议新辅助治疗", breastCancerCase: true, molecularSubtype: "ER 60%(+)，PR 10%(+)，HER2(3+)，Ki-67 40%", tnmStage: "cT2N1M0 IIB期", pathology: "浸润性导管癌，HER2 阳性" },
  { diagnosisCode: "C50.904", diagnosisName: "HER2阳性乳腺癌", deptId: "D004", procedureCode: "85.4401", procedureName: "乳腺癌改良根治术+腋窝淋巴结清扫术", bodyPart: "乳腺/腋窝", symptom: "乳腺肿块伴皮肤牵拉", sign: "乳腺肿块质硬，局部皮肤轻度凹陷", keyFinding: "不规则低回声肿块伴微钙化，腋窝淋巴结门结构消失，BI-RADS 5", keyConclusion: "HER2 阳性乳腺癌可能，腋窝转移可疑", breastCancerCase: true, molecularSubtype: "ER(-)，PR(-)，HER2(3+)，Ki-67 55%", tnmStage: "cT2N1M0 IIB期", pathology: "浸润性导管癌，HER2 过表达" },
  { diagnosisCode: "C50.905", diagnosisName: "三阴性乳腺癌", deptId: "D004", procedureCode: "85.4302", procedureName: "乳腺癌保乳术+腋窝前哨淋巴结活检术", bodyPart: "乳腺/腋窝", symptom: "短期内乳腺肿块增大", sign: "乳腺肿块边界欠清，质硬", keyFinding: "乳腺低回声肿块边缘成角，后方回声衰减，BI-RADS 5", keyConclusion: "三阴性乳腺癌待病理免疫组化确认", breastCancerCase: true, molecularSubtype: "ER(-)，PR(-)，HER2(0)，Ki-67 70%", tnmStage: "cT2N0M0 IIA期", pathology: "浸润性导管癌，三阴性表型" },
  { diagnosisCode: "C50.906", diagnosisName: "乳腺浸润性小叶癌", deptId: "D004", procedureCode: "85.4102", procedureName: "乳腺癌改良根治术", bodyPart: "乳腺/腋窝", symptom: "乳腺局部增厚伴牵拉感", sign: "乳腺质地局灶增厚，边界不清", keyFinding: "乳腺结构扭曲，MRI 强化呈非肿块样分布，BI-RADS 5", keyConclusion: "乳腺浸润性小叶癌可能", breastCancerCase: true, molecularSubtype: "ER 85%(+)，PR 65%(+)，HER2(1+)，Ki-67 18%", tnmStage: "cT2N0M0 IIA期", pathology: "浸润性小叶癌，E-cadherin 阴性" },
  { diagnosisCode: "C50.908", diagnosisName: "乳腺癌伴腋窝淋巴结转移", deptId: "D004", procedureCode: "40.2301", procedureName: "腋窝淋巴结清扫术", bodyPart: "乳腺/腋窝", symptom: "乳腺肿块伴腋窝包块", sign: "腋窝可触及融合样淋巴结", keyFinding: "腋窝多发淋巴结肿大，皮质明显增厚，乳腺原发灶 BI-RADS 5", keyConclusion: "乳腺癌伴腋窝淋巴结转移", breastCancerCase: true, molecularSubtype: "ER 75%(+)，PR 30%(+)，HER2(2+，FISH阴性)，Ki-67 32%", tnmStage: "cT2N2M0 IIIA期", pathology: "腋窝淋巴结穿刺见转移性癌" },
  { diagnosisCode: "C50.909", diagnosisName: "炎性乳腺癌", deptId: "D004", procedureCode: "86.0702", procedureName: "输液港植入+新辅助治疗评估", bodyPart: "乳腺/皮肤/腋窝", symptom: "乳腺红肿热痛伴皮肤橘皮样改变", sign: "乳腺弥漫性肿胀，皮肤增厚发红", keyFinding: "乳腺皮肤明显增厚，实质弥漫性异常强化，腋窝淋巴结肿大", keyConclusion: "炎性乳腺癌可能，建议多学科评估", breastCancerCase: true, molecularSubtype: "ER(-)，PR(-)，HER2(3+)，Ki-67 60%", tnmStage: "cT4dN1M0 IIIB期", pathology: "皮肤淋巴管内癌栓待病理确认" },
  { diagnosisCode: "C50.910", diagnosisName: "局部晚期乳腺癌", deptId: "D004", procedureCode: "85.4402", procedureName: "乳腺癌改良根治术+胸壁修复评估", bodyPart: "乳腺/胸壁/腋窝", symptom: "乳腺巨大肿块伴皮肤破溃", sign: "肿块固定，皮肤破溃渗出", keyFinding: "乳腺巨大占位累及皮肤及胸壁筋膜，腋窝淋巴结多发肿大", keyConclusion: "局部晚期乳腺癌", breastCancerCase: true, molecularSubtype: "ER 20%(+)，PR(-)，HER2(1+)，Ki-67 65%", tnmStage: "cT4bN2M0 IIIB期", pathology: "浸润性癌，局部皮肤受累" },
  { diagnosisCode: "C50.911", diagnosisName: "乳腺癌新辅助治疗后评估", deptId: "D004", procedureCode: "85.4303", procedureName: "新辅助治疗后保乳术+前哨淋巴结活检术", bodyPart: "乳腺/腋窝", symptom: "新辅助治疗后返院手术评估", sign: "原乳腺肿块明显缩小，腋窝淋巴结未触及", keyFinding: "原病灶区残余片状低回声，增强 MRI 显示部分缓解", keyConclusion: "乳腺癌新辅助治疗后部分缓解", breastCancerCase: true, molecularSubtype: "ER(-)，PR(-)，HER2(3+)，Ki-67 25%(治疗后)", tnmStage: "ycT1N0M0", pathology: "新辅助治疗后残余癌灶待术后评估" },
  { diagnosisCode: "C50.912", diagnosisName: "乳腺癌术后局部复发", deptId: "D004", procedureCode: "85.2001", procedureName: "胸壁复发病灶切除术", bodyPart: "乳腺术区/胸壁", symptom: "乳腺癌术后瘢痕旁结节", sign: "胸壁瘢痕旁触及硬结", keyFinding: "术区皮下低回声结节，边界欠清，血流信号丰富", keyConclusion: "乳腺癌术后局部复发可疑", breastCancerCase: true, molecularSubtype: "ER 50%(+)，PR 10%(+)，HER2(2+，FISH阳性)，Ki-67 45%", tnmStage: "rT1N0M0", pathology: "复发浸润性癌待切除病理确认" },
  { diagnosisCode: "C50.913", diagnosisName: "双侧乳腺癌", deptId: "D004", procedureCode: "85.4201", procedureName: "双侧乳腺癌手术评估", bodyPart: "双侧乳腺/腋窝", symptom: "双侧乳腺分别发现肿块", sign: "双乳均可触及质硬结节", keyFinding: "双侧乳腺均见 BI-RADS 5 类病灶，腋窝未见明显融合淋巴结", keyConclusion: "双侧原发乳腺癌可能", breastCancerCase: true, molecularSubtype: "左 ER(+)/HER2(-)，右 ER(-)/HER2(3+)，Ki-67 分别 20%/55%", tnmStage: "左 cT1N0M0，右 cT2N0M0", pathology: "双侧乳腺浸润性癌，分子分型不同" },
  { diagnosisCode: "C50.914", diagnosisName: "男性乳腺癌", deptId: "D004", procedureCode: "85.4103", procedureName: "男性乳腺癌改良根治术", bodyPart: "乳腺/腋窝", symptom: "男性乳晕后肿块伴乳头内陷", sign: "乳晕后质硬肿块，乳头轻度内陷", keyFinding: "乳晕后不规则低回声肿块，边缘毛刺，BI-RADS 5", keyConclusion: "男性乳腺癌可能", breastCancerCase: true, molecularSubtype: "ER 95%(+)，PR 70%(+)，HER2(1+)，Ki-67 22%", tnmStage: "cT2N0M0 IIA期", pathology: "男性乳腺浸润性导管癌" },
  { diagnosisCode: "C50.915", diagnosisName: "遗传性乳腺癌 BRCA相关", deptId: "D004", procedureCode: "85.4202", procedureName: "乳腺癌手术+遗传咨询评估", bodyPart: "乳腺/卵巢风险评估", symptom: "年轻乳腺癌伴家族史", sign: "乳腺肿块，家族中有乳腺癌/卵巢癌史", keyFinding: "乳腺不规则肿块，增强 MRI 多灶强化，BI-RADS 5", keyConclusion: "BRCA 相关遗传性乳腺癌风险，建议遗传咨询", breastCancerCase: true, molecularSubtype: "ER(-)，PR(-)，HER2(0)，Ki-67 80%，BRCA1疑似致病变异", tnmStage: "cT2N0M0 IIA期", pathology: "高增殖三阴性乳腺癌" },
  { diagnosisCode: "C50.916", diagnosisName: "乳腺癌骨转移", deptId: "D004", procedureCode: "92.2901", procedureName: "骨转移评估及止痛/抗骨转移治疗", bodyPart: "乳腺/骨", symptom: "乳腺癌病史伴腰背痛", sign: "胸腰椎叩痛，神经定位体征阴性", keyFinding: "骨显像多发放射性浓聚灶，椎体斑片状异常信号", keyConclusion: "乳腺癌骨转移", breastCancerCase: true, molecularSubtype: "ER 80%(+)，PR 40%(+)，HER2(1+)，Ki-67 30%", tnmStage: "cM1 IV期", pathology: "骨转移灶病理待穿刺确认" },
  { diagnosisCode: "C50.917", diagnosisName: "乳腺癌肝转移", deptId: "D004", procedureCode: "88.0101", procedureName: "肝转移灶穿刺活检术", bodyPart: "乳腺/肝脏", symptom: "乳腺癌术后复查发现肝占位", sign: "肝区无明显叩痛，体重下降", keyFinding: "肝内多发低回声结节，增强呈环形强化", keyConclusion: "乳腺癌肝转移可能", breastCancerCase: true, molecularSubtype: "ER 30%(+)，PR(-)，HER2(3+)，Ki-67 50%", tnmStage: "cM1 IV期", pathology: "肝穿刺提示转移性乳腺癌待确认" },
  { diagnosisCode: "C50.918", diagnosisName: "乳腺癌肺转移伴恶性胸腔积液", deptId: "D004", procedureCode: "34.9102", procedureName: "胸腔穿刺置管引流+胸水细胞学检查", bodyPart: "乳腺/肺部/胸腔", symptom: "乳腺癌治疗后咳嗽胸闷，胸腔积液增多", sign: "患侧呼吸音减低，活动后气促", keyFinding: "胸腔液性暗区约 10cm，胸膜结节样增厚，双肺散在小结节", keyConclusion: "乳腺癌肺转移伴恶性胸腔积液可能", breastCancerCase: true, molecularSubtype: "ER(-)，PR(-)，HER2(3+)，Ki-67 58%", tnmStage: "cM1 IV期", pathology: "胸水细胞学查见异型上皮细胞待免疫确认", complicationFocus: "恶性胸腔积液" },
  { diagnosisCode: "C50.919", diagnosisName: "乳腺癌脑转移", deptId: "D004", procedureCode: "92.3001", procedureName: "脑转移放疗定位评估", bodyPart: "乳腺/头颅", symptom: "乳腺癌病史伴头痛头晕", sign: "神经系统查体未见明显偏瘫", keyFinding: "头颅 MRI 见多发强化结节，周围水肿", keyConclusion: "乳腺癌脑转移", breastCancerCase: true, molecularSubtype: "ER(-)，PR(-)，HER2(3+)，Ki-67 65%", tnmStage: "cM1 IV期", pathology: "结合病史及影像考虑脑转移" },
  { diagnosisCode: "C50.920", diagnosisName: "乳腺癌化疗后骨髓抑制伴静脉血栓风险", deptId: "D004", procedureCode: "99.2501", procedureName: "化疗并发症处理+VTE风险评估", bodyPart: "乳腺/血液系统/下肢静脉", symptom: "乳腺癌化疗后乏力，血小板持续偏低，下肢酸胀", sign: "皮肤散在瘀点，下肢轻度肿胀", keyFinding: "血常规示血小板降低，下肢静脉超声提示肌间静脉血栓可疑", keyConclusion: "化疗后骨髓抑制，需评估静脉血栓并规范支持治疗", breastCancerCase: true, molecularSubtype: "HER2低表达或三阴性治疗后状态，需结合原病理复核", tnmStage: "治疗中并发症评估", pathology: "既往乳腺癌病理明确，本次重点为化疗毒性和血栓风险", complicationFocus: "化疗并发症/静脉血栓" }
];

function diseaseProfileFor(index) {
  const profile = COHORT_DISEASE_CATALOG[index % COHORT_DISEASE_CATALOG.length];
  const profileWithDefaults = {
    ...profile,
    attendingDoctorId: profile.attendingDoctorId ?? (profile.deptId === "D005" ? "PRA002" : "PRA001"),
    surgeryLevel: profile.surgeryLevel ?? (profile.deptId === "D005" || profile.procedureName.includes("置换") ? "四级" : "三级"),
    anesthesiaMethod: profile.anesthesiaMethod ?? (profile.procedureName.includes("胃镜") || profile.procedureName.includes("肠镜") ? "静脉麻醉" : "全麻"),
    position: profile.position ?? (profile.deptId === "D006" ? "截石位" : "仰卧位"),
    examCode: profile.examCode ?? `EXAM-${profile.diagnosisCode.replace(/[^A-Z0-9]/gi, "")}`,
    examName: profile.examName ?? `${profile.bodyPart} CT/专科检查`,
    ultrasoundName: profile.ultrasoundName ?? `${profile.bodyPart}彩色多普勒超声`,
    specimenName: profile.specimenName ?? profile.diagnosisName.replace(/(伴.*|急性|慢性|3级|症)$/u, ""),
    drgCode: profile.drgCode ?? `CN${String(COHORT_DISEASE_CATALOG.indexOf(profile) + 1).padStart(3, "0")}`,
    drgName: profile.drgName ?? `${profile.diagnosisName}住院诊疗组`
  };
  if (profileWithDefaults.breastCancerCase) {
    const oncologyCase = /转移|化疗|新辅助|胸腔积液|骨髓抑制|静脉血栓/u.test(profile.diagnosisName);
    profileWithDefaults.deptId = oncologyCase ? "D011" : "D012";
    profileWithDefaults.attendingDoctorId = profile.attendingDoctorId ?? (oncologyCase ? "PRA008" : "PRA007");
    profileWithDefaults.examCode = profile.examCode ?? `MG-${profile.diagnosisCode.replace(/[^A-Z0-9]/gi, "")}`;
    profileWithDefaults.examName = profile.examName ?? "乳腺钼靶+乳腺MRI/专科评估";
    profileWithDefaults.ultrasoundName = profile.ultrasoundName ?? "乳腺及腋窝彩色多普勒超声";
    profileWithDefaults.modality = profile.modality ?? "MG";
    profileWithDefaults.specimenName = profile.specimenName ?? "乳腺肿瘤组织";
    profileWithDefaults.position = profile.position ?? "仰卧位，上肢外展";
    profileWithDefaults.surgeryLevel = profile.surgeryLevel ?? "四级";
    profileWithDefaults.drgName = profile.drgName ?? `${profile.diagnosisName}乳腺肿瘤综合治疗组`;
  }
  return {
    ...profileWithDefaults,
    examFinding: profile.examFinding ?? `${profile.bodyPart}检查提示：${profile.keyFinding}。`,
    examConclusion: profile.examConclusion ?? profile.keyConclusion,
    ultrasoundFinding: profile.ultrasoundFinding ?? `${profile.bodyPart}超声提示：${profile.keyFinding}。`,
    ultrasoundConclusion: profile.ultrasoundConclusion ?? profile.keyConclusion,
    chiefComplaint: profile.chiefComplaint ?? `${profile.symptom}。`,
    presentIllness: profile.presentIllness ?? `患者因${profile.symptom}入院，结合门诊及入院检查考虑${profile.diagnosisName}，拟完善术前/诊疗评估后行${profile.procedureName}。`,
    specialtyExam: profile.specialtyExam ?? profile.sign,
    preopSummary: profile.preopSummary ?? (
      profileWithDefaults.breastCancerCase
        ? `患者因${profile.diagnosisName}入院，乳腺专科评估已完善乳腺超声、钼靶/MRI、BI-RADS 分级、空芯针病理及 ER/PR/HER2/Ki-67 免疫组化，拟经乳腺外科-肿瘤内科-MDT 讨论后行${profile.procedureName}。`
        : `患者因${profile.diagnosisName}入院，已完善国内住院诊疗所需检查检验、知情同意和医保属性审核，拟行${profile.procedureName}。`
    )
  };
}

function diseaseProfileForJourney(state, journey) {
  const diagnosis = state.diagnoses.find((item) => item.encounterId === journey.encounterId && item.isPrimary)
    ?? state.diagnoses.find((item) => item.encounterId === journey.encounterId);
  const encounter = findById(state.encounters, "encounterId", journey.encounterId);
  if (encounter?.extendedClinicalProfile?.diagnosisCode) {
    const extendedIndex = COHORT_DISEASE_CATALOG.findIndex((item) => (
      item.diagnosisCode === encounter.extendedClinicalProfile.diagnosisCode
      && item.diagnosisName === encounter.extendedClinicalProfile.diagnosisName
    ));
    if (extendedIndex >= 0) {
      return diseaseProfileFor(extendedIndex);
    }
  }
  const index = COHORT_DISEASE_CATALOG.findIndex((item) => item.diagnosisCode === diagnosis?.diagnosisCode);
  if (index >= 0) {
    return diseaseProfileFor(index);
  }
  return {
    ...diseaseProfileFor(0),
    diagnosisCode: diagnosis?.diagnosisCode ?? "K80.200",
    diagnosisName: diagnosis?.diagnosisName ?? "胆囊结石伴慢性胆囊炎"
  };
}

function roundMoney(value) {
  return Math.round(Number(value || 0) * 100) / 100;
}

function insurancePolicyFor(patient) {
  if (patient?.insuranceType === "自费") {
    return {
      insuranceType: "自费",
      insuredPersonTypeCode: "SELF",
      insuredPersonTypeName: "自费人员",
      deductibleAmount: 0,
      reimbursementRatio: 0,
      personalAccountRatio: 0,
      policyName: "自费结算"
    };
  }
  if (patient?.insuranceType === "城乡居民") {
    return {
      insuranceType: "城乡居民",
      insuredPersonTypeCode: "390",
      insuredPersonTypeName: "城乡居民基本医疗保险参保人员",
      deductibleAmount: 800,
      reimbursementRatio: 0.65,
      personalAccountRatio: 0,
      policyName: "城乡居民基本医保普通住院模拟待遇"
    };
  }
  return {
    insuranceType: "城镇职工",
    insuredPersonTypeCode: "310",
    insuredPersonTypeName: "职工基本医疗保险参保人员",
    deductibleAmount: 800,
    reimbursementRatio: 0.82,
    personalAccountRatio: 0.35,
    policyName: "职工基本医保普通住院模拟待遇"
  };
}

function billingInsuranceParts(item) {
  const amount = roundMoney(item.amount ?? item.unitPrice ?? 0);
  const insuranceClass = item.insuranceClass ?? "甲类";
  const selfPayRatio = item.selfPayRatio ?? (insuranceClass === "乙类" ? 0.1 : insuranceClass === "自费" ? 1 : 0);
  const fullSelfPayAmount = insuranceClass === "自费" ? amount : 0;
  const priorSelfPayAmount = insuranceClass === "乙类" ? roundMoney(amount * selfPayRatio) : 0;
  const catalogPaymentScopeAmount = roundMoney(Math.max(amount - fullSelfPayAmount - priorSelfPayAmount, 0));
  return {
    amount,
    insuranceClass,
    selfPayRatio,
    fullSelfPayAmount,
    priorSelfPayAmount,
    catalogPaymentScopeAmount
  };
}

function calculateChinaInsuranceSettlement(state, journey, input = {}) {
  const patient = findById(state.patients, "patientId", journey.patientId);
  const policy = insurancePolicyFor(patient);
  const billingItems = (state.billingItems ?? []).filter((item) => item.journeyId === journey.journeyId);
  const parts = billingItems.map(billingInsuranceParts);
  const totalAmount = roundMoney(input.totalAmount ?? parts.reduce((sum, item) => sum + item.amount, 0));
  const fullSelfPayAmount = roundMoney(input.fullSelfPayAmount ?? parts.reduce((sum, item) => sum + item.fullSelfPayAmount, 0));
  const priorSelfPayAmount = roundMoney(input.priorSelfPayAmount ?? parts.reduce((sum, item) => sum + item.priorSelfPayAmount, 0));
  const catalogPaymentScopeAmount = roundMoney(input.catalogPaymentScopeAmount ?? parts.reduce((sum, item) => sum + item.catalogPaymentScopeAmount, 0));
  const deductibleAmount = roundMoney(input.deductibleAmount ?? Math.min(policy.deductibleAmount, catalogPaymentScopeAmount));
  const fundPayBaseAmount = roundMoney(Math.max(catalogPaymentScopeAmount - deductibleAmount, 0));
  const overallFundPaymentAmount = roundMoney(input.overallFundPaymentAmount ?? fundPayBaseAmount * policy.reimbursementRatio);
  const seriousIllnessFundPaymentAmount = roundMoney(input.seriousIllnessFundPaymentAmount ?? 0);
  const otherFundPaymentAmount = roundMoney(input.otherFundPaymentAmount ?? 0);
  const fundPaymentAmount = roundMoney(overallFundPaymentAmount + seriousIllnessFundPaymentAmount + otherFundPaymentAmount);
  const personalBurdenAmount = roundMoney(totalAmount - fundPaymentAmount);
  const personalAccountPaymentAmount = roundMoney(input.personalAccountPaymentAmount ?? Math.min(
    patient?.insuranceType === "城镇职工" ? personalBurdenAmount * policy.personalAccountRatio : 0,
    personalBurdenAmount
  ));
  const cashPaymentAmount = roundMoney(Math.max(personalBurdenAmount - personalAccountPaymentAmount, 0));
  return {
    policy,
    totalAmount,
    coveredAmount: fundPaymentAmount,
    selfPayAmount: personalBurdenAmount,
    catalogPaymentScopeAmount,
    fullSelfPayAmount,
    priorSelfPayAmount,
    deductibleAmount,
    fundPayBaseAmount,
    overallFundPaymentAmount,
    seriousIllnessFundPaymentAmount,
    otherFundPaymentAmount,
    fundPaymentAmount,
    personalAccountPaymentAmount,
    cashPaymentAmount
  };
}

function createCohortBasePatient(state, index, calendar = createCohortCalendar()) {
  const names = ["张某某", "刘某某", "王某某", "李某某", "陈某某", "赵某某", "孙某某", "周某某", "吴某某", "郑某某"];
  const disease = diseaseProfileFor(index);
  const dateStamp = calendar.operationDateStamp;
  const patient = createPatient(state, {
    name: names[index % names.length],
    gender: disease.diagnosisName.includes("男性乳腺癌") ? "男" : (disease.deptId === "D006" || disease.breastCancerCase) ? "女" : index % 3 === 0 ? "女" : "男",
    birthDate: `${1965 + (index % 35)}-${String((index % 12) + 1).padStart(2, "0")}-${String((index % 26) + 1).padStart(2, "0")}`,
    ageText: `${42 + (index % 28)}岁`,
    mpiNo: `MPI${dateStamp}${formatSerial(index)}`,
    idCardNo: `32030019${String(65 + (index % 35)).padStart(2, "0")}0101${String(index).padStart(4, "0")}`,
    phone: `138${String(index).padStart(8, "0")}`,
    address: `徐州市演示社区 ${index + 1} 号`,
    insuranceType: index % 10 === 0 ? "自费" : index % 3 === 0 ? "城乡居民" : "城镇职工",
    bloodType: ["A Rh+", "B Rh+", "O Rh+", "AB Rh+"][index % 4],
    allergyText: index % 9 === 0 ? "青霉素过敏" : "无"
  });

  const ward = state.wards.find((item) => item.deptId === disease.deptId) ?? state.wards[index % state.wards.length];
  const bed = {
    bedId: buildId("BED", state.counters),
    bedNo: `${String(8 + (index % 5)).padStart(2, "0")}${String(Math.floor(index / 5) + 1).padStart(2, "0")}-${String((index % 3) + 1).padStart(2, "0")}`,
    wardId: ward.wardId,
    roomNo: `${String(8 + (index % 5)).padStart(2, "0")}${String(Math.floor(index / 5) + 1).padStart(2, "0")}`,
    status: "Occupied",
    currentEncounterId: null
  };
  state.beds.push(bed);

  const encounterId = buildId("ENC", state.counters);
  const admissionId = buildId("ADM", state.counters);
  const diagnosisId = buildId("DIA", state.counters);
  const admissionDate = calendar.admissionDateFor(index);
  const startTime = `${admissionDate}T${String(8 + (index % 8)).padStart(2, "0")}:20:00+08:00`;

  const encounter = {
    encounterId,
    patientId: patient.patientId,
    encounterType: "住院",
    outpatientNo: null,
    inpatientNo: `ZY${dateStamp}${formatSerial(index)}`,
    visitNo: `VIS${dateStamp}${formatSerial(index)}`,
    deptId: disease.deptId,
    attendingDoctorId: disease.attendingDoctorId,
    extendedClinicalProfile: {
      diagnosisCode: disease.diagnosisCode,
      diagnosisName: disease.diagnosisName,
      procedureCode: disease.procedureCode,
      procedureName: disease.procedureName,
      breastCancerCase: Boolean(disease.breastCancerCase),
      molecularSubtype: disease.molecularSubtype ?? null,
      tnmStage: disease.tnmStage ?? null,
      complicationFocus: disease.complicationFocus ?? null
    },
    status: "Admitted",
    startTime,
    endTime: null
  };
  const admission = {
    admissionId,
    encounterId,
    wardId: ward.wardId,
    bedId: bed.bedId,
    admissionTime: startTime,
    dischargeTime: null,
    admissionDiagnosis: disease.diagnosisName,
    dischargeDiagnosis: null,
    nursingLevel: index % 5 === 0 ? "一级护理" : "二级护理",
    conditionLevel: "一般"
  };
  const diagnosis = {
    diagnosisId,
    encounterId,
    diagnosisCode: disease.diagnosisCode,
    diagnosisName: disease.diagnosisName,
    diagnosisType: "术前",
    isPrimary: true,
    recordedTime: startTime
  };

  bed.currentEncounterId = encounterId;
  state.encounters.push(encounter);
  state.admissions.push(admission);
  state.diagnoses.push(diagnosis);

  return { patient, encounter, admission, diagnosis, disease };
}

function createCohortReportsAndDocuments(state, index, patient, encounter, disease = diseaseProfileFor(index), calendar = createCohortCalendar()) {
  const labOrderId = buildId("ORD", state.counters);
  const examOrderId = buildId("ORD", state.counters);
  const ultrasoundOrderId = buildId("ORD", state.counters);
  const ecgOrderId = buildId("ORD", state.counters);
  const serial = formatSerial(index);
  const dateStamp = calendar.operationDateStamp;
  const isChole = isCholecystectomyProfile(disease);
  const lowPotassiumCritical = index > 0 && index % 13 === 0;
  const potassiumValue = lowPotassiumCritical ? "2.8" : "4.1";
  state.orders.push(
    {
      orderId: labOrderId,
      orderNo: `LAB${dateStamp}${serial}`,
      encounterId: encounter.encounterId,
      orderType: "检验",
      itemCode: isChole ? "PREOP_LAB_CHOLE" : "CBC",
      itemName: isChole ? "血常规+肝肾功能+电解质+凝血功能" : "血常规",
      status: "已确认",
      requesterDeptId: encounter.deptId,
      requesterId: encounter.attendingDoctorId,
      requestedTime: encounter.startTime,
      scheduledTime: encounter.startTime
    },
    {
      orderId: examOrderId,
      orderNo: `EXAM${dateStamp}${serial}`,
      encounterId: encounter.encounterId,
      orderType: "检查",
      itemCode: disease.examCode,
      itemName: disease.examName,
      status: "已确认",
      requesterDeptId: encounter.deptId,
      requesterId: encounter.attendingDoctorId,
      requestedTime: encounter.startTime,
      scheduledTime: encounter.startTime
    },
    {
      orderId: ultrasoundOrderId,
      orderNo: `US${dateStamp}${serial}`,
      encounterId: encounter.encounterId,
      orderType: "检查",
      itemCode: `US-${disease.diagnosisCode.replace(/[^A-Z0-9]/gi, "")}`,
      itemName: disease.ultrasoundName,
      status: "已确认",
      requesterDeptId: encounter.deptId,
      requesterId: encounter.attendingDoctorId,
      requestedTime: encounter.startTime,
      scheduledTime: encounter.startTime
    },
    {
      orderId: ecgOrderId,
      orderNo: `ECG${dateStamp}${serial}`,
      encounterId: encounter.encounterId,
      orderType: "检查",
      itemCode: "ECG-12",
      itemName: "十二导联心电图",
      status: "已确认",
      requesterDeptId: encounter.deptId,
      requesterId: encounter.attendingDoctorId,
      requestedTime: encounter.startTime,
      scheduledTime: encounter.startTime
    }
  );

  state.labReports.push({
    labReportId: buildId("LABR", state.counters),
    orderId: labOrderId,
    encounterId: encounter.encounterId,
    patientId: patient.patientId,
    sampleNo: `LAB${dateStamp}${serial}`,
    specimenType: "血液",
    reportName: isChole ? "术前血常规+生化+凝血" : "血常规",
    status: "Registered",
    reportTime: null,
    abnormalFlag: lowPotassiumCritical ? "Critical" : "Normal",
    items: isChole
      ? cholecystectomyLabItems({ potassium: potassiumValue })
      : [
        { code: "WBC", name: "白细胞", value: "6.2", unit: "10^9/L", referenceRange: "3.5-9.5", flag: "N" },
        { code: "HGB", name: "血红蛋白", value: "136", unit: "g/L", referenceRange: "115-150", flag: "N" },
        { code: "K", name: "血钾", value: potassiumValue, unit: "mmol/L", referenceRange: "3.5-5.3", flag: lowPotassiumCritical ? "LL" : "N" }
      ]
  });

  const accessionNo = `ACC${dateStamp}${serial}`;
  state.examReports.push({
    examReportId: buildId("EXR", state.counters),
    orderId: examOrderId,
    encounterId: encounter.encounterId,
    patientId: patient.patientId,
    accessionNo,
    modality: disease.modality ?? "CT",
    bodyPart: disease.bodyPart,
    finding: disease.examFinding,
    conclusion: disease.examConclusion,
    status: "Registered",
    reportTime: null
  });

  state.ultrasoundReports ??= [];
  state.ultrasoundReports.push({
    ultrasoundReportId: buildId("US", state.counters),
    orderId: ultrasoundOrderId,
    encounterId: encounter.encounterId,
    patientId: patient.patientId,
    accessionNo: `US${dateStamp}${serial}`,
    examName: disease.ultrasoundName,
    bodyPart: disease.bodyPart,
    finding: disease.ultrasoundFinding,
    conclusion: disease.ultrasoundConclusion,
    status: "Registered",
    performedTime: null,
    reportTime: null,
    images: [
      {
        imageNo: `US-${serial}-1`,
        view: isChole ? "胆囊长轴" : `${disease.bodyPart}长轴`,
        description: disease.keyFinding,
        imageUrl: isChole ? `/assets/imaging/1.2.826.0.1.3680043.10.543.${dateStamp}${serial}.700/preview.png` : null
      },
      {
        imageNo: `US-${serial}-2`,
        view: isChole ? "胆总管切面" : `${disease.bodyPart}补充切面`,
        description: disease.keyConclusion,
        imageUrl: isChole ? `/dicomweb/studies/1.2.826.0.1.3680043.10.543.${dateStamp}${serial}.700/series/1/instances/1/rendered` : null
      }
    ]
  });

  state.ecgReports ??= [];
  state.ecgReports.push({
    ecgReportId: buildId("ECG", state.counters),
    orderId: ecgOrderId,
    encounterId: encounter.encounterId,
    patientId: patient.patientId,
    examNo: `ECG${dateStamp}${serial}`,
    heartRate: 70 + (index % 12),
    rhythm: "窦性心律",
    prInterval: 148 + (index % 5) * 4,
    qrsDuration: 84 + (index % 4) * 2,
    qtInterval: 382 + (index % 8) * 3,
    finding: "P 波规律出现，QRS 波群时限正常，ST-T 未见明显异常改变。",
    conclusion: "窦性心律，正常范围心电图。",
    status: "Registered",
    performedTime: null,
    reportTime: null,
    waveform: [
      { lead: "I", note: "基线平稳" },
      { lead: "II", note: "节律规则" },
      { lead: "V5", note: "ST 段无明显压低" }
    ]
  });

  const studyInstanceUid = `1.2.826.0.1.3680043.10.543.${dateStamp}${serial}`;
  state.imagingStudies.push({
    imagingStudyId: buildId("IMG", state.counters),
    accessionNo,
    studyInstanceUid,
    patientId: patient.patientId,
    encounterId: encounter.encounterId,
    modality: disease.modality ?? "CT",
    studyDescription: disease.examName,
    bodyPart: disease.bodyPart,
    studyTime: encounter.startTime,
    dicomwebUrl: `/dicomweb/studies/${studyInstanceUid}`,
    dicomFileUrl: `/dicomweb/studies/${studyInstanceUid}/series/1/instances/1/file`,
    previewImageUrl: `/assets/imaging/${studyInstanceUid}/preview.png`,
    viewerUrl: `/viewer/studies/${studyInstanceUid}`,
    assetType: "脱敏合成DICOM测试片",
    assetNote: "用于系统联调和硬件测试，不含真实患者身份信息，不作为真实诊断依据。",
    standards: {
      dicom: "DICOM PS3.10 Part 10 文件 + DICOMweb 元数据模拟",
      report: disease.breastCancerCase ? "乳腺 BI-RADS、钼靶/超声/MRI 结构化报告字段" : "国内住院检查报告结构化字段"
    },
    breastCancerStructuredData: disease.breastCancerCase ? {
      biRads: disease.keyFinding.match(/BI-RADS\s*\w+/i)?.[0] ?? "BI-RADS 5",
      molecularSubtype: disease.molecularSubtype,
      tnmStage: disease.tnmStage,
      pathology: disease.pathology,
      complicationFocus: disease.complicationFocus ?? null,
      mdt: ["乳腺外科", "肿瘤内科", "影像科", "病理科", "放疗科"]
    } : null,
    series: [
      {
        seriesNo: "1",
        seriesDescription: disease.breastCancerCase ? "BREAST SYNTHETIC TEST IMAGE" : "AXIAL ABDOMEN 5mm",
        instanceCount: 36,
        renderedUrl: `/dicomweb/studies/${studyInstanceUid}/series/1/instances/1/rendered`,
        dicomFileUrl: `/dicomweb/studies/${studyInstanceUid}/series/1/instances/1/file`,
        keyImages: [
          { sopInstanceUid: `${studyInstanceUid}.1.12`, imageNo: 12, finding: disease.keyFinding },
          { sopInstanceUid: `${studyInstanceUid}.1.18`, imageNo: 18, finding: disease.keyConclusion }
        ]
      }
    ]
  });

  if (isChole) {
    const ultrasoundStudyInstanceUid = `${studyInstanceUid}.700`;
    state.imagingStudies.push({
      imagingStudyId: buildId("IMG", state.counters),
      accessionNo: `US${dateStamp}${serial}`,
      studyInstanceUid: ultrasoundStudyInstanceUid,
      patientId: patient.patientId,
      encounterId: encounter.encounterId,
      modality: "US",
      studyDescription: disease.ultrasoundName,
      bodyPart: "胆囊/胆总管",
      studyTime: encounter.startTime,
      dicomwebUrl: `/dicomweb/studies/${ultrasoundStudyInstanceUid}`,
      dicomFileUrl: `/dicomweb/studies/${ultrasoundStudyInstanceUid}/series/1/instances/1/file`,
      previewImageUrl: `/assets/imaging/${ultrasoundStudyInstanceUid}/preview.png`,
      viewerUrl: `/viewer/studies/${ultrasoundStudyInstanceUid}`,
      assetType: "脱敏合成B超DICOM测试片",
      assetNote: "模拟国内普外科胆囊结石术前腹部超声关键图像，供 PACS/DICOMweb 联调，不含真实患者身份信息。",
      standards: {
        dicom: "DICOM PS3.10 Part 10 文件 + DICOMweb 元数据模拟",
        report: "腹部超声结构化报告：胆囊大小、壁厚、结石大小、声影、胆总管内径"
      },
      series: [
        {
          seriesNo: "1",
          seriesDescription: "GALLBLADDER ULTRASOUND SYNTHETIC TEST IMAGE",
          instanceCount: 8,
          renderedUrl: `/dicomweb/studies/${ultrasoundStudyInstanceUid}/series/1/instances/1/rendered`,
          dicomFileUrl: `/dicomweb/studies/${ultrasoundStudyInstanceUid}/series/1/instances/1/file`,
          keyImages: [
            { sopInstanceUid: `${ultrasoundStudyInstanceUid}.1.1`, imageNo: 1, finding: "胆囊长轴：多发强回声伴声影" },
            { sopInstanceUid: `${ultrasoundStudyInstanceUid}.1.2`, imageNo: 2, finding: "胆总管切面：内径约 0.5cm，未见扩张" }
          ]
        }
      ]
    });
  }

  createDocument(state, {
    encounterId: encounter.encounterId,
    documentType: "PreoperativeSummary",
    title: "术前小结",
    authorId: disease.attendingDoctorId,
    deptId: disease.deptId,
    status: "Draft",
    contentText: disease.preopSummary
  });
  createDocument(state, {
    encounterId: encounter.encounterId,
    documentType: "AdmissionRecord",
    title: "入院记录",
    authorId: disease.attendingDoctorId,
    deptId: disease.deptId,
    status: "Final",
    signedTime: encounter.startTime,
    contentText: `患者因${disease.symptom}入院，结合检查检验考虑${disease.diagnosisName}，拟完善住院诊疗流程后行${disease.procedureName}。`,
    content: {
      chiefComplaint: disease.chiefComplaint,
      presentIllness: disease.presentIllness,
      pastHistory: index % 7 === 0 ? "既往有高血压病史 5 年，口服药物控制尚可。" : "既往体健，否认高血压、糖尿病、冠心病等慢性病史。",
      personalHistory: "生于本地，否认疫水及疫区接触史，否认长期大量饮酒。",
      allergyHistory: patient.allergyText || "无特殊药物及食物过敏史。",
      marriageHistory: "已婚，家属支持手术治疗。",
      menstrualObstetricHistory: patient.gender === "女" ? "月经史无特殊，否认妊娠。" : "无。",
      familyHistory: "否认家族遗传性疾病及传染病史。",
      physicalExam: "T 36.6℃，P 78 次/分，R 18 次/分，BP 126/78 mmHg。神志清楚，心肺听诊未闻及明显异常。",
      specialtyExam: disease.specialtyExam,
      breastCancerAssessment: disease.breastCancerCase ? {
        biRads: disease.keyFinding.match(/BI-RADS\s*\w+/i)?.[0] ?? "BI-RADS 5",
        molecularSubtype: disease.molecularSubtype,
        tnmStage: disease.tnmStage,
        pathology: disease.pathology,
        mdtPlan: "乳腺外科、肿瘤内科、影像科、病理科、放疗科 MDT 讨论后确定手术/新辅助/全身治疗路径。"
      } : null
    }
  });
}

function configureOperatingRoomCount(state, roomCount, reset = false) {
  if (roomCount === undefined || roomCount === null || roomCount === "") {
    return state.operatingRooms.length;
  }

  const target = Math.min(Math.max(Number.parseInt(roomCount, 10) || state.operatingRooms.length, 1), 60);
  if (reset && state.operatingRooms.length > target) {
    state.operatingRooms = state.operatingRooms.slice(0, target);
  }

  for (let index = state.operatingRooms.length + 1; index <= target; index += 1) {
    const roomId = `OR${String(index).padStart(2, "0")}`;
    state.operatingRooms.push({
      roomId,
      roomCode: `OR-${String(index).padStart(2, "0")}`,
      roomName: `${index} 号手术间`,
      roomType: index % 6 === 0 ? "复合" : index % 5 === 0 ? "日间" : "普通",
      deptId: "D002",
      floor: "3F",
      status: "Idle",
      videoSourceCode: `CAM-${roomId}`
    });
  }

  return state.operatingRooms.length;
}

function estimateCohortSurgeryMinutes(disease) {
  const name = disease.procedureName ?? "";
  const rules = [
    [/胆囊|胆道/u, 90],
    [/腹股沟疝/u, 75],
    [/胃镜|肠镜|息肉/u, 45],
    [/甲状腺/u, 120],
    [/乳腺.*改良根治|腋窝淋巴结清扫/u, 180],
    [/保乳|前哨淋巴结/u, 130],
    [/输液港/u, 45],
    [/髋|置换/u, 160],
    [/肺楔形|胸腔镜/u, 150],
    [/冠状动脉造影/u, 60],
    [/脑血管造影/u, 90],
    [/支气管镜|穿刺/u, 55]
  ];
  const matched = rules.find(([pattern]) => pattern.test(name));
  const byLevel = { "一级": 45, "二级": 70, "三级": 105, "四级": 150 };
  let minutes = matched ? matched[1] : (byLevel[disease.surgeryLevel] || 90);
  if (disease.surgeryLevel === "四级" && minutes < 150) {
    minutes += 30;
  }
  return minutes;
}

function createCohortSurgery(state, index, encounter, disease = diseaseProfileFor(index), calendar = createCohortCalendar()) {
  const request = createSurgeryRequest(state, {
    encounterId: encounter.encounterId,
    requesterDeptId: encounter.deptId,
    requesterId: encounter.attendingDoctorId,
    plannedSurgeryCode: disease.procedureCode,
    plannedSurgeryName: disease.procedureName,
    surgeryLevel: disease.surgeryLevel,
    anesthesiaMethod: disease.anesthesiaMethod,
    position: disease.position
  });
  const room = state.operatingRooms[index % state.operatingRooms.length];
  const surgeryDate = calendar.surgeryDateFor(index);
  const hour = 8 + (index % 8);
  const minuteOffset = (Math.floor(index / state.operatingRooms.length) % 3) * 10;
  const durationMinutes = estimateCohortSurgeryMinutes(disease);
  const startTime = `${surgeryDate}T${String(hour).padStart(2, "0")}:${String(20 + minuteOffset).padStart(2, "0")}:00+08:00`;
  const endTime = addMinutes(startTime, durationMinutes);
  const schedule = createSurgerySchedule(state, {
    surgeryRequestId: request.surgeryRequestId,
    scheduleDate: surgeryDate,
    roomId: room.roomId,
    tableNo: (index % 6) + 1,
    plannedStartTime: startTime,
    plannedEndTime: endTime
  });

  state.surgeryStaffAssignments.push(
    { assignmentId: buildId("SSA", state.counters), surgeryScheduleId: schedule.surgeryScheduleId, practitionerId: disease.attendingDoctorId, role: "主刀", sortNo: 1 },
    { assignmentId: buildId("SSA", state.counters), surgeryScheduleId: schedule.surgeryScheduleId, practitionerId: "PRA003", role: "麻醉医生", sortNo: 2 },
    { assignmentId: buildId("SSA", state.counters), surgeryScheduleId: schedule.surgeryScheduleId, practitionerId: "PRA004", role: "巡回护士", sortNo: 3 },
    { assignmentId: buildId("SSA", state.counters), surgeryScheduleId: schedule.surgeryScheduleId, practitionerId: "PRA005", role: "器械护士", sortNo: 4 }
  );

  return schedule;
}

export function simulatePatientJourneyCohort(state, input = {}) {
  const count = Math.min(Math.max(Number(input.count ?? 100), 1), 200);
  const templateId = input.templateId ?? "TPL_CHOLECYSTECTOMY_INPATIENT";
  const template = getTemplate(state, templateId);
  const reset = input.reset !== false;
  const calendar = createCohortCalendar(input.operationDate);

  if (reset) {
    resetClinicalCollectionsForCohort(state);
  }
  const roomCount = configureOperatingRoomCount(state, input.roomCount, reset);

  const created = [];
  const diseaseNames = new Set();
  const breastCancerNames = new Set();
  const startingIndex = state.patientJourneys.length;

  for (let index = 0; index < count; index += 1) {
    const absoluteIndex = startingIndex + index;
    const { patient, encounter, disease } = createCohortBasePatient(state, absoluteIndex, calendar);
    diseaseNames.add(disease.diagnosisName);
    if (disease.breastCancerCase) {
      breastCancerNames.add(disease.diagnosisName);
    }
    createCohortReportsAndDocuments(state, absoluteIndex, patient, encounter, disease, calendar);
    const schedule = createCohortSurgery(state, absoluteIndex, encounter, disease, calendar);
    const journey = createPatientJourney(state, {
      templateId: template.templateId,
      patientId: patient.patientId,
      encounterId: encounter.encounterId,
      surgeryScheduleId: schedule.surgeryScheduleId,
      simulatedTime: encounter.startTime,
      summary: `第 ${absoluteIndex + 1} 位${disease.diagnosisName}住院诊疗患者`
    });

    const targetProgress = Number.isInteger(input.initialProgressSteps)
      ? Math.min(Math.max(input.initialProgressSteps, 0), template.steps.length)
      : Math.floor((index / Math.max(count - 1, 1)) * template.steps.length);
    for (let stepIndex = 0; stepIndex < targetProgress; stepIndex += 1) {
      advancePatientJourney(state, journey.journeyId);
    }
    created.push(enrichPatientJourney(state, findById(state.patientJourneys, "journeyId", journey.journeyId)));
  }

  const summary = summarizePatientJourneys(state);
  logInterfaceMessage(state, {
    channelId: "CH000001",
    correlationId: `COHORT-${nowIso()}`,
    messageType: "journey.cohort_simulated",
    direction: "event",
    status: "success",
    responseBody: {
      requestedCount: count,
      createdCount: created.length,
      totalJourneys: summary.total,
      diseaseTypeCount: diseaseNames.size,
      breastCancerTypeCount: breastCancerNames.size
    }
  });

  return {
    createdCount: created.length,
    operationDate: calendar.operationDate,
    diseaseCatalogTotal: COHORT_DISEASE_CATALOG.length,
    diseaseTypeCount: diseaseNames.size,
    breastCancerTypeCount: breastCancerNames.size,
    roomCount,
    chinaStandardBaseline: CHINA_STANDARD_BASELINE,
    summary,
    items: created
  };
}

export function summarizePatientJourneys(state) {
  const phaseCounts = {
    入院: 0,
    术前: 0,
    术中: 0,
    术后: 0,
    出院: 0
  };
  const statusCounts = {
    ready: 0,
    running: 0,
    completed: 0,
    cancelled: 0
  };
  const surgeryStatusCounts = {};
  let totalProgress = 0;

  for (const journey of state.patientJourneys) {
    const template = getTemplate(state, journey.templateId);
    statusCounts[journey.status] = (statusCounts[journey.status] ?? 0) + 1;
    totalProgress += Math.max(journey.currentStepIndex + 1, 0);

    const step = journey.status === "completed"
      ? template.steps[template.steps.length - 1]
      : template.steps[Math.max(journey.currentStepIndex + 1, 0)] ?? template.steps[template.steps.length - 1];
    phaseCounts[step.phase] = (phaseCounts[step.phase] ?? 0) + 1;

    if (journey.surgeryScheduleId) {
      const schedule = findById(state.surgerySchedules, "surgeryScheduleId", journey.surgeryScheduleId);
      const status = schedule?.status ?? "Unknown";
      surgeryStatusCounts[status] = (surgeryStatusCounts[status] ?? 0) + 1;
    }
  }

  const total = state.patientJourneys.length;
  const template = state.journeyTemplates[0];
  const totalSteps = template?.steps?.length ?? 0;

  return {
    total,
    statusCounts,
    phaseCounts,
    surgeryStatusCounts,
    averageProgress: total && totalSteps ? Math.round((totalProgress / (total * totalSteps)) * 100) : 0,
    inHospital: state.encounters.filter((encounter) => encounter.status !== "Discharged").length,
    discharged: state.encounters.filter((encounter) => encounter.status === "Discharged").length,
    operating: state.surgerySchedules.filter((schedule) => ["InRoom", "AnesthesiaStarted", "SurgeryStarted", "SurgeryEnded"].includes(schedule.status)).length,
    waitingSurgery: state.surgerySchedules.filter((schedule) => ["Scheduled", "Called"].includes(schedule.status)).length
  };
}
