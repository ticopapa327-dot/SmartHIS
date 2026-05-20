import { enrichEncounter, enrichSurgerySchedule } from "./domain.js";

function bundle(type, entries) {
  return {
    resourceType: "Bundle",
    type: "searchset",
    total: entries.length,
    entry: entries.map((resource) => ({
      fullUrl: `${type}/${resource.id}`,
      resource
    }))
  };
}

export function toFhirPatient(patient) {
  return {
    resourceType: "Patient",
    id: patient.patientId,
    identifier: [
      { system: "urn:smarthis:mpi", value: patient.mpiNo },
      { system: "urn:smarthis:id-card", value: patient.idCardNo }
    ],
    name: [{ text: patient.name }],
    gender: patient.gender === "男" ? "male" : patient.gender === "女" ? "female" : "unknown",
    birthDate: patient.birthDate,
    telecom: [{ system: "phone", value: patient.phone }],
    address: [{ text: patient.address }]
  };
}

export function toFhirEncounter(state, encounter) {
  const enriched = enrichEncounter(state, encounter);
  return {
    resourceType: "Encounter",
    id: encounter.encounterId,
    status: encounter.status === "Admitted" ? "in-progress" : "finished",
    class: { code: encounter.encounterType },
    subject: { reference: `Patient/${encounter.patientId}`, display: enriched.patient?.name },
    serviceProvider: { reference: "Organization/ORG001" },
    period: { start: encounter.startTime, end: encounter.endTime ?? undefined },
    location: enriched.admission?.bedId ? [{ location: { reference: `Location/${enriched.admission.bedId}` } }] : []
  };
}

export function toFhirProcedure(state, schedule) {
  const enriched = enrichSurgerySchedule(state, schedule);
  return {
    resourceType: "Procedure",
    id: schedule.surgeryScheduleId,
    status: schedule.status === "Completed" ? "completed" : "in-progress",
    code: {
      coding: [{ system: "urn:smarthis:surgery-code", code: enriched.plannedSurgeryCode }],
      text: enriched.plannedSurgeryName
    },
    subject: { reference: `Patient/${enriched.patient.patientId}`, display: enriched.patient.name },
    encounter: { reference: `Encounter/${enriched.encounter.encounterId}` },
    performedPeriod: {
      start: schedule.actualStartTime ?? schedule.plannedStartTime,
      end: schedule.actualEndTime ?? schedule.plannedEndTime
    },
    location: { reference: `Location/${schedule.roomId}`, display: enriched.room?.roomName }
  };
}

export function toFhirDiagnosticReport(report, kind = "Lab") {
  return {
    resourceType: "DiagnosticReport",
    id: report.labReportId ?? report.examReportId,
    status: report.status === "Final" ? "final" : "registered",
    code: { text: report.reportName ?? report.bodyPart ?? "检查检验报告" },
    subject: { reference: `Patient/${report.patientId}` },
    encounter: { reference: `Encounter/${report.encounterId}` },
    effectiveDateTime: report.reportTime,
    conclusion: report.conclusion ?? undefined,
    category: [{ text: kind }]
  };
}

export function toFhirImagingStudy(study) {
  return {
    resourceType: "ImagingStudy",
    id: study.imagingStudyId,
    identifier: [{ system: "urn:dicom:accession-number", value: study.accessionNo }],
    status: "available",
    subject: { reference: `Patient/${study.patientId}` },
    encounter: { reference: `Encounter/${study.encounterId}` },
    started: study.studyTime,
    numberOfSeries: 1,
    numberOfInstances: 1,
    series: [
      {
        uid: `${study.studyInstanceUid}.1`,
        modality: { code: study.modality },
        instance: [{ uid: `${study.studyInstanceUid}.1.1`, sopClass: { code: "1.2.840.10008.5.1.4.1.1.2" } }]
      }
    ]
  };
}

export function toFhirDocumentReference(document) {
  return {
    resourceType: "DocumentReference",
    id: document.documentId,
    status: document.status === "Final" ? "current" : "preliminary",
    type: { text: document.documentType },
    subject: { reference: `Encounter/${document.encounterId}` },
    date: document.signedTime ?? document.createdTime,
    content: [
      {
        attachment: {
          contentType: "text/plain; charset=utf-8",
          title: document.title,
          data: Buffer.from(document.contentText, "utf8").toString("base64")
        }
      }
    ]
  };
}

export function fhirSearch(state, resourceType) {
  if (resourceType === "Patient") {
    return bundle("Patient", state.patients.map(toFhirPatient));
  }

  if (resourceType === "Encounter") {
    return bundle("Encounter", state.encounters.map((encounter) => toFhirEncounter(state, encounter)));
  }

  if (resourceType === "Procedure") {
    return bundle("Procedure", state.surgerySchedules.map((schedule) => toFhirProcedure(state, schedule)));
  }

  if (resourceType === "DiagnosticReport") {
    const reports = [
      ...state.labReports.map((report) => toFhirDiagnosticReport(report, "Lab")),
      ...state.examReports.map((report) => toFhirDiagnosticReport(report, "Exam"))
    ];
    return bundle("DiagnosticReport", reports);
  }

  if (resourceType === "ImagingStudy") {
    return bundle("ImagingStudy", state.imagingStudies.map(toFhirImagingStudy));
  }

  if (resourceType === "DocumentReference") {
    return bundle("DocumentReference", state.documents.map(toFhirDocumentReference));
  }

  return null;
}
