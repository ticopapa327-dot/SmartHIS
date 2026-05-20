export function renderConsoleHtml() {
  return `<!doctype html>
<html lang="zh-CN">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>首视医院业务仿真控制台</title>
  <style>
    :root {
      color-scheme: light;
      --bg: #f6f7f9;
      --panel: #ffffff;
      --text: #1d232a;
      --muted: #66717f;
      --line: #d9dee7;
      --brand: #176b72;
      --brand-2: #4a6fa5;
      --accent: #d58936;
      --danger: #b23a48;
      --ok: #2f7d4f;
      font-family: "Microsoft YaHei", "Segoe UI", Arial, sans-serif;
    }

    * {
      box-sizing: border-box;
    }

    body {
      margin: 0;
      background: var(--bg);
      color: var(--text);
    }

    header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 16px;
      padding: 16px 24px;
      border-bottom: 1px solid var(--line);
      background: var(--panel);
      position: sticky;
      top: 0;
      z-index: 2;
    }

    h1 {
      margin: 0;
      font-size: 20px;
      font-weight: 700;
      letter-spacing: 0;
    }

    h2 {
      margin: 0 0 12px;
      font-size: 16px;
      letter-spacing: 0;
    }

    button {
      border: 1px solid var(--brand);
      background: var(--brand);
      color: white;
      border-radius: 6px;
      height: 34px;
      padding: 0 12px;
      font-size: 14px;
      cursor: pointer;
      white-space: nowrap;
    }

    button.secondary {
      background: white;
      color: var(--brand);
    }

    .link-button {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      border: 1px solid var(--brand);
      background: white;
      color: var(--brand);
      border-radius: 6px;
      height: 34px;
      padding: 0 12px;
      font-size: 14px;
      text-decoration: none;
      white-space: nowrap;
    }

    button.warning {
      background: var(--accent);
      border-color: var(--accent);
    }

    main {
      max-width: 1440px;
      margin: 0 auto;
      padding: 20px 24px 40px;
    }

    .topbar {
      display: flex;
      align-items: center;
      gap: 10px;
      flex-wrap: wrap;
    }

    .header-clock {
      color: var(--brand);
      font-size: 15px;
      font-weight: 700;
      white-space: nowrap;
      padding: 7px 10px;
      border: 1px solid var(--line);
      border-radius: 6px;
      background: #f9fbfc;
    }

    .grid {
      display: grid;
      grid-template-columns: repeat(4, minmax(0, 1fr));
      gap: 14px;
      margin-bottom: 18px;
    }

    .phase-grid {
      display: grid;
      grid-template-columns: repeat(5, minmax(0, 1fr));
      gap: 10px;
      margin-bottom: 18px;
    }

    .phase-item {
      border: 1px solid var(--line);
      border-radius: 8px;
      background: var(--panel);
      padding: 12px;
      min-height: 68px;
    }

    .phase-item .label {
      color: var(--muted);
      font-size: 13px;
      margin-bottom: 6px;
    }

    .phase-item .value {
      font-size: 22px;
      font-weight: 700;
    }

    .metric {
      background: var(--panel);
      border: 1px solid var(--line);
      border-radius: 8px;
      padding: 14px;
      min-height: 84px;
    }

    .metric .label {
      color: var(--muted);
      font-size: 13px;
      margin-bottom: 8px;
    }

    .metric .value {
      font-size: 28px;
      font-weight: 700;
    }

    .operation-status {
      display: grid;
      grid-template-columns: repeat(6, minmax(0, 1fr));
      gap: 10px;
      margin-bottom: 18px;
    }

    .operation-item {
      border: 1px solid var(--line);
      border-radius: 8px;
      padding: 10px 12px;
      background: #fbfcfd;
      min-height: 64px;
    }

    .operation-item .label {
      color: var(--muted);
      font-size: 12px;
      margin-bottom: 6px;
    }

    .operation-item .value {
      font-size: 17px;
      font-weight: 700;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }

    .layout {
      display: grid;
      grid-template-columns: minmax(0, 1.5fr) minmax(320px, 0.7fr);
      gap: 16px;
    }

    section {
      background: var(--panel);
      border: 1px solid var(--line);
      border-radius: 8px;
      padding: 16px;
      min-width: 0;
    }

    table {
      width: 100%;
      border-collapse: collapse;
      table-layout: fixed;
    }

    th, td {
      border-bottom: 1px solid var(--line);
      padding: 10px 8px;
      text-align: left;
      vertical-align: middle;
      font-size: 14px;
      overflow: hidden;
      text-overflow: ellipsis;
    }

    th {
      color: var(--muted);
      font-weight: 600;
      background: #fafbfc;
    }

    tr:last-child td {
      border-bottom: 0;
    }

    .status {
      display: inline-flex;
      align-items: center;
      min-width: 92px;
      justify-content: center;
      height: 28px;
      padding: 0 8px;
      border-radius: 999px;
      background: #edf3f3;
      color: var(--brand);
      font-size: 13px;
      font-weight: 600;
    }

    .status.SurgeryStarted,
    .status.InRoom,
    .status.AnesthesiaStarted,
    .status.active {
      background: #eef2fb;
      color: var(--brand-2);
    }

    .status.Cleaning,
    .status.cleaning {
      background: #fff4e6;
      color: var(--accent);
    }

    .status.Completed,
    .status.done {
      background: #edf7f0;
      color: var(--ok);
    }

    .status.Cancelled,
    .status.cancelled,
    .status.risk {
      background: #fae9ec;
      color: var(--danger);
    }

    .actions {
      display: flex;
      gap: 8px;
      flex-wrap: wrap;
    }

    .stack {
      display: grid;
      gap: 16px;
    }

    .quality-panel {
      border: 1px solid var(--line);
      border-left: 4px solid var(--ok);
      border-radius: 8px;
      background: #f7fbf8;
      padding: 10px 12px;
      margin: 12px 0;
    }

    .quality-panel.warning {
      border-left-color: var(--accent);
      background: #fffaf2;
    }

    .quality-panel.failed,
    .quality-panel.fail {
      border-left-color: var(--danger);
      background: #fff5f6;
    }

    .quality-head {
      display: flex;
      align-items: baseline;
      justify-content: space-between;
      gap: 12px;
      font-weight: 700;
    }

    .quality-score {
      font-size: 22px;
    }

    .quality-summary {
      color: var(--muted);
      font-size: 13px;
      margin-top: 6px;
    }

    .quality-list {
      display: grid;
      gap: 5px;
      margin-top: 8px;
      font-size: 13px;
    }

    .quality-list .failed,
    .quality-list .fail {
      color: var(--danger);
    }

    .quality-list .warning,
    .quality-list .remind {
      color: #8a5a12;
    }

    .summary-section {
      margin-top: 14px;
      padding-top: 10px;
      border-top: 1px solid var(--line);
    }

    .log-list {
      display: grid;
      gap: 8px;
      max-height: 420px;
      overflow: auto;
    }

    .log-item {
      border: 1px solid var(--line);
      border-radius: 6px;
      padding: 10px;
      background: #fcfcfd;
    }

    .log-item strong {
      display: block;
      font-size: 13px;
      margin-bottom: 4px;
    }

    .log-item span {
      color: var(--muted);
      font-size: 12px;
    }

    .journey-progress {
      height: 8px;
      background: #e9edf3;
      border-radius: 999px;
      overflow: hidden;
      margin: 10px 0 12px;
    }

    .journey-progress span {
      display: block;
      height: 100%;
      background: var(--brand);
      width: 0;
    }

    .timeline {
      display: grid;
      gap: 8px;
      max-height: 220px;
      overflow: auto;
      margin-top: 12px;
    }

    .timeline-item {
      display: grid;
      grid-template-columns: 72px minmax(0, 1fr);
      gap: 8px;
      border-left: 3px solid var(--brand-2);
      padding: 6px 8px 6px 10px;
      background: #fbfcfd;
      border-radius: 4px;
    }

    .timeline-item .phase {
      color: var(--brand-2);
      font-size: 12px;
      font-weight: 700;
    }

    .timeline-item .title {
      font-size: 13px;
      font-weight: 700;
    }

    .timeline-item .time {
      color: var(--muted);
      font-size: 12px;
      margin-top: 3px;
    }

    .step-list {
      display: grid;
      gap: 6px;
      margin-top: 12px;
      max-height: 360px;
      overflow: auto;
      padding-right: 4px;
    }

    .journey-step {
      display: grid;
      grid-template-columns: 28px minmax(0, 1fr) 56px;
      align-items: center;
      gap: 8px;
      border: 1px solid var(--line);
      border-radius: 6px;
      padding: 7px 8px;
      background: #fbfcfd;
      min-height: 40px;
    }

    .journey-step.completed {
      border-color: #cde6d5;
      background: #f3faf5;
    }

    .journey-step.current {
      border-color: #9ccbd0;
      background: #edf7f8;
    }

    .journey-step .num {
      width: 24px;
      height: 24px;
      display: inline-flex;
      align-items: center;
      justify-content: center;
      border-radius: 999px;
      background: #e9edf3;
      color: var(--muted);
      font-size: 12px;
      font-weight: 700;
    }

    .journey-step.completed .num {
      background: var(--ok);
      color: white;
    }

    .journey-step.current .num {
      background: var(--brand);
      color: white;
    }

    .journey-step .name {
      font-size: 13px;
      font-weight: 700;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }

    .journey-step .meta {
      color: var(--muted);
      font-size: 12px;
    }

    .empty {
      color: var(--muted);
      padding: 16px 0;
    }

    @media (max-width: 980px) {
      header {
        align-items: flex-start;
        flex-direction: column;
      }

      .grid,
      .phase-grid,
      .operation-status,
      .layout {
        grid-template-columns: 1fr;
      }
    }
  </style>
</head>
<body>
  <header>
    <h1>首视医院业务仿真平台</h1>
    <div class="topbar">
      <div class="header-clock" id="clock"></div>
      <button id="refreshButton" type="button">刷新</button>
      <button id="naturalTickButton" class="secondary" type="button">自然推进一次</button>
      <button id="cohortButton" class="secondary" type="button">模拟100病人</button>
      <a class="link-button" href="/family-waiting-display" target="_blank" rel="noreferrer">家属等待区大屏</a>
      <a class="link-button" href="/or-terminal-simulator" target="_blank" rel="noreferrer">终端联调模拟台</a>
      <a class="link-button" href="/or-inner-control?roomId=OR01" target="_blank" rel="noreferrer">室内控制端</a>
      <a class="link-button" href="/or-door-display" target="_blank" rel="noreferrer">手术室门口屏</a>
      <a class="link-button" href="/or-nurse-station-display" target="_blank" rel="noreferrer">护士站看板</a>
      <a class="link-button" href="/director-quality-display" target="_blank" rel="noreferrer">院长质控</a>
      <button id="scenarioButton" class="secondary" type="button">推进场景</button>
      <button id="resetButton" class="warning" type="button">重置数据</button>
    </div>
  </header>

  <main>
    <div class="grid" id="metrics"></div>
    <div class="phase-grid" id="phaseSummary"></div>
    <section style="margin-bottom: 18px">
      <h2>医院自然运转</h2>
      <div class="operation-status" id="operationStatus"></div>
    </section>
    <div class="layout">
      <section>
        <h2>今日手术</h2>
        <div id="surgeryTable"></div>
      </section>
      <div class="stack">
        <section>
          <h2>当前患者摘要</h2>
          <div id="summary"></div>
        </section>
        <section>
          <h2>病人全流程</h2>
          <div id="journey"></div>
        </section>
        <section>
          <h2>接口日志</h2>
          <div class="log-list" id="logs"></div>
        </section>
      </div>
    </div>
  </main>

  <script>
    const state = {
      selectedScheduleId: "SCH000100",
      selectedJourneyId: "JNY000100",
      scenarioRunId: null
    };

    const statusFlow = ["已接台", "已入室", "麻醉开始", "手术开始", "手术结束", "已出室", "清洁中", "已完成"];

    function pad(value) {
      return String(value).padStart(2, "0");
    }

    function formatClock(date = new Date()) {
      return date.getFullYear() + "-" + pad(date.getMonth() + 1) + "-" + pad(date.getDate())
        + " " + pad(date.getHours()) + ":" + pad(date.getMinutes()) + ":" + pad(date.getSeconds());
    }

    function tickClock() {
      document.getElementById("clock").textContent = formatClock();
    }

    async function api(path, options = {}) {
      const response = await fetch(path, {
        ...options,
        headers: { "content-type": "application/json", ...(options.headers || {}) }
      });
      const body = await response.json();
      if (!response.ok) {
        throw new Error(body.message || response.statusText);
      }
      return body;
    }

    function statusLabel(status) {
      const labels = {
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
      return labels[status] || status;
    }

    function statusClass(status) {
      const label = statusLabel(status);
      if (["已入室", "麻醉开始", "手术开始", "手术结束"].includes(label)) return "active";
      if (label === "清洁中") return "cleaning";
      if (["已完成", "已出室", "通过", "已出院"].includes(label)) return "done";
      if (["已取消", "未通过", "危急值", "异常"].includes(label)) return "risk";
      return "";
    }

    function nextStatus(status) {
      const current = statusFlow.indexOf(statusLabel(status));
      if (current === -1) return "已接台";
      return statusFlow[Math.min(current + 1, statusFlow.length - 1)];
    }

    function renderMetrics(data) {
      const active = data.surgeries.items.filter((item) => !["已完成", "已取消", "Completed", "Cancelled"].includes(item.status)).length;
      const logs = data.logs.total;
      const metrics = [
        ["患者", data.summary.total || data.patients.total],
        ["住院中", data.summary.inHospital ?? data.patients.total],
        ["术中", data.summary.operating ?? active],
        ["接口消息", logs]
      ];
      document.getElementById("metrics").innerHTML = metrics.map(([label, value]) => \`
        <div class="metric">
          <div class="label">\${label}</div>
          <div class="value">\${value}</div>
        </div>
      \`).join("");
    }

    function renderPhaseSummary(summary) {
      const phases = ["入院", "术前", "术中", "术后", "出院"];
      document.getElementById("phaseSummary").innerHTML = phases.map((phase) => \`
        <div class="phase-item">
          <div class="label">\${phase}</div>
          <div class="value">\${summary.phaseCounts?.[phase] || 0}</div>
        </div>
      \`).join("");
    }

    function renderOperationStatus(operation) {
      const items = [
        ["运行状态", operation.运行状态],
        ["业务日期", operation.当前业务日期],
        ["最近推进", operation.最近推进时间 || "尚未推进"],
        ["今日入院", operation.今日已生成入院人数 + "/" + operation.今日计划入院人数],
        ["术中台次", operation.手术负荷?.术中台次 || 0],
        ["出院人数", operation.患者流转摘要?.discharged || 0]
      ];
      document.getElementById("operationStatus").innerHTML = items.map(([label, value]) => \`
        <div class="operation-item">
          <div class="label">\${label}</div>
          <div class="value" title="\${value}">\${value}</div>
        </div>
      \`).join("");
    }

    function renderSurgeries(surgeries) {
      if (!surgeries.items.length) {
        document.getElementById("surgeryTable").innerHTML = '<div class="empty">暂无手术</div>';
        return;
      }

      document.getElementById("surgeryTable").innerHTML = \`
        <table>
          <thead>
            <tr>
              <th style="width: 13%">手术间</th>
              <th style="width: 18%">患者</th>
              <th>手术</th>
              <th style="width: 15%">主刀</th>
              <th style="width: 14%">状态</th>
              <th style="width: 18%">操作</th>
            </tr>
          </thead>
          <tbody>
            \${surgeries.items.map((item) => {
              const surgeon = item.staff.find((staff) => staff.role === "主刀")?.practitioner?.name || "";
              return \`
                <tr>
                  <td>\${item.room?.roomName || item.roomId}</td>
                  <td>\${item.patient.name} · \${item.patient.ageText}</td>
                  <td title="\${item.plannedSurgeryName}">\${item.plannedSurgeryName}</td>
                  <td>\${surgeon}</td>
                  <td><span class="status \${statusClass(item.status)}">\${statusLabel(item.status)}</span></td>
                  <td>
                    <div class="actions">
                      <button class="secondary" type="button" onclick="selectSchedule('\${item.surgeryScheduleId}')">摘要</button>
                      <button type="button" onclick="advanceStatus('\${item.surgeryScheduleId}', '\${item.status}')">推进</button>
                    </div>
                  </td>
                </tr>
              \`;
            }).join("")}
          </tbody>
        </table>
      \`;
    }

    function renderSummary(summary) {
      document.getElementById("summary").innerHTML = \`
        <div><strong>\${summary.patient.name}</strong> · \${summary.patient.gender} · \${summary.patient.ageText}</div>
        <div style="margin-top: 8px; color: var(--muted)">住院号：\${summary.encounter.inpatientNo || ""}</div>
        <div style="margin-top: 8px">诊断：\${summary.diagnoses.map((item) => item.diagnosisName).join("、")}</div>
        <div style="margin-top: 8px">报告：\${summary.reports.map((item) => item.reportName || item.bodyPart).join("、")}</div>
        <div style="margin-top: 8px">文书：\${summary.documents.map((item) => item.title).join("、")}</div>
      \`;
    }

    function compactList(items, mapper) {
      const values = (items || []).map(mapper).filter(Boolean);
      return values.length ? values.join("；") : "";
    }

    function cleanSummaryValue(value) {
      const text = String(value ?? "").trim();
      return !text || text === "暂无" ? "" : text;
    }

    function summaryLine(label, value) {
      const text = cleanSummaryValue(value);
      return text ? \`<div style="margin-top: 8px">\${label}：\${text}</div>\` : "";
    }

    function summarySection(title, rows) {
      const body = rows.filter(Boolean).join("");
      return body ? \`<div class="summary-section"><strong>\${title}</strong>\${body}</div>\` : "";
    }

    function qualityStatusLabel(status) {
      return status === "passed" ? "通过" : status === "warning" ? "提醒" : status === "failed" ? "需修正" : status;
    }

    function qualityClass(status) {
      const label = qualityStatusLabel(status);
      return label === "通过" ? "passed" : label === "提醒" ? "warning" : "fail";
    }

    function renderQuality(quality) {
      if (!quality) {
        return "";
      }
      const issues = (quality.checks || [])
        .filter((item) => qualityStatusLabel(item.status) !== "通过")
        .slice(0, 6);
      const issueList = issues.length
        ? \`<div class="quality-list">\${issues.map((item) => \`
            <div class="\${qualityClass(item.status)}">[\${item.category}] \${item.item}：\${item.message}</div>
          \`).join("")}</div>\`
        : '<div class="quality-summary">未发现关键缺项或路径矛盾。</div>';
      return \`
        <div class="quality-panel \${qualityClass(quality.status)}">
          <div class="quality-head">
            <span>摘要质控：\${qualityStatusLabel(quality.status)}</span>
            <span class="quality-score">\${quality.score}分</span>
          </div>
          <div class="quality-summary">
            通过 \${quality.passedCount}/\${quality.totalCount}，提醒 \${quality.warningCount}，失败 \${quality.failedCount}。 \${quality.summary}
          </div>
          \${issueList}
        </div>
      \`;
    }

    function renderDetailedSummary(summary) {
      const qualityPanel = renderQuality(summary.quality);
      const reports = compactList(summary.reports, (item) => {
        const name = item.reportName || item.examName || item.bodyPart || item.conclusion;
        const conclusion = item.conclusion ? \`，结论：\${item.conclusion}\` : "";
        const time = item.reportTime || item.resultTime || item.examTime || item.recordTime || "";
        return name ? \`\${name}\${time ? "（" + time + "）" : ""}\${conclusion}\` : "";
      });
      const pacs = compactList(summary.imagingStudies, (item) => \`<a href="\${item.viewerUrl}" target="_blank" rel="noreferrer">\${item.modality}检查 \${item.accessionNo}</a>\`);
      const dicomAssets = compactList(summary.imagingStudies, (item) => \`<a href="\${item.previewImageUrl || item.viewerUrl}" target="_blank" rel="noreferrer">预览图</a> / <a href="\${item.dicomFileUrl || item.dicomwebUrl}" target="_blank" rel="noreferrer">影像文件</a>\`);
      const breastAssessment = compactList(summary.imagingStudies, (item) => item.breastCancerStructuredData ? \`\${item.breastCancerStructuredData.biRads} \${item.breastCancerStructuredData.molecularSubtype || ""} \${item.breastCancerStructuredData.tnmStage || ""}\` : "");
      const meds = compactList(summary.medicationDispenses, (item) => \`\${item.phase || "用药"}：\${item.medicationName}\${item.dose || ""}，\${item.route || ""}，\${item.frequency || ""}，\${item.status}\`);
      const nursing = compactList((summary.nursingRecords || []).slice(-3), (item) => \`\${item.recordTime || ""} \${item.recordType}：\${item.content || ""}\`);
      const consents = compactList(summary.consents, (item) => \`\${item.title}，\${item.status}\${item.signedTime ? "，签署时间 " + item.signedTime : ""}\`);
      const risks = compactList(summary.riskAssessments, (item) => \`\${item.assessmentType}:\${item.riskLevel}\`);
      const critical = compactList(summary.labCriticalValues, (item) => \`\${item.itemName}\${item.value}\${item.unit}(\${item.status})\`);
      const billing = (summary.billingItems || []).reduce((sum, item) => sum + Number(item.amount || 0), 0);
      const dischargeMeds = compactList(summary.dischargeMedications, (item) => \`\${item.medicationName} \${item.quantity}\`);
      const followUps = compactList(summary.followUps, (item) => \`\${item.followUpType} \${item.scheduledTime}\`);
      const specimens = compactList(summary.surgicalSpecimens, (item) => \`\${item.specimenName}(\${item.status})\`);
      const pathology = compactList(summary.pathologyReports, (item) => \`\${item.reportName}:\${item.diagnosis}\`);
      const settlements = compactList(summary.insuranceSettlements, (item) => \`\${item.status} 自付\${item.selfPayAmount}元\`);
      const safety = compactList(summary.surgicalSafetyChecklists, (item) => \`\${item.status} \${item.timeOutTime || ""}\`);
      const anesthesia = compactList(summary.anesthesiaRecords, (item) => \`\${item.anesthesiaMethod}(\${item.status})\`);
      const counts = compactList(summary.instrumentCounts, (item) => \`\${item.phase}:\${item.status}\`);
      const pacu = compactList(summary.pacuRecords, (item) => \`\${item.status} 复苏评分\${item.aldreteScoreOut || ""}\`);
      const vitals = compactList((summary.vitalSignRecords || []).slice(-3), (item) => \`\${item.recordType} \${item.temperature}℃ \${item.bloodPressure}\`);
      const administrations = compactList(summary.medicationAdministrations, (item) => \`\${item.medicationName}(\${item.status})\`);
      const prep = compactList(summary.preopPreparations, (item) => \`\${item.status} 皮肤:\${item.skinCondition}\`);
      const rounds = compactList(summary.wardRounds, (item) => \`\${item.roundType}:\${item.assessment}\`);
      const dischargeAssessments = compactList(summary.dischargeAssessments, (item) => \`\${item.status} \${item.readinessScore}分\`);
      const labTracks = compactList(summary.labSpecimenTracks, (item) => \`\${item.specimenType} \${item.status} \${item.barcode}\`);
      const infusions = compactList(summary.infusionRecords, (item) => \`\${item.infusionName}(\${item.status})\`);
      const pain = compactList(summary.painAssessments, (item) => \`\${item.phase} \${item.score}分→\${item.reassessmentScore}分\`);
      const wound = compactList(summary.woundCareRecords, (item) => \`\${item.dressingStatus} \${item.infectionSigns}\`);
      const homePages = compactList(summary.medicalRecordHomePages, (item) => \`\${item.drgCode} \${item.status}\`);
      const quality = compactList(summary.recordQualityChecks, (item) => \`\${item.level} \${item.score}分\`);
      const consults = compactList(summary.consultations, (item) => \`\${item.consultationType}:\${item.status}\`);
      const teaching = compactList(summary.teachingSessions, (item) => \`\${item.title}(\${item.status})\`);
      const family = compactList(summary.familyNotifications, (item) => \`\${item.phase}:\${item.status}\`);
      const antibiotic = compactList(summary.antimicrobialReviews, (item) => \`\${item.medicationName}(\${item.status})\`);
      const consumables = compactList(summary.orConsumableUsages, (item) => \`\${item.status} \${(item.items || []).length}项\`);
      const media = compactList(summary.surgeryMediaRecords, (item) => \`\${item.sourceCode} \${item.status}\`);
      const diet = compactList(summary.dietaryPlans, (item) => \`\${item.phase}:\${item.dietOrder}\`);
      const mobility = compactList(summary.mobilityRehabRecords, (item) => \`\${item.activityLevel} \${item.distanceMeters}m\`);
      const vte = compactList(summary.vteProphylaxisRecords, (item) => \`\${item.riskLevel} \${item.status}\`);
      const handovers = compactList(summary.nursingHandovers, (item) => \`\${item.handoverType}:\${item.status}\`);
      const observations = compactList(summary.postopObservationRecords, (item) => \`\${item.status} \${item.fever}\`);
      const counseling = compactList(summary.medicationCounselingRecords, (item) => \`\${item.status} \${item.teachBackResult}\`);
      const dischargeEducation = compactList(summary.dischargeEducationRecords, (item) => \`\${item.status} \${item.patientUnderstanding}\`);
      const invoices = compactList(summary.invoiceRecords, (item) => \`\${item.invoiceType} \${item.status}\`);
      const followUpOutcomes = compactList(summary.followUpOutcomeRecords, (item) => \`\${item.contactMethod}:\${item.status}\`);
      const infection = compactList(summary.infectionSurveillanceRecords, (item) => \`\${item.woundClass} \${item.status}\`);
      const surveys = compactList(summary.satisfactionSurveys, (item) => \`\${item.overallScore}分 \${item.status}\`);
      const orderReviews = compactList(summary.orderReviewRecords, (item) => \`\${item.reviewType}:\${item.status}\`);
      const appointments = compactList(summary.examAppointments, (item) => \`\${item.examName} \${item.queueNo}(\${item.status})\`);
      const bloodPreparation = compactList(summary.bloodPreparationRecords, (item) => \`\${item.bloodType} \${item.productType}\${item.reservedVolume}(\${item.status})\`);
      const medicationSafety = compactList(summary.medicationSafetyChecks, (item) => \`\${item.medicationName} \${item.skinTestResult}(\${item.status})\`);
      const identityChecks = compactList(summary.identityVerificationRecords, (item) => \`\${item.scene}:\${item.status}\`);
      const eligibility = compactList(summary.insuranceEligibilityRecords, (item) => \`\${item.insuranceType} \${item.eligibilityStatus}\`);
      const deposits = compactList(summary.depositPayments, (item) => \`\${item.amount}元 \${item.status}\`);
      const dailyBills = compactList(summary.dailyBillingStatements, (item) => \`\${item.statementDate} 自付预估\${item.selfPayEstimate}元\`);
      const extendedRows = [
        summarySection("入院及费用", [
          summaryLine("医保资格", eligibility),
          summaryLine("住院预交", deposits),
          summaryLine("费用日清单", dailyBills),
          summaryLine("费用合计", billing ? billing.toFixed(2) + "元" : "")
        ]),
        summarySection("术前准备", [
          summaryLine("术前评估", risks),
          summaryLine("知情同意", consents),
          summaryLine("医嘱审核", orderReviews),
          summaryLine("检查预约", appointments),
          summaryLine("血型复核及备血", bloodPreparation),
          summaryLine("皮试及过敏核查", medicationSafety),
          summaryLine("扫码核对", identityChecks),
          summaryLine("术前准备", prep)
        ]),
        summarySection("检查检验", [
          summaryLine("危急值", critical),
          summaryLine("影像调阅", pacs),
          summaryLine("影像文件", dicomAssets),
          summaryLine("专科评估", breastAssessment)
        ]),
        summarySection("围手术期记录", [
          summaryLine("安全核查", safety),
          summaryLine("麻醉记录", anesthesia),
          summaryLine("器械清点", counts),
          summaryLine("复苏室记录", pacu),
          summaryLine("术中标本", specimens),
          summaryLine("病理报告", pathology),
          summaryLine("抗菌药审核", antibiotic),
          summaryLine("耗材追溯", consumables),
          summaryLine("手术视频", media)
        ]),
        summarySection("术后护理及康复", [
          summaryLine("生命体征单", vitals),
          summaryLine("用药执行单", administrations),
          summaryLine("医生查房", rounds),
          summaryLine("护理交接", handovers),
          summaryLine("术后观察", observations),
          summaryLine("营养饮食", diet),
          summaryLine("康复活动", mobility),
          summaryLine("静脉血栓栓塞预防", vte),
          summaryLine("标本流转", labTracks),
          summaryLine("输液记录", infusions),
          summaryLine("疼痛评估", pain),
          summaryLine("切口换药", wound),
          summaryLine("院感监测", infection)
        ]),
        summarySection("出院及随访", [
          summaryLine("出院评估", dischargeAssessments),
          summaryLine("出院带药", dischargeMeds),
          summaryLine("用药指导", counseling),
          summaryLine("出院宣教", dischargeEducation),
          summaryLine("随访预约", followUps),
          summaryLine("随访结果", followUpOutcomes),
          summaryLine("医保结算", settlements),
          summaryLine("电子票据", invoices),
          summaryLine("病案首页", homePages),
          summaryLine("病案质控", quality),
          summaryLine("满意度", surveys)
        ]),
        summarySection("协同业务", [
          summaryLine("远程会诊", consults),
          summaryLine("示教直播", teaching),
          summaryLine("家属通知", family)
        ])
      ].join("");
      document.getElementById("summary").innerHTML = \`
        <div><strong>\${summary.patient.name}</strong> · \${summary.patient.gender} · \${summary.patient.ageText}</div>
        <div style="margin-top: 8px; color: var(--muted)">住院号：\${summary.encounter.inpatientNo || ""}</div>
        <div style="margin-top: 8px">诊断：\${summary.diagnoses.map((item) => item.diagnosisName).join("、")}</div>
        \${qualityPanel}
        \${summaryLine("检查检验", reports)}
        \${summaryLine("配药执行", meds)}
        \${summaryLine("护理记录", nursing)}
        \${summaryLine("电子病历", summary.documents.map((item) => item.title).filter(Boolean).join("、"))}
      \`;
      document.getElementById("summary").insertAdjacentHTML("beforeend", extendedRows);
    }

    function renderLogs(logs) {
      document.getElementById("logs").innerHTML = logs.items.slice(0, 20).map((item) => \`
        <div class="log-item">
          <strong>\${item.messageType} · \${item.status}</strong>
          <span>\${item.createdTime} · \${item.messageId}</span>
        </div>
      \`).join("") || '<div class="empty">暂无接口消息</div>';
    }

    function isCompletedStep(status) {
      return status === "已完成" || status === "completed";
    }

    function isCurrentStep(status) {
      return status === "当前" || status === "current";
    }

    function journeyStepClass(status) {
      return isCompletedStep(status) ? "completed" : isCurrentStep(status) ? "current" : "pending";
    }

    function journeyStepText(status) {
      return isCompletedStep(status) ? "完成" : isCurrentStep(status) ? "当前" : "待执行";
    }

    function renderJourney(journeyResult) {
      const journey = journeyResult.items?.[0] || journeyResult;
      if (!journey || !journey.journeyId) {
        document.getElementById("journey").innerHTML = '<div class="empty">暂无病人旅程</div>';
        return;
      }

      state.selectedJourneyId = journey.journeyId;
      const next = journey.nextStep ? \`\${journey.nextStep.phase} · \${journey.nextStep.stepName}\` : "已完成";
      const timeline = journey.timeline || [];
      document.getElementById("journey").innerHTML = \`
        <div><strong>\${journey.template.templateName}</strong></div>
        <div style="margin-top: 8px; color: var(--muted)">\${journey.patient.name} · \${journey.status} · \${journey.progress.completed}/\${journey.progress.total}</div>
        <div class="journey-progress"><span style="width: \${journey.progress.percent}%"></span></div>
        <div>下一步：\${next}</div>
        <div class="actions" style="margin-top: 12px">
          <button type="button" onclick="advanceJourney()">推进旅程</button>
          <button class="secondary" type="button" onclick="runJourney()">一键跑完</button>
          <button class="secondary" type="button" onclick="resetJourney()">重置旅程</button>
        </div>
        <div class="step-list">
          \${journey.steps.map((step) => \`
            <div class="journey-step \${journeyStepClass(step.status)}">
              <div class="num">\${isCompletedStep(step.status) ? "✓" : step.index + 1}</div>
              <div>
                <div class="name" title="\${step.stepName}">\${step.stepName}</div>
                <div class="meta">\${step.system} · \${step.phase}\${step.event ? " · " + step.event.eventTime : ""}</div>
              </div>
              <div class="meta">\${journeyStepText(step.status)}</div>
            </div>
          \`).join("")}
        </div>
        <div class="timeline">
          \${timeline.slice().reverse().slice(0, 8).map((item) => \`
            <div class="timeline-item">
              <div class="phase">\${item.phase}</div>
              <div>
                <div class="title">\${item.stepName}</div>
                <div class="time">\${item.eventTime}</div>
              </div>
            </div>
          \`).join("") || '<div class="empty">还没有旅程事件</div>'}
        </div>
      \`;
    }

    async function load() {
      const surgeries = await api("/api/v1/surgery-schedules?pageSize=120");
      const patients = await api("/api/v1/patients");
      const journeySummary = await api("/api/v1/patient-journeys/summary");
      const operation = await api("/api/v1/hospital-operation/status");
      const logs = await api("/api/v1/interface-messages?pageSize=20");
      const selected = surgeries.items.find((item) => item.surgeryScheduleId === state.selectedScheduleId) || surgeries.items[0];
      if (selected) state.selectedScheduleId = selected.surgeryScheduleId;
      const journeys = selected
        ? await api(\`/api/v1/patient-journeys?encounterId=\${selected.encounter.encounterId}&pageSize=1\`)
        : await api("/api/v1/patient-journeys?pageSize=1");
      const summary = selected ? await api(\`/api/v1/encounters/\${selected.encounter.encounterId}/summary\`) : null;
      renderMetrics({ surgeries, patients, logs, summary: journeySummary });
      renderPhaseSummary(journeySummary);
      renderOperationStatus(operation);
      renderSurgeries(surgeries);
      if (summary) renderDetailedSummary(summary);
      renderJourney(journeys);
      renderLogs(logs);
    }

    window.selectSchedule = async function selectSchedule(scheduleId) {
      state.selectedScheduleId = scheduleId;
      await load();
    };

    window.advanceStatus = async function advanceStatus(scheduleId, status) {
      await api(\`/api/v1/surgery-schedules/\${scheduleId}/status\`, {
        method: "PATCH",
        body: JSON.stringify({ status: nextStatus(status), sourceSystem: "首视控制台" })
      });
      state.selectedScheduleId = scheduleId;
      await load();
    };

    window.advanceJourney = async function advanceJourney() {
      await api(\`/api/v1/patient-journeys/\${state.selectedJourneyId}/next\`, { method: "POST" });
      await load();
    };

    window.runJourney = async function runJourney() {
      await api(\`/api/v1/patient-journeys/\${state.selectedJourneyId}/run\`, { method: "POST" });
      await load();
    };

    window.resetJourney = async function resetJourney() {
      await api(\`/api/v1/patient-journeys/\${state.selectedJourneyId}/reset\`, { method: "POST" });
      state.selectedScheduleId = "SCH000001";
      await load();
    };

    document.getElementById("refreshButton").addEventListener("click", load);

    document.getElementById("naturalTickButton").addEventListener("click", async () => {
      await api("/api/v1/hospital-operation/tick", { method: "POST" });
      await load();
    });

    document.getElementById("cohortButton").addEventListener("click", async () => {
      const result = await api("/api/v1/patient-journeys/simulate-cohort", {
        method: "POST",
        body: JSON.stringify({ count: 100, reset: true })
      });
      const activeJourney = result.items.find((item) => item.progress.completed >= item.progress.total - 3)
        || result.items.find((item) => item.progress.completed >= 24)
        || result.items[0];
      state.selectedScheduleId = activeJourney?.surgeryScheduleId || "SCH000001";
      state.selectedJourneyId = activeJourney?.journeyId || "JNY000001";
      state.scenarioRunId = null;
      await load();
    });

    document.getElementById("resetButton").addEventListener("click", async () => {
      await api("/api/v1/data-factory/reset", { method: "POST" });
      state.selectedScheduleId = "SCH000001";
      state.selectedJourneyId = "JNY000001";
      state.scenarioRunId = null;
      await load();
    });

    document.getElementById("scenarioButton").addEventListener("click", async () => {
      if (!state.scenarioRunId) {
        const run = await api("/api/v1/scenarios/SCN000001/runs", {
          method: "POST",
          body: JSON.stringify({ surgeryScheduleId: state.selectedScheduleId })
        });
        state.scenarioRunId = run.runId;
      }
      const next = await api(\`/api/v1/scenario-runs/\${state.scenarioRunId}/next\`, { method: "POST" });
      if (next.status === "已完成" || next.status === "completed") {
        state.scenarioRunId = null;
      }
      await load();
    });

    tickClock();
    setInterval(tickClock, 1000);

    load().catch((error) => {
      document.body.insertAdjacentHTML("beforeend", \`<pre style="color: #b23a48; padding: 16px">\${error.message}</pre>\`);
    });
  </script>
</body>
</html>`;
}
