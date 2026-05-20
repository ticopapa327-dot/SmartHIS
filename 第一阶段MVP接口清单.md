# SmartHIS 第一阶段 MVP 接口清单

版本：0.1  
日期：2026-05-16  
范围：支撑数字化手术室、手术示教、远程会诊等首视 Smart 系列产品完成基础联调

## 1. 接口目标

第一阶段接口的目标不是覆盖所有医院信息化标准，而是完成一条稳定、清晰、可复现的手术业务链路：

患者建档 -> 入院 -> 诊断 -> 检查检验 -> 手术申请 -> 手术排班 -> 术中状态 -> 文书/报告调阅 -> 示教/会诊/门口屏/中央监控联动。

## 2. 接口类型

| 类型 | 优先级 | 用途 |
| --- | --- | --- |
| REST API | P0 | 首视产品快速对接、管理控制台调用 |
| Webhook/Event | P0 | 推送手术状态、报告完成、会诊状态 |
| FHIR API | P1 | 标准资源输出，便于产品化 |
| HL7 v2 | P1 | 模拟传统医院集成平台消息 |
| DICOMweb | P1 | 影像调阅与 PACS 模拟 |
| DB View | P2 | 模拟部分医院只开放数据库视图的现场情况 |
| Excel/CSV | P2 | 批量导入客户字典和演示数据 |

## 3. REST API 清单

统一前缀建议：`/api/v1`

### 3.1 基础数据

| 方法 | 路径 | 说明 | 优先级 |
| --- | --- | --- | --- |
| GET | `/orgs` | 查询医院机构 | P0 |
| GET | `/departments` | 查询科室列表 | P0 |
| GET | `/wards` | 查询病区列表 | P0 |
| GET | `/beds` | 查询床位列表 | P1 |
| GET | `/operating-rooms` | 查询手术间列表 | P0 |
| GET | `/practitioners` | 查询医护人员 | P0 |
| GET | `/dictionaries/{dictCode}` | 查询字典 | P0 |

### 3.2 患者与就诊

| 方法 | 路径 | 说明 | 优先级 |
| --- | --- | --- | --- |
| GET | `/patients` | 按姓名、住院号、门诊号、患者 ID 查询患者 | P0 |
| GET | `/patients/{patientId}` | 查询患者详情 | P0 |
| POST | `/patients` | 创建模拟患者 | P1 |
| GET | `/encounters` | 查询就诊列表 | P0 |
| GET | `/encounters/{encounterId}` | 查询就诊详情 | P0 |
| GET | `/encounters/{encounterId}/diagnoses` | 查询诊断 | P0 |
| GET | `/inpatients` | 查询当前住院患者 | P0 |
| GET | `/inpatients/by-ward/{wardId}` | 按病区查询住院患者 | P1 |

### 3.3 手术业务

| 方法 | 路径 | 说明 | 优先级 |
| --- | --- | --- | --- |
| GET | `/surgery-requests` | 查询手术申请 | P0 |
| GET | `/surgery-requests/{requestId}` | 查询手术申请详情 | P0 |
| POST | `/surgery-requests` | 创建模拟手术申请 | P1 |
| GET | `/surgery-schedules` | 按日期、手术间、科室查询手术排班 | P0 |
| GET | `/surgery-schedules/{scheduleId}` | 查询排班详情 | P0 |
| POST | `/surgery-schedules` | 创建手术排班 | P1 |
| PATCH | `/surgery-schedules/{scheduleId}/status` | 更新手术状态 | P0 |
| POST | `/surgery-schedules/{scheduleId}/events` | 写入手术事件 | P0 |
| GET | `/surgery-schedules/{scheduleId}/events` | 查询手术事件 | P0 |
| GET | `/operating-rooms/{roomId}/current-surgery` | 查询手术间当前手术 | P0 |
| GET | `/or-terminals` | 查询手术部终端设备 | P0 |
| GET | `/or-terminals/{deviceId}` | 查询终端详情 | P0 |
| POST | `/or-terminals/register` | 注册或更新终端设备 | P0 |
| PATCH | `/or-terminals/{deviceId}/binding` | 更新终端与手术间绑定 | P0 |
| PATCH | `/or-terminals/{deviceId}/status` | 更新终端状态 | P0 |
| POST | `/or-terminals/{deviceId}/heartbeat` | 写入终端心跳 | P0 |
| GET | `/or-display/rooms/{roomId}/door-snapshot` | 查询门口屏展示快照 | P0 |
| GET | `/or-display/family-waiting-snapshot` | 查询家属等待区脱敏快照 | P0 |
| GET | `/or-display/nurse-station-snapshot` | 查询护士站全局快照 | P0 |
| GET | `/or-display/director-dashboard-snapshot` | 查询院领导汇总快照 | P0 |
| GET | `/or-events/replay` | 按手术间、设备、日期回放手术状态事件 | P0 |

### 3.4 文书

| 方法 | 路径 | 说明 | 优先级 |
| --- | --- | --- | --- |
| GET | `/documents` | 按患者、就诊、文书类型查询文书 | P0 |
| GET | `/documents/{documentId}` | 查询文书详情 | P0 |
| POST | `/documents` | 创建模拟文书 | P1 |
| GET | `/encounters/{encounterId}/summary` | 查询就诊摘要，供会诊和示教使用 | P0 |

### 3.5 检验检查与影像

| 方法 | 路径 | 说明 | 优先级 |
| --- | --- | --- | --- |
| GET | `/orders` | 查询医嘱/申请单 | P1 |
| GET | `/lab-reports` | 查询检验报告 | P0 |
| GET | `/lab-reports/{reportId}` | 查询检验报告详情 | P0 |
| GET | `/exam-reports` | 查询检查报告 | P0 |
| GET | `/exam-reports/{reportId}` | 查询检查报告详情 | P0 |
| GET | `/imaging-studies` | 查询影像索引 | P0 |
| GET | `/imaging-studies/{studyId}` | 查询影像调阅信息 | P0 |

### 3.6 会诊与示教

| 方法 | 路径 | 说明 | 优先级 |
| --- | --- | --- | --- |
| GET | `/consultations` | 查询会诊列表 | P0 |
| POST | `/consultations` | 创建会诊申请 | P0 |
| PATCH | `/consultations/{consultationId}/status` | 更新会诊状态 | P0 |
| GET | `/teaching-sessions` | 查询示教场次 | P0 |
| POST | `/teaching-sessions` | 创建示教场次 | P0 |
| PATCH | `/teaching-sessions/{sessionId}/status` | 更新示教状态 | P0 |

### 3.7 场景与数据工厂

| 方法 | 路径 | 说明 | 优先级 |
| --- | --- | --- | --- |
| GET | `/scenarios` | 查询场景模板 | P0 |
| POST | `/scenarios/{scenarioId}/runs` | 启动场景 | P0 |
| GET | `/scenario-runs/{runId}` | 查询场景运行状态 | P0 |
| POST | `/scenario-runs/{runId}/next` | 推进到下一步 | P0 |
| POST | `/data-factory/reset` | 重置演示数据 | P0 |
| POST | `/data-factory/generate-patients` | 生成患者 | P1 |
| POST | `/data-factory/generate-surgeries` | 生成手术 | P1 |

### 3.8 接口日志

| 方法 | 路径 | 说明 | 优先级 |
| --- | --- | --- | --- |
| GET | `/interface-messages` | 查询接口消息日志 | P0 |
| GET | `/interface-messages/{messageId}` | 查询消息详情 | P0 |
| POST | `/interface-messages/{messageId}/replay` | 回放消息 | P1 |
| PATCH | `/interface-channels/{channelId}/enabled` | 启停接口通道 | P1 |

## 4. Webhook/Event 清单

SmartHIS 可以向首视产品推送事件，也可以接收首视产品回写事件。

### 4.1 出站事件

| 事件编码 | 说明 | 优先级 |
| --- | --- | --- |
| `patient.created` | 患者创建 | P1 |
| `encounter.admitted` | 患者入院 | P1 |
| `surgery.requested` | 手术申请创建 | P0 |
| `surgery.scheduled` | 手术完成排班 | P0 |
| `surgery.called` | 接台/呼叫患者 | P0 |
| `surgery.in_room` | 患者入室 | P0 |
| `surgery.anesthesia_started` | 麻醉开始 | P0 |
| `surgery.started` | 手术开始 | P0 |
| `surgery.ended` | 手术结束 | P0 |
| `surgery.out_room` | 患者出室 | P0 |
| `or.cleaning_started` | 手术间清洁开始 | P0 |
| `or.cleaning_completed` | 手术间清洁完成 | P0 |
| `lab_report.finalized` | 检验报告审核完成 | P1 |
| `exam_report.finalized` | 检查报告审核完成 | P1 |
| `consultation.completed` | 会诊完成 | P1 |

### 4.2 入站事件

| 事件编码 | 说明 | 优先级 |
| --- | --- | --- |
| `smartor.surgery_event` | 数字化手术室回写术中事件 | P0 |
| `smartteach.session_started` | 示教开始 | P0 |
| `smartteach.session_ended` | 示教结束 | P0 |
| `smartconsult.consultation_started` | 远程会诊开始 | P1 |
| `smartconsult.consultation_completed` | 远程会诊完成 | P1 |
| `smartclean.task_completed` | 清洁任务完成 | P1 |

## 5. FHIR 资源清单

FHIR 第一阶段作为标准化输出，不作为唯一内部模型。

| FHIR Resource | SmartHIS 映射 | 优先级 |
| --- | --- | --- |
| Patient | Patient | P1 |
| Encounter | Encounter / Admission | P1 |
| Organization | Organization | P1 |
| Location | Campus / Ward / Bed / OperatingRoom | P1 |
| Practitioner | Practitioner | P1 |
| Condition | Diagnosis | P1 |
| ServiceRequest | Order / SurgeryRequest | P1 |
| Procedure | SurgerySchedule / SurgeryEvent | P1 |
| Observation | LabReport items | P1 |
| DiagnosticReport | LabReport / ExamReport | P1 |
| ImagingStudy | ImagingStudy | P1 |
| DocumentReference | Document | P1 |

建议路径：

- `/fhir/Patient`
- `/fhir/Encounter`
- `/fhir/Procedure`
- `/fhir/DiagnosticReport`
- `/fhir/ImagingStudy`
- `/fhir/DocumentReference`

## 6. HL7 v2 消息清单

HL7 v2 用于模拟国内常见集成平台消息，第一阶段只覆盖关键消息。

| 消息 | 触发场景 | 优先级 |
| --- | --- | --- |
| ADT^A01 | 入院 | P1 |
| ADT^A02 | 转科/转床 | P1 |
| ADT^A03 | 出院 | P1 |
| ADT^A04 | 门诊登记 | P2 |
| ADT^A08 | 患者信息更新 | P1 |
| ORM^O01 | 医嘱/检查/检验/手术申请 | P1 |
| ORU^R01 | 检查检验结果 | P1 |
| SIU^S12 | 手术预约/排班 | P1 |
| SIU^S14 | 手术排班修改 | P1 |
| SIU^S15 | 手术排班取消 | P1 |

第一阶段消息段建议：

- MSH：消息头。
- PID：患者信息。
- PV1：就诊/住院信息。
- ORC：医嘱控制。
- OBR：检查检验/手术申请。
- OBX：结果明细。
- SCH：预约排班。
- AIP：人员。
- AIL：地点/手术间。

## 7. DICOM/DICOMweb 清单

第一阶段以影像索引和调阅为主，不做完整 PACS。

| 接口 | 说明 | 优先级 |
| --- | --- | --- |
| QIDO-RS Studies | 按患者、检查号查询 Study | P1 |
| WADO-RS Metadata | 查询 Study/Series/Instance 元数据 | P1 |
| WADO-RS Retrieve | 下载 DICOM 样例 | P1 |
| Viewer URL | 返回 Web 影像调阅地址 | P0 |
| DICOM C-FIND | 可选，模拟传统 PACS 查询 | P2 |
| DICOM C-MOVE | 可选，模拟传统 PACS 拉取 | P2 |

## 8. DB View 清单

DB View 用于模拟医院现场开放只读视图的情况，第一阶段可选。

| 视图名 | 内容 | 优先级 |
| --- | --- | --- |
| `v_patient` | 患者主索引 | P2 |
| `v_inpatient` | 住院患者 | P2 |
| `v_diagnosis` | 诊断 | P2 |
| `v_surgery_schedule` | 手术排班 | P2 |
| `v_surgery_event` | 手术事件 | P2 |
| `v_lab_report` | 检验报告 | P2 |
| `v_exam_report` | 检查报告 | P2 |
| `v_imaging_study` | 影像索引 | P2 |

## 9. 首视产品联调矩阵

| 首视产品/模块 | 需要接口 | MVP 优先级 |
| --- | --- | --- |
| 数字化手术室 | 患者、住院、诊断、手术排班、手术状态回写、文书摘要、报告 | P0 |
| 手术示教 | 手术排班、术者信息、患者脱敏摘要、影像报告、直播状态 | P0 |
| 远程会诊 | 患者摘要、诊断、报告、影像、文书、会诊申请/结果 | P0 |
| 门口屏 | 手术间当前手术、台次、脱敏患者、术中状态 | P0 |
| 中央监控 | 手术间列表、当前手术、状态、视频源、告警 | P0 |
| 家属谈话 | 患者摘要、术前小结、谈话预约、状态回写 | P1 |
| 一键清洁 | 出室事件、手术间状态、清洁开始/完成 | P0 |

## 10. 示例请求与响应

### 10.1 查询某日手术排班

请求：

```http
GET /api/v1/surgery-schedules?date=2026-05-16&roomId=OR01
```

响应：

```json
{
  "items": [
    {
      "scheduleId": "SCH202605160001",
      "surgeryNo": "OP202605160001",
      "roomCode": "OR01",
      "tableNo": 1,
      "patient": {
        "patientId": "P202605160001",
        "name": "张某某",
        "gender": "男",
        "ageText": "56岁",
        "inpatientNo": "ZY202605160001"
      },
      "plannedSurgeryName": "腹腔镜胆囊切除术",
      "anesthesiaMethod": "全麻",
      "surgeonName": "李主任",
      "status": "Scheduled",
      "plannedStartTime": "2026-05-16T08:30:00+08:00"
    }
  ]
}
```

### 10.2 回写手术状态

请求：

```http
PATCH /api/v1/surgery-schedules/SCH202605160001/status
Content-Type: application/json

{
  "status": "SurgeryStarted",
  "eventTime": "2026-05-16T09:12:00+08:00",
  "sourceSystem": "SmartOR",
  "operatorCode": "D001"
}
```

响应：

```json
{
  "scheduleId": "SCH202605160001",
  "status": "SurgeryStarted",
  "accepted": true,
  "eventId": "EVT202605160003"
}
```

### 10.3 查询就诊摘要

请求：

```http
GET /api/v1/encounters/ENC202605160001/summary
```

响应：

```json
{
  "encounterId": "ENC202605160001",
  "patient": {
    "patientId": "P202605160001",
    "name": "张某某",
    "gender": "男",
    "ageText": "56岁",
    "inpatientNo": "ZY202605160001"
  },
  "diagnoses": [
    {
      "code": "K80.200",
      "name": "胆囊结石伴慢性胆囊炎",
      "type": "Preoperative"
    }
  ],
  "documents": [
    {
      "type": "PreoperativeSummary",
      "title": "术前小结",
      "status": "Final"
    }
  ],
  "reports": [
    {
      "type": "Lab",
      "name": "血常规",
      "status": "Final",
      "abnormalFlag": "Normal"
    },
    {
      "type": "Exam",
      "name": "上腹部CT",
      "status": "Final",
      "accessionNo": "ACC202605160001"
    }
  ]
}
```

## 11. 接口安全与模拟规则

- 第一阶段使用 API Key 或固定 Token 即可，后续再扩展 OAuth2/OIDC。
- 所有日志默认脱敏姓名、身份证号、手机号。
- 管理控制台可以查看完整假数据，但不能导入真实患者数据作为默认演示数据。
- 接口必须支持可控失败：超时、500、空结果、编码缺失、状态冲突。
- 每次接口调用写入 `InterfaceMessage`，便于测试和项目复盘。

## 12. 第一阶段验收条件

- 可以通过 REST API 查询患者、住院、诊断、手术排班、文书摘要、检查检验、影像索引。
- 可以把某台手术从已排班推进到出室和清洁完成。
- 可以向首视数字化手术室/示教/会诊模块推送至少 5 类关键事件。
- 可以查看接口日志，并按患者或手术号追踪完整调用链。
- 可以重置演示数据，并重复执行同一个手术演示场景。
- 可以输出基础 FHIR 资源和 HL7 v2 样例消息，用于产品化展示。
