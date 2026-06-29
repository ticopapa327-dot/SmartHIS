# SmartHIS

SmartHIS 是一个面向首视 Smart 系列软件的医院业务与接口仿真平台，用于数字化手术室、手术示教、远程会诊、门口屏、中央监控、一键清洁等产品的研发联调、演示和测试。

当前版本是 `0.1.0` MVP：采用零外部依赖 Node.js 服务，内置演示医院、患者、住院、诊断、手术、检查检验、影像索引、文书、会诊、示教、接口日志和场景推进能力。

## 启动

```powershell
npm start
```

真实安卓终端在同一局域网访问时，服务端需要监听所有网卡：

```powershell
$env:HOST="0.0.0.0"
$env:PORT="7070"
npm start
```

安卓终端访问地址应使用电脑的局域网 IPv4，例如 `http://192.168.x.x:7070/or-terminal-simulator`；`127.0.0.1` 只适用于本机浏览器。

默认地址：

- 控制台：`http://127.0.0.1:7070/console`
- 终端联调模拟台：`http://127.0.0.1:7070/or-terminal-simulator`
- 手术室内控制端：`http://127.0.0.1:7070/or-inner-control?roomId=OR01`
- 家属等待区大屏：`http://127.0.0.1:7070/family-waiting-display`
- 家属等待区手机端：`http://127.0.0.1:7070/family-waiting-mobile`
- 手术室门口屏：`http://127.0.0.1:7070/or-door-display?roomId=OR01`
- 手术部护士站看板：`http://127.0.0.1:7070/or-nurse-station-display`
- 院长质控看板：`http://127.0.0.1:7070/director-quality-display`
- 健康检查：`http://127.0.0.1:7070/health`
- REST API：`http://127.0.0.1:7070/api/v1`
- 第三方对接画像：`http://127.0.0.1:7070/api/v1/integrations/profiles`
- FHIR：`http://127.0.0.1:7070/fhir/Patient`
- DICOMweb：`http://127.0.0.1:7070/dicomweb/studies`

如需换端口：

```powershell
$env:PORT=7080
npm start
```

## 测试

```powershell
npm test
```

当前测试覆盖：

- 今日手术排班查询。
- 手术状态推进与事件记录。
- 场景运行与步骤推进。
- FHIR、DICOMweb、HL7 样例输出。
- 接口日志记录。
- 数据工厂重置与手术生成。
- 内置控制台页面。
- 手术室门口屏、手术部护士站看板、院长质控看板页面。
- 第三方门口屏、手术室信息面板、排队叫号角色接口和厂商只读库视图。

## 目录

```text
src/
  app.js        HTTP 应用、路由、日志包装
  console.js    内置 Web 控制台
  domain.js     核心业务操作
  fhir.js       FHIR 资源映射
  hl7.js        HL7 v2 样例消息
  integrations.js 第三方角色化对接契约
  seed.js       演示医院种子数据
  server.js     服务启动入口
test/
  api.test.js   API 自动化测试
```

## 核心 API

### 手术排班

```http
GET /api/v1/surgery-schedules?date=2026-05-16
GET /api/v1/surgery-schedules/SCH000001
PATCH /api/v1/surgery-schedules/SCH000001/status
POST /api/v1/surgery-schedules/SCH000001/events
GET /api/v1/surgery-schedules/SCH000001/events
GET /api/v1/operating-rooms/OR01/current-surgery
```

状态推进示例：

```json
{
  "status": "已接台",
  "sourceSystem": "室内控制终端",
  "operatorId": "PRA004",
  "deviceId": "DEV000003",
  "idempotencyKey": "DEV000003-SCH000002-CALLED"
}
```

支持状态：

```text
已排班、已接台、已入室、麻醉开始、手术开始、手术结束、已出室、清洁中、已完成、已取消
```

### 手术室终端与展示快照

```http
GET /api/v1/or-terminals
GET /api/v1/or-terminals/DEV000001
POST /api/v1/or-terminals/register
PATCH /api/v1/or-terminals/DEV000001/binding
PATCH /api/v1/or-terminals/DEV000001/status
POST /api/v1/or-terminals/DEV000001/heartbeat

GET /api/v1/or-display/rooms/OR01/door-snapshot
GET /api/v1/or-display/family-waiting-snapshot?date=2026-05-16
GET /api/v1/or-display/nurse-station-snapshot?date=2026-05-16
GET /api/v1/or-display/director-dashboard-snapshot?date=2026-05-16
GET /api/v1/or-events/replay?roomId=OR02&deviceId=DEV000003&date=2026-05-16
```

### 第三方角色化对接

```http
GET /api/v1/integrations/profiles
GET /api/v1/integrations/or-door-screens/OR01/snapshot?date=2026-05-16
GET /api/v1/integrations/or-panels/OR01/snapshot?date=2026-05-16
GET /api/v1/integrations/queue-calls/snapshot?date=2026-05-16
GET /api/v1/integrations/queue-calls/snapshot?date=2026-05-16&dataScope=full
```

`dataScope=display` 是默认范围，按门口屏、运行面板、排队叫号的角色输出最小必要字段；`dataScope=full` 用于授权第三方联调，会输出真实姓名、住院号、床号等角色必要字段。启用 `SMARTHIS_VENDOR_API_KEYS` 后，`full` 范围必须携带 `x-api-key` 或 `Authorization: Bearer <密钥>`。

### 患者与就诊

```http
GET /api/v1/patients
GET /api/v1/patients/PAT000001
POST /api/v1/patients
GET /api/v1/encounters
GET /api/v1/encounters/ENC000001
GET /api/v1/encounters/ENC000001/diagnoses
GET /api/v1/encounters/ENC000001/summary
GET /api/v1/inpatients
```

### 检查检验与影像

```http
GET /api/v1/lab-reports
GET /api/v1/exam-reports
GET /api/v1/imaging-studies
GET /dicomweb/studies?AccessionNumber=ACC202605160001
GET /viewer/studies/1.2.826.0.1.3680043.10.543.202605160001
```

### 会诊与示教

```http
GET /api/v1/consultations
POST /api/v1/consultations
PATCH /api/v1/consultations/CON000001/status
GET /api/v1/teaching-sessions
POST /api/v1/teaching-sessions
PATCH /api/v1/teaching-sessions/TEA000001/status
```

### 场景与数据工厂

```http
GET /api/v1/scenarios
POST /api/v1/scenarios/SCN000001/runs
POST /api/v1/scenario-runs/RUN000001/next
POST /api/v1/data-factory/reset
POST /api/v1/data-factory/generate-patients
POST /api/v1/data-factory/generate-surgeries
```

### 标准接口样例

```http
GET /fhir/Patient
GET /fhir/Encounter
GET /fhir/Procedure
GET /fhir/DiagnosticReport
GET /fhir/ImagingStudy
GET /fhir/DocumentReference
GET /api/v1/hl7/messages?messageType=SIU_S12&surgeryScheduleId=SCH000001
```

## 当前边界

- 数据暂存在内存中，服务重启后恢复种子数据。
- 影像调阅目前是 DICOMweb 元数据和 Viewer 占位页，后续可接 Orthanc、dcm4chee 或自研 DICOM 服务。
- FHIR 和 HL7 v2 当前是 MVP 级映射，后续需要按客户项目扩展字段、编码和消息段。
- 当前版本用于模拟、联调、测试和演示，不用于真实诊疗、真实收费、真实医保或真实病历归档。
- `D:\我的工作\AOV\客户资料\连云港中医院\11-17` 样本目录当前确认包含 DICOM、X 线检查报告 PDF、截图和压缩包，未发现可直接导入的 `.db/.sql/.mdb/.xlsx/.csv` 业务数据库文件；因此本项目只把该样本用于影像/报告/界面字段建模，不声称复刻了真实医院数据库表结构。

## 下一阶段建议

1. 接 PostgreSQL，把内存仓库迁移为持久化数据模型。
2. 增加 OpenAPI 文档和接口映射配置界面。
3. 接入 PACS 模拟组件与真实 DICOM 样例库。
4. 增加 HL7 v2 入站监听和 Webhook 订阅配置。
5. 把控制台拆成独立前端，增加患者、排班、报告、场景配置页面。

## Patient Journey 病人全流程仿真

第一阶段内置一个胆囊结石择期住院手术模板，默认旅程为 `JNY000001`。

```http
GET /api/v1/journey-templates
GET /api/v1/journey-templates/TPL_CHOLECYSTECTOMY_INPATIENT
GET /api/v1/patient-journeys
GET /api/v1/patient-journeys/JNY000001
POST /api/v1/patient-journeys/JNY000001/next
POST /api/v1/patient-journeys/JNY000001/run
POST /api/v1/patient-journeys/JNY000001/reset
GET /api/v1/patient-journeys/JNY000001/timeline
GET /api/v1/patient-journeys/summary
POST /api/v1/patient-journeys/simulate-cohort
```

## 手术部看板

当前内置四类大屏页面，均可直接由浏览器访问：

```http
GET /family-waiting-display
GET /family-waiting-display?date=2026-05-16&rows=10&roomCount=12&interval=12000
GET /family-waiting-mobile
GET /family-waiting-mobile?date=2026-05-16
GET /or-terminal-simulator
GET /or-inner-control?roomId=OR01
GET /or-door-display?roomId=OR01
GET /or-nurse-station-display
GET /director-quality-display
```

`/family-waiting-display` 面向 55 寸 4K 家属等待区大屏，页面按电视机外框和 `3840x2160` 屏幕比例仿真，浏览器中会等比缩放为真实 16:9 显示区域。默认每屏显示 10 台手术，超过后按页自动滚动。可通过 `rows` 设置单屏条数，通过 `roomCount` 设置开放手术间数量，通过 `interval` 设置翻页间隔毫秒，通过 `date` 指定手术日期。页面按“术中/接台优先、候台其次、术毕最后”的策略排序，并按常见手术类型、手术级别和预计时长模拟进度、剩余时间和复杂程度。

`/family-waiting-mobile` 面向家属手机扫码查看，复用家属等待区快照接口，只展示等候号、脱敏姓名、手术间、当前阶段、最近更新时间和护士站提示，不展示诊断、术式、住院号、身份证号、电话和住址。页面包含实时时钟、状态筛选、15 秒自动刷新和手动刷新按钮，可通过 `date` 指定手术日期。

`/or-door-display` 面向 13.3 寸竖屏手术间门口屏，按门口屏硬件外框、顶部提示灯、内嵌 `1080x1920` 屏幕区域、底部扬声器和实体按键仿真，默认显示 `OR01`，可通过 `roomId` 切换手术间。`/or-nurse-station-display` 面向手术部护士站，展示今日手术运行、接台、术中、清洁周转、护理交接、安全核查和耗材登记。`/director-quality-display` 面向院长/质控管理，展示病人流程进度、摘要质控、病案质控、院感观察和医保结算概览。

`/or-terminal-simulator` 用于在单台电脑的一个页面内联调多类终端视图：室内控制端、门口屏、家属等待区、护士站、院领导看板和终端心跳。该页面只用于模拟测试；后端仍按每个 `deviceId` 的终端角色和房间绑定校验权限。

模拟台内的室内控制终端和门口屏按 `1080x1920` 竖屏比例仿真；家属等待区、护士站、院领导看板和终端心跳按 `3840x2160` 横屏比例仿真。独立家属等待区页面同时提供电视机外框和 4K 屏幕比例仿真。

单设备联调建议步骤：

1. 打开 `http://127.0.0.1:7070/or-terminal-simulator`。
2. 选择手术间和室内控制终端，点击当前允许的下一状态，例如“已接台”。
3. 同页确认“门口屏、家属等待区、护士站、院领导看板”四类投影同步更新。
4. 到真实安卓终端测试时，室内控制端访问 `/or-inner-control?roomId=OR01`，门口屏访问 `/or-door-display?roomId=OR01`；其他大屏继续访问各自页面。

门口屏与安卓终端对接的下一阶段设计见：[手术室门口屏对接场景设计说明.md](./手术室门口屏对接场景设计说明.md)。

## 中国医院业务状态规范

面向控制台、大屏和普通 REST 输出的业务状态值统一使用中文，不再向使用者暴露 `Paid`、`Unpaid`、`Draft`、`Final`、`Scheduled`、`Called`、`N`、`Y` 等英文业务状态。标准协议本身必须保留的技术字段和编码例外，例如 DICOM tag、FHIR resourceType、ICD-10 编码、检验项目缩写 WBC/HGB、DICOM Part 10 标识等。

手术状态使用：`已排班`、`已接台`、`已入室`、`麻醉开始`、`手术开始`、`手术结束`、`已出室`、`清洁中`、`已完成`、`已取消`。

病历、费用、检验和流程质控状态使用：`草稿`、`已签发`、`已预交/已缴费`、`未预交/未缴费`、`已结算`、`正常`、`异常`、`危急值`、`待执行`、`执行中`、`当前`、`通过`、`提醒`、`未通过` 等中文表述。

旅程步骤覆盖：

```text
入院登记 -> 入院诊断 -> 术前医嘱 -> 报告完成 -> 术前小结 -> 麻醉访视
-> 手术申请 -> 手术排班 -> 接台 -> 入室 -> 麻醉开始 -> 手术开始
-> 手术结束 -> 出室 -> 清洁完成 -> 术后病程 -> 出院小结 -> 出院归档
```

每个旅程步骤都会写入时间线和接口日志；推进到手术节点时，会同步更新手术排班状态；推进到出院节点时，会结束住院并释放床位。

批量模拟 100 个病人：

```http
POST /api/v1/patient-journeys/simulate-cohort
Content-Type: application/json

{
  "count": 100,
  "reset": true,
  "roomCount": 12
}
```

批量模拟会生成住院患者、床位、医嘱、检验、检查、影像、药房配药、护理记录、手术排班、EMR 文书和病人旅程，并把病人分布在入院、术前、术中、术后、出院等不同阶段。`roomCount` 可设置模拟开放手术间数量，排班会按手术间轮转分配，并按胆囊、乳腺、关节置换、胸腔镜、内镜、介入等常见手术类型生成更接近真实业务的预计手术时长。默认病种目录为 50 类国内常见住院诊疗场景，其中包含 20 类乳腺癌相关病例，覆盖保乳/改良根治、新辅助治疗、HER2 阳性、三阴性、骨/脑/肺/肝转移、恶性胸腔积液、化疗骨髓抑制与静脉血栓风险等肿瘤内科可评估场景。

## HIS/EMR 与真实检查过程扩展

本版本已经把 HIS、EMR、RIS/PACS、心电、药房、护理作为显式子系统接入住院诊疗全流程。`POST /api/v1/patient-journeys/simulate-cohort` 会生成 100 个病人的住院流转，并给每个病人生成可查询的入院记录、术前小结、B 超报告、心电报告、PACS 索引、检验报告、药房配药记录和护理记录。

影像资产不是纯文本占位。每个 PACS study 都带有：

```http
GET /viewer/studies/{StudyInstanceUID}
GET /assets/imaging/{StudyInstanceUID}/preview.png
GET /dicomweb/studies/{StudyInstanceUID}/metadata
GET /dicomweb/studies/{StudyInstanceUID}/series/1/instances/1/file
```

其中 `preview.png` 为脱敏合成测试片，`file` 返回 DICOM Part 10 测试文件，可用于硬件厂商调阅、DICOM/PACS/DICOMweb 联调。乳腺癌病例的影像结构化字段包含 BI-RADS、分子分型、TNM 分期、病理免疫组化和 MDT 评估信息。

## 胆囊结石单病种真实性修正

胆囊结石择期住院手术模板已按国内普外科常用路径重新校准：腹部彩色多普勒超声作为主要诊断依据，报告包含胆囊大小、囊壁厚度、可移动强回声伴声影、结石最大径、胆总管内径和胆管是否扩张；上腹部 CT 仅作为补充 PACS 影像，重点排除胆总管扩张和急性胰腺炎征象。

胆囊结石患者的检验报告从单纯血常规扩展为术前血常规、生化、电解质、肝胆酶、胆红素、血淀粉酶和凝血功能。围术期用药改为切皮前 30-60 分钟头孢唑林预防用药，术后无感染证据不常规延长抗菌药；出院带药改为短期按需镇痛和胃黏膜保护，不再默认熊去氧胆酸或口服头孢。术前输血流程也改为低出血风险腹腔镜胆囊切除的血型复核和不规则抗体筛查，不常规 2U 交叉配血备血。

病历与手术记录补充了 Calot 三角、关键安全视野、胆囊管/胆囊动脉处理、标本袋取出、未置引流、术后病理“慢性胆囊炎伴胆囊多发胆固醇性结石”等字段，方便手术示教、远程会诊和术中质控系统联调。

对接“患者信息自动录入接口文档 - 副本.docx”的兼容接口：

```http
GET /getHISPatient?idCard=320300197003120011
GET /api/v1/his/patients/PAT000001
```

返回结构包含 `status`、`message`、`code`、`successMessage`、`errorMessage`、`entity`、`data`、`errorList`，其中 `entity` 映射文档字段：`brbh`、`blh`、`hzxm`、`hzxb`、`sfzh`、`sfzhHide`、`jzks`、`ryrq`、`hzzs`、`hzxbs`、`hzjws`、`hztgjc`、`hzbkjc`、`hzfzjc`、`hzcbzd`、`ysqm` 等。

新增过程数据接口：

```http
GET /api/v1/ultrasound-reports
GET /api/v1/ecg-reports
GET /api/v1/pacs-studies
GET /api/v1/medication-dispenses
GET /api/v1/nursing-records
GET /api/v1/clinical-tasks
GET /api/v1/encounters/ENC000001/summary
GET /api/v1/encounters/ENC000001/summary/quality
```

控制台 `/console` 的当前患者摘要会展示检查检验、PACS 影像、配药执行、护理记录和电子病历，便于数字化手术室、手术示教、远程会诊系统联调。摘要顶部同时提供“摘要质控”结果，按患者身份、电子病历、检验真实性、检查真实性、PACS/DICOM、围术期闭环、出院闭环和胆囊结石路径规则给出通过率、提醒项和失败项。

家属等待区大屏：

```http
GET /family-waiting-display
```

该页面面向手术室外大屏，自动刷新手术部排班信息，按国内医院常见展示习惯脱敏显示患者姓名和住院号，仅展示手术间、计划时间、术式/诊疗项目、科室和当前状态。

## 围术期流程第二轮扩展

本轮继续补齐了住院手术病人会遇到的关键真实环节：术前风险评估、知情同意签署、检验危急值通知、病区到手术室转运交接、术后医嘱与费用记账、出院带药、出院后一周随访预约。控制台的患者摘要会合并展示这些过程数据。

新增接口：

```http
GET /api/v1/consents
GET /api/v1/risk-assessments
GET /api/v1/transport-events
GET /api/v1/billing-items
GET /api/v1/discharge-medications
GET /api/v1/follow-ups
GET /api/v1/lab-critical-values
```

## 病理与医保结算扩展

第三轮补齐了术后常见的后续闭环：术中标本送检、病理科接收登记、术后病理报告回传 EMR、出院前医保预结算、出院后正式医保结算。批量模拟后，处于术后和出院阶段的病人会带有这些过程数据。乳腺癌病例会额外生成乳腺病理、免疫组化 ER/PR/HER2/Ki-67、FISH 待复核、新辅助/辅助治疗建议等结构化信息。

新增接口：

```http
GET /api/v1/surgical-specimens
GET /api/v1/pathology-reports
GET /api/v1/insurance-settlements
```

## 医嘱审核与检查预约扩展

本轮补齐了术前医嘱闭环和检查预约登记：医生开立术前医嘱后，护士站完成检验、检查、手术、用药、禁食水、过敏史和医保属性审核；RIS/心电系统为 CT、腹部超声和十二导联心电图生成预约、队列号、检查准备和完成状态。控制台当前患者摘要会展示“医嘱审核”和“检查预约”。

新增接口：

```http
GET /api/v1/order-review-records
GET /api/v1/exam-appointments
```

## 输血备血与血型复核扩展

本轮补齐了输血备血闭环：在输血知情同意归档后，生成输血科复核记录。胆囊结石择期腹腔镜胆囊切除术按低出血风险处理，仅完成 ABO/Rh 血型复核和不规则抗体筛查，不常规 2U 交叉配血备血；其他手术仍可模拟交叉配血和红细胞备血。该流程支持数字化手术室在术前核查中调阅备血状态。控制台当前患者摘要会展示“输血备血”。

新增接口：

```http
GET /api/v1/blood-preparation-records
```

## 用药安全与扫码核对扩展

本轮补齐了术前用药安全闭环：药学审核后，护士执行抗菌药皮试/过敏史核查；胆囊结石患者按清洁-污染类胆道手术模拟切皮前 30-60 分钟头孢唑林预防用药，青霉素过敏患者会触发替代方案审核。术前给药前还会生成 PDA 扫码核对记录，覆盖腕带、医嘱、药品、剂量、途径、过敏史和执行时间。控制台当前患者摘要会展示“皮试核查”和“扫码核对”。

新增接口：

```http
GET /api/v1/medication-safety-checks
GET /api/v1/identity-verifications
```

## 医保资格、预交金与费用日清单扩展

本轮补齐了入院和出院前的 HIS 财务链条：入院后完成医保电子凭证/身份证资格核验，自费患者按自费结算确认；开立入院医嘱后收取住院预交金；出院前生成费用日清单，按诊疗、药品、护理、耗材等分类汇总，并给出医保预计支付、自付预估和预交金余额。结算口径按中国医保模拟，不使用欧美商业保险模型，字段包含医保区划、定点机构、人员类别、医保目录甲类/乙类/自费、目录内费用、全自费、乙类先行自付、起付线、统筹基金支付、个人账户支付、个人现金支付和医保基金结算清单编号。控制台当前患者摘要会展示“医保资格”“住院预交”和“费用日清单”。

新增接口：

```http
GET /api/v1/insurance-eligibility-records
GET /api/v1/deposit-payments
GET /api/v1/daily-billing-statements
```

## 当前日期自然演进

服务进程启动时默认启用医院自然运转引擎，按北京时间生成当前业务日的住院病人、检查检验、手术排班、PACS/DICOM 索引、护理执行、收费医保和出院随访数据。系统会定时推进旅程事件，让患者从入院、术前、术中、术后到出院自然流转；白天时段还会按计划补充新入院患者。控制台、手术室门口屏、手术部护士站看板、院长质控看板和厂商只读数据库都读取同一份实时状态。

新增接口：

```http
GET /api/v1/hospital-operation/status
POST /api/v1/hospital-operation/tick
POST /api/v1/hospital-operation/rebuild
```

默认配置可通过环境变量调整：

```text
SMARTHIS_NATURAL_OPERATION=0        关闭服务启动时的自然运转
SMARTHIS_NATURAL_PATIENT_COUNT=50   初始模拟病人数，默认日常演示档
SMARTHIS_NATURAL_ROOM_COUNT=6       开放手术间数量，默认日常演示档
SMARTHIS_NATURAL_DAILY_ADMISSIONS=6 每日计划新入院人数，默认日常演示档
SMARTHIS_NATURAL_TICK_MS=30000      自动推进间隔
```

需要厂商联调或接口压力稍高的演示时，可临时设置为 `SMARTHIS_NATURAL_PATIENT_COUNT=100`、`SMARTHIS_NATURAL_ROOM_COUNT=8`、`SMARTHIS_NATURAL_DAILY_ADMISSIONS=12` 后重启服务。

## 厂商只读数据库对接

为方便数字化手术室、门口屏、手术室信息显示与运行状态面板、排队叫号、示教录播、PDA、影像调阅等外部厂商联调，本系统提供厂商只读数据库快照。快照默认生成到 `data/smarthis-vendor-readonly.sqlite`，只包含对接视图，不暴露系统内部运行对象。数据库表名保留英文代码，便于程序稳定读取；表字段、业务状态和展示内容均使用国内医院中文表述。

默认 `SMARTHIS_VENDOR_DATA_SCOPE=display`，姓名和住院号按显示端范围处理；需要授权厂商拿真实字段联调时，可在启动前设置：

```powershell
$env:SMARTHIS_VENDOR_DATA_SCOPE="full"
$env:SMARTHIS_VENDOR_API_KEYS="vendor-secret"
npm start
```

`full` 范围用于真实联调，不等于所有终端都应读取全量病历；门口屏、运行面板、排队叫号仍按角色表输出必要字段。身份证、电话、住址这类字段后续如确需开放，应单独增加接口画像和审批边界，不能混入低权限显示视图。

新增接口：

```http
GET /api/v1/vendor-db
POST /api/v1/vendor-db/sync
GET /api/v1/vendor-db/schema.sql
GET /api/v1/vendor-db/views/vendor_surgery_schedule?pageSize=50
GET /api/v1/vendor-db/views/vendor_report_index?patientId=PAT000001
GET /api/v1/vendor-db/views/vendor_or_door_screen?roomId=OR01
GET /api/v1/vendor-db/views/vendor_or_status_panel?date=2026-05-16
GET /api/v1/vendor-db/views/vendor_queue_call?date=2026-05-16
GET /api/v1/vendor-db/download
```

当前快照包含 9 个只读视图：

```text
vendor_patient_index          厂商_患者索引
vendor_encounter_index        厂商_住院就诊
vendor_surgery_schedule       厂商_手术排班
vendor_report_index           厂商_检查检验报告
vendor_medication_nursing     厂商_用药护理执行
vendor_billing_settlement     厂商_收费医保结算
vendor_or_door_screen         厂商_手术室门口屏
vendor_or_status_panel        厂商_手术室运行面板
vendor_queue_call             厂商_排队叫号
```

授权控制：默认内网演示环境不启用密钥；需要给客户或厂商试用时，可在启动服务前设置 `SMARTHIS_VENDOR_API_KEYS`，多个密钥用英文逗号或分号分隔。启用后厂商必须通过 `x-api-key` 请求头或 `Authorization: Bearer <密钥>` 访问上述数据库接口。
