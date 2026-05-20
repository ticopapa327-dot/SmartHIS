function shell(title, body, script, options = {}) {
  const bodyClass = options.bodyClass ? ` class="${options.bodyClass}"` : "";
  return `<!doctype html>
<html lang="zh-CN">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>${title}</title>
  <style>
    :root {
      color-scheme: dark;
      font-family: "Microsoft YaHei", "PingFang SC", Arial, sans-serif;
      background: #07141d;
      color: #eef8ff;
    }
    * { box-sizing: border-box; }
    body {
      margin: 0;
      min-height: 100vh;
      background: #07141d;
    }
    header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 24px;
      padding: 26px 38px 18px;
      border-bottom: 1px solid rgba(255, 255, 255, 0.14);
    }
    h1 {
      margin: 0;
      font-size: 34px;
      line-height: 1.2;
      letter-spacing: 0;
    }
    .clock {
      min-width: 260px;
      text-align: right;
      color: #9ed8ff;
      font-size: 22px;
      white-space: nowrap;
    }
    main {
      padding: 24px 38px 38px;
    }
    .metrics {
      display: grid;
      grid-template-columns: repeat(4, minmax(0, 1fr));
      gap: 14px;
      margin-bottom: 18px;
    }
    .metric, .panel {
      background: rgba(10, 38, 58, 0.78);
      border: 1px solid rgba(255, 255, 255, 0.14);
      border-radius: 6px;
    }
    .metric {
      padding: 16px 18px;
      min-height: 96px;
    }
    .metric .label {
      color: #a8c7d6;
      font-size: 17px;
    }
    .metric .value {
      margin-top: 8px;
      font-size: 34px;
      font-weight: 800;
      color: #ffffff;
    }
    .layout {
      display: grid;
      grid-template-columns: 1.25fr 0.75fr;
      gap: 16px;
    }
    .layout-wide {
      display: grid;
      grid-template-columns: 1fr;
      gap: 16px;
    }
    .panel {
      overflow: hidden;
    }
    .panel h2 {
      margin: 0;
      padding: 16px 18px;
      color: #9ed8ff;
      font-size: 20px;
      border-bottom: 1px solid rgba(255, 255, 255, 0.12);
    }
    .panel-body {
      padding: 18px;
    }
    .headline {
      display: grid;
      grid-template-columns: 180px 1fr;
      gap: 18px;
      align-items: stretch;
    }
    .room-badge {
      display: flex;
      align-items: center;
      justify-content: center;
      min-height: 150px;
      background: #135a73;
      border-radius: 6px;
      font-size: 44px;
      font-weight: 800;
      text-align: center;
    }
    .case-title {
      font-size: 34px;
      line-height: 1.25;
      font-weight: 800;
    }
    .subtle {
      color: #a8c7d6;
    }
    .patient-line {
      margin-top: 14px;
      display: grid;
      grid-template-columns: repeat(3, minmax(0, 1fr));
      gap: 10px;
      color: #d9edf7;
      font-size: 22px;
    }
    .status {
      display: inline-block;
      min-width: 92px;
      padding: 7px 11px;
      border-radius: 4px;
      text-align: center;
      font-weight: 800;
      background: #1d4f70;
      color: #fff;
      white-space: nowrap;
    }
    .tone-waiting { background: #1d4f70; }
    .tone-active { background: #b45309; }
    .tone-done { background: #047857; }
    .tone-cleaning { background: #6d5c16; }
    .tone-cancelled { background: #7f1d1d; }
    .tone-risk { background: #b91c1c; }
    .tone-remind { background: #a16207; }
    .tone-pass { background: #047857; }
    table {
      width: 100%;
      border-collapse: collapse;
      table-layout: fixed;
    }
    th, td {
      padding: 13px 14px;
      border-bottom: 1px solid rgba(255, 255, 255, 0.11);
      text-align: left;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
      font-size: 18px;
    }
    th {
      color: #9ed8ff;
      background: rgba(3, 18, 29, 0.72);
      font-size: 16px;
      font-weight: 700;
    }
    .facts {
      display: grid;
      grid-template-columns: repeat(2, minmax(0, 1fr));
      gap: 10px;
    }
    .fact {
      padding: 12px 14px;
      background: rgba(255, 255, 255, 0.06);
      border-radius: 6px;
      min-height: 70px;
    }
    .fact .label {
      color: #a8c7d6;
      font-size: 15px;
    }
    .fact .value {
      margin-top: 8px;
      font-size: 20px;
      font-weight: 700;
    }
    .list {
      display: grid;
      gap: 10px;
    }
    .list-item {
      padding: 12px 14px;
      background: rgba(255, 255, 255, 0.06);
      border-radius: 6px;
      color: #d9edf7;
      font-size: 17px;
      line-height: 1.45;
    }
    .empty {
      padding: 48px;
      color: #a8c7d6;
      text-align: center;
      font-size: 24px;
    }
    @media (max-width: 1100px) {
      header {
        align-items: flex-start;
        flex-direction: column;
        padding: 20px;
      }
      main { padding: 18px 20px; }
      h1 { font-size: 28px; }
      .clock { text-align: left; min-width: 0; }
      .metrics, .layout, .headline, .patient-line, .facts {
        grid-template-columns: 1fr;
      }
      .room-badge { min-height: 96px; }
      .case-title { font-size: 26px; }
      th, td { font-size: 15px; padding: 10px 8px; }
    }

    body.door-display-shell {
      min-height: 100vh;
      overflow: auto;
      background:
        radial-gradient(circle at 50% 0%, rgba(54, 169, 123, 0.18), transparent 34%),
        linear-gradient(180deg, #d8eadb 0%, #eef5e8 100%);
      color: #17211e;
    }
    body.door-display-shell header {
      display: none;
    }
    body.door-display-shell main {
      width: min(100vw, calc(100vh * 0.5625));
      min-width: 360px;
      min-height: 100vh;
      margin: 0 auto;
      padding: 14px;
      background:
        linear-gradient(90deg, rgba(14, 138, 92, 0.28) 0 9px, transparent 9px),
        linear-gradient(180deg, #edf5e8 0%, #dcefe2 100%);
      box-shadow: 0 0 28px rgba(12, 84, 57, 0.18);
    }
    .door-screen {
      min-height: calc(100vh - 28px);
      display: flex;
      flex-direction: column;
      gap: 10px;
    }
    .door-hero {
      position: relative;
      min-height: 162px;
      padding: 18px 18px 16px 206px;
      overflow: hidden;
      background: linear-gradient(180deg, #fbfbef 0%, #ecf5e7 100%);
      border-radius: 8px;
      box-shadow: 0 8px 24px rgba(24, 112, 75, 0.16);
    }
    .door-room-badge {
      position: absolute;
      top: -8px;
      left: 22px;
      width: 168px;
      height: 152px;
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      gap: 6px;
      color: #effff7;
      background: linear-gradient(180deg, #35a36c 0%, #168956 100%);
      border: 1px solid rgba(255, 255, 255, 0.55);
      border-radius: 8px 8px 44px 44px;
      box-shadow: inset 0 1px 16px rgba(255, 255, 255, 0.18), 0 10px 22px rgba(13, 115, 73, 0.28);
    }
    .door-room-badge .room-code {
      font-size: 42px;
      line-height: 1;
      font-weight: 500;
    }
    .door-room-badge .room-table {
      font-size: 28px;
      line-height: 1;
      font-weight: 700;
    }
    .door-date {
      text-align: center;
      font-size: 17px;
      color: #1a2724;
      font-weight: 700;
    }
    .door-main-status {
      margin-top: 10px;
      text-align: center;
      font-size: 46px;
      line-height: 1;
      font-weight: 900;
      color: #111827;
    }
    .door-duration {
      display: flex;
      justify-content: center;
      align-items: center;
      gap: 10px;
      margin-top: 12px;
      font-weight: 800;
      color: #17211e;
    }
    .door-duration span {
      min-width: 39px;
      padding: 8px 7px;
      text-align: center;
      background: #b9d8c8;
      border-radius: 7px;
      box-shadow: inset 0 -2px 0 rgba(13, 115, 73, 0.12);
    }
    .door-card {
      overflow: hidden;
      background: rgba(255, 255, 246, 0.95);
      border: 1px solid rgba(20, 110, 74, 0.24);
      border-radius: 8px;
      box-shadow: 0 8px 18px rgba(60, 98, 79, 0.15);
    }
    .door-card-header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      min-height: 38px;
      padding: 0 12px 0 18px;
      color: #ffffff;
      background: linear-gradient(90deg, #0d7b4d 0%, #209466 100%);
      font-size: 18px;
      font-weight: 900;
    }
    .door-pill {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      min-width: 74px;
      padding: 6px 12px;
      color: #ffffff;
      background: #168956;
      border-radius: 999px;
      font-size: 15px;
      font-weight: 800;
      white-space: nowrap;
    }
    .door-pill.warn {
      color: #8a1f1f;
      background: #f5dddd;
      border: 1px solid rgba(138, 31, 31, 0.28);
    }
    .door-card-body {
      padding: 14px 16px 12px;
    }
    .door-patient {
      display: grid;
      grid-template-columns: 54px 1fr auto;
      gap: 12px;
      align-items: start;
    }
    .door-avatar {
      width: 52px;
      height: 52px;
      border-radius: 50%;
      background:
        radial-gradient(circle at 50% 30%, #1f2937 0 20%, transparent 21%),
        radial-gradient(circle at 50% 78%, #7da6c5 0 42%, transparent 43%),
        #e9f1f3;
      border: 2px solid #d6e4df;
    }
    .door-name-line {
      display: flex;
      align-items: center;
      gap: 8px;
      flex-wrap: wrap;
      min-width: 0;
      font-size: 18px;
      line-height: 1.35;
      color: #1f2933;
    }
    .door-name {
      font-size: 22px;
      font-weight: 900;
    }
    .door-meta {
      margin-top: 4px;
      color: #2f3c38;
      font-size: 16px;
      line-height: 1.45;
    }
    .door-divider {
      height: 1px;
      margin: 11px 0 10px;
      background: repeating-linear-gradient(90deg, rgba(91, 118, 105, 0.28) 0 7px, transparent 7px 12px);
    }
    .door-field {
      margin-top: 5px;
      display: grid;
      grid-template-columns: 112px 1fr;
      gap: 8px;
      font-size: 17px;
      line-height: 1.42;
      color: #17211e;
    }
    .door-field .label {
      color: #253530;
      font-weight: 800;
      white-space: nowrap;
    }
    .door-staff-grid {
      margin-top: 10px;
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 0 16px;
      padding: 10px 14px;
      background: rgba(214, 226, 216, 0.75);
      border-radius: 8px;
      font-size: 16px;
      line-height: 1.7;
      color: #22302b;
    }
    .door-card.next .door-card-header {
      color: #17211e;
      background: linear-gradient(90deg, #e7eee2 0%, #d8eadc 100%);
    }
    .door-bottom {
      margin-top: auto;
      display: grid;
      grid-template-columns: 0.55fr 1fr 0.56fr;
      gap: 9px;
      align-items: stretch;
    }
    .door-env-list {
      display: grid;
      gap: 9px;
    }
    .door-env-item {
      display: grid;
      grid-template-columns: 34px 1fr;
      gap: 9px;
      align-items: center;
      min-height: 58px;
      padding: 8px 10px;
      background: rgba(255, 255, 246, 0.92);
      border: 1px solid rgba(20, 110, 74, 0.16);
      border-radius: 8px;
    }
    .door-env-icon {
      width: 32px;
      height: 32px;
      display: grid;
      place-items: center;
      border-radius: 50%;
      color: #fff;
      background: #2aa879;
      font-size: 17px;
      font-weight: 900;
    }
    .door-env-label {
      color: #42524c;
      font-size: 13px;
    }
    .door-env-value {
      margin-top: 2px;
      color: #17211e;
      font-size: 16px;
      font-weight: 900;
    }
    .door-room-photo {
      min-height: 170px;
      border-radius: 8px;
      border: 1px solid rgba(20, 110, 74, 0.22);
      overflow: hidden;
      background:
        linear-gradient(180deg, rgba(10, 26, 32, 0.05), rgba(10, 26, 32, 0.38)),
        linear-gradient(25deg, transparent 0 34%, rgba(29, 78, 64, 0.9) 35% 46%, transparent 47%),
        linear-gradient(160deg, transparent 0 42%, rgba(23, 76, 96, 0.64) 43% 58%, transparent 59%),
        linear-gradient(180deg, #b8c8c8 0 30%, #7f9da1 31% 58%, #284952 59% 100%);
      position: relative;
    }
    .door-room-photo::before {
      content: "";
      position: absolute;
      left: 12%;
      right: 12%;
      bottom: 18%;
      height: 24%;
      border-radius: 50% 50% 8px 8px;
      background: #16856c;
      box-shadow: 0 12px 20px rgba(0, 0, 0, 0.24);
    }
    .door-room-photo::after {
      content: "";
      position: absolute;
      left: 34%;
      top: 14%;
      width: 32%;
      height: 26%;
      border-radius: 50%;
      border: 5px solid rgba(230, 240, 238, 0.7);
      box-shadow: -38px 18px 0 -16px rgba(230, 240, 238, 0.72), 42px 20px 0 -18px rgba(230, 240, 238, 0.7);
    }
    .door-call {
      display: grid;
      place-items: center;
      gap: 10px;
      min-height: 170px;
      padding: 18px 10px;
      color: #ffffff;
      background: linear-gradient(180deg, #2fc082, #0a8b59);
      border-radius: 8px;
      font-size: 17px;
      font-weight: 800;
      text-align: center;
      box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.25), 0 8px 18px rgba(8, 115, 73, 0.24);
    }
    .door-call-icon {
      width: 48px;
      height: 48px;
      display: grid;
      place-items: center;
      color: #128150;
      background: rgba(255, 255, 255, 0.85);
      border-radius: 50%;
      font-size: 25px;
    }
    .door-notice {
      margin-top: 4px;
      color: #174332;
      font-size: 12px;
      font-weight: 800;
    }
    .door-empty {
      min-height: calc(100vh - 28px);
      display: grid;
      place-items: center;
      text-align: center;
      color: #23533e;
      background: rgba(255, 255, 246, 0.84);
      border-radius: 8px;
      font-size: 26px;
      font-weight: 900;
    }
    @media (max-height: 860px) {
      body.door-display-shell main {
        width: min(100vw, 560px);
      }
      .door-hero { min-height: 140px; padding-left: 182px; }
      .door-room-badge { width: 146px; height: 132px; }
      .door-main-status { font-size: 38px; }
      .door-card-body { padding: 10px 12px; }
      .door-bottom, .door-room-photo, .door-call { min-height: 130px; }
      .door-staff-grid { font-size: 14px; line-height: 1.45; }
    }

    .control-shell {
      display: grid;
      grid-template-columns: minmax(0, 1.08fr) minmax(320px, 0.92fr);
      gap: 16px;
    }
    .control-status {
      display: grid;
      grid-template-columns: repeat(2, minmax(0, 1fr));
      gap: 12px;
      margin-top: 16px;
    }
    .control-button {
      min-height: 72px;
      border: 1px solid rgba(158, 216, 255, 0.26);
      border-radius: 6px;
      color: #eef8ff;
      background: #124763;
      font: inherit;
      font-size: 22px;
      font-weight: 800;
      cursor: pointer;
    }
    .control-button:hover {
      background: #176182;
    }
    .control-button:disabled {
      cursor: not-allowed;
      color: #8ba8b8;
      background: rgba(255, 255, 255, 0.08);
    }
    .control-form {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 12px;
    }
    .control-form label {
      display: grid;
      gap: 7px;
      color: #a8c7d6;
      font-size: 15px;
    }
    .control-form input, .control-form select {
      width: 100%;
      min-height: 42px;
      border: 1px solid rgba(255, 255, 255, 0.18);
      border-radius: 6px;
      padding: 8px 10px;
      color: #eef8ff;
      background: #081f31;
      font: inherit;
    }
    .control-message {
      margin-top: 14px;
      min-height: 28px;
      color: #9ed8ff;
      font-size: 17px;
    }
    .control-message.error {
      color: #fecaca;
    }
    .sim-grid {
      display: grid;
      grid-template-columns: repeat(12, minmax(0, 1fr));
      gap: 18px;
      align-items: start;
    }
    .sim-device {
      min-height: 0;
    }
    .sim-device-portrait {
      grid-column: span 3;
    }
    .sim-device-landscape {
      grid-column: span 6;
    }
    .sim-device h2 {
      position: relative;
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 12px;
      padding-left: 150px;
      padding-right: 150px;
    }
    .sim-resolution {
      position: absolute;
      top: 50%;
      right: 18px;
      transform: translateY(-50%);
      padding: 4px 8px;
      border: 1px solid rgba(158, 216, 255, 0.3);
      border-radius: 4px;
      color: #dff3ff;
      background: rgba(158, 216, 255, 0.12);
      font-size: 12px;
      font-weight: 800;
      white-space: nowrap;
    }
    .sim-title-text {
      flex: 0 1 auto;
      min-width: 0;
      text-align: center;
    }
    .sim-device-frame {
      padding: 12px;
      background: #030d15;
      border-radius: 8px;
      box-shadow: inset 0 0 0 1px rgba(255, 255, 255, 0.08);
    }
    .sim-screen {
      position: relative;
      width: 100%;
      margin: 0 auto;
      overflow: hidden;
      border: 10px solid #111827;
      border-radius: 12px;
      background: #061624;
      box-shadow: 0 18px 42px rgba(0, 0, 0, 0.34);
    }
    .sim-device-portrait .sim-screen {
      max-width: 390px;
      aspect-ratio: 1080 / 1920;
    }
    .sim-device-landscape .sim-screen {
      max-width: 100%;
      aspect-ratio: 3840 / 2160;
    }
    .sim-screen-body {
      position: absolute;
      inset: 0;
      overflow: auto;
      padding: 14px;
      background: linear-gradient(180deg, rgba(9, 33, 52, 0.98), rgba(4, 18, 30, 0.98));
    }
    .sim-device-portrait .sim-screen-body {
      padding: 16px 12px;
    }
    .sim-device-portrait .control-status {
      grid-template-columns: 1fr;
      gap: 8px;
      margin-top: 12px;
    }
    .sim-device-portrait .control-button {
      min-height: 48px;
      font-size: 16px;
    }
    .sim-device-portrait .status {
      min-width: 76px;
      padding: 6px 8px;
      font-size: 14px;
    }
    .sim-row {
      display: grid;
      grid-template-columns: 96px 1fr auto;
      gap: 10px;
      align-items: center;
      padding: 10px 0;
      border-bottom: 1px solid rgba(255, 255, 255, 0.1);
      font-size: 16px;
    }
    .sim-row:last-child {
      border-bottom: 0;
    }
    .sim-device-portrait .sim-row {
      grid-template-columns: 76px minmax(0, 1fr);
      gap: 8px;
      padding: 8px 0;
      font-size: 14px;
    }
    .sim-device-portrait .sim-row > div:nth-child(3) {
      grid-column: 2;
      justify-self: start;
      margin-top: 4px;
    }
    .family-mini {
      min-height: 100%;
      padding: 12px;
      color: #173b34;
      background: #f6fbf8;
      border-radius: 8px;
    }
    .family-mini-head {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 12px;
      margin-bottom: 12px;
      color: #1e6055;
      font-weight: 900;
    }
    .family-mini-title {
      font-size: 18px;
    }
    .family-mini-note {
      padding: 8px 10px;
      margin-bottom: 12px;
      color: #315d53;
      background: #eef7f4;
      border: 1px solid #cfe4dc;
      border-radius: 6px;
      font-size: 13px;
      font-weight: 700;
      line-height: 1.45;
    }
    .family-mini-list {
      display: grid;
      grid-template-columns: repeat(2, minmax(0, 1fr));
      gap: 10px;
    }
    .family-mini-card {
      padding: 11px 12px;
      border: 1px solid #dcebe4;
      border-left: 5px solid #6bb6a7;
      border-radius: 7px;
      background: #ffffff;
      box-shadow: 0 8px 18px rgba(27, 72, 62, 0.08);
    }
    .family-mini-card-top {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 10px;
      margin-bottom: 8px;
    }
    .family-mini-id {
      color: #1e6055;
      font-size: 22px;
      font-weight: 900;
    }
    .family-mini-patient {
      color: #173b34;
      font-size: 17px;
      font-weight: 900;
    }
    .family-mini-room, .family-mini-help {
      color: #52756c;
      font-size: 13px;
      font-weight: 700;
      line-height: 1.4;
    }
    .family-mini-status {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      min-width: 82px;
      padding: 5px 8px;
      border-radius: 999px;
      font-size: 13px;
      font-weight: 900;
      white-space: nowrap;
    }
    .family-tone-waiting { color: #28506b; background: #dfeef8; }
    .family-tone-called { color: #1f5d7a; background: #d9f0fa; }
    .family-tone-preparing { color: #205d64; background: #d9f3f2; }
    .family-tone-active { color: #226154; background: #dbf2e9; }
    .family-tone-done { color: #245d38; background: #dff3e5; }
    .family-tone-remind { color: #805316; background: #f7ead2; }

    body.or-control-shell {
      color-scheme: dark;
      background: #081513;
      color: #edf7f3;
    }
    body.or-control-shell header {
      background: #0a1f1b;
      border-bottom: 1px solid rgba(126, 213, 189, 0.22);
    }
    body.or-control-shell .clock {
      color: #b9efe1;
    }
    body.or-control-shell .panel {
      background: #0f2622;
      border-color: rgba(126, 213, 189, 0.22);
      box-shadow: 0 14px 30px rgba(0, 0, 0, 0.24);
    }
    body.or-control-shell .panel h2 {
      color: #b9efe1;
      background: #0b1d1a;
      border-bottom-color: rgba(126, 213, 189, 0.2);
    }
    body.or-control-shell .room-badge {
      color: #06201a;
      background: #8edbc7;
    }
    body.or-control-shell .case-title {
      color: #f2fffb;
    }
    body.or-control-shell .patient-line,
    body.or-control-shell .fact .value {
      color: #d8f4ed;
    }
    body.or-control-shell .subtle,
    body.or-control-shell .fact .label,
    body.or-control-shell .control-form label {
      color: #9ccbc0;
    }
    body.or-control-shell .fact {
      background: rgba(255, 255, 255, 0.055);
      border: 1px solid rgba(126, 213, 189, 0.12);
    }
    body.or-control-shell .control-form input,
    body.or-control-shell .control-form select {
      color: #f2fffb;
      background: #071a17;
      border-color: rgba(126, 213, 189, 0.24);
    }
    body.or-control-shell .control-button {
      color: #06201a;
      background: #8edbc7;
      border-color: rgba(255, 255, 255, 0.18);
    }
    body.or-control-shell .control-button:hover {
      background: #a5ead8;
    }
    body.or-control-shell .control-button:disabled {
      color: #78968f;
      background: rgba(255, 255, 255, 0.06);
      border-color: rgba(255, 255, 255, 0.08);
    }
    body.or-control-shell .control-message {
      color: #b9efe1;
    }

    body.door-display-shell {
      background: linear-gradient(180deg, #eef6f1 0%, #e4f0e9 100%);
    }
    body.door-display-shell main {
      background:
        linear-gradient(90deg, rgba(64, 119, 104, 0.22) 0 8px, transparent 8px),
        linear-gradient(180deg, #f7fbf5 0%, #e8f3ec 100%);
    }
    body.door-display-shell .door-hero {
      background: linear-gradient(180deg, #ffffff 0%, #eef7f1 100%);
      box-shadow: 0 8px 20px rgba(40, 84, 72, 0.13);
    }
    body.door-display-shell .door-room-badge,
    body.door-display-shell .door-card-header {
      background: linear-gradient(180deg, #438575 0%, #2f6f62 100%);
    }
    body.door-display-shell .door-main-status {
      color: #173d35;
    }
    .door-calm-ribbon {
      min-height: 42px;
      display: grid;
      place-items: center;
      padding: 8px 14px;
      color: #255c50;
      background: #e8f4ef;
      border: 1px solid rgba(71, 135, 117, 0.24);
      border-radius: 8px;
      font-size: 18px;
      font-weight: 900;
      letter-spacing: 0;
      text-align: center;
    }
    body.door-display-shell .door-notice {
      padding: 8px 10px;
      color: #255c50;
      background: #eef8f3;
      border: 1px solid rgba(71, 135, 117, 0.2);
      border-radius: 8px;
      text-align: center;
      font-size: 13px;
    }

    body.nurse-station-shell {
      color-scheme: light;
      background: #eef4f7;
      color: #17242b;
    }
    body.nurse-station-shell header {
      position: relative;
      justify-content: center;
      background: #ffffff;
      border-bottom: 1px solid #d6e4ea;
    }
    body.nurse-station-shell h1 {
      color: #17242b;
      text-align: center;
    }
    body.nurse-station-shell .clock {
      position: absolute;
      right: 38px;
      color: #166272;
    }
    body.nurse-station-shell .metric,
    body.nurse-station-shell .panel {
      background: #ffffff;
      border-color: #d6e4ea;
      box-shadow: 0 10px 24px rgba(25, 64, 77, 0.08);
    }
    body.nurse-station-shell .metric {
      border-left: 5px solid #2b8a9b;
    }
    body.nurse-station-shell .metric .label,
    body.nurse-station-shell .subtle {
      color: #58717a;
    }
    body.nurse-station-shell .metric .value,
    body.nurse-station-shell .fact .value {
      color: #17242b;
    }
    body.nurse-station-shell .panel h2 {
      color: #145767;
      background: #f5fafc;
      border-bottom-color: #d6e4ea;
    }
    body.nurse-station-shell th {
      color: #145767;
      background: #e8f2f5;
      border-bottom-color: #c8dbe2;
    }
    body.nurse-station-shell td {
      color: #17242b;
      border-bottom-color: #e4edf1;
    }

    body.director-dashboard-shell {
      color-scheme: dark;
      background: #101521;
      color: #edf2f7;
    }
    body.director-dashboard-shell header {
      position: relative;
      justify-content: center;
      background: #121a2a;
      border-bottom: 1px solid rgba(212, 170, 93, 0.26);
    }
    body.director-dashboard-shell h1 {
      text-align: center;
    }
    body.director-dashboard-shell .clock {
      position: absolute;
      right: 38px;
      color: #e7c980;
    }
    body.director-dashboard-shell .metric,
    body.director-dashboard-shell .panel {
      background: #182238;
      border-color: rgba(212, 170, 93, 0.2);
      box-shadow: 0 16px 34px rgba(0, 0, 0, 0.28);
    }
    body.director-dashboard-shell .metric {
      border-top: 4px solid #d4aa5d;
    }
    body.director-dashboard-shell .metric .label,
    body.director-dashboard-shell .subtle {
      color: #aeb8ca;
    }
    body.director-dashboard-shell .metric .value {
      color: #f7d98f;
    }
    body.director-dashboard-shell .panel h2 {
      color: #f7d98f;
      background: #131c2e;
      border-bottom-color: rgba(212, 170, 93, 0.2);
    }
    body.director-dashboard-shell th {
      color: #f7d98f;
      background: #121a2a;
    }
    body.director-dashboard-shell td {
      color: #edf2f7;
    }
    body.director-dashboard-shell .list-item {
      background: rgba(255, 255, 255, 0.055);
      border: 1px solid rgba(212, 170, 93, 0.13);
    }

    .terminal-inner-theme {
      color: #edf7f3;
      background: #0b1b18;
    }
    .terminal-door-theme {
      color: #173b34;
      background: #eef6f1;
    }
    .terminal-family-theme {
      color: #173b34;
      background: #f6fbf8;
    }
    .terminal-nurse-theme {
      color: #17242b;
      background: #eef4f7;
    }
    .terminal-director-theme {
      color: #edf2f7;
      background: #111827;
    }
    .terminal-heartbeat-theme {
      color: #e5eef8;
      background: #0d1726;
    }
    .terminal-door-theme .sim-row,
    .terminal-nurse-theme .sim-row {
      border-bottom-color: rgba(23, 36, 43, 0.12);
    }
    .terminal-door-theme .subtle,
    .terminal-nurse-theme .subtle {
      color: #58716b;
    }
    .door-mini-quiet,
    .nurse-mini-head,
    .director-mini-head {
      margin-bottom: 10px;
      padding: 9px 11px;
      border-radius: 7px;
      font-weight: 900;
      line-height: 1.35;
    }
    .door-mini-quiet {
      color: #245c50;
      background: #e1f0ea;
      border: 1px solid rgba(47, 111, 98, 0.22);
      text-align: center;
    }
    .nurse-mini-head {
      color: #145767;
      background: #ffffff;
      border: 1px solid #d6e4ea;
    }
    .director-mini-head {
      color: #f7d98f;
      background: #182238;
      border: 1px solid rgba(212, 170, 93, 0.2);
    }
    .director-mini-metrics {
      display: grid;
      grid-template-columns: repeat(2, minmax(0, 1fr));
      gap: 8px;
    }
    .director-mini-metric {
      min-height: 62px;
      padding: 10px;
      border: 1px solid rgba(212, 170, 93, 0.16);
      border-radius: 7px;
      background: rgba(255, 255, 255, 0.055);
    }
    .director-mini-metric .label {
      color: #aeb8ca;
      font-size: 12px;
      font-weight: 800;
    }
    .director-mini-metric .value {
      margin-top: 5px;
      color: #f7d98f;
      font-size: 22px;
      font-weight: 900;
    }
    body.or-simulator-shell .sim-tools {
      padding: 12px 14px;
      background: rgba(10, 38, 58, 0.78);
      border: 1px solid rgba(255, 255, 255, 0.14);
      border-radius: 8px;
    }
    body.or-simulator-shell .sim-device h2 {
      min-height: 58px;
      color: #dff3ff;
    }
    body.or-simulator-shell .sim-device-frame {
      background: #020910;
    }
    @media (max-width: 1100px) {
      body.nurse-station-shell header,
      body.director-dashboard-shell header {
        justify-content: flex-start;
      }
      body.nurse-station-shell h1,
      body.director-dashboard-shell h1 {
        text-align: left;
      }
      body.nurse-station-shell .clock,
      body.director-dashboard-shell .clock {
        position: static;
      }
    }
    .sim-tools {
      display: flex;
      flex-wrap: wrap;
      gap: 10px;
      margin-bottom: 14px;
    }
    .sim-tools input, .sim-tools select, .sim-tools button {
      min-height: 40px;
      border: 1px solid rgba(255, 255, 255, 0.18);
      border-radius: 6px;
      padding: 8px 10px;
      color: #eef8ff;
      background: #081f31;
      font: inherit;
    }
    .sim-tools button {
      cursor: pointer;
      background: #124763;
      font-weight: 800;
    }
    @media (max-width: 1500px) {
      .sim-device-portrait {
        grid-column: span 6;
      }
      .sim-device-landscape {
        grid-column: span 12;
      }
    }
    @media (max-width: 1100px) {
      .control-shell, .control-status, .control-form {
        grid-template-columns: 1fr;
      }
      .sim-device-portrait, .sim-device-landscape {
        grid-column: span 12;
      }
      .sim-device h2 {
        padding-left: 18px;
        padding-right: 18px;
        flex-direction: column;
      }
      .sim-resolution {
        position: static;
        transform: none;
      }
    }
  </style>
</head>
<body${bodyClass}>
  <header>
    <h1>${title}</h1>
    <div class="clock" id="clock"></div>
  </header>
  <main>${body}</main>
  <script>
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
    async function api(path, options = undefined) {
      const response = await fetch(path, options);
      const body = await response.json();
      if (!response.ok) throw new Error(body.message || response.statusText);
      return body;
    }
    function fmtTime(value) {
      if (!value) return "";
      const date = new Date(value);
      return Number.isNaN(date.getTime()) ? value : date.toLocaleTimeString("zh-CN", { hour: "2-digit", minute: "2-digit" });
    }
    function maskName(name = "") {
      return name ? name.slice(0, 1) + "**" : "";
    }
    function maskNo(value = "") {
      return value ? value.slice(0, 4) + "****" + value.slice(-2) : "";
    }
    function statusTone(status = "") {
      if (["手术开始", "麻醉开始", "已入室", "手术结束"].includes(status)) return "tone-active";
      if (["清洁中"].includes(status)) return "tone-cleaning";
      if (["已完成", "已出室", "通过", "已出院", "已结算"].includes(status)) return "tone-done";
      if (["已取消", "未通过", "危急值", "异常"].includes(status)) return "tone-risk";
      if (["提醒", "待处理", "待执行"].includes(status)) return "tone-remind";
      return "tone-waiting";
    }
    function staffName(item, role) {
      return (item.staff || []).find((staff) => staff.role === role)?.practitioner?.name || "";
    }
    function activeLike(status = "") {
      return ["已接台", "已入室", "麻醉开始", "手术开始", "手术结束", "已出室", "清洁中"].includes(status);
    }
    function roomShortName(roomName = "") {
      const matched = String(roomName).match(/\\d+/);
      return matched ? matched[0] + "号" : String(roomName || "");
    }
    ${script}
    tick();
    load();
    setInterval(tick, 1000);
  </script>
</body>
</html>`;
}

export function renderOrInnerControlHtml() {
  return shell(
    "手术室内状态控制端",
    `<div class="control-shell">
      <section class="panel">
        <h2>当前手术</h2>
        <div class="panel-body">
          <div class="headline">
            <div class="room-badge" id="roomBadge">--</div>
            <div>
              <div class="case-title" id="caseTitle">正在读取手术间状态</div>
              <div class="patient-line" id="caseMeta"></div>
            </div>
          </div>
          <div class="control-status" id="statusButtons"></div>
          <div class="control-message" id="message"></div>
        </div>
      </section>
      <section class="panel">
        <h2>终端身份</h2>
        <div class="panel-body">
          <div class="control-form">
            <label>手术间<input id="roomId" value="OR01"></label>
            <label>设备 ID<input id="deviceId" value=""></label>
            <label>操作人员
              <select id="operatorId">
                <option value="PRA004">赵护士</option>
                <option value="PRA003">周麻醉</option>
                <option value="PRA001">李主任</option>
              </select>
            </label>
            <label>越级原因<input id="overrideReason" placeholder="仅急诊/纠偏时填写"></label>
          </div>
          <div class="facts" id="terminalFacts" style="margin-top: 14px;"></div>
        </div>
      </section>
    </div>`,
    `
    const statusFlow = ["已接台", "已入室", "麻醉开始", "手术开始", "手术结束", "已出室", "清洁中", "已完成", "已取消"];
    const nextMap = {
      "已排班": ["已接台", "已取消"],
      "已接台": ["已入室", "已取消"],
      "已入室": ["麻醉开始", "已取消"],
      "麻醉开始": ["手术开始", "已取消"],
      "手术开始": ["手术结束"],
      "手术结束": ["已出室"],
      "已出室": ["清洁中", "已完成"],
      "清洁中": ["已完成"],
      "已完成": [],
      "已取消": []
    };
    let currentSnapshot = null;

    function message(text, error = false) {
      const node = document.getElementById("message");
      node.textContent = text || "";
      node.className = error ? "control-message error" : "control-message";
    }

    async function loadTerminals(roomId) {
      const terminals = await api("/api/v1/or-terminals?roomId=" + encodeURIComponent(roomId));
      const indoor = terminals.items.find((item) => item.terminalType === "室内控制终端") || terminals.items[0];
      if (indoor && !document.getElementById("deviceId").value) {
        document.getElementById("deviceId").value = indoor.deviceId;
      }
      document.getElementById("terminalFacts").innerHTML = terminals.items.map((item) => \`
        <div class="fact">
          <div class="label">\${item.terminalType}</div>
          <div class="value">\${item.deviceName}<br><span class="subtle">\${item.status} · \${item.lastHeartbeatTime || ""}</span></div>
        </div>
      \`).join("") || '<div class="fact"><div class="label">终端</div><div class="value">未绑定</div></div>';
    }

    function renderButtons(status) {
      const allowed = nextMap[status] || [];
      document.getElementById("statusButtons").innerHTML = statusFlow.map((target) => \`
        <button class="control-button" data-status="\${target}" \${allowed.includes(target) ? "" : "disabled"}>\${target}</button>
      \`).join("");
      document.querySelectorAll(".control-button").forEach((button) => {
        button.addEventListener("click", () => updateStatus(button.dataset.status));
      });
    }

    async function load() {
      const params = new URLSearchParams(location.search);
      const roomId = params.get("roomId") || document.getElementById("roomId").value || "OR01";
      document.getElementById("roomId").value = roomId;
      await loadTerminals(roomId);
      currentSnapshot = await api("/api/v1/or-display/rooms/" + encodeURIComponent(roomId) + "/door-snapshot");
      document.getElementById("roomBadge").textContent = roomShortName(currentSnapshot.display?.roomName || roomId);
      if (!currentSnapshot.currentSurgeryId) {
        document.getElementById("caseTitle").textContent = "当前手术间暂无进行中手术";
        document.getElementById("caseMeta").innerHTML = "";
        document.getElementById("statusButtons").innerHTML = "";
        message("请先完成手术排班或接台。");
        return;
      }
      const display = currentSnapshot.display || {};
      document.getElementById("caseTitle").textContent = display.plannedSurgeryName || "当前手术";
      document.getElementById("caseMeta").innerHTML = [
        "患者：" + (display.patientName || ""),
        "状态：" + (display.displayStatus || ""),
        "更新：" + (display.lastUpdatedTime || "")
      ].map((text) => "<div>" + text + "</div>").join("");
      renderButtons(display.displayStatus || "");
      message("室内终端只控制本手术间状态；门口屏、家属区、护士站和院领导看板由服务端同步更新。");
    }

    async function updateStatus(status) {
      if (!currentSnapshot?.currentSurgeryId) return;
      const roomId = document.getElementById("roomId").value;
      const deviceId = document.getElementById("deviceId").value.trim();
      const operatorId = document.getElementById("operatorId").value;
      const overrideReason = document.getElementById("overrideReason").value.trim();
      try {
        const result = await api("/api/v1/surgery-schedules/" + currentSnapshot.currentSurgeryId + "/status", {
          method: "PATCH",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            status,
            deviceId,
            operatorId,
            sourceSystem: "室内控制终端",
            idempotencyKey: deviceId + "-" + currentSnapshot.currentSurgeryId + "-" + status,
            overrideReason
          })
        });
        message(result.idempotent ? "重复操作已按幂等处理。" : "状态已更新：" + status);
        await load();
      } catch (error) {
        message(error.message, true);
      }
    }

    document.getElementById("roomId").addEventListener("change", load);
    setInterval(load, 10000);
    `,
    { bodyClass: "or-control-shell" }
  );
}

export function renderOrTerminalSimulatorHtml() {
  return shell(
    "手术室多终端联调模拟台",
    `<div class="sim-tools">
      <label>手术间 <select id="roomId"><option value="OR01">OR01</option><option value="OR02">OR02</option><option value="OR03">OR03</option></select></label>
      <label>室内设备 <select id="deviceId"></select></label>
      <label>操作人员 <select id="operatorId"><option value="PRA004">赵护士</option><option value="PRA003">周麻醉</option><option value="PRA001">李主任</option></select></label>
      <button id="refresh">刷新全部终端</button>
    </div>
    <div class="sim-grid">
      <section class="panel sim-device sim-device-portrait" data-resolution="1080x1920">
        <h2><span class="sim-title-text">室内控制终端</span><span class="sim-resolution">1080x1920 竖屏</span></h2>
        <div class="panel-body sim-device-frame"><div class="sim-screen"><div class="sim-screen-body terminal-inner-theme" id="innerPanel"></div></div></div>
      </section>
      <section class="panel sim-device sim-device-portrait" data-resolution="1080x1920">
        <h2><span class="sim-title-text">门口屏</span><span class="sim-resolution">1080x1920 竖屏</span></h2>
        <div class="panel-body sim-device-frame"><div class="sim-screen"><div class="sim-screen-body terminal-door-theme" id="doorPanel"></div></div></div>
      </section>
      <section class="panel sim-device sim-device-landscape" data-resolution="3840x2160">
        <h2><span class="sim-title-text">家属等待区</span><span class="sim-resolution">3840*2160 横屏</span></h2>
        <div class="panel-body sim-device-frame"><div class="sim-screen"><div class="sim-screen-body terminal-family-theme" id="familyPanel"></div></div></div>
      </section>
      <section class="panel sim-device sim-device-landscape" data-resolution="3840x2160">
        <h2><span class="sim-title-text">护士站</span><span class="sim-resolution">3840*2160 横屏</span></h2>
        <div class="panel-body sim-device-frame"><div class="sim-screen"><div class="sim-screen-body terminal-nurse-theme" id="nursePanel"></div></div></div>
      </section>
      <section class="panel sim-device sim-device-landscape" data-resolution="3840x2160">
        <h2><span class="sim-title-text">院领导看板</span><span class="sim-resolution">3840*2160 横屏</span></h2>
        <div class="panel-body sim-device-frame"><div class="sim-screen"><div class="sim-screen-body terminal-director-theme" id="directorPanel"></div></div></div>
      </section>
      <section class="panel sim-device sim-device-landscape" data-resolution="3840x2160">
        <h2><span class="sim-title-text">终端心跳</span><span class="sim-resolution">3840*2160 横屏</span></h2>
        <div class="panel-body sim-device-frame"><div class="sim-screen"><div class="sim-screen-body terminal-heartbeat-theme" id="terminalPanel"></div></div></div>
      </section>
    </div>`,
    `
    const statusFlow = ["已接台", "已入室", "麻醉开始", "手术开始", "手术结束", "已出室", "清洁中", "已完成", "已取消"];
    const nextMap = {
      "已排班": ["已接台", "已取消"],
      "已接台": ["已入室", "已取消"],
      "已入室": ["麻醉开始", "已取消"],
      "麻醉开始": ["手术开始", "已取消"],
      "手术开始": ["手术结束"],
      "手术结束": ["已出室"],
      "已出室": ["清洁中", "已完成"],
      "清洁中": ["已完成"],
      "已完成": [],
      "已取消": []
    };
    let current = null;

    function row(left, middle, right = "") {
      return \`<div class="sim-row"><div class="subtle">\${left}</div><div>\${middle}</div><div>\${right}</div></div>\`;
    }

    async function loadTerminals(roomId) {
      const all = await api("/api/v1/or-terminals?pageSize=100");
      const roomTerminals = all.items.filter((item) => item.roomId === roomId && item.terminalType === "室内控制终端");
      const select = document.getElementById("deviceId");
      select.innerHTML = roomTerminals.map((item) => \`<option value="\${item.deviceId}">\${item.deviceName}</option>\`).join("");
      const terminalsHtml = all.items.map((item) => row(
        item.terminalType,
        (item.roomId || "公共区域") + " · " + item.deviceName,
        \`<span class="status \${item.status === "离线" ? "tone-risk" : "tone-done"}">\${item.status}</span>\`
      )).join("");
      document.getElementById("terminalPanel").innerHTML = terminalsHtml || '<div class="empty">暂无终端</div>';
    }

    function renderInner(snapshot) {
      const display = snapshot.display || {};
      const allowed = nextMap[display.displayStatus] || [];
      const buttons = statusFlow.map((status) => \`
        <button class="control-button" data-status="\${status}" \${allowed.includes(status) ? "" : "disabled"}>\${status}</button>
      \`).join("");
      document.getElementById("innerPanel").innerHTML = \`
        \${row("手术间", display.roomName || "")}
        \${row("当前手术", display.plannedSurgeryName || "暂无")}
        \${row("患者", display.patientName || "")}
        \${row("当前状态", \`<span class="status \${statusTone(display.displayStatus)}">\${display.displayStatus || ""}</span>\`)}
        <div class="control-status">\${buttons}</div>
        <div class="control-message" id="simMessage"></div>
      \`;
      document.querySelectorAll("#innerPanel .control-button").forEach((button) => {
        button.addEventListener("click", () => updateStatus(button.dataset.status));
      });
    }

    function renderDoor(snapshot) {
      const display = snapshot.display || {};
      document.getElementById("doorPanel").innerHTML = \`
        <div class="door-mini-quiet">请保持安静 · 非工作人员请勿在门口聚集</div>
        \${row("房间", display.roomName || "")}
        \${row("状态", \`<span class="status \${statusTone(display.displayStatus)}">\${display.displayStatus || ""}</span>\`)}
        \${row("患者", display.patientName || "")}
        \${row("术式", display.plannedSurgeryName || "")}
        \${row("更新", display.lastUpdatedTime || "")}
      \`;
    }

    function familyTone(status = "") {
      if (status === "等待接入") return "family-tone-called";
      if (["已进入手术区", "手术准备中"].includes(status)) return "family-tone-preparing";
      if (status === "手术中") return "family-tone-active";
      if (["手术已结束", "复苏观察中", "已完成"].includes(status)) return "family-tone-done";
      if (status === "请咨询护士站") return "family-tone-remind";
      return "family-tone-waiting";
    }

    function familyHelp(status = "") {
      return ({
        "等待中": "正在按计划等候接台",
        "等待接入": "医护团队正在安排接台",
        "已进入手术区": "患者已进入手术区域",
        "手术准备中": "正在进行麻醉及术前核查",
        "手术中": "手术正在有序进行",
        "手术已结束": "医护团队正在整理交接",
        "复苏观察中": "患者正在复苏观察",
        "已完成": "本次流程已完成",
        "请咨询护士站": "请凭等候号咨询护士站"
      })[status] || "请关注护士站通知";
    }

    function renderFamily(snapshot) {
      const cards = snapshot.items.slice(0, 6).map((item) => \`
        <article class="family-mini-card">
          <div class="family-mini-card-top">
            <div>
              <div class="family-mini-id">\${item.queueNo}</div>
              <div class="family-mini-patient">\${item.patientName}</div>
            </div>
            <span class="family-mini-status \${familyTone(item.displayStatus)}">\${item.displayStatus}</span>
          </div>
          <div class="family-mini-room">\${item.roomName}</div>
          <div class="family-mini-help">\${familyHelp(item.displayStatus)}</div>
        </article>
      \`).join("");
      document.getElementById("familyPanel").innerHTML = \`
        <div class="family-mini">
          <div class="family-mini-head">
            <span class="family-mini-title">安心等候</span>
            <span>信息已脱敏</span>
          </div>
          <div class="family-mini-note">手术时间会因个体情况有所差异，请以医护人员正式沟通为准。</div>
          <div class="family-mini-list">\${cards || '<div class="empty">暂无家属区展示数据</div>'}</div>
        </div>
      \`;
    }

    function renderNurse(snapshot) {
      const offline = snapshot.terminals.filter((item) => item.status === "离线").length;
      document.getElementById("nursePanel").innerHTML = \`
        <div class="nurse-mini-head">护士站运行总览 · 重点关注接台、术中、清洁周转</div>
        \${row("手术台次", snapshot.surgeries.length)}
        \${row("终端离线", offline)}
        \${snapshot.surgeries.slice(0, 6).map((item) => row(
          item.roomName,
          item.patientName + " · " + item.plannedSurgeryName,
          \`<span class="status \${statusTone(item.status)}">\${item.status}</span>\`
        )).join("")}
      \`;
    }

    function renderDirector(snapshot) {
      const metrics = snapshot.metrics || {};
      document.getElementById("directorPanel").innerHTML = \`
        <div class="director-mini-head">院领导运营质控 · 看趋势、看风险、看闭环</div>
        <div class="director-mini-metrics">
          \${Object.entries(metrics).map(([key, value]) => \`
            <div class="director-mini-metric">
              <div class="label">\${key}</div>
              <div class="value">\${value}</div>
            </div>
          \`).join("")}
        </div>
      \`;
    }

    async function updateStatus(status) {
      const deviceId = document.getElementById("deviceId").value;
      const operatorId = document.getElementById("operatorId").value;
      const message = document.getElementById("simMessage");
      try {
        const result = await api("/api/v1/surgery-schedules/" + current.currentSurgeryId + "/status", {
          method: "PATCH",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            status,
            deviceId,
            operatorId,
            sourceSystem: "终端联调模拟台",
            idempotencyKey: deviceId + "-" + current.currentSurgeryId + "-" + status
          })
        });
        message.textContent = result.idempotent ? "重复点击已幂等处理" : "已更新为：" + status;
        message.className = "control-message";
        await load();
      } catch (error) {
        message.textContent = error.message;
        message.className = "control-message error";
      }
    }

    async function load() {
      const roomId = document.getElementById("roomId").value;
      await loadTerminals(roomId);
      const date = new URLSearchParams(location.search).get("date")
        || new Date().getFullYear() + "-" + pad(new Date().getMonth() + 1) + "-" + pad(new Date().getDate());
      const [door, family, nurse, director] = await Promise.all([
        api("/api/v1/or-display/rooms/" + encodeURIComponent(roomId) + "/door-snapshot"),
        api("/api/v1/or-display/family-waiting-snapshot?date=" + date),
        api("/api/v1/or-display/nurse-station-snapshot?date=" + date),
        api("/api/v1/or-display/director-dashboard-snapshot?date=" + date)
      ]);
      current = door;
      renderInner(door);
      renderDoor(door);
      renderFamily(family);
      renderNurse(nurse);
      renderDirector(director);
    }

    document.getElementById("roomId").addEventListener("change", load);
    document.getElementById("refresh").addEventListener("click", load);
    setInterval(load, 10000);
    `,
    { bodyClass: "or-simulator-shell" }
  );
}

export function renderOrDoorDisplayHtml() {
  return shell(
    "手术室门口屏看板",
    `<div id="board" class="door-screen"></div>`,
    `
    function weekdayText(date = new Date()) {
      return ["周日", "周一", "周二", "周三", "周四", "周五", "周六"][date.getDay()];
    }
    function formatDoorDate(date = new Date()) {
      return (date.getMonth() + 1) + "月" + date.getDate() + "日 " + weekdayText(date) + " " + pad(date.getHours()) + ":" + pad(date.getMinutes()) + ":" + pad(date.getSeconds());
    }
    function roomTitle(item) {
      const source = item.room?.roomName || item.roomId || "";
      const matched = source.match(/\\d+/);
      return matched ? matched[0] + "号" : source;
    }
    function genderMark(gender = "") {
      if (gender === "男") return "♂";
      if (gender === "女") return "♀";
      return "";
    }
    function doorStatus(status = "") {
      if (["手术开始", "手术结束"].includes(status)) return "手术中";
      if (status === "麻醉开始") return "麻醉中";
      if (status === "已入室") return "术前核查";
      if (status === "已接台") return "接台转运";
      if (status === "清洁中") return "清洁中";
      if (status === "已完成" || status === "已出室") return "手术结束";
      if (status === "已取消") return "已取消";
      return "术前准备";
    }
    function roomEnvironment(roomId = "OR01") {
      const roomNo = Number(String(roomId).replace(/\\D/g, "")) || 1;
      return {
        temperature: (22.0 + (roomNo % 4) * 0.3).toFixed(1) + "℃",
        humidity: (46 + (roomNo % 5)) + "%",
        pm25: (4 + (roomNo % 4)) + "μg/m³"
      };
    }
    function elapsedSeconds(item) {
      const start = item.actualStartTime || item.plannedStartTime;
      const date = start ? new Date(start) : null;
      if (!date || Number.isNaN(date.getTime())) return 0;
      return Math.max(0, Math.floor((Date.now() - date.getTime()) / 1000));
    }
    function durationParts(seconds) {
      const hours = Math.floor(seconds / 3600);
      const minutes = Math.floor((seconds % 3600) / 60);
      const rest = seconds % 60;
      return [hours, minutes, rest].map(pad);
    }
    function updateDoorTimers() {
      document.querySelectorAll("[data-start-time]").forEach((node) => {
        const start = new Date(node.dataset.startTime);
        const seconds = Number.isNaN(start.getTime()) ? 0 : Math.max(0, Math.floor((Date.now() - start.getTime()) / 1000));
        const [h, m, s] = durationParts(seconds);
        node.innerHTML = "<span>" + h + "</span><b>:</b><span>" + m + "</span><b>:</b><span>" + s + "</span>";
      });
      const doorDate = document.getElementById("doorDate");
      if (doorDate) doorDate.textContent = formatDoorDate();
    }
    function surgeryCard(item, options = {}) {
      if (!item) {
        return \`
          <section class="door-card next">
            <div class="door-card-header"><span>下一台</span><span class="door-pill">暂无排班</span></div>
            <div class="door-card-body"><div class="door-meta">当前手术间暂无下一台手术安排。</div></div>
          </section>
        \`;
      }
      const summary = options.summary || null;
      const diagnosis = options.next ? "下一台候台信息" : "按手术部展示策略隐藏";
      const painTag = item.surgeryLevel === "四级" ? "重点关注" : "无痛";
      const bedNo = summary?.admission?.bed?.bedNo || "";
      const sequence = options.sequenceText || "";
      const headerStatus = options.headerStatus || item.status;
      return \`
        <section class="door-card \${options.next ? "next" : ""}">
          <div class="door-card-header">
            <span>\${sequence}</span>
            <span class="door-pill">\${headerStatus}</span>
          </div>
          <div class="door-card-body">
            <div class="door-patient">
              <div class="door-avatar"></div>
              <div>
                <div class="door-name-line">
                  <span class="door-name">\${maskName(item.patient?.name)}</span>
                  <span>\${genderMark(item.patient?.gender)} \${item.patient?.gender || ""}</span>
                  <span>|</span>
                  <span>\${item.patient?.ageText || ""}</span>
                  <span>|</span>
                  <span>\${item.encounter?.department?.deptName || "住院病区"}</span>
                </div>
                <div class="door-meta">床位：\${bedNo || "按权限显示"} | 最近状态：\${headerStatus}</div>
              </div>
              <span class="door-pill warn">● \${painTag}</span>
            </div>
            <div class="door-divider"></div>
            <div class="door-field"><span class="label">诊断：</span><span>\${diagnosis}</span></div>
            <div class="door-field"><span class="label">手术名称：</span><span>\${item.plannedSurgeryName || ""}</span></div>
            <div class="door-field"><span class="label">麻醉方式：</span><span>\${item.anesthesiaMethod || ""}</span></div>
            <div class="door-staff-grid">
              <div>主刀医生：\${staffName(item, "主刀") || "待确认"}</div>
              <div>麻醉医生：\${staffName(item, "麻醉医生") || "待确认"}</div>
              <div>洗手护士：\${staffName(item, "器械护士") || "待确认"}</div>
              <div>巡回护士：\${staffName(item, "巡回护士") || "待确认"}</div>
            </div>
          </div>
        </section>
      \`;
    }
    async function load() {
      const roomId = new URLSearchParams(location.search).get("roomId") || "OR01";
      const snapshot = await api("/api/v1/or-display/rooms/" + encodeURIComponent(roomId) + "/door-snapshot");
      const data = await api("/api/v1/surgery-schedules?roomId=" + encodeURIComponent(roomId) + "&pageSize=120");
      const roomItems = data.items
        .filter((item) => item.roomId === roomId || item.room?.roomId === roomId)
        .sort((left, right) => String(left.plannedStartTime || "").localeCompare(String(right.plannedStartTime || "")));
      const current = roomItems.find((item) => item.surgeryScheduleId === snapshot.currentSurgeryId)
        || roomItems.find((item) => activeLike(item.status))
        || roomItems.find((item) => !["已完成", "已取消"].includes(item.status));
      if (!current) {
        document.getElementById("board").innerHTML = '<div class="door-empty">当前手术间暂无排班信息</div>';
        return;
      }
      const currentIndex = Math.max(roomItems.findIndex((item) => item.surgeryScheduleId === current.surgeryScheduleId), 0);
      const next = roomItems.slice(currentIndex + 1).find((item) => !["已完成", "已取消"].includes(item.status));
      let summary = null;
      let nextSummary = null;
      try {
        summary = await api("/api/v1/encounters/" + current.encounter.encounterId + "/summary");
      } catch {
        summary = null;
      }
      if (next) {
        try {
          nextSummary = await api("/api/v1/encounters/" + next.encounter.encounterId + "/summary");
        } catch {
          nextSummary = null;
        }
      }
      const env = roomEnvironment(roomId);
      const timerStart = current.actualStartTime || current.plannedStartTime || "";
      document.getElementById("board").innerHTML = \`
        <section class="door-hero">
          <div class="door-room-badge">
            <div class="room-code">\${roomShortName(snapshot.display?.roomName || current.room?.roomName || roomTitle(current))}</div>
            <div class="room-table">\${current.tableNo || 1}台</div>
          </div>
          <div class="door-date" id="doorDate">\${formatDoorDate()}</div>
          <div class="door-main-status">\${doorStatus(snapshot.display?.displayStatus || current.status)}</div>
          <div class="door-duration" data-start-time="\${timerStart}">
            \${durationParts(elapsedSeconds(current)).map((part) => "<span>" + part + "</span>").join("<b>:</b>")}
          </div>
        </section>
        <div class="door-calm-ribbon">请保持安静 · 非工作人员请勿在门口聚集</div>
        \${surgeryCard(current, {
          summary,
          sequenceText: "当前手术 " + (currentIndex + 1) + "/" + roomItems.length,
          headerStatus: snapshot.display?.displayStatus || current.status
        })}
        \${surgeryCard(next, {
          summary: nextSummary,
          next: true,
          sequenceText: next ? "下一台 " + (roomItems.findIndex((item) => item.surgeryScheduleId === next.surgeryScheduleId) + 1) + "/" + roomItems.length : "下一台",
          headerStatus: next?.status || "待排班"
        })}
        <div class="door-bottom">
          <div class="door-env-list">
            <div class="door-env-item"><div class="door-env-icon">温</div><div><div class="door-env-label">温度</div><div class="door-env-value">\${env.temperature}</div></div></div>
            <div class="door-env-item"><div class="door-env-icon">湿</div><div><div class="door-env-label">湿度</div><div class="door-env-value">\${env.humidity}</div></div></div>
            <div class="door-env-item"><div class="door-env-icon">净</div><div><div class="door-env-label">PM2.5</div><div class="door-env-value">\${env.pm25}</div></div></div>
          </div>
          <div class="door-room-photo" aria-label="手术间画面"></div>
          <div class="door-call" role="button" aria-label="发起通话">
            <div class="door-call-icon">☎</div>
            <div>发起通话</div>
          </div>
        </div>
        <div class="door-notice">当前患者正在进行手术，请保持安静！最近更新：\${snapshot.display?.lastUpdatedTime || ""}</div>
      \`;
      updateDoorTimers();
    }
    setInterval(updateDoorTimers, 1000);
    setInterval(load, 10000);
    `,
    { bodyClass: "door-display-shell" }
  );
}

export function renderOrNurseStationDisplayHtml() {
  return shell(
    "手术部护士站看板",
    `<div class="metrics" id="metrics"></div><div class="layout-wide"><section class="panel"><h2>今日手术运行</h2><div id="scheduleTable"></div></section></div>`,
    `
    function metric(label, value) {
      return \`<div class="metric"><div class="label">\${label}</div><div class="value">\${value}</div></div>\`;
    }
    async function load() {
      const date = new URLSearchParams(location.search).get("date")
        || new Date().getFullYear() + "-" + pad(new Date().getMonth() + 1) + "-" + pad(new Date().getDate());
      const snapshot = await api("/api/v1/or-display/nurse-station-snapshot?date=" + date);
      const items = snapshot.surgeries.filter((item) => item.status !== "已取消");
      const active = items.filter((item) => ["已入室", "麻醉开始", "手术开始", "手术结束"].includes(item.status)).length;
      const waiting = items.filter((item) => ["已排班", "已接台"].includes(item.status)).length;
      const cleaning = items.filter((item) => item.status === "清洁中").length;
      const offline = snapshot.terminals.filter((item) => item.status === "离线").length;
      document.getElementById("metrics").innerHTML = [
        metric("待接台", waiting),
        metric("术中运行", active),
        metric("清洁周转", cleaning),
        metric("终端离线", offline)
      ].join("");
      if (!items.length) {
        document.getElementById("scheduleTable").innerHTML = '<div class="empty">暂无手术排班信息</div>';
        return;
      }
      const rows = items.map((item) => {
        return \`
          <tr>
            <td>\${item.roomName || item.roomId}</td>
            <td>\${fmtTime(item.plannedStartTime)}</td>
            <td>\${maskName(item.patientName)} · \${maskNo(item.inpatientNo)}</td>
            <td title="\${item.plannedSurgeryName}">\${item.plannedSurgeryName}</td>
            <td>\${item.primarySurgeon || ""}</td>
            <td><span class="status \${statusTone(item.status)}">\${item.status}</span></td>
            <td>\${item.eventCount || 0} 条</td>
            <td>\${item.lastUpdatedTime || ""}</td>
            <td>\${snapshot.terminals.filter((terminal) => terminal.roomId === item.roomId).map((terminal) => terminal.status).join(" / ") || "未绑定"}</td>
          </tr>
        \`;
      });
      document.getElementById("scheduleTable").innerHTML = \`
        <table>
          <thead>
            <tr>
              <th style="width: 9%">手术间</th>
              <th style="width: 10%">计划</th>
              <th style="width: 14%">患者</th>
              <th>手术/诊疗项目</th>
              <th style="width: 11%">主刀</th>
              <th style="width: 11%">状态</th>
              <th style="width: 10%">事件</th>
              <th style="width: 12%">更新</th>
              <th style="width: 12%">终端</th>
            </tr>
          </thead>
          <tbody>\${rows.join("")}</tbody>
        </table>
      \`;
    }
    setInterval(load, 10000);
    `,
    { bodyClass: "nurse-station-shell" }
  );
}

export function renderDirectorQualityDisplayHtml() {
  return shell(
    "院长质控看板",
    `<div class="metrics" id="metrics"></div><div class="layout"><section class="panel"><h2>住院流程质控</h2><div id="qualityTable"></div></section><section class="panel"><h2>重点问题</h2><div class="panel-body"><div class="list" id="issues"></div></div></section></div>`,
    `
    function metric(label, value) {
      return \`<div class="metric"><div class="label">\${label}</div><div class="value">\${value}</div></div>\`;
    }
    async function load() {
      const [journeySummary, journeys, recordQuality, infection, settlements] = await Promise.all([
        api("/api/v1/patient-journeys/summary"),
        api("/api/v1/patient-journeys?pageSize=100"),
        api("/api/v1/record-quality-checks?pageSize=100"),
        api("/api/v1/infection-surveillance-records?pageSize=100"),
        api("/api/v1/insurance-settlements?pageSize=100")
      ]);
      const qualityRows = await Promise.all(journeys.items.slice(0, 40).map(async (journey) => {
        const encounterId = journey.encounterId || journey.encounter?.encounterId;
        if (!encounterId) return null;
        try {
          const quality = await api("/api/v1/encounters/" + encounterId + "/summary/quality");
          return { journey, quality };
        } catch {
          return null;
        }
      }));
      const rows = qualityRows.filter(Boolean);
      const passed = rows.filter((row) => row.quality.status === "通过").length;
      const reminded = rows.filter((row) => row.quality.status === "提醒").length;
      const failed = rows.filter((row) => row.quality.status === "未通过").length;
      const settled = settlements.items.filter((item) => item.status === "已结算").length;
      document.getElementById("metrics").innerHTML = [
        metric("模拟患者", journeySummary.total || journeys.total),
        metric("平均进度", (journeySummary.averageProgress || 0) + "%"),
        metric("摘要通过", passed),
        metric("医保结算", settled)
      ].join("");

      const issueCounts = new Map();
      for (const row of rows) {
        for (const check of row.quality.checks || []) {
          if (check.status === "通过") continue;
          const key = check.category + "：" + check.item;
          issueCounts.set(key, (issueCounts.get(key) || 0) + 1);
        }
      }
      const issueList = [...issueCounts.entries()]
        .sort((left, right) => right[1] - left[1])
        .slice(0, 8)
        .map(([name, count]) => \`<div class="list-item">\${name}<br><span class="subtle">涉及 \${count} 例，需按病历质控要求闭环整改。</span></div>\`)
        .join("") || '<div class="list-item">暂无未闭环问题。</div>';
      document.getElementById("issues").innerHTML = issueList;

      const infectionAbnormal = infection.items.filter((item) => item.status !== "正常" && item.status !== "通过").length;
      document.getElementById("qualityTable").innerHTML = \`
        <table>
          <thead>
            <tr>
              <th style="width: 15%">患者</th>
              <th style="width: 22%">诊断</th>
              <th style="width: 14%">流程状态</th>
              <th style="width: 14%">摘要质控</th>
              <th>质控摘要</th>
            </tr>
          </thead>
          <tbody>
            \${rows.slice(0, 18).map((row) => \`
              <tr>
                <td>\${maskName(row.journey.patient?.name)} · \${maskNo(row.journey.encounter?.inpatientNo || "")}</td>
                <td>\${row.quality.diagnosisName || ""}</td>
                <td>\${row.journey.status}</td>
                <td><span class="status \${statusTone(row.quality.status)}">\${row.quality.status}</span></td>
                <td title="\${row.quality.summary}">\${row.quality.summary}</td>
              </tr>
            \`).join("")}
          </tbody>
        </table>
        <div class="panel-body subtle">病案质控记录 \${recordQuality.total} 条；院感重点观察 \${infection.total} 条，其中需关注 \${infectionAbnormal} 条；医保结算记录 \${settlements.total} 条。</div>
      \`;
    }
    setInterval(load, 30000);
    `,
    { bodyClass: "director-dashboard-shell" }
  );
}
