import { formatBeijingDateTime } from "./china-standard.js";
import { findById, logInterfaceMessage } from "./domain.js";
import {
  advancePatientJourney,
  simulatePatientJourneyCohort,
  summarizePatientJourneys
} from "./journey.js";
import { beijingDateString } from "./hospital-clock.js";

const DEFAULT_CONFIG = {
  patientCount: 50,
  roomCount: 6,
  dailyNewPatients: 6,
  maxStepsPerTick: 160,
  tickIntervalMs: 30_000
};

function normalizeConfig(options = {}) {
  return {
    patientCount: Math.min(Math.max(Number(options.patientCount ?? DEFAULT_CONFIG.patientCount), 1), 200),
    roomCount: Math.min(Math.max(Number(options.roomCount ?? DEFAULT_CONFIG.roomCount), 1), 60),
    dailyNewPatients: Math.min(Math.max(Number(options.dailyNewPatients ?? DEFAULT_CONFIG.dailyNewPatients), 0), 80),
    maxStepsPerTick: Math.min(Math.max(Number(options.maxStepsPerTick ?? DEFAULT_CONFIG.maxStepsPerTick), 1), 10_000),
    tickIntervalMs: Math.max(Number(options.tickIntervalMs ?? DEFAULT_CONFIG.tickIntervalMs), 0),
    operationDate: options.operationDate,
    now: options.now
  };
}

function nowDate(value) {
  const date = value ? new Date(value) : new Date();
  return Number.isNaN(date.getTime()) ? new Date() : date;
}

function beijingHour(date) {
  const hour = new Intl.DateTimeFormat("zh-CN", {
    timeZone: "Asia/Shanghai",
    hour: "2-digit",
    hour12: false
  }).format(date);
  return Number(hour);
}

function nextJourneyDueTime(state, journey) {
  if (journey.status === "completed" || journey.status === "cancelled") {
    return null;
  }
  const template = findById(state.journeyTemplates, "templateId", journey.templateId);
  const step = template?.steps?.[journey.currentStepIndex + 1];
  if (!step) {
    return null;
  }
  const baseTime = new Date(journey.simulatedTime ?? journey.startedTime ?? new Date());
  if (Number.isNaN(baseTime.getTime())) {
    return null;
  }
  return {
    journey,
    step,
    dueTime: new Date(baseTime.getTime() + Number(step.defaultOffsetMinutes ?? 0) * 60_000)
  };
}

function advanceDueJourneys(state, now, maxStepsPerTick) {
  const advanced = [];
  let remaining = maxStepsPerTick;

  while (remaining > 0) {
    const next = state.patientJourneys
      .map((journey) => nextJourneyDueTime(state, journey))
      .filter((item) => item && item.dueTime.getTime() <= now.getTime())
      .sort((left, right) => left.dueTime.getTime() - right.dueTime.getTime())[0];

    if (!next) {
      break;
    }

    const result = advancePatientJourney(state, next.journey.journeyId);
    if (!result.event) {
      break;
    }
    advanced.push({
      旅程ID: next.journey.journeyId,
      患者ID: next.journey.patientId,
      步骤名称: result.event.stepName,
      业务阶段: result.event.phase,
      事件时间: formatBeijingDateTime(result.event.eventTime)
    });
    remaining -= 1;
  }

  return advanced;
}

function ensureOperationState(state, config, now, rebuild = false) {
  const operationDate = config.operationDate ?? beijingDateString(now);
  const shouldBuild = rebuild
    || !state.hospitalOperation?.initialized
    || !Array.isArray(state.patientJourneys)
    || state.patientJourneys.length < Math.min(config.patientCount, 20);

  if (shouldBuild) {
    const cohort = simulatePatientJourneyCohort(state, {
      count: config.patientCount,
      reset: true,
      roomCount: config.roomCount,
      operationDate,
      initialProgressSteps: 0
    });
    state.hospitalOperation = {
      initialized: true,
      enabled: true,
      mode: "按北京时间自然演进",
      startedAt: now.toISOString(),
      operationDate,
      targetPatientCount: config.patientCount,
      roomCount: config.roomCount,
      dailyNewPatients: config.dailyNewPatients,
      dailyAdmissionLedger: { [operationDate]: countAdmissionsOnDate(state, operationDate) },
      tickCount: 0,
      lastRebuildResult: {
        createdCount: cohort.createdCount,
        diseaseTypeCount: cohort.diseaseTypeCount,
        breastCancerTypeCount: cohort.breastCancerTypeCount
      }
    };
  }

  state.hospitalOperation.enabled = true;
  state.hospitalOperation.operationDate = operationDate;
  state.hospitalOperation.targetPatientCount = config.patientCount;
  state.hospitalOperation.roomCount = config.roomCount;
  state.hospitalOperation.dailyNewPatients = config.dailyNewPatients;
  state.hospitalOperation.dailyAdmissionLedger ??= {};
  state.hospitalOperation.dailyAdmissionLedger[operationDate] ??= 0;
  return state.hospitalOperation;
}

function countAdmissionsOnDate(state, operationDate) {
  return (state.admissions ?? []).filter((item) => String(item.admissionTime ?? "").startsWith(operationDate)).length;
}

function maybeCreateDailyAdmissions(state, config, now, operationDate) {
  const op = state.hospitalOperation;
  const hour = beijingHour(now);
  if (config.dailyNewPatients <= 0 || hour < 7 || hour > 18) {
    return 0;
  }

  const createdToday = op.dailyAdmissionLedger[operationDate] ?? 0;
  const remaining = Math.max(config.dailyNewPatients - createdToday, 0);
  if (!remaining) {
    return 0;
  }

  const batchSize = Math.min(remaining, Math.max(1, Math.ceil(config.dailyNewPatients / 6)));
  const result = simulatePatientJourneyCohort(state, {
    count: batchSize,
    reset: false,
    roomCount: config.roomCount,
    operationDate,
    initialProgressSteps: 2
  });
  op.dailyAdmissionLedger[operationDate] = createdToday + result.createdCount;
  return result.createdCount;
}

function surgeryLoad(state) {
  const activeStatuses = new Set(["Called", "InRoom", "AnesthesiaStarted", "SurgeryStarted", "SurgeryEnded"]);
  const schedules = state.surgerySchedules.filter((item) => item.scheduleDate === state.hospitalOperation?.operationDate);
  return {
    今日手术台次: schedules.length,
    术中台次: schedules.filter((item) => activeStatuses.has(item.status)).length,
    待接台台次: schedules.filter((item) => ["Scheduled", "Called"].includes(item.status)).length,
    已完成台次: schedules.filter((item) => ["OutRoom", "Cleaning", "Completed"].includes(item.status)).length
  };
}

export function initializeNaturalHospitalOperation(state, options = {}) {
  const config = normalizeConfig(options);
  const now = nowDate(config.now);
  ensureOperationState(state, config, now, Boolean(options.rebuild));
  const catchUpSteps = options.initialCatchUpSteps
    ?? Math.max(config.maxStepsPerTick, config.patientCount * 45);
  return tickNaturalHospitalOperation(state, { ...config, now, maxStepsPerTick: catchUpSteps });
}

export function tickNaturalHospitalOperation(state, options = {}) {
  const current = state.hospitalOperation ?? {};
  const config = normalizeConfig({
    patientCount: current.targetPatientCount,
    roomCount: current.roomCount,
    dailyNewPatients: current.dailyNewPatients,
    ...options
  });
  const now = nowDate(config.now);
  const operationDate = config.operationDate ?? beijingDateString(now);
  const op = ensureOperationState(state, { ...config, operationDate }, now, Boolean(options.rebuild));

  if (op.operationDate !== operationDate) {
    op.operationDate = operationDate;
    op.dailyAdmissionLedger[operationDate] ??= 0;
  }

  const createdAdmissions = maybeCreateDailyAdmissions(state, config, now, operationDate);
  const advanced = advanceDueJourneys(state, now, config.maxStepsPerTick);
  const summary = summarizePatientJourneys(state);

  op.tickCount += 1;
  op.lastTickAt = now.toISOString();
  op.lastTickResult = {
    createdAdmissions,
    advancedSteps: advanced.length,
    sampleAdvancedSteps: advanced.slice(0, 12)
  };

  if (createdAdmissions > 0 || advanced.length > 0) {
    logInterfaceMessage(state, {
      channelId: "CH000001",
      correlationId: `HOSPITAL-OPERATION-${operationDate}`,
      messageType: "hospital.operation.tick",
      direction: "event",
      status: "success",
      responseBody: {
        operationDate,
        createdAdmissions,
        advancedSteps: advanced.length,
        inHospital: summary.inHospital,
        discharged: summary.discharged,
        operating: summary.operating
      }
    });
  }

  return getNaturalHospitalOperationStatus(state);
}

export function getNaturalHospitalOperationStatus(state) {
  const op = state.hospitalOperation ?? {};
  const summary = summarizePatientJourneys(state);
  return {
    运行状态: op.enabled ? "已启用" : "未启用",
    运行模式: op.mode ?? "未启用",
    当前业务日期: op.operationDate ?? beijingDateString(),
    当前北京时间: formatBeijingDateTime(new Date().toISOString()),
    启动时间: formatBeijingDateTime(op.startedAt ?? null),
    最近推进时间: formatBeijingDateTime(op.lastTickAt ?? null),
    已推进次数: op.tickCount ?? 0,
    目标在院模拟人数: op.targetPatientCount ?? 0,
    开放手术间数量: op.roomCount ?? 0,
    今日计划入院人数: op.dailyNewPatients ?? 0,
    今日已生成入院人数: op.dailyAdmissionLedger?.[op.operationDate] ?? 0,
    本次推进步骤数: op.lastTickResult?.advancedSteps ?? 0,
    本次新增入院人数: op.lastTickResult?.createdAdmissions ?? 0,
    最近推进样例: op.lastTickResult?.sampleAdvancedSteps ?? [],
    手术负荷: surgeryLoad(state),
    患者流转摘要: summary,
    状态说明: "系统按北京时间自动生成新入院患者，并按旅程事件时间推进检查、手术、复苏、收费、出院和随访。"
  };
}

export function startNaturalHospitalOperation(state, options = {}) {
  const config = normalizeConfig({
    patientCount: process.env.SMARTHIS_NATURAL_PATIENT_COUNT,
    roomCount: process.env.SMARTHIS_NATURAL_ROOM_COUNT,
    dailyNewPatients: process.env.SMARTHIS_NATURAL_DAILY_ADMISSIONS,
    tickIntervalMs: process.env.SMARTHIS_NATURAL_TICK_MS,
    ...options
  });
  initializeNaturalHospitalOperation(state, config);

  let timer = null;
  if (config.tickIntervalMs > 0) {
    timer = setInterval(() => {
      try {
        tickNaturalHospitalOperation(state, config);
      } catch (error) {
        state.hospitalOperation ??= {};
        state.hospitalOperation.lastError = {
          message: error.message,
          time: new Date().toISOString()
        };
      }
    }, config.tickIntervalMs);
    timer.unref?.();
  }

  return {
    stop() {
      if (timer) {
        clearInterval(timer);
        timer = null;
      }
      if (state.hospitalOperation) {
        state.hospitalOperation.enabled = false;
      }
    },
    tick(input = {}) {
      return tickNaturalHospitalOperation(state, { ...config, ...input });
    },
    status() {
      return getNaturalHospitalOperationStatus(state);
    }
  };
}
