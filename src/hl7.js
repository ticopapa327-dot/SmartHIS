import { enrichEncounter, enrichSurgerySchedule, findById } from "./domain.js";
import { requireFound } from "./utils.js";

function timestamp(value = new Date()) {
  const date = value instanceof Date ? value : new Date(value);
  const pad = (input) => String(input).padStart(2, "0");
  return `${date.getFullYear()}${pad(date.getMonth() + 1)}${pad(date.getDate())}${pad(date.getHours())}${pad(date.getMinutes())}${pad(date.getSeconds())}`;
}

function msh(messageType) {
  return `MSH|^~\\&|SmartHIS|SmartHIS|SmartProduct|Shoushi|${timestamp()}||${messageType}|MSG${timestamp()}|P|2.5`;
}

function pid(patient) {
  return `PID|||${patient.patientId}^^^SmartHIS^PI||${patient.name}||${patient.birthDate.replaceAll("-", "")}|${patient.gender === "男" ? "M" : "F"}|||${patient.address}||${patient.phone}|||${patient.insuranceType}||${patient.idCardNo}`;
}

function pv1(encounter, deptName) {
  return `PV1||${encounter.encounterType === "住院" ? "I" : "O"}|${encounter.deptId}^${deptName ?? ""}||||${encounter.attendingDoctorId ?? ""}|||||||||||${encounter.inpatientNo ?? encounter.outpatientNo ?? encounter.visitNo}`;
}

export function buildHl7Message(state, messageType, options = {}) {
  if (messageType === "ADT_A01") {
    const encounter = enrichEncounter(
      state,
      requireFound(
        findById(state.encounters, "encounterId", options.encounterId ?? state.encounters[0]?.encounterId),
        "Encounter was not found."
      )
    );
    return [
      msh("ADT^A01"),
      pid(encounter.patient),
      pv1(encounter, encounter.department?.deptName)
    ].join("\r");
  }

  if (messageType === "ORM_O01") {
    const schedule = enrichSurgerySchedule(
      state,
      requireFound(
        findById(state.surgerySchedules, "surgeryScheduleId", options.surgeryScheduleId ?? state.surgerySchedules[0]?.surgeryScheduleId),
        "Surgery schedule was not found."
      )
    );
    return [
      msh("ORM^O01"),
      pid(schedule.patient),
      pv1(schedule.encounter, findById(state.departments, "deptId", schedule.encounter.deptId)?.deptName),
      `ORC|NW|${schedule.request.orderId}|${schedule.surgeryNo}||${schedule.status}`,
      `OBR|1|${schedule.request.orderId}|${schedule.surgeryNo}|${schedule.plannedSurgeryCode}^${schedule.plannedSurgeryName}|||${timestamp(schedule.plannedStartTime)}`
    ].join("\r");
  }

  if (messageType === "SIU_S12") {
    const schedule = enrichSurgerySchedule(
      state,
      requireFound(
        findById(state.surgerySchedules, "surgeryScheduleId", options.surgeryScheduleId ?? state.surgerySchedules[0]?.surgeryScheduleId),
        "Surgery schedule was not found."
      )
    );
    const surgeon = schedule.staff.find((item) => item.role === "主刀")?.practitioner;
    return [
      msh("SIU^S12"),
      `SCH|${schedule.surgeryScheduleId}|${schedule.surgeryNo}|||||${schedule.plannedSurgeryName}|||${timestamp(schedule.plannedStartTime)}|${timestamp(schedule.plannedEndTime)}`,
      pid(schedule.patient),
      pv1(schedule.encounter, findById(state.departments, "deptId", schedule.encounter.deptId)?.deptName),
      `AIP|1||${surgeon?.practitionerId ?? ""}^${surgeon?.name ?? ""}^SURGEON`,
      `AIL|1||${schedule.room?.roomCode ?? ""}^${schedule.room?.roomName ?? ""}`
    ].join("\r");
  }

  throw new Error(`Unsupported HL7 message type: ${messageType}`);
}
