export function createSeedState() {
  const orgs = [
    {
      orgId: "ORG001",
      orgCode: "320300A001",
      orgName: "首视演示三甲医院",
      orgType: "综合医院",
      grade: "三级甲等",
      regionCode: "320300",
      address: "江苏省徐州市演示路 66 号",
      enabled: true
    }
  ];

  const departments = [
    { deptId: "D001", deptCode: "MZK", deptName: "门诊部", deptType: "门诊", parentDeptId: null, campusId: "CAMP001", enabled: true },
    { deptId: "D002", deptCode: "SSB", deptName: "手术部", deptType: "手术", parentDeptId: null, campusId: "CAMP001", enabled: true },
    { deptId: "D003", deptCode: "MZK2", deptName: "麻醉科", deptType: "手术", parentDeptId: null, campusId: "CAMP001", enabled: true },
    { deptId: "D004", deptCode: "PWK", deptName: "普外科", deptType: "住院", parentDeptId: null, campusId: "CAMP001", enabled: true },
    { deptId: "D005", deptCode: "GK", deptName: "骨科", deptType: "住院", parentDeptId: null, campusId: "CAMP001", enabled: true },
    { deptId: "D006", deptCode: "FK", deptName: "妇科", deptType: "住院", parentDeptId: null, campusId: "CAMP001", enabled: true },
    { deptId: "D007", deptCode: "CK", deptName: "产科", deptType: "住院", parentDeptId: null, campusId: "CAMP001", enabled: true },
    { deptId: "D008", deptCode: "YXK", deptName: "影像科", deptType: "医技", parentDeptId: null, campusId: "CAMP001", enabled: true },
    { deptId: "D009", deptCode: "JYK", deptName: "检验科", deptType: "医技", parentDeptId: null, campusId: "CAMP001", enabled: true },
    { deptId: "D010", deptCode: "YJK", deptName: "药剂科", deptType: "医技", parentDeptId: null, campusId: "CAMP001", enabled: true },
    { deptId: "D011", deptCode: "ZLNK", deptName: "肿瘤内科", deptType: "住院", parentDeptId: null, campusId: "CAMP001", enabled: true },
    { deptId: "D012", deptCode: "RXWK", deptName: "乳腺外科", deptType: "住院", parentDeptId: null, campusId: "CAMP001", enabled: true },
    { deptId: "D013", deptCode: "FLK", deptName: "放疗科", deptType: "医技", parentDeptId: null, campusId: "CAMP001", enabled: true },
    { deptId: "D014", deptCode: "BLK", deptName: "病理科", deptType: "医技", parentDeptId: null, campusId: "CAMP001", enabled: true },
    { deptId: "D015", deptCode: "CSYX", deptName: "超声医学科", deptType: "医技", parentDeptId: null, campusId: "CAMP001", enabled: true }
  ];

  const wards = [
    { wardId: "W001", wardCode: "PWK01", wardName: "普外科一病区", deptId: "D004", floor: "8F", nurseStation: "NS-PWK01" },
    { wardId: "W002", wardCode: "GK01", wardName: "骨科一病区", deptId: "D005", floor: "9F", nurseStation: "NS-GK01" },
    { wardId: "W003", wardCode: "FK01", wardName: "妇科一病区", deptId: "D006", floor: "10F", nurseStation: "NS-FK01" },
    { wardId: "W004", wardCode: "ZLNK01", wardName: "肿瘤内科一病区", deptId: "D011", floor: "11F", nurseStation: "NS-ZLNK01" },
    { wardId: "W005", wardCode: "RXWK01", wardName: "乳腺外科一病区", deptId: "D012", floor: "12F", nurseStation: "NS-RXWK01" }
  ];

  const beds = [
    { bedId: "B001", bedNo: "0801-01", wardId: "W001", roomNo: "0801", status: "Occupied", currentEncounterId: "ENC000001" },
    { bedId: "B002", bedNo: "0801-02", wardId: "W001", roomNo: "0801", status: "Idle", currentEncounterId: null },
    { bedId: "B003", bedNo: "0902-01", wardId: "W002", roomNo: "0902", status: "Occupied", currentEncounterId: "ENC000002" },
    { bedId: "B004", bedNo: "1003-01", wardId: "W003", roomNo: "1003", status: "Occupied", currentEncounterId: "ENC000003" }
  ];

  const operatingRooms = [
    { roomId: "OR01", roomCode: "OR-01", roomName: "1 号手术间", roomType: "普通", deptId: "D002", floor: "3F", status: "Occupied", videoSourceCode: "CAM-OR01" },
    { roomId: "OR02", roomCode: "OR-02", roomName: "2 号手术间", roomType: "复合", deptId: "D002", floor: "3F", status: "Idle", videoSourceCode: "CAM-OR02" },
    { roomId: "OR03", roomCode: "OR-03", roomName: "3 号日间手术间", roomType: "日间", deptId: "D002", floor: "3F", status: "Cleaning", videoSourceCode: "CAM-OR03" }
  ];

  const practitioners = [
    { practitionerId: "PRA001", staffNo: "D001", name: "李主任", gender: "男", title: "主任医师", role: "医生", deptId: "D004", phone: "13900000001", enabled: true, educationBackground: ["南京医科大学临床医学学士", "上海交通大学医学院外科学硕士"], academicExperience: ["三级医院普外科工作 20 年", "中国医师协会外科医师分会会员", "擅长肝胆胰疾病微创手术及围术期管理"], researchInterests: ["胆石症微创治疗", "围术期ERAS"] },
    { practitionerId: "PRA002", staffNo: "D002", name: "王医生", gender: "女", title: "副主任医师", role: "医生", deptId: "D005", phone: "13900000002", enabled: true, educationBackground: ["苏州大学临床医学学士", "复旦大学骨科学硕士"], academicExperience: ["骨科创伤与关节方向 16 年", "省级关节外科进修 1 年", "主持院级创伤骨科质控项目"], researchInterests: ["髋部骨折", "关节镜技术"] },
    { practitionerId: "PRA003", staffNo: "A001", name: "周麻醉", gender: "女", title: "主治医师", role: "麻醉医生", deptId: "D003", phone: "13900000003", enabled: true, educationBackground: ["徐州医科大学麻醉学学士", "南京医科大学麻醉学硕士"], academicExperience: ["麻醉科工作 12 年", "完成胸科、乳腺、腹腔镜手术麻醉专项培训", "参与舒适化医疗质控"], researchInterests: ["全麻苏醒质量", "术后镇痛"] },
    { practitionerId: "PRA004", staffNo: "N001", name: "赵护士", gender: "女", title: "主管护师", role: "护士", deptId: "D002", phone: "13900000004", enabled: true, educationBackground: ["江苏护理职业学院护理学专科", "南京医科大学护理学本科"], academicExperience: ["手术室护理 15 年", "省级手术室专科护士", "负责手术安全核查与器械清点质控"], researchInterests: ["数字化手术室护理", "围术期安全"] },
    { practitionerId: "PRA005", staffNo: "N002", name: "孙护士", gender: "女", title: "护师", role: "护士", deptId: "D002", phone: "13900000005", enabled: true, educationBackground: ["徐州医科大学护理学本科"], academicExperience: ["手术室巡回与器械护理 8 年", "完成乳腺手术专科护理培训"], researchInterests: ["手术耗材追溯", "患者转运交接"] },
    { practitionerId: "PRA006", staffNo: "T001", name: "陈技师", gender: "男", title: "主管技师", role: "技师", deptId: "D008", phone: "13900000006", enabled: true, educationBackground: ["南京医科大学医学影像技术本科"], academicExperience: ["影像科技术岗位 13 年", "PACS/DICOM 质控负责人", "参加国家住院医技互联互通数据治理项目"], researchInterests: ["DICOM质控", "影像设备联调"] },
    { practitionerId: "PRA007", staffNo: "B001", name: "沈乳外", gender: "女", title: "主任医师", role: "医生", deptId: "D012", phone: "13900000007", enabled: true, educationBackground: ["复旦大学上海医学院临床医学学士", "复旦大学肿瘤学博士"], academicExperience: ["乳腺外科工作 22 年", "国家级乳腺肿瘤规范化诊疗培训师", "长期参与乳腺癌 MDT 与保乳手术质控"], researchInterests: ["乳腺癌保乳治疗", "前哨淋巴结活检", "乳房重建"] },
    { practitionerId: "PRA008", staffNo: "O001", name: "顾肿内", gender: "女", title: "主任医师", role: "医生", deptId: "D011", phone: "13900000008", enabled: true, educationBackground: ["上海交通大学医学院临床医学学士", "复旦大学肿瘤学硕士", "美国 MD Anderson Cancer Center 访问学习 6 个月"], academicExperience: ["肿瘤内科工作 21 年", "乳腺癌多学科综合治疗骨干", "承担抗肿瘤药物不良反应管理培训"], researchInterests: ["乳腺癌化疗/靶向/内分泌治疗", "骨转移", "脑转移", "恶性胸腹水", "癌痛与VTE管理"] },
    { practitionerId: "PRA009", staffNo: "B002", name: "许乳外", gender: "男", title: "副主任医师", role: "医生", deptId: "D012", phone: "13900000009", enabled: true, educationBackground: ["浙江大学临床医学学士", "海军军医大学外科学硕士"], academicExperience: ["乳腺肿瘤外科 15 年", "省级乳腺微创旋切与定位活检培训", "参与乳腺癌术后随访数据库建设"], researchInterests: ["乳腺微创活检", "腋窝处理策略"] },
    { practitionerId: "PRA010", staffNo: "O002", name: "韩肿内", gender: "男", title: "副主任医师", role: "医生", deptId: "D011", phone: "13900000010", enabled: true, educationBackground: ["南京医科大学临床医学学士", "中国医学科学院肿瘤学博士"], academicExperience: ["实体瘤内科治疗 14 年", "GCP 抗肿瘤药物临床试验骨干", "负责乳腺癌靶向治疗用药审核"], researchInterests: ["HER2阳性乳腺癌", "三阴性乳腺癌", "免疫治疗不良反应"] },
    { practitionerId: "PRA011", staffNo: "R001", name: "丁放疗", gender: "女", title: "主任医师", role: "医生", deptId: "D013", phone: "13900000011", enabled: true, educationBackground: ["复旦大学上海医学院临床医学学士", "北京协和医学院放射肿瘤学博士"], academicExperience: ["放射治疗 19 年", "乳腺癌术后放疗计划质控专家", "参加调强放疗和立体定向放疗规范化培训"], researchInterests: ["乳腺癌术后放疗", "脑转移放疗", "放疗不良反应管理"] },
    { practitionerId: "PRA012", staffNo: "P001", name: "马病理", gender: "女", title: "主任医师", role: "病理医生", deptId: "D014", phone: "13900000012", enabled: true, educationBackground: ["中山大学临床医学学士", "复旦大学病理学博士"], academicExperience: ["乳腺病理诊断 20 年", "省级分子病理质控专家", "负责ER/PR/HER2/Ki-67免疫组化与FISH复核"], researchInterests: ["乳腺癌分子分型", "病理质控"] },
    { practitionerId: "PRA013", staffNo: "U001", name: "叶超声", gender: "女", title: "副主任医师", role: "超声医生", deptId: "D015", phone: "13900000013", enabled: true, educationBackground: ["徐州医科大学医学影像学学士", "复旦大学影像医学与核医学硕士"], academicExperience: ["乳腺及甲状腺超声 16 年", "乳腺 BI-RADS 规范化报告培训讲师", "开展超声引导下空芯针穿刺"], researchInterests: ["乳腺BI-RADS", "超声引导穿刺"] },
    { practitionerId: "PRA014", staffNo: "I001", name: "邱影像", gender: "男", title: "主任医师", role: "影像医生", deptId: "D008", phone: "13900000014", enabled: true, educationBackground: ["山东大学医学影像学学士", "复旦大学影像医学与核医学博士"], academicExperience: ["乳腺钼靶/MRI 18 年", "PACS结构化报告模板负责人", "参与乳腺影像MDT"], researchInterests: ["乳腺钼靶", "乳腺MRI", "影像结构化报告"] },
    { practitionerId: "PRA015", staffNo: "C001", name: "何心内", gender: "男", title: "副主任医师", role: "医生", deptId: "D004", phone: "13900000015", enabled: true, educationBackground: ["南京医科大学临床医学学士", "上海交通大学心血管内科学硕士"], academicExperience: ["心血管内科 15 年", "围术期心血管风险会诊骨干"], researchInterests: ["冠心病", "房颤", "围术期心血管评估"] },
    { practitionerId: "PRA016", staffNo: "N003", name: "陆神内", gender: "女", title: "副主任医师", role: "医生", deptId: "D004", phone: "13900000016", enabled: true, educationBackground: ["南京大学医学院临床医学学士", "首都医科大学神经病学硕士"], academicExperience: ["神经内科 13 年", "卒中中心质控秘书", "擅长脑血管病住院流程管理"], researchInterests: ["脑梗死", "TIA", "围术期卒中风险"] },
    { practitionerId: "PRA017", staffNo: "E001", name: "程内分泌", gender: "女", title: "主治医师", role: "医生", deptId: "D004", phone: "13900000017", enabled: true, educationBackground: ["徐州医科大学临床医学学士", "南京医科大学内分泌学硕士"], academicExperience: ["内分泌科 10 年", "院内血糖管理小组成员"], researchInterests: ["围术期血糖管理", "甲状腺疾病"] },
    { practitionerId: "PRA018", staffNo: "G001", name: "郑妇科", gender: "女", title: "主任医师", role: "医生", deptId: "D006", phone: "13900000018", enabled: true, educationBackground: ["东南大学临床医学学士", "复旦大学妇产科学硕士"], academicExperience: ["妇科肿瘤及微创手术 18 年", "省级妇科内镜培训基地带教老师"], researchInterests: ["子宫肌瘤", "卵巢囊肿", "妇科肿瘤微创"] },
    { practitionerId: "PRA019", staffNo: "PH001", name: "吴临药", gender: "女", title: "主管药师", role: "药师", deptId: "D010", phone: "13900000019", enabled: true, educationBackground: ["中国药科大学临床药学学士", "复旦大学药理学硕士"], academicExperience: ["临床药学 12 年", "抗肿瘤药物处方审核与不良反应监测负责人"], researchInterests: ["抗肿瘤药物管理", "围术期抗菌药物"] },
    { practitionerId: "PRA020", staffNo: "MR001", name: "张病案", gender: "男", title: "主管技师", role: "病案编码员", deptId: "D014", phone: "13900000020", enabled: true, educationBackground: ["南京医科大学卫生信息管理本科"], academicExperience: ["病案编码与DRG/DIP管理 11 年", "院内医保结算清单质控员", "参与病案首页与医保清单一致性校验"], researchInterests: ["ICD编码", "医保结算清单", "病案首页质控"] }
  ];

  const patients = [
    {
      patientId: "PAT000001",
      mpiNo: "MPI202605160001",
      name: "张某某",
      gender: "男",
      birthDate: "1970-03-12",
      ageText: "56岁",
      idCardNo: "320300197003120011",
      phone: "13800000001",
      address: "江苏省徐州市演示小区",
      insuranceType: "城镇职工",
      bloodType: "A Rh+",
      allergyText: "青霉素过敏"
    },
    {
      patientId: "PAT000002",
      mpiNo: "MPI202605160002",
      name: "刘某某",
      gender: "女",
      birthDate: "1984-09-08",
      ageText: "41岁",
      idCardNo: "320300198409080022",
      phone: "13800000002",
      address: "江苏省徐州市模拟街道",
      insuranceType: "城乡居民",
      bloodType: "O Rh+",
      allergyText: "无"
    },
    {
      patientId: "PAT000003",
      mpiNo: "MPI202605160003",
      name: "陈某某",
      gender: "女",
      birthDate: "1992-01-20",
      ageText: "34岁",
      idCardNo: "320300199201200033",
      phone: "13800000003",
      address: "江苏省徐州市测试路",
      insuranceType: "自费",
      bloodType: "B Rh+",
      allergyText: "无"
    }
  ];

  const encounters = [
    { encounterId: "ENC000001", patientId: "PAT000001", encounterType: "住院", outpatientNo: null, inpatientNo: "ZY202605160001", visitNo: "VIS202605160001", deptId: "D004", attendingDoctorId: "PRA001", status: "Admitted", startTime: "2026-05-15T08:20:00+08:00", endTime: null },
    { encounterId: "ENC000002", patientId: "PAT000002", encounterType: "住院", outpatientNo: null, inpatientNo: "ZY202605160002", visitNo: "VIS202605160002", deptId: "D005", attendingDoctorId: "PRA002", status: "Admitted", startTime: "2026-05-15T10:30:00+08:00", endTime: null },
    { encounterId: "ENC000003", patientId: "PAT000003", encounterType: "住院", outpatientNo: null, inpatientNo: "ZY202605160003", visitNo: "VIS202605160003", deptId: "D006", attendingDoctorId: "PRA001", status: "Admitted", startTime: "2026-05-16T07:50:00+08:00", endTime: null }
  ];

  const admissions = [
    { admissionId: "ADM000001", encounterId: "ENC000001", wardId: "W001", bedId: "B001", admissionTime: "2026-05-15T08:20:00+08:00", dischargeTime: null, admissionDiagnosis: "胆囊结石伴慢性胆囊炎", dischargeDiagnosis: null, nursingLevel: "二级护理", conditionLevel: "一般" },
    { admissionId: "ADM000002", encounterId: "ENC000002", wardId: "W002", bedId: "B003", admissionTime: "2026-05-15T10:30:00+08:00", dischargeTime: null, admissionDiagnosis: "右股骨颈骨折", dischargeDiagnosis: null, nursingLevel: "一级护理", conditionLevel: "较重" },
    { admissionId: "ADM000003", encounterId: "ENC000003", wardId: "W003", bedId: "B004", admissionTime: "2026-05-16T07:50:00+08:00", dischargeTime: null, admissionDiagnosis: "子宫肌瘤", dischargeDiagnosis: null, nursingLevel: "二级护理", conditionLevel: "一般" }
  ];

  const diagnoses = [
    { diagnosisId: "DIA000001", encounterId: "ENC000001", diagnosisCode: "K80.200", diagnosisName: "胆囊结石伴慢性胆囊炎", diagnosisType: "术前", isPrimary: true, recordedTime: "2026-05-15T09:00:00+08:00" },
    { diagnosisId: "DIA000002", encounterId: "ENC000002", diagnosisCode: "S72.001", diagnosisName: "右股骨颈骨折", diagnosisType: "术前", isPrimary: true, recordedTime: "2026-05-15T11:00:00+08:00" },
    { diagnosisId: "DIA000003", encounterId: "ENC000003", diagnosisCode: "D25.900", diagnosisName: "子宫肌瘤", diagnosisType: "术前", isPrimary: true, recordedTime: "2026-05-16T08:30:00+08:00" }
  ];

  const orders = [
    { orderId: "ORD000001", orderNo: "ORD202605160001", encounterId: "ENC000001", orderType: "手术", itemCode: "51.2301", itemName: "腹腔镜胆囊切除术", status: "已完成", requesterDeptId: "D004", requesterId: "PRA001", requestedTime: "2026-05-15T10:00:00+08:00", scheduledTime: "2026-05-16T08:30:00+08:00" },
    { orderId: "ORD000002", orderNo: "LAB202605160001", encounterId: "ENC000001", orderType: "检验", itemCode: "PREOP_LAB_CHOLE", itemName: "血常规+肝肾功能+电解质+凝血功能", status: "已完成", requesterDeptId: "D004", requesterId: "PRA001", requestedTime: "2026-05-15T10:05:00+08:00", scheduledTime: "2026-05-15T11:00:00+08:00" },
    { orderId: "ORD000003", orderNo: "EXAM202605160001", encounterId: "ENC000001", orderType: "检查", itemCode: "CT-ABD-UPPER", itemName: "上腹部 CT 平扫", status: "已完成", requesterDeptId: "D004", requesterId: "PRA001", requestedTime: "2026-05-15T10:10:00+08:00", scheduledTime: "2026-05-15T14:30:00+08:00" },
    { orderId: "ORD000004", orderNo: "ORD202605160002", encounterId: "ENC000002", orderType: "手术", itemCode: "81.5201", itemName: "人工股骨头置换术", status: "已确认", requesterDeptId: "D005", requesterId: "PRA002", requestedTime: "2026-05-15T11:10:00+08:00", scheduledTime: "2026-05-16T10:30:00+08:00" },
    { orderId: "ORD000005", orderNo: "US202605160001", encounterId: "ENC000001", orderType: "检查", itemCode: "US-ABD-GALLBLADDER", itemName: "腹部彩色多普勒超声（肝胆胰脾）", status: "已完成", requesterDeptId: "D004", requesterId: "PRA001", requestedTime: "2026-05-15T10:12:00+08:00", scheduledTime: "2026-05-15T13:20:00+08:00" },
    { orderId: "ORD000006", orderNo: "ECG202605160001", encounterId: "ENC000001", orderType: "检查", itemCode: "ECG-12", itemName: "十二导联心电图", status: "已完成", requesterDeptId: "D004", requesterId: "PRA001", requestedTime: "2026-05-15T10:14:00+08:00", scheduledTime: "2026-05-15T11:20:00+08:00" }
  ];

  const surgeryRequests = [
    { surgeryRequestId: "SR000001", surgeryNo: "OP202605160001", encounterId: "ENC000001", orderId: "ORD000001", plannedSurgeryCode: "51.2301", plannedSurgeryName: "腹腔镜胆囊切除术", surgeryLevel: "三级", incisionType: "II", anesthesiaMethod: "全麻", position: "仰卧位", isolationFlag: false, requestedTime: "2026-05-15T10:00:00+08:00", status: "已排班" },
    { surgeryRequestId: "SR000002", surgeryNo: "OP202605160002", encounterId: "ENC000002", orderId: "ORD000004", plannedSurgeryCode: "81.5201", plannedSurgeryName: "人工股骨头置换术", surgeryLevel: "四级", incisionType: "I", anesthesiaMethod: "椎管内麻醉", position: "侧卧位", isolationFlag: false, requestedTime: "2026-05-15T11:10:00+08:00", status: "已排班" }
  ];

  const surgerySchedules = [
    { surgeryScheduleId: "SCH000001", surgeryRequestId: "SR000001", scheduleDate: "2026-05-16", roomId: "OR01", tableNo: 1, plannedStartTime: "2026-05-16T08:30:00+08:00", plannedEndTime: "2026-05-16T10:00:00+08:00", actualStartTime: "2026-05-16T08:46:00+08:00", actualEndTime: null, status: "SurgeryStarted" },
    { surgeryScheduleId: "SCH000002", surgeryRequestId: "SR000002", scheduleDate: "2026-05-16", roomId: "OR02", tableNo: 2, plannedStartTime: "2026-05-16T10:30:00+08:00", plannedEndTime: "2026-05-16T12:30:00+08:00", actualStartTime: null, actualEndTime: null, status: "Scheduled" }
  ];

  const surgeryStaffAssignments = [
    { assignmentId: "SSA000001", surgeryScheduleId: "SCH000001", practitionerId: "PRA001", role: "主刀", sortNo: 1 },
    { assignmentId: "SSA000002", surgeryScheduleId: "SCH000001", practitionerId: "PRA003", role: "麻醉医生", sortNo: 2 },
    { assignmentId: "SSA000003", surgeryScheduleId: "SCH000001", practitionerId: "PRA004", role: "巡回护士", sortNo: 3 },
    { assignmentId: "SSA000004", surgeryScheduleId: "SCH000001", practitionerId: "PRA005", role: "器械护士", sortNo: 4 },
    { assignmentId: "SSA000005", surgeryScheduleId: "SCH000002", practitionerId: "PRA002", role: "主刀", sortNo: 1 },
    { assignmentId: "SSA000006", surgeryScheduleId: "SCH000002", practitionerId: "PRA003", role: "麻醉医生", sortNo: 2 }
  ];

  const surgeryEvents = [
    { eventId: "EVT000001", surgeryScheduleId: "SCH000001", eventType: "InRoom", eventTime: "2026-05-16T08:35:00+08:00", operatorId: "PRA004", sourceSystem: "SmartHIS", payload: {} },
    { eventId: "EVT000002", surgeryScheduleId: "SCH000001", eventType: "AnesthesiaStarted", eventTime: "2026-05-16T08:40:00+08:00", operatorId: "PRA003", sourceSystem: "SmartHIS", payload: {} },
    { eventId: "EVT000003", surgeryScheduleId: "SCH000001", eventType: "SurgeryStarted", eventTime: "2026-05-16T08:46:00+08:00", operatorId: "PRA001", sourceSystem: "SmartHIS", payload: {} }
  ];

  const documents = [
    { documentId: "DOC000001", encounterId: "ENC000001", documentType: "PreoperativeSummary", title: "术前小结", authorId: "PRA001", deptId: "D004", status: "Final", createdTime: "2026-05-15T16:00:00+08:00", signedTime: "2026-05-15T16:30:00+08:00", contentText: "患者因反复右上腹痛入院，腹部超声提示胆囊多发结石伴慢性胆囊炎，胆总管未见扩张；血常规、肝肾功能、胆红素、血淀粉酶、凝血功能及心电图未见手术禁忌，ASA II级，拟择期行腹腔镜胆囊切除术。", content: { risk: "ASA II级，VTE中低危", consent: "手术、麻醉及必要输血知情同意已签署", diagnosticBasis: ["腹部超声", "上腹部 CT", "术前检验", "心电图"] } },
    { documentId: "DOC000002", encounterId: "ENC000001", documentType: "SurgeryRecord", title: "手术记录", authorId: "PRA001", deptId: "D004", status: "Draft", createdTime: "2026-05-16T09:10:00+08:00", signedTime: null, contentText: "手术进行中，记录待完善。", content: {} },
    { documentId: "DOC000003", encounterId: "ENC000002", documentType: "PreoperativeSummary", title: "术前小结", authorId: "PRA002", deptId: "D005", status: "Final", createdTime: "2026-05-15T17:00:00+08:00", signedTime: "2026-05-15T17:40:00+08:00", contentText: "患者右股骨颈骨折，拟行人工股骨头置换术。", content: { risk: "较高风险", consent: "已签署" } },
    { documentId: "DOC000004", encounterId: "ENC000001", documentType: "AdmissionRecord", title: "入院记录", authorId: "PRA001", deptId: "D004", status: "Final", createdTime: "2026-05-15T09:10:00+08:00", signedTime: "2026-05-15T09:30:00+08:00", contentText: "患者因反复右上腹胀痛 1 月余，油腻饮食后加重 1 天入院。门诊及入院腹部超声提示胆囊多发结石伴慢性胆囊炎，胆总管未见扩张，拟完善术前评估后择期行腹腔镜胆囊切除术。", content: { chiefComplaint: "反复右上腹胀痛 1 月余，油腻饮食后加重 1 天。", presentIllness: "患者 1 月余前出现右上腹阵发性胀痛，进食油腻后明显，偶有恶心，无寒战高热，无皮肤巩膜黄染，无陶土样便。", pastHistory: "既往体健，否认高血压、糖尿病、冠心病等慢性病史。", physicalExam: "T 36.6℃，P 78 次/分，R 18 次/分，BP 126/78 mmHg。神志清楚，心肺听诊未闻及明显异常。", specialtyExam: "腹平软，右上腹轻压痛，无反跳痛及肌紧张，Murphy 征阴性或可疑阳性，肝脾肋下未及。", allergyHistory: "无特殊药物及食物过敏史。" } }
  ];

  const labReports = [
    {
      labReportId: "LABR000001",
      orderId: "ORD000002",
      encounterId: "ENC000001",
      patientId: "PAT000001",
      sampleNo: "LAB202605160001",
      specimenType: "血液",
      reportName: "术前血常规+生化+凝血",
      status: "Final",
      reportTime: "2026-05-15T12:10:00+08:00",
      abnormalFlag: "Normal",
      items: [
        { code: "WBC", name: "白细胞", value: "6.8", unit: "10^9/L", referenceRange: "3.5-9.5", flag: "N" },
        { code: "NEUTP", name: "中性粒细胞百分比", value: "64.2", unit: "%", referenceRange: "40-75", flag: "N" },
        { code: "HGB", name: "血红蛋白", value: "136", unit: "g/L", referenceRange: "115-150", flag: "N" },
        { code: "PLT", name: "血小板", value: "228", unit: "10^9/L", referenceRange: "125-350", flag: "N" },
        { code: "ALT", name: "谷丙转氨酶", value: "32", unit: "U/L", referenceRange: "9-50", flag: "N" },
        { code: "AST", name: "谷草转氨酶", value: "26", unit: "U/L", referenceRange: "15-40", flag: "N" },
        { code: "TBIL", name: "总胆红素", value: "16.8", unit: "umol/L", referenceRange: "5.1-23.0", flag: "N" },
        { code: "DBIL", name: "直接胆红素", value: "4.6", unit: "umol/L", referenceRange: "0.0-6.8", flag: "N" },
        { code: "GGT", name: "谷氨酰转肽酶", value: "36", unit: "U/L", referenceRange: "10-60", flag: "N" },
        { code: "AMY", name: "血淀粉酶", value: "54", unit: "U/L", referenceRange: "30-110", flag: "N" },
        { code: "K", name: "血钾", value: "4.1", unit: "mmol/L", referenceRange: "3.5-5.3", flag: "N" },
        { code: "PT", name: "凝血酶原时间", value: "11.8", unit: "s", referenceRange: "9.8-13.5", flag: "N" },
        { code: "INR", name: "国际标准化比值", value: "1.03", unit: "", referenceRange: "0.85-1.15", flag: "N" },
        { code: "APTT", name: "活化部分凝血活酶时间", value: "29.6", unit: "s", referenceRange: "22-38", flag: "N" }
      ]
    }
  ];

  const examReports = [
    {
      examReportId: "EXR000001",
      orderId: "ORD000003",
      encounterId: "ENC000001",
      patientId: "PAT000001",
      accessionNo: "ACC202605160001",
      modality: "CT",
      bodyPart: "上腹部",
      finding: "肝脏形态大小未见明显异常；胆囊腔内见多发点状及结节状高密度影，胆囊壁轻度增厚，胆囊周围脂肪间隙清晰；肝内外胆管未见扩张，胰腺形态密度未见急性炎症征象。",
      conclusion: "胆囊多发结石伴慢性胆囊炎改变；未见胆总管扩张及急性胰腺炎征象。",
      status: "Final",
      reportTime: "2026-05-15T15:20:00+08:00"
    }
  ];

  const ultrasoundReports = [
    {
      ultrasoundReportId: "US000001",
      orderId: "ORD000005",
      encounterId: "ENC000001",
      patientId: "PAT000001",
      accessionNo: "US202605160001",
      examName: "腹部彩色多普勒超声（肝胆胰脾）",
      bodyPart: "肝胆胰脾",
      finding: "肝脏大小形态正常，实质回声均匀；胆囊大小约 7.3cm x 3.2cm，囊壁稍厚约 0.32cm，腔内见数枚可移动强回声团伴后方声影，大者约 1.1cm；胆总管内径约 0.5cm，肝内外胆管未见扩张；胰腺、脾脏未见明显异常。",
      conclusion: "胆囊多发结石；慢性胆囊炎声像图改变；胆总管未见扩张。",
      status: "Final",
      performedTime: "2026-05-15T13:20:00+08:00",
      reportTime: "2026-05-15T13:38:00+08:00",
      images: [
        { imageNo: "US-001", view: "胆囊长轴", description: "胆囊腔内多发强回声伴声影", imageUrl: "/assets/imaging/1.2.826.0.1.3680043.10.543.202605160001.700/preview.png" },
        { imageNo: "US-002", view: "胆总管切面", description: "胆总管内径约 0.5cm，未见扩张", imageUrl: "/dicomweb/studies/1.2.826.0.1.3680043.10.543.202605160001.700/series/1/instances/1/rendered" }
      ]
    }
  ];

  const ecgReports = [
    {
      ecgReportId: "ECG000001",
      orderId: "ORD000006",
      encounterId: "ENC000001",
      patientId: "PAT000001",
      examNo: "ECG202605160001",
      heartRate: 76,
      rhythm: "窦性心律",
      prInterval: 156,
      qrsDuration: 88,
      qtInterval: 392,
      finding: "P 波规律出现，QRS 波群时限正常，ST-T 未见明显异常改变。",
      conclusion: "窦性心律，正常范围心电图。",
      status: "Final",
      performedTime: "2026-05-15T11:22:00+08:00",
      reportTime: "2026-05-15T11:30:00+08:00",
      waveform: [
        { lead: "I", note: "R 波递增尚可" },
        { lead: "II", note: "节律规则" },
        { lead: "V5", note: "ST 段无明显压低" }
      ]
    }
  ];

  const imagingStudies = [
    {
      imagingStudyId: "IMG000001",
      accessionNo: "ACC202605160001",
      studyInstanceUid: "1.2.826.0.1.3680043.10.543.202605160001",
      patientId: "PAT000001",
      encounterId: "ENC000001",
      modality: "CT",
      studyDescription: "上腹部 CT 平扫",
      bodyPart: "上腹部",
      studyTime: "2026-05-15T14:50:00+08:00",
      dicomwebUrl: "/dicomweb/studies/1.2.826.0.1.3680043.10.543.202605160001",
      dicomFileUrl: "/dicomweb/studies/1.2.826.0.1.3680043.10.543.202605160001/series/1/instances/1/file",
      previewImageUrl: "/assets/imaging/1.2.826.0.1.3680043.10.543.202605160001/preview.png",
      viewerUrl: "/viewer/studies/1.2.826.0.1.3680043.10.543.202605160001"
    },
    {
      imagingStudyId: "IMG000002",
      accessionNo: "US202605160001",
      studyInstanceUid: "1.2.826.0.1.3680043.10.543.202605160001.700",
      patientId: "PAT000001",
      encounterId: "ENC000001",
      modality: "US",
      studyDescription: "腹部彩色多普勒超声（肝胆胰脾）",
      bodyPart: "胆囊/胆总管",
      studyTime: "2026-05-15T13:20:00+08:00",
      dicomwebUrl: "/dicomweb/studies/1.2.826.0.1.3680043.10.543.202605160001.700",
      dicomFileUrl: "/dicomweb/studies/1.2.826.0.1.3680043.10.543.202605160001.700/series/1/instances/1/file",
      previewImageUrl: "/assets/imaging/1.2.826.0.1.3680043.10.543.202605160001.700/preview.png",
      viewerUrl: "/viewer/studies/1.2.826.0.1.3680043.10.543.202605160001.700",
      assetType: "脱敏合成B超DICOM测试片",
      assetNote: "模拟胆囊结石术前腹部超声关键图像，供 PACS/DICOMweb 联调，不含真实患者身份信息。"
    }
  ];

  const consultations = [
    { consultationId: "CON000001", encounterId: "ENC000001", surgeryScheduleId: "SCH000001", consultationType: "远程", requesterDeptId: "D004", invitedDeptId: "D008", reason: "术前影像资料远程讨论", status: "已确认", scheduledTime: "2026-05-16T09:30:00+08:00", conclusion: "" }
  ];

  const teachingSessions = [
    { teachingSessionId: "TEA000001", surgeryScheduleId: "SCH000001", title: "腹腔镜胆囊切除术示教", teacherId: "PRA001", status: "已预约", startTime: "2026-05-16T08:30:00+08:00", endTime: null, streamCode: "CAM-OR01", recordingUrl: null }
  ];

  const deviceTerminals = [
    { deviceId: "DEV000001", deviceCode: "DORS-OR01-INNER", deviceName: "1 号手术间室内控制终端", deviceType: "室内控制终端", terminalType: "室内控制终端", roomId: "OR01", locationName: "1 号手术间内", permissionProfile: "室内状态控制", ipAddress: "192.168.10.101", status: "在线", enabled: true, registeredTime: "2026-05-16T07:30:00+08:00", lastHeartbeatTime: "2026-05-16T09:20:00+08:00" },
    { deviceId: "DEV000002", deviceCode: "DORS-OR01-DOOR", deviceName: "1 号手术间门口屏", deviceType: "门口展示终端", terminalType: "门口展示终端", roomId: "OR01", locationName: "1 号手术间门口", permissionProfile: "门口只读展示", ipAddress: "192.168.10.111", status: "在线", enabled: true, registeredTime: "2026-05-16T07:30:00+08:00", lastHeartbeatTime: "2026-05-16T09:20:00+08:00" },
    { deviceId: "DEV000003", deviceCode: "DORS-OR02-INNER", deviceName: "2 号手术间室内控制终端", deviceType: "室内控制终端", terminalType: "室内控制终端", roomId: "OR02", locationName: "2 号手术间内", permissionProfile: "室内状态控制", ipAddress: "192.168.10.102", status: "在线", enabled: true, registeredTime: "2026-05-16T07:30:00+08:00", lastHeartbeatTime: "2026-05-16T09:20:00+08:00" },
    { deviceId: "DEV000004", deviceCode: "DORS-OR02-DOOR", deviceName: "2 号手术间门口屏", deviceType: "门口展示终端", terminalType: "门口展示终端", roomId: "OR02", locationName: "2 号手术间门口", permissionProfile: "门口只读展示", ipAddress: "192.168.10.112", status: "在线", enabled: true, registeredTime: "2026-05-16T07:30:00+08:00", lastHeartbeatTime: "2026-05-16T09:20:00+08:00" },
    { deviceId: "DEV000005", deviceCode: "DORS-FAMILY-01", deviceName: "家属等待区信息屏", deviceType: "家属等待区屏", terminalType: "家属等待区屏", roomId: null, locationName: "三层家属等待区", permissionProfile: "家属区脱敏展示", ipAddress: "192.168.10.130", status: "在线", enabled: true, registeredTime: "2026-05-16T07:30:00+08:00", lastHeartbeatTime: "2026-05-16T09:20:00+08:00" },
    { deviceId: "DEV000006", deviceCode: "DORS-NURSE-01", deviceName: "手术部护士站看板", deviceType: "护士站看板", terminalType: "护士站看板", roomId: null, locationName: "手术部护士站", permissionProfile: "护士站调度", ipAddress: "192.168.10.120", status: "在线", enabled: true, registeredTime: "2026-05-16T07:30:00+08:00", lastHeartbeatTime: "2026-05-16T09:20:00+08:00" },
    { deviceId: "DEV000007", deviceCode: "DORS-DIRECTOR-01", deviceName: "院领导质控看板", deviceType: "院领导看板", terminalType: "院领导看板", roomId: null, locationName: "管理驾驶舱", permissionProfile: "汇总指标展示", ipAddress: "192.168.10.140", status: "在线", enabled: true, registeredTime: "2026-05-16T07:30:00+08:00", lastHeartbeatTime: "2026-05-16T09:20:00+08:00" }
  ];

  const mediaSources = [
    { mediaSourceId: "MED000001", sourceCode: "CAM-OR01", sourceType: "RTSP", roomId: "OR01", displayName: "1 号手术间全景", streamUrl: "rtsp://127.0.0.1:8554/or01", enabled: true },
    { mediaSourceId: "MED000002", sourceCode: "CAM-OR02", sourceType: "RTSP", roomId: "OR02", displayName: "2 号手术间全景", streamUrl: "rtsp://127.0.0.1:8554/or02", enabled: true }
  ];

  const interfaceChannels = [
    { channelId: "CH000001", channelCode: "REST_CORE", channelType: "REST", direction: "双向", enabled: true, config: { basePath: "/api/v1" } },
    { channelId: "CH000002", channelCode: "FHIR_R4", channelType: "FHIR", direction: "出站", enabled: true, config: { basePath: "/fhir" } },
    { channelId: "CH000003", channelCode: "DICOMWEB", channelType: "DICOM", direction: "出站", enabled: true, config: { basePath: "/dicomweb" } },
    { channelId: "CH000004", channelCode: "HL7_V2", channelType: "HL7", direction: "出站", enabled: true, config: { encoding: "UTF-8" } }
  ];

  const scenarios = [
    {
      scenarioId: "SCN000001",
      scenarioCode: "NORMAL_INPATIENT_SURGERY",
      scenarioName: "普通住院手术全流程",
      hospitalTemplate: "三级综合医院",
      description: "从接台、入室、麻醉、手术、出室到清洁完成的完整演示流程。",
      steps: ["Called", "InRoom", "AnesthesiaStarted", "SurgeryStarted", "SurgeryEnded", "OutRoom", "Cleaning", "Completed"],
      enabled: true
    },
    {
      scenarioId: "SCN000002",
      scenarioCode: "REMOTE_CONSULTATION",
      scenarioName: "远程会诊资料调阅",
      hospitalTemplate: "三级综合医院",
      description: "围绕患者摘要、文书、检查检验和影像索引生成会诊场景。",
      steps: ["ConsultationRequested", "ConsultationStarted", "ConsultationCompleted"],
      enabled: true
    },
    {
      scenarioId: "SCN000003",
      scenarioCode: "TEACHING_SURGERY",
      scenarioName: "手术示教直播",
      hospitalTemplate: "三级综合医院",
      description: "围绕手术排班、视频源和示教状态生成示教直播场景。",
      steps: ["TeachingScheduled", "TeachingStarted", "TeachingEnded"],
      enabled: true
    }
  ];

  const journeyTemplates = [
    {
      templateId: "TPL_CHOLECYSTECTOMY_INPATIENT",
      templateCode: "CHOLECYSTECTOMY_INPATIENT",
      templateName: "胆囊结石择期住院手术全流程",
      diseaseName: "胆囊结石伴慢性胆囊炎",
      departmentId: "D004",
      description: "模拟普外科胆囊结石患者从入院到出院的完整住院手术流程。",
      enabled: true,
      steps: [
        { stepCode: "admission_registered", stepName: "入院登记", phase: "入院", defaultOffsetMinutes: 0, linkedAction: "confirmAdmission", interfaceEvent: "journey.admission_registered", description: "确认患者建档、住院号、病区和床位。" },
        { stepCode: "diagnosis_recorded", stepName: "入院诊断", phase: "入院", defaultOffsetMinutes: 40, linkedAction: "confirmDiagnosis", interfaceEvent: "journey.diagnosis_recorded", description: "写入胆囊结石伴慢性胆囊炎主诊断。" },
        { stepCode: "admission_orders_created", stepName: "入院医嘱", phase: "入院", defaultOffsetMinutes: 20, linkedAction: "createAdmissionOrders", interfaceEvent: "journey.admission_orders_created", description: "开立护理级别、禁食水、补液和基础治疗医嘱。" },
        { stepCode: "preop_orders_created", stepName: "术前医嘱", phase: "术前", defaultOffsetMinutes: 40, linkedAction: "confirmPreopOrders", interfaceEvent: "journey.preop_orders_created", description: "开立血常规、凝血、肝肾功能、腹部超声、必要时上腹部 CT 和手术医嘱。" },
        { stepCode: "specimen_collected", stepName: "检验采样", phase: "术前", defaultOffsetMinutes: 30, linkedAction: "collectSpecimens", interfaceEvent: "lis.specimen_collected", description: "护士完成血液标本采集，检验科接收样本。" },
        { stepCode: "imaging_performed", stepName: "检查执行", phase: "术前", defaultOffsetMinutes: 90, linkedAction: "performImaging", interfaceEvent: "ris.exam_performed", description: "超声科完成腹部超声，影像科完成必要 CT，PACS 生成影像索引。" },
        { stepCode: "reports_finalized", stepName: "报告完成", phase: "术前", defaultOffsetMinutes: 120, linkedAction: "finalizeReports", interfaceEvent: "journey.reports_finalized", description: "检验检查报告审核完成，影像可调阅。" },
        { stepCode: "preop_medication_dispensed", stepName: "术前配药", phase: "术前", defaultOffsetMinutes: 30, linkedAction: "dispensePreopMedication", interfaceEvent: "pharmacy.preop_medication_dispensed", description: "药房完成术前预防用药、补液和镇痛药品配发。" },
        { stepCode: "preop_medication_administered", stepName: "术前用药", phase: "术前", defaultOffsetMinutes: 20, linkedAction: "administerPreopMedication", interfaceEvent: "nursing.preop_medication_administered", description: "护士核对患者身份并执行术前用药。" },
        { stepCode: "preop_summary_signed", stepName: "术前小结签署", phase: "术前", defaultOffsetMinutes: 60, linkedAction: "signPreopSummary", interfaceEvent: "journey.preop_summary_signed", description: "术前小结完成签署。" },
        { stepCode: "anesthesia_visit_done", stepName: "麻醉访视完成", phase: "术前", defaultOffsetMinutes: 30, linkedAction: "createAnesthesiaVisit", interfaceEvent: "journey.anesthesia_visit_done", description: "生成麻醉访视摘要。" },
        { stepCode: "surgery_requested", stepName: "手术申请确认", phase: "术前", defaultOffsetMinutes: 30, linkedAction: "confirmSurgeryRequest", interfaceEvent: "journey.surgery_requested", description: "手术申请审核确认。" },
        { stepCode: "surgery_scheduled", stepName: "手术排班完成", phase: "术前", defaultOffsetMinutes: 30, linkedAction: "confirmSurgerySchedule", interfaceEvent: "journey.surgery_scheduled", description: "确认手术间、台次、术者和麻醉方式。" },
        { stepCode: "patient_called", stepName: "接台", phase: "术中", defaultOffsetMinutes: 720, linkedAction: "surgeryStatus:Called", interfaceEvent: "surgery.called", description: "手术部接台，通知患者准备入室。" },
        { stepCode: "patient_in_room", stepName: "入室", phase: "术中", defaultOffsetMinutes: 10, linkedAction: "surgeryStatus:InRoom", interfaceEvent: "surgery.in_room", description: "患者进入手术间。" },
        { stepCode: "anesthesia_started", stepName: "麻醉开始", phase: "术中", defaultOffsetMinutes: 10, linkedAction: "surgeryStatus:AnesthesiaStarted", interfaceEvent: "surgery.anesthesia_started", description: "麻醉医生开始麻醉。" },
        { stepCode: "surgery_started", stepName: "手术开始", phase: "术中", defaultOffsetMinutes: 10, linkedAction: "surgeryStatus:SurgeryStarted", interfaceEvent: "surgery.started", description: "主刀医生开始手术。" },
        { stepCode: "surgery_ended", stepName: "手术结束", phase: "术中", defaultOffsetMinutes: 70, linkedAction: "surgeryStatus:SurgeryEnded", interfaceEvent: "surgery.ended", description: "手术操作结束。" },
        { stepCode: "patient_out_room", stepName: "出室", phase: "术中", defaultOffsetMinutes: 15, linkedAction: "surgeryStatus:OutRoom", interfaceEvent: "surgery.out_room", description: "患者离开手术间。" },
        { stepCode: "room_cleaned", stepName: "清洁完成", phase: "术后", defaultOffsetMinutes: 25, linkedAction: "completeCleaning", interfaceEvent: "or.cleaning_completed", description: "手术间清洁完成，可接下一台。" },
        { stepCode: "postop_medication_dispensed", stepName: "术后配药", phase: "术后", defaultOffsetMinutes: 40, linkedAction: "dispensePostopMedication", interfaceEvent: "pharmacy.postop_medication_dispensed", description: "药房配发术后短程护胃、按需镇痛/止吐药品，感染证据明确时再配发抗菌药。" },
        { stepCode: "postop_care_recorded", stepName: "术后护理", phase: "术后", defaultOffsetMinutes: 120, linkedAction: "performPostopCare", interfaceEvent: "nursing.postop_care_recorded", description: "护士完成生命体征观察、疼痛评估和切口护理。" },
        { stepCode: "postop_progress_recorded", stepName: "术后病程", phase: "术后", defaultOffsetMinutes: 240, linkedAction: "createPostopProgress", interfaceEvent: "journey.postop_progress_recorded", description: "记录术后恢复情况。" },
        { stepCode: "followup_check_completed", stepName: "术后复查", phase: "术后", defaultOffsetMinutes: 720, linkedAction: "completeFollowupCheck", interfaceEvent: "journey.followup_check_completed", description: "完成术后血常规和肝功能复查，确认恢复情况。" },
        { stepCode: "discharge_summary_signed", stepName: "出院小结签署", phase: "出院", defaultOffsetMinutes: 1440, linkedAction: "createDischargeSummary", interfaceEvent: "journey.discharge_summary_signed", description: "完成出院小结。" },
        { stepCode: "patient_discharged", stepName: "出院归档", phase: "出院", defaultOffsetMinutes: 60, linkedAction: "dischargePatient", interfaceEvent: "encounter.discharged", description: "患者出院，床位释放，病历归档。" }
      ]
    }
  ];

  const cholecystectomySteps = journeyTemplates[0].steps;
  const insertJourneyStepAfter = (afterStepCode, step) => {
    const existing = cholecystectomySteps.find((item) => item.stepCode === step.stepCode);
    if (existing) {
      return;
    }
    const index = cholecystectomySteps.findIndex((item) => item.stepCode === afterStepCode);
    cholecystectomySteps.splice(index >= 0 ? index + 1 : cholecystectomySteps.length, 0, step);
  };

  insertJourneyStepAfter("admission_registered", { stepCode: "insurance_eligibility_verified", stepName: "医保身份核验", phase: "入院", defaultOffsetMinutes: 10, linkedAction: "verifyInsuranceEligibility", interfaceEvent: "billing.eligibility_verified", description: "HIS 读取医保电子凭证/身份证，核验参保状态、结算类别和本次住院待遇。" });
  insertJourneyStepAfter("reports_finalized", { stepCode: "preop_risk_assessed", stepName: "术前风险评估", phase: "术前", defaultOffsetMinutes: 20, linkedAction: "completePreopRiskAssessment", interfaceEvent: "risk.preop_assessed", description: "完成 ASA、VTE、跌倒压疮等围术期风险评估。" });
  insertJourneyStepAfter("admission_orders_created", { stepCode: "admission_assessment_completed", stepName: "入院综合评估", phase: "入院", defaultOffsetMinutes: 30, linkedAction: "completeAdmissionAssessment", interfaceEvent: "vitals.admission_assessment_completed", description: "完成入院生命体征、疼痛、营养、安全和首次查房评估。" });
  insertJourneyStepAfter("admission_orders_created", { stepCode: "deposit_paid", stepName: "住院预交金", phase: "入院", defaultOffsetMinutes: 10, linkedAction: "collectAdmissionDeposit", interfaceEvent: "billing.deposit_paid", description: "收费处/自助机完成住院预交金支付，形成收据和账户余额。" });
  insertJourneyStepAfter("admission_assessment_completed", { stepCode: "nutrition_screening_completed", stepName: "营养饮食评估", phase: "入院", defaultOffsetMinutes: 20, linkedAction: "completeNutritionScreening", interfaceEvent: "nutrition.screening_completed", description: "完成 NRS2002 营养风险筛查、低脂饮食宣教和术前禁食水计划。" });
  insertJourneyStepAfter("nutrition_screening_completed", { stepCode: "admission_infusion_executed", stepName: "入院补液执行", phase: "入院", defaultOffsetMinutes: 40, linkedAction: "executeAdmissionInfusion", interfaceEvent: "infusion.admission_executed", description: "护士建立静脉通路并执行入院补液，记录滴速、穿刺点和输液反应。" });
  insertJourneyStepAfter("preop_orders_created", { stepCode: "order_review_completed", stepName: "医嘱审核确认", phase: "术前", defaultOffsetMinutes: 15, linkedAction: "completeOrderReview", interfaceEvent: "order.preop_reviewed", description: "护士站审核术前检验、检查、手术、用药、禁食水、过敏史和医保属性。" });
  insertJourneyStepAfter("order_review_completed", { stepCode: "exam_appointments_booked", stepName: "检查预约登记", phase: "术前", defaultOffsetMinutes: 20, linkedAction: "bookPreopExamAppointments", interfaceEvent: "appointment.exam_booked", description: "RIS/心电系统完成 CT、腹部超声和心电图预约、队列号和检查准备。" });
  insertJourneyStepAfter("specimen_collected", { stepCode: "lab_specimen_tracked", stepName: "标本流转接收", phase: "术前", defaultOffsetMinutes: 20, linkedAction: "completeLabSpecimenTracking", interfaceEvent: "lis.specimen_received", description: "检验标本完成条码流转、物流交接、检验科接收和上机前核收。" });
  insertJourneyStepAfter("reports_finalized", { stepCode: "remote_consultation_completed", stepName: "远程会诊完成", phase: "术前", defaultOffsetMinutes: 30, linkedAction: "completeRemoteConsultation", interfaceEvent: "consult.remote_completed", description: "围绕检验、超声、PACS 影像和麻醉风险完成术前远程会诊意见。" });
  insertJourneyStepAfter("preop_risk_assessed", { stepCode: "informed_consent_signed", stepName: "知情同意签署", phase: "术前", defaultOffsetMinutes: 25, linkedAction: "signConsents", interfaceEvent: "consent.signed", description: "完成手术、麻醉、输血等知情同意归档。" });
  insertJourneyStepAfter("informed_consent_signed", { stepCode: "blood_preparation_completed", stepName: "输血备血复核", phase: "术前", defaultOffsetMinutes: 20, linkedAction: "completeBloodPreparation", interfaceEvent: "blood.preparation_completed", description: "输血科完成标本采集、ABO/Rh 血型复核和抗体筛查；低出血风险胆囊手术不常规交叉配血。" });
  insertJourneyStepAfter("preop_medication_dispensed", { stepCode: "antimicrobial_review_completed", stepName: "抗菌药审核", phase: "术前", defaultOffsetMinutes: 10, linkedAction: "completeAntimicrobialReview", interfaceEvent: "antibiotic.review_completed", description: "药学部完成围术期预防性抗菌药物适宜性审核和停药建议。" });
  insertJourneyStepAfter("antimicrobial_review_completed", { stepCode: "medication_safety_checked", stepName: "皮试过敏核查", phase: "术前", defaultOffsetMinutes: 15, linkedAction: "completeMedicationSafetyCheck", interfaceEvent: "allergy.skin_test_completed", description: "护士完成术前抗菌药皮试/过敏史核查，青霉素过敏患者自动替换备用抗菌药。" });
  insertJourneyStepAfter("medication_safety_checked", { stepCode: "preop_medication_scan_verified", stepName: "用药扫码核对", phase: "术前", defaultOffsetMinutes: 5, linkedAction: "verifyPreopMedicationScan", interfaceEvent: "scan.preop_medication_verified", description: "PDA 扫码核对腕带、医嘱、药品、剂量、给药途径、过敏史和执行时间。" });
  insertJourneyStepAfter("preop_medication_administered", { stepCode: "preop_preparation_completed", stepName: "术前准备完成", phase: "术前", defaultOffsetMinutes: 20, linkedAction: "completePreopPreparation", interfaceEvent: "preop.preparation_completed", description: "完成皮肤准备、手术部位标识、禁食水、随身物品和转运前生命体征核对。" });
  insertJourneyStepAfter("patient_called", { stepCode: "family_waiting_notified", stepName: "家属等候通知", phase: "术中", defaultOffsetMinutes: 2, linkedAction: "notifyFamilyWaiting", interfaceEvent: "family.waiting_notified", description: "向手术等候区/短信同步患者进入接台流程。" });
  insertJourneyStepAfter("patient_called", { stepCode: "patient_transferred_to_or", stepName: "术前转运交接", phase: "术中", defaultOffsetMinutes: 8, linkedAction: "transferToOR", interfaceEvent: "transport.to_or", description: "病区护士与手术部护士完成患者转运和资料交接。" });
  insertJourneyStepAfter("patient_in_room", { stepCode: "surgical_safety_checked", stepName: "手术安全核查", phase: "术中", defaultOffsetMinutes: 5, linkedAction: "completeSurgicalSafetyChecklist", interfaceEvent: "safety.checklist_completed", description: "手术医师、麻醉医师、巡回护士完成患者身份、术式、部位、同意书和影像资料核查。" });
  insertJourneyStepAfter("anesthesia_started", { stepCode: "anesthesia_record_started", stepName: "麻醉记录开始", phase: "术中", defaultOffsetMinutes: 5, linkedAction: "startAnesthesiaRecord", interfaceEvent: "anesthesia.record_started", description: "麻醉医生记录诱导用药、气道、生命体征和液体出入量。" });
  insertJourneyStepAfter("surgery_started", { stepCode: "surgery_media_teaching_started", stepName: "视频示教开始", phase: "术中", defaultOffsetMinutes: 2, linkedAction: "startSurgeryMediaTeaching", interfaceEvent: "media.recording_started", description: "数字化手术室开始录制手术视频并开启示教直播，家属端同步手术开始状态。" });
  insertJourneyStepAfter("surgery_started", { stepCode: "instrument_count_verified", stepName: "器械敷料清点", phase: "术中", defaultOffsetMinutes: 55, linkedAction: "completeInstrumentCount", interfaceEvent: "instrument.count_verified", description: "巡回护士与器械护士完成器械、敷料、缝针和耗材清点。" });
  insertJourneyStepAfter("instrument_count_verified", { stepCode: "or_consumables_traced", stepName: "耗材追溯记账", phase: "术中", defaultOffsetMinutes: 8, linkedAction: "traceOrConsumables", interfaceEvent: "consumable.usage_traced", description: "记录 Trocar、钛夹、标本袋等术中耗材条码、批号、数量并完成费用关联。" });
  insertJourneyStepAfter("surgery_ended", { stepCode: "surgical_specimen_sent", stepName: "术中标本送检", phase: "术中", defaultOffsetMinutes: 5, linkedAction: "sendSurgicalSpecimen", interfaceEvent: "pathology.specimen_sent", description: "术中标本固定、贴签、送病理科并完成接收；乳腺肿瘤病例同步标本方向标记和免疫组化项目。" });
  insertJourneyStepAfter("surgical_specimen_sent", { stepCode: "operation_record_signed", stepName: "手术记录签署", phase: "术中", defaultOffsetMinutes: 10, linkedAction: "signOperationRecord", interfaceEvent: "journey.operation_record_signed", description: "主刀医生完成手术经过、术中所见、出血量、并发症和标本情况记录。" });
  insertJourneyStepAfter("operation_record_signed", { stepCode: "surgery_media_archived", stepName: "视频归档示教结束", phase: "术中", defaultOffsetMinutes: 5, linkedAction: "archiveSurgeryMediaTeaching", interfaceEvent: "media.recording_archived", description: "手术视频完成脱敏归档，示教直播结束并生成回放地址，家属端同步手术结束状态。" });
  insertJourneyStepAfter("patient_out_room", { stepCode: "pacu_recovery_recorded", stepName: "PACU复苏记录", phase: "术后", defaultOffsetMinutes: 45, linkedAction: "recordPacuRecovery", interfaceEvent: "pacu.recovery_recorded", description: "患者进入麻醉恢复室，记录复苏评分、生命体征、疼痛评分并完成回病区交接。" });
  insertJourneyStepAfter("pacu_recovery_recorded", { stepCode: "ward_handover_completed", stepName: "回病区交接", phase: "术后", defaultOffsetMinutes: 10, linkedAction: "completeWardHandover", interfaceEvent: "handover.ward_completed", description: "PACU护士与病区责任护士完成床旁交接，确认切口、用药、疼痛和风险提示。" });
  insertJourneyStepAfter("pacu_recovery_recorded", { stepCode: "postop_pain_assessed", stepName: "术后疼痛评估", phase: "术后", defaultOffsetMinutes: 20, linkedAction: "assessPostopPain", interfaceEvent: "pain.postop_assessed", description: "护士完成术后回病区疼痛评分、干预和复评记录。" });
  insertJourneyStepAfter("room_cleaned", { stepCode: "postop_orders_created", stepName: "术后医嘱开立", phase: "术后", defaultOffsetMinutes: 15, linkedAction: "createPostopOrders", interfaceEvent: "journey.postop_orders_created", description: "开立术后饮食、生命体征、镇痛和必要用药医嘱并记账。" });
  insertJourneyStepAfter("postop_orders_created", { stepCode: "postop_diet_advanced", stepName: "术后饮食推进", phase: "术后", defaultOffsetMinutes: 45, linkedAction: "advancePostopDiet", interfaceEvent: "nutrition.postop_diet_advanced", description: "评估清醒、恶心呕吐和腹部情况后，按路径推进饮水、流质、低脂半流质饮食。" });
  insertJourneyStepAfter("postop_medication_dispensed", { stepCode: "postop_medication_administered", stepName: "术后用药执行", phase: "术后", defaultOffsetMinutes: 30, linkedAction: "administerPostopMedication", interfaceEvent: "mar.postop_medication_administered", description: "护士执行术后护胃用药，核对镇痛和止吐备用药并记录首次术后生命体征。" });
  insertJourneyStepAfter("postop_medication_administered", { stepCode: "postop_adverse_observed", stepName: "不良反应观察", phase: "术后", defaultOffsetMinutes: 30, linkedAction: "observePostopAdverseEvents", interfaceEvent: "observation.postop_completed", description: "观察术后恶心呕吐、发热、出血、黄疸和腹部体征等不良反应。" });
  insertJourneyStepAfter("postop_care_recorded", { stepCode: "postop_ward_round_completed", stepName: "术后医生查房", phase: "术后", defaultOffsetMinutes: 90, linkedAction: "completePostopWardRound", interfaceEvent: "round.postop_completed", description: "主管医生完成术后首次查房，评估疼痛、切口、饮食、活动和后续治疗计划。" });
  insertJourneyStepAfter("postop_ward_round_completed", { stepCode: "vte_prophylaxis_completed", stepName: "VTE预防执行", phase: "术后", defaultOffsetMinutes: 60, linkedAction: "completeVteProphylaxis", interfaceEvent: "vte.prophylaxis_completed", description: "按 Caprini 评分执行早期活动、踝泵运动、弹力袜/气压泵等 VTE 预防措施。" });
  insertJourneyStepAfter("vte_prophylaxis_completed", { stepCode: "early_ambulation_completed", stepName: "早期下床活动", phase: "术后", defaultOffsetMinutes: 90, linkedAction: "completeEarlyAmbulation", interfaceEvent: "rehab.early_ambulation_completed", description: "护士协助患者床旁站立和病区步行，记录活动距离、耐受和跌倒风险。" });
  insertJourneyStepAfter("postop_ward_round_completed", { stepCode: "wound_care_completed", stepName: "切口换药", phase: "术后", defaultOffsetMinutes: 180, linkedAction: "completeWoundCare", interfaceEvent: "wound.care_completed", description: "护士完成术后切口观察、消毒换药、感染征象记录和护理收费。" });
  insertJourneyStepAfter("postop_progress_recorded", { stepCode: "pathology_report_finalized", stepName: "术后病理回报", phase: "术后", defaultOffsetMinutes: 600, linkedAction: "finalizePathologyReport", interfaceEvent: "pathology.report_finalized", description: "病理科审核术后病理并回传 EMR；乳腺癌病例同步 ER/PR/HER2/Ki-67 等免疫组化信息。" });
  insertJourneyStepAfter("followup_check_completed", { stepCode: "daily_billing_statement_generated", stepName: "费用日清单确认", phase: "出院", defaultOffsetMinutes: 20, linkedAction: "generateDailyBillingStatement", interfaceEvent: "billing.daily_statement_generated", description: "生成住院费用日清单，按诊疗、药品、护理、耗材等分类汇总并推送患者端确认。" });
  insertJourneyStepAfter("daily_billing_statement_generated", { stepCode: "insurance_pre_settled", stepName: "医保预结算", phase: "出院", defaultOffsetMinutes: 30, linkedAction: "createInsurancePreSettlement", interfaceEvent: "billing.pre_settled", description: "出院前生成医保预结算和费用自付估算。" });
  insertJourneyStepAfter("insurance_pre_settled", { stepCode: "discharge_medication_prepared", stepName: "出院带药准备", phase: "出院", defaultOffsetMinutes: 60, linkedAction: "prepareDischargeMedications", interfaceEvent: "pharmacy.discharge_medication_prepared", description: "药房准备出院带药并生成用药指导。" });
  insertJourneyStepAfter("discharge_medication_prepared", { stepCode: "discharge_medication_counseled", stepName: "出院用药指导", phase: "出院", defaultOffsetMinutes: 20, linkedAction: "completeDischargeMedicationCounseling", interfaceEvent: "pharmacy.discharge_medication_counseled", description: "药师完成出院带药用法用量、不良反应、复述确认和交付记录。" });
  insertJourneyStepAfter("discharge_medication_counseled", { stepCode: "discharge_readiness_assessed", stepName: "出院准备评估", phase: "出院", defaultOffsetMinutes: 30, linkedAction: "assessDischargeReadiness", interfaceEvent: "discharge.readiness_assessed", description: "完成出院前生命体征、切口、疼痛、活动、饮食、宣教和复诊准备评估。" });
  insertJourneyStepAfter("discharge_readiness_assessed", { stepCode: "discharge_education_signed", stepName: "出院宣教签收", phase: "出院", defaultOffsetMinutes: 15, linkedAction: "signDischargeEducation", interfaceEvent: "education.discharge_signed", description: "患者及家属签收切口护理、饮食活动、带药、复诊和异常症状处理宣教。" });
  insertJourneyStepAfter("discharge_summary_signed", { stepCode: "medical_record_homepage_completed", stepName: "病案首页质控", phase: "出院", defaultOffsetMinutes: 45, linkedAction: "createMedicalRecordHomePage", interfaceEvent: "mr.homepage_completed", description: "完成病案首页编码、DRG 分组和出院病案质控。" });
  insertJourneyStepAfter("patient_discharged", { stepCode: "insurance_settled", stepName: "出院医保结算", phase: "出院", defaultOffsetMinutes: 10, linkedAction: "completeInsuranceSettlement", interfaceEvent: "billing.settled", description: "完成出院费用清单确认和医保结算。" });
  insertJourneyStepAfter("insurance_settled", { stepCode: "invoice_issued", stepName: "电子票据生成", phase: "出院", defaultOffsetMinutes: 5, linkedAction: "issueDischargeInvoice", interfaceEvent: "invoice.issued", description: "生成医疗电子票据和患者端下载地址。" });
  insertJourneyStepAfter("invoice_issued", { stepCode: "followup_scheduled", stepName: "出院随访预约", phase: "出院", defaultOffsetMinutes: 20, linkedAction: "scheduleFollowUp", interfaceEvent: "followup.scheduled", description: "预约出院后一周门诊复诊并完成出院宣教。" });
  insertJourneyStepAfter("followup_scheduled", { stepCode: "followup_outcome_recorded", stepName: "随访结果记录", phase: "出院后", defaultOffsetMinutes: 7 * 24 * 60, linkedAction: "recordFollowUpOutcome", interfaceEvent: "followup.outcome_recorded", description: "完成电话随访，记录切口愈合、饮食恢复、用药依从性和警示症状。" });
  insertJourneyStepAfter("followup_outcome_recorded", { stepCode: "infection_surveillance_completed", stepName: "院感切口监测", phase: "出院后", defaultOffsetMinutes: 30, linkedAction: "completeInfectionSurveillance", interfaceEvent: "ssi.surveillance_completed", description: "院感护士完成手术部位感染随访监测和抗菌药时机核查。" });
  insertJourneyStepAfter("infection_surveillance_completed", { stepCode: "satisfaction_survey_submitted", stepName: "满意度反馈", phase: "出院后", defaultOffsetMinutes: 20, linkedAction: "collectSatisfactionSurvey", interfaceEvent: "survey.satisfaction_submitted", description: "患者端提交入院、护理、手术沟通、出院指导和信息化体验满意度。" });

  const patientJourneys = [
    {
      journeyId: "JNY000001",
      templateId: "TPL_CHOLECYSTECTOMY_INPATIENT",
      patientId: "PAT000001",
      encounterId: "ENC000001",
      surgeryScheduleId: "SCH000001",
      status: "ready",
      currentStepIndex: -1,
      startedTime: null,
      updatedTime: null,
      finishedTime: null,
      simulatedTime: "2026-05-15T08:20:00+08:00",
      summary: "胆囊结石患者择期住院手术全流程"
    }
  ];

  const journeyEvents = [];
  const clinicalTasks = [];
  const medicationDispenses = [];
  const nursingRecords = [];
  const consents = [];
  const riskAssessments = [];
  const transportEvents = [];
  const billingItems = [];
  const dischargeMedications = [];
  const followUps = [];
  const labCriticalValues = [];
  const surgicalSpecimens = [];
  const pathologyReports = [];
  const insuranceSettlements = [];
  const surgicalSafetyChecklists = [];
  const anesthesiaRecords = [];
  const instrumentCounts = [];
  const pacuRecords = [];
  const vitalSignRecords = [];
  const medicationAdministrations = [];
  const preopPreparations = [];
  const wardRounds = [];
  const dischargeAssessments = [];
  const labSpecimenTracks = [];
  const infusionRecords = [];
  const painAssessments = [];
  const woundCareRecords = [];
  const medicalRecordHomePages = [];
  const recordQualityChecks = [];
  const familyNotifications = [];
  const antimicrobialReviews = [];
  const orConsumableUsages = [];
  const surgeryMediaRecords = [];
  const dietaryPlans = [];
  const mobilityRehabRecords = [];
  const vteProphylaxisRecords = [];
  const nursingHandovers = [];
  const postopObservationRecords = [];
  const medicationCounselingRecords = [];
  const dischargeEducationRecords = [];
  const invoiceRecords = [];
  const followUpOutcomeRecords = [];
  const infectionSurveillanceRecords = [];
  const satisfactionSurveys = [];
  const orderReviewRecords = [];
  const examAppointments = [];
  const bloodPreparationRecords = [];
  const medicationSafetyChecks = [];
  const identityVerificationRecords = [];
  const insuranceEligibilityRecords = [];
  const depositPayments = [];
  const dailyBillingStatements = [];

  return {
    orgs,
    departments,
    wards,
    beds,
    operatingRooms,
    practitioners,
    patients,
    encounters,
    admissions,
    diagnoses,
    orders,
    surgeryRequests,
    surgerySchedules,
    surgeryStaffAssignments,
    surgeryEvents,
    documents,
    labReports,
    examReports,
    ultrasoundReports,
    ecgReports,
    imagingStudies,
    consultations,
    teachingSessions,
    deviceTerminals,
    mediaSources,
    interfaceChannels,
    interfaceMessages: [],
    scenarios,
    scenarioRuns: [],
    journeyTemplates,
    patientJourneys,
    journeyEvents,
    clinicalTasks,
    medicationDispenses,
    nursingRecords,
    consents,
    riskAssessments,
    transportEvents,
    billingItems,
    dischargeMedications,
    followUps,
    labCriticalValues,
    surgicalSpecimens,
    pathologyReports,
    insuranceSettlements,
    surgicalSafetyChecklists,
    anesthesiaRecords,
    instrumentCounts,
    pacuRecords,
    vitalSignRecords,
    medicationAdministrations,
    preopPreparations,
    wardRounds,
    dischargeAssessments,
    labSpecimenTracks,
    infusionRecords,
    painAssessments,
    woundCareRecords,
    medicalRecordHomePages,
    recordQualityChecks,
    familyNotifications,
    antimicrobialReviews,
    orConsumableUsages,
    surgeryMediaRecords,
    dietaryPlans,
    mobilityRehabRecords,
    vteProphylaxisRecords,
    nursingHandovers,
    postopObservationRecords,
    medicationCounselingRecords,
    dischargeEducationRecords,
    invoiceRecords,
    followUpOutcomeRecords,
    infectionSurveillanceRecords,
    satisfactionSurveys,
    orderReviewRecords,
    examAppointments,
    bloodPreparationRecords,
    medicationSafetyChecks,
    identityVerificationRecords,
    insuranceEligibilityRecords,
    depositPayments,
    dailyBillingStatements,
    counters: {
      PAT: 3,
      ENC: 3,
      ADM: 3,
      DIA: 3,
      ORD: 6,
      SR: 2,
      SCH: 2,
      SSA: 6,
      EVT: 3,
      DOC: 4,
      LABR: 1,
      EXR: 1,
      US: 1,
      ECG: 1,
      IMG: 2,
      CON: 1,
      TEA: 1,
      DEV: 7,
      MSG: 0,
      RUN: 0,
      JNY: 1,
      JEV: 0,
      TASK: 0,
      MED: 0,
      NUR: 0,
      CNS: 0,
      RSK: 0,
      TRN: 0,
      BIL: 0,
      DMED: 0,
      FUP: 0,
      CRIT: 0,
      SPM: 0,
      PATH: 0,
      SET: 0,
      SAFE: 0,
      ANR: 0,
      CNT: 0,
      PACU: 0,
      VSR: 0,
      MAR: 0,
      PREP: 0,
      WRD: 0,
      DRA: 0,
      LST: 0,
      INF: 0,
      PAIN: 0,
      WND: 0,
      MHP: 0,
      QCK: 0,
      FAM: 0,
      ABX: 0,
      OCU: 0,
      SMR: 0,
      DIET: 0,
      MOB: 0,
      VTE: 0,
      HOV: 0,
      OBS: 0,
      COUN: 0,
      DED: 0,
      INV: 0,
      FOUT: 0,
      SSI: 0,
      SAT: 0,
      ORV: 0,
      APP: 0,
      BLD: 0,
      MSC: 0,
      IDV: 0,
      ELG: 0,
      DEP: 0,
      DBS: 0,
      BED: 4
    }
  };
}

export function resetState(targetState) {
  const fresh = createSeedState();
  for (const key of Object.keys(targetState)) {
    delete targetState[key];
  }
  Object.assign(targetState, fresh);
  return targetState;
}
