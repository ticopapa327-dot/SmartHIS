import { findById } from "./domain.js";
import { HttpError } from "./utils.js";

function maskIdCard(idCardNo = "") {
  const value = String(idCardNo);
  if (value.length < 10) {
    return value ? `${value.slice(0, 2)}****` : "";
  }
  return `${value.slice(0, 6)}********${value.slice(-4)}`;
}

function formatReportSummary(reports = []) {
  return reports
    .filter(Boolean)
    .map((report) => {
      const name = report.reportName || report.examName || report.bodyPart || report.modality || "检查";
      const result = report.conclusion || report.finding || report.status || "";
      return `${name}: ${result}`;
    })
    .filter(Boolean)
    .join("；");
}

function latestAdmissionRecord(state, encounterId) {
  return state.documents
    .filter((document) => document.encounterId === encounterId && document.documentType === "AdmissionRecord")
    .sort((left, right) => String(right.createdTime).localeCompare(String(left.createdTime)))[0] ?? null;
}

function defaultHistory(patient, diagnosisName) {
  return {
    chiefComplaint: "反复右上腹胀痛不适 1 月余，加重 1 天。",
    presentIllness: "患者进食油腻后出现右上腹阵发性胀痛，偶伴恶心，无寒战高热，无皮肤巩膜黄染，无陶土样便。门诊腹部超声提示胆囊多发结石伴慢性胆囊炎，胆总管未见扩张，收入普通外科择期手术治疗。",
    pastHistory: "既往体健，否认高血压、糖尿病、冠心病等慢性病史。",
    personalHistory: "生于本地，否认疫水、疫区接触史，否认长期饮酒史。",
    allergyHistory: patient.allergyText || "无特殊药物及食物过敏史。",
    marriageHistory: "已婚，配偶及家属支持治疗。",
    menstrualObstetricHistory: patient.gender === "女" ? "月经史无特殊，否认妊娠。" : "无。",
    familyHistory: "否认家族遗传性疾病及传染病史。",
    physicalExam: "T 36.6℃，P 78 次/分，R 18 次/分，BP 126/78 mmHg。神志清楚，心肺听诊未闻及明显异常。",
    specialtyExam: "腹平软，右上腹轻压痛，无反跳痛及肌紧张，Murphy 征阴性或可疑阳性，未触及包块，肝脾肋下未及，皮肤巩膜无黄染。",
    diagnosis: diagnosisName || "胆囊结石伴慢性胆囊炎"
  };
}

export function buildHisPatientEntity(state, query = {}) {
  const patient = state.patients.find((item) => (
    (query.idCard && item.idCardNo === query.idCard)
    || (query.patientId && item.patientId === query.patientId)
    || (query.mpiNo && item.mpiNo === query.mpiNo)
  ));

  if (!patient) {
    throw new HttpError(404, "未查询到患者信息。");
  }

  const encounter = state.encounters
    .filter((item) => item.patientId === patient.patientId)
    .sort((left, right) => String(right.startTime).localeCompare(String(left.startTime)))[0];
  if (!encounter) {
    throw new HttpError(404, "未查询到患者就诊信息。");
  }

  const admission = state.admissions.find((item) => item.encounterId === encounter.encounterId) ?? null;
  const diagnosis = state.diagnoses.find((item) => item.encounterId === encounter.encounterId && item.isPrimary)
    ?? state.diagnoses.find((item) => item.encounterId === encounter.encounterId)
    ?? null;
  const department = findById(state.departments, "deptId", encounter.deptId) ?? null;
  const doctor = findById(state.practitioners, "practitionerId", encounter.attendingDoctorId) ?? null;
  const admissionRecord = latestAdmissionRecord(state, encounter.encounterId);
  const history = {
    ...defaultHistory(patient, diagnosis?.diagnosisName),
    ...(admissionRecord?.content ?? {})
  };

  const labReports = state.labReports.filter((item) => item.encounterId === encounter.encounterId);
  const examReports = state.examReports.filter((item) => item.encounterId === encounter.encounterId);
  const ultrasoundReports = (state.ultrasoundReports ?? []).filter((item) => item.encounterId === encounter.encounterId);
  const ecgReports = (state.ecgReports ?? []).filter((item) => item.encounterId === encounter.encounterId);
  const reportSummary = formatReportSummary([
    ...labReports.map((report) => ({
      reportName: report.reportName,
      conclusion: report.items?.map((item) => `${item.name}${item.value}${item.unit ?? ""}`).join("，")
    })),
    ...examReports,
    ...ultrasoundReports,
    ...ecgReports
  ]);

  return {
    xh: patient.patientId,
    brbh: patient.patientId,
    blh: encounter.inpatientNo || encounter.outpatientNo || encounter.visitNo,
    hzxm: patient.name,
    hzxb: patient.gender,
    birth: patient.birthDate,
    zjlx: "01",
    zjlxStr: "居民身份证",
    sfzh: patient.idCardNo,
    sfzhHide: maskIdCard(patient.idCardNo),
    lxdh: patient.phone,
    lxdz: patient.address,
    jzks: department?.deptName ?? encounter.deptId,
    ryrq: admission?.admissionTime ?? encounter.startTime,
    hzzs: history.chiefComplaint,
    hzxbs: history.presentIllness,
    hzjws: history.pastHistory,
    hzgrs: history.personalHistory,
    hzyjs: history.allergyHistory,
    hzhys: history.marriageHistory,
    hzycs: history.menstrualObstetricHistory,
    hzjzs: history.familyHistory,
    hztgjc: history.physicalExam,
    hzbkjc: history.specialtyExam,
    hzfzjc: reportSummary || "术前检查资料已申请，待检查报告回传。",
    hzcbzd: diagnosis?.diagnosisName ?? admission?.admissionDiagnosis ?? history.diagnosis,
    ysqm: doctor?.name ?? encounter.attendingDoctorId
  };
}

export function buildHisPatientResponse(state, query = {}) {
  try {
    const entity = buildHisPatientEntity(state, query);
    return {
      status: 0,
      message: "查询成功",
      code: "SUCCESS",
      successMessage: "查询成功",
      errorMessage: "",
      entity,
      data: null,
      errorList: []
    };
  } catch (error) {
    if (error instanceof HttpError && error.status === 404) {
      return {
        status: 1,
        message: error.message,
        code: "FAIL",
        successMessage: "",
        errorMessage: error.message,
        entity: null,
        data: null,
        errorList: [error.message]
      };
    }
    throw error;
  }
}
