export function renderWaitingMobileHtml() {
  return `<!doctype html>
<html lang="zh-CN">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
  <title>家属等待区手机端</title>
  <style>
    :root {
      color-scheme: light;
      font-family: "Microsoft YaHei", "PingFang SC", "Noto Sans CJK SC", Arial, sans-serif;
      background: #edf5f2;
      color: #173b34;
    }
    * { box-sizing: border-box; }
    body {
      margin: 0;
      min-height: 100vh;
      background: #edf5f2;
    }
    button {
      font: inherit;
    }
    .app {
      width: min(100%, 520px);
      min-height: 100vh;
      margin: 0 auto;
      background: #f7fbf9;
      box-shadow: 0 0 0 1px rgba(31, 85, 73, 0.08);
    }
    .top {
      position: sticky;
      top: 0;
      z-index: 10;
      padding: calc(env(safe-area-inset-top) + 14px) 16px 12px;
      background: #ffffff;
      border-bottom: 1px solid #d8e9e3;
    }
    .title-row {
      display: flex;
      align-items: flex-start;
      justify-content: space-between;
      gap: 12px;
    }
    h1 {
      margin: 0;
      font-size: 22px;
      line-height: 1.25;
      font-weight: 900;
      letter-spacing: 0;
    }
    .subtitle {
      margin-top: 5px;
      color: #55756d;
      font-size: 13px;
      line-height: 1.45;
      font-weight: 700;
    }
    .clock {
      flex: 0 0 auto;
      min-width: 92px;
      padding: 7px 9px;
      color: #1e6055;
      background: #eef7f4;
      border: 1px solid #cfe4dc;
      border-radius: 8px;
      text-align: center;
      font-size: 13px;
      line-height: 1.3;
      font-weight: 900;
      white-space: nowrap;
    }
    .date-line {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 8px;
      margin-top: 12px;
      color: #496c63;
      font-size: 13px;
      line-height: 1.35;
      font-weight: 700;
    }
    .refresh {
      flex: 0 0 auto;
      border: 1px solid #cfe4dc;
      border-radius: 8px;
      padding: 7px 10px;
      color: #1e6055;
      background: #ffffff;
      font-size: 13px;
      font-weight: 900;
    }
    .tabs {
      display: grid;
      grid-template-columns: repeat(4, minmax(0, 1fr));
      gap: 7px;
      padding: 12px 16px 10px;
      background: #ffffff;
      border-bottom: 1px solid #d8e9e3;
    }
    .tab {
      min-height: 36px;
      border: 1px solid #d6e7e1;
      border-radius: 8px;
      color: #315d53;
      background: #f7fbf9;
      font-size: 13px;
      font-weight: 900;
    }
    .tab.active {
      color: #ffffff;
      background: #1e6055;
      border-color: #1e6055;
    }
    .summary {
      display: grid;
      grid-template-columns: repeat(4, minmax(0, 1fr));
      gap: 8px;
      padding: 12px 16px;
    }
    .metric {
      min-height: 62px;
      padding: 9px 8px;
      border: 1px solid #dcebe4;
      background: #ffffff;
      border-radius: 8px;
      text-align: center;
    }
    .metric .label {
      color: #55756d;
      font-size: 12px;
      line-height: 1.2;
      font-weight: 800;
    }
    .metric .value {
      margin-top: 6px;
      color: #173b34;
      font-size: 22px;
      line-height: 1;
      font-weight: 900;
    }
    .notice {
      margin: 0 16px 12px;
      padding: 10px 12px;
      color: #315d53;
      background: #eef7f4;
      border: 1px solid #cfe4dc;
      border-radius: 8px;
      font-size: 13px;
      line-height: 1.55;
      font-weight: 700;
    }
    .list {
      display: grid;
      gap: 10px;
      padding: 0 16px calc(env(safe-area-inset-bottom) + 18px);
    }
    .case {
      padding: 14px;
      background: #ffffff;
      border: 1px solid #dcebe4;
      border-left: 5px solid #6bb6a7;
      border-radius: 8px;
      box-shadow: 0 8px 20px rgba(27, 72, 62, 0.06);
    }
    .case-head {
      display: flex;
      align-items: flex-start;
      justify-content: space-between;
      gap: 10px;
    }
    .patient-line {
      min-width: 0;
    }
    .queue {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      min-width: 44px;
      height: 32px;
      margin-right: 7px;
      color: #1e6055;
      background: #eef7f4;
      border-radius: 8px;
      font-size: 17px;
      font-weight: 900;
      vertical-align: middle;
    }
    .patient {
      color: #173b34;
      font-size: 19px;
      line-height: 1.3;
      font-weight: 900;
      vertical-align: middle;
    }
    .room {
      margin-top: 7px;
      color: #55756d;
      font-size: 14px;
      line-height: 1.35;
      font-weight: 800;
    }
    .status {
      flex: 0 0 auto;
      max-width: 128px;
      padding: 7px 9px;
      border-radius: 999px;
      text-align: center;
      font-size: 13px;
      line-height: 1.2;
      font-weight: 900;
      word-break: keep-all;
    }
    .tone-waiting { color: #28506b; background: #dfeef8; }
    .tone-called { color: #1f5d7a; background: #d9f0fa; }
    .tone-preparing { color: #205d64; background: #d9f3f2; }
    .tone-active { color: #226154; background: #dbf2e9; }
    .tone-done { color: #245d38; background: #dff3e5; }
    .tone-remind { color: #805316; background: #f7ead2; }
    .phase {
      display: grid;
      grid-template-columns: repeat(5, minmax(0, 1fr));
      gap: 5px;
      margin: 14px 0 10px;
    }
    .phase-step {
      height: 8px;
      border-radius: 999px;
      background: #dbe6e2;
    }
    .phase-step.is-on {
      background: #6bb6a7;
    }
    .case-note {
      color: #315d53;
      font-size: 14px;
      line-height: 1.55;
      font-weight: 800;
    }
    .updated {
      margin-top: 8px;
      color: #6a837d;
      font-size: 12px;
      font-weight: 800;
    }
    .empty, .error {
      margin: 8px 16px 0;
      min-height: 220px;
      display: grid;
      place-items: center;
      padding: 24px;
      text-align: center;
      color: #55756d;
      background: #ffffff;
      border: 1px solid #dcebe4;
      border-radius: 8px;
      font-size: 16px;
      line-height: 1.65;
      font-weight: 800;
    }
    .error {
      color: #8a3f22;
      background: #fff8f3;
      border-color: #efd4c4;
    }
    @media (max-width: 360px) {
      .tabs { grid-template-columns: repeat(2, minmax(0, 1fr)); }
      .summary { grid-template-columns: repeat(2, minmax(0, 1fr)); }
      .status { max-width: 112px; }
      h1 { font-size: 20px; }
    }
  </style>
</head>
<body>
  <div class="app">
    <header class="top">
      <div class="title-row">
        <div>
          <h1>家属等待区手机端</h1>
          <div class="subtitle">患者信息已脱敏，状态以手术部正式通知为准</div>
        </div>
        <div class="clock" id="clock"></div>
      </div>
      <div class="date-line">
        <span id="dateLine">正在读取今日手术安排</span>
        <button class="refresh" type="button" id="refreshButton">刷新</button>
      </div>
    </header>
    <nav class="tabs" aria-label="状态筛选">
      <button class="tab active" type="button" data-filter="全部">全部</button>
      <button class="tab" type="button" data-filter="等待">等待</button>
      <button class="tab" type="button" data-filter="术中">术中</button>
      <button class="tab" type="button" data-filter="术后">术后</button>
    </nav>
    <section class="summary" id="summary"></section>
    <div class="notice" id="notice">请在等候区保持手机畅通。如需家属配合，护士站会通过等候号或现场广播通知。</div>
    <main class="list" id="list"></main>
  </div>
  <script>
    const params = new URLSearchParams(location.search);
    const state = {
      items: [],
      filter: "全部",
      date: params.get("date") || formatDate(new Date())
    };

    const statusHelp = {
      "等待中": "正在按计划等待接台，请留意等候区通知。",
      "等待接入": "医护团队正在安排接台，请家属在等候区等候。",
      "已进入手术区": "患者已进入手术区域，正在进行术前核对。",
      "手术准备中": "正在进行麻醉及术前准备，时间可能因个体情况调整。",
      "手术中": "手术正在有序进行，请保持安静等候。",
      "手术已结束": "手术已结束，医护团队正在整理交接。",
      "复苏观察中": "患者正在复苏观察，护士站会按流程通知。",
      "已完成": "本次手术流程已完成，请按护士站通知办理后续事项。",
      "请咨询护士站": "请凭等候号到护士站咨询。"
    };

    function pad(value) {
      return String(value).padStart(2, "0");
    }

    function formatClock(date = new Date()) {
      return date.getFullYear() + "-" + pad(date.getMonth() + 1) + "-" + pad(date.getDate())
        + "<br>" + pad(date.getHours()) + ":" + pad(date.getMinutes()) + ":" + pad(date.getSeconds());
    }

    function formatDate(date) {
      return date.getFullYear() + "-" + pad(date.getMonth() + 1) + "-" + pad(date.getDate());
    }

    function formatTime(value) {
      if (!value) return "";
      if (/^\\d{4}-\\d{2}-\\d{2} \\d{2}:\\d{2}$/.test(value)) return value.slice(11, 16);
      const date = new Date(value);
      if (Number.isNaN(date.getTime())) return String(value).slice(-5);
      return pad(date.getHours()) + ":" + pad(date.getMinutes());
    }

    function statusTone(status = "") {
      if (status === "等待接入") return "tone-called";
      if (["已进入手术区", "手术准备中"].includes(status)) return "tone-preparing";
      if (status === "手术中") return "tone-active";
      if (["手术已结束", "复苏观察中", "已完成"].includes(status)) return "tone-done";
      if (status === "请咨询护士站") return "tone-remind";
      return "tone-waiting";
    }

    function phaseIndex(status = "") {
      if (status === "等待接入") return 1;
      if (["已进入手术区", "手术准备中"].includes(status)) return 2;
      if (status === "手术中") return 3;
      if (status === "手术已结束") return 4;
      if (["复苏观察中", "已完成"].includes(status)) return 5;
      return 0;
    }

    function filterGroup(status = "") {
      if (["等待中", "等待接入"].includes(status)) return "等待";
      if (["已进入手术区", "手术准备中", "手术中"].includes(status)) return "术中";
      if (["手术已结束", "复苏观察中", "已完成"].includes(status)) return "术后";
      return "其他";
    }

    function priority(item) {
      const group = filterGroup(item.displayStatus);
      if (group === "术中") return 1;
      if (group === "等待") return 2;
      if (group === "术后") return 3;
      return 4;
    }

    async function api(path) {
      const response = await fetch(path);
      if (!response.ok) throw new Error("接口暂时不可用");
      return response.json();
    }

    function renderSummary(items) {
      const metrics = [
        ["全部", items.length],
        ["等待", items.filter((item) => filterGroup(item.displayStatus) === "等待").length],
        ["术中", items.filter((item) => filterGroup(item.displayStatus) === "术中").length],
        ["术后", items.filter((item) => filterGroup(item.displayStatus) === "术后").length]
      ];
      document.getElementById("summary").innerHTML = metrics.map(([label, value]) => \`
        <div class="metric">
          <div class="label">\${label}</div>
          <div class="value">\${value}</div>
        </div>
      \`).join("");
    }

    function renderList() {
      const filtered = state.items
        .filter((item) => state.filter === "全部" || filterGroup(item.displayStatus) === state.filter)
        .sort((left, right) => priority(left) - priority(right)
          || String(left.lastUpdatedTime || "").localeCompare(String(right.lastUpdatedTime || ""))
          || String(left.queueNo || "").localeCompare(String(right.queueNo || "")));

      const target = document.getElementById("list");
      if (!filtered.length) {
        target.innerHTML = '<div class="empty">当前筛选条件下暂无展示信息<br>请留意护士站通知</div>';
        return;
      }

      target.innerHTML = filtered.map((item) => {
        const index = phaseIndex(item.displayStatus);
        const phases = [1, 2, 3, 4, 5].map((step) => \`<span class="phase-step \${step <= index ? "is-on" : ""}"></span>\`).join("");
        return \`
          <article class="case">
            <div class="case-head">
              <div class="patient-line">
                <span class="queue">\${item.queueNo}</span>
                <span class="patient">\${item.patientName}</span>
                <div class="room">\${item.roomName}</div>
              </div>
              <span class="status \${statusTone(item.displayStatus)}">\${item.displayStatus}</span>
            </div>
            <div class="phase" aria-hidden="true">\${phases}</div>
            <div class="case-note">\${statusHelp[item.displayStatus] || "请关注护士站正式通知。"}</div>
            <div class="updated">最近更新：\${formatTime(item.lastUpdatedTime)}</div>
          </article>
        \`;
      }).join("");
    }

    async function load() {
      try {
        const snapshot = await api("/api/v1/or-display/family-waiting-snapshot?date=" + encodeURIComponent(state.date));
        state.items = (snapshot.items || []).filter((item) => item.displayStatus && item.displayStatus !== "请咨询护士站");
        document.getElementById("dateLine").textContent = state.date + " 手术等候信息，共 " + state.items.length + " 条";
        document.getElementById("notice").textContent = snapshot.notice || "患者信息已脱敏，请以护士站正式通知为准。";
        renderSummary(state.items);
        renderList();
      } catch (error) {
        document.getElementById("list").innerHTML = '<div class="error">暂时无法读取等候信息，请稍后刷新或咨询护士站。</div>';
      }
    }

    function tick() {
      document.getElementById("clock").innerHTML = formatClock();
    }

    document.querySelectorAll(".tab").forEach((button) => {
      button.addEventListener("click", () => {
        state.filter = button.dataset.filter;
        document.querySelectorAll(".tab").forEach((item) => item.classList.toggle("active", item === button));
        renderList();
      });
    });
    document.getElementById("refreshButton").addEventListener("click", load);

    tick();
    load();
    setInterval(tick, 1000);
    setInterval(load, 15000);
  </script>
</body>
</html>`;
}
