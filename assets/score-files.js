/* Excel score exchange. The workbook library loads only when the teacher uses this tool. */
(() => {
    'use strict';
    const normalize = value => String(value ?? '').normalize('NFKC').trim().toLocaleLowerCase('th').replace(/[\s._\-]+/g, '');
    const aliases = {
        id:['รหัสนักเรียน','รหัสนักเรียน(5หลัก)','รหัสประจำตัว','รหัสประจำตัวนักเรียน','studentid','studentcode','id'],
        room:['ห้อง','ห้องเรียน','ชั้น/ห้อง','class','classname'],
        number:['ที่','เลขที่','ลำดับ','no','number'], name:['ชื่อ','ชื่อ-สกุล','ชื่อ-นามสกุล','ชื่อสกุล','ชื่อนักเรียน','ชื่อและนามสกุล','คำนำหน้า','นามสกุล','name','studentname'],
        attendance:['จิตพิสัย','คะแนนจิตพิสัย','attendance'], midterm:['กลางภาค','คะแนนกลางภาค','midterm'],
        final:['ปลายภาค','คะแนนปลายภาค','final'], bonus:['พิเศษ','คะแนนพิเศษ','คะแนนพิเศษจากครู','bonus'],
        ignore:['คะแนนเก็บ','คะแนนเก็บ(รวมจริง)','รวม','รวมคะแนน','คะแนนรวม','เกรด','ผลการเรียน','หมายเหตุ','note','total','totalscore','grade']
    };
    const limits = {attendance:10, midterm:20, final:20, bonus:Number.MAX_SAFE_INTEGER};
    const blank = value => value === null || value === undefined || String(value).trim() === '';
    function header(value) {
        const text = String(value ?? '').trim();
        const suffix = text.match(/\(\s*(?:คะแนนเต็ม|เต็ม|คะแนน)?\s*(\d+(?:\.\d+)?)\s*(?:คะแนน)?\s*\)\s*$/u);
        const name = suffix ? text.slice(0,suffix.index).trim() : text;
        const full = normalize(text), base = normalize(name);
        const kind = Object.keys(aliases).find(key => aliases[key].some(alias => normalize(alias) === full || normalize(alias) === base));
        return {name, key:base, kind:kind || 'task', max:suffix ? Number(suffix[1]) : null};
    }
    function studentCode(value) {
        const text = typeof value === 'number' && Number.isInteger(value) ? String(value).padStart(5,'0') : String(value ?? '').trim();
        if (!/^\d{5}$/.test(text)) throw new Error('รหัสนักเรียนต้องเป็นตัวเลข 5 หลัก: ' + text);
        return text;
    }
    function score(value, max, task) {
        if (blank(value)) return {skip:true};
        const text = normalize(value);
        if (String(value).trim()==='-' || ['ยังไม่ส่ง','ไม่ได้ส่ง','missing'].includes(text)) return {value:null};
        if (['รอตรวจ','ส่งแล้ว','ส่งแล้วรอตรวจ','submitted','pending'].includes(text)) {
            if (!task) throw new Error('สถานะรอตรวจใช้ได้เฉพาะช่องชิ้นงาน');
            return {value:'submitted'};
        }
        if (typeof value === 'boolean' || !/^(?:\d+(?:\.\d*)?|\.\d+)$/.test(String(value).trim())) throw new Error('คะแนนไม่ใช่ตัวเลขหรือสถานะที่รองรับ: ' + value);
        const number = Number(value);
        if (!Number.isFinite(number) || number < 0 || number > max) throw new Error('คะแนน ' + value + ' เกินช่วง 0–' + max);
        return {value:number};
    }
    function parseCSV(text) {
        text = text.replace(/^\uFEFF/, '');
        const counts = new Map([['\t',0],[';',0],[',',0]]);
        let inQuote=false, lines=0;
        for(let i=0;i<text.length && lines<20;i++) {
            if(text[i]==='"') {if(inQuote&&text[i+1]==='"')i++;else inQuote=!inQuote;}
            else if(!inQuote) {if(counts.has(text[i]))counts.set(text[i],counts.get(text[i])+1);if(text[i]==='\n')lines++;}
        }
        const delimiter = [',','\t',';'].sort((a,b)=>counts.get(b)-counts.get(a))[0];
        const rows=[]; let row=[], cell='', quoted=false;
        for(let i=0;i<text.length;i++) {
            const ch=text[i];
            if(ch==='"') { if(quoted && text[i+1]==='"'){cell+='"';i++;} else quoted=!quoted; }
            else if(!quoted && ch===delimiter){row.push(cell);cell='';}
            else if(!quoted && (ch==='\n'||ch==='\r')){if(ch==='\r'&&text[i+1]==='\n')i++;row.push(cell);rows.push(row);row=[];cell='';}
            else cell+=ch;
        }
        if(quoted)throw new Error('ไฟล์ CSV มีเครื่องหมายคำพูดไม่ครบ');
        if(cell||row.length){row.push(cell);rows.push(row);}
        return rows;
    }
    function planImport(data, tables, defaultClassId) {
        const byId=new Map(data.classes.map(cls=>[cls.id,cls]));
        const classes=new Map(), updates=[], newTasks=[], errors=[], cells=new Set(), changedStudents=new Set();
        let recognized=0, defaultRoomRows=0;
        const error = text => {if(errors.length<30)errors.push(text);};
        for(const table of tables) {
            const at=table.rows.slice(0,20).findIndex(row=>row.some(value=>header(value).kind==='id'));
            if(at<0)continue;
            recognized++;
            const columns=Array.from(table.rows[at],header), idColumns=columns.map((c,i)=>c.kind==='id'?i:-1).filter(i=>i>=0);
            if(idColumns.length!==1){error(table.name+': ต้องมีคอลัมน์รหัสนักเรียนเพียงหนึ่งคอลัมน์');continue;}
            const seen=new Set();
            for(const col of columns.filter(c=>c.name && !['ignore','number','name'].includes(c.kind))) {
                const key=col.kind==='task'?'task:'+col.key:col.kind;
                if(seen.has(key))error(table.name+': หัวคอลัมน์ซ้ำ '+col.name);seen.add(key);
            }
            const roomIndex=columns.findIndex(c=>c.kind==='room');
            for(let rowIndex=at+1;rowIndex<table.rows.length;rowIndex++) {
                const row=table.rows[rowIndex];if(row.every(blank))continue;
                const where=table.name+' แถว '+(rowIndex+1);
                try {
                    if(row.length>columns.length && row.slice(columns.length).some(v=>!blank(v)))throw new Error('มีคะแนนในคอลัมน์ที่ไม่มีหัวตาราง');
                    let cls;
                    if(roomIndex>=0) {
                        const roomName=normalize(row[roomIndex]);
                        const matches=data.classes.filter(c=>normalize(c.name)===roomName);
                        if(matches.length!==1)throw new Error('ไม่พบห้องเรียนที่ตรงกันเพียงห้องเดียว: '+String(row[roomIndex]??''));
                        cls=matches[0];
                    } else {cls=byId.get(defaultClassId);defaultRoomRows++;}
                    if(!cls)throw new Error('กรุณาเลือกห้องเรียนก่อนนำเข้า');
                    const code=studentCode(row[idColumns[0]]);
                    const students=cls.students.filter(s=>s.studentId===code);
                    if(students.length!==1)throw new Error('ไม่พบรหัส '+code+' เพียงหนึ่งคนในห้อง '+cls.name+' กรุณาตรวจหรือเพิ่มรายชื่อก่อน');
                    const student=students[0];
                    if(!classes.has(cls.id))classes.set(cls.id,{id:cls.id,name:cls.name,taskNames:new Map(),updates:0,students:new Set()});
                    const context=classes.get(cls.id);
                    for(let colIndex=0;colIndex<columns.length;colIndex++) {
                        const col=columns[colIndex], value=row[colIndex];
                        if(['id','room','number','name','ignore'].includes(col.kind))continue;
                        if(!col.name){if(!blank(value))throw new Error('คะแนนในช่องไม่มีชื่อชิ้นงาน');continue;}
                        let task=null, max=limits[col.kind];
                        if(col.kind!=='task' && col.max!==null && col.max!==max)throw new Error('คะแนนเต็ม '+col.name+' ต้องเป็น '+max);
                        if(col.kind==='task') {
                            const matches=cls.assignments.filter(a=>normalize(a.name)===col.key);
                            if(matches.length>1)throw new Error('ชื่อชิ้นงานในเว็บซ้ำกัน: '+col.name);
                            task=matches[0] || context.taskNames.get(col.key);
                            if(task && col.max!==null && col.max!==Number(task.maxScore))throw new Error('คะแนนเต็ม '+col.name+' ไม่ตรงกับเว็บ ('+task.maxScore+')');
                            if(!task) {
                                if(col.max===null || col.max<=0 || col.max>100)throw new Error('งานใหม่ต้องระบุคะแนนเต็ม เช่น '+col.name+' (เต็ม 10)');
                                task={name:col.name,maxScore:col.max,newKey:cls.id+'\u0000'+col.key};
                                context.taskNames.set(col.key,task);newTasks.push({classId:cls.id,...task});
                            }
                            max=Number(task.maxScore);
                        }
                        if(blank(value))continue;
                        const parsed=score(value,max,!!task);
                        if(parsed.skip)continue;
                        const field=task ? 'task:'+(task.id||task.newKey) : 'fixed:'+col.kind;
                        const cellKey=cls.id+'\u0000'+student.id+'\u0000'+field;
                        if(cells.has(cellKey))throw new Error('คะแนนคนเดียวกันและช่องเดียวกันซ้ำในไฟล์: '+code+' / '+col.name);
                        cells.add(cellKey);
                        const previous=task ? student.scores?.[task.id] : student[col.kind];
                        if((previous===undefined||previous==='') && parsed.value===null || previous===parsed.value)continue;
                        updates.push({classId:cls.id,studentId:student.id,taskId:task?.id,newKey:task?.newKey,field:task?null:col.kind,value:parsed.value});
                        context.updates++;context.students.add(student.id);changedStudents.add(cls.id+'\u0000'+student.id);
                    }
                }catch(e){error(where+': '+e.message);}
            }
        }
        if(!recognized)error('ไม่พบหัวตารางรหัสนักเรียน ใช้แม่แบบ Excel ของเว็บ หรือไฟล์ที่มีหัวคอลัมน์รหัสนักเรียนและชื่อชิ้นงาน');
        return {updates,newTasks,errors,rooms:[...classes.values()].map(c=>({name:c.name,updates:c.updates,students:c.students.size})),studentCount:changedStudents.size,defaultRoomRows};
    }
    function applyPlan(data, plan, makeId) {
        if(plan.errors.length)throw new Error('ไฟล์มีข้อผิดพลาด จึงยังไม่นำเข้าคะแนน');
        const next=JSON.parse(JSON.stringify(data)), ids=new Map();
        for(const task of plan.newTasks) {
            const id=makeId();ids.set(task.newKey,id);
            next.classes.find(c=>c.id===task.classId).assignments.push({id,name:task.name,maxScore:task.maxScore});
        }
        for(const update of plan.updates) {
            const student=next.classes.find(c=>c.id===update.classId).students.find(s=>s.id===update.studentId);
            if(update.field)student[update.field]=update.value;
            else {student.scores=student.scores||{};student.scores[update.taskId||ids.get(update.newKey)]=update.value;}
        }
        return next;
    }
    async function library() {
        await loadOptionalScript('score-excel','assets/vendor/exceljs-4.4.0.min.js',()=>!!window.ExcelJS);
        return window.ExcelJS;
    }
    function cellValue(cell) {
        if(!cell)return null;
        if(cell.f && (cell.v===undefined||cell.v===null))throw new Error('สูตร Excel ไม่มีผลคำนวณ กรุณาเปิดและบันทึกไฟล์ใน Excel ก่อนนำเข้า');
        if(cell.t==='e')throw new Error('พบข้อผิดพลาดสูตร Excel: '+(cell.w||cell.v));
        if(cell.t==='d')throw new Error('ช่องคะแนนต้องเป็นตัวเลข ไม่ใช่วันที่');
        return cell.v??null;
    }
    async function readTables(file) {
        if(file.size>5*1024*1024)throw new Error('ไฟล์ใหญ่เกิน 5 MB กรุณาแยกไฟล์เป็นรายห้อง');
        if(/\.csv$/i.test(file.name))return [{name:file.name,rows:parseCSV(await file.text())}];
        if(!/\.xlsx$/i.test(file.name))throw new Error('รองรับ .xlsx และ .csv กรุณาบันทึกไฟล์ .xls เป็น .xlsx ก่อน');
        await loadOptionalScript('score-excel-reader','assets/vendor/sheetjs-0.20.3.mini.min.js',()=>!!window.XLSX);
        const XLSX=window.XLSX, workbook=XLSX.read(await file.arrayBuffer(),{type:'array',cellDates:true,cellHTML:false,sheetRows:5001});
        return workbook.SheetNames.filter((name,index)=>!workbook.Workbook?.Sheets?.[index]?.Hidden).map(name=>{
            const sheet=workbook.Sheets[name];
            const range=XLSX.utils.decode_range(sheet['!fullref']||sheet['!ref']||'A1');
            if(range.e.r>=5000||range.e.c>=250)throw new Error('ตารางใหญ่เกินขนาดที่รองรับ กรุณาแยกไฟล์');
            const raw=[];for(let r=0;r<=range.e.r;r++)raw.push(Array.from({length:range.e.c+1},(_,c)=>sheet[XLSX.utils.encode_cell({r,c})]));
            const headerRow=raw.slice(0,20).findIndex(row=>row.some(cell=>typeof cell?.v==='string'&&header(cell.v).kind==='id'));
            // Worksheets without score headers can contain unrelated notes or formulas.
            if(headerRow<0)return {name,rows:[]};
            const ignored=new Set(raw[headerRow].map((cell,index)=>header(cell?.v).kind==='ignore'?index:-1).filter(index=>index>=0));
            // Derived totals/grades are recalculated by the app, never imported as score inputs.
            // Excel may omit their cached zero results; those cells must not reject an otherwise valid file.
            const rows=raw.map((row,index)=>Array.from(row,(value,column)=>index>headerRow&&ignored.has(column)?null:cellValue(value)));
            return {name,rows};
        });
    }
    function ensureTeacher(importing=false) {
        if(!adminAuthenticated || !teacherSessionToken)throw new Error('กรุณาเข้าระบบครูก่อน');
        if(!cloudLoadedAt)throw new Error('กรุณารอข้อมูลห้องเรียนจาก Sheet ก่อน');
        if(importing && (hasUnsavedCloudChanges||pendingScoreSaves||scoreSaveWorkerRunning))throw new Error('มีคะแนนที่ยังรอยืนยันการบันทึก กรุณารอหรือแก้รายการค้างก่อนนำเข้า');
        const cls=getActiveAdminClass();if(!cls)throw new Error('กรุณาเลือกห้องเรียนก่อน');return cls;
    }
    function feedback(text,error=false) {
        const status=document.getElementById('score-files-status');status.textContent=text;status.dataset.state=error?'error':'info';
    }
    async function download(template) {
        const buttons=[...document.querySelectorAll('#score-files-dialog button[data-export]')];
        buttons.forEach(b=>b.disabled=true);feedback('กำลังสร้างไฟล์ Excel…');
        try {
            const cls=JSON.parse(JSON.stringify(ensureTeacher())), ExcelJS=await library();
            const workbook=new ExcelJS.Workbook();workbook.creator='HONGSON EDUTRACK';
            workbook.calcProperties.fullCalcOnLoad=true;
            const sheet=workbook.addWorksheet('คะแนน',{views:[{state:'frozen',xSplit:4,ySplit:1,showGridLines:true}]});
            const columns=[{name:'ห้อง',width:12},{name:'เลขที่',width:8},{name:'รหัสนักเรียน',width:15},{name:'ชื่อ-สกุล',width:30},
                ...cls.assignments.map(a=>({name:a.name+' (เต็ม '+a.maxScore+')',width:18})),
                {name:'จิตพิสัย (เต็ม 10)',width:18},{name:'กลางภาค (เต็ม 20)',width:18},{name:'ปลายภาค (เต็ม 20)',width:18},{name:'คะแนนพิเศษจากครู',width:20},
                {name:'คะแนนเก็บ(รวมจริง)',width:20},{name:'รวม(100)',width:12},{name:'เกรด',width:9}];
            sheet.columns=columns.map(c=>({width:c.width}));
            // A regular worksheet for offline editing: headers first, one student per row.
            const headings=sheet.getRow(1);headings.values=columns.map(c=>c.name);headings.height=32;
            headings.font={name:'Tahoma',size:11,bold:true,color:{argb:'FF000000'}};
            headings.fill={type:'pattern',pattern:'solid',fgColor:{argb:'FFF2F2F2'}};
            headings.alignment={vertical:'middle',horizontal:'center',wrapText:true};
            // Keep the score block numeric for copying into other grading software.
            // Empty cells skip updates on re-import, so existing missing/submitted states stay intact.
            const exported=value=>{
                if(value===undefined||value===null||value===''||value==='submitted')return null;
                const number=Number(value);return Number.isFinite(number)?number:null;
            };
            [...cls.students].sort((a,b)=>Number(a.no)-Number(b.no)).forEach(student=>{
                const row=sheet.addRow([cls.name,student.no,String(student.studentId),student.name,
                    ...cls.assignments.map(a=>template?null:exported(student.scores?.[a.id])),
                    ...['attendance','midterm','final','bonus'].map(key=>template?null:exported(student[key])),null,null,null]);
                const tasksEnd=4+cls.assignments.length, fixed=tasksEnd+1, sum=tasksEnd+5, total=sum+1, grade=sum+2;
                const address=column=>sheet.getCell(row.number,column).address;
                const stats=template?{assignRawSum:0,total:0,grade:'0'}:calculateStudentScore(student,cls.assignments);
                row.getCell(sum).value={formula:cls.assignments.length?'SUM('+address(5)+':'+address(tasksEnd)+')':'0',result:stats.assignRawSum};
                row.getCell(total).value={formula:'ROUND(MIN(100,'+address(sum)+'+MIN(10,SUM('+address(fixed)+'))+MIN(20,SUM('+address(fixed+1)+'))+MIN(20,SUM('+address(fixed+2)+'))+SUM('+address(fixed+3)+')),1)',result:stats.total};
                const t=address(total);
                row.getCell(grade).value={formula:'IF('+t+'>=80,4,IF('+t+'>=75,3.5,IF('+t+'>=70,3,IF('+t+'>=65,2.5,IF('+t+'>=60,2,IF('+t+'>=55,1.5,IF('+t+'>=50,1,0)))))))',result:Number(stats.grade)};
                row.height=22;row.font={name:'Tahoma',size:11,color:{argb:'FF000000'}};row.alignment={vertical:'middle'};
                row.getCell(3).numFmt='@';
                row.eachCell({includeEmpty:true},(cell,index)=>{
                    if(index>4)cell.numFmt=index===grade?'0.0':'General';
                });
            });
            sheet.autoFilter={from:{row:1,column:1},to:{row:Math.max(1,sheet.rowCount),column:columns.length}};
            const bytes=await workbook.xlsx.writeBuffer(), blob=new Blob([bytes],{type:'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'});
            const url=URL.createObjectURL(blob), anchor=document.createElement('a');anchor.href=url;
            anchor.download=(template?'แม่แบบคะแนน_':'คะแนน_')+cls.name.replace(/[\\/:*?"<>|]/g,'-')+'.xlsx';
            document.body.appendChild(anchor);anchor.click();anchor.remove();setTimeout(()=>URL.revokeObjectURL(url),1000);
            feedback('ดาวน์โหลดแล้ว เปิดกรอกคะแนนใน Excel ได้โดยไม่ต้องต่ออินเทอร์เน็ต เมื่อกลับมาออนไลน์ให้อัปโหลดไฟล์เพื่ออัปเดตคะแนน');
        }catch(e){feedback(e.message,true);}finally{buttons.forEach(b=>b.disabled=false);}
    }
    let pending=null, reading=false, fileRevision=0;
    function open() {
        try {
            const cls=ensureTeacher();pending=null;reading=false;fileRevision++;document.getElementById('score-files-preview').replaceChildren();
            document.getElementById('score-files-confirm').disabled=true;
            document.getElementById('score-files-room').textContent='ห้องที่เลือก: '+cls.name+' • '+cls.assignments.length+' ชิ้นงาน';
            feedback('ดาวน์โหลดคะแนนปัจจุบันไปแก้ใน Excel แบบออฟไลน์ แล้วอัปโหลดกลับเพื่ออัปเดตคะแนนในห้องนี้');
            document.getElementById('score-files-dialog').showModal();
        }catch(e){showModal({title:'ไฟล์คะแนน Excel',msg:escapeHTML(e.message),type:'alert'});}
    }
    async function importFile(event) {
        const file=event.target.files[0];event.target.value='';if(!file||reading)return;
        const revision=++fileRevision;
        pending=null;document.getElementById('score-files-confirm').disabled=true;
        document.getElementById('score-files-preview').replaceChildren();reading=true;
        try {
            const cls=ensureTeacher(true), base=JSON.stringify(appData);feedback('กำลังอ่านและตรวจไฟล์ ยังไม่มีการบันทึกคะแนน…');
            const tables=await readTables(file), source=JSON.parse(base), plan=planImport(source,tables,cls.id);
            if(revision!==fileRevision || !document.getElementById('score-files-dialog').open)return;
            const preview=document.getElementById('score-files-preview');
            if(plan.errors.length){preview.textContent=plan.errors.join('\n');feedback('พบข้อผิดพลาด กรุณาแก้ไฟล์ก่อนนำเข้า • ยังไม่แก้คะแนนใด ๆ',true);return;}
            preview.textContent=plan.rooms.map(room=>'ห้อง '+room.name+': '+room.students+' คน / '+room.updates+' ช่องที่เปลี่ยน').join('\n')+
                '\nงานใหม่ '+plan.newTasks.length+' งาน'+(plan.newTasks.length?'\n'+plan.newTasks.map(t=>'• ห้อง '+source.classes.find(c=>c.id===t.classId).name+': '+t.name+' (เต็ม '+t.maxScore+')').join('\n'):'')+
                (plan.defaultRoomRows?'\nไฟล์ไม่มีคอลัมน์ห้อง จึงนำเข้าห้อง '+cls.name:'');
            if(!plan.updates.length&&!plan.newTasks.length){feedback('ไม่มีคะแนนเปลี่ยนแปลง ช่องว่างไม่แก้ข้อมูลเดิม');return;}
            const details=document.createElement('details'), summary=document.createElement('summary'), list=document.createElement('div');
            summary.textContent='ดูรายการคะแนนที่เปลี่ยน ('+plan.updates.length+' ช่อง)';
            const display=value=>value===null||value===undefined||value===''?'ยังไม่ส่ง':value==='submitted'?'รอตรวจ':String(value);
            list.textContent=plan.updates.slice(0,100).map(update=>{
                const room=source.classes.find(c=>c.id===update.classId), student=room.students.find(s=>s.id===update.studentId);
                const task=room.assignments.find(a=>a.id===update.taskId)||plan.newTasks.find(a=>a.newKey===update.newKey);
                const name=task?.name||{attendance:'จิตพิสัย',midterm:'กลางภาค',final:'ปลายภาค',bonus:'คะแนนพิเศษจากครู'}[update.field];
                const previous=update.field?student[update.field]:student.scores?.[update.taskId];
                return room.name+' / '+student.studentId+' '+student.name+' / '+name+': '+display(previous)+' → '+display(update.value);
            }).join('\n')+(plan.updates.length>100?'\nแสดง 100 รายการแรกจาก '+plan.updates.length+' ช่อง':'');
            details.append(summary,list);preview.append(details);
            pending={base,plan};document.getElementById('score-files-confirm').disabled=false;
            feedback('ตรวจแล้ว '+plan.studentCount+' คน / '+plan.updates.length+' ช่อง กรุณาตรวจห้องและงานก่อนยืนยัน');
        }catch(e){if(revision===fileRevision)feedback(e.message,true);}finally{if(revision===fileRevision)reading=false;}
    }
    async function confirmImport() {
        if(!pending)return;
        const button=document.getElementById('score-files-confirm');button.disabled=true;
        try {
            ensureTeacher(true);
            if(JSON.stringify(appData)!==pending.base)throw new Error('ข้อมูลในเว็บเปลี่ยนระหว่างตรวจไฟล์ กรุณาเลือกไฟล์อีกครั้งเพื่อเทียบกับคะแนนล่าสุด');
            const next=applyPlan(appData,pending.plan,generateId);pending=null;appData=next;
            // One atomic batch goes through the existing authenticated save queue.
            const saved=saveData();renderTeacherView();document.getElementById('score-files-dialog').close();
            await saved; // The existing save feedback reports confirmed success or retained pending scores.
        }catch(e){pending=null;feedback(e.message,true);}
    }
    document.getElementById('score-files-dialog').addEventListener('close',()=>{fileRevision++;pending=null;reading=false;});
    window.HSScoreFiles={open,download,importFile,confirmImport,planImport,applyPlan,parseCSV,readTables,header};
})();
