export const SURGERY_STATUS_LABELS = {
  Scheduled: "已排班",
  Called: "已接台",
  InRoom: "已入室",
  AnesthesiaStarted: "麻醉开始",
  SurgeryStarted: "手术开始",
  SurgeryEnded: "手术结束",
  OutRoom: "已出室",
  Cleaning: "清洁中",
  Completed: "已完成",
  Cancelled: "已取消"
};

const SURGERY_STATUS_BY_LABEL = Object.fromEntries(
  Object.entries(SURGERY_STATUS_LABELS).map(([code, label]) => [label, code])
);

const BUSINESS_VALUE_LABELS = {
  ...SURGERY_STATUS_LABELS,
  CleaningStarted: "清洁开始",
  CleaningCompleted: "清洁完成",
  Admitted: "住院中",
  Discharged: "已出院",
  PreAdmission: "入院准备",
  Occupied: "占用",
  Idle: "空闲",
  Available: "可用",
  Maintenance: "维护中",
  Paid: "已缴费",
  Unpaid: "未缴费",
  Settled: "已结算",
  Pending: "待处理",
  Open: "待处理",
  Closed: "已关闭",
  Online: "在线",
  Offline: "离线",
  Draft: "草稿",
  Final: "已签发",
  Registered: "已登记",
  Confirmed: "已确认",
  Ordered: "已开立",
  Reviewed: "已审核",
  Approved: "已审核",
  Rejected: "已驳回",
  Booked: "已预约",
  Collected: "已采集",
  Received: "已接收",
  Reported: "已出报告",
  Signed: "已签名",
  Published: "已发布",
  Archived: "已归档",
  Recording: "录制中",
  Dispensed: "已发药",
  Administered: "已执行",
  Standby: "备用",
  PRN: "备用（临时医嘱）",
  Active: "正常参保",
  Inactive: "暂停参保",
  Passed: "审核通过",
  Failed: "审核不通过",
  Prepared: "已备血",
  Issued: "已开具",
  NoInfection: "无院内感染",
  Infected: "发生院内感染",
  InProgress: "进行中",
  Stable: "病情平稳",
  Unstable: "病情不稳定",
  Delivered: "已送达",
  Accepted: "已接收",
  Coded: "病案已编码",
  Matched: "器械清点相符",
  Unmatched: "器械清点不符",
  TransferredOut: "已转出复苏室",
  TransferredIn: "转入复苏室",
  Ready: "达到出院标准",
  SelfPayConfirmed: "自费身份已确认",
  TypeScreened: "血型复核及抗体筛查已完成",
  ApprovedWithAlternative: "已审核并采用替代方案",
  Created: "已创建",
  Submitted: "已提交",
  Verified: "已核验",
  AlternativePrepared: "已备替代用药",
  Normal: "正常",
  Abnormal: "异常",
  Critical: "危急值",
  High: "偏高",
  Low: "偏低",
  Positive: "阳性",
  Negative: "阴性",
  N: "正常",
  Y: "异常",
  LL: "危急低值",
  active: "启用",
  inactive: "停用",
  enabled: "启用",
  disabled: "停用",
  ok: "正常",
  success: "成功",
  failed: "未通过",
  warning: "提醒",
  passed: "通过",
  info: "提示",
  error: "错误",
  ready: "待执行",
  running: "执行中",
  completed: "已完成",
  current: "当前",
  pending: "待执行",
  replayed: "已重放",
  cancelled: "已取消"
};

const STATUS_COUNT_KEYS = new Set([
  "statusCounts",
  "surgeryStatusCounts",
  "qualityStatusCounts",
  "paymentStatusCounts"
]);

const DATE_TIME_PATTERN = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(?::\d{2}(?:\.\d{1,3})?)?(?:Z|[+-]\d{2}:\d{2})?$/;

export function formatBeijingDateTime(value) {
  if (typeof value !== "string" || !DATE_TIME_PATTERN.test(value)) {
    return value;
  }
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return value;
  }

  const parts = new Intl.DateTimeFormat("zh-CN", {
    timeZone: "Asia/Shanghai",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false
  }).formatToParts(date);
  const part = (type) => parts.find((item) => item.type === type)?.value ?? "";
  return `${part("year")}-${part("month")}-${part("day")} ${part("hour")}:${part("minute")}`;
}

function isBusinessStatusKey(key) {
  const normalized = String(key).toLowerCase();
  return normalized === "status"
    || normalized.endsWith("status")
    || normalized === "result"
    || normalized === "eventtype"
    || normalized === "severity"
    || normalized.endsWith("flag")
    || normalized.includes("statusflag");
}

export function businessLabel(value) {
  if (typeof value !== "string") {
    return value;
  }
  return BUSINESS_VALUE_LABELS[value] ?? value;
}

export function toInternalSurgeryStatus(value) {
  return SURGERY_STATUS_BY_LABEL[value] ?? value;
}

export function normalizeBusinessTextForChina(value, parentKey = "") {
  if (Array.isArray(value)) {
    return value.map((item) => normalizeBusinessTextForChina(item, parentKey));
  }

  if (typeof value === "string") {
    if (isBusinessStatusKey(parentKey)) {
      return businessLabel(value);
    }
    return formatBeijingDateTime(value);
  }

  if (!value || typeof value !== "object" || Buffer.isBuffer(value)) {
    return value;
  }

  const result = {};
  for (const [key, item] of Object.entries(value)) {
    const outputKey = STATUS_COUNT_KEYS.has(key) ? "中文状态统计" : key;
    if (STATUS_COUNT_KEYS.has(key) && item && typeof item === "object" && !Array.isArray(item)) {
      result[outputKey] = Object.fromEntries(
        Object.entries(item).map(([status, count]) => [businessLabel(status), count])
      );
      continue;
    }

    if (isBusinessStatusKey(key) && typeof item === "string") {
      result[outputKey] = businessLabel(item);
      continue;
    }

    result[outputKey] = normalizeBusinessTextForChina(item, key);
  }

  return result;
}
