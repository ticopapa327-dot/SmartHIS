export function renderWaitingDisplayHtml() {
  return `<!doctype html>
<html lang="zh-CN">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>家属等待区手术信息大屏</title>
  <style>
    :root {
      color-scheme: light;
      font-family: "Noto Sans CJK SC", "Source Han Sans SC", "Microsoft YaHei", "PingFang SC", Arial, sans-serif;
      background: #f6fbf8;
      color: #173b34;
    }
    * { box-sizing: border-box; }
    body {
      margin: 0;
      min-height: 100vh;
      background: #f6fbf8;
    }
    header {
      position: relative;
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 32px;
      min-height: 120px;
      padding: 28px 48px 22px;
      color: #173b34;
      background: #ffffff;
      border-bottom: 1px solid #dcebe4;
    }
    header > div:first-child {
      text-align: center;
    }
    h1 {
      margin: 0;
      font-size: 42px;
      line-height: 1.2;
      font-weight: 800;
      letter-spacing: 0;
    }
    .hospital-line {
      margin-top: 8px;
      color: #52756c;
      font-size: 20px;
      font-weight: 600;
    }
    .clock {
      position: absolute;
      right: 48px;
      min-width: 300px;
      padding: 12px 18px;
      color: #1e6055;
      background: #eef7f4;
      border: 1px solid #cfe4dc;
      border-radius: 8px;
      text-align: center;
      font-size: 26px;
      font-weight: 800;
      white-space: nowrap;
    }
    main {
      display: grid;
      grid-template-columns: minmax(0, 1fr) 420px;
      gap: 22px;
      padding: 26px 48px 42px;
    }
    .summary {
      display: grid;
      grid-template-columns: repeat(4, minmax(0, 1fr));
      gap: 14px;
      margin-bottom: 18px;
    }
    .metric {
      min-height: 96px;
      padding: 16px 20px;
      border: 1px solid #dcebe4;
      background: #ffffff;
      border-radius: 8px;
      box-shadow: 0 8px 22px rgba(27, 72, 62, 0.06);
    }
    .metric .label {
      color: #52756c;
      font-size: 18px;
      font-weight: 700;
    }
    .metric .value {
      margin-top: 8px;
      color: #173b34;
      font-size: 34px;
      font-weight: 900;
    }
    .notice {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 18px;
      min-height: 58px;
      margin-bottom: 18px;
      padding: 13px 18px;
      color: #315d53;
      background: #eef7f4;
      border: 1px solid #cfe4dc;
      border-radius: 8px;
      font-size: 22px;
      font-weight: 700;
    }
    .page-indicator {
      flex: 0 0 auto;
      color: #1e6055;
      white-space: nowrap;
    }
    .case-grid {
      display: grid;
      grid-template-columns: repeat(2, minmax(0, 1fr));
      gap: 16px;
    }
    .case-card {
      display: grid;
      grid-template-columns: 132px minmax(0, 1fr);
      gap: 18px;
      min-height: 172px;
      padding: 20px;
      border: 1px solid #dcebe4;
      border-left: 8px solid #6bb6a7;
      background: #ffffff;
      border-radius: 8px;
      box-shadow: 0 10px 26px rgba(27, 72, 62, 0.08);
    }
    .queue {
      display: grid;
      place-items: center;
      align-self: stretch;
      color: #1e6055;
      background: #eef7f4;
      border-radius: 8px;
      font-size: 58px;
      font-weight: 900;
    }
    .case-info {
      min-width: 0;
    }
    .case-top {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 16px;
      margin-bottom: 12px;
    }
    .patient-name {
      color: #173b34;
      font-size: 34px;
      font-weight: 900;
    }
    .room-name {
      color: #52756c;
      font-size: 24px;
      font-weight: 800;
      white-space: nowrap;
    }
    .status {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      min-width: 168px;
      padding: 12px 18px;
      border-radius: 999px;
      text-align: center;
      font-size: 26px;
      font-weight: 900;
      white-space: nowrap;
    }
    .tone-waiting {
      color: #28506b;
      background: #dfeef8;
    }
    .tone-called {
      color: #1f5d7a;
      background: #d9f0fa;
    }
    .tone-preparing {
      color: #205d64;
      background: #d9f3f2;
    }
    .tone-active {
      color: #226154;
      background: #dbf2e9;
    }
    .tone-done {
      color: #245d38;
      background: #dff3e5;
    }
    .tone-remind {
      color: #805316;
      background: #f7ead2;
    }
    .phase {
      display: grid;
      grid-template-columns: repeat(5, minmax(0, 1fr));
      gap: 8px;
      margin: 14px 0 10px;
    }
    .phase-step {
      min-height: 12px;
      border-radius: 999px;
      background: #dbe6e2;
    }
    .phase-step.is-on {
      background: #6bb6a7;
    }
    .case-note {
      color: #315d53;
      font-size: 23px;
      font-weight: 700;
      line-height: 1.45;
    }
    .updated {
      margin-top: 8px;
      color: #6a837d;
      font-size: 20px;
      font-weight: 700;
    }
    .care-panel {
      display: grid;
      gap: 16px;
      align-content: start;
    }
    .care-card {
      padding: 22px 24px;
      border: 1px solid #dcebe4;
      background: #ffffff;
      border-radius: 8px;
      box-shadow: 0 10px 26px rgba(27, 72, 62, 0.08);
    }
    .care-card h2 {
      margin: 0 0 14px;
      color: #1e6055;
      font-size: 28px;
      line-height: 1.25;
      font-weight: 900;
    }
    .care-card p {
      margin: 0 0 12px;
      color: #315d53;
      font-size: 22px;
      line-height: 1.55;
      font-weight: 700;
    }
    .care-card p:last-child {
      margin-bottom: 0;
    }
    .service-list {
      display: grid;
      gap: 12px;
    }
    .service-item {
      display: grid;
      grid-template-columns: 108px minmax(0, 1fr);
      gap: 10px;
      color: #315d53;
      font-size: 21px;
      line-height: 1.45;
      font-weight: 700;
    }
    .service-label {
      color: #1e6055;
      font-weight: 900;
    }
    .empty {
      min-height: 360px;
      display: grid;
      place-items: center;
      text-align: center;
      color: #52756c;
      background: #ffffff;
      border: 1px solid #dcebe4;
      border-radius: 8px;
      font-size: 34px;
      font-weight: 800;
    }
    @media (max-width: 1280px) {
      main {
        grid-template-columns: 1fr;
      }
      .care-panel {
        grid-template-columns: repeat(2, minmax(0, 1fr));
      }
    }
    @media (max-width: 900px) {
      header {
        position: static;
        align-items: flex-start;
        flex-direction: column;
        gap: 12px;
        padding: 20px;
      }
      header > div:first-child { text-align: left; }
      main { padding: 18px 20px; }
      h1 { font-size: 30px; }
      .hospital-line, .clock { font-size: 20px; }
      .clock { position: static; }
      .summary, .case-grid, .care-panel { grid-template-columns: 1fr; }
      .notice { align-items: flex-start; flex-direction: column; }
      .case-card { grid-template-columns: 96px minmax(0, 1fr); padding: 16px; }
      .queue { font-size: 42px; }
      .patient-name { font-size: 26px; }
      .room-name, .case-note, .care-card p { font-size: 20px; }
      .status { min-width: 132px; font-size: 21px; }
    }
    @media (min-width: 2200px) {
      header { min-height: 168px; padding: 42px 72px 30px; }
      main { grid-template-columns: minmax(0, 1fr) 620px; gap: 32px; padding: 38px 72px 62px; }
      h1 { font-size: 72px; }
      .hospital-line { font-size: 34px; }
      .clock { min-width: 470px; font-size: 42px; padding: 18px 26px; }
      .summary { gap: 22px; margin-bottom: 26px; }
      .metric { min-height: 142px; padding: 26px 32px; }
      .metric .label { font-size: 30px; }
      .metric .value { font-size: 54px; }
      .notice { min-height: 86px; font-size: 34px; padding: 20px 28px; margin-bottom: 26px; }
      .case-grid { gap: 24px; }
      .case-card { min-height: 258px; grid-template-columns: 198px minmax(0, 1fr); gap: 28px; padding: 30px; }
      .queue { font-size: 88px; }
      .patient-name { font-size: 52px; }
      .room-name { font-size: 38px; }
      .status { min-width: 252px; font-size: 42px; padding: 18px 26px; }
      .phase { gap: 12px; margin: 22px 0 18px; }
      .phase-step { min-height: 18px; }
      .case-note { font-size: 36px; }
      .updated { font-size: 30px; }
      .care-panel { gap: 24px; }
      .care-card { padding: 34px 38px; }
      .care-card h2 { font-size: 44px; margin-bottom: 22px; }
      .care-card p, .service-item { font-size: 34px; }
      .service-item { grid-template-columns: 160px minmax(0, 1fr); gap: 16px; }
    }
  </style>
</head>
<body>
  <header>
    <div>
      <h1>手术室家属等待区信息</h1>
      <div class="hospital-line">请您安心等候，手术团队正在按流程照护患者</div>
    </div>
    <div class="clock" id="clock"></div>
  </header>
  <main>
    <section>
      <div class="summary" id="summary"></div>
      <div class="notice">
        <span>55 寸 4K 大屏自动翻页；患者信息已脱敏，具体病情请以医护人员正式沟通为准。</span>
        <span class="page-indicator" id="pageIndicator"></span>
      </div>
      <div id="board"></div>
    </section>
    <aside class="care-panel">
      <section class="care-card">
        <h2>安心提示</h2>
        <p>手术时间会因患者个体情况、麻醉准备和术中处理有所差异，状态显示用于帮助您了解大致阶段。</p>
        <p>如需家属配合，护士站会通过等候号或现场通知主动联系。</p>
      </section>
      <section class="care-card">
        <h2>服务信息</h2>
        <div class="service-list">
          <div class="service-item"><span class="service-label">咨询</span><span>请凭等候号到护士站咨询。</span></div>
          <div class="service-item"><span class="service-label">谈话</span><span>术后沟通请留意护士站通知。</span></div>
          <div class="service-item"><span class="service-label">休息</span><span>饮水、卫生间和无障碍服务请按现场导引。</span></div>
        </div>
      </section>
    </aside>
  </main>
  <script>
    const params = new URLSearchParams(location.search);
    const state = {
      page: 0,
      pages: [[]]
    };

    function clampInt(value, fallback, min, max) {
      const parsed = Number.parseInt(value ?? "", 10);
      if (!Number.isFinite(parsed)) return fallback;
      return Math.min(Math.max(parsed, min), max);
    }

    const rowsPerPage = clampInt(params.get("rows"), 8, 4, 10);
    const configuredRoomCount = clampInt(params.get("roomCount"), 0, 0, 60);
    const pageIntervalMs = clampInt(params.get("interval"), 12000, 5000, 60000);

    const labels = {
      Scheduled: "等待中",
      Called: "等待接入",
      InRoom: "已进入手术区",
      AnesthesiaStarted: "手术准备中",
      SurgeryStarted: "手术中",
      SurgeryEnded: "手术已结束",
      OutRoom: "复苏观察中",
      Cleaning: "复苏观察中",
      Completed: "已完成",
      Cancelled: "请咨询护士站"
    };

    const statusHelp = {
      "等待中": "正在按计划等候接台",
      "等待接入": "医护团队正在安排接台",
      "已进入手术区": "患者已进入手术区域",
      "手术准备中": "正在进行麻醉及术前核查",
      "手术中": "手术正在有序进行",
      "手术已结束": "医护团队正在整理交接",
      "复苏观察中": "患者正在复苏观察",
      "已完成": "本次手术流程已完成",
      "请咨询护士站": "请家属凭等候号咨询护士站"
    };

    function label(status = "") {
      return labels[status] || status;
    }

    function statusTone(status = "") {
      const value = label(status);
      if (value === "等待接入") return "tone-called";
      if (["已进入手术区", "手术准备中"].includes(value)) return "tone-preparing";
      if (value === "手术中") return "tone-active";
      if (["手术已结束", "复苏观察中", "已完成"].includes(value)) return "tone-done";
      if (value === "请咨询护士站") return "tone-remind";
      return "tone-waiting";
    }

    function phaseIndex(status = "") {
      const value = label(status);
      if (value === "等待接入") return 1;
      if (["已进入手术区", "手术准备中"].includes(value)) return 2;
      if (value === "手术中") return 3;
      if (value === "手术已结束") return 4;
      if (["复苏观察中", "已完成"].includes(value)) return 5;
      return 0;
    }

    function fmtTime(value) {
      if (!value) return "";
      if (/^\\d{4}-\\d{2}-\\d{2} \\d{2}:\\d{2}$/.test(value)) return value.slice(11, 16);
      const date = new Date(value);
      return Number.isNaN(date.getTime()) ? String(value).slice(-5) : date.toLocaleTimeString("zh-CN", {
        hour: "2-digit",
        minute: "2-digit",
        hour12: false
      });
    }

    function fmtDate(value = new Date()) {
      const date = value instanceof Date ? value : new Date(value);
      if (Number.isNaN(date.getTime())) return "";
      const parts = new Intl.DateTimeFormat("zh-CN", {
        timeZone: "Asia/Shanghai",
        year: "numeric",
        month: "2-digit",
        day: "2-digit"
      }).formatToParts(date);
      const part = (type) => parts.find((item) => item.type === type)?.value || "";
      return \`\${part("year")}-\${part("month")}-\${part("day")}\`;
    }

    function statusPriority(item) {
      const status = label(item.displayStatus);
      if (["手术中", "手术准备中", "已进入手术区", "等待接入"].includes(status)) return 1;
      if (status === "等待中") return 2;
      if (["手术已结束", "复苏观察中"].includes(status)) return 3;
      if (status === "已完成") return 4;
      return 5;
    }

    function splitPages(items) {
      const pages = [];
      for (let index = 0; index < items.length; index += rowsPerPage) {
        pages.push(items.slice(index, index + rowsPerPage));
      }
      return pages.length ? pages : [[]];
    }

    async function api(path) {
      const response = await fetch(path);
      if (!response.ok) throw new Error(response.statusText);
      return response.json();
    }

    function renderSummary(items, roomTotal) {
      const active = items.filter((item) => ["已进入手术区", "手术准备中", "手术中"].includes(label(item.displayStatus))).length;
      const waiting = items.filter((item) => ["等待中", "等待接入"].includes(label(item.displayStatus))).length;
      const done = items.filter((item) => ["手术已结束", "复苏观察中", "已完成"].includes(label(item.displayStatus))).length;
      const metrics = [
        ["开放手术间", roomTotal],
        ["今日手术", items.length],
        ["候台/接台", waiting],
        ["术中/术后", active + done]
      ];
      document.getElementById("summary").innerHTML = metrics.map(([title, value]) => \`
        <div class="metric">
          <div class="label">\${title}</div>
          <div class="value">\${value}</div>
        </div>
      \`).join("");
    }

    function render(items) {
      if (!items.length) {
        document.getElementById("board").innerHTML = '<div class="empty">暂无手术排班信息<br><span style="font-size: 0.68em; color: #6a837d;">请您留意护士站通知</span></div>';
        document.getElementById("pageIndicator").textContent = "";
        return;
      }
      const pageTotal = state.pages.length;
      document.getElementById("pageIndicator").textContent = \`第 \${state.page + 1} / \${pageTotal} 屏，每 \${Math.round(pageIntervalMs / 1000)} 秒自动翻页\`;
      document.getElementById("board").innerHTML = \`
        <div class="case-grid">
          \${items.map((item) => {
            const value = label(item.displayStatus);
            const currentPhase = phaseIndex(value);
            const phase = [1, 2, 3, 4, 5].map((step) => \`<span class="phase-step \${step <= currentPhase ? "is-on" : ""}"></span>\`).join("");
            return \`
              <article class="case-card">
                <div class="queue">\${item.queueNo}</div>
                <div class="case-info">
                  <div class="case-top">
                    <div>
                      <div class="patient-name">\${item.patientName}</div>
                      <div class="room-name">\${item.roomName}</div>
                    </div>
                    <span class="status \${statusTone(value)}">\${value}</span>
                  </div>
                  <div class="phase" aria-hidden="true">\${phase}</div>
                  <div class="case-note">\${statusHelp[value] || "请关注护士站通知"}</div>
                  <div class="updated">最近更新 \${fmtTime(item.lastUpdatedTime)}</div>
                </div>
              </article>
            \`;
          }).join("")}
        </div>
      \`;
    }

    async function load() {
      const date = params.get("date") || fmtDate();
      const [snapshot, rooms] = await Promise.all([
        api(\`/api/v1/or-display/family-waiting-snapshot?date=\${date}\`),
        api("/api/v1/operating-rooms?pageSize=200")
      ]);
      const visible = snapshot.items
        .filter((item) => item.displayStatus !== "请咨询护士站")
        .sort((left, right) => statusPriority(left) - statusPriority(right)
          || String(left.lastUpdatedTime || "").localeCompare(String(right.lastUpdatedTime || ""))
          || String(left.roomName || "").localeCompare(String(right.roomName || "")));
      const roomTotal = configuredRoomCount || Math.max(rooms.total || 0, new Set(visible.map((item) => item.roomName)).size);
      state.pages = splitPages(visible);
      state.page = Math.min(state.page, state.pages.length - 1);
      renderSummary(visible, roomTotal);
      render(state.pages[state.page]);
    }

    function nextPage() {
      if (state.pages.length <= 1) return;
      state.page = (state.page + 1) % state.pages.length;
      render(state.pages[state.page]);
    }

    function pad(value) {
      return String(value).padStart(2, "0");
    }

    function formatClock(date = new Date()) {
      return date.getFullYear() + "-" + pad(date.getMonth() + 1) + "-" + pad(date.getDate())
        + " " + pad(date.getHours()) + ":" + pad(date.getMinutes()) + ":" + pad(date.getSeconds());
    }

    function tick() {
      document.getElementById("clock").textContent = formatClock();
    }

    tick();
    load();
    setInterval(tick, 1000);
    setInterval(load, 15000);
    setInterval(nextPage, pageIntervalMs);
  </script>
</body>
</html>`;
}
